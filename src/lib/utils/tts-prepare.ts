import { stripMarkdownToPlainText } from "./strip-markdown";

type TopAction = {
  contactName: string;
  company: string;
  actionLabel: string;
  detail: string;
  deeplink: string;
  contactId?: string;
};

const MAX_WORDS = 300;

export type PrepareBriefingForTTSOptions = {
  /** Podcast-style intro; when set, skips redundant "priorities" lead-in for listeners */
  spokenOpening?: string;
};

export function prepareBriefingForTTS(
  narrative: string,
  topActions: TopAction[],
  options?: PrepareBriefingForTTSOptions,
): string {
  const parts: string[] = [];
  const opening = options?.spokenOpening?.trim();
  const hasOpening = Boolean(opening);

  if (opening) {
    parts.push(opening);
  }

  const plainNarrative = stripMarkdownToPlainText(narrative).trim();
  if (plainNarrative) {
    if (hasOpening) {
      parts.push("Here's the full briefing.");
    }
    parts.push(plainNarrative);
  }

  if (topActions.length > 0) {
    if (!hasOpening) {
      parts.push("Here are your priorities for today.");
    }

    topActions.forEach((action, i) => {
      const ordinal =
        i === 0 ? "First" : i === 1 ? "Second" : i === 2 ? "Third" : `Next`;
      const sentence = `${ordinal}, ${action.actionLabel.toLowerCase()} with ${action.contactName} at ${action.company} regarding ${action.detail}.`;
      parts.push(sentence);
    });
  }

  let text = parts.join(" ");

  const words = text.split(/\s+/);
  if (words.length > MAX_WORDS) {
    text = words.slice(0, MAX_WORDS).join(" ") + ".";
  }

  return text;
}
