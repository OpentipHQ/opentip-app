import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { adminNav } from "@/components/shell/nav";
import { getRequestSession } from "@/lib/auth";
import { devBypassEnabled } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getRequestSession();
  if (!session) redirect("/sign-in?next=/admin");
  if (session.role !== "ADMIN") redirect("/dashboard");
  return (
    <AppShell
      items={adminNav}
      userLabel={session.login}
      devPreview={devBypassEnabled()}
    >
      {children}
    </AppShell>
  );
}
