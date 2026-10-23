import { getSiteBySubdomain } from "@/lib/sites/load";
import { sitemapXml } from "@/lib/sites/seo";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ subdomain: string }> },
) {
  const { subdomain } = await context.params;
  const site = await getSiteBySubdomain(subdomain);
  if (!site) return new Response("Not found", { status: 404 });
  return new Response(sitemapXml(site), {
    headers: { "content-type": "application/xml; charset=utf-8" },
  });
}
