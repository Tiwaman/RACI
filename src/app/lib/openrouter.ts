const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";

const MODELS = [
  "meta-llama/llama-3.3-70b-instruct:free",
  "qwen/qwen3-70b-instruct:free",
  "google/gemini-2.0-flash-exp:free",
  "deepseek/deepseek-chat-v3-0324:free",
];

async function callModel(
  model: string,
  system: string,
  user: string,
  maxTokens: number
): Promise<{ ok: boolean; text: string }> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.3,
      max_tokens: maxTokens,
    }),
  });

  if (res.status === 429 || res.status === 404 || res.status === 503) {
    return { ok: false, text: "" };
  }

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter API error (${res.status}): ${err}`);
  }

  const data = await res.json();
  return { ok: true, text: data.choices?.[0]?.message?.content || "" };
}

export async function llmCall(
  system: string,
  user: string,
  maxTokens = 4096
): Promise<string> {
  for (const model of MODELS) {
    try {
      const result = await callModel(model, system, user, maxTokens);
      if (result.ok) return result.text;
      // 429 — try next model
      console.log(`Rate limited on ${model}, trying next...`);
    } catch (e) {
      // If it's not a 429, rethrow on last model
      if (model === MODELS[MODELS.length - 1]) throw e;
      console.log(`Error on ${model}, trying next...`);
    }
  }
  throw new Error("All models are currently rate-limited. Please try again in a minute.");
}

export function parseJSON(text: string) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}
