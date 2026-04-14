"use client";

import { useState, useRef } from "react";

interface Assignment {
  role: "R" | "A" | "C" | "I" | null;
  reason: string;
}

interface MatrixRow {
  task: string;
  assignments: Record<string, Assignment>;
}

const ROLE_COLORS: Record<string, { bg: string; text: string; label: string }> =
  {
    R: {
      bg: "bg-red-100 border-red-300",
      text: "text-red-700",
      label: "Responsible",
    },
    A: {
      bg: "bg-orange-100 border-orange-300",
      text: "text-orange-700",
      label: "Accountable",
    },
    C: {
      bg: "bg-blue-100 border-blue-300",
      text: "text-blue-700",
      label: "Consulted",
    },
    I: {
      bg: "bg-gray-100 border-gray-300",
      text: "text-gray-500",
      label: "Informed",
    },
  };

export default function Home() {
  const [tasksText, setTasksText] = useState("");
  const [membersText, setMembersText] = useState("");
  const [matrix, setMatrix] = useState<MatrixRow[] | null>(null);
  const [memberNames, setMemberNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tooltip, setTooltip] = useState<{
    text: string;
    x: number;
    y: number;
  } | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  const parseMember = (
    line: string
  ): { name: string; role: string } | null => {
    const separators = [" — ", " - ", " – ", ": ", ", "];
    for (const sep of separators) {
      const idx = line.indexOf(sep);
      if (idx > 0) {
        return {
          name: line.slice(0, idx).trim(),
          role: line.slice(idx + sep.length).trim(),
        };
      }
    }
    return null;
  };

  const handleGenerate = async () => {
    setError("");
    setMatrix(null);

    const tasks = tasksText
      .split("\n")
      .map((l) => l.replace(/^\d+[\.\)]\s*/, "").trim())
      .filter(Boolean);
    const members = membersText
      .split("\n")
      .map((l) => parseMember(l.replace(/^[-•*]\s*/, "").trim()))
      .filter(Boolean) as { name: string; role: string }[];

    if (!tasks.length) {
      setError("Add at least one task.");
      return;
    }
    if (!members.length) {
      setError(
        'Add at least one team member with role (e.g. "Aman — Project Manager").'
      );
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/generate-raci", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tasks, members }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      setMatrix(data.matrix);
      setMemberNames(members.map((m) => m.name));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    if (!matrix || !memberNames.length) return;
    const header = ["Task", ...memberNames].join(",");
    const rows = matrix.map((row) => {
      const cells = memberNames.map(
        (name) => row.assignments[name]?.role || ""
      );
      return [`"${row.task.replace(/"/g, '""')}"`, ...cells].join(",");
    });
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "raci-matrix.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCellHover = (
    e: React.MouseEvent,
    reason: string | undefined
  ) => {
    if (!reason) return;
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setTooltip({
      text: reason,
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
    });
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">
              R
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">
                AI RACI Assigner
              </h1>
              <p className="text-xs text-slate-500">
                Paste tasks + team, get a RACI matrix instantly
              </p>
            </div>
          </div>
          {matrix && (
            <button
              onClick={exportCSV}
              className="px-4 py-2 text-sm font-medium bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-slate-700 cursor-pointer"
            >
              Export CSV
            </button>
          )}
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Input Section */}
        {!matrix && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <label className="block text-sm font-semibold text-slate-800 mb-2">
                Tasks
              </label>
              <p className="text-xs text-slate-500 mb-3">
                One task per line. Numbering is optional.
              </p>
              <textarea
                value={tasksText}
                onChange={(e) => setTasksText(e.target.value)}
                rows={6}
                placeholder={`1. Design the landing page\n2. Set up CI/CD pipeline\n3. Write API documentation\n4. Conduct user interviews`}
                className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none bg-slate-50 placeholder:text-slate-400"
              />
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <label className="block text-sm font-semibold text-slate-800 mb-2">
                Team Members
              </label>
              <p className="text-xs text-slate-500 mb-3">
                One per line: Name — Role
              </p>
              <textarea
                value={membersText}
                onChange={(e) => setMembersText(e.target.value)}
                rows={5}
                placeholder={`Aman — Project Manager\nSara — Frontend Developer\nJohn — Backend Developer\nLisa — UX Designer`}
                className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none bg-slate-50 placeholder:text-slate-400"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            <button
              onClick={handleGenerate}
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
                  AI is thinking...
                </span>
              ) : (
                "Generate RACI Matrix"
              )}
            </button>
          </div>
        )}

        {/* Output Section */}
        {matrix && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  RACI Matrix
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Hover over a cell to see why that role was assigned
                </p>
              </div>
              <button
                onClick={() => setMatrix(null)}
                className="px-4 py-2 text-sm font-medium text-violet-600 border border-violet-200 rounded-lg hover:bg-violet-50 transition-colors cursor-pointer"
              >
                Start Over
              </button>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-3">
              {Object.entries(ROLE_COLORS).map(([key, val]) => (
                <div
                  key={key}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${val.bg} ${val.text}`}
                >
                  <span className="font-bold">{key}</span>
                  <span>{val.label}</span>
                </div>
              ))}
            </div>

            {/* Table */}
            <div
              ref={tableRef}
              className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto"
            >
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-left px-5 py-3 font-semibold text-slate-700 sticky left-0 bg-slate-50 min-w-[200px]">
                      Task
                    </th>
                    {memberNames.map((name) => (
                      <th
                        key={name}
                        className="px-4 py-3 font-semibold text-slate-700 text-center min-w-[120px]"
                      >
                        {name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matrix.map((row, i) => (
                    <tr
                      key={i}
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50"
                    >
                      <td className="px-5 py-3 font-medium text-slate-800 sticky left-0 bg-white">
                        {row.task}
                      </td>
                      {memberNames.map((name) => {
                        const assignment = row.assignments[name];
                        const role = assignment?.role;
                        const style = role ? ROLE_COLORS[role] : null;
                        return (
                          <td key={name} className="px-4 py-3 text-center">
                            {role && style ? (
                              <span
                                className={`inline-flex items-center justify-center w-9 h-9 rounded-lg border font-bold text-sm cursor-default ${style.bg} ${style.text}`}
                                onMouseEnter={(e) =>
                                  handleCellHover(e, assignment?.reason)
                                }
                                onMouseLeave={() => setTooltip(null)}
                              >
                                {role}
                              </span>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 px-3 py-2 bg-slate-900 text-white text-xs rounded-lg shadow-lg max-w-xs pointer-events-none"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: "translate(-50%, -100%)",
          }}
        >
          {tooltip.text}
          <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-900" />
        </div>
      )}
    </main>
  );
}
