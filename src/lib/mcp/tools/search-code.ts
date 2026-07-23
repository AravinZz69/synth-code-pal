import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { embed } from "@/lib/ai-gateway.server";

export default defineTool({
  name: "search_code",
  title: "Semantic code search",
  description:
    "Semantic search across a connected repository's chunked source code. Returns the top matching snippets with file path and line range.",
  inputSchema: {
    repository_id: z.string().uuid().describe("Repository UUID (from list_repositories)."),
    query: z.string().min(2).describe("Natural language search query."),
    limit: z.number().int().min(1).max(20).optional().describe("Max results (default 8)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ repository_id, query, limit }, ctx: ToolContext) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    // RLS on repositories enforces ownership; this fails if the user doesn't own it.
    const { data: repo, error: repoErr } = await supabase
      .from("repositories")
      .select("id")
      .eq("id", repository_id)
      .maybeSingle();
    if (repoErr || !repo) {
      return { content: [{ type: "text", text: "Repository not found or not accessible." }], isError: true };
    }
    const [embedding] = await embed([query]);
    const { data, error } = await supabase.rpc("match_chunks", {
      p_repository_id: repository_id,
      query_embedding: embedding as unknown as string,
      match_count: limit ?? 8,
    });
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const results = (data ?? []) as Array<{
      path: string; start_line: number; end_line: number; kind: string; content: string; similarity: number;
    }>;
    const text = results
      .map((r) => `• ${r.path}:${r.start_line}-${r.end_line} [${r.kind}] (sim ${r.similarity.toFixed(2)})\n${r.content.slice(0, 800)}`)
      .join("\n\n---\n\n");
    return {
      content: [{ type: "text", text: text || "No matches." }],
      structuredContent: { results },
    };
  },
});