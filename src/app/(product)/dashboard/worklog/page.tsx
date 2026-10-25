import { PageHeader } from "@/components/shell/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { getViewSession } from "@/lib/admin/act-as";
import { loadWorklog } from "@/lib/view-data";

export const dynamic = "force-dynamic";

export default async function WorklogPage() {
  const session = await getViewSession();
  if (!session) return null;
  const { entries, connected } = await loadWorklog(session);
  return (
    <>
      <PageHeader
        title="Changelog"
        description="Notes published alongside a docs site. Writing new entries from here arrives with the Changelog carry-over."
      />
      {!connected ? (
        <Alert>
          <AlertTitle>Database is not connected</AlertTitle>
          <AlertDescription>The entry below is preview data.</AlertDescription>
        </Alert>
      ) : null}
      {entries.length === 0 ? (
        <Empty className="border border-border bg-card">
          <EmptyHeader>
            <EmptyTitle>No Changelog entries</EmptyTitle>
            <EmptyDescription>Entries for your sites will list here.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="flex flex-col gap-4">
          {entries.map((entry) => (
            <Card key={entry.id}>
              <CardHeader>
                <CardTitle>{entry.title}</CardTitle>
                <CardDescription>
                  {entry.siteName} · {entry.publishedAt.slice(0, 10)}
                </CardDescription>
                {entry.preview ? <Badge variant="secondary">Preview</Badge> : null}
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-6">{entry.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
