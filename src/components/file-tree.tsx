import { useState } from "react";
import { ChevronRight, File as FileIcon, Folder } from "lucide-react";

export interface FileNode {
  name: string;
  path: string;
  type: "file" | "dir";
  children?: FileNode[];
}

export function FileTree({ nodes, onSelect, selected }: {
  nodes: FileNode[];
  onSelect: (path: string) => void;
  selected?: string;
}) {
  return (
    <ul className="text-sm font-mono">
      {nodes.map((n) => (
        <TreeItem key={n.path} node={n} onSelect={onSelect} selected={selected} depth={0} />
      ))}
    </ul>
  );
}

function TreeItem({ node, onSelect, selected, depth }: {
  node: FileNode;
  onSelect: (path: string) => void;
  selected?: string;
  depth: number;
}) {
  const [open, setOpen] = useState(depth < 1);
  const pad = { paddingLeft: `${depth * 12 + 8}px` };
  if (node.type === "dir") {
    return (
      <li>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          style={pad}
          className="w-full flex items-center gap-1.5 py-1 hover:bg-secondary/50 text-left"
        >
          <ChevronRight className={`h-3 w-3 transition-transform ${open ? "rotate-90" : ""}`} />
          <Folder className="h-3.5 w-3.5 text-accent" />
          <span className="truncate">{node.name}</span>
        </button>
        {open && node.children && (
          <ul>
            {node.children.map((c) => (
              <TreeItem key={c.path} node={c} onSelect={onSelect} selected={selected} depth={depth + 1} />
            ))}
          </ul>
        )}
      </li>
    );
  }
  const isSel = selected === node.path;
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(node.path)}
        style={pad}
        className={`w-full flex items-center gap-1.5 py-1 hover:bg-secondary/50 text-left ${isSel ? "bg-secondary text-primary" : ""}`}
      >
        <FileIcon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="truncate">{node.name}</span>
      </button>
    </li>
  );
}