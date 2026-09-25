/**
 * Formula reference rewriting (Excel semantics).
 *
 * One tokenizer-based rewriter is used for every operation that changes where
 * cells live or what sheets are called:
 *
 * - copy/paste and fill: relative references shift by the paste offset,
 *   absolute parts (`$`) are kept ({@link offsetFormula});
 * - inserting/deleting rows, columns or cells: references follow the cells,
 *   ranges grow when cells are inserted inside them and shrink when part of
 *   them is deleted, and references to deleted cells become `#REF!`;
 * - cut/paste and drag-moving: every reference that points entirely inside
 *   the moved block follows it (also from other sheets), references to the
 *   overwritten destination become `#REF!`, and the moved formulas keep their
 *   text (qualified with their old sheet when moved to another sheet);
 * - renaming or deleting a sheet: sheet-qualified references are renamed, or
 *   become `#REF!`.
 *
 * Strings, structured references (`Table1[Col]`, `[@Col]`), external
 * workbook references and unknown sheets are never touched. Whole-column
 * references (`A:C`) are unaffected by row operations and whole-row
 * references (`1:3`) by column operations.
 *
 * {@link adjustReferences} applies a change to the whole workbook: cell
 * formulas, data-validation ranges, internal hyperlinks, conditional-format
 * formulas, and everything registered through
 * {@link registerReferenceAdjuster} (defined names, charts, ...).
 */
import type { Context } from "../context";
import type { Cell } from "../types";
import { tokenizeFormula } from "./formulaEditor";
import { execFunctionGroup } from "./formula";

/** Excel's grid size: references beyond it become `#REF!`. */
export const MAX_ROWS = 1048576;
export const MAX_COLUMNS = 16384;

export type RangeRect = { row: [number, number]; column: [number, number] };

export type ReferenceChange =
  /** `count` rows/columns inserted so that the first new one is `index`. */
  | {
      type: "insert";
      sheetId: string;
      axis: "row" | "column";
      index: number;
      count: number;
    }
  /** rows/columns `start..end` (inclusive) deleted */
  | {
      type: "delete";
      sheetId: string;
      axis: "row" | "column";
      start: number;
      end: number;
    }
  /** Insert cells in `range`, shifting existing cells down or right. */
  | {
      type: "insertCells";
      sheetId: string;
      range: RangeRect;
      shift: "down" | "right";
    }
  /** Delete the cells in `range`, shifting the cells below/right up/left. */
  | {
      type: "deleteCells";
      sheetId: string;
      range: RangeRect;
      shift: "up" | "left";
    }
  /** Move `range` (cut/paste or drag) so its top-left lands on (toRow, toColumn). */
  | {
      type: "move";
      sheetId: string;
      range: RangeRect;
      toSheetId: string;
      toRow: number;
      toColumn: number;
    }
  | { type: "renameSheet"; sheetId: string; oldName: string; newName: string }
  | { type: "deleteSheet"; sheetId: string; name: string };

/* -------------------------------------------------------------------------- */
/*                              Reference parsing                             */
/* -------------------------------------------------------------------------- */

export type RefKind = "cell" | "range" | "cols" | "rows";

/** A parsed A1 reference; rows/columns are 0-based, -1 when absent. */
export type ParsedRef = {
  /** sheet prefix exactly as written, including the `!` ("" if none) */
  prefix: string;
  /** unquoted sheet name, null when unqualified */
  sheet: string | null;
  kind: RefKind;
  r1: number;
  c1: number;
  r2: number;
  c2: number;
  /** absolute ($) flags */
  ar1: boolean;
  ac1: boolean;
  ar2: boolean;
  ac2: boolean;
};

const CELL_RE = /^(\$?)([A-Za-z]{1,3})(\$?)([0-9]+)$/;
const COL_RE = /^(\$?)([A-Za-z]{1,3})$/;
const ROW_RE = /^(\$?)([0-9]+)$/;

export function columnToIndex(letters: string) {
  let n = 0;
  const s = letters.toUpperCase();
  for (let i = 0; i < s.length; i += 1) n = n * 26 + (s.charCodeAt(i) - 64);
  return n - 1;
}

