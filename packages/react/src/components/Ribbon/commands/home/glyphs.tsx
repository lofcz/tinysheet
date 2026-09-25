/**
 * Home tab glyphs lucide has no equivalent for (border variants, double
 * underline, text orientation, comma style), drawn on lucide's 24px grid
 * with its stroke so they sit with the other chrome icons. Each one is a
 * drop-in for a lucide component (`<Icon icon={BorderBottom} />`).
 */
import React from "react";
import type { LucideIcon } from "../../../ui";

type GlyphProps = {
  size?: number;
  strokeWidth?: number;
  className?: string;
  style?: React.CSSProperties;
};

function glyph(name: string, body: React.ReactNode): LucideIcon {
  const C = ({
    size = 16,
    strokeWidth = 1.75,
    className,
    style,
  }: GlyphProps) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
      focusable="false"
    >
      {body}
    </svg>
  );
  C.displayName = name;
  return C as unknown as LucideIcon;
}

/** The faint cell grid every border glyph is drawn over. */
const grid = (
  <g opacity={0.5} strokeDasharray="1 2.6" strokeWidth={1.5}>
    <rect x="4" y="4" width="16" height="16" rx="0.5" />
    <path d="M12 4v16M4 12h16" />
  </g>
);

const EDGE = {
  top: "M4 4h16",
  bottom: "M4 20h16",
  left: "M4 4v16",
  right: "M20 4v16",
  insideH: "M4 12h16",
  insideV: "M12 4v16",
};

const border = (name: string, ...extra: React.ReactNode[]) =>
  glyph(
    name,
    <>
      {grid}
      {extra}
    </>
  );

const edge = (d: string, key: string, width?: number) => (
  <path key={key} d={d} strokeWidth={width} strokeLinecap="square" />
);

export const BorderBottom = border("BorderBottom", edge(EDGE.bottom, "b"));
export const BorderTop = border("BorderTop", edge(EDGE.top, "t"));
export const BorderLeft = border("BorderLeft", edge(EDGE.left, "l"));
export const BorderRight = border("BorderRight", edge(EDGE.right, "r"));
export const BorderNone = border("BorderNone");
export const BorderAll = glyph(
  "BorderAll",
  <path
    d="M4 4h16v16H4zM12 4v16M4 12h16"
    strokeLinecap="square"
    strokeLinejoin="miter"
  />
);
export const BorderOutside = border(
  "BorderOutside",
  <rect key="o" x="4" y="4" width="16" height="16" strokeLinejoin="miter" />
);
export const BorderThickBox = border(
  "BorderThickBox",
  <rect
    key="o"
    x="4.5"
    y="4.5"
    width="15"
    height="15"
    strokeWidth={3}
    strokeLinejoin="miter"
  />
);
export const BorderInside = border(
  "BorderInside",
  edge(EDGE.insideH, "h"),
  edge(EDGE.insideV, "v")
);
export const BorderBottomDouble = border(
  "BorderBottomDouble",
  edge("M4 17.5h16", "b1", 1.5),
  edge("M4 21h16", "b2", 1.5)
);
export const BorderBottomThick = border(
  "BorderBottomThick",
  edge("M4 19.5h16", "b", 3)
);
export const BorderTopBottom = border(
  "BorderTopBottom",
  edge(EDGE.top, "t"),
  edge(EDGE.bottom, "b")
);
export const BorderTopThickBottom = border(
  "BorderTopThickBottom",
  edge(EDGE.top, "t"),
  edge("M4 19.5h16", "b", 3)
);
export const BorderTopDoubleBottom = border(
  "BorderTopDoubleBottom",
  edge(EDGE.top, "t"),
  edge("M4 17.5h16", "b1", 1.5),
  edge("M4 21h16", "b2", 1.5)
);
export const BorderDiagonal = border("BorderDiagonal", edge("M4 4l16 16", "d"));

/** A line-style sample (Line Style submenu), `width` px wide. */
export const LineSample: React.FC<{
  dash?: string;
  width?: number;
  thickness?: number;
  double?: boolean;
}> = ({ dash, width = 96, thickness = 1, double }) => (
  <svg width={width} height={12} aria-hidden="true" focusable="false">
    {double ? (
      <>
        <line x1={0} x2={width} y1={4.5} y2={4.5} stroke="currentColor" />
        <line x1={0} x2={width} y1={7.5} y2={7.5} stroke="currentColor" />
      </>
    ) : (
      <line
        x1={0}
        x2={width}
        y1={6}
        y2={6}
        stroke="currentColor"
        strokeWidth={thickness}
        strokeDasharray={dash}
      />
    )}
  </svg>
);

export const DoubleUnderline = glyph(
  "DoubleUnderline",
  <>
    <path d="M6 3v5.5a6 6 0 0 0 12 0V3" />
    <path d="M4 17.5h16" />
    <path d="M4 21h16" />
  </>
);

/** A letter on a slant over an arrow: Excel's Orientation button. */
export const Orientation = glyph(
  "Orientation",
  <>
    <g transform="rotate(-45 10 11)">
      <path d="m6 15 4-9 4 9" />
      <path d="M7.4 12h5.2" />
    </g>
    <path d="M13 20h7" />
    <path d="m17.5 17.5 2.5 2.5-2.5 2.5" />
  </>
);

/** Letters stacked downwards: Vertical Text. */
export const VerticalText = glyph(
  "VerticalText",
  <>
    <path d="M9 4h4" />
    <path d="M9 10.5h4" />
    <path d="M9 17h4" />
    <path d="M18 4v16" />
    <path d="m15.5 17.5 2.5 2.5 2.5-2.5" />
  </>
);

/** A large comma: Comma Style. */
export const CommaStyle = glyph(
  "CommaStyle",
  <>
    <circle cx="11.5" cy="10.5" r="2.5" fill="currentColor" stroke="none" />
    <path d="M14 10.5c0 3.8-1.6 6.6-4.8 8.5" />
  </>
);

/** One wide cell with arrows to both sides: Merge Across. */
export const MergeAcross = glyph(
  "MergeAcross",
  <>
    <rect x="3" y="6" width="18" height="12" rx="1.5" />
    <path d="M7 12h10" />
    <path d="m9 10-2 2 2 2" />
    <path d="m15 10 2 2-2 2" />
  </>
);

/** One big cell over the dashed grid it replaces: Merge Cells. */
export const MergeCells = glyph(
  "MergeCells",
  <>
    <rect x="3" y="4" width="18" height="16" rx="1.5" />
    <path
      d="M12 4v4M12 16v4M3 12h4M17 12h4"
      opacity={0.45}
      strokeDasharray="1 2.4"
    />
  </>
);
