import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function embedQuery(apiKey: string, query: string): Promise<number[]> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
    body: JSON.stringify({ model: "google/gemini-embedding-2", input: query }),
  });
  if (!res.ok) throw new Error(`Embed failed: ${await res.text()}`);
  const json = (await res.json()) as { data: { embedding: number[] }[] };
  return json.data[0].embedding;
}

const ACTION_PROMPTS: Record<string, string> = {
  code: "You are a senior engineer. Using the provided repository context, write clear, correct code that implements what the user asks. Cite files as `path:lineStart-lineEnd`. Prefer minimal diffs. Output well-formatted markdown with fenced code blocks.",
  debug: "You are an expert debugger. Given the user's error/stack and repository context, identify the most likely root cause and propose a specific fix with a code block. Cite files as `path:lineStart-lineEnd`.",
  docs: "You are a technical writer. Produce professional Markdown documentation for this project — Overview, Architecture, Getting Started, Key Modules, and Usage — based on the repo context. Include mermaid diagrams if useful.",
  deploy: "You are a DevOps engineer. Produce a concise, step-by-step deployment guide tailored to the detected stack (framework, package manager, build tool). Recommend the simplest free-tier host that fits. Include exact commands.",
};

export const runAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      repositoryId: z.string().uuid(),
      action: z.enum(["code", "debug", "docs", "deploy"]),
      prompt: z.string().min(1),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY!;
    const { data: repo } = await context.supabase
      .from("repositories")
      .select("owner, name, tech_stack, mermaid")
      .eq("id", data.repositoryId).maybeSingle();
    if (!repo) throw new Error("Repository not found");

    const emb = await embedQuery(apiKey, data.prompt);
    const { data: matches } = await context.supabase.rpc("match_chunks", {
      p_repository_id: data.repositoryId,
      query_embedding: emb as unknown as string,
      match_count: 8,
    });

    const contextBlock = (matches ?? [])
      .map((m: { path: string; start_line: number; end_line: number; content: string }) =>
        `\n--- ${m.path}:${m.start_line}-${m.end_line} ---\n${m.content}`)
      .join("\n");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
      body: JSON.stringify({
        model: "openai/gpt-5.4",
        messages: [
          { role: "system", content: ACTION_PROMPTS[data.action] },
          {
            role: "user",
            content: `Repository: ${repo.owner}/${repo.name}\nTech stack: ${JSON.stringify(repo.tech_stack)}\n\nRelevant code context:\n${contextBlock}\n\nRequest:\n${data.prompt}`,
          },
        ],
      }),
    });
    if (!res.ok) throw new Error(`AI failed [${res.status}]: ${await res.text()}`);
    const json = (await res.json()) as { choices: { message: { content: string } }[] };
    return {
      answer: json.choices[0].message.content,
      sources: (matches ?? []).map((m: { path: string; start_line: number; end_line: number }) =>
        ({ path: m.path, start_line: m.start_line, end_line: m.end_line })),
    };
  });