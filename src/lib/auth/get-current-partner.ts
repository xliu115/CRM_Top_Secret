import { getServerSession } from "next-auth";
import { authOptions } from "./auth-options";

export async function getCurrentPartnerId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return (session?.user as Record<string, unknown> | undefined)?.partnerId as
    | string
    | null;
}

export async function requirePartnerId(): Promise<string> {
  const id = await getCurrentPartnerId();
  if (!id) throw new Error("Unauthorized");
  return id;
}
