import { describe, expect, it } from "vitest";
import { authEntryTarget } from "@/lib/auth/entry";

describe("auth entry", () => {
  it("leaves a signed-out visitor on the page", () => {
    expect(authEntryTarget({ signedIn: false, approved: false })).toBeNull();
    expect(authEntryTarget({ signedIn: false, approved: true })).toBeNull();
  });

  it("sends a signed-in approved user to the dashboard", () => {
    expect(authEntryTarget({ signedIn: true, approved: true })).toBe("/dashboard");
  });

  it("sends a signed-in unapproved user to the waitlist", () => {
    expect(authEntryTarget({ signedIn: true, approved: false })).toBe("/waitlist");
  });
});
