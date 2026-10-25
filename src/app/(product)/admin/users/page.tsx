import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getPrisma } from "@/lib/db";
import { startActAs, suspendUser, unsuspendUser } from "./actions";

export const dynamic = "force-dynamic";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; error?: string }>;
}) {
  const params = await searchParams;
  const q = (params.q ?? "").trim().slice(0, 100);
  const prisma = getPrisma();
  const users = prisma
    ? await prisma.user.findMany({
        where: q
          ? {
              OR: [
                { login: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
                { name: { contains: q, mode: "insensitive" } },
              ],
            }
          : undefined,
        orderBy: { createdAt: "desc" },
        take: 100,
      })
    : [];
  return (
    <>
      <PageHeader
        title="Users"
        description="Search people, suspend access, open a detail view, or view the dashboard as a user. Act-as is read-only."
      />
      {params.error ? <p className="text-sm text-destructive">That user action failed.</p> : null}
      <form method="get" className="flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search login, name, or email"
          className="h-9 flex-1 rounded-full border border-border bg-white px-4 text-sm outline-none focus:border-foreground"
        />
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>
      {users.length === 0 ? (
        <Empty className="border border-border bg-card">
          <EmptyHeader>
            <EmptyTitle>No users found</EmptyTitle>
            <EmptyDescription>Try a different search.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <Link href={`/admin/users/${user.id}`} className="font-medium underline-offset-4 hover:underline">
                      {user.login}
                    </Link>
                    <p className="text-xs text-muted-foreground">{user.email ?? "No email"}</p>
                  </TableCell>
                  <TableCell>{user.role}</TableCell>
                  <TableCell>
                    {user.suspendedAt ? <Badge variant="destructive">Suspended</Badge> : <Badge variant="secondary">Active</Badge>}
                  </TableCell>
                  <TableCell>{user.createdAt.toISOString().slice(0, 10)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <form action={startActAs}>
                        <input type="hidden" name="id" value={user.id} />
                        <Button type="submit" size="sm" variant="outline">
                          View as
                        </Button>
                      </form>
                      {user.suspendedAt ? (
                        <form action={unsuspendUser}>
                          <input type="hidden" name="id" value={user.id} />
                          <Button type="submit" size="sm" variant="outline">
                            Unsuspend
                          </Button>
                        </form>
                      ) : (
                        <form action={suspendUser}>
                          <input type="hidden" name="id" value={user.id} />
                          <Button type="submit" size="sm" variant="destructive">
                            Suspend
                          </Button>
                        </form>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </>
  );
}
