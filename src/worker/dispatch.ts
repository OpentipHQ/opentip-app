import { JobPhase, type Job } from "@/generated/prisma/client";
import {
  DEFAULT_GLOBAL_DAILY_CAP_USD,
  DEFAULT_REPO_DAILY_CAP_USD,
  readCap,
} from "@/lib/copilot/caps";
import {
  GenerationContractError,
  draftFromGeneration,
  parseGenerationResult,
  type PageDraft,
} from "@/lib/copilot/contract";
import { estimateCostUsd, ratesFromEnv, reserveTokens } from "@/lib/copilot/cost";
import { generateRepoSummary } from "@/lib/copilot/generate";
import {
  chatEditRequest,
  firstBuildRequest,
  pushUpdateRequest,
} from "@/lib/copilot/prompts";
import { taskSizeForJob } from "@/lib/copilot/models";
import {
  releaseUsage,
  reserveDailySpend,
  finalizeUsage,
} from "@/lib/copilot/reserve";
import type { CompletionResult } from "@/lib/copilot/providers";
import { resolveProvider } from "@/lib/copilot/providers";
import { getPrisma } from "@/lib/db";
import { createInstallationToken } from "@/lib/github/installation-token";
import {
  readRepoChange,
  readRepoSnapshot,
} from "@/lib/github/repo-content";
import { applyDrafts } from "@/lib/sites/publish";
import {
  PermanentJobError,
  TransientJobError,
  safeErrorMessage,
} from "@/worker/errors";
import { logJobEvent } from "@/worker/events";
import {
  assertOwnership,
  finishJob,
  heartbeat,
} from "@/worker/queue";
import type { WorkerConfig } from "@/worker/config";

type ProgressReporter = {
  phase: JobPhase;
  progress: number;
  message: string;
  detail?: string | null;
};

export async function runJob(
  jobId: string,
  config: WorkerConfig,
): Promise<void> {
  const prisma = getPrisma();
  if (!prisma) throw new Error("DATABASE_URL is required to run the worker.");
  const loaded = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      repo: {
        include: {
          installation: true,
          site: true,
        },
      },
      chatEdit: true,
    },
  });
  if (!loaded) throw new PermanentJobError("The job no longer exists.");
  const repo = loaded.repo;
  const site = repo.site;
  if (!site) {
    throw new PermanentJobError("This repository is not connected to a site.");
  }
  if (site.status === "PAUSED") {
    throw new PermanentJobError("This site is paused.");
  }
  if (repo.installation.uninstalledAt || repo.installation.suspendedAt) {
    throw new PermanentJobError("The GitHub App is not connected for this repository.");
  }

  const heartbeatTimer = setInterval(() => {
    void heartbeat(jobId, config.workerId, config.leaseMs).catch(() => undefined);
  }, config.heartbeatMs);
  heartbeatTimer.unref?.();

  let usageId: string | undefined;
  try {
    const instruction =
      loaded.kind === "CHAT_EDIT" ? loaded.chatEdit?.instruction ?? "" : undefined;
    const task = taskSizeForJob(loaded.kind, instruction);
    const provider = resolveProvider(task, process.env);
    await prisma.job.updateMany({
      where: { id: jobId, status: "RUNNING", lockedBy: config.workerId },
      data: {
        provider: provider.id.toUpperCase() as "XAI" | "GROQ" | "FAKE",
        model: provider.model,
      },
    });
    const rates =
      provider.id === "fake"
        ? { inputUsdPerMillion: 0, outputUsdPerMillion: 0 }
        : ratesFromEnv(provider.id, process.env);
    const reserve = reserveTokens(task);
    const estimateUsd = estimateCostUsd(reserve, rates);
    const reservation = await reserveDailySpend({
      repoId: repo.id,
      estimateUsd,
      repoCapUsd: readCap(process.env.REPO_DAILY_CAP_USD, DEFAULT_REPO_DAILY_CAP_USD),
      globalCapUsd: readCap(
        process.env.GLOBAL_DAILY_CAP_USD,
        DEFAULT_GLOBAL_DAILY_CAP_USD,
      ),
      provider: provider.id.toUpperCase() as "XAI" | "GROQ" | "FAKE",
      model: provider.model,
      jobId,
    });
    if (!reservation.allowed) {
      throw new PermanentJobError(
        "Today's generation limit was reached. Try again tomorrow.",
      );
    }
    usageId = reservation.usageId;

    if (loaded.kind === "SUMMARY_REFRESH") {
      await refreshSummary({
        job: loaded,
        config,
        provider,
        owner: repo.owner,
        name: repo.name,
        branch: repo.defaultBranch,
        installationId: repo.installation.githubInstallationId,
        usageId,
      });
      return;
    }

    if (loaded.kind === "CHAT_EDIT") {
      await runChatEdit({
        job: loaded,
        config,
        provider,
        siteId: site.id,
        siteName: site.name,
        pageId: loaded.chatEdit?.pageId ?? null,
        instruction: instruction ?? "",
        usageId,
      });
      return;
    }

    const token = await installationToken(repo.installation.githubInstallationId);
    if (loaded.kind === "FIRST_BUILD") {
      await runFirstBuild({
        job: loaded,
        config,
        provider,
        token,
        owner: repo.owner,
        name: repo.name,
        branch: repo.defaultBranch,
        siteId: site.id,
        siteName: site.name,
        siteDescription: site.description,
        repoSummary: repo.summary,
        reviewMode: site.reviewMode,
        usageId,
      });
      return;
    }

    if (loaded.kind === "PUSH_UPDATE") {
      await runPushUpdate({
        job: loaded,
        config,
        provider,
        token,
        owner: repo.owner,
        name: repo.name,
        branch: repo.defaultBranch,
        siteId: site.id,
        siteName: site.name,
        repoSummary: repo.summary,
        reviewMode: site.reviewMode,
        usageId,
      });
      return;
    }

    throw new PermanentJobError("This job type is not supported.");
  } catch (error) {
    await releaseUsage(usageId).catch(() => undefined);
    throw error;
  } finally {
    clearInterval(heartbeatTimer);
  }
}

