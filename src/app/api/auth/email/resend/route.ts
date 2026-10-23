import { cookies } from "next/headers";
import { sessionSecret } from "@/lib/config";
import { EMAIL_CODE_USER, LOGIN_EMAIL_COOKIE } from "@/lib/auth/constants";
import { issueLoginCode } from "@/lib/auth/email-flow";
import { clientIp, redirectWithCookies, requestOrigin } from "@/lib/auth/http";
import { normalizeEmail } from "@/lib/auth/login-code";
import { verifySession } from "@/lib/session";

export async function POST(request: Request) {
  const origin = requestOrigin(request);
  const secret = sessionSecret();
  const jar = await cookies();
  const pending = secret ? await verifySession(jar.get(LOGIN_EMAIL_COOKIE)?.value, secret) : null;
  const email = pending && pending.userId === EMAIL_CODE_USER ? normalizeEmail(pending.login) : null;
  if (!email) return redirectWithCookies(origin, "/login?error=missing", []);
  const issued = await issueLoginCode({ emailRaw: email, ip: clientIp(request) });
  if (issued.status === "waitlist") return redirectWithCookies(origin, "/waitlist", []);
  if (issued.status === "sent") return redirectWithCookies(origin, "/login/code", []);
  if (issued.status === "cooldown") return redirectWithCookies(origin, "/login/code?error=cooldown", []);
  return redirectWithCookies(origin, `/login/code?error=${issued.status}`, []);
}
