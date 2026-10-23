import { RowsTable } from "@/components/admin/table";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createBetaInvite } from "@/app/admin/invites/actions";
import { loadAdminSnapshot } from "@/lib/view-data";

export const dynamic = "force-dynamic";

export default async function InvitesPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; saved?: string; error?: string }>;
}) {
  const params = await searchParams;
  const snapshot = await loadAdminSnapshot();
  const note = params.sent
    ? "Invite email sent."
    : params.saved
      ? "Invite saved. Email was not sent because Resend is not configured."
      : params.error
        ? "Add a valid email and connect the database first."
        : null;
  return (
    <>
      <PageHeader
        title="Invites"
        description="Beta access is sent by email, one wave at a time."
      />
      <Card>
        <CardHeader>
          <CardTitle>New invite</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createBetaInvite} className="flex flex-col gap-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input id="email" name="email" type="email" required />
              </Field>
              <Field>
                <FieldLabel htmlFor="wave">Wave</FieldLabel>
                <Input id="wave" name="wave" type="number" min={1} defaultValue={1} />
              </Field>
            </FieldGroup>
            <Button type="submit" className="w-fit">
              Save invite
            </Button>
          </form>
          {note ? <p className="mt-4 text-sm text-muted-foreground">{note}</p> : null}
        </CardContent>
      </Card>
      <RowsTable
        columns={["Email", "Wave", "Sent", "Accepted"]}
        rows={snapshot.invites.map((row) => [
          row.email,
          String(row.wave),
          row.sentAt ? row.sentAt.slice(0, 10) : "Not sent",
          row.acceptedAt ? row.acceptedAt.slice(0, 10) : "Waiting",
        ])}
        empty="No invites yet."
      />
    </>
  );
}
