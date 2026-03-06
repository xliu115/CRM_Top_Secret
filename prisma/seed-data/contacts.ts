import { partners } from "./partners";
import { companies } from "./companies";

type Importance = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

interface ContactDef {
  name: string;
  title: string;
  importance: Importance;
}

const contactsByCompany: Record<string, ContactDef[]> = {
  "c-microsoft": [
    { name: "Sarah Mitchell", title: "CIO", importance: "CRITICAL" },
    { name: "David Park", title: "VP of Engineering", importance: "HIGH" },
    { name: "Rachel Torres", title: "Head of Cloud Partnerships", importance: "HIGH" },
    { name: "James Whitfield", title: "Director of Procurement", importance: "MEDIUM" },
    { name: "Priya Sharma", title: "Principal PM – Azure AI", importance: "HIGH" },
    { name: "Kevin O'Brien", title: "Corp Dev Lead", importance: "MEDIUM" },
    { name: "Lisa Chang", title: "SVP Enterprise Sales", importance: "CRITICAL" },
  ],
  "c-apple": [
    { name: "Michael Foster", title: "VP of Services", importance: "CRITICAL" },
    { name: "Jennifer Wu", title: "Director of ML Engineering", importance: "HIGH" },
    { name: "Robert Hayes", title: "Head of Supply Chain Strategy", importance: "MEDIUM" },
    { name: "Amanda Collins", title: "Senior Director, Enterprise", importance: "HIGH" },
    { name: "Chris Nakamura", title: "Engineering Manager – Siri", importance: "MEDIUM" },
    { name: "Diana Reeves", title: "VP of Hardware Engineering", importance: "HIGH" },
  ],
  "c-amazon": [
    { name: "Thomas Grant", title: "VP of AWS Partnerships", importance: "CRITICAL" },
    { name: "Sophia Martinez", title: "Head of Retail Technology", importance: "HIGH" },
    { name: "Andrew Kim", title: "Director of Logistics Innovation", importance: "MEDIUM" },
    { name: "Emily Zhang", title: "Principal Scientist – Alexa AI", importance: "HIGH" },
    { name: "Marcus Johnson", title: "GM, AWS Enterprise", importance: "HIGH" },
    { name: "Natalie Cooper", title: "Head of Procurement", importance: "MEDIUM" },
    { name: "Ryan Patel", title: "VP of Seller Services", importance: "MEDIUM" },
  ],
  "c-jpmorgan": [
    { name: "William Chen", title: "CTO", importance: "CRITICAL" },
    { name: "Catherine Brooks", title: "Head of Digital Transformation", importance: "HIGH" },
    { name: "Daniel Okafor", title: "Managing Director, Tech Banking", importance: "HIGH" },
    { name: "Stephanie Lee", title: "VP of Fintech Partnerships", importance: "MEDIUM" },
    { name: "Richard Alvarez", title: "Chief Data Officer", importance: "HIGH" },
    { name: "Monica Singh", title: "Head of AI/ML Strategy", importance: "HIGH" },
  ],
  "c-google": [
    { name: "Alex Thompson", title: "VP of Cloud Sales", importance: "CRITICAL" },
    { name: "Karen Liu", title: "Director of AI Research", importance: "HIGH" },
    { name: "Brian Foster", title: "Head of Enterprise Partnerships", importance: "HIGH" },
    { name: "Jessica Nguyen", title: "Product Lead – Gemini", importance: "HIGH" },
    { name: "Patrick Sullivan", title: "Director of Corp Dev", importance: "MEDIUM" },
    { name: "Samantha Reed", title: "VP of People Operations", importance: "MEDIUM" },
  ],
  "c-meta": [
    { name: "Christopher Davis", title: "VP of Reality Labs", importance: "HIGH" },
    { name: "Angela Kim", title: "Director of AI Infrastructure", importance: "HIGH" },
    { name: "Jason Miller", title: "Head of Business Development", importance: "MEDIUM" },
    { name: "Laura Hernandez", title: "VP of Advertising Technology", importance: "CRITICAL" },
    { name: "Nathan Wright", title: "Engineering Director – LLaMA", importance: "HIGH" },
  ],
  "c-nvidia": [
    { name: "Gregory Tan", title: "VP of Enterprise AI", importance: "CRITICAL" },
    { name: "Michelle Park", title: "Director of Partner Engineering", importance: "HIGH" },
    { name: "Steven Rodriguez", title: "Head of Data Center Solutions", importance: "HIGH" },
    { name: "Rebecca Moore", title: "VP of Software Platforms", importance: "HIGH" },
    { name: "Derek Yamamoto", title: "Director of Automotive AI", importance: "MEDIUM" },
  ],
  "c-salesforce": [
    { name: "Victoria Adams", title: "EVP of Product", importance: "CRITICAL" },
    { name: "Howard Chen", title: "VP of Einstein AI", importance: "HIGH" },
    { name: "Megan Taylor", title: "Director of ISV Partnerships", importance: "HIGH" },
    { name: "Oscar Gutierrez", title: "Head of Industry Solutions", importance: "MEDIUM" },
    { name: "Tina Washington", title: "VP of Customer Success", importance: "MEDIUM" },
  ],
  "c-adobe": [
    { name: "Charles Bennett", title: "CTO", importance: "CRITICAL" },
    { name: "Yuki Tanaka", title: "VP of Firefly AI", importance: "HIGH" },
    { name: "Sandra Phillips", title: "Director of Enterprise Sales", importance: "HIGH" },
    { name: "Martin Kovalev", title: "Head of Experience Cloud", importance: "MEDIUM" },
    { name: "Alicia Moreno", title: "VP of Digital Media", importance: "HIGH" },
  ],
  "c-netflix": [
    { name: "Elizabeth Warren-Scott", title: "VP of Engineering", importance: "HIGH" },
    { name: "Tyler Jackson", title: "Director of Content Technology", importance: "HIGH" },
    { name: "Hannah Cho", title: "Head of Data Science", importance: "HIGH" },
    { name: "Dominic Russo", title: "VP of Global Partnerships", importance: "CRITICAL" },
  ],
  "c-nike": [
    { name: "Brandon Lewis", title: "VP of Digital Commerce", importance: "HIGH" },
    { name: "Olivia Fernandez", title: "Head of Innovation", importance: "HIGH" },
    { name: "Keith Robinson", title: "Director of Supply Chain Tech", importance: "MEDIUM" },
    { name: "Jasmine Patel", title: "VP of Consumer Data & Analytics", importance: "HIGH" },
    { name: "Trevor Olsen", title: "CIO", importance: "CRITICAL" },
  ],
  "c-pepsico": [
    { name: "Robert Chang", title: "CTO", importance: "CRITICAL" },
    { name: "Nicole Anderson", title: "VP of Digital Transformation", importance: "HIGH" },
    { name: "Frank DeLuca", title: "Head of eCommerce", importance: "MEDIUM" },
    { name: "Aisha Williams", title: "Director of Data & AI", importance: "HIGH" },
    { name: "George Papadopoulos", title: "VP of Supply Chain", importance: "MEDIUM" },
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
      const partnerIdx = Math.floor(rand() * partners.length);
      const partner = partners[partnerIdx];
      const emailName = def.name.toLowerCase().replace(/[^a-z]/g, ".");
      const companyDomain = companies
        .find((c) => c.id === companyId)!
        .name.toLowerCase()
        .replace(/[^a-z]/g, "");

      contacts.push({
        id: `ct-${String(idx).padStart(3, "0")}`,
        partnerId: partner.id,
        companyId,
        name: def.name,
        email: `${emailName}@${companyDomain}.example.com`,
        title: def.title,
        phone: `+1-555-${String(1000 + idx).slice(-4)}-${String(
          Math.floor(rand() * 9000 + 1000)
        )}`,
        importance: def.importance,
        notes: `Key ${def.title} contact at ${
          companies.find((c) => c.id === companyId)!.name
        }. Relationship established ${2020 + Math.floor(rand() * 5)}.`,
      });
      idx++;
    }
  }
  return contacts;
}
