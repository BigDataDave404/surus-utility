import dotenv from "dotenv";
dotenv.config();

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

// Concurrency limiter: runs up to 'limit' tasks in parallel, with delay between batches
async function runWithConcurrency(tasks, limit, delayMs) {
  const results = [];
  let i = 0;
  while (i < tasks.length) {
    const batch = tasks.slice(i, i + limit).map((fn) => fn());
    // Wait for this batch to finish
    // Use Promise.allSettled to capture all results
    // eslint-disable-next-line no-await-in-loop
    const batchResults = await Promise.allSettled(batch);
    results.push(...batchResults);
    i += limit;
    if (i < tasks.length) {
      // eslint-disable-next-line no-await-in-loop
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

    // Prepare tasks for all MC numbers
    const tasks = inputData.map((mcNumber) => async () => {
      try {
        // Get carrier ID by MC number
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
        // Get carrier details
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

    // Run all tasks with a concurrency limit of 39 per second
    const resultsSettled = await runWithConcurrency(tasks, 39, 1000);
    // Map to UI-friendly results
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
