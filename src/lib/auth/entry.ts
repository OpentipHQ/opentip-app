import { redirect } from "next/navigation";
import { getRequestSession } from "@/lib/auth";
import { hasBetaAccess } from "@/lib/beta/access";
import { getPrisma } from "@/lib/db";
import { devBypassEnabled } from "@/lib/session";

export function authEntryTarget(input: {
  signedIn: boolean;
  approved: boolean;
}): "/dashboard" | "/waitlist" | null {
  if (!input.signedIn) return null;
  if (!input.approved) return "/waitlist";
  return "/dashboard";
}

export async function redirectAuthenticatedEntry(): Promise<void> {
  if (devBypassEnabled()) redirect("/dashboard");
  const session = await getRequestSession();
  if (!session) return;
  const prisma = getPrisma();
  if (!prisma) return;
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { email: true },
  });
  if (!user) return;
  const approved = Boolean(user.email) && (await hasBetaAccess(user.email ?? ""));
  const target = authEntryTarget({ signedIn: true, approved });
  if (target) redirect(target);
}
