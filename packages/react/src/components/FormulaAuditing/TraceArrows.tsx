import React, { useContext } from "react";
import {
  Context,
  formulaAuditLocale,
  getTraceArrows,
  qualifiedCellAddress,
  TraceArrow,
} from "@lofcz/tinysheet-core";
import WorkbookContext from "../../context";

type Freeze = {
  horizontal?: { freezenhorizontaldata?: number[] };
  vertical?: { freezenverticaldata?: number[] };
};

type Pt = { x: number; y: number };

/** Cell bounds in sheet content coordinates (null when off the sheet). */
function cellBox(ctx: Context, r: number, c: number) {
  const rows = ctx.visibledatarow;
  const cols = ctx.visibledatacolumn;
  if (r < 0 || c < 0 || r >= rows.length || c >= cols.length) return null;
  return {
    x0: c === 0 ? 0 : cols[c - 1],
    x1: cols[c],
    y0: r === 0 ? 0 : rows[r - 1],
    y1: rows[r],
  };
}

/**
 * Content coordinates -> coordinates in the visible cell area, following
 * the scroll position; frozen rows / columns stay put.
 */
function toView(
  ctx: Context,
  freeze: Freeze | undefined,
  x: number,
  y: number,
  r: number,
  c: number
): Pt {
  const fv = freeze?.vertical?.freezenverticaldata;
  const fh = freeze?.horizontal?.freezenhorizontaldata;
  return {
    x: fv && c < fv[1] ? x - fv[2] : x - ctx.scrollLeft,
    y: fh && r < fh[1] ? y - fh[2] : y - ctx.scrollTop,
  };
}

function center(
  ctx: Context,
  freeze: Freeze | undefined,
  r: number,
  c: number
) {
  const b = cellBox(ctx, r, c);
  if (!b) return null;
  return toView(ctx, freeze, (b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, r, c);
}

function arrowHead(from: Pt, to: Pt, size = 8) {
  const a = Math.atan2(to.y - from.y, to.x - from.x);
  const p1 = {
    x: to.x - size * Math.cos(a - Math.PI / 7),
    y: to.y - size * Math.sin(a - Math.PI / 7),
  };
  const p2 = {
    x: to.x - size * Math.cos(a + Math.PI / 7),
    y: to.y - size * Math.sin(a + Math.PI / 7),
  };
  return `${to.x},${to.y} ${p1.x},${p1.y} ${p2.x},${p2.y}`;
}

/** Worksheet icon marking a reference to another sheet. */
const SheetMark: React.FC<{ at: Pt; title: string }> = ({ at, title }) => (
  <g
    className="fortune-trace-sheet"
    transform={`translate(${at.x - 9}, ${at.y - 7})`}
  >
    <title>{title}</title>
    <rect width="18" height="14" rx="1.5" />
    <path d="M0 5h18M0 9.5h18M6 0v14M12 0v14" />
  </g>
);

/**
 * Trace Precedents / Dependents arrows (SVG over the cell area), drawn from
 * `ctx.traceArrows`; follows scrolling, zoom and frozen panes.
 */
const TraceArrows: React.FC = () => {
  const { context, refs } = useContext(WorkbookContext);
  const arrows = context.traceArrows ? getTraceArrows(context) : [];
  if (arrows.length === 0) return null;
  const t = formulaAuditLocale(context).auditing;
  const sheetId = context.currentSheetId;
  const freeze = refs.globalCache.freezen?.[sheetId] as Freeze | undefined;
  const zoom = context.zoomRatio || 1;
  const offset = { x: 44 * zoom, y: 28 * zoom };

  const items = arrows.map((a: TraceArrow, i: number) => {
    const key = `${a.kind}-${i}`;
    const cls = `fortune-trace-arrow${a.error ? " fortune-trace-error" : ""}`;
    const fromHere = a.from.sheetId === sheetId;
    const toHere = a.to.sheetId === sheetId;
    const [r0, r1] = a.from.row;
    const [c0, c1] = a.from.column;
    if (fromHere && toHere) {
      const start = center(context, freeze, r0, c0);
      const end = center(context, freeze, a.to.r, a.to.c);
      if (!start || !end) return null;
      let box: React.ReactNode = null;
      if (r1 > r0 || c1 > c0) {
        const tl = cellBox(context, r0, c0);
        const br = cellBox(
          context,
          Math.min(r1, context.visibledatarow.length - 1),
          Math.min(c1, context.visibledatacolumn.length - 1)
        );
        if (tl && br) {
          const p0 = toView(context, freeze, tl.x0, tl.y0, r0, c0);
          const p1 = toView(context, freeze, br.x1, br.y1, r1, c1);
          box = (
            <rect
              className="fortune-trace-range"
              x={p0.x + 1}
              y={p0.y + 1}
              width={Math.max(0, p1.x - p0.x - 2)}
              height={Math.max(0, p1.y - p0.y - 2)}
            />
          );
        }
      }
      return (
        <g key={key} className={cls} data-kind={a.kind}>
          {box}
          <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} />
          <circle cx={start.x} cy={start.y} r={3} />
          <polygon points={arrowHead(start, end)} />
        </g>
      );
    }
    // one end on another sheet: dashed arrow to / from a worksheet icon
    const cell = toHere ? a.to : { r: r0, c: c0 };
    const at = center(context, freeze, cell.r, cell.c);
    if (!at) return null;
    const icon = {
      x: Math.max(12, at.x + (toHere ? -offset.x : offset.x)),
      y: Math.max(10, at.y - offset.y),
    };
    const other = toHere
      ? qualifiedCellAddress(context, a.from.sheetId, r0, c0)
      : qualifiedCellAddress(context, a.to.sheetId, a.to.r, a.to.c);
    const start = toHere ? icon : at;
    const end = toHere ? at : icon;
    return (
      <g
        key={key}
        className={`${cls} fortune-trace-external`}
        data-kind={a.kind}
      >
        <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} />
        {!toHere && <circle cx={start.x} cy={start.y} r={3} />}
        <polygon points={arrowHead(start, end)} />
        <SheetMark at={icon} title={`${t.otherSheet}: ${other}`} />
      </g>
    );
  });

  return (
    <svg
      className="fortune-trace-arrows"
      data-testid="trace-arrows"
      style={{
        left: context.scrollLeft,
        top: context.scrollTop,
        width: context.cellmainWidth,
        height: context.cellmainHeight,
      }}
      aria-hidden="true"
    >
      {items}
    </svg>
  );
};

export default TraceArrows;
