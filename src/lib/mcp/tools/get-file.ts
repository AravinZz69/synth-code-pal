import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { fetchRawFile } from "@/lib/github.server";

export default defineTool({
  name: "get_file",
  title: "Get file contents",
  description: "Fetch the raw contents of a file from a connected repository at its default branch.",
  inputSchema: {
    repository_id: z.string().uuid(),
    path: z.string().min(1).describe("File path relative to repo root."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async ({ repository_id, path }, ctx: ToolContext) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: repo, error } = await supabase
      .from("repositories")
      .select("owner, name, default_branch")
      .eq("id", repository_id)
      .maybeSingle();
    if (error || !repo) {
      return { content: [{ type: "text", text: "Repository not found or not accessible." }], isError: true };
    }
    const { data: tok } = await supabase.from("github_tokens").select("access_token").maybeSingle();
    if (!tok?.access_token) {
      return { content: [{ type: "text", text: "GitHub token missing for this user." }], isError: true };
    }
    try {
      const content = await fetchRawFile(tok.access_token, repo.owner, repo.name, repo.default_branch, path);
      return {
        content: [{ type: "text", text: content.slice(0, 60_000) }],
        structuredContent: { path, truncated: content.length > 60_000 },
      };
    } catch (e) {
      return { content: [{ type: "text", text: e instanceof Error ? e.message : "Fetch failed" }], isError: true };
    }
  },
});