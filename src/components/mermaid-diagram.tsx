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
          theme: "dark",
          themeVariables: {
            background: "#0f1517",
            primaryColor: "#1a2226",
            primaryTextColor: "#e8eef1",
            primaryBorderColor: "#38b48b",
            lineColor: "#556",
            fontFamily: "'Space Grotesk', sans-serif",
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