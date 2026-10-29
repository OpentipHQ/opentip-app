import { describe, expect, it } from "vitest";
import { markDraft } from "@/lib/workspace/draft";

describe("draft highlights", () => {
  it("marks edited and new sections", () => {
    const live = ["# Getting started", "Install Plugr.", "", "## Install", "Requires Node 16."].join("\n");
    const draft = [
      "# Getting started",
      "Install Plugr.",
      "",
      "## Install",
      "Requires Node 18.",
      "",
      "## Troubleshooting",
      "Clear the package cache.",
    ].join("\n");
    const marks = markDraft(live, draft);
    expect(marks.find((section) => section.heading === "Getting started")?.mark).toBe("same");
    expect(marks.find((section) => section.heading === "Install")?.mark).toBe("edited");
    expect(marks.find((section) => section.heading === "Troubleshooting")?.mark).toBe("new");
  });
});
