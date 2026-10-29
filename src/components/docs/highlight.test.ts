import { describe, expect, it } from "vitest";
import { extractHeadings, highlight, readSourceComment, sourceUrl } from "@/components/docs/highlight";

describe("docs highlighting", () => {
  it("highlights keywords and escapes html", () => {
    const html = highlight("const name = \"<Plugr>\";", "ts");
    expect(html).toContain("text-violet-700");
    expect(html).toContain("const");
    expect(html).toContain("&lt;Plugr&gt;");
    expect(html).not.toContain("<Plugr>");
  });

  it("reads headings and source citations", () => {
    const markdown = "## Install\n\n### Database\n\n<!-- sources: package.json src/app/api/health/route.ts -->";
    expect(extractHeadings(markdown)).toEqual([
      { id: "install", text: "Install", level: 2 },
      { id: "database", text: "Database", level: 3 },
    ]);
    expect(readSourceComment(markdown)).toEqual([
      "package.json",
      "src/app/api/health/route.ts",
    ]);
    expect(sourceUrl("optimusexe/Plugr", "main", "src/app/api/health/route.ts")).toBe(
      "https://github.com/optimusexe/Plugr/blob/main/src/app/api/health/route.ts",
    );
  });
});
