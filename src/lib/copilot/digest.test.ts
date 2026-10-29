import { describe, expect, it } from "vitest";
import {
  buildChangeDigest,
  buildRepoDigest,
  buildSummaryDigest,
  exportedSymbols,
} from "@/lib/copilot/digest";
import type { RepoChange, RepoSnapshot } from "@/lib/github/repo-content";

const snapshot: RepoSnapshot = {
  sha: "a".repeat(40),
  branch: "main",
  treePaths: ["README.md", "docs/setup.md", "src/index.ts"],
  files: [
    { path: "README.md", content: "# Widget\nInstall it.", truncated: false },
    { path: "docs/setup.md", content: "Run the setup.", truncated: false },
    { path: "src/index.ts", content: "export const widget = 1;", truncated: false },
  ],
  omittedFiles: 2,
  treeTruncated: false,
};

describe("repo digest", () => {
  it("includes the tree, file contents, and omission count", () => {
    const digest = buildRepoDigest(snapshot, 10_000);
    expect(digest).toContain("Files in tree: 3");
    expect(digest).toContain("Files not read: 2");
    expect(digest).toContain("--- README.md");
    expect(digest).toContain("Install it.");
  });

  it("builds a small exported symbol map", () => {
    expect(
      exportedSymbols([
        {
          path: "src/index.ts",
          content: "export function build() {}\nexport const ready = true;",
          truncated: false,
        },
        { path: "README.md", content: "# No code", truncated: false },
      ]),
    ).toEqual(["src/index.ts: build, ready"]);
  });

  it("truncates safely", () => {
    const digest = buildRepoDigest(snapshot, 80);
    expect(digest.length).toBeLessThanOrEqual(80);
    expect(digest).toContain("[Repository context truncated]");
  });

  it("includes removals and patches for pushes", () => {
    const change: RepoChange = {
      before: "a".repeat(40),
      after: "b".repeat(40),
      changedPaths: ["docs/setup.md"],
      removedPaths: ["docs/old.md"],
      files: [],
      patches: [{ path: "docs/setup.md", patch: "- old\n+ new" }],
      fallback: null,
    };
    const digest = buildChangeDigest(change, 10_000);
    expect(digest).toContain("docs/old.md");
    expect(digest).toContain("+ new");
  });

  it("prefers docs for a summary digest", () => {
    const digest = buildSummaryDigest(snapshot, 10_000);
    expect(digest).toContain("--- docs/setup.md");
    expect(digest).not.toContain("--- src/index.ts");
  });
});
