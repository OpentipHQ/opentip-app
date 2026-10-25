-- Product announcement preferences. Transactional email is not affected.
CREATE TABLE "EmailPreference" (
    "email" TEXT NOT NULL,
    "announcements" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailPreference_pkey" PRIMARY KEY ("email")
);
