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

export interface WebSearchCitation {
  url: string;
  title: string;
}

export async function callLLMWithWebSearch(
  systemPrompt: string,
  userPrompt: string,
  options?: { model?: string; maxOutputTokens?: number }
): Promise<{ text: string; citations: WebSearchCitation[] } | null> {
  if (!openai) return null;
  const model = options?.model ?? process.env.COMPANY_BRIEF_MODEL ?? "gpt-4o-mini";
  try {
    const response = await openai.responses.create({
      model,
      instructions: systemPrompt,
      input: userPrompt,
      tools: [{ type: "web_search_preview" as const }],
      ...(options?.maxOutputTokens && { max_output_tokens: options.maxOutputTokens }),
    });

    let text = "";
    const citations: WebSearchCitation[] = [];
    const seenUrls = new Set<string>();

    for (const item of response.output) {
      if (item.type === "message") {
        for (const block of item.content) {
          if (block.type === "output_text") {
            text += block.text;
            for (const ann of block.annotations ?? []) {
              if (ann.type === "url_citation" && !seenUrls.has(ann.url)) {
                seenUrls.add(ann.url);
                citations.push({ url: ann.url, title: ann.title ?? ann.url });
              }
            }
          }
        }
      }
    }

    return { text, citations };
  } catch (err) {
    console.error(
      "[llm-service] OpenAI web search call failed:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

export { openai };
