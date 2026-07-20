import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, KeyRound, CheckCircle2, XCircle } from "lucide-react";
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
    <div className="mx-auto max-w-[1200px] px-6 py-10">
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Repositories</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Connect a GitHub repository to analyze and chat with it.
          </p>
        </div>
        <button
          onClick={() => setShowToken((v) => !v)}
          className="flex items-center gap-2 text-xs rounded-md border border-border px-3 py-1.5 hover:bg-muted"
        >
          <KeyRound className="h-3.5 w-3.5" />
          {tokenStatus.data?.hasToken ? "GitHub token: set" : "Add GitHub token"}
        </button>
      </div>

      {showToken && (
        <div className="mb-6 rounded-md border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground mb-2">
            Optional. Add a <a className="text-primary underline" target="_blank" rel="noreferrer" href="https://github.com/settings/tokens/new?scopes=repo">GitHub PAT with <code>repo</code> scope</a> to access private repositories and lift rate limits.
          </p>
          <div className="flex gap-2">
            <input
              type="password" value={token} onChange={(e) => setTokenValue(e.target.value)}
              placeholder="ghp_…"
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
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
        className="flex gap-2 mb-6"
      >
        <input
          type="text" value={url} onChange={(e) => setUrl(e.target.value)}
          placeholder="https://github.com/vercel/next.js or vercel/next.js"
          className="flex-1 rounded-md border border-input bg-background px-3.5 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          type="submit" disabled={addMut.isPending || !url.trim()}
          className="flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {addMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Add repository
        </button>
      </form>

      <div className="rounded-md border border-border bg-card overflow-hidden">
        {repos.isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading…</div>
        ) : (repos.data ?? []).length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            No repositories yet. Add one above to get started.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left font-medium px-5 py-2.5">Repository</th>
                <th className="text-left font-medium px-5 py-2.5 hidden md:table-cell">Branch</th>
                <th className="text-left font-medium px-5 py-2.5">Status</th>
                <th className="text-right font-medium px-5 py-2.5">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {repos.data!.map((r) => (
                <tr key={r.id} className="hover:bg-muted/30">
                  <td className="px-5 py-3">
                    <div className="font-mono text-sm">{r.owner}/{r.name}</div>
                  </td>
                  <td className="px-5 py-3 text-xs text-muted-foreground font-mono hidden md:table-cell">
                    {r.default_branch ?? "main"}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <StatusIcon status={r.status} />
                      <span className="truncate max-w-[240px]">{r.status_message ?? r.status}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {r.status === "ready" ? (
                        <Link
                          to="/r/$owner/$repo" params={{ owner: r.owner, repo: r.name }}
                          className="rounded-md border border-border px-3 py-1 text-xs font-medium hover:bg-muted"
                        >Open</Link>
                      ) : r.status === "error" ? (
                        <button
                          onClick={() => fnIngest({ data: { repositoryId: r.id } }).then(() => qc.invalidateQueries({ queryKey: ["repos"] }))}
                          className="rounded-md border border-border px-3 py-1 text-xs hover:bg-muted"
                        >Retry</button>
                      ) : null}
                      <button
                        onClick={() => delMut.mutate(r.id)}
                        className="rounded-md p-1.5 text-muted-foreground hover:text-destructive hover:bg-muted"
                        aria-label="Delete"
                      ><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === "ready") return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />;
  if (status === "error") return <XCircle className="h-3.5 w-3.5 text-destructive" />;
  return <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />;
}