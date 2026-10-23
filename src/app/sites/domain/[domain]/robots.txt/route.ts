import { getSiteByDomain } from "@/lib/sites/load";
import { robotsTxt } from "@/lib/sites/seo";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ domain: string }> },
) {
  const { domain } = await context.params;
  const site = await getSiteByDomain(domain);
  if (!site) return new Response("Not found", { status: 404 });
  return new Response(robotsTxt(site), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
