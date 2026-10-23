export type CachedSummary = {
  content: string;
  sha: string;
  cachedAt: number;
};

export type SummaryStore = {
  get(repoId: string): Promise<CachedSummary | null>;
  set(
    repoId: string,
    value: { content: string; sha: string; cachedAt: number },
  ): Promise<void>;
};

export async function getOrCreateRepoSummary(args: {
  repoId: string;
  sha: string;
  digest: string;
  ttlMs: number;
  now: number;
  store: SummaryStore;
  complete: (digest: string) => Promise<string>;
}): Promise<{ content: string; cache: "hit" | "miss" }> {
  const cached = await args.store.get(args.repoId);
  if (
    cached &&
    cached.sha === args.sha &&
    args.now - cached.cachedAt < args.ttlMs
  ) {
    return { content: cached.content, cache: "hit" };
  }
  const content = await args.complete(args.digest);
  await args.store.set(args.repoId, {
    content,
    sha: args.sha,
    cachedAt: args.now,
  });
  return { content, cache: "miss" };
}
