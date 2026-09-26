import React, { CSSProperties } from "react";
import { getIcon, ICON_STROKE } from "./ui/icons";

type Props = {
  name: string;
  width?: number;
  height?: number;
  style?: CSSProperties;
};

/**
 * A named icon. Names mapped to a lucide icon (ui/icons.tsx) draw that
 * icon, sized for the box the caller asked for (a 24px sprite box holds a
 * 16px glyph); the others use the sprite in SVGDefines.
 */
const SVGIcon: React.FC<Props> = ({ width = 24, height = 24, name, style }) => {
  const Lucide = getIcon(name);
  if (Lucide) {
    const box = Math.min(width, height);
    const size = box >= 20 ? 16 : Math.max(8, box - 2);
    return (
      <Lucide
        size={size}
        strokeWidth={ICON_STROKE}
        style={style}
        className="ts-icon"
        aria-hidden="true"
        focusable="false"
      />
    );
  }
  return (
    <svg width={width} height={height} style={style} aria-hidden="true">
      <use xlinkHref={`#${name}`} />
    </svg>
  );
};

export default SVGIcon;
