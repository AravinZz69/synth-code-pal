
## Overview

Build "Talk to Code" — an AI-powered app that connects a GitHub repo, auto-analyzes it, and lets the user chat/search/generate/debug/document against the codebase. Since Lovable only runs TanStack Start, I'll build it on TanStack Start (React 19 + Vite) with Lovable Cloud (Postgres + pgvector + auth) and Lovable AI Gateway (Gemini + GPT). Same product, same feature set.

## User flow

1. Land on `/` → "Sign in with GitHub".
2. GitHub OAuth via Lovable Cloud auth → land on `/repos`.
3. Pick a repo → server ingests it (tree + files via GitHub REST), chunks code, embeds, stores in pgvector. Progress shown live.
4. On completion → redirect to `/r/$owner/$repo` workspace with tabs:
   - **Overview** — auto-generated Mermaid architecture diagram + tech stack detected
   - **Files** — interactive file tree + file viewer with syntax highlight
   - **Chat** — streaming RAG chat over the codebase (with cited file:line snippets)
   - **Actions** — one-click: Generate code / Debug error / Generate docs / Deployment guide

## Modules

**Auth (GitHub OAuth)**
- Enable Lovable Cloud, configure GitHub provider with `repo` scope.
- Store the user's GitHub access token in a `github_tokens` table on first sign-in via a server function that reads the provider token.
- Routes: `/auth` (public sign-in), `_authenticated/*` gated by managed layout.

**Repository management**
- `/repos` (protected): server fn calls `GET /user/repos` with the user's GitHub token, lists repos, "Ingest" button.
- `repositories` table: id, user_id, owner, name, default_branch, status (`pending|processing|ready|error`), tech_stack jsonb, mermaid text, file_tree jsonb.
- `code_chunks` table: id, repository_id, path, start_line, end_line, kind (`function|class|block|file`), content, embedding vector(3072).

**Ingestion engine** (server fn, sync for demo)
- Fetch repo tree via GitHub REST (`/repos/{o}/{r}/git/trees/{sha}?recursive=1`), cap at ~300 code files, skip binaries/node_modules/dist/lock.
- Fetch each file's raw content.
- Detect tech stack from package.json / requirements.txt / go.mod / Cargo.toml / etc.
- Chunk: simple language-aware splitter (functions/classes by regex for JS/TS/PY; sliding 60-line windows otherwise), max ~1500 chars per chunk with overlap.
- Embed chunks in batches of ≤100 via Lovable AI Gateway `google/gemini-embedding-2` (3072 dims).
- Build Mermaid `graph TD` from top-level folder relationships + detected entry points; generate a polished version by asking `openai/gpt-5.5` to refine given the file tree + stack.
- Persist file_tree jsonb for the file explorer.

**Architecture generation**
- Rendered client-side with `mermaid` npm package inside `<ClientOnly>`.
- Regenerate button re-runs the LLM step only (no re-embed).

**File structure visualization**
- Left pane: collapsible tree from `file_tree` jsonb.
- Right pane: file viewer; on click, server fn fetches file content from GitHub (or cache) and returns it; render with `shiki` or `react-syntax-highlighter`.

**Semantic search + Chat (RAG)**
- `/api/chat` server route (streaming): embed user query → pgvector cosine top-k=8 → build context with `path:start-end` headers → stream from `openai/gpt-5.5` via AI SDK + Lovable AI Gateway helper.
- Client uses `useChat` with `DefaultChatTransport`; message parts render text + a "Sources" block with citations that link to the file viewer.

**Code / Debug / Docs / Deploy actions**
- Same RAG pipeline, different system prompts:
  - Generate code: user describes feature → returns diff-style code block scoped to relevant files.
  - Debug: user pastes error/stack → returns likely cause + fix with file citations.
  - Docs: generates a README-style doc from top chunks + tech stack; downloadable as `.md`.
  - Deploy: infers stack, outputs step-by-step deployment guide (Vercel/Netlify/Fly/Docker) based on detected tech.

