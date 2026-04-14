import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { tasks, members } = await request.json();

    if (!tasks?.length || !members?.length) {
      return NextResponse.json(
        { error: "Tasks and team members are required." },
        { status: 400 }
      );
    }

    const prompt = `You are a project management expert. Given the following tasks and team members with their roles, generate a RACI matrix.

RACI definitions:
- R (Responsible): The person who does the work
- A (Accountable): The person who is ultimately answerable and approves the work
- C (Consulted): People whose opinions are sought (two-way communication)
- I (Informed): People who are kept up-to-date on progress (one-way communication)

Rules:
- Every task MUST have exactly one A (Accountable)
- Every task MUST have at least one R (Responsible)
- Assign roles based on each member's role/title
- A task can have multiple R, C, or I assignments
- Use null for cells where a person has no involvement

Tasks:
${tasks.map((t: string, i: number) => `${i + 1}. ${t}`).join("\n")}

Team Members:
${members.map((m: { name: string; role: string }) => `- ${m.name} (${m.role})`).join("\n")}

Respond with ONLY valid JSON in this exact format:
{
  "matrix": [
    {
      "task": "task name",
      "assignments": {
        "Member Name": { "role": "R"|"A"|"C"|"I"|null, "reason": "brief explanation" }
      }
    }
  ]
}`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    const text =
      message.content[0].type === "text" ? message.content[0].text : "";

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
    console.error("RACI generation error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
