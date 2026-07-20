import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  buildFileTree,
  chunkFile,
  detectTechStack,
  fetchRawFile,
  getBranchSha,
  getRepo,
  getTree,
  isCodeFile,
} from "./github.server";

const MAX_FILES = 120; // demo cap

async function generateArchitectureDiagram(apiKey: string, opts: {
  fileTree: unknown;
  techStack: unknown;
  owner: string;
  name: string;
}): Promise<string> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
    },
    body: JSON.stringify({
      model: "openai/gpt-5.4-mini",
      messages: [
        {
          role: "system",
          content:
            [
              "You are a senior software architect. Produce ONLY a Mermaid `graph TD` diagram (no fences, no prose) showing the main modules and data flow for the repository.",
              "Rules:",
              "- Use short readable labels. Under 22 nodes total.",
              "- Group related nodes with subgraphs when helpful (Frontend, Backend, Data, External).",
              "- Assign every node exactly one class from this fixed set based on what it is:",
              "  frontend | backend | database | api | auth | ai | external",
              "- Use `class NodeId className` lines (NOT :::) at the end.",
              "- Include these classDef lines VERBATIM at the top after `graph TD`:",
              "  classDef frontend fill:#DBEAFE,stroke:#3B82F6,stroke-width:1.5px,color:#1E3A8A",
              "  classDef backend fill:#E0E7FF,stroke:#6366F1,stroke-width:1.5px,color:#312E81",
              "  classDef database fill:#EDE9FE,stroke:#8B5CF6,stroke-width:1.5px,color:#4C1D95",
              "  classDef api fill:#CFFAFE,stroke:#06B6D4,stroke-width:1.5px,color:#164E63",
              "  classDef auth fill:#FEF3C7,stroke:#F59E0B,stroke-width:1.5px,color:#78350F",
              "  classDef ai fill:#FCE7F3,stroke:#EC4899,stroke-width:1.5px,color:#831843",
              "  classDef external fill:#F1F5F9,stroke:#64748B,stroke-width:1.5px,color:#0F172A",
              "- Use rounded nodes: NodeId([Label]). Add short edge labels like -->|reads|.",
              "- Return ONLY mermaid starting exactly with `graph TD`.",
            ].join("\n"),
        },
        {
          role: "user",
          content: `Repository: ${opts.owner}/${opts.name}\n\nTech stack: ${JSON.stringify(opts.techStack)}\n\nFile tree (top levels):\n${JSON.stringify(opts.fileTree).slice(0, 6000)}`,
        },
      ],
    }),
  });
  if (!res.ok) {
    return `graph TD\n  A[${opts.owner}/${opts.name}] --> B[Source]\n  B --> C[Modules]`;
  }
  const json = (await res.json()) as { choices: { message: { content: string } }[] };
  let text = json.choices?.[0]?.message?.content ?? "";
  text = text.replace(/```mermaid\s*/gi, "").replace(/```/g, "").trim();
  if (!text.startsWith("graph")) text = `graph TD\n${text}`;
  return text;
}

async function generateOverview(apiKey: string, opts: {
  fileTree: unknown;
  techStack: unknown;
  owner: string;
  name: string;
  readme?: string | null;
}): Promise<{ description: string; workflow: string }> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
    body: JSON.stringify({
      model: "openai/gpt-5.4-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            'You analyze GitHub repositories. Return ONLY valid JSON with two keys: "description" (2-4 sentence plain-English summary of what the project is and does) and "workflow" (a numbered step-by-step text explanation of how the system works end to end — data flow, key modules, and how a typical request/action moves through the code, 6-10 concise steps, each on its own line prefixed with "1. ", "2. ", ...). No prose outside JSON, no markdown fences.',
        },
        {
          role: "user",
          content: `Repository: ${opts.owner}/${opts.name}
Tech stack: ${JSON.stringify(opts.techStack)}

File tree (partial):
${JSON.stringify(opts.fileTree).slice(0, 5000)}

README (may be empty):
${(opts.readme ?? "").slice(0, 6000)}`,
        },
      ],
    }),
  });
  if (!res.ok) {
    return {
      description: `${opts.owner}/${opts.name} — automated overview unavailable.`,
      workflow: "1. Overview generation failed. Retry from the workspace.",
    };
  }
  const json = (await res.json()) as { choices: { message: { content: string } }[] };
  const text = json.choices?.[0]?.message?.content ?? "{}";
  try {
    const parsed = JSON.parse(text) as { description?: string; workflow?: string };
    return {
      description: parsed.description ?? "",
      workflow: parsed.workflow ?? "",
    };
  } catch {
    return { description: text.slice(0, 800), workflow: "" };
  }
}

