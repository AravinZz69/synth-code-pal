import { createFileRoute, Link } from "@tanstack/react-router";
import { Code2, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold">
            <Code2 className="h-5 w-5" />
            <span>Talk to Code</span>
          </div>
          <Link
            to="/auth"
            className="rounded-md bg-primary text-primary-foreground px-4 py-1.5 text-sm font-medium hover:opacity-90"
          >
            Sign in
          </Link>
        </div>
      </header>

      <section className="flex-1 mx-auto w-full max-w-3xl px-6 pt-28 pb-20">
        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-foreground">
          Chat with any GitHub repository.
        </h1>
        <p className="mt-5 text-base text-muted-foreground max-w-xl leading-relaxed">
          Talk to Code indexes your codebase and gives you semantic search, architecture diagrams,
          documentation, and debugging — all in one clean workspace.
        </p>
        <div className="mt-8 flex items-center gap-3">
          <Link
            to="/auth"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90"
          >
            Get started <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/auth"
            className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Sign in
          </Link>
        </div>
      </section>

      <footer className="border-t border-border py-5 text-center text-xs text-muted-foreground">
        Built for engineers.
      </footer>
    </div>
  );
}
