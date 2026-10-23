import { cookies } from "next/headers";
import { sessionCookieOptions } from "@/lib/auth";
import { NEXT_COOKIE } from "@/lib/auth/constants";
import { safeRelativePath } from "@/lib/auth/gate";
import { sessionSecret } from "@/lib/config";
import { githubAuthorizeUrl, newOauthNonce } from "@/lib/github/app";
import { OAUTH_STATE_COOKIE, signSession } from "@/lib/session";
import { NextResponse } from "next/server";
import { requestOrigin } from "@/lib/auth/http";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = requestOrigin(request);
  if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
    return NextResponse.redirect(new URL("/login?error=github", origin));
  }
  const secret = sessionSecret();
  if (!secret) {
    return NextResponse.redirect(new URL("/login?error=session", origin));
  }
  const nonce = newOauthNonce();
  const invite = url.searchParams.get("invite");
  const token = await signSession(
    {
      userId: nonce,
      login: "oauth",
      name: invite && /^[A-Za-z0-9_-]{16,}$/.test(invite) ? invite : null,
      role: "USER",
      exp: Date.now() + 10 * 60 * 1000,
    },
    secret,
  );
  const jar = await cookies();
  jar.set(OAUTH_STATE_COOKIE, token, sessionCookieOptions(10 * 60));
  const next = safeRelativePath(url.searchParams.get("next"), "");
  if (next) jar.set(NEXT_COOKIE, next, sessionCookieOptions(10 * 60));
  return NextResponse.redirect(githubAuthorizeUrl(nonce));
}
