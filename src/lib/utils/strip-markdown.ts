/**
 * Converts markdown to plain text for preview display.
 * Strips formatting while preserving structure (newlines, lists as plain text).
 */
export function stripMarkdownToPlainText(md: string): string {
  if (!md || typeof md !== "string") return md;

  let text = md
    // Code blocks (```...```)
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/^```\w*\n?|```$/g, "").trim())
    // Inline code (`...`)
    .replace(/`([^`]+)`/g, "$1")
    // Bold (** or __)
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    // Italic (* or _) - after bold, single * or _ remain
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    // Headers (# ## ### etc)
    .replace(/^#{1,6}\s+/gm, "")
    // Links [text](url) -> text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    // Strikethrough ~~...~~
    .replace(/~~([^~]+)~~/g, "$1")
    // Horizontal rules
    .replace(/^[-*_]{3,}\s*$/gm, "")
    // List markers (- * + or 1. 2.)
    .replace(/^\s*[-*+]\s+/gm, "• ")
    .replace(/^\s*\d+\.\s+/gm, "");

  return text.trim();
}
