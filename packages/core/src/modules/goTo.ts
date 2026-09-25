/**
 * Go To (Ctrl+G / F5) and Go To Special, plus the helpers that activate a
 * sheet and select ranges on it (shared with Find & Replace).
 *
 * Excel behaviour implemented here:
 * - The reference box accepts A1 cells and ranges (`B2:D9`, `A:A`, `3:5`),
 *   sheet-qualified references (`Sheet2!C3`, `'My Sheet'!A1:B2`), a comma
 *   separated list of areas on one sheet, and names when a resolver is given.
 * - Go To Special works on the selection, or on the used range when a single
 *   cell is selected, and turns its result into a multi-range selection.
 */
import _ from "lodash";
import { Context, getFlowdata, updateContextWithSheetData } from "../context";
import { Cell, CellMatrix, Selection, Sheet } from "../types";
import { getSheetIndex } from "../utils";
import {
  extractStaticReferences,
  getSpillAnchor,
  parseReference,
  tokenizeFormula,
} from "./formulaFunctions";
import {
  cellHasValue,
  getCurrentRegion,
  getLastUsedCell,
  SimpleRange,
} from "./navigation";
import { normalizeSelection, scrollToHighlightCell } from "./selection";
import { valueIsError } from "./validation";

// ---------------------------------------------------------------------------
// Sheet activation and selection
// ---------------------------------------------------------------------------

function sheetById(ctx: Context, id: string): Sheet | null {
  const i = getSheetIndex(ctx, id);
  return i == null ? null : ctx.luckysheetfile[i];
}

/**
 * Makes `sheetId` the current sheet the way a tab click does: the current
 * sheet's scroll/selection is remembered, and row/column geometry is rebuilt
 * for the new sheet so selections and scroll positions can be computed.
 */
export function switchToSheet(ctx: Context, sheetId: string): boolean {
  if (sheetId === ctx.currentSheetId) return true;
  const sheet = sheetById(ctx, sheetId);
  if (!sheet?.data) return false;
  if (ctx.sheetScrollRecord) {
    ctx.sheetScrollRecord[ctx.currentSheetId] = {
      scrollLeft: ctx.scrollLeft,
      scrollTop: ctx.scrollTop,
      luckysheet_select_status: ctx.luckysheet_select_status,
      luckysheet_select_save: ctx.luckysheet_select_save,
      luckysheet_selection_range: ctx.luckysheet_selection_range,
    };
  }
  ctx.dataVerificationDropDownList = false;
  ctx.currentSheetId = sheetId;
  ctx.zoomRatio = sheet.zoomRatio || 1;
  ctx.config = sheet.config ?? {};
  ctx.scrollLeft = 0;
  ctx.scrollTop = 0;
  ctx.luckysheet_select_save = undefined;
  if (ctx.visibledatarow && ctx.defaultrowlen != null) {
    updateContextWithSheetData(ctx, sheet.data);
  }
  return true;
}

/**
 * Selects `ranges` on `sheetId` (activating it first) with (r, c) as the
 * active cell, and scrolls it into view. The range containing the active
 * cell is placed last, which is where the active cell is read from.
 */
export function selectRangesOnSheet(
  ctx: Context,
  sheetId: string,
  ranges: SimpleRange[],
  focus?: [number, number]
): boolean {
  if (ranges.length === 0) return false;
  const switched = sheetId !== ctx.currentSheetId;
  if (!switchToSheet(ctx, sheetId)) return false;
  const [fr, fc] = focus ?? [ranges[0].row[0], ranges[0].column[0]];
  const holder = ranges.findIndex(
    (rg) =>
      fr >= rg.row[0] &&
      fr <= rg.row[1] &&
      fc >= rg.column[0] &&
      fc <= rg.column[1]
  );
  const ordered = ranges.slice();
  if (holder >= 0) ordered.push(ordered.splice(holder, 1)[0]);
  const sel: Selection[] = ordered.map((rg) => ({
    row: [rg.row[0], rg.row[1]],
    column: [rg.column[0], rg.column[1]],
    row_focus: rg.row[0],
    column_focus: rg.column[0],
  }));
  const last = sel[sel.length - 1];
  if (holder >= 0) {
    last.row_focus = fr;
    last.column_focus = fc;
  }
  ctx.luckysheet_select_status = false;
  ctx.luckysheet_select_save = normalizeSelection(ctx, sel);
  if (ctx.visibledatarow?.length) {
    scrollToHighlightCell(ctx, last.row_focus!, last.column_focus!);
  }
  if (switched && ctx.sheetScrollRecord) {
    // the tab components restore this record when the sheet changes
    ctx.sheetScrollRecord[sheetId] = {
      scrollLeft: ctx.scrollLeft,
      scrollTop: ctx.scrollTop,
      luckysheet_select_status: false,
      luckysheet_select_save: ctx.luckysheet_select_save,
      luckysheet_selection_range: [],
    };
  }
  return true;
}

