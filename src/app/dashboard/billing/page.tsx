import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { showPlanPrices } from "@/lib/config";
import { loadPlans } from "@/lib/view-data";

export const dynamic = "force-dynamic";

const details: Record<string, string[]> = {
  FREE: ["Subdomain on opentip.tech", "Ledger and Minimal themes", "Docs updated on every push"],
  PRO: ["Custom domain", "Higher daily build cap", "Everything on Free"],
  TEAM: ["Custom domain", "Higher daily build cap for more repos", "Everything on Pro"],
};

export default async function BillingPage() {
  const plans = await loadPlans();
  const prices = showPlanPrices();
  return (
    <>
      <PageHeader
        title="Billing"
        description="Prices stay hidden during beta. Checkout is not connected yet."
      />
      <div className="grid gap-4 lg:grid-cols-3">
        {plans.map((plan) => (
          <Card key={plan.tier}>
            <CardHeader>
              <CardTitle>{plan.name}</CardTitle>
              <CardDescription>
                {prices ? formatPrice(plan.priceCents) : "Price hidden during beta"}
              </CardDescription>
              {plan.tier === "FREE" ? <Badge variant="secondary">Beta</Badge> : null}
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-2 text-sm leading-6">
                {(details[plan.tier] ?? []).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button variant="outline" disabled>
                {plan.tier === "FREE" ? "Included with beta" : "Not open yet"}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </>
  );
}

function formatPrice(cents: number): string {
  if (cents === 0) return "$0 a month";
  return `$${cents / 100} a month`;
}
