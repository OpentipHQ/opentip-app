import { cookies } from "next/headers";
import { sessionSecret } from "@/lib/config";
import { EMAIL_CODE_USER, LOGIN_EMAIL_COOKIE } from "@/lib/auth/constants";
import { issueLoginCode } from "@/lib/auth/email-flow";
import { clientIp, redirectWithCookies, requestOrigin } from "@/lib/auth/http";
import { authErrors } from "@/lib/auth/messages";
import { normalizeEmail } from "@/lib/auth/login-code";
import { verifySession } from "@/lib/session";

export async function POST(request: Request) {
  const origin = requestOrigin(request);
  const secret = sessionSecret();
  const jar = await cookies();
  const pending = secret ? await verifySession(jar.get(LOGIN_EMAIL_COOKIE)?.value, secret) : null;
  const email = pending && pending.userId === EMAIL_CODE_USER ? normalizeEmail(pending.login) : null;
  if (!email) {
    return redirectWithCookies(origin, "/login?error=missing", [], {
      tone: "error",
      message: authErrors.missing,
    });
  }
  const issued = await issueLoginCode({ emailRaw: email, ip: clientIp(request) });
  if (issued.status === "waitlist") {
    return redirectWithCookies(origin, "/waitlist", [], {
      tone: "info",
      message: "You are on the waitlist for now.",
    });
  }
  if (issued.status === "sent") {
    return redirectWithCookies(origin, "/login/code", [], {
      tone: "success",
      message: "New code sent. Check your email.",
    });
  }
  if (issued.status === "cooldown") {
    return redirectWithCookies(origin, "/login/code?error=cooldown", [], {
      tone: "info",
      message: authErrors.cooldown,
    });
  }
  return redirectWithCookies(origin, `/login/code?error=${issued.status}`, [], {
    tone: "error",
    message: authErrors[issued.status] ?? "Could not resend the code.",
  });
}
