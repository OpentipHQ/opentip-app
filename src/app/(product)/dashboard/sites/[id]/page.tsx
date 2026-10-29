import { redirectSite } from "@/lib/workspace/redirect";

export default async function SiteRedirect({ params }: { params: Promise<{ id: string }> }) {
  await redirectSite((await params).id);
}
