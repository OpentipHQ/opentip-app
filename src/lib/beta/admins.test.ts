import { describe, expect, it } from "vitest";
import { bootstrapAdminEmails, isBootstrapAdmin, signInRole } from "@/lib/beta/admins";

describe("ADMIN_EMAILS", () => {
  it("parses a comma-separated list", () => {
    expect([
      ...bootstrapAdminEmails(" You@Example.com, other@opentip.tech ,, not-an-email "),
    ]).toEqual(["you@example.com", "other@opentip.tech"]);
  });

  it("treats a listed email as an approved admin", () => {
    const raw = "you@example.com, other@opentip.tech";
    expect(isBootstrapAdmin(" YOU@example.com ", raw)).toBe(true);
    expect(isBootstrapAdmin("stranger@example.com", raw)).toBe(false);
    expect(signInRole("You@Example.com", raw)).toBe("ADMIN");
    expect(signInRole("stranger@example.com", raw)).toBe("USER");
  });

  it("approves nobody when the list is empty", () => {
    expect([...bootstrapAdminEmails("")]).toEqual([]);
    expect([...bootstrapAdminEmails(undefined)]).toEqual([]);
    expect(isBootstrapAdmin("you@example.com", "")).toBe(false);
    expect(isBootstrapAdmin("you@example.com", undefined)).toBe(false);
    expect(signInRole("you@example.com", "")).toBe("USER");
    expect(signInRole(null, "you@example.com")).toBe("USER");
  });
});
