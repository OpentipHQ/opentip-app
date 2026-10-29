import { redirectSite } from "@/lib/workspace/redirect";

export default async function RevisionRedirect({
  params,
}: {
  params: Promise<{ id: string; revisionId: string }>;
}) {
  await redirectSite((await params).id);
}
