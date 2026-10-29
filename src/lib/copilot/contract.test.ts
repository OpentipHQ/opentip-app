import { describe, expect, it } from "vitest";
import {
  GenerationContractError,
  normalizeSlug,
  parseGenerationResult,
} from "@/lib/copilot/contract";

function result(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    pages: [
      {
        slug: "",
        section: "Start",
        title: "Home",
        description: "Welcome",
        navOrder: 0,
        content: "Hello",
      },
      {
        slug: "Guides/Setup",
        section: "Guides",
        title: "Setup",
        description: null,
        navOrder: 10,
        content: "Steps",
      },
    ],
    removedSlugs: ["old/page", "old/page"],
    changeNote: "Initial docs",
    ...overrides,
  });
}

describe("generation contract", () => {
  it("normalizes slugs and parses a fenced response", () => {
    const parsed = parseGenerationResult(`\`\`\`json\n${result()}\n\`\`\``, {
      allowEmpty: false,
      requireHome: true,
      maxPages: 10,
    });
    expect(parsed.pages[0]?.slug).toBe("");
    expect(parsed.pages[1]?.slug).toBe("guides/setup");
    expect(parsed.removedSlugs).toEqual(["old/page"]);
    expect(parsed.changeNote).toBe("Initial docs");
  });

  it("rejects invalid, reserved, duplicate, and missing home pages", () => {
    expect(() =>
      parseGenerationResult("not json", { allowEmpty: false }),
    ).toThrow(GenerationContractError);
    expect(() =>
      parseGenerationResult(
        result({ pages: [{ slug: "api", title: "API", content: "x" }] }),
        { allowEmpty: false },
      ),
    ).toThrow(GenerationContractError);
    expect(() =>
      parseGenerationResult(
        result({
          pages: [
            { slug: "one", title: "One", content: "x" },
            { slug: "one", title: "Two", content: "y" },
          ],
        }),
        { allowEmpty: false },
      ),
    ).toThrow(GenerationContractError);
    expect(() =>
      parseGenerationResult(result({ pages: [] }), {
        allowEmpty: false,
        requireHome: true,
      }),
    ).toThrow(GenerationContractError);
  });

  it("allows an empty update and normalizes empty slugs", () => {
    const parsed = parseGenerationResult(
      JSON.stringify({ pages: [], removedSlugs: [], changeNote: null }),
      { allowEmpty: true },
    );
    expect(parsed.pages).toEqual([]);
    expect(normalizeSlug("/")).toBe("");
    expect(normalizeSlug("Guides/Setup")).toBe("guides/setup");
  });

  it("repairs common model slug mistakes", () => {
    expect(normalizeSlug("getting_started")).toBe("getting-started");
    expect(normalizeSlug("Guides / Setup Guide")).toBe("guides/setup-guide");
    expect(normalizeSlug("api/v2.0")).toBe("api/v2-0");
    expect(normalizeSlug("config.json")).toBe("config-json");
    expect(normalizeSlug("--weird--/---path---")).toBe("weird/path");
    expect(normalizeSlug("@@@")).toBeNull();
    expect(normalizeSlug("api")).toBeNull();
    expect(normalizeSlug("a".repeat(121))).toBeNull();
  });

  it("names the bad slug when it cannot be repaired", () => {
    expect(() =>
      parseGenerationResult(
        result({
          pages: [{ slug: "api", title: "API", content: "x", section: null, description: null, navOrder: 0 }],
        }),
        { allowEmpty: false },
      ),
    ).toThrow(/invalid slug: "api"/);
  });
});
