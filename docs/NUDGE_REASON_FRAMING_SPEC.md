# Nudge Reason Framing Spec

## Purpose

Make nudge cards feel more conversational and action-oriented by leading with a clear outreach prompt, then summarizing the reason in plain language.

## Product Principle

The visible nudge copy should read like a short, helpful note from a teammate:

1. Start with the action.
2. Summarize what is happening with the contact in 1 to 2 sentences.
3. Keep the raw signal details available below the summary for transparency.

## Desired Pattern

```text
Reach out to Brian Foster at Google (Alphabet).
Brian recently changed roles, and there has been a gap since your last conversation. Company news and an upcoming event make this a good moment to reconnect.
```

## Copy Rules

- Use an action-first opening such as `Reach out to...`, `Reconnect with...`, or `Send a quick note to...`.
- Keep the reason human-readable and situational.
- Summarize multiple signals into a short story instead of listing every nudge type.
- Preserve exact signal evidence in the detail list below the summary.
- Prefer 1 to 2 sentences in the reason block.
- Avoid internal taxonomy in the headline copy when possible.

## UX Structure

For each nudge card:

- Title area: contact, company, and priority remain visible.
- Reason block: short summary of what happened or is happening.
- Evidence block: existing insight list stays below the summary and continues to show type-specific details and links.
- CTA area: existing nudge action buttons remain unchanged.

## Example Rewrites

- `Brian Foster recently changed roles, and you have not connected in a while. Company news and an upcoming event make this a timely moment to reach out.`
- `The relationship has gone quiet since the last check-in, and the company has had some notable movement. This is a good time to restart the conversation while the context is fresh.`
- `There is a clear reason to follow up now: the contact is active around a relevant event, and recent news gives you a natural opening.`

## Implementation Notes

- The nudge list already stores structured insight data in `metadata.insights`.
- The UI should use that structured data to generate or present a short summary, but still render the underlying insight list for trust and detail.
- If a summary is not available, fall back to the existing consolidated `reason` field.

