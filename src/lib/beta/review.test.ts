import { describe, expect, it, vi } from "vitest";
import {
  type MarketingApplication,
  type MarketingApplicationLoad,
  type MarketingReviewUpdate,
} from "@/lib/beta/marketing-applications";
import {
  approveBetaApplication,
  rejectBetaApplication,
  revokeBetaApplicationAccess,
} from "@/lib/beta/review";

function application(overrides: Partial<MarketingApplication> = {}): MarketingApplication {
  return {
    id: "42",
    name: "Ada",
    email: "ada@example.com",
    githubUsername: "ada",
    xHandle: null,
    repoUrl: "https://github.com/ada/engine",
    monthlyPayUsd: null,
    status: "pending",
    createdAt: "2026-10-20T12:30:00.000Z",
    projectSummary: "A docs project.",
    docsReaders: "Developers",
    docsTooling: "Markdown",
    docsPain: "Keeping pages current.",
    pushFrequency: "Weekly",
    feedbackCall: false,
    reviewedAt: null,
    reviewedBy: null,
    ...overrides,
  };
}

function deps(input: {
  load?: MarketingApplicationLoad;
  approve?: MarketingReviewUpdate;
  reject?: MarketingReviewUpdate;
  grant?: "granted" | "invalid" | "no-database";
  revoke?: "revoked" | "invalid" | "no-database" | "bootstrap";
  notify?: "sent" | "skipped";
} = {}) {
  return {
    marketing: {
      get: vi.fn(async () => input.load ?? ({ state: "ok", application: application() } as const)),
      approve: vi.fn(async () => input.approve ?? ({ state: "ok", email: "ada@example.com", status: "approved" } as const)),
      reject: vi.fn(async () => input.reject ?? ({ state: "ok", email: "ada@example.com", status: "rejected" } as const)),
    },
    access: {
      grant: vi.fn(async () => input.grant ?? "granted"),
      revoke: vi.fn(async () => input.revoke ?? "revoked"),
    },
    notify: {
      approval: vi.fn(async () => input.notify ?? "sent"),
    },
  };
}

