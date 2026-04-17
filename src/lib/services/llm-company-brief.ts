import { callLLMWithWebSearch, type WebSearchCitation } from "./llm-core";
import { prisma } from "@/lib/db/prisma";

// ── Types ───────────────────────────────────────────────────────────

export interface CompanyBriefSubsection {
  id: string;
  title: string;
  content: string;
}

export interface CompanyBriefSource {
  id: string;
  title: string;
  type: "filing" | "transcript" | "news" | "analyst" | "other";
  url: string;
  date: string;
  publisher?: string;
}

export interface CompanyBriefResult {
  subsections: CompanyBriefSubsection[];
  sources: CompanyBriefSource[];
  generatedAt: string;
  model: string;
}

// ── System Prompt ───────────────────────────────────────────────────

const COMPANY_BRIEF_SYSTEM_PROMPT = `You are a senior equity research analyst preparing a comprehensive company intelligence brief for a consulting firm Partner. Your brief must be authoritative, cross-referenced, and sourced.

RESEARCH DIMENSIONS — cover all six:
1. Operational & Financial Performance — revenue, margins, growth trajectory, segment breakdowns from latest filings/transcripts
2. Strategic Initiatives — key strategic bets, product launches, platform shifts, partnerships
3. M&A & Transactions — recent acquisitions, divestitures, significant deals
4. Leadership & Governance — C-suite changes, board composition shifts, executive commentary
5. Market & Regulatory Developments — industry dynamics, regulatory actions, competitive positioning
6. Analyst & Market Sentiment — consensus analyst ratings, price targets, notable upgrades/downgrades, current stock price, YTD trend, market capitalization

RULES:
- Cross-reference claims across at least 2 source types (filings vs. transcripts vs. news) where possible
- Include select direct excerpts (CEO quotes from earnings calls, filing language) where they add insight
- Flag any conflicting information between sources
- Use **bold** for key numbers, names, and dates
- Write 3-6 sentences per subsection as flowing prose. NO bullet points.
- Use bracketed [s1], [s2] style inline citations referencing the sources array

OUTPUT FORMAT — respond with ONLY valid JSON, no markdown fences:
{
  "subsections": [
    {"id": "financial", "title": "Operational & Financial Performance", "content": "..."},
    {"id": "strategic", "title": "Strategic Initiatives", "content": "..."},
    {"id": "mna", "title": "M&A & Transactions", "content": "..."},
    {"id": "leadership", "title": "Leadership & Governance", "content": "..."},
    {"id": "market", "title": "Market & Regulatory Developments", "content": "..."},
    {"id": "sentiment", "title": "Analyst & Market Sentiment", "content": "..."}
  ],
  "sources": [
    {"id": "s1", "title": "...", "type": "filing|transcript|news|analyst|other", "url": "...", "date": "YYYY-MM-DD", "publisher": "..."},
    ...
  ]
}`;

// ── Generate Company Brief ──────────────────────────────────────────

export async function generateCompanyBrief(
  companyName: string,
  companyIndustry: string,
): Promise<CompanyBriefResult> {
  const model = process.env.COMPANY_BRIEF_MODEL ?? "gpt-4o-mini";

  const userPrompt = `Prepare a comprehensive intelligence brief for **${companyName}** (industry: ${companyIndustry}). Research their latest SEC filings, earnings transcripts, recent news, M&A activity, leadership changes, and analyst coverage. Include current stock/market data.`;

  const result = await callLLMWithWebSearch(
    COMPANY_BRIEF_SYSTEM_PROMPT,
    userPrompt,
    { model, maxOutputTokens: 8000 },
  );

  if (result) {
    const parsed = parseCompanyBriefResponse(result.text, result.citations);
    if (parsed) return { ...parsed, generatedAt: new Date().toISOString(), model };
  }

  return generateCompanyBriefFallback(companyName, model);
}

