import { normalizeEmail } from "@/lib/auth/login-code";

export type AccountProfile = {
  githubId: string | null;
  login: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
};

export type ExistingUser = Omit<AccountProfile, "email"> & {
  id: string;
  role: "USER" | "ADMIN";
  email: string | null;
};

export type LinkDecision =
  | { kind: "create"; data: AccountProfile }
  | { kind: "update"; id: string; data: AccountProfile }
  | { kind: "conflict" };

export function loginFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "";
  const slug = local.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 32);
  return slug.length >= 2 ? slug : "member";
}

export function decideAccountLink(args: {
  profile: AccountProfile;
  byGithub: ExistingUser | null;
  byEmail: ExistingUser | null;
}): LinkDecision {
  const email = normalizeEmail(args.profile.email);
  if (!email) return { kind: "conflict" };
  const profile = { ...args.profile, email };
  const { byGithub, byEmail } = args;
  if (byGithub && byEmail && byGithub.id !== byEmail.id) return { kind: "conflict" };
  if (byEmail && byEmail.githubId && profile.githubId && byEmail.githubId !== profile.githubId) {
    return { kind: "conflict" };
  }
  if (byGithub && byEmail && byGithub.githubId && profile.githubId && byGithub.githubId !== profile.githubId) {
    return { kind: "conflict" };
  }
  const target = byGithub ?? byEmail;
  if (!target) return { kind: "create", data: profile };
  return {
    kind: "update",
    id: target.id,
    data: {
      githubId: profile.githubId ?? target.githubId,
      login: profile.githubId ? profile.login : target.login,
      name: profile.name ?? target.name,
      email,
      avatarUrl: profile.avatarUrl ?? target.avatarUrl,
    },
  };
}
