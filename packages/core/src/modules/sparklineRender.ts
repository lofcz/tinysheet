/**
 * Sparkline values and drawing.
 *
 * `computeSparkline` reads a sparkline's data (skipping hidden rows and
 * columns unless the group shows them, applying the empty-cell option and
 * the optional date axis) and the vertical axis bounds (per sparkline, the
 * same for the whole group, or custom). Results are cached per group and
 * reused until a sheet the group reads from changes (a recalculation or an
 * edit gives the sheet's cell matrix a new identity).
 *
 * `drawSparkline` paints one sparkline into a cell box; it is registered as
 * the background phase of a cell decorator, so the cell's text still draws
 * over it.
 */
import type { Context } from "../context";
import type { Cell, CellMatrix, Sheet } from "../types";
import { getCanvasTheme, resolveCellTextColor } from "../theme";
import { peek } from "./dependencyGraph";
import { registerCellDecorator } from "./extensions";
import {
  DEFAULT_SPARKLINE_LINE_WEIGHT,
  parseSparklineRange,
  Sparkline,
  SparklineColorKey,
  sparklineAt,
  sparklineColor,
  SparklineGroup,
  SparklineRange,
} from "./sparkline";

export type SparklinePoint = {
  /** Horizontal position 0..1 (left to right as plotted). */
  x: number;
  /** null: a gap. */
  v: number | null;
};

export type ComputedSparkline = {
  points: SparklinePoint[];
  /** Data extremes of this sparkline (NaN when it has no numbers). */
  dataMin: number;
  dataMax: number;
  /** Vertical axis bounds used for plotting. */
  min: number;
  max: number;
};

type SheetLike = Pick<Context, "luckysheetfile" | "currentSheetId"> & {
  config?: Context["config"];
};

/* -------------------------------------------------------------------------- */
/*                                Reading data                                */
/* -------------------------------------------------------------------------- */

function sheetOf(ctx: SheetLike, id: string): Sheet | undefined {
  const files = peek(ctx.luckysheetfile) ?? [];
  for (let i = 0; i < files.length; i += 1) {
    const s = peek(files[i]);
    if (s?.id === id) return s;
  }
  return undefined;
}

const celldataCache = new WeakMap<object, Map<number, Cell>>();

/** Cell reader for a sheet, loaded (`data`) or not (`celldata`). */
function cellReader(sheet: Sheet | undefined) {
  const data = peek(sheet?.data) as CellMatrix | undefined;
  if (data) return (r: number, c: number) => peek(peek(data[r])?.[c]);
  const celldata = sheet?.celldata;
  if (!celldata?.length) return () => null;
  let map = celldataCache.get(celldata);
  if (!map) {
    map = new Map();
    celldata.forEach((item) => {
      if (item?.v && typeof item.v === "object") {
        map!.set(item.r * 16384 + item.c, item.v as Cell);
      }
    });
    celldataCache.set(celldata, map);
  }
  const m = map;
  return (r: number, c: number) => m.get(r * 16384 + c) ?? null;
}

/** The numeric value of a cell, or null (empty, text, logical, error). */
export function sparklineCellNumber(cell: Cell | null | undefined) {
  if (cell == null) return null;
  const { v } = cell;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim() !== "") {
    const t = cell.ct?.t;
    if (t === "n" || t === "d") {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    }
  }
  return null;
}

function hiddenOf(ctx: SheetLike, sheet: Sheet | undefined) {
  const config =
    sheet?.id === ctx.currentSheetId && ctx.config ? ctx.config : sheet?.config;
  return {
    rows: peek(config?.rowhidden) ?? null,
    cols: peek(config?.colhidden) ?? null,
  };
}

/**
 * The values of a (one-dimensional) range in order; cells in hidden rows
 * and columns are left out unless `displayHidden`.
 */
