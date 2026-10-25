import { PageHeader } from "@/components/shell/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getPrisma } from "@/lib/db";

export const dynamic = "force-dynamic";

type UserTotal = {
  id: string;
  login: string;
  email: string | null;
  jobs: number;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
};

export default async function AdminUsagePage() {
  const prisma = getPrisma();
  const rows = prisma
    ? await prisma.usageEntry.findMany({
        select: {
          promptTokens: true,
          completionTokens: true,
          estimatedCostUsd: true,
          repo: {
            select: {
              installation: {
                select: {
                  user: { select: { id: true, login: true, email: true } },
                },
              },
            },
          },
        },
      })
    : [];
  const totals = new Map<string, UserTotal>();
  let allCost = 0;
  let allTokens = 0;
  for (const row of rows) {
    const user = row.repo.installation.user;
    if (!user) continue;
    const current =
      totals.get(user.id) ??
      ({
        id: user.id,
        login: user.login,
        email: user.email,
        jobs: 0,
        promptTokens: 0,
        completionTokens: 0,
        costUsd: 0,
      } satisfies UserTotal);
    current.jobs += 1;
    current.promptTokens += row.promptTokens;
    current.completionTokens += row.completionTokens;
    current.costUsd += Number(row.estimatedCostUsd);
    allCost += Number(row.estimatedCostUsd);
    allTokens += row.promptTokens + row.completionTokens;
    totals.set(user.id, current);
  }
  const users = Array.from(totals.values()).sort((left, right) => right.costUsd - left.costUsd);

  return (
    <>
      <PageHeader
        title="AI usage and costs"
        description="Token totals and estimated spend per user. These are internal estimates, not invoices."
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Estimated spend</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl tracking-tight">${allCost.toFixed(4)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Tokens</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl tracking-tight">{allTokens.toLocaleString("en")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Jobs accounted</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl tracking-tight">{rows.length}</p>
          </CardContent>
        </Card>
      </div>
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Jobs</TableHead>
              <TableHead>Prompt</TableHead>
              <TableHead>Completion</TableHead>
              <TableHead>Estimated USD</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  {user.login}
                  <p className="text-xs text-muted-foreground">{user.email ?? ""}</p>
                </TableCell>
                <TableCell>{user.jobs}</TableCell>
                <TableCell>{user.promptTokens.toLocaleString("en")}</TableCell>
                <TableCell>{user.completionTokens.toLocaleString("en")}</TableCell>
                <TableCell>{user.costUsd.toFixed(4)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
