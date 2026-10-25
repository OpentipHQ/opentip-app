import { PageHeader } from "@/components/shell/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default function TipsPage() {
  return (
    <>
      <PageHeader
        title="Tips"
        description="Read-only summary of tips sent to projects. Tips are ETH or USDC only."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>ETH</CardTitle>
            <CardDescription>No tips recorded.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              There is no Tip model or tip data in this release. This card stays empty.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>USDC</CardTitle>
            <CardDescription>No tips recorded.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              There is no Tip model or tip data in this release. This card stays empty.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
