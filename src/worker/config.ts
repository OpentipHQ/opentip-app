import { randomUUID } from "node:crypto";

export type WorkerConfig = {
  workerId: string;
  concurrency: number;
  maxConcurrentHeavy: number;
  pollMs: number;
  leaseMs: number;
  heartbeatMs: number;
  reaperMs: number;
};

export function readWorkerConfig(
  env: Record<string, string | undefined> = process.env,
): WorkerConfig {
  const concurrency = clampInt(env.WORKER_CONCURRENCY, 2, 1, 4);
  const maxConcurrentHeavy = clampInt(
    env.MAX_CONCURRENT_HEAVY,
    1,
    1,
    concurrency,
  );
  const leaseMs = clampInt(env.WORKER_LEASE_MS, 300_000, 30_000, 900_000);
  return {
    workerId: env.WORKER_ID?.trim() || `${process.pid}-${randomUUID().slice(0, 8)}`,
    concurrency,
    maxConcurrentHeavy,
    pollMs: clampInt(env.WORKER_POLL_MS, 1_000, 250, 30_000),
    leaseMs,
    heartbeatMs: Math.min(
      clampInt(env.WORKER_HEARTBEAT_MS, 30_000, 5_000, 120_000),
      Math.max(5_000, Math.floor(leaseMs / 3)),
    ),
    reaperMs: clampInt(env.WORKER_REAPER_MS, 60_000, 10_000, 300_000),
  };
}

function clampInt(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}
