export const RESERVED_SUBDOMAINS = new Set([
  "www",
  "beta",
  "app",
  "api",
  "admin",
  "mail",
  "status",
  "docs",
  "cdn",
  "assets",
  "static",
]);

export type HostDecision =
  | { kind: "app" }
  | { kind: "docs"; subdomain: string }
  | { kind: "custom"; host: string };

export function normalizeHost(hostHeader: string): string {
  return hostHeader.trim().toLowerCase().replace(/:\d+$/, "");
}

export function resolveHost(
  hostHeader: string,
  options: { appHosts: string[]; docsRootDomain: string },
): HostDecision {
  const host = normalizeHost(hostHeader);
  const appHosts = new Set(options.appHosts.map(normalizeHost));
  const docsRoot = normalizeHost(options.docsRootDomain);
  if (!host || appHosts.has(host) || host === docsRoot || host === `www.${docsRoot}`) {
    return { kind: "app" };
  }

  for (const appHost of appHosts) {
    if (!appHost || appHost === "localhost" || appHost === "127.0.0.1") continue;
    const suffix = `.${appHost}`;
    if (host.endsWith(suffix)) {
      const subdomain = host.slice(0, -suffix.length);
      if (isSubdomain(subdomain)) return { kind: "docs", subdomain };
    }
  }

  const docsSuffix = `.${docsRoot}`;
  if (docsRoot && host.endsWith(docsSuffix)) {
    const subdomain = host.slice(0, -docsSuffix.length);
    if (isSubdomain(subdomain) && !RESERVED_SUBDOMAINS.has(subdomain)) {
      return { kind: "docs", subdomain };
    }
    return { kind: "app" };
  }

  if (host === "localhost" || host === "127.0.0.1") return { kind: "app" };
  return { kind: "custom", host };
}

function isSubdomain(value: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(value);
}

export type ProxyDecision =
  | { kind: "next" }
  | { kind: "rewrite"; pathname: string; publicHost: string }
  | { kind: "protect"; area: "dashboard" | "admin" };

export function decideProxy(input: {
  host: string;
  pathname: string;
  appHosts: string[];
  docsRootDomain: string;
}): ProxyDecision {
  if (
    input.pathname.startsWith("/_next") ||
    input.pathname.startsWith("/api") ||
    input.pathname === "/favicon.ico" ||
    input.pathname === "/icon.svg"
  ) {
    return { kind: "next" };
  }

  const resolved = resolveHost(input.host, {
    appHosts: input.appHosts,
    docsRootDomain: input.docsRootDomain,
  });
  const publicHost = normalizeHost(input.host);

  if (resolved.kind === "docs") {
    const suffix = input.pathname === "/" ? "" : input.pathname;
    return {
      kind: "rewrite",
      pathname: `/sites/${resolved.subdomain}${suffix}`,
      publicHost,
    };
  }

  if (resolved.kind === "custom") {
    const suffix = input.pathname === "/" ? "" : input.pathname;
    return {
      kind: "rewrite",
      pathname: `/sites/domain/${resolved.host}${suffix}`,
      publicHost,
    };
  }

  if (input.pathname === "/admin" || input.pathname.startsWith("/admin/")) {
    return { kind: "protect", area: "admin" };
  }
  if (
    input.pathname === "/dashboard" ||
    input.pathname.startsWith("/dashboard/")
  ) {
    return { kind: "protect", area: "dashboard" };
  }
  return { kind: "next" };
}
