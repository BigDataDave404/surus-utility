import dotenv from "dotenv";
dotenv.config();

// Fetch Turvo token
async function getTurvoToken() {
  const response = await fetch(
    "https://publicapi.turvo.com/v1/oauth/token?client_id=publicapi&client_secret=secret",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.PRODUCTION_API_KEY,
      },
      body: JSON.stringify({
        grant_type: "password",
        username: process.env.PRODUCTION_USERNAME,
        password: process.env.PRODUCTION_PASSWORD,
        scope: "read+trust+write",
        type: "business",
      }),
    }
  );
  const data = await response.json();
  return data.access_token;
}

// Recursive function to find carrier ID
function findCarrierID(obj) {
  if (typeof obj !== "object" || obj === null) return null;
  if ("id" in obj && "mcNumber" in obj && "name" in obj) return obj.id;
  for (let key in obj) {
    if (obj.hasOwnProperty(key)) {
      const result = findCarrierID(obj[key]);
      if (result) return result;
    }
  }
  return null;
}

// Concurrency limiter
async function runWithConcurrency(tasks, limit, delayMs) {
  const results = [];
  let i = 0;
  while (i < tasks.length) {
    const batch = tasks.slice(i, i + limit).map((fn) => fn());
    const batchResults = await Promise.allSettled(batch);
    results.push(...batchResults);
    i += limit;
    if (i < tasks.length) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return results;
}

// Format output cleanly for the UI
function formatAddress(addr) {
  if (!addr) return "N/A";
  return `${addr.line1 || ""}, ${addr.city || ""}, ${addr.state || ""}, ${
    addr.zip || ""
  }, ${addr.country || ""}`;
}

function extractCarrierFields(result) {
  const carrier = result?.details?.details;

  if (!carrier) {
    console.error("No carrier details found:", result);
    return {
      mcNumber: result.mcNumber,
      status: "error",
      message: "Carrier details missing",
    };
  }

  return {
    mcNumber: result.mcNumber,
    status: result.status,
    name: carrier.name || "N/A",
    carrierStatus: carrier.status?.description || "Unknown",
    mcNumberConfirmed: carrier.mcNumber || "N/A",
    dotNumber: carrier.dotNumber || "N/A",
    address: formatAddress(carrier.address?.find((addr) => addr.isPrimary)),
    equipment:
      carrier.equipment
        ?.map((e) => `${e.qty}x ${e.size?.value} ${e.type?.value}`)
        .join(", ") || "N/A",
    insurance:
      carrier.insurance
        ?.map(
          (i) =>
            `${i.type?.value}: $${i.amount.toLocaleString()} (Exp: ${
              i.expirationDate
            })`
        )
        .join("; ") || "N/A",
    commonAuthority: carrier.authority?.commonAuthority || "N/A",
    contractAuthority: carrier.authority?.contractAuthority || "N/A",
    brokerAuthority: carrier.authority?.brokerAuthority || "N/A",
  };
}

// API handler
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const startTime = Date.now();

  try {
    const token = await getTurvoToken();
    const { inputData } = req.body;

    if (!Array.isArray(inputData) || inputData.length === 0) {
      return res
        .status(400)
        .json({ error: "inputData must be a non-empty array" });
    }

    // Task for each MC number
    const tasks = inputData.map((mcNumber) => async () => {
      try {
        const carrierResponse = await fetch(
          `https://publicapi.turvo.com/v1/carriers/list?mcNumber[eq]=${mcNumber}`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": process.env.PRODUCTION_API_KEY,
              Authorization: `Bearer ${token}`,
            },
          }
        );
        const carrierContentType =
          carrierResponse.headers.get("content-type") || "";
        if (
          !carrierResponse.ok ||
          !carrierContentType.includes("application/json")
        ) {
          const text = await carrierResponse.text();
          return {
            mcNumber,
            status: "error",
            message: `Carrier lookup failed - ${text}`,
          };
        }
        const carrierData = await carrierResponse.json();
        const carrierID = findCarrierID(carrierData);
        if (!carrierID) {
          return { mcNumber, status: "error", message: "Carrier not found" };
        }

        const detailsResponse = await fetch(
          `https://publicapi.turvo.com/v1/carriers/${carrierID}`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": process.env.PRODUCTION_API_KEY,
              Authorization: `Bearer ${token}`,
            },
          }
        );
        const detailsContentType =
          detailsResponse.headers.get("content-type") || "";
        if (
          !detailsResponse.ok ||
          !detailsContentType.includes("application/json")
        ) {
          const text = await detailsResponse.text();
          return {
            mcNumber,
            status: "error",
            message: `Details fetch failed - ${text}`,
          };
        }
        const details = await detailsResponse.json();
        return { mcNumber, status: "SUCCESS DUDE", details };
      } catch (error) {
        return { mcNumber, status: "error", message: error.message };
      }
    });

    const resultsSettled = await runWithConcurrency(tasks, 39, 1000);
    const resultsRaw = resultsSettled.map((r) =>
      r.status === "fulfilled"
        ? r.value
        : { status: "error", message: r.reason }
    );

    // Transform results for UI
    const results = resultsRaw.map(extractCarrierFields);

    const endTime = Date.now();
    const durationSeconds = ((endTime - startTime) / 1000).toFixed(2);

    res.status(200).json({ results, durationSeconds });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
