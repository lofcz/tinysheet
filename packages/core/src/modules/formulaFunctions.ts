/**
 * Workbook-aware formula functions and dynamic-array spill.
 *
 * 1. Reference arguments. Functions that need a *reference* (ROW, OFFSET,
 *    ISFORMULA, CELL, SUBTOTAL, ...) are registered with the parser's
 *    `setFunction` and declare `referenceParams`: a reference argument there
 *    reaches them unread, as a `createReference` descriptor (so ISFORMULA(B1)
 *    does not read B1, and an error in B1 does not abort it). OFFSET and
 *    INDIRECT (A1 or R1C1 text) return `createReference` values and declare
 *    `returnsReference`, so the parser uses them as references everywhere:
 *    range operands (`OFFSET(A1,1,0):C5`), `ROWS(OFFSET(...))`,
 *    `INDEX(INDIRECT(...),2)`, and reads them where a value is needed.
 *    The stored formula text is never changed. (The older string "reference
 *    markers" of `rewriteReferenceArgs` are still understood as references,
 *    through the parser's `resolveReference` event, but formulas are no longer
 *    rewritten before evaluation.)
 *
 * 2. Dependencies. INDIRECT/OFFSET/CELL/SUBTOTAL formulas are volatile, and
 *    every reference INDIRECT/OFFSET resolves to (plus the rectangle a spilled
 *    formula writes to) is recorded as a dynamic dependency of the formula
 *    cell, so the recalculation graph re-runs it when those cells change.
 *
 * 3. Dynamic-array spill. When a formula cell evaluates to a matrix bigger than
 *    1x1, the anchor keeps the formula and the top-left value, and the other
 *    values are written into the neighbouring cells as plain value cells
 *    carrying `spillFrom: { dr, dc }` (their offset from the anchor). The
 *    anchor carries `spill: { rs, cs, blocked? }`. If any target cell is not
 *    empty the anchor shows `#SPILL!`. Ghost writes are queued on
 *    `ctx.groupValuesRefreshData` (applied at the end of the same update) and
 *    mirrored into the recalculation overlay (`formulaCache.setGlobalCell`,
 *    formerly `execFunctionGlobalData`) so formulas evaluated in the same
 *    pass read the new values.
 */
import _ from "lodash";
import {
  createReference,
  error as parserError,
  isReference,
} from "@lofcz/tinysheet-formula-parser";
import type { Context } from "../context";
import { getFlowdata } from "../context";
import type { Cell, CellMatrix, FormulaDependency } from "../types";
import { columnCharToIndex, getSheetIndex, indexToColumnChar } from "../utils";
import { error as ERRORS, isRealNull, valueIsError } from "./validation";
import { setCellValue } from "./cell";
import { getSheetDataCached, peek, peekCell } from "./dependencyGraph";
import { expandFormulaNames, getNameDependencies } from "./names";
import { cellImageFromValue, isImageValue, sameImageValue } from "./cellImage";

// ---------------------------------------------------------------------------
// Types and per-workbook state
// ---------------------------------------------------------------------------

export type SpillAnchorInfo = { rs: number; cs: number; blocked?: boolean };
export type SpillCell = Cell & {
  spill?: SpillAnchorInfo;
  spillFrom?: { dr: number; dc: number };
};

export type RefRange = {
  sheetId: string;
  r1: number;
  c1: number;
  r2: number;
  c2: number;
};

type ChangedCell = { r: number; c: number; i: string };

type EvalFrame = {
  ctx: Context;
  r: number;
  c: number;
  sheetId: string;
  isCell: boolean;
  deps: FormulaDependency[];
  /** The formula being evaluated (with "="). */
  formula: string;
};

export type SpillGrowthRequest = {
  id: string;
  r: number;
  c: number;
  /** The anchor's formula. */
  f: string;
  /** Rows / columns the sheet needs (counts). */
  rows: number;
  cols: number;
};

type EngineState = {
  current: EvalFrame | null;
  dynamicDeps: Map<string, FormulaDependency[]>;
  staticDeps: Map<string, FormulaDependency[]>;
  spillChanges: ChangedCell[];
  propagationDepth: number;
  /** Spills past the sheet edge, waiting for the sheet to grow (spill.ts). */
  pendingGrowth: SpillGrowthRequest[];
  /** Set while spill.ts grows a sheet: no new growth requests. */
  growing: boolean;
};

const MAX_ROWS = 1048576;
const MAX_COLS = 16384;
const MAX_SPILL_PASSES = 8;

const states = new WeakMap<object, EngineState>();

function getState(ctx: Context): EngineState {
  const key = ctx.formulaCache as object;
  let state = states.get(key);
  if (!state) {
    state = {
      current: null,
      dynamicDeps: new Map(),
      staticDeps: new Map(),
      spillChanges: [],
      propagationDepth: 0,
      pendingGrowth: [],
      growing: false,
    };
    states.set(key, state);
  }
  return state;
}

function formulaKey(r: number, c: number, id: string) {
  return `r${r}c${c}i${id}`;
}

function errorValue(code: string) {
  return new Error(code);
}

const ERR_REF = "#REF!";
const ERR_VALUE = "#VALUE!";
const ERR_NA = "#N/A";
const ERR_DIV0 = "#DIV/0!";
const ERR_NUM = "#NUM!";

/** Normalise an Error (or error-looking value) to its Excel error string. */
export function toErrorString(e: any): string | null {
  if (e instanceof Error) {
    return (
      parserError(e.message) ||
      (valueIsError(e.message) ? e.message : "#ERROR!")
    );
  }
  if (_.isString(e) && valueIsError(e)) return e;
  return null;
}

function isErrorLike(v: any) {
  return v instanceof Error || (_.isString(v) && valueIsError(v));
}

function asError(v: any): Error {
  return v instanceof Error ? v : errorValue(v);
}

// ---------------------------------------------------------------------------
// Sheet helpers
// ---------------------------------------------------------------------------

function findSheetIdByName(ctx: Context, name: string): string | null {
  const lower = name.toLowerCase();
  const sheet = ctx.luckysheetfile.find(
    (f) => (f.name ?? "").toLowerCase() === lower
  );
  return sheet?.id ?? null;
}

function getSheet(ctx: Context, id: string) {
  const idx = getSheetIndex(ctx, id);
  return idx == null ? null : ctx.luckysheetfile[idx];
}

function orderedSheets(ctx: Context) {
  return ctx.luckysheetfile
    .map((f, i) => ({ f, i }))
    .sort((a, b) => (a.f.order ?? a.i) - (b.f.order ?? b.i) || a.i - b.i)
    .map((x) => x.f);
}

function sheetSize(ctx: Context, id: string) {
  const data = getFlowdata(ctx, id);
  const rows = data?.length ?? 0;
  const cols = data?.[0]?.length ?? 0;
  return { rows, cols };
}

export function quoteSheetName(name: string) {
  if (/^[A-Za-z_À-ʯ][A-Za-z0-9_.À-ʯ]*$/.test(name)) {
    // Names that look like a cell (A1) or R1C1 reference must be quoted too.
    if (!/^[A-Za-z]{1,3}\d+$/.test(name) && !/^R\d*C\d*$/i.test(name)) {
      return name;
    }
  }
  return `'${name.replace(/'/g, "''")}'`;
}

function a1Address(r: number, c: number, absRow = true, absCol = true) {
  return `${absCol ? "$" : ""}${indexToColumnChar(c)}${absRow ? "$" : ""}${
    r + 1
  }`;
}

// ---------------------------------------------------------------------------
// Reference parsing (A1 and R1C1)
// ---------------------------------------------------------------------------

// Unquoted sheet names cannot contain spaces or operator characters.
const SHEET_PREFIX_RE = /^(?:'((?:[^']|'')+)'|([^'!:\s()+\-*/&^,;=<>"]+))!/;

function splitSheetPrefix(text: string): [string | null, string] {
  const m = text.match(SHEET_PREFIX_RE);
  if (!m) return [null, text];
  const name = m[1] != null ? m[1].replace(/''/g, "'") : m[2];
  return [name, text.slice(m[0].length)];
}

type Part = { r: number | null; c: number | null };

function parseA1Part(text: string): Part | null {
  let m = text.match(/^\$?([A-Za-z]{1,3})\$?(\d+)$/);
  if (m) {
    const c = columnCharToIndex(m[1]);
    const r = parseInt(m[2], 10) - 1;
    if (Number.isNaN(c) || r < 0 || r >= MAX_ROWS || c >= MAX_COLS) {
      return null;
    }
    return { r, c };
  }
  m = text.match(/^\$?([A-Za-z]{1,3})$/);
  if (m) {
    const c = columnCharToIndex(m[1]);
    if (Number.isNaN(c) || c >= MAX_COLS) return null;
    return { r: null, c };
  }
  m = text.match(/^\$?(\d+)$/);
  if (m) {
    const r = parseInt(m[1], 10) - 1;
    if (r < 0 || r >= MAX_ROWS) return null;
    return { r, c: null };
  }
  return null;
}

