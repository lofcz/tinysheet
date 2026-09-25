import React, { useContext } from "react";
import { locale } from "@lofcz/tinysheet-core";
import type { BorderLine, FormatCellsState } from "@lofcz/tinysheet-core";
import WorkbookContext from "../../context";

export type EdgeKey =
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "insideH"
  | "insideV";

/** Border edits: `none` clears first, then each edited edge is applied. */
export type BorderDraft = {
  none: boolean;
  edges: Partial<Record<EdgeKey, BorderLine | null>>;
  /** Line style and colour new edges get. */
  line: BorderLine;
};

/** Line styles, with how the preview draws them. */
const LINE_STYLES: { style: string; width: number; dash?: string }[] = [
  { style: "2", width: 1, dash: "1 2" },
  { style: "3", width: 1, dash: "2 2" },
  { style: "6", width: 1, dash: "8 2 2 2 2 2" },
  { style: "5", width: 1, dash: "8 2 2 2" },
  { style: "4", width: 1, dash: "4 2" },
  { style: "1", width: 1 },
  { style: "11", width: 2, dash: "8 2 2 2 2 2" },
  { style: "12", width: 2, dash: "8 2 3 2" },
  { style: "10", width: 2, dash: "8 2 2 2" },
  { style: "9", width: 2, dash: "6 3" },
  { style: "8", width: 2 },
  { style: "13", width: 3 },
  { style: "7", width: 1 },
];

function lineStyle(style: string | undefined) {
  return LINE_STYLES.find((s) => s.style === style) ?? LINE_STYLES[5];
}

/** An SVG line in a border style ("7" double is drawn as two lines). */
const StyledLine: React.FC<{
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  line: BorderLine;
}> = ({ x1, y1, x2, y2, line }) => {
  const s = lineStyle(line.style);
  if (line.style === "7") {
    const horizontal = y1 === y2;
    const dx = horizontal ? 0 : 1.5;
    const dy = horizontal ? 1.5 : 0;
    return (
      <g stroke={line.color} strokeWidth={1}>
        <line x1={x1 - dx} y1={y1 - dy} x2={x2 - dx} y2={y2 - dy} />
        <line x1={x1 + dx} y1={y1 + dy} x2={x2 + dx} y2={y2 + dy} />
      </g>
    );
  }
  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={line.color}
      strokeWidth={s.width}
      strokeDasharray={s.dash}
    />
  );
};

/** The edges as they will look: the active cell's, then the edits. */
export function displayedEdges(
  initial: FormatCellsState["borders"],
  draft: BorderDraft
): Record<EdgeKey, BorderLine | null> {
  const base: Record<EdgeKey, BorderLine | null> = draft.none
    ? {
        top: null,
        bottom: null,
        left: null,
        right: null,
        insideH: null,
        insideV: null,
      }
    : { ...initial, insideH: null, insideV: null };
  (Object.keys(draft.edges) as EdgeKey[]).forEach((k) => {
    base[k] = draft.edges[k] ?? null;
  });
  return base;
}

type Props = {
  initial: FormatCellsState["borders"];
  draft: BorderDraft;
  multiRow: boolean;
  multiCol: boolean;
  onChange: (draft: BorderDraft) => void;
};

const W = 180;
const H = 110;
const PAD = 14;

