import { describe, it, expect } from "vitest";

/**
 * Tests for the article-share mobile flow. We exercise the regex intent
 * matching and the helper logic that runs on the client (snippet generation
 * from the same `normalizeTemplateText` pattern used server-side).
 *
 * The `buildArticleShareBlocks` helper is async / DB-bound, so it's
 * covered by integration tests. These unit tests focus on the intent regex
 * and snippet / template normalisation that can be exercised in isolation.
 */

// ── SHARE_ARTICLE_INTENT regex ──────────────────────────────────────────

const SHARE_ARTICLE_INTENT =
  /\b(share\s+(?:the\s+|an?\s+|this\s+)?article|(?:newly\s+published\s+)?articles?\s+to\s+share|share\s+(?:this\s+)?content|newly\s+published\s+articles?)\b/i;

describe("SHARE_ARTICLE_INTENT regex", () => {
  const positives = [
    "Share an article",
    "share the article",
    "share this article",
    "share article",
    "articles to share",
    "article to share",
    "Share this content",
    "share content",
    "I want to share an article with clients",
    "Do I have any articles to share?",
    "Newly published articles to share",
    "newly published article",
    "newly published articles",
    "Newly published articles to share with contacts",
  ];

  const negatives = [
    "Draft an email to Sarah",
    "Review my campaign approvals",
    "What's on my plate today?",
    "article about Apple",
    "share the dossier",
    "share my screen",
  ];

  it.each(positives)("matches: %s", (input) => {
    expect(SHARE_ARTICLE_INTENT.test(input)).toBe(true);
  });

  it.each(negatives)("does NOT match: %s", (input) => {
    expect(SHARE_ARTICLE_INTENT.test(input)).toBe(false);
  });
});

// ── normalizeTemplateText (same logic as in chat route) ─────────────────

function normalizeTemplateText(
  raw: string,
  ctx?: { contactName?: string; companyName?: string },
): string {
  const firstName = ctx?.contactName?.split(/\s+/)[0];
  const fullName = ctx?.contactName;
  const company = ctx?.companyName;

  const replaced = raw.replace(
    /\{\{\s*([^}]+?)\s*\}\}/g,
    (_match, key: string) => {
      const k = key.toLowerCase().replace(/[\s_]+/g, "");
      if (/^(contact\.)?first(name)?$/.test(k) && firstName) return firstName;
      if (/^(contact\.)?last(name)?$/.test(k) && fullName) {
        const parts = fullName.split(/\s+/);
        return parts.length > 1 ? parts.slice(1).join(" ") : "";
      }
      if (/^(contact\.)?(full)?name$/.test(k) && fullName) return fullName;
      if (/^(contact\.)?company(\.?name)?$/.test(k) && company) return company;
      return "";
    },
  );

  return replaced
    .replace(/\s*\n\s*/g, " ")
    .replace(/\s+'s\b/g, "")
    .replace(/\s+'\s/g, " ")
    .replace(/\s+,(?=\s)/g, ",")
    .replace(/,\s*,/g, ",")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function buildRecipientSnippet(
  raw: string,
  ctx?: { contactName?: string; companyName?: string },
): string {
  if (!raw) return "";
  const flattened = normalizeTemplateText(raw, ctx);
  const stripped = flattened.replace(
    /^(?:hi|hello|hey|dear)[^.!?]*[,.!?]\s*/i,
    "",
  );
  return stripped.length > 80 ? `${stripped.slice(0, 77)}…` : stripped;
}

describe("buildRecipientSnippet for article share", () => {
  it("substitutes firstName token and produces clean snippet", () => {
    const raw =
      "Hi {{contact.firstName}}. Given Sarah's focus on digital transformation, this article might be relevant to Acme Corp.";
    const result = buildRecipientSnippet(raw, {
      contactName: "Sarah Chen",
      companyName: "Acme Corp",
    });
    expect(result).not.toContain("{{");
    expect(result).toContain("Sarah");
    expect(result).toContain("digital transformation");
  });

  it("handles missing context gracefully (strips tokens)", () => {
    const raw =
      "Hi {{firstName}}. {{company}} has been making strides in the market.";
    const result = buildRecipientSnippet(raw);
    expect(result).not.toContain("{{");
    expect(result).not.toContain("}}");
    expect(result.length).toBeGreaterThan(0);
  });

  it("clips to ~80 characters", () => {
    const longBody =
      "This is a very long personalized email body that goes on and on about various topics related to digital transformation and strategic priorities.";
    const result = buildRecipientSnippet(longBody);
    expect(result.length).toBeLessThanOrEqual(80);
    expect(result).toContain("…");
  });

  it("strips greeting prefix", () => {
    const raw = "Dear Sarah. We thought you might like this article about AI.";
    const result = buildRecipientSnippet(raw, { contactName: "Sarah Chen" });
    expect(result).not.toMatch(/^Dear/i);
    expect(result.toLowerCase()).toContain("article");
  });

  it("returns empty string for empty input", () => {
    expect(buildRecipientSnippet("")).toBe("");
    expect(buildRecipientSnippet("", { contactName: "Test" })).toBe("");
  });
});

describe("normalizeTemplateText", () => {
  it("replaces company token", () => {
    const result = normalizeTemplateText(
      "At {{contact.company}}, strategic priorities include...",
      { companyName: "Tesla" },
    );
    expect(result).toBe("At Tesla, strategic priorities include...");
  });

  it("cleans orphaned possessive after token removal", () => {
    const result = normalizeTemplateText(
      "Given {{contact.firstName}}'s strategic priorities, we recommend...",
    );
    expect(result).toBe("Given strategic priorities, we recommend...");
  });

  it("removes double spaces and stray punctuation", () => {
    const result = normalizeTemplateText(
      "Hello {{firstName}} , how are you?",
    );
    expect(result).toBe("Hello, how are you?");
  });
});
