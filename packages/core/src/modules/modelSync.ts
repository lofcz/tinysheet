/**
 * Keeps the workbook's data models consistent across structural edits.
 *
 * Every structural change (rows/columns inserted or deleted, cells inserted
 * or deleted with a shift, cells moved by cut/paste or drag, sheets renamed
 * or deleted) goes through `adjustReferences` (refAdjust.ts), which rewrites
 * cell, data-validation, hyperlink and conditional-format formulas and then
 * runs every registered reference adjuster exactly once. This module
 * registers the adjusters of the other models:
 *
 * - defined names (names.ts `adjustNamesForChange`),
 * - tables and structured references (tables.ts `adjustTablesForChange`),
 * - charts: series ranges and positions (chart.ts `adjustChartsForChange`),
 * - sparklines: data references and location cells (sparkline.ts
 *   `adjustSparklinesForChange`),
 * - note boxes with an explicit position (`adjustNotesForChange` below).
 *
 * The data-validation rule anchors register their own adjuster
 * (dataVerification.ts). Cell-keyed data (merges, data-validation and
 * hyperlink keys, conditional-format ranges, filters, borders) is moved by
 * the operation itself (rowcol.ts, shiftCells.ts, moveCells.ts).
 *
 * Duplicating a sheet is not a reference change; `prepareDuplicatedSheet`
 * gives the copy's tables and charts their own identity instead.
 *
 * Modules performing structural changes import this module, so the
 * adjusters are registered before the first change.
 */
import type { Context } from "../context";
import type { Sheet } from "../types";
import { remapDuplicatedCharts, adjustChartsForChange } from "./chart";
import { adjustNamesForChange } from "./names";
import {
  createSheetLookup,
  locateRangeForChange,
  parseRef,
  ReferenceAdjuster,
  ReferenceChange,
  registerReferenceAdjuster,
  rewriteFormula,
} from "./refAdjust";
import { columnLeftPx, insertedSizePx, rowTopPx } from "./sheetGeometry";
import {
  adjustSparklinesForChange,
  remapDuplicatedSparklines,
} from "./sparkline";
import { installSparklineRenderer } from "./sparklineRender";
import {
  adjustTablesForChange,
  mapStructuredReferences,
  renameDuplicatedTables,
} from "./tables";

/**
 * Note boxes that were moved or resized by the user keep an explicit
 * position (`ps.left` / `ps.top`, sheet pixels at 100% zoom). When their
 * cell moves, the box moves by as much as the cell's top-right corner, so
 * it stays next to its cell as in Excel (the note itself travels with the
 * cell). Notes without an explicit position are placed from their cell.
 * Called before the cells move.
 */
export function adjustNotesForChange(ctx: Context, change: ReferenceChange) {
  if (change.type === "renameSheet" || change.type === "deleteSheet") return;
  const { sheetId } = change;
  const sheet = ctx.luckysheetfile?.find((s) => s.id === sheetId);
  const data = sheet?.data;
  if (!data) return;
  const rightEdge = (sid: string, c: number) => columnLeftPx(ctx, sid, c + 1);

  let rows: [number, number] = [0, data.length - 1];
  let cols: [number, number] = [0, (data[0]?.length ?? 0) - 1];
  if (change.type === "move") {
    rows = change.range.row;
    cols = change.range.column;
  }

  // how far the rows/columns after an inserted/deleted block move
  let shift = 0;
  if (change.type === "insert") {
    shift = insertedSizePx(ctx, change.axis, change.count);
  } else if (change.type === "delete") {
    const edge = (i: number) =>
      change.axis === "row"
        ? rowTopPx(ctx, sheetId, i)
        : columnLeftPx(ctx, sheetId, i);
    shift = edge(change.start) - edge(change.end + 1);
  }

  for (let r = rows[0]; r <= rows[1]; r += 1) {
    const row = data[r];
    if (!row) continue;
    for (let c = cols[0]; c <= cols[1]; c += 1) {
      const cell = row[c];
      const ps = cell?.ps;
      if (!cell || !ps || (ps.left == null && ps.top == null)) continue;
      let dx = 0;
      let dy = 0;
      if (change.type === "insert") {
        if (change.axis === "row" && r >= change.index) dy = shift;
        if (change.axis === "column" && c >= change.index) dx = shift;
      } else if (change.type === "delete") {
        if (change.axis === "row" && r > change.end) dy = shift;
        if (change.axis === "column" && c > change.end) dx = shift;
      } else {
        const loc = locateRangeForChange(
          { row: [r, r], column: [c, c] },
          change,
          sheetId
        );
        if (!loc) continue;
        const [nr] = loc.range.row;
        const [nc] = loc.range.column;
        if (loc.sheetId === sheetId && nr === r && nc === c) continue;
        dy = rowTopPx(ctx, loc.sheetId, nr) - rowTopPx(ctx, sheetId, r);
        dx = rightEdge(loc.sheetId, nc) - rightEdge(sheetId, c);
      }
      if (!dx && !dy) continue;
      cell.ps = {
        ...ps,
        left: ps.left == null ? ps.left : ps.left + dx,
        top: ps.top == null ? ps.top : ps.top + dy,
      };
    }
  }
}

