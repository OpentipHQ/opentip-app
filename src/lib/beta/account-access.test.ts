import { describe, expect, it } from "vitest";
import {
  betaAccessAfterEmailChange,
  betaAccessEmailsToRevokeOnDelete,
} from "@/lib/beta/account-access";

describe("beta approval and account email", () => {
  it("does not move approval when the account email changes", () => {
    expect(betaAccessAfterEmailChange()).toEqual({
      revokePreviousEmail: false,
      grantNextEmail: false,
    });
  });

  it("revokes approval for the address when the account is deleted", () => {
    expect(betaAccessEmailsToRevokeOnDelete("ada@example.com")).toEqual(["ada@example.com"]);
    expect(betaAccessEmailsToRevokeOnDelete(null)).toEqual([]);
  });
});