function parseR1C1Part(text: string, baseR: number, baseC: number) {
  const m = text.match(
    /^(?:R(?:\[(-?\d+)\]|(\d+))?)?(?:C(?:\[(-?\d+)\]|(\d+))?)?$/i
  );
  if (!m || text.length === 0) return null;
  const hasR = /^R/i.test(text);
  const hasC = /C/i.test(text.replace(/^R(\[-?\d+\]|\d+)?/i, ""));
  if (!hasR && !hasC) return null;
  let r: number | null = null;
  let c: number | null = null;
  if (hasR) {
    if (m[1] != null) r = baseR + parseInt(m[1], 10);
    else if (m[2] != null) r = parseInt(m[2], 10) - 1;
    else r = baseR;
  }
  if (hasC) {
    if (m[3] != null) c = baseC + parseInt(m[3], 10);
    else if (m[4] != null) c = parseInt(m[4], 10) - 1;
    else c = baseC;
  }
  if (
    (r != null && (r < 0 || r >= MAX_ROWS)) ||
    (c != null && (c < 0 || c >= MAX_COLS))
  ) {
    return null;
  }
  return { r, c };
}

/**
 * Parse a textual reference (`A1`, `$A$1:B2`, `Sheet2!A:A`, `'My Sheet'!3:5`,
 * or R1C1 when `a1` is false) relative to the given sheet and cell.
 */
export function parseReference(
  ctx: Context,
  text: string,
  defaultSheetId: string,
  a1 = true,
  baseR = 0,
  baseC = 0
): RefRange | null {
  if (!_.isString(text)) return null;
  let rest = text.trim();
  if (!rest) return null;
  const [sheetName, afterSheet] = splitSheetPrefix(rest);
  let sheetId = defaultSheetId;
  if (sheetName != null) {
    const id = findSheetIdByName(ctx, sheetName);
    if (id == null) return null;
    sheetId = id;
  }
  rest = afterSheet;
  const pieces = rest.split(":");
  if (pieces.length > 2) return null;
  const parts: Part[] = [];
  for (let i = 0; i < pieces.length; i += 1) {
    let piece = pieces[i];
    if (i === 1) {
      const [sheet2, after2] = splitSheetPrefix(piece);
      if (sheet2 != null) {
        if (findSheetIdByName(ctx, sheet2) !== sheetId) return null;
        piece = after2;
      }
    }
    const part = a1 ? parseA1Part(piece) : parseR1C1Part(piece, baseR, baseC);
    if (!part) return null;
    parts.push(part);
  }
  const [p1, p2 = p1] = parts;
  // A single row-only or column-only part is not a reference (`A`, `5`) in A1
  // style; in R1C1 style `R2` / `C3` mean the whole row / column.
  if (parts.length === 1 && a1 && (p1.r == null || p1.c == null)) return null;
  if ((p1.r == null) !== (p2.r == null) || (p1.c == null) !== (p2.c == null)) {
    return null;
  }
  const { rows, cols } = sheetSize(ctx, sheetId);
  const r1 = p1.r ?? 0;
  const r2 = p2.r ?? Math.max(rows - 1, 0);
  const c1 = p1.c ?? 0;
  const c2 = p2.c ?? Math.max(cols - 1, 0);
  return {
    sheetId,
    r1: Math.min(r1, r2),
    r2: Math.max(r1, r2),
    c1: Math.min(c1, c2),
    c2: Math.max(c1, c2),
  };
}

// ---------------------------------------------------------------------------
// Reference markers (legacy)
//
// Formulas are no longer rewritten before evaluation (reference arguments
// travel as parser references, see the module comment). The marker helpers
// stay for callers of `rewriteReferenceArgs`: a marker string still acts as
// a reference (the parser's `resolveReference` event).
// ---------------------------------------------------------------------------

const MARKER = "\u0001TSREF:";

function refToDependency(ref: RefRange): FormulaDependency {
  return {
    row: [ref.r1, ref.r2],
    column: [ref.c1, ref.c2],
    sheetId: ref.sheetId,
  };
}

export function encodeRef(ref: RefRange | null) {
  if (!ref) return `${MARKER}${ERR_REF}`;
  return `${MARKER}${ref.r1},${ref.c1},${ref.r2},${ref.c2},${encodeURIComponent(
    ref.sheetId
  )}`;
}

export function isRefMarker(v: any): v is string {
  return _.isString(v) && v.startsWith(MARKER);
}

/** Decode a marker to a range; returns an Error for #REF! markers. */
export function decodeRef(v: any): RefRange | Error | null {
  if (!isRefMarker(v)) return null;
  const payload = v.slice(MARKER.length);
  if (payload === ERR_REF) return errorValue(ERR_REF);
  const parts = payload.split(",");
  if (parts.length !== 5) return errorValue(ERR_REF);
  const [r1, c1, r2, c2] = parts.slice(0, 4).map((x) => parseInt(x, 10));
  return { r1, c1, r2, c2, sheetId: decodeURIComponent(parts[4]) };
}

// ---------------------------------------------------------------------------
// Formula tokenizer / rewriter
// ---------------------------------------------------------------------------

type TokType = "str" | "ref" | "func" | "lp" | "rp" | "sep" | "ws" | "other";
type Tok = { t: TokType; s: string };

const SHEET_PART = "(?:[A-Za-z0-9_\\u00C0-\\u02AF]+|'(?:[^']|'')+')!";
const CELL_PART = "\\$?[A-Za-z]{1,3}\\$?\\d+";
const REF_RE = new RegExp(
  `^(?:${SHEET_PART})?(?:${CELL_PART}(?::(?:${SHEET_PART})?${CELL_PART})?|\\$?[A-Za-z]{1,3}:\\$?[A-Za-z]{1,3}|\\$?\\d+:\\$?\\d+)(?![A-Za-z0-9_.(!$])`
);
const IDENT_RE = /^[A-Za-z_\\\u00C0-\u02AF][A-Za-z0-9_.\u00C0-\u02AF]*/;
const NUMBER_RE = /^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/;
const ERROR_RE = /^#[A-Za-z0-9/]+[!?]?/;

/** Match an anchored regex at position i. */
function matchAt(re: RegExp, s: string, i: number) {
  const m = re.exec(s.slice(i));
  return m ? m[0] : null;
}

export function tokenizeFormula(s: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) {
      let j = i + 1;
      while (j < s.length && /\s/.test(s[j])) j += 1;
      toks.push({ t: "ws", s: s.slice(i, j) });
      i = j;
      continue;
    }
    if (ch === '"') {
      let j = i + 1;
      while (j < s.length) {
        if (s[j] === "\\" && s[j + 1] === '"') j += 2;
        else if (s[j] === '"' && s[j + 1] === '"') j += 2;
        else if (s[j] === '"') break;
        else j += 1;
      }
      toks.push({ t: "str", s: s.slice(i, j + 1) });
      i = j + 1;
      continue;
    }
    const ref = matchAt(REF_RE, s, i);
    if (ref) {
      toks.push({ t: "ref", s: ref });
      i += ref.length;
      continue;
    }
    if (ch === "'") {
      let j = i + 1;
      while (j < s.length) {
        if (s[j] === "'" && s[j + 1] === "'") j += 2;
        else if (s[j] === "'") break;
        else j += 1;
      }
      toks.push({ t: "str", s: s.slice(i, j + 1) });
      i = j + 1;
      continue;
    }
    if (ch === "(") {
      toks.push({ t: "lp", s: ch });
      i += 1;
      continue;
    }
    if (ch === ")") {
      toks.push({ t: "rp", s: ch });
      i += 1;
      continue;
    }
    if (ch === "," || ch === ";") {
      toks.push({ t: "sep", s: ch });
      i += 1;
      continue;
    }
    if (ch === "#") {
      const err = matchAt(ERROR_RE, s, i);
      if (err) {
        toks.push({ t: "other", s: err });
        i += err.length;
        continue;
      }
    }
    const num = matchAt(NUMBER_RE, s, i);
    if (num) {
      toks.push({ t: "other", s: num });
      i += num.length;
      continue;
    }
    const ident = matchAt(IDENT_RE, s, i);
    if (ident) {
      toks.push({
        t: s[i + ident.length] === "(" ? "func" : "other",
        s: ident,
      });
      i += ident.length;
      continue;
    }
    toks.push({ t: "other", s: ch });
    i += 1;
  }
  return toks;
}

type Node =
  | { kind: "tok"; tok: Tok }
  | { kind: "group"; open: string; body: Node[]; close: string }
  | {
      kind: "call";
      name: string;
      args: Node[][];
      seps: string[];
      close: string;
    };

