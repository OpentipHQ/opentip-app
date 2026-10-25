import { AutoRefresh } from "@/components/admin/auto-refresh";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getPrisma } from "@/lib/db";
import { retryJob } from "./actions";

export const dynamic = "force-dynamic";

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ retried?: string; error?: string }>;
}) {
  const params = await searchParams;
  const prisma = getPrisma();
  const jobs = prisma
    ? await prisma.job.findMany({
        include: { repo: { select: { fullName: true } } },
        orderBy: { createdAt: "desc" },
        take: 100,
      })
    : [];
  return (
    <>
      <AutoRefresh />
      <PageHeader
        title="Docs jobs"
        description="Live queue. Failed jobs can be retried. This page refreshes every 10 seconds."
      />
      {params.retried ? <p className="text-sm text-muted-foreground">Job queued again.</p> : null}
      {params.error ? <p className="text-sm text-destructive">Only failed jobs can be retried.</p> : null}
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Repo</TableHead>
              <TableHead>Kind</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>Error</TableHead>
              <TableHead>Created</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.map((job) => (
              <TableRow key={job.id}>
                <TableCell>{job.repo.fullName}</TableCell>
                <TableCell>{job.kind}</TableCell>
                <TableCell>
                  <Badge variant={job.status === "FAILED" ? "destructive" : "secondary"}>{job.status}</Badge>
                </TableCell>
                <TableCell>{job.model}</TableCell>
                <TableCell className="max-w-56 truncate text-xs text-muted-foreground" title={job.error ?? ""}>
                  {job.error ?? ""}
                </TableCell>
                <TableCell>{job.createdAt.toISOString().slice(0, 16).replace("T", " ")}</TableCell>
                <TableCell>
                  {job.status === "FAILED" ? (
                    <form action={retryJob}>
                      <input type="hidden" name="id" value={job.id} />
                      <Button type="submit" size="sm" variant="outline">
                        Retry
                      </Button>
                    </form>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
