# Outreach email copy — milestone 1

Partner-facing digests, daily ad-hoc alerts, and external templates. Examples use **seed-style** names and content library article URLs (`ci-art-001`–`ci-art-007` in `prisma/seed-data/content-library.ts`). Replace `{{placeholders}}` in production.

## Article recommendations (product meaning)

**Not** a single “suggested read” for the partner alone. The system recommends **articles for the partner to share with each specific contact** (e.g. IT company + new AI industry report → recommend that piece **for that contact’s** outreach). Each contact may have **zero, one, or two** picks. When there are **no** articles, **omit** the “Articles to share with this contact” block entirely (no empty-state message). When there are picks, show them under **“Articles to share with this contact.”**

**Priority tags** (urgent / high / medium) are **out of scope** for this mockup version.

---

## 1. Bi-weekly digest (to partner)

**Behavior:** Combined list: (A) stale / due for check-in, (B) transition or company news **not yet contacted**. Multiple contacts per send.

### Subject line options

- `Your bi-weekly relationship check-in — {{count}} people to reconnect with`
- `Reconnect: {{count}} contacts (stale + new signals)`

### Outline

Greet the partner; **Due for a check-in** with one row per contact (AI summary + optional article block only if 1–2 links + CTA); **New signals — not yet contacted** same pattern; **Your move** CTA. No separate “top priorities” list in this version.

---

## 2. Daily ad-hoc (to partner)

**Behavior:** News and transition (event-driven) only. **Do not send** when there are zero qualifying rows. Per contact: AI summary + articles to share (0–2).

### Quiet day

**No email.** Optionally log `daily_adhoc_skipped_reason=no_qualifying_events`.

---

## 3. External templates (to contact)

Frame articles as **you’re passing something useful to them** (matches recommended shares from the digest).

See mockups: `external-stale-example.html`, `external-transition-example.html`, `external-news-example.html`.

---

## Placeholders

| Placeholder | Example |
|-------------|---------|
| `{{partner_first_name}}` | Ava |
| `{{contact_first_name}}` | Thomas |
| `{{company}}` | Google |
| `{{news_summary_short}}` | “record earnings” |
| `{{articles_for_contact}}` | 0–2 structured picks (title, URL, why) |

---

## Viewing mockups

With `npm run dev`:

- **http://localhost:3000/outreach-mockups** → redirects to index list  
- **http://localhost:3000/outreach-mockups/biweekly-digest.html**  
- **http://localhost:3000/outreach-mockups/daily-adhoc.html**  
- **http://localhost:3000/outreach-mockups/draft-email-preview.html** — all “Draft …” buttons point here  
- **http://localhost:3000/outreach-mockups/nudge-emails-both-full.html** — both digests in one scroll (for screenshots)

**MDS:** [`public/outreach-mockups/mds-email.css`](public/outreach-mockups/mds-email.css) aligns with `MDS` in [`src/lib/services/email-service.ts`](src/lib/services/email-service.ts). Mock adds per-contact **Articles to share with this contact** (not in production HTML yet).
