import React from "react";
import {
  arrowHeadPath,
  presetOutline,
  Shape,
  ShapeDash,
  ShapeText,
} from "@lofcz/tinysheet-core";
import { alignToCss, DEFAULT_FONT_SIZE, runStyle } from "./richText";

/** DrawingML default text insets: 0.1" left/right, 0.05" top/bottom. */
export const TEXT_INSET = { x: 9.6, y: 4.8 };

const DASHES: Record<ShapeDash, number[] | null> = {
  solid: null,
  dash: [4, 3],
  dot: [1, 1],
  dashDot: [4, 3, 1, 3],
  lgDash: [8, 3],
  sysDash: [3, 1],
  sysDot: [1, 1],
};

export function dashArray(dash: ShapeDash | undefined, width: number) {
  const pattern = dash ? DASHES[dash] : null;
  if (!pattern) return undefined;
  return pattern.map((n) => n * Math.max(1, width)).join(" ");
}

export function defaultTextColor(shape: Shape) {
  return shape.textBox || !shape.fill ? "#000000" : "#FFFFFF";
}

type Props = {
  shape: Shape;
  /** Unzoomed box size. */
  width: number;
  height: number;
  zoom: number;
  /** Rendered instead of the static text (the text editor). */
  editor?: React.ReactNode;
};

/** The static text of a shape (paragraphs of styled runs). */
export const ShapeTextBody: React.FC<{ text: ShapeText }> = ({ text }) => (
  <>
    {text.paragraphs.map((p, i) => (
      <div
        // paragraphs have no identity beyond their position
        // eslint-disable-next-line react/no-array-index-key
        key={i}
        className="fortune-shape-paragraph"
        style={{ textAlign: alignToCss(p.align) }}
      >
        {p.runs.some((r) => r.text !== "") ? (
          p.runs.map((r, j) => (
            // eslint-disable-next-line react/no-array-index-key
            <span key={j} style={runStyle(r)}>
              {r.text}
            </span>
          ))
        ) : (
          <br />
        )}
      </div>
    ))}
  </>
);

/**
 * Draws one shape in its (unrotated) box: the preset outline as SVG with
 * fill, outline, arrow heads and shadow, and the text on top. Rotation and
 * placement are applied by the caller.
 */
const ShapeView: React.FC<Props> = ({ shape, width, height, zoom, editor }) => {
  const w = Math.max(width, 0);
  const h = Math.max(height, 0);
  const outline = presetOutline(shape.prst, w, h, shape.adj);
  const { line, fill } = shape;
  const lineWidth = line ? Math.max(0.5, line.width) : 0;
  const flip =
    shape.flipH || shape.flipV
      ? `translate(${shape.flipH ? w : 0},${shape.flipV ? h : 0}) scale(${
          shape.flipH ? -1 : 1
        },${shape.flipV ? -1 : 1})`
      : undefined;
  const heads: string[] = [];
  if (outline.open && outline.ends && line) {
    if (line.head && line.head !== "none")
      heads.push(arrowHeadPath(outline.ends.start, lineWidth));
    if (line.tail && line.tail !== "none")
      heads.push(arrowHeadPath(outline.ends.end, lineWidth));
  }
  const { text } = shape;
  const hasText =
    !!editor ||
    (!!text && text.paragraphs.some((p) => p.runs.some((r) => r.text)));
  const tr = outline.text;
  const anchor = text?.anchor ?? (shape.textBox ? "t" : "ctr");
  const justify = { t: "flex-start", ctr: "center", b: "flex-end" }[anchor];
  const color = text?.defaults?.color ?? defaultTextColor(shape);
  return (
    <>
      <svg
        className="fortune-shape-svg"
        width={Math.max(1, w * zoom)}
        height={Math.max(1, h * zoom)}
        aria-hidden="true"
        style={
          shape.shadow
            ? { filter: "drop-shadow(2px 2px 2px rgba(0, 0, 0, 0.4))" }
            : undefined
        }
      >
        <g transform={zoom !== 1 ? `scale(${zoom})` : undefined}>
          <g transform={flip}>
            <path
              className="fortune-shape-geometry"
              d={outline.d}
              fill={!outline.open && fill ? fill.color : "none"}
              fillOpacity={
                fill?.transparency ? 1 - fill.transparency : undefined
              }
              stroke={line ? line.color : "none"}
              strokeWidth={lineWidth}
              strokeDasharray={dashArray(line?.dash, lineWidth)}
              strokeLinejoin="round"
              pointerEvents={outline.open ? "none" : "all"}
            />
            {heads.map((d) => (
              <path key={d} d={d} fill={line!.color} stroke="none" />
            ))}
            {outline.open && (
              <path
                className="fortune-shape-hit"
                d={outline.d}
                fill="none"
                stroke="transparent"
                strokeWidth={Math.max(8, lineWidth + 6) / zoom}
                pointerEvents="stroke"
              />
            )}
          </g>
        </g>
      </svg>
      {!outline.open && hasText && (
        <div
          className="fortune-shape-text"
          style={{
            left: tr.x * zoom,
            top: tr.y * zoom,
            width: Math.max(0, tr.w),
            height: Math.max(0, tr.h),
            transform: zoom !== 1 ? `scale(${zoom})` : undefined,
            justifyContent: justify,
            padding: `${TEXT_INSET.y}px ${TEXT_INSET.x}px`,
            fontSize: `${(DEFAULT_FONT_SIZE * 4) / 3}px`,
            whiteSpace: text?.wrap === false ? "pre" : "pre-wrap",
            ...runStyle(text?.defaults ?? {}),
            color,
          }}
        >
          {editor ?? (text ? <ShapeTextBody text={text} /> : null)}
        </div>
      )}
    </>
  );
};

export default ShapeView;
