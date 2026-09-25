/**
 * Excel's Insert… / Delete… for a cell range: insert blank cells shifting the
 * existing ones right or down, or delete cells shifting the rest left or up.
 *
 * Moves cell objects (values, styles, notes), merges that lie inside the
 * shifted band, hyperlinks, data validation and the calc chain, and rewrites
 * A1 references in every formula of the workbook that points into the
 * shifted band (references to deleted cells become `#REF!`), then recalculates.
 *
 * Not adjusted yet: conditional-format and filter ranges.
 */
import _ from "lodash";
import { Context } from "../context";
import { CellMatrix, Sheet } from "../types";
import { columnCharToIndex, getSheetIndex, indexToColumnChar } from "../utils";
import { invalidateDependencyGraph, recalculate } from "./formulaHelper";

export type InsertCellsDirection = "right" | "down";
export type DeleteCellsDirection = "left" | "up";

export type CellRect = { row: number[]; column: number[] };

type Shift = {
  kind: "insert" | "delete";
  /** "col": cells move along a row (right/left); "row": along a column. */
  axis: "col" | "row";
  r1: number;
  r2: number;
  c1: number;
  c2: number;
  n: number;
};

const MAX_ROWS = 10000;
const MAX_COLS = 1000;

function makeShift(
  kind: Shift["kind"],
  axis: Shift["axis"],
  range: CellRect
): Shift {
  const r1 = Math.min(range.row[0], range.row[1]);
  const r2 = Math.max(range.row[0], range.row[1]);
  const c1 = Math.min(range.column[0], range.column[1]);
  const c2 = Math.max(range.column[0], range.column[1]);
  const n = axis === "col" ? c2 - c1 + 1 : r2 - r1 + 1;
  return { kind, axis, r1, r2, c1, c2, n };
}

/** New position of the cell at (r, c); null when the cell is deleted. */
export function mapShiftedPosition(
  s: Shift,
  r: number,
  c: number
): [number, number] | null {
  if (s.axis === "col") {
    if (r < s.r1 || r > s.r2) return [r, c];
    if (s.kind === "insert") return c >= s.c1 ? [r, c + s.n] : [r, c];
    if (c < s.c1) return [r, c];
    if (c <= s.c2) return null;
    return [r, c - s.n];
  }
  if (c < s.c1 || c > s.c2) return [r, c];
  if (s.kind === "insert") return r >= s.r1 ? [r + s.n, c] : [r, c];
  if (r < s.r1) return [r, c];
  if (r <= s.r2) return null;
  return [r - s.n, c];
}

/* ------------------------------------------------------------------------ */
/* Reference rewriting                                                      */
/* ------------------------------------------------------------------------ */

type Area = { ra: number; ca: number; rb: number; cb: number };

/** Along-axis coordinate transform for one range edge. */
function mapIndex(s: Shift, i: number, edge: "start" | "end"): number | null {
  const lo = s.axis === "col" ? s.c1 : s.r1;
  const hi = s.axis === "col" ? s.c2 : s.r2;
  if (s.kind === "insert") return i >= lo ? i + s.n : i;
  if (i < lo) return i;
  if (i > hi) return i - s.n;
  // inside the deleted span: a range edge snaps to the surviving side
  return edge === "start" ? lo : lo - 1;
}

/**
 * Transforms a referenced area. Like Excel, only areas that lie entirely in
 * the shifted band (rows for a horizontal shift, columns for a vertical one)
 * follow the cells; others are left alone. Returns null for `#REF!`.
 */
export function mapShiftedArea(s: Shift, a: Area): Area | null {
  const inBand =
    s.axis === "col"
      ? a.ra >= s.r1 && a.rb <= s.r2
      : a.ca >= s.c1 && a.cb <= s.c2;
  if (!inBand) return a;
  if (s.axis === "col") {
    const ca = mapIndex(s, a.ca, "start")!;
    const cb = mapIndex(s, a.cb, "end")!;
    if (cb < ca) return null;
    return { ...a, ca, cb };
  }
  const ra = mapIndex(s, a.ra, "start")!;
  const rb = mapIndex(s, a.rb, "end")!;
  if (rb < ra) return null;
  return { ...a, ra, rb };
}

