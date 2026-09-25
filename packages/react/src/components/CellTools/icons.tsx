import React from "react";

/**
 * Icons of the cell tools, as sprite symbols (the toolbar's Button and
 * Combo take a symbol id). Rendered next to each toolbar item, so the
 * symbols exist wherever the item is (toolbar or its More menu).
 */
export const CellToolsIcons: React.FC = () => (
  <svg
    width="0"
    height="0"
    style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
    aria-hidden="true"
    focusable="false"
  >
    <symbol id="fortune-cell-checkbox" viewBox="0 0 24 24">
      <rect
        x="5"
        y="5"
        width="14"
        height="14"
        rx="2.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M8.5 12.2l2.4 2.4 4.8-5.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </symbol>
    <symbol id="fortune-cell-data-tools" viewBox="0 0 24 24">
      <rect
        x="4"
        y="5"
        width="13"
        height="12"
        rx="1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M4 9h13M8.5 5v12" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M17.5 12.5l-2.2 4h2.6l-1.6 4 4.2-5.2h-2.6l1.6-2.8z"
        fill="currentColor"
      />
    </symbol>
  </svg>
);
