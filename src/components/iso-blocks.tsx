import { type CSSProperties } from "react";

/**
 * Isometric cube decoration primitives.
 * Variants: "tower" | "staircase" | "cluster" | "cross" | "mini"
 * Palette: "blue" | "violet" | "cyan" | "mixed"
 */

type Palette = "blue" | "violet" | "cyan" | "mixed";
type Variant = "tower" | "staircase" | "cluster" | "cross" | "mini";

const PALETTES: Record<Palette, { top: string; left: string; right: string }[]> = {
  blue: [
    { top: "#7BC5FF", left: "#2F6BE0", right: "#3E86F5" },
    { top: "#6EE7F0", left: "#0FA3B1", right: "#22C5D1" },
  ],
  violet: [
    { top: "#B9A6FF", left: "#4C3AB8", right: "#6B54DB" },
    { top: "#7BC5FF", left: "#2F6BE0", right: "#3E86F5" },
  ],
  cyan: [
    { top: "#8CF0E4", left: "#0E9C93", right: "#1FC3B4" },
    { top: "#7BC5FF", left: "#2F6BE0", right: "#3E86F5" },
  ],
  mixed: [
    { top: "#7BC5FF", left: "#2F6BE0", right: "#3E86F5" },
    { top: "#6EE7F0", left: "#0FA3B1", right: "#22C5D1" },
    { top: "#B9A6FF", left: "#4C3AB8", right: "#6B54DB" },
  ],
};

function Cube({
  x,
  y,
  s = 1,
  colors,
  floatClass,
}: {
  x: number;
  y: number;
  s?: number;
  colors: { top: string; left: string; right: string };
  floatClass?: string;
}) {
  const w = 34.64 * s;
  const h = 20 * s;
  const depth = 40 * s;
  return (
    <g className={floatClass} transform={`translate(${x},${y})`}>
      <polygon
        points={`0,${-h} ${w},0 0,${h} ${-w},0`}
        fill={colors.top}
        stroke="#0F172A"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <polygon
        points={`${-w},0 0,${h} 0,${h + depth} ${-w},${depth}`}
        fill={colors.left}
        stroke="#0F172A"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <polygon
        points={`${w},0 0,${h} 0,${h + depth} ${w},${depth}`}
        fill={colors.right}
        stroke="#0F172A"
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </g>
  );
}

function positions(variant: Variant): { x: number; y: number; s?: number }[] {
  switch (variant) {
    case "tower":
      // inspired by the reference image — stacked figure-8 tower
      return [
        { x: 60, y: 240 },
        { x: 130, y: 240 },
        { x: 25, y: 220 },
        { x: 95, y: 220 },
        { x: 165, y: 220 },
        { x: 60, y: 180 },
        { x: 130, y: 180 },
        { x: 95, y: 160 },
        { x: 60, y: 120 },
        { x: 130, y: 120 },
        { x: 25, y: 100 },
        { x: 95, y: 100 },
        { x: 60, y: 60 },
        { x: 130, y: 60 },
      ];
    case "staircase":
      return [
        { x: 30, y: 220 },
        { x: 30, y: 180 },
        { x: 80, y: 180 },
        { x: 80, y: 140 },
        { x: 130, y: 140 },
        { x: 130, y: 100 },
        { x: 180, y: 100 },
      ];
    case "cluster":
      return [
        { x: 90, y: 200 },
        { x: 50, y: 180 },
        { x: 130, y: 180 },
        { x: 90, y: 160 },
        { x: 90, y: 110 },
        { x: 160, y: 90, s: 0.6 },
      ];
    case "cross":
      return [
        { x: 100, y: 200 },
        { x: 100, y: 160 },
        { x: 60, y: 160 },
        { x: 140, y: 160 },
        { x: 100, y: 120 },
      ];
    case "mini":
    default:
      return [
        { x: 40, y: 100, s: 0.7 },
        { x: 90, y: 100, s: 0.7 },
        { x: 65, y: 70, s: 0.7 },
      ];
  }
}

const FLOATS = ["iso-float-a", "iso-float-b", "iso-float-c"];

export function IsoBlock({
  variant = "tower",
  palette = "mixed",
  width = 220,
  height = 300,
  className = "",
  style,
  animated = true,
}: {
  variant?: Variant;
  palette?: Palette;
  width?: number;
  height?: number;
  className?: string;
  style?: CSSProperties;
  animated?: boolean;
}) {
  const cubes = positions(variant);
  const colors = PALETTES[palette];
  return (
    <svg
      aria-hidden
      width={width}
      height={height}
      viewBox="0 0 220 300"
      className={className}
      style={style}
    >
      {/* soft ground shadow */}
      <ellipse cx="110" cy="278" rx="80" ry="8" fill="#0F172A" opacity="0.06" />
      {cubes.map((c, i) => (
        <Cube
          key={i}
          x={c.x}
          y={c.y}
          s={c.s ?? 1}
          colors={colors[i % colors.length]}
          floatClass={animated ? FLOATS[i % FLOATS.length] : undefined}
        />
      ))}
    </svg>
  );
}