export function indexToColumn(index: number) {
  let n = index + 1;
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function splitPrefix(text: string): [string, string] {
  // the sheet prefix ends at the last "!" (quoted names cannot contain one
  // unescaped, and the body never contains one)
  const bang = text.lastIndexOf("!");
  if (bang < 0) return ["", text];
  return [text.slice(0, bang + 1), text.slice(bang + 1)];
}

function unquoteSheet(prefix: string): string | null {
  if (!prefix) return null;
  let name = prefix.slice(0, -1);
  if (name.startsWith("'") && name.endsWith("'") && name.length >= 2) {
    name = name.slice(1, -1).replace(/''/g, "'");
  }
  return name;
}

/**
 * Order the ends of a range top-left to bottom-right, like Excel does when a
 * range is entered as `B2:A1`. Each coordinate keeps its `$` flag; when one
 * dimension is tied the corners are kept together.
 */
function normalizeRef(ref: ParsedRef): ParsedRef {
  const next = { ...ref };
  const hasRows = ref.kind !== "cols";
  const hasCols = ref.kind !== "rows";
  const swapRows =
    hasRows &&
    (ref.r1 > ref.r2 || (ref.r1 === ref.r2 && hasCols && ref.c1 > ref.c2));
  const swapCols =
    hasCols &&
    (ref.c1 > ref.c2 || (ref.c1 === ref.c2 && hasRows && ref.r1 > ref.r2));
  if (swapRows) {
    [next.r1, next.r2, next.ar1, next.ar2] = [ref.r2, ref.r1, ref.ar2, ref.ar1];
  }
  if (swapCols) {
    [next.c1, next.c2, next.ac1, next.ac2] = [ref.c2, ref.c1, ref.ac2, ref.ac1];
  }
  return next;
}

/** Parses `A1`, `$A$1:B2`, `A:C`, `$1:3`, `Sheet2!A1`, `'My sheet'!A:A`. */
export function parseRef(text: string): ParsedRef | null {
  const [prefix, body] = splitPrefix(text.trim());
  const parts = body.split(":");
  if (parts.length > 2 || parts.some((p) => p.length === 0)) return null;
  const sheet = unquoteSheet(prefix);
  const base = { prefix, sheet };

  const cells = parts.map((p) => p.match(CELL_RE));
  if (cells.every((m) => m)) {
    const pts = cells.map((m) => ({
      c: columnToIndex(m![2]),
      r: parseInt(m![4], 10) - 1,
      ac: m![1] === "$",
      ar: m![3] === "$",
    }));
    if (pts.some((p) => p.r < 0 || p.r >= MAX_ROWS || p.c >= MAX_COLUMNS)) {
      return null;
    }
    const a = pts[0];
    const b = pts[pts.length - 1];
    // normalise B2:A1 to A1:B2, keeping each coordinate's $ flag
    return normalizeRef({
      ...base,
      kind: parts.length === 1 ? "cell" : "range",
      r1: a.r,
      c1: a.c,
      r2: b.r,
      c2: b.c,
      ar1: a.ar,
      ac1: a.ac,
      ar2: b.ar,
      ac2: b.ac,
    });
  }
  if (parts.length !== 2) return null;

  const cols = parts.map((p) => p.match(COL_RE));
  if (cols.every((m) => m)) {
    const x = cols.map((m) => ({ c: columnToIndex(m![2]), a: m![1] === "$" }));
    if (x.some((p) => p.c >= MAX_COLUMNS)) return null;
    return normalizeRef({
      ...base,
      kind: "cols",
      r1: -1,
      r2: -1,
      c1: x[0].c,
      c2: x[1].c,
      ar1: false,
      ar2: false,
      ac1: x[0].a,
      ac2: x[1].a,
    });
  }

  const rows = parts.map((p) => p.match(ROW_RE));
  if (rows.every((m) => m)) {
    const x = rows.map((m) => ({
      r: parseInt(m![2], 10) - 1,
      a: m![1] === "$",
    }));
    if (x.some((p) => p.r < 0 || p.r >= MAX_ROWS)) return null;
    return normalizeRef({
      ...base,
      kind: "rows",
      r1: x[0].r,
      r2: x[1].r,
      c1: -1,
      c2: -1,
      ar1: x[0].a,
      ar2: x[1].a,
      ac1: false,
      ac2: false,
    });
  }
  return null;
}

/** Whether a sheet name must be quoted in a reference (`'My sheet'!A1`). */
export function sheetNameNeedsQuotes(name: string) {
  if (!/^[A-Za-z_À-￿][A-Za-z0-9_.À-￿]*$/.test(name)) {
    return true;
  }
  // names that read as a cell (A1, XFD12) or an R1C1 reference
  if (/^[A-Za-z]{1,3}[0-9]+$/.test(name)) return true;
  if (/^[Rr][0-9]*[Cc][0-9]*$/.test(name)) return true;
  if (/^(TRUE|FALSE)$/i.test(name)) return true;
  return false;
}

/** `Sheet1!` or `'My sheet'!` */
export function sheetPrefix(name: string) {
  return sheetNameNeedsQuotes(name)
    ? `'${name.replace(/'/g, "''")}'!`
    : `${name}!`;
}

/** Serialises the body (without sheet prefix) of a parsed reference. */
export function formatRefBody(ref: ParsedRef) {
  const cell = (r: number, c: number, ar: boolean, ac: boolean) =>
    `${ac ? "$" : ""}${indexToColumn(c)}${ar ? "$" : ""}${r + 1}`;
  if (ref.kind === "cell") return cell(ref.r1, ref.c1, ref.ar1, ref.ac1);
  if (ref.kind === "range") {
    return `${cell(ref.r1, ref.c1, ref.ar1, ref.ac1)}:${cell(
      ref.r2,
      ref.c2,
      ref.ar2,
      ref.ac2
    )}`;
  }
  if (ref.kind === "cols") {
    return `${ref.ac1 ? "$" : ""}${indexToColumn(ref.c1)}:${
      ref.ac2 ? "$" : ""
    }${indexToColumn(ref.c2)}`;
  }
  return `${ref.ar1 ? "$" : ""}${ref.r1 + 1}:${ref.ar2 ? "$" : ""}${
    ref.r2 + 1
  }`;
}

export function formatRef(ref: ParsedRef) {
  return ref.prefix + formatRefBody(ref);
}

/* -------------------------------------------------------------------------- */
/*                                  Scanning                                  */
/* -------------------------------------------------------------------------- */

export type FormulaSegment = {
  text: string;
  start: number;
  end: number;
  /** set for reference tokens that parse as A1 references */
  ref?: ParsedRef;
};

/**
 * Blank out bracketed spans (structured references such as `Table1[Col]`,
 * `[@Col]`, `Table1[[#This Row],[A1]]` and external workbook prefixes like
 * `[1]Sheet1!A1`) outside string literals, so nothing inside them is read as
 * a cell reference. Lengths are preserved so token offsets stay valid.
 */
function maskBrackets(text: string) {
  if (text.indexOf("[") < 0) return text;
  let out = "";
  let depth = 0;
  let inStr = false;
  let inSheet = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (depth === 0 && !inSheet && ch === '"') inStr = !inStr;
    else if (depth === 0 && !inStr && ch === "'") inSheet = !inSheet;
    if (!inStr && !inSheet && ch === "[") depth += 1;
    if (depth > 0) {
      out += "_";
      if (!inStr && ch === "]") depth -= 1;
    } else {
      out += ch;
    }
  }
  return out;
}

