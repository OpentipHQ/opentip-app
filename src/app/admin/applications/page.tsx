import { RowsTable } from "@/components/admin/table";
import { PageHeader } from "@/components/shell/page-header";
import { loadAdminSnapshot } from "@/lib/view-data";

export const dynamic = "force-dynamic";

export default async function ApplicationsPage() {
  const snapshot = await loadAdminSnapshot();
  return (
    <>
      <PageHeader
        title="Applications"
        description="Beta applications stored in this app. The marketing site form writes to its own database until those rows are copied here."
      />
      <RowsTable
        columns={["Email", "GitHub", "Status", "Created"]}
        rows={snapshot.applications.map((row) => [
          row.email,
          row.githubLogin ?? "",
          row.status,
          row.createdAt.slice(0, 10),
        ])}
        empty="No applications in this database yet."
      />
    </>
  );
}
