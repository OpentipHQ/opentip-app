import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, MessageSquareText, RefreshCw } from "lucide-react";
import { LiveRefresh } from "@/components/sites/live-refresh";
import { PageHeader } from "@/components/shell/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { SubmitButton } from "@/components/ui/submit-button";
import { getViewSession } from "@/lib/admin/act-as";
import { formatDateTime, jobKindLabel, sourceLabel } from "@/lib/format";
import { loadManagedSite } from "@/lib/sites/manage";
import {
  refreshSummaryAction,
  setReviewModeAction,
} from "./actions";

export const dynamic = "force-dynamic";

const notices: Record<string, { title: string; description: string }> = {
  approved: {
    title: "Revision published",
    description: "The page is live on your docs site.",
  },
  rejected: {
    title: "Revision rejected",
    description: "The live page was not changed.",
  },
  saved: {
    title: "Settings saved",
    description: "New GitHub pushes will use this review mode.",
  },
  summary: {
    title: "Summary refresh queued",
    description: "The repository summary will update when the worker picks up the job.",
  },
};

const statusCopy = {
  ACTIVE: { label: "Live", variant: "secondary" as const },
  PAUSED: { label: "Paused", variant: "destructive" as const },
  PENDING: { label: "Awaiting first build", variant: "outline" as const },
};

