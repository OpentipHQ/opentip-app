import { describe, expect, it } from "vitest";
import { chatEditRequest } from "@/lib/copilot/prompts";
import { parseGenerationResult } from "@/lib/copilot/contract";
import { createFakeProvider } from "@/lib/copilot/providers";

describe("fake Copilot provider", () => {
  it("returns a valid home page for a chat edit", async () => {
    const provider = createFakeProvider("small", "fake-model");
    const result = await provider.complete(
      chatEditRequest({
        siteName: "Sample",
        page: {
          slug: "",
          section: "Start",
          title: "Home",
          description: null,
          navOrder: 0,
          content: "Welcome",
        },
        instruction: "Add a short example.",
      }),
    );
    const parsed = parseGenerationResult(result.text, {
      allowEmpty: false,
      maxPages: 1,
    });
    expect(parsed.pages).toHaveLength(1);
    expect(parsed.pages[0]).toMatchObject({ slug: "", title: "Home" });
  });
});
