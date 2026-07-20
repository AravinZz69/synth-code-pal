import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { fetchRawFile, getRepo, listAllUserRepos, parseRepoUrl } from "./github.server";

export const listRepositories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("repositories")
      .select("id, owner, name, default_branch, status, status_message, tech_stack, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getRepository = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: repo, error } = await context.supabase
      .from("repositories")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!repo) throw new Error("Repository not found");
    return repo;
  });

export const getRepositoryByPath = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ owner: z.string(), name: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: repo, error } = await context.supabase
      .from("repositories")
      .select("*")
      .eq("owner", data.owner)
      .eq("name", data.name)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return repo;
  });

export const deleteRepository = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("repositories").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const addRepository = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ url: z.string().min(3) }).parse(d))
  .handler(async ({ data, context }) => {
    const parsed = parseRepoUrl(data.url);
    if (!parsed) throw new Error("Invalid GitHub URL. Use owner/repo or https://github.com/owner/repo");
    const { data: tokenRow } = await context.supabase
      .from("github_tokens")
      .select("access_token")
      .maybeSingle();
    const token = tokenRow?.access_token ?? undefined;
    const info = await getRepo(parsed.owner, parsed.repo, token);
    const { data: existing } = await context.supabase
      .from("repositories")
      .select("id")
      .eq("owner", parsed.owner)
      .eq("name", parsed.repo)
      .maybeSingle();
    if (existing) return { id: existing.id, existing: true };
    const { data: inserted, error } = await context.supabase
      .from("repositories")
      .insert({
        user_id: context.userId,
        owner: parsed.owner,
        name: parsed.repo,
        default_branch: info.default_branch,
        status: "pending",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: inserted.id, existing: false };
  });

export const setGithubToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ token: z.string().min(4) }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("github_tokens")
      .upsert({ user_id: context.userId, access_token: data.token, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getGithubTokenStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("github_tokens").select("user_id").maybeSingle();
    return { hasToken: !!data };
  });

export const listMyGithubRepos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: tokenRow } = await context.supabase
      .from("github_tokens").select("access_token, github_login").maybeSingle();
    if (!tokenRow?.access_token) throw new Error("Not signed in with GitHub");
    const repos = await listAllUserRepos(tokenRow.access_token);
    // Already-connected repos in our DB
    const { data: connected } = await context.supabase
      .from("repositories")
      .select("id, owner, name, status");
    const byKey = new Map((connected ?? []).map((r) => [`${r.owner}/${r.name}`, r]));
    return {
      login: tokenRow.github_login,
      repos: repos.map((r) => ({
        id: r.id,
        owner: r.owner.login,
        name: r.name,
        full_name: r.full_name,
        description: r.description,
        private: r.private,
        fork: r.fork,
        language: r.language,
        stars: r.stargazers_count,
        default_branch: r.default_branch,
        updated_at: r.updated_at,
        connected: byKey.get(r.full_name) ?? null,
      })),
    };
  });

export const connectRepository = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ owner: z.string(), name: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: existing } = await context.supabase
      .from("repositories")
      .select("id, status")
      .eq("owner", data.owner)
      .eq("name", data.name)
      .maybeSingle();
    if (existing) return { id: existing.id, existing: true };
    const { data: tokenRow } = await context.supabase
      .from("github_tokens").select("access_token").maybeSingle();
    const info = await getRepo(data.owner, data.name, tokenRow?.access_token ?? undefined);
    const { data: inserted, error } = await context.supabase
      .from("repositories")
      .insert({
        user_id: context.userId,
        owner: data.owner,
        name: data.name,
        default_branch: info.default_branch,
        description: info.description,
        status: "pending",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: inserted.id, existing: false };
  });

export const getFileContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ repositoryId: z.string().uuid(), path: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: repo, error } = await context.supabase
      .from("repositories")
      .select("owner, name, default_branch")
      .eq("id", data.repositoryId)
      .maybeSingle();
    if (error || !repo) throw new Error("Repository not found");
    const { data: tokenRow } = await context.supabase
      .from("github_tokens").select("access_token").maybeSingle();
    const content = await fetchRawFile(
      repo.owner, repo.name, repo.default_branch ?? "HEAD", data.path,
      tokenRow?.access_token ?? undefined,
    );
    return { content: content ?? "" };
  });