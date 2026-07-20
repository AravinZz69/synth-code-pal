import { useEffect, useRef, useState } from "react";

let counter = 0;

export function MermaidDiagram({ code }: { code: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState<string | null>(null);
  const idRef = useRef(`mmd-${++counter}`);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "neutral",
          themeVariables: {
            background: "#ffffff",
            primaryColor: "#f5f5f7",
            primaryTextColor: "#1a1a1a",
            primaryBorderColor: "#d4d4d8",
            lineColor: "#9ca3af",
            fontFamily: "'Inter', sans-serif",
          },
          securityLevel: "loose",
        });
        const { svg } = await mermaid.render(idRef.current, code);
        if (!cancelled && ref.current) ref.current.innerHTML = svg;
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Failed to render");
      }
    })();
    return () => { cancelled = true; };
  }, [code]);

  if (err) return <pre className="text-xs text-destructive whitespace-pre-wrap">{err}</pre>;
  return <div ref={ref} className="overflow-x-auto flex justify-center [&>svg]:max-w-full" />;
}