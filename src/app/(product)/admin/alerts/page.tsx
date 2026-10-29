import { PageHeader } from "@/components/shell/page-header";
import { SubmitButton } from "@/components/ui/submit-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getPrisma } from "@/lib/db";
import { alertRecipients, spendThresholds } from "@/lib/admin/spend";
import { checkSpendAlerts } from "./actions";

export const dynamic = "force-dynamic";

export default async function AlertsPage({
  searchParams,
}: {
  searchParams: Promise<{ checked?: string; total?: string; outliers?: string }>;
}) {
  const params = await searchParams;
  const thresholds = spendThresholds();
  const recipients = alertRecipients(process.env.SPEND_ALERT_EMAILS);
  const prisma = getPrisma();
  const alerts = prisma
    ? await prisma.spendAlert.findMany({ orderBy: { createdAt: "desc" }, take: 50 })
    : [];
  return (
    <>
      <PageHeader
        title="Spend alerts"
        description="Daily total and per-user outlier alerts. Alerts are deduplicated by day and user."
      />
      {params.checked ? (
        <p className="text-sm text-muted-foreground">
          Checked. Total ${params.total}. {params.outliers ?? "0"} outliers.
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Daily total</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">Alert at ${thresholds.dailyUsd.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>User outlier</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              At least ${thresholds.userUsd.toFixed(2)} and {thresholds.userMultiple}x the median
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recipients</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              {recipients.length > 0 ? recipients.join(", ") : "SPEND_ALERT_EMAILS is empty"}
            </p>
          </CardContent>
        </Card>
      </div>
      <form action={checkSpendAlerts}>
        <SubmitButton loadingText="Checking...">Check now</SubmitButton>
      </form>
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Day</TableHead>
              <TableHead>Kind</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Amount USD</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {alerts.map((alert) => (
              <TableRow key={alert.id}>
                <TableCell>{alert.day.toISOString().slice(0, 10)}</TableCell>
                <TableCell>{alert.kind}</TableCell>
                <TableCell>{alert.userId ?? ""}</TableCell>
                <TableCell>{Number(alert.amountUsd).toFixed(4)}</TableCell>
                <TableCell>{alert.createdAt.toISOString().slice(0, 16).replace("T", " ")}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
