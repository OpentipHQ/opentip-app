import { cookies } from "next/headers";
import { getRequestSession, sessionCookieOptions } from "@/lib/auth";
import { sessionSecret } from "@/lib/config";
import { getPrisma } from "@/lib/db";
import { signSession, verifySession, type Session } from "@/lib/session";

export const ACT_AS_COOKIE = "opentip_act_as";
export const ACT_AS_TTL_SECONDS = 60 * 30;

export type ActAsSession = Session & { actorId: string };

export function actAsActorAllowed(
  actor: { role: string; suspendedAt: Date | null } | null,
): boolean {
  return Boolean(actor && actor.role === "ADMIN" && !actor.suspendedAt);
}

export async function readActAs(): Promise<ActAsSession | null> {
  const secret = sessionSecret();
  if (!secret) return null;
  const jar = await cookies();
  const raw = await verifySession(jar.get(ACT_AS_COOKIE)?.value, secret);
  if (!raw || !raw.actorId) return null;
  const prisma = getPrisma();
  if (!prisma) return null;
  const actor = await prisma.user.findUnique({
    where: { id: raw.actorId },
    select: { role: true, suspendedAt: true },
  });
  if (!actAsActorAllowed(actor)) return null;
  return raw as ActAsSession;
}

export async function signActAs(
  actorId: string,
  target: { id: string; login: string; name: string | null; role: "USER" | "ADMIN" },
  secret = sessionSecret(),
  now = Date.now(),
): Promise<string | null> {
  if (!secret) return null;
  return signSession(
    {
      userId: target.id,
      login: target.login,
      name: target.name,
      role: target.role,
      exp: now + ACT_AS_TTL_SECONDS * 1000,
      sv: 0,
      actorId,
    },
    secret,
  );
}

export async function setActAsCookie(token: string): Promise<void> {
  const jar = await cookies();
  jar.set(ACT_AS_COOKIE, token, sessionCookieOptions(ACT_AS_TTL_SECONDS));
}

export async function clearActAsCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(ACT_AS_COOKIE, "", sessionCookieOptions(0));
}

export function writesBlocked(actAs: ActAsSession | null): boolean {
  return actAs !== null;
}

export async function getViewSession(): Promise<Session | null> {
  const session = await getRequestSession();
  if (!session) return null;
  const actAs = await readActAs();
  return actAs ?? session;
}
