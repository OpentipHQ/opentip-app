import { describe, expect, it } from "vitest";
import { devBypassEnabled, sessionCookieOptions, signSession, verifySession } from "@/lib/session";

describe("session cookie", () => {
  it("round-trips a signed session and rejects a tampered one", async () => {
    const secret = "session-secret";
    const token = await signSession(
      {
        userId: "user_1",
        login: "ada",
        name: "Ada",
        role: "ADMIN",
        exp: Date.now() + 60_000,
      },
      secret,
    );
    const session = await verifySession(token, secret);
    expect(session?.login).toBe("ada");
    expect(session?.role).toBe("ADMIN");
    const [body, signature] = token.split(".");
    expect(await verifySession(`${body}.${signature}x`, secret)).toBeNull();
    expect(devBypassEnabled({ NODE_ENV: "production", AUTH_DEV_BYPASS: "1" })).toBe(
      false,
    );
    expect(devBypassEnabled({ NODE_ENV: "development", AUTH_DEV_BYPASS: "1" })).toBe(
      true,
    );
  });

  it("uses a host-only Lax cookie so the sign-in return from GitHub can send it", () => {
    expect(sessionCookieOptions(600, "production")).toEqual({
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: 600,
    });
    expect(sessionCookieOptions(600, "development").secure).toBe(false);
    expect("domain" in sessionCookieOptions(600, "production")).toBe(false);
  });
});