// ---------------------------------------------------------------------------
// Reference parsing
// ---------------------------------------------------------------------------

export type GoToTarget = { sheetId: string; ranges: SimpleRange[] };

/** Resolves a defined name to a range (plugged in by the names model). */
export type NameResolver = (name: string, ctx: Context) => GoToTarget | null;

/** Splits `a,b,'x,y'!c` on commas outside quoted sheet names. */
function splitAreas(text: string) {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === "'") quoted = !quoted;
    if (ch === "," && !quoted) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/**
 * Parses what was typed into the Go To reference box. Returns null when the
 * text isn't a valid reference (Excel: "Reference isn't valid.").
 */
export function parseGoToReference(
  ctx: Context,
  text: string,
  resolveName?: NameResolver
): GoToTarget | null {
  const trimmed = (text ?? "").trim().replace(/^=/, "");
  if (!trimmed) return null;
  let sheetId: string | null = null;
  const ranges: SimpleRange[] = [];
  const areas = splitAreas(trimmed);
  for (let i = 0; i < areas.length; i += 1) {
    const area = areas[i];
    if (!area) return null;
    let target: GoToTarget | null = null;
    const ref = parseReference(ctx, area, ctx.currentSheetId);
    if (ref) {
      const data = getFlowdata(ctx, ref.sheetId);
      const rows = data?.length ?? 0;
      const cols = data?.[0]?.length ?? 0;
      if (ref.r1 >= rows || ref.c1 >= cols) return null;
      target = {
        sheetId: ref.sheetId,
        ranges: [
          {
            row: [ref.r1, Math.min(ref.r2, rows - 1)],
            column: [ref.c1, Math.min(ref.c2, cols - 1)],
          },
        ],
      };
    } else if (resolveName) {
      target = resolveName(area, ctx);
    }
    if (!target) return null;
    if (sheetId != null && target.sheetId !== sheetId) return null;
    sheetId = target.sheetId;
    ranges.push(...target.ranges);
  }
  if (sheetId == null) return null;
  return { sheetId, ranges };
}

/** Go To: selects the reference. Returns false when it isn't valid. */
export function goToReference(
  ctx: Context,
  text: string,
  resolveName?: NameResolver
): boolean {
  const target = parseGoToReference(ctx, text, resolveName);
  if (!target) return false;
  const first = target.ranges[0];
  return selectRangesOnSheet(ctx, target.sheetId, target.ranges, [
    first.row[0],
    first.column[0],
  ]);
}

