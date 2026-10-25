import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  findMany: vi.fn(),
  findUnique: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getPrisma: () => ({ emailPreference: db }),
}));

import {
  emailPreferenceLinks,
  emailPreferenceToken,
  filterAnnouncementRecipients,
  loadAnnouncementPreference,
  readEmailPreferenceToken,
  setAnnouncementPreference,
} from "@/lib/email/preferences";

beforeEach(() => {
  db.findMany.mockReset();
  db.findUnique.mockReset();
  db.upsert.mockReset();
});

describe("email preference tokens", () => {
  it("round-trips a normalized email address", () => {
    const token = emailPreferenceToken(" Ada@Example.com ", "test-secret");

    expect(token).toBeTruthy();
    expect(readEmailPreferenceToken(token, "test-secret")).toBe("ada@example.com");
  });

  it("rejects a tampered token", () => {
    const token = emailPreferenceToken("ada@example.com", "test-secret")!;
    const tampered = `${token.slice(0, -1)}${token.endsWith("A") ? "B" : "A"}`;

    expect(readEmailPreferenceToken(tampered, "test-secret")).toBeNull();
  });

  it("rejects a token signed with another secret", () => {
    const token = emailPreferenceToken("ada@example.com", "test-secret");

    expect(readEmailPreferenceToken(token, "other-secret")).toBeNull();
  });

  it("returns no token when the secret is missing", () => {
    expect(emailPreferenceToken("ada@example.com", null)).toBeNull();
    expect(readEmailPreferenceToken("v1.invalid.signature", null)).toBeNull();
  });

  it("builds manage, unsubscribe, and one-click links", () => {
    const links = emailPreferenceLinks("ada@example.com", "https://beta.opentip.tech/");

    expect(links?.manageUrl).toMatch(
      /^https:\/\/beta\.opentip\.tech\/email\/preferences\?token=v1\./,
    );
    expect(links?.unsubscribeUrl).toContain("&intent=unsubscribe");
    expect(links?.oneClickUnsubscribeUrl).toMatch(
      /^https:\/\/beta\.opentip\.tech\/api\/email\/unsubscribe\?token=v1\./,
    );
  });
});

describe("announcement preferences", () => {
  it("defaults missing preferences to subscribed", async () => {
    db.findUnique.mockResolvedValueOnce(null);

    await expect(loadAnnouncementPreference("ADA@example.com")).resolves.toEqual({
      state: "ok",
      announcements: true,
    });
    expect(db.findUnique).toHaveBeenCalledWith({
      where: { email: "ada@example.com" },
      select: { announcements: true },
    });
  });

  it("stores the preference by normalized email", async () => {
    db.upsert.mockResolvedValueOnce({});

    await expect(setAnnouncementPreference("ADA@example.com", false)).resolves.toEqual({
      state: "ok",
      announcements: false,
    });
    expect(db.upsert).toHaveBeenCalledWith({
      where: { email: "ada@example.com" },
      create: { email: "ada@example.com", announcements: false },
      update: { announcements: false },
    });
  });

  it("removes opted-out and duplicate recipients", async () => {
    db.findMany.mockResolvedValueOnce([{ email: "ada@example.com" }]);

    await expect(
      filterAnnouncementRecipients([
        "ADA@example.com",
        "bea@example.com",
        "bea@example.com",
        "not-an-email",
        " ada@example.com ",
      ]),
    ).resolves.toEqual({
      recipients: ["bea@example.com"],
      suppressed: ["ada@example.com"],
    });
    expect(db.findMany).toHaveBeenCalledWith({
      where: {
        email: { in: ["ada@example.com", "bea@example.com"] },
        announcements: false,
      },
      select: { email: true },
    });
  });
});
