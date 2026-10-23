type Env = Record<string, string | undefined>;

export function appUrl(env: Env = process.env): string {
  return (env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function docsRootDomain(env: Env = process.env): string {
  return (env.DOCS_ROOT_DOMAIN || "opentip.tech").toLowerCase();
}

export function appHosts(env: Env = process.env): string[] {
  let fromApp = "beta.opentip.tech";
  try {
    fromApp = new URL(appUrl(env)).host;
  } catch {
    fromApp = "beta.opentip.tech";
  }
  return Array.from(new Set([fromApp, "beta.opentip.tech", "localhost", "127.0.0.1"]));
}

export function sessionSecret(env: Env = process.env): string | null {
  if (env.SESSION_SECRET) return env.SESSION_SECRET;
  if (env.NODE_ENV !== "production") return "dev-session-secret";
  return null;
}

export function ogSecret(env: Env = process.env): string | null {
  if (env.OG_SIGNING_SECRET) return env.OG_SIGNING_SECRET;
  if (env.NODE_ENV !== "production") return "dev-og-secret";
  return null;
}

export function showPlanPrices(env: Env = process.env): boolean {
  return env.SHOW_PLAN_PRICES === "1";
}

export function githubAppSlug(env: Env = process.env): string {
  const slug = (env.GITHUB_APP_SLUG || "opentip-copilot").trim().toLowerCase();
  return slug || "opentip-copilot";
}

export function githubAppInstallUrl(env: Env = process.env): string {
  return `https://github.com/apps/${githubAppSlug(env)}/installations/new`;
}
