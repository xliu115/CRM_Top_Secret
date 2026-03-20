import { partners } from "./partners";
import { companies } from "./companies";

type Importance = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

interface ContactDef {
  name: string;
  title: string;
  importance: Importance;
}

// Real, verifiable executives — all names are publicly listed on company websites, LinkedIn, or news.
// Sources: company leadership pages, SEC filings, press releases.
const contactsByCompany: Record<string, ContactDef[]> = {
  "c-microsoft": [
    { name: "Satya Nadella", title: "Chairman and CEO", importance: "CRITICAL" },
    { name: "Scott Guthrie", title: "EVP, Cloud + AI Group", importance: "CRITICAL" },
    { name: "Mustafa Suleyman", title: "CEO, Microsoft AI", importance: "CRITICAL" },
    { name: "Amy Hood", title: "EVP and CFO", importance: "HIGH" },
    { name: "Brad Smith", title: "Vice Chair and President", importance: "HIGH" },
    { name: "Judson Althoff", title: "EVP and Chief Commercial Officer", importance: "HIGH" },
    { name: "Pavan Davuluri", title: "EVP, Windows + Devices", importance: "MEDIUM" },
  ],
  "c-apple": [
    { name: "Eddy Cue", title: "SVP of Services and Health", importance: "CRITICAL" },
    { name: "Craig Federighi", title: "SVP of Software Engineering", importance: "CRITICAL" },
    { name: "John Ternus", title: "SVP of Hardware Engineering", importance: "HIGH" },
    { name: "Deirdre O'Brien", title: "SVP of Retail + People", importance: "HIGH" },
    { name: "Kevan Parekh", title: "SVP and CFO", importance: "HIGH" },
    { name: "Jennifer Newstead", title: "SVP and General Counsel", importance: "MEDIUM" },
    { name: "Molly Anderson", title: "VP of Industrial Design", importance: "MEDIUM" },
  ],
  "c-amazon": [
    { name: "Andy Jassy", title: "President and CEO", importance: "CRITICAL" },
    { name: "Matt Garman", title: "CEO of AWS", importance: "CRITICAL" },
    { name: "Doug Herrington", title: "CEO, Worldwide Amazon Stores", importance: "HIGH" },
    { name: "Brian Olsavsky", title: "SVP and CFO", importance: "HIGH" },
    { name: "Peter DeSantis", title: "SVP, AWS Utility Computing", importance: "HIGH" },
    { name: "Panos Panay", title: "SVP, Devices & Services", importance: "MEDIUM" },
    { name: "Beth Galetti", title: "SVP, People eXperience and Technology", importance: "MEDIUM" },
  ],
  "c-jpmorgan": [
    { name: "Jamie Dimon", title: "Chairman and CEO", importance: "CRITICAL" },
    { name: "Marianne Lake", title: "CEO, Consumer & Community Banking", importance: "CRITICAL" },
    { name: "Jeremy Barnum", title: "Chief Financial Officer", importance: "HIGH" },
    { name: "Jennifer Piepszak", title: "Chief Operating Officer", importance: "HIGH" },
    { name: "Mary Callahan Erdoes", title: "CEO, Asset & Wealth Management", importance: "HIGH" },
    { name: "Troy Rohrbaugh", title: "Co-CEO, Commercial & Investment Bank", importance: "MEDIUM" },
  ],
  "c-google": [
    { name: "Sundar Pichai", title: "CEO of Alphabet and Google", importance: "CRITICAL" },
    { name: "Thomas Kurian", title: "CEO of Google Cloud", importance: "CRITICAL" },
    { name: "Ruth Porat", title: "President and CIO", importance: "CRITICAL" },
    { name: "Anat Ashkenazi", title: "SVP and CFO", importance: "HIGH" },
    { name: "Kent Walker", title: "President of Global Affairs", importance: "HIGH" },
    { name: "Philipp Schindler", title: "SVP and Chief Business Officer", importance: "HIGH" },
    { name: "Prabhakar Raghavan", title: "SVP of Knowledge & Information", importance: "MEDIUM" },
  ],
  "c-meta": [
    { name: "Mark Zuckerberg", title: "CEO and Chairman", importance: "CRITICAL" },
    { name: "Dina Powell McCormick", title: "President and Vice Chairman", importance: "CRITICAL" },
    { name: "Andrew Bosworth", title: "CTO", importance: "HIGH" },
    { name: "Susan Li", title: "Chief Financial Officer", importance: "HIGH" },
    { name: "Chris Cox", title: "Chief Product Officer", importance: "HIGH" },
    { name: "Javier Olivan", title: "Chief Operating Officer", importance: "MEDIUM" },
  ],
  "c-nvidia": [
    { name: "Jensen Huang", title: "Founder, President and CEO", importance: "CRITICAL" },
    { name: "Colette Kress", title: "EVP and CFO", importance: "HIGH" },
    { name: "Jay Puri", title: "EVP, Worldwide Field Operations", importance: "HIGH" },
    { name: "Bill Dally", title: "Chief Scientist", importance: "HIGH" },
    { name: "Debora Shoquist", title: "EVP of Operations", importance: "MEDIUM" },
    { name: "Ian Buck", title: "VP and GM, Accelerated Computing", importance: "MEDIUM" },
  ],
  "c-salesforce": [
    { name: "Marc Benioff", title: "Chair, CEO and Co-Founder", importance: "CRITICAL" },
    { name: "Robin Washington", title: "President and COFO", importance: "HIGH" },
    { name: "Parker Harris", title: "Co-Founder and CTO", importance: "HIGH" },
    { name: "David Schmaier", title: "President and Chief Product Officer", importance: "HIGH" },
    { name: "Patrick Stokes", title: "Chief Marketing Officer", importance: "MEDIUM" },
    { name: "Madhav Thattai", title: "EVP and GM, Agentforce", importance: "MEDIUM" },
  ],
  "c-adobe": [
    { name: "Shantanu Narayen", title: "Chairman and CEO", importance: "CRITICAL" },
    { name: "Dan Durn", title: "EVP and CFO", importance: "HIGH" },
    { name: "David Wadhwani", title: "President, Digital Media Business", importance: "HIGH" },
    { name: "Anil Chakravarthy", title: "President, Digital Experience Business", importance: "HIGH" },
  ],
  "c-netflix": [
    { name: "Ted Sarandos", title: "Co-CEO and Chairman", importance: "CRITICAL" },
    { name: "Greg Peters", title: "Co-CEO", importance: "CRITICAL" },
    { name: "Spencer Neumann", title: "CFO", importance: "HIGH" },
  ],
  "c-nike": [
    { name: "Elliott Hill", title: "President and CEO", importance: "CRITICAL" },
    { name: "Matthew Friend", title: "EVP and CFO", importance: "HIGH" },
    { name: "Ann Miller", title: "EVP and General Counsel", importance: "MEDIUM" },
  ],
  "c-pepsico": [
    { name: "Ramon Laguarta", title: "Chairman and CEO", importance: "CRITICAL" },
    { name: "Jamie Caulfield", title: "EVP and CFO", importance: "HIGH" },
    { name: "Athina Kanioura", title: "EVP and Chief Strategy Officer", importance: "HIGH" },
  ],
};

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  };
}

