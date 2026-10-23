import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { sessionSecret } from "@/lib/config";
import { getPrisma } from "@/lib/db";
import { exchangeGithubCode } from "@/lib/github/app";
import { listInstallationRepositories, readUserInstallation } from "@/lib/github/install";
import { linkInstallationRecords } from "@/lib/github/link-installation";
import { completeOauthCallback, readInstallationId } from "@/lib/github/oauth-callback";
import { createPrismaInstallationStore } from "@/lib/github/prisma-installation-store";
import { OAUTH_STATE_COOKIE, SESSION_COOKIE, sessionCookieOptions, signSession, verifySession } from "@/lib/session";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const secret = sessionSecret();
  const jar = await cookies();
  const pending = secret
    ? await verifySession(jar.get(OAUTH_STATE_COOKIE)?.value, secret)
    : null;
  const result = await completeOauthCallback(
    {
      code: url.searchParams.get("code"),
      state: url.searchParams.get("state"),
      installationId: readInstallationId(url.searchParams.get("installation_id")),
      setupAction: url.searchParams.get("setup_action"),
      pendingUserId: pending?.userId ?? null,
      pendingInvite: pending?.name ?? null,
      hasSecret: Boolean(secret),
    },
    {
      exchange: exchangeGithubCode,
      readInstallation: readUserInstallation,
      listRepos: listInstallationRepositories,
    },
  );
  if (!result.ok || !secret) {
    const error = result.ok ? "session" : result.error;
    return NextResponse.redirect(new URL(`/sign-in?error=${error}`, origin));
  }

  const prisma = getPrisma();
  if (!prisma) {
    return NextResponse.redirect(new URL("/sign-in?error=database", origin));
  }

  try {
    const profile = result.profile;
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
    if (result.inviteToken && profile.email) {
      await prisma.betaInvite.updateMany({
        where: { token: result.inviteToken, email: profile.email, acceptedAt: null },
        data: { acceptedAt: new Date(), userId: user.id },
      });
    }
    if (result.installation) {
      const store = createPrismaInstallationStore();
      if (store) {
        try {
          await linkInstallationRecords(store, {
            userId: user.id,
            installation: result.installation,
            repos: result.repos,
          });
        } catch {
          // The session is still created. A later install can link the repos.
        }
      }
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
    jar.set(OAUTH_STATE_COOKIE, "", sessionCookieOptions(0));
    const next = url.searchParams.get("next");
    const safeNext =
      result.flow === "sign-in" && next && next.startsWith("/") && !next.startsWith("//")
        ? next
        : "/dashboard";
    return NextResponse.redirect(new URL(safeNext, origin));
  } catch {
    return NextResponse.redirect(new URL("/sign-in?error=github", origin));
  }
}
