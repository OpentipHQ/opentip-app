import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { sessionCookieOptions } from "@/lib/auth";
import { sessionSecret } from "@/lib/config";
import { getPrisma } from "@/lib/db";
import { exchangeGithubCode } from "@/lib/github/app";
import { OAUTH_STATE_COOKIE, SESSION_COOKIE, signSession, verifySession } from "@/lib/session";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const secret = sessionSecret();
  const jar = await cookies();
  const pending = await verifySession(jar.get(OAUTH_STATE_COOKIE)?.value, secret ?? "");
  if (!secret || !code || !state || !pending || pending.userId !== state) {
    return NextResponse.redirect(new URL("/sign-in?error=state", origin));
  }

  const prisma = getPrisma();
  if (!prisma) {
    return NextResponse.redirect(new URL("/sign-in?error=database", origin));
  }

  try {
    const profile = await exchangeGithubCode(code);
    const user = await prisma.user.upsert({
      where: { githubId: profile.id },
      create: {
        githubId: profile.id,
        login: profile.login,
        name: profile.name,
        email: profile.email,
        avatarUrl: profile.avatarUrl,
      },
      update: {
        login: profile.login,
        name: profile.name,
        email: profile.email,
        avatarUrl: profile.avatarUrl,
      },
    });
    if (pending.name && profile.email) {
      await prisma.betaInvite.updateMany({
        where: { token: pending.name, email: profile.email, acceptedAt: null },
        data: { acceptedAt: new Date(), userId: user.id },
      });
    }
    const session = await signSession(
      {
        userId: user.id,
        login: user.login,
        name: user.name,
        role: user.role,
        exp: Date.now() + 14 * 24 * 60 * 60 * 1000,
      },
      secret,
    );
    jar.set(SESSION_COOKIE, session, sessionCookieOptions(14 * 24 * 60 * 60));
    jar.delete(OAUTH_STATE_COOKIE);
    const next = url.searchParams.get("next");
    const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
    return NextResponse.redirect(new URL(safeNext, origin));
  } catch {
    return NextResponse.redirect(new URL("/sign-in?error=github", origin));
  }
}
