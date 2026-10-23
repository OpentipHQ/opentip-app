import { githubApiHeaders } from "@/lib/github/app";

export type VerifiedInstallation = {
  githubInstallationId: string;
  accountLogin: string;
  accountType: string;
};

export type RepoSeed = {
  githubRepoId: string;
  owner: string;
  name: string;
  fullName: string;
  private: boolean;
  defaultBranch: string;
  archived: boolean;
};

export function installationFromApi(
  installationId: string,
  value: unknown,
): VerifiedInstallation | null {
  if (!value || typeof value !== "object") return null;
  const body = value as { id?: unknown; account?: { login?: unknown; type?: unknown } };
  const id = body.id;
  const got = typeof id === "number" ? String(id) : typeof id === "string" ? id : "";
  if (got !== installationId) return null;
  const login = body.account?.login;
  if (typeof login !== "string" || login.length === 0) return null;
  const accountType = body.account?.type;
  return {
    githubInstallationId: installationId,
    accountLogin: login,
    accountType: typeof accountType === "string" && accountType ? accountType : "User",
  };
}

export function repoSeedFromApi(value: unknown): RepoSeed | null {
  if (!value || typeof value !== "object") return null;
  const repo = value as {
    id?: unknown;
    name?: unknown;
    full_name?: unknown;
    private?: unknown;
    default_branch?: unknown;
    archived?: unknown;
    owner?: { login?: unknown };
  };
  const githubRepoId =
    typeof repo.id === "number" ? String(repo.id) : typeof repo.id === "string" ? repo.id : "";
  if (!/^[0-9]+$/.test(githubRepoId)) return null;
  const name = typeof repo.name === "string" ? repo.name : "";
  const fullName = typeof repo.full_name === "string" ? repo.full_name : "";
  const ownerLogin = typeof repo.owner?.login === "string" ? repo.owner.login : "";
  const owner = ownerLogin || fullName.split("/")[0] || "";
  if (!name || !owner) return null;
  return {
    githubRepoId,
    owner,
    name,
    fullName: fullName || `${owner}/${name}`,
    private: repo.private === true,
    defaultBranch:
      typeof repo.default_branch === "string" && repo.default_branch ? repo.default_branch : "main",
    archived: repo.archived === true,
  };
}

export function nextGithubPage(link: string | null): string | null {
  if (!link) return null;
  for (const part of link.split(",")) {
    const match = part.match(/<([^>]+)>;\s*rel="next"/);
    const url = match?.[1];
    if (url?.startsWith("https://api.github.com/")) return url;
  }
  return null;
}

export async function readUserInstallation(
  installationId: string,
  accessToken: string,
  fetcher: typeof fetch = fetch,
): Promise<VerifiedInstallation | null> {
  const response = await fetcher(
    `https://api.github.com/user/installations/${installationId}`,
    { headers: githubApiHeaders(accessToken) },
  );
  if (!response.ok) return null;
  return installationFromApi(installationId, await response.json());
}

export async function listInstallationRepositories(
  installationId: string,
  accessToken: string,
  fetcher: typeof fetch = fetch,
): Promise<RepoSeed[]> {
  const repos: RepoSeed[] = [];
  let url: string | null =
    `https://api.github.com/user/installations/${installationId}/repositories?per_page=100`;
  for (let page = 0; page < 3 && url; page += 1) {
    const response = await fetcher(url, { headers: githubApiHeaders(accessToken) });
    if (!response.ok) break;
    const body = (await response.json()) as { repositories?: unknown[] };
    for (const repo of body.repositories ?? []) {
      const seed = repoSeedFromApi(repo);
      if (seed) repos.push(seed);
    }
    url = nextGithubPage(response.headers.get("link"));
  }
  return repos;
}
