import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

const NEW_COMPANIES = [
  { id: "c-tesla", name: "Tesla", industry: "Automotive / Energy", description: "Electric vehicle and clean energy company.", employeeCount: 140000, website: "https://tesla.com" },
  { id: "c-disney", name: "The Walt Disney Company", industry: "Entertainment / Media", description: "Global entertainment and media conglomerate.", employeeCount: 225000, website: "https://thewaltdisneycompany.com" },
  { id: "c-goldmansachs", name: "Goldman Sachs", industry: "Financial Services", description: "Leading global investment banking and securities firm.", employeeCount: 49000, website: "https://goldmansachs.com" },
  { id: "c-oracle", name: "Oracle", industry: "Enterprise Software", description: "Enterprise cloud computing and database technology leader.", employeeCount: 164000, website: "https://oracle.com" },
  { id: "c-walmart", name: "Walmart", industry: "Retail", description: "World's largest retailer by revenue.", employeeCount: 2100000, website: "https://walmart.com" },
  { id: "c-pfizer", name: "Pfizer", industry: "Pharmaceuticals", description: "Global pharmaceutical and biotechnology corporation.", employeeCount: 88000, website: "https://pfizer.com" },
  { id: "c-boeing", name: "Boeing", industry: "Aerospace & Defense", description: "World's largest aerospace company and defense contractor.", employeeCount: 170000, website: "https://boeing.com" },
  { id: "c-uber", name: "Uber", industry: "Technology / Transportation", description: "Global ride-sharing and delivery platform.", employeeCount: 32800, website: "https://uber.com" },
  { id: "c-airbnb", name: "Airbnb", industry: "Technology / Hospitality", description: "Global online marketplace for lodging and experiences.", employeeCount: 6900, website: "https://airbnb.com" },
  { id: "c-stripe", name: "Stripe", industry: "Fintech", description: "Leading online payment processing platform for internet businesses.", employeeCount: 8000, website: "https://stripe.com" },
];

type Importance = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

interface ContactEntry {
  name: string;
  title: string;
  importance: Importance;
  companyId: string;
}

