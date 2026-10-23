import { RowsTable } from "@/components/admin/table";
import { PageHeader } from "@/components/shell/page-header";
import { loadAdminSnapshot } from "@/lib/view-data";

export const dynamic = "force-dynamic";

export default async function AdminUsagePage() {
  const snapshot = await loadAdminSnapshot();
  return (
    <>
      <PageHeader
        title="Usage"
        description="Token totals and estimated spend per job. This page is for admins. The customer dashboard does not show it."
      />
      <RowsTable
        columns={["Repo", "Model", "Prompt", "Completion", "Estimate USD", "When"]}
        rows={snapshot.jobs.map((row) => [
          row.repo,
          row.model,
          String(row.promptTokens),
          String(row.completionTokens),
          row.estimatedCostUsd,
          row.createdAt.slice(0, 10),
        ])}
        empty="No jobs have been accounted yet."
      />
    </>
  );
}