/** A1 text for a Go To target (for the recent list). */
export function formatGoToTarget(ctx: Context, target: GoToTarget) {
  const sheet = sheetById(ctx, target.sheetId);
  const name = sheet?.name ?? "";
  const quoted = /^[A-Za-z_][A-Za-z0-9_.]*$/.test(name)
    ? name
    : `'${name.replace(/'/g, "''")}'`;
  const col = (c: number) => {
    let s = "";
    let n = c + 1;
    while (n > 0) {
      const m = (n - 1) % 26;
      s = String.fromCharCode(65 + m) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  };
  const areas = target.ranges.map((rg) => {
    const a = `$${col(rg.column[0])}$${rg.row[0] + 1}`;
    if (rg.row[0] === rg.row[1] && rg.column[0] === rg.column[1]) return a;
    return `${a}:$${col(rg.column[1])}$${rg.row[1] + 1}`;
  });
  return `${quoted}!${areas.join(",")}`;
}

// ---------------------------------------------------------------------------
// Go To Special
// ---------------------------------------------------------------------------

export type GoToSpecialType =
  | "notes"
  | "constants"
  | "formulas"
  | "blanks"
  | "currentRegion"
  | "currentArray"
  | "rowDifferences"
  | "columnDifferences"
  | "precedents"
  | "dependents"
  | "lastCell"
  | "visibleCells"
  | "conditionalFormats"
  | "dataValidation";

export type ValueKind = "numbers" | "text" | "logicals" | "errors";

export type GoToSpecialOptions = {
  /** Constants / Formulas: which value types to include (default: all). */
  valueTypes?: Partial<Record<ValueKind, boolean>>;
  /** Conditional formats / Data validation: only rules of the active cell. */
  sameOnly?: boolean;
};

type SpillCell = Cell & {
  spill?: { rs: number; cs: number };
  spillFrom?: { dr: number; dc: number };
};

/** Master cell of a merge, or the cell itself. */
function masterCell(data: CellMatrix, r: number, c: number) {
  const cell = data[r]?.[c];
  if (cell?.mc && (cell.mc.r !== r || cell.mc.c !== c)) {
    return data[cell.mc.r]?.[cell.mc.c] ?? null;
  }
  return cell ?? null;
}

/** Excel's value type of a cell, or null when it is blank. */
export function cellValueKind(cell: Cell | null | undefined): ValueKind | null {
  if (!cell) return null;
  if (cell.ct?.t === "inlineStr") {
    return _.isEmpty(cell.ct.s) ? null : "text";
  }
  const { v } = cell;
  if (v == null || v === "") return cell.f ? "text" : null;
  if (typeof v === "boolean" || cell.ct?.t === "b") return "logicals";
  if (typeof v === "number") return "numbers";
  if (_.isString(v) && valueIsError(v)) return "errors";
  if (_.isString(v) && ["#CALC!", "#GETTING_DATA"].includes(v)) {
    return "errors";
  }
  if ((cell.ct?.t === "n" || cell.ct?.t === "d") && _.isFinite(Number(v))) {
    return "numbers";
  }
  return "text";
}

function isFormulaCell(cell: SpillCell | null | undefined) {
  return !!cell && (!!cell.f || !!cell.spillFrom);
}

/** Collapses a set of cells into rectangles (row runs merged downwards). */
export function cellsToRanges(cells: [number, number][]): SimpleRange[] {
  const byRow = new Map<number, number[]>();
  cells.forEach(([r, c]) => {
    const list = byRow.get(r);
    if (list) list.push(c);
    else byRow.set(r, [c]);
  });
  const rows = Array.from(byRow.keys()).sort((a, b) => a - b);
  const open = new Map<string, SimpleRange>();
  const out: SimpleRange[] = [];
  rows.forEach((r) => {
    const cols = _.sortedUniq(byRow.get(r)!.sort((a, b) => a - b));
    const runs: [number, number][] = [];
    cols.forEach((c) => {
      const last = runs[runs.length - 1];
      if (last && last[1] === c - 1) last[1] = c;
      else runs.push([c, c]);
    });
    const next = new Map<string, SimpleRange>();
    runs.forEach(([c1, c2]) => {
      const key = `${c1}:${c2}`;
      const prev = open.get(key);
      if (prev && prev.row[1] === r - 1) {
        prev.row[1] = r;
        next.set(key, prev);
      } else {
        const rg: SimpleRange = { row: [r, r], column: [c1, c2] };
        out.push(rg);
        next.set(key, rg);
      }
    });
    open.clear();
    next.forEach((v, k) => open.set(k, v));
  });
  return out;
}

function currentSheet(ctx: Context) {
  return sheetById(ctx, ctx.currentSheetId);
}

function activeCell(ctx: Context): [number, number] {
  const last = _.last(ctx.luckysheet_select_save);
  if (!last) return [0, 0];
  return [last.row_focus ?? last.row[0], last.column_focus ?? last.column[0]];
}

function isSingleCellSelection(ctx: Context, data: CellMatrix) {
  const sel = ctx.luckysheet_select_save ?? [];
  if (sel.length === 0) return true;
  if (sel.length > 1) return false;
  const [s] = sel;
  if (s.row[0] === s.row[1] && s.column[0] === s.column[1]) return true;
  // a selected merged cell counts as one cell
  const m = data[s.row[0]]?.[s.column[0]]?.mc;
  return (
    !!m &&
    m.rs != null &&
    m.cs != null &&
    s.row[0] === m.r &&
    s.column[0] === m.c &&
    s.row[1] === m.r + m.rs - 1 &&
    s.column[1] === m.c + m.cs - 1
  );
}

/**
 * Cells Go To Special looks at: the selection, or the used range when a
 * single cell is selected; always clipped to the used range (as Excel does).
 */
function specialScope(ctx: Context, data: CellMatrix): SimpleRange[] {
  const [lr, lc] = getLastUsedCell(data);
  const used: SimpleRange = { row: [0, lr], column: [0, lc] };
  if (isSingleCellSelection(ctx, data)) return [used];
  const out: SimpleRange[] = [];
  (ctx.luckysheet_select_save ?? []).forEach((s) => {
    const r1 = Math.max(0, s.row[0]);
    const r2 = Math.min(lr, s.row[1]);
    const c1 = Math.max(0, s.column[0]);
    const c2 = Math.min(lc, s.column[1]);
    if (r1 <= r2 && c1 <= c2) out.push({ row: [r1, r2], column: [c1, c2] });
  });
  return out;
}

function forEachCell(
  ranges: SimpleRange[],
  fn: (r: number, c: number) => void
) {
  const seen = new Set<string>();
  ranges.forEach((rg) => {
    for (let r = rg.row[0]; r <= rg.row[1]; r += 1) {
      for (let c = rg.column[0]; c <= rg.column[1]; c += 1) {
        const k = `${r}_${c}`;
        if (!seen.has(k)) {
          seen.add(k);
          fn(r, c);
        }
      }
    }
  });
}

/** Relative (R1C1-like) form of a formula, for row/column differences. */
export function relativeFormulaSignature(f: string, r: number, c: number) {
  const body = f.startsWith("=") ? f.slice(1) : f;
  return tokenizeFormula(body)
    .map((tok) => {
      if (tok.t !== "ref") return tok.s;
      return tok.s.replace(
        /(\$?)([A-Za-z]{1,3})(\$?)(\d+)/g,
        (_m, ac: string, col: string, ar: string, row: string) => {
          let ci = 0;
          const up = col.toUpperCase();
          for (let i = 0; i < up.length; i += 1) {
            ci = ci * 26 + (up.charCodeAt(i) - 64);
          }
          ci -= 1;
          const ri = parseInt(row, 10) - 1;
          const rs = ar ? `R${ri + 1}` : `R[${ri - r}]`;
          const cs = ac ? `C${ci + 1}` : `C[${ci - c}]`;
          return rs + cs;
        }
      );
    })
    .join("")
    .toUpperCase();
}

function comparisonKey(data: CellMatrix, r: number, c: number) {
  const cell = masterCell(data, r, c) as SpillCell | null;
  if (cell?.f) return `F:${relativeFormulaSignature(cell.f, r, c)}`;
  if (!cellHasValue(cell)) return "B:";
  if (cell?.ct?.t === "inlineStr") {
    return `S:${(cell.ct.s ?? []).map((x: any) => x.v ?? "").join("")}`;
  }
  return `${typeof cell?.v}:${String(cell?.v)}`;
}

function rangesOverlap(a: SimpleRange, b: SimpleRange) {
  return !(
    a.row[1] < b.row[0] ||
    a.row[0] > b.row[1] ||
    a.column[1] < b.column[0] ||
    a.column[0] > b.column[1]
  );
}

function sheetDependencies(ctx: Context, f: string, sheetId: string) {
  return extractStaticReferences(ctx, f, sheetId).filter(
    (d) => (d.sheetId ?? sheetId) === sheetId
  );
}

function visibleSegments(
  from: number,
  to: number,
  hidden: Record<string, any> | undefined
) {
  const out: [number, number][] = [];
  let start: number | null = null;
  for (let i = from; i <= to; i += 1) {
    const isHidden = hidden?.[i] != null;
    if (!isHidden && start == null) start = i;
    if (isHidden && start != null) {
      out.push([start, i - 1]);
      start = null;
    }
  }
  if (start != null) out.push([start, to]);
  return out;
}

/** Rule of a data-validation item without its position-dependent parts. */
function dvSignature(item: any) {
  return JSON.stringify(_.omit(item, ["checked"]));
}

/**
 * Computes the ranges Go To Special selects. Returns an empty list when no
 * cells match (Excel: "No cells were found.").
 */
export function getGoToSpecialRanges(
  ctx: Context,
  type: GoToSpecialType,
  options: GoToSpecialOptions = {}
): SimpleRange[] {
  const data = getFlowdata(ctx);
  const sheet = currentSheet(ctx);
  if (!data || !sheet || data.length === 0) return [];
  const rows = data.length;
  const cols = data[0]?.length ?? 0;
  const [ar, ac] = activeCell(ctx);
  const sheetId = ctx.currentSheetId;
  const types = {
    numbers: true,
    text: true,
    logicals: true,
    errors: true,
    ...options.valueTypes,
  };
  const cells: [number, number][] = [];

  switch (type) {
    case "notes": {
      forEachCell(specialScope(ctx, data), (r, c) => {
        if (data[r]?.[c]?.ps) cells.push([r, c]);
      });
      break;
    }
    case "constants":
    case "formulas": {
      forEachCell(specialScope(ctx, data), (r, c) => {
        const own = data[r]?.[c] as SpillCell | null;
        if (own?.mc && (own.mc.r !== r || own.mc.c !== c)) return;
        const formula = isFormulaCell(own);
        if (formula !== (type === "formulas")) return;
        const kind = cellValueKind(own);
        if (kind && types[kind]) cells.push([r, c]);
      });
      break;
    }
    case "blanks": {
      forEachCell(specialScope(ctx, data), (r, c) => {
        const cell = masterCell(data, r, c) as SpillCell | null;
        if (!isFormulaCell(cell) && cellValueKind(cell) == null) {
          cells.push([r, c]);
        }
      });
      break;
    }
    case "currentRegion": {
      const isFilled = (r: number, c: number) =>
        cellHasValue(masterCell(data, r, c));
      const region = getCurrentRegion(isFilled, ar, ac, rows, cols);
      return [region ?? { row: [ar, ar], column: [ac, ac] }];
    }
    case "currentArray": {
      const anchor = getSpillAnchor(ctx, ar, ac, sheetId) ?? { r: ar, c: ac };
      const cell = data[anchor.r]?.[anchor.c] as SpillCell | null;
      if (!cell?.spill) return [];
      return [
        {
          row: [anchor.r, anchor.r + cell.spill.rs - 1],
          column: [anchor.c, anchor.c + cell.spill.cs - 1],
        },
      ];
    }
    case "rowDifferences":
    case "columnDifferences": {
      const byRow = type === "rowDifferences";
      const scope = isSingleCellSelection(ctx, data)
        ? specialScope(ctx, data)
        : (ctx.luckysheet_select_save ?? []).map((s) => ({
            row: [s.row[0], s.row[1]] as [number, number],
            column: [s.column[0], s.column[1]] as [number, number],
          }));
      scope.forEach((rg) => {
        // comparison cells: the active cell's column (row differences) or
        // row (column differences), when it is inside the range
        const refRow = ar >= rg.row[0] && ar <= rg.row[1] ? ar : rg.row[0];
        const refCol =
          ac >= rg.column[0] && ac <= rg.column[1] ? ac : rg.column[0];
        forEachCell([rg], (r, c) => {
          const refR = byRow ? r : refRow;
          const refC = byRow ? refCol : c;
          if (refR === r && refC === c) return;
          if (comparisonKey(data, r, c) !== comparisonKey(data, refR, refC)) {
            cells.push([r, c]);
          }
        });
      });
      break;
    }
    case "precedents": {
      const sources: [number, number][] = [];
      if (isSingleCellSelection(ctx, data)) sources.push([ar, ac]);
      else {
        forEachCell(
          (ctx.luckysheet_select_save ?? []).map((s) => ({
            row: [s.row[0], s.row[1]] as [number, number],
            column: [s.column[0], s.column[1]] as [number, number],
          })),
          (r, c) => sources.push([r, c])
        );
      }
      const out: SimpleRange[] = [];
      sources.forEach(([r, c]) => {
        const f = data[r]?.[c]?.f;
        if (!f) return;
        sheetDependencies(ctx, f, sheetId).forEach((d) => {
          const r1 = Math.max(0, d.row[0]);
          const r2 = Math.min(rows - 1, d.row[1]);
          const c1 = Math.max(0, d.column[0]);
          const c2 = Math.min(cols - 1, d.column[1]);
          if (r1 <= r2 && c1 <= c2) {
            out.push({ row: [r1, r2], column: [c1, c2] });
          }
        });
      });
      return _.uniqWith(out, _.isEqual);
    }
    case "dependents": {
      const targets = (ctx.luckysheet_select_save ?? []).map((s) => ({
        row: [s.row[0], s.row[1]] as [number, number],
        column: [s.column[0], s.column[1]] as [number, number],
      }));
      if (targets.length === 0)
        targets.push({ row: [ar, ar], column: [ac, ac] });
      for (let r = 0; r < rows; r += 1) {
        const row = data[r];
        for (let c = 0; c < cols; c += 1) {
          const f = row?.[c]?.f;
          if (f) {
            const hit = sheetDependencies(ctx, f, sheetId).some((d) =>
              targets.some((t) =>
                rangesOverlap(t, {
                  row: [d.row[0], d.row[1]],
                  column: [d.column[0], d.column[1]],
                })
              )
            );
            if (hit) cells.push([r, c]);
          }
        }
      }
      break;
    }
    case "lastCell": {
      const [lr, lc] = getLastUsedCell(data);
      return [{ row: [lr, lr], column: [lc, lc] }];
    }
    case "visibleCells": {
      const scope = isSingleCellSelection(ctx, data)
        ? specialScope(ctx, data)
        : (ctx.luckysheet_select_save ?? []).map((s) => ({
            row: [s.row[0], s.row[1]] as [number, number],
            column: [s.column[0], s.column[1]] as [number, number],
          }));
      const out: SimpleRange[] = [];
      scope.forEach((rg) => {
        const rs = visibleSegments(rg.row[0], rg.row[1], ctx.config?.rowhidden);
        const cs = visibleSegments(
          rg.column[0],
          rg.column[1],
          ctx.config?.colhidden
        );
        rs.forEach((row) => {
          cs.forEach((column) => out.push({ row, column }));
        });
      });
      return out;
    }
    case "conditionalFormats": {
      const rules: any[] = sheet.luckysheet_conditionformat_save ?? [];
      const inRule = (rule: any, r: number, c: number) =>
        (rule.cellrange ?? []).some(
          (rg: any) =>
            r >= rg.row[0] &&
            r <= rg.row[1] &&
            c >= rg.column[0] &&
            c <= rg.column[1]
        );
      const picked = options.sameOnly
        ? rules.filter((rule) => inRule(rule, ar, ac))
        : rules;
      const out: SimpleRange[] = [];
      picked.forEach((rule) => {
        (rule.cellrange ?? []).forEach((rg: any) => {
          out.push({
            row: [rg.row[0], Math.min(rows - 1, rg.row[1])],
            column: [rg.column[0], Math.min(cols - 1, rg.column[1])],
          });
        });
      });
      return _.uniqWith(out, _.isEqual);
    }
    case "dataValidation": {
      const dv: Record<string, any> = sheet.dataVerification ?? {};
      const activeItem = dv[`${ar}_${ac}`];
      if (options.sameOnly && !activeItem) return [];
      const sig = activeItem ? dvSignature(activeItem) : null;
      Object.keys(dv).forEach((key) => {
        const [r, c] = key.split("_").map((x) => parseInt(x, 10));
        if (!dv[key] || Number.isNaN(r) || Number.isNaN(c)) return;
        if (options.sameOnly && dvSignature(dv[key]) !== sig) return;
        cells.push([r, c]);
      });
      break;
    }
    default:
      return [];
  }
  return cellsToRanges(cells);
}

/**
 * Go To Special: selects the matching cells as a multi-range selection.
 * Returns the number of ranges selected (0: nothing found, the selection is
 * left unchanged).
 */
export function applyGoToSpecial(
  ctx: Context,
  type: GoToSpecialType,
  options: GoToSpecialOptions = {}
): number {
  const ranges = getGoToSpecialRanges(ctx, type, options);
  if (ranges.length === 0) return 0;
  const [ar, ac] = activeCell(ctx);
  const keepActive =
    type === "currentRegion" ||
    type === "currentArray" ||
    type === "visibleCells";
  selectRangesOnSheet(
    ctx,
    ctx.currentSheetId,
    ranges,
    keepActive ? [ar, ac] : undefined
  );
  return ranges.length;
}
