/**
 * Replace Ted Sarandos's auto-generated email draft with a hand-crafted one
 * written through Sven's senior-partner playbook lens, scoped to the actual
 * relationship: Ted is a LONG-TAIL contact. Morgan is not in a project with
 * him. So the right reference point is Sven's "Power of Personal Notes" and
 * the Contact System rhythm — "thinking about their business when you're
 * not being paid to" — not the "trusted advisor in the room" mode.
 *
 *   - Open with congratulations, not with our agenda
 *   - Anchor in a real past conversation (the dinner about content
 *     monetization) so it isn't a generic "saw the news" note
 *   - Hold the operating-model question lightly — one sentence of
 *     genuine curiosity, not a pitch. Sven: "demonstrate you were
 *     listening", not "demonstrate you're worth hiring"
 *   - No deck offer, no "I can come to LA" — those are for active
 *     engagements, not long-tail relationships
 *   - Soft ask with a graceful out ("either way")
 *   - Acknowledge the gap once, lightly, no apology theater
 */
import { prisma } from "@/lib/db/prisma";

const CONTACT_NAME = "Ted Sarandos";
const PARTNER_ID = "p-morgan-chen";

const SUBJECT = "InterPositive — and that dinner conversation";

const BODY = `Hi Ted,

Saw the InterPositive AI announcement — congrats. Hard not to read it as a bet on the thesis you were laying out at dinner: that the next margin frontier in streaming is the unit cost of original production, not just the top of the funnel.

Most of the coverage frames it as a cost-savings story. The question I keep turning over, and the one I'd be curious how you're thinking about, is the operating model — whether InterPositive becomes a capability the creative orgs actively pull from, or an internal vendor they route around. The first 90 days usually set that pattern.

No agenda from my side — just didn't want the moment to pass without a note. If a coffee or a 30-minute call in the next month or two makes sense, I'd enjoy it. If it's a stretch, I'll catch you at the next industry thing.

Either way, congrats on the deal.

Best,
Morgan`;

async function main() {
  const c = await prisma.contact.findFirst({
    where: { name: CONTACT_NAME, partnerId: PARTNER_ID },
    include: { nudges: { where: { status: "OPEN" } } },
  });
  const n = c?.nudges[0];
  if (!n) {
    console.error(`No open nudge for ${CONTACT_NAME}`);
    process.exit(1);
  }

  await prisma.nudge.update({
    where: { id: n.id },
    data: {
      generatedEmail: JSON.stringify({ subject: SUBJECT, body: BODY }),
    },
  });

  console.log(`Updated email draft on nudge ${n.id}`);
  console.log(`\nSUBJECT: ${SUBJECT}\n`);
  console.log(BODY);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
