export type VoiceIntent =
  | { kind: "approve" }
  | { kind: "skip" }
  | { kind: "send" }
  | { kind: "next" }
  | { kind: "stop" }
  | { kind: "hangup" }
  | { kind: "warmer" }
  | { kind: "shorter" }
  | { kind: "edit"; instruction: string }
  | { kind: "none" };

const APPROVE = /^(approve(?:\s+it)?|yes,?\s*approve|looks good,?\s*approve|go(?:\s+ahead)?)\.?$/i;
const SKIP = /^(skip(?:\s+(?:it|this))?|pass|next\s+one|not\s+now)\.?$/i;
const SEND = /^(send(?:\s+it)?|send\s+now|ship\s+it|yes,?\s*send)\.?$/i;
const NEXT = /^(next|keep\s+going|continue|what(?:'?s)?\s+next)\.?$/i;
const STOP = /^(stop|hold on|wait|pause)\.?$/i;
const HANGUP = /^(hang\s*up|end\s+(?:the\s+)?call|goodbye|bye|that'?s\s+all)\.?$/i;
const WARMER = /\b(make\s+it\s+warmer|warmer\s+tone|more\s+warm|warmer)\b/i;
const SHORTER = /\b(make\s+it\s+shorter|shorter\s+version|cut\s+it\s+down|shorter)\b/i;
const EDIT_PREFIX = /^(edit|change|rewrite|make\s+it)\b/i;

export function parseVoiceIntent(raw: string): VoiceIntent {
  const text = raw.trim();
  if (!text) return { kind: "none" };

  if (HANGUP.test(text)) return { kind: "hangup" };
  if (STOP.test(text)) return { kind: "stop" };
  if (APPROVE.test(text)) return { kind: "approve" };
  if (SEND.test(text)) return { kind: "send" };
  if (SKIP.test(text)) return { kind: "skip" };
  if (NEXT.test(text)) return { kind: "next" };

  const hasWarmer = WARMER.test(text);
  const hasShorter = SHORTER.test(text);
  const short = text.length <= 40;
  if (hasWarmer && short) return { kind: "warmer" };
  if (hasShorter && short) return { kind: "shorter" };

  if (EDIT_PREFIX.test(text)) {
    return { kind: "edit", instruction: text };
  }

  return { kind: "none" };
}
