import { redirectSite } from "@/lib/workspace/redirect";

export default async function ChatRedirect({ params }: { params: Promise<{ id: string }> }) {
  await redirectSite((await params).id);
}
