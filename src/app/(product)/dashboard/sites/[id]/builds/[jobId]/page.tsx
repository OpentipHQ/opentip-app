import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, CircleAlert, LoaderCircle, RefreshCw } from "lucide-react";
import { LiveRefresh } from "@/components/sites/live-refresh";
import { PageHeader } from "@/components/shell/page-header";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getViewSession } from "@/lib/admin/act-as";
import {
  formatDateTime,
  formatDuration,
  jobKindLabel,
  sourceLabel,
} from "@/lib/format";
import { loadBuild } from "@/lib/sites/manage";
import { retryBuildAction } from "../../actions";

export const dynamic = "force-dynamic";

const retryErrorCopy: Record<string, string> = {
  paused: "This site is paused. Resolve the repository issue before retrying.",
  "not-failed": "This build is no longer failed, so it cannot be retried.",
  queue: "The build could not be queued again. Try again in a moment.",
};

const stages = [
  { phase: "QUEUED", label: "Queued", description: "Waiting for a worker" },
  { phase: "READING_REPO", label: "Reading repository", description: "Reading docs and source files" },
  { phase: "GENERATING", label: "Writing pages", description: "Generating documentation" },
  { phase: "VALIDATING", label: "Checking pages", description: "Validating slugs and content" },
  { phase: "PUBLISHING", label: "Publishing", description: "Writing pages and preparing review" },
  { phase: "COMPLETE", label: "Complete", description: "The job finished" },
] as const;

function phaseIndex(phase: string): number {
  const index = stages.findIndex((stage) => stage.phase === phase);
  return index < 0 ? 0 : index;
}

export default async function BuildPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; jobId: string }>;
  searchParams: Promise<{ retryError?: string }>;
}) {
  const session = await getViewSession();
  const { id, jobId } = await params;
  const { retryError } = await searchParams;
  if (!session) return null;
  const build = await loadBuild(session, id, jobId);
  if (!build) notFound();
  const active = build.status === "QUEUED" || build.status === "RUNNING";
  const current = phaseIndex(build.phase);
  const succeeded = build.status === "SUCCEEDED";
  const failed = build.status === "FAILED";
  const retryErrorMessage = retryError ? retryErrorCopy[retryError] : undefined;
  const retryLabel =
    build.kind === "SUMMARY_REFRESH"
      ? "Retry summary"
      : build.kind === "CHAT_EDIT"
        ? "Retry edit"
        : "Retry build";

  return (
    <>
      <LiveRefresh active={active} seconds={2} />
      <div>
        <Button
          nativeButton={false}
          variant="ghost"
          size="sm"
          render={<Link href={`/dashboard/sites/${id}`} />}
        >
          <ArrowLeft />
          Back to site
        </Button>
      </div>
      <PageHeader
        title={jobKindLabel(build.kind)}
        description={`${build.site?.name ?? "Site"} · ${build.repoFullName}`}
        action={
          <Badge
            variant={
              failed ? "destructive" : succeeded ? "secondary" : "outline"
            }
          >
            {build.status.toLowerCase()}
          </Badge>
        }
      />

      {retryErrorMessage ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Retry not queued</AlertTitle>
          <AlertDescription>{retryErrorMessage}</AlertDescription>
        </Alert>
      ) : null}

      {failed ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>This build failed</AlertTitle>
          <AlertDescription>
            {build.error ?? "The worker stopped before finishing."} Check your live pages to confirm what changed.
          </AlertDescription>
          <AlertAction>
            <form action={retryBuildAction}>
              <input type="hidden" name="siteId" value={id} />
              <input type="hidden" name="jobId" value={build.id} />
              <SubmitButton size="sm" variant="outline" loadingText="Retrying...">
                <RefreshCw />
                {retryLabel}
              </SubmitButton>
            </form>
          </AlertAction>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>
            {succeeded
              ? "Build complete"
              : failed
                ? "Build stopped"
                : build.status === "QUEUED"
                  ? "Waiting to start"
                  : "Build in progress"}
          </CardTitle>
          <CardDescription>
            {build.detail ?? "You can close this page. The build keeps running on the server."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {formatDuration(build.startedAt ?? build.createdAt, build.finishedAt)}
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              {succeeded ? 100 : build.progress}%
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all ${
                failed ? "bg-destructive" : "bg-primary"
              }`}
              style={{ width: `${succeeded ? 100 : Math.max(2, build.progress)}%` }}
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {stages.map((stage, index) => {
              const done = succeeded || index < current;
              const currentStage = !succeeded && !failed && index === current;
              const failedStage = failed && index === current;
              return (
                <div
                  key={stage.phase}
                  className={`rounded-control border p-3 ${
                    failedStage
                      ? "border-destructive/40 bg-destructive/5"
                      : currentStage
                        ? "border-foreground bg-muted/40"
                        : done
                          ? "border-border bg-background"
                          : "border-border/70 bg-muted/20"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {failedStage ? (
                      <CircleAlert className="size-4 text-destructive" />
                    ) : done ? (
                      <Check className="size-4" />
                    ) : currentStage ? (
                      <LoaderCircle className="size-4 animate-spin" />
                    ) : (
                      <span className="size-2 rounded-full border border-muted-foreground/40" />
                    )}
                    <p className="text-sm font-medium">{stage.label}</p>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {stage.description}
                  </p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {build.pendingRevisions.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Changes are ready for review</CardTitle>
            <CardDescription>
              Nothing here is live yet. Review each page before publishing.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {build.pendingRevisions.map((revision) => (
              <div
                key={revision.id}
                className="flex items-center justify-between gap-3 rounded-control border border-border p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {revision.action === "DELETE" ? "Remove" : revision.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    /{revision.slug || ""} · {sourceLabel(revision.source)}
                  </p>
                </div>
                <Button
                  nativeButton={false}
                  size="sm"
                  render={
                    <Link href={`/dashboard/sites/${id}/revisions/${revision.id}`} />
                  }
                >
                  Review
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Activity</CardTitle>
          <CardDescription>
            Stages and saved milestones. Raw prompts and model output are not shown.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {build.events.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No activity yet. The worker will pick up this job soon.
            </p>
          ) : (
            <ol className="flex flex-col gap-3">
              {build.events.map((event) => (
                <li key={event.id} className="flex gap-3">
                  <span
                    className={`mt-1 size-2 shrink-0 rounded-full ${
                      event.level === "error" ? "bg-destructive" : "bg-primary"
                    }`}
                  />
                  <div className="min-w-0">
                    <p className="text-sm">{event.message}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(event.createdAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Queued {formatDateTime(build.createdAt)}
        {build.attempts > 0 ? ` · Attempt ${build.attempts} of ${build.maxAttempts}` : ""}
      </p>
    </>
  );
}
