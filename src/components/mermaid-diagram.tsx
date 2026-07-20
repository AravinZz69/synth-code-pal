import { useEffect, useRef, useState } from "react";
import { Maximize2, Minimize2, ZoomIn, ZoomOut, Download, RotateCcw } from "lucide-react";

let counter = 0;

export function MermaidDiagram({ code, controls = true }: { code: string; controls?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [full, setFull] = useState(false);
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

  const download = (type: "svg" | "png") => {
    const svgEl = ref.current?.querySelector("svg");
    if (!svgEl) return;
    const clone = svgEl.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const source = new XMLSerializer().serializeToString(clone);
    if (type === "svg") {
      const blob = new Blob([source], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "architecture.svg"; a.click();
      URL.revokeObjectURL(url);
      return;
    }
    const img = new Image();
    const svg64 = btoa(unescape(encodeURIComponent(source)));
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const scale = 2;
      canvas.width = (svgEl.clientWidth || 800) * scale;
      canvas.height = (svgEl.clientHeight || 600) * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = "architecture.png"; a.click();
        URL.revokeObjectURL(url);
      }, "image/png");
    };
    img.src = `data:image/svg+xml;base64,${svg64}`;
  };

  if (err) return <pre className="text-xs text-destructive whitespace-pre-wrap">{err}</pre>;

  return (
    <div
      ref={wrapRef}
      className={
        full
          ? "fixed inset-0 z-50 bg-background flex flex-col"
          : "relative"
      }
    >
      {controls && (
        <div className={`flex items-center gap-1 ${full ? "border-b border-border px-3 h-11" : "absolute top-1 right-1 z-10 bg-background/90 backdrop-blur rounded-md border border-border p-0.5"}`}>
          <IconBtn onClick={() => setZoom((z) => Math.min(3, z + 0.2))} title="Zoom in"><ZoomIn className="h-3.5 w-3.5" /></IconBtn>
          <IconBtn onClick={() => setZoom((z) => Math.max(0.4, z - 0.2))} title="Zoom out"><ZoomOut className="h-3.5 w-3.5" /></IconBtn>
          <IconBtn onClick={() => setZoom(1)} title="Reset"><RotateCcw className="h-3.5 w-3.5" /></IconBtn>
          <div className="w-px h-4 bg-border mx-0.5" />
          <IconBtn onClick={() => download("svg")} title="Export SVG"><Download className="h-3.5 w-3.5" /></IconBtn>
          <IconBtn onClick={() => download("png")} title="Export PNG"><span className="text-[10px] font-medium px-1">PNG</span></IconBtn>
          <div className="w-px h-4 bg-border mx-0.5" />
          <IconBtn onClick={() => setFull((v) => !v)} title={full ? "Exit fullscreen" : "Fullscreen"}>
            {full ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </IconBtn>
        </div>
      )}
      <div className={full ? "flex-1 overflow-auto p-6" : "overflow-auto"}>
        <div
          ref={ref}
          className="flex justify-center [&>svg]:max-w-full origin-top transition-transform"
          style={{ transform: `scale(${zoom})` }}
        />
      </div>
    </div>
  );
}

function IconBtn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="h-6 min-w-6 px-1 inline-flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted"
    >
      {children}
    </button>
  );
}