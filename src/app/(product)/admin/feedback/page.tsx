import { RowsTable } from "@/components/admin/table";
import { PageHeader } from "@/components/shell/page-header";
import { loadAdminSnapshot } from "@/lib/view-data";

export const dynamic = "force-dynamic";

export default async function FeedbackPage() {
  const snapshot = await loadAdminSnapshot();
  return (
    <>
      <PageHeader title="Feedback" description="Notes people send about the beta." />
      <RowsTable
        columns={["Message", "When"]}
        rows={snapshot.feedback.map((row) => [row.message, row.createdAt.slice(0, 10)])}
        empty="No feedback yet."
      />
    </>
  );
}
