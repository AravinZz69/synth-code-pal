import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listRepositoriesTool from "./tools/list-repositories";
import searchCodeTool from "./tools/search-code";
import getFileTool from "./tools/get-file";
import getArchitectureTool from "./tools/get-architecture";

// The OAuth issuer MUST be the direct Supabase host (not the .lovable.cloud proxy).
// Vite inlines VITE_SUPABASE_PROJECT_ID at build time.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "codespace-mcp",
  title: "CodeSpace",
  version: "0.1.0",
  instructions:
    "Tools for querying CodeSpace: list the user's connected GitHub repositories, run semantic code search, fetch a file, or read the generated architecture, workflow, and description.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listRepositoriesTool, searchCodeTool, getFileTool, getArchitectureTool],
});