/**
 * Splits a formula into segments; reference segments carry the parsed
 * reference. Concatenating every `text` gives back the input.
 */
export function scanFormula(formula: string): FormulaSegment[] {
  const masked = maskBrackets(formula);
  const tokens = tokenizeFormula(masked);
  const segs: FormulaSegment[] = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const t = tokens[i];
    const text = formula.slice(t.start, t.end);
    const seg: FormulaSegment = { text, start: t.start, end: t.end };
    if (t.type === "reference" && masked.slice(t.start, t.end) === text) {
      const ref = parseRef(text);
      if (ref) seg.ref = ref;
    }
    segs.push(seg);
  }
  return segs;
}

/**
 * Low-level rewriter: calls `fn` for every A1 reference in `formula` and
 * splices in its result (a replacement reference, the string "#REF!", or
 * null/undefined to keep the original text).
 */
export function transformReferences(
  formula: string,
  fn: (ref: ParsedRef) => ParsedRef | "#REF!" | null | undefined
): string {
  if (!formula) return formula;
  const segs = scanFormula(formula);
  let changed = false;
  let out = "";
  for (let i = 0; i < segs.length; i += 1) {
    const seg = segs[i];
    if (seg.ref) {
      const res = fn(seg.ref);
      if (res === "#REF!") {
        out += "#REF!";
        changed = true;
        // a deleted spill reference (A1#) is plain #REF!, not #REF!#
        const next = segs[i + 1];
        if (next && !next.ref && /^#(?![A-Za-z/])/.test(next.text)) {
          segs[i + 1] = { ...next, text: next.text.slice(1) };
        }
        continue;
      }
      if (res) {
        const text = formatRef(res);
        if (text !== seg.text) changed = true;
        out += text;
        continue;
      }
    }
    out += seg.text;
  }
  return changed ? out : formula;
}

/** All references of a formula, parsed (strings/structured refs skipped). */
export function getFormulaReferences(formula: string): ParsedRef[] {
  return scanFormula(formula)
    .filter((s) => s.ref)
    .map((s) => s.ref!);
}

/* -------------------------------------------------------------------------- */
/*                             Copy / fill offsets                            */
/* -------------------------------------------------------------------------- */

/**
 * Shift the relative parts of every reference by (rowOffset, colOffset), as
 * when a formula is copied `rowOffset` rows down and `colOffset` columns
 * right. Absolute parts are kept; references pushed off the grid become
 * `#REF!` (Excel). Sheet prefixes are kept as written.
 */
export function offsetFormula(
  formula: string,
  rowOffset: number,
  colOffset: number
): string {
  if (!rowOffset && !colOffset) return formula;
  return transformReferences(formula, (ref) => {
    const next = { ...ref };
    if (ref.kind !== "cols") {
      if (!ref.ar1) next.r1 += rowOffset;
      if (!ref.ar2) next.r2 += rowOffset;
    }
    if (ref.kind !== "rows") {
      if (!ref.ac1) next.c1 += colOffset;
      if (!ref.ac2) next.c2 += colOffset;
    }
    if (ref.kind === "cell") {
      next.r2 = next.r1;
      next.c2 = next.c1;
    }
    const rowsOk =
      ref.kind === "cols" ||
      (next.r1 >= 0 &&
        next.r2 >= 0 &&
        next.r1 < MAX_ROWS &&
        next.r2 < MAX_ROWS);
    const colsOk =
      ref.kind === "rows" ||
      (next.c1 >= 0 &&
        next.c2 >= 0 &&
        next.c1 < MAX_COLUMNS &&
        next.c2 < MAX_COLUMNS);
    if (!rowsOk || !colsOk) return "#REF!";
    // a range whose ends crossed (one end absolute) is re-normalised
    return normalizeRef(next);
  });
}

