import { describe, expect, it } from "vitest";
import { signActAs, writesBlocked } from "@/lib/admin/act-as";
import { verifySession } from "@/lib/session";

const target = { id: "user_2", login: "ada", name: "Ada", role: "USER" as const };

describe("act-as cookie", () => {
  it("signs an actor and target pair", async () => {
    const token = await signActAs("admin_1", target, "secret", Date.now());
    expect(token).toBeTruthy();
    const parsed = await verifySession(token ?? undefined, "secret");
    expect(parsed).toMatchObject({ userId: "user_2", actorId: "admin_1", login: "ada" });
  });

  it("rejects a tampered token", async () => {
    const token = await signActAs("admin_1", target, "secret", Date.now());
    expect(token).toBeTruthy();
    expect(await verifySession(`${token}x`, "secret")).toBeNull();
  });

  it("expires after the act-as window", async () => {
    const token = await signActAs("admin_1", target, "secret", Date.now());
    expect(token).toBeTruthy();
    const later = Date.now() + 31 * 60 * 1000;
    expect(await verifySession(token ?? undefined, "secret", later)).toBeNull();
  });

  it("reports writes as blocked whenever act-as exists", () => {
    expect(writesBlocked(null)).toBe(false);
    expect(
      writesBlocked({
        userId: "user_2",
        login: "ada",
        name: "Ada",
        role: "USER",
        exp: Date.now() + 1000,
        actorId: "admin_1",
      }),
    ).toBe(true);
  });
});
