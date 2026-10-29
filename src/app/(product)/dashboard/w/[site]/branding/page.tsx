import { notFound } from "next/navigation";
import { saveWorkspaceAction } from "@/app/(product)/dashboard/w/[site]/actions";
import { SubmitButton } from "@/components/ui/submit-button";
import { getViewSession } from "@/lib/admin/act-as";
import { loadWorkspace } from "@/lib/workspace/load";

export const dynamic = "force-dynamic";

const field = "h-9 rounded-control border border-border bg-background px-3 text-sm";

export default async function BrandingSection({ params }: { params: Promise<{ site: string }> }) {
  const session = await getViewSession();
  if (!session) return null;
  const site = await loadWorkspace(session, (await params).site);
  if (!site) notFound();
  return (
    <div className="grid gap-6 p-6 xl:grid-cols-[1fr_360px]">
      <form action={saveWorkspaceAction} className="flex flex-col gap-4">
        <h1 className="text-2xl">Branding</h1>
        <input type="hidden" name="kind" value="branding" />
        <input type="hidden" name="siteId" value={site.id} />
        <input type="hidden" name="subdomain" value={site.subdomain} />
        <input type="hidden" name="section" value="/branding" />
        <label className="flex flex-col gap-1 text-sm">
          Logo, light
          <input name="logoLightUrl" defaultValue={site.logoLightUrl ?? ""} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Logo, dark
          <input name="logoDarkUrl" defaultValue={site.logoDarkUrl ?? ""} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Favicon
          <input name="faviconUrl" defaultValue={site.faviconUrl ?? ""} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Primary color
          <input name="primaryColor" defaultValue={site.primaryColor} className={field} />
        </label>
        <div className="flex gap-2">
          {(["LEDGER", "MINIMAL"] as const).map((theme) => (
            <label key={theme} className="flex items-center gap-2 rounded-control border border-border px-3 py-2 text-sm">
              <input type="radio" name="theme" value={theme} defaultChecked={site.theme === theme} />
              {theme === "LEDGER" ? "Ledger" : "Minimal"}
            </label>
          ))}
        </div>
        <SubmitButton className="w-fit">Save branding</SubmitButton>
      </form>
      <iframe title="Branding preview" src={`/preview/${site.subdomain}`} className="h-[640px] w-full rounded-control border border-border bg-white" />
    </div>
  );
}
