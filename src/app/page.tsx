import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center gap-8 px-6 py-16">
      <p className="text-sm text-muted-foreground">Opentip</p>
      <div className="flex flex-col gap-3">
        <h1 className="text-4xl tracking-tight">Hosted docs and a Worklog for a GitHub repo.</h1>
        <p className="max-w-xl text-base leading-7 text-muted-foreground">
          Opentip writes the docs and updates them on every push. Sign in with the Opentip GitHub App. The beta app lives at beta.opentip.tech.
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button nativeButton={false} render={<Link href="/sign-in" />}>
          Sign in with GitHub
        </Button>
        <Button nativeButton={false} variant="outline" render={<Link href="/sites/sample" />}>
          View a preview site
        </Button>
      </div>
    </main>
  );
}
