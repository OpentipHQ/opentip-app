"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getViewSession } from "@/lib/admin/act-as";
import { blockActAsWrites } from "@/lib/admin/guard";
import { getPrisma } from "@/lib/db";
import { approveRevision, rejectRevision } from "@/lib/sites/publish";
import { redirectWithToast } from "@/lib/toast-server";

function pathFor(subdomain: string, section = "") {
  return `/dashboard/w/${subdomain}${section}`;
}

async function ownedSite(siteId: string, userId: string) {
  const prisma = getPrisma();
  if (!prisma) return null;
  return prisma.site.findFirst({
    where: { id: siteId, ownerId: userId },
    select: { id: true, subdomain: true, repoId: true },
  });
}

export async function publishDraftAction(formData: FormData) {
  const session = await getViewSession();
  const siteId = String(formData.get("siteId") ?? "");
  const subdomain = String(formData.get("subdomain") ?? "");
  if (!session) redirect(`/login?next=${pathFor(subdomain)}`);
  await blockActAsWrites();
  const prisma = getPrisma();
  if (!prisma) return redirectWithToast(pathFor(subdomain), "error", "The database is not connected.");
  const site = await ownedSite(siteId, session.userId);
  if (!site) return redirectWithToast("/dashboard", "error", "Site not found.");
  const pending = await prisma.pageRevision.findMany({
    where: { siteId, status: "PENDING" },
    select: { id: true },
  });
  for (const revision of pending) {
    const result = await approveRevision({ revisionId: revision.id, ownerId: session.userId });
    if (!result.ok) return redirectWithToast(pathFor(site.subdomain), "error", result.error);
  }
  revalidatePath(pathFor(site.subdomain));
  return redirectWithToast(pathFor(site.subdomain), "success", "Published.");
}

export async function discardDraftAction(formData: FormData) {
  const session = await getViewSession();
  const siteId = String(formData.get("siteId") ?? "");
  const subdomain = String(formData.get("subdomain") ?? "");
  if (!session) redirect(`/login?next=${pathFor(subdomain)}`);
  await blockActAsWrites();
  const prisma = getPrisma();
  if (!prisma) return redirectWithToast(pathFor(subdomain), "error", "The database is not connected.");
  const site = await ownedSite(siteId, session.userId);
  if (!site) return redirectWithToast("/dashboard", "error", "Site not found.");
  const pending = await prisma.pageRevision.findMany({
    where: { siteId, status: "PENDING" },
    select: { id: true },
  });
  for (const revision of pending) {
    const result = await rejectRevision({ revisionId: revision.id, ownerId: session.userId, note: null });
    if (!result.ok) return redirectWithToast(pathFor(site.subdomain), "error", result.error);
  }
  revalidatePath(pathFor(site.subdomain));
  return redirectWithToast(pathFor(site.subdomain), "success", "Discarded.");
}

