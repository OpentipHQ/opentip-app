import { describe, expect, it, vi } from "vitest";
import type { GithubUser } from "@/lib/github/app";
import type { RepoSeed, VerifiedInstallation } from "@/lib/github/install";
import {
  classifyOauthCallback,
  completeOauthCallback,
  readInstallationId,
  type OauthCallbackInput,
} from "@/lib/github/oauth-callback";

const profile: GithubUser = {
  id: "42",
  login: "ada",
  name: "Ada",
  email: "ada@example.com",
  avatarUrl: null,
};

const installation: VerifiedInstallation = {
  githubInstallationId: "99",
  accountLogin: "ada",
  accountType: "User",
};

const repo: RepoSeed = {
  githubRepoId: "7",
  owner: "ada",
  name: "docs",
  fullName: "ada/docs",
  private: false,
  defaultBranch: "main",
  archived: false,
};

function input(overrides: Partial<OauthCallbackInput> = {}): OauthCallbackInput {
  return {
    code: "code-1",
    state: "nonce-1",
    installationId: null,
    setupAction: null,
    pendingUserId: "nonce-1",
    pendingInvite: null,
    hasSecret: true,
    ...overrides,
  };
}

describe("GitHub OAuth callback", () => {
  it("keeps the sign-in button flow when the state cookie matches", () => {
    expect(
      classifyOauthCallback({
        hasCode: true,
        stateMatches: true,
        installationId: null,
        setupAction: null,
      }),
    ).toBe("sign-in");
  });

  it("treats GitHub's install redirect as an install when our state cookie is absent", () => {
    expect(readInstallationId("99")).toBe("99");
    expect(readInstallationId("nope")).toBeNull();
    expect(
      classifyOauthCallback({
        hasCode: true,
        stateMatches: false,
        installationId: "99",
        setupAction: "install",
      }),
    ).toBe("install");
    expect(
      classifyOauthCallback({
        hasCode: true,
        stateMatches: false,
        installationId: "99",
        setupAction: "update",
      }),
    ).toBe("install");
  });

  it("rejects a code with no state and no installation", () => {
    expect(
      classifyOauthCallback({
        hasCode: true,
        stateMatches: false,
        installationId: null,
        setupAction: "install",
      }),
    ).toBe("reject");
    expect(
      classifyOauthCallback({
        hasCode: false,
        stateMatches: false,
        installationId: "99",
        setupAction: "install",
      }),
    ).toBe("reject");
  });

  it("uses the sign-in flow when the state cookie matches, even on an install redirect", () => {
    expect(
      classifyOauthCallback({
        hasCode: true,
        stateMatches: true,
        installationId: "99",
        setupAction: "install",
      }),
    ).toBe("sign-in");
  });

  it("signs in from the install redirect only after GitHub confirms the installation", async () => {
    const exchange = vi.fn(async () => ({ profile, accessToken: "user-token" }));
    const readInstallation = vi.fn(async () => installation);
    const listRepos = vi.fn(async () => [repo]);
    const result = await completeOauthCallback(
      input({ state: null, pendingUserId: null, installationId: "99", setupAction: "install" }),
      { exchange, readInstallation, listRepos },
    );
    expect(result).toMatchObject({
      ok: true,
      flow: "install",
      inviteToken: null,
      installation,
      repos: [repo],
    });
    expect(readInstallation).toHaveBeenCalledWith("99", "user-token");
  });

  it("refuses the install redirect when the token cannot access that installation", async () => {
    const exchange = vi.fn(async () => ({ profile, accessToken: "user-token" }));
    const readInstallation = vi.fn(async () => null);
    const listRepos = vi.fn(async () => [repo]);
    const result = await completeOauthCallback(
      input({
        state: "someone-else",
        pendingUserId: "nonce-1",
        pendingInvite: "invite-token-value1",
        installationId: "99",
        setupAction: "install",
      }),
      { exchange, readInstallation, listRepos },
    );
    expect(result).toEqual({ ok: false, error: "installation" });
    expect(listRepos).not.toHaveBeenCalled();
  });

  it("does not exchange a code when the sign-in state does not match and this is not an install", async () => {
    const exchange = vi.fn(async () => ({ profile, accessToken: "user-token" }));
    const result = await completeOauthCallback(input({ pendingUserId: "other" }), {
      exchange,
      readInstallation: vi.fn(),
      listRepos: vi.fn(),
    });
    expect(result).toEqual({ ok: false, error: "state" });
    expect(exchange).not.toHaveBeenCalled();
  });

  it("keeps a matching sign-in session when installation lookup fails", async () => {
    const result = await completeOauthCallback(input({ installationId: "99", setupAction: "install" }), {
      exchange: async () => ({ profile, accessToken: "user-token" }),
      readInstallation: async () => null,
      listRepos: async () => {
        throw new Error("should not list");
      },
    });
    expect(result).toMatchObject({ ok: true, flow: "sign-in", installation: null, repos: [] });
  });
});
