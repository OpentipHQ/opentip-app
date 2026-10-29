export type DraftMark = "same" | "edited" | "new";

export type DraftSection = {
  heading: string | null;
  markdown: string;
  mark: DraftMark;
};

export function markdownSections(content: string): { heading: string | null; markdown: string }[] {
  const sections: { heading: string | null; lines: string[] }[] = [];
  let current: { heading: string | null; lines: string[] } = { heading: null, lines: [] };
  for (const line of content.split("\n")) {
    if (/^#{1,3} /.test(line) && (current.lines.length > 0 || current.heading)) {
      sections.push(current);
      current = { heading: line.replace(/^#{1,3} /, "").trim(), lines: [line] };
    } else if (/^#{1,3} /.test(line)) {
      current = { heading: line.replace(/^#{1,3} /, "").trim(), lines: [line] };
    } else {
      current.lines.push(line);
    }
  }
  if (current.lines.length > 0 || current.heading) sections.push(current);
  return sections
    .map((section) => ({
      heading: section.heading,
      markdown: section.lines.join("\n").trim(),
    }))
    .filter((section) => section.markdown.length > 0);
}

export function markDraft(live: string, draft: string): DraftSection[] {
  const previous = new Map(
    markdownSections(live).map((section) => [section.heading, section.markdown]),
  );
  return markdownSections(draft).map((section) => {
    const before = previous.get(section.heading);
    if (before === undefined) return { ...section, mark: "new" };
    if (before.trim() !== section.markdown.trim()) return { ...section, mark: "edited" };
    return { ...section, mark: "same" };
  });
}
