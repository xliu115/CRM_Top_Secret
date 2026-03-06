import { describe, it, expect } from "vitest";

/**
 * Tests for the RAG keyword extraction and document matching logic.
 */

const stopWords = new Set([
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "shall", "can", "need", "to", "of", "in",
  "for", "on", "with", "at", "by", "from", "as", "into", "through",
  "during", "before", "after", "above", "below", "between", "out", "off",
  "over", "under", "again", "further", "then", "once", "here", "there",
  "when", "where", "why", "how", "all", "both", "each", "few", "more",
  "most", "other", "some", "such", "no", "nor", "not", "only", "own",
  "same", "so", "than", "too", "very", "just", "don", "now", "and",
  "but", "or", "if", "while", "about", "what", "which", "who", "whom",
  "this", "that", "these", "those", "am", "it", "its", "my", "me", "we",
  "our", "your", "his", "her", "their", "them", "i", "you", "he", "she",
  "they", "tell", "give", "show", "find", "get", "know", "think", "say",
  "make", "go", "see", "come", "take", "want", "look", "use", "work",
  "call", "try", "ask", "let", "keep", "help", "talk", "turn", "start",
  "anything", "everything", "something", "latest", "recent", "recently",
  "last", "new", "any",
]);

const companyNames = [
  "Microsoft", "Apple", "Amazon", "JPMorgan", "Google", "Alphabet",
  "Meta", "Nvidia", "Salesforce", "Adobe", "Netflix", "Nike", "PepsiCo",
];

function extractKeywords(query: string): string[] {
  const words = query
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !stopWords.has(w.toLowerCase()));

  for (const name of companyNames) {
    if (query.toLowerCase().includes(name.toLowerCase())) {
      words.unshift(name);
    }
  }

  return [...new Set(words)];
}

interface Doc {
  type: string;
  content: string;
}

function matchDocs(keywords: string[], docs: Doc[]): Doc[] {
  return docs.filter((d) =>
    keywords.some((kw) =>
      d.content.toLowerCase().includes(kw.toLowerCase())
    )
  );
}

describe("RAG Retrieval Logic", () => {
  describe("Keyword Extraction", () => {
    it("should extract meaningful keywords from a query", () => {
      const keywords = extractKeywords(
        "What's the latest with Microsoft contacts?"
      );
      expect(keywords).toContain("Microsoft");
      expect(keywords).toContain("contacts");
      expect(keywords).not.toContain("the");
      expect(keywords).not.toContain("with");
    });

    it("should detect company names", () => {
      const keywords = extractKeywords(
        "Tell me about our relationship with Amazon"
      );
      expect(keywords).toContain("Amazon");
    });

    it("should handle multi-word queries", () => {
      const keywords = extractKeywords(
        "Who changed jobs recently among my accounts?"
      );
      expect(keywords).toContain("changed");
      expect(keywords).toContain("jobs");
      expect(keywords).toContain("accounts");
    });

    it("should deduplicate keywords", () => {
      const keywords = extractKeywords("Microsoft Microsoft Microsoft");
      const microsoftCount = keywords.filter(
        (k) => k.toLowerCase() === "microsoft"
      ).length;
      expect(microsoftCount).toBe(1);
    });

    it("should handle empty query", () => {
      const keywords = extractKeywords("");
      expect(keywords).toHaveLength(0);
    });

    it("should detect Google/Alphabet", () => {
      const keywords = extractKeywords("What's happening at Google?");
      expect(keywords).toContain("Google");
    });
  });

  describe("Document Matching", () => {
    const docs: Doc[] = [
      {
        type: "Interaction",
        content:
          "EMAIL with Sarah Mitchell (Microsoft): Discussed cloud migration strategy.",
      },
      {
        type: "Signal",
        content: "Amazon announces $2B investment in AI infrastructure",
      },
      {
        type: "Contact",
        content:
          "Thomas Grant – VP of AWS Partnerships at Amazon. Importance: CRITICAL.",
      },
      {
        type: "Nudge",
        content:
          "No interaction with William Chen (JPMorgan) in 95 days.",
      },
      {
        type: "Meeting",
        content:
          'QBR with Microsoft – Sarah Mitchell and David Park. Review Q1 performance.',
      },
    ];

    it("should match documents by company name", () => {
      const keywords = extractKeywords("Tell me about Microsoft");
      const matched = matchDocs(keywords, docs);
      expect(matched.length).toBeGreaterThanOrEqual(2);
      expect(matched.some((d) => d.content.includes("Microsoft"))).toBe(true);
    });

    it("should match documents by person name", () => {
      const keywords = extractKeywords("What about Sarah Mitchell?");
      const matched = matchDocs(keywords, docs);
      expect(matched.length).toBeGreaterThanOrEqual(1);
      expect(matched.some((d) => d.content.includes("Sarah"))).toBe(true);
    });

    it("should match documents by topic", () => {
      const keywords = extractKeywords("cloud migration");
      const matched = matchDocs(keywords, docs);
      expect(matched.length).toBeGreaterThanOrEqual(1);
      expect(matched.some((d) => d.content.includes("cloud"))).toBe(true);
    });

    it("should return empty for unrelated query", () => {
      const keywords = extractKeywords("quantum computing blockchain");
      const matched = matchDocs(keywords, docs);
      expect(matched).toHaveLength(0);
    });

    it("should match across different document types", () => {
      const keywords = extractKeywords("Amazon partnerships");
      const matched = matchDocs(keywords, docs);
      expect(matched.some((d) => d.type === "Signal")).toBe(true);
      expect(matched.some((d) => d.type === "Contact")).toBe(true);
    });
  });
});
