import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { requirePartnerId } from "@/lib/auth/get-current-partner";
import {
  nudgeRepo,
  meetingRepo,
  signalRepo,
  partnerRepo,
} from "@/lib/repositories";
import {
  generateNarrativeBriefing,
  type NarrativeBriefingContext,
} from "@/lib/services/llm-service";
import { buildDataDrivenSummaryMarkdown } from "@/lib/services/structured-briefing";
import { addDays, isBefore, format, differenceInDays } from "date-fns";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM_ADDRESS =
  process.env.RESEND_FROM || "ClientIQ <onboarding@resend.dev>";

const MDS = {
  deepBlue: "#051C2C",
  blue: "#0070AD",
  electricBlue: "#2251FF",
  text: "#2D2D2D",
  textLight: "#64748b",
  bgLight: "#F5F5F5",
  white: "#FFFFFF",
  border: "#E0E0E0",
};

function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function mdToHtml(md: string): string {
  return md
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul style="margin:8px 0;padding-left:20px;">${m}</ul>`)
    .replace(/\n{2,}/g, "</p><p>")
    .replace(/\n/g, "<br>");
}

export async function POST(request: NextRequest) {
  try {
    const partnerId = await requirePartnerId();
    const body = (await request.json()) as { to?: string };
    const toEmail = body.to;
    if (!toEmail) {
      return NextResponse.json({ error: "Missing 'to' email address" }, { status: 400 });
    }

    if (!resend) {
      return NextResponse.json(
        { error: "RESEND_API_KEY not configured" },
        { status: 500 },
      );
    }

    const [partner, openNudges, allUpcomingMeetings, clientNews] =
      await Promise.all([
        partnerRepo.findById(partnerId),
        nudgeRepo.findByPartnerId(partnerId, { status: "OPEN" }),
        meetingRepo.findUpcomingByPartnerId(partnerId),
        signalRepo.findRecentByPartnerId(partnerId, 10),
      ]);

    const partnerName = partner?.name ?? "there";
    const now = new Date();
    const dateStr = format(now, "EEEE, MMMM d, yyyy");

    const priorityOrder: Record<string, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    const typeOrder: Record<string, number> = {
      MEETING_PREP: 0, REPLY_NEEDED: 1, JOB_CHANGE: 2, STALE_CONTACT: 3,
      FOLLOW_UP: 4, CAMPAIGN_APPROVAL: 5, ARTICLE_CAMPAIGN: 6,
    };
    const sortedNudges = [...openNudges].sort((a, b) => {
      const pa = priorityOrder[a.priority] ?? 4;
      const pb = priorityOrder[b.priority] ?? 4;
      if (pa !== pb) return pa - pb;
      return (typeOrder[a.ruleType] ?? 99) - (typeOrder[b.ruleType] ?? 99);
    });

    const topNudges = sortedNudges.slice(0, 8).map((n) => ({
      contactName: n.contact.name,
      company: n.contact.company.name,
      reason: n.reason,
      priority: n.priority,
      contactId: n.contact.id,
      nudgeId: n.id,
      ruleType: n.ruleType,
      daysSince: n.contact.lastContacted
        ? differenceInDays(now, new Date(n.contact.lastContacted))
        : undefined,
      metadata: n.metadata ?? undefined,
    }));

    const twoDaysFromNow = addDays(now, 2);
    const nearMeetings = allUpcomingMeetings
      .filter((m) => isBefore(new Date(m.startTime), twoDaysFromNow))
      .slice(0, 5)
      .map((m) => ({
        title: m.title,
        startTime: format(new Date(m.startTime), "EEE h:mm a"),
        attendeeNames: m.attendees.map((a) => a.contact.name),
        meetingId: m.id,
      }));

    const newsItems = clientNews.slice(0, 5).map((s) => ({
      content: s.content,
      contactName: s.contact?.name,
      company: s.contact?.company?.name ?? s.company?.name,
    }));

    const ctx: NarrativeBriefingContext = {
      partnerName,
      nudges: topNudges,
      meetings: nearMeetings,
      clientNews: newsItems,
    };

    const [narrative, dataDriven] = await Promise.all([
      generateNarrativeBriefing(ctx).then((r) => r.narrative).catch(() => ""),
      Promise.resolve(buildDataDrivenSummaryMarkdown(ctx)),
    ]);

    const nudgeRows = topNudges
      .slice(0, 6)
      .map((n) => {
        const priorityColor =
          n.priority === "URGENT" ? "#dc2626" : n.priority === "HIGH" ? "#d97706" : MDS.textLight;
        return `
        <tr>
          <td style="padding:12px 16px;border-bottom:1px solid ${MDS.border};">
            <div style="font-weight:600;color:${MDS.text};">${esc(n.contactName)}</div>
            <div style="font-size:13px;color:${MDS.textLight};">${esc(n.company)}</div>
          </td>
          <td style="padding:12px 16px;border-bottom:1px solid ${MDS.border};font-size:13px;color:${MDS.textLight};">
            ${esc(n.reason.length > 100 ? n.reason.slice(0, 97) + "…" : n.reason)}
          </td>
          <td style="padding:12px 8px;border-bottom:1px solid ${MDS.border};text-align:center;">
            <span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;color:${priorityColor};background:${priorityColor}15;">
              ${esc(n.priority)}
            </span>
          </td>
        </tr>`;
      })
      .join("");

    const meetingRows = nearMeetings
      .map(
        (m) => `
        <tr>
          <td style="padding:10px 16px;border-bottom:1px solid ${MDS.border};">
            <div style="font-weight:600;color:${MDS.text};">${esc(m.title)}</div>
            <div style="font-size:13px;color:${MDS.textLight};">${esc(m.startTime)} · ${esc(m.attendeeNames.join(", "))}</div>
          </td>
        </tr>`,
      )
      .join("");

    const newsRows = newsItems
      .slice(0, 5)
      .map(
        (s) => `
        <tr>
          <td style="padding:10px 16px;border-bottom:1px solid ${MDS.border};font-size:14px;color:${MDS.text};">
            ${s.company ? `<strong>${esc(s.company)}</strong>: ` : ""}${esc((s.content ?? "").slice(0, 160))}
          </td>
        </tr>`,
      )
      .join("");

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:${MDS.bgLight};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${MDS.bgLight};padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:${MDS.white};border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">

        <!-- Header -->
        <tr>
          <td style="background:${MDS.deepBlue};padding:28px 32px;">
            <div style="font-size:22px;font-weight:700;color:${MDS.white};letter-spacing:-0.3px;">
              ✦ ClientIQ Morning Brief
            </div>
            <div style="font-size:14px;color:rgba(255,255,255,0.7);margin-top:6px;">
              ${esc(dateStr)} · ${esc(partnerName)}
            </div>
          </td>
        </tr>

        <!-- Narrative summary -->
        <tr>
          <td style="padding:28px 32px 16px;">
            <div style="font-size:15px;line-height:1.65;color:${MDS.text};">
              <p>${narrative ? mdToHtml(esc(narrative)) : mdToHtml(esc(dataDriven))}</p>
            </div>
          </td>
        </tr>

        <!-- Priority contacts -->
        ${nudgeRows ? `
        <tr>
          <td style="padding:8px 32px 4px;">
            <div style="font-size:16px;font-weight:700;color:${MDS.deepBlue};margin-bottom:8px;">Priority Contacts</div>
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${MDS.border};border-radius:8px;overflow:hidden;">
              ${nudgeRows}
            </table>
          </td>
        </tr>` : ""}

        <!-- Meetings -->
        ${meetingRows ? `
        <tr>
          <td style="padding:20px 32px 4px;">
            <div style="font-size:16px;font-weight:700;color:${MDS.deepBlue};margin-bottom:8px;">Upcoming Meetings</div>
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${MDS.border};border-radius:8px;overflow:hidden;">
              ${meetingRows}
            </table>
          </td>
        </tr>` : ""}

        <!-- News -->
        ${newsRows ? `
        <tr>
          <td style="padding:20px 32px 4px;">
            <div style="font-size:16px;font-weight:700;color:${MDS.deepBlue};margin-bottom:8px;">Signals &amp; News</div>
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${MDS.border};border-radius:8px;overflow:hidden;">
              ${newsRows}
            </table>
          </td>
        </tr>` : ""}

        <!-- CTA -->
        <tr>
          <td style="padding:28px 32px;" align="center">
            <a href="${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/mobile"
               style="display:inline-block;padding:12px 32px;background:${MDS.electricBlue};color:${MDS.white};font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">
              Open ClientIQ
            </a>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:16px 32px 24px;text-align:center;font-size:12px;color:${MDS.textLight};">
            Sent by ClientIQ · Your AI-powered CRM assistant
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const subject = `☀️ Morning Brief — ${partnerName} · ${format(now, "MMM d")}`;

    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: toEmail,
      subject,
      html,
    });

    if (error) {
      console.error("[briefing/send] Resend error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(`[briefing/send] Morning brief sent to ${toEmail}`);
    return NextResponse.json({ sent: true, to: toEmail });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[briefing/send] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    );
  }
}
