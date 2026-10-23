// Prisma 7 reads the datasource URL from this file, not from schema.prisma.
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Generate and diff do not connect. Migrate deploy uses DATABASE_URL.
    url:
      process.env.DATABASE_URL ||
      "postgresql://opentip:opentip@127.0.0.1:5432/opentip?schema=public",
  },
});
