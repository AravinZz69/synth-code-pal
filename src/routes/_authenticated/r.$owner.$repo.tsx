import { createFileRoute, Link, ClientOnly } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getRepositoryByPath, getFileContent } from "@/lib/repos.functions";
import { regenerateArchitecture } from "@/lib/ingest.functions";
import { runAction } from "@/lib/actions.functions";
import { MermaidDiagram } from "@/components/mermaid-diagram";
import { FileTree, type FileNode } from "@/components/file-tree";
import { WorkflowDiagram, type WorkflowStep } from "@/components/workflow-diagram";
import { DocsView } from "@/components/docs-view";
import { toast } from "sonner";
import {
  Loader2, RefreshCw, MessageSquare, Wrench, FileText, Rocket, Sparkles, Send,
  ChevronLeft, LayoutDashboard, Home,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/r/$owner/$repo")({
  component: WorkspacePage,
  head: ({ params }) => ({
    meta: [{ title: `${params.owner}/${params.repo} — Talk to Code` }],
  }),
});

type CenterTab = "overview" | "chat" | "code" | "debug" | "docs" | "deploy";

function WorkspacePage() {
  const { owner, repo } = Route.useParams();
  const fnGet = useServerFn(getRepositoryByPath);
  const repository = useQuery({
    queryKey: ["repo", owner, repo],
    queryFn: () => fnGet({ data: { owner, name: repo } }),
    refetchInterval: (q) => {
      const s = (q.state.data as { status?: string } | undefined)?.status;
      return s && s !== "ready" && s !== "error" ? 1800 : false;
    },
  });

  const [tab, setTab] = useState<CenterTab>("overview");
  const r = repository.data;

  if (repository.isLoading) return <Centered><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></Centered>;
  if (!r) return <Centered>Repository not found. <Link to="/repos" className="text-foreground underline ml-1">Back</Link></Centered>;

  const notReady = r.status !== "ready";

  const fileTree = (r.file_tree ?? []) as unknown as FileNode[];

  const tabs: { id: CenterTab; label: string; icon: typeof Sparkles; color: string }[] = [
    { id: "overview", label: "Overview", icon: LayoutDashboard, color: "#6366f1" },
    { id: "chat", label: "Chat", icon: MessageSquare, color: "#0ea5e9" },
    { id: "code", label: "Code", icon: Sparkles, color: "#a855f7" },
    { id: "debug", label: "Debug", icon: Wrench, color: "#f59e0b" },
    { id: "docs", label: "Docs", icon: FileText, color: "#10b981" },
    { id: "deploy", label: "Deploy", icon: Rocket, color: "#ec4899" },
  ];

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col">
      {/* Repo header */}
      <div className="border-b border-border bg-background px-6 h-11 flex items-center gap-3 shrink-0">
        <Link to="/" className="text-muted-foreground hover:text-foreground" title="Home">
          <Home className="h-4 w-4" />
        </Link>
        <Link to="/repos" className="text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">{r.owner}</span>
          <span className="text-muted-foreground">/</span>
          <span className="font-medium">{r.name}</span>
          <span className="ml-2 text-xs text-muted-foreground font-mono">{r.default_branch}</span>
        </div>
        {notReady && (
          <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> {r.status_message ?? r.status}
          </span>
        )}
      </div>

      {/* Three-panel workspace */}
      <div className="flex-1 grid grid-cols-[260px_1fr_320px] min-h-0">
        {/* Left: file tree */}
        <aside className="border-r border-border bg-sidebar overflow-hidden flex flex-col">
          <div className="px-4 h-9 flex items-center text-xs font-medium uppercase tracking-wide text-muted-foreground border-b border-border">
            Files
          </div>
          <div className="flex-1 overflow-auto p-2">
            {fileTree.length > 0 ? (
              <FilesPanel repositoryId={r.id} fileTree={fileTree} />
            ) : (
              <div className="p-3 text-xs text-muted-foreground">Waiting for ingestion…</div>
            )}
          </div>
        </aside>

        {/* Center: chat / actions */}
        <section className="flex flex-col min-w-0 bg-background">
          <nav className="border-b border-border h-9 px-3 flex items-center gap-0.5">
            {tabs.map(({ id, label, icon: Icon, color }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                disabled={notReady}
                className={`flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-medium transition-colors ${
                  tab === id ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                <Icon className="h-3.5 w-3.5" style={{ color }} /> {label}
              </button>
            ))}
          </nav>
          <div className="flex-1 min-h-0 overflow-hidden">
            {tab === "overview" && <OverviewPanel repo={r} />}
            {tab === "chat" && <ChatPanel repositoryId={r.id} />}
            {tab === "docs" && <DocsView repositoryId={r.id} repoLabel={`${r.owner}/${r.name}`} />}
            {(tab === "code" || tab === "debug" || tab === "deploy") && <ActionPanel repositoryId={r.id} action={tab} />}
          </div>
        </section>

        {/* Right: architecture & summary */}
        <aside className="border-l border-border bg-sidebar overflow-auto">
          <RightPanel repo={r} />
        </aside>
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="min-h-[50vh] flex items-center justify-center text-sm text-muted-foreground">{children}</div>;
}

function OverviewPanel({ repo }: { repo: { id: string; owner: string; name: string; description: string | null; workflow: string | null; mermaid: string | null; status: string; status_message: string | null; tech_stack: unknown } }) {
  const stack = (repo.tech_stack ?? {}) as {
    languages?: string[]; frameworks?: string[]; package_managers?: string[]; build_tools?: string[];
  };
  const workflowSteps = (repo.workflow ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const COLORS: WorkflowStep["color"][] = ["blue", "indigo", "violet", "cyan", "amber", "pink", "emerald", "slate"];
  const wfDiagram: WorkflowStep[] = workflowSteps.map((raw, i) => {
    const cleaned = raw.replace(/^\d+[.)]\s*/, "");
    const [head, ...rest] = cleaned.split(/[:—-]\s+/);
    return {
      title: (head ?? cleaned).slice(0, 90),
      detail: rest.length ? rest.join(" — ") : cleaned,
      color: COLORS[i % COLORS.length],
    };
  });

  if (repo.status !== "ready") {
    return (
      <div className="h-full flex flex-col items-center justify-center px-6 text-center gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <div className="text-sm text-muted-foreground">
          {repo.status_message ?? "Analyzing repository…"}
        </div>
        <div className="text-xs text-muted-foreground max-w-md">
          Cloning file tree, chunking code, generating embeddings, and writing the project overview. This usually takes 30–90 seconds.
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
        <section>
          <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-2">Description</div>
          <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
            {repo.description || "No description generated."}
          </p>
        </section>

        <section>
          <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-2">Workflow</div>
          {wfDiagram.length > 0 ? (
            <WorkflowDiagram steps={wfDiagram} />
          ) : (
            <p className="text-sm text-muted-foreground">No workflow generated.</p>
          )}
        </section>

        <section>
          <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-2">Architecture</div>
          <div className="rounded-md border border-border bg-card p-4">
            {repo.mermaid ? (
              <ClientOnly fallback={<div className="text-xs text-muted-foreground">Rendering diagram…</div>}>
                <MermaidDiagram code={repo.mermaid} />
              </ClientOnly>
            ) : (
              <div className="text-xs text-muted-foreground">No diagram available.</div>
            )}
          </div>
        </section>

        {(stack.languages?.length || stack.frameworks?.length) && (
          <section>
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-2">Tech stack</div>
            <div className="flex flex-wrap gap-1.5">
              {[...(stack.languages ?? []), ...(stack.frameworks ?? []), ...(stack.build_tools ?? []), ...(stack.package_managers ?? [])].map((t) => (
                <span key={t} className="rounded border border-border bg-background px-2 py-0.5 text-[11px] font-mono">{t}</span>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function RightPanel({ repo }: { repo: { id: string; mermaid: string | null; tech_stack: unknown; status: string } }) {
  const qc = useQueryClient();
  const fnRegen = useServerFn(regenerateArchitecture);
  const regen = useMutation({
    mutationFn: () => fnRegen({ data: { repositoryId: repo.id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["repo"] }),
  });
  const stack = (repo.tech_stack ?? {}) as {
    languages?: string[]; frameworks?: string[]; package_managers?: string[]; build_tools?: string[];
  };
  return (
    <div className="p-4 space-y-4">
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Architecture</h3>
          <button
            onClick={() => regen.mutate()}
            disabled={regen.isPending || repo.status !== "ready"}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
            title="Regenerate"
          >
            {regen.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          </button>
        </div>
        <div className="rounded-md border border-border bg-card p-3">
          {repo.mermaid ? (
            <ClientOnly fallback={<div className="text-xs text-muted-foreground">Rendering…</div>}>
              <MermaidDiagram code={repo.mermaid} />
            </ClientOnly>
          ) : (
            <div className="text-xs text-muted-foreground">Waiting for ingestion…</div>
          )}
        </div>
      </section>
      <section>
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">Tech stack</h3>
        <div className="rounded-md border border-border bg-card p-3 space-y-3">
          <StackSection label="Languages" items={stack.languages} />
          <StackSection label="Frameworks" items={stack.frameworks} />
          <StackSection label="Package managers" items={stack.package_managers} />
          <StackSection label="Build tools" items={stack.build_tools} />
          {!stack.languages?.length && !stack.frameworks?.length && (
            <div className="text-xs text-muted-foreground">Not analyzed yet.</div>
          )}
        </div>
      </section>
    </div>
  );
}

function StackSection({ label, items }: { label: string; items?: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-1 flex flex-wrap gap-1">
        {items.map((i) => (
          <span key={i} className="rounded border border-border bg-background px-1.5 py-0.5 text-[11px] font-mono">{i}</span>
        ))}
      </div>
    </div>
  );
}

function FilesPanel({ repositoryId, fileTree }: { repositoryId: string; fileTree: FileNode[] }) {
  const fnFile = useServerFn(getFileContent);
  const [selected, setSelected] = useState<string | undefined>();
  const fileQ = useQuery({
    queryKey: ["file", repositoryId, selected],
    queryFn: () => fnFile({ data: { repositoryId, path: selected! } }),
    enabled: !!selected,
  });

  return (
    <>
      <FileTree nodes={fileTree} onSelect={setSelected} selected={selected} />
      {selected && (
        <FileViewer path={selected} loading={fileQ.isLoading} content={fileQ.data?.content} onClose={() => setSelected(undefined)} />
      )}
    </>
  );
}

function FileViewer({ path, loading, content, onClose }: { path: string; loading: boolean; content?: string; onClose: () => void }) {
  return (
    <div className="fixed inset-y-14 right-0 w-[45vw] bg-background border-l border-border z-40 flex flex-col shadow-lg">
      <div className="border-b border-border px-4 h-9 flex items-center justify-between shrink-0">
        <div className="text-xs font-mono text-muted-foreground truncate">{path}</div>
        <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">Close</button>
      </div>
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-6 text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <pre className="p-4 text-xs font-mono whitespace-pre-wrap break-words">{content}</pre>
        )}
      </div>
    </div>
  );
}

interface ChatMessage { role: "user" | "assistant"; content: string; sources?: { path: string; start_line: number; end_line: number }[] }

function ChatPanel({ repositoryId }: { repositoryId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  async function send() {
    const q = input.trim();
    if (!q || streaming) return;
    setInput("");
    const next: ChatMessage[] = [...messages, { role: "user", content: q }, { role: "assistant", content: "" }];
    setMessages(next);
    setStreaming(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          repositoryId,
          messages: next
            .filter((m) => m.content)
            .map((m, i) => ({
              id: `m${i}`, role: m.role,
              parts: [{ type: "text", text: m.content }],
            })),
        }),
      });
      if (!res.ok || !res.body) throw new Error(await res.text());
      const sourcesHeader = res.headers.get("X-Sources");
      let sources: ChatMessage["sources"];
      try { sources = sourcesHeader ? JSON.parse(sourcesHeader) : undefined; } catch { /* noop */ }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        // AI SDK UI stream lines start with "data: {...}\n\n"; extract text deltas
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          const m = line.match(/^data:\s*(.+)$/);
          if (!m) continue;
          try {
            const evt = JSON.parse(m[1]);
            if (evt.type === "text-delta" && typeof evt.delta === "string") {
              setMessages((prev) => {
                const copy = [...prev];
                copy[copy.length - 1] = { ...copy[copy.length - 1], content: copy[copy.length - 1].content + evt.delta };
                return copy;
              });
            }
          } catch { /* ignore parse noise */ }
        }
      }
      if (sources) {
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { ...copy[copy.length - 1], sources };
          return copy;
        });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Chat failed");
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setStreaming(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground px-6 text-center">
            Ask anything about this codebase.
          </div>
        ) : (
          <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">
            {messages.map((m, i) => (
              <div key={i} className="text-sm">
                <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-1.5">
                  {m.role === "user" ? "You" : "Talk to Code"}
                </div>
                <div className={`whitespace-pre-wrap leading-relaxed ${m.role === "user" ? "text-foreground" : "text-foreground"}`}>
                  {m.content || <span className="text-muted-foreground">…</span>}
                </div>
                {m.sources && m.sources.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {m.sources.slice(0, 6).map((s, j) => (
                      <span key={j} className="text-[11px] font-mono border border-border rounded px-1.5 py-0.5 text-muted-foreground">
                        {s.path}:{s.start_line}-{s.end_line}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="border-t border-border p-3 flex gap-2 bg-background">
        <input
          value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())}
          placeholder="Ask about this repo…"
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          disabled={streaming}
        />
        <button
          onClick={send} disabled={streaming || !input.trim()}
          className="rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5"
        >
          {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

const ACTIONS = [
  { id: "code", label: "Generate code", icon: Sparkles, placeholder: "Describe the feature or code you want…" },
  { id: "debug", label: "Debug error", icon: Wrench, placeholder: "Paste an error message or stack trace…" },
  { id: "docs", label: "Generate docs", icon: FileText, placeholder: "What should the docs focus on? (e.g. 'a full README')" },
  { id: "deploy", label: "Deploy guide", icon: Rocket, placeholder: "Any deployment constraints? (e.g. 'free tier only')" },
] as const;

function ActionPanel({ repositoryId, action }: { repositoryId: string; action: "code" | "debug" | "docs" | "deploy" }) {
  const fnAction = useServerFn(runAction);
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState<{ answer: string; sources: { path: string; start_line: number; end_line: number }[] } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { setResult(null); setPrompt(""); }, [action]);

  async function run() {
    if (!prompt.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const r = await fnAction({ data: { repositoryId, action, prompt: prompt.trim() } });
      setResult(r);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  const current = useMemo(() => ACTIONS.find((a) => a.id === action)!, [action]);

  return (
    <div className="h-full flex flex-col">
      <div className="border-b border-border p-3 bg-background">
        <textarea
          value={prompt} onChange={(e) => setPrompt(e.target.value)}
          placeholder={current.placeholder}
          rows={3}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none font-mono focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="mt-2 flex justify-end">
          <button
            onClick={run} disabled={loading || !prompt.trim()}
            className="rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-sm font-medium disabled:opacity-50 flex items-center gap-1.5"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <current.icon className="h-4 w-4" />}
            Run
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        {loading && !result && (
          <div className="p-6 text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Working…
          </div>
        )}
        {result && (
          <div className="max-w-3xl mx-auto px-6 py-6">
            <pre className="text-sm whitespace-pre-wrap break-words leading-relaxed">{result.answer}</pre>
            {result.sources.length > 0 && (
              <div className="mt-6 pt-4 border-t border-border">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">Sources</div>
                <div className="flex flex-wrap gap-1">
                  {result.sources.map((s, i) => (
                    <span key={i} className="text-[11px] font-mono border border-border rounded px-1.5 py-0.5 text-muted-foreground">
                      {s.path}:{s.start_line}-{s.end_line}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        {!loading && !result && (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground text-center px-6">
            {current.label} — enter a prompt above.
          </div>
        )}
      </div>
    </div>
  );
}