/**
 * Adjust a formula copied from (fromRow, fromCol) and pasted transposed at
 * (toRow, toCol): fully relative references are transposed around the
 * formula cell (a reference one column to the right now points one row
 * down), like Excel's Paste Special > Transpose. References with an
 * absolute part are shifted like a plain paste; whole rows/columns too.
 */
export function transposeFormula(
  formula: string,
  fromRow: number,
  fromCol: number,
  toRow: number,
  toCol: number
): string {
  const shifted = (ref: ParsedRef) =>
    offsetFormula(`=${formatRefBody(ref)}`, toRow - fromRow, toCol - fromCol);
  return transformReferences(formula, (ref) => {
    const relative =
      (ref.kind === "cell" || ref.kind === "range") &&
      !ref.ar1 &&
      !ref.ac1 &&
      !ref.ar2 &&
      !ref.ac2;
    if (!relative) {
      const out = shifted(ref);
      if (out === "=#REF!") return "#REF!";
      const moved = parseRef(out.slice(1));
      return moved ? { ...moved, prefix: ref.prefix, sheet: ref.sheet } : null;
    }
    const next = {
      ...ref,
      r1: toRow + (ref.c1 - fromCol),
      c1: toCol + (ref.r1 - fromRow),
      r2: toRow + (ref.c2 - fromCol),
      c2: toCol + (ref.r2 - fromRow),
    };
    if (
      [next.r1, next.r2].some((r) => r < 0 || r >= MAX_ROWS) ||
      [next.c1, next.c2].some((c) => c < 0 || c >= MAX_COLUMNS)
    ) {
      return "#REF!";
    }
    return normalizeRef(next);
  });
}

/* -------------------------------------------------------------------------- */
/*                         Structural change semantics                        */
/* -------------------------------------------------------------------------- */

/** Inclusive interval [a, b] of rows or columns. */
type Span = [number, number];

/** Interval after inserting `n` at `p` (every index >= p shifts). */
function insertSpan([a, b]: Span, p: number, n: number): Span {
  return [a >= p ? a + n : a, b >= p ? b + n : b];
}

/** Interval after deleting [s, e]; null when it is entirely deleted. */
function deleteSpan([a, b]: Span, s: number, e: number): Span | null {
  const n = e - s + 1;
  if (a >= s && b <= e) return null;
  let na = s;
  if (a < s) na = a;
  else if (a > e) na = a - n;
  let nb = s - 1;
  if (b < s) nb = b;
  else if (b > e) nb = b - n;
  return [na, nb];
}

/**
 * A rectangle on one sheet; `row`/`column` null means "every row/column"
 * (whole-column / whole-row references).
 */
export type Area = { row: Span | null; column: Span | null };

function within(span: Span | null, band: Span) {
  return span != null && span[0] >= band[0] && span[1] <= band[1];
}

function areaInside(area: Area, range: RangeRect) {
  return within(area.row, range.row) && within(area.column, range.column);
}

/**
 * Where an area on the changed sheet ends up after `change`: the new area,
 * null when it was deleted/overwritten (`#REF!`), or the same object when
 * unaffected. For moves, `sheetMoved` tells whether it now lives on the
 * destination sheet.
 */
export function adjustArea(
  area: Area,
  change: ReferenceChange,
  onSheetId: string
): { area: Area; sheetId: string } | null {
  const same = { area, sheetId: onSheetId };
  switch (change.type) {
    case "insert": {
      if (onSheetId !== change.sheetId) return same;
      if (change.axis === "row") {
        if (!area.row) return same;
        return {
          area: {
            ...area,
            row: insertSpan(area.row, change.index, change.count),
          },
          sheetId: onSheetId,
        };
      }
      if (!area.column) return same;
      return {
        area: {
          ...area,
          column: insertSpan(area.column, change.index, change.count),
        },
        sheetId: onSheetId,
      };
    }
    case "delete": {
      if (onSheetId !== change.sheetId) return same;
      const key = change.axis === "row" ? "row" : "column";
      const span = area[key];
      if (!span) return same;
      const next = deleteSpan(span, change.start, change.end);
      if (!next) return null;
      return { area: { ...area, [key]: next }, sheetId: onSheetId };
    }
    case "insertCells": {
      if (onSheetId !== change.sheetId) return same;
      const { range } = change;
      if (change.shift === "down") {
        // only areas lying in the shifted column band move
        if (!area.row || !within(area.column, range.column)) return same;
        const n = range.row[1] - range.row[0] + 1;
        return {
          area: { ...area, row: insertSpan(area.row, range.row[0], n) },
          sheetId: onSheetId,
        };
      }
      if (!area.column || !within(area.row, range.row)) return same;
      const n = range.column[1] - range.column[0] + 1;
      return {
        area: {
          ...area,
          column: insertSpan(area.column, range.column[0], n),
        },
        sheetId: onSheetId,
      };
    }
    case "deleteCells": {
      if (onSheetId !== change.sheetId) return same;
      const { range } = change;
      if (areaInside(area, range)) return null;
      if (change.shift === "up") {
        if (!area.row || !within(area.column, range.column)) return same;
        const next = deleteSpan(area.row, range.row[0], range.row[1]);
        if (!next) return null;
        return { area: { ...area, row: next }, sheetId: onSheetId };
      }
      if (!area.column || !within(area.row, range.row)) return same;
      const next = deleteSpan(area.column, range.column[0], range.column[1]);
      if (!next) return null;
      return { area: { ...area, column: next }, sheetId: onSheetId };
    }
    case "move": {
      const { range } = change;
      const dr = change.toRow - range.row[0];
      const dc = change.toColumn - range.column[0];
      if (onSheetId === change.sheetId && areaInside(area, range)) {
        return {
          area: {
            row: [area.row![0] + dr, area.row![1] + dr],
            column: [area.column![0] + dc, area.column![1] + dc],
          },
          sheetId: change.toSheetId,
        };
      }
      if (onSheetId === change.toSheetId) {
        const dest: RangeRect = {
          row: [range.row[0] + dr, range.row[1] + dr],
          column: [range.column[0] + dc, range.column[1] + dc],
        };
        // references to the overwritten destination cells break (Excel)
        if (areaInside(area, dest)) return null;
      }
      return same;
    }
    case "deleteSheet":
      return onSheetId === change.sheetId ? null : same;
    default:
      return same;
  }
}

