import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Code2,
  ArrowRight,
  FolderGit2,
  Network,
  Search,
  Sparkles,
  Bug,
  FileText,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

const features = [
  {
    icon: FolderGit2,
    title: "Repository Analysis",
    description:
      "Connect any GitHub repository and get an instant breakdown of its structure, stack, and dependencies.",
  },
  {
    icon: Network,
    title: "Architecture Generation",
    description:
      "Auto-generated diagrams that map out modules, data flow, and how the pieces of your codebase fit together.",
  },
  {
    icon: Search,
    title: "Semantic Search",
    description:
      "Ask questions in plain English and jump straight to the functions, files, and snippets that matter.",
  },
  {
    icon: Sparkles,
    title: "Code Generation",
    description:
      "Generate new components, utilities, and refactors that follow the conventions already in your repo.",
  },
  {
    icon: Bug,
    title: "Debugging Assistant",
    description:
      "Paste an error or stack trace and get grounded fixes with links back to the relevant source lines.",
  },
  {
    icon: FileText,
    title: "Documentation Generator",
    description:
      "Turn your codebase into clean, human-readable docs for onboarding, handoffs, and internal wikis.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-background">
        <div className="mx-auto max-w-6xl px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-semibold text-foreground">
            <Code2 className="h-5 w-5" />
            <span>Talk to Code</span>
          </Link>
          <nav className="hidden md:flex items-center gap-7 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">
              Features
            </a>
            <a
              href="https://docs.github.com"
              target="_blank"
              rel="noreferrer"
              className="hover:text-foreground transition-colors"
            >
              Documentation
            </a>
          </nav>
          <Link
            to="/auth"
            className="rounded-md bg-primary text-primary-foreground px-4 py-1.5 text-sm font-medium hover:opacity-90"
          >
            GitHub Login
          </Link>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <IsoDecor side="left" />
        <IsoDecor side="right" />
        <div className="relative mx-auto w-full max-w-3xl px-6 pt-24 pb-20 text-center">
        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-foreground">
          Talk to Code
        </h1>
        <p className="mt-5 text-lg text-foreground/80 max-w-2xl mx-auto leading-relaxed">
          Understand, search, debug, and document any GitHub repository using AI.
        </p>
        <p className="mt-4 text-sm text-muted-foreground max-w-xl mx-auto leading-relaxed">
          Connect a repository and interact with your codebase through natural conversation —
          explore architecture, find code, generate changes, and produce documentation in one place.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            to="/auth"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90"
          >
            Get Started <ArrowRight className="h-4 w-4" />
          </Link>
          <a
            href="#features"
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            View Demo
          </a>
        </div>
        </div>
      </section>

      <section id="features" className="border-t border-border bg-muted/30">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="rounded-lg border border-border bg-background p-5 hover:border-foreground/20 transition-colors"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-muted/50">
                  <Icon className="h-4.5 w-4.5 text-foreground" />
                </div>
                <h3 className="mt-4 text-sm font-semibold text-foreground">{title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-5 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Talk to Code
      </footer>
    </div>
  );
}

function IsoDecor({ side }: { side: "left" | "right" }) {
  const isLeft = side === "left";
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute top-1/2 -translate-y-1/2 hidden md:block ${
        isLeft ? "left-0 lg:left-6" : "right-0 lg:right-6"
      }`}
    >
      <svg
        width="260"
        height="320"
        viewBox="0 0 260 320"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="opacity-70 lg:opacity-80"
      >
        <defs>
          <g id={`iso-cube-${side}`}>
            {/* isometric cube: top, left, right */}
            <polygon
              points="0,-20 34.64,0 0,20 -34.64,0"
              fill="var(--iso-top)"
              stroke="var(--iso-stroke)"
              strokeWidth="1"
            />
            <polygon
              points="-34.64,0 0,20 0,60 -34.64,40"
              fill="var(--iso-left)"
              stroke="var(--iso-stroke)"
              strokeWidth="1"
            />
            <polygon
              points="34.64,0 0,20 0,60 34.64,40"
              fill="var(--iso-right)"
              stroke="var(--iso-stroke)"
              strokeWidth="1"
            />
          </g>
        </defs>

        {isLeft ? (
          <g>
            {/* stacked pyramid of cubes */}
            <g className="iso-float-a" transform="translate(80,220)">
              <use href={`#iso-cube-${side}`} />
            </g>
            <g className="iso-float-b" transform="translate(150,180)">
              <use href={`#iso-cube-${side}`} />
            </g>
            <g className="iso-float-a" transform="translate(115,160)">
              <use href={`#iso-cube-${side}`} />
            </g>
            <g className="iso-float-c" transform="translate(115,100)">
              <use href={`#iso-cube-${side}`} />
            </g>
            <g className="iso-float-b" transform="translate(45,180)">
              <use href={`#iso-cube-${side}`} />
            </g>
            {/* floating detached cube */}
            <g className="iso-float-c" transform="translate(190,90)">
              <use href={`#iso-cube-${side}`} transform="scale(0.6)" />
            </g>
            {/* connector line */}
            <line
              x1="150"
              y1="90"
              x2="185"
              y2="90"
              stroke="var(--border)"
              strokeDasharray="2 3"
            />
          </g>
        ) : (
          <g>
            {/* grid wall of small cubes */}
            {Array.from({ length: 4 }).map((_, row) =>
              Array.from({ length: 3 }).map((_, col) => {
                const delay = ((row + col) % 3) as 0 | 1 | 2;
                const cls = ["iso-float-a", "iso-float-b", "iso-float-c"][delay];
                const x = 60 + col * 55;
                const y = 60 + row * 55 + (col % 2) * 8;
                return (
                  <g
                    key={`${row}-${col}`}
                    className={cls}
                    transform={`translate(${x},${y}) scale(0.7)`}
                  >
                    <use href={`#iso-cube-${side}`} />
                  </g>
                );
              })
            )}
          </g>
        )}
      </svg>
    </div>
  );
}
