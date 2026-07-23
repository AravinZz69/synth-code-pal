// Converts a newline-separated workflow (numbered/bulleted lines) into a colored
// Mermaid top-down flowchart with the same look-and-feel as the architecture diagram.

const NODE_COLORS: { fill: string; stroke: string; text: string }[] = [
  { fill: "#dbeafe", stroke: "#3b82f6", text: "#1e3a8a" }, // blue
  { fill: "#e0e7ff", stroke: "#6366f1", text: "#312e81" }, // indigo
  { fill: "#ede9fe", stroke: "#8b5cf6", text: "#4c1d95" }, // violet
  { fill: "#cffafe", stroke: "#06b6d4", text: "#164e63" }, // cyan
  { fill: "#fef3c7", stroke: "#f59e0b", text: "#78350f" }, // amber
  { fill: "#fce7f3", stroke: "#ec4899", text: "#831843" }, // pink
  { fill: "#d1fae5", stroke: "#10b981", text: "#064e3b" }, // emerald
  { fill: "#f1f5f9", stroke: "#64748b", text: "#0f172a" }, // slate
];

function escapeLabel(s: string) {
  return s.replace(/"/g, "'").replace(/\n/g, " ").slice(0, 90);
}

export function workflowToMermaid(workflowText: string): string | null {
  const steps = workflowText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((raw) => raw.replace(/^\d+[.)]\s*/, "").replace(/^[-*•]\s*/, ""));
  if (steps.length === 0) return null;

  const lines: string[] = ["flowchart TD"];
  steps.forEach((step, i) => {
    const [head] = step.split(/[:—-]\s+/);
    const title = escapeLabel(head || step);
    lines.push(`  N${i}["${i + 1}. ${title}"]`);
  });
  for (let i = 0; i < steps.length - 1; i++) {
    lines.push(`  N${i} --> N${i + 1}`);
  }
  steps.forEach((_step, i) => {
    const c = NODE_COLORS[i % NODE_COLORS.length];
    lines.push(`  classDef c${i} fill:${c.fill},stroke:${c.stroke},color:${c.text},stroke-width:1.5px,rx:6,ry:6;`);
    lines.push(`  class N${i} c${i};`);
  });
  return lines.join("\n");
}