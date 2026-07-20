import { createFileRoute, Outlet, redirect, Link, useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Code2, LogOut, GitBranch } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthedLayout,
  errorComponent: ({ error }) => (
    <div className="p-8 text-destructive">Error: {error.message}</div>
  ),
});

function AuthedLayout() {
  const { user } = Route.useRouteContext();
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(user.email ?? null);
  useEffect(() => setEmail(user.email ?? null), [user.email]);

  async function signOut() {
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card/40 backdrop-blur">
        <div className="mx-auto max-w-7xl px-6 h-14 flex items-center justify-between">
          <Link to="/repos" className="flex items-center gap-2 font-semibold">
            <Code2 className="h-5 w-5 text-primary" />
            <span>Talk to Code</span>
          </Link>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link to="/repos" className="hover:text-foreground flex items-center gap-1.5">
              <GitBranch className="h-4 w-4" /> Repos
            </Link>
            <span className="font-mono text-xs">{email}</span>
            <button
              onClick={signOut}
              className="flex items-center gap-1.5 rounded-md px-2 py-1 hover:bg-secondary"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1"><Outlet /></main>
    </div>
  );
}