import { githubApiHeaders } from "@/lib/github/app";

const API = "https://api.github.com";
const MAX_TREE_PATHS = 2_000;
const MAX_FILES = 80;
const MAX_FILE_CHARS = 60_000;
const MAX_TOTAL_CHARS = 240_000;
const MAX_COMPARE_FILES = 120;
const MAX_PATCH_CHARS = 12_000;
const FETCH_CONCURRENCY = 4;

const SKIPPED_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".ico", ".pdf",
  ".zip", ".gz", ".tar", ".tgz", ".7z", ".rar", ".exe", ".dll", ".so",
  ".dylib", ".woff", ".woff2", ".ttf", ".otf", ".mp3", ".mp4", ".mov",
  ".webm", ".wasm", ".map", ".min.js", ".min.css",
]);

const SKIPPED_PARTS = new Set([
  "node_modules", ".git", ".next", "dist", "build", "out", "coverage",
  "vendor", "third_party", "third-party", "generated", "__snapshots__",
  "fixtures", "fixture", "testdata", "test-data",
]);

const SKIPPED_FILES = new Set([
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lockb",
  "cargo.lock",
  "poetry.lock",
  "composer.lock",
]);

const MANIFEST_FILES = new Set([
  "package.json",
  "pyproject.toml",
  "requirements.txt",
  "cargo.toml",
  "go.mod",
  "composer.json",
  "gemfile",
  "pom.xml",
  "build.gradle",
  "dockerfile",
  "makefile",
  "tsconfig.json",
  "next.config.js",
  "next.config.ts",
  "vite.config.ts",
  "astro.config.mjs",
]);

export type RepoFile = {
  path: string;
  content: string;
  truncated: boolean;
};

export type RepoSnapshot = {
  sha: string;
  branch: string;
  treePaths: string[];
  files: RepoFile[];
  omittedFiles: number;
  treeTruncated: boolean;
};

export type RepoChange = {
  before: string;
  after: string;
  changedPaths: string[];
  removedPaths: string[];
  files: RepoFile[];
  patches: Array<{ path: string; patch: string }>;
  fallback: RepoSnapshot | null;
};

type TreeEntry = { path?: unknown; type?: unknown; sha?: unknown; size?: unknown };

export function isRelevantPath(path: string): boolean {
  const lower = path.toLowerCase();
  const parts = lower.split("/");
  if (parts.some((part) => SKIPPED_PARTS.has(part))) return false;
  const name = parts[parts.length - 1] ?? "";
  if (SKIPPED_FILES.has(name)) return false;
  if ([...SKIPPED_EXTENSIONS].some((extension) => lower.endsWith(extension))) {
    return false;
  }
  if (name.startsWith(".env") && !name.endsWith(".example")) return false;
  return true;
}

