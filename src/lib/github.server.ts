// GitHub REST helpers used from server functions only.

const GH = "https://api.github.com";

function headers(token?: string): HeadersInit {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "talk-to-code",
  };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

export async function ghFetch<T>(path: string, token?: string): Promise<T> {
  const res = await fetch(`${GH}${path}`, { headers: headers(token) });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub ${res.status} ${path}: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

export async function fetchRawFile(owner: string, repo: string, sha: string, path: string, token?: string): Promise<string | null> {
  const url = `${GH}/repos/${owner}/${repo}/contents/${encodeURIComponent(path).replace(/%2F/g, "/")}?ref=${sha}`;
  const res = await fetch(url, { headers: { ...headers(token), Accept: "application/vnd.github.raw" } });
  if (!res.ok) return null;
  return await res.text();
}

export interface GhRepoInfo {
  full_name: string;
  default_branch: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  private: boolean;
}

export interface GhTreeEntry {
  path: string;
  type: "blob" | "tree";
  size?: number;
  sha: string;
}

export interface GhTreeResponse {
  sha: string;
  tree: GhTreeEntry[];
  truncated: boolean;
}

export async function getRepo(owner: string, repo: string, token?: string) {
  return ghFetch<GhRepoInfo>(`/repos/${owner}/${repo}`, token);
}

export async function getBranchSha(owner: string, repo: string, branch: string, token?: string) {
  const b = await ghFetch<{ commit: { sha: string } }>(`/repos/${owner}/${repo}/branches/${branch}`, token);
  return b.commit.sha;
}

export async function getTree(owner: string, repo: string, sha: string, token?: string) {
  return ghFetch<GhTreeResponse>(`/repos/${owner}/${repo}/git/trees/${sha}?recursive=1`, token);
}

const SKIP_DIRS = [
  "node_modules/", ".git/", "dist/", "build/", ".next/", ".turbo/", "out/",
  "coverage/", ".cache/", "vendor/", "target/", ".venv/", "__pycache__/",
  "public/", "assets/", "images/", "img/",
];
const CODE_EXT = new Set([
  "ts", "tsx", "js", "jsx", "mjs", "cjs",
  "py", "rb", "go", "rs", "java", "kt", "swift",
  "c", "cc", "cpp", "h", "hpp", "cs", "php",
  "vue", "svelte", "astro",
  "sql", "sh", "bash", "toml", "yml", "yaml",
  "css", "scss", "html", "json", "md",
]);

export function isCodeFile(path: string, size?: number): boolean {
  if (size !== undefined && size > 200_000) return false;
  const lower = path.toLowerCase();
  for (const d of SKIP_DIRS) if (lower.includes(`/${d}`) || lower.startsWith(d)) return false;
  if (lower.endsWith(".lock") || lower.endsWith(".min.js") || lower.endsWith(".map")) return false;
  const ext = lower.split(".").pop() ?? "";
  return CODE_EXT.has(ext);
}

export interface FileTreeNode {
  name: string;
  path: string;
  type: "file" | "dir";
  children?: FileTreeNode[];
}

export function buildFileTree(entries: GhTreeEntry[]): FileTreeNode[] {
  const root: FileTreeNode[] = [];
  const findOrCreate = (list: FileTreeNode[], name: string, path: string, type: "file" | "dir"): FileTreeNode => {
    let node = list.find((n) => n.name === name && n.type === type);
    if (!node) {
      node = { name, path, type, children: type === "dir" ? [] : undefined };
      list.push(node);
    }
    return node;
  };
  for (const e of entries) {
    const parts = e.path.split("/");
    let current = root;
    for (let i = 0; i < parts.length; i++) {
      const isLast = i === parts.length - 1;
      const partPath = parts.slice(0, i + 1).join("/");
      const type: "file" | "dir" = isLast && e.type === "blob" ? "file" : "dir";
      const node = findOrCreate(current, parts[i], partPath, type);
      if (node.type === "dir") current = node.children!;
    }
  }
  const sortTree = (nodes: FileTreeNode[]) => {
    nodes.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "dir" ? -1 : 1));
    for (const n of nodes) if (n.children) sortTree(n.children);
  };
  sortTree(root);
  return root;
}

