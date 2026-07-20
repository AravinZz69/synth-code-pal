import { createFileRoute } from "@tanstack/react-router";
import { getAuthedUser, getAuthedUserPrimaryEmail } from "@/lib/github.server";

function parseCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

function html(msg: string, status = 400) {
  return new Response(
    `<!doctype html><meta charset="utf-8"><title>Sign in error</title><body style="font-family:system-ui;padding:40px;max-width:520px;margin:auto"><h1 style="font-size:20px">Sign in failed</h1><p style="color:#555">${msg}</p><p><a href="/auth">Back to sign in</a></p></body>`,
    { status, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

export const Route = createFileRoute("/api/public/auth/github/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const clientId = process.env.GITHUB_CLIENT_ID;
        const clientSecret = process.env.GITHUB_CLIENT_SECRET;
        if (!clientId || !clientSecret) {
          return html("GitHub OAuth is not configured on the server.", 500);
        }
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const err = url.searchParams.get("error_description") ?? url.searchParams.get("error");
        if (err) return html(`GitHub returned an error: ${err}`);
        if (!code || !state) return html("Missing OAuth code or state.");

        const cookie = parseCookie(request.headers.get("cookie"), "gh_oauth");
        if (!cookie) return html("OAuth session expired. Please try again.");
        const [cookieState, redirectAfter = "/repos"] = cookie.split("|");
        if (cookieState !== state) return html("OAuth state mismatch. Please try again.");

        // 1) Exchange code for token
        const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
          method: "POST",
          headers: { Accept: "application/json", "Content-Type": "application/json" },
          body: JSON.stringify({
            client_id: clientId,
            client_secret: clientSecret,
            code,
            redirect_uri: `${url.origin}/api/public/auth/github/callback`,
          }),
        });
        if (!tokenRes.ok) return html(`Token exchange failed (${tokenRes.status}).`);
        const tokenJson = (await tokenRes.json()) as { access_token?: string; error?: string; error_description?: string };
        if (tokenJson.error || !tokenJson.access_token) {
          return html(`GitHub: ${tokenJson.error_description ?? tokenJson.error ?? "no access token"}`);
        }
        const ghToken = tokenJson.access_token;

        // 2) Get GitHub user + email
        const ghUser = await getAuthedUser(ghToken);
        const email = ghUser.email ?? (await getAuthedUserPrimaryEmail(ghToken));
        if (!email) return html("Could not read a verified email from your GitHub account.");

        // 3) Create or fetch Supabase user, save GitHub token, mint magic link
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // generateLink creates the user if missing and returns action_link + user
        const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
          type: "magiclink",
          email,
          options: { redirectTo: `${url.origin}${redirectAfter}` },
        });
        if (linkErr || !linkData?.properties?.action_link || !linkData.user) {
          return html(`Auth error: ${linkErr?.message ?? "could not create session"}`);
        }

        // 4) Save GitHub token against Supabase user
        const { error: upsertErr } = await supabaseAdmin.from("github_tokens").upsert(
          {
            user_id: linkData.user.id,
            access_token: ghToken,
            github_login: ghUser.login,
            github_id: ghUser.id,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        );
        if (upsertErr) return html(`Could not save GitHub token: ${upsertErr.message}`);

        // 5) Redirect through Supabase verify URL — session is established, then bounces to redirectTo
        return new Response(null, {
          status: 302,
          headers: {
            Location: linkData.properties.action_link,
            "Set-Cookie": `gh_oauth=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
          },
        });
      },
    },
  },
});