async function runFirstBuild(args: {
  job: Job;
  config: WorkerConfig;
  provider: ReturnType<typeof resolveProvider>;
  token: string;
  owner: string;
  name: string;
  branch: string;
  siteId: string;
  siteName: string;
  siteDescription: string | null;
  repoSummary: string | null;
  reviewMode: "AUTO_PUBLISH" | "REVIEW";
  usageId?: string;
}) {
  await progress(args.job.id, args.config, {
    phase: JobPhase.READING_REPO,
    progress: 10,
    message: "Reading repository",
    detail: "Reading the README, docs, and source files",
  });
  const snapshot = await repoCall(() =>
    readRepoSnapshot({
      owner: args.owner,
      name: args.name,
      branch: args.branch,
      token: args.token,
    }),
  );
  await progress(args.job.id, args.config, {
    phase: JobPhase.GENERATING,
    progress: 35,
    message: "Writing pages",
    detail: `Writing docs from ${snapshot.files.length} files`,
  });
  await assertOwnership(args.job.id, args.config.workerId);
  const generated = await args.provider
    .complete(
      firstBuildRequest({
        siteName: args.siteName,
        siteDescription: args.siteDescription,
        repoSummary: args.repoSummary,
        snapshot,
      }),
    );
  await finalize(args.usageId, generated);
  const pages = parseGenerated(generated.text, {
    allowEmpty: false,
    requireHome: true,
    maxPages: 10,
  });
  const drafts = pages.pages.map(draftFromGeneration);
  await publish(args, {
    pages: drafts,
    removedSlugs: pages.removedSlugs,
    changeNote: pages.changeNote,
    source: "FIRST_BUILD",
    baseSha: snapshot.sha,
  });
}