export function readSparklineValues(
  ctx: SheetLike,
  range: SparklineRange,
  displayHidden?: boolean
): (number | null)[] {
  const sheet = sheetOf(ctx, range.sheetId);
  const read = cellReader(sheet);
  const hidden = displayHidden
    ? { rows: null, cols: null }
    : hiddenOf(ctx, sheet);
  const out: (number | null)[] = [];
  const total =
    (range.row[1] - range.row[0] + 1) * (range.column[1] - range.column[0] + 1);
  if (total > 100000) return out;
  for (let r = range.row[0]; r <= range.row[1]; r += 1) {
    if (hidden.rows && hidden.rows[r] != null) continue;
    for (let c = range.column[0]; c <= range.column[1]; c += 1) {
      if (hidden.cols && hidden.cols[c] != null) continue;
      out.push(sparklineCellNumber(read(r, c)));
    }
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/*                                 Computing                                  */
/* -------------------------------------------------------------------------- */

type RawSparkline = {
  values: (number | null)[];
  /** Dates of the points (date axis), aligned with `values`. */
  dates: (number | null)[] | null;
};

function rawSparkline(
  ctx: Context | SheetLike,
  group: SparklineGroup,
  sparkline: Sparkline,
  hostSheetId: string,
  dates: (number | null)[] | null
): RawSparkline {
  const range = parseSparklineRange(ctx as Context, sparkline.f, hostSheetId);
  if (!range) return { values: [], dates: null };
  let values = readSparklineValues(ctx, range, group.displayHidden);
  if (group.displayEmptyCellsAs === "zero") {
    values = values.map((v) => (v == null ? 0 : v));
  }
  return {
    values,
    dates: dates && dates.length === values.length ? dates : null,
  };
}

function extent(values: (number | null)[]) {
  let min = Infinity;
  let max = -Infinity;
  values.forEach((v) => {
    if (v == null) return;
    if (v < min) min = v;
    if (v > max) max = v;
  });
  return min <= max ? { min, max } : { min: NaN, max: NaN };
}

function toPoints(raw: RawSparkline, group: SparklineGroup): SparklinePoint[] {
  const n = raw.values.length;
  let points: SparklinePoint[];
  if (raw.dates) {
    const ds = raw.dates;
    const { min, max } = extent(ds);
    points = [];
    raw.values.forEach((v, i) => {
      const d = ds[i];
      if (d == null || Number.isNaN(min)) return;
      points.push({ x: max === min ? 0.5 : (d - min) / (max - min), v });
    });
    points.sort((a, b) => a.x - b.x);
  } else {
    points = raw.values.map((v, i) => ({
      x: n <= 1 ? 0.5 : i / (n - 1),
      v,
    }));
  }
  if (group.rightToLeft) {
    points = points.map((p) => ({ x: 1 - p.x, v: p.v })).reverse();
  }
  return points;
}

type GroupCache = {
  deps: unknown[];
  items: ComputedSparkline[];
};

const groupCache = new WeakMap<SparklineGroup, GroupCache>();

const depIdsCache = new WeakMap<SparklineGroup, string[]>();

/** Ids of the sheets a group reads from. */
function groupSheetIds(
  ctx: SheetLike,
  group: SparklineGroup,
  hostSheetId: string
) {
  const cached = depIdsCache.get(group);
  if (cached) return cached;
  const ids = new Set<string>();
  const add = (ref: string | undefined) => {
    if (!ref) return;
    const m = /^(?:'((?:[^']|'')+)'|([^!]+))!/.exec(ref);
    if (!m) {
      ids.add(hostSheetId);
      return;
    }
    const name = (m[1] != null ? m[1].replace(/''/g, "'") : m[2]).toLowerCase();
    const files = peek(ctx.luckysheetfile) ?? [];
    const sheet = files.find((s) => peek(s)?.name?.toLowerCase() === name);
    if (sheet?.id) ids.add(sheet.id);
  };
  group.sparklines.forEach((s) => add(s.f));
  add(group.dateAxis);
  const list = Array.from(ids).sort();
  depIdsCache.set(group, list);
  return list;
}

