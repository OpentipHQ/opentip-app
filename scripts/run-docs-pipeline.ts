import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { extractFacts } from "@/lib/copilot/facts";
import { runFirstBuildPipeline } from "@/lib/copilot/pipeline";
import { resolveProvider } from "@/lib/copilot/providers";
import {
  isRelevantPath,
  readRepoSnapshot,
  selectContentCandidates,
  type RepoSnapshot,
} from "@/lib/github/repo-content";

const repo = process.argv[2] ?? "optimusexe/Plugr";
const [owner, name] = repo.split("/");
if (!owner || !name) {
  console.error("Usage: tsx scripts/run-docs-pipeline.ts owner/name");
  process.exit(1);
}

async function main() {
const localRoot = process.env.LOCAL_REPO;
const snapshot = localRoot
  ? snapshotFromDisk(localRoot)
  : await readRepoSnapshot({
      owner,
      name,
      branch: process.env.DOCS_BRANCH ?? "main",
      token: process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? "",
    });
const facts = extractFacts(snapshot);
const result = await runFirstBuildPipeline({
  heavy: resolveProvider("heavy", process.env),
  small: resolveProvider("small", process.env),
  siteName: name,
  repoFullName: `${owner}/${name}`,
  snapshot,
  facts,
});

const report = {
  repo: `${owner}/${name}`,
  sha: snapshot.sha,
  filesRead: snapshot.files.length,
  routes: facts.routes.length,
  envVars: facts.envVars.map((item) => item.name),
  scripts: facts.scripts.map((item) => item.name),
  audience: facts.audience,
  pages: result.pages.map((page) => ({
    slug: page.slug || "/",
    section: page.section,
    title: page.title,
    description: page.description,
  })),
  verification: result.verification,
  usage: result.usage,
  sample: result.pages.find((page) => page.slug === "getting-started") ?? result.pages[0] ?? null,
};

function snapshotFromDisk(root: string): RepoSnapshot {
  const treePaths: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === ".git" || entry.name === "node_modules" || entry.name === ".next") continue;
      const full = join(dir, entry.name);
      const rel = relative(root, full);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!statSync(full).isFile() || !isRelevantPath(rel)) continue;
      treePaths.push(rel);
      if (treePaths.length >= 2_000) return;
    }
  };
  walk(root);
  const candidates = selectContentCandidates(treePaths);
  const files = [];
  let total = 0;
  for (const path of candidates) {
    const raw = readFileSync(join(root, path), "utf8");
    if (raw.includes("\u0000")) continue;
    const truncated = raw.length > 60_000;
    const content = truncated ? raw.slice(0, 60_000) : raw;
    if (total + content.length > 240_000) break;
    total += content.length;
    files.push({ path, content, truncated });
  }
  return {
    sha: "local",
    branch: "main",
    treePaths,
    files,
    omittedFiles: Math.max(0, candidates.length - files.length),
    treeTruncated: false,
  };
}

const out = process.env.DOCS_PIPELINE_OUT ?? "/tmp/docs-pipeline-result.json";
writeFileSync(out, JSON.stringify(report, null, 2));
console.log(
  JSON.stringify(
    {
      out,
      pages: report.pages,
      routes: report.routes,
      envVars: report.envVars,
      promptTokens: result.usage.promptTokens,
      completionTokens: result.usage.completionTokens,
      estimatedCostUsd: result.usage.estimatedCostUsd,
      stages: result.usage.stages.map((stage) => ({
        stage: stage.stage,
        model: stage.model,
        cost: stage.estimatedCostUsd,
      })),
      verification: result.verification.map((item) => ({
        slug: item.slug || "/",
        violations: item.violations.length,
        stubbed: item.stubbed,
        rewritten: item.rewritten,
      })),
    },
    null,
    2,
  ),
);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
