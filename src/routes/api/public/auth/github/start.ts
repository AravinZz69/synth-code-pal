import { createFileRoute } from "@tanstack/react-router";
import { randomBytes } from "node:crypto";

export const Route = createFileRoute("/api/public/auth/github/start")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const clientId = process.env.GITHUB_CLIENT_ID;
        if (!clientId) {
          return new Response(
            "GitHub OAuth is not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET.",
            { status: 500 },
          );
        }
        const url = new URL(request.url);
        const redirectAfter = url.searchParams.get("redirect") ?? "/repos";
        const state = randomBytes(24).toString("hex");
        // Cookie carries state + post-login redirect
        const payload = `${state}|${redirectAfter}`;
        const callback = `${url.origin}/api/public/auth/github/callback`;
        const authorize = new URL("https://github.com/login/oauth/authorize");
        authorize.searchParams.set("client_id", clientId);
        authorize.searchParams.set("redirect_uri", callback);
        authorize.searchParams.set("scope", "read:user user:email repo");
        authorize.searchParams.set("state", state);
        authorize.searchParams.set("allow_signup", "true");
        return new Response(null, {
          status: 302,
          headers: {
            Location: authorize.toString(),
            "Set-Cookie": `gh_oauth=${encodeURIComponent(payload)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
          },
        });
      },
    },
  },
});