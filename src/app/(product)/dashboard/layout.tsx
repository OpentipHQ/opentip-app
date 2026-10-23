import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { dashboardNav } from "@/components/shell/nav";
import { getRequestSession } from "@/lib/auth";
import { devBypassEnabled } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getRequestSession();
  if (!session) redirect("/login?next=/dashboard");
  return (
    <AppShell
      items={dashboardNav}
      userLabel={session.login}
      devPreview={devBypassEnabled()}
    >
      {children}
    </AppShell>
  );
}
