import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getPrisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  const prisma = getPrisma();
  const rows = prisma
    ? await prisma.activityLog.findMany({ orderBy: { createdAt: "desc" }, take: 200 })
    : [];
  return (
    <>
      <PageHeader
        title="Activity log"
        description="Admin actions with the actor, target, and timestamp. The snapshot stays after a user is deleted."
      />
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Metadata</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.createdAt.toISOString().slice(0, 16).replace("T", " ")}</TableCell>
                <TableCell>{row.actorEmail ?? row.actorId ?? "System"}</TableCell>
                <TableCell>{row.action}</TableCell>
                <TableCell>
                  {row.targetType ? `${row.targetType}: ${row.targetId ?? ""}` : ""}
                </TableCell>
                <TableCell className="max-w-64 truncate font-mono text-xs text-muted-foreground">
                  {row.metadata ? JSON.stringify(row.metadata) : ""}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
