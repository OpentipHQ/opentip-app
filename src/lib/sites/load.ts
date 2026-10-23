import { sanitizeColor } from "@/lib/brand";
import { docsRootDomain } from "@/lib/config";
import { getPrisma } from "@/lib/db";
import { sampleSite, SAMPLE_SUBDOMAIN } from "@/lib/sites/sample";
import type { DocsPage, DocsSite } from "@/lib/sites/types";

type SiteRecord = {
  id: string;
  name: string;
  description: string | null;
  subdomain: string;
  customDomain: string | null;
  customDomainStatus: string | null;
  status: "PENDING" | "ACTIVE" | "PAUSED";
  pausedReason: string | null;
  theme: "LEDGER" | "MINIMAL";
  appearance: "SYSTEM" | "LIGHT" | "DARK";
  primaryColor: string;
  logoLightUrl: string | null;
  logoDarkUrl: string | null;
  faviconUrl: string | null;
  logoHref: string | null;
  ogBackgroundUrl: string | null;
  ogImageUrl: string | null;
  pages: Array<{
    slug: string;
    section: string | null;
    title: string;
    description: string | null;
    content: string;
    navOrder: number;
    published: boolean;
    noindex: boolean;
    handEdited: boolean;
    ogImageUrl: string | null;
  }>;
};

function mapSite(site: SiteRecord): DocsSite {
  const pages: DocsPage[] = site.pages.map((page) => ({
    slug: page.slug,
    section: page.section,
    title: page.title,
    description: page.description,
    content: page.content,
    navOrder: page.navOrder,
    published: page.published,
    noindex: page.noindex,
    handEdited: page.handEdited,
    ogImageUrl: page.ogImageUrl,
  }));
  return {
    ...site,
    primaryColor: sanitizeColor(site.primaryColor),
    pages,
    source: "database",
  };
}

const include = {
  pages: { orderBy: { navOrder: "asc" as const } },
};

export async function getSiteBySubdomain(subdomain: string): Promise<DocsSite | null> {
  const prisma = getPrisma();
  if (!prisma) {
    return subdomain === SAMPLE_SUBDOMAIN ? sampleSite() : null;
  }
  try {
    const site = await prisma.site.findUnique({
      where: { subdomain },
      include,
    });
    return site ? mapSite(site) : null;
  } catch {
    return subdomain === SAMPLE_SUBDOMAIN ? sampleSite() : null;
  }
}

export async function getSiteByDomain(host: string): Promise<DocsSite | null> {
  const prisma = getPrisma();
  if (!prisma) return null;
  try {
    const site = await prisma.site.findUnique({
      where: { customDomain: host },
      include,
    });
    return site ? mapSite(site) : null;
  } catch {
    return null;
  }
}

export function canonicalOrigin(site: DocsSite): string {
  if (site.customDomain && site.customDomainStatus === "active") {
    return `https://${site.customDomain}`;
  }
  return `https://${site.subdomain}.${docsRootDomain()}`;
}

export function pagePath(slug: string): string {
  return slug ? `/${slug}` : "/";
}

export function findPage(site: DocsSite, slug: string): DocsPage | null {
  return site.pages.find((page) => page.slug === slug && page.published) ?? null;
}

export function publicPages(site: DocsSite): DocsPage[] {
  if (site.status === "PAUSED") return [];
  return site.pages.filter((page) => page.published && !page.noindex);
}