/** Whether `change` can affect references on sheet `sheetId` at all. */
function changeTouchesSheet(change: ReferenceChange, sheetId: string) {
  if (change.type === "move") {
    return sheetId === change.sheetId || sheetId === change.toSheetId;
  }
  return sheetId === change.sheetId;
}

/* -------------------------------------------------------------------------- */
/*                         Sheet-aware formula rewriting                      */
/* -------------------------------------------------------------------------- */

export type SheetLookup = {
  /** sheet id for a (case-insensitive) sheet name, undefined if unknown */
  idOf: (name: string) => string | undefined;
  /** display name of a sheet id (after the change, e.g. the new name) */
  nameOf: (id: string) => string | undefined;
};

/** Sheet lookup over `sheets`, aware of renames/deletes in `change`. */
export function createSheetLookup(
  sheets: { id?: string; name: string }[],
  change?: ReferenceChange
): SheetLookup {
  const byName = new Map<string, string>();
  const byId = new Map<string, string>();
  sheets.forEach((s) => {
    if (s.id == null) return;
    byName.set(s.name.toLowerCase(), s.id);
    byId.set(s.id, s.name);
  });
  if (change?.type === "renameSheet") {
    // resolve the old name (formulas still use it) and print the new one;
    // the sheet object may already carry either name
    byName.delete(change.newName.toLowerCase());
    byName.set(change.oldName.toLowerCase(), change.sheetId);
    byId.set(change.sheetId, change.newName);
  } else if (change?.type === "deleteSheet") {
    byName.set(change.name.toLowerCase(), change.sheetId);
  }
  return {
    idOf: (name) => byName.get(name.toLowerCase()),
    nameOf: (id) => byId.get(id),
  };
}

function refToArea(ref: ParsedRef): Area {
  return {
    row: ref.kind === "cols" ? null : [ref.r1, ref.r2],
    column: ref.kind === "rows" ? null : [ref.c1, ref.c2],
  };
}

/**
 * Rewrite the references of `formula` for a workbook `change`.
 *
 * `hostSheetId` is the sheet the formula lives on (it resolves unqualified
 * references). `newHostSheetId` is where it lives afterwards (differs only
 * for formulas that are themselves moved to another sheet): unqualified
 * references to the old host then gain a sheet prefix, and references that
 * now point at the new host lose nothing (qualified ones stay qualified).
 */
export function rewriteFormula(
  formula: string,
  change: ReferenceChange,
  hostSheetId: string,
  lookup: SheetLookup,
  newHostSheetId: string = hostSheetId
): string {
  if (!formula) return formula;
  return transformReferences(formula, (ref) => {
    let sheetId: string | undefined;
    if (ref.sheet == null) sheetId = hostSheetId;
    else {
      sheetId = lookup.idOf(ref.sheet);
      // unknown sheet or external reference: leave as written
      if (sheetId == null) return null;
    }

    let target = sheetId;
    let next = ref;
    if (change.type === "renameSheet") {
      if (ref.sheet != null && sheetId === change.sheetId) {
        return {
          ...ref,
          prefix: sheetPrefix(change.newName),
          sheet: change.newName,
        };
      }
    } else if (changeTouchesSheet(change, sheetId)) {
      const res = adjustArea(refToArea(ref), change, sheetId);
      if (!res) return "#REF!";
      target = res.sheetId;
      const { area } = res;
      next = { ...ref };
      if (area.row) [next.r1, next.r2] = area.row;
      if (area.column) [next.c1, next.c2] = area.column;
    }

    if (target === newHostSheetId && ref.sheet == null) return next;
    if (target === sheetId && ref.sheet != null) return next;
    // the reference now needs a (different) sheet prefix
    const name = lookup.nameOf(target);
    if (name == null) return "#REF!";
    return { ...next, prefix: sheetPrefix(name), sheet: name };
  });
}

/**
 * Rewrite a bare reference text such as a data-validation list source
 * (`Sheet1!A1:A5`, `$B$2:$B$9`) or an internal hyperlink target. Returns
 * null when the reference was deleted.
 */
