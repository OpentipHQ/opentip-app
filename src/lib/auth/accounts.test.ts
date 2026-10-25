import { describe, expect, it } from "vitest";
import { decideAccountLink, loginFromEmail, type ExistingUser } from "@/lib/auth/accounts";

function user(overrides: Partial<ExistingUser> = {}): ExistingUser {
  return {
    id: "user_1",
    githubId: null,
    login: "ada",
    name: "Ada",
    email: "ada@example.com",
    avatarUrl: null,
    role: "USER",
    sessionVersion: 0,
    suspendedAt: null,
    ...overrides,
  };
}

describe("account linking", () => {
  it("links GitHub onto an email-only account when the emails match", () => {
    const decision = decideAccountLink({
      profile: {
        githubId: "42",
        login: "ada",
        name: "Ada Lovelace",
        email: "Ada@Example.com",
        avatarUrl: null,
      },
      byGithub: null,
      byEmail: user(),
    });
    expect(decision).toMatchObject({
      kind: "update",
      id: "user_1",
      data: { githubId: "42", email: "ada@example.com", login: "ada" },
    });
  });

  it("keeps one account when an email code matches a GitHub user", () => {
    const decision = decideAccountLink({
      profile: {
        githubId: null,
        login: "ada",
        name: null,
        email: "ada@example.com",
        avatarUrl: null,
      },
      byGithub: null,
      byEmail: user({ githubId: "42", login: "ada-gh" }),
    });
    expect(decision).toMatchObject({
      kind: "update",
      id: "user_1",
      data: { githubId: "42", login: "ada-gh" },
    });
  });

  it("keeps a changed profile email and display name on GitHub sign-in", () => {
    const decision = decideAccountLink({
      profile: {
        githubId: "42",
        login: "ada-gh",
        name: "Ada GitHub",
        email: "old@github.com",
        avatarUrl: null,
      },
      byGithub: user({ githubId: "42", login: "ada-gh" }),
      byEmail: null,
    });
    expect(decision).toMatchObject({
      kind: "update",
      id: "user_1",
      data: {
        githubId: "42",
        login: "ada-gh",
        name: "Ada",
        email: "ada@example.com",
      },
    });
  });

  it("refuses to attach an email that already belongs to another GitHub account", () => {
    const decision = decideAccountLink({
      profile: {
        githubId: "99",
        login: "grace",
        name: null,
        email: "ada@example.com",
        avatarUrl: null,
      },
      byGithub: null,
      byEmail: user({ githubId: "42" }),
    });
    expect(decision.kind).toBe("conflict");
  });

  it("creates an email-only account when nothing matches", () => {
    const decision = decideAccountLink({
      profile: {
        githubId: null,
        login: loginFromEmail("ada@example.com"),
        name: null,
        email: "ada@example.com",
        avatarUrl: null,
      },
      byGithub: null,
      byEmail: null,
    });
    expect(decision).toMatchObject({ kind: "create", data: { githubId: null, login: "ada" } });
  });
});
