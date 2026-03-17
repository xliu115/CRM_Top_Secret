import { tavily } from "@tavily/core";
import { contactRepo, signalRepo } from "@/lib/repositories";
import { prisma } from "@/lib/db/prisma";

interface FetchedArticle {
  title: string;
  content: string;
  url: string;
}

async function fetchCompanyNews(
  companyName: string,
  maxResults = 5
): Promise<FetchedArticle[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return [];

  try {
    const client = tavily({ apiKey });
    const response = await client.search(
      `${companyName} latest news`,
      {
        maxResults,
        searchDepth: "basic",
        topic: "news",
      }
    );

    return (response.results ?? []).map((r) => ({
      title: r.title,
      content: r.content,
      url: r.url,
    }));
  } catch (err) {
    console.error(
      `[news-ingestion] Tavily search failed for "${companyName}":`,
      err
    );
    return [];
  }
}

/**
 * Fetches real news for all companies associated with a partner's contacts,
 * replaces stale NEWS signals, and returns the count of new signals created.
 */
export async function ingestNewsForPartner(partnerId: string): Promise<number> {
  const contacts = await contactRepo.findByPartnerId(partnerId);

  const companyMap = new Map<string, string>();
  for (const c of contacts) {
    if (!companyMap.has(c.companyId)) {
      companyMap.set(c.companyId, c.company.name);
    }
  }

  if (companyMap.size === 0) return 0;

  let totalCreated = 0;

  // Fetch news for each company in parallel (capped at 5 concurrent)
  const entries = Array.from(companyMap.entries());
  const batchSize = 5;

  for (let i = 0; i < entries.length; i += batchSize) {
    const batch = entries.slice(i, i + batchSize);

    const results = await Promise.allSettled(
      batch.map(async ([companyId, companyName]) => {
        const articles = await fetchCompanyNews(companyName, 3);
        if (articles.length === 0) return 0;

        // Check for existing signals that reference nudges (can't delete those)
        // Delete old fetched NEWS signals for this company, then insert fresh ones
        // Use a transaction to keep it atomic
        const count = await prisma.$transaction(async (tx) => {
          await tx.externalSignal.deleteMany({
            where: {
              companyId,
              type: "NEWS",
              nudges: { none: {} },
            },
          });

          const { count: created } = await tx.externalSignal.createMany({
            data: articles.map((a) => ({
              companyId,
              type: "NEWS",
              date: new Date(),
              content: `${a.title} — ${a.content}`.slice(0, 500),
              url: a.url,
              confidence: 0.85,
            })),
          });

          return created;
        });

        console.log(
          `[news-ingestion] ${companyName}: ingested ${count} articles`
        );
        return count;
      })
    );

    for (const r of results) {
      if (r.status === "fulfilled") totalCreated += r.value;
    }
  }

  console.log(
    `[news-ingestion] Total: ${totalCreated} news signals for ${companyMap.size} companies`
  );
  return totalCreated;
}
