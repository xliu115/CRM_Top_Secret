import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { sendMorningBriefing } from "@/lib/services/briefing-service";
import { verifyCronSecret } from "@/lib/utils/cron-auth";

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const partners = await prisma.partner.findMany({
      where: { briefingEnabled: true },
      select: { id: true, name: true },
    });

    const settled = await Promise.allSettled(
      partners.map(async (partner) => {
        const result = await sendMorningBriefing(partner.id);
        return { name: partner.name, ...result };
      })
    );

    const results: { name: string; sent: boolean; error?: string }[] = settled.map(
      (s, i) =>
        s.status === "fulfilled"
          ? s.value
          : {
              name: partners[i].name,
              sent: false,
              error: s.reason?.message ?? "Unknown error",
            }
    );

    const sent = results.filter((r) => r.sent).length;
    const failed = results.filter((r) => !r.sent).length;
    const errors = results.filter((r) => r.error).map((r) => `${r.name}: ${r.error}`);

    console.log(`[cron/morning-briefing] Sent: ${sent}, Failed: ${failed}`);

    return NextResponse.json({ sent, failed, errors, total: partners.length });
  } catch (err) {
    console.error("[cron/morning-briefing] Fatal error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
