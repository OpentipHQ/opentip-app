import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isLocalDatabaseUrl } from "@/lib/db-guard";
import { sendLoginCodeEmail } from "@/lib/email/login-code-mail";

describe("local database guard", () => {
  it("allows only localhost database URLs", () => {
    expect(isLocalDatabaseUrl("postgresql://opentip:opentip@127.0.0.1:5432/opentip")).toBe(true);
    expect(isLocalDatabaseUrl("postgresql://opentip:opentip@localhost:5432/opentip")).toBe(true);
    expect(isLocalDatabaseUrl("postgresql://user:pw@ep-cool.neon.tech/opentip")).toBe(false);
    expect(isLocalDatabaseUrl(undefined)).toBe(false);
  });
});

describe("login code email", () => {
  it("refuses to write a local sink in production", async () => {
    const dir = mkdtempSync(join(tmpdir(), "opentip-code-"));
    const sink = join(dir, "codes.log");
    await expect(
      sendLoginCodeEmail({
        to: "ada@example.com",
        code: "123456",
        env: { NODE_ENV: "production", LOGIN_CODE_SINK: sink },
      }),
    ).rejects.toThrow(/RESEND_API_KEY/);
    rmSync(dir, { recursive: true, force: true });
  });

  it("writes the code only to the local sink outside production", async () => {
    const dir = mkdtempSync(join(tmpdir(), "opentip-code-"));
    const sink = join(dir, "nested", "codes.log");
    const result = await sendLoginCodeEmail({
      to: "ada@example.com",
      code: "654321",
      env: { NODE_ENV: "development", LOGIN_CODE_SINK: sink },
    });
    expect(result).toEqual({ delivered: false, mode: "sink" });
    expect(readFileSync(sink, "utf8")).toBe("ada@example.com 654321\n");
    rmSync(dir, { recursive: true, force: true });
  });
});
