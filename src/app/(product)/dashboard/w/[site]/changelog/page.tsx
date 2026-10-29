import { notFound } from "next/navigation";
import { saveWorkspaceAction } from "@/app/(product)/dashboard/w/[site]/actions";
import { SubmitButton } from "@/components/ui/submit-button";
import { getViewSession } from "@/lib/admin/act-as";
import { loadWorkspace } from "@/lib/workspace/load";

export const dynamic = "force-dynamic";

export default async function ChangelogSection({ params }: { params: Promise<{ site: string }> }) {
  const session = await getViewSession();
  if (!session) return null;
  const site = await loadWorkspace(session, (await params).site);
  if (!site) notFound();
  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl">Changelog</h1>
      </div>
      <form action={saveWorkspaceAction} className="flex flex-col gap-2 rounded-control border border-border p-4">
        <input type="hidden" name="kind" value="changelog" />
        <input type="hidden" name="siteId" value={site.id} />
        <input type="hidden" name="subdomain" value={site.subdomain} />
        <input type="hidden" name="section" value="/changelog" />
        <input name="title" required placeholder="Title" className="h-9 rounded-control border border-border bg-background px-3 text-sm" />
        <textarea name="body" required rows={3} placeholder="Body" className="rounded-control border border-border bg-background px-3 py-2 text-sm" />
        <SubmitButton className="w-fit">Publish</SubmitButton>
      </form>
      <div className="flex flex-col gap-3">
        {site.changelog.map((entry) => (
          <article key={entry.id} className="rounded-control border border-border p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base">{entry.title}</h2>
              <span className="text-xs text-muted-foreground">{entry.publishedAt.slice(0, 10)}</span>
            </div>
            <p className="mt-2 text-sm whitespace-pre-wrap">{entry.body}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
