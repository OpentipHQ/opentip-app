import { AppShell } from "@/components/shell/app-shell";
import { adminNav } from "@/components/shell/nav";
import { requireAdminPage } from "@/lib/admin/guard";
import { readActAs } from "@/lib/admin/act-as";
import { loadCurrentUser } from "@/lib/profile/user";
import { devBypassEnabled } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAdminPage();
  const user = await loadCurrentUser(session);
  const actAs = await readActAs();
  return (
    <AppShell
      items={adminNav}
      user={user}
      actAs={actAs ? { login: actAs.login, name: actAs.name } : null}
      devPreview={devBypassEnabled()}
    >
      {children}
    </AppShell>
  );
}
