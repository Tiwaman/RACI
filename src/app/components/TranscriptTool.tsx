"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";

// --- Types ---

type Step = "input" | "categories" | "results";

interface Category {
  name: string;
  summary: string;
  estimatedItems: number;
  selected: boolean;
}

interface ActionItem {
  task: string;
  assignedTo: string;
  priority: "High" | "Medium" | "Low";
  dueDate: string | null;
  category: string;
}

// Web Speech API types
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance;
}

declare global {
  interface Window {
    SpeechRecognition: SpeechRecognitionConstructor;
    webkitSpeechRecognition: SpeechRecognitionConstructor;
  }
}

// --- Constants ---

const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  High: { bg: "bg-red-100 border-red-300", text: "text-red-700" },
  Medium: { bg: "bg-orange-100 border-orange-300", text: "text-orange-700" },
  Low: { bg: "bg-blue-100 border-blue-300", text: "text-blue-700" },
};

const CATEGORY_COLORS = [
  "border-l-violet-500",
  "border-l-blue-500",
  "border-l-emerald-500",
  "border-l-orange-500",
  "border-l-rose-500",
  "border-l-cyan-500",
  "border-l-amber-500",
  "border-l-indigo-500",
];

const CATEGORY_DOTS = [
  "bg-violet-500",
  "bg-blue-500",
  "bg-emerald-500",
  "bg-orange-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-amber-500",
  "bg-indigo-500",
];

// --- Helpers ---

function loadLS<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  const saved = localStorage.getItem(key);
  if (!saved) return fallback;
  try {
    return JSON.parse(saved);
  } catch {
    return fallback;
  }
}