function parseCompanyBriefResponse(
  raw: string,
  citations: WebSearchCitation[],
): Omit<CompanyBriefResult, "generatedAt" | "model"> | null {
  try {
    const cleaned = raw.replace(/```json\n?|\n?```/g, "").trim();
    const data = JSON.parse(cleaned);

    if (!Array.isArray(data.subsections) || data.subsections.length < 4) return null;

    const subsections: CompanyBriefSubsection[] = data.subsections.map(
      (s: { id: string; title: string; content: string }) => ({
        id: s.id,
        title: s.title,
        content: s.content,
      }),
    );

    let sources: CompanyBriefSource[] = [];
    if (Array.isArray(data.sources)) {
      sources = data.sources.map(
        (s: { id: string; title: string; type: string; url: string; date: string; publisher?: string }) => ({
          id: s.id,
          title: s.title,
          type: classifySourceType(s.type),
          url: s.url,
          date: s.date ?? "",
          publisher: s.publisher,
        }),
      );
    }

    if (sources.length === 0 && citations.length > 0) {
      sources = citations.map((c, i) => ({
        id: `s${i + 1}`,
        title: c.title,
        type: classifySourceType(guessSourceType(c.url, c.title)),
        url: c.url,
        date: "",
      }));
    }

    return { subsections, sources };
  } catch {
    return null;
  }
}

function classifySourceType(raw: string): CompanyBriefSource["type"] {
  const lower = (raw ?? "").toLowerCase();
  if (lower.includes("filing") || lower.includes("sec") || lower.includes("10-k") || lower.includes("10-q")) return "filing";
  if (lower.includes("transcript") || lower.includes("earnings call")) return "transcript";
  if (lower.includes("analyst") || lower.includes("rating") || lower.includes("upgrade") || lower.includes("downgrade")) return "analyst";
  if (lower.includes("news") || lower.includes("article") || lower.includes("report")) return "news";
  return "other";
}

function guessSourceType(url: string, title: string): string {
  const combined = `${url} ${title}`.toLowerCase();
  if (combined.includes("sec.gov") || combined.includes("edgar")) return "filing";
  if (combined.includes("transcript") || combined.includes("earnings call")) return "transcript";
  if (combined.includes("seeking") || combined.includes("analyst") || combined.includes("morningstar")) return "analyst";
  return "news";
}

function generateCompanyBriefFallback(
  companyName: string,
  model: string,
): CompanyBriefResult {
  return {
    subsections: [
      { id: "financial", title: "Operational & Financial Performance", content: `Company Brief for **${companyName}** is unavailable — click Refresh to try again.` },
      { id: "strategic", title: "Strategic Initiatives", content: "Data not available." },
      { id: "mna", title: "M&A & Transactions", content: "Data not available." },
      { id: "leadership", title: "Leadership & Governance", content: "Data not available." },
      { id: "market", title: "Market & Regulatory Developments", content: "Data not available." },
      { id: "sentiment", title: "Analyst & Market Sentiment", content: "Data not available." },
    ],
    sources: [],
    generatedAt: new Date().toISOString(),
    model,
  };
}

// ── Persistence Helpers ─────────────────────────────────────────────

export async function getCachedCompanyBrief(
  companyId: string,
): Promise<CompanyBriefResult | null> {
  const row = await prisma.companyBrief.findFirst({
    where: { companyId, expiresAt: { gt: new Date() } },
    orderBy: { generatedAt: "desc" },
  });
  if (!row) return null;
  try {
    const data = JSON.parse(row.content);
    return {
      subsections: data.subsections ?? [],
      sources: data.sources ?? [],
      generatedAt: row.generatedAt.toISOString(),
      model: row.model,
    };
  } catch {
    return null;
  }
}

export async function storeCompanyBrief(
  companyId: string,
  brief: CompanyBriefResult,
): Promise<void> {
  const expiryHours = parseInt(process.env.COMPANY_BRIEF_EXPIRY_HOURS ?? "24", 10);
  const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);
  await prisma.companyBrief.create({
    data: {
      companyId,
      content: JSON.stringify({ subsections: brief.subsections, sources: brief.sources }),
      model: brief.model,
      expiresAt,
    },
  });
}

export async function refreshCompanyBrief(
  companyId: string,
  companyName: string,
  companyIndustry: string,
): Promise<CompanyBriefResult> {
  const brief = await generateCompanyBrief(companyName, companyIndustry);
  await storeCompanyBrief(companyId, brief);
  return brief;
}