export async function saveWorkspaceAction(formData: FormData) {
  const session = await getViewSession();
  const siteId = String(formData.get("siteId") ?? "");
  const subdomain = String(formData.get("subdomain") ?? "");
  const section = String(formData.get("section") ?? "");
  if (!session) redirect(`/login?next=${pathFor(subdomain, section)}`);
  await blockActAsWrites();
  const prisma = getPrisma();
  if (!prisma) return redirectWithToast(pathFor(subdomain, section), "error", "The database is not connected.");
  const site = await ownedSite(siteId, session.userId);
  if (!site) return redirectWithToast("/dashboard", "error", "Site not found.");
  const kind = String(formData.get("kind") ?? "");
  if (kind === "branding") {
    const theme = String(formData.get("theme") ?? "");
    const color = String(formData.get("primaryColor") ?? "");
    if (theme !== "LEDGER" && theme !== "MINIMAL") {
      return redirectWithToast(pathFor(site.subdomain, "/branding"), "error", "Choose a theme.");
    }
    if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
      return redirectWithToast(pathFor(site.subdomain, "/branding"), "error", "Use a #RRGGBB color.");
    }
    await prisma.site.update({
      where: { id: site.id },
      data: {
        theme,
        primaryColor: color,
        logoLightUrl: emptyToNull(formData.get("logoLightUrl")),
        logoDarkUrl: emptyToNull(formData.get("logoDarkUrl")),
        faviconUrl: emptyToNull(formData.get("faviconUrl")),
      },
    });
  } else if (kind === "domain") {
    const nextSubdomain = String(formData.get("nextSubdomain") ?? "").trim().toLowerCase();
    const customDomain = emptyToNull(formData.get("customDomain"));
    if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(nextSubdomain)) {
      return redirectWithToast(pathFor(site.subdomain, "/domain"), "error", "Choose a subdomain.");
    }
    const taken = await prisma.site.findFirst({
      where: { subdomain: nextSubdomain, NOT: { id: site.id } },
      select: { id: true },
    });
    if (taken) return redirectWithToast(pathFor(site.subdomain, "/domain"), "error", "That subdomain is taken.");
    await prisma.site.update({
      where: { id: site.id },
      data: {
        subdomain: nextSubdomain,
        customDomain,
        customDomainStatus: customDomain ? "Waiting for DNS" : null,
      },
    });
    revalidatePath(pathFor(nextSubdomain, "/domain"));
    return redirectWithToast(pathFor(nextSubdomain, "/domain"), "success", "Saved.");
  } else if (kind === "money") {
    await prisma.site.update({
      where: { id: site.id },
      data: {
        tipButton: formData.get("tipButton") === "on",
        tipEth: formData.get("tipEth") === "on",
        tipUsdc: formData.get("tipUsdc") === "on",
        payoutWallet: emptyToNull(formData.get("payoutWallet")),
      },
    });
  } else if (kind === "settings") {
    const reviewMode = String(formData.get("reviewMode") ?? "");
    if (reviewMode !== "AUTO_PUBLISH" && reviewMode !== "REVIEW") {
      return redirectWithToast(pathFor(site.subdomain, "/settings"), "error", "Choose a publishing mode.");
    }
    await prisma.site.update({
      where: { id: site.id },
      data: {
        reviewMode,
        privateSite: formData.get("privateSite") === "on",
        previewNoindex: formData.get("previewNoindex") === "on",
      },
    });
  } else if (kind === "pause") {
    const current = await prisma.site.findUnique({ where: { id: site.id }, select: { status: true } });
    await prisma.site.update({
      where: { id: site.id },
      data: {
        status: current?.status === "PAUSED" ? "ACTIVE" : "PAUSED",
        pausedReason: current?.status === "PAUSED" ? null : "paused",
      },
    });
  } else if (kind === "changelog") {
    const title = String(formData.get("title") ?? "").trim();
    const body = String(formData.get("body") ?? "").trim();
    if (!title || !body) {
      return redirectWithToast(pathFor(site.subdomain, "/changelog"), "error", "Title and body are required.");
    }
    await prisma.worklogEntry.create({
      data: { siteId: site.id, title: title.slice(0, 160), body: body.slice(0, 8_000), source: "manual" },
    });
  }
  revalidatePath(pathFor(site.subdomain, section));
  return redirectWithToast(pathFor(site.subdomain, section || ""), "success", "Saved.");
}

export async function deleteWorkspaceAction(formData: FormData) {
  const session = await getViewSession();
  const siteId = String(formData.get("siteId") ?? "");
  const subdomain = String(formData.get("subdomain") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (!session) redirect(`/login?next=${pathFor(subdomain, "/settings")}`);
  await blockActAsWrites();
  const prisma = getPrisma();
  if (!prisma) return redirectWithToast(pathFor(subdomain, "/settings"), "error", "The database is not connected.");
  const site = await prisma.site.findFirst({
    where: { id: siteId, ownerId: session.userId },
    select: { id: true, name: true },
  });
  if (!site) return redirectWithToast("/dashboard", "error", "Site not found.");
  if (confirm !== site.name) {
    return redirectWithToast(pathFor(subdomain, "/settings"), "error", "Type the workspace name.");
  }
  await prisma.site.delete({ where: { id: site.id } });
  revalidatePath("/dashboard");
  return redirectWithToast("/dashboard", "success", "Deleted.");
}

function emptyToNull(value: FormDataEntryValue | null): string | null {
  const text = String(value ?? "").trim();
  return text ? text : null;
}
