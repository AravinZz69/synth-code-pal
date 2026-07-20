import { useState } from "react";
import { ChevronDown } from "lucide-react";

export interface WorkflowStep {
  title: string;
  detail: string;
  color: "blue" | "indigo" | "violet" | "cyan" | "amber" | "pink" | "emerald" | "slate";
}

const COLOR_MAP: Record<WorkflowStep["color"], { bg: string; border: string; text: string; dot: string }> = {
  blue:    { bg: "bg-blue-50",    border: "border-blue-200",    text: "text-blue-900",    dot: "bg-blue-500" },
  indigo:  { bg: "bg-indigo-50",  border: "border-indigo-200",  text: "text-indigo-900",  dot: "bg-indigo-500" },
  violet:  { bg: "bg-violet-50",  border: "border-violet-200",  text: "text-violet-900",  dot: "bg-violet-500" },
  cyan:    { bg: "bg-cyan-50",    border: "border-cyan-200",    text: "text-cyan-900",    dot: "bg-cyan-500" },
  amber:   { bg: "bg-amber-50",   border: "border-amber-200",   text: "text-amber-900",   dot: "bg-amber-500" },
  pink:    { bg: "bg-pink-50",    border: "border-pink-200",    text: "text-pink-900",    dot: "bg-pink-500" },
  emerald: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-900", dot: "bg-emerald-500" },
  slate:   { bg: "bg-slate-50",   border: "border-slate-200",   text: "text-slate-900",   dot: "bg-slate-500" },
};

export function WorkflowDiagram({ steps }: { steps: WorkflowStep[] }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <ol className="space-y-2">
      {steps.map((step, i) => {
        const c = COLOR_MAP[step.color];
        const isOpen = open === i;
        return (
          <li key={i}>
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : i)}
              className={`w-full text-left flex items-center gap-3 rounded-lg border ${c.border} ${c.bg} px-3 py-2.5 hover:shadow-sm transition-shadow`}
            >
              <span className={`shrink-0 h-6 w-6 rounded-full ${c.dot} text-white text-[11px] font-semibold flex items-center justify-center`}>
                {i + 1}
              </span>
              <span className={`flex-1 text-sm font-medium ${c.text}`}>{step.title}</span>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </button>
            {isOpen && (
              <div className="ml-9 mt-1.5 mb-1 text-xs text-muted-foreground leading-relaxed">
                {step.detail}
              </div>
            )}
            {i < steps.length - 1 && (
              <div className="ml-6 h-3 w-px bg-border" aria-hidden />
            )}
          </li>
        );
      })}
    </ol>
  );
}