import Groq from "groq-sdk";
import { NextRequest, NextResponse } from "next/server";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(request: NextRequest) {
  try {
    const { transcript } = await request.json();

    if (!transcript?.trim()) {
      return NextResponse.json(
        { error: "A meeting transcript is required." },
        { status: 400 }
      );
    }

    const prompt = `You are a project management expert. Analyze the following meeting transcript and extract all action items, tasks, and assignments.

For each action item:
1. Identify the specific task or action that needs to be done
2. Identify who it is assigned to (use the person's name as mentioned in the transcript)
3. Assess priority (High, Medium, or Low) based on urgency language, deadlines, and context
4. Extract any mentioned due date or deadline (use ISO format YYYY-MM-DD, or null if not mentioned)

Rules:
- Extract ONLY concrete, actionable tasks (not discussion points or opinions)
- If a task is not explicitly assigned to someone, infer the most likely person from context
- If no person can be inferred, use "Unassigned"
- Priority should be High if words like "urgent", "ASAP", "critical", "blocker" are used or deadline is within 2 days
- Priority should be Low if words like "eventually", "nice to have", "when you get a chance" are used
- Default priority is Medium

Meeting Transcript:
${transcript}

Respond with ONLY valid JSON, no markdown code fences, in this exact format:
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

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 8192,
    });

    const text = completion.choices[0]?.message?.content || "";

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "Failed to parse AI response." },
        { status: 500 }
      );
    }

    const data = JSON.parse(jsonMatch[0]);
    return NextResponse.json(data);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    console.error("Transcript analysis error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