const BorderTab: React.FC<Props> = ({
  initial,
  draft,
  multiRow,
  multiCol,
  onChange,
}) => {
  const { context } = useContext(WorkbookContext);
  const { formatCells } = locale(context);
  const shown = displayedEdges(initial, draft);
  const { line } = draft;

  const setEdges = (edges: Partial<Record<EdgeKey, BorderLine | null>>) =>
    onChange({ ...draft, edges: { ...draft.edges, ...edges } });

  const toggle = (edge: EdgeKey) => {
    const cur = shown[edge];
    const same =
      cur &&
      cur.style === line.style &&
      cur.color.toLowerCase() === line.color.toLowerCase();
    setEdges({ [edge]: same ? null : { ...line } });
  };

  const edgeLabel: Record<EdgeKey, string> = {
    top: formatCells.borderTop,
    bottom: formatCells.borderBottom,
    left: formatCells.borderLeft,
    right: formatCells.borderRight,
    insideH: formatCells.borderInsideH,
    insideV: formatCells.borderInsideV,
  };

  const edgeButton = (edge: EdgeKey, path: string, disabled = false) => (
    <button
      type="button"
      className={`fortune-fc-edge${shown[edge] ? " on" : ""}`}
      aria-pressed={!!shown[edge]}
      aria-label={edgeLabel[edge]}
      title={edgeLabel[edge]}
      disabled={disabled}
      onClick={() => toggle(edge)}
    >
      <svg viewBox="0 0 20 20" width={20} height={20} aria-hidden="true">
        <rect
          x={3}
          y={3}
          width={14}
          height={14}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.35}
          strokeDasharray="1 2"
        />
        <path d={path} stroke="currentColor" strokeWidth={2} />
      </svg>
    </button>
  );

  const preset = (
    key: "none" | "outline" | "inside",
    label: string,
    disabled: boolean,
    paths: string
  ) => (
    <button
      type="button"
      className="fortune-fc-preset"
      disabled={disabled}
      onClick={() => {
        if (key === "none") onChange({ ...draft, none: true, edges: {} });
        else if (key === "outline")
          setEdges({ top: line, bottom: line, left: line, right: line });
        else
          setEdges({
            ...(multiRow ? { insideH: line } : {}),
            ...(multiCol ? { insideV: line } : {}),
          });
      }}
    >
      <svg viewBox="0 0 32 32" width={32} height={32} aria-hidden="true">
        <rect
          x={4}
          y={4}
          width={24}
          height={24}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.35}
          strokeDasharray="1 2"
        />
        <path d={paths} stroke="currentColor" strokeWidth={2} fill="none" />
      </svg>
      <span>{label}</span>
    </button>
  );

  const midX = W / 2;
  const midY = H / 2;

  return (
    <div className="fortune-fc-border">
      <div className="fortune-fc-column fortune-fc-border-line">
        <div className="fortune-fc-label">{formatCells.line}</div>
        <div className="fortune-fc-sublabel">{formatCells.style}:</div>
        <div
          className="fortune-fc-line-styles"
          role="listbox"
          aria-label={formatCells.style}
        >
          {LINE_STYLES.map((s) => (
            <div
              key={s.style}
              role="option"
              aria-selected={s.style === line.style}
              tabIndex={0}
              className={`fortune-fc-line-style${
                s.style === line.style ? " selected" : ""
              }`}
              onClick={() =>
                onChange({ ...draft, line: { ...line, style: s.style } })
              }
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onChange({ ...draft, line: { ...line, style: s.style } });
                }
              }}
            >
              <svg width="100%" height={10} aria-hidden="true">
                <StyledLine
                  x1={4}
                  y1={5}
                  x2={70}
                  y2={5}
                  line={{ style: s.style, color: "currentColor" }}
                />
              </svg>
            </div>
          ))}
        </div>
        <label className="fortune-fc-field" htmlFor="fortune-fc-border-1">
          <span>{formatCells.color}:</span>
          <input
            id="fortune-fc-border-1"
            type="color"
            value={line.color}
            onChange={(e) =>
              onChange({ ...draft, line: { ...line, color: e.target.value } })
            }
          />
        </label>
      </div>
      <div className="fortune-fc-column fortune-fc-grow">
        <div className="fortune-fc-label">{formatCells.presets}</div>
        <div className="fortune-fc-presets">
          {preset("none", formatCells.none, false, "")}
          {preset("outline", formatCells.outline, false, "M4 4H28V28H4Z")}
          {preset(
            "inside",
            formatCells.inside,
            !multiRow && !multiCol,
            "M16 4V28M4 16H28"
          )}
        </div>
        <div className="fortune-fc-label">{formatCells.border}</div>
        <div className="fortune-fc-border-editor">
          <div className="fortune-fc-edge-column">
            {edgeButton("top", "M3 3H17")}
            {edgeButton("insideH", "M3 10H17", !multiRow)}
            {edgeButton("bottom", "M3 17H17")}
          </div>
          <div>
            <svg
              className="fortune-fc-border-preview"
              width={W}
              height={H}
              data-testid="format-cells-border-preview"
              role="img"
              aria-label={formatCells.preview}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const near = 8;
                if (Math.abs(y - PAD) < near) toggle("top");
                else if (Math.abs(y - (H - PAD)) < near) toggle("bottom");
                else if (Math.abs(x - PAD) < near) toggle("left");
                else if (Math.abs(x - (W - PAD)) < near) toggle("right");
                else if (multiRow && Math.abs(y - midY) < near)
                  toggle("insideH");
                else if (multiCol && Math.abs(x - midX) < near)
                  toggle("insideV");
              }}
            >
              {[
                [PAD - 6, PAD, PAD, PAD, PAD, PAD - 6],
                [W - PAD + 6, PAD, W - PAD, PAD, W - PAD, PAD - 6],
                [PAD - 6, H - PAD, PAD, H - PAD, PAD, H - PAD + 6],
                [W - PAD + 6, H - PAD, W - PAD, H - PAD, W - PAD, H - PAD + 6],
              ].map((p, i) => (
                <polyline
                  key={i}
                  points={`${p[0]},${p[1]} ${p[2]},${p[3]} ${p[4]},${p[5]}`}
                  fill="none"
                  className="fortune-fc-border-corner"
                />
              ))}
              <text
                x={multiCol ? W / 4 : midX}
                y={multiRow ? H / 4 + 4 : midY + 4}
                textAnchor="middle"
                className="fortune-fc-border-text"
              >
                {formatCells.categories.text}
              </text>
              {shown.top && (
                <StyledLine
                  x1={PAD}
                  y1={PAD}
                  x2={W - PAD}
                  y2={PAD}
                  line={shown.top}
                />
              )}
              {shown.bottom && (
                <StyledLine
                  x1={PAD}
                  y1={H - PAD}
                  x2={W - PAD}
                  y2={H - PAD}
                  line={shown.bottom}
                />
              )}
              {shown.left && (
                <StyledLine
                  x1={PAD}
                  y1={PAD}
                  x2={PAD}
                  y2={H - PAD}
                  line={shown.left}
                />
              )}
              {shown.right && (
                <StyledLine
                  x1={W - PAD}
                  y1={PAD}
                  x2={W - PAD}
                  y2={H - PAD}
                  line={shown.right}
                />
              )}
              {multiRow && shown.insideH && (
                <StyledLine
                  x1={PAD}
                  y1={midY}
                  x2={W - PAD}
                  y2={midY}
                  line={shown.insideH}
                />
              )}
              {multiCol && shown.insideV && (
                <StyledLine
                  x1={midX}
                  y1={PAD}
                  x2={midX}
                  y2={H - PAD}
                  line={shown.insideV}
                />
              )}
            </svg>
            <div className="fortune-fc-edge-row">
              {edgeButton("left", "M3 3V17")}
              {edgeButton("insideV", "M10 3V17", !multiCol)}
              {edgeButton("right", "M17 3V17")}
            </div>
          </div>
        </div>
        <p className="fortune-fc-description">{formatCells.borderHint}</p>
      </div>
    </div>
  );
};

export default BorderTab;
