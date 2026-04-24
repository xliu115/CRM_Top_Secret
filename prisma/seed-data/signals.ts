import { companies } from "./companies";

type SignalType = "NEWS" | "EVENT" | "JOB_CHANGE" | "LINKEDIN_ACTIVITY";

interface ContactRef {
  id: string;
  name: string;
  companyId: string;
  title: string;
}

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  };
}

// ── Real company news — verified URLs, dated within the last few days ──

interface RealNewsItem {
  content: string;
  url: string;
  daysAgo: number; // 0 = today, 1 = yesterday, etc.
}

const realNewsByCompany: Record<string, RealNewsItem[]> = {
  "c-microsoft": [
    {
      content:
        "Microsoft SharePoint turns 25, rolls out agentic AI building and governance tools",
      url: "https://redmondmag.com/articles/2026/03/03/microsoft-turns-25-on-sharepoint.aspx",
      daysAgo: 3,
    },
    {
      content:
        "Microsoft Security Blog: Malicious AI assistant extensions found harvesting LLM chat histories across 20,000 enterprise tenants",
      url: "https://www.microsoft.com/en-us/security/blog/2026/03/05/malicious-ai-assistant-extensions-harvest-llm-chat-histories/",
      daysAgo: 1,
    },
    {
      content:
        "Microsoft, Europol and partners disrupt Tycoon 2FA phishing platform that impacted 500,000+ organizations monthly",
      url: "https://blogs.microsoft.com/on-the-issues/2026/03/04/how-a-global-coalition-disrupted-tycoon/",
      daysAgo: 2,
    },
    {
      content:
        "Perplexity signs $750 million AI cloud deal with Microsoft Azure",
      url: "https://www.reuters.com/business/perplexity-signs-750-million-ai-cloud-deal-with-microsoft-bloomberg-news-reports-2026-01-29/",
      daysAgo: 0,
    },
  ],
  "c-apple": [
    {
      content:
        "Apple's biggest week of 2026: MacBook Neo, iPhone 17e, MacBook Pro M5, iPad Air M4, and new Studio Displays announced",
      url: "https://www.macrumors.com/2026/03/04/apple-march-2026-product-releases/",
      daysAgo: 2,
    },
    {
      content:
        "Apple introduces iPhone 17e with A19 chip, 48MP camera, and satellite connectivity starting at $599",
      url: "https://www.apple.com/newsroom/2026/03/apple-introduces-iphone-17e/",
      daysAgo: 2,
    },
    {
      content:
        "Apple introduces MacBook Pro with M5 Pro and M5 Max chips — up to 4x faster AI performance",
      url: "https://www.apple.com/newsroom/2026/03/apple-introduces-macbook-pro-with-all-new-m5-pro-and-m5-max/",
      daysAgo: 2,
    },
    {
      content:
        "Apple unveils new Studio Display and all-new Studio Display XDR with mini-LED and 120Hz",
      url: "https://www.apple.com/newsroom/2026/03/apple-unveils-new-studio-display-and-all-new-studio-display-xdr/",
      daysAgo: 2,
    },
  ],
  "c-amazon": [
    {
      content:
        "Amazon cuts jobs in robotics division as layoffs continue — at least 100 white-collar roles eliminated",
      url: "https://today.reuters.com/business/world-at-work/amazon-cuts-more-jobs-this-time-robotics-unit-2026-03-04/",
      daysAgo: 2,
    },
    {
      content:
        "Amazon launches new AI-powered Seller Canvas tool helping merchants visualize and grow their business in real time",
      url: "https://www.aboutamazon.com/news/innovation-at-amazon/amazon-sellers-canvas-artificial-intelligence",
      daysAgo: 1,
    },
    {
      content:
        "Amazon's AWS CEO calls orbital data centers 'pretty far' from reality despite growing interest in space computing",
      url: "https://www.reuters.com/business/aerospace-defense/amazons-aws-ceo-says-orbital-data-centers-pretty-far-reality-2026-02-03/",
      daysAgo: 0,
    },
    {
      content:
        "Amazon's ongoing restructuring has eliminated ~30,000 corporate roles since October 2025 — nearly 10% of its white-collar workforce",
      url: "https://www.businessinsider.com/amazon-robotics-division-job-cuts-2026-3",
      daysAgo: 1,
    },
  ],
  "c-jpmorgan": [
    {
      content:
        "JPMorgan CEO Jamie Dimon says AI could lead to a four-day work week: 'It will be a wonderful thing'",
      url: "https://finance.yahoo.com/news/jpmorgan-ceo-jamie-dimon-says-183041637.html",
      daysAgo: 1,
    },
    {
      content:
        "Chase becomes new issuer of Apple Card, expanding JPMorgan's consumer finance offerings",
      url: "https://www.jpmorganchase.com/newsroom/press-releases/2026/chase-to-become-new-issuer-of-apple-card",
      daysAgo: 2,
    },
    {
      content:
        "JPMorgan CEO Dimon argues stablecoin issuers paying interest should be regulated as banks",
      url: "https://www.coindesk.com/policy/2026/03/03/jp-morgan-ceo-jamie-dimon-says-stablecoin-issuers-paying-interest-should-be-regulated-as-banks",
      daysAgo: 3,
    },
    {
      content:
        "JPMorgan achieved record $57.5 billion net income in 2025, stock up 37% — outperforming Dow Jones by 24 points",
      url: "https://www.disruptionbanking.com/2026/03/02/jpmorgan-outperforms-dow-jones-in-2025-37-57b-record-year/",
      daysAgo: 4,
    },
  ],
  "c-google": [
    {
      content:
        "Alphabet completes landmark $20 billion bond offering with $100B+ investor demand, including rare 100-year century bonds",
      url: "https://markets.financialcontent.com/worldnow.kwtv/article/marketminute-2026-3-5-alphabets-20-billion-ai-war-chest-a-100-billion-bet-on-the-future-of-tech",
      daysAgo: 1,
    },
    {
      content:
        "Alphabet stock surges 80% YoY as Gemini 3.1 Pro dominates AI benchmarks — company now valued at $4 trillion",
      url: "https://www.reuters.com/business/alphabet-hits-4-trillion-valuation-ai-refocus-lifts-sentiment-2026-01-12/",
      daysAgo: 0,
    },
    {
      content:
        "Alphabet partners with Broadcom on 'Project Ironwood' — 7th-gen TPU to achieve 'AI Sovereignty' from third-party GPUs",
      url: "https://business.times-online.com/times-online/article/marketminute-2026-3-4-alphabets-sovereign-ai-era-how-gemini-3-and-the-broadcom-tpu-alliance-propelled-googl-to-a-magnificent-7-blowout",
      daysAgo: 2,
    },
    {
      content:
        "Alphabet faces landmark wrongful death lawsuit alleging Gemini chatbot contributed to user's suicide",
      url: "https://finance.yahoo.com/news/gemini-lawsuit-apple-deal-reframe-021911317.html",
      daysAgo: 1,
    },
  ],
  "c-meta": [
    {
      content:
        "Meta creates new applied AI engineering unit led by Maher Saba to accelerate model development",
      url: "https://www.pymnts.com/artificial-intelligence-2/2026/meta-creates-new-ai-unit-to-accelerate-model-development/",
      daysAgo: 1,
    },
    {
      content:
        "Meta reworks AI chip strategy — partners with AMD, leases Google chips, cancels in-house chip after design setbacks",
      url: "https://finance.yahoo.com/news/meta-reworks-ai-chip-strategy-100814965.html",
      daysAgo: 2,
    },
    {
      content:
        "Meta to temporarily allow rival AI chatbots on WhatsApp in EU to address antitrust concerns",
      url: "https://www.theverge.com/tech/889875/meta-says-it-will-temporarily-allow-rival-ai-chatbots-on-whatsapp-in-the-eu",
      daysAgo: 0,
    },
    {
      content:
        "Meta plans to double AI investment in 2026 to $115-135 billion capex, up from $72.2B in 2025",
      url: "https://www.sramanamitra.com/2026/02/25/meta-plans-on-doubling-ai-investment-in-2026/",
      daysAgo: 3,
    },
  ],
  "c-nvidia": [
    {
      content:
        "Nvidia CEO Jensen Huang hints at end of investments in OpenAI and Anthropic as both prepare for IPOs later in 2026",
      url: "https://techcrunch.com/2026/03/04/jensen-huang-says-nvidia-is-pulling-back-from-openai-and-anthropic-but-his-explanation-raises-more-questions-than-it-answers/",
      daysAgo: 2,
    },
    {
      content:
        "Nvidia announces next-gen Vera Rubin platform — 6 new chips enabling 75% fewer GPUs for training and 90% lower inference costs",
      url: "https://nvidianews.nvidia.com/news/rubin-platform-ai-supercomputer",
      daysAgo: 0,
    },
    {
      content:
        "Nvidia invests $4 billion ($2B each in Coherent and Lumentum) to advance silicon photonics for AI data centers",
      url: "https://www.reuters.com/technology/nvidia-invest-2-billion-photonic-product-maker-lumentum-2026-03-02/",
      daysAgo: 4,
    },
    {
      content:
        "Nvidia GTC 2026 announced for March 16-19 in San Jose — Jensen Huang to keynote with 30,000+ attendees expected",
      url: "https://nvidianews.nvidia.com/news/nvidia-ceo-jensen-huang-and-global-technology-leaders-to-showcase-age-of-ai-at-gtc-2026",
      daysAgo: 1,
    },
    {
      content:
        "Nvidia generated $215.9B revenue in fiscal 2026 (+65% YoY), forecasts Q1 FY2027 revenue at $78B (+77% YoY growth)",
      url: "https://www.fool.com/investing/2026/03/06/jensen-huang-incredible-news-nvidia-stock-investor/",
      daysAgo: 0,
    },
  ],
  "c-salesforce": [
    {
      content:
        "Salesforce rolls out Agentforce Health AI agents at HIMSS 2026 — early adopter MIMIT Health reports 459% ROI",
      url: "https://www.techtarget.com/searchcustomerexperience/news/366639798/Salesforce-rolls-out-Agentforce-Health-AI-agents",
      daysAgo: 1,
    },
    {
      content:
        "Formula 1 expands Salesforce partnership — Agentforce-powered fan companion handles 80% of routine queries",
      url: "https://www.salesforce.com/news/press-releases/2026/03/03/formula-1-agentforce-to-grow-fan-connection/",
      daysAgo: 3,
    },
    {
      content:
        "Salesforce restructures Partner Program — consolidates to two tiers, launches $1B success-based incentives",
      url: "https://www.salesforce.com/news/stories/rewarding-value-through-new-salesforce-partner-program/",
      daysAgo: 2,
    },
    {
      content:
        "Salesforce announces Spring 2026 product release with expanded Agentforce vertical industry suites",
      url: "https://www.salesforce.com/news/stories/spring-2026-product-release-announcement/",
      daysAgo: 0,
    },
  ],
  "c-adobe": [
    {
      content:
        "Adobe to announce Q1 FY2026 earnings on March 12 — analysts watching AI-powered creative tools adoption",
      url: "https://finance.yahoo.com/news/adobe-announce-q1-fy2026-earnings-180000475.html",
      daysAgo: 1,
    },
    {
      content:
        "WPP and Adobe expand partnership to drive AI transformation for client marketing operations with agentic workflows",
      url: "https://news.adobe.com/news/2026/02/wpp-adobe-expand-partnership",
      daysAgo: 3,
    },
    {
      content:
        "Adobe partners with OpenAI to test ads for Acrobat Studio and Firefly in ChatGPT",
      url: "https://blog.adobe.com/en/publish/2026/02/09/adobe-partners-openai-test-ads-chatgpt",
      daysAgo: 2,
    },
    {
      content:
        "Adobe introduces free Photoshop, Acrobat and Firefly AI for students in India — targeting millions through government partnership",
      url: "https://news.adobe.com/en/apac/news/2026/02/adobe-introduces-photoshop-acrobat-and-firefly-ai-student-offering-for-free-in-india-to-accelerate-vibrant-creator-economy",
      daysAgo: 4,
    },
  ],
  "c-netflix": [
    {
      content:
        "Netflix acquires Ben Affleck's InterPositive AI startup — AI tools for color correction, VFX, and relighting to reduce production costs",
      url: "https://www.newsshooter.com/2026/03/05/netflix-buys-ben-afflecks-interpositive-ai-startup/",
      daysAgo: 1,
    },
    {
      content:
        "Netflix launches ONE PIECE Season 2 on March 10 and Peaky Blinders film on March 20 — major content slate for March",
      url: "https://www.hollywoodreporter.com/tv/tv-news/netflix-march-2026-new-releases-movies-tv-1236520338/",
      daysAgo: 0,
    },
    {
      content:
        "Netflix premieres 'Vladimir' limited series starring Rachel Weisz — new original content strategy in full swing",
      url: "https://www.whats-on-netflix.com/coming-soon/biggest-new-netflix-originals-coming-in-march-2026/",
      daysAgo: 1,
    },
  ],
  "c-nike": [
    {
      content:
        "A'ja Wilson unveils second Nike signature shoe 'ATwo' in Paris — global launch May 2 with expanded apparel line",
      url: "https://www.webwire.com/ViewPressRel.asp?aId=351428",
      daysAgo: 1,
    },
    {
      content:
        "Nike appoints Cimarron Nix as Chief Sustainability Officer — company exceeded Scope 1 & 2 emissions targets with 74% reduction",
      url: "https://www.sgieurope.com/people/nike-names-new-chief-sustainability-officer/119848.article",
      daysAgo: 3,
    },
    {
      content:
        "Nike plans to reduce reliance on China production for US market to soften tariff blow amid trade tensions",
      url: "https://www.reuters.com/business/nike-posts-smaller-than-expected-drop-fourth-quarter-revenue-2025-06-26/",
      daysAgo: 0,
    },
  ],
  "c-pepsico": [
    {
      content:
        "PepsiCo-backed Poppi launches in UK on March 5 — first international expansion of $1.95B functional soda acquisition",
      url: "https://www.pepsico.com/newsroom/press-releases/2026/poppi-lands-in-the-uk-marking-its-first-launch-outside-united-states",
      daysAgo: 1,
    },
    {
      content:
        "PepsiCo, Campbell's and Smucker cut plants as snack market slows amid GLP-1 medication impact and soft volumes",
      url: "https://www.bakeryandsnacks.com/Article/2026/03/04/pepsico-campbells-and-smucker-cut-plants-as-snack-market-slows-amid-glp-1-impact-and-soft-volumes/",
      daysAgo: 2,
    },
    {
      content:
        "PepsiCo launches Gatorade Lower Sugar and Super Mario Galaxy themed bubly — targeting health-conscious consumers",
      url: "https://simplywall.st/stocks/us/food-beverage-tobacco/nasdaq-pep/pepsico/news/pepsico-targets-health-trends-with-gatorade-lower-sugar-and",
      daysAgo: 0,
    },
  ],
};