export function generateContacts() {
  const rand = seededRandom(42);
  const contacts: {
    id: string;
    partnerId: string;
    companyId: string;
    name: string;
    email: string;
    title: string;
    phone: string;
    importance: Importance;
    notes: string;
  }[] = [];

  let idx = 0;
  for (const [companyId, defs] of Object.entries(contactsByCompany)) {
    for (const def of defs) {
      const primaryPartnerIdx = Math.floor(rand() * partners.length);
      const primaryPartner = partners[primaryPartnerIdx];
      const emailName = def.name.toLowerCase().replace(/[^a-z]/g, ".");
      const companyDomain = companies
        .find((c) => c.id === companyId)!
        .name.toLowerCase()
        .replace(/[^a-z]/g, "");
      const companyName = companies.find((c) => c.id === companyId)!.name;

      contacts.push({
        id: `ct-${String(idx).padStart(3, "0")}`,
        partnerId: primaryPartner.id,
        companyId,
        name: def.name,
        email: `${emailName}@${companyDomain}.example.com`,
        title: def.title,
        phone: `+1-555-${String(1000 + idx).slice(-4)}-${String(
          Math.floor(rand() * 9000 + 1000)
        )}`,
        importance: def.importance,
        notes: `Key ${def.title} contact at ${companyName}. Relationship established ${2020 + Math.floor(rand() * 5)}.`,
      });
      idx++;

      // CRITICAL and HIGH contacts are shared across 2-4 additional partners
      if (def.importance === "CRITICAL" || def.importance === "HIGH") {
        const additionalCount =
          def.importance === "CRITICAL"
            ? 2 + Math.floor(rand() * 3) // 2-4 extra partners
            : 1 + Math.floor(rand() * 2); // 1-2 extra partners

        const usedPartnerIds = new Set([primaryPartner.id]);
        for (let j = 0; j < additionalCount; j++) {
          let otherIdx = Math.floor(rand() * partners.length);
          let attempts = 0;
          while (usedPartnerIds.has(partners[otherIdx].id) && attempts < 10) {
            otherIdx = (otherIdx + 1) % partners.length;
            attempts++;
          }
          if (usedPartnerIds.has(partners[otherIdx].id)) continue;
          usedPartnerIds.add(partners[otherIdx].id);

          contacts.push({
            id: `ct-${String(idx).padStart(3, "0")}`,
            partnerId: partners[otherIdx].id,
            companyId,
            name: def.name,
            email: `${emailName}@${companyDomain}.example.com`,
            title: def.title,
            phone: `+1-555-${String(1000 + idx).slice(-4)}-${String(
              Math.floor(rand() * 9000 + 1000)
            )}`,
            importance: def.importance,
            notes: `${def.title} at ${companyName}. Cross-firm relationship.`,
          });
          idx++;
        }
      }
    }
  }
  return contacts;
}
