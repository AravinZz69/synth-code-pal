# CodeSpace — Project Explanation Script

A 3–5 minute walkthrough script for demos, pitch decks, or onboarding videos.

---

## 1. Hook — What is CodeSpace?

> *"CodeSpace is an AI-powered codebase intelligence platform. Connect any GitHub repository, and within seconds it builds a searchable, interactive knowledge base that helps you understand, search, debug, and document your code using natural language."*

Think of it as ChatGPT that actually knows *your* repository — every function, file, dependency, and architectural decision.

---

## 2. The Problem

> *"Development teams waste hours reading unfamiliar code. Onboarding engineers spend days tracing dependencies. Debugging a legacy repo means grepping through thousands of files. And writing documentation is almost always out of date the moment it's saved."*

CodeSpace turns that friction into a conversation.

---

## 3. How It Works — The Big Picture

> *"The experience is simple. You log in with GitHub, pick a repository, and CodeSpace does the heavy lifting automatically."*

There are three core steps:

1. **Connect** — GitHub OAuth grants secure, scoped access.
2. **Ingest** — The platform fetches the repo tree, reads files, detects the tech stack, and splits the code into meaningful chunks.
3. **Interact** — Everything becomes queryable: architecture diagrams, semantic search, AI chat, code generation, debugging help, docs, and deployment guidance.

---

## 4. Auto-Generated Intelligence

> *"The moment ingestion finishes, CodeSpace creates four things automatically — no prompts required."*

- **Layered Architecture Diagram** — A color-coded, interactive visualization organized into Presentation, Application, Domain, Data Access, and Infrastructure layers.
- **Workflow Diagram** — A step-by-step Mermaid flowchart showing how data moves through the system.
- **Project Description** — A concise summary of what the project does.
- **Tech Stack Detection** — Frameworks, languages, databases, and external services pulled from config files like `package.json`, `requirements.txt`, `go.mod`, and `Cargo.toml`.

---

## 5. The RAG Pipeline

> *"At the heart of CodeSpace is a Retrieval-Augmented Generation pipeline."*

Here's what happens when you ask a question:

1. Your query is converted into a vector embedding using `google/gemini-embedding-2`.
2. A vector search runs against the stored code chunks in PostgreSQL + pgvector, finding the most semantically relevant snippets.
3. Those snippets are injected into the prompt sent to `openai/gpt-5.5`.
4. The model answers with citations that link directly back to file names and line ranges.

> *"This means the AI is not guessing — it is reasoning over the actual code in your repository."*

---

## 6. AI Assistants — Five Built-In Modes

> *"CodeSpace ships with five specialized assistants, all grounded in your repo."*

- **Chat** — Ask anything: "How does authentication work?" or "Where is the billing logic?"
- **Generate Code** — Describe a feature and get code that follows the repo's existing conventions.
- **Debug** — Paste an error or stack trace and get likely causes and fixes with citations.
- **Documentation** — Auto-generate a professional README covering overview, tech stack, structure, architecture, API, setup, and deployment.
- **Deploy** — Get step-by-step deployment instructions tailored to the detected stack.

---

## 7. Agent Integrations via MCP

> *"CodeSpace also exposes an MCP server, so external AI assistants like Claude, ChatGPT, and Cursor can talk to your repository through CodeSpace."*

Available tools include:

- `list_repositories` — See connected repos.
- `search_code` — Run semantic code search.
- `get_file` — Fetch raw file contents.
- `get_architecture` — Read generated architecture, workflow, and project descriptions.

Authentication is handled through Supabase OAuth 2.1, so every MCP client acts as the user it signed in as — with full RLS protection.

---

## 8. Tech Stack

> *"CodeSpace is built entirely on modern, open, and edge-friendly technologies."*

| Layer | Technology |
|-------|------------|
| Frontend | TanStack Start (React 19 + Vite) |
| Styling | Tailwind CSS v4, shadcn/ui, Inter typography |
| Backend | TanStack server functions on Cloudflare Workers |
| Auth | GitHub OAuth 2.0 via Lovable Cloud |
| Database | PostgreSQL + pgvector (vector storage) |
| AI Gateway | Lovable AI Gateway — Gemini embeddings + GPT generation |
| Diagrams | Mermaid, rendered client-side |
| Docs/PDF | ReactMarkdown + html2pdf.js |
| MCP | `@lovable.dev/mcp-js` |

---

## 9. Security & Privacy

> *"Security is built in, not bolted on."*

- GitHub tokens are stored per-user and never exposed to the client.
- Every database query respects Row-Level Security — users can only see their own repositories and tokens.
- MCP access is protected by OAuth 2.1, so agents cannot impersonate users.
- No `anon` reads or service-role bypasses in the MCP layer.

---

## 10. Closing — Who Is It For?

> *"CodeSpace is for engineering teams who want to move faster in complex codebases."*

Use it for:
- Onboarding new developers
- Refactoring legacy projects
- Debugging production issues
- Generating accurate, always-fresh documentation
- Building context-aware AI assistants and agents

> *"Instead of reading code, you talk to it."*

---

## Optional: 30-Second Elevator Pitch

> *"CodeSpace connects to any GitHub repo and turns it into an intelligent knowledge base. It auto-generates architecture diagrams, workflows, and documentation, then lets you chat, search, generate code, debug, and deploy using AI that actually understands your codebase."*
