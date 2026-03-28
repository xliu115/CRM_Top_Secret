import OpenAI from "openai";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
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
