import { describe, expect, it } from "vitest";
import {
  alertRecipients,
  dayKey,
  median,
  selectUserOutliers,
  spendThresholds,
  utcDay,
} from "@/lib/admin/spend";

describe("spend alerts", () => {
  it("uses UTC day boundaries", () => {
    const day = utcDay(new Date("2026-10-25T23:30:00-05:00"));
    expect(day.toISOString()).toBe("2026-10-26T00:00:00.000Z");
    expect(dayKey(day)).toBe("2026-10-26");
  });

  it("computes a median", () => {
    expect(median([])).toBe(0);
    expect(median([4])).toBe(4);
    expect(median([1, 3, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it("selects only users above the flat threshold and multiple", () => {
    const rows = [
      { userId: "a", costUsd: 1 },
      { userId: "b", costUsd: 1 },
      { userId: "c", costUsd: 1 },
      { userId: "d", costUsd: 9 },
    ];
    expect(selectUserOutliers(rows, { minUsd: 5, multiple: 5 })).toEqual([
      { userId: "d", costUsd: 9 },
    ]);
    expect(selectUserOutliers(rows, { minUsd: 50, multiple: 5 })).toEqual([]);
  });

  it("falls back to safe thresholds and parses recipients", () => {
    expect(spendThresholds({})).toEqual({ dailyUsd: 25, userUsd: 5, userMultiple: 5 });
    expect(
      spendThresholds({ SPEND_ALERT_DAILY_USD: "50", SPEND_ALERT_USER_USD: "8" }),
    ).toMatchObject({ dailyUsd: 50, userUsd: 8 });
    expect(alertRecipients("A@Example.com, b@example.com, bad")).toEqual([
      "a@example.com",
      "b@example.com",
    ]);
  });
});
