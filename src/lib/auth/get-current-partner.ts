import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth-options";

const VALID_PARTNER_IDS = [
  "p-ava-patel",
  "p-jordan-kim",
  "p-sam-rivera",
  "p-morgan-chen",
  "p-taylor-brooks",
];

export async function getCurrentPartnerId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  const fromSession = (session?.user as Record<string, unknown> | undefined)
    ?.partnerId as string | null;
  if (fromSession) return fromSession;

  // Dev/verification bypass: accept partner_id cookie when NODE_ENV=development
  if (process.env.NODE_ENV === "development") {
    const cookieStore = await cookies();
    const partnerId = cookieStore.get("partner_id")?.value;
    if (partnerId && VALID_PARTNER_IDS.includes(partnerId)) return partnerId;
  }

  return null;
}

export async function requirePartnerId(): Promise<string> {
  const id = await getCurrentPartnerId();
  if (!id) throw new Error("Unauthorized");
  return id;
}
