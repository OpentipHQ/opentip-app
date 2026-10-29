import { describe, expect, it } from "vitest";
import { cronAuthorized } from "@/lib/admin/cron-auth";

describe("cron authorization", () => {
  it("accepts only the bearer secret and ignores a missing secret", () => {
    expect(cronAuthorized("Bearer night-key", "night-key")).toBe(true);
    expect(cronAuthorized("Bearer other", "night-key")).toBe(false);
    expect(cronAuthorized("Bearer night-key", undefined)).toBe(false);
    expect(cronAuthorized(null, "night-key")).toBe(false);
  });
});