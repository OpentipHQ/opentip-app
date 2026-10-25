import { cookies } from "next/headers";
import { sessionSecret } from "@/lib/config";
import {
  EMAIL_CODE_USER,
  LOGIN_EMAIL_COOKIE,
  NEXT_COOKIE,
  PENDING_INSTALL_COOKIE,
  SESSION_TTL_SECONDS,
} from "@/lib/auth/constants";
import { verifyLoginCode } from "@/lib/auth/email-flow";
import { claimPendingForUser, safeRelativePath } from "@/lib/auth/gate";
import { redirectWithCookies, requestOrigin } from "@/lib/auth/http";
import { normalizeEmail } from "@/lib/auth/login-code";
import { consumePendingInstall, readPendingInstall } from "@/lib/auth/pending-store";
import { findUserByGithubId, linkInstallForUser, updateAppUser } from "@/lib/auth/users";
import { SESSION_COOKIE, signSession, verifySession } from "@/lib/session";

export async function POST(request: Request) {
  const origin = requestOrigin(request);
  const secret = sessionSecret();
  const jar = await cookies();
  const pending = secret ? await verifySession(jar.get(LOGIN_EMAIL_COOKIE)?.value, secret) : null;
  const email = pending && pending.userId === EMAIL_CODE_USER ? normalizeEmail(pending.login) : null;
  if (!email || !secret) return redirectWithCookies(origin, "/login?error=missing", []);

  const form = await request.formData();
  const result = await verifyLoginCode({ email, code: String(form.get("code") ?? "") });
  if (result.status === "waitlist") {
    return redirectWithCookies(origin, "/waitlist", [
      { name: SESSION_COOKIE, value: "", maxAge: 0 },
    ]);
  }
  if (result.status !== "ok") {
    return redirectWithCookies(origin, `/login/code?error=${result.status}`, []);
  }

  const held = await readPendingInstall(jar.get(PENDING_INSTALL_COOKIE)?.value);
  const claim = await claimPendingForUser(result.user, held?.snapshot ?? null, {
    findUserByGithubId,
    updateUser: updateAppUser,
    link: linkInstallForUser,
  });
  if (claim.consumed && held) await consumePendingInstall(held.id);

  const sessionUser = claim.user;
  const token = await signSession(
    {
      userId: sessionUser.id,
      login: sessionUser.login,
      name: sessionUser.name,
      role: sessionUser.role,
      exp: Date.now() + SESSION_TTL_SECONDS * 1000,
      sv: sessionUser.sessionVersion,
    },
    secret,
  );
  const next = safeRelativePath(jar.get(NEXT_COOKIE)?.value, "/dashboard");
  const cookiesOut = [
    { name: SESSION_COOKIE, value: token, maxAge: SESSION_TTL_SECONDS },
    { name: LOGIN_EMAIL_COOKIE, value: "", maxAge: 0 },
    { name: NEXT_COOKIE, value: "", maxAge: 0 },
  ];
  if (claim.consumed) {
    cookiesOut.push({ name: PENDING_INSTALL_COOKIE, value: "", maxAge: 0 });
  }
  return redirectWithCookies(origin, next, cookiesOut);
}
