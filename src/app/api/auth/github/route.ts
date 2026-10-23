import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { sessionCookieOptions } from "@/lib/auth";
import { sessionSecret } from "@/lib/config";
import { githubAuthorizeUrl, newOauthNonce } from "@/lib/github/app";
import { OAUTH_STATE_COOKIE, signSession } from "@/lib/session";

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
    return NextResponse.redirect(new URL("/sign-in?error=github", origin));
  }
  const secret = sessionSecret();
  if (!secret) {
    return NextResponse.redirect(new URL("/sign-in?error=session", origin));
  }
  const nonce = newOauthNonce();
  const invite = new URL(request.url).searchParams.get("invite");
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
  return NextResponse.redirect(githubAuthorizeUrl(nonce));
}
