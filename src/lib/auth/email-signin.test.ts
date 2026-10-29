import { describe, expect, it } from "vitest";
import { emailSignInAllowed } from "@/lib/auth/email-signin";

describe("email sign-in switch", () => {
  it("blocks codes when email sign-in is disabled and allows a new address", () => {
    expect(emailSignInAllowed({ emailSignInEnabled: false })).toBe(false);
    expect(emailSignInAllowed({ emailSignInEnabled: true })).toBe(true);
    expect(emailSignInAllowed(null)).toBe(true);
  });
});
