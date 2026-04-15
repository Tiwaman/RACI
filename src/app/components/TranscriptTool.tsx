"use client";

import { useState, useEffect } from "react";

interface ActionItem {
  task: string;
  assignedTo: string;
  priority: "High" | "Medium" | "Low";
  dueDate: string | null;
}

const PRIORITY_COLORS: Record<
  string,
  { bg: string; text: string }
> = {
  High: { bg: "bg-red-100 border-red-300", text: "text-red-700" },
  Medium: { bg: "bg-orange-100 border-orange-300", text: "text-orange-700" },
  Low: { bg: "bg-blue-100 border-blue-300", text: "text-blue-700" },
};

export default function TranscriptTool({ onBack }: { onBack: () => void }) {
  const [transcriptText, setTranscriptText] = useState(() => {
    if (typeof window !== "undefined")
      return localStorage.getItem("transcript_text") || "";
    return "";
  });
  const [actionItems, setActionItems] = useState<ActionItem[] | null>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("transcript_results");
      return saved ? JSON.parse(saved) : null;
    }
    return null;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    localStorage.setItem("transcript_text", transcriptText);
  }, [transcriptText]);
  useEffect(() => {
    localStorage.setItem("transcript_results", JSON.stringify(actionItems));
  }, [actionItems]);

  const handleAnalyze = async () => {
    setError("");
    setActionItems(null);

    if (!transcriptText.trim()) {
      setError("Paste a meeting transcript to analyze.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/analyze-transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: transcriptText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed");
      setActionItems(data.actionItems);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    if (!actionItems?.length) return;
    const header = ["#", "Task", "Assigned To", "Priority", "Due Date"].join(
      ","
    );
    const rows = actionItems.map((item, i) =>
      [
        i + 1,
        `"${item.task.replace(/"/g, '""')}"`,
        `"${item.assignedTo}"`,
        item.priority,
        item.dueDate || "",
      ].join(",")
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "meeting-action-items.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 mb-6 cursor-pointer transition-colors"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
        Back to Tools
      </button>

      {/* Input Section */}
      {!actionItems && (
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <label className="block text-sm font-semibold text-slate-800 mb-2">
              Meeting Transcript
            </label>
            <p className="text-xs text-slate-500 mb-3">
              Paste your meeting notes, transcript, or minutes below.
            </p>
            <textarea
              value={transcriptText}
              onChange={(e) => setTranscriptText(e.target.value)}
              rows={14}
              placeholder={`Aman: Let's kick off. Sara, can you finish the landing page redesign by Friday? It's urgent — the launch depends on it.\n\nSara: Sure, I'll prioritize it. I'll need the new assets from Lisa though.\n\nAman: Lisa, can you get those design assets to Sara by Wednesday?\n\nLisa: Yes, I'll have them ready.\n\nAman: John, the API docs need updating before we onboard the new partner. Can you handle that by next week?\n\nJohn: Got it. I'll also set up the staging environment while I'm at it.\n\nAman: Great. Himanshu, please review the security audit report when you get a chance — no rush on that one.`}
              className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none bg-slate-50 placeholder:text-slate-400"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <button
            onClick={handleAnalyze}
            disabled={loading}
            className="w-full py-3 px-6 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-violet-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-violet-200 cursor-pointer"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="animate-spin h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Analyzing transcript...
              </span>
            ) : (
              "Extract Action Items"
            )}
          </button>
        </div>
      )}

      {/* Output Section */}
      {actionItems && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Action Items
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                {actionItems.length} action item
                {actionItems.length !== 1 ? "s" : ""} extracted from transcript
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={exportCSV}
                className="px-4 py-2 text-sm font-medium bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-slate-700 cursor-pointer"
              >
                Export CSV
              </button>
              <button
                onClick={() => setActionItems(null)}
                className="px-4 py-2 text-sm font-medium text-violet-600 border border-violet-200 rounded-lg hover:bg-violet-50 transition-colors cursor-pointer"
              >
                Start Over
              </button>
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3">
            {Object.entries(PRIORITY_COLORS).map(([key, val]) => (
              <div
                key={key}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${val.bg} ${val.text}`}
              >
                {key} Priority
              </div>
            ))}
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left px-5 py-3 font-semibold text-slate-700 w-10">
                    #
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700 min-w-[280px]">
                    Task / Action Item
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700 min-w-[140px]">
                    Assigned To
                  </th>
                  <th className="text-center px-4 py-3 font-semibold text-slate-700 min-w-[100px]">
                    Priority
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700 min-w-[120px]">
                    Due Date
                  </th>
                </tr>
              </thead>
              <tbody>
                {actionItems.map((item, i) => {
                  const pStyle = PRIORITY_COLORS[item.priority];
                  return (
                    <tr
                      key={i}
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50"
                    >
                      <td className="px-5 py-3 text-slate-400 font-mono text-xs">
                        {i + 1}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {item.task}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="w-6 h-6 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                            {item.assignedTo
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .slice(0, 2)
                              .toUpperCase()}
                          </span>
                          {item.assignedTo}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {pStyle && (
                          <span
                            className={`inline-flex items-center justify-center px-2.5 py-1 rounded-lg border text-xs font-semibold ${pStyle.bg} ${pStyle.text}`}
                          >
                            {item.priority}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {item.dueDate || (
                          <span className="text-slate-300">--</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
