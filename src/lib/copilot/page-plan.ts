import { normalizeSlug, type PageDraft } from "@/lib/copilot/contract";
import type { Audience, HttpRoute, RepoFacts } from "@/lib/copilot/facts";

export type PageKind = "home" | "guide" | "concept" | "api" | "reference";

export type PlannedPage = {
  slug: string;
  section: string;
  title: string;
  description: string;
  navOrder: number;
  kind: PageKind;
  audience: Audience;
  sourcePaths: string[];
  routes: HttpRoute[];
};

const MAX_PAGES = 12;

export function planPagesFromFacts(input: {
  facts: RepoFacts;
  treePaths: string[];
}): PlannedPage[] {
  const facts = input.facts;
  const tree = new Set(input.treePaths);
  const pages: PlannedPage[] = [];
  const readme = facts.readmePath && tree.has(facts.readmePath) ? [facts.readmePath] : [];
  const manifest = input.treePaths.filter((path) => {
    const name = path.split("/").pop() ?? "";
    return name === "package.json" || name.endsWith(".env.example") || name === "schema.prisma";
  });

  pages.push({
    slug: "",
    section: "Introduction",
    title: facts.packageName ? titleFromPackage(facts.packageName) : "Overview",
    description: facts.packageDescription ?? "What this project does and where to start.",
    navOrder: 0,
    kind: "home",
    audience: facts.audience,
    sourcePaths: unique([...readme, ...manifest.slice(0, 3)]),
    routes: [],
  });

  pages.push({
    slug: "getting-started",
    section: "Guides",
    title: "Getting started",
    description: setupDescription(facts),
    navOrder: 10,
    kind: "guide",
    audience: facts.audience,
    sourcePaths: unique([...readme, ...manifest, ...facts.entryPoints.slice(0, 2)].filter((path) => tree.has(path) || manifest.includes(path))),
    routes: [],
  });

  if (facts.envVars.length > 0 || facts.schemaModels.length > 0) {
    pages.push({
      slug: "configuration",
      section: "Guides",
      title: "Configuration",
      description: "Environment variables and local setup.",
      navOrder: 20,
      kind: "guide",
      audience: facts.audience,
      sourcePaths: unique(manifest.filter((path) => path.endsWith(".env.example") || path.endsWith("schema.prisma") || path.endsWith("package.json"))),
      routes: [],
    });
  }

  if (facts.audience === "library") {
    pages.push({
      slug: "reference",
      section: "Reference",
      title: "Reference",
      description: "Exports and entry points.",
      navOrder: 30,
      kind: "reference",
      audience: facts.audience,
      sourcePaths: unique([...facts.entryPoints, facts.packageMain].filter((path): path is string => Boolean(path && tree.has(path)))).slice(0, 8),
      routes: [],
    });
  }

  if (facts.audience === "cli" || facts.binaries.length > 0) {
    pages.push({
      slug: "commands",
      section: "Guides",
      title: "Commands",
      description: "Commands from the package scripts and binaries.",
      navOrder: 30,
      kind: "guide",
      audience: "cli",
      sourcePaths: unique([...manifest, ...facts.binaries, ...facts.entryPoints].filter((path) => tree.has(path))).slice(0, 8),
      routes: [],
    });
  }

  pages.push(...apiPages(facts, tree));
  return pages.slice(0, MAX_PAGES);
}

export function mergePagePlan(input: {
  base: PlannedPage[];
  suggested: Array<Partial<PlannedPage> & { slug?: string; title?: string; sourcePaths?: string[] }>;
  treePaths: string[];
  facts: RepoFacts;
}): PlannedPage[] {
  const tree = new Set(input.treePaths);
  const bySlug = new Map(input.base.map((page) => [page.slug, page]));
  for (const raw of input.suggested) {
    const slug = normalizeSlug(raw.slug);
    if (slug === null) continue;
    if (bySlug.has(slug)) {
      const current = bySlug.get(slug)!;
      const extra = (raw.sourcePaths ?? []).filter((path) => tree.has(path));
      current.sourcePaths = unique([...current.sourcePaths, ...extra]).slice(0, 8);
      if (typeof raw.description === "string" && raw.description.trim()) {
        current.description = raw.description.trim().slice(0, 280);
      }
      continue;
    }
    if (bySlug.size >= MAX_PAGES) continue;
    const title = typeof raw.title === "string" ? raw.title.trim().slice(0, 120) : "";
    if (!title) continue;
    const sources = (raw.sourcePaths ?? []).filter((path) => tree.has(path)).slice(0, 8);
    if (sources.length === 0 && slug !== "") continue;
    const kind = raw.kind === "api" || raw.kind === "guide" || raw.kind === "concept" || raw.kind === "reference" || raw.kind === "home"
      ? raw.kind
      : "guide";
    bySlug.set(slug, {
      slug,
      section: kind === "api" || kind === "reference" ? "Reference" : "Guides",
      title,
      description: typeof raw.description === "string" ? raw.description.trim().slice(0, 280) : "",
      navOrder: typeof raw.navOrder === "number" ? raw.navOrder : 50 + bySlug.size,
      kind,
      audience: input.facts.audience,
      sourcePaths: sources,
      routes: [],
    });
  }
  return [...bySlug.values()].sort((a, b) => a.navOrder - b.navOrder || a.slug.localeCompare(b.slug)).slice(0, MAX_PAGES);
}

