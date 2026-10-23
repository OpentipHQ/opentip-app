import { PageHeader } from "@/components/shell/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { loadAdminSnapshot } from "@/lib/view-data";

export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  const snapshot = await loadAdminSnapshot();
  const stats = [
    { label: "Applications", value: snapshot.applications.length },
    { label: "Users", value: snapshot.users.length },
    { label: "Jobs", value: snapshot.jobs.length },
    { label: "Installs", value: snapshot.installs.length },
  ];
  return (
    <>
      <PageHeader
        title="Admin"
        description="Applications, people, jobs, plans, feedback, invites, and GitHub App installs."
      />
      {!snapshot.connected ? (
        <Alert>
          <AlertTitle>Database is not connected</AlertTitle>
          <AlertDescription>Counts stay at zero until Neon is configured.</AlertDescription>
        </Alert>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
