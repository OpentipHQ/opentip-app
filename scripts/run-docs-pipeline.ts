import { writeFileSync } from "node:fs";
import { extractFacts } from "@/lib/copilot/facts";
import { runFirstBuildPipeline } from "@/lib/copilot/pipeline";
import { resolveProvider } from "@/lib/copilot/providers";
import { readRepoSnapshot } from "@/lib/github/repo-content";

const repo = process.argv[2] ?? "optimusexe/Plugr";
const [owner, name] = repo.split("/");
if (!owner || !name) {
  console.error("Usage: tsx scripts/run-docs-pipeline.ts owner/name");
  process.exit(1);
}

const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? "";
const snapshot = await readRepoSnapshot({
  owner,
  name,
  branch: process.env.DOCS_BRANCH ?? "main",
  token,
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
