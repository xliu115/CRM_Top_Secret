import { tavily } from "@tavily/core";
import { prisma } from "@/lib/db/prisma";

const TAVILY_QUERY =
  "McKinsey insights latest articles site:mckinsey.com";

export function inferPractice(title: string): string | null {
  const t = title.toLowerCase();
  const pairs: [RegExp, string][] = [
    [/\b(generative ai|artificial intelligence|\bai\b|quantumblack|machine learning)\b/, "AI"],
    [/\b(banking|bank|financial services|insurance|wealth|capital markets|fintech)\b/, "Financial Services"],
    [/\b(operations|supply chain|procurement|manufacturing|lean)\b/, "Operations"],
    [/\b(telecom|telecommunications|technology|media|tmt|digital transformation)\b/, "TMT"],
    [/\b(healthcare|health care|pharma|life sciences|medical)\b/, "Healthcare"],
    [/\b(strategy|m&a|mergers|acquisitions|corporate finance)\b/, "Strategy & Corporate Finance"],
    [/\b(sustainability|climate|net zero|energy transition|decarbon)\b/, "Sustainability"],
    [/\b(digital|analytics|data and analytics|cyber)\b/, "Digital & Analytics"],
  ];
  for (const [re, practice] of pairs) {
    if (re.test(t)) return practice;
  }
  return null;
}

function mapResultToArticleData(r: {
  title?: string;
  content?: string;
  url?: string;
  published_date?: string;
}) {
  const url = r.url?.trim();
  if (!url) return null;

  const title = (r.title ?? "Untitled").trim() || "Untitled";
  const description = (r.content ?? "").trim().slice(0, 2000) || null;
  const practice = inferPractice(title);
  const publishedAt = r.published_date
    ? new Date(r.published_date)
    : null;

  return {
    type: "ARTICLE" as const,
    title,
    description,
    url,
    sourceId: url,
    practice,
    publishedAt:
      publishedAt && !Number.isNaN(publishedAt.getTime())
        ? publishedAt
        : null,
  };
}

export async function ingestArticles(): Promise<number> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return 0;

  try {
    const client = tavily({ apiKey });
    const response = await client.search(TAVILY_QUERY, {
      maxResults: 20,
      searchDepth: "basic",
      topic: "news",
    });

    const results = response.results ?? [];
    let created = 0;

    for (const r of results) {
      const data = mapResultToArticleData(r);
      if (!data) continue;

      const existing = await prisma.contentItem.findFirst({
        where: { sourceId: data.sourceId },
      });

      if (existing) {
        await prisma.contentItem.update({
          where: { id: existing.id },
          data: {
            title: data.title,
            description: data.description,
            url: data.url,
            practice: data.practice,
            publishedAt: data.publishedAt,
          },
        });
      } else {
        await prisma.contentItem.create({ data });
        created += 1;
      }
    }

    console.log(
      `[content-ingestion] Ingested McKinsey articles: ${created} new, ${results.length} fetched`
    );
    return created;
  } catch (err) {
    console.error("[content-ingestion] Tavily search failed:", err);
    return 0;
  }
}
