import type { GithubUser } from "@/lib/github/app";
import type { RepoSeed, VerifiedInstallation } from "@/lib/github/install";

export type OauthCallbackInput = {
  code: string | null;
  state: string | null;
  installationId: string | null;
  setupAction: string | null;
  pendingUserId: string | null;
  pendingInvite: string | null;
  hasSecret: boolean;
};

export type OauthFlow = "sign-in" | "install" | "reject";

export function readInstallationId(value: string | null): string | null {
  if (!value || !/^[0-9]{1,20}$/.test(value)) return null;
  return value;
}

// The Sign in button stores a nonce in a cookie and sends the same nonce as
// `state`. GitHub's install redirect does not. It sends `code`,
// `installation_id`, and `setup_action` instead.
export function classifyOauthCallback(input: {
  hasCode: boolean;
  stateMatches: boolean;
  installationId: string | null;
  setupAction: string | null;
}): OauthFlow {
  if (!input.hasCode) return "reject";
  if (input.stateMatches) return "sign-in";
  const action = input.setupAction?.toLowerCase() ?? "";
  if (input.installationId && (action === "install" || action === "update")) {
    return "install";
  }
  return "reject";
}

export function stateMatchesNonce(
  state: string | null,
  pendingUserId: string | null,
  hasSecret: boolean,
): boolean {
  return Boolean(hasSecret && state && pendingUserId && pendingUserId === state);
}

export type OauthCallbackDeps = {
  exchange: (code: string) => Promise<{ profile: GithubUser; accessToken: string }>;
  readInstallation: (
    installationId: string,
    accessToken: string,
  ) => Promise<VerifiedInstallation | null>;
  listRepos: (installationId: string, accessToken: string) => Promise<RepoSeed[]>;
};

export type OauthCallbackResult =
  | { ok: false; error: "state" | "session" | "github" | "installation" }
  | {
      ok: true;
      flow: "sign-in" | "install";
      profile: GithubUser;
      inviteToken: string | null;
      installation: VerifiedInstallation | null;
      repos: RepoSeed[];
    };

export async function completeOauthCallback(
  input: OauthCallbackInput,
  deps: OauthCallbackDeps,
): Promise<OauthCallbackResult> {
  if (!input.hasSecret) return { ok: false, error: "session" };
  const matches = stateMatchesNonce(input.state, input.pendingUserId, input.hasSecret);
  const flow = classifyOauthCallback({
    hasCode: Boolean(input.code),
    stateMatches: matches,
    installationId: input.installationId,
    setupAction: input.setupAction,
  });
  if (flow === "reject" || !input.code) return { ok: false, error: "state" };

  let exchanged: { profile: GithubUser; accessToken: string };
  try {
    exchanged = await deps.exchange(input.code);
  } catch {
    return { ok: false, error: "github" };
  }

  let installation: VerifiedInstallation | null = null;
  let repos: RepoSeed[] = [];
  if (input.installationId) {
    try {
      installation = await deps.readInstallation(input.installationId, exchanged.accessToken);
    } catch {
      installation = null;
    }
    if (flow === "install" && !installation) {
      return { ok: false, error: "installation" };
    }
    if (installation) {
      try {
        repos = await deps.listRepos(input.installationId, exchanged.accessToken);
      } catch {
        repos = [];
      }
    }
  }

  return {
    ok: true,
    flow,
    profile: exchanged.profile,
    inviteToken: flow === "sign-in" ? input.pendingInvite : null,
    installation,
    repos,
  };
}
