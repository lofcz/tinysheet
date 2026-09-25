/**
 * Background error checking (Excel's green triangles, File > Options >
 * Formulas > Error checking rules).
 *
 * Rules (`ErrorRuleKey`), in the order a cell reports them:
 * - evaluationError: a formula whose result is an error value;
 * - inconsistentFormula: the neighbours on both sides (above and below, or
 *   left and right) share one formula (in R1C1 form) and this cell differs;
 * - omitsCells: a formula refers to a one-row / one-column range and the
 *   next cell along that range holds a number;
 * - unlockedFormula: a formula in an unlocked cell (`lo: 0`);
 * - emptyCellRef (off by default): a formula refers to an empty cell;
 * - numberAsText: a constant number stored as text.
 *
 * Cost: results are computed lazily per drawn cell and cached per sheet;
 * any edit of the sheet replaces its data matrix (immer), which drops the
 * cache. R1C1 forms are memoised per cell object, which survives edits of
 * other cells.
 *
 * Ignored errors are stored on the cell (`cell.ie`, rule keys), so they
 * move and copy with it.
 */
import type { Context } from "../context";
import type { Cell } from "../types";
import { getSheetIndex } from "../utils";
import { getCanvasTheme } from "../theme";
import { formatRef, offsetFormula, ParsedRef, scanFormula } from "./refAdjust";
import { isRealNum } from "./validation";
import { isErrorValue } from "./formulaAudit";
import { sheetIdByName, sheetNameById } from "./names";
import { updateCell } from "./cell";
import { jfrefreshgrid } from "./refresh";
import { registerCellDecorator } from "./extensions";

export type ErrorRuleKey =
  | "evaluationError"
  | "inconsistentFormula"
  | "omitsCells"
  | "unlockedFormula"
  | "emptyCellRef"
  | "numberAsText";

export const ERROR_RULE_KEYS: ErrorRuleKey[] = [
  "evaluationError",
  "inconsistentFormula",
  "omitsCells",
  "unlockedFormula",
  "emptyCellRef",
  "numberAsText",
];

export type ErrorCheckingOptions = {
  /** Enable background error checking. @default true */
  enabled?: boolean;
  /** Rules on / off; Excel's defaults: all on but emptyCellRef. */
  rules?: Partial<Record<ErrorRuleKey, boolean>>;
};

export const DEFAULT_ERROR_RULES: Record<ErrorRuleKey, boolean> = {
  evaluationError: true,
  inconsistentFormula: true,
  omitsCells: true,
  unlockedFormula: true,
  emptyCellRef: false,
  numberAsText: true,
};

export type ErrorInfo = {
  rule: ErrorRuleKey;
  /** inconsistentFormula: the neighbour whose formula the region uses */
  source?: { r: number; c: number; direction: "above" | "left" };
  /** omitsCells: the formula with the range extended */
  fixedFormula?: string;
};

type ResolvedOptions = {
  enabled: boolean;
  rules: Record<ErrorRuleKey, boolean>;
};

let lastOptions: {
  from: ErrorCheckingOptions | undefined;
  resolved: ResolvedOptions;
} | null = null;

/** The options with defaults filled in (memoised: read for every cell). */
export function getErrorCheckingOptions(ctx: Context): ResolvedOptions {
  const o = ctx.errorCheckingOptions;
  if (lastOptions && lastOptions.from === o) return lastOptions.resolved;
  const resolved = {
    enabled: o?.enabled ?? true,
    rules: { ...DEFAULT_ERROR_RULES, ...(o?.rules ?? {}) },
  };
  lastOptions = { from: o, resolved };
  return resolved;
}

export function setErrorCheckingOptions(
  ctx: Context,
  patch: ErrorCheckingOptions
) {
  const cur = getErrorCheckingOptions(ctx);
  ctx.errorCheckingOptions = {
    enabled: patch.enabled ?? cur.enabled,
    rules: { ...cur.rules, ...(patch.rules ?? {}) },
  };
}

/* ------------------------------------------------------------------------ */
/* R1C1 form (memoised per cell object)                                     */
/* ------------------------------------------------------------------------ */

const r1c1Memo = new WeakMap<object, { r: number; c: number; key: string }>();

function part(abs: boolean, v: number, base: number, letter: string) {
  return abs ? `${letter}${v + 1}` : `${letter}[${v - base}]`;
}

function refR1C1(ref: ParsedRef, r: number, c: number) {
  const sheet = ref.sheet == null ? "" : `${ref.sheet.toUpperCase()}!`;
  if (ref.kind === "rows") {
    return `${sheet}${part(ref.ar1, ref.r1, r, "R")}:${part(
      ref.ar2,
      ref.r2,
      r,
      "R"
    )}`;
  }
  if (ref.kind === "cols") {
    return `${sheet}${part(ref.ac1, ref.c1, c, "C")}:${part(
      ref.ac2,
      ref.c2,
      c,
      "C"
    )}`;
  }
  const a = part(ref.ar1, ref.r1, r, "R") + part(ref.ac1, ref.c1, c, "C");
  if (ref.kind === "cell") return sheet + a;
  return `${sheet + a}:${part(ref.ar2, ref.r2, r, "R")}${part(
    ref.ac2,
    ref.c2,
    c,
    "C"
  )}`;
}

/** The formula of a cell in R1C1 form (relative to the cell), or null. */
export function formulaR1C1(
  cell: Cell | null | undefined,
  r: number,
  c: number
) {
  const f = cell?.f;
  if (!cell || typeof f !== "string" || f.charAt(0) !== "=") return null;
  const hit = r1c1Memo.get(cell);
  if (hit && hit.r === r && hit.c === c) return hit.key;
  const key = scanFormula(f)
    .map((seg) => (seg.ref ? refR1C1(seg.ref, r, c) : seg.text.toUpperCase()))
    .join("")
    .replace(/\s+/g, "");
  r1c1Memo.set(cell, { r, c, key });
  return key;
}

/* ------------------------------------------------------------------------ */
/* Rules                                                                    */
/* ------------------------------------------------------------------------ */

type Grid = (Cell | null)[][];

const at = (data: Grid, r: number, c: number) =>
  r < 0 || c < 0 ? null : data[r]?.[c] ?? null;

function isNumberCell(cell: Cell | null) {
  return cell != null && typeof cell.v === "number";
}

function isEmptyCell(cell: Cell | null) {
  return (
    cell == null ||
    ((cell.v == null || cell.v === "") && cell.f == null && !cell.mc)
  );
}

function checkInconsistent(
  data: Grid,
  cell: Cell,
  r: number,
  c: number
): ErrorInfo | null {
  const self = formulaR1C1(cell, r, c);
  if (!self) return null;
  const pairs: [number, number, number, number, "above" | "left"][] = [
    [r - 1, c, r + 1, c, "above"],
    [r, c - 1, r, c + 1, "left"],
  ];
  for (let i = 0; i < pairs.length; i += 1) {
    const [ra, ca, rb, cb, direction] = pairs[i];
    const a = formulaR1C1(at(data, ra, ca), ra, ca);
    if (a && a !== self && a === formulaR1C1(at(data, rb, cb), rb, cb)) {
      return {
        rule: "inconsistentFormula",
        source: { r: ra, c: ca, direction },
      };
    }
  }
  return null;
}

/** Grow `ref` along its long axis over neighbouring numbers. */
function extendOverNumbers(
  data: Grid,
  ref: ParsedRef,
  r: number,
  c: number
): ParsedRef | null {
  const vertical = ref.c1 === ref.c2 && ref.r2 > ref.r1;
  const horizontal = ref.r1 === ref.r2 && ref.c2 > ref.c1;
  if (!vertical && !horizontal) return null;
  const usable = (rr: number, cc: number) =>
    !(rr === r && cc === c) && isNumberCell(at(data, rr, cc));
  const next = { ...ref };
  if (vertical) {
    while (usable(next.r2 + 1, ref.c1)) next.r2 += 1;
    while (next.r1 > 0 && usable(next.r1 - 1, ref.c1)) next.r1 -= 1;
  } else {
    while (usable(ref.r1, next.c2 + 1)) next.c2 += 1;
    while (next.c1 > 0 && usable(ref.r1, next.c1 - 1)) next.c1 -= 1;
  }
  return next.r1 !== ref.r1 ||
    next.r2 !== ref.r2 ||
    next.c1 !== ref.c1 ||
    next.c2 !== ref.c2
    ? next
    : null;
}

function checkOmits(
  ctx: Context,
  sheetId: string,
  data: Grid,
  f: string,
  r: number,
  c: number
): ErrorInfo | null {
  const own = sheetNameById(ctx, sheetId)?.toUpperCase();
  const segs = scanFormula(f);
  let changed = false;
  const text = segs
    .map((seg) => {
      const { ref } = seg;
      if (
        !ref ||
        ref.kind !== "range" ||
        (ref.sheet != null && ref.sheet.toUpperCase() !== own)
      ) {
        return seg.text;
      }
      const ext = extendOverNumbers(data, ref, r, c);
      if (!ext) return seg.text;
      changed = true;
      return formatRef(ext);
    })
    .join("");
  return changed ? { rule: "omitsCells", fixedFormula: text } : null;
}

function checkEmptyRefs(
  ctx: Context,
  sheetId: string,
  data: Grid,
  f: string
): ErrorInfo | null {
  const segs = scanFormula(f);
  for (let i = 0; i < segs.length; i += 1) {
    const { ref } = segs[i];
    if (ref && ref.kind === "cell") {
      const id = ref.sheet == null ? sheetId : sheetIdByName(ctx, ref.sheet);
      if (id != null) {
        const d = id === sheetId ? data : sheetDataOf(ctx, id); // eslint-disable-line no-use-before-define
        if (d && isEmptyCell(at(d, ref.r1, ref.c1))) {
          return { rule: "emptyCellRef" };
        }
      }
    }
  }
  return null;
}

function sheetDataOf(ctx: Context, sheetId: string): Grid | null {
  const i = getSheetIndex(ctx, sheetId);
  return i == null ? null : (ctx.luckysheetfile[i]?.data as Grid) ?? null;
}

function computeCellError(
  ctx: Context,
  sheetId: string,
  data: Grid,
  r: number,
  c: number,
  rules: Record<ErrorRuleKey, boolean>
): ErrorInfo | null {
  const cell = at(data, r, c);
  if (!cell) return null;
  const ignored = (cell as any).ie as string[] | undefined;
  const on = (k: ErrorRuleKey) => rules[k] && !ignored?.includes(k);
  const f =
    typeof cell.f === "string" && cell.f.charAt(0) === "=" ? cell.f : null;
  if (f) {
    if (on("evaluationError") && isErrorValue(cell.v)) {
      return { rule: "evaluationError" };
    }
    if (on("inconsistentFormula")) {
      const hit = checkInconsistent(data, cell, r, c);
      if (hit) return hit;
    }
    if (on("omitsCells")) {
      const hit = checkOmits(ctx, sheetId, data, f, r, c);
      if (hit) return hit;
    }
    if (on("unlockedFormula") && cell.lo != null && !cell.lo) {
      return { rule: "unlockedFormula" };
    }
    if (on("emptyCellRef")) {
      const hit = checkEmptyRefs(ctx, sheetId, data, f);
      if (hit) return hit;
    }
    return null;
  }
  if (
    on("numberAsText") &&
    typeof cell.v === "string" &&
    !cell.mc?.rs &&
    isRealNum(cell.v)
  ) {
    return { rule: "numberAsText" };
  }
  return null;
}

/* ------------------------------------------------------------------------ */
/* Cache                                                                    */
/* ------------------------------------------------------------------------ */

type SheetCache = {
  data: unknown;
  options: unknown;
  sheets: unknown;
  results: Map<number, ErrorInfo | null>;
};

const caches = new WeakMap<object, Map<string, SheetCache>>();

/**
 * The error of a cell (null when none, checking disabled, or ignored).
 * Cached until the sheet's data, the sheet list or the options change.
 */
export function getCellError(
  ctx: Context,
  r: number,
  c: number,
  sheetId = ctx.currentSheetId
): ErrorInfo | null {
  const options = ctx.errorCheckingOptions;
  const { enabled, rules } = getErrorCheckingOptions(ctx);
  if (!enabled) return null;
  const data = sheetDataOf(ctx, sheetId);
  if (!data) return null;
  let perSheet = caches.get(ctx.formulaCache);
  if (!perSheet) {
    perSheet = new Map();
    caches.set(ctx.formulaCache, perSheet);
  }
  let cache = perSheet.get(sheetId);
  if (
    !cache ||
    cache.data !== data ||
    cache.options !== options ||
    cache.sheets !== ctx.luckysheetfile
  ) {
    cache = {
      data,
      options,
      sheets: ctx.luckysheetfile,
      results: new Map(),
    };
    perSheet.set(sheetId, cache);
  }
  const key = r * 16384 + c;
  let hit = cache.results.get(key);
  if (hit === undefined) {
    hit = computeCellError(ctx, sheetId, data, r, c, rules);
    cache.results.set(key, hit);
  }
  return hit;
}

/* ------------------------------------------------------------------------ */
/* Actions (smart tag menu)                                                 */
/* ------------------------------------------------------------------------ */

function currentCell(ctx: Context, r: number, c: number) {
  const data = sheetDataOf(ctx, ctx.currentSheetId);
  return data?.[r]?.[c] ?? null;
}

/** Convert to Number: the text becomes a number (current sheet). */
export function convertToNumber(ctx: Context, r: number, c: number) {
  const data = sheetDataOf(ctx, ctx.currentSheetId);
  const cell = data?.[r]?.[c];
  if (!cell || typeof cell.v !== "string" || !isRealNum(cell.v)) return false;
  const n = Number(cell.v);
  cell.v = n;
  cell.m = String(n);
  cell.ct = { fa: "General", t: "n" };
  delete cell.qp;
  jfrefreshgrid(ctx, null, [{ row: [r, r], column: [c, c] }]);
  return true;
}

/** Copy Formula from Above / Left: the region's formula replaces this one. */
export function copyFormulaFromSource(ctx: Context, r: number, c: number) {
  const info = getCellError(ctx, r, c);
  const src = info?.source;
  if (!src) return false;
  const f = currentCell(ctx, src.r, src.c)?.f;
  if (!f) return false;
  updateCell(ctx, r, c, null, offsetFormula(f, r - src.r, c - src.c));
  return true;
}

/** Update Formula to Include Cells. */
export function updateFormulaToIncludeCells(
  ctx: Context,
  r: number,
  c: number
) {
  const info = getCellError(ctx, r, c);
  if (!info?.fixedFormula) return false;
  updateCell(ctx, r, c, null, info.fixedFormula);
  return true;
}

/** Lock Cell (Unprotected Formula): the cell becomes locked again. */
export function lockCell(ctx: Context, r: number, c: number) {
  const cell = currentCell(ctx, r, c);
  if (cell && cell.lo != null) delete cell.lo;
}

/** Ignore Error: the cell no longer reports `rule`. */
export function ignoreCellError(
  ctx: Context,
  r: number,
  c: number,
  rule: ErrorRuleKey
) {
  const cell = currentCell(ctx, r, c) as any;
  if (!cell) return;
  const list: string[] = cell.ie ?? [];
  if (!list.includes(rule)) cell.ie = [...list, rule];
}

/** Reset Ignored Errors (every sheet). */
export function resetIgnoredErrors(ctx: Context) {
  ctx.luckysheetfile.forEach((sheet) => {
    sheet.data?.forEach((row) => {
      row?.forEach((cell) => {
        if (cell && (cell as any).ie) delete (cell as any).ie;
      });
    });
  });
}

/* ------------------------------------------------------------------------ */
/* Canvas indicator                                                         */
/* ------------------------------------------------------------------------ */

let registered: (() => void) | null = null;

/** Register the green-triangle cell decorator. Idempotent. */
export function registerErrorCheckingDecorator() {
  if (registered) return registered;
  const off = registerCellDecorator("errorChecking", {
    drawForeground: ({ ctx, renderCtx, cell, r, c, x, y, zoom }) => {
      if (!cell) return;
      if (!getCellError(ctx, r, c)) return;
      const size = 6 * zoom;
      renderCtx.beginPath();
      renderCtx.moveTo(x + size, y);
      renderCtx.lineTo(x, y);
      renderCtx.lineTo(x, y + size);
      renderCtx.closePath();
      renderCtx.fillStyle = getCanvasTheme(ctx).numberAsTextMarker;
      renderCtx.fill();
    },
  });
  registered = () => {
    off();
    registered = null;
  };
  return registered;
}
