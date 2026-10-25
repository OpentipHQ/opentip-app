import { afterEach, describe, expect, it, vi } from "vitest";
import { sendAnnouncementEmail } from "@/lib/email/resend";
import { sendEmail } from "@/lib/email/transport";

const configured = {
  RESEND_API_KEY: "test-api-key",
  RESEND_FROM: "Opentip <hello@opentip.tech>",
  NODE_ENV: "test",
  APP_URL: "https://beta.opentip.tech",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("email transport", () => {
  it("skips delivery outside production when Resend is not configured", async () => {
    const result = await sendEmail({
      to: ["ada@example.com"],
      subject: "Hello",
      html: "<p>Hello</p>",
      text: "Hello",
      env: { NODE_ENV: "test" },
    });

    expect(result).toEqual({ delivered: false, mode: "skipped" });
  });

  it("requires Resend configuration in production", async () => {
    await expect(
      sendEmail({
        to: ["ada@example.com"],
        subject: "Hello",
        html: "<p>Hello</p>",
        text: "Hello",
        env: { NODE_ENV: "production" },
      }),
    ).rejects.toThrow("RESEND_API_KEY");
  });

  it("posts the rendered message to Resend", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendEmail({
      to: ["ada@example.com"],
      subject: "Hello",
      html: "<p>Hello</p>",
      text: "Hello",
      tags: [{ name: "type", value: "test" }],
      headers: { "X-Test": "1" },
      env: configured,
    });

    expect(result).toEqual({ delivered: true, mode: "resend" });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer test-api-key");
    expect(JSON.parse(String(init.body))).toMatchObject({
      from: configured.RESEND_FROM,
      to: ["ada@example.com"],
      subject: "Hello",
      html: "<p>Hello</p>",
      text: "Hello",
      tags: [{ name: "type", value: "test" }],
      headers: { "X-Test": "1" },
    });
  });

  it("throws when Resend rejects the request", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 429 })));

    await expect(
      sendEmail({
        to: ["ada@example.com"],
        subject: "Hello",
        html: "<p>Hello</p>",
        text: "Hello",
        env: configured,
      }),
    ).rejects.toThrow("Resend request failed (429)");
  });

  it("refuses an announcement without a preference link in production", async () => {
    await expect(
      sendAnnouncementEmail({
        to: "not-an-email",
        subject: "A smaller, faster update",
        body: "Push updates are smaller and faster now.",
        env: { ...configured, NODE_ENV: "production" },
      }),
    ).rejects.toThrow("SESSION_SECRET");
  });

  it("adds per-recipient unsubscribe headers to announcements", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendAnnouncementEmail({
      to: "ada@example.com",
      subject: "A smaller, faster update",
      body: "Push updates are smaller and faster now.",
      env: configured,
    });

    expect(result).toEqual({ delivered: true, mode: "resend" });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(body.to).toEqual(["ada@example.com"]);
    expect(body.html).toContain("Email preferences");
    expect(body.html).toContain("intent=unsubscribe");
    expect(body.headers["List-Unsubscribe"]).toMatch(
      /^<https:\/\/beta\.opentip\.tech\/api\/email\/unsubscribe\?token=/,
    );
    expect(body.headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
  });
});
