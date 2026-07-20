import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Code2 } from "lucide-react";
import { toast } from "sonner";

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
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) router.navigate({ to: "/repos", replace: true });
    });
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}/repos` },
        });
        if (error) throw error;
        toast.success("Account created. You may need to confirm your email.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      router.navigate({ to: "/repos", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function signInGoogle() {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error(result.error.message ?? "Google sign-in failed");
        setLoading(false);
        return;
      }
      if (result.redirected) return;
      router.navigate({ to: "/repos", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-8">
          <Code2 className="h-6 w-6 text-primary" />
          <span className="text-lg font-semibold">Talk to Code</span>
        </div>
        <div className="rounded-xl border border-border bg-card p-6 shadow-lg">
          <h1 className="text-xl font-semibold text-center">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-1 text-center text-sm text-muted-foreground">
            {mode === "signin" ? "Sign in to explore your repos" : "Start chatting with your codebase"}
          </p>

          <button
            onClick={signInGoogle}
            disabled={loading}
            className="mt-6 w-full flex items-center justify-center gap-2 rounded-md border border-border bg-background hover:bg-secondary px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#EA4335" d="M12 5c1.617 0 3.077.554 4.226 1.641l3.157-3.156C17.508 1.716 14.966.75 12 .75 7.311.75 3.258 3.438 1.281 7.359l3.68 2.859C5.929 7.148 8.727 5 12 5z"/><path fill="#4285F4" d="M23.492 12.275c0-.816-.075-1.606-.216-2.363H12v4.472h6.436c-.278 1.497-1.122 2.767-2.396 3.617l3.68 2.858c2.145-1.98 3.772-4.902 3.772-8.584z"/><path fill="#FBBC05" d="M4.961 14.242C4.746 13.599 4.625 12.916 4.625 12s.121-1.599.336-2.242L1.28 6.899C.464 8.451 0 10.171 0 12s.464 3.549 1.281 5.101l3.68-2.859z"/><path fill="#34A853" d="M12 23.25c3.24 0 5.958-1.062 7.941-2.891l-3.68-2.858c-1.02.688-2.336 1.093-4.261 1.093-3.273 0-6.071-2.148-7.039-5.218l-3.68 2.858C3.258 20.562 7.311 23.25 12 23.25z"/></svg>
            Continue with Google
          </button>

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> or <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={onSubmit} className="space-y-3">
            <input
              type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <input
              type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="submit" disabled={loading}
              className="w-full rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "…" : mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>

          <button
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground"
          >
            {mode === "signin" ? "Don't have an account? Sign up" : "Already have one? Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}