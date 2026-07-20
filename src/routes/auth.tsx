import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Code2, Github, Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — Talk to Code" },
      { name: "description", content: "Sign in to Talk to Code to connect a GitHub repo and start chatting with your code." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) router.navigate({ to: "/repos", replace: true });
    });
  }, [router]);

  function signInGithub() {
    setLoading(true);
    const url = "/api/public/auth/github/start?redirect=/repos";
    // Lovable preview runs in an iframe; GitHub sends X-Frame-Options: DENY,
    // so navigate the top-level window to avoid "refused to connect".
    try {
      if (window.top && window.top !== window.self) {
        window.top.location.href = url;
        return;
      }
    } catch {
      // cross-origin top — fall through to opening a new tab
      window.open(url, "_blank", "noopener");
      return;
    }
    window.location.href = url;
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-8">
          <Code2 className="h-6 w-6 text-primary" />
          <span className="text-lg font-semibold">Talk to Code</span>
        </div>
        <div className="rounded-xl border border-border bg-card p-6 shadow-lg">
          <h1 className="text-xl font-semibold text-center">Welcome to Talk to Code</h1>
          <p className="mt-1 text-center text-sm text-muted-foreground">
            Sign in with GitHub to browse your repositories and chat with your code.
          </p>

          <button
            onClick={signInGithub}
            disabled={loading}
            className="mt-6 w-full flex items-center justify-center gap-2 rounded-md bg-[#24292f] hover:bg-[#1b1f23] text-white px-4 py-2.5 text-sm font-medium disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Github className="h-4 w-4" />}
            Continue with GitHub
          </button>

          <p className="mt-5 text-[11px] text-center text-muted-foreground leading-relaxed">
            We request <code className="font-mono">read:user</code>, <code className="font-mono">user:email</code>, and{" "}
            <code className="font-mono">repo</code> so we can list and analyze your repositories.
          </p>
        </div>
      </div>
    </div>
  );
}