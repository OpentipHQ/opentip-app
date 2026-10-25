import { PageHeader } from "@/components/shell/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { countMarketingApplications } from "@/lib/beta/marketing-db";
import { getPrisma } from "@/lib/db";
import { loadAdminSnapshot } from "@/lib/view-data";

export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  const [snapshot, marketing] = await Promise.all([
    loadAdminSnapshot(),
    countMarketingApplications(),
  ]);
  const prisma = getPrisma();
  const [announcements, alerts, webhookErrors] = prisma
    ? await Promise.all([
        prisma.announcement.count({ where: { active: true } }),
        prisma.spendAlert.count(),
        prisma.webhookError.count(),
      ])
    : [0, 0, 0];
  const stats = [
    { label: "Applications", value: marketing.state === "ok" ? marketing.count : "n/a" },
    { label: "Users", value: snapshot.users.length },
    { label: "Jobs", value: snapshot.jobs.length },
    { label: "Installs", value: snapshot.installs.length },
    { label: "Active announcements", value: announcements },
    { label: "Spend alerts", value: alerts },
    { label: "Webhook errors", value: webhookErrors },
  ];
  return (
    <>
      <PageHeader
        title="Admin"
        description="Applications, people, jobs, plans, feedback, invites, installs, announcements, alerts, and activity."
      />
      {!snapshot.connected ? (
        <Alert>
          <AlertTitle>Database is not connected</AlertTitle>
          <AlertDescription>Counts stay at zero until Neon is configured.</AlertDescription>
        </Alert>
      ) : null}
      {marketing.state !== "ok" ? (
        <Alert>
          <AlertTitle>
            {marketing.state === "unconfigured"
              ? "Applications database is not configured"
              : "Applications are unavailable"}
          </AlertTitle>
          <AlertDescription>
            {marketing.state === "unconfigured"
              ? "Set MARKETING_DATABASE_URL to count marketing site applications."
              : "The marketing database could not be reached. The count is unavailable."}
          </AlertDescription>
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
