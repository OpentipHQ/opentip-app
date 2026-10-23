import { RowsTable } from "@/components/admin/table";
import { PageHeader } from "@/components/shell/page-header";
import { loadAdminSnapshot } from "@/lib/view-data";

export const dynamic = "force-dynamic";

export default async function JobsPage() {
  const snapshot = await loadAdminSnapshot();
  return (
    <>
      <PageHeader
        title="Jobs"
        description="Queued Copilot work. A worker that runs these jobs is the next phase."
      />
      <RowsTable
        columns={["Repo", "Kind", "Status", "Provider", "Model"]}
        rows={snapshot.jobs.map((row) => [
          row.repo,
          row.kind,
          row.status,
          row.provider,
          row.model,
        ])}
        empty="No jobs queued."
      />
    </>
  );
}
