import React from "react";
import {
  arrowHeadPath,
  presetOutline,
  ShapeGalleryItem,
} from "@lofcz/tinysheet-core";

/** Small picture of a gallery item. */
export const ShapePresetIcon: React.FC<{ item: ShapeGalleryItem }> = ({
  item,
}) => {
  if (item.textBox) {
    return (
      <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
        <rect
          x="2.5"
          y="3.5"
          width="17"
          height="15"
          fill="none"
          stroke="currentColor"
        />
        <path
          d="M7 15 L11 6 L15 15 M8.6 12 H13.4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
        />
      </svg>
    );
  }
  const line = item.category === "lines";
  const w = 16;
  const h = line ? 16 : 13;
  const outline = presetOutline(item.prst, w, h);
  const heads: string[] = [];
  if (outline.ends) {
    if (item.head) heads.push(arrowHeadPath(outline.ends.start, 1));
    if (item.tail) heads.push(arrowHeadPath(outline.ends.end, 1));
  }
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
      <g transform={`translate(3,${line ? 3 : 4.5})`}>
        <path
          d={outline.d}
          fill={outline.open ? "none" : "currentColor"}
          fillOpacity={outline.open ? undefined : 0.18}
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        {heads.map((d) => (
          <path key={d} d={d} fill="currentColor" />
        ))}
      </g>
    </svg>
  );
};
