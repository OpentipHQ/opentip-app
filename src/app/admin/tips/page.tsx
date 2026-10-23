import { PageHeader } from "@/components/shell/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default function TipsPage() {
  return (
    <>
      <PageHeader
        title="Tips"
        description="A later overview of tips sent to a project."
      />
      <Card>
        <CardHeader>
          <CardTitle>Not in this release</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-6 text-muted-foreground">
            Tips are not part of this release. When they ship, a tip can be ETH or USDC.
          </p>
        </CardContent>
      </Card>
    </>
  );
}
