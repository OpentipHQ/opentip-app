import { describe, expect, it } from "vitest";
import { githubAppInstallUrl, githubAppSlug } from "@/lib/config";

describe("github app slug", () => {
  it("defaults to opentip-copilot", () => {
    expect(githubAppSlug({})).toBe("opentip-copilot");
    expect(githubAppInstallUrl({})).toBe(
      "https://github.com/apps/opentip-copilot/installations/new",
    );
  });

  it("uses GITHUB_APP_SLUG when set", () => {
    expect(githubAppSlug({ GITHUB_APP_SLUG: "Custom-Slug" })).toBe("custom-slug");
    expect(githubAppInstallUrl({ GITHUB_APP_SLUG: "custom-slug" })).toBe(
      "https://github.com/apps/custom-slug/installations/new",
    );
  });
});
