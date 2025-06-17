import { useState } from "react";
import {
  ChevronDown,
  Play,
  Loader2,
  Download,
  AlignCenter,
} from "lucide-react";

const SurusUtilities = () => {
  const [selectedScript, setSelectedScript] = useState("");
  const [inputData, setInputData] = useState("");
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [durationSeconds, setDurationSeconds] = useState(null);

  const scripts = {
    "dat-rates": {
      name: "Get DAT Rates",
      description: "Retrieve market rates from DAT API",
      placeholder:
        "Enter lanes (one per line):\nCHICAGO,IL,ATLANTA,GA,VAN\nDALLAS,TX,HOUSTON,TX,REEFER\nNEW HAVEN CT,NEW YORK,NY,FLATBEDS",
      endpoint: "/api/dat-rates",
    },
    "target-rate-tag": {
      name: "Enter Target Rate & Tag",
      description: "Set target rates and apply tags to shipments",
      placeholder:
        "Enter ShipmentID,MinPay,Tag (one per line):\n993432,1500,OPS1\n921028,2000,OPS2",
      endpoint: "/api/target-rate-tag",
    },
    "tag-carrier": {
      name: "Tag Carrier Do Not Use",
      description: 'Mark carriers with "donotuse" tag',
      placeholder:
        "Enter MC Numbers (one per line excluding MC):\n123456\n789012",
      endpoint: "/api/tag-carrier",
    },
    "check-mc": {
      name: "Check MC Status",
      description: "Reference MC numbers in Turvo and MCP",
      placeholder:
        "Enter MC Numbers (one per line excluding MC):\n123456\n789012",
      endpoint: "/api/check-mc",
    },
  };

  const handleSubmit = async () => {
    if (!selectedScript || !inputData.trim()) {
      setError("Please select a script and enter input data");
      return;
    }

    setIsLoading(true);
    setError("");
    setResults([]);
    setDurationSeconds(null);

    try {
      const response = await fetch(scripts[selectedScript].endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputData: inputData
            .trim()
            .split("\n")
            .filter((line) => line.trim()),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "API request failed");
      }

      setResults(data.results || []);
      if (data.durationSeconds) {
        setDurationSeconds(data.durationSeconds);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const downloadResults = () => {
    let csvContent = "";
    if (selectedScript === "check-mc") {
      // CSV header for check-mc
      csvContent = [
        "MC Number,Status,ID,Name,Status Value,Address,Phone,MC Number,DOT Number,Common Authority,Contract Authority,Broker Authority",
        ...results.map((result) => {
          if (typeof result === "object" && result.details) {
            const fields = extractCheckMCFields(result);
            return [
              fields.mcNumber,
              fields.status,
              fields.id,
              fields.name,
              fields.statusValue,
              fields.address,
              fields.phone,
              fields.mcNumber,
              fields.dotNumber,
              fields.authority.commonAuthority,
              fields.authority.contractAuthority,
              fields.authority.brokerAuthority,
            ]
              .map((v) => (v ? String(v).replace(/,/g, " ") : ""))
              .join(",");
          } else if (typeof result === "object") {
            // error case
            return [
              result.mcNumber || "",
              result.status || "error",
              "",
              "",
              "",
              "",
              "",
              "",
              "",
              "",
              "",
              result.message || "No details found",
            ].join(",");
          }
          return "";
        }),
      ].join("\n");
    } else {
      // Fallback for other scripts: join all object values or use string
      csvContent = results
        .map((result) =>
          typeof result === "object" ? Object.values(result).join(",") : result
        )
        .join("\n");
    }

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedScript}-results.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const clearAll = () => {
    setSelectedScript("");
    setInputData("");
    setResults([]);
    setError("");
    setDurationSeconds(null);
  };

  // Helper to extract key fields from check-mc details
  function extractCheckMCFields(result) {
    const mainDetails = result.details?.details || {};
    const address = Array.isArray(mainDetails.address)
      ? mainDetails.address[0] || {}
      : {};

    return {
      // Top-level status (e.g., "SUCCESS DUDE")
      status: result.status || "N/A",

      // Carrier ID
      id: mainDetails.id || "N/A",

      // Carrier name
      name: mainDetails.name || "N/A",

      // Status from nested structure (description or fallback)
      statusValue:
        mainDetails.status?.description ||
        mainDetails.status?.code?.value ||
        result.details?.Status ||
        "N/A",

      // Address composed from line1, city, state
      address: [address.line1, address.city, address.state]
        .filter(Boolean)
        .join(", "),

      // Phone number logic (if any available)
      phone:
        Array.isArray(mainDetails.phone) && mainDetails.phone[0]
          ? mainDetails.phone[0].phone || mainDetails.phone[0].number || ""
          : "",

      // MC number directly from result or mainDetails
      mcNumber: mainDetails.mcNumber || result.mcNumber || "N/A",

      // DOT number
      dotNumber: mainDetails.dotNumber || "N/A",

      // Authority breakdown
      authority: {
        commonAuthority: mainDetails.authority?.commonAuthority || "",
        contractAuthority: mainDetails.authority?.contractAuthority || "",
        brokerAuthority: mainDetails.authority?.brokerAuthority || "",
      },
    };
  }

  return (
    <div className="su-bg">
      <div className="su-container">
        <div className="su-card">
          <div className="su-header">
            <h2 className="su-title">Surus Utilities</h2>
            <p className="su-subtitle">
              Manage DAT Rates, Target Rates, Carrier DNU Tags and Carrier MC
              Status
            </p>
          </div>

          <div className="su-content">
            <div>
              {/* <label className="su-label">Choose Script</label> */}
              <div className="su-select-wrapper">
                <select
                  value={selectedScript}
                  onChange={(e) => {
                    setSelectedScript(e.target.value);
                    setInputData("");
                    setResults([]);
                    setError("");
                    setDurationSeconds(null);
                  }}
                  className="su-select"
                >
                  <option value="">Select a script...</option>
                  {Object.entries(scripts).map(([key, script]) => (
                    <option key={key} value={key}>
                      {script.name}
                    </option>
                  ))}
                </select>
                {/* <span className="su-chevron">
                  <ChevronDown size={24} color="#888" />
                </span> */}
              </div>
              {selectedScript && (
                <p className="su-description">
                  {scripts[selectedScript].description}
                </p>
              )}
            </div>

            {selectedScript && (
              <div>
                <label className="su-label">Input Data</label>
                <textarea
                  value={inputData}
                  onChange={(e) => setInputData(e.target.value)}
                  placeholder={scripts[selectedScript].placeholder}
                  className="su-textarea"
                />
              </div>
            )}

            {selectedScript && (
              <div className="su-actions">
                <button
                  onClick={handleSubmit}
                  disabled={isLoading || !inputData.trim()}
                  className="su-btn su-btn-primary"
                >
                  {isLoading ? <Loader2 className="su-icon-spin" /> : <Play />}
                  {isLoading ? "Processing..." : "Run Script"}
                </button>

                <button onClick={clearAll} className="su-btn su-btn-secondary">
                  Clear All
                </button>
              </div>
            )}

            {error && (
              <div className="su-error">
                <p>
                  <strong>Error:</strong> {error}
                </p>
              </div>
            )}

            {results.length > 0 && (
              <div>
                <div className="su-results-header">
                  <h3 className="su-results-title">Results</h3>
                  {durationSeconds && (
                    <span className="su-results-timer">
                      Time: {durationSeconds} seconds
                    </span>
                  )}
                  <button
                    onClick={downloadResults}
                    className="su-btn su-btn-download"
                  >
                    <Download /> Download CSV
                  </button>
                </div>

                <div className="su-results">
                  <pre>
                    {results.map((result, index) => {
                      // DAT RATES: legacy string or object with lane info
                      if (selectedScript === "dat-rates") {
                        if (typeof result === "string") {
                          return (
                            <div key={index} className="su-result-row">
                              {result}
                            </div>
                          );
                        }
                        if (typeof result === "object") {
                          return (
                            <div key={index} className="su-result-row">
                              {Object.values(result).join(", ")}
                            </div>
                          );
                        }
                      }

                      // TAG-CARRIER or TARGET-RATE-TAG: simple status
                      if (
                        selectedScript === "tag-carrier" ||
                        selectedScript === "target-rate-tag"
                      ) {
                        if (typeof result === "string") {
                          const isSuccess = /success/i.test(result);
                          return (
                            <div key={index} className="su-result-row">
                              <span>
                                {isSuccess ? "✅" : "❌"} {result}
                              </span>
                            </div>
                          );
                        }
                        if (typeof result === "object") {
                          const isSuccess =
                            result.status === "success" ||
                            /success/i.test(result.message);
                          return (
                            <div key={index} className="su-result-row">
                              <span>
                                {isSuccess ? "✅" : "❌"} MC{" "}
                                {result.mcNumber || result.shipmentID || ""}:{" "}
                                {result.message || ""}
                              </span>
                            </div>
                          );
                        }
                      }

                      // CHECK-MC: show selected fields
                      if (selectedScript === "check-mc") {
                        console.log("check-mc result:", result);
                        if (typeof result === "object" && result.details) {
                          const fields = extractCheckMCFields(result);
                          return (
                            <div key={index} className="su-result-row">
                              <div>
                                <b>Status:</b> {fields.status}
                              </div>
                              <div>
                                <b>Name:</b> {fields.name}
                              </div>
                              <div>
                                <b>Carrier Status:</b> {fields.statusValue}
                              </div>
                              <div>
                                <b>MC Number:</b> {fields.mcNumber}
                              </div>
                              <div>
                                <b>DOT Number:</b> {fields.dotNumber}
                              </div>
                              <div>
                                <b>Address:</b> {fields.address}
                              </div>
                              <div>
                                <b>ID:</b> {fields.id}
                              </div>
                              {/* For debugging, you can also log or display the raw address object */}
                              {/* <pre>{JSON.stringify(fields.addressObj, null, 2)}</pre> */}
                            </div>
                          );
                        } else if (typeof result === "object") {
                          // error case
                          return (
                            <div key={index} className="su-result-row">
                              <span>
                                ❌ MC {result.mcNumber || ""}:{" "}
                                {result.message || "No details found"}
                              </span>
                            </div>
                          );
                        }
                      }

                      // Fallback
                      return (
                        <div key={index} className="su-result-row">
                          <span>❓ {String(result)}</span>
                        </div>
                      );
                    })}
                  </pre>
                </div>
              </div>
            )}

            {isLoading && (
              <div className="su-loading">
                <Loader2 className="su-icon-spin" />
                <span>Processing...</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SurusUtilities;
