import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getRequestSession, sessionCookieOptions } from "@/lib/auth";
import { LINK_GITHUB_COOKIE } from "@/lib/auth/constants";
import { redirectWithCookies, requestOrigin } from "@/lib/auth/http";
import { authErrors } from "@/lib/auth/messages";
import { sessionSecret } from "@/lib/config";
import { githubAuthorizeUrl, newOauthNonce } from "@/lib/github/app";
import { OAUTH_STATE_COOKIE, signSession } from "@/lib/session";

export async function GET(request: Request) {
  const origin = requestOrigin(request);
  const session = await getRequestSession();
  if (!session) return NextResponse.redirect(new URL("/login?next=/profile", origin));
  if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
    return redirectWithCookies(origin, "/profile?error=github", [], {
      tone: "error",
      message: authErrors.github,
    });
  }
  const secret = sessionSecret();
  if (!secret) {
    return redirectWithCookies(origin, "/profile?error=session", [], {
      tone: "error",
      message: authErrors.session,
    });
  }
  const nonce = newOauthNonce();
  const jar = await cookies();
  const stateToken = await signSession(
    {
      userId: nonce,
      login: "oauth",
      name: null,
      role: "USER",
      exp: Date.now() + 10 * 60 * 1000,
    },
    secret,
  );
  const linkToken = await signSession(
    {
      userId: session.userId,
      login: session.login,
      name: session.name,
      role: session.role,
      exp: Date.now() + 10 * 60 * 1000,
      sv: session.sv ?? 0,
    },
    secret,
  );
  jar.set(OAUTH_STATE_COOKIE, stateToken, sessionCookieOptions(10 * 60));
  jar.set(LINK_GITHUB_COOKIE, linkToken, sessionCookieOptions(10 * 60));
  return NextResponse.redirect(githubAuthorizeUrl(nonce));
}
