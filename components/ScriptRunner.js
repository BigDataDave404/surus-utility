import React, { useState } from "react";
import { ChevronDown, Play, Loader2, Download } from "lucide-react";

const SurusUtilities = () => {
  const [selectedScript, setSelectedScript] = useState("");
  const [inputData, setInputData] = useState("");
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const scripts = {
    "dat-rates": {
      name: "Get DAT Rates",
      description: "Retrieve market rates from DAT API",
      placeholder:
        "Enter lanes (one per line):\nCHICAGO,IL,ATLANTA,GA,VAN\nDALLAS,TX,HOUSTON,TX,REEFER",
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
  };

  const handleSubmit = async () => {
    if (!selectedScript || !inputData.trim()) {
      setError("Please select a script and enter input data");
      return;
    }

    setIsLoading(true);
    setError("");
    setResults([]);

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
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const downloadResults = () => {
    const csvContent = results
      .map((result) =>
        typeof result === "object" ? Object.values(result).join(",") : result
      )
      .join("\n");

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
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-slate-100 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-600 to-blue-700 p-8 text-white">
            <p className="text-blue-200 text-lg"></p>
          </div>

          <div className="p-8 space-y-8">
            <div>
              <label className="block text-lg font-medium text-gray-800 mb-2">
                Choose Script
              </label>
              <div className="relative">
                <select
                  value={selectedScript}
                  onChange={(e) => {
                    setSelectedScript(e.target.value);
                    setInputData("");
                    setResults([]);
                    setError("");
                  }}
                  className="w-full appearance-none p-4 pr-12 rounded-xl border border-gray-300 focus:ring-4 focus:ring-indigo-400 focus:outline-none text-lg"
                >
                  <option value="">Select a script...</option>
                  {Object.entries(scripts).map(([key, script]) => (
                    <option key={key} value={key}>
                      {script.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-4 top-4 h-6 w-6 text-gray-500 pointer-events-none" />
              </div>
              {selectedScript && (
                <p className="mt-2 text-sm text-gray-600">
                  {scripts[selectedScript].description}
                </p>
              )}
            </div>

            {selectedScript && (
              <div>
                <label className="block text-lg font-medium text-gray-800 mb-2">
                  Input Data
                </label>
                <textarea
                  value={inputData}
                  onChange={(e) => setInputData(e.target.value)}
                  placeholder={scripts[selectedScript].placeholder}
                  className="w-full h-48 p-5 text-base border border-gray-300 rounded-xl focus:ring-4 focus:ring-indigo-400 focus:outline-none resize-vertical"
                />
              </div>
            )}

            {selectedScript && (
              <div className="flex flex-wrap gap-4">
                <button
                  onClick={handleSubmit}
                  disabled={isLoading || !inputData.trim()}
                  className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-lg shadow-md"
                >
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Play className="h-5 w-5" />
                  )}
                  {isLoading ? "Processing..." : "Run Script"}
                </button>

                <button
                  onClick={clearAll}
                  className="px-6 py-3 bg-gray-600 text-white rounded-xl hover:bg-gray-700 text-lg shadow-md"
                >
                  Clear All
                </button>
              </div>
            )}

            {error && (
              <div className="p-4 bg-red-100 border border-red-300 text-red-700 rounded-xl">
                <p className="font-semibold">Error: {error}</p>
              </div>
            )}

            {results.length > 0 && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-bold text-gray-800">Results</h3>
                  <button
                    onClick={downloadResults}
                    className="flex items-center gap-2 px-5 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 text-sm shadow"
                  >
                    <Download className="h-4 w-4" /> Download CSV
                  </button>
                </div>

                <div className="bg-gray-100 rounded-xl p-5 max-h-96 overflow-auto text-sm">
                  <pre className="whitespace-pre-wrap text-gray-800">
                    {results.map((result, index) => (
                      <div
                        key={index}
                        className="py-1 border-b border-gray-200 last:border-b-0"
                      >
                        {typeof result === "object"
                          ? JSON.stringify(result, null, 2)
                          : result}
                      </div>
                    ))}
                  </pre>
                </div>
              </div>
            )}

            {isLoading && (
              <div className="flex justify-center items-center p-8">
                <div className="flex items-center gap-3 text-indigo-600">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="text-lg font-medium">Processing...</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SurusUtilities;
