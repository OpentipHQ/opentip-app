import { RowsTable } from "@/components/admin/table";
import { PageHeader } from "@/components/shell/page-header";
import { loadAdminSnapshot } from "@/lib/view-data";

export const dynamic = "force-dynamic";

export default async function PlansPage() {
  const snapshot = await loadAdminSnapshot();
  return (
    <>
      <PageHeader
        title="Plans"
        description="Stored prices. The billing page hides them during beta."
      />
      <RowsTable
        columns={["Plan", "USD / month", "Custom domain", "Repo daily cap USD"]}
        rows={snapshot.plans.map((plan) => [
          plan.name,
          (plan.priceCents / 100).toFixed(0),
          plan.customDomain ? "Yes" : "No",
          plan.dailyRepoCapUsd.toFixed(2),
        ])}
        empty="No plans stored."
      />
    </>
  );
}
