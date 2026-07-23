import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "get_architecture",
  title: "Get architecture & overview",
  description:
    "Return the CodeSpace-generated description, workflow, layered architecture (Mermaid), and detected tech stack for a repository.",
  inputSchema: { repository_id: z.string().uuid() },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ repository_id }, ctx: ToolContext) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase
      .from("repositories")
      .select("owner, name, description, workflow, mermaid, tech_stack, status")
      .eq("id", repository_id)
      .maybeSingle();
    if (error || !data) {
      return { content: [{ type: "text", text: "Repository not found or not accessible." }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: data,
    };
  },
});