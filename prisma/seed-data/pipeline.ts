import type { PrismaClient } from "@prisma/client";

function firstName(name: string): string {
  return name.split(/\s+/)[0] ?? name;
}

type RowSeed = {
  partnerId: string;
  lens: "PIPELINE" | "CLIENTS";
  stage: string;
  confirmationStatus: string;
  title: string;
  workingTitle: string | null;
  companyId: string;
  contactId: string | null;
  nextStep: string | null;
  clientContact: string | null;
  lastTouchpoint: string | null;
  milestoneDate: Date | null;
  provenance: string;
  tags: string;
};

/**
 * Demo pipeline: board counts roughly approach but stay slightly under the
 * steady-state targets (Pipeline 2-4-8, Clients 4-8-16) so the product
 * looks like a partner has been building momentum. Confirmed row counts:
 *
 *   Pipeline  1 · 3 · 7  (active eng · LOPs · serious)
 *   Clients   3 · 7 · 14 (active cli · warm  · cultivation)
 *
 * Plus 2 DRAFT pipeline rows and a handful of pending suggestions.
 * Re-seed safe (main seed clears tables first).
 */
export async function seedPipelineDemo(prisma: PrismaClient): Promise<void> {
  const morganContacts = await prisma.contact.findMany({
    where: { partnerId: "p-morgan-chen" },
    orderBy: { name: "asc" },
    take: 40,
  });
  const jordanContacts = await prisma.contact.findMany({
    where: { partnerId: "p-jordan-kim" },
    orderBy: { name: "asc" },
    take: 2,
  });
  const avaContacts = await prisma.contact.findMany({
    where: { partnerId: "p-ava-patel" },
    orderBy: { name: "asc" },
    take: 2,
  });

  const m = morganContacts;
  const j = jordanContacts;
  const a = avaContacts;

  if (m.length === 0) {
    console.log("   (Skipping pipeline demo: no contacts for demo partners yet.)");
    return;
  }

  const pick = (i: number) => m[i % m.length]!;

  const daysFromNow = (d: number) => new Date(Date.now() + d * 24 * 60 * 60 * 1000);
  const daysAgo = (d: number) => `${d}d ago`;

  type RowSpec = { stage: string; title: string; next: string; contact: string; touched: string; milestone: Date | null };

  // ── Pipeline confirmed rows: 1 active + 3 LOPs + 7 serious = 11 ──
  const pipelineRows: RowSpec[] = [
    { stage: "active_engagements", title: "Cloud renewal posture — multi-year EA", next: "Confirm decision timeline with CIO", contact: "Sarah Kim (CIO)", touched: daysAgo(2), milestone: daysFromNow(14) },
    { stage: "lops_in_discussion", title: "PE portfolio ops — value creation sprint", next: "Share one-pager after partner sync", contact: "James Thornton (MD)", touched: daysAgo(5), milestone: daysFromNow(21) },
    { stage: "lops_in_discussion", title: "Retail media network build", next: "Workshop Doodle poll", contact: "Lisa Park (SVP Digital)", touched: daysAgo(3), milestone: daysFromNow(30) },
    { stage: "lops_in_discussion", title: "Supply chain control tower", next: "Pilot KPI definition", contact: "Raj Mehta (COO)", touched: daysAgo(7), milestone: daysFromNow(18) },
    { stage: "serious_discussions", title: "Operating model diagnostic", next: "Workshop proposal by Friday", contact: "David Chen (CFO)", touched: daysAgo(1), milestone: daysFromNow(7) },
    { stage: "serious_discussions", title: "M&A synergy plan — integration PMO", next: "SteerCo deck v2", contact: "Michelle Torres (Corp Dev)", touched: daysAgo(4), milestone: daysFromNow(10) },
    { stage: "serious_discussions", title: "Sustainability reporting uplift", next: "ESG metrics workshop", contact: "Anna Johansson (CSO)", touched: daysAgo(6), milestone: daysFromNow(25) },
    { stage: "serious_discussions", title: "Cyber resilience tabletop", next: "Invite CISO office", contact: "Tom Bradley (CISO)", touched: daysAgo(10), milestone: daysFromNow(35) },
    { stage: "serious_discussions", title: "Finance shared services redesign", next: "RFP timeline", contact: "Priya Sharma (VP Finance)", touched: daysAgo(8), milestone: daysFromNow(42) },
    { stage: "serious_discussions", title: "Cost takeout diagnostics — phase 2", next: "Align on data room scope", contact: "Mark Sullivan (EVP Ops)", touched: daysAgo(3), milestone: daysFromNow(12) },
    { stage: "serious_discussions", title: "Customer analytics modernization", next: "Vendor shortlist review", contact: "Wei Zhang (CDO)", touched: daysAgo(5), milestone: daysFromNow(20) },
  ];

  // ── Clients confirmed rows: 3 active + 7 warm + 14 cultivation = 24 ──
  const clientRows: RowSpec[] = [
    { stage: "active_clients", title: "Exec sponsor map — renewal play", next: "Add CFO intro", contact: "Robert Hayes (CEO)", touched: daysAgo(1), milestone: daysFromNow(7) },
    { stage: "active_clients", title: "QBR rhythm — account team", next: "Schedule August QBR", contact: "Karen Liu (COO)", touched: daysAgo(3), milestone: daysFromNow(45) },
    { stage: "active_clients", title: "Innovation co-development track", next: "Share lighthouse use cases", contact: "Ankit Patel (CTO)", touched: daysAgo(2), milestone: daysFromNow(14) },
    { stage: "warm_relationships", title: "Industry forum follow-ups", next: "Send recap note", contact: "Nina Rossi (CMO)", touched: daysAgo(4), milestone: null },
    { stage: "warm_relationships", title: "Talent exchange — secondments", next: "HR policy check", contact: "Derek Williams (CHRO)", touched: daysAgo(12), milestone: daysFromNow(60) },
    { stage: "warm_relationships", title: "Board advisory relationship", next: "Prepare governance brief", contact: "Helen Carter (Board Chair)", touched: daysAgo(8), milestone: daysFromNow(30) },
    { stage: "warm_relationships", title: "Digital transformation co-pilot", next: "Share case study library", contact: "Sam Nakamura (CIO)", touched: daysAgo(6), milestone: null },
    { stage: "warm_relationships", title: "CFO leadership circle", next: "Extend invite for fall session", contact: "Julia Martin (CFO)", touched: daysAgo(15), milestone: daysFromNow(90) },
    { stage: "warm_relationships", title: "Infrastructure modernization partner", next: "Follow up on workshop notes", contact: "Chris O'Brien (VP Infra)", touched: daysAgo(9), milestone: null },
    { stage: "warm_relationships", title: "Growth equity relationship", next: "Warm intro to sector head", contact: "Elaine Cho (Partner, PE)", touched: daysAgo(7), milestone: daysFromNow(21) },
    { stage: "under_cultivation", title: "Emerging tech scouting", next: "Intro to ventures lead", contact: "Leo Fernandez (CTO)", touched: daysAgo(14), milestone: null },
    { stage: "under_cultivation", title: "Board education session (AI)", next: "Propose 45-min briefing", contact: "Margaret Huang (Board)", touched: daysAgo(20), milestone: daysFromNow(28) },
    { stage: "under_cultivation", title: "LatAm market entry research", next: "Identify country GM", contact: "Carlos Mendez (SVP LatAm)", touched: daysAgo(11), milestone: null },
    { stage: "under_cultivation", title: "Procurement savings analysis", next: "Request spend data", contact: "Laura Bennett (CPO)", touched: daysAgo(9), milestone: daysFromNow(35) },
    { stage: "under_cultivation", title: "Workforce planning pilot", next: "Map current org model", contact: "Ian Moore (CHRO)", touched: daysAgo(18), milestone: null },
    { stage: "under_cultivation", title: "Data mesh architecture review", next: "Prep two-page brief", contact: "Nadia Petrov (VP Data)", touched: daysAgo(6), milestone: daysFromNow(14) },
    { stage: "under_cultivation", title: "ESG disclosures readiness", next: "Benchmark against peers", contact: "Grace Okonkwo (CSO)", touched: daysAgo(22), milestone: null },
    { stage: "under_cultivation", title: "Shared services center setup", next: "Site selection criteria", contact: "Paul Richter (CFO)", touched: daysAgo(16), milestone: daysFromNow(50) },
    { stage: "under_cultivation", title: "Revenue operations reboot", next: "Interview RevOps lead", contact: "Tanya Singh (CRO)", touched: daysAgo(5), milestone: daysFromNow(10) },
    { stage: "under_cultivation", title: "Product portfolio rationalization", next: "Collect SKU-level data", contact: "Ryan Cooper (SVP Product)", touched: daysAgo(13), milestone: null },
    { stage: "under_cultivation", title: "Post-merger integration tracking", next: "Day-1 readiness checklist", contact: "Diana Walsh (Corp Dev)", touched: daysAgo(4), milestone: daysFromNow(7) },
    { stage: "under_cultivation", title: "Customer experience redesign", next: "Journey map sprint invite", contact: "Alex Nguyen (VP CX)", touched: daysAgo(8), milestone: daysFromNow(21) },
    { stage: "under_cultivation", title: "Government affairs advisory", next: "Policy landscape memo", contact: "Frank Ellis (GR Lead)", touched: daysAgo(25), milestone: null },
    { stage: "under_cultivation", title: "AI ethics & governance framework", next: "Schedule founder call", contact: "Sophia Reed (Chief Ethics)", touched: daysAgo(10), milestone: daysFromNow(18) },
  ];

  const rows: RowSeed[] = [];

  pipelineRows.forEach((spec, idx) => {
    const c = pick(idx + 1);
    rows.push({
      partnerId: "p-morgan-chen",
      lens: "PIPELINE",
      stage: spec.stage,
      confirmationStatus: "CONFIRMED",
      title: spec.title,
      workingTitle: idx === 0 ? "Meridian renewal" : null,
      companyId: c.companyId,
      contactId: c.id,
      nextStep: spec.next,
      clientContact: spec.contact,
      lastTouchpoint: spec.touched,
      milestoneDate: spec.milestone,
      provenance: idx % 3 === 0 ? "manual" : idx % 3 === 1 ? "voice" : "system",
      tags: JSON.stringify(["demo"]),
    });
  });

  clientRows.forEach((spec, idx) => {
    const c = pick(idx + 15);
    rows.push({
      partnerId: "p-morgan-chen",
      lens: "CLIENTS",
      stage: spec.stage,
      confirmationStatus: "CONFIRMED",
      title: spec.title,
      workingTitle: null,
      companyId: c.companyId,
      contactId: c.id,
      nextStep: spec.next,
      clientContact: spec.contact,
      lastTouchpoint: spec.touched,
      milestoneDate: spec.milestone,
      provenance: idx % 4 === 0 ? "voice" : "manual",
      tags: JSON.stringify(["relationship"]),
    });
  });

  // 2 draft pipeline rows (don't count in triples)
  const draftC = pick(4);
  rows.push({
    partnerId: "p-morgan-chen",
    lens: "PIPELINE",
    stage: "active_engagements",
    confirmationStatus: "DRAFT",
    title: "Voice note: pricing workshop (unconfirmed)",
    workingTitle: null,
    companyId: draftC.companyId,
    contactId: draftC.id,
    nextStep: null,
    clientContact: null,
    lastTouchpoint: null,
    milestoneDate: null,
    provenance: "voice",
    tags: "[]",
  });

  const draft2 = pick(5);
  rows.push({
    partnerId: "p-morgan-chen",
    lens: "PIPELINE",
    stage: "lops_in_discussion",
    confirmationStatus: "DRAFT",
    title: "Draft: diligence readout — awaiting sponsor",
    workingTitle: "Readout",
    companyId: draft2.companyId,
    contactId: draft2.id,
    nextStep: "Confirm internal review date",
    clientContact: "TBD (waiting on sponsor)",
    lastTouchpoint: daysAgo(14),
    milestoneDate: null,
    provenance: "manual",
    tags: "[]",
  });

  // Other partners (small presence)
  if (j[0]) {
    rows.push({
      partnerId: "p-jordan-kim",
      lens: "PIPELINE",
      stage: "active_engagements",
      confirmationStatus: "CONFIRMED",
      title: `Retail transformation — ${firstName(j[0].name)}`,
      workingTitle: null,
      companyId: j[0].companyId,
      contactId: j[0].id,
      nextStep: "Site visit prep",
      clientContact: firstName(j[0].name),
      lastTouchpoint: daysAgo(3),
      milestoneDate: daysFromNow(10),
      provenance: "manual",
      tags: "[]",
    });
  }

  if (a[0]) {
    rows.push({
      partnerId: "p-ava-patel",
      lens: "CLIENTS",
      stage: "warm_relationships",
      confirmationStatus: "CONFIRMED",
      title: `${firstName(a[0].name)} — quarterly check-in rhythm`,
      workingTitle: null,
      companyId: a[0].companyId,
      contactId: a[0].id,
      nextStep: "Schedule Q3 touch",
      clientContact: firstName(a[0].name),
      lastTouchpoint: daysAgo(7),
      milestoneDate: daysFromNow(30),
      provenance: "system",
      tags: "[]",
    });
  }

  await prisma.pipelineRow.createMany({ data: rows });

  // ── Stale row for hygiene suggestion ──
  const morganRows = await prisma.pipelineRow.findMany({
    where: { partnerId: "p-morgan-chen", lens: "PIPELINE" },
    orderBy: { createdAt: "asc" },
  });
  const staleTarget =
    morganRows.find((r) => r.stage === "serious_discussions" && r.confirmationStatus === "CONFIRMED") ??
    morganRows[0];
  if (staleTarget) {
    const old = new Date(Date.now() - 88 * 24 * 60 * 60 * 1000);
    await prisma.pipelineRow.update({
      where: { id: staleTarget.id },
      data: { updatedAt: old },
    });
  }

  // ── Tab states ──
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  await prisma.pipelineTabState.upsert({
    where: {
      partnerId_tabKey: { partnerId: "p-morgan-chen", tabKey: "pipeline" },
    },
    create: { partnerId: "p-morgan-chen", tabKey: "pipeline", lastViewedAt: threeDaysAgo },
    update: { lastViewedAt: threeDaysAgo },
  });
  await prisma.pipelineTabState.upsert({
    where: {
      partnerId_tabKey: { partnerId: "p-morgan-chen", tabKey: "clients" },
    },
    create: { partnerId: "p-morgan-chen", tabKey: "clients", lastViewedAt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    update: { lastViewedAt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
  });

  // ── Events (historical + recent) ──
  const firstConfirmed = morganRows.find((r) => r.confirmationStatus === "CONFIRMED");
  if (firstConfirmed) {
    await prisma.pipelineEvent.createMany({
      data: [
        {
          partnerId: "p-morgan-chen",
          rowId: firstConfirmed.id,
          eventType: "STAGE_CHANGED",
          payload: JSON.stringify({ from: "lops_in_discussion", to: "active_engagements", previousStage: "lops_in_discussion" }),
        },
        {
          partnerId: "p-morgan-chen",
          rowId: firstConfirmed.id,
          eventType: "ROW_CONFIRMED",
          payload: JSON.stringify({}),
        },
      ],
    });
  }

  const recent = new Date(Date.now() - 10 * 60 * 60 * 1000);
  await prisma.pipelineEvent.createMany({
    data: [
      {
        partnerId: "p-morgan-chen",
        rowId: morganRows[1]?.id ?? null,
        eventType: "STAGE_CHANGED",
        createdAt: recent,
        payload: JSON.stringify({ from: "active_engagements", to: "lops_in_discussion" }),
      },
      {
        partnerId: "p-morgan-chen",
        rowId: morganRows[2]?.id ?? null,
        eventType: "NEXT_STEP_UPDATED",
        createdAt: recent,
        payload: JSON.stringify({ note: "Champion aligned on timeline" }),
      },
      {
        partnerId: "p-morgan-chen",
        rowId: null,
        eventType: "BOARD_REFRESHED",
        createdAt: recent,
        payload: JSON.stringify({ source: "seed" }),
      },
    ],
  });

  // ── Suggestions (6 meeting-prep + 1 hygiene + 1 clients) ──
  const suggBase = m.slice(0, 6);
  const suggestionsData: Array<{
    partnerId: string;
    type: string;
    targetRowId: string | null;
    title: string;
    subtitle: string | null;
    whyLine: string;
    rank: number;
    status: string;
    dedupeKey: string;
    payload: string;
  }> = suggBase.map((c, i) => ({
    partnerId: "p-morgan-chen",
    type: "NEW_ROW",
    targetRowId: null as string | null,
    title: `Add pipeline item for ${firstName(c.name)}`,
    subtitle: `${c.title} · Pipeline touchpoint ${i + 1}`,
    whyLine: `Upcoming meeting ${new Date(Date.now() + (i + 3) * 24 * 60 * 60 * 1000).toLocaleDateString()} — capture a working title and next step.`,
    rank: 80 - i * 3,
    status: "pending",
    dedupeKey: `seed-sugg-newrow-${i}`,
    payload: JSON.stringify({
      lens: "PIPELINE",
      stage: "active_engagements",
      title: `${firstName(c.name)} — follow-up from last touchpoint`,
      contactId: c.id,
      companyId: c.companyId,
      provenance: "system",
      nextStep: "Send prep note and attach one-pager",
    }),
  }));

  if (staleTarget) {
    suggestionsData.push({
      partnerId: "p-morgan-chen",
      type: "HYGIENE",
      targetRowId: staleTarget.id,
      title: `Still active? — ${staleTarget.title.slice(0, 48)}`,
      subtitle: null,
      whyLine: "No updates for 60+ days — archive or refresh if still live.",
      rank: 22,
      status: "pending",
      dedupeKey: "seed-sugg-hygiene-1",
      payload: JSON.stringify({ action: "archive_or_refresh", rowId: staleTarget.id }),
    });
  }

  suggestionsData.push({
    partnerId: "p-morgan-chen",
    type: "NEW_ROW",
    targetRowId: null,
    title: "Add client lens item — expansion account",
    subtitle: "Clients tab · relationship depth",
    whyLine: "Strong engagement signals — worth a formal client row.",
    rank: 48,
    status: "pending",
    dedupeKey: "seed-sugg-clients-1",
    payload: JSON.stringify({
      lens: "CLIENTS",
      stage: "warm_relationships",
      title: "Expansion — pricing & packaging workstream",
      contactId: pick(6).id,
      companyId: pick(6).companyId,
      provenance: "system",
    }),
  });

  for (const s of suggestionsData) {
    await prisma.pipelineSuggestion.create({ data: s });
  }
}
