import { redirect } from "next/navigation";
import { getViewSession } from "@/lib/admin/act-as";
import { getPrisma } from "@/lib/db";

export async function redirectSite(id: string, section = "") {
  const session = await getViewSession();
  if (!session) redirect(`/login?next=/dashboard/sites/${id}`);
  const prisma = getPrisma();
  const site = prisma
    ? await prisma.site.findFirst({
        where: { id, ownerId: session.userId },
        select: { subdomain: true },
      })
    : null;
  redirect(site ? `/dashboard/w/${site.subdomain}${section}` : "/dashboard");
}
