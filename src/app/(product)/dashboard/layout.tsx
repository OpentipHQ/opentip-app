import { redirect } from "next/navigation";
import { LowBalanceBanner } from "@/components/credits/low-balance";
import { ProductFrame } from "@/components/product/product-frame";
import { getRequestSession } from "@/lib/auth";
import { getViewSession, readActAs } from "@/lib/admin/act-as";
import { loadCurrentUser } from "@/lib/profile/user";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getRequestSession();
  if (!session) redirect("/login?next=/dashboard");
  const view = (await getViewSession()) ?? session;
  const actAs = await readActAs();
  const user = await loadCurrentUser(view);
  return (
    <ProductFrame
      user={user}
      actAs={actAs ? { login: actAs.login, name: actAs.name } : null}
      banner={<LowBalanceBanner userId={view.userId} />}
    >
      {children}
    </ProductFrame>
  );
}
