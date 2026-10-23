import { describe, expect, it } from "vitest";
import { devBypassEnabled, signSession, verifySession } from "@/lib/session";

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
});