## Data model (single migration)

```sql
create extension if not exists vector;

create table public.repositories (...);
grant select, insert, update, delete on public.repositories to authenticated;
alter table public.repositories enable row level security;
create policy "own repos" on public.repositories
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.code_chunks (
  id uuid primary key default gen_random_uuid(),
  repository_id uuid not null references public.repositories(id) on delete cascade,
  path text not null,
  start_line int, end_line int,
  kind text,
  content text not null,
  embedding vector(3072) not null,
  created_at timestamptz default now()
);
grant select, insert, delete on public.code_chunks to authenticated;
alter table public.code_chunks enable row level security;
create policy "own chunks" on public.code_chunks for all to authenticated
  using (exists (select 1 from public.repositories r where r.id = repository_id and r.user_id = auth.uid()))
  with check (exists (select 1 from public.repositories r where r.id = repository_id and r.user_id = auth.uid()));

create index code_chunks_embedding_idx on public.code_chunks
  using hnsw ((embedding::halfvec(3072)) halfvec_cosine_ops);

create table public.github_tokens (user_id uuid primary key references auth.users on delete cascade, access_token text not null, updated_at timestamptz default now());
grant select, insert, update on public.github_tokens to authenticated;
alter table public.github_tokens enable row level security;
create policy "own token" on public.github_tokens for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

Plus `match_chunks(repository_id, query_embedding, k)` SQL function using halfvec cast.

## Technical details

- **Stack**: TanStack Start (React 19 + Vite), Tailwind CSS v4, shadcn/ui, TanStack Query, Lovable Cloud (Supabase + pgvector), Lovable AI Gateway via `@ai-sdk/openai-compatible` + `ai` SDK. Mermaid rendered client-only.
- **Server surfaces**:
  - `createServerFn` (authenticated): `listGithubRepos`, `ingestRepository`, `getRepository`, `getFileContent`, `regenerateArchitecture`, `runAction` (code/debug/docs/deploy).
  - Server route `/api/chat` (streaming, auth-checked) for the chat UI with `useChat`.
- **GitHub API**: called directly with the user's stored access token (no connector needed — we already get the token via OAuth). Fallback: if the user hits rate limits, show a clear error.
- **AI models**: embeddings `google/gemini-embedding-2` (3072 dims, halfvec index). Chat/generation `openai/gpt-5.5` (fast, quality). Architecture refinement uses structured output.
- **Ingestion in the demo**: run synchronously inside `ingestRepository` with progress persisted to `repositories.status_message`; UI polls every 1.5s via TanStack Query. Cap total files to keep under Worker limits; skip files > 200KB or binary.
- **Design**: dark, developer-tool aesthetic (terminal-ish accent), Space Grotesk + JetBrains Mono, semantic tokens in `src/styles.css`. Real title/description in `__root.tsx` head().

## What's out of scope (hackathon)

- Background workers, queues, Redis, Kubernetes — everything runs in server functions.
- Incremental re-indexing on repo push (webhook) — user can hit "Re-ingest".
- Multi-branch support — default branch only.
- Multi-tenant billing.

## Build order

1. Enable Lovable Cloud + configure GitHub OAuth + provision `LOVABLE_API_KEY`.
2. Migration (tables + pgvector + `match_chunks`).
3. Auth pages (`/auth`, sign-in with GitHub) and managed `_authenticated` layout.
4. `/repos` page + `listGithubRepos` server fn + repo capture of provider token.
5. `ingestRepository` server fn (tree fetch → chunk → embed → persist → mermaid).
6. Workspace route `_authenticated/r/$owner/$repo` with tabs (Overview / Files / Chat / Actions).
7. `/api/chat` streaming route + `useChat` UI with citations.
8. Actions (code/debug/docs/deploy) reusing the RAG pipeline.
9. Landing page polish + Mermaid diagram styling.

I'll implement it end-to-end in one pass and stop at any point where a design/scope decision is needed.