async function runPushUpdate(args: {
  job: Job;
  config: WorkerConfig;
  provider: ReturnType<typeof resolveProvider>;
  token: string;
  owner: string;
  name: string;
  branch: string;
  siteId: string;
  siteName: string;
  repoSummary: string | null;
  reviewMode: "AUTO_PUBLISH" | "REVIEW";
  usageId?: string;
}) {
  await progress(args.job.id, args.config, {
    phase: JobPhase.READING_REPO,
    progress: 10,
    message: "Reading changes",
    detail: "Comparing the pushed commit with the previous commit",
  });
  const payload = (args.job.payload ?? {}) as {
    before?: unknown;
    after?: unknown;
  };
  const before = typeof payload.before === "string" ? payload.before : "";
  const after = typeof payload.after === "string" ? payload.after : "";
  if (!/^[0-9a-f]{7,40}$/i.test(after)) {
    throw new PermanentJobError("The push event is missing its commit.");
  }
  const change = await repoCall(() =>
    readRepoChange({
      owner: args.owner,
      name: args.name,
      branch: args.branch,
      before: /^[0-9a-f]{7,40}$/i.test(before) ? before : "",
      after,
      token: args.token,
    }),
  );
  if (
    change.changedPaths.length === 0 &&
    change.patches.length === 0 &&
    change.files.length === 0
  ) {
    await releaseUsage(args.usageId);
    await logJobEvent({
      jobId: args.job.id,
      phase: JobPhase.COMPLETE,
      progress: 100,
      detail: "No documentation changes needed",
      message: "No documentation changes needed",
    });
    await finishJob({
      jobId: args.job.id,
      workerId: args.config.workerId,
      promptTokens: 0,
      completionTokens: 0,
      estimatedCostUsd: 0,
      successMessage: "No documentation changes needed",
    });
    return;
  }
  const prisma = getPrisma();
  if (!prisma) throw new Error("DATABASE_URL is required to run the worker.");
  const existing = await prisma.page.findMany({
    where: { siteId: args.siteId, published: true },
    select: {
      slug: true,
      section: true,
      title: true,
      description: true,
      content: true,
      navOrder: true,
    },
    orderBy: { navOrder: "asc" },
  });
  await progress(args.job.id, args.config, {
    phase: JobPhase.GENERATING,
    progress: 35,
    message: "Updating pages",
    detail: `Reviewing ${change.changedPaths.length} changed files`,
  });
  const generated = await args.provider
    .complete(
      pushUpdateRequest({
        siteName: args.siteName,
        repoSummary: args.repoSummary,
        change,
        existingPages: existing,
      }),
    );
  await finalize(args.usageId, generated);
  const result = parseGenerated(generated.text, {
    allowEmpty: true,
    maxPages: 8,
  });
  if (result.pages.length === 0 && result.removedSlugs.length === 0) {
    const usage = await jobUsageTotals(args.job.id);
    await logJobEvent({
      jobId: args.job.id,
      phase: JobPhase.COMPLETE,
      progress: 100,
      detail: "No documentation changes needed",
      message: "No documentation changes needed",
    });
    await finishJob({
      jobId: args.job.id,
      workerId: args.config.workerId,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      estimatedCostUsd: usage.estimatedCostUsd,
      successMessage: "No documentation changes needed",
    });
    return;
  }
  await publish(args, {
    pages: result.pages.map(draftFromGeneration),
    removedSlugs: result.removedSlugs,
    changeNote: result.changeNote,
    source: "PUSH_UPDATE",
    baseSha: after,
  });
}

