export function utcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function dayKey(day: Date): string {
  return day.toISOString().slice(0, 10);
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  return (sorted[middle - 1] + sorted[middle]) / 2;
}

export function selectUserOutliers(
  rows: Array<{ userId: string; costUsd: number }>,
  args: { minUsd: number; multiple: number },
): Array<{ userId: string; costUsd: number }> {
  if (rows.length === 0) return [];
  const baseline = median(rows.map((row) => row.costUsd));
  return rows.filter((row) => {
    if (row.costUsd < args.minUsd) return false;
    if (baseline <= 0) return true;
    return row.costUsd >= baseline * args.multiple;
  });
}

export function spendThresholds(env: Record<string, string | undefined> = process.env): {
  dailyUsd: number;
  userUsd: number;
  userMultiple: number;
} {
  const numberOr = (value: string | undefined, fallback: number) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  };
  return {
    dailyUsd: numberOr(env.SPEND_ALERT_DAILY_USD, 25),
    userUsd: numberOr(env.SPEND_ALERT_USER_USD, 5),
    userMultiple: numberOr(env.SPEND_ALERT_USER_MULTIPLE, 5),
  };
}

export function alertRecipients(value: string | undefined): string[] {
  if (!value) return [];
  return Array.from(
    new Set(
      value
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter((email) => email.includes("@")),
    ),
  );
}
