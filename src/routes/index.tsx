import { createFileRoute, Link } from "@tanstack/react-router";
import { Code2, GitBranch, MessageSquare, Sparkles, Search, Wrench, FileText, Rocket } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold">
            <Code2 className="h-5 w-5 text-primary" />
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

      <section className="mx-auto max-w-4xl px-6 pt-24 pb-16 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground font-mono">
          <Sparkles className="h-3 w-3 text-primary" />
          AI-powered code intelligence
        </div>
        <h1 className="mt-6 text-5xl md:text-6xl font-bold tracking-tight">
          Turn any GitHub repo into an <span className="text-primary">AI knowledge base</span>
        </h1>
        <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
          Talk to Code auto-analyzes your codebase, draws its architecture, and lets you chat with it —
          semantic search, code generation, debugging, docs, and deployment guides in one place.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            to="/auth"
            className="rounded-md bg-primary text-primary-foreground px-5 py-2.5 text-sm font-medium hover:opacity-90"
          >
            Get started free
          </Link>
          <a
            href="#features"
            className="rounded-md border border-border px-5 py-2.5 text-sm font-medium hover:bg-secondary"
          >
            See what it does
          </a>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-6 py-16 grid gap-6 md:grid-cols-3">
        {[
          { icon: GitBranch, title: "Auto architecture", desc: "Instant Mermaid diagrams and file structure the moment you connect a repo." },
          { icon: Search, title: "Semantic search", desc: "Embeddings + pgvector let you find code by meaning, not just keywords." },
          { icon: MessageSquare, title: "Chat with your code", desc: "Ask questions and get answers with citations back to exact file lines." },
          { icon: Wrench, title: "Debug faster", desc: "Paste a stack trace and get a root-cause explanation with a fix." },
          { icon: FileText, title: "Docs on demand", desc: "Generate professional README-style docs from the actual code." },
          { icon: Rocket, title: "Deploy guide", desc: "Step-by-step deployment tailored to your detected stack." },
        ].map((f) => (
          <div key={f.title} className="rounded-lg border border-border bg-card p-5">
            <f.icon className="h-6 w-6 text-primary" />
            <h3 className="mt-3 font-semibold">{f.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
          </div>
        ))}
      </section>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground font-mono">
        Built for developers. Free & open.
      </footer>
    </div>
  );
}
