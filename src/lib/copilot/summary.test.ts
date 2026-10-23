import { describe, expect, it, vi } from "vitest";
import { getOrCreateRepoSummary, type SummaryStore } from "@/lib/copilot/summary";

function memoryStore(): SummaryStore & { writes: number } {
  const rows = new Map<string, { content: string; sha: string; cachedAt: number }>();
  return {
    writes: 0,
    async get(repoId) {
      return rows.get(repoId) ?? null;
    },
    async set(repoId, value) {
      rows.set(repoId, value);
      this.writes += 1;
    },
  };
}

describe("cached repo summaries", () => {
  it("calls the model once until the sha changes or the cache expires", async () => {
    const store = memoryStore();
    const complete = vi.fn(async (digest: string) => `summary:${digest}`);
    const first = await getOrCreateRepoSummary({
      repoId: "repo-a",
      sha: "sha-1",
      digest: "tree-1",
      ttlMs: 1_000,
      now: 10_000,
      store,
      complete,
    });
    const second = await getOrCreateRepoSummary({
      repoId: "repo-a",
      sha: "sha-1",
      digest: "tree-1",
      ttlMs: 1_000,
      now: 10_500,
      store,
      complete,
    });
    const third = await getOrCreateRepoSummary({
      repoId: "repo-a",
      sha: "sha-2",
      digest: "tree-2",
      ttlMs: 1_000,
      now: 10_800,
      store,
      complete,
    });
    expect(first).toEqual({ content: "summary:tree-1", cache: "miss" });
    expect(second).toEqual({ content: "summary:tree-1", cache: "hit" });
    expect(third.cache).toBe("miss");
    expect(complete).toHaveBeenCalledTimes(2);
  });
});
