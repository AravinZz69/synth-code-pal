import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Search, CheckCircle2, XCircle, GitFork, Lock, Star, Play } from "lucide-react";
import { listMyGithubRepos, connectRepository } from "@/lib/repos.functions";
import { ingestRepository } from "@/lib/ingest.functions";

export const Route = createFileRoute("/_authenticated/repos")({
  component: ReposPage,
  head: () => ({ meta: [{ title: "Your repositories — CodeSpace" }] }),
});

function ReposPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const fnList = useServerFn(listMyGithubRepos);
  const fnConnect = useServerFn(connectRepository);
  const fnIngest = useServerFn(ingestRepository);

  const list = useQuery({
    queryKey: ["gh-repos"],
    queryFn: () => fnList(),
    refetchInterval: (q) => {
      const repos = (q.state.data as { repos?: { connected: { status?: string } | null }[] } | undefined)?.repos;
      const anyProcessing = repos?.some(
        (r) => r.connected && r.connected.status !== "ready" && r.connected.status !== "error",
      );
      return anyProcessing ? 2000 : false;
    },
  });

  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const all = list.data?.repos ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.full_name.toLowerCase().includes(q) ||
        (r.description ?? "").toLowerCase().includes(q),
    );
  }, [list.data, query]);

  const connectMut = useMutation({
    mutationFn: async (r: { owner: string; name: string }) => {
      const res = await fnConnect({ data: { owner: r.owner, name: r.name } });
      if (!res.existing) {
        // fire-and-forget ingestion; UI polls
        fnIngest({ data: { repositoryId: res.id } }).catch((e) => toast.error(e.message));
      }
      return { ...res, owner: r.owner, name: r.name };
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["gh-repos"] });
      if (res.existing) {
        router.navigate({ to: "/r/$owner/$repo", params: { owner: res.owner, repo: res.name } });
      } else {
        toast.success("Analysis started");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Your GitHub repositories</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {list.data?.login ? (
            <>
              Signed in as <span className="font-mono">@{list.data.login}</span>. Select a repository to analyze it.
            </>
          ) : (
            "Loading your repositories from GitHub…"
          )}
        </p>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search repositories…"
          className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="rounded-md border border-border bg-card overflow-hidden">
        {list.isLoading ? (
          <div className="p-10 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading repositories…
          </div>
        ) : list.isError ? (
          <div className="p-6 text-sm text-destructive">
            Failed to load repositories: {(list.error as Error).message}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No repositories match your search.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((r) => {
              const connected = r.connected;
              const isProcessing = connected && connected.status !== "ready" && connected.status !== "error";
              const isReady = connected?.status === "ready";
              const isError = connected?.status === "error";
              return (
                <li key={r.id} className="px-5 py-4 flex items-start justify-between gap-4 hover:bg-muted/30">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-medium truncate">{r.full_name}</span>
                      {r.private && (
                        <span title="Private" className="text-muted-foreground">
                          <Lock className="h-3 w-3" />
                        </span>
                      )}
                      {r.fork && (
                        <span title="Fork" className="text-muted-foreground">
                          <GitFork className="h-3 w-3" />
                        </span>
                      )}
                      {isReady && (
                        <span className="text-[11px] rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-emerald-700 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Analyzed
                        </span>
                      )}
                      {isProcessing && (
                        <span className="text-[11px] rounded border border-border bg-background px-1.5 py-0.5 text-muted-foreground flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" /> Analyzing
                        </span>
                      )}
                      {isError && (
                        <span className="text-[11px] rounded border border-red-200 bg-red-50 px-1.5 py-0.5 text-red-700 flex items-center gap-1">
                          <XCircle className="h-3 w-3" /> Error
                        </span>
                      )}
                    </div>
                    {r.description && (
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{r.description}</p>
                    )}
                    <div className="mt-1.5 flex items-center gap-3 text-[11px] text-muted-foreground font-mono">
                      {r.language && <span>{r.language}</span>}
                      {r.stars > 0 && (
                        <span className="flex items-center gap-1">
                          <Star className="h-3 w-3" /> {r.stars}
                        </span>
                      )}
                      <span>{r.default_branch}</span>
                    </div>
                  </div>
                  <div className="shrink-0">
                    {isReady ? (
                      <button
                        onClick={() =>
                          router.navigate({ to: "/r/$owner/$repo", params: { owner: r.owner, repo: r.name } })
                        }
                        className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted"
                      >
                        Open
                      </button>
                    ) : isProcessing ? (
                      <button
                        onClick={() =>
                          router.navigate({ to: "/r/$owner/$repo", params: { owner: r.owner, repo: r.name } })
                        }
                        className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted"
                      >
                        View
                      </button>
                    ) : (
                      <button
                        onClick={() => connectMut.mutate({ owner: r.owner, name: r.name })}
                        disabled={connectMut.isPending && connectMut.variables?.name === r.name}
                        className="flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium hover:opacity-90 disabled:opacity-50"
                      >
                        {connectMut.isPending && connectMut.variables?.name === r.name ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Play className="h-3 w-3" />
                        )}
                        Analyze
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
