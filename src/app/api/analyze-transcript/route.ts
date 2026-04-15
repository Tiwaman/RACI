import Groq from "groq-sdk";
import { NextRequest, NextResponse } from "next/server";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `You are a project management expert. Analyze the meeting transcript chunk and extract all action items, tasks, and assignments.

For each action item:
1. Identify the specific task or action that needs to be done
2. Identify who it is assigned to (use the person's name as mentioned)
3. Assess priority (High, Medium, or Low) based on urgency language, deadlines, and context
4. Extract any mentioned due date or deadline (use ISO format YYYY-MM-DD, or null if not mentioned)

Rules:
- Extract ONLY concrete, actionable tasks (not discussion points or opinions)
- If a task is not explicitly assigned to someone, infer the most likely person from context
- If no person can be inferred, use "Unassigned"
- Priority should be High if words like "urgent", "ASAP", "critical", "blocker" are used or deadline is within 2 days
- Priority should be Low if words like "eventually", "nice to have", "when you get a chance" are used
- Default priority is Medium
- If the chunk has NO actionable tasks, return an empty actionItems array

Respond with ONLY valid JSON, no markdown code fences:
{
  "actionItems": [
    {
      "task": "description of the action item",
      "assignedTo": "Person Name",
      "priority": "High"|"Medium"|"Low",
      "dueDate": "YYYY-MM-DD" or null
    }
  ]
}`;

async function analyzeChunk(chunk: string): Promise<{ task: string; assignedTo: string; priority: string; dueDate: string | null }[]> {
  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Meeting Transcript:\n${chunk}` },
    ],
    temperature: 0.3,
    max_tokens: 4096,
  });

  const text = completion.choices[0]?.message?.content || "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return [];

  try {
    const data = JSON.parse(jsonMatch[0]);
    return data.actionItems || [];
  } catch {
    return [];
  }
}

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
  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks;
}

export async function POST(request: NextRequest) {
  try {
    const { transcript } = await request.json();

    if (!transcript?.trim()) {
      return NextResponse.json(
        { error: "A meeting transcript is required." },
        { status: 400 }
      );
    }

    const chunks = splitIntoChunks(transcript);
    const totalChunks = chunks.length;

    // Process chunks sequentially to stay within rate limits
    const allItems: { task: string; assignedTo: string; priority: string; dueDate: string | null }[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const items = await analyzeChunk(chunks[i]);
      allItems.push(...items);

      // Small delay between chunks to respect rate limits
      if (i < chunks.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    // Deduplicate similar tasks
    const seen = new Set<string>();
    const unique = allItems.filter((item) => {
      const key = item.task.toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return NextResponse.json({
      actionItems: unique,
      totalChunks,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    console.error("Transcript analysis error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
