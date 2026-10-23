// Localhost only. In production, list the first admin in ADMIN_EMAILS.
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { isLocalDatabaseUrl } from "../src/lib/db-guard";

const url = process.env.DATABASE_URL ?? "";
if (!isLocalDatabaseUrl(url)) {
  console.error("Refusing to run: DATABASE_URL must point at localhost or 127.0.0.1.");
  process.exit(1);
}

const email = process.argv[2]?.trim().toLowerCase();
const makeAdmin = process.argv.includes("--admin");
if (!email || !email.includes("@")) {
  console.error("Usage: npx tsx scripts/approve-beta-email.ts <email> [--admin]");
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

async function main() {
  try {
    await prisma.betaAccess.upsert({
      where: { email },
      create: { email },
      update: {},
    });
    if (makeAdmin) {
      const updated = await prisma.user.updateMany({
        where: { email },
        data: { role: "ADMIN" },
      });
      if (updated.count === 0) {
        console.log(`Approved ${email}. No user row yet. Run this again with --admin after they sign in.`);
      } else {
        console.log(`Approved ${email} and set role ADMIN.`);
      }
    } else {
      console.log(`Approved ${email}.`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Approve failed");
  process.exit(1);
});
