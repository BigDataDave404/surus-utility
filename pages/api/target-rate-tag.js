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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const token = await getTurvoToken();
    const { inputData } = req.body;
    const results = [];

    for (const line of inputData) {
      const [shipmentID, minPay, tag] = line.split(",").map((x) => x.trim());

      if (!shipmentID || !minPay || !tag) {
        results.push(`Skipping invalid entry: ${line}`);
        continue;
      }

      // Set target rate
      const rateResponse = await fetch(
        `https://publicapi.turvo.com/v1/shipments/${shipmentID}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": process.env.PRODUCTION_API_KEY,
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            margin: { minPay: parseFloat(minPay) },
          }),
        }
      );

      // Apply tag
      const tagResponse = await fetch(
        `https://publicapi.turvo.com/v1/tags/attach/shipment/${shipmentID}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": process.env.PRODUCTION_API_KEY,
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ tagNames: [tag] }),
        }
      );

      results.push(
        `${shipmentID}: MinPay=${minPay}, Tag=${tag} - ${
          rateResponse.ok && tagResponse.ok ? "Success" : "Failed"
        }`
      );
    }

    res.status(200).json({ results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
