import { cookies } from "next/headers";
import { sessionSecret } from "@/lib/config";
import {
  SESSION_COOKIE,
  devBypassEnabled,
  devSession,
  verifySession,
  type Session,
} from "@/lib/session";

export { sessionCookieOptions } from "@/lib/session";

export async function getRequestSession(): Promise<Session | null> {
  if (devBypassEnabled()) return devSession();
  const secret = sessionSecret();
  if (!secret) return null;
  const jar = await cookies();
  return verifySession(jar.get(SESSION_COOKIE)?.value, secret);
}