const REF_RE =
  /((?:'(?:[^']|'')+'|[A-Za-z_¡-￿][\w.¡-￿]*)!)?(\$?)([A-Za-z]{1,3})(\$?)(\d+)(?::(\$?)([A-Za-z]{1,3})(\$?)(\d+))?/g;

function unquoteSheet(prefix: string) {
  const name = prefix.slice(0, -1);
  if (name.startsWith("'")) return name.slice(1, -1).replace(/''/g, "'");
  return name;
}

function rewriteSegment(
  text: string,
  s: Shift,
  sheetName: string,
  isHomeSheet: boolean
) {
  return text.replace(REF_RE, (match, prefix, ...rest) => {
    const offset = rest[rest.length - 2] as number;
    const full = rest[rest.length - 1] as string;
    const before = offset > 0 ? full[offset - 1] : "";
    const after = full[offset + match.length] || "";
    // part of a longer identifier, a function name or a sheet name
    if (/[\w.$]/.test(before) || /[\w(!]/.test(after)) return match;
    const refersHere = prefix
      ? unquoteSheet(prefix).toLowerCase() === sheetName.toLowerCase()
      : isHomeSheet;
    if (!refersHere) return match;
    const [d1, col1, d2, row1, d3, col2, d4, row2] = rest as string[];
    const ca = columnCharToIndex(col1);
    const ra = parseInt(row1, 10) - 1;
    if (Number.isNaN(ca) || ca >= 16384 || ra < 0) return match;
    const isRange = col2 != null;
    const cb = isRange ? columnCharToIndex(col2) : ca;
    const rb = isRange ? parseInt(row2, 10) - 1 : ra;
    if (Number.isNaN(cb) || rb < 0) return match;
    const area = {
      ra: Math.min(ra, rb),
      rb: Math.max(ra, rb),
      ca: Math.min(ca, cb),
      cb: Math.max(ca, cb),
    };
    let mapped: Area | null;
    if (!isRange) {
      const p = mapShiftedPosition(s, ra, ca);
      mapped = p ? { ra: p[0], rb: p[0], ca: p[1], cb: p[1] } : null;
    } else {
      mapped = mapShiftedArea(s, area);
    }
    const head = prefix || "";
    if (!mapped) return `${head}#REF!`;
    if (_.isEqual(mapped, area)) return match;
    const a1 = `${d1}${indexToColumnChar(mapped.ca)}${d2}${mapped.ra + 1}`;
    if (!isRange) return `${head}${a1}`;
    return `${head}${a1}:${d3}${indexToColumnChar(mapped.cb)}${d4}${
      mapped.rb + 1
    }`;
  });
}

/** Rewrites the references of one formula (string literals are skipped). */
export function shiftFormulaReferences(
  formula: string,
  s: Shift,
  sheetName: string,
  isHomeSheet: boolean
) {
  let out = "";
  let last = 0;
  const strRe = /"(?:[^"]|"")*"/g;
  let m = strRe.exec(formula);
  while (m) {
    out += rewriteSegment(
      formula.slice(last, m.index),
      s,
      sheetName,
      isHomeSheet
    );
    out += m[0];
    last = m.index + m[0].length;
    m = strRe.exec(formula);
  }
  out += rewriteSegment(formula.slice(last), s, sheetName, isHomeSheet);
  return out;
}

/* ------------------------------------------------------------------------ */
/* Data moves                                                               */
/* ------------------------------------------------------------------------ */

