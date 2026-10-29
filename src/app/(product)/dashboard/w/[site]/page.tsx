import { notFound } from "next/navigation";
import { PreviewChat } from "@/components/workspace/preview-chat";
import { getViewSession } from "@/lib/admin/act-as";
import { loadWorkspace } from "@/lib/workspace/load";

export const dynamic = "force-dynamic";

export default async function WorkspacePreviewPage({
  params,
}: {
  params: Promise<{ site: string }>;
}) {
  const session = await getViewSession();
  if (!session) return null;
  const { site: subdomain } = await params;
  const site = await loadWorkspace(session, subdomain);
  if (!site) notFound();
  const pendingSlugs = new Set(site.pending.map((revision) => revision.slug));
  return (
    <PreviewChat
      siteId={site.id}
      subdomain={site.subdomain}
      host={site.publicHost}
      pendingCount={site.pending.length}
      running={site.jobs.some((job) => job.status === "QUEUED" || job.status === "RUNNING")}
      pages={site.pages.map((page) => ({
        id: page.id,
        slug: page.slug,
        title: page.title,
        pending: pendingSlugs.has(page.slug),
      }))}
      chats={site.chats}
    />
  );
}
