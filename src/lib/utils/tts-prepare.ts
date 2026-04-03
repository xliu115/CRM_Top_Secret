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

export function prepareBriefingForTTS(
  narrative: string,
  topActions: TopAction[],
): string {
  const parts: string[] = [];

  const plainNarrative = stripMarkdownToPlainText(narrative).trim();
  if (plainNarrative) {
    parts.push(plainNarrative);
  }

  if (topActions.length > 0) {
    parts.push("Here are your priorities for today.");

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
