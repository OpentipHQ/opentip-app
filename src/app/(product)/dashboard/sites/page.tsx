import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { getViewSession } from "@/lib/admin/act-as";
import { docsRootDomain } from "@/lib/config";
import { loadSiteCards } from "@/lib/view-data";

export const dynamic = "force-dynamic";

const statusLabel = { ACTIVE: "Live", PAUSED: "Paused", PENDING: "Pending build" } as const;
const themeLabel = { LEDGER: "Ledger", MINIMAL: "Minimal" } as const;

const resultCopy: Record<string, { title: string; description: string }> = {
  imported: {
    title: "Build queued",
    description:
      "Your site is pending while the first build runs. It will go live when the build succeeds.",
  },
  "already-imported": {
    title: "Already imported",
    description: "That repo already has a site. It is listed below.",
  },
};

export default async function SitesPage({
  searchParams,
}: {
  searchParams: Promise<{ result?: string }>;
}) {
  const session = await getViewSession();
  if (!session) return null;
  const params = await searchParams;
  const notice = params.result ? resultCopy[params.result] : undefined;
  const { sites, connected } = await loadSiteCards(session);
  return (
    <>
      <PageHeader
        title="Sites"
        description="Sites created from imported repos. Pending sites stay here while their first build runs."
        action={
          <Button nativeButton={false} variant="outline" render={<Link href="/dashboard" />}>
            Import a repo
          </Button>
        }
      />
      {notice ? (
        <Alert>
          <AlertTitle>{notice.title}</AlertTitle>
          <AlertDescription>{notice.description}</AlertDescription>
        </Alert>
      ) : null}
      {!connected ? (
        <Alert>
          <AlertTitle>Database is not connected</AlertTitle>
          <AlertDescription>
            The sample site below is preview data. It goes away once DATABASE_URL points at Neon.
          </AlertDescription>
        </Alert>
      ) : null}
      {sites.length === 0 ? (
        <Empty className="border border-border bg-card">
          <EmptyHeader>
            <EmptyTitle>No sites yet</EmptyTitle>
            <EmptyDescription>
              Choose a repo in{" "}
              <Link href="/dashboard" className="underline">
                the import view
              </Link>
              , name the site, and click Build site. Installing Opentip Copilot only connects GitHub. It does
              not create a site.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {sites.map((site) => {
            const href = site.preview
              ? "/sites/sample"
              : `https://${site.subdomain}.${docsRootDomain()}`;
            return (
              <Card key={site.id}>
                <CardHeader>
                  <CardTitle>{site.name}</CardTitle>
                  <CardDescription>
                    {site.subdomain}.{docsRootDomain()}
                  </CardDescription>
                  <div className="flex gap-2">
                    <Badge variant="outline">{statusLabel[site.status]}</Badge>
                    {site.preview ? <Badge variant="secondary">Preview</Badge> : null}
                  </div>
                </CardHeader>
                <CardContent className="flex items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">
                    {themeLabel[site.theme]} · {site.pageCount} pages
                  </p>
                  <Button nativeButton={false} variant="outline" size="sm" render={<Link href={href} />}>
                    Open
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