export function rewriteReferenceText(
  text: string,
  change: ReferenceChange,
  hostSheetId: string,
  lookup: SheetLookup
): string | null {
  const out = rewriteFormula(text, change, hostSheetId, lookup);
  return out.indexOf("#REF!") >= 0 ? null : out;
}

/* -------------------------------------------------------------------------- */
/*                            Workbook-wide rewrite                           */
/* -------------------------------------------------------------------------- */

export type ReferenceAdjusterApi = {
  lookup: SheetLookup;
  /** rewrite a formula (with or without `=`) living on `hostSheetId` */
  rewriteFormula: (formula: string, hostSheetId: string) => string;
  /** rewrite a bare reference text; null when it was deleted */
  rewriteReferenceText: (text: string, hostSheetId: string) => string | null;
  /** new position of a rectangle on `sheetId`; null when deleted */
  adjustRange: (range: RangeRect, sheetId: string) => RangeRect | null;
  /**
   * Like `adjustRange`, but also tells on which sheet the rectangle ends up
   * (a block moved to another sheet takes its contents with it).
   */
  locateRange: (
    range: RangeRect,
    sheetId: string
  ) => { range: RangeRect; sheetId: string } | null;
};

/**
 * Callback run by {@link adjustReferences} for every structural change, so
 * other data models (defined names, tables, charts, notes, ...) keep their
 * references in sync. It is called once per change, before the cells are
 * actually moved. It may return a "finisher": a function run once the
 * caller has moved the cells (see {@link finishReferenceChange}), for work
 * that needs the new cell layout (e.g. writing the header of a table column
 * that was just inserted).
 */
export type ReferenceAdjuster = (
  ctx: Context,
  change: ReferenceChange,
  api: ReferenceAdjusterApi
) => void | (() => void);

/*
 * The registry lives on a hoisted function so that modules registering
 * adjusters while this module is still being evaluated (import cycles) do
 * not hit an uninitialised binding.
 */
function registry(): Map<string, ReferenceAdjuster> {
  const holder = registry as unknown as {
    adjusters?: Map<string, ReferenceAdjuster>;
  };
  if (!holder.adjusters) holder.adjusters = new Map();
  return holder.adjusters;
}

function pendingFinishers(): (() => void)[] {
  const holder = pendingFinishers as unknown as { list?: (() => void)[] };
  if (!holder.list) holder.list = [];
  return holder.list;
}

/**
 * Register a reference adjuster under `key` (re-registering replaces it).
 * Returns a function that unregisters it.
 */
export function registerReferenceAdjuster(
  key: string,
  adjuster: ReferenceAdjuster
) {
  registry().set(key, adjuster);
  return () => {
    if (registry().get(key) === adjuster) registry().delete(key);
  };
}

export function unregisterReferenceAdjuster(key: string) {
  registry().delete(key);
}

/** Keys of the registered adjusters (in registration order). */
export function getReferenceAdjusterKeys() {
  return Array.from(registry().keys());
}

/**
 * Run the finishers returned by the adjusters of the last
 * {@link adjustReferences} call. Callers moving cells call it (through
 * {@link recalcAfterStructuralChange}) once the cells are in place; it is a
 * no-op when nothing is pending.
 */
export function finishReferenceChange() {
  const list = pendingFinishers();
  while (list.length > 0) {
    const fn = list.shift()!;
    fn();
  }
}

function isFormulaString(f: unknown): f is string {
  return typeof f === "string" && f.length > 1 && f[0] === "=";
}

/** Cheap pre-filter: can `f` on `hostId` contain a reference `change` affects? */
function mayBeAffected(
  f: string,
  hostId: string,
  change: ReferenceChange,
  names: string[]
) {
  if (change.type !== "renameSheet" && changeTouchesSheet(change, hostId)) {
    return true;
  }
  if (f.indexOf("!") < 0) return false;
  const lower = f.toLowerCase();
  return names.some((n) => lower.indexOf(n) >= 0);
}

function inRange(r: number, c: number, range: RangeRect) {
  return (
    r >= range.row[0] &&
    r <= range.row[1] &&
    c >= range.column[0] &&
    c <= range.column[1]
  );
}

/** New position (and sheet) of a rectangle; null when it was deleted. */
export function locateRangeForChange(
  range: RangeRect,
  change: ReferenceChange,
  sheetId: string
): { range: RangeRect; sheetId: string } | null {
  const res = adjustArea(
    { row: [...range.row] as Span, column: [...range.column] as Span },
    change,
    sheetId
  );
  if (!res) return null;
  return {
    range: {
      row: res.area.row as [number, number],
      column: res.area.column as [number, number],
    },
    sheetId: res.sheetId,
  };
}

export function adjustRangeForChange(
  range: RangeRect,
  change: ReferenceChange,
  sheetId: string
): RangeRect | null {
  const res = adjustArea(
    { row: [...range.row] as Span, column: [...range.column] as Span },
    change,
    sheetId
  );
  if (!res) return null;
  return {
    row: res.area.row as [number, number],
    column: res.area.column as [number, number],
  };
}

