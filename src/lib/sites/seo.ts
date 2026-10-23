import { canonicalOrigin, pagePath, publicPages } from "@/lib/sites/load";
import type { DocsSite } from "@/lib/sites/types";

export function sitemapXml(site: DocsSite): string {
  const origin = canonicalOrigin(site);
  const urls = publicPages(site)
    .map((page) => `  <url><loc>${escapeXml(`${origin}${pagePath(page.slug)}`)}</loc></url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export function robotsTxt(site: DocsSite): string {
  const origin = canonicalOrigin(site);
  if (site.status === "PAUSED") {
    return "User-agent: *\nDisallow: /\n";
  }
  return `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`;
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
