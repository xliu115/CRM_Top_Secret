import OpenAI from "openai";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      ...(process.env.OPENAI_BASE_URL && {
        baseURL: process.env.OPENAI_BASE_URL,
      }),
    })
  : null;

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export async function callLLM(
  systemPrompt: string,
  userPrompt: string
): Promise<string | null> {
  if (!openai) return null;
  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 4000,
    });
    return res.choices[0]?.message?.content ?? "";
  } catch (err) {
    console.error(
      "[llm-service] OpenAI call failed, falling back to template:",
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

export async function callLLMWithHistory(
  systemPrompt: string,
  messages: ChatMessage[]
): Promise<string | null> {
  if (!openai) return null;
  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      temperature: 0.7,
      max_tokens: 2000,
    });
    return res.choices[0]?.message?.content ?? "";
  } catch (err) {
    console.error(
      "[llm-service] OpenAI call failed, falling back to template:",
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

export async function callLLMJson<T = Record<string, unknown>>(
  systemPrompt: string,
  userPrompt: string,
  options?: { maxTokens?: number; temperature?: number },
): Promise<T | null> {
  if (!openai) return null;
  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: options?.temperature ?? 0.2,
      max_tokens: options?.maxTokens ?? 2000,
      response_format: { type: "json_object" },
    });
    const text = res.choices[0]?.message?.content;
    if (!text) return null;
    return JSON.parse(text) as T;
  } catch (err) {
    console.error(
      "[llm-service] OpenAI JSON call failed:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

export { openai };