describe("beta application review", () => {
  it("grants local access before approving a pending application", async () => {
    const fake = deps();
    const result = await approveBetaApplication({ id: "42", reviewer: "admin" }, fake);

    expect(result).toMatchObject({
      ok: true,
      outcome: "approved",
      applicationId: "42",
      email: "ada@example.com",
    });
    expect(fake.access.grant).toHaveBeenCalledWith("ada@example.com");
    expect(fake.marketing.approve).toHaveBeenCalledWith("42", "admin");
    expect(fake.access.grant.mock.invocationCallOrder[0]).toBeLessThan(
      fake.marketing.approve.mock.invocationCallOrder[0],
    );
    expect(fake.notify.approval).toHaveBeenCalledOnce();
    expect(fake.notify.approval).toHaveBeenCalledWith("ada@example.com");
    expect(fake.marketing.approve.mock.invocationCallOrder[0]).toBeLessThan(
      fake.notify.approval.mock.invocationCallOrder[0],
    );
  });

  it("reports a skipped approval email without failing the approval", async () => {
    const fake = deps({ notify: "skipped" });
    const result = await approveBetaApplication({ id: "42", reviewer: "admin" }, fake);

    expect(result).toMatchObject({ ok: true, approvalEmail: "skipped" });
  });

  it("keeps the approval when the email fails", async () => {
    const fake = deps();
    fake.notify.approval.mockRejectedValueOnce(new Error("resend down"));
    const result = await approveBetaApplication({ id: "42", reviewer: "admin" }, fake);

    expect(result).toMatchObject({ ok: true, approvalEmail: "failed" });
    expect(fake.access.grant).toHaveBeenCalledWith("ada@example.com");
  });

  it("grants missing local access on an already approved application", async () => {
    const fake = deps({
      load: { state: "ok", application: application({ status: "approved" }) },
    });
    const result = await approveBetaApplication({ id: "42", reviewer: "admin" }, fake);

    expect(result).toMatchObject({ ok: true, outcome: "approved" });
    expect(fake.access.grant).toHaveBeenCalledWith("ada@example.com");
    expect(fake.marketing.approve).not.toHaveBeenCalled();
    expect(fake.notify.approval).not.toHaveBeenCalled();
  });

  it("does not grant access to a rejected application", async () => {
    const fake = deps({
      load: { state: "ok", application: application({ status: "rejected" }) },
    });
    const result = await approveBetaApplication({ id: "42", reviewer: "admin" }, fake);

    expect(result).toMatchObject({ ok: false, reason: "status" });
    expect(fake.access.grant).not.toHaveBeenCalled();
    expect(fake.marketing.approve).not.toHaveBeenCalled();
  });

  it("reports a partial approval when local access succeeds but the status update fails", async () => {
    const fake = deps({ approve: { state: "unavailable" } });
    const result = await approveBetaApplication({ id: "42", reviewer: "admin" }, fake);

    expect(result).toMatchObject({
      ok: false,
      reason: "partial-approve",
      applicationId: "42",
      email: "ada@example.com",
    });
    expect(fake.notify.approval).not.toHaveBeenCalled();
  });

  it("does not update the marketing row when granting local access throws", async () => {
    const fake = deps();
    fake.access.grant.mockRejectedValueOnce(new Error("local database down"));
    const result = await approveBetaApplication({ id: "42", reviewer: "admin" }, fake);

    expect(result).toMatchObject({ ok: false, reason: "database" });
    expect(fake.marketing.approve).not.toHaveBeenCalled();
  });

  it("rejects the marketing row before revoking local access", async () => {
    const fake = deps();
    const result = await rejectBetaApplication({ id: "42", reviewer: "admin" }, fake);

    expect(result).toMatchObject({ ok: true, outcome: "rejected" });
    expect(fake.marketing.reject).toHaveBeenCalledWith("42", "admin");
    expect(fake.access.revoke).toHaveBeenCalledWith("ada@example.com");
    expect(fake.marketing.reject.mock.invocationCallOrder[0]).toBeLessThan(
      fake.access.revoke.mock.invocationCallOrder[0],
    );
  });

  it("reports a partial rejection when local access cannot be revoked", async () => {
    const fake = deps({ revoke: "no-database" });
    const result = await rejectBetaApplication({ id: "42", reviewer: "admin" }, fake);

    expect(result).toMatchObject({
      ok: false,
      reason: "partial-reject",
      applicationId: "42",
      email: "ada@example.com",
    });
  });

  it("reports a partial rejection when revoking local access throws", async () => {
    const fake = deps();
    fake.access.revoke.mockRejectedValueOnce(new Error("local database down"));
    const result = await rejectBetaApplication({ id: "42", reviewer: "admin" }, fake);

    expect(result).toMatchObject({ ok: false, reason: "partial-reject" });
  });

  it("does not revoke local access when the marketing rejection fails", async () => {
    const fake = deps({ reject: { state: "unavailable" } });
    const result = await rejectBetaApplication({ id: "42", reviewer: "admin" }, fake);

    expect(result).toMatchObject({ ok: false, reason: "unavailable" });
    expect(fake.access.revoke).not.toHaveBeenCalled();
  });

  it("revokes access for a rejected application", async () => {
    const fake = deps({
      load: { state: "ok", application: application({ status: "rejected" }) },
    });
    const result = await revokeBetaApplicationAccess({ id: "42" }, fake);

    expect(result).toMatchObject({ ok: true, outcome: "revoked" });
    expect(fake.access.revoke).toHaveBeenCalledWith("ada@example.com");
  });

  it("does not revoke access while the application is approved", async () => {
    const fake = deps({
      load: { state: "ok", application: application({ status: "approved" }) },
    });
    const result = await revokeBetaApplicationAccess({ id: "42" }, fake);

    expect(result).toMatchObject({ ok: false, reason: "status" });
    expect(fake.access.revoke).not.toHaveBeenCalled();
  });

  it("rejects invalid application ids before reading the database", async () => {
    const fake = deps();
    const result = await approveBetaApplication({ id: "1; drop table", reviewer: "admin" }, fake);

    expect(result).toMatchObject({ ok: false, reason: "invalid" });
    expect(fake.marketing.get).not.toHaveBeenCalled();
  });
});