// Simple line-window chunker. Language-agnostic; good enough for the demo.
export interface Chunk {
  path: string;
  content: string;
  start_line: number;
  end_line: number;
  kind: string;
}
export function chunkFile(path: string, content: string): Chunk[] {
  const lines = content.split("\n");
  if (lines.length <= 60) {
    return [{ path, content, start_line: 1, end_line: lines.length, kind: "file" }];
  }
  const size = 80;
  const overlap = 15;
  const chunks: Chunk[] = [];
  for (let i = 0; i < lines.length; i += size - overlap) {
    const slice = lines.slice(i, i + size);
    if (slice.length < 5) break;
    chunks.push({
      path,
      content: slice.join("\n"),
      start_line: i + 1,
      end_line: Math.min(i + size, lines.length),
      kind: "block",
    });
    if (i + size >= lines.length) break;
  }
  return chunks;
}

export interface TechStack {
  languages: string[];
  frameworks: string[];
  package_managers: string[];
  build_tools: string[];
}

export function detectTechStack(files: Set<string>, contents: Record<string, string>): TechStack {
  const has = (p: string) => files.has(p) || [...files].some((f) => f.endsWith("/" + p));
  const languages = new Set<string>();
  const frameworks = new Set<string>();
  const pkg = new Set<string>();
  const build = new Set<string>();

  if (has("package.json")) {
    pkg.add("npm/bun");
    try {
      const rawKey = [...files].find((f) => f === "package.json" || f.endsWith("/package.json"));
      if (rawKey && contents[rawKey]) {
        const json = JSON.parse(contents[rawKey]);
        const deps = { ...(json.dependencies ?? {}), ...(json.devDependencies ?? {}) };
        if (deps.react) frameworks.add("React");
        if (deps.next) frameworks.add("Next.js");
        if (deps["@tanstack/react-router"]) frameworks.add("TanStack Router");
        if (deps["@tanstack/react-start"]) frameworks.add("TanStack Start");
        if (deps.vue) frameworks.add("Vue");
        if (deps.svelte) frameworks.add("Svelte");
        if (deps.express) frameworks.add("Express");
        if (deps.fastify) frameworks.add("Fastify");
        if (deps.tailwindcss) frameworks.add("Tailwind CSS");
        if (deps.vite) build.add("Vite");
        if (deps.webpack) build.add("Webpack");
      }
    } catch {}
    languages.add("JavaScript/TypeScript");
  }
  if (has("requirements.txt") || has("pyproject.toml") || has("Pipfile")) {
    languages.add("Python");
    pkg.add("pip/uv");
  }
  if (has("go.mod")) { languages.add("Go"); pkg.add("go modules"); }
  if (has("Cargo.toml")) { languages.add("Rust"); pkg.add("cargo"); }
  if (has("Gemfile")) { languages.add("Ruby"); pkg.add("bundler"); }
  if (has("pom.xml") || has("build.gradle")) { languages.add("Java"); pkg.add(has("pom.xml") ? "maven" : "gradle"); }
  if (has("Dockerfile")) build.add("Docker");

  return {
    languages: [...languages],
    frameworks: [...frameworks],
    package_managers: [...pkg],
    build_tools: [...build],
  };
}

export function parseRepoUrl(input: string): { owner: string; repo: string } | null {
  const t = input.trim().replace(/\.git$/, "").replace(/\/$/, "");
  const m = t.match(/^(?:https?:\/\/github\.com\/)?([\w.-]+)\/([\w.-]+)$/i);
  if (!m) return null;
  return { owner: m[1], repo: m[2] };
}