async function runChatEdit(args: {
  job: Job;
  config: WorkerConfig;
  provider: ReturnType<typeof resolveProvider>;
  siteId: string;
  siteName: string;
  pageId: string | null;
  instruction: string;
  usageId?: string;
}) {
  if (!args.instruction.trim()) {
    throw new PermanentJobError("The chat instruction was empty.");
  }
  if (!args.pageId) {
    throw new PermanentJobError("Choose a page before sending a chat edit.");
  }
  const prisma = getPrisma();
  if (!prisma) throw new Error("DATABASE_URL is required to run the worker.");
  const page = await prisma.page.findFirst({
    where: { id: args.pageId, siteId: args.siteId },
    select: {
      slug: true,
      section: true,
      title: true,
      description: true,
      content: true,
      navOrder: true,
      handEdited: true,
    },
  });
  if (!page) throw new PermanentJobError("That page no longer exists.");
  await progress(args.job.id, args.config, {
    phase: JobPhase.GENERATING,
    progress: 35,
    message: "Editing the page",
    detail: "Applying your instruction",
  });
  const pageDraft: PageDraft = {
    slug: page.slug,
    section: page.section,
    title: page.title,
    description: page.description,
    navOrder: page.navOrder,
    content: page.content,
  };
  const generated = await args.provider
    .complete(
      chatEditRequest({
        siteName: args.siteName,
        page: pageDraft,
        instruction: args.instruction,
      }),
    );
  await finalize(args.usageId, generated);
  const result = parseGenerated(generated.text, {
    allowEmpty: false,
    maxPages: 1,
  });
  if (result.pages.length !== 1) {
    throw new PermanentJobError("The edit did not return exactly one page.");
  }
  const draft = draftFromGeneration(result.pages[0]);
  const usage = await jobUsageTotals(args.job.id);
  await progress(args.job.id, args.config, {
    phase: JobPhase.PUBLISHING,
    progress: 80,
    message: "Preparing your edit",
    detail: "This edit will wait for your approval",
  });
  const site = await prisma.site.findUnique({
    where: { id: args.siteId },
    select: { reviewMode: true },
  });
  if (!site) throw new PermanentJobError("The site no longer exists.");
  await assertOwnership(args.job.id, args.config.workerId);
  const applied = await applyDrafts({
    siteId: args.siteId,
    jobId: args.job.id,
    source: "CHAT_EDIT",
    reviewMode: site.reviewMode,
    baseSha: null,
    pages: [draft],
    removedSlugs: [],
    changeNote: result.changeNote,
  });
  const message =
    applied.pending > 0
      ? "Your edit is ready for review."
      : "The edit did not change the page.";
  await logJobEvent({
    jobId: args.job.id,
    level: "info",
    message,
    phase: JobPhase.COMPLETE,
    progress: 100,
    detail: message,
  });
  await finishJob({
    jobId: args.job.id,
    workerId: args.config.workerId,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    estimatedCostUsd: usage.estimatedCostUsd,
    successMessage: message,
  });
}

async function refreshSummary(args: {
  job: Job;
  config: WorkerConfig;
  provider: ReturnType<typeof resolveProvider>;
  owner: string;
  name: string;
  branch: string;
  installationId: string;
  usageId?: string;
}) {
  const token = await installationToken(args.installationId);
  await progress(args.job.id, args.config, {
    phase: JobPhase.READING_REPO,
    progress: 10,
    message: "Reading repository",
    detail: "Finding the parts that describe the project",
  });
  const snapshot = await repoCall(() =>
    readRepoSnapshot({
      owner: args.owner,
      name: args.name,
      branch: args.branch,
      token,
    }),
  );
  await progress(args.job.id, args.config, {
    phase: JobPhase.GENERATING,
    progress: 40,
    message: "Refreshing the summary",
    detail: "Summarizing the repository",
  });
  const generated = await generateRepoSummary({
    provider: args.provider,
    siteName: args.name,
    snapshot,
  });
  await finalize(args.usageId, generated.completion);
  const usage = await jobUsageTotals(args.job.id);
  const prisma = getPrisma();
  if (!prisma) throw new Error("DATABASE_URL is required to run the worker.");
  await assertOwnership(args.job.id, args.config.workerId);
  await prisma.repo.update({
    where: { id: args.job.repoId },
    data: {
      summary: generated.text,
      summarySha: snapshot.sha,
      summaryCachedAt: new Date(),
    },
  });
  await logJobEvent({
    jobId: args.job.id,
    message: "Summary refreshed",
    phase: JobPhase.COMPLETE,
    progress: 100,
    detail: "Summary refreshed",
  });
  await finishJob({
    jobId: args.job.id,
    workerId: args.config.workerId,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    estimatedCostUsd: usage.estimatedCostUsd,
    successMessage: "Summary refreshed",
  });
}