const CONTACTS: ContactEntry[] = [
  // Apple — real executives
  { name: "Eddy Cue", title: "SVP of Services and Health", importance: "CRITICAL", companyId: "c-apple" },
  { name: "Craig Federighi", title: "SVP of Software Engineering", importance: "CRITICAL", companyId: "c-apple" },
  { name: "John Ternus", title: "SVP of Hardware Engineering", importance: "HIGH", companyId: "c-apple" },
  { name: "Deirdre O'Brien", title: "SVP of Retail + People", importance: "HIGH", companyId: "c-apple" },
  { name: "Jennifer Newstead", title: "SVP and General Counsel", importance: "MEDIUM", companyId: "c-apple" },
  { name: "Luca Maestri", title: "Former CFO, Senior Advisor", importance: "MEDIUM", companyId: "c-apple" },
  { name: "Kevan Parekh", title: "SVP and CFO", importance: "HIGH", companyId: "c-apple" },
  { name: "Molly Anderson", title: "VP of Industrial Design", importance: "MEDIUM", companyId: "c-apple" },

  // Google / Alphabet
  { name: "Sundar Pichai", title: "CEO of Alphabet and Google", importance: "CRITICAL", companyId: "c-google" },
  { name: "Anat Ashkenazi", title: "SVP and CFO", importance: "HIGH", companyId: "c-google" },
  { name: "Kent Walker", title: "President of Global Affairs", importance: "HIGH", companyId: "c-google" },
  { name: "Philipp Schindler", title: "SVP and Chief Business Officer", importance: "HIGH", companyId: "c-google" },
  { name: "Ruth Porat", title: "President and CIO", importance: "CRITICAL", companyId: "c-google" },
  { name: "Thomas Kurian", title: "CEO of Google Cloud", importance: "CRITICAL", companyId: "c-google" },
  { name: "Prabhakar Raghavan", title: "SVP of Knowledge & Information", importance: "MEDIUM", companyId: "c-google" },

  // Microsoft
  { name: "Satya Nadella", title: "Chairman and CEO", importance: "CRITICAL", companyId: "c-microsoft" },
  { name: "Amy Hood", title: "EVP and CFO", importance: "HIGH", companyId: "c-microsoft" },
  { name: "Brad Smith", title: "Vice Chair and President", importance: "HIGH", companyId: "c-microsoft" },
  { name: "Scott Guthrie", title: "EVP, Cloud + AI Group", importance: "CRITICAL", companyId: "c-microsoft" },
  { name: "Judson Althoff", title: "EVP and Chief Commercial Officer", importance: "HIGH", companyId: "c-microsoft" },
  { name: "Mustafa Suleyman", title: "CEO, Microsoft AI", importance: "CRITICAL", companyId: "c-microsoft" },
  { name: "Pavan Davuluri", title: "EVP, Windows + Devices", importance: "MEDIUM", companyId: "c-microsoft" },
  { name: "Jacob Andreou", title: "EVP, Copilot", importance: "HIGH", companyId: "c-microsoft" },

  // Amazon
  { name: "Andy Jassy", title: "President and CEO", importance: "CRITICAL", companyId: "c-amazon" },
  { name: "Brian Olsavsky", title: "SVP and CFO", importance: "HIGH", companyId: "c-amazon" },
  { name: "Matt Garman", title: "CEO of AWS", importance: "CRITICAL", companyId: "c-amazon" },
  { name: "Doug Herrington", title: "CEO, Worldwide Amazon Stores", importance: "HIGH", companyId: "c-amazon" },
  { name: "Peter DeSantis", title: "SVP, AWS Utility Computing", importance: "HIGH", companyId: "c-amazon" },
  { name: "Panos Panay", title: "SVP, Devices & Services", importance: "MEDIUM", companyId: "c-amazon" },
  { name: "Beth Galetti", title: "SVP, People eXperience and Technology", importance: "MEDIUM", companyId: "c-amazon" },
  { name: "David Zapolsky", title: "Chief Global Affairs Officer", importance: "MEDIUM", companyId: "c-amazon" },

  // JPMorgan Chase
  { name: "Jamie Dimon", title: "Chairman and CEO", importance: "CRITICAL", companyId: "c-jpmorgan" },
  { name: "Jeremy Barnum", title: "Chief Financial Officer", importance: "HIGH", companyId: "c-jpmorgan" },
  { name: "Marianne Lake", title: "CEO, Consumer & Community Banking", importance: "CRITICAL", companyId: "c-jpmorgan" },
  { name: "Jennifer Piepszak", title: "Chief Operating Officer", importance: "HIGH", companyId: "c-jpmorgan" },
  { name: "Mary Callahan Erdoes", title: "CEO, Asset & Wealth Management", importance: "HIGH", companyId: "c-jpmorgan" },
  { name: "Troy Rohrbaugh", title: "Co-CEO, Commercial & Investment Bank", importance: "MEDIUM", companyId: "c-jpmorgan" },

  // Meta
  { name: "Mark Zuckerberg", title: "CEO and Chairman", importance: "CRITICAL", companyId: "c-meta" },
  { name: "Dina Powell McCormick", title: "President and Vice Chairman", importance: "CRITICAL", companyId: "c-meta" },
  { name: "Susan Li", title: "Chief Financial Officer", importance: "HIGH", companyId: "c-meta" },
  { name: "Andrew Bosworth", title: "CTO", importance: "HIGH", companyId: "c-meta" },
  { name: "Chris Cox", title: "Chief Product Officer", importance: "HIGH", companyId: "c-meta" },
  { name: "Javier Olivan", title: "Chief Operating Officer", importance: "MEDIUM", companyId: "c-meta" },

  // Nvidia
  { name: "Jensen Huang", title: "Founder, President and CEO", importance: "CRITICAL", companyId: "c-nvidia" },
  { name: "Colette Kress", title: "EVP and CFO", importance: "HIGH", companyId: "c-nvidia" },
  { name: "Jay Puri", title: "EVP, Worldwide Field Operations", importance: "HIGH", companyId: "c-nvidia" },
  { name: "Debora Shoquist", title: "EVP of Operations", importance: "MEDIUM", companyId: "c-nvidia" },
  { name: "Bill Dally", title: "Chief Scientist", importance: "HIGH", companyId: "c-nvidia" },
  { name: "Ian Buck", title: "VP and GM, Accelerated Computing", importance: "MEDIUM", companyId: "c-nvidia" },

  // Salesforce
  { name: "Marc Benioff", title: "Chair, CEO and Co-Founder", importance: "CRITICAL", companyId: "c-salesforce" },
  { name: "Robin Washington", title: "President and COFO", importance: "HIGH", companyId: "c-salesforce" },
  { name: "Parker Harris", title: "Co-Founder and CTO", importance: "HIGH", companyId: "c-salesforce" },
  { name: "David Schmaier", title: "President and Chief Product Officer", importance: "HIGH", companyId: "c-salesforce" },
  { name: "Patrick Stokes", title: "Chief Marketing Officer", importance: "MEDIUM", companyId: "c-salesforce" },
  { name: "Madhav Thattai", title: "EVP and GM, Agentforce", importance: "MEDIUM", companyId: "c-salesforce" },

  // Tesla
  { name: "Elon Musk", title: "CEO and Director", importance: "CRITICAL", companyId: "c-tesla" },
  { name: "Vaibhav Taneja", title: "CFO and Chief Accounting Officer", importance: "HIGH", companyId: "c-tesla" },
  { name: "Tom Zhu", title: "SVP, Automotive", importance: "HIGH", companyId: "c-tesla" },
  { name: "Ashok Elluswamy", title: "VP of AI Software", importance: "HIGH", companyId: "c-tesla" },
  { name: "Lars Moravy", title: "VP of Vehicle Engineering", importance: "MEDIUM", companyId: "c-tesla" },
  { name: "Franz von Holzhausen", title: "Chief Designer", importance: "MEDIUM", companyId: "c-tesla" },
  { name: "Brandon Ehrhart", title: "General Counsel", importance: "LOW", companyId: "c-tesla" },

  // Disney
  { name: "Josh D'Amaro", title: "Chief Executive Officer", importance: "CRITICAL", companyId: "c-disney" },
  { name: "Dana Walden", title: "President and Chief Creative Officer", importance: "CRITICAL", companyId: "c-disney" },
  { name: "Hugh Johnston", title: "SEVP and CFO", importance: "HIGH", companyId: "c-disney" },
  { name: "Alan Bergman", title: "Chairman, Disney Entertainment Studios", importance: "HIGH", companyId: "c-disney" },
  { name: "James Pitaro", title: "Chairman, ESPN", importance: "HIGH", companyId: "c-disney" },
  { name: "Horacio Gutierrez", title: "SEVP, Chief Legal Officer", importance: "MEDIUM", companyId: "c-disney" },
  { name: "Sonia Coleman", title: "SEVP and Chief People Officer", importance: "MEDIUM", companyId: "c-disney" },

  // Goldman Sachs
  { name: "David Solomon", title: "Chairman and CEO", importance: "CRITICAL", companyId: "c-goldmansachs" },
  { name: "Denis Coleman", title: "Chief Financial Officer", importance: "HIGH", companyId: "c-goldmansachs" },
  { name: "John Waldron", title: "President and COO", importance: "CRITICAL", companyId: "c-goldmansachs" },
  { name: "Nishi Somaiya", title: "Co-Head of Wealth Management", importance: "HIGH", companyId: "c-goldmansachs" },
  { name: "Gregory Calnon", title: "Co-Head of Public Investing", importance: "MEDIUM", companyId: "c-goldmansachs" },
  { name: "Kristin Olson", title: "Head of Alternatives for Wealth", importance: "MEDIUM", companyId: "c-goldmansachs" },
  { name: "James Reynolds", title: "Co-Head of Private Credit", importance: "MEDIUM", companyId: "c-goldmansachs" },

  // Oracle
  { name: "Safra Catz", title: "CEO", importance: "CRITICAL", companyId: "c-oracle" },
  { name: "Larry Ellison", title: "Chairman and CTO", importance: "CRITICAL", companyId: "c-oracle" },
  { name: "Clay Magouyrk", title: "EVP, Oracle Cloud Infrastructure", importance: "HIGH", companyId: "c-oracle" },
  { name: "Steve Miranda", title: "EVP, Applications Development", importance: "HIGH", companyId: "c-oracle" },
  { name: "Dorian Daley", title: "EVP and General Counsel", importance: "MEDIUM", companyId: "c-oracle" },

  // Walmart
  { name: "Doug McMillon", title: "President and CEO", importance: "CRITICAL", companyId: "c-walmart" },
  { name: "John David Rainey", title: "EVP and CFO", importance: "HIGH", companyId: "c-walmart" },
  { name: "Suresh Kumar", title: "EVP and CTO", importance: "HIGH", companyId: "c-walmart" },
  { name: "Donna Morris", title: "EVP and Chief People Officer", importance: "MEDIUM", companyId: "c-walmart" },

  // Adobe
  { name: "Shantanu Narayen", title: "Chairman and CEO", importance: "CRITICAL", companyId: "c-adobe" },
  { name: "Dan Durn", title: "EVP and CFO", importance: "HIGH", companyId: "c-adobe" },
  { name: "David Wadhwani", title: "President, Digital Media Business", importance: "HIGH", companyId: "c-adobe" },
  { name: "Anil Chakravarthy", title: "President, Digital Experience Business", importance: "HIGH", companyId: "c-adobe" },

  // Uber
  { name: "Dara Khosrowshahi", title: "CEO", importance: "CRITICAL", companyId: "c-uber" },
  { name: "Prashanth Mahendra-Rajah", title: "CFO", importance: "HIGH", companyId: "c-uber" },
  { name: "Tony West", title: "Chief Legal Officer", importance: "MEDIUM", companyId: "c-uber" },
  { name: "Andrew Macdonald", title: "SVP, Mobility and Business Operations", importance: "HIGH", companyId: "c-uber" },

  // Airbnb
  { name: "Brian Chesky", title: "Co-Founder and CEO", importance: "CRITICAL", companyId: "c-airbnb" },
  { name: "Dave Stephenson", title: "CFO", importance: "HIGH", companyId: "c-airbnb" },
  { name: "Hiroki Asai", title: "Chief Marketing Officer", importance: "MEDIUM", companyId: "c-airbnb" },

  // Stripe
  { name: "Patrick Collison", title: "Co-Founder and CEO", importance: "CRITICAL", companyId: "c-stripe" },
  { name: "John Collison", title: "Co-Founder and President", importance: "CRITICAL", companyId: "c-stripe" },
  { name: "Steffan Tomlinson", title: "CFO", importance: "HIGH", companyId: "c-stripe" },
  { name: "David Singleton", title: "CTO", importance: "HIGH", companyId: "c-stripe" },

  // Netflix
  { name: "Ted Sarandos", title: "Co-CEO and Chairman", importance: "CRITICAL", companyId: "c-netflix" },
  { name: "Greg Peters", title: "Co-CEO", importance: "CRITICAL", companyId: "c-netflix" },
  { name: "Spencer Neumann", title: "CFO", importance: "HIGH", companyId: "c-netflix" },

  // Nike
  { name: "Elliott Hill", title: "President and CEO", importance: "CRITICAL", companyId: "c-nike" },
  { name: "Matthew Friend", title: "EVP and CFO", importance: "HIGH", companyId: "c-nike" },
  { name: "Ann Miller", title: "EVP and General Counsel", importance: "MEDIUM", companyId: "c-nike" },

  // PepsiCo
  { name: "Ramon Laguarta", title: "Chairman and CEO", importance: "CRITICAL", companyId: "c-pepsico" },
  { name: "Jamie Caulfield", title: "EVP and CFO", importance: "HIGH", companyId: "c-pepsico" },
  { name: "Athina Kanioura", title: "EVP and Chief Strategy Officer", importance: "HIGH", companyId: "c-pepsico" },

  // Pfizer
  { name: "Albert Bourla", title: "Chairman and CEO", importance: "CRITICAL", companyId: "c-pfizer" },
  { name: "David Denton", title: "EVP and CFO", importance: "HIGH", companyId: "c-pfizer" },
  { name: "Mikael Dolsten", title: "Chief Scientific Officer", importance: "HIGH", companyId: "c-pfizer" },
  { name: "Aamir Malik", title: "EVP and Chief Business Innovation Officer", importance: "MEDIUM", companyId: "c-pfizer" },

  // Boeing
  { name: "Kelly Ortberg", title: "President and CEO", importance: "CRITICAL", companyId: "c-boeing" },
  { name: "Brian West", title: "EVP and CFO", importance: "HIGH", companyId: "c-boeing" },
  { name: "Stephanie Pope", title: "EVP and COO", importance: "HIGH", companyId: "c-boeing" },
  { name: "Ted Colbert", title: "President and CEO, Boeing Defense", importance: "MEDIUM", companyId: "c-boeing" },
];

