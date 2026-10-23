import { approveApplication } from "./actions";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { loadAdminSnapshot } from "@/lib/view-data";

export const dynamic = "force-dynamic";

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ approved?: string; error?: string }>;
}) {
  const params = await searchParams;
  const snapshot = await loadAdminSnapshot();
  return (
    <>
      <PageHeader
        title="Applications"
        description="Approve an application to add that email to the beta. Unapproved emails stay on the waitlist and cannot open the app."
      />
      {params.approved ? <p className="text-sm">Email approved.</p> : null}
      {params.error ? <p className="text-sm text-destructive">The application could not be approved.</p> : null}
      {snapshot.applications.length === 0 ? (
        <Empty className="border border-border bg-card">
          <EmptyHeader>
            <EmptyTitle>Nothing here yet</EmptyTitle>
            <EmptyDescription>
              The marketing site form writes to its own database until those rows are copied here.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>GitHub</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Access</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {snapshot.applications.map((row) => {
                const approved = row.status.toLowerCase() === "approved";
                return (
                  <TableRow key={row.id}>
                    <TableCell>{row.email}</TableCell>
                    <TableCell>{row.githubLogin ?? ""}</TableCell>
                    <TableCell>{row.status}</TableCell>
                    <TableCell>{row.createdAt.slice(0, 10)}</TableCell>
                    <TableCell>
                      {approved ? (
                        "Approved"
                      ) : (
                        <form action={approveApplication}>
                          <input type="hidden" name="id" value={row.id} />
                          <Button type="submit" size="sm">
                            Approve
                          </Button>
                        </form>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </>
  );
}
