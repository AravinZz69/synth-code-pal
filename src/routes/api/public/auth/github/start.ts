import { createFileRoute } from "@tanstack/react-router";
import { randomBytes } from "node:crypto";

const CANONICAL_AUTH_ORIGIN = "https://synth-code-pal.lovable.app";

function cleanRedirectPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/repos";
  return value;
}

function getAuthOrigin() {
  return (process.env.GITHUB_OAUTH_ORIGIN ?? CANONICAL_AUTH_ORIGIN).replace(/\/$/, "");
}

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
        const redirectAfter = cleanRedirectPath(url.searchParams.get("redirect"));
        const authOrigin = getAuthOrigin();

        if (url.origin !== authOrigin) {
          const canonicalStart = new URL("/api/public/auth/github/start", authOrigin);
          canonicalStart.searchParams.set("redirect", redirectAfter);
          return new Response(null, {
            status: 302,
            headers: { Location: canonicalStart.toString() },
          });
        }

        const state = randomBytes(24).toString("hex");
        // Cookie carries state + post-login redirect
        const payload = `${state}|${redirectAfter}`;
        const callback = `${authOrigin}/api/public/auth/github/callback`;
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