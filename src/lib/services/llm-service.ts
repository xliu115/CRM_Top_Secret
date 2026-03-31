/**
 * LLM integration barrel: shared OpenAI helpers live in `./llm-core`;
 * domain prompts live in `./llm-email`, `./llm-meeting`, etc.
 */
export type { ChatMessage } from "./llm-core";
export { callLLM, callLLMWithHistory, callLLMJson } from "./llm-core";

export * from "./llm-email";
export * from "./llm-briefing";
export * from "./llm-chat";
export * from "./llm-meeting";
export * from "./llm-sequence";
export * from "./llm-contact360";
export * from "./llm-company360";
