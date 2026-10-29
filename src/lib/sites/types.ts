export type DocsPage = {
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
};

export type DocsSite = {
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
  repoFullName: string | null;
  repoBranch: string | null;
  pages: DocsPage[];
  source: "database" | "preview";
};