/**
 * Apply `change` to every reference in the workbook: cell formulas on all
 * sheets, data-validation list sources and custom formulas, internal
 * hyperlinks, conditional-format formulas, and every registered adjuster.
 *
 * Call it BEFORE the cells are moved/inserted/deleted (moved formula cells
 * are rewritten in place and carried along by the caller). Positional data
 * that is keyed by cell (merges, data-validation keys, hyperlink keys,
 * conditional-format ranges on the changed sheet, ...) stays the caller's
 * job. Returns the number of formulas whose text changed.
 */
export function adjustReferences(ctx: Context, change: ReferenceChange) {
  // a previous change whose caller never finished: its cells have moved by
  // now, so complete it before looking at the new one
  finishReferenceChange();
  const files = ctx.luckysheetfile || [];
  const lookup = createSheetLookup(files, change);
  const names: string[] = [];
  const addName = (n?: string) => {
    if (!n) return;
    names.push(n.toLowerCase());
    // quoted names escape ' as ''
    if (n.indexOf("'") >= 0) names.push(n.toLowerCase().replace(/'/g, "''"));
  };
  if (change.type === "renameSheet") addName(change.oldName);
  else if (change.type === "deleteSheet") addName(change.name);
  else {
    addName(lookup.nameOf(change.sheetId));
    if (change.type === "move") addName(lookup.nameOf(change.toSheetId));
  }

  let count = 0;
  const rewriteCellFormula = (
    cell: Cell | null | undefined,
    hostId: string,
    r: number,
    c: number
  ) => {
    if (!cell || !isFormulaString(cell.f)) return;
    const moved =
      change.type === "move" &&
      hostId === change.sheetId &&
      inRange(r, c, change.range);
    if (!moved && !mayBeAffected(cell.f, hostId, change, names)) return;
    const newHost = moved ? (change as any).toSheetId : hostId;
    const next = rewriteFormula(cell.f, change, hostId, lookup, newHost);
    if (next !== cell.f) {
      cell.f = next;
      count += 1;
    }
  };

  for (let i = 0; i < files.length; i += 1) {
    const file = files[i];
    const hostId = file.id;
    if (hostId == null) continue;
    // the formulas of a sheet being deleted go away with it
    if (change.type === "deleteSheet" && hostId === change.sheetId) continue;
    if (file.data) {
      const { data } = file;
      for (let r = 0; r < data.length; r += 1) {
        const row = data[r];
        if (!row) continue;
        for (let c = 0; c < row.length; c += 1) {
          const cell = row[c];
          if (cell && cell.f != null) rewriteCellFormula(cell, hostId, r, c);
        }
      }
    } else if (file.celldata) {
      // sheets that were never opened keep their cells in `celldata`
      file.celldata.forEach((item) => {
        rewriteCellFormula(item.v as Cell, hostId, item.r, item.c);
      });
    }

    // data validation: list sources and custom formulas
    const dv = file.dataVerification;
    if (dv) {
      Object.keys(dv).forEach((key) => {
        const item = dv[key];
        if (!item) return;
        (["value1", "value2"] as const).forEach((field) => {
          const v = item[field];
          if (typeof v !== "string" || v === "") return;
          if (isFormulaString(v)) {
            const next = rewriteFormula(v, change, hostId, lookup);
            if (next !== v) item[field] = next;
          } else if (item.type === "dropdown" && field === "value1") {
            const ref = parseRef(v);
            if (!ref) return;
            const next = rewriteFormula(v, change, hostId, lookup);
            if (next !== v) item[field] = next;
          }
        });
      });
    }

    // internal hyperlinks
    const links = file.hyperlink;
    if (links) {
      Object.keys(links).forEach((key) => {
        const link = links[key];
        if (!link) return;
        if (link.linkType === "cellrange" && parseRef(link.linkAddress)) {
          const next = rewriteFormula(link.linkAddress, change, hostId, lookup);
          if (next !== link.linkAddress) link.linkAddress = next;
        } else if (
          link.linkType === "sheet" &&
          change.type === "renameSheet" &&
          link.linkAddress.toLowerCase() === change.oldName.toLowerCase()
        ) {
          link.linkAddress = change.newName;
        }
      });
    }

    // conditional formatting rules written as formulas
    const cf = file.luckysheet_conditionformat_save;
    if (cf) {
      cf.forEach((rule: any) => {
        if (!rule || !Array.isArray(rule.conditionValue)) return;
        rule.conditionValue.forEach((v: unknown, k: number) => {
          if (!isFormulaString(v)) return;
          const next = rewriteFormula(v, change, hostId, lookup);
          if (next !== v) rule.conditionValue[k] = next;
        });
      });
    }
  }

  const adjusters = registry();
  if (adjusters.size > 0) {
    const api: ReferenceAdjusterApi = {
      lookup,
      rewriteFormula: (f, hostSheetId) =>
        rewriteFormula(f, change, hostSheetId, lookup),
      rewriteReferenceText: (text, hostSheetId) =>
        rewriteReferenceText(text, change, hostSheetId, lookup),
      adjustRange: (range, sheetId) =>
        adjustRangeForChange(range, change, sheetId),
      locateRange: (range, sheetId) =>
        locateRangeForChange(range, change, sheetId),
    };
    const pending = pendingFinishers();
    adjusters.forEach((fn) => {
      const finish = fn(ctx, change, api);
      if (typeof finish === "function") pending.push(finish);
    });
  }

  if (ctx.formulaCache) ctx.formulaCache.formulaCellInfoMap = null;
  // renaming a sheet moves no cells: nothing to wait for
  if (change.type === "renameSheet") finishReferenceChange();
  return count;
}

export type WorkbookFormulaSite = {
  kind: "cell" | "dataVerification" | "conditionalFormat" | "definedName";
  /** sheet the formula lives on (for names: the sheet storing the name) */
  sheetId: string;
  /** cell position, for cell formulas only */
  r?: number;
  c?: number;
};

/**
 * Apply `fn` to every formula text of the workbook: cell formulas (loaded
 * or not), data-validation formulas, conditional-format formulas and
 * defined-name definitions. `fn` returns the new text (the same string when
 * unchanged). Returns the number of formulas changed. Used for rewrites that
 * are not positional, such as renaming a table or one of its columns.
 */
export function rewriteWorkbookFormulas(
  ctx: Context,
  fn: (formula: string, site: WorkbookFormulaSite) => string
) {
  let count = 0;
  const files = ctx.luckysheetfile || [];
  files.forEach((file) => {
    const sheetId = file.id;
    if (sheetId == null) return;
    const visitCell = (cell: Cell | null | undefined, r: number, c: number) => {
      if (!cell || !isFormulaString(cell.f)) return;
      const next = fn(cell.f, { kind: "cell", sheetId, r, c });
      if (next !== cell.f) {
        cell.f = next;
        count += 1;
      }
    };
    if (file.data) {
      const { data } = file;
      for (let r = 0; r < data.length; r += 1) {
        const row = data[r];
        if (!row) continue;
        for (let c = 0; c < row.length; c += 1) {
          if (row[c]?.f != null) visitCell(row[c], r, c);
        }
      }
    } else if (file.celldata) {
      file.celldata.forEach((item) =>
        visitCell(item.v as Cell, item.r, item.c)
      );
    }
    const dv = file.dataVerification;
    if (dv) {
      Object.keys(dv).forEach((key) => {
        const item = dv[key];
        if (!item) return;
        (["value1", "value2"] as const).forEach((field) => {
          const v = item[field];
          if (!isFormulaString(v)) return;
          const next = fn(v, { kind: "dataVerification", sheetId });
          if (next !== v) {
            item[field] = next;
            count += 1;
          }
        });
      });
    }
    const cf = file.luckysheet_conditionformat_save;
    if (cf) {
      cf.forEach((rule: any) => {
        if (!rule || !Array.isArray(rule.conditionValue)) return;
        rule.conditionValue.forEach((v: unknown, k: number) => {
          if (!isFormulaString(v)) return;
          const next = fn(v, { kind: "conditionalFormat", sheetId });
          if (next !== v) {
            rule.conditionValue[k] = next;
            count += 1;
          }
        });
      });
    }
    const names = file.definedNames;
    if (names?.length) {
      let changed = false;
      const next = names.map((d) => {
        if (!isFormulaString(d.refersTo)) return d;
        const refersTo = fn(d.refersTo, { kind: "definedName", sheetId });
        if (refersTo === d.refersTo) return d;
        changed = true;
        count += 1;
        return { ...d, refersTo };
      });
      // a new array: the name index is memoised on the array identity
      if (changed) file.definedNames = next;
    }
  });
  if (count > 0 && ctx.formulaCache) {
    ctx.formulaCache.formulaCellInfoMap = null;
  }
  return count;
}

/** Whether any sheet of the workbook holds a formula. */
export function workbookHasFormulas(ctx: Context) {
  const files = ctx.luckysheetfile || [];
  for (let i = 0; i < files.length; i += 1) {
    const { data, celldata } = files[i];
    if (data) {
      for (let r = 0; r < data.length; r += 1) {
        const row = data[r];
        if (!row) continue;
        for (let c = 0; c < row.length; c += 1) {
          if (isFormulaString(row[c]?.f)) return true;
        }
      }
    } else if (celldata?.some((d) => isFormulaString((d.v as Cell)?.f))) {
      return true;
    }
  }
  return false;
}

/**
 * Recalculate every formula after a structural change (insert/delete of
 * rows, columns, cells or sheets, moves): references were rewritten and
 * position-dependent functions (ROW, COLUMN, OFFSET, ...) may now return
 * something else. Results are queued in `ctx.groupValuesRefreshData` like
 * any other recalculation.
 */
export function recalcAfterStructuralChange(ctx: Context) {
  finishReferenceChange();
  const fc = ctx.formulaCache;
  if (!fc) return;
  fc.formulaCellInfoMap = null;
  if (!workbookHasFormulas(ctx)) return;
  if (!ctx.groupValuesRefreshData) ctx.groupValuesRefreshData = [];
  fc.execFunctionExist = undefined;
  execFunctionGroup(
    ctx,
    null as any,
    null as any,
    null,
    ctx.currentSheetId,
    undefined,
    true
  );
  fc.execFunctionGlobalData = null;
}
