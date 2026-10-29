import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { DocsMarkdown } from "@/components/docs/markdown";
import { PageHeader } from "@/components/shell/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { formatDateTime, sourceLabel } from "@/lib/format";
import { loadRevision } from "@/lib/sites/manage";
import { approveRevisionAction, rejectRevisionAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function RevisionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; revisionId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getViewSession();
  const { id, revisionId } = await params;
  const { error } = await searchParams;
  if (!session) return null;
  const revision = await loadRevision(session, id, revisionId);
  if (!revision) notFound();
  const pending = revision.status === "PENDING";
  const removal = revision.action === "DELETE";

  return (
    <>
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
        title={removal ? "Remove page" : revision.title}
        description={`/${revision.slug || ""} · ${sourceLabel(revision.source)} · ${formatDateTime(revision.createdAt)}`}
        action={<Badge variant={pending ? "outline" : "secondary"}>{revision.status.toLowerCase()}</Badge>}
      />

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>That did not work</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {revision.changeNote ? (
        <Alert>
          <AlertTitle>Change note</AlertTitle>
          <AlertDescription>{revision.changeNote}</AlertDescription>
        </Alert>
      ) : null}

      {removal ? (
        <Alert variant="destructive">
          <AlertTitle>This revision removes a page</AlertTitle>
          <AlertDescription>
            Approving this revision unpublishes the page. The content stays in the database but is no
            longer served on your docs site.
          </AlertDescription>
        </Alert>
      ) : null}

      {!pending ? (
        <Card>
          <CardHeader>
            <CardTitle>This revision is {revision.status.toLowerCase()}</CardTitle>
            <CardDescription>No action is needed.</CardDescription>
          </CardHeader>
          {revision.reviewNote ? (
            <CardContent>
              <p className="text-sm text-muted-foreground">{revision.reviewNote}</p>
            </CardContent>
          ) : null}
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Publish this revision?</CardTitle>
            <CardDescription>
              {removal
                ? "Approving removes the page from your live docs."
                : revision.source === "CHAT_EDIT"
                  ? "Approving makes this page live. Future GitHub pushes will not overwrite your chat edit."
                  : "Approving makes this page live. Future GitHub pushes can still update it."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              <form action={approveRevisionAction}>
                <input type="hidden" name="siteId" value={id} />
                <input type="hidden" name="revisionId" value={revision.id} />
                <SubmitButton loadingText="Publishing...">
                  {removal ? "Approve removal" : "Approve and publish"}
                </SubmitButton>
              </form>
              <Button
                nativeButton={false}
                variant="outline"
                render={<Link href={`/dashboard/sites/${id}`} />}
              >
                Keep changes pending
              </Button>
            </div>
            <form action={rejectRevisionAction} className="flex flex-col gap-2 border-t border-border pt-4">
              <input type="hidden" name="siteId" value={id} />
              <input type="hidden" name="revisionId" value={revision.id} />
              <label htmlFor="note" className="text-sm font-medium">
                Reject this revision
              </label>
              <textarea
                id="note"
                name="note"
                rows={2}
                maxLength={1_000}
                placeholder="Optional note for your records"
                className="w-full rounded-control border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground"
              />
              <SubmitButton
                variant="destructive"
                size="sm"
                className="self-start"
                loadingText="Rejecting..."
              >
                Reject
              </SubmitButton>
            </form>
          </CardContent>
        </Card>
      )}

      <div className={`grid gap-4 ${removal ? "" : "lg:grid-cols-2"}`}>
        <Card className="[--docs-primary:var(--primary)]">
          <CardHeader>
            <CardTitle>{removal ? "Current page" : "Current live page"}</CardTitle>
            <CardDescription>
              {revision.current
                ? revision.current.published
                  ? "This is what visitors see now."
                  : "This page is not currently published."
                : "There is no live page for this slug."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {revision.current ? (
              <div className="max-h-[42rem] overflow-y-auto pr-2">
                <DocsMarkdown content={revision.current.content} />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No current content.</p>
            )}
          </CardContent>
        </Card>

        {removal ? null : (
          <Card className="border-foreground/30 [--docs-primary:var(--primary)]">
            <CardHeader>
              <CardTitle>Proposed page</CardTitle>
              <CardDescription>
                {revision.description ?? "No description provided."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-h-[42rem] overflow-y-auto pr-2">
                <DocsMarkdown content={revision.content} />
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {revision.job ? (
        <p className="text-xs text-muted-foreground">
          Built by{" "}
          <Link
            href={`/dashboard/sites/${id}/builds/${revision.job.id}`}
            className="underline underline-offset-4"
          >
            this build
          </Link>
          .
        </p>
      ) : null}
    </>
  );
}