function parseNodes(
  toks: Tok[],
  start: number,
  closer: "rp" | "}" | null
): [Node[], number, boolean] {
  const nodes: Node[] = [];
  let i = start;
  while (i < toks.length) {
    const tok = toks[i];
    if (closer === "rp" && tok.t === "rp") return [nodes, i + 1, true];
    if (closer === "}" && tok.t === "other" && tok.s === "}") {
      return [nodes, i + 1, true];
    }
    if (tok.t === "func" && toks[i + 1]?.t === "lp") {
      const [body, next, closed] = parseNodes(toks, i + 2, "rp");
      const args: Node[][] = [[]];
      const seps: string[] = [];
      body.forEach((n) => {
        if (n.kind === "tok" && n.tok.t === "sep") {
          seps.push(n.tok.s);
          args.push([]);
        } else {
          args[args.length - 1].push(n);
        }
      });
      nodes.push({
        kind: "call",
        name: tok.s,
        args,
        seps,
        close: closed ? ")" : "",
      });
      i = next;
      continue;
    }
    if (tok.t === "lp") {
      const [body, next, closed] = parseNodes(toks, i + 1, "rp");
      nodes.push({ kind: "group", open: "(", body, close: closed ? ")" : "" });
      i = next;
      continue;
    }
    if (tok.t === "other" && tok.s === "{") {
      const [body, next, closed] = parseNodes(toks, i + 1, "}");
      // Separators inside array constants are not argument separators.
      nodes.push({ kind: "group", open: "{", body, close: closed ? "}" : "" });
      i = next;
      continue;
    }
    nodes.push({ kind: "tok", tok });
    i += 1;
  }
  return [nodes, i, false];
}

/** Argument positions that take a reference, per function. */
function refArgPositions(name: string): ((k: number) => boolean) | null {
  switch (name) {
    case "ROW":
    case "COLUMN":
    case "ROWS":
    case "COLUMNS":
    case "ISREF":
    case "ISFORMULA":
    case "FORMULATEXT":
    case "OFFSET":
    case "SHEET":
    case "SHEETS":
    case "TSREF.OFFSET":
      return (k) => k === 0;
    case "CELL":
      return (k) => k === 1;
    case "SUBTOTAL":
      return (k) => k >= 1;
    default:
      return null;
  }
}

const REF_RETURNING: Record<string, string> = {
  OFFSET: "TSREF.OFFSET",
  INDIRECT: "TSREF.INDIRECT",
};

type RewriteEnv = {
  ctx: Context;
  sheetId: string;
  changed: boolean;
};

function serialize(nodes: Node[], env: RewriteEnv): string {
  // eslint-disable-next-line no-use-before-define
  return nodes.map((n) => serializeNode(n, env)).join("");
}

function serializeNode(n: Node, env: RewriteEnv, rename?: string): string {
  if (n.kind === "tok") return n.tok.s;
  if (n.kind === "group") return n.open + serialize(n.body, env) + n.close;
  const upper = (rename ?? n.name).toUpperCase();
  const isRefArg = refArgPositions(upper);
  let out = `${rename ?? n.name}(`;
  n.args.forEach((arg, k) => {
    if (k > 0) out += n.seps[k - 1];
    if (isRefArg?.(k)) {
      const meaningful = arg.filter(
        (x) => !(x.kind === "tok" && x.tok.t === "ws")
      );
      if (meaningful.length === 1) {
        const only = meaningful[0];
        if (only.kind === "tok" && only.tok.t === "ref") {
          const ref = parseReference(env.ctx, only.tok.s, env.sheetId);
          env.changed = true;
          out += `"${encodeRef(ref)}"`;
          return;
        }
        if (only.kind === "call" && REF_RETURNING[only.name.toUpperCase()]) {
          env.changed = true;
          out += serializeNode(
            only,
            env,
            REF_RETURNING[only.name.toUpperCase()]
          );
          return;
        }
      }
    }
    out += serialize(arg, env);
  });
  return out + n.close;
}