async function embedBatch(apiKey: string, inputs: string[]): Promise<number[][]> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
    },
    body: JSON.stringify({ model: "google/gemini-embedding-2", input: inputs }),
  });
  if (!res.ok) throw new Error(`Embedding failed [${res.status}]: ${await res.text()}`);
  const json = (await res.json()) as { data: { embedding: number[]; index: number }[] };
  return json.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

export const ingestRepository = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ repositoryId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const { data: repo } = await context.supabase
      .from("repositories")
      .select("*")
      .eq("id", data.repositoryId)
      .maybeSingle();
    if (!repo) throw new Error("Repository not found");

    const { data: tokenRow } = await context.supabase
      .from("github_tokens").select("access_token").maybeSingle();
    const token = tokenRow?.access_token ?? undefined;

    const setStatus = async (status: string, message: string) => {
      await context.supabase
        .from("repositories")
        .update({ status, status_message: message, updated_at: new Date().toISOString() })
        .eq("id", repo.id);
    };

    try {
      await setStatus("processing", "Fetching repository metadata…");
      const info = await getRepo(repo.owner, repo.name, token);
      const branch = info.default_branch;
      const sha = await getBranchSha(repo.owner, repo.name, branch, token);

      await setStatus("processing", "Reading file tree…");
      const tree = await getTree(repo.owner, repo.name, sha, token);

      // Wipe previous chunks if re-ingesting
      await context.supabase.from("code_chunks").delete().eq("repository_id", repo.id);

      const codeFiles = tree.tree
        .filter((e) => e.type === "blob" && isCodeFile(e.path, e.size))
        .slice(0, MAX_FILES);

      const fileTree = buildFileTree(tree.tree.filter((e) => e.type === "blob"));

      await setStatus("processing", `Downloading ${codeFiles.length} files…`);
      const fileContents: Record<string, string> = {};
      let downloaded = 0;
      // sequential to keep GitHub happy; fast enough for demo
      for (const f of codeFiles) {
        const content = await fetchRawFile(repo.owner, repo.name, sha, f.path, token);
        if (content !== null) fileContents[f.path] = content;
        downloaded++;
        if (downloaded % 20 === 0) await setStatus("processing", `Downloaded ${downloaded}/${codeFiles.length}`);
      }

      const techStack = detectTechStack(new Set(Object.keys(fileContents)), fileContents);

      await setStatus("processing", "Chunking source code…");
      const chunks = Object.entries(fileContents).flatMap(([path, content]) => chunkFile(path, content));

      await setStatus("processing", `Embedding ${chunks.length} code chunks…`);
      const batchSize = 60;
      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        const embeddings = await embedBatch(
          apiKey,
          batch.map(
            (c) => `File: ${c.path} (lines ${c.start_line}-${c.end_line})\n\n${c.content.slice(0, 6000)}`,
          ),
        );
        const rows = batch.map((c, idx) => ({
          repository_id: repo.id,
          path: c.path,
          start_line: c.start_line,
          end_line: c.end_line,
          kind: c.kind,
          content: c.content.slice(0, 8000),
          embedding: embeddings[idx] as unknown as string,
        }));
        const { error } = await context.supabase.from("code_chunks").insert(rows);
        if (error) throw new Error(`Insert chunks failed: ${error.message}`);
        await setStatus("processing", `Embedded ${Math.min(i + batchSize, chunks.length)}/${chunks.length}`);
      }

      await setStatus("processing", "Generating architecture diagram…");
      const mermaid = await generateArchitectureDiagram(apiKey, {
        fileTree, techStack, owner: repo.owner, name: repo.name,
      });

      await setStatus("processing", "Writing project overview…");
      const readme = fileContents["README.md"] ?? fileContents["Readme.md"] ?? fileContents["readme.md"] ?? null;
      const overview = await generateOverview(apiKey, {
        fileTree, techStack, owner: repo.owner, name: repo.name, readme,
      });

      await context.supabase
        .from("repositories")
        .update({
          status: "ready",
          status_message: "Ready",
          default_branch: branch,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          tech_stack: techStack as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          file_tree: fileTree as any,
          mermaid,
          description: overview.description || repo.description,
          workflow: overview.workflow,
          updated_at: new Date().toISOString(),
        })
        .eq("id", repo.id);

      return { ok: true, chunks: chunks.length, files: codeFiles.length };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await setStatus("error", message.slice(0, 500));
      throw err;
    }
  });

export const regenerateArchitecture = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ repositoryId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY!;
    const { data: repo } = await context.supabase
      .from("repositories")
      .select("*")
      .eq("id", data.repositoryId)
      .maybeSingle();
    if (!repo) throw new Error("Not found");
    const mermaid = await generateArchitectureDiagram(apiKey, {
      fileTree: repo.file_tree, techStack: repo.tech_stack, owner: repo.owner, name: repo.name,
    });
    await context.supabase.from("repositories").update({ mermaid }).eq("id", repo.id);
    return { mermaid };
  });