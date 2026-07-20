import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github.css";
import { generateDocumentation } from "@/lib/docs.functions";
import { Loader2, Download, RefreshCw, FileText } from "lucide-react";
import { toast } from "sonner";

export function DocsView({ repositoryId, repoLabel }: { repositoryId: string; repoLabel: string }) {
  const fn = useServerFn(generateDocumentation);
  const q = useQuery({
    queryKey: ["docs", repositoryId],
    queryFn: () => fn({ data: { repositoryId } }),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const printRef = useRef<HTMLDivElement>(null);

  const downloadPdf = async () => {
    if (!printRef.current) return;
    try {
      const html2pdf = (await import("html2pdf.js")).default as unknown as () => {
        set: (opts: Record<string, unknown>) => { from: (el: HTMLElement) => { save: () => Promise<void> } };
      };
      await html2pdf()
        .set({
          margin: [12, 12, 14, 12],
          filename: `${repoLabel.replace("/", "-")}-docs.pdf`,
          image: { type: "jpeg", quality: 0.95 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        })
        .from(printRef.current)
        .save();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "PDF export failed");
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="border-b border-border h-11 px-4 flex items-center gap-2 bg-background shrink-0">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <div className="text-sm font-medium">Documentation</div>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => q.refetch()}
            disabled={q.isFetching}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground h-7 px-2 rounded-md hover:bg-muted disabled:opacity-50"
          >
            {q.isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Regenerate
          </button>
          <button
            onClick={downloadPdf}
            disabled={!q.data?.markdown}
            className="flex items-center gap-1.5 text-xs bg-primary text-primary-foreground h-7 px-2.5 rounded-md hover:opacity-90 disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" /> Download PDF
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        {q.isLoading && (
          <div className="p-8 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Generating professional documentation…
          </div>
        )}
        {q.error && (
          <div className="p-8 text-sm text-destructive">
            {q.error instanceof Error ? q.error.message : "Failed to generate docs"}
          </div>
        )}
        {q.data?.markdown && (
          <div className="max-w-3xl mx-auto px-8 py-8">
            <div ref={printRef} className="docs-print">
              <header className="mb-8 pb-6 border-b-2" style={{ borderColor: "#6366F1" }}>
                <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1">CodeSpace · Documentation</div>
                <h1 className="text-3xl font-bold tracking-tight">{repoLabel}</h1>
              </header>
              <article className="docs-md">
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                  {q.data.markdown}
                </ReactMarkdown>
              </article>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}