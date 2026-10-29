import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, PenLine } from "lucide-react";
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
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { getViewSession } from "@/lib/admin/act-as";
import { formatDateTime } from "@/lib/format";
import { loadChatView } from "@/lib/sites/manage";
import { sendChatEditAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function ChatPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; error?: string }>;
}) {
  const session = await getViewSession();
  const { id } = await params;
  const query = await searchParams;
  if (!session) return null;
  const view = await loadChatView(session, id, query.page ?? null);
  if (!view) notFound();

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
        title="Chat edit"
        description={`Ask Opentip to change one page on ${view.name}. The edit is always a pending revision until you approve it.`}
      />

      {query.error ? (
        <Alert variant="destructive">
          <AlertTitle>That did not work</AlertTitle>
          <AlertDescription>{query.error}</AlertDescription>
        </Alert>
      ) : null}

      {view.pages.length === 0 ? (
        <Empty className="border border-border bg-card">
          <EmptyHeader>
            <EmptyTitle>No pages to edit</EmptyTitle>
            <EmptyDescription>
              Wait for the first build to publish pages, then come back here.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[17rem_1fr] lg:items-start">
          <Card className="lg:sticky lg:top-4">
            <CardHeader>
              <CardTitle>Pages</CardTitle>
              <CardDescription>Choose a page to edit.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-1">
              {view.pages.map((page) => {
                const selected = view.selected?.id === page.id;
                return (
                  <Link
                    key={page.id}
                    href={`/dashboard/sites/${id}/chat?page=${encodeURIComponent(page.slug)}`}
                    className={`rounded-control px-3 py-2 text-sm transition ${
                      selected
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    }`}
                  >
                    <span className="block truncate font-medium">{page.title}</span>
                    <span
                      className={`block truncate text-xs ${
                        selected ? "text-primary-foreground/80" : "text-muted-foreground"
                      }`}
                    >
                      /{page.slug || ""}
                    </span>
                  </Link>
                );
              })}
            </CardContent>
          </Card>

          <div className="flex flex-col gap-4">
            {view.selected ? (
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle>{view.selected.title}</CardTitle>
                    {!view.selected.published ? <Badge variant="outline">Draft</Badge> : null}
                    {view.selected.handEdited ? (
                      <Badge variant="secondary">Hand edited</Badge>
                    ) : null}
                  </div>
                  <CardDescription className="flex flex-wrap gap-2">
                    <span>/{view.selected.slug || ""}</span>
                    <Link
                      href={`/dashboard/sites/${id}/chat?page=${encodeURIComponent(view.selected.slug)}`}
                      className="underline underline-offset-4"
                    >
                      Reload page
                    </Link>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form action={sendChatEditAction} className="flex flex-col gap-3">
                    <input type="hidden" name="siteId" value={id} />
                    <input type="hidden" name="pageId" value={view.selected.id} />
                    <input type="hidden" name="slug" value={view.selected.slug} />
                    <label htmlFor="instruction" className="text-sm font-medium">
                      What should change?
                    </label>
                    <textarea
                      id="instruction"
                      name="instruction"
                      rows={5}
                      maxLength={4_000}
                      required
                      placeholder="Example: Add a short section about deploying with Docker, and make the setup steps easier to scan."
                      className="w-full rounded-control border border-border bg-background px-3 py-2 text-sm leading-6 outline-none focus:border-foreground"
                    />
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs text-muted-foreground">
                        The edit will wait for your approval before it goes live.
                      </p>
                      <SubmitButton loadingText="Preparing...">
                        <PenLine />
                        Prepare edit
                      </SubmitButton>
                    </div>
                  </form>
                </CardContent>
              </Card>
            ) : null}

            <Card>
              <CardHeader>
                <CardTitle>Recent chat edits</CardTitle>
                <CardDescription>
                  Requests for this site. Open the build to see progress or the revision to approve.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {view.history.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No chat edits yet. Your first request will appear here.
                  </p>
                ) : (
                  <div className="flex flex-col divide-y divide-border">
                    {view.history.map((edit) => (
                      <div key={edit.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium">{edit.pageTitle}</p>
                          {edit.jobStatus ? (
                            <Badge
                              variant={
                                edit.jobStatus === "FAILED"
                                  ? "destructive"
                                  : edit.jobStatus === "SUCCEEDED"
                                    ? "secondary"
                                    : "outline"
                              }
                            >
                              {edit.jobStatus.toLowerCase()}
                            </Badge>
                          ) : null}
                          {edit.pendingRevisionId ? (
                            <Badge variant="outline">Needs review</Badge>
                          ) : null}
                        </div>
                        <p className="text-sm text-muted-foreground">{edit.instruction}</p>
                        <div className="flex flex-wrap items-center gap-3 text-xs">
                          <span className="text-muted-foreground">
                            {formatDateTime(edit.createdAt)}
                          </span>
                          {edit.jobId ? (
                            <Link
                              href={`/dashboard/sites/${id}/builds/${edit.jobId}`}
                              className="underline underline-offset-4"
                            >
                              View build
                            </Link>
                          ) : null}
                          {edit.pendingRevisionId ? (
                            <Link
                              href={`/dashboard/sites/${id}/revisions/${edit.pendingRevisionId}`}
                              className="underline underline-offset-4"
                            >
                              Review change
                            </Link>
                          ) : null}
                        </div>
                        {edit.jobError ? (
                          <p className="text-xs text-destructive">{edit.jobError}</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
