/**
 * Home tab glyphs lucide has no equivalent for (double underline, text
 * orientation, comma style; border glyphs are ui BorderGlyph), drawn on lucide's 24px grid
 * with its stroke so they sit with the other chrome icons. Each one is a
 * drop-in for a lucide component (`<Icon icon={DoubleUnderline} />`).
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
