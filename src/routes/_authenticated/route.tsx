import { createFileRoute, Outlet, redirect, Link, useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Code2, LogOut } from "lucide-react";

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
      <header className="border-b border-border bg-background">
        <div className="mx-auto max-w-[1400px] px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/repos" className="flex items-center gap-2 font-semibold text-sm">
              <Code2 className="h-5 w-5" />
              <span>Talk to Code</span>
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              <Link
                to="/repos"
                className="px-2.5 py-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                activeProps={{ className: "px-2.5 py-1 rounded-md text-foreground bg-muted" }}
              >
                Repositories
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-xs text-muted-foreground hidden sm:inline">{email}</span>
            <button
              onClick={signOut}
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1"><Outlet /></main>
    </div>
  );
}