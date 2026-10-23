import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center gap-4 px-6">
      <h1 className="text-3xl tracking-tight">Page not found</h1>
      <p className="text-sm leading-6 text-muted-foreground">
        That page is not on this host.
      </p>
      <Button nativeButton={false} variant="outline" render={<Link href="/" />}>
        Back home
      </Button>
    </main>
  );
}
