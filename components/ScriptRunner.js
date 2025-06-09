import React, { useState } from "react";
import { ChevronDown, Play, Loader2, Download } from "lucide-react";

const LogisticsAPITool = () => {
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
        "Enter lanes (one per line):\nCHICAGO,IL,ATLANTA,GA,V\nDALLAS,TX,HOUSTON,TX,R",
      endpoint: "/api/dat-rates",
    },
    "target-rate-tag": {
      name: "Enter Target Rate & Tag",
      description: "Set target rates and apply tags to shipments",
      placeholder:
        "Enter ShipmentID,MinPay,Tag (one per line):\nSHIP123,1500,OPS1\nSHIP456,2000,OPS2",
      endpoint: "/api/target-rate-tag",
    },
    "tag-carrier": {
      name: "Tag Carrier Do Not Use",
      description: 'Mark carriers with "donotuse" tag',
      placeholder: "Enter MC Numbers (one per line):\nMC123456\nMC789012",
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-white">
            <h1 className="text-3xl font-bold mb-2">Logistics API Tool</h1>
            <p className="text-blue-100">
              Manage DAT rates, shipment targets, and carrier tags
            </p>
          </div>

          {/* Main Content */}
          <div className="p-6">
            <div className="space-y-6">
              {/* Script Selection */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">
                  Select Script
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
                    className="w-full p-3 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
                  >
                    <option value="">Choose a script...</option>
                    {Object.entries(scripts).map(([key, script]) => (
                      <option key={key} value={key}>
                        {script.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-3.5 h-5 w-5 text-gray-400 pointer-events-none" />
                </div>
                {selectedScript && (
                  <p className="text-sm text-gray-600 mt-2">
                    {scripts[selectedScript].description}
                  </p>
                )}
              </div>

              {/* Input Area */}
              {selectedScript && (
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    Input Data
                  </label>
                  <textarea
                    value={inputData}
                    onChange={(e) => setInputData(e.target.value)}
                    placeholder={scripts[selectedScript].placeholder}
                    className="w-full h-40 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical"
                  />
                </div>
              )}

              {/* Action Buttons */}
              {selectedScript && (
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={isLoading || !inputData.trim()}
                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                    {isLoading ? "Processing..." : "Run Script"}
                  </button>

                  <button
                    type="button"
                    onClick={clearAll}
                    className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors font-medium"
                  >
                    Clear All
                  </button>
                </div>
              )}
            </div>

            {/* Error Display */}
            {error && (
              <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-700 font-medium">Error: {error}</p>
              </div>
            )}

            {/* Results Display */}
            {results.length > 0 && (
              <div className="mt-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">
                    Results
                  </h3>
                  <button
                    onClick={downloadResults}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                  >
                    <Download className="h-4 w-4" />
                    Download CSV
                  </button>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-auto">
                  <pre className="text-sm text-gray-800 whitespace-pre-wrap">
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

            {/* Loading State */}
            {isLoading && (
              <div className="mt-6 flex items-center justify-center p-8">
                <div className="flex items-center gap-3 text-blue-600">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="font-medium">
                    Processing your request...
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-gray-600 text-sm">
          <p>Logistics API Tool - Streamline your operations</p>
        </div>
      </div>
    </div>
  );
};

export default LogisticsAPITool;
