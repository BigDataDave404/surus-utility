import dotenv from "dotenv";
dotenv.config();

const ORG_TOKEN_URL =
  "https://identity.api.dat.com/access/v1/token/organization";
const USER_TOKEN_URL = "https://identity.api.dat.com/access/v1/token/user";
const LANE_RATE_URL = "https://analytics.api.dat.com/linehaulrates/v1/lookups";

// Token management functions (simplified for serverless)
async function getTokens() {
  // Get org token
  const orgRes = await fetch(ORG_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: process.env.SERVICE_ACCOUNT_EMAIL,
      password: process.env.SERVICE_ACCOUNT_PASSWORD,
    }),
  });
  const orgData = await orgRes.json();

  // Get user token
  const userRes = await fetch(USER_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${orgData.accessToken}`,
    },
    body: JSON.stringify({ username: process.env.DAT_USERNAME }),
  });
  const userData = await userRes.json();

  return userData.accessToken;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const userToken = await getTokens();
    const { inputData } = req.body;
    const results = [];

    for (const line of inputData) {
      const parts = line.split(",").map((s) => s.trim().toUpperCase());
      if (parts.length !== 5) {
        results.push(`${line}: Invalid format`);
        continue;
      }

      const [originCity, originState, destCity, destState, equipment] = parts;

      const response = await fetch(LANE_RATE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify([
          {
            origin: { city: originCity, stateOrProvince: originState },
            destination: { city: destCity, stateOrProvince: destState },
            rateType: "SPOT",
            equipment: equipment,
            includeMyRate: false,
            targetEscalation: { escalationType: "BEST_FIT" },
          },
        ]),
      });

      if (response.ok) {
        const data = await response.json();
        const rate = data?.rateResponses?.[0]?.response?.rate;
        if (rate) {
          results.push(
            `${parts.join(",")}:${rate.mileage},${rate.perTrip.rateUsd},${
              rate.perTrip.lowUsd
            },${rate.averageFuelSurchargePerTripUsd}`
          );
        } else {
          results.push(`${parts.join(",")}: No data returned`);
        }
      } else {
        results.push(`${parts.join(",")}: API error ${response.status}`);
      }
    }

    res.status(200).json({ results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
