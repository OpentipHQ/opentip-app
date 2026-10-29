import { cookies } from "next/headers";
import { sessionSecret } from "@/lib/config";
import { getPrisma } from "@/lib/db";
import {
  LINK_GITHUB_COOKIE,
  NEXT_COOKIE,
  PENDING_INSTALL_COOKIE,
  PENDING_INSTALL_TTL_SECONDS,
  SESSION_TTL_SECONDS,
} from "@/lib/auth/constants";
import { applyGithubGate, type SessionDraft } from "@/lib/auth/gate";
import { redirectWithCookies, requestOrigin } from "@/lib/auth/http";
import { authErrors } from "@/lib/auth/messages";
import { consumePendingInstall, readPendingInstall, storePendingInstall } from "@/lib/auth/pending-store";
import {
  createAppUser,
  findUserByEmail,
  findUserByGithubId,
  linkInstallForUser,
  toExistingUser,
  updateAppUser,
} from "@/lib/auth/users";
import { hasBetaAccess } from "@/lib/beta/access";
import { exchangeGithubCode } from "@/lib/github/app";
import { listInstallationRepositories, readUserInstallation } from "@/lib/github/install";
import { completeOauthCallback, readInstallationId } from "@/lib/github/oauth-callback";
import { OAUTH_STATE_COOKIE, SESSION_COOKIE, signSession, verifySession } from "@/lib/session";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = requestOrigin(request);
  const secret = sessionSecret();
  const jar = await cookies();
  const pendingState = secret
    ? await verifySession(jar.get(OAUTH_STATE_COOKIE)?.value, secret)
    : null;
  const result = await completeOauthCallback(
    {
      code: url.searchParams.get("code"),
      state: url.searchParams.get("state"),
      installationId: readInstallationId(url.searchParams.get("installation_id")),
      setupAction: url.searchParams.get("setup_action"),
      pendingUserId: pendingState?.userId ?? null,
      pendingInvite: pendingState?.name ?? null,
      hasSecret: Boolean(secret),
    },
    {
      exchange: exchangeGithubCode,
      readInstallation: readUserInstallation,
      listRepos: listInstallationRepositories,
    },
  );

  const clearOauth = { name: OAUTH_STATE_COOKIE, value: "", maxAge: 0 };
  if (!result.ok || !secret) {
    const error = result.ok ? "session" : result.error;
    return redirectWithCookies(origin, `/login?error=${error}`, [clearOauth], {
      tone: "error",
      message: authErrors[error] ?? "GitHub sign-in failed.",
    });
  }

  const prisma = getPrisma();
  if (!prisma) {
    return redirectWithCookies(origin, "/login?error=database", [clearOauth], {
      tone: "error",
      message: authErrors.database,
    });
  }

  const existingRaw = await verifySession(jar.get(SESSION_COOKIE)?.value, secret);
  let existing: SessionDraft | null = null;
  let sessionActive = false;
  if (existingRaw) {
    const row = await prisma.user.findUnique({ where: { id: existingRaw.userId } });
    if (row && !row.suspendedAt && (existingRaw.sv ?? 0) === row.sessionVersion) {
      const user = toExistingUser(row);
      existing = {
        userId: user.id,
        login: user.login,
        name: user.name,
        role: user.role,
        email: user.email,
        githubId: user.githubId,
        sv: user.sessionVersion,
      };
      sessionActive = true;
    }
  }

  const linkRaw = await verifySession(jar.get(LINK_GITHUB_COOKIE)?.value, secret);
  if (linkRaw && existingRaw && linkRaw.userId === existingRaw.userId) {
    const clearLink = { name: LINK_GITHUB_COOKIE, value: "", maxAge: 0 };
    if (!sessionActive || !existing) {
      return redirectWithCookies(
        origin,
        "/login?error=suspended",
        [
          clearOauth,
          clearLink,
          { name: SESSION_COOKIE, value: "", maxAge: 0 },
        ],
        { tone: "error", message: authErrors.suspended },
      );
    }
    const owner = await prisma.user.findUnique({
      where: { githubId: result.profile.id },
      select: { id: true },
    });
    if (owner && owner.id !== linkRaw.userId) {
      return redirectWithCookies(origin, "/profile?error=github-taken", [clearOauth, clearLink], {
        tone: "error",
        message: "That GitHub account is already linked to someone else.",
      });
    }
    await prisma.user.update({
      where: { id: linkRaw.userId },
      data: {
        githubId: result.profile.id,
        avatarUrl: result.profile.avatarUrl,
        ...(existing.name ? {} : { name: result.profile.name }),
      },
    });
    return redirectWithCookies(origin, "/profile?linked=1", [clearOauth, clearLink], {
      tone: "success",
      message: "GitHub connected.",
    });
  }

  const held = await readPendingInstall(jar.get(PENDING_INSTALL_COOKIE)?.value);
  const nextPath = jar.get(NEXT_COOKIE)?.value ?? url.searchParams.get("next");
  let outcome;
  try {
    outcome = await applyGithubGate(
    result,
    {
      hasAccess: hasBetaAccess,
      findUserByGithubId,
      findUserByEmail,
      createUser: createAppUser,
      updateUser: updateAppUser,
      savePending: storePendingInstall,
      link: linkInstallForUser,
      takePending: async () => held?.snapshot ?? null,
      markPendingConsumed: async () => {
        if (held) await consumePendingInstall(held.id);
      },
      existingSession: existing,
    },
    nextPath,
    );
  } catch {
    return redirectWithCookies(origin, "/login?error=github", [clearOauth], {
      tone: "error",
      message: authErrors.github,
    });
  }

  if (outcome.session && result.inviteToken && result.profile.email) {
    await prisma.betaInvite.updateMany({
      where: { token: result.inviteToken, email: result.profile.email, acceptedAt: null },
      data: { acceptedAt: new Date(), userId: outcome.session.userId },
    });
  }

  const jarCookies: Array<{ name: string; value: string; maxAge: number }> = [
    clearOauth,
    { name: LINK_GITHUB_COOKIE, value: "", maxAge: 0 },
    { name: NEXT_COOKIE, value: "", maxAge: 0 },
  ];
  if (outcome.clearSession) {
    jarCookies.push({ name: SESSION_COOKIE, value: "", maxAge: 0 });
  }
  if (outcome.pendingSelector) {
    jarCookies.push({
      name: PENDING_INSTALL_COOKIE,
      value: outcome.pendingSelector,
      maxAge: PENDING_INSTALL_TTL_SECONDS,
    });
  } else if (outcome.consumedPending) {
    jarCookies.push({ name: PENDING_INSTALL_COOKIE, value: "", maxAge: 0 });
  }
  if (outcome.session) {
    const token = await signSession(
      {
        userId: outcome.session.userId,
        login: outcome.session.login,
        name: outcome.session.name,
        role: outcome.session.role,
        exp: Date.now() + SESSION_TTL_SECONDS * 1000,
        sv: outcome.session.sv,
      },
      secret,
    );
    jarCookies.push({ name: SESSION_COOKIE, value: token, maxAge: SESSION_TTL_SECONDS });
  }
  const toast =
    outcome.session && !outcome.redirect.startsWith("/waitlist")
      ? { tone: "success" as const, message: "Signed in with GitHub." }
      : undefined;
  return redirectWithCookies(origin, outcome.redirect, jarCookies, toast);
}
