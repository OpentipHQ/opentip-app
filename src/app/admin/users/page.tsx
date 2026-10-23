import { RowsTable } from "@/components/admin/table";
import { PageHeader } from "@/components/shell/page-header";
import { loadAdminSnapshot } from "@/lib/view-data";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const snapshot = await loadAdminSnapshot();
  return (
    <>
      <PageHeader
        title="Users"
        description="People who signed in with the Opentip Copilot GitHub App. Admin is a role on the user row."
      />
      <RowsTable
        columns={["Login", "Email", "Role", "Joined"]}
        rows={snapshot.users.map((row) => [
          row.login,
          row.email ?? "",
          row.role,
          row.createdAt.slice(0, 10),
        ])}
        empty="No users yet."
      />
    </>
  );
}
