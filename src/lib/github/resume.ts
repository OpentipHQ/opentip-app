export function nextSiteStatus(input: {
  status: "PENDING" | "ACTIVE" | "PAUSED";
  pausedReason: string | null;
  publishedPageCount: number;
  reasons: readonly string[];
}): "ACTIVE" | "PENDING" | null {
  if (input.status !== "PAUSED") return null;
  if (!input.pausedReason || !input.reasons.includes(input.pausedReason)) return null;
  return input.publishedPageCount > 0 ? "ACTIVE" : "PENDING";
}

export async function applyResume(
  sites: Array<{ id: string; pausedReason: string | null; publishedPageCount: number }>,
  reasons: readonly string[],
  update: (id: string, status: "ACTIVE" | "PENDING") => Promise<void>,
): Promise<number> {
  let resumed = 0;
  for (const site of sites) {
    const next = nextSiteStatus({
      status: "PAUSED",
      pausedReason: site.pausedReason,
      publishedPageCount: site.publishedPageCount,
      reasons,
    });
    if (!next) continue;
    await update(site.id, next);
    resumed += 1;
  }
  return resumed;
}
