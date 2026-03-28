import { NextRequest, NextResponse } from "next/server";
import { requirePartnerId } from "@/lib/auth/get-current-partner";
import { contactRepo, signalRepo } from "@/lib/repositories";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const partnerId = await requirePartnerId();
    const { id } = await params;

    const contact = await contactRepo.findById(id, partnerId);

    if (!contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    const [contactSignals, companySignals] = await Promise.all([
      signalRepo.findByContactId(id),
      signalRepo.findByCompanyId(contact.companyId),
    ]);
    const signals = [
      ...new Map(
        [...contactSignals, ...companySignals].map((s) => [s.id, s])
      ).values(),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return NextResponse.json(signals);
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
