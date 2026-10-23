import { PageHeader } from "@/components/shell/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getRequestSession } from "@/lib/auth";
import { loadUsage } from "@/lib/view-data";

export const dynamic = "force-dynamic";

export default async function UsagePage() {
  const session = await getRequestSession();
  if (!session) return null;
  const usage = await loadUsage(session);
  const stats = [
    { label: "Sites", value: usage.sites },
    { label: "Published pages", value: usage.pages },
    { label: "Builds", value: usage.builds },
  ];
  return (
    <>
      <PageHeader
        title="Usage"
        description="Sites, published pages, and builds on your account. Token totals and estimated spend stay on the admin usage page."
      />
      {!usage.connected ? (
        <Alert>
          <AlertTitle>Database is not connected</AlertTitle>
          <AlertDescription>These counts include the local preview site.</AlertDescription>
        </Alert>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader>
              <CardTitle>{stat.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl tracking-tight">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
