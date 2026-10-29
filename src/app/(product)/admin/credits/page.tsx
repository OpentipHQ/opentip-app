import { revalidatePath } from "next/cache";
import { requireWritableAdminAction } from "@/lib/admin/guard";
import { getPrisma } from "@/lib/db";
import { SubmitButton } from "@/components/ui/submit-button";
import { redirectWithToast } from "@/lib/toast-server";

export const dynamic = "force-dynamic";

async function closeCreditRequest(formData: FormData) {
  "use server";
  await requireWritableAdminAction();
  const id = String(formData.get("id") ?? "");
  const prisma = getPrisma();
  if (!prisma || !id) return redirectWithToast("/admin/credits", "error", "Request not found.");
  await prisma.creditRequest.update({ where: { id }, data: { status: "DONE" } });
  revalidatePath("/admin/credits");
  return redirectWithToast("/admin/credits", "success", "Closed.");
}

export default async function AdminCreditsPage() {
  const prisma = getPrisma();
  const requests = prisma
    ? await prisma.creditRequest.findMany({
        where: { status: "OPEN" },
        orderBy: { createdAt: "desc" },
        include: { user: { select: { id: true, login: true, creditBalance: true } } },
      })
    : [];
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl">Credits</h1>
      <div className="overflow-hidden rounded-control border border-border">
        {requests.length === 0 ? <p className="px-4 py-3 text-sm text-muted-foreground">None</p> : null}
        {requests.map((request) => (
          <div key={request.id} className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-b-0">
            <div>
              <p className="text-sm">{request.user.login}</p>
              <p className="text-xs text-muted-foreground">
                {request.user.creditBalance} · {request.createdAt.toISOString().slice(0, 16).replace("T", " ")}
              </p>
            </div>
            <form action={closeCreditRequest}>
              <input type="hidden" name="id" value={request.id} />
              <SubmitButton size="sm" variant="outline">
                Done
              </SubmitButton>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}
