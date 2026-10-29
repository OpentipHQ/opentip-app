-- CreateEnum
CREATE TYPE "CreditKind" AS ENUM ('MIGRATION', 'REFILL', 'GRANT', 'REMOVAL', 'SPEND');

-- CreateEnum
CREATE TYPE "CreditRequestStatus" AS ENUM ('OPEN', 'DONE');

-- AlterTable
ALTER TABLE "Site" ADD COLUMN     "payoutWallet" TEXT,
ADD COLUMN     "previewNoindex" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "privateSite" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tipButton" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tipEth" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "tipUsdc" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "creditBalance" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "CreditEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "kind" "CreditKind" NOT NULL,
    "reason" TEXT,
    "action" TEXT,
    "siteId" TEXT,
    "jobId" TEXT,
    "usageEntryId" TEXT,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "CreditRequestStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CreditEntry_usageEntryId_key" ON "CreditEntry"("usageEntryId");

-- CreateIndex
CREATE INDEX "CreditEntry_userId_createdAt_idx" ON "CreditEntry"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "CreditEntry_siteId_idx" ON "CreditEntry"("siteId");

-- CreateIndex
CREATE INDEX "CreditEntry_kind_createdAt_idx" ON "CreditEntry"("kind", "createdAt");

-- CreateIndex
CREATE INDEX "CreditRequest_status_createdAt_idx" ON "CreditRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "CreditRequest_userId_status_idx" ON "CreditRequest"("userId", "status");

-- AddForeignKey
ALTER TABLE "CreditEntry" ADD CONSTRAINT "CreditEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditEntry" ADD CONSTRAINT "CreditEntry_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditEntry" ADD CONSTRAINT "CreditEntry_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditRequest" ADD CONSTRAINT "CreditRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Move an existing User.creditUsd balance into the ledger.
-- 100 credits = $1.00. A non-zero dollar balance becomes one MIGRATION row.
INSERT INTO "CreditEntry" ("id", "userId", "amount", "kind", "reason", "createdAt")
SELECT
  gen_random_uuid()::text,
  "id",
  ROUND("creditUsd" * 100)::int,
  'MIGRATION',
  'Opening balance',
  CURRENT_TIMESTAMP
FROM "User"
WHERE "creditUsd" <> 0;

UPDATE "User" AS u
SET "creditBalance" = COALESCE((
  SELECT SUM(e."amount")::int FROM "CreditEntry" AS e WHERE e."userId" = u."id"
), 0);
