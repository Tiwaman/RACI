import Groq from "groq-sdk";
import { NextRequest, NextResponse } from "next/server";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// --- Prompts ---

const CATEGORIZE_SYSTEM_PROMPT = `You are a project management expert. Analyze the meeting transcript and identify the main discussion categories/themes.

Rules:
- Identify 2-8 distinct categories that group the discussion topics
- Each category should represent a clear theme (e.g. "Design", "Backend Development", "Security", "Documentation", "Infrastructure")
- Provide a brief 1-sentence summary of what was discussed for each
- Estimate how many actionable tasks fall under each category
- Focus on categories that contain ACTIONABLE work, not just discussion

Respond with ONLY valid JSON, no markdown code fences:
{
  "categories": [
    {
      "name": "Category Name",
      "summary": "Brief summary of what was discussed",
      "estimatedItems": 3
    }
  ]
}`;

const EXTRACT_SYSTEM_PROMPT = `You are a project management expert. Extract action items from the meeting transcript and classify each into one of the provided categories.

For each action item:
1. Identify the specific task or action
2. Identify who it is assigned to (use the person's name as mentioned)
3. Assess priority (High, Medium, or Low)
4. Extract any due date (ISO YYYY-MM-DD or null)
5. Classify into one of the provided categories

Rules:
- Extract ONLY concrete, actionable tasks (not discussion points)
- If unassigned, infer from context or use "Unassigned"
- High priority: "urgent", "ASAP", "critical", "blocker" or deadline within 2 days
- Low priority: "eventually", "nice to have", "when you get a chance"
- Default priority: Medium
- ONLY use categories from the provided list
- If a task doesn't fit any category well, assign to the closest one

Respond with ONLY valid JSON, no markdown code fences:
{
  "actionItems": [
    {
      "task": "description",
      "assignedTo": "Person Name",
      "priority": "High"|"Medium"|"Low",
      "dueDate": "YYYY-MM-DD" or null,
      "category": "Category Name"
    }
  ]
}`;

// --- Helpers ---

function splitIntoChunks(text: string, maxChars: number = 6000): string[] {
  const lines = text.split("\n");
  const chunks: string[] = [];
  let current = "";
  for (const line of lines) {
    if (current.length + line.length + 1 > maxChars && current.length > 0) {
      chunks.push(current.trim());
      current = "";
    }
    current += line + "\n";
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

async function llmCall(system: string, user: string, maxTokens = 4096) {
  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.3,
    max_tokens: maxTokens,
  });
  return completion.choices[0]?.message?.content || "";
}

function parseJSON(text: string) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

// --- Categorize ---

async function categorizeTranscript(transcript: string) {
  const chunks = splitIntoChunks(transcript);

  if (chunks.length === 1) {
    const text = await llmCall(
      CATEGORIZE_SYSTEM_PROMPT,
      `Meeting Transcript:\n${chunks[0]}`
    );
    const data = parseJSON(text);
    return data?.categories || [];
  }

  // Multi-chunk: categorize each, then merge
  const allCategories: { name: string; summary: string; estimatedItems: number }[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const text = await llmCall(
      CATEGORIZE_SYSTEM_PROMPT,
      `Meeting Transcript (Part ${i + 1} of ${chunks.length}):\n${chunks[i]}`
    );
    const data = parseJSON(text);
    if (data?.categories) allCategories.push(...data.categories);
    if (i < chunks.length - 1) await new Promise((r) => setTimeout(r, 2000));
  }

  // Merge duplicates via LLM
  await new Promise((r) => setTimeout(r, 2000));
  const mergeText = await llmCall(
    `You are given a list of categories extracted from different parts of a meeting. Merge duplicate or overlapping categories, combine their summaries, and sum their estimated items. Return 2-8 final categories.

Respond with ONLY valid JSON, no markdown code fences:
{
  "categories": [
    { "name": "Category Name", "summary": "Merged summary", "estimatedItems": 5 }
  ]
}`,
    JSON.stringify(allCategories)
  );
  const merged = parseJSON(mergeText);
  return merged?.categories || allCategories;
}

// --- Extract ---

async function extractActions(transcript: string, categories: string[]) {
  const chunks = splitIntoChunks(transcript);
  const categoryList = categories.join(", ");
  const allItems: { task: string; assignedTo: string; priority: string; dueDate: string | null; category: string }[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const text = await llmCall(
      EXTRACT_SYSTEM_PROMPT,
      `Categories to use: ${categoryList}\n\nMeeting Transcript:\n${chunks[i]}`
    );
    const data = parseJSON(text);
    if (data?.actionItems) allItems.push(...data.actionItems);
    if (i < chunks.length - 1) await new Promise((r) => setTimeout(r, 2000));
  }

  // Deduplicate
  const seen = new Set<string>();
  return allItems.filter((item) => {
    const key = item.task.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// --- Route Handler ---

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { transcript, mode = "categorize", categories } = body;

    if (!transcript?.trim()) {
      return NextResponse.json(
        { error: "A meeting transcript is required." },
        { status: 400 }
      );
    }

    if (mode === "categorize") {
      const cats = await categorizeTranscript(transcript);
      return NextResponse.json({ categories: cats });
    }

    if (mode === "extract") {
      if (!categories?.length) {
        return NextResponse.json(
          { error: "At least one category must be selected." },
          { status: 400 }
        );
      }
      const actionItems = await extractActions(transcript, categories);
      return NextResponse.json({ actionItems });
    }

    return NextResponse.json({ error: "Invalid mode." }, { status: 400 });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    console.error("Transcript analysis error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