/** What a group's values depend on: the cells and hidden rows it reads. */
function groupDeps(ctx: SheetLike, group: SparklineGroup, hostSheetId: string) {
  // the options the values depend on (groups edited in place keep their
  // identity outside immer)
  const deps: unknown[] = [
    peek(ctx.luckysheetfile).length,
    group.sparklines,
    group.displayEmptyCellsAs,
    group.displayHidden,
    group.rightToLeft,
    group.dateAxis,
    group.minAxisType,
    group.maxAxisType,
    group.manualMin,
    group.manualMax,
  ];
  groupSheetIds(ctx, group, hostSheetId).forEach((id) => {
    const sheet = sheetOf(ctx, id);
    deps.push(
      id,
      peek(sheet?.data) ?? peek(sheet?.celldata),
      sheet?.name,
      peek(id === ctx.currentSheetId && ctx.config ? ctx.config : sheet?.config)
    );
  });
  return deps;
}

const sameDeps = (a: unknown[], b: unknown[]) =>
  a.length === b.length && a.every((v, i) => v === b[i]);

/** Compute every sparkline of a group (cached). */
export function computeSparklineGroup(
  ctx: Context | SheetLike,
  group: SparklineGroup,
  hostSheetId: string
): ComputedSparkline[] {
  const g = peek(group);
  const deps = groupDeps(ctx, g, hostSheetId);
  const cached = groupCache.get(g);
  if (cached && sameDeps(cached.deps, deps)) return cached.items;

  let dates: (number | null)[] | null = null;
  if (g.dateAxis) {
    const range = parseSparklineRange(ctx as Context, g.dateAxis, hostSheetId);
    if (range) dates = readSparklineValues(ctx, range, g.displayHidden);
  }
  const raws = g.sparklines.map((s) =>
    rawSparkline(ctx, g, peek(s), hostSheetId, dates)
  );
  const extents = raws.map((raw) => extent(raw.values));
  let groupMin = Infinity;
  let groupMax = -Infinity;
  extents.forEach((e) => {
    if (e.min < groupMin) groupMin = e.min;
    if (e.max > groupMax) groupMax = e.max;
  });
  const items = raws.map((raw, i) => {
    const e = extents[i];
    let { min, max } = e;
    if (g.minAxisType === "group" && groupMin <= groupMax) min = groupMin;
    if (g.maxAxisType === "group" && groupMin <= groupMax) max = groupMax;
    if (g.minAxisType === "custom" && Number.isFinite(g.manualMin)) {
      min = g.manualMin as number;
    }
    if (g.maxAxisType === "custom" && Number.isFinite(g.manualMax)) {
      max = g.manualMax as number;
    }
    return {
      points: toPoints(raw, g),
      dataMin: e.min,
      dataMax: e.max,
      min,
      max,
    };
  });
  groupCache.set(g, { deps, items });
  return items;
}

/** The computed sparkline at (r, c) of `sheetId`, if there is one. */
export function computeSparklineAt(
  ctx: Context,
  sheetId: string,
  r: number,
  c: number
) {
  const hit = sparklineAt(ctx, sheetId, r, c);
  if (!hit) return null;
  const items = computeSparklineGroup(ctx, hit.group, sheetId);
  return { ...hit, computed: items[hit.index] };
}

/* -------------------------------------------------------------------------- */
/*                                  Drawing                                   */
/* -------------------------------------------------------------------------- */

export type SparklineBox = { x: number; y: number; w: number; h: number };

/**
 * The colour of point `i` (value `v`): Excel's precedence, the later rule
 * wins (markers < negative < low < high < first < last). Null: no marker
 * (lines) / the series colour (bars).
 */
export function sparklinePointRole(
  group: SparklineGroup,
  sp: ComputedSparkline,
  i: number
): SparklineColorKey | null {
  const { v } = sp.points[i];
  if (v == null) return null;
  let role: SparklineColorKey | null = null;
  if (group.markers && group.type === "line") role = "markers";
  if (group.negative && v < 0) role = "negative";
  if (group.low && v === sp.dataMin) role = "low";
  if (group.high && v === sp.dataMax) role = "high";
  if (group.first || group.last) {
    let firstI = -1;
    let lastI = -1;
    sp.points.forEach((p, k) => {
      if (p.v == null) return;
      if (firstI < 0) firstI = k;
      lastI = k;
    });
    if (group.first && i === firstI) role = "first";
    if (group.last && i === lastI) role = "last";
  }
  return role;
}

