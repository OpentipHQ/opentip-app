import { cookies } from "next/headers";
import { sessionSecret } from "@/lib/config";
import { getPrisma } from "@/lib/db";
import {
  SESSION_COOKIE,
  devBypassEnabled,
  devSession,
  verifySession,
  type Session,
} from "@/lib/session";

export async function getRequestSession(): Promise<Session | null> {
  if (devBypassEnabled()) return devSession();
  const secret = sessionSecret();
  if (!secret) return null;
  const jar = await cookies();
  const session = await verifySession(jar.get(SESSION_COOKIE)?.value, secret);
  if (!session) return null;

  const prisma = getPrisma();
  if (!prisma) return session;
  const row = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      login: true,
      name: true,
      role: true,
      sessionVersion: true,
      suspendedAt: true,
    },
  });
  if (!row || row.suspendedAt) return null;
  if (row.sessionVersion !== (session.sv ?? 0)) return null;
  return {
    ...session,
    login: row.login,
    name: row.name,
    role: row.role,
    sv: row.sessionVersion,
  };
}

export function sessionCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds,
  };
}
