import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { getRequestSession } from "@/lib/auth";
import { docsRootDomain } from "@/lib/config";
import { loadSiteCards } from "@/lib/view-data";

export const dynamic = "force-dynamic";

const statusLabel = { ACTIVE: "Live", PAUSED: "Paused", PENDING: "Pending" } as const;
const themeLabel = { LEDGER: "Ledger", MINIMAL: "Minimal" } as const;

export default async function SitesPage() {
  const session = await getRequestSession();
  if (!session) return null;
  const { sites, connected } = await loadSiteCards(session);
  return (
    <>
      <PageHeader
        title="Sites"
        description="Docs sites connected to GitHub repos."
      />
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
              Install the Opentip GitHub App on a repo to create one.
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
