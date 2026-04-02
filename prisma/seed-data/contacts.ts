import { partners } from "./partners";
import { companies } from "./companies";

type Importance = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

interface ContactDef {
  name: string;
  title: string;
  importance: Importance;
  city?: string;
  country?: string;
}

// Real, verifiable executives — all names are publicly listed on company websites, LinkedIn, or news.
// Sources: company leadership pages, SEC filings, press releases.
const contactsByCompany: Record<string, ContactDef[]> = {
  "c-microsoft": [
    { name: "Satya Nadella", title: "Chairman and CEO", importance: "CRITICAL", city: "Redmond", country: "United States" },
    { name: "Scott Guthrie", title: "EVP, Cloud + AI Group", importance: "CRITICAL", city: "Redmond", country: "United States" },
    { name: "Mustafa Suleyman", title: "CEO, Microsoft AI", importance: "CRITICAL", city: "London", country: "United Kingdom" },
    { name: "Amy Hood", title: "EVP and CFO", importance: "HIGH", city: "Redmond", country: "United States" },
    { name: "Brad Smith", title: "Vice Chair and President", importance: "HIGH", city: "Washington", country: "United States" },
    { name: "Judson Althoff", title: "EVP and Chief Commercial Officer", importance: "HIGH", city: "New York", country: "United States" },
    { name: "Pavan Davuluri", title: "EVP, Windows + Devices", importance: "MEDIUM", city: "Redmond", country: "United States" },
  ],
  "c-apple": [
    { name: "Eddy Cue", title: "SVP of Services and Health", importance: "CRITICAL", city: "Cupertino", country: "United States" },
    { name: "Craig Federighi", title: "SVP of Software Engineering", importance: "CRITICAL", city: "Cupertino", country: "United States" },
    { name: "John Ternus", title: "SVP of Hardware Engineering", importance: "HIGH", city: "Cupertino", country: "United States" },
    { name: "Deirdre O'Brien", title: "SVP of Retail + People", importance: "HIGH", city: "Cupertino", country: "United States" },
    { name: "Kevan Parekh", title: "SVP and CFO", importance: "HIGH", city: "Cupertino", country: "United States" },
    { name: "Jennifer Newstead", title: "SVP and General Counsel", importance: "MEDIUM", city: "Washington", country: "United States" },
    { name: "Molly Anderson", title: "VP of Industrial Design", importance: "MEDIUM", city: "London", country: "United Kingdom" },
  ],
  "c-amazon": [
    { name: "Andy Jassy", title: "President and CEO", importance: "CRITICAL", city: "Seattle", country: "United States" },
    { name: "Matt Garman", title: "CEO of AWS", importance: "CRITICAL", city: "Seattle", country: "United States" },
    { name: "Doug Herrington", title: "CEO, Worldwide Amazon Stores", importance: "HIGH", city: "Seattle", country: "United States" },
    { name: "Brian Olsavsky", title: "SVP and CFO", importance: "HIGH", city: "Seattle", country: "United States" },
    { name: "Peter DeSantis", title: "SVP, AWS Utility Computing", importance: "HIGH", city: "Seattle", country: "United States" },
    { name: "Panos Panay", title: "SVP, Devices & Services", importance: "MEDIUM", city: "New York", country: "United States" },
    { name: "Beth Galetti", title: "SVP, People eXperience and Technology", importance: "MEDIUM", city: "Seattle", country: "United States" },
  ],
  "c-jpmorgan": [
    { name: "Jamie Dimon", title: "Chairman and CEO", importance: "CRITICAL", city: "New York", country: "United States" },
    { name: "Marianne Lake", title: "CEO, Consumer & Community Banking", importance: "CRITICAL", city: "New York", country: "United States" },
    { name: "Jeremy Barnum", title: "Chief Financial Officer", importance: "HIGH", city: "New York", country: "United States" },
    { name: "Jennifer Piepszak", title: "Chief Operating Officer", importance: "HIGH", city: "New York", country: "United States" },
    { name: "Mary Callahan Erdoes", title: "CEO, Asset & Wealth Management", importance: "HIGH", city: "London", country: "United Kingdom" },
    { name: "Troy Rohrbaugh", title: "Co-CEO, Commercial & Investment Bank", importance: "MEDIUM", city: "London", country: "United Kingdom" },
  ],
  "c-google": [
    { name: "Sundar Pichai", title: "CEO of Alphabet and Google", importance: "CRITICAL", city: "Mountain View", country: "United States" },
    { name: "Thomas Kurian", title: "CEO of Google Cloud", importance: "CRITICAL", city: "Mountain View", country: "United States" },
    { name: "Ruth Porat", title: "President and CIO", importance: "CRITICAL", city: "Mountain View", country: "United States" },
    { name: "Anat Ashkenazi", title: "SVP and CFO", importance: "HIGH", city: "Mountain View", country: "United States" },
    { name: "Kent Walker", title: "President of Global Affairs", importance: "HIGH", city: "Washington", country: "United States" },
    { name: "Philipp Schindler", title: "SVP and Chief Business Officer", importance: "HIGH", city: "London", country: "United Kingdom" },
    { name: "Prabhakar Raghavan", title: "SVP of Knowledge & Information", importance: "MEDIUM", city: "Mountain View", country: "United States" },
  ],
  "c-meta": [
    { name: "Mark Zuckerberg", title: "CEO and Chairman", importance: "CRITICAL", city: "Menlo Park", country: "United States" },
    { name: "Dina Powell McCormick", title: "President and Vice Chairman", importance: "CRITICAL", city: "New York", country: "United States" },
    { name: "Andrew Bosworth", title: "CTO", importance: "HIGH", city: "Menlo Park", country: "United States" },
    { name: "Susan Li", title: "Chief Financial Officer", importance: "HIGH", city: "Menlo Park", country: "United States" },
    { name: "Chris Cox", title: "Chief Product Officer", importance: "HIGH", city: "Menlo Park", country: "United States" },
    { name: "Javier Olivan", title: "Chief Operating Officer", importance: "MEDIUM", city: "London", country: "United Kingdom" },
  ],
  "c-nvidia": [
    { name: "Jensen Huang", title: "Founder, President and CEO", importance: "CRITICAL", city: "Santa Clara", country: "United States" },
    { name: "Colette Kress", title: "EVP and CFO", importance: "HIGH", city: "Santa Clara", country: "United States" },
    { name: "Jay Puri", title: "EVP, Worldwide Field Operations", importance: "HIGH", city: "Santa Clara", country: "United States" },
    { name: "Bill Dally", title: "Chief Scientist", importance: "HIGH", city: "Santa Clara", country: "United States" },
    { name: "Debora Shoquist", title: "EVP of Operations", importance: "MEDIUM", city: "Santa Clara", country: "United States" },
    { name: "Ian Buck", title: "VP and GM, Accelerated Computing", importance: "MEDIUM", city: "Tokyo", country: "Japan" },
  ],
  "c-salesforce": [
    { name: "Marc Benioff", title: "Chair, CEO and Co-Founder", importance: "CRITICAL", city: "San Francisco", country: "United States" },
    { name: "Robin Washington", title: "President and COFO", importance: "HIGH", city: "San Francisco", country: "United States" },
    { name: "Parker Harris", title: "Co-Founder and CTO", importance: "HIGH", city: "San Francisco", country: "United States" },
    { name: "David Schmaier", title: "President and Chief Product Officer", importance: "HIGH", city: "San Francisco", country: "United States" },
    { name: "Patrick Stokes", title: "Chief Marketing Officer", importance: "MEDIUM", city: "New York", country: "United States" },
    { name: "Madhav Thattai", title: "EVP and GM, Agentforce", importance: "MEDIUM", city: "San Francisco", country: "United States" },
  ],
  "c-adobe": [
    { name: "Shantanu Narayen", title: "Chairman and CEO", importance: "CRITICAL", city: "San Jose", country: "United States" },
    { name: "Dan Durn", title: "EVP and CFO", importance: "HIGH", city: "San Jose", country: "United States" },
    { name: "David Wadhwani", title: "President, Digital Media Business", importance: "HIGH", city: "San Jose", country: "United States" },
    { name: "Anil Chakravarthy", title: "President, Digital Experience Business", importance: "HIGH", city: "San Jose", country: "United States" },
  ],
  "c-netflix": [
    { name: "Ted Sarandos", title: "Co-CEO and Chairman", importance: "CRITICAL", city: "Los Angeles", country: "United States" },
    { name: "Greg Peters", title: "Co-CEO", importance: "CRITICAL", city: "Los Angeles", country: "United States" },
    { name: "Spencer Neumann", title: "CFO", importance: "HIGH", city: "Los Angeles", country: "United States" },
  ],
  "c-nike": [
    { name: "Elliott Hill", title: "President and CEO", importance: "CRITICAL", city: "Portland", country: "United States" },
    { name: "Matthew Friend", title: "EVP and CFO", importance: "HIGH", city: "Portland", country: "United States" },
    { name: "Ann Miller", title: "EVP and General Counsel", importance: "MEDIUM", city: "Portland", country: "United States" },
  ],
  "c-pepsico": [
    { name: "Ramon Laguarta", title: "Chairman and CEO", importance: "CRITICAL", city: "Purchase", country: "United States" },
    { name: "Jamie Caulfield", title: "EVP and CFO", importance: "HIGH", city: "Purchase", country: "United States" },
    { name: "Athina Kanioura", title: "EVP and Chief Strategy Officer", importance: "HIGH", city: "New York", country: "United States" },
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
    country: string | null;
    city: string | null;
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
        country: def.country ?? null,
        city: def.city ?? null,
        importance: def.importance,
        notes: `Key ${def.title} contact at ${companyName}. Relationship established ${2020 + Math.floor(rand() * 5)}.`,
      });
      idx++;

      if (def.importance === "CRITICAL" || def.importance === "HIGH") {
        const additionalCount =
          def.importance === "CRITICAL"
            ? 2 + Math.floor(rand() * 3)
            : 1 + Math.floor(rand() * 2);

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
            country: def.country ?? null,
            city: def.city ?? null,
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
