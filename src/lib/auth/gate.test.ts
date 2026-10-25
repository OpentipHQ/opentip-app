import { describe, expect, it, vi } from "vitest";
import { applyGithubGate, pendingInstallMatches, type GateDeps, type PendingSnapshot } from "@/lib/auth/gate";
import type { OauthCallbackResult } from "@/lib/github/oauth-callback";

const installation = {
  githubInstallationId: "99",
  accountLogin: "ada",
  accountType: "User",
};

const repo = {
  githubRepoId: "7",
  owner: "ada",
  name: "docs",
  fullName: "ada/docs",
  private: false,
  defaultBranch: "main",
  archived: false,
};

function success(flow: "sign-in" | "install", withInstall = true): Extract<OauthCallbackResult, { ok: true }> {
  return {
    ok: true,
    flow,
    profile: {
      id: "42",
      login: "ada",
      name: "Ada",
      email: "ada@example.com",
      avatarUrl: null,
    },
    inviteToken: flow === "sign-in" ? "invite-token-value1" : null,
    installation: withInstall ? installation : null,
    repos: withInstall ? [repo] : [],
  };
}

function deps(overrides: Partial<GateDeps> = {}): GateDeps {
  return {
    hasAccess: async () => true,
    findUserByGithubId: async () => null,
    findUserByEmail: async () => null,
    createUser: vi.fn(async (profile) => ({ id: "user_1", role: "USER" as const, sessionVersion: 0, suspendedAt: null, ...profile })),
    updateUser: async (id, profile) => ({ id, role: "USER", sessionVersion: 0, suspendedAt: null, ...profile }),
    savePending: vi.fn(async () => "selector"),
    link: vi.fn(async () => ({ sitesCreated: 0 })),
    takePending: async () => null,
    markPendingConsumed: vi.fn(async () => undefined),
    existingSession: null,
    ...overrides,
  };
}

describe("beta gate for GitHub", () => {
  it("sends an unapproved install to the waitlist and creates no sites", async () => {
    const gate = deps({ hasAccess: async () => false });
    const outcome = await applyGithubGate(success("install"), gate, null);
    expect(outcome).toMatchObject({
      redirect: "/waitlist",
      session: null,
      sitesCreated: 0,
      clearSession: true,
      pendingSelector: "selector",
    });
    expect(gate.link).not.toHaveBeenCalled();
    expect(gate.createUser).not.toHaveBeenCalled();
  });

  it("holds an approved install that has no session, without creating sites", async () => {
    const gate = deps();
    const outcome = await applyGithubGate(success("install"), gate, null);
    expect(outcome).toMatchObject({
      redirect: "/login?from=install",
      session: null,
      sitesCreated: 0,
    });
    expect(gate.savePending).toHaveBeenCalled();
    expect(gate.link).not.toHaveBeenCalled();
  });

  it("links the install when the signed-in account is approved and matches", async () => {
    const gate = deps({
      existingSession: {
        userId: "user_1",
        login: "ada",
        name: "Ada",
        role: "USER",
        email: "ada@example.com",
        githubId: "42",
        sv: 0,
      },
      findUserByGithubId: async () => ({
        id: "user_1",
        githubId: "42",
        login: "ada",
        name: "Ada",
        email: "ada@example.com",
        avatarUrl: null,
        role: "USER",
        sessionVersion: 0,
        suspendedAt: null,
      }),
    });
    const outcome = await applyGithubGate(success("install"), gate, null);
    expect(outcome.session?.userId).toBe("user_1");
    expect(outcome.sitesCreated).toBe(0);
    expect(gate.link).toHaveBeenCalledWith("user_1", installation, [repo]);
    expect(gate.savePending).not.toHaveBeenCalled();
  });

  it("does not create sites from a direct install when the email is missing", async () => {
    const gate = deps();
    const result = success("install");
    result.profile = { ...result.profile, email: null };
    const outcome = await applyGithubGate(result, gate, null);
    expect(outcome.redirect).toBe("/login?error=email&from=install");
    expect(outcome.sitesCreated).toBe(0);
    expect(outcome.session).toBeNull();
    expect(gate.link).not.toHaveBeenCalled();
  });

  it("creates the account but no sites after an approved sign-in", async () => {
    const gate = deps();
    const outcome = await applyGithubGate(success("sign-in"), gate, "/dashboard/billing");
    expect(outcome.redirect).toBe("/dashboard/billing");
    expect(outcome.session?.login).toBe("ada");
    expect(outcome.sitesCreated).toBe(0);
  });

  it("consumes a held install on a later approved sign-in when the GitHub account matches", async () => {
    const pending: PendingSnapshot = {
      githubUserId: "42",
      email: "ada@example.com",
      login: "ada",
      name: "Ada",
      avatarUrl: null,
      installation,
      repos: [repo],
    };
    const gate = deps({ takePending: async () => pending });
    const outcome = await applyGithubGate(success("sign-in", false), gate, null);
    expect(outcome.sitesCreated).toBe(0);
    expect(outcome.consumedPending).toBe(true);
    expect(gate.markPendingConsumed).toHaveBeenCalled();
  });

  it("uses a linked account's current email for beta access after an email change", async () => {
    const linked = {
      id: "user_1",
      githubId: "42",
      login: "ada",
      name: "Ada",
      email: "new@example.com",
      avatarUrl: null,
      role: "USER" as const,
      sessionVersion: 0,
      suspendedAt: null,
    };
    const gate = deps({
      hasAccess: async (candidate) => candidate === "new@example.com",
      findUserByGithubId: async () => linked,
    });
    const outcome = await applyGithubGate(success("sign-in"), gate, null);
    expect(outcome.session?.userId).toBe("user_1");
    expect(outcome.session?.email).toBe("new@example.com");
    expect(outcome.redirect).toBe("/dashboard");
  });

  it("does not create a session for a suspended account", async () => {
    const suspended = {
      id: "user_1",
      githubId: "42",
      login: "ada",
      name: "Ada",
      email: "ada@example.com",
      avatarUrl: null,
      role: "USER" as const,
      sessionVersion: 2,
      suspendedAt: new Date(),
    };
    const gate = deps({
      findUserByGithubId: async () => suspended,
      updateUser: async () => suspended,
    });
    const outcome = await applyGithubGate(success("sign-in"), gate, null);
    expect(outcome.session).toBeNull();
    expect(outcome.redirect).toBe("/login?error=suspended");
    expect(gate.link).not.toHaveBeenCalled();
  });

  it("does not attach a held install to a different GitHub account", () => {
    expect(
      pendingInstallMatches(
        { githubId: "7", email: "ada@example.com" },
        { githubUserId: "42", email: "ada@example.com" },
      ),
    ).toBe(false);
    expect(
      pendingInstallMatches(
        { githubId: null, email: "ada@example.com" },
        { githubUserId: "42", email: "Ada@Example.com" },
      ),
    ).toBe(true);
  });
});
