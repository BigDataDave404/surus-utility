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

function formatAddress(addr) {
  if (!addr) return "N/A";
  return `${addr.line1 || ""}, ${addr.city || ""}, ${addr.state || ""}, ${
    addr.zip || ""
  }, ${addr.country || ""}`
    .replace(/,\s*,/g, ", ")
    .replace(/,\s*$/, "");
}

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

    const tasks = inputData.map((mcNumber) => async () => {
      try {
        const carrierRes = await fetch(
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
        if (!carrierRes.ok) {
          const text = await carrierRes.text();
          return {
            mcNumber,
            status: "error",
            message: `Carrier lookup failed - ${text}`,
          };
        }

        const carrierData = await carrierRes.json();
        const carrierID = findCarrierID(carrierData);
        if (!carrierID) {
          return {
            mcNumber,
            status: "error",
            message: "Carrier not found",
          };
        }

        const detailsRes = await fetch(
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
        if (!detailsRes.ok) {
          const text = await detailsRes.text();
          return {
            mcNumber,
            status: "error",
            message: `Details fetch failed - ${text}`,
          };
        }

        const data = await detailsRes.json();
        const c = data.details;

        return {
          id: c.id,
          name: c.name || "N/A",
          status:
            c.status?.code?.value ||
            "Unknown Carrier Status (Active/Suspended/Inactive)",
          mcNumber: c.mcNumber || "N/A",
          dotNumber: c.dotNumber || "N/A",
          address: formatAddress(c.address?.find((a) => a.isPrimary)),
          equipment:
            c.equipment
              ?.map((e) => `${e.qty} - ${e.type?.value}`) //${e.size?.value} extra code//
              .join(", ") || "N/A",
          insurance:
            c.insurance
              ?.map(
                (i) =>
                  `${i.type?.value}: $${Number(
                    i.amount
                  ).toLocaleString()} (Exp: ${i.expirationDate})`
              )
              .join("; ") || "N/A",
          commonAuthority: c.authority?.commonAuthority ?? "N/A",
          contractAuthority: c.authority?.contractAuthority ?? "N/A",
          email:
            c.email.find((e) => e.isPrimary)?.email ||
            c.email[0].email ||
            "N/A",
          phone: c.phone?.find((p) => p.isPrimary)?.number || "N/A",
        };
      } catch (error) {
        return {
          mcNumber,
          status: "error",
          message: error.message,
        };
      }
    });

    const resultsSettled = await runWithConcurrency(tasks, 39, 1000);
    const results = resultsSettled.map((r) =>
      r.status === "fulfilled"
        ? r.value
        : { status: "error", message: r.reason }
    );

    const endTime = Date.now();
    const durationSeconds = ((endTime - startTime) / 1000).toFixed(2);
    res.status(200).json({ results, durationSeconds });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