/**
 * Draw one sparkline into `box` (canvas pixels, zoom applied). `color`
 * maps a group colour to the one painted (theme adaptation).
 */
export function drawSparkline(
  rc: CanvasRenderingContext2D,
  group: SparklineGroup,
  sp: ComputedSparkline,
  box: SparklineBox,
  zoom = 1,
  color: (c: string) => string = (c) => c
) {
  const { points } = sp;
  if (points.length === 0 || box.w < 4 || box.h < 4) return;
  const colorOf = (key: SparklineColorKey) => color(sparklineColor(group, key));
  const inset = Math.max(1, Math.round(2 * zoom));
  rc.save();
  rc.beginPath();
  rc.rect(box.x, box.y, box.w, box.h);
  rc.clip();

  if (group.type === "line") {
    const lw = Math.max(
      0.5,
      (group.lineWeight ?? DEFAULT_SPARKLINE_LINE_WEIGHT) * (4 / 3) * zoom
    );
    const mr = Math.max(1.5, 1.6 * zoom + lw * 0.4);
    const left = box.x + inset + mr;
    const right = box.x + box.w - inset - mr;
    const top = box.y + inset + mr;
    const bottom = box.y + box.h - inset - mr;
    if (right <= left || bottom <= top) {
      rc.restore();
      return;
    }
    const { min, max } = sp;
    const yOf = (v: number) =>
      max === min || !Number.isFinite(max - min)
        ? (top + bottom) / 2
        : bottom - ((v - min) / (max - min)) * (bottom - top);
    const xOf = (x: number) => left + x * (right - left);

    if (group.displayXAxis && min < 0 && max > 0) {
      const ay = Math.round(yOf(0)) + 0.5;
      rc.strokeStyle = colorOf("axis");
      rc.lineWidth = 1;
      rc.beginPath();
      rc.moveTo(box.x + inset, ay);
      rc.lineTo(box.x + box.w - inset, ay);
      rc.stroke();
    }

    const connect = group.displayEmptyCellsAs === "span";
    rc.strokeStyle = colorOf("series");
    rc.lineWidth = lw;
    rc.lineJoin = "round";
    rc.lineCap = "round";
    rc.beginPath();
    let open = false;
    let lone: number[] = [];
    let run = 0;
    points.forEach((p, i) => {
      if (p.v == null) {
        if (!connect) {
          if (run === 1) lone.push(i - 1);
          open = false;
          run = 0;
        }
        return;
      }
      const x = xOf(p.x);
      const y = yOf(p.v);
      if (!open) {
        rc.moveTo(x, y);
        open = true;
        run = 1;
      } else {
        rc.lineTo(x, y);
        run += 1;
      }
    });
    rc.stroke();
    if (run === 1) lone.push(points.length - 1);
    // an isolated point between gaps still shows as a dot
    lone = lone.filter((i) => i >= 0 && points[i]?.v != null);
    rc.fillStyle = colorOf("series");
    lone.forEach((i) => {
      rc.beginPath();
      rc.arc(xOf(points[i].x), yOf(points[i].v as number), lw, 0, Math.PI * 2);
      rc.fill();
    });

    points.forEach((p, i) => {
      if (p.v == null) return;
      const role = sparklinePointRole(group, sp, i);
      if (!role) return;
      rc.fillStyle = colorOf(role);
      rc.beginPath();
      rc.arc(xOf(p.x), yOf(p.v), mr, 0, Math.PI * 2);
      rc.fill();
    });
    rc.restore();
    return;
  }

  // column and win/loss bars
  const left = box.x + inset;
  const width = box.w - inset * 2;
  const top = box.y + inset;
  const bottom = box.y + box.h - inset;
  if (width <= 0 || bottom <= top) {
    rc.restore();
    return;
  }
  const n = points.length;
  const slot = width / n;
  const gap = Math.min(slot * 0.3, Math.max(1, zoom));
  const barW = Math.max(1, slot - gap);
  const isDate =
    !!group.dateAxis && points.some((p, i) => i > 0 && p.x !== i / (n - 1));
  const barLeft = (i: number, x: number) =>
    isDate ? left + x * (width - barW) : left + slot * i + (slot - barW) / 2;
  const minH = Math.max(1, zoom);

  let axisY: number | null = null;
  if (group.type === "winloss") {
    // wins fill the upper half, losses the lower half
    const mid = Math.round((top + bottom) / 2);
    if (group.displayXAxis) axisY = mid + 0.5;
    points.forEach((p, i) => {
      if (p.v == null || p.v === 0) return;
      const role = sparklinePointRole(group, sp, i);
      rc.fillStyle = colorOf(role ?? "series");
      if (p.v > 0)
        rc.fillRect(barLeft(i, p.x), top, barW, Math.max(minH, mid - top));
      else
        rc.fillRect(
          barLeft(i, p.x),
          mid + 1,
          barW,
          Math.max(minH, bottom - mid - 1)
        );
    });
  } else {
    const { min, max } = sp;
    const span = max - min;
    const flat = span === 0 || !Number.isFinite(span);
    const yOf = (v: number) =>
      flat ? (top + bottom) / 2 : bottom - ((v - min) / span) * (bottom - top);
    // bars grow from 0, or from the axis end nearest to 0
    let base: number;
    if (min <= 0 && max >= 0) base = 0;
    else base = min > 0 ? min : max;
    if (group.displayXAxis && min < 0 && max > 0) {
      axisY = Math.round(yOf(0)) + 0.5;
    }
    const by = flat ? bottom : yOf(base);
    points.forEach((p, i) => {
      if (p.v == null) return;
      const role = sparklinePointRole(group, sp, i);
      rc.fillStyle = colorOf(role ?? "series");
      const vy = flat ? top : yOf(p.v);
      let y0 = Math.min(by, vy);
      let h = Math.abs(by - vy);
      if (h < minH && p.v !== 0) {
        h = minH;
        y0 = p.v < base ? by : by - h;
      }
      if (h <= 0) return;
      rc.fillRect(barLeft(i, p.x), y0, barW, h);
    });
  }
  if (axisY != null) {
    rc.strokeStyle = colorOf("axis");
    rc.lineWidth = 1;
    rc.beginPath();
    rc.moveTo(left, axisY);
    rc.lineTo(left + width, axisY);
    rc.stroke();
  }
  rc.restore();
}

