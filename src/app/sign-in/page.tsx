import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { devBypassEnabled } from "@/lib/session";

const errors: Record<string, string> = {
  state: "The sign-in attempt expired. Try again.",
  github: "GitHub did not complete sign-in. Check the app client id and secret.",
  database: "The database is not connected, so the account could not be saved.",
  session: "SESSION_SECRET is missing.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; invite?: string; next?: string }>;
}) {
  const params = await searchParams;
  const error = params.error ? errors[params.error] : null;
  const invite = params.invite;
  const href = invite ? `/api/auth/github?invite=${encodeURIComponent(invite)}` : "/api/auth/github";
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-16">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>
            Use the Opentip GitHub App. The same app keeps docs updated on every push.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button nativeButton={false} render={<Link href={href} />}>
            Sign in with GitHub
          </Button>
          {devBypassEnabled() ? (
            <p className="text-sm leading-6 text-muted-foreground">
              Dev preview is on, so the dashboard opens without GitHub.{" "}
              <Link href="/dashboard" className="text-primary underline underline-offset-4">
                Open the dashboard
              </Link>
              .
            </p>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
