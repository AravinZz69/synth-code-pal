import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ClientOnly } from "@tanstack/react-router";
import { getRepositoryByPath, getFileContent } from "@/lib/repos.functions";
import { regenerateArchitecture } from "@/lib/ingest.functions";
import { runAction } from "@/lib/actions.functions";
import { MermaidDiagram } from "@/components/mermaid-diagram";
import { FileTree, type FileNode } from "@/components/file-tree";
import { toast } from "sonner";
import {
  Loader2, RefreshCw, MessageSquare, GitBranch, FileCode,
  Wrench, FileText, Rocket, Sparkles, Send,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/r/$owner/$repo")({
  component: WorkspacePage,
  head: ({ params }) => ({
    meta: [{ title: `${params.owner}/${params.repo} — Talk to Code` }],
  }),
});

type Tab = "overview" | "files" | "chat" | "actions";

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

  const [tab, setTab] = useState<Tab>("overview");
  const r = repository.data;

  if (repository.isLoading) return <Centered><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></Centered>;
  if (!r) return <Centered>Repository not found. <Link to="/repos" className="text-primary underline ml-1">Back</Link></Centered>;

  const notReady = r.status !== "ready";

  return (
    <div className="mx-auto max-w-7xl px-6 py-6">
      <div className="flex items-center gap-3 mb-4">
        <GitBranch className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-mono">{r.owner}/{r.name}</h1>
        <span className="text-xs text-muted-foreground">{r.default_branch}</span>
        {notReady && (
          <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> {r.status_message ?? r.status}
          </span>
        )}
      </div>

      <nav className="flex gap-1 border-b border-border mb-6">
        {([
          ["overview", "Overview", Sparkles],
          ["files", "Files", FileCode],
          ["chat", "Chat", MessageSquare],
          ["actions", "Actions", Wrench],
        ] as [Tab, string, typeof Sparkles][]).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            disabled={notReady && id !== "overview"}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm border-b-2 -mb-px transition-colors ${
              tab === id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </nav>

      {tab === "overview" && <OverviewTab repo={r} />}
      {tab === "files" && <FilesTab repositoryId={r.id} fileTree={(r.file_tree ?? []) as FileNode[]} />}
      {tab === "chat" && <ChatTab repositoryId={r.id} />}
      {tab === "actions" && <ActionsTab repositoryId={r.id} />}
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="min-h-[50vh] flex items-center justify-center text-sm text-muted-foreground">{children}</div>;
}

function OverviewTab({ repo }: { repo: { id: string; mermaid: string | null; tech_stack: unknown; status: string } }) {
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
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 rounded-lg border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Architecture</h2>
          <button
            onClick={() => regen.mutate()}
            disabled={regen.isPending || repo.status !== "ready"}
            className="flex items-center gap-1.5 text-xs rounded-md border border-border px-2.5 py-1 hover:bg-secondary disabled:opacity-50"
          >
            {regen.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Regenerate
          </button>
        </div>
        {repo.mermaid ? (
          <ClientOnly fallback={<div className="text-xs text-muted-foreground">Rendering…</div>}>
            <MermaidDiagram code={repo.mermaid} />
          </ClientOnly>
        ) : (
          <div className="text-sm text-muted-foreground">Waiting for ingestion to complete…</div>
        )}
      </div>
      <div className="rounded-lg border border-border bg-card p-5">
        <h2 className="font-semibold mb-4">Tech stack</h2>
        <StackSection label="Languages" items={stack.languages} />
        <StackSection label="Frameworks" items={stack.frameworks} />
        <StackSection label="Package managers" items={stack.package_managers} />
        <StackSection label="Build tools" items={stack.build_tools} />
      </div>
    </div>
  );
}

function StackSection({ label, items }: { label: string; items?: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="mb-3">
      <div className="text-xs uppercase text-muted-foreground tracking-wide">{label}</div>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {items.map((i) => (
          <span key={i} className="rounded-md bg-secondary px-2 py-0.5 text-xs font-mono">{i}</span>
        ))}
      </div>
    </div>
  );
}

function FilesTab({ repositoryId, fileTree }: { repositoryId: string; fileTree: FileNode[] }) {
  const fnFile = useServerFn(getFileContent);
  const [selected, setSelected] = useState<string | undefined>();
  const fileQ = useQuery({
    queryKey: ["file", repositoryId, selected],
    queryFn: () => fnFile({ data: { repositoryId, path: selected! } }),
    enabled: !!selected,
  });

  return (
    <div className="grid grid-cols-[280px_1fr] gap-4 h-[70vh]">
      <div className="rounded-lg border border-border bg-card overflow-auto">
        <FileTree nodes={fileTree} onSelect={setSelected} selected={selected} />
      </div>
      <div className="rounded-lg border border-border bg-card overflow-auto">
        {!selected ? (
          <div className="p-6 text-sm text-muted-foreground">Select a file to view its contents.</div>
        ) : fileQ.isLoading ? (
          <div className="p-6 text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading {selected}…
          </div>
        ) : (
          <>
            <div className="border-b border-border px-4 py-2 text-xs font-mono text-muted-foreground">{selected}</div>
            <pre className="p-4 text-xs font-mono whitespace-pre-wrap break-words">{fileQ.data?.content}</pre>
          </>
        )}
      </div>
    </div>
  );
}

interface ChatMessage { role: "user" | "assistant"; content: string; sources?: { path: string; start_line: number; end_line: number }[] }

function ChatTab({ repositoryId }: { repositoryId: string }) {
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
    <div className="flex flex-col h-[70vh] rounded-lg border border-border bg-card">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-16">
            Ask anything about this codebase. Examples:
            <div className="mt-3 flex flex-wrap gap-2 justify-center">
              {["How does authentication work?", "Where is the database schema defined?", "Explain the entry point"].map((s) => (
                <button
                  key={s}
                  onClick={() => setInput(s)}
                  className="rounded-full border border-border px-3 py-1 text-xs hover:bg-secondary"
                >{s}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
            <div className={`max-w-[85%] rounded-lg px-4 py-3 text-sm whitespace-pre-wrap ${
              m.role === "user" ? "bg-primary text-primary-foreground" : "bg-secondary/50"
            }`}>
              {m.content || <span className="opacity-60">…</span>}
              {m.sources && m.sources.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border/50">
                  <div className="text-xs text-muted-foreground mb-1.5">Sources</div>
                  <div className="flex flex-wrap gap-1.5">
                    {m.sources.slice(0, 6).map((s, j) => (
                      <span key={j} className="text-xs font-mono bg-background/60 rounded px-1.5 py-0.5">
                        {s.path}:{s.start_line}-{s.end_line}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-border p-3 flex gap-2">
        <input
          value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())}
          placeholder="Ask about this repo…"
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
          disabled={streaming}
        />
        <button
          onClick={send} disabled={streaming || !input.trim()}
          className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
        >
          {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Send
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

function ActionsTab({ repositoryId }: { repositoryId: string }) {
  const fnAction = useServerFn(runAction);
  const [selected, setSelected] = useState<(typeof ACTIONS)[number]["id"]>("code");
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState<{ answer: string; sources: { path: string; start_line: number; end_line: number }[] } | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    if (!prompt.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const r = await fnAction({ data: { repositoryId, action: selected, prompt: prompt.trim() } });
      setResult(r);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  const current = useMemo(() => ACTIONS.find((a) => a.id === selected)!, [selected]);

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {ACTIONS.map((a) => (
          <button
            key={a.id} onClick={() => setSelected(a.id)}
            className={`flex items-center gap-2 rounded-lg border p-3 text-left transition-colors ${
              selected === a.id ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-secondary/50"
            }`}
          >
            <a.icon className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">{a.label}</span>
          </button>
        ))}
      </div>
      <div className="rounded-lg border border-border bg-card p-4">
        <textarea
          value={prompt} onChange={(e) => setPrompt(e.target.value)}
          placeholder={current.placeholder}
          rows={4}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none font-mono"
        />
        <div className="mt-3 flex justify-end">
          <button
            onClick={run} disabled={loading || !prompt.trim()}
            className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <current.icon className="h-4 w-4" />}
            Run
          </button>
        </div>
      </div>
      {result && (
        <div className="rounded-lg border border-border bg-card p-5">
          <pre className="text-sm whitespace-pre-wrap break-words">{result.answer}</pre>
          {result.sources.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border">
              <div className="text-xs text-muted-foreground mb-2">Sources</div>
              <div className="flex flex-wrap gap-1.5">
                {result.sources.map((s, i) => (
                  <span key={i} className="text-xs font-mono bg-secondary/50 rounded px-1.5 py-0.5">
                    {s.path}:{s.start_line}-{s.end_line}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}