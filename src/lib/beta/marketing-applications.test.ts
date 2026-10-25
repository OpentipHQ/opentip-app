import { describe, expect, it } from "vitest";
import {
  formatApplicationDate,
  formatMonthlyPay,
  isMarketingApplicationId,
  mapMarketingApplication,
  mapMarketingApplicationSummary,
  normalizeMarketingStatus,
} from "@/lib/beta/marketing-applications";

const createdAt = new Date("2026-10-20T12:30:00.000Z");

describe("marketing applications", () => {
  it("maps a summary row and keeps numeric values as strings", () => {
    const application = mapMarketingApplicationSummary({
      id: "42",
      name: "Ada Lovelace",
      email: "Ada@Example.com",
      github_username: "ada",
      x_handle: null,
      repo_url: "https://github.com/ada/engine",
      monthly_pay_usd: "25.00",
      status: "pending",
      created_at: createdAt,
    });

    expect(application).toEqual({
      id: "42",
      name: "Ada Lovelace",
      email: "Ada@Example.com",
      githubUsername: "ada",
      xHandle: null,
      repoUrl: "https://github.com/ada/engine",
      monthlyPayUsd: "25.00",
      status: "pending",
      createdAt: "2026-10-20T12:30:00.000Z",
    });
  });

  it("maps the full application answers", () => {
    const application = mapMarketingApplication({
      id: "42",
      name: "Ada",
      email: "ada@example.com",
      github_username: "ada",
      x_handle: "@ada",
      repo_url: "https://github.com/ada/engine",
      monthly_pay_usd: null,
      status: "approved",
      created_at: createdAt,
      project_summary: "A docs project.",
      docs_readers: "Developers",
      docs_tooling: "Markdown",
      docs_pain: "Keeping pages current.",
      push_frequency: "Weekly",
      feedback_call: true,
      reviewed_at: new Date("2026-10-21T08:00:00.000Z"),
      reviewed_by: "admin@example.com",
    });

    expect(application).toMatchObject({
      status: "approved",
      xHandle: "@ada",
      projectSummary: "A docs project.",
      docsReaders: "Developers",
      docsTooling: "Markdown",
      docsPain: "Keeping pages current.",
      pushFrequency: "Weekly",
      feedbackCall: true,
      reviewedAt: "2026-10-21T08:00:00.000Z",
      reviewedBy: "admin@example.com",
    });
  });

  it("normalizes known statuses and treats unknown statuses as pending", () => {
    expect(normalizeMarketingStatus("APPROVED")).toBe("approved");
    expect(normalizeMarketingStatus("Rejected")).toBe("rejected");
    expect(normalizeMarketingStatus("needs-review")).toBe("pending");
    expect(normalizeMarketingStatus(null)).toBe("pending");
  });

  it("formats pay answers and dates", () => {
    expect(formatMonthlyPay(null)).toBe("Not answered");
    expect(formatMonthlyPay("bad")).toBe("Not answered");
    expect(formatMonthlyPay("25")).toBe("$25.00");
    expect(formatApplicationDate("2026-10-20T12:30:00.000Z")).toBe("2026-10-20");
    expect(formatApplicationDate("")).toBe("Unknown");
  });

  it("accepts only bigint-shaped application ids", () => {
    expect(isMarketingApplicationId("1")).toBe(true);
    expect(isMarketingApplicationId("9223372036854775807")).toBe(true);
    expect(isMarketingApplicationId("")).toBe(false);
    expect(isMarketingApplicationId("1; drop table beta_application")).toBe(false);
    expect(isMarketingApplicationId("-1")).toBe(false);
    expect(isMarketingApplicationId("1.5")).toBe(false);
  });
});