const REWRITE_HINT =
  /(ROWS?|COLUMNS?|ISREF|ISFORMULA|FORMULATEXT|CELL|OFFSET|SUBTOTAL|SHEETS?)\s*\(/i;

/**
 * Rewrite reference arguments of reference-taking functions into markers.
 * `expr` is the formula without the leading "=". Legacy: evaluation no
 * longer needs it, but rewritten formulas still evaluate the same.
 */
export function rewriteReferenceArgs(
  ctx: Context,
  expr: string,
  sheetId: string
): string {
  if (!REWRITE_HINT.test(expr)) return expr;
  const toks = tokenizeFormula(expr);
  const [nodes] = parseNodes(toks, 0, null);
  const env: RewriteEnv = { ctx, sheetId, changed: false };
  const out = serialize(nodes, env);
  return env.changed ? out : expr;
}

/** All references written in a formula, as dependency ranges. */
export function extractStaticReferences(
  ctx: Context,
  formula: string,
  sheetId: string
): FormulaDependency[] {
  const expr = formula.startsWith("=") ? formula.slice(1) : formula;
  const deps: FormulaDependency[] = [];
  tokenizeFormula(expr).forEach((tok) => {
    if (tok.t !== "ref") return;
    const ref = parseReference(ctx, tok.s, sheetId);
    if (ref) deps.push(refToDependency(ref));
  });
  return deps;
}

// ---------------------------------------------------------------------------
// Cell access
// ---------------------------------------------------------------------------

function readCell(
  ctx: Context,
  sheetId: string,
  r: number,
  c: number
): SpillCell | null {
  const g = ctx.formulaCache.getGlobalCell(r, c, sheetId);
  if (g) return g;
  return (getFlowdata(ctx, sheetId)?.[r]?.[c] as SpillCell) ?? null;
}

function isEmptyCell(cell: SpillCell | null | undefined) {
  if (!cell) return true;
  if (cell.f || cell.img) return false;
  if (cell.ct?.t === "inlineStr" && !_.isEmpty(cell.ct.s)) return false;
  return isRealNull(cell.v);
}

export function isGhostOf(
  cell: SpillCell | null | undefined,
  r: number,
  c: number,
  ar: number,
  ac: number
) {
  const from = cell?.spillFrom;
  return !!from && r - from.dr === ar && c - from.dc === ac;
}

function anchorOfGhost(ctx: Context, sheetId: string, r: number, c: number) {
  const cell = getFlowdata(ctx, sheetId)?.[r]?.[c] as SpillCell | undefined;
  if (!cell?.spillFrom) return null;
  const ar = r - cell.spillFrom.dr;
  const ac = c - cell.spillFrom.dc;
  const anchor = getFlowdata(ctx, sheetId)?.[ar]?.[ac] as SpillCell | undefined;
  return anchor?.f ? { r: ar, c: ac, cell: anchor } : null;
}

// ---------------------------------------------------------------------------
// Workbook functions
// ---------------------------------------------------------------------------

type ParserRef = {
  sheetName?: string;
  startRow: number;
  startColumn: number;
  endRow: number;
  endColumn: number;
} | null;

type Fn = (args: any[], frame: EvalFrame, refs?: ParserRef[]) => any;

/**
 * The range a reference parameter stands for: a parser reference descriptor
 * (`createReference`, 0-based, -1 = whole row/column span, bounded here to
 * the sheet's size) or a legacy reference marker. null for other values.
 */
function refOf(v: any, frame: EvalFrame): RefRange | Error | null {
  if (isReference(v)) {
    const sheetId =
      v.sheetName == null
        ? frame.sheetId
        : findSheetIdByName(frame.ctx, v.sheetName);
    if (sheetId == null) return errorValue(ERR_REF);
    const whole = (start: number, end: number, size: number) =>
      start < 0 || end < 0 ? [0, Math.max(size - 1, 0)] : [start, end];
    const { rows, cols } = sheetSize(frame.ctx, sheetId);
    const [r1, r2] = whole(v.startRow, v.endRow, rows);
    const [c1, c2] = whole(v.startColumn, v.endColumn, cols);
    return { sheetId, r1, c1, r2, c2 };
  }
  return decodeRef(v);
}

function refArg(v: any, frame: EvalFrame): RefRange | Error {
  if (v instanceof Error) return v;
  if (isErrorLike(v)) return asError(v);
  const ref = refOf(v, frame);
  if (ref == null) return errorValue(ERR_VALUE);
  return ref;
}

/** A range as a parser reference (null sheet name = the formula's sheet). */
function toParserReference(frame: EvalFrame, ref: RefRange) {
  return createReference({
    sheetName:
      ref.sheetId === frame.sheetId
        ? null
        : getSheet(frame.ctx, ref.sheetId)?.name ?? null,
    startRow: ref.r1,
    startColumn: ref.c1,
    endRow: ref.r2,
    endColumn: ref.c2,
  });
}

function toNumberArg(v: any, fallback?: number): number | Error {
  if (v == null || v === "") {
    if (fallback != null) return fallback;
    return 0;
  }
  if (v instanceof Error) return v;
  if (isErrorLike(v)) return asError(v);
  if (Array.isArray(v)) return toNumberArg(_.flattenDeep(v)[0], fallback);
  if (typeof v === "boolean") return v ? 1 : 0;
  const n = Number(v);
  if (Number.isNaN(n)) return errorValue(ERR_VALUE);
  return n;
}

function toBoolArg(v: any, fallback: boolean): boolean | Error {
  if (v == null || v === "") return fallback;
  if (v instanceof Error) return v;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (_.isString(v)) {
    const u = v.toUpperCase();
    if (u === "TRUE") return true;
    if (u === "FALSE") return false;
    const n = Number(v);
    if (!Number.isNaN(n)) return n !== 0;
  }
  return errorValue(ERR_VALUE);
}

function recordDependency(frame: EvalFrame, ref: RefRange) {
  frame.deps.push(refToDependency(ref));
}

function resolveIndirect(args: any[], frame: EvalFrame): RefRange | Error {
  const [text, a1Arg] = args;
  if (text instanceof Error) return text;
  if (isRefMarker(text)) return refArg(text, frame);
  if (!_.isString(text)) return errorValue(ERR_REF);
  const a1 = toBoolArg(a1Arg, true);
  if (a1 instanceof Error) return a1;
  let ref = parseReference(
    frame.ctx,
    text,
    frame.sheetId,
    a1,
    frame.r,
    frame.c
  );
  if (!ref && a1) {
    // a defined name or a structured reference (INDIRECT("Sales"),
    // INDIRECT("Table1[Qty]"), INDIRECT("[@Qty]")) that stands for a
    // reference, resolved from the formula's cell
    const trimmed = text.trim();
    const expanded = expandFormulaNames(
      frame.ctx,
      trimmed,
      frame.sheetId,
      frame.isCell ? frame.r : null,
      frame.isCell ? frame.c : null
    );
    if (expanded !== trimmed) {
      ref = parseReference(frame.ctx, expanded, frame.sheetId, true);
    }
  }
  if (!ref) return errorValue(ERR_REF);
  recordDependency(frame, ref);
  return ref;
}

function resolveOffset(args: any[], frame: EvalFrame): RefRange | Error {
  const base = refArg(args[0], frame);
  if (base instanceof Error) return base;
  const rows = toNumberArg(args[1]);
  if (rows instanceof Error) return rows;
  const cols = toNumberArg(args[2]);
  if (cols instanceof Error) return cols;
  const height = toNumberArg(args[3], base.r2 - base.r1 + 1);
  if (height instanceof Error) return height;
  const width = toNumberArg(args[4], base.c2 - base.c1 + 1);
  if (width instanceof Error) return width;
  const h = Math.trunc(height);
  const w = Math.trunc(width);
  if (h === 0 || w === 0) return errorValue(ERR_REF);
  const top = base.r1 + Math.trunc(rows);
  const left = base.c1 + Math.trunc(cols);
  // Negative height/width extend up/left from the offset cell (Excel 365).
  const r1 = h > 0 ? top : top + h + 1;
  const r2 = h > 0 ? top + h - 1 : top;
  const c1 = w > 0 ? left : left + w + 1;
  const c2 = w > 0 ? left + w - 1 : left;
  if (r1 < 0 || c1 < 0 || r2 >= MAX_ROWS || c2 >= MAX_COLS) {
    return errorValue(ERR_REF);
  }
  const ref = { sheetId: base.sheetId, r1, c1, r2, c2 };
  recordDependency(frame, ref);
  return ref;
}

function perCell(
  ref: RefRange,
  fn: (r: number, c: number) => any
): any | any[][] {
  if (ref.r1 === ref.r2 && ref.c1 === ref.c2) return fn(ref.r1, ref.c1);
  const out: any[][] = [];
  for (let r = ref.r1; r <= ref.r2; r += 1) {
    const row: any[] = [];
    for (let c = ref.c1; c <= ref.c2; c += 1) row.push(fn(r, c));
    out.push(row);
  }
  return out;
}

function formulaOfCell(ctx: Context, sheetId: string, r: number, c: number) {
  // execFunctionGlobalData holds the cells edited in this recalculation.
  const cell = readCell(ctx, sheetId, r, c);
  if (cell?.f) return cell.f;
  const anchor = anchorOfGhost(ctx, sheetId, r, c);
  return anchor?.cell.f ?? null;
}

function hiddenRowSets(ctx: Context, sheetId: string) {
  const sheet = getSheet(ctx, sheetId);
  const isCurrent = sheetId === ctx.currentSheetId;
  const rowhidden: Record<string, number> = {
    ...(sheet?.config?.rowhidden || {}),
    ...((isCurrent && ctx.config?.rowhidden) || {}),
  };
  const filtered: Record<string, number> = {};
  const addFilter = (filter: any) => {
    _.forEach(filter || {}, (f: any) => Object.assign(filtered, f?.rowhidden));
  };
  addFilter(sheet?.filter);
  if (isCurrent) addFilter(ctx.filter);
  return { rowhidden, filtered };
}

function isSubtotalFormula(f: string | null | undefined) {
  return !!f && /(^|[^A-Za-z0-9_.])(SUBTOTAL|AGGREGATE)\s*\(/i.test(f);
}

function subtotalCompute(fn: number, values: any[]): any {
  const err = values.find(isErrorLike);
  if (err !== undefined) return asError(err);
  const nums = values.filter(
    (v) => typeof v === "number" && Number.isFinite(v)
  ) as number[];
  const n = nums.length;
  const sum = nums.reduce((a, b) => a + b, 0);
  const variance = (sample: boolean) => {
    const mean = sum / n;
    const sq = nums.reduce((a, b) => a + (b - mean) ** 2, 0);
    return sq / (sample ? n - 1 : n);
  };
  switch (fn) {
    case 1:
      return n ? sum / n : errorValue(ERR_DIV0);
    case 2:
      return n;
    case 3:
      return values.filter((v) => v != null && v !== "").length;
    case 4:
      return n ? Math.max(...nums) : 0;
    case 5:
      return n ? Math.min(...nums) : 0;
    case 6:
      return n ? nums.reduce((a, b) => a * b, 1) : 0;
    case 7:
      return n > 1 ? Math.sqrt(variance(true)) : errorValue(ERR_DIV0);
    case 8:
      return n > 0 ? Math.sqrt(variance(false)) : errorValue(ERR_DIV0);
    case 9:
      return sum;
    case 10:
      return n > 1 ? variance(true) : errorValue(ERR_DIV0);
    case 11:
      return n > 0 ? variance(false) : errorValue(ERR_DIV0);
    default:
      return errorValue(ERR_VALUE);
  }
}

function formatCode(fa: string | undefined) {
  if (!fa || fa === "General") return "G";
  if (fa === "@") return "@";
  const dec = (fa.split(".")[1] || "").replace(/[^0#]/g, "").length;
  if (/[ymdhs]/i.test(fa)) {
    if (/h/i.test(fa)) return "D9";
    if (/y/i.test(fa) && /d/i.test(fa)) return "D1";
    return "D3";
  }
  if (fa.includes("%")) return `P${dec}`;
  if (/[Ee]\+/.test(fa)) return `S${dec}`;
  if (/[$¥€£]/.test(fa)) return `C${dec}`;
  if (fa.includes(",")) return `,${dec}`;
  return `F${dec}`;
}

/**
 * formulajs recognises errors by identity, so errors produced outside it
 * (Error objects from these functions or from array functions) would slip
 * through IFERROR & co. These wrappers handle Error instances and otherwise
 * return undefined, which falls back to the parser's implementation.
 */
function errorAware(fn: (err: Error, args: any[]) => any): Fn {
  return (args) => (args[0] instanceof Error ? fn(args[0], args) : undefined);
}

const allFunctions: Record<string, Fn> = {
  IFERROR: errorAware((_e, args) => args[1] ?? 0),
  IFNA: errorAware((e, args) =>
    toErrorString(e) === ERR_NA ? args[1] ?? 0 : e
  ),
  ISERROR: errorAware(() => true),
  ISERR: errorAware((e) => toErrorString(e) !== ERR_NA),
  ISNA: errorAware((e) => toErrorString(e) === ERR_NA),
  ROW(args, frame) {
    if (args.length === 0 || args[0] == null) return frame.r + 1;
    const ref = refArg(args[0], frame);
    if (ref instanceof Error) return ref;
    if (ref.r1 === ref.r2) return ref.r1 + 1;
    return _.range(ref.r1, ref.r2 + 1).map((r) => [r + 1]);
  },
  COLUMN(args, frame) {
    if (args.length === 0 || args[0] == null) return frame.c + 1;
    const ref = refArg(args[0], frame);
    if (ref instanceof Error) return ref;
    if (ref.c1 === ref.c2) return ref.c1 + 1;
    return [_.range(ref.c1, ref.c2 + 1).map((c) => c + 1)];
  },
  ROWS(args, frame) {
    const v = args[0];
    if (v instanceof Error) return v;
    const ref = refOf(v, frame);
    if (ref instanceof Error) return ref;
    if (ref) return ref.r2 - ref.r1 + 1;
    if (Array.isArray(v)) return Array.isArray(v[0]) ? v.length : 1;
    return 1;
  },
  COLUMNS(args, frame) {
    const v = args[0];
    if (v instanceof Error) return v;
    const ref = refOf(v, frame);
    if (ref instanceof Error) return ref;
    if (ref) return ref.c2 - ref.c1 + 1;
    if (Array.isArray(v)) return Array.isArray(v[0]) ? v[0].length : v.length;
    return 1;
  },
  ISREF(args, frame) {
    const ref = refOf(args[0], frame);
    return !!ref && !(ref instanceof Error);
  },
  ISFORMULA(args, frame) {
    const ref = refArg(args[0], frame);
    if (ref instanceof Error) return ref;
    return perCell(
      ref,
      (r, c) => formulaOfCell(frame.ctx, ref.sheetId, r, c) != null
    );
  },
  FORMULATEXT(args, frame) {
    const ref = refArg(args[0], frame);
    if (ref instanceof Error) return ref;
    const f = formulaOfCell(frame.ctx, ref.sheetId, ref.r1, ref.c1);
    return f ?? errorValue(ERR_NA);
  },
  INDIRECT(args, frame) {
    const ref = resolveIndirect(args, frame);
    return ref instanceof Error ? ref : toParserReference(frame, ref);
  },
  OFFSET(args, frame) {
    const ref = resolveOffset(args, frame);
    return ref instanceof Error ? ref : toParserReference(frame, ref);
  },
  ADDRESS(args) {
    const row = toNumberArg(args[0]);
    if (row instanceof Error) return row;
    const col = toNumberArg(args[1]);
    if (col instanceof Error) return col;
    const abs = toNumberArg(args[2], 1);
    if (abs instanceof Error) return abs;
    const a1 = toBoolArg(args[3], true);
    if (a1 instanceof Error) return a1;
    const r = Math.trunc(row);
    const c = Math.trunc(col);
    const mode = Math.trunc(abs);
    if (r < 1 || c < 1 || r > MAX_ROWS || c > MAX_COLS) {
      return errorValue(ERR_VALUE);
    }
    if (mode < 1 || mode > 4) return errorValue(ERR_VALUE);
    const absRow = mode === 1 || mode === 2;
    const absCol = mode === 1 || mode === 3;
    const address = a1
      ? a1Address(r - 1, c - 1, absRow, absCol)
      : `R${absRow ? r : `[${r}]`}C${absCol ? c : `[${c}]`}`;
    const sheet = args[4];
    if (sheet instanceof Error) return sheet;
    if (sheet == null) return address;
    const name = String(sheet);
    return `${name === "" ? "" : quoteSheetName(name)}!${address}`;
  },
  SHEET(args, frame) {
    const sheets = orderedSheets(frame.ctx);
    const indexOf = (id: string) => sheets.findIndex((s) => s.id === id) + 1;
    if (args.length === 0 || args[0] == null) return indexOf(frame.sheetId);
    const v = args[0];
    if (v instanceof Error) return v;
    const ref = refOf(v, frame);
    if (ref instanceof Error) return ref;
    if (ref) return indexOf(ref.sheetId);
    if (_.isString(v)) {
      const id = findSheetIdByName(frame.ctx, v);
      return id == null ? errorValue(ERR_NA) : indexOf(id);
    }
    return errorValue(ERR_NA);
  },
  SHEETS(args, frame) {
    if (args.length === 0 || args[0] == null) {
      return frame.ctx.luckysheetfile.length;
    }
    const ref = refArg(args[0], frame);
    if (ref instanceof Error) return ref;
    return 1;
  },
  HYPERLINK(args) {
    const [link, friendly] = args;
    if (link instanceof Error) return link;
    if (friendly instanceof Error) return friendly;
    return friendly == null ? link ?? "" : friendly;
  },
  CELL(args, frame) {
    const info = args[0];
    if (info instanceof Error) return info;
    if (!_.isString(info)) return errorValue(ERR_VALUE);
    let ref: RefRange;
    if (args.length < 2 || args[1] == null) {
      ref = {
        sheetId: frame.sheetId,
        r1: frame.r,
        c1: frame.c,
        r2: frame.r,
        c2: frame.c,
      };
    } else {
      const decoded = refArg(args[1], frame);
      if (decoded instanceof Error) return decoded;
      ref = decoded;
    }
    const { ctx } = frame;
    const r = ref.r1;
    const c = ref.c1;
    const sheet = getSheet(ctx, ref.sheetId);
    const cell = readCell(ctx, ref.sheetId, r, c);
    switch (info.toLowerCase()) {
      case "address": {
        const address = a1Address(r, c);
        if (ref.sheetId === frame.sheetId) return address;
        return `${quoteSheetName(sheet?.name ?? "")}!${address}`;
      }
      case "row":
        return r + 1;
      case "col":
        return c + 1;
      case "contents": {
        const v = ctx.formulaCache.tryGetCellAsNumber(cell as Cell);
        return v ?? 0;
      }
      case "type": {
        if (isEmptyCell(cell)) return "b";
        const v = ctx.formulaCache.tryGetCellAsNumber(cell as Cell);
        return _.isString(v) && !valueIsError(v) ? "l" : "v";
      }
      case "filename":
        return `[Book1]${sheet?.name ?? ""}`;
      case "format":
        return formatCode(cell?.ct?.fa);
      case "prefix": {
        if (!_.isString(cell?.v) || isEmptyCell(cell)) return "";
        if (cell?.ht === 0) return "^";
        if (cell?.ht === 2) return '"';
        return "'";
      }
      case "protect":
        return 1;
      case "parentheses":
      case "color":
        return 0;
      case "width": {
        const px =
          (sheet?.config?.columnlen?.[c] as number | undefined) ??
          sheet?.defaultColWidth ??
          ctx.defaultcollen ??
          73;
        return Math.max(0, Math.round((px - 5) / 7));
      }
      default:
        return errorValue(ERR_VALUE);
    }
  },
  SUBTOTAL(args, frame) {
    const fnArg = toNumberArg(args[0]);
    if (fnArg instanceof Error) return fnArg;
    const code = Math.trunc(fnArg);
    const ignoreHidden = code >= 101 && code <= 111;
    const fn = ignoreHidden ? code - 100 : code;
    if (fn < 1 || fn > 11) return errorValue(ERR_VALUE);
    if (args.length < 2) return errorValue(ERR_VALUE);
    const values: any[] = [];
    for (let k = 1; k < args.length; k += 1) {
      const arg = args[k];
      const ref = refOf(arg, frame);
      if (ref instanceof Error) return ref;
      if (ref) {
        const { rowhidden, filtered } = hiddenRowSets(frame.ctx, ref.sheetId);
        for (let r = ref.r1; r <= ref.r2; r += 1) {
          if (r in filtered) continue;
          if (ignoreHidden && r in rowhidden) continue;
          for (let c = ref.c1; c <= ref.c2; c += 1) {
            const cell = readCell(frame.ctx, ref.sheetId, r, c);
            const f =
              cell?.f ?? formulaOfCell(frame.ctx, ref.sheetId, r, c) ?? null;
            if (isSubtotalFormula(f)) continue;
            values.push(
              frame.ctx.formulaCache.tryGetCellAsNumber(cell as Cell)
            );
          }
        }
      } else if (Array.isArray(arg)) {
        values.push(..._.flattenDeep(arg));
      } else {
        values.push(arg);
      }
    }
    return subtotalCompute(fn, values);
  },
  /**
   * AGGREGATE over references: options 0-3 skip nested SUBTOTAL/AGGREGATE,
   * options 1, 3, 5 and 7 skip hidden rows (by hand or by a filter). The
   * skipped cells are blanked and the parser's own AGGREGATE does the rest.
   */
  AGGREGATE(args, frame, refs) {
    if (!refs || refs.every((r) => r == null)) return undefined;
    const fnArg = toNumberArg(args[0]);
    if (fnArg instanceof Error) return undefined;
    const optArg = args[1] == null || args[1] === "" ? 0 : toNumberArg(args[1]);
    if (optArg instanceof Error) return undefined;
    const fn = Math.trunc(fnArg);
    const opt = Math.trunc(optArg);
    if (fn < 1 || fn > 19 || opt < 0 || opt > 7) return undefined;
    const ignoreHidden = opt % 2 === 1;
    const ignoreNested = opt <= 3;
    const params = args.slice();
    const last = fn <= 13 ? args.length - 1 : 2;
    for (let k = 2; k <= last; k += 1) {
      const ref = refs[k];
      if (ref && Array.isArray(args[k])) {
        const sheetId = ref.sheetName
          ? findSheetIdByName(frame.ctx, ref.sheetName)
          : frame.sheetId;
        if (sheetId != null) {
          const { rowhidden, filtered } = hiddenRowSets(frame.ctx, sheetId);
          const r0 = Math.max(ref.startRow, 0);
          const c0 = Math.max(ref.startColumn, 0);
          params[k] = (args[k] as any[]).map((row: any, i: number) => {
            const r = r0 + i;
            const hidden = r in rowhidden || r in filtered;
            if (ignoreHidden && hidden) return row.map(() => null);
            if (!ignoreNested) return row;
            return row.map((v: any, j: number) =>
              isSubtotalFormula(formulaOfCell(frame.ctx, sheetId, r, c0 + j))
                ? null
                : v
            );
          });
        }
      }
    }
    // no references left: the parser's AGGREGATE computes the result
    return frame.ctx.formulaCache.parser._callFunction("AGGREGATE", params, []);
  },
};

/** Functions implemented (or completed) by this module. */
export const WORKBOOK_FUNCTION_NAMES = [
  "ROW",
  "COLUMN",
  "ROWS",
  "COLUMNS",
  "ISREF",
  "ISFORMULA",
  "FORMULATEXT",
  "INDIRECT",
  "OFFSET",
  "ADDRESS",
  "SHEET",
  "SHEETS",
  "HYPERLINK",
  "CELL",
  "SUBTOTAL",
  "AGGREGATE",
];

/**
 * Reference parameters of the functions registered with `setFunction`
 * (see the module comment); the other functions of `allFunctions` complete
 * the parser's implementation through its `callFunction` event.
 */
const REFERENCE_PARAMS: Record<string, (k: number) => boolean> = {
  ROW: (k) => k === 0,
  COLUMN: (k) => k === 0,
  ROWS: (k) => k === 0,
  COLUMNS: (k) => k === 0,
  ISREF: (k) => k === 0,
  ISFORMULA: (k) => k === 0,
  FORMULATEXT: (k) => k === 0,
  SHEET: (k) => k === 0,
  SHEETS: (k) => k === 0,
  OFFSET: (k) => k === 0,
  INDIRECT: () => false,
  CELL: (k) => k === 1,
  SUBTOTAL: (k) => k >= 1,
};

/** Functions whose result is a reference (`createReference`). */
const RETURNS_REFERENCE = new Set(["OFFSET", "INDIRECT"]);

/** Aliases used by formulas rewritten with `rewriteReferenceArgs`. */
const LEGACY_ALIASES: Record<string, string> = {
  "TSREF.OFFSET": "OFFSET",
  "TSREF.INDIRECT": "INDIRECT",
};

const installedParsers = new WeakSet<object>();

function evalFrame(parser: any): EvalFrame | null {
  const ctx = parser.context as Context | undefined;
  if (!ctx) return null;
  return (
    getState(ctx).current ?? {
      ctx,
      r: 0,
      c: 0,
      sheetId: parser.options?.sheetId ?? ctx.currentSheetId,
      isCell: false,
      deps: [],
      formula: "",
    }
  );
}

/** Install the workbook-aware functions on a parser (idempotent). */
export function installWorkbookFunctions(parser: any) {
  if (!parser || installedParsers.has(parser)) return;
  installedParsers.add(parser);
  const register = (name: string, fnName: string) => {
    const fn = allFunctions[fnName];
    const hostFn: any = (params: any[], refs?: ParserRef[]) => {
      const frame = evalFrame(parser);
      // undefined: not handled here, the parser's own implementation runs.
      return frame ? fn(params ?? [], frame, refs) : undefined;
    };
    hostFn.referenceParams = REFERENCE_PARAMS[fnName];
    hostFn.returnsReference = RETURNS_REFERENCE.has(fnName);
    parser.setFunction(name, hostFn);
  };
  Object.keys(REFERENCE_PARAMS).forEach((name) => register(name, name));
  Object.entries(LEGACY_ALIASES).forEach(([alias, name]) =>
    register(alias, name)
  );
  parser.on(
    "callFunction",
    (
      name: string,
      params: any[],
      done: (v: any) => void,
      refs?: ParserRef[]
    ) => {
      const upper = String(name).toUpperCase();
      if (REFERENCE_PARAMS[upper] || LEGACY_ALIASES[upper]) return;
      const fn = allFunctions[upper];
      if (!fn) return;
      const frame = evalFrame(parser);
      if (!frame) return;
      const result = fn(params ?? [], frame, refs);
      // undefined: not handled here, the parser's own implementation runs.
      if (result !== undefined) done(result);
    }
  );
  // legacy reference markers (`rewriteReferenceArgs`) are references too
  parser.on(
    "resolveReference",
    (value: any, _options: any, done: (v: any) => void) => {
      if (!isRefMarker(value)) return;
      const frame = evalFrame(parser);
      const ref = frame && decodeRef(value);
      if (frame && ref && !(ref instanceof Error)) {
        done(toParserReference(frame, ref));
      }
    }
  );
}

// ---------------------------------------------------------------------------
// Evaluation lifecycle (called from execfunction)
// ---------------------------------------------------------------------------

/**
 * Called by execfunction before parsing. Returns the expression (without
 * "=") to hand to the parser.
 */
export function prepareFormulaEvaluation(
  ctx: Context,
  txt: string,
  r: number,
  c: number,
  id: string,
  isrefresh?: boolean
): string {
  installWorkbookFunctions(ctx.formulaCache.parser);
  const state = getState(ctx);
  const hasCell = !_.isNil(r) && !_.isNil(c);
  const isCell =
    hasCell &&
    (!!isrefresh ||
      // read-only peek: no immer draft per evaluated formula
      (peekCell(getSheetDataCached(ctx, id), r, c) as Cell)?.f === txt);
  state.current = {
    ctx,
    r: hasCell ? r : 0,
    c: hasCell ? c : 0,
    sheetId: id,
    isCell,
    deps: [],
    formula: txt,
  };
  // defined names and table references become plain references (names.ts)
  let expr = expandFormulaNames(ctx, txt.substring(1), id, r, c);
  // eslint-disable-next-line no-use-before-define
  if (SPILL_REF_HINT.test(expr)) expr = rewriteSpillReferences(ctx, expr, id);
  return expr;
}

/**
 * Called by execfunction after parsing, with the formula value (or error
 * string). Spills matrices from formula cells and records dynamic
 * dependencies. Returns the value to store in the formula cell.
 */
export function finishFormulaEvaluation(
  ctx: Context,
  value: any,
  r: number,
  c: number,
  id: string
): any {
  const state = getState(ctx);
  const frame = state.current;
  state.current = null;
  if (!frame?.isCell || _.isNil(r) || _.isNil(c)) {
    return value;
  }
  const deps = frame.deps.slice();
  // eslint-disable-next-line no-use-before-define
  const result = spillResult(ctx, state, value, r, c, id, frame.formula);
  const key = formulaKey(r, c, id);
  if (deps.length > 0) state.dynamicDeps.set(key, deps);
  else state.dynamicDeps.delete(key);
  return result;
}

// ---------------------------------------------------------------------------
// Dependency hooks (called from execFunctionGroup)
// ---------------------------------------------------------------------------

const VOLATILE_RE =
  /(^|[^A-Za-z0-9_.])(INDIRECT|OFFSET|CELL|SUBTOTAL|AGGREGATE)\s*\(/i;
const OFFSET_LIKE_RE = /(INDIRECT|OFFSET|INDEX)\(/i;

/** Formulas that must be re-evaluated on every recalculation. */
export function isVolatileFormula(formula: string | undefined | null) {
  return !!formula && VOLATILE_RE.test(formula);
}

/**
 * Dependencies of a formula cell for the recalculation graph: the static
 * ones, plus references resolved at run time (INDIRECT/OFFSET targets and
 * the spill rectangle).
 */
export function getFormulaDependencies(
  ctx: Context,
  formulaObject: {
    formulaDependency: FormulaDependency[];
    calc_funcStr?: string;
    key?: string;
    r?: number;
    c?: number;
    id?: string;
  }
): FormulaDependency[] {
  const state = states.get(ctx.formulaCache as object);
  let deps = formulaObject.formulaDependency;
  const f = formulaObject.calc_funcStr;
  const { id } = formulaObject;
  // formulaHelper only tracks INDIRECT/OFFSET/INDEX formulas through the
  // legacy special-reference path, which drops their plain references.
  if (f && id && OFFSET_LIKE_RE.test(f)) {
    const st = getState(ctx);
    const cacheKey = `${id}|${f}`;
    let extra = st.staticDeps.get(cacheKey);
    if (!extra) {
      extra = extractStaticReferences(ctx, f, id);
      st.staticDeps.set(cacheKey, extra);
    }
    if (extra.length) deps = deps.concat(extra);
  }
  const key =
    formulaObject.key ??
    (formulaObject.r != null && formulaObject.c != null && id
      ? formulaKey(formulaObject.r, formulaObject.c, id)
      : null);
  const dynamic = key ? state?.dynamicDeps.get(key) : undefined;
  if (dynamic?.length) deps = deps.concat(dynamic);
  if (formulaObject.r != null && formulaObject.c != null && id) {
    // eslint-disable-next-line no-use-before-define
    const area = spillAreaDependencies(
      ctx,
      formulaObject.r,
      formulaObject.c,
      id
    );
    if (area) deps = deps.concat(area);
  }
  // cells behind defined names / structured references (names.ts)
  if (f && id) {
    const named = getNameDependencies(
      ctx,
      f,
      id,
      formulaObject.r,
      formulaObject.c
    );
    if (named.length) deps = deps.concat(named);
  }
  return deps;
}

// ---------------------------------------------------------------------------
// Spill
// ---------------------------------------------------------------------------

/**
 * The spill area of the anchor at (r, c) as dependencies of the anchor: every
 * cell of its rectangle except the anchor itself (which would make the anchor
 * its own dependency). Derived from the `spill` tag in the sheet data, so it
 * stays right after undo/redo, structural changes and reloads.
 */
function spillAreaDependencies(
  ctx: Context,
  r: number,
  c: number,
  id: string
): FormulaDependency[] | null {
  const data = getSheetDataCached(ctx, id);
  const cell = peekCell(data, r, c) as SpillCell | null;
  const sp = cell?.spill;
  if (!sp || !cell?.f) return null;
  const rows = data?.length ?? 0;
  const cols = peek(data?.[0])?.length ?? 0;
  const lastRow = Math.min(r + sp.rs, rows) - 1;
  const lastCol = Math.min(c + sp.cs, cols) - 1;
  const deps: FormulaDependency[] = [];
  if (lastCol > c) {
    deps.push({ row: [r, lastRow], column: [c + 1, lastCol], sheetId: id });
  }
  if (lastRow > r) {
    deps.push({ row: [r + 1, lastRow], column: [c, c], sheetId: id });
  }
  return deps.length ? deps : null;
}

function requestSheetGrowth(state: EngineState, req: SpillGrowthRequest) {
  if (state.growing || req.rows > MAX_ROWS || req.cols > MAX_COLS) return;
  state.pendingGrowth.push(req);
}

/** Whether spill.ts is growing a sheet right now. */
export function isGrowingSheet(ctx: Context) {
  return !!states.get(ctx.formulaCache as object)?.growing;
}

/** Take (and reset) the pending sheet-growth requests. */
export function takeSpillGrowthRequests(ctx: Context) {
  const state = states.get(ctx.formulaCache as object);
  if (!state || state.pendingGrowth.length === 0) return null;
  const out = state.pendingGrowth;
  state.pendingGrowth = [];
  return out;
}

/** Run `fn` with sheet-growth requests disabled (used while growing). */
export function withoutSpillGrowth<T>(ctx: Context, fn: () => T): T {
  const state = getState(ctx);
  const prev = state.growing;
  state.growing = true;
  try {
    return fn();
  } finally {
    state.growing = prev;
  }
}

/** Whether a recalculation (or a nested spill pass) is running. */
export function isRecalculating(ctx: Context) {
  const state = states.get(ctx.formulaCache as object);
  return (
    (state?.propagationDepth ?? 0) > 0 ||
    (ctx.formulaCache.recalcDepth ?? 0) > 0
  );
}

/** Forget the run-time dependencies of a sheet's formulas (cells moved). */
export function forgetDynamicDependencies(ctx: Context, id: string) {
  const state = states.get(ctx.formulaCache as object);
  if (!state) return;
  const suffix = `i${id}`;
  Array.from(state.dynamicDeps.keys()).forEach((key) => {
    if (key.endsWith(suffix)) state.dynamicDeps.delete(key);
  });
}

// ---------------------------------------------------------------------------
// Spill references (A1#)
// ---------------------------------------------------------------------------

// A spill reference is a cell reference (ending with its row number)
// followed by "#".
const SPILL_REF_HINT = /\d#/;

/**
 * The range a spill reference (`A1#`, `Sheet2!$B$3#`) stands for, as
 * reference text: the anchor's current spill rectangle. `#REF!` when the cell
 * holds no formula (Excel: the reference is not to a dynamic array), and
 * `#SPILL!` while the anchor itself is blocked. A formula cell with a single
 * value is a 1x1 spill, like Excel's `=SEQUENCE(1)` referenced as `A1#`.
 */
export function resolveSpillReference(
  ctx: Context,
  text: string,
  sheetId: string
): string {
  const ref = parseReference(ctx, text, sheetId);
  if (!ref || ref.r1 !== ref.r2 || ref.c1 !== ref.c2) return ERR_REF;
  const cell = peekCell(
    getSheetDataCached(ctx, ref.sheetId),
    ref.r1,
    ref.c1
  ) as SpillCell | null;
  // A formula being entered is in the recalculation overlay (and carries its
  // spill tag) before the cell editor stores it.
  if (
    !cell?.f &&
    !cell?.spill &&
    !ctx.formulaCache.getGlobalCell(ref.r1, ref.c1, ref.sheetId)?.f
  ) {
    return ERR_REF;
  }
  const sp = cell?.spill;
  if (sp?.blocked) return ERRORS.sp;
  const trimmed = text.trim();
  const bang = trimmed.lastIndexOf("!");
  const sheetPart = bang > -1 ? trimmed.slice(0, bang + 1) : "";
  const start = a1Address(ref.r1, ref.c1, false, false);
  if (!sp || (sp.rs <= 1 && sp.cs <= 1)) return `${sheetPart}${start}`;
  const end = a1Address(ref.r1 + sp.rs - 1, ref.c1 + sp.cs - 1, false, false);
  return `${sheetPart}${start}:${end}`;
}

/**
 * Replace spill references (`A1#`) in a formula expression (without "=") by
 * the range they currently stand for. Only the text handed to the parser
 * changes; the stored formula keeps `A1#`. The formula depends on the anchor
 * cell (formulaHelper strips the "#"), so it is recalculated whenever the
 * anchor is, including when the spill changes size.
 */
export function rewriteSpillReferences(
  ctx: Context,
  expr: string,
  sheetId: string
): string {
  const toks = tokenizeFormula(expr);
  let changed = false;
  const out: string[] = [];
  for (let i = 0; i < toks.length; i += 1) {
    const tok = toks[i];
    const next = toks[i + 1];
    if (
      tok.t === "ref" &&
      next?.t === "other" &&
      next.s === "#" &&
      tok.s.indexOf(":") === -1
    ) {
      out.push(resolveSpillReference(ctx, tok.s, sheetId));
      changed = true;
      i += 1;
    } else {
      out.push(tok.s);
    }
  }
  return changed ? out.join("") : expr;
}

// ---------------------------------------------------------------------------
// Spill values
// ---------------------------------------------------------------------------

function normalizeSpillValue(v: any) {
  if (v == null) return 0;
  if (v instanceof Error) return toErrorString(v);
  if (Object.prototype.toString.call(v) === "[object Date]")
    return v.toString();
  if (typeof v === "number" && !Number.isFinite(v)) return ERR_NUM;
  return v;
}

function toMatrix(value: any): any[][] | null {
  if (!Array.isArray(value)) return null;
  if (value.length === 0) return null;
  if (!Array.isArray(value[0])) return [value];
  return value as any[][];
}

function queueRefresh(ctx: Context, item: any) {
  if (!ctx.groupValuesRefreshData) ctx.groupValuesRefreshData = [];
  ctx.groupValuesRefreshData.push(item);
}

/** The current ghost cell of anchor (ar, ac) at (r, c), pending writes included. */
function currentGhost(
  ctx: Context,
  data: CellMatrix,
  id: string,
  r: number,
  c: number,
  ar: number,
  ac: number
): SpillCell | null {
  const g = ctx.formulaCache.getGlobalCell(r, c, id);
  if (g) return isGhostOf(g, r, c, ar, ac) ? g : null;
  const cell = data[r]?.[c] as SpillCell | null | undefined;
  return isGhostOf(cell, r, c, ar, ac) ? cell! : null;
}

function isBlocking(
  ctx: Context,
  data: CellMatrix,
  id: string,
  r: number,
  c: number,
  ar: number,
  ac: number
) {
  const g = ctx.formulaCache.getGlobalCell(r, c, id);
  if (g) {
    if (isGhostOf(g, r, c, ar, ac)) return false;
    return !!g.spillFrom || !isEmptyCell(g);
  }
  const cell = data[r]?.[c] as SpillCell | null | undefined;
  if (!cell) return false;
  if (cell.mc) return true;
  if (isGhostOf(cell, r, c, ar, ac)) return false;
  if (cell.spillFrom) {
    // A ghost whose anchor is gone does not block.
    const ghostAnchor = data[r - cell.spillFrom.dr]?.[c - cell.spillFrom.dc];
    return !!ghostAnchor?.f;
  }
  return !isEmptyCell(cell);
}

function markChanged(state: EngineState, r: number, c: number, i: string) {
  state.spillChanges.push({ r, c, i });
}

function clearGhost(
  ctx: Context,
  state: EngineState,
  id: string,
  r: number,
  c: number,
  ar: number,
  ac: number
) {
  queueRefresh(ctx, {
    r,
    c,
    id,
    spe: { type: "spillClear", r: ar, c: ac },
  });
  ctx.formulaCache.setGlobalCell(r, c, id, {});
  markChanged(state, r, c, id);
}

function clearGhosts(
  ctx: Context,
  state: EngineState,
  data: CellMatrix,
  id: string,
  ar: number,
  ac: number,
  old: SpillAnchorInfo,
  keep: { rs: number; cs: number } | null
) {
  for (let i = 0; i < old.rs; i += 1) {
    for (let j = 0; j < old.cs; j += 1) {
      if (i === 0 && j === 0) continue;
      if (keep && i < keep.rs && j < keep.cs) continue;
      const r = ar + i;
      const c = ac + j;
      if (currentGhost(ctx, data, id, r, c, ar, ac)) {
        clearGhost(ctx, state, id, r, c, ar, ac);
      }
    }
  }
}

function spillResult(
  ctx: Context,
  state: EngineState,
  value: any,
  r: number,
  c: number,
  id: string,
  formula: string
) {
  const view = getSheetDataCached(ctx, id); // read-only, no immer drafts
  if (!view || !view[r]) return value;
  const scalar = toMatrix(value);
  if (!scalar || (scalar.length === 1 && scalar[0].length <= 1)) {
    // Fast path for the common scalar result of a cell that never spilled:
    // decided on a read-only peek, so no immer draft is created for it.
    const peeked = peekCell(view, r, c) as SpillCell | null;
    if (!peeked?.spillFrom && !peeked?.spill) {
      if (!scalar) return value;
      const v = scalar[0][0];
      return v instanceof Error ? toErrorString(v) : v ?? null;
    }
  }
  const data = getFlowdata(ctx, id);
  if (!data || !data[r]) return value;
  let anchor = data[r][c] as SpillCell | null;
  if (anchor?.spillFrom) {
    // A formula typed over a spilled cell: it is no longer part of the spill.
    delete anchor.spillFrom;
  }
  const old = anchor?.spill;
  const matrix = toMatrix(value);
  if (!matrix || (matrix.length === 1 && matrix[0].length <= 1)) {
    if (old) {
      if (!old.blocked) clearGhosts(ctx, state, data, id, r, c, old, null);
      delete anchor!.spill;
    }
    if (matrix) {
      const v = matrix[0][0];
      return v instanceof Error ? toErrorString(v) : v ?? null;
    }
    return value;
  }
  const rs = matrix.length;
  // (no Math.max(...rows): a million-row result would overflow the stack)
  let cs = 1;
  for (let i = 0; i < rs; i += 1) {
    const row = matrix[i];
    if (Array.isArray(row) && row.length > cs) cs = row.length;
  }
  const rows = data.length;
  const cols = data[0]?.length ?? 0;
  let blocked = r + rs > rows || c + cs > cols;
  if (blocked) {
    // Past the sheet edge: ask for more rows/columns once this recalculation
    // is over (see spill.ts); until then the anchor shows #SPILL!.
    requestSheetGrowth(state, {
      id,
      r,
      c,
      f: formula,
      rows: r + rs,
      cols: c + cs,
    });
  }
  // The spill area is a dependency of the anchor (see spillAreaDependencies):
  // editing any of its cells re-evaluates the anchor.
  for (let i = 0; i < rs && !blocked; i += 1) {
    for (let j = 0; j < cs; j += 1) {
      if (i === 0 && j === 0) continue;
      if (isBlocking(ctx, data, id, r + i, c + j, r, c)) {
        blocked = true;
        break;
      }
    }
  }
  if (!anchor) {
    anchor = {};
    data[r][c] = anchor;
  }
  if (blocked) {
    if (old && !old.blocked) {
      clearGhosts(ctx, state, data, id, r, c, old, null);
    }
    anchor.spill = { rs, cs, blocked: true };
    return ERRORS.sp;
  }
  if (old && !old.blocked) {
    clearGhosts(ctx, state, data, id, r, c, old, { rs, cs });
  }
  for (let i = 0; i < rs; i += 1) {
    for (let j = 0; j < cs; j += 1) {
      if (i === 0 && j === 0) continue;
      const rr = r + i;
      const cc = c + j;
      const row = matrix[i];
      const v = normalizeSpillValue(Array.isArray(row) ? row[j] : row);
      const cur = currentGhost(ctx, data, id, rr, cc, r, c);
      if (cur && (isImageValue(v) ? sameImageValue(cur, v) : cur.v === v)) {
        continue;
      }
      queueRefresh(ctx, {
        r: rr,
        c: cc,
        id,
        v,
        spe: { type: "spillCell", r, c },
      });
      ctx.formulaCache.setGlobalCell(rr, cc, id, {
        v,
        spillFrom: { dr: i, dc: j },
        ...(typeof v === "number" ? { ct: { fa: "General", t: "n" } } : {}),
        ...(isImageValue(v) ? { img: cellImageFromValue(v) } : {}),
      });
      markChanged(state, rr, cc, id);
    }
  }
  anchor.spill = { rs, cs };
  return normalizeSpillValue(matrix[0][0]);
}

/**
 * Apply a queued spill write/clear (from ctx.groupValuesRefreshData).
 * Returns false if the item is not a spill item.
 */
export function applySpillRefreshItem(
  ctx: Context,
  item: any,
  data: CellMatrix
): boolean {
  const type = item?.spe?.type;
  if (type !== "spillCell" && type !== "spillClear") return false;
  const { r, c } = item;
  const ar = item.spe.r;
  const ac = item.spe.c;
  if (!data[r]) return true;
  const cell = data[r][c] as SpillCell | null;
  if (type === "spillClear") {
    if (!cell || !isGhostOf(cell, r, c, ar, ac)) return true;
    delete cell.v;
    delete cell.m;
    delete cell.img;
    delete cell.spillFrom;
    if (cell.ct && (!cell.ct.fa || cell.ct.fa === "General")) delete cell.ct;
    if (_.isEmpty(cell)) data[r][c] = null;
    return true;
  }
  if (cell && (cell.f || cell.mc)) return true;
  if (cell && !isGhostOf(cell, r, c, ar, ac) && !isEmptyCell(cell)) {
    return true;
  }
  if (cell?.ct?.t === "inlineStr") delete cell.ct;
  setCellValue(ctx, r, c, data, { v: item.v });
  let next = data[r][c] as SpillCell | null;
  if (!next) {
    next = {};
    data[r][c] = next;
  }
  next.spillFrom = { dr: r - ar, dc: c - ac };
  return true;
}

/**
 * Called when the formula at (r, c) is removed (delFunctionGroup): clears
 * its spilled cells. Also detaches a spilled cell that is being overwritten.
 */
export function onFormulaRemoved(
  ctx: Context,
  r: number,
  c: number,
  id: string
) {
  const data = getFlowdata(ctx, id);
  const cell = data?.[r]?.[c] as SpillCell | null | undefined;
  if (!data || !cell) return;
  if (cell.spillFrom) {
    delete cell.spillFrom;
  }
  if (cell.spill) {
    const state = getState(ctx);
    if (!cell.spill.blocked) {
      clearGhosts(ctx, state, data, id, r, c, cell.spill, null);
    }
    delete cell.spill;
  }
  getState(ctx).dynamicDeps.delete(formulaKey(r, c, id));
}

/**
 * Clear ghosts left behind by an anchor that lost its formula without going
 * through delFunctionGroup (e.g. Delete key replacing the cell).
 */
function cleanupOrphanGhosts(
  ctx: Context,
  state: EngineState,
  id: string,
  r: number,
  c: number
) {
  const data = getFlowdata(ctx, id);
  if (!data) return;
  const cell = data[r]?.[c] as SpillCell | null | undefined;
  if (cell?.f) return;
  const right = data[r]?.[c + 1] as SpillCell | null | undefined;
  const below = data[r + 1]?.[c] as SpillCell | null | undefined;
  if (!isGhostOf(right, r, c + 1, r, c) && !isGhostOf(below, r + 1, c, r, c)) {
    return;
  }
  let rs = 1;
  while (
    r + rs < data.length &&
    isGhostOf(data[r + rs]?.[c] as SpillCell, r + rs, c, r, c)
  ) {
    rs += 1;
  }
  let cs = 1;
  while (
    c + cs < (data[r]?.length ?? 0) &&
    isGhostOf(data[r]?.[c + cs] as SpillCell, r, c + cs, r, c)
  ) {
    cs += 1;
  }
  clearGhosts(ctx, state, data, id, r, c, { rs, cs }, null);
  if (cell?.spill) delete cell.spill;
}

/**
 * Called at the start of execFunctionGroup with the cells that changed.
 */
export function beforeRecalculation(
  ctx: Context,
  changed: { r: number; c: number; i?: string; id?: string }[]
) {
  const state = getState(ctx);
  changed.forEach((cell) => {
    const id = cell.i ?? cell.id ?? ctx.currentSheetId;
    if (_.isNil(cell.r) || _.isNil(cell.c)) return;
    cleanupOrphanGhosts(ctx, state, id, cell.r, cell.c);
  });
}

/**
 * Called at the end of execFunctionGroup. Returns the spilled cells that
 * changed during the pass (and resets the list) so dependents of those cells
 * can be recalculated, or null when there is nothing (left) to propagate.
 */
export function takeSpillChanges(ctx: Context): ChangedCell[] | null {
  const state = states.get(ctx.formulaCache as object);
  if (!state || state.spillChanges.length === 0) return null;
  const changes = _.uniqBy(state.spillChanges, (x) => `${x.r}_${x.c}_${x.i}`);
  state.spillChanges = [];
  if (state.propagationDepth >= MAX_SPILL_PASSES) return null;
  return changes;
}

/** Run `fn` as a nested spill-propagation pass (bounded depth). */
export function runSpillPropagation(ctx: Context, fn: () => void) {
  const state = getState(ctx);
  state.propagationDepth += 1;
  try {
    fn();
  } finally {
    state.propagationDepth -= 1;
  }
}

/** The anchor cell a spilled cell belongs to, if any. */
export function getSpillAnchor(
  ctx: Context,
  r: number,
  c: number,
  id: string = ctx.currentSheetId
) {
  const a = anchorOfGhost(ctx, id, r, c);
  return a ? { r: a.r, c: a.c } : null;
}
