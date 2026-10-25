import type { GithubUser } from "@/lib/github/app";
import type { RepoSeed, VerifiedInstallation } from "@/lib/github/install";
import type { OauthCallbackResult } from "@/lib/github/oauth-callback";
import {
  decideAccountLink,
  type AccountProfile,
  type ExistingUser,
} from "@/lib/auth/accounts";
import { normalizeEmail } from "@/lib/auth/login-code";

export type SessionDraft = {
  userId: string;
  login: string;
  name: string | null;
  role: "USER" | "ADMIN";
  email: string | null;
  githubId: string | null;
  sv: number;
};

export type PendingSnapshot = {
  githubUserId: string;
  email: string | null;
  login: string;
  name: string | null;
  avatarUrl: string | null;
  installation: VerifiedInstallation;
  repos: RepoSeed[];
};

export type GateDeps = {
  hasAccess: (email: string) => Promise<boolean>;
  findUserByGithubId: (githubId: string) => Promise<ExistingUser | null>;
  findUserByEmail: (email: string) => Promise<ExistingUser | null>;
  createUser: (profile: AccountProfile) => Promise<ExistingUser>;
  updateUser: (id: string, profile: AccountProfile) => Promise<ExistingUser>;
  savePending: (snapshot: PendingSnapshot) => Promise<string>;
  link: (
    userId: string,
    installation: VerifiedInstallation,
    repos: RepoSeed[],
  ) => Promise<{ sitesCreated: number }>;
  takePending: () => Promise<PendingSnapshot | null>;
  markPendingConsumed: () => Promise<void>;
  existingSession: SessionDraft | null;
};

export type GateOutcome = {
  redirect: string;
  session: SessionDraft | null;
  sitesCreated: number;
  clearSession: boolean;
  pendingSelector: string | null;
  consumedPending: boolean;
};

export function safeRelativePath(value: string | null | undefined, fallback = "/dashboard"): string {
  if (!value) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\") || value.includes("://")) {
    return fallback;
  }
  return value;
}

export function pendingInstallMatches(
  user: { githubId: string | null; email: string | null },
  pending: { githubUserId: string; email: string | null },
): boolean {
  if (user.githubId && user.githubId !== pending.githubUserId) return false;
  if (user.githubId && user.githubId === pending.githubUserId) return true;
  const userEmail = user.email ? normalizeEmail(user.email) : null;
  const pendingEmail = pending.email ? normalizeEmail(pending.email) : null;
  return Boolean(userEmail && pendingEmail && userEmail === pendingEmail);
}

function snapshotOf(
  result: Extract<OauthCallbackResult, { ok: true }>,
  email: string | null,
): PendingSnapshot | null {
  if (!result.installation) return null;
  return {
    githubUserId: result.profile.id,
    email,
    login: result.profile.login,
    name: result.profile.name,
    avatarUrl: result.profile.avatarUrl,
    installation: result.installation,
    repos: result.repos,
  };
}

function sessionMatches(session: SessionDraft | null, profile: GithubUser, email: string): boolean {
  if (!session) return false;
  if (session.githubId && session.githubId === profile.id) return true;
  return Boolean(session.email && normalizeEmail(session.email) === email);
}

function toSession(user: ExistingUser): SessionDraft {
  return {
    userId: user.id,
    login: user.login,
    name: user.name,
    role: user.role,
    email: user.email,
    githubId: user.githubId,
    sv: user.sessionVersion,
  };
}

export async function applyGithubGate(
  result: Extract<OauthCallbackResult, { ok: true }>,
  deps: GateDeps,
  nextPath: string | null,
): Promise<GateOutcome> {
  const email = normalizeEmail(result.profile.email ?? "");
  const pending = snapshotOf(result, email);
  const [byGithub, byEmail] = await Promise.all([
    deps.findUserByGithubId(result.profile.id),
    email ? deps.findUserByEmail(email) : Promise.resolve(null),
  ]);
  const accountEmail = byGithub && (!byEmail || byEmail.id === byGithub.id) ? byGithub.email : null;
  const approved = accountEmail
    ? await deps.hasAccess(accountEmail)
    : email
      ? await deps.hasAccess(email)
      : false;
  const none = {
    session: null,
    sitesCreated: 0,
    pendingSelector: null as string | null,
    consumedPending: false,
  };

  if (!email || !approved) {
    const selector = pending ? await deps.savePending(pending) : null;
    if (!email) {
      const redirect =
        result.flow === "install" ? "/login?error=email&from=install" : "/login?error=email";
      return { ...none, redirect, clearSession: false, pendingSelector: selector };
    }
    return { ...none, redirect: "/waitlist", clearSession: true, pendingSelector: selector };
  }

  const matched = sessionMatches(deps.existingSession, result.profile, email);
  if (result.flow === "install" && !matched) {
    const selector = pending ? await deps.savePending(pending) : null;
    return {
      ...none,
      redirect: "/login?from=install",
      clearSession: false,
      pendingSelector: selector,
    };
  }

  const profile: AccountProfile = {
    githubId: result.profile.id,
    login: result.profile.login,
    name: result.profile.name,
    email,
    avatarUrl: result.profile.avatarUrl,
  };
  const decision = decideAccountLink({ profile, byGithub, byEmail });
  if (decision.kind === "conflict") {
    const selector = pending ? await deps.savePending(pending) : null;
    return {
      ...none,
      redirect: "/login?error=conflict",
      clearSession: false,
      pendingSelector: selector,
    };
  }
  const user =
    decision.kind === "create"
      ? await deps.createUser(decision.data)
      : await deps.updateUser(decision.id, decision.data);
  if (user.suspendedAt) {
    return { ...none, redirect: "/login?error=suspended", clearSession: true };
  }

  let sitesCreated = 0;
  let consumedPending = false;
  if (result.installation) {
    const linked = await deps.link(user.id, result.installation, result.repos);
    sitesCreated = linked.sitesCreated;
  } else {
    const held = await deps.takePending();
    if (held && pendingInstallMatches(user, held)) {
      const linked = await deps.link(user.id, held.installation, held.repos);
      sitesCreated = linked.sitesCreated;
      await deps.markPendingConsumed();
      consumedPending = true;
    }
  }

  return {
    redirect: result.flow === "sign-in" ? safeRelativePath(nextPath) : "/dashboard",
    session: toSession(user),
    sitesCreated,
    clearSession: false,
    pendingSelector: null,
    consumedPending,
  };
}

export async function claimPendingForUser(
  user: ExistingUser,
  pending: PendingSnapshot | null,
  deps: Pick<GateDeps, "findUserByGithubId" | "updateUser" | "link">,
): Promise<{ user: ExistingUser; sitesCreated: number; consumed: boolean }> {
  if (!pending || !pendingInstallMatches(user, pending) || !user.email) {
    return { user, sitesCreated: 0, consumed: false };
  }
  let next = user;
  if (!user.githubId) {
    const owner = await deps.findUserByGithubId(pending.githubUserId);
    if (owner && owner.id !== user.id) return { user, sitesCreated: 0, consumed: false };
    next = await deps.updateUser(user.id, {
      githubId: pending.githubUserId,
      login: pending.login || user.login,
      name: pending.name ?? user.name,
      email: user.email,
      avatarUrl: pending.avatarUrl ?? user.avatarUrl,
    });
  }
  const linked = await deps.link(next.id, pending.installation, pending.repos);
  return { user: next, sitesCreated: linked.sitesCreated, consumed: true };
}
