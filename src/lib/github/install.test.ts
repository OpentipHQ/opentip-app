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
    });
    expect(installationFromApi("99", { id: 100, account: { login: "ada", type: "User" } })).toBeNull();
    expect(installationFromApi("99", { id: 99 })).toBeNull();
  });

  it("reads the installation with the user token and treats 404 as inaccessible", async () => {
    const fetcher = vi.fn(async (url: string | URL | Request) => {
      expect(String(url)).toBe("https://api.github.com/user/installations/99");
      return jsonResponse({ id: 99, account: { login: "acme", type: "Organization" } });
    });
    await expect(readUserInstallation("99", "token", fetcher as typeof fetch)).resolves.toEqual({
      githubInstallationId: "99",
      accountLogin: "acme",
      accountType: "Organization",
    });
    const denied = vi.fn(async () => jsonResponse({ message: "Not Found" }, 404));
    await expect(readUserInstallation("99", "token", denied as typeof fetch)).resolves.toBeNull();
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

  it("creates a site for a new repo and skips one that already has a site", async () => {
    const sites: string[] = [];
    const store: InstallationStore = {
      async saveInstallation() {
        return { id: "inst_1" };
      },
      async saveRepo(input) {
        return { id: `repo_${input.githubRepoId}`, hasSite: input.githubRepoId === "2" };
      },
      async saveSite(input) {
        if (input.subdomain === "ada-docs") return "taken";
        sites.push(input.subdomain);
        return "created";
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
    expect(created).toEqual({ sitesCreated: 1 });
    expect(sites).toEqual(["ada-docs-7"]);
  });
});
