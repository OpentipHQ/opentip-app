import type { PageDraft } from "@/lib/copilot/contract";
import {
  knownEnvNames,
  knownScriptNames,
  routesMatch,
  type RepoFacts,
} from "@/lib/copilot/facts";

export type ViolationKind = "route" | "env" | "command" | "file" | "link";

export type Violation = {
  kind: ViolationKind;
  value: string;
};

const SHELL_BUILTINS = new Set([
  "PATH",
  "HOME",
  "USER",
  "PWD",
  "SHELL",
  "CI",
  "NODE_ENV",
  "npm_config_user_agent",
  "TERM",
  "TMPDIR",
  "LANG",
]);

const ALWAYS_OK_SCRIPTS = new Set(["install", "ci"]);

export function verifyPage(
  content: string,
  facts: RepoFacts,
  treePaths: string[],
): Violation[] {
  const violations: Violation[] = [];
  const seen = new Set<string>();
  const push = (kind: ViolationKind, value: string) => {
    const key = `${kind}:${value}`;
    if (seen.has(key)) return;
    seen.add(key);
    violations.push({ kind, value });
  };

  for (const mention of mentionedRoutes(content)) {
    const known = facts.routes.some((route) => {
      if (!routesMatch(route.path, mention.path)) return false;
      if (route.method === "ANY" || mention.method === "ANY") return true;
      return route.method === mention.method;
    });
    if (!known) push("route", `${mention.method} ${mention.path}`);
  }

  const envNames = knownEnvNames(facts);
  for (const name of mentionedEnv(content)) {
    if (!envNames.has(name)) push("env", name);
  }

  const scripts = knownScriptNames(facts);
  const hasPackage = treePaths.some((path) => path.split("/").pop() === "package.json") || facts.scripts.length > 0;
  for (const script of mentionedScripts(content)) {
    if (ALWAYS_OK_SCRIPTS.has(script) && hasPackage) continue;
    if (!scripts.has(script)) push("command", script);
  }

  const tree = new Set(treePaths);
  for (const path of mentionedFiles(content)) {
    if (!tree.has(path) && !tree.has(path.replace(/^\.\//, ""))) push("file", path);
  }

  return violations;
}

export function mentionedRoutes(content: string): Array<{ method: string; path: string }> {
  const found: Array<{ method: string; path: string }> = [];
  const seen = new Set<string>();
  const add = (method: string, path: string) => {
    const clean = path.replace(/[.,);:]+$/, "");
    if (!clean.startsWith("/")) return;
    const key = `${method} ${clean}`;
    if (seen.has(key)) return;
    seen.add(key);
    found.push({ method, path: clean });
  };
  for (const match of content.matchAll(
    /\b(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+`?(\/[A-Za-z0-9_./:[\]*?{}-]+)`?/g,
  )) {
    add(match[1], match[2]);
  }
  for (const match of content.matchAll(/`((?:\/api)\/[A-Za-z0-9_./:[\]*?{}-]+)`/g)) {
    add("ANY", match[1]);
  }
  return found;
}

export function mentionedEnv(content: string): string[] {
  const names = new Set<string>();
  for (const match of content.matchAll(/process\.env\.([A-Z][A-Z0-9_]{1,80})/g)) {
    names.add(match[1]);
  }
  for (const match of content.matchAll(/process\.env\[\s*['"]([A-Z][A-Z0-9_]{1,80})['"]\s*\]/g)) {
    names.add(match[1]);
  }
  const fenced = content.split(/```/);
  for (let index = 1; index < fenced.length; index += 2) {
    const block = fenced[index] ?? "";
    const lang = block.slice(0, block.indexOf("\n")).toLowerCase();
    if (!/^(?:bash|sh|shell|zsh|env|dotenv|text)?$/.test(lang.trim()) && !lang.includes("bash") && !lang.includes("sh")) {
      continue;
    }
    for (const match of block.matchAll(/\$\{?([A-Z][A-Z0-9_]{2,80})\}?/g)) {
      if (!SHELL_BUILTINS.has(match[1])) names.add(match[1]);
    }
    for (const match of block.matchAll(/^\s*([A-Z][A-Z0-9_]{2,80})=/gm)) {
      names.add(match[1]);
    }
  }
  return [...names];
}

export function mentionedScripts(content: string): string[] {
  const names = new Set<string>();
  for (const match of content.matchAll(/\b(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?([a-z][a-z0-9:_-]*)/gi)) {
    const name = match[1].toLowerCase();
    if (["run", "exec", "create", "init", "add", "rm", "remove", "x"].includes(name)) continue;
    names.add(name);
  }
  return [...names];
}

export function mentionedFiles(content: string): string[] {
  const paths = new Set<string>();
  for (const match of content.matchAll(/`((?:\.?\/)?(?:[A-Za-z0-9_.-]+\/)+[A-Za-z0-9_.@-]+\.[A-Za-z0-9]+)`/g)) {
    const path = match[1].replace(/^\.\//, "");
    if (path.length > 180) continue;
    paths.add(path);
  }
  for (const match of content.matchAll(/`(\.[A-Za-z0-9_.-]+(?:\.[A-Za-z0-9]+)?|package\.json|schema\.prisma)`/g)) {
    paths.add(match[1]);
  }
  return [...paths];
}

export type LinkRepair = {
  pages: PageDraft[];
  removedLinks: string[];
};

export function repairSiteLinks(pages: PageDraft[]): LinkRepair {
  const slugs = new Set(pages.map((page) => page.slug));
  const removedLinks: string[] = [];
  const next = pages.map((page) => {
    const content = page.content.replace(
      /\[([^\]]+)\]\(([^)\s]+)\)/g,
      (full, label: string, href: string) => {
        if (!isInternalDocLink(href)) return full;
        const slug = slugFromHref(href, page.slug);
        if (slug === null) return full;
        if (href.startsWith("/api/") || href === "/api") {
          removedLinks.push(href);
          return `\`${label}\``;
        }
        if (slugs.has(slug)) return full;
        removedLinks.push(href);
        return label;
      },
    );
    return { ...page, content };
  });
  return { pages: next, removedLinks };
}

export function isInternalDocLink(href: string): boolean {
  if (!href || href.startsWith("#")) return false;
  if (/^[a-z]+:/i.test(href)) return false;
  if (href.startsWith("//")) return false;
  return href.startsWith("/") || href.startsWith("./") || href.startsWith("../") || !href.includes("/");
}

export function slugFromHref(href: string, currentSlug: string): string | null {
  const withoutHash = href.split("#")[0]?.split("?")[0] ?? "";
  if (!withoutHash || withoutHash === "/") return "";
  if (withoutHash.startsWith("/")) {
    return withoutHash.replace(/^\/+|\/+$/g, "");
  }
  const base = currentSlug.split("/").slice(0, -1);
  const parts = withoutHash.split("/");
  for (const part of parts) {
    if (part === "." || part === "") continue;
    if (part === "..") base.pop();
    else base.push(part);
  }
  return base.join("/");
}