function lastUsedIndex(d: CellMatrix, s: Shift) {
  let last = -1;
  if (s.axis === "col") {
    for (let r = s.r1; r <= s.r2 && r < d.length; r += 1) {
      const row = d[r] || [];
      for (let c = row.length - 1; c > last; c -= 1) {
        if (row[c] != null) {
          last = c;
          break;
        }
      }
    }
  } else {
    for (let r = d.length - 1; r > last; r -= 1) {
      const row = d[r] || [];
      for (let c = s.c1; c <= s.c2; c += 1) {
        if (row[c] != null) {
          last = r;
          break;
        }
      }
    }
  }
  return last;
}

function growSheet(file: Sheet, d: CellMatrix, s: Shift) {
  const cols = d[0]?.length ?? 0;
  const last = lastUsedIndex(d, s);
  if (s.axis === "col") {
    const need = last + s.n + 1 - cols;
    if (need > 0) {
      if (cols + need >= MAX_COLS) throw new Error("maxExceeded");
      d.forEach((row) => {
        for (let i = 0; i < need; i += 1) row.push(null);
      });
      file.column = cols + need;
    }
  } else {
    const need = last + s.n + 1 - d.length;
    if (need > 0) {
      if (d.length + need >= MAX_ROWS) throw new Error("maxExceeded");
      for (let i = 0; i < need; i += 1) d.push(new Array(cols).fill(null));
      file.row = d.length;
    }
  }
}

function moveData(d: CellMatrix, s: Shift) {
  const rows = d.length;
  const cols = d[0]?.length ?? 0;
  if (s.axis === "col") {
    for (let r = s.r1; r <= Math.min(s.r2, rows - 1); r += 1) {
      const row = d[r];
      if (s.kind === "insert") {
        row.splice(s.c1, 0, ...new Array(s.n).fill(null));
        row.length = cols;
      } else {
        row.splice(s.c1, s.n);
        while (row.length < cols) row.push(null);
      }
    }
    return;
  }
  for (let c = s.c1; c <= Math.min(s.c2, cols - 1); c += 1) {
    if (s.kind === "insert") {
      for (let r = rows - 1; r >= s.r1 + s.n; r -= 1) d[r][c] = d[r - s.n][c];
      for (let r = s.r1; r < s.r1 + s.n && r < rows; r += 1) d[r][c] = null;
    } else {
      for (let r = s.r1; r < rows - s.n; r += 1) d[r][c] = d[r + s.n][c];
      for (let r = Math.max(s.r1, rows - s.n); r < rows; r += 1) d[r][c] = null;
    }
  }
}

type Merge = { r: number; c: number; rs: number; cs: number };

/**
 * New merges, or throws `partMC` when the shift would split a merged cell
 * (Excel refuses those too).
 */
function shiftMerges(merges: Record<string, Merge> | undefined, s: Shift) {
  const out: Record<string, Merge> = {};
  _.forEach(merges, (m) => {
    const mr1 = m.r;
    const mr2 = m.r + m.rs - 1;
    const mc1 = m.c;
    const mc2 = m.c + m.cs - 1;
    const [b1, b2, a1, a2, lo, hi] =
      s.axis === "col"
        ? [mr1, mr2, mc1, mc2, s.r1, s.r2]
        : [mc1, mc2, mr1, mr2, s.c1, s.c2];
    const start = s.axis === "col" ? s.c1 : s.r1;
    const end = s.axis === "col" ? s.c2 : s.r2;
    const touchesBand = b2 >= lo && b1 <= hi;
    // merges entirely before the shifted span stay put
    const affected = a2 >= start;
    if (!touchesBand || !affected) {
      out[`${m.r}_${m.c}`] = m;
      return;
    }
    if (b1 < lo || b2 > hi) throw new Error("partMC");
    let na1 = a1;
    if (s.kind === "insert") {
      if (a1 < start) throw new Error("partMC");
      na1 = a1 + s.n;
    } else if (a1 > end) {
      na1 = a1 - s.n;
    } else if (a1 >= start && a2 <= end) {
      return; // deleted with its cells
    } else {
      throw new Error("partMC");
    }
    const moved = s.axis === "col" ? { ...m, c: na1 } : { ...m, r: na1 };
    out[`${moved.r}_${moved.c}`] = moved;
  });
  return out;
}

