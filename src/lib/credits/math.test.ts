import { describe, expect, it } from "vitest";
import {
  CREDITS_PER_USD,
  MONTHLY_REFILL_CREDITS,
  NO_CREDITS_MESSAGE,
  creditsFromUsd,
  lowBalanceSentence,
  nextRefillLabel,
  openingCreditsFromUsd,
  refillSentence,
  spendActionLabel,
  usdFromCredits,
} from "@/lib/credits/config";
import {
  adjustmentDelta,
  balancesMatch,
  canStartAiAction,
  creditsByAction,
  creditsByWorkspace,
  creditsSpentByDay,
  historyLabel,
  isLowBalance,
  periodTotals,
  refillDue,
  sumCredits,
} from "@/lib/credits/math";

const now = new Date("2026-10-29T12:41:00.000Z");

describe("credit conversion", () => {
  it("uses 100 credits per dollar", () => {
    expect(CREDITS_PER_USD).toBe(100);
    expect(creditsFromUsd(0.91)).toBe(91);
    expect(creditsFromUsd(0.63)).toBe(63);
    expect(creditsFromUsd(0.04)).toBe(4);
    expect(creditsFromUsd(0)).toBe(0);
    expect(creditsFromUsd(-2)).toBe(0);
    expect(creditsFromUsd(0.004)).toBe(1);
    expect(usdFromCredits(412)).toBe(4.12);
    expect(openingCreditsFromUsd(12.5)).toBe(1250);
    expect(openingCreditsFromUsd(0)).toBe(0);
  });

  it("names AI actions without a fixed price", () => {
    expect(spendActionLabel("FIRST_BUILD")).toBe("First build");
    expect(spendActionLabel("PUSH_UPDATE")).toBe("Rebuild");
    expect(spendActionLabel("CHAT_EDIT")).toBe("Chat edit");
    expect(spendActionLabel("SUMMARY_REFRESH")).toBe("Regeneration");
  });
});

describe("credit ledger", () => {
  const rows = [
    {
      amount: MONTHLY_REFILL_CREDITS,
      kind: "REFILL" as const,
      createdAt: new Date("2026-10-01T00:00:00.000Z"),
      action: null,
      siteName: null,
    },
    {
      amount: 120,
      kind: "GRANT" as const,
      createdAt: new Date("2026-10-27T09:15:00.000Z"),
      action: null,
      siteName: null,
    },
    {
      amount: -91,
      kind: "SPEND" as const,
      createdAt: new Date("2026-10-27T09:02:00.000Z"),
      action: "First build",
      siteName: "Plugr",
      siteId: "plugr",
    },
    {
      amount: -63,
      kind: "SPEND" as const,
      createdAt: new Date("2026-10-28T16:20:00.000Z"),
      action: "Rebuild",
      siteName: "Plugr",
      siteId: "plugr",
    },
    {
      amount: -4,
      kind: "SPEND" as const,
      createdAt: new Date("2026-10-29T12:41:00.000Z"),
      action: "Chat edit",
      siteName: "Plugr",
      siteId: "plugr",
    },
    {
      amount: -18,
      kind: "SPEND" as const,
      createdAt: new Date("2026-10-20T08:00:00.000Z"),
      action: "Rebuild",
      siteName: "opentip-docs",
      siteId: "docs",
    },
  ];

  it("derives the balance from the ledger", () => {
    expect(sumCredits(rows)).toBe(444);
    expect(balancesMatch(444, rows)).toBe(true);
    expect(balancesMatch(443, rows)).toBe(false);
  });

  it("refuses AI actions only when the balance is empty", () => {
    expect(canStartAiAction(1)).toBe(true);
    expect(canStartAiAction(0)).toBe(false);
    expect(canStartAiAction(-4)).toBe(false);
    expect(NO_CREDITS_MESSAGE).toBe("No credits left.");
  });

  it("grants the monthly refill once per UTC month", () => {
    expect(MONTHLY_REFILL_CREDITS).toBe(500);
    expect(refillDue(rows, now)).toBe(false);
    expect(refillDue(rows, new Date("2026-11-01T00:00:00.000Z"))).toBe(true);
    expect(refillDue([], now)).toBe(true);
    expect(nextRefillLabel(now)).toBe("Nov 1");
    expect(refillSentence(now)).toBe("Refills Nov 1");
  });

  it("totals the current month and groups spend", () => {
    expect(periodTotals(rows, now)).toEqual({ granted: 620, used: 176 });
    expect(creditsByWorkspace(rows)).toEqual([
      { name: "Plugr", credits: 158 },
      { name: "opentip-docs", credits: 18 },
    ]);
    expect(creditsByAction(rows)).toEqual([
      { name: "First build", credits: 91 },
      { name: "Rebuild", credits: 81 },
      { name: "Chat edit", credits: 4 },
    ]);
    const days = creditsSpentByDay(rows, now);
    expect(days[0]?.label).toBe("Oct 1");
    expect(days.at(-1)).toMatchObject({ label: "Today", credits: 4 });
    expect(days.find((day) => day.day === "2026-10-28")).toMatchObject({ credits: 63 });
  });

  it("labels history rows and requires a reason for admin changes", () => {
    expect(historyLabel(rows[2]!)).toBe("First build, Plugr");
    expect(historyLabel({ kind: "GRANT" })).toBe("Admin grant");
    expect(historyLabel({ kind: "REFILL" })).toBe("Monthly refill");
    expect(historyLabel({ kind: "REMOVAL" })).toBe("Admin removal");
    expect(adjustmentDelta({ mode: "grant", credits: 120, balance: 10, reason: "refund" })).toEqual({
      ok: true,
      delta: 120,
      reason: "refund",
    });
    expect(adjustmentDelta({ mode: "remove", credits: 20, balance: 10, reason: "correction" })).toEqual({
      ok: false,
      error: "Not enough credits.",
    });
    expect(adjustmentDelta({ mode: "grant", credits: 20, balance: 10, reason: "  " })).toEqual({
      ok: false,
      error: "A reason is required.",
    });
  });

  it("writes the low-balance line without explaining a cap", () => {
    expect(isLowBalance(34)).toBe(true);
    expect(isLowBalance(51)).toBe(false);
    expect(lowBalanceSentence(34, now)).toBe("34 credits left. Refills Nov 1.");
    expect(lowBalanceSentence(-8, now)).toBe("0 credits left. Refills Nov 1.");
  });
});
