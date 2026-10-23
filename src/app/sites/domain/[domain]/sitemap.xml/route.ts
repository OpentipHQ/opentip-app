import { getSiteByDomain } from "@/lib/sites/load";
import { sitemapXml } from "@/lib/sites/seo";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ domain: string }> },
) {
  const { domain } = await context.params;
  const site = await getSiteByDomain(domain);
  if (!site) return new Response("Not found", { status: 404 });
  return new Response(sitemapXml(site), {
    headers: { "content-type": "application/xml; charset=utf-8" },
  });
}
