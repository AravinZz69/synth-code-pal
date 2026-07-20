import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, GitBranch, KeyRound, CheckCircle2, XCircle } from "lucide-react";
import { addRepository, deleteRepository, getGithubTokenStatus, listRepositories, setGithubToken } from "@/lib/repos.functions";
import { ingestRepository } from "@/lib/ingest.functions";

export const Route = createFileRoute("/_authenticated/repos")({
  component: ReposPage,
  head: () => ({ meta: [{ title: "Your repositories — Talk to Code" }] }),
});

function ReposPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const fnList = useServerFn(listRepositories);
  const fnAdd = useServerFn(addRepository);
  const fnDel = useServerFn(deleteRepository);
  const fnIngest = useServerFn(ingestRepository);
  const fnToken = useServerFn(setGithubToken);
  const fnTokenStatus = useServerFn(getGithubTokenStatus);

  const repos = useQuery({ queryKey: ["repos"], queryFn: () => fnList() });
  const tokenStatus = useQuery({ queryKey: ["ghToken"], queryFn: () => fnTokenStatus() });

  const [url, setUrl] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [token, setTokenValue] = useState("");

  // poll while any repo is processing
  useEffect(() => {
    const processing = repos.data?.some((r) => r.status === "processing" || r.status === "pending");
    if (!processing) return;
    const id = setInterval(() => qc.invalidateQueries({ queryKey: ["repos"] }), 1800);
    return () => clearInterval(id);
  }, [repos.data, qc]);

  const addMut = useMutation({
    mutationFn: async (u: string) => {
      const res = await fnAdd({ data: { url: u } });
      if (!res.existing) {
        // fire-and-forget ingestion; UI polls
        fnIngest({ data: { repositoryId: res.id } }).catch((e) => toast.error(e.message));
      }
      return res;
    },
    onSuccess: (res) => {
      setUrl("");
      qc.invalidateQueries({ queryKey: ["repos"] });
      toast.success(res.existing ? "Repo already added" : "Ingestion started");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => fnDel({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["repos"] }),
  });

  const tokenMut = useMutation({
    mutationFn: async (t: string) => fnToken({ data: { token: t } }),
    onSuccess: () => {
      setTokenValue("");
      setShowToken(false);
      qc.invalidateQueries({ queryKey: ["ghToken"] });
      toast.success("GitHub token saved");
    },
  });

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Your repositories</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Paste a GitHub URL to ingest a repo and start chatting with it.
          </p>
        </div>
        <button
          onClick={() => setShowToken((v) => !v)}
          className="flex items-center gap-2 text-xs rounded-md border border-border px-3 py-1.5 hover:bg-secondary"
        >
          <KeyRound className="h-3.5 w-3.5" />
          {tokenStatus.data?.hasToken ? "GitHub token: set" : "Add GitHub token"}
        </button>
      </div>

      {showToken && (
        <div className="mb-6 rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground mb-2">
            Optional. Add a <a className="text-primary underline" target="_blank" rel="noreferrer" href="https://github.com/settings/tokens/new?scopes=repo">GitHub PAT with <code>repo</code> scope</a> to access private repositories and lift rate limits.
          </p>
          <div className="flex gap-2">
            <input
              type="password" value={token} onChange={(e) => setTokenValue(e.target.value)}
              placeholder="ghp_…"
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
            />
            <button
              onClick={() => tokenMut.mutate(token)}
              disabled={!token || tokenMut.isPending}
              className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium disabled:opacity-50"
            >Save</button>
          </div>
        </div>
      )}

      <form
        onSubmit={(e) => { e.preventDefault(); if (url.trim()) addMut.mutate(url.trim()); }}
        className="flex gap-2 mb-8"
      >
        <input
          type="text" value={url} onChange={(e) => setUrl(e.target.value)}
          placeholder="https://github.com/vercel/next.js or vercel/next.js"
          className="flex-1 rounded-md border border-input bg-background px-4 py-2.5 text-sm font-mono"
        />
        <button
          type="submit" disabled={addMut.isPending || !url.trim()}
          className="flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {addMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Ingest repo
        </button>
      </form>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {repos.isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading…</div>
        ) : (repos.data ?? []).length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No repositories yet. Add one above to get started.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {repos.data!.map((r) => (
              <li key={r.id} className="px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <GitBranch className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-sm truncate">{r.owner}/{r.name}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                      <StatusIcon status={r.status} />
                      <span>{r.status_message ?? r.status}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {r.status === "ready" ? (
                    <Link
                      to="/r/$owner/$repo" params={{ owner: r.owner, repo: r.name }}
                      className="rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium hover:opacity-90"
                    >Open</Link>
                  ) : r.status === "error" ? (
                    <button
                      onClick={() => fnIngest({ data: { repositoryId: r.id } }).then(() => qc.invalidateQueries({ queryKey: ["repos"] }))}
                      className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-secondary"
                    >Retry</button>
                  ) : null}
                  <button
                    onClick={() => delMut.mutate(r.id)}
                    className="rounded-md p-1.5 text-muted-foreground hover:text-destructive hover:bg-secondary"
                    aria-label="Delete"
                  ><Trash2 className="h-4 w-4" /></button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === "ready") return <CheckCircle2 className="h-3.5 w-3.5 text-primary" />;
  if (status === "error") return <XCircle className="h-3.5 w-3.5 text-destructive" />;
  return <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />;
}