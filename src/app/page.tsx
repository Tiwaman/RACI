"use client";

import { useState } from "react";
import RaciTool from "./components/RaciTool";
import TranscriptTool from "./components/TranscriptTool";

type ActiveTool = "selector" | "raci" | "transcript";

const TOOLS = [
  {
    id: "raci" as const,
    title: "RACI Matrix",
    description:
      "Paste your tasks and team members — AI assigns Responsible, Accountable, Consulted, and Informed roles instantly.",
    icon: (
      <svg
        className="w-7 h-7"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M3 10h18M3 14h18M3 6h18M3 18h18M10 6v12M17 6v12"
        />
      </svg>
    ),
    gradient: "from-violet-500 to-purple-600",
    accent: "violet",
  },
  {
    id: "transcript" as const,
    title: "Meeting Action Items",
    description:
      "Paste a meeting transcript — AI extracts action items, assigns them to people, and sets priorities automatically.",
    icon: (
      <svg
        className="w-7 h-7"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
        />
      </svg>
    ),
    gradient: "from-indigo-500 to-blue-600",
    accent: "indigo",
  },
];

export default function Home() {
  const [activeTool, setActiveTool] = useState<ActiveTool>("selector");

  const subtitles: Record<ActiveTool, string> = {
    selector: "AI-Powered Project Management Tools",
    raci: "RACI Matrix Generator",
    transcript: "Meeting Action Item Extractor",
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div
            className={`flex items-center gap-3 ${activeTool === "selector" ? "" : "cursor-pointer"}`}
            onClick={() => activeTool !== "selector" && setActiveTool("selector")}
          >
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">
              AI
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">
                AI Project Tools
              </h1>
              <p className="text-xs text-slate-500">
                {subtitles[activeTool]}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Tool Selector */}
      {activeTool === "selector" && (
        <div className="max-w-4xl mx-auto px-6 py-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-3">
              What do you need?
            </h2>
            <p className="text-slate-500">
              Pick a tool below — powered by Llama 3.3 70B via Groq
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {TOOLS.map((tool) => (
              <button
                key={tool.id}
                onClick={() => setActiveTool(tool.id)}
                className="group bg-white rounded-2xl border border-slate-200 p-8 shadow-sm hover:shadow-lg hover:border-slate-300 transition-all cursor-pointer text-left"
              >
                <div
                  className={`w-14 h-14 rounded-xl bg-gradient-to-br ${tool.gradient} flex items-center justify-center text-white mb-5 group-hover:scale-110 transition-transform`}
                >
                  {tool.icon}
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">
                  {tool.title}
                </h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  {tool.description}
                </p>
                <div className="mt-5 flex items-center gap-1.5 text-sm font-medium text-violet-600 group-hover:gap-2.5 transition-all">
                  Get started
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
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Active Tool */}
      {activeTool === "raci" && (
        <RaciTool onBack={() => setActiveTool("selector")} />
      )}
      {activeTool === "transcript" && (
        <TranscriptTool onBack={() => setActiveTool("selector")} />
      )}
    </main>
  );
}
