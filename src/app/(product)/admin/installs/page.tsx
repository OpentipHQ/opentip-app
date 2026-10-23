import { RowsTable } from "@/components/admin/table";
import { PageHeader } from "@/components/shell/page-header";
import { loadAdminSnapshot } from "@/lib/view-data";

export const dynamic = "force-dynamic";

export default async function InstallsPage() {
  const snapshot = await loadAdminSnapshot();
  return (
    <>
      <PageHeader
        title="Installs"
        description="GitHub App installations. Uninstall pauses the connected sites."
      />
      <RowsTable
        columns={["Account", "Type", "Repos", "Uninstalled"]}
        rows={snapshot.installs.map((row) => [
          row.accountLogin,
          row.accountType,
          String(row.repoCount),
          row.uninstalledAt ? row.uninstalledAt.slice(0, 10) : "Active",
        ])}
        empty="No installations recorded."
      />
    </>
  );
}
