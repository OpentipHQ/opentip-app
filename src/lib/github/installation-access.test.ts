import { describe, expect, it } from "vitest";
import { installationOwnerUpdate, installationVisibleWhere } from "@/lib/github/installation-access";

describe("shared org installations", () => {
  it("keeps the first org owner and adds the next member", () => {
    expect(
      installationOwnerUpdate({
        accountType: "Organization",
        existingUserId: "user_a",
        linkingUserId: "user_b",
      }),
    ).toEqual({ userId: null, addMember: true });
    expect(
      installationOwnerUpdate({
        accountType: "Organization",
        existingUserId: null,
        linkingUserId: "user_a",
      }),
    ).toEqual({ userId: "user_a", addMember: true });
  });

  it("still assigns a personal installation to the linking user", () => {
    expect(
      installationOwnerUpdate({
        accountType: "User",
        existingUserId: "user_a",
        linkingUserId: "user_a",
      }),
    ).toEqual({ userId: "user_a", addMember: true });
  });

  it("matches either the owner or a member", () => {
    expect(installationVisibleWhere("user_b")).toEqual({
      uninstalledAt: null,
      suspendedAt: null,
      OR: [{ userId: "user_b" }, { members: { some: { userId: "user_b" } } }],
    });
  });
});
