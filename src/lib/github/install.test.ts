import { describe, expect, it, vi } from "vitest";
import {
  installationFromApi,
  listInstallationRepositories,
  nextGithubPage,
  readUserInstallation,
  repoSeedFromApi,
} from "@/lib/github/install";
import { linkInstallationRecords, type InstallationStore } from "@/lib/github/link-installation";
import { subdomainCandidates } from "@/lib/github/subdomain";

function jsonResponse(body: unknown, status = 200, link: string | null = null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: link ? { link } : undefined,
  });
}

describe("installation API", () => {
  it("accepts an installation only when the id matches the requested one", () => {
    expect(
      installationFromApi("99", { id: 99, account: { login: "ada", type: "User" } }),
    ).toEqual({
      githubInstallationId: "99",
      accountLogin: "ada",
      accountType: "User",
      accountAvatarUrl: null,
    });
    expect(installationFromApi("99", { id: 100, account: { login: "ada", type: "User" } })).toBeNull();
    expect(installationFromApi("99", { id: 99 })).toBeNull();
  });

  it("accepts a personal install and an org install a member can access", async () => {
    const fetcher = vi.fn(async (url: string | URL | Request) => {
      expect(String(url)).toBe("https://api.github.com/user/installations?per_page=100");
      return jsonResponse({
        installations: [
          { id: 7, account: { login: "ada", type: "User" } },
          { id: 99, account: { login: "Opentip", type: "Organization" } },
        ],
      });
    });
    await expect(readUserInstallation("7", "token", fetcher as typeof fetch)).resolves.toEqual({
      githubInstallationId: "7",
      accountLogin: "ada",
      accountType: "User",
      accountAvatarUrl: null,
    });
    await expect(readUserInstallation("99", "token", fetcher as typeof fetch)).resolves.toEqual({
      githubInstallationId: "99",
      accountLogin: "Opentip",
      accountType: "Organization",
      accountAvatarUrl: null,
    });
  });

  it("blocks an org install that is absent from the user's list", async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({
        installations: [{ id: 7, account: { login: "ada", type: "User" } }],
      }),
    );
    await expect(readUserInstallation("99", "token", fetcher as typeof fetch)).resolves.toBeNull();
    const denied = vi.fn(async () => jsonResponse({ message: "Not Found" }, 404));
    await expect(readUserInstallation("99", "token", denied as typeof fetch)).resolves.toBeNull();
  });

  it("follows later pages to find an org install", async () => {
    const fetcher = vi.fn(async (url: string | URL | Request) => {
      if (String(url).includes("page=2")) {
        return jsonResponse({
          installations: [{ id: 99, account: { login: "Opentip", type: "Organization" } }],
        });
      }
      return jsonResponse(
        { installations: [{ id: 7, account: { login: "ada", type: "User" } }] },
        200,
        '<https://api.github.com/user/installations?per_page=100&page=2>; rel="next"',
      );
    });
    await expect(readUserInstallation("99", "token", fetcher as typeof fetch)).resolves.toEqual({
      githubInstallationId: "99",
      accountLogin: "Opentip",
      accountType: "Organization",
      accountAvatarUrl: null,
    });
    await expect(readUserInstallation("404", "token", fetcher as typeof fetch)).resolves.toBeNull();
  });

  it("follows only GitHub API next links and skips incomplete repos", async () => {
    expect(
      nextGithubPage('<https://api.github.com/user/installations/99/repositories?page=2>; rel="next"'),
    ).toBe("https://api.github.com/user/installations/99/repositories?page=2");
    expect(nextGithubPage('<https://evil.example/next>; rel="next"')).toBeNull();
    expect(repoSeedFromApi({ id: 7, name: "docs", full_name: "ada/docs", owner: { login: "ada" } })).toMatchObject({
      githubRepoId: "7",
      owner: "ada",
      name: "docs",
    });
    expect(repoSeedFromApi({ id: "nope", name: "docs" })).toBeNull();

    const fetcher = vi.fn(async (url: string | URL | Request) => {
      if (String(url).includes("page=2")) {
        return jsonResponse({
          repositories: [{ id: 8, name: "site", full_name: "ada/site", private: true, owner: { login: "ada" } }],
        });
      }
      return jsonResponse(
        { repositories: [{ id: 7, name: "docs", full_name: "ada/docs", owner: { login: "ada" } }, { id: 1 }] },
        200,
        '<https://api.github.com/user/installations/99/repositories?per_page=100&page=2>; rel="next"',
      );
    });
    const repos = await listInstallationRepositories("99", "token", fetcher as typeof fetch);
    expect(repos.map((repo) => repo.githubRepoId)).toEqual(["7", "8"]);
    expect(repos[1]?.private).toBe(true);
  });
});

describe("install sites", () => {
  it("builds a subdomain from the owner and repo, skipping reserved labels", () => {
    expect(subdomainCandidates("Ada", "Docs", "987654321")).toEqual([
      "ada-docs",
      "ada-docs-87654321",
      "r87654321",
    ]);
    expect(subdomainCandidates("api", "", "12")).toEqual(["api-12", "r12"]);
  });

  it("stores the installation and repos without creating sites", async () => {
    const saved: string[] = [];
    let installationUser = "";
    const store: InstallationStore = {
      async saveInstallation(input) {
        installationUser = input.userId;
        return { id: "inst_1" };
      },
      async saveRepo(input) {
        saved.push(`${input.installationId}:${input.githubRepoId}`);
        return { id: `repo_${input.githubRepoId}` };
      },
    };
    const created = await linkInstallationRecords(store, {
      userId: "user_1",
      installation: { githubInstallationId: "99", accountLogin: "ada", accountType: "User" },
      repos: [
        {
          githubRepoId: "7",
          owner: "ada",
          name: "docs",
          fullName: "ada/docs",
          private: false,
          defaultBranch: "main",
          archived: false,
        },
        {
          githubRepoId: "2",
          owner: "ada",
          name: "old",
          fullName: "ada/old",
          private: false,
          defaultBranch: "main",
          archived: false,
        },
      ],
    });
    expect(created).toEqual({ sitesCreated: 0 });
    expect(installationUser).toBe("user_1");
    expect(saved).toEqual(["inst_1:7", "inst_1:2"]);
  });
});
