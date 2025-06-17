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
      csvContent = [
        "MC Number,Status,Name,Carrier Status,Address,DOT Number,Common Authority,Contract Authority,Broker Authority",
        ...results.map((result) => {
          if (typeof result === "object") {
            return [
              result.mcNumber,
              result.status,
              result.name,
              result.id,
              result.carrierStatus,
              result.address,
              result.email,
              result.phone,
              result.dotNumber,
              result.commonAuthority,
              result.contractAuthority,
              result.brokerAuthority,
            ]
              .map((v) => (v ? String(v).replace(/,/g, " ") : ""))
              .join(",");
          } else {
            return "Invalid result";
          }
        }),
      ].join("\n");
    } else {
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
                  <div className="su-results-content">
                    {results.map((result, index) => {
                      if (selectedScript === "dat-rates") {
                        return (
                          <div key={index} className="su-result-row">
                            {typeof result === "object"
                              ? Object.values(result).join(", ")
                              : result}
                          </div>
                        );
                      }

                      if (
                        selectedScript === "tag-carrier" ||
                        selectedScript === "target-rate-tag"
                      ) {
                        const isSuccess =
                          typeof result === "string"
                            ? /success/i.test(result)
                            : result.status === "success" ||
                              /success/i.test(result.message);
                        return (
                          <div key={index} className="su-result-row">
                            <span>
                              {isSuccess ? "✅" : "❌"} MC{" "}
                              {result.mcNumber || result.shipmentID || ""}:{" "}
                              {result.message || result}
                            </span>
                          </div>
                        );
                      }

                      if (selectedScript === "check-mc") {
                        if (
                          typeof result === "object" &&
                          result.status !== "error"
                        ) {
                          return (
                            <div key={index} className="su-result-row">
                              <div>
                                <b>Status:</b> {result.status}
                              </div>
                              <div>
                                <b>Name:</b> {result.name}
                              </div>
                              <div>
                                <b>Carrier ID:</b> {result.id}
                              </div>
                              <div>
                                <b>Carrier Status:</b> {result.carrierStatus}
                              </div>
                              <div>
                                <b>MC Number:</b> {result.mcNumber}
                              </div>
                              <div>
                                <b>DOT Number:</b> {result.dotNumber}
                              </div>
                              <div>
                                <b>Address:</b> {result.address}
                              </div>
                              <div>
                                <b>Email:</b> {result.email}
                              </div>
                              <div>
                                <b>Phone:</b> {result.phone}
                              </div>
                            </div>
                          );
                        } else {
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

                      return (
                        <div key={index} className="su-result-row">
                          <span>❓ {String(result)}</span>
                        </div>
                      );
                    })}
                  </div>
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