function applyMergeTags(d: CellMatrix, merges: Record<string, Merge>) {
  _.forEach(merges, ({ r, c, rs, cs }) => {
    for (let i = r; i < r + rs; i += 1) {
      for (let j = c; j < c + cs; j += 1) {
        const cell = d[i]?.[j];
        if (cell) cell.mc = i === r && j === c ? { r, c, rs, cs } : { r, c };
      }
    }
  });
}

function remapKeyed<T>(
  record: Record<string, T> | undefined,
  s: Shift
): Record<string, T> | undefined {
  if (!record) return record;
  const out: Record<string, T> = {};
  _.forEach(record, (v, key) => {
    const [r, c] = key.split("_").map(Number);
    const p = mapShiftedPosition(s, r, c);
    if (p) out[`${p[0]}_${p[1]}`] = v;
  });
  return out;
}

function shiftCells(ctx: Context, s: Shift, sheetId?: string) {
  const id = sheetId || ctx.currentSheetId;
  const index = getSheetIndex(ctx, id);
  if (index == null) return;
  const file = ctx.luckysheetfile[index];
  const d = file.data;
  if (!d || d.length === 0) return;
  const cfg = file.config || {};

  const merge = shiftMerges(cfg.merge as Record<string, Merge>, s);
  if (s.kind === "insert") growSheet(file, d, s);
  moveData(d, s);
  cfg.merge = merge;
  applyMergeTags(d, merge);
  file.config = cfg;
  if (id === ctx.currentSheetId) ctx.config = cfg;

  file.hyperlink = remapKeyed(file.hyperlink, s);
  _.forEach(file.hyperlink, (_v, key) => {
    const [r, c] = key.split("_").map(Number);
    const cell = d[r]?.[c];
    if (cell?.hl) cell.hl = { ...cell.hl, r, c };
  });
  file.dataVerification = remapKeyed(file.dataVerification, s);

  if (file.calcChain) {
    file.calcChain = file.calcChain.flatMap((item: any) => {
      if (item.id != null && item.id !== id) return [item];
      const p = mapShiftedPosition(s, item.r, item.c);
      return p ? [{ ...item, r: p[0], c: p[1] }] : [];
    });
  }

  // formulas anywhere in the workbook that point into the band
  const sheetName = file.name;
  ctx.luckysheetfile.forEach((sheet) => {
    const { data } = sheet;
    if (!data) return;
    const home = sheet.id === id;
    for (let r = 0; r < data.length; r += 1) {
      const row = data[r];
      if (!row) continue;
      for (let c = 0; c < row.length; c += 1) {
        const cell = row[c];
        if (cell?.f) {
          const f = shiftFormulaReferences(cell.f, s, sheetName, home);
          if (f !== cell.f) cell.f = f;
        }
      }
    }
  });

  invalidateDependencyGraph(ctx);
  try {
    recalculate(ctx, [], null, { isForce: true });
  } catch (e) {
    // a formula that fails to evaluate keeps its last value
  }
}

/** Excel's Insert… > Shift cells right / Shift cells down. */
export function insertCells(
  ctx: Context,
  range: CellRect,
  direction: InsertCellsDirection,
  sheetId?: string
) {
  shiftCells(
    ctx,
    makeShift("insert", direction === "right" ? "col" : "row", range),
    sheetId
  );
}

/** Excel's Delete… > Shift cells left / Shift cells up. */
export function deleteCells(
  ctx: Context,
  range: CellRect,
  direction: DeleteCellsDirection,
  sheetId?: string
) {
  shiftCells(
    ctx,
    makeShift("delete", direction === "left" ? "col" : "row", range),
    sheetId
  );
}
