import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getPrisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function InstallsPage() {
  const prisma = getPrisma();
  const [installs, errors] = prisma
    ? await Promise.all([
        prisma.installation.findMany({
          include: {
            user: { select: { login: true } },
            _count: { select: { repos: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 100,
        }),
        prisma.webhookError.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
      ])
    : [[], []];
  return (
    <>
      <PageHeader
        title="GitHub installs"
        description="Active and uninstalled GitHub App installations, connected repos, and recent webhook errors."
      />
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Account</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Repos</TableHead>
              <TableHead>State</TableHead>
              <TableHead>Manage</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {installs.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.accountLogin}</TableCell>
                <TableCell>{row.accountType}</TableCell>
                <TableCell>{row.user?.login ?? ""}</TableCell>
                <TableCell>{row._count.repos}</TableCell>
                <TableCell>
                  <Badge variant={row.uninstalledAt || row.suspendedAt ? "destructive" : "secondary"}>
                    {row.uninstalledAt ? "Uninstalled" : row.suspendedAt ? "Suspended" : "Active"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <a
                    className="underline underline-offset-4"
                    href={`https://github.com/settings/installations/${row.githubInstallationId}`}
                  >
                    GitHub
                  </a>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent webhook errors</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {errors.length === 0 ? (
            <p className="text-sm text-muted-foreground">No webhook errors recorded.</p>
          ) : (
            errors.map((error) => (
              <div key={error.id} className="rounded-control border border-border p-3">
                <p className="text-sm font-medium">
                  {error.event} {error.action ? `(${error.action})` : ""}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {error.createdAt.toISOString()} · delivery {error.deliveryId}
                </p>
                <p className="mt-2 font-mono text-xs">{error.message}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </>
  );
}