function contentPriority(path: string): number {
  const lower = path.toLowerCase();
  const name = lower.split("/").pop() ?? "";
  if (/^readme(\.[a-z0-9]+)?$/.test(name)) return 0;
  if (lower.startsWith("docs/")) return 1;
  if (name.endsWith(".md") || name.endsWith(".mdx")) return 2;
  if (MANIFEST_FILES.has(name)) return 3;
  if (lower.includes("/examples/") || lower.startsWith("examples/")) return 4;
  if (/^(src|app|lib|packages|cmd|internal)\//.test(lower)) return 5;
  if (name.endsWith(".ts") || name.endsWith(".tsx") || name.endsWith(".js") || name.endsWith(".jsx")) {
    return 6;
  }
  return 9;
}

export function selectContentCandidates(paths: string[]): string[] {
  return paths
    .filter(isRelevantPath)
    .map((path) => ({ path, priority: contentPriority(path) }))
    .sort((a, b) => a.priority - b.priority || a.path.localeCompare(b.path))
    .slice(0, MAX_FILES)
    .map((item) => item.path);
}

export async function readRepoSnapshot(args: {
  owner: string;
  name: string;
  branch: string;
  token: string;
  fetcher?: typeof fetch;
  ref?: string;
}): Promise<RepoSnapshot> {
  const fetcher = args.fetcher ?? fetch;
  const sha = args.ref?.trim() || (await readBranchSha(args.owner, args.name, args.branch, args.token, fetcher));
  const treeResponse = await fetcher(
    `${API}/repos/${encodeURIComponent(args.owner)}/${encodeURIComponent(args.name)}/git/trees/${encodeURIComponent(sha)}?recursive=1`,
    { headers: githubApiHeaders(args.token), signal: AbortSignal.timeout(20_000) },
  );
  if (!treeResponse.ok) {
    throw new Error(`GitHub tree request failed (${treeResponse.status}).`);
  }
  const treeBody = (await treeResponse.json()) as {
    truncated?: unknown;
    tree?: unknown;
  };
  const entries = Array.isArray(treeBody.tree) ? (treeBody.tree as TreeEntry[]) : [];
  const blobs = entries.filter(
    (entry) =>
      entry.type === "blob" &&
      typeof entry.path === "string" &&
      typeof entry.sha === "string" &&
      relevantBlob(entry.path),
  );
  const allPaths = entries
    .filter(
      (entry) =>
        typeof entry.path === "string" && isRelevantPath(entry.path),
    )
    .map((entry) => entry.path as string)
    .slice(0, MAX_TREE_PATHS);
  const candidates = selectContentCandidates(blobs.map((entry) => entry.path as string));
  const byPath = new Map(
    blobs
      .filter((entry): entry is TreeEntry & { path: string; sha: string } =>
        typeof entry.path === "string" && typeof entry.sha === "string",
      )
      .map((entry) => [entry.path, entry.sha]),
  );
  const files = await readBlobs({
    owner: args.owner,
    name: args.name,
    token: args.token,
    fetcher,
    candidates,
    byPath,
  });
  return {
    sha,
    branch: args.branch,
    treePaths: allPaths,
    files,
    omittedFiles: Math.max(0, blobs.length - files.length),
    treeTruncated: treeBody.truncated === true,
  };
}

function relevantBlob(path: string): boolean {
  if (!isRelevantPath(path)) return false;
  return !/\.(png|jpe?g|gif|webp|ico|pdf|zip|gz|woff2?|ttf|otf|mp[34]|mov|wasm)$/i.test(path);
}

async function readBranchSha(
  owner: string,
  name: string,
  branch: string,
  token: string,
  fetcher: typeof fetch,
): Promise<string> {
  const ref = branch.split("/").map(encodeURIComponent).join("/");
  const response = await fetcher(
    `${API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/git/ref/heads/${ref}`,
    { headers: githubApiHeaders(token), signal: AbortSignal.timeout(20_000) },
  );
  if (!response.ok) {
    throw new Error(`GitHub branch lookup failed (${response.status}).`);
  }
  const body = (await response.json()) as { object?: { sha?: unknown } };
  if (typeof body.object?.sha !== "string" || !body.object.sha) {
    throw new Error("GitHub did not return a branch commit.");
  }
  return body.object.sha;
}

async function readBlobs(args: {
  owner: string;
  name: string;
  token: string;
  fetcher: typeof fetch;
  candidates: string[];
  byPath: Map<string, string>;
}): Promise<RepoFile[]> {
  const files: RepoFile[] = [];
  let total = 0;
  for (let offset = 0; offset < args.candidates.length; offset += FETCH_CONCURRENCY) {
    const batch = args.candidates.slice(offset, offset + FETCH_CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (path) => {
        const sha = args.byPath.get(path);
        if (!sha) return null;
        const response = await args.fetcher(
          `${API}/repos/${encodeURIComponent(args.owner)}/${encodeURIComponent(args.name)}/git/blobs/${encodeURIComponent(sha)}`,
          { headers: githubApiHeaders(args.token), signal: AbortSignal.timeout(20_000) },
        );
        if (!response.ok) return null;
        const body = (await response.json()) as { content?: unknown; encoding?: unknown };
        if (typeof body.content !== "string") return null;
        const raw =
          body.encoding === "base64"
            ? Buffer.from(body.content, "base64").toString("utf8")
            : body.content;
        if (raw.includes("\u0000")) return null;
        const truncated = raw.length > MAX_FILE_CHARS;
        return {
          path,
          content: truncated ? raw.slice(0, MAX_FILE_CHARS) : raw,
          truncated,
        } satisfies RepoFile;
      }),
    );
    for (const file of results) {
      if (!file) continue;
      if (total + file.content.length > MAX_TOTAL_CHARS) continue;
      total += file.content.length;
      files.push(file);
    }
    if (total >= MAX_TOTAL_CHARS) break;
  }
  return files;
}

export async function readRepoChange(args: {
  owner: string;
  name: string;
  branch: string;
  before: string;
  after: string;
  token: string;
  fetcher?: typeof fetch;
}): Promise<RepoChange> {
  const fetcher = args.fetcher ?? fetch;
  if (!/^[0-9a-f]{7,40}$/i.test(args.before) || !/^[0-9a-f]{7,40}$/i.test(args.after)) {
    const fallback = await readRepoSnapshot({ ...args, fetcher, ref: args.after });
    return emptyChange(args.before, args.after, fallback);
  }
  const response = await fetcher(
    `${API}/repos/${encodeURIComponent(args.owner)}/${encodeURIComponent(args.name)}/compare/${encodeURIComponent(args.before)}...${encodeURIComponent(args.after)}`,
    { headers: githubApiHeaders(args.token), signal: AbortSignal.timeout(20_000) },
  );
  if (!response.ok) {
    const fallback = await readRepoSnapshot({ ...args, fetcher, ref: args.after });
    return emptyChange(args.before, args.after, fallback);
  }
  const body = (await response.json()) as { files?: unknown };
  const rows = Array.isArray(body.files)
    ? (body.files as Array<Record<string, unknown>>).slice(0, MAX_COMPARE_FILES)
    : [];
  const changedPaths: string[] = [];
  const removedPaths: string[] = [];
  const patches: Array<{ path: string; patch: string }> = [];
  for (const row of rows) {
    const path = typeof row.filename === "string" ? row.filename : "";
    if (!path || !isRelevantPath(path)) continue;
    changedPaths.push(path);
    if (row.status === "removed") {
      removedPaths.push(path);
      continue;
    }
    if (typeof row.patch === "string" && row.patch) {
      patches.push({
        path,
        patch:
          row.patch.length > MAX_PATCH_CHARS
            ? `${row.patch.slice(0, MAX_PATCH_CHARS)}\n[truncated]`
            : row.patch,
      });
    }
  }
  return {
    before: args.before,
    after: args.after,
    changedPaths,
    removedPaths,
    files: [],
    patches,
    fallback: null,
  };
}

function emptyChange(before: string, after: string, fallback: RepoSnapshot): RepoChange {
  return {
    before,
    after,
    changedPaths: fallback.treePaths,
    removedPaths: [],
    files: fallback.files,
    patches: [],
    fallback,
  };
}