async function publish(
  args: {
    job: Job;
    config: WorkerConfig;
    siteId: string;
    reviewMode: "AUTO_PUBLISH" | "REVIEW";
  },
  input: {
    pages: PageDraft[];
    removedSlugs: string[];
    changeNote: string | null;
    source: "FIRST_BUILD" | "PUSH_UPDATE";
    baseSha: string | null;
  },
) {
  const usage = await jobUsageTotals(args.job.id);
  await progress(args.job.id, args.config, {
    phase: JobPhase.VALIDATING,
    progress: 65,
    message: "Checking pages",
    detail: `Checking ${input.pages.length} pages`,
  });
  await assertOwnership(args.job.id, args.config.workerId);
  await progress(args.job.id, args.config, {
    phase: JobPhase.PUBLISHING,
    progress: 85,
    message: args.reviewMode === "AUTO_PUBLISH" ? "Updating your docs" : "Preparing your review",
    detail:
      args.reviewMode === "AUTO_PUBLISH"
        ? "Making the changes live"
        : "The changes will wait for your approval",
  });
  const applied = await applyDrafts({
    siteId: args.siteId,
    jobId: args.job.id,
    source: input.source,
    reviewMode: args.reviewMode,
    baseSha: input.baseSha,
    pages: input.pages,
    removedSlugs: input.removedSlugs,
    changeNote: input.changeNote,
  }).catch((error) => {
    const message = safeErrorMessage(error);
    if (/^(Site not found\.|This site is paused\.)$/.test(message)) {
      throw new PermanentJobError(message);
    }
    throw error;
  });
  const message =
    args.reviewMode === "REVIEW" && applied.pending > 0
      ? "Changes are ready for review."
      : applied.published > 0
        ? `Published ${applied.published} page${applied.published === 1 ? "" : "s"}.`
        : applied.skipped > 0
          ? "No pages changed. Hand edited pages were skipped."
          : "No pages changed.";
  await logJobEvent({
    jobId: args.job.id,
    message,
    phase: JobPhase.COMPLETE,
    progress: 100,
    detail: message,
    metadata: {
      published: applied.published,
      pending: applied.pending,
      skipped: applied.skipped,
      removed: applied.removed,
    },
  });
  await finishJob({
    jobId: args.job.id,
    workerId: args.config.workerId,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    estimatedCostUsd: usage.estimatedCostUsd,
    successMessage: message,
  });
}

function parseGenerated(
  text: string,
  options: {
    allowEmpty: boolean;
    requireHome?: boolean;
    maxPages: number;
  },
) {
  try {
    return parseGenerationResult(text, options);
  } catch (error) {
    if (error instanceof GenerationContractError) {
      throw new PermanentJobError(error.message);
    }
    throw error;
  }
}

async function jobUsageTotals(jobId: string): Promise<{
  promptTokens: number;
  completionTokens: number;
  estimatedCostUsd: number;
}> {
  const prisma = getPrisma();
  if (!prisma) {
    return { promptTokens: 0, completionTokens: 0, estimatedCostUsd: 0 };
  }
  const rows = await prisma.usageEntry.findMany({
    where: { jobId, status: "FINAL" },
    select: {
      promptTokens: true,
      completionTokens: true,
      estimatedCostUsd: true,
    },
  });
  return rows.reduce(
    (total, row) => ({
      promptTokens: total.promptTokens + row.promptTokens,
      completionTokens: total.completionTokens + row.completionTokens,
      estimatedCostUsd: total.estimatedCostUsd + Number(row.estimatedCostUsd),
    }),
    { promptTokens: 0, completionTokens: 0, estimatedCostUsd: 0 },
  );
}

async function finalize(
  usageId: string | undefined,
  result: CompletionResult,
): Promise<void> {
  if (!usageId) return;
  await finalizeUsage({
    usageId,
    promptTokens: result.promptTokens,
    completionTokens: result.completionTokens,
    estimatedCostUsd: result.estimatedCostUsd,
  });
}

async function progress(
  jobId: string,
  config: WorkerConfig,
  input: ProgressReporter,
): Promise<void> {
  await logJobEvent({
    jobId,
    message: input.message,
    phase: input.phase,
    progress: input.progress,
    detail: input.detail,
  });
  await assertOwnership(jobId, config.workerId);
}

async function installationToken(installationId: string): Promise<string> {
  const result = await createInstallationToken({ installationId });
  return result.token;
}

async function repoCall<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    const message = safeErrorMessage(error);
    if (/\b(401|403|404)\b/.test(message)) {
      throw new PermanentJobError(message);
    }
    throw new TransientJobError(message);
  }
}
