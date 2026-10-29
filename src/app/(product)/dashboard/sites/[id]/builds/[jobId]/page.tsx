import { redirectSite } from "@/lib/workspace/redirect";

export default async function BuildRedirect({
  params,
}: {
  params: Promise<{ id: string; jobId: string }>;
}) {
  await redirectSite((await params).id, "/builds");
}
