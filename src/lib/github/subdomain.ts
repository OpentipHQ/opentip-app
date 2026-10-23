import { RESERVED_SUBDOMAINS } from "@/lib/sites/host";

export function slugLabel(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63)
    .replace(/-+$/g, "");
  if (slug.length < 2) return "";
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(slug)) return "";
  return slug;
}

export function subdomainCandidates(owner: string, name: string, githubRepoId: string): string[] {
  const base = slugLabel(`${owner}-${name}`);
  const id = githubRepoId.replace(/\D/g, "").slice(-8);
  const suffixed = slugLabel(`${base || "repo"}-${id || "2"}`);
  const idOnly = slugLabel(`r${id || "2"}`);
  const ordered: string[] = [];
  for (const candidate of [base, suffixed, idOnly]) {
    if (!candidate || RESERVED_SUBDOMAINS.has(candidate) || ordered.includes(candidate)) continue;
    ordered.push(candidate);
  }
  return ordered;
}
