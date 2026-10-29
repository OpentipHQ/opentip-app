import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getViewSession } from "@/lib/admin/act-as";
import { blockActAsWrites } from "@/lib/admin/guard";
import { getPrisma } from "@/lib/db";
import { SubmitButton } from "@/components/ui/submit-button";
import { redirectWithToast } from "@/lib/toast-server";

export const dynamic = "force-dynamic";

async function sendFeedback(formData: FormData) {
  "use server";
  const session = await getViewSession();
  if (!session) redirect("/login?next=/dashboard/feedback");
  await blockActAsWrites();
  const message = String(formData.get("message") ?? "").trim();
  const prisma = getPrisma();
  if (!prisma || !message) {
    return redirectWithToast("/dashboard/feedback", "error", "Write a message.");
  }
  await prisma.feedback.create({
    data: { userId: session.userId, message: message.slice(0, 4_000) },
  });
  revalidatePath("/admin/feedback");
  return redirectWithToast("/dashboard/feedback", "success", "Sent.");
}

export default function FeedbackPage() {
  return (
    <form action={sendFeedback} className="flex max-w-xl flex-col gap-3">
      <h1 className="text-2xl">Feedback</h1>
      <textarea name="message" required rows={5} className="rounded-control border border-border bg-background px-3 py-2 text-sm" />
      <SubmitButton className="w-fit">Send</SubmitButton>
    </form>
  );
}
