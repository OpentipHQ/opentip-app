import { describe, expect, it } from "vitest";
import {
  assessLoginCode,
  cooldownRemaining,
  generateLoginCode,
  hashLoginCode,
  MAX_ATTEMPTS,
  planLoginCode,
} from "@/lib/auth/login-code";

const now = new Date("2026-10-23T12:00:00Z");
const secret = "pepper";
const email = "ada@example.com";

describe("login codes", () => {
  it("hashes the code and does not store the digits", () => {
    const code = generateLoginCode(() => 42);
    expect(code).toBe("000042");
    const hash = hashLoginCode(code, email, secret);
    expect(hash).not.toContain(code);
    expect(hash).toHaveLength(64);
  });

  it("accepts a fresh code and rejects an expired or wrong one", () => {
    const code = "123456";
    const row = {
      codeHash: hashLoginCode(code, email, secret),
      expiresAt: new Date(now.getTime() + 60_000),
      attempts: 0,
      consumedAt: null,
    };
    expect(assessLoginCode({ row, code, email, secret, now }).ok).toBe(true);
    expect(
      assessLoginCode({
        row: { ...row, expiresAt: new Date(now.getTime() - 1) },
        code,
        email,
        secret,
        now,
      }),
    ).toMatchObject({ ok: false, reason: "expired", increment: false });
    expect(assessLoginCode({ row, code: "000000", email, secret, now })).toMatchObject({
      ok: false,
      reason: "wrong",
      increment: true,
    });
  });

  it("stops after the attempt limit", () => {
    const row = {
      codeHash: hashLoginCode("123456", email, secret),
      expiresAt: new Date(now.getTime() + 60_000),
      attempts: MAX_ATTEMPTS - 1,
      consumedAt: null,
    };
    expect(assessLoginCode({ row, code: "000000", email, secret, now })).toMatchObject({
      ok: false,
      reason: "too_many",
      increment: true,
    });
    expect(
      assessLoginCode({ row: { ...row, attempts: MAX_ATTEMPTS }, code: "123456", email, secret, now }),
    ).toMatchObject({ ok: false, reason: "too_many", increment: false });
  });

  it("does not issue a code for an unapproved email, and rate limits the rest", () => {
    expect(
      planLoginCode({
        approved: false,
        recentEmailCount: 0,
        recentIpCount: 0,
        lastSentAt: null,
        now,
        email,
        secret,
        code: "111111",
      }),
    ).toEqual({ ok: false, reason: "waitlist" });
    expect(
      planLoginCode({
        approved: true,
        recentEmailCount: 5,
        recentIpCount: 0,
        lastSentAt: null,
        now,
        email,
        secret,
      }),
    ).toEqual({ ok: false, reason: "rate" });
    expect(
      planLoginCode({
        approved: true,
        recentEmailCount: 0,
        recentIpCount: 0,
        lastSentAt: new Date(now.getTime() - 30_000),
        now,
        email,
        secret,
      }),
    ).toEqual({ ok: false, reason: "cooldown" });
    const sent = planLoginCode({
      approved: true,
      recentEmailCount: 0,
      recentIpCount: 0,
      lastSentAt: new Date(now.getTime() - 60_000),
      now,
      email,
      secret,
      code: "222222",
    });
    expect(sent.ok).toBe(true);
    if (sent.ok) {
      expect(sent.codeHash).not.toContain("222222");
      expect(sent.expiresAt.getTime() - now.getTime()).toBe(10 * 60 * 1000);
    }
    expect(cooldownRemaining(new Date(now.getTime() - 15_000), now)).toBe(45);
  });
});
