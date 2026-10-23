import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocsRoute } from "@/components/docs/docs-route";
import { getSiteByDomain } from "@/lib/sites/load";
import { docsBasePath, docsPageMetadata, requestDocsContext } from "@/lib/sites/metadata";

export const dynamic = "force-dynamic";

type Params = { domain: string; slug?: string[] };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { domain, slug } = await params;
  const site = await getSiteByDomain(domain);
  if (!site) return { title: "Not found" };
  const { origin } = await requestDocsContext();
  return docsPageMetadata(site, (slug ?? []).join("/"), origin);
}

export default async function DomainDocsPage({ params }: { params: Promise<Params> }) {
  const { domain, slug } = await params;
  const site = await getSiteByDomain(domain);
  if (!site) notFound();
  const { publicHost } = await requestDocsContext();
  return (
    <DocsRoute
      site={site}
      slug={(slug ?? []).join("/")}
      basePath={docsBasePath({ publicHost, domain })}
    />
  );
}