export function pagesAffectedByChange(input: {
  pages: PageDraft[];
  changedPaths: string[];
  removedPaths: string[];
  facts: RepoFacts;
}): PageDraft[] {
  const changed = new Set([...input.changedPaths, ...input.removedPaths]);
  if (changed.size === 0) return [];
  const routeTouched = [...changed].some((path) => /route\.(?:ts|tsx|js|jsx)$/.test(path) || /pages\/api\//.test(path) || path.endsWith("package.json") || path.endsWith(".env.example") || path.endsWith("schema.prisma") || /(^|\/)readme(\.[a-z0-9]+)?$/i.test(path));
  const selected: PageDraft[] = [];
  for (const page of input.pages) {
    const sources = readSourcePaths(page.content);
    const overlaps = sources.some((path) => changed.has(path));
    const apiPage = page.slug === "api-reference" || page.slug.startsWith("api-reference/");
    const setupPage = page.slug === "" || page.slug === "getting-started" || page.slug === "configuration" || page.slug === "commands";
    if (overlaps) {
      selected.push(page);
      continue;
    }
    if (apiPage && [...changed].some((path) => /route\.(?:ts|tsx|js|jsx)$/.test(path) || /pages\/api\//.test(path))) {
      selected.push(page);
      continue;
    }
    if (setupPage && routeTouched && [...changed].some((path) => path.endsWith("package.json") || path.endsWith(".env.example") || path.endsWith("schema.prisma") || /(^|\/)readme/i.test(path))) {
      selected.push(page);
    }
  }
  if (selected.length === 0 && input.facts.routes.length > 0 && [...changed].some((path) => /route\.(?:ts|tsx|js|jsx)$/.test(path))) {
    return input.pages.filter((page) => page.slug.startsWith("api-reference"));
  }
  return selected;
}

export function readSourcePaths(content: string): string[] {
  const match = content.match(/<!--\s*sources:\s*([^>]+?)\s*-->/);
  if (!match) return [];
  return match[1].split(/\s+/).filter(Boolean);
}

export function withSources(content: string, sources: string[]): string {
  const cleaned = content.replace(/\n*<!--\s*sources:[\s\S]*?-->\s*$/m, "").trim();
  const uniqueSources = unique(sources).slice(0, 12);
  if (uniqueSources.length === 0) return cleaned;
  return `${cleaned}\n\n<!-- sources: ${uniqueSources.join(" ")} -->`;
}

function apiPages(facts: RepoFacts, tree: Set<string>): PlannedPage[] {
  if (facts.routes.length === 0) return [];
  const groups = new Map<string, HttpRoute[]>();
  for (const route of facts.routes) {
    const parts = route.path.split("/").filter(Boolean);
    const key = parts[0] === "api" ? (parts[1] ?? "root") : (parts[0] ?? "root");
    const list = groups.get(key) ?? [];
    list.push(route);
    groups.set(key, list);
  }
  const sourcesFor = (routes: HttpRoute[]) =>
    unique(routes.map((route) => route.source)).filter((path) => tree.has(path)).slice(0, 8);

  if (facts.routes.length <= 12 || groups.size <= 1) {
    return [
      {
        slug: "api-reference",
        section: "Reference",
        title: "API reference",
        description: "HTTP routes exported by this repository.",
        navOrder: 40,
        kind: "api",
        audience: facts.audience,
        sourcePaths: sourcesFor(facts.routes),
        routes: facts.routes,
      },
    ];
  }

  const pages: PlannedPage[] = [
    {
      slug: "api-reference",
      section: "Reference",
      title: "API reference",
      description: "HTTP routes exported by this repository.",
      navOrder: 40,
      kind: "api",
      audience: facts.audience,
      sourcePaths: sourcesFor(facts.routes).slice(0, 4),
      routes: facts.routes,
    },
  ];
  const entries = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  let order = 41;
  for (const [key, routes] of entries) {
    if (pages.length >= 8) break;
    const slug = normalizeSlug(`api-reference/${key}`);
    if (!slug) continue;
    pages.push({
      slug,
      section: "Reference",
      title: titleFromSegment(key),
      description: `Routes under /${routes[0]?.path.split("/").filter(Boolean).slice(0, 2).join("/") ?? key}.`,
      navOrder: order,
      kind: "api",
      audience: facts.audience,
      sourcePaths: sourcesFor(routes),
      routes,
    });
    order += 1;
  }
  return pages;
}

export function factualPageContent(
  page: PlannedPage,
  facts: RepoFacts,
  repoFullName: string | null,
): { title: string; description: string; content: string } {
  const blocks: string[] = [];
  if (page.kind === "home") {
    const excerpt = facts.readmeExcerpt
      .split("\n")
      .filter((line) => line && !line.startsWith("#"))
      .slice(0, 2)
      .join(" ");
    blocks.push(facts.packageDescription ?? (excerpt || `${page.title} documentation.`));
    if (facts.routes.length > 0) {
      blocks.push(`## What you can call\n\n${facts.routes.slice(0, 8).map((route) => `- \`${route.method} ${route.path}\``).join("\n")}`);
    }
    if (facts.scripts.length > 0) {
      blocks.push(`## Scripts\n\n${facts.scripts.slice(0, 8).map((script) => `- \`${script.name}\`: \`${script.command}\``).join("\n")}`);
    }
  } else if (page.slug === "getting-started") {
    blocks.push("## Steps");
    const steps: string[] = [];
    if (repoFullName) steps.push(`Clone the repository.\n\n\`\`\`bash\ngit clone https://github.com/${repoFullName}.git\ncd ${repoFullName.split("/")[1] ?? repoFullName}\n\`\`\``);
    if (facts.scripts.length > 0 || facts.packageName) steps.push("Install dependencies.\n\n```bash\nnpm install\n```");
    if (facts.envVars.length > 0) {
      steps.push(`Create an environment file with:\n\n${facts.envVars.slice(0, 12).map((item) => `- \`${item.name}\``).join("\n")}`);
    }
    if (facts.schemaModels.length > 0) {
      const migrate = facts.scripts.find((script) => /migrate|db/.test(script.name));
      steps.push(
        migrate
          ? `Apply the database schema.\n\n\`\`\`bash\nnpm run ${migrate.name}\n\`\`\``
          : `This project stores data in: ${facts.schemaModels.map((model) => model.name).join(", ")}.`,
      );
    }
    const dev = facts.scripts.find((script) => script.name === "dev" || script.name === "start");
    if (dev) steps.push(`Start the project.\n\n\`\`\`bash\nnpm run ${dev.name}\n\`\`\``);
    blocks.push(steps.map((step, index) => `${index + 1}. ${step}`).join("\n\n"));
  } else if (page.slug === "configuration") {
    if (facts.envVars.length > 0) {
      blocks.push(`## Environment\n\n${facts.envVars.map((item) => `- \`${item.name}\` from \`${item.source}\`${item.example ? `: \`${item.example}\`` : ""}`).join("\n")}`);
    }
    if (facts.schemaModels.length > 0) {
      blocks.push(`## Data\n\n${facts.schemaModels.map((model) => `- \`${model.name}\`: ${model.fields.slice(0, 8).join(", ")}`).join("\n")}`);
    }
  } else if (page.kind === "api") {
    const routes = page.routes.length > 0 ? page.routes : facts.routes;
    blocks.push("## Routes\n\n| Method | Path | Source |\n| --- | --- | --- |\n" + routes.map((route) => `| ${route.method} | \`${route.path}\` | \`${route.source}\` |`).join("\n"));
  } else if (page.slug === "commands") {
    blocks.push(facts.scripts.map((script) => `## \`${script.name}\`\n\n\`\`\`bash\nnpm run ${script.name}\n\`\`\`\n\n\`${script.command}\``).join("\n\n"));
  } else {
    blocks.push(facts.packageDescription ?? page.description);
    if (page.sourcePaths.length > 0) {
      blocks.push(`## Source\n\n${page.sourcePaths.map((path) => `- \`${path}\``).join("\n")}`);
    }
  }
  const content = withSources(blocks.filter(Boolean).join("\n\n"), page.sourcePaths);
  return {
    title: page.title,
    description: page.description,
    content,
  };
}

function titleFromPackage(name: string): string {
  const bare = name.split("/").pop() ?? name;
  return bare
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function titleFromSegment(key: string): string {
  if (key === "root") return "API routes";
  return titleFromPackage(key);
}

function setupDescription(facts: RepoFacts): string {
  if (facts.audience === "cli") return "Install the CLI and run the first command.";
  if (facts.audience === "library") return "Install the package and make the first call.";
  return "Clone, configure, and run the app locally.";
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}
