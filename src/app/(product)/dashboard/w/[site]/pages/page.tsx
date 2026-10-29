import Link from "next/link";
import { notFound } from "next/navigation";
import { getViewSession } from "@/lib/admin/act-as";
import { loadWorkspace } from "@/lib/workspace/load";

export const dynamic = "force-dynamic";

export default async function PagesSection({ params }: { params: Promise<{ site: string }> }) {
  const session = await getViewSession();
  if (!session) return null;
  const site = await loadWorkspace(session, (await params).site);
  if (!site) notFound();
  const pending = new Set(site.pending.map((revision) => revision.slug));
  return (
    <div className="flex flex-col gap-4 p-6">
      <h1 className="text-2xl">Pages</h1>
      <div className="overflow-hidden rounded-control border border-border">
        {site.pages.map((page) => (
          <div key={page.id} className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-b-0">
            <div>
              <Link href={`/dashboard/w/${site.subdomain}`} className="text-sm text-link">
                {page.title}
              </Link>
              <p className="text-xs text-muted-foreground">{page.slug || "/"}</p>
            </div>
            <span className="text-sm text-muted-foreground">
              {pending.has(page.slug) ? "Draft" : page.published ? "Published" : "Hidden"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