const PARTNERS = [
  "p-ava-patel", "p-jordan-kim", "p-sam-rivera", "p-morgan-chen", "p-taylor-brooks",
];

function seededRandom(seed: number) {
  let s = seed;
  return () => { s = (s * 16807 + 0) % 2147483647; return s / 2147483647; };
}

async function main() {
  const rand = seededRandom(999);

  console.log("Creating new companies...");
  for (const co of NEW_COMPANIES) {
    await prisma.company.upsert({
      where: { id: co.id },
      update: {},
      create: co,
    });
  }
  console.log(`  ${NEW_COMPANIES.length} companies upserted.`);

  const existingMax = await prisma.contact.count();
  let idx = existingMax;

  console.log(`Adding ${CONTACTS.length} new contacts (starting at index ${idx})...`);
  let created = 0;
  for (const c of CONTACTS) {
    const partnerId = PARTNERS[Math.floor(rand() * PARTNERS.length)];
    const emailName = c.name.toLowerCase().replace(/[^a-z]/g, ".");
    const domain = c.companyId.replace("c-", "") + ".example.com";

    const existing = await prisma.contact.findFirst({
      where: { name: c.name, companyId: c.companyId },
    });
    if (existing) {
      console.log(`  Skipping ${c.name} (already exists)`);
      continue;
    }

    const daysAgo = Math.floor(rand() * 90) + 1;
    const lastContacted = new Date();
    lastContacted.setDate(lastContacted.getDate() - daysAgo);

    await prisma.contact.create({
      data: {
        id: `ct-${String(idx).padStart(3, "0")}`,
        partnerId,
        companyId: c.companyId,
        name: c.name,
        email: `${emailName}@${domain}`,
        title: c.title,
        phone: `+1-555-${String(2000 + idx).slice(-4)}-${String(Math.floor(rand() * 9000 + 1000))}`,
        importance: c.importance,
        notes: `${c.title} at ${c.companyId.replace("c-", "").replace(/^\w/, (ch) => ch.toUpperCase())}. Key relationship contact.`,
        lastContacted,
      },
    });
    created++;
    idx++;
  }

  console.log(`Done! Created ${created} new contacts.`);
  const total = await prisma.contact.count();
  console.log(`Total contacts in database: ${total}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