const namesAdjuster: ReferenceAdjuster = (ctx, change, api) =>
  adjustNamesForChange(ctx, change, api);

const tablesAdjuster: ReferenceAdjuster = (ctx, change) =>
  adjustTablesForChange(ctx, change);

const chartsAdjuster: ReferenceAdjuster = (ctx, change) =>
  adjustChartsForChange(ctx, change);

const notesAdjuster: ReferenceAdjuster = (ctx, change) =>
  adjustNotesForChange(ctx, change);

const sparklinesAdjuster: ReferenceAdjuster = (ctx, change, api) =>
  adjustSparklinesForChange(ctx, change, api);

/** Keys the model adjusters are registered under. */
export const MODEL_ADJUSTER_KEYS = [
  "model.tables",
  "model.names",
  "model.charts",
  "model.notes",
  "model.sparklines",
] as const;

/**
 * Register the model adjusters (idempotent: registering again replaces
 * them). Tables run first: structured references to deleted tables are
 * turned into #REF! before names are rewritten.
 */
export function installModelAdjusters() {
  registerReferenceAdjuster("model.tables", tablesAdjuster);
  registerReferenceAdjuster("model.names", namesAdjuster);
  registerReferenceAdjuster("model.charts", chartsAdjuster);
  registerReferenceAdjuster("model.notes", notesAdjuster);
  registerReferenceAdjuster("model.sparklines", sparklinesAdjuster);
  installSparklineRenderer();
}

installModelAdjusters();

/**
 * Prepare the copy of a duplicated sheet before it is added to the
 * workbook, like Excel's "Move or Copy > Create a copy":
 *
 * - its tables get new unique names, and the copy's formulas that refer to
 *   them follow;
 * - workbook-scoped names that happened to be stored on the original stay
 *   there (they are not duplicated); sheet-scoped names are copied, pointing
 *   at the copy where they pointed at the original;
 * - data-validation and conditional-format formulas pointing at the
 *   original sheet point at the copy (cell formulas are handled by
 *   duplicateSheet);
 * - charts get new ids and plot the copied cells;
 * - sparkline groups get new ids and read the copied cells.
 */
export function prepareDuplicatedSheet(
  ctx: Context,
  source: Sheet,
  copy: Sheet
) {
  if (source.id == null || copy.id == null) return;
  const renames = renameDuplicatedTables(ctx, copy);
  const renameTables = (formula: string) =>
    renames.size === 0
      ? formula
      : mapStructuredReferences(formula, (tableName, content) => {
          if (tableName == null) return null;
          const next = renames.get(tableName.toUpperCase());
          if (!next) return null;
          return content == null ? next : `${next}[${content}]`;
        });
  // references to the original sheet now name the copy
  const retarget: ReferenceChange = {
    type: "renameSheet",
    sheetId: source.id,
    oldName: source.name,
    newName: copy.name,
  };
  const lookup = createSheetLookup(ctx.luckysheetfile, retarget);
  const rewrite = (formula: string) =>
    renameTables(rewriteFormula(formula, retarget, copy.id!, lookup));

  if (copy.definedNames?.length) {
    const local = copy.definedNames
      .filter((d) => d.local)
      .map((d) => {
        const refersTo = rewrite(d.refersTo);
        return refersTo === d.refersTo ? d : { ...d, refersTo };
      });
    if (local.length > 0) copy.definedNames = local;
    else delete copy.definedNames;
  }

  const dv = copy.dataVerification;
  if (dv) {
    Object.keys(dv).forEach((key) => {
      const item = dv[key];
      if (!item) return;
      (["value1", "value2"] as const).forEach((field) => {
        const v = item[field];
        if (typeof v !== "string" || !v) return;
        // formulas, and list sources given as a reference (Sheet1!A1:A5)
        const isSource =
          item.type === "dropdown" && field === "value1" && parseRef(v);
        if (v.startsWith("=") || isSource) item[field] = rewrite(v);
      });
    });
  }
  copy.luckysheet_conditionformat_save?.forEach((rule: any) => {
    if (!Array.isArray(rule?.conditionValue)) return;
    rule.conditionValue = rule.conditionValue.map((v: unknown) =>
      typeof v === "string" && v.startsWith("=") ? rewrite(v) : v
    );
  });

  if (copy.charts?.length) {
    copy.charts = remapDuplicatedCharts(copy.charts, source.id, copy.id);
  }
  if (copy.sparklineGroups?.length) {
    copy.sparklineGroups = remapDuplicatedSparklines(
      copy.sparklineGroups,
      rewrite
    );
  }
}
