-- CreateEnum
CREATE TYPE "JobPhase" AS ENUM ('QUEUED', 'READING_REPO', 'GENERATING', 'VALIDATING', 'PUBLISHING', 'COMPLETE');

-- CreateEnum
CREATE TYPE "ReviewMode" AS ENUM ('AUTO_PUBLISH', 'REVIEW');

-- CreateEnum
CREATE TYPE "RevisionStatus" AS ENUM ('PENDING', 'PUBLISHED', 'REJECTED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "RevisionSource" AS ENUM ('FIRST_BUILD', 'PUSH_UPDATE', 'CHAT_EDIT');

-- CreateEnum
CREATE TYPE "RevisionAction" AS ENUM ('UPSERT', 'DELETE');

-- AlterEnum
ALTER TYPE "JobKind" ADD VALUE 'SUMMARY_REFRESH';

-- A job can retry after a finalized model call, so usage is recorded per attempt.
DROP INDEX "UsageEntry_jobId_key";
CREATE INDEX "UsageEntry_jobId_idx" ON "UsageEntry"("jobId");


-- AlterTable
ALTER TABLE "Site" ADD COLUMN "reviewMode" "ReviewMode" NOT NULL DEFAULT 'AUTO_PUBLISH';

-- AlterTable
ALTER TABLE "Job"
ADD COLUMN "phase" "JobPhase" NOT NULL DEFAULT 'QUEUED',
ADD COLUMN "progress" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "detail" TEXT,
ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "maxAttempts" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "leaseUntil" TIMESTAMP(3),
ADD COLUMN "lockedBy" TEXT,
ADD COLUMN "lastHeartbeatAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "JobEvent" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'info',
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PageRevision" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "pageId" TEXT,
    "jobId" TEXT,
    "action" "RevisionAction" NOT NULL DEFAULT 'UPSERT',
    "status" "RevisionStatus" NOT NULL DEFAULT 'PENDING',
    "source" "RevisionSource" NOT NULL,
    "slug" TEXT NOT NULL,
    "section" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "content" TEXT NOT NULL,
    "navOrder" INTEGER NOT NULL DEFAULT 0,
    "baseSha" TEXT,
    "changeNote" TEXT,
    "reviewNote" TEXT,
    "publishedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PageRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Job_status_availableAt_idx" ON "Job"("status", "availableAt");

-- CreateIndex
CREATE INDEX "Job_leaseUntil_idx" ON "Job"("leaseUntil");

-- CreateIndex
CREATE UNIQUE INDEX "Job_one_running_per_repo" ON "Job"("repoId") WHERE "status" = 'RUNNING';

-- CreateIndex
CREATE UNIQUE INDEX "JobEvent_jobId_sequence_key" ON "JobEvent"("jobId", "sequence");

-- CreateIndex
CREATE INDEX "JobEvent_jobId_createdAt_idx" ON "JobEvent"("jobId", "createdAt");

-- CreateIndex
CREATE INDEX "PageRevision_siteId_status_createdAt_idx" ON "PageRevision"("siteId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "PageRevision_pageId_idx" ON "PageRevision"("pageId");

-- CreateIndex
CREATE INDEX "PageRevision_jobId_idx" ON "PageRevision"("jobId");

-- AddForeignKey
ALTER TABLE "JobEvent" ADD CONSTRAINT "JobEvent_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PageRevision" ADD CONSTRAINT "PageRevision_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PageRevision" ADD CONSTRAINT "PageRevision_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PageRevision" ADD CONSTRAINT "PageRevision_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;