function scoreItem(item: ActionItem, query: string): number {
  if (!query.trim()) return 1;
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const searchable =
    `${item.task} ${item.assignedTo} ${item.category} ${item.priority}`.toLowerCase();
  let score = 0;
  for (const word of words) {
    if (searchable.includes(word)) {
      score += 1;
      if (new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i").test(searchable))
        score += 0.5;
    }
  }
  return score;
}

// --- Component ---

export default function TranscriptTool({ onBack }: { onBack: () => void }) {
  // Core state
  const [step, setStep] = useState<Step>(() => loadLS("transcript_step", "input"));
  const [transcriptText, setTranscriptText] = useState(() =>
    typeof window !== "undefined"
      ? localStorage.getItem("transcript_text") || ""
      : ""
  );
  const [categories, setCategories] = useState<Category[]>(() =>
    loadLS("transcript_categories", [])
  );
  const [actionItems, setActionItems] = useState<ActionItem[] | null>(() =>
    loadLS("transcript_results", null)
  );

  // UI state
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [activeFilter, setActiveFilter] = useState(() =>
    typeof window !== "undefined"
      ? localStorage.getItem("transcript_filter") || "All"
      : "All"
  );
  const [searchQuery, setSearchQuery] = useState(() =>
    typeof window !== "undefined"
      ? localStorage.getItem("transcript_search") || ""
      : ""
  );
  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);

  // Voice state
  const [isRecording, setIsRecording] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  // --- Persistence ---
  useEffect(() => { localStorage.setItem("transcript_text", transcriptText); }, [transcriptText]);
  useEffect(() => { localStorage.setItem("transcript_step", JSON.stringify(step)); }, [step]);
  useEffect(() => { localStorage.setItem("transcript_categories", JSON.stringify(categories)); }, [categories]);
  useEffect(() => { localStorage.setItem("transcript_results", JSON.stringify(actionItems)); }, [actionItems]);
  useEffect(() => { localStorage.setItem("transcript_filter", activeFilter); }, [activeFilter]);
  useEffect(() => { localStorage.setItem("transcript_search", searchQuery); }, [searchQuery]);

  // --- Debounced search ---
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // --- Voice typing setup ---
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) {
      setSpeechSupported(true);
      const recognition = new SR();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = "en-US";
      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let text = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            text += event.results[i][0].transcript;
          }
        }
        if (text) {
          setTranscriptText((prev) => (prev ? prev + " " + text : text));
        }
      };
      recognition.onerror = () => setIsRecording(false);
      recognition.onend = () => setIsRecording(false);
      recognitionRef.current = recognition;
    }
  }, []);

  const toggleRecording = useCallback(() => {
    if (!recognitionRef.current) return;
    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      recognitionRef.current.start();
      setIsRecording(true);
    }
  }, [isRecording]);

  // --- Backward compat: clear stale data without category field ---
  useEffect(() => {
    if (actionItems && actionItems.length > 0 && !actionItems[0].category) {
      setActionItems(null);
      setCategories([]);
      setStep("input");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Handlers ---

  const handleCategorize = async () => {
    setError("");
    if (!transcriptText.trim()) {
      setError("Paste a meeting transcript to analyze.");
      return;
    }
    setLoading(true);
    setProgress("Analyzing transcript and identifying categories...");
    try {
      const res = await fetch("/api/analyze-transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: transcriptText, mode: "categorize" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Categorization failed");
      const cats: Category[] = (data.categories || []).map(
        (c: { name: string; summary: string; estimatedItems: number }) => ({
          ...c,
          selected: true,
        })
      );
      setCategories(cats);
      setStep("categories");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
      setProgress("");
    }
  };

  const handleExtract = async () => {
    const selected = categories.filter((c) => c.selected).map((c) => c.name);
    if (!selected.length) {
      setError("Select at least one category.");
      return;
    }
    setError("");
    setLoading(true);
    setProgress("Generating tasks for selected categories...");
    try {
      const res = await fetch("/api/analyze-transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: transcriptText,
          mode: "extract",
          categories: selected,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Extraction failed");
      setActionItems(data.actionItems);
      setActiveFilter("All");
      setSearchQuery("");
      setStep("results");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
      setProgress("");
    }
  };

  const handleStartOver = () => {
    setActionItems(null);
    setCategories([]);
    setActiveFilter("All");
    setSearchQuery("");
    setStep("input");
  };

  // --- Filtered + searched items ---

  const uniqueCategories = useMemo(() => {
    if (!actionItems) return [];
    return [...new Set(actionItems.map((i) => i.category))];
  }, [actionItems]);

  const displayedItems = useMemo(() => {
    let items = actionItems ?? [];
    if (activeFilter !== "All")
      items = items.filter((i) => i.category === activeFilter);
    if (debouncedSearch.trim()) {
      items = items
        .map((item) => ({ item, score: scoreItem(item, debouncedSearch) }))
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score)
        .map(({ item }) => item);
    }
    return items;
  }, [actionItems, activeFilter, debouncedSearch]);

  const getCategoryColor = (name: string) => {
    const idx = uniqueCategories.indexOf(name);
    return idx >= 0 ? idx % CATEGORY_COLORS.length : 0;
  };

  // --- CSV Export ---

  const exportCSV = () => {
    if (!displayedItems.length) return;
    const header = [
      "#",
      "Task",
      "Assigned To",
      "Category",
      "Priority",
      "Due Date",
    ].join(",");
    const rows = displayedItems.map((item, i) =>
      [
        i + 1,
        `"${item.task.replace(/"/g, '""')}"`,
        `"${item.assignedTo}"`,
        `"${item.category}"`,
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

  // --- Render ---

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* Back to tools */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 mb-6 cursor-pointer transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Tools
      </button>

      {/* ===================== STEP 1: INPUT ===================== */}
      {step === "input" && !loading && (
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-semibold text-slate-800">
                Meeting Transcript
              </label>
              {transcriptText.length > 0 && (
                <span className="text-xs text-slate-400">
                  {transcriptText.length.toLocaleString()} chars
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Paste your meeting notes or use the mic button to dictate.
              {speechSupported && (
                <span className="text-violet-500 ml-1">Voice typing available.</span>
              )}
            </p>

            {/* Textarea with mic button */}
            <div className="relative">
              <textarea
                value={transcriptText}
                onChange={(e) => setTranscriptText(e.target.value)}
                rows={14}
                placeholder={`Aman: Let's kick off. Sara, can you finish the landing page redesign by Friday? It's urgent — the launch depends on it.\n\nSara: Sure, I'll prioritize it. I'll need the new assets from Lisa though.\n\nAman: Lisa, can you get those design assets to Sara by Wednesday?\n\nLisa: Yes, I'll have them ready.\n\nAman: John, the API docs need updating before we onboard the new partner. Can you handle that by next week?\n\nJohn: Got it. I'll also set up the staging environment while I'm at it.\n\nAman: Great. Himanshu, please review the security audit report when you get a chance — no rush on that one.`}
                className="w-full rounded-lg border border-slate-200 px-4 py-3 pr-14 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none bg-slate-50 placeholder:text-slate-400"
              />
              {speechSupported && (
                <button
                  onClick={toggleRecording}
                  className={`absolute bottom-3 right-3 w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                    isRecording
                      ? "bg-red-500 text-white animate-pulse shadow-lg shadow-red-200"
                      : "bg-slate-100 text-slate-500 hover:bg-violet-100 hover:text-violet-600"
                  }`}
                  title={isRecording ? "Stop recording" : "Start voice typing"}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {isRecording ? (
                      <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
                    ) : (
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                      />
                    )}
                  </svg>
                </button>
              )}
            </div>
            {isRecording && (
              <p className="text-xs text-red-500 mt-2 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                Listening... speak now
              </p>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <button
            onClick={handleCategorize}
            disabled={loading}
            className="w-full py-3 px-6 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-violet-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-violet-200 cursor-pointer"
          >
            Analyze Transcript
          </button>
        </div>
      )}

      {/* ===================== LOADING ===================== */}
      {loading && (
        <div className="max-w-md mx-auto text-center py-20">
          <div className="mx-auto w-16 h-16 mb-6">
            <svg className="animate-spin w-16 h-16 text-violet-500" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-800 mb-2">{progress}</h3>
          <p className="text-sm text-slate-500">This may take a moment for longer transcripts.</p>
          <div className="mt-6 w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full animate-pulse" style={{ width: "60%" }} />
          </div>
        </div>
      )}

      {/* ===================== STEP 2: CATEGORIES ===================== */}
      {step === "categories" && !loading && (
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Meeting Categories</h2>
              <p className="text-sm text-slate-500 mt-1">
                Select the categories you want to generate tasks for.
              </p>
            </div>
            <button
              onClick={() => setStep("input")}
              className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Back to Input
            </button>
          </div>

          {/* Select all / deselect all */}
          <div className="flex gap-4 text-sm">
            <button
              onClick={() => setCategories((prev) => prev.map((c) => ({ ...c, selected: true })))}
              className="text-violet-600 hover:underline cursor-pointer"
            >
              Select All
            </button>
            <button
              onClick={() => setCategories((prev) => prev.map((c) => ({ ...c, selected: false })))}
              className="text-slate-500 hover:underline cursor-pointer"
            >
              Deselect All
            </button>
          </div>

          {/* Category cards grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {categories.map((cat, idx) => (
              <button
                key={cat.name}
                onClick={() =>
                  setCategories((prev) =>
                    prev.map((c) =>
                      c.name === cat.name ? { ...c, selected: !c.selected } : c
                    )
                  )
                }
                className={`relative text-left p-5 rounded-xl border-l-4 border bg-white shadow-sm transition-all cursor-pointer ${
                  cat.selected
                    ? `${CATEGORY_COLORS[idx % CATEGORY_COLORS.length]} border-violet-200 hover:shadow-md`
                    : "border-l-slate-300 border-slate-200 opacity-50"
                }`}
              >
                {/* Checkbox indicator */}
                <div
                  className={`absolute top-3 right-3 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                    cat.selected
                      ? "bg-violet-500 border-violet-500"
                      : "bg-white border-slate-300"
                  }`}
                >
                  {cat.selected && (
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>

                <h3 className="font-semibold text-slate-800 pr-8">{cat.name}</h3>
                <p className="text-sm text-slate-500 mt-1 line-clamp-2">
                  {cat.summary}
                </p>
                <span className="inline-block mt-3 text-xs font-medium text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">
                  ~{cat.estimatedItems} items
                </span>
              </button>
            ))}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          {/* Summary + Generate button */}
          <div className="flex items-center justify-between pt-2">
            <p className="text-sm text-slate-500">
              {categories.filter((c) => c.selected).length} of{" "}
              {categories.length} categories selected
            </p>
          </div>
          <button
            onClick={handleExtract}
            disabled={loading || !categories.some((c) => c.selected)}
            className="w-full py-3 px-6 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-violet-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-violet-200 cursor-pointer"
          >
            Generate Tasks for Selected Categories
          </button>
        </div>
      )}

      {/* ===================== STEP 3: RESULTS ===================== */}
      {step === "results" && !loading && actionItems && (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Action Items</h2>
              <p className="text-sm text-slate-500 mt-1">
                {displayedItems.length} of {actionItems.length} item
                {actionItems.length !== 1 ? "s" : ""}
                {activeFilter !== "All" || debouncedSearch ? " (filtered)" : ""}
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
                onClick={() => setStep("categories")}
                className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Back to Categories
              </button>
              <button
                onClick={handleStartOver}
                className="px-4 py-2 text-sm font-medium text-violet-600 border border-violet-200 rounded-lg hover:bg-violet-50 transition-colors cursor-pointer"
              >
                Start Over
              </button>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative">
            <svg
              className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks, people, categories..."
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent bg-white placeholder:text-slate-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Category filter chips */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveFilter("All")}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                activeFilter === "All"
                  ? "bg-violet-100 text-violet-700 border-violet-300"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              All ({actionItems.length})
            </button>
            {uniqueCategories.map((cat) => {
              const count = actionItems.filter((i) => i.category === cat).length;
              const colorIdx = getCategoryColor(cat);
              return (
                <button
                  key={cat}
                  onClick={() => setActiveFilter(activeFilter === cat ? "All" : cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer flex items-center gap-1.5 ${
                    activeFilter === cat
                      ? "bg-violet-100 text-violet-700 border-violet-300"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${CATEGORY_DOTS[colorIdx]}`} />
                  {cat} ({count})
                </button>
              );
            })}
          </div>

          {/* Priority legend */}
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
          {displayedItems.length > 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-left px-5 py-3 font-semibold text-slate-700 w-10">#</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-700 min-w-[250px]">Task</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-700 min-w-[130px]">Assigned To</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-700 min-w-[120px]">Category</th>
                    <th className="text-center px-4 py-3 font-semibold text-slate-700 min-w-[90px]">Priority</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-700 min-w-[100px]">Due Date</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedItems.map((item, i) => {
                    const pStyle = PRIORITY_COLORS[item.priority];
                    const colorIdx = getCategoryColor(item.category);
                    return (
                      <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                        <td className="px-5 py-3 text-slate-400 font-mono text-xs">{i + 1}</td>
                        <td className="px-4 py-3 font-medium text-slate-800">{item.task}</td>
                        <td className="px-4 py-3 text-slate-700">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="w-6 h-6 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                              {item.assignedTo.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                            </span>
                            {item.assignedTo}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          <span className="inline-flex items-center gap-1.5 text-xs">
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${CATEGORY_DOTS[colorIdx]}`} />
                            {item.category}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {pStyle && (
                            <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-lg border text-xs font-semibold ${pStyle.bg} ${pStyle.text}`}>
                              {item.priority}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {item.dueDate || <span className="text-slate-300">--</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
              <p className="text-slate-400">
                No tasks match your current filters.
              </p>
              <button
                onClick={() => {
                  setActiveFilter("All");
                  setSearchQuery("");
                }}
                className="mt-3 text-sm text-violet-600 hover:underline cursor-pointer"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
