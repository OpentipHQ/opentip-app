import { describe, expect, it } from "vitest";
import type { PageDraft } from "@/lib/copilot/contract";
import type { RepoFacts } from "@/lib/copilot/facts";
import { repairSiteLinks, verifyPage } from "@/lib/copilot/verify";

const facts: RepoFacts = {
  audience: "app",
  packageName: "plugr",
  packageDescription: null,
  packageMain: null,
  binaries: [],
  routes: [
    { method: "GET", path: "/api/providers", source: "src/app/api/providers/route.ts" },
    { method: "POST", path: "/api/providers", source: "src/app/api/providers/route.ts" },
    { method: "GET", path: "/api/users/:id", source: "src/app/api/users/[id]/route.ts" },
  ],
  envVars: [
    { name: "DATABASE_URL", source: ".env.example", example: "postgres://localhost/plugr" },
  ],
  scripts: [
    { name: "dev", command: "next dev" },
    { name: "migrate", command: "prisma migrate deploy" },
  ],
  schemaModels: [],
  entryPoints: [],
  readmePath: "README.md",
  readmeExcerpt: "",
};

const tree = [
  "package.json",
  "README.md",
  ".env.example",
  "src/app/api/providers/route.ts",
  "src/app/api/users/[id]/route.ts",
];

describe("page verification", () => {
  it("rejects invented routes, env vars, commands, and files", () => {
    const content = [
      "Rank providers with `POST /api/score`.",
      "Set `process.env.SECRET_KEY` before boot.",
      "Run `npm run seed`.",
      "Edit `src/lib/missing.ts`.",
    ].join("\n");
    const violations = verifyPage(content, facts, tree);
    expect(violations).toEqual(
      expect.arrayContaining([
        { kind: "route", value: "POST /api/score" },
        { kind: "env", value: "SECRET_KEY" },
        { kind: "command", value: "seed" },
        { kind: "file", value: "src/lib/missing.ts" },
      ]),
    );
  });

  it("accepts routes, env vars, and commands that exist", () => {
    const content = [
      "Call `GET /api/providers` or `GET /api/users/[id]`.",
      "Set `process.env.DATABASE_URL` from `.env.example`.",
      "Run `npm install` and `npm run dev`, then `npm run migrate`.",
      "The handler lives in `src/app/api/providers/route.ts`.",
    ].join("\n");
    expect(verifyPage(content, facts, tree)).toEqual([]);
  });
});

describe("link check", () => {
  it("drops links to pages that are not in the plan and keeps real ones", () => {
    const pages: PageDraft[] = [
      {
        slug: "",
        section: "Introduction",
        title: "Home",
        description: null,
        navOrder: 0,
        content: "Read the [API reference](/api-reference) and the [guide](/getting-started).",
      },
      {
        slug: "getting-started",
        section: "Guides",
        title: "Getting started",
        description: null,
        navOrder: 10,
        content: "Back [home](/).",
      },
    ];
    const repaired = repairSiteLinks(pages);
    expect(repaired.removedLinks).toContain("/api-reference");
    expect(repaired.pages[0]?.content).toContain("API reference");
    expect(repaired.pages[0]?.content).not.toContain("](/api-reference)");
    expect(repaired.pages[0]?.content).toContain("](/getting-started)");
    expect(repaired.pages[1]?.content).toContain("](/)");
  });

  it("turns endpoint links into code so the docs host does not 404 them", () => {
    const pages: PageDraft[] = [
      {
        slug: "api-reference",
        section: "Reference",
        title: "API reference",
        description: null,
        navOrder: 40,
        content: "Try [GET /api/providers](/api/providers).",
      },
    ];
    const repaired = repairSiteLinks(pages);
    expect(repaired.pages[0]?.content).toBe("Try `GET /api/providers`.");
    expect(repaired.removedLinks).toEqual(["/api/providers"]);
  });
});
