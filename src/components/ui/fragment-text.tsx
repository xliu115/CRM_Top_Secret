"use client";

import type { SentenceFragment } from "@/lib/utils/nudge-summary";

export function FragmentText({ fragments }: { fragments: SentenceFragment[] }) {
  const groups: SentenceFragment[][] = [[]];
  for (const f of fragments) {
    if (f.lineBreak) {
      groups.push([]);
    } else {
      groups[groups.length - 1].push(f);
    }
  }

  return (
    <div className="space-y-2">
      {groups.map((group, gi) => (
        <p key={gi}>
          {group.map((f, i) =>
            f.bold ? (
              <strong key={i} className="font-semibold text-foreground/90">{f.text}</strong>
            ) : (
              <span key={i}>{f.text}</span>
            )
          )}
        </p>
      ))}
    </div>
  );
}
