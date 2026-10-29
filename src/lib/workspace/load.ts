import { docsRootDomain } from "@/lib/config";
import { getPrisma } from "@/lib/db";
import type { Session } from "@/lib/session";

export type WorkspacePage = {
  id: string;
  slug: string;
  title: string;
  section: string | null;
  published: boolean;
  content: string;
};

export type WorkspaceRecord = {
  id: string;
  name: string;
  subdomain: string;
  description: string | null;
  status: "PENDING" | "ACTIVE" | "PAUSED";
  reviewMode: "AUTO_PUBLISH" | "REVIEW";
  theme: "LEDGER" | "MINIMAL";
  appearance: "SYSTEM" | "LIGHT" | "DARK";
  primaryColor: string;
  logoLightUrl: string | null;
  logoDarkUrl: string | null;
  faviconUrl: string | null;
  logoHref: string | null;
  privateSite: boolean;
  previewNoindex: boolean;
  tipButton: boolean;
  tipEth: boolean;
  tipUsdc: boolean;
  payoutWallet: string | null;
  customDomain: string | null;
  customDomainStatus: string | null;
  ownerLogin: string;
  repoOwner: string;
  repoName: string;
  repoFullName: string;
  branch: string;
  publicHost: string;
  pages: WorkspacePage[];
  pending: Array<{
    id: string;
    slug: string;
    title: string;
    section: string | null;
    content: string;
    changeNote: string | null;
  }>;
  jobs: Array<{
    id: string;
    kind: string;
    status: string;
    error: string | null;
    createdAt: string;
    finishedAt: string | null;
  }>;
  chats: Array<{
    id: string;
    instruction: string;
    createdAt: string;
    status: string | null;
    error: string | null;
  }>;
  changelog: Array<{
    id: string;
    title: string;
    body: string;
    publishedAt: string;
    source: string;
  }>;
};

export async function loadWorkspaces(session: Session) {
  const prisma = getPrisma();
  if (!prisma) return [];
  const sites = await prisma.site.findMany({
    where: { ownerId: session.userId },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      subdomain: true,
      status: true,
      repo: { select: { owner: true, name: true, fullName: true } },
      _count: { select: { pages: true } },
    },
  });
  return sites.map((site) => ({
    id: site.id,
    name: site.name,
    subdomain: site.subdomain,
    status: site.status,
    owner: site.repo.owner,
    repo: site.repo.name,
    fullName: site.repo.fullName,
    pages: site._count.pages,
    host: `${site.subdomain}.${docsRootDomain()}`,
  }));
}

export async function loadWorkspace(
  session: Session,
  subdomain: string,
): Promise<WorkspaceRecord | null> {
  const prisma = getPrisma();
  if (!prisma) return null;
  const site = await prisma.site.findFirst({
    where: { subdomain, ownerId: session.userId },
    include: {
      owner: { select: { login: true } },
      repo: { select: { owner: true, name: true, fullName: true, defaultBranch: true } },
      pages: { orderBy: [{ navOrder: "asc" }, { title: "asc" }] },
      revisions: {
        where: { status: "PENDING" },
        orderBy: { createdAt: "desc" },
      },
      worklog: { orderBy: { publishedAt: "desc" }, take: 30 },
      chatEdits: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { job: { select: { status: true, error: true } } },
      },
    },
  });
  if (!site) return null;
  const jobs = await prisma.job.findMany({
    where: { repoId: site.repoId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      kind: true,
      status: true,
      error: true,
      createdAt: true,
      finishedAt: true,
    },
  });
  return {
    id: site.id,
    name: site.name,
    subdomain: site.subdomain,
    description: site.description,
    status: site.status,
    reviewMode: site.reviewMode,
    theme: site.theme,
    appearance: site.appearance,
    primaryColor: site.primaryColor,
    logoLightUrl: site.logoLightUrl,
    logoDarkUrl: site.logoDarkUrl,
    faviconUrl: site.faviconUrl,
    logoHref: site.logoHref,
    privateSite: site.privateSite,
    previewNoindex: site.previewNoindex,
    tipButton: site.tipButton,
    tipEth: site.tipEth,
    tipUsdc: site.tipUsdc,
    payoutWallet: site.payoutWallet,
    customDomain: site.customDomain,
    customDomainStatus: site.customDomainStatus,
    ownerLogin: site.owner.login,
    repoOwner: site.repo.owner,
    repoName: site.repo.name,
    repoFullName: site.repo.fullName,
    branch: site.repo.defaultBranch,
    publicHost: `${site.subdomain}.${docsRootDomain()}`,
    pages: site.pages.map((page) => ({
      id: page.id,
      slug: page.slug,
      title: page.title,
      section: page.section,
      published: page.published,
      content: page.content,
    })),
    pending: site.revisions.map((revision) => ({
      id: revision.id,
      slug: revision.slug,
      title: revision.title,
      section: revision.section,
      content: revision.content,
      changeNote: revision.changeNote,
    })),
    jobs: jobs.map((job) => ({
      id: job.id,
      kind: job.kind,
      status: job.status,
      error: job.error,
      createdAt: job.createdAt.toISOString(),
      finishedAt: job.finishedAt?.toISOString() ?? null,
    })),
    chats: site.chatEdits.map((chat) => ({
      id: chat.id,
      instruction: chat.instruction,
      createdAt: chat.createdAt.toISOString(),
      status: chat.job?.status ?? null,
      error: chat.job?.error ?? null,
    })),
    changelog: site.worklog.map((entry) => ({
      id: entry.id,
      title: entry.title,
      body: entry.body,
      publishedAt: entry.publishedAt.toISOString(),
      source: entry.source,
    })),
  };
}
