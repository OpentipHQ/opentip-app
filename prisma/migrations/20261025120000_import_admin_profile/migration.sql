-- Profile, import, admin, announcements, spend alerts, and webhook errors.

CREATE TYPE "AlertKind" AS ENUM ('DAILY_TOTAL', 'USER_OUTLIER');

ALTER TABLE "User"
ADD COLUMN "imageUrl" TEXT,
ADD COLUMN "emailSignInEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "suspendedAt" TIMESTAMP(3),
ADD COLUMN "creditUsd" DECIMAL(12,4) NOT NULL DEFAULT 0;

ALTER TABLE "Installation"
ADD COLUMN "accountAvatarUrl" TEXT;

ALTER TABLE "Repo"
ADD COLUMN "pushedAt" TIMESTAMP(3);

ALTER TABLE "LoginCode"
ADD COLUMN "purpose" TEXT NOT NULL DEFAULT 'signin',
ADD COLUMN "userId" TEXT;

CREATE INDEX "LoginCode_userId_purpose_createdAt_idx" ON "LoginCode"("userId", "purpose", "createdAt");

ALTER TABLE "LoginCode"
ADD CONSTRAINT "LoginCode_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "WebhookError" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "action" TEXT,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookError_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WebhookError_createdAt_idx" ON "WebhookError"("createdAt");

CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorEmail" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");
CREATE INDEX "ActivityLog_actorId_idx" ON "ActivityLog"("actorId");

ALTER TABLE "ActivityLog"
ADD CONSTRAINT "ActivityLog_actorId_fkey"
FOREIGN KEY ("actorId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "emailRequested" BOOLEAN NOT NULL DEFAULT false,
    "emailSentAt" TIMESTAMP(3),
    "emailRecipientCount" INTEGER NOT NULL DEFAULT 0,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Announcement_active_createdAt_idx" ON "Announcement"("active", "createdAt");

ALTER TABLE "Announcement"
ADD CONSTRAINT "Announcement_authorId_fkey"
FOREIGN KEY ("authorId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "SpendAlert" (
    "id" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "kind" "AlertKind" NOT NULL,
    "day" DATE NOT NULL,
    "userId" TEXT,
    "amountUsd" DECIMAL(12,6) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpendAlert_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SpendAlert_scopeKey_key" ON "SpendAlert"("scopeKey");
CREATE INDEX "SpendAlert_day_idx" ON "SpendAlert"("day");
