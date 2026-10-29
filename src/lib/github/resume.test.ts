import { describe, expect, it } from "vitest";
import { nextSiteStatus } from "@/lib/github/resume";

describe("paused site resume", () => {
  it("restores a published site and leaves a different pause reason alone", () => {
    expect(
      nextSiteStatus({
        status: "PAUSED",
        pausedReason: "github_app_suspended",
        publishedPageCount: 3,
        reasons: ["github_app_suspended"],
      }),
    ).toBe("ACTIVE");
    expect(
      nextSiteStatus({
        status: "PAUSED",
        pausedReason: "github_app_uninstalled",
        publishedPageCount: 3,
        reasons: ["github_app_suspended"],
      }),
    ).toBeNull();
    expect(
      nextSiteStatus({
        status: "PAUSED",
        pausedReason: "repo_removed",
        publishedPageCount: 0,
        reasons: ["repo_removed", "repo_deleted"],
      }),
    ).toBe("PENDING");
    expect(
      nextSiteStatus({
        status: "ACTIVE",
        pausedReason: null,
        publishedPageCount: 1,
        reasons: ["github_app_suspended"],
      }),
    ).toBeNull();
  });
});