export default async function ManagedSitePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    approved?: string;
    rejected?: string;
    saved?: string;
    summary?: string;
    error?: string;
  }>;
}) {
  const session = await getViewSession();
  const { id } = await params;
  const query = await searchParams;
  if (!session) return null;
  const site = await loadManagedSite(session, id);
  if (!site) notFound();
  const notice = query.error
    ? { title: "That did not work", description: query.error }
    : query.approved
      ? notices.approved
      : query.rejected
        ? notices.rejected
        : query.saved
          ? notices.saved
          : query.summary
            ? notices.summary
            : null;
  const activeJob = site.recentJobs.some(
    (job) => job.status === "QUEUED" || job.status === "RUNNING",
  );
  const status =
    site.status === "PENDING" && site.pendingRevisionCount > 0
      ? { label: "Review needed", variant: "outline" as const }
      : site.status === "PENDING" &&
          site.recentJobs[0]?.status === "FAILED"
        ? { label: "Build failed", variant: "destructive" as const }
        : statusCopy[site.status];

  return (
    <>
      <LiveRefresh active={activeJob} />
      <PageHeader
        title={site.name}
        description="Manage pages, builds, review, and GitHub updates for this site."
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              nativeButton={false}
              variant="outline"
              render={<Link href={`/dashboard/sites/${site.id}/chat`} />}
            >
              <MessageSquareText />
              Chat edit
            </Button>
            {site.status === "ACTIVE" ? (
              <Button nativeButton={false} render={<Link href={site.publicUrl} />}>
                Open site
                <ArrowUpRight />
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={status.variant}>{status.label}</Badge>
        <Badge variant="outline">{site.reviewMode === "AUTO_PUBLISH" ? "Auto-publish" : "Review first"}</Badge>
        <a href={site.publicUrl} className="text-sm text-muted-foreground underline underline-offset-4">
          {site.publicUrl.replace("https://", "")}
        </a>
      </div>

      {notice ? (
        <Alert variant={query.error ? "destructive" : "default"}>
          <AlertTitle>{notice.title}</AlertTitle>
          <AlertDescription>{notice.description}</AlertDescription>
        </Alert>
      ) : null}

      {site.status === "PAUSED" ? (
        <Alert variant="destructive">
          <AlertTitle>This site is paused</AlertTitle>
          <AlertDescription>
            {site.pausedReason === "github_app_uninstalled"
              ? "The GitHub App was uninstalled. Reinstall it to resume updates."
              : site.pausedReason === "github_app_suspended"
                ? "The GitHub App installation is suspended."
                : "GitHub pushes will not update this site until the repo is available again."}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card size="sm">
          <CardHeader>
            <CardDescription>Published pages</CardDescription>
            <CardTitle className="text-2xl">{site.publishedPageCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>Waiting for review</CardDescription>
            <CardTitle className="text-2xl">{site.pendingRevisionCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>Last build</CardDescription>
            <CardTitle className="text-base">
              {site.recentJobs[0]
                ? `${jobKindLabel(site.recentJobs[0].kind)} · ${site.recentJobs[0].status.toLowerCase()}`
                : "Not started"}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg tracking-tight">Needs review</h2>
          <p className="text-sm text-muted-foreground">
            These changes are not live. Approve a revision to publish it.
          </p>
        </div>
        {site.pendingRevisions.length === 0 ? (
          <Empty className="border border-border bg-card">
            <EmptyHeader>
              <EmptyTitle>No changes waiting</EmptyTitle>
              <EmptyDescription>
                Push to GitHub or start a chat edit. Pending changes will show up here.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="overflow-hidden rounded-control border border-border bg-background">
            <div className="divide-y divide-border">
              {site.pendingRevisions.map((revision) => (
                <div
                  key={revision.id}
                  className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">
                        {revision.action === "DELETE" ? "Remove" : revision.title}
                      </p>
                      <Badge variant="outline">{sourceLabel(revision.source)}</Badge>
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {revision.action === "DELETE" ? revision.slug : revision.slug || "Home page"}
                      {revision.changeNote ? ` · ${revision.changeNote}` : ""}
                    </p>
                  </div>
                  <Button
                    nativeButton={false}
                    size="sm"
                    render={
                      <Link href={`/dashboard/sites/${site.id}/revisions/${revision.id}`} />
                    }
                  >
                    Review
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg tracking-tight">Builds</h2>
          <p className="text-sm text-muted-foreground">
            Every repo read, generation, and publish run is recorded here.
          </p>
        </div>
        {site.recentJobs.length === 0 ? (
          <Empty className="border border-border bg-card">
            <EmptyHeader>
              <EmptyTitle>No builds yet</EmptyTitle>
              <EmptyDescription>The first build starts automatically after import.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="overflow-hidden rounded-control border border-border bg-background">
            <div className="divide-y divide-border">
              {site.recentJobs.map((job) => (
                <Link
                  key={job.id}
                  href={`/dashboard/sites/${site.id}/builds/${job.id}`}
                  className="flex flex-col gap-2 px-4 py-3 transition hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-medium">{jobKindLabel(job.kind)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDateTime(job.createdAt)}
                      {job.error ? ` · ${job.error}` : ""}
                    </p>
                  </div>
                  <Badge
                    variant={
                      job.status === "FAILED"
                        ? "destructive"
                        : job.status === "SUCCEEDED"
                          ? "secondary"
                          : "outline"
                    }
                  >
                    {job.status.toLowerCase()}
                  </Badge>
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Pages</CardTitle>
            <CardDescription>
              Published pages are live. Hand edited pages are never overwritten by push updates.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {site.pages.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Pages appear after the first build finishes.
              </p>
            ) : (
              <div className="flex flex-col divide-y divide-border">
                {site.pages.map((page) => (
                  <div
                    key={page.id}
                    className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{page.title}</p>
                      <p className="text-xs text-muted-foreground">
                        /{page.slug || ""} {page.published ? "· live" : "· draft"}
                        {page.handEdited ? " · hand edited" : ""}
                      </p>
                    </div>
                    <Button
                      nativeButton={false}
                      variant="ghost"
                      size="sm"
                      render={
                        <Link
                          href={`/dashboard/sites/${site.id}/chat?page=${encodeURIComponent(page.slug)}`}
                        />
                      }
                    >
                      Edit
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Update mode</CardTitle>
            <CardDescription>
              Choose whether GitHub pushes publish immediately or wait for your review.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={setReviewModeAction} className="flex flex-col gap-3">
              <input type="hidden" name="siteId" value={site.id} />
              <label className="flex cursor-pointer gap-3 rounded-control border border-border p-3">
                <input
                  type="radio"
                  name="reviewMode"
                  value="AUTO_PUBLISH"
                  defaultChecked={site.reviewMode === "AUTO_PUBLISH"}
                  className="mt-1"
                />
                <span>
                  <span className="block text-sm font-medium">Auto-publish updates</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    Push to GitHub and the live docs update after the build succeeds.
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer gap-3 rounded-control border border-border p-3">
                <input
                  type="radio"
                  name="reviewMode"
                  value="REVIEW"
                  defaultChecked={site.reviewMode === "REVIEW"}
                  className="mt-1"
                />
                <span>
                  <span className="block text-sm font-medium">Review changes first</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    The build prepares changes, but the live docs wait for approval.
                  </span>
                </span>
              </label>
              <SubmitButton size="sm" className="self-start" loadingText="Saving...">
                Save update mode
              </SubmitButton>
            </form>
            <div className="mt-4 border-t border-border pt-4">
              <p className="text-sm font-medium">Repository summary</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Keep a short project overview for future builds and updates.
              </p>
              <form action={refreshSummaryAction} className="mt-2">
                <input type="hidden" name="siteId" value={site.id} />
                <SubmitButton
                  size="sm"
                  variant="outline"
                  disabled={activeJob}
                  loadingText="Refreshing..."
                >
                  <RefreshCw />
                  Refresh summary
                </SubmitButton>
              </form>
            </div>
          </CardContent>
        </Card>
      </section>
    </>
  );
}
