import { describe, expect, it } from "vitest";
import {
  isRelevantPath,
  selectContentCandidates,
} from "@/lib/github/repo-content";

describe("repository content selection", () => {
  it("skips generated, dependency, binary, and secret paths", () => {
    expect(isRelevantPath("README.md")).toBe(true);
    expect(isRelevantPath("src/index.ts")).toBe(true);
    expect(isRelevantPath("node_modules/pkg/index.js")).toBe(false);
    expect(isRelevantPath("dist/index.js")).toBe(false);
    expect(isRelevantPath("package-lock.json")).toBe(false);
    expect(isRelevantPath("public/logo.png")).toBe(false);
    expect(isRelevantPath(".env")).toBe(false);
    expect(isRelevantPath(".env.example")).toBe(true);
  });

  it("prioritizes manifests and source over README and docs", () => {
    const selected = selectContentCandidates([
      "src/z.ts",
      "package.json",
      "docs/setup.md",
      "README.md",
      "src/a.ts",
      "image.png",
    ]);
    expect(selected).toEqual([
      "package.json",
      "src/a.ts",
      "src/z.ts",
      "README.md",
      "docs/setup.md",
    ]);
  });
});
