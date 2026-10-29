import { notFound } from "next/navigation";
import { retryBuildAction } from "@/app/(product)/dashboard/sites/[id]/actions";
import { SubmitButton } from "@/components/ui/submit-button";
import { getViewSession } from "@/lib/admin/act-as";
import { jobKindLabel } from "@/lib/format";
import { loadWorkspace } from "@/lib/workspace/load";

export const dynamic = "force-dynamic";

export default async function BuildsSection({ params }: { params: Promise<{ site: string }> }) {
  const session = await getViewSession();
  if (!session) return null;
  const site = await loadWorkspace(session, (await params).site);
  if (!site) notFound();
  return (
    <div className="flex flex-col gap-4 p-6">
      <h1 className="text-2xl">Builds</h1>
      <div className="overflow-hidden rounded-control border border-border">
        {site.jobs.length === 0 ? <p className="px-4 py-3 text-sm text-muted-foreground">None</p> : null}
        {site.jobs.map((job) => (
          <div key={job.id} className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-b-0">
            <div>
              <p className="text-sm">{jobKindLabel(job.kind)}</p>
              <p className="text-xs text-muted-foreground">{job.createdAt.slice(0, 16).replace("T", " ")}</p>
              {job.error ? <p className="text-xs text-destructive">{job.error}</p> : null}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm">{job.status}</span>
              {job.status === "FAILED" ? (
                <form action={retryBuildAction}>
                  <input type="hidden" name="siteId" value={site.id} />
                  <input type="hidden" name="jobId" value={job.id} />
                  <SubmitButton size="sm" variant="outline">
                    Retry
                  </SubmitButton>
                </form>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
