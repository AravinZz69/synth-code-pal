import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const generateDocumentation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ repositoryId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const { data: repo } = await context.supabase
      .from("repositories")
      .select("owner, name, description, workflow, tech_stack, file_tree, default_branch")
      .eq("id", data.repositoryId).maybeSingle();
    if (!repo) throw new Error("Repository not found");

    const { data: readmeChunk } = await context.supabase
      .from("code_chunks")
      .select("content")
      .eq("repository_id", data.repositoryId)
      .ilike("path", "%README%")
      .limit(1)
      .maybeSingle();

    const system = [
      "You are a senior technical writer producing professional developer documentation.",
      "Return ONLY GitHub-flavored Markdown, no prose outside the doc.",
      "Structure with these H2 sections in this order:",
      "## Project Overview",
      "## Technology Stack (use a Markdown table with columns Category | Tools)",
      "## Folder Structure (fenced ```text tree)",
      "## Architecture Explanation",
      "## API Documentation (table of endpoint | method | purpose, or say 'No public APIs detected.')",
      "## Setup Instructions (numbered list with fenced ```bash blocks)",
      "## Environment Variables (table of Name | Required | Description)",
      "## Deployment Guide (numbered list, mention the simplest free-tier host that fits)",
      "Use callouts sparingly with '> **Note:**' / '> **Tip:**' blockquotes. Use fenced code blocks with language tags. Keep it concise and production-ready.",
    ].join("\n");

    const treeSummary = JSON.stringify(repo.file_tree).slice(0, 5000);
    const user = [
      `Repository: ${repo.owner}/${repo.name} (branch: ${repo.default_branch ?? "main"})`,
      `Description: ${repo.description ?? "n/a"}`,
      `Workflow: ${repo.workflow ?? "n/a"}`,
      `Tech stack: ${JSON.stringify(repo.tech_stack)}`,
      `File tree (partial): ${treeSummary}`,
      readmeChunk?.content ? `README excerpt:\n${readmeChunk.content.slice(0, 4000)}` : "",
    ].filter(Boolean).join("\n\n");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
      body: JSON.stringify({
        model: "openai/gpt-5.4-mini",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) throw new Error(`Docs generation failed [${res.status}]: ${await res.text()}`);
    const json = (await res.json()) as { choices: { message: { content: string } }[] };
    let markdown = json.choices?.[0]?.message?.content ?? "";
    markdown = markdown.replace(/^```markdown\s*/i, "").replace(/```\s*$/i, "").trim();
    return { markdown };
  });