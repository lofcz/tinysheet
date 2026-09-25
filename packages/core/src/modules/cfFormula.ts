import _ from "lodash";
import type { Context } from "../context";
import {
  columnToIndex,
  indexToColumn,
  CF_MAX_COL,
  CF_MAX_ROW,
} from "./cfRules";
import {
  finishFormulaEvaluation,
  prepareFormulaEvaluation,
} from "./formulaFunctions";

/**
 * Formulas of conditional-formatting rules are written for the top-left cell
 * of the applies-to range; for every other cell their relative references
 * shift like a copied formula. The formula is split once into literal text
 * and references, so producing the formula of each cell is cheap.
 */

type Piece =
  | string
  | {
      kind: "cell";
      colAbs: boolean;
      col: number;
      rowAbs: boolean;
      row: number;
    }
  | { kind: "cols"; abs1: boolean; c1: number; abs2: boolean; c2: number }
  | { kind: "rows"; abs1: boolean; r1: number; abs2: boolean; r2: number };

export interface CFFormulaTemplate {
  pieces: Piece[];
  /** false when the formula has no relative reference */
  relative: boolean;
  /** ROW()/COLUMN() without arguments depend on the evaluating cell */
  positional: boolean;
}

const CELL_RE = /(\$?)([A-Za-z]{1,3})(\$?)([0-9]{1,7})(?![A-Za-z0-9_(.!])/y;
const COLS_RE = /(\$?)([A-Za-z]{1,3}):(\$?)([A-Za-z]{1,3})(?![A-Za-z0-9_(.!])/y;
const ROWS_RE = /(\$?)([0-9]{1,7}):(\$?)([0-9]{1,7})(?![A-Za-z0-9_(.!])/y;
const WORD_CHAR = /[A-Za-z0-9_.\\]/;

const templateCache = new Map<string, CFFormulaTemplate>();

export function compileCFFormula(formula: string): CFFormulaTemplate {
  const hit = templateCache.get(formula);
  if (hit) return hit;
  const pieces: Piece[] = [];
  let text = "";
  let relative = false;
  let i = 0;
  const f = formula;
  while (i < f.length) {
    const ch = f[i];
    if (ch === '"') {
      // string literal ("" escapes a quote)
      let j = i + 1;
      while (j < f.length) {
        if (f[j] === '"') {
          if (f[j + 1] === '"') j += 2;
          else break;
        } else j += 1;
      }
      text += f.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    if (ch === "'") {
      // quoted sheet name: copy up to the closing quote
      let j = i + 1;
      while (j < f.length) {
        if (f[j] === "'") {
          if (f[j + 1] === "'") j += 2;
          else break;
        } else j += 1;
      }
      text += f.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    const prev = i > 0 ? f[i - 1] : "";
    if (prev === "" || !WORD_CHAR.test(prev)) {
      COLS_RE.lastIndex = i;
      ROWS_RE.lastIndex = i;
      CELL_RE.lastIndex = i;
      let m = COLS_RE.exec(f);
      if (m) {
        if (text) pieces.push(text);
        text = "";
        const p: Piece = {
          kind: "cols",
          abs1: m[1] === "$",
          c1: columnToIndex(m[2]),
          abs2: m[3] === "$",
          c2: columnToIndex(m[4]),
        };
        if (!p.abs1 || !p.abs2) relative = true;
        pieces.push(p);
        i += m[0].length;
        continue;
      }
      m = ROWS_RE.exec(f);
      if (m) {
        if (text) pieces.push(text);
        text = "";
        const p: Piece = {
          kind: "rows",
          abs1: m[1] === "$",
          r1: parseInt(m[2], 10) - 1,
          abs2: m[3] === "$",
          r2: parseInt(m[4], 10) - 1,
        };
        if (!p.abs1 || !p.abs2) relative = true;
        pieces.push(p);
        i += m[0].length;
        continue;
      }
      m = CELL_RE.exec(f);
      if (m && columnToIndex(m[2]) <= CF_MAX_COL) {
        if (text) pieces.push(text);
        text = "";
        const p: Piece = {
          kind: "cell",
          colAbs: m[1] === "$",
          col: columnToIndex(m[2]),
          rowAbs: m[3] === "$",
          row: parseInt(m[4], 10) - 1,
        };
        if (!p.colAbs || !p.rowAbs) relative = true;
        pieces.push(p);
        i += m[0].length;
        continue;
      }
    }
    // copy a whole word (function or name) so its tail is not read as a ref
    if (WORD_CHAR.test(ch)) {
      let j = i;
      while (j < f.length && WORD_CHAR.test(f[j])) j += 1;
      text += f.slice(i, j);
      i = j;
      continue;
    }
    text += ch;
    i += 1;
  }
  if (text) pieces.push(text);
  const tpl: CFFormulaTemplate = {
    pieces,
    relative,
    positional: /(^|[^A-Za-z0-9_.])(ROW|COLUMN|CELL)\s*\(\s*\)/i.test(formula),
  };
  if (templateCache.size > 500) templateCache.clear();
  templateCache.set(formula, tpl);
  return tpl;
}

/** The formula as written for a cell `dr` rows and `dc` columns away. */
export function shiftCFFormula(
  tpl: CFFormulaTemplate | string,
  dr: number,
  dc: number
): string {
  const t = typeof tpl === "string" ? compileCFFormula(tpl) : tpl;
  let out = "";
  for (let i = 0; i < t.pieces.length; i += 1) {
    const p = t.pieces[i];
    if (typeof p === "string") {
      out += p;
    } else if (p.kind === "cell") {
      const col = p.colAbs ? p.col : p.col + dc;
      const row = p.rowAbs ? p.row : p.row + dr;
      if (col < 0 || row < 0 || col > CF_MAX_COL || row > CF_MAX_ROW) {
        out += "#REF!";
      } else {
        out += `${p.colAbs ? "$" : ""}${indexToColumn(col)}${
          p.rowAbs ? "$" : ""
        }${row + 1}`;
      }
    } else if (p.kind === "cols") {
      const c1 = p.abs1 ? p.c1 : p.c1 + dc;
      const c2 = p.abs2 ? p.c2 : p.c2 + dc;
      if (c1 < 0 || c2 < 0 || c1 > CF_MAX_COL || c2 > CF_MAX_COL) {
        out += "#REF!";
      } else {
        out += `${p.abs1 ? "$" : ""}${indexToColumn(c1)}:${
          p.abs2 ? "$" : ""
        }${indexToColumn(c2)}`;
      }
    } else {
      const r1 = p.abs1 ? p.r1 : p.r1 + dr;
      const r2 = p.abs2 ? p.r2 : p.r2 + dr;
      if (r1 < 0 || r2 < 0 || r1 > CF_MAX_ROW || r2 > CF_MAX_ROW) {
        out += "#REF!";
      } else {
        out += `${p.abs1 ? "$" : ""}${r1 + 1}:${p.abs2 ? "$" : ""}${r2 + 1}`;
      }
    }
  }
  return out;
}

export const CF_ERROR_VALUES = new Set([
  "#NULL!",
  "#DIV/0!",
  "#VALUE!",
  "#REF!",
  "#NAME?",
  "#NUM!",
  "#N/A",
  "#GETTING_DATA",
  "#SPILL!",
  "#CALC!",
]);

export function isCFError(v: any) {
  if (v instanceof Error) return true;
  return typeof v === "string" && CF_ERROR_VALUES.has(v);
}

/**
 * Evaluate a formula (with or without the leading "=") as if it were in cell
 * (r, c) of `sheetId`, without touching the workbook: no calc-chain entry, no
 * spill, no dependency record. Returns the value, an error string, or
 * undefined when the formula cannot be evaluated.
 */
export function evaluateCFFormula(
  ctx: Context,
  formula: string,
  r: number,
  c: number,
  sheetId: string
): any {
  const parser = ctx.formulaCache?.parser;
  if (!parser) return undefined;
  const txt = formula.startsWith("=") ? formula : `=${formula}`;
  if (txt.includes("#REF!")) return "#REF!";
  const prevContext = parser.context;
  parser.context = ctx;
  try {
    const expression = prepareFormulaEvaluation(ctx, txt, r, c, sheetId);
    const { result, error } = parser.parse(expression, {
      sheetId,
      row: r,
      column: c,
    });
    let value = _.isNil(error) ? result : error;
    if (value instanceof Error) value = value.message;
    // a matrix result: Excel uses its first value
    while (Array.isArray(value)) [value] = value;
    return value;
  } catch (e) {
    return "#VALUE!";
  } finally {
    // end the evaluation frame without spilling (no cell position)
    finishFormulaEvaluation(
      ctx,
      null,
      undefined as any,
      undefined as any,
      sheetId
    );
    parser.context = prevContext ?? ctx;
  }
}

/** Excel's truthiness of a CF formula result: TRUE or a non-zero number. */
export function isCFTruthy(v: any) {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0 && !Number.isNaN(v);
  if (typeof v === "string") {
    const u = v.trim().toUpperCase();
    if (u === "TRUE") return true;
    if (u === "" || u === "FALSE" || isCFError(v)) return false;
    const n = Number(v);
    return !Number.isNaN(n) && n !== 0;
  }
  return false;
}
