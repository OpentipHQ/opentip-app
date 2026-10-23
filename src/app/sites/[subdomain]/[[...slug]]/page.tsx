import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocsRoute } from "@/components/docs/docs-route";
import { getSiteBySubdomain } from "@/lib/sites/load";
import { docsBasePath, docsPageMetadata, requestDocsContext } from "@/lib/sites/metadata";

export const dynamic = "force-dynamic";

type Params = { subdomain: string; slug?: string[] };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { subdomain, slug } = await params;
  const site = await getSiteBySubdomain(subdomain);
  if (!site) return { title: "Not found" };
  const { origin } = await requestDocsContext();
  return docsPageMetadata(site, (slug ?? []).join("/"), origin);
}

export default async function SubdomainDocsPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { subdomain, slug } = await params;
  const site = await getSiteBySubdomain(subdomain);
  if (!site) notFound();
  const { publicHost } = await requestDocsContext();
  return (
    <DocsRoute
      site={site}
      slug={(slug ?? []).join("/")}
      basePath={docsBasePath({ publicHost, subdomain })}
    />
  );
}
