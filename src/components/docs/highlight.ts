const JS_KEYWORDS = [
  "const", "let", "var", "function", "return", "if", "else", "for", "while",
  "export", "import", "from", "async", "await", "new", "class", "extends",
  "type", "interface", "enum", "public", "private", "static", "try", "catch",
  "throw", "of", "in", "as", "true", "false", "null", "undefined",
];

const BASH_KEYWORDS = ["echo", "cd", "export", "npm", "npx", "pnpm", "yarn", "bun", "git", "sudo", "fi", "then", "do", "done"];

const SQL_KEYWORDS = ["select", "from", "where", "insert", "into", "values", "update", "delete", "create", "table", "and", "or", "not", "null"];

export function highlight(code: string, language: string): string {
  const keywords = keywordsFor(language);
  const hashComments = /^(?:bash|sh|shell|zsh|py|python|prisma|env|dotenv)$/.test(normalizeLang(language));
  let html = "";
  let index = 0;
  while (index < code.length) {
    const rest = code.slice(index);
    if (rest.startsWith("//") || (hashComments && rest.startsWith("#"))) {
      const end = rest.indexOf("\n");
      const slice = end === -1 ? rest : rest.slice(0, end);
      html += span("text-muted-foreground", slice);
      index += slice.length;
      continue;
    }
    const quote = rest[0];
    if (quote === '"' || quote === "'" || quote === "`") {
      let cursor = 1;
      while (cursor < rest.length && rest[cursor] !== quote) {
        if (rest[cursor] === "\\") cursor += 1;
        cursor += 1;
      }
      if (cursor < rest.length) cursor += 1;
      html += span("text-emerald-700 dark:text-emerald-300", rest.slice(0, cursor));
      index += cursor;
      continue;
    }
    const number = /^[0-9]+(?:\.[0-9]+)?/.exec(rest);
    if (number && (index === 0 || /[^A-Za-z0-9_]/.test(code[index - 1] ?? ""))) {
      html += span("text-amber-700 dark:text-amber-300", number[0]);
      index += number[0].length;
      continue;
    }
    const word = /^[A-Za-z_][A-Za-z0-9_]*/.exec(rest);
    if (word) {
      html += keywords.has(word[0])
        ? span("text-violet-700 dark:text-violet-300", word[0])
        : escapeHtml(word[0]);
      index += word[0].length;
      continue;
    }
    html += escapeHtml(rest[0] ?? "");
    index += 1;
  }
  return html;
}

export function extractHeadings(markdown: string): Array<{ id: string; text: string; level: 2 | 3 }> {
  const counts = new Map<string, number>();
  const headings: Array<{ id: string; text: string; level: 2 | 3 }> = [];
  for (const line of markdown.split("\n")) {
    const match = /^(#{2,3})\s+(.+?)\s*$/.exec(line);
    if (!match) continue;
    const text = match[2].replace(/[`*_[\]]/g, "").trim();
    if (!text) continue;
    headings.push({
      id: nextHeadingId(text, counts),
      text,
      level: match[1].length === 2 ? 2 : 3,
    });
  }
  return headings;
}

export function nextHeadingId(text: string, counts: Map<string, number>): string {
  const base = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "section";
  const seen = (counts.get(base) ?? 0) + 1;
  counts.set(base, seen);
  return seen === 1 ? base : `${base}-${seen}`;
}

export function readSourceComment(content: string): string[] {
  const match = content.match(/<!--\s*sources:\s*([^>]+?)\s*-->/);
  if (!match) return [];
  return match[1].split(/\s+/).filter(Boolean);
}

export function sourceUrl(fullName: string, branch: string, path: string): string {
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `https://github.com/${fullName}/blob/${encodeURIComponent(branch)}/${encoded}`;
}

function keywordsFor(language: string): Set<string> {
  const lang = normalizeLang(language);
  if (lang === "bash" || lang === "sh" || lang === "shell" || lang === "zsh") return new Set(BASH_KEYWORDS);
  if (lang === "sql" || lang === "prisma") return new Set(SQL_KEYWORDS);
  return new Set(JS_KEYWORDS);
}

function normalizeLang(language: string): string {
  const lang = language.toLowerCase();
  if (lang === "tsx" || lang === "jsx" || lang === "js" || lang === "javascript" || lang === "typescript" || lang === "mjs" || lang === "cjs") {
    return "ts";
  }
  return lang;
}

function span(className: string, value: string): string {
  return `<span class="${className}">${escapeHtml(value)}</span>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
