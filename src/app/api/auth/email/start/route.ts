import { sessionSecret } from "@/lib/config";
import { EMAIL_CODE_USER, LOGIN_EMAIL_COOKIE, LOGIN_EMAIL_TTL_SECONDS, NEXT_COOKIE } from "@/lib/auth/constants";
import { issueLoginCode } from "@/lib/auth/email-flow";
import { safeRelativePath } from "@/lib/auth/gate";
import { clientIp, redirectWithCookies, requestOrigin } from "@/lib/auth/http";
import { normalizeEmail } from "@/lib/auth/login-code";
import { signSession } from "@/lib/session";

export async function POST(request: Request) {
  const origin = requestOrigin(request);
  const form = await request.formData();
  const emailRaw = String(form.get("email") ?? "");
  const back = String(form.get("return") ?? "") === "sign-up" ? "/sign-up" : "/login";
  const issued = await issueLoginCode({ emailRaw, ip: clientIp(request) });
  if (issued.status === "waitlist") {
    const email = normalizeEmail(emailRaw);
    const path = email ? `/waitlist?email=${encodeURIComponent(email)}` : "/waitlist";
    return redirectWithCookies(origin, path, []);
  }
  if (issued.status !== "sent" && issued.status !== "cooldown") {
    return redirectWithCookies(origin, `${back}?error=${issued.status}`, []);
  }
  const email = normalizeEmail(emailRaw);
  const secret = sessionSecret();
  if (!email || !secret) {
    return redirectWithCookies(origin, `${back}?error=session`, []);
  }
  const token = await signSession(
    {
      userId: EMAIL_CODE_USER,
      login: email,
      name: null,
      role: "USER",
      exp: Date.now() + LOGIN_EMAIL_TTL_SECONDS * 1000,
    },
    secret,
  );
  const nextRaw = form.get("next");
  const next = typeof nextRaw === "string" ? safeRelativePath(nextRaw, "") : "";
  const cookies = [{ name: LOGIN_EMAIL_COOKIE, value: token, maxAge: LOGIN_EMAIL_TTL_SECONDS }];
  if (next) cookies.push({ name: NEXT_COOKIE, value: next, maxAge: LOGIN_EMAIL_TTL_SECONDS });
  const error = issued.status === "cooldown" ? "?error=cooldown" : "";
  return redirectWithCookies(origin, `/login/code${error}`, cookies);
}
