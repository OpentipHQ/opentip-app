-- Closed beta access, hashed email codes, and held GitHub installs.
-- githubId becomes optional so an email-only account can exist, then link GitHub later.

ALTER TABLE "User" ALTER COLUMN "githubId" DROP NOT NULL;

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

CREATE TABLE "BetaAccess" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "applicationId" TEXT,
    "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BetaAccess_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BetaAccess_email_key" ON "BetaAccess"("email");

CREATE UNIQUE INDEX "BetaAccess_applicationId_key" ON "BetaAccess"("applicationId");

ALTER TABLE "BetaAccess"
ADD CONSTRAINT "BetaAccess_applicationId_fkey"
FOREIGN KEY ("applicationId") REFERENCES "BetaApplication"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "LoginCode" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumedAt" TIMESTAMP(3),
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginCode_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LoginCode_email_createdAt_idx" ON "LoginCode"("email", "createdAt");

CREATE TABLE "PendingInstall" (
    "id" TEXT NOT NULL,
    "selectorHash" TEXT NOT NULL,
    "githubUserId" TEXT NOT NULL,
    "email" TEXT,
    "login" TEXT NOT NULL,
    "name" TEXT,
    "avatarUrl" TEXT,
    "installationJson" JSONB NOT NULL,
    "reposJson" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PendingInstall_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PendingInstall_selectorHash_key" ON "PendingInstall"("selectorHash");

CREATE INDEX "PendingInstall_expiresAt_idx" ON "PendingInstall"("expiresAt");
