import _ from "lodash";
import type { Context } from "../context";
import type { SingleRange } from "../types";
import { getSheetIndex } from "../utils";
import type {
  CFColorScaleStop,
  CFDataBar,
  CFIconSet,
  CFRule,
  CFStyle,
} from "./cfTypes";
import { cleanRanges, rangesIntersect } from "./cfRules";
import { checkProtectionFormatCells } from "./protection";

/*
 * Editing conditional-formatting rules. Every function mutates `ctx` and is
 * meant to run inside `setContext`, so each edit is one undo step (the rules
 * live in `luckysheetfile[i].luckysheet_conditionformat_save`, which the
 * history records).
 *
 * Indexes are array indexes: the last rule has the highest priority.
 */

function sheetIndexOf(ctx: Context, sheetId?: string) {
  return getSheetIndex(ctx, sheetId ?? ctx.currentSheetId);
}

export function getCFRules(ctx: Context, sheetId?: string): CFRule[] {
  const i = sheetIndexOf(ctx, sheetId);
  if (i == null) return [];
  return (ctx.luckysheetfile[i].luckysheet_conditionformat_save ??
    []) as CFRule[];
}

/** Replace the rule list of a sheet (the Manage Rules dialog's OK). */
export function setCFRules(ctx: Context, rules: CFRule[], sheetId?: string) {
  if (!checkProtectionFormatCells(ctx)) return false;
  const i = sheetIndexOf(ctx, sheetId);
  if (i == null) return false;
  ctx.luckysheetfile[i].luckysheet_conditionformat_save = _.cloneDeep(rules);
  return true;
}

/** Add a rule with the highest priority. Returns its index or -1. */
export function addCFRule(ctx: Context, rule: CFRule, sheetId?: string) {
  if (!checkProtectionFormatCells(ctx)) return -1;
  const i = sheetIndexOf(ctx, sheetId);
  if (i == null) return -1;
  const file = ctx.luckysheetfile[i];
  if (!file.luckysheet_conditionformat_save) {
    file.luckysheet_conditionformat_save = [];
  }
  const copy = _.cloneDeep(rule);
  copy.cellrange = cleanRanges(copy.cellrange);
  file.luckysheet_conditionformat_save.push(copy);
  return file.luckysheet_conditionformat_save.length - 1;
}

export function updateCFRule(
  ctx: Context,
  index: number,
  rule: CFRule,
  sheetId?: string
) {
  if (!checkProtectionFormatCells(ctx)) return false;
  const rules = getCFRules(ctx, sheetId);
  if (index < 0 || index >= rules.length) return false;
  const copy = _.cloneDeep(rule);
  copy.cellrange = cleanRanges(copy.cellrange);
  rules[index] = copy;
  return true;
}

export function deleteCFRule(ctx: Context, index: number, sheetId?: string) {
  if (!checkProtectionFormatCells(ctx)) return false;
  const rules = getCFRules(ctx, sheetId);
  if (index < 0 || index >= rules.length) return false;
  rules.splice(index, 1);
  return true;
}

/**
 * Move a rule by `delta` places in priority (+1 = higher priority, i.e.
 * towards the end of the array). Returns the new index.
 */
export function moveCFRule(
  ctx: Context,
  index: number,
  delta: number,
  sheetId?: string
) {
  if (!checkProtectionFormatCells(ctx)) return index;
  const rules = getCFRules(ctx, sheetId);
  const to = Math.max(0, Math.min(rules.length - 1, index + delta));
  if (index < 0 || index >= rules.length || to === index) return index;
  const [rule] = rules.splice(index, 1);
  rules.splice(to, 0, rule);
  return to;
}

/** `a` minus `b` as up to four rectangles. */
export function subtractRange(a: SingleRange, b: SingleRange): SingleRange[] {
  if (!rangesIntersect(a, b)) return [a];
  const out: SingleRange[] = [];
  const [ar1, ar2] = a.row;
  const [ac1, ac2] = a.column;
  const r1 = Math.max(ar1, b.row[0]);
  const r2 = Math.min(ar2, b.row[1]);
  if (ar1 < r1) out.push({ row: [ar1, r1 - 1], column: [ac1, ac2] });
  if (r2 < ar2) out.push({ row: [r2 + 1, ar2], column: [ac1, ac2] });
  if (ac1 < b.column[0]) {
    out.push({ row: [r1, r2], column: [ac1, b.column[0] - 1] });
  }
  if (b.column[1] < ac2) {
    out.push({ row: [r1, r2], column: [b.column[1] + 1, ac2] });
  }
  return out;
}

/** Array indexes of the rules whose applies-to meets `ranges`. */
export function cfRulesInRanges(
  ctx: Context,
  ranges: SingleRange[],
  sheetId?: string
) {
  const rules = getCFRules(ctx, sheetId);
  const out: number[] = [];
  rules.forEach((rule, i) => {
    if (
      (rule.cellrange ?? []).some((a) =>
        ranges.some((b) => rangesIntersect(a, b))
      )
    ) {
      out.push(i);
    }
  });
  return out;
}

/**
 * Excel's "Clear Rules": from the selected cells (the selection is cut out
 * of every applies-to range) or from the entire sheet.
 */
export function clearCFRules(
  ctx: Context,
  scope: "selection" | "sheet",
  sheetId?: string
) {
  if (!checkProtectionFormatCells(ctx)) return false;
  const i = sheetIndexOf(ctx, sheetId);
  if (i == null) return false;
  const file = ctx.luckysheetfile[i];
  if (scope === "sheet") {
    file.luckysheet_conditionformat_save = [];
    return true;
  }
  const selection = cleanRanges(ctx.luckysheet_select_save);
  const rules = (file.luckysheet_conditionformat_save ?? []) as CFRule[];
  const next: CFRule[] = [];
  rules.forEach((rule) => {
    let ranges = cleanRanges(rule.cellrange);
    selection.forEach((sel) => {
      ranges = _.flatMap(ranges, (r) => subtractRange(r, sel));
    });
    if (ranges.length === 0) return;
    if (_.isEqual(ranges, cleanRanges(rule.cellrange))) next.push(rule);
    else next.push({ ...rule, cellrange: ranges });
  });
  file.luckysheet_conditionformat_save = next;
  return true;
}

function selectionRanges(ctx: Context) {
  return cleanRanges(ctx.luckysheet_select_save);
}

/* Rules for the toolbar galleries, applied to the selection */

export function addDataBarRule(ctx: Context, dataBar: CFDataBar) {
  return addCFRule(ctx, {
    type: "dataBar",
    cellrange: selectionRanges(ctx),
    format: [dataBar.color],
    dataBar,
  });
}

export function addColorScaleRule(ctx: Context, stops: CFColorScaleStop[]) {
  return addCFRule(ctx, {
    type: "colorGradation",
    cellrange: selectionRanges(ctx),
    format: stops.map((s) => s.color).reverse(),
    colorScale: { stops },
  });
}

export function addIconSetRule(ctx: Context, iconSet: CFIconSet) {
  return addCFRule(ctx, {
    type: "icons",
    cellrange: selectionRanges(ctx),
    iconSet,
  });
}

/** A highlight rule ("Format only cells that ...") on the selection. */
export function addHighlightRule(
  ctx: Context,
  conditionName: CFRule["conditionName"],
  conditionValue: any[],
  format: CFStyle,
  extra: Partial<CFRule> = {}
) {
  return addCFRule(ctx, {
    type: "default",
    cellrange: selectionRanges(ctx),
    conditionName,
    conditionValue,
    conditionRange: [],
    format,
    ...extra,
  });
}