/* -------------------------------------------------------------------------- */
/*                               Cell decorator                               */
/* -------------------------------------------------------------------------- */

/** Draw the sparkline located at (r, c) of the current sheet, if any. */
function drawCellSparkline(args: {
  ctx: Context;
  renderCtx: CanvasRenderingContext2D;
  r: number;
  c: number;
  cell: Cell | null | undefined;
  x: number;
  y: number;
  w: number;
  h: number;
  zoom: number;
}) {
  const { ctx } = args;
  const sheetId = ctx.currentSheetId;
  const hit = computeSparklineAt(ctx, sheetId, args.r, args.c);
  if (!hit?.computed) return;
  const dark = getCanvasTheme(ctx) !== getCanvasTheme("light");
  const bg = args.cell?.bg ?? null;
  const color = dark
    ? (c: string) => resolveCellTextColor(ctx, c, bg)
    : (c: string) => c;
  drawSparkline(
    args.renderCtx,
    hit.group,
    hit.computed,
    { x: args.x, y: args.y, w: args.w, h: args.h },
    args.zoom,
    color
  );
}

let uninstall: (() => void) | null = null;

/** Register the sparkline cell decorator (idempotent). */
export function installSparklineRenderer() {
  if (uninstall) return;
  uninstall = registerCellDecorator("sparkline", {
    drawBackground: drawCellSparkline,
  });
}

installSparklineRenderer();
