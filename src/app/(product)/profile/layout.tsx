import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { dashboardNav } from "@/components/shell/nav";
import { getRequestSession } from "@/lib/auth";
import { getViewSession, readActAs } from "@/lib/admin/act-as";
import { loadActiveAnnouncement } from "@/lib/announcements";
import { loadCurrentUser } from "@/lib/profile/user";
import { devBypassEnabled } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getRequestSession();
  if (!session) redirect("/login?next=/profile");
  const view = (await getViewSession()) ?? session;
  const actAs = await readActAs();
  const user = await loadCurrentUser(view);
  const announcement = await loadActiveAnnouncement();
  return (
    <AppShell
      items={dashboardNav}
      user={user}
      actAs={actAs ? { login: actAs.login, name: actAs.name } : null}
      devPreview={devBypassEnabled()}
      announcement={announcement}
    >
      {children}
    </AppShell>
  );
}
