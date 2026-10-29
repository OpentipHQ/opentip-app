-- Org members share one GitHub App installation instead of replacing its owner.

CREATE TABLE "InstallationMember" (
    "id" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstallationMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InstallationMember_installationId_userId_key" ON "InstallationMember"("installationId", "userId");
CREATE INDEX "InstallationMember_userId_idx" ON "InstallationMember"("userId");

ALTER TABLE "InstallationMember" ADD CONSTRAINT "InstallationMember_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "Installation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InstallationMember" ADD CONSTRAINT "InstallationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "InstallationMember" ("id", "installationId", "userId")
SELECT gen_random_uuid()::text, "id", "userId"
FROM "Installation"
WHERE "userId" IS NOT NULL;