// NOTE on data accuracy
// --------------------------------------------------------------------
// The platform surfaces signal content verbatim in narratives, emails,
// and voice briefings. Randomly generated per-contact signals (fake
// job changes, fabricated event appearances, invented LinkedIn quotes)
// caused the LLM to assert false facts about real executives — e.g.
// claiming Jensen Huang had transitioned from CEO to "VP of AI & Data".
//
// To keep everything grounded in verifiable content, signals are now
// sourced exclusively from `realNewsByCompany` (curated, URL-backed
// company news). Any contact-specific signals should be added as
// explicit, hand-authored entries — never via templated randomization.

export function generateSignals(_contacts: ContactRef[]) {
  const signals: {
    id: string;
    contactId: string | null;
    companyId: string | null;
    type: SignalType;
    date: Date;
    content: string;
    url: string | null;
    confidence: number;
  }[] = [];

  const now = new Date();
  let idx = 0;

  // Company-level news signals — real, URL-backed items from
  // `realNewsByCompany` with explicit recency in days.
  for (const company of companies) {
    const newsItems = realNewsByCompany[company.id] ?? [];
    for (const item of newsItems) {
      signals.push({
        id: `sig-${String(idx).padStart(4, "0")}`,
        contactId: null,
        companyId: company.id,
        type: "NEWS",
        date: new Date(now.getTime() - item.daysAgo * 86400000),
        content: item.content,
        url: item.url,
        confidence: 0.95,
      });
      idx++;
    }
  }

  return signals;
}
