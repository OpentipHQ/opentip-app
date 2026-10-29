import { describe, expect, it } from "vitest";
import { readWorkerConfig } from "@/worker/config";

describe("worker config", () => {
  it("uses safe beta defaults", () => {
    const config = readWorkerConfig({ WORKER_ID: "worker-a" });
    expect(config.workerId).toBe("worker-a");
    expect(config.concurrency).toBe(2);
    expect(config.maxConcurrentHeavy).toBe(1);
    expect(config.leaseMs).toBe(300_000);
  });

  it("clamps concurrency and heavy limits", () => {
    const config = readWorkerConfig({
      WORKER_CONCURRENCY: "99",
      MAX_CONCURRENT_HEAVY: "9",
    });
    expect(config.concurrency).toBe(4);
    expect(config.maxConcurrentHeavy).toBe(4);
    const small = readWorkerConfig({
      WORKER_CONCURRENCY: "1",
      MAX_CONCURRENT_HEAVY: "3",
    });
    expect(small.concurrency).toBe(1);
    expect(small.maxConcurrentHeavy).toBe(1);
  });

  it("keeps heartbeats well inside the lease", () => {
    const config = readWorkerConfig({
      WORKER_LEASE_MS: "30000",
      WORKER_HEARTBEAT_MS: "120000",
    });
    expect(config.heartbeatMs).toBe(10_000);
  });
});
