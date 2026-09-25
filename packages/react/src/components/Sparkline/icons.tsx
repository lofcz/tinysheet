import React from "react";
import type { SparklineLocale, SparklineType } from "@lofcz/tinysheet-core";

export const SPARKLINE_TOOLBAR_ICON = "fortune-insert-sparkline";

export const SPARKLINE_TYPES: {
  type: SparklineType;
  label: keyof SparklineLocale;
}[] = [
  { type: "line", label: "line" },
  { type: "column", label: "column" },
  { type: "winloss", label: "winLoss" },
];

/** 24px outline icons of the three sparkline types (currentColor). */
export const SparklineTypeIcon: React.FC<{
  type: SparklineType;
  size?: number;
}> = ({ type, size = 24 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
    focusable="false"
  >
    <rect
      x="2.75"
      y="4.75"
      width="18.5"
      height="14.5"
      rx="1.5"
      stroke="currentColor"
      strokeWidth="1.2"
      opacity="0.45"
    />
    {type === "line" && (
      <path
        d="M5 15l3.5-4 3 2.5L15 8l4 4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    )}
    {type === "column" && (
      <g fill="currentColor">
        <rect x="5.5" y="11" width="2.2" height="6" />
        <rect x="9.3" y="8" width="2.2" height="9" />
        <rect x="13.1" y="12.5" width="2.2" height="4.5" />
        <rect x="16.9" y="7" width="2.2" height="10" />
      </g>
    )}
    {type === "winloss" && (
      <g fill="currentColor">
        <rect x="5.5" y="8" width="2.2" height="4" />
        <rect x="9.3" y="12" width="2.2" height="4" />
        <rect x="13.1" y="8" width="2.2" height="4" />
        <rect x="16.9" y="8" width="2.2" height="4" />
      </g>
    )}
  </svg>
);

/** The toolbar icon, as a <symbol> for SVGIcon. */
export const SparklineToolbarSymbol: React.FC = () => (
  <svg style={{ position: "absolute", width: 0, height: 0 }} aria-hidden="true">
    <defs>
      <symbol id={SPARKLINE_TOOLBAR_ICON} viewBox="0 0 24 24" fill="none">
        <rect
          x="3.75"
          y="6.75"
          width="16.5"
          height="10.5"
          rx="1.5"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M6.5 14l3-3.5 2.5 2 2.5-3.5 3 2.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </symbol>
    </defs>
  </svg>
);
