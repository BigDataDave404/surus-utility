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

// Rate limiter utility
function rateLimit(tasks, callsPerSecond) {
  const interval = 1000 / callsPerSecond;
  let index = 0;
  let results = [];

  return new Promise((resolve) => {
    function next() {
      if (index >= tasks.length) {
        Promise.allSettled(results).then(resolve);
        return;
      }
      results.push(tasks[index++]());
      if (index < tasks.length) {
        setTimeout(next, interval);
      }
    }
    next();
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const startTime = Date.now();

  try {
    const token = await getTurvoToken();
    const { inputData } = req.body;

    // Prepare tasks for all MC numbers
    const tasks = inputData.map((mcNumber) => async () => {
      try {
        // Get carrier ID
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
        const carrierData = await carrierResponse.json();
        const carrierID = findCarrierID(carrierData);
        if (!carrierID) {
          return `MC ${mcNumber}: Carrier not found`;
        }
        // Tag carrier
        const tagResponse = await fetch(
          `https://publicapi.turvo.com/v1/tags/attach/carrier/${carrierID}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": process.env.PRODUCTION_API_KEY,
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ tagNames: ["donotuse"] }),
          }
        );
        return `MC ${mcNumber}: ${
          tagResponse.ok ? "Tagged successfully" : "Tagging failed"
        }`;
      } catch (error) {
        return `MC ${mcNumber}: Error - ${error.message}`;
      }
    });

    // Run all tagging tasks with a call limiter (39 calls per second)
    const resultsSettled = await rateLimit(tasks, 39);
    const results = resultsSettled.map((r) =>
      r.status === "fulfilled" ? r.value : `Error: ${r.reason}`
    );

    const endTime = Date.now();
    const durationSeconds = ((endTime - startTime) / 1000).toFixed(2);

    res.status(200).json({ results, durationSeconds });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
