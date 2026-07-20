import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";

function makeUserClient(token: string) {
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient<Database>(process.env.SUPABASE_URL!, key, {
    global: {
      headers: { Authorization: `Bearer ${token}` },
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        const token = auth.replace(/^Bearer\s+/i, "");
        if (!token) return new Response("Unauthorized", { status: 401 });

        const body = (await request.json()) as {
          messages?: UIMessage[];
          repositoryId?: string;
        };
        if (!Array.isArray(body.messages) || !body.repositoryId) {
          return new Response("Bad request", { status: 400 });
        }

        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const supabase = makeUserClient(token);

        const { data: repo } = await supabase
          .from("repositories")
          .select("owner, name, tech_stack, mermaid")
          .eq("id", body.repositoryId)
          .maybeSingle();
        if (!repo) return new Response("Repository not found", { status: 404 });

        // Extract the latest user message for retrieval.
        const lastUser = [...body.messages].reverse().find((m) => m.role === "user");
        const queryText = lastUser?.parts
          ?.map((p) => (p.type === "text" ? p.text : ""))
          .join(" ")
          .trim() ?? "";

        let contextBlock = "";
        const sources: { path: string; start_line: number; end_line: number }[] = [];
        if (queryText) {
          const embRes = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
            body: JSON.stringify({ model: "google/gemini-embedding-2", input: queryText }),
          });
          if (embRes.ok) {
            const embJson = (await embRes.json()) as { data: { embedding: number[] }[] };
            const { data: matches } = await supabase.rpc("match_chunks", {
              p_repository_id: body.repositoryId,
              query_embedding: embJson.data[0].embedding as unknown as string,
              match_count: 8,
            });
            for (const m of matches ?? []) {
              sources.push({ path: m.path, start_line: m.start_line ?? 0, end_line: m.end_line ?? 0 });
              contextBlock += `\n--- ${m.path}:${m.start_line}-${m.end_line} ---\n${m.content}\n`;
            }
          }
        }

        const system = `You are Talk to Code, an expert assistant for the GitHub repository ${repo.owner}/${repo.name}.
Use the retrieved code snippets below to answer the user's question. Cite files as \`path:lineStart-lineEnd\`.
If the answer isn't in the snippets, say so and suggest which files might contain it.

Tech stack: ${JSON.stringify(repo.tech_stack)}

Retrieved context:
${contextBlock || "(no matching code found — answer from general knowledge and say so)"}
`;

        const gateway = createLovableAiGatewayProvider(apiKey);
        const result = streamText({
          model: gateway("openai/gpt-5.4"),
          system,
          messages: await convertToModelMessages(body.messages),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: body.messages,
          headers: { "X-Sources": JSON.stringify(sources).slice(0, 4000) },
        });
      },
    },
  },
});