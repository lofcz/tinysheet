import _ from "lodash";
import { current, isDraft } from "immer";
import { v4 as uuidv4 } from "uuid";
import { initSheetData } from "../api/sheet";
import { Context } from "../context";
import { locale } from "../locale";
import { Settings } from "../settings";
import { Cell, CellMatrix, Sheet } from "../types";
import { generateRandomSheetName, getSheetIndex } from "../utils";
import { recalculate, setFormulaCellInfo } from "./formulaHelper";
import { adjustReferences, recalcAfterStructuralChange } from "./refAdjust";
import { moveWorkbookNamesBeforeSheetDelete } from "./names";
import { prepareDuplicatedSheet } from "./modelSync";
import { updateCell } from "./cell";
import { delFunctionGroup } from "./formula";
import { quoteSheetName, tokenizeFormula } from "./formulaFunctions";

function storeSheetParam(ctx: Context) {
  const index = getSheetIndex(ctx, ctx.currentSheetId);
  if (index == null) return;
  const file = ctx.luckysheetfile[index];
  file.config = ctx.config;
  // file.visibledatarow = ctx.visibledatarow;
  // file.visibledatacolumn = ctx.visibledatacolumn;
  // file.ch_width = ctx.ch_width;
  // file.rh_height = ctx.rh_height;
  file.luckysheet_select_save = ctx.luckysheet_select_save;
  file.luckysheet_selection_range = ctx.luckysheet_selection_range;
  file.zoomRatio = ctx.zoomRatio;
}

export function storeSheetParamALL(ctx: Context) {
  storeSheetParam(ctx);
  const index = getSheetIndex(ctx, ctx.currentSheetId);
  if (index == null) return;
  ctx.luckysheetfile[index].config = ctx.config;
}

export function changeSheet(
  ctx: Context,
  id: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  isPivotInitial?: boolean,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  isNewSheet?: boolean,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  isCopySheet?: boolean
) {
  //   if (isEditMode()) {
  //     // alert("非编辑模式下不允许该操作！");
  //     return;
  //   }

  if (id === ctx.currentSheetId) {
    return;
  }

  const file = ctx.luckysheetfile[getSheetIndex(ctx, id)!];

  if (ctx.hooks.beforeActivateSheet?.(id) === false) {
    return;
  }

  storeSheetParamALL(ctx);

  ctx.currentSheetId = id;

  if (file.isPivotTable) {
    ctx.luckysheetcurrentisPivotTable = true;
    //     if (!isPivotInitial) {
    //       pivotTable.changePivotTable(index);
    //     }
  } else {
    ctx.luckysheetcurrentisPivotTable = false;
    //     $("#luckysheet-modal-dialog-slider-pivot").hide();
    //     luckysheetsizeauto(false);
  }

  // 隐藏其他sheet的图表，显示当前sheet的图表 chartMix
  //   renderChartShow(index);

  //   luckysheetFreezen.initialFreezen(index);
  //   _this.restoreselect();
  if (ctx.hooks.afterActivateSheet) {
    setTimeout(() => {
      ctx.hooks.afterActivateSheet?.(id);
    });
  }
}

export function addSheet(
  ctx: Context,
  settings?: Required<Settings>,
  newSheetID: string | undefined = undefined, // if action is from websocket, there will be a new sheetID
  isPivotTable = false,
  sheetName: string | undefined = undefined,
  sheetData: Sheet | undefined = undefined
) {
  if (/* isEditMode() || */ ctx.allowEdit === false) {
    // alert("非编辑模式下不允许该操作！");
    return;
  }
  const order = ctx.luckysheetfile.length;
  const id = newSheetID ?? (settings?.generateSheetId() as string);
  const sheetname =
    sheetName || generateRandomSheetName(ctx.luckysheetfile, isPivotTable, ctx);
  if (!_.isNil(sheetData)) {
    delete sheetData.data;
    ctx.luckysheetfile.forEach((sheet) => {
      sheet.order =
        (sheet.order as number) < sheetData.order!
          ? sheet.order
          : (sheet.order as number) + 1;
      return sheet;
    });
  }
  const sheetconfig: Sheet = _.isNil(sheetData)
    ? {
        name: sheetName === undefined ? sheetname : sheetName,
        status: 0,
        order,
        id,
        row: ctx.defaultrowNum,
        column: ctx.defaultcolumnNum,
        config: {},
        pivotTable: null,
        isPivotTable: !!isPivotTable,
        zoomRatio: 1,
      }
    : sheetData;
  if (sheetName !== undefined) sheetconfig.name = sheetName;
  if (sheetconfig.id === undefined) sheetconfig.id = uuidv4();
  if (ctx.hooks.beforeAddSheet?.(sheetconfig) === false) {
    return;
  }

  ctx.luckysheetfile.push(sheetconfig);

  //   server.saveParam("sha", null, $.extend(true, {}, sheetconfig));

  if (!newSheetID) {
    changeSheet(ctx, id, isPivotTable, true);
  }

  if (ctx.hooks.afterAddSheet) {
    setTimeout(() => {
      ctx.hooks.afterAddSheet?.(sheetconfig);
    });
  }
}

export function deleteSheet(ctx: Context, id: string) {
  if (ctx.allowEdit === false) {
    return;
  }

  const arrIndex = getSheetIndex(ctx, id);

  if (arrIndex == null) {
    return;
  }

  // const file = ctx.luckysheetfile[arrIndex];

  if (ctx.hooks.beforeDeleteSheet?.(id) === false) {
    return;
  }

  // references to the deleted sheet become #REF! (Excel)
  adjustReferences(ctx, {
    type: "deleteSheet",
    sheetId: id,
    name: ctx.luckysheetfile[arrIndex].name,
  });

  // _this.setSheetHide(index, true);
  moveWorkbookNamesBeforeSheetDelete(ctx, id);

  // $(`#luckysheet-sheets-item${index}`).remove();
  // $(`#luckysheet-datavisual-selection-set-${index}`).remove();
  ctx.luckysheetfile = ctx.luckysheetfile.map((sheet) => {
    sheet.order =
      (sheet.order as number) < (ctx.luckysheetfile[arrIndex].order as number)
        ? sheet.order
        : (sheet.order as number) - 1;
    return sheet;
  });

  ctx.luckysheetfile.splice(arrIndex, 1);
  recalcAfterStructuralChange(ctx);
  // _this.reOrderAllSheet();

  // server.saveParam("shd", null, { deleIndex: index });
  if (id === ctx.currentSheetId) {
    const shownSheets = _.cloneDeep(ctx.luckysheetfile).filter(
      (singleSheet) => _.isUndefined(singleSheet.hide) || singleSheet.hide !== 1
    );
    const orderSheets = _.sortBy(shownSheets, (sheet) => sheet.order);
    ctx.currentSheetId = orderSheets?.[0]?.id as string;
  }

  if (ctx.hooks.afterDeleteSheet) {
    setTimeout(() => {
      ctx.hooks.afterDeleteSheet?.(id);
    });
  }
}

export function updateSheet(ctx: Context, newData: Sheet[]) {
  newData.forEach((newDatum) => {
    const { data, row, column } = newDatum;
    const index = getSheetIndex(ctx, newDatum.id!) as number;
    if (data != null) {
      // If row and column exist, compare row and column with data. If row and column do not exist, compare data with default.
      let lastRowNum = data.length;
      let lastColNum = data[0].length;
      if (row != null && column != null && row > 0 && column > 0) {
        lastRowNum = Math.max(lastRowNum, row);
        lastColNum = Math.max(lastColNum, column);
      } else {
        lastRowNum = Math.max(lastRowNum, ctx.defaultrowNum);
        lastColNum = Math.max(lastColNum, ctx.defaultcolumnNum);
      }
      const expandedData: Sheet["data"] = _.times(lastRowNum, () =>
        _.times(lastColNum, () => null)
      );
      for (let i = 0; i < data.length; i += 1) {
        for (let j = 0; j < data[i].length; j += 1) {
          expandedData[i][j] = data[i][j];
          setFormulaCellInfo(ctx, { r: i, c: j, id: newDatum.id! }, data);
        }
      }
      newDatum.data = expandedData;
      if (ctx.luckysheetfile[index] == null) {
        ctx.luckysheetfile.push(newDatum);
      } else {
        ctx.luckysheetfile[index] = newDatum;
      }
    } else if (newDatum.celldata != null) {
      initSheetData(ctx, index, newDatum);
      const _index = getSheetIndex(ctx, newDatum.id!) as number;
      newDatum.celldata?.forEach((d) => {
        setFormulaCellInfo(
          ctx,
          { r: d.r, c: d.c, id: newDatum.id! },
          ctx.luckysheetfile[_index].data
        );
      });
    }
  });
}

export function expandRowsAndColumns(
  data: CellMatrix,
  rowsToAdd: number,
  columnsToAdd: number
) {
  if (rowsToAdd <= 0 && columnsToAdd <= 0) {
    return data;
  }

  if (data.length + rowsToAdd >= 10000) {
    throw new Error(
      "This action would increase the number of rows in the workbook above the limit of 10000."
    );
  }

  if (data[0].length + columnsToAdd >= 1000) {
    throw new Error(
      "This action would increase the number of columns in the workbook above the limit of 1000."
    );
  }
  if (rowsToAdd <= 0) {
    rowsToAdd = 0;
  }

  if (columnsToAdd <= 0) {
    columnsToAdd = 0;
  }

  let currentColLen = 0;
  if (data.length > 0) {
    currentColLen = data[0].length;
  }

  for (let r = 0; r < data.length; r += 1) {
    for (let i = 0; i < columnsToAdd; i += 1) {
      data[r].push(null);
    }
  }

  for (let r = 0; r < rowsToAdd; r += 1) {
    data.push(_.times(currentColLen + columnsToAdd, () => null));
  }

  return data;
}

/* ------------------------------------------------------------------------ */
/* Sheet operations (Excel parity): names, duplicate, move, colour, hide,   */
/* grouped sheets                                                            */
/* ------------------------------------------------------------------------ */

export const SHEET_NAME_MAX_LENGTH = 31;

export type SheetNameError =
  | "blank"
  | "tooLong"
  | "invalidChars"
  | "apostrophe"
  | "duplicate"
  | "reserved";

/**
 * Excel's sheet-name rules: not blank, at most 31 characters, none of
 * `\ / ? * [ ] :`, no leading or trailing apostrophe, not "History", and
 * unique ignoring case. `excludeId` is the sheet being renamed.
 */
export function validateSheetName(
  ctx: Context,
  name: string,
  excludeId?: string
): SheetNameError | null {
  if (name == null || name.trim().length === 0) return "blank";
  if (name.length > SHEET_NAME_MAX_LENGTH) return "tooLong";
  if (/[\\/?*[\]:]/.test(name)) return "invalidChars";
  if (name.startsWith("'") || name.endsWith("'")) return "apostrophe";
  if (name.toLowerCase() === "history") return "reserved";
  const lower = name.toLowerCase();
  const taken = ctx.luckysheetfile.some(
    (s) => s.id !== excludeId && (s.name ?? "").toLowerCase() === lower
  );
  return taken ? "duplicate" : null;
}

export function sheetNameErrorMessage(ctx: Context, error: SheetNameError) {
  const { sheetconfig } = locale(ctx);
  const map: Record<SheetNameError, string> = {
    blank: sheetconfig.nameBlank,
    tooLong: sheetconfig.nameTooLong,
    invalidChars: sheetconfig.nameInvalidChars,
    apostrophe: sheetconfig.nameApostrophe,
    duplicate: sheetconfig.nameDuplicate,
    reserved: sheetconfig.nameReserved,
  };
  return map[error];
}

const SHEET_PREFIX = /^(?:'((?:[^']|'')+)'|([^'!:]+))!/;

/**
 * Rewrites sheet-qualified references to `fromName` so they name `toName`
 * (`Sheet1!A1` -> `'Sheet1 (2)'!A1`). Text in string literals is left alone.
 *
 * Used when duplicating a sheet (the copy's references to its original
 * point at the copy); renames go through refAdjust.adjustReferences.
 */
export function rewriteSheetReferences(
  formula: string,
  fromName: string,
  toName: string
): string {
  if (!formula || fromName === toName) return formula;
  const hasEq = formula.startsWith("=");
  const body = hasEq ? formula.slice(1) : formula;
  const from = fromName.toLowerCase();
  const quoted = quoteSheetName(toName);
  let changed = false;
  const fixPart = (part: string) => {
    const m = part.match(SHEET_PREFIX);
    if (!m) return part;
    const name = m[1] != null ? m[1].replace(/''/g, "'") : m[2];
    if (name.toLowerCase() !== from) return part;
    changed = true;
    return `${quoted}!${part.slice(m[0].length)}`;
  };
  const out = tokenizeFormula(body)
    .map((tok) => {
      if (tok.t !== "ref" || tok.s.indexOf("!") < 0) return tok.s;
      // a range may repeat the sheet on its second part (Sheet1!A1:Sheet1!B2)
      const m = tok.s.match(SHEET_PREFIX);
      const headLength = m ? m[0].length : 0;
      const colon = tok.s.indexOf(":", headLength);
      if (colon < 0) return fixPart(tok.s);
      return `${fixPart(tok.s.slice(0, colon))}:${fixPart(
        tok.s.slice(colon + 1)
      )}`;
    })
    .join("");
  if (!changed) return formula;
  return hasEq ? `=${out}` : out;
}

function forEachFormulaCell(
  sheet: Sheet,
  fn: (cell: Cell, r: number, c: number) => void
) {
  if (sheet.data) {
    sheet.data.forEach((row, r) => {
      row?.forEach((cell, c) => {
        if (cell?.f) fn(cell, r, c);
      });
    });
  } else {
    sheet.celldata?.forEach((d) => {
      if (d.v?.f) fn(d.v, d.r, d.c);
    });
  }
}

/** Points sheet-qualified references to `fromName` at `toName`. */
function renameReferencesInSheet(
  ctx: Context,
  sheet: Sheet,
  fromName: string,
  toName: string,
  register = true
) {
  forEachFormulaCell(sheet, (cell, r, c) => {
    const next = rewriteSheetReferences(cell.f!, fromName, toName);
    if (next !== cell.f) {
      cell.f = next;
      if (register && sheet.data && sheet.id) {
        setFormulaCellInfo(ctx, { r, c, id: sheet.id }, sheet.data);
      }
    }
  });
}

/**
 * Renames the sheet at `index` and rewrites references to it everywhere:
 * formulas on every sheet, defined names, data validation, hyperlinks and
 * conditional-format formulas (refAdjust).
 */
function applySheetRename(ctx: Context, index: number, name: string) {
  const sheet = ctx.luckysheetfile[index];
  const oldName = sheet.name;
  if (oldName && oldName !== name && sheet.id) {
    adjustReferences(ctx, {
      type: "renameSheet",
      sheetId: sheet.id,
      oldName,
      newName: name,
    });
  }
  sheet.name = name;
}

/**
 * Renames a sheet, enforcing Excel's naming rules. Returns the rule that was
 * broken, or null on success. Sheet-qualified references are rewritten.
 */
export function renameSheet(
  ctx: Context,
  sheetId: string,
  name: string
): SheetNameError | null {
  const index = getSheetIndex(ctx, sheetId);
  if (index == null || ctx.allowEdit === false) return null;
  const oldName = ctx.luckysheetfile[index].name;
  if (oldName === name) return null;
  const error = validateSheetName(ctx, name, sheetId);
  if (error) return error;
  if (ctx.hooks.beforeUpdateSheetName?.(sheetId, oldName, name) === false) {
    return null;
  }
  applySheetRename(ctx, index, name);
  if (ctx.hooks.afterUpdateSheetName) {
    setTimeout(() => {
      ctx.hooks.afterUpdateSheetName?.(sheetId, oldName, name);
    });
  }
  return null;
}

/** Excel's name for a copy: "Sheet1 (2)", "Sheet1 (3)", ... (31 chars max). */
export function generateDuplicateSheetName(ctx: Context, name: string) {
  const base = name.replace(/ \(\d+\)$/, "");
  const taken = new Set(
    ctx.luckysheetfile.map((s) => (s.name ?? "").toLowerCase())
  );
  let n = 2;
  for (;;) {
    const suffix = ` (${n})`;
    const candidate =
      base.slice(0, SHEET_NAME_MAX_LENGTH - suffix.length) + suffix;
    if (!taken.has(candidate.toLowerCase())) return candidate;
    n += 1;
  }
}

function sortedSheets(ctx: Context) {
  return _.sortBy(ctx.luckysheetfile, (s) => Number(s.order ?? 0));
}

/**
 * Moves `sheetId` before `beforeSheetId` (null: to the end) and renumbers
 * every sheet's `order` from 0.
 */
export function moveSheet(
  ctx: Context,
  sheetId: string,
  beforeSheetId: string | null
) {
  if (ctx.allowEdit === false || sheetId === beforeSheetId) return;
  const list = sortedSheets(ctx).filter((s) => s.id !== sheetId);
  const moving = ctx.luckysheetfile.find((s) => s.id === sheetId);
  if (!moving) return;
  let at = list.length;
  if (beforeSheetId != null) {
    const i = list.findIndex((s) => s.id === beforeSheetId);
    if (i >= 0) at = i;
  }
  list.splice(at, 0, moving);
  list.forEach((s, i) => {
    s.order = i;
  });
}

function plainValue<T>(v: T): T {
  return isDraft(v) ? current(v) : v;
}

/**
 * Duplicates a sheet (Excel "Move or Copy" with "Create a copy", or
 * Duplicate): the copy gets the next free "Name (n)" name and a new id, its
 * references to the original sheet point at the copy, and it is placed
 * before `beforeSheetId` (undefined: right after the original; null: at
 * the end). The new sheet is appended to `luckysheetfile`. Returns its id.
 */
export function duplicateSheet(
  ctx: Context,
  sheetId: string,
  options: {
    beforeSheetId?: string | null;
    name?: string;
    newSheetId?: string;
  } = {}
): string | null {
  if (ctx.allowEdit === false) return null;
  const index = getSheetIndex(ctx, sheetId);
  if (index == null) return null;
  const source = ctx.luckysheetfile[index];
  const name = options.name ?? generateDuplicateSheetName(ctx, source.name);
  const copy: Sheet = _.cloneDeep(plainValue(source));
  copy.id = options.newSheetId ?? uuidv4();
  copy.name = name;
  copy.status = 0;
  delete copy.hide;
  if (copy.images) {
    copy.images = copy.images.map((img) => ({ ...img, id: uuidv4() }));
  }
  renameReferencesInSheet(ctx, copy, source.name, name, false);
  // tables, sheet-scoped names, DV/CF formulas and charts of the copy
  prepareDuplicatedSheet(ctx, source, copy);

  if (ctx.hooks.beforeAddSheet?.(copy) === false) return null;
  ctx.luckysheetfile.push(copy);
  const newId = copy.id;

  let before: string | null;
  if (options.beforeSheetId !== undefined) {
    before = options.beforeSheetId;
  } else {
    const rest = sortedSheets(ctx).filter((s) => s.id !== newId);
    const i = rest.findIndex((s) => s.id === sheetId);
    before = rest[i + 1]?.id ?? null;
  }
  moveSheet(ctx, newId, before);

  const added = ctx.luckysheetfile[ctx.luckysheetfile.length - 1];
  if (added.data) {
    forEachFormulaCell(added, (_cell, r, c) => {
      setFormulaCellInfo(ctx, { r, c, id: newId }, added.data!);
    });
  }

  if (ctx.hooks.afterAddSheet) {
    setTimeout(() => {
      ctx.hooks.afterAddSheet?.(copy);
    });
  }
  return newId;
}

/** Sets (or with undefined clears) the tab colour of the given sheets. */
export function setSheetTabColor(
  ctx: Context,
  sheetIds: string[],
  color: string | undefined
) {
  if (ctx.allowEdit === false) return;
  sheetIds.forEach((id) => {
    const i = getSheetIndex(ctx, id);
    if (i == null) return;
    if (color) ctx.luckysheetfile[i].color = color;
    else delete ctx.luckysheetfile[i].color;
  });
}

function isVisibleSheet(s: Sheet) {
  return s.hide !== 1;
}

function rememberSheetView(ctx: Context) {
  if (!ctx.sheetScrollRecord) return;
  ctx.sheetScrollRecord[ctx.currentSheetId] = {
    scrollLeft: ctx.scrollLeft,
    scrollTop: ctx.scrollTop,
    luckysheet_select_status: ctx.luckysheet_select_status,
    luckysheet_select_save: ctx.luckysheet_select_save,
    luckysheet_selection_range: ctx.luckysheet_selection_range,
  };
}

/**
 * Hides sheets. At least one sheet must stay visible (returns false and
 * changes nothing otherwise). When the active sheet is hidden, the next
 * visible sheet becomes active.
 */
export function hideSheets(ctx: Context, sheetIds: string[]): boolean {
  if (ctx.allowEdit === false) return false;
  const ids = new Set(sheetIds);
  const remaining = sortedSheets(ctx).filter(
    (s) => isVisibleSheet(s) && !ids.has(s.id!)
  );
  if (remaining.length === 0) return false;
  const order = sortedSheets(ctx);
  const cur = order.findIndex((s) => s.id === ctx.currentSheetId);
  ctx.luckysheetfile.forEach((s) => {
    if (ids.has(s.id!)) {
      s.hide = 1;
      s.status = 0;
    }
  });
  ctx.groupedSheetIds = undefined;
  if (ids.has(ctx.currentSheetId)) {
    const next =
      order.slice(cur + 1).find(isVisibleSheet) ??
      order.slice(0, Math.max(cur, 0)).reverse().find(isVisibleSheet);
    if (next?.id) {
      rememberSheetView(ctx);
      ctx.currentSheetId = next.id;
      ctx.zoomRatio = next.zoomRatio || 1;
    }
  }
  return true;
}

/** Unhides sheets; the last one unhidden becomes active (as in Excel). */
export function unhideSheets(ctx: Context, sheetIds: string[]) {
  if (ctx.allowEdit === false) return;
  let last: Sheet | undefined;
  sheetIds.forEach((id) => {
    const i = getSheetIndex(ctx, id);
    if (i == null) return;
    delete ctx.luckysheetfile[i].hide;
    last = ctx.luckysheetfile[i];
  });
  if (last?.id && last.id !== ctx.currentSheetId) {
    rememberSheetView(ctx);
    ctx.currentSheetId = last.id;
    ctx.zoomRatio = last.zoomRatio || 1;
  }
}

/* ---- grouped sheets ---------------------------------------------------- */

/**
 * Sheets in the current group (Ctrl/Shift+click on tabs), in tab order.
 * Empty when sheets aren't grouped. The active sheet is always a member.
 */
export function getGroupedSheetIds(ctx: Context): string[] {
  const ids = ctx.groupedSheetIds;
  if (!ids || ids.length < 2) return [];
  const set = new Set(ids);
  set.add(ctx.currentSheetId);
  const out = sortedSheets(ctx)
    .filter((s) => isVisibleSheet(s) && set.has(s.id!))
    .map((s) => s.id!);
  return out.length > 1 ? out : [];
}

/** Ctrl+click on a tab: adds it to, or removes it from, the group. */
export function toggleSheetInGroup(ctx: Context, sheetId: string) {
  if (sheetId === ctx.currentSheetId) return;
  const ids = new Set(getGroupedSheetIds(ctx));
  ids.add(ctx.currentSheetId);
  if (ids.has(sheetId)) ids.delete(sheetId);
  else ids.add(sheetId);
  ctx.groupedSheetIds = ids.size > 1 ? Array.from(ids) : undefined;
}

/** Shift+click on a tab: groups every visible sheet from the active one. */
export function selectSheetRange(ctx: Context, sheetId: string) {
  const visible = sortedSheets(ctx).filter(isVisibleSheet);
  const a = visible.findIndex((s) => s.id === ctx.currentSheetId);
  const b = visible.findIndex((s) => s.id === sheetId);
  if (a < 0 || b < 0) return;
  const ids = visible
    .slice(Math.min(a, b), Math.max(a, b) + 1)
    .map((s) => s.id!);
  ctx.groupedSheetIds = ids.length > 1 ? ids : undefined;
}

export function selectAllSheets(ctx: Context) {
  const ids = sortedSheets(ctx)
    .filter(isVisibleSheet)
    .map((s) => s.id!);
  ctx.groupedSheetIds = ids.length > 1 ? ids : undefined;
}

export function ungroupSheets(ctx: Context) {
  ctx.groupedSheetIds = undefined;
}

/**
 * A plain click on a tab: switching to a sheet of the group keeps the group
 * unless every sheet is grouped; switching elsewhere ungroups (Excel).
 */
export function onSheetTabActivated(ctx: Context, sheetId: string) {
  const ids = getGroupedSheetIds(ctx);
  if (ids.length === 0) return;
  const visible = ctx.luckysheetfile.filter(isVisibleSheet).length;
  if (!ids.includes(sheetId) || ids.length === visible) {
    ctx.groupedSheetIds = undefined;
  }
}

/** Updates that applied themselves to every grouped sheet (not mirrored). */
const GROUP_EDIT_HANDLED = new WeakSet<Context>();

/**
 * Delete / Clear Contents with grouped sheets: clears the contents of the
 * selected cells on every other grouped sheet as well, including cells that
 * are already empty on the active sheet. Each sheet keeps its own formats,
 * so the update is then not mirrored. Call it in the same update, after
 * clearing the active sheet.
 */
export function clearGroupedSheetsContents(ctx: Context) {
  const ids = getGroupedSheetIds(ctx);
  const selection = ctx.luckysheet_select_save;
  if (ids.length < 2 || !selection?.length) return;
  GROUP_EDIT_HANDLED.add(ctx);
  ids.forEach((id) => {
    if (id === ctx.currentSheetId) return;
    const j = getSheetIndex(ctx, id);
    if (j == null) return;
    const sheet = ctx.luckysheetfile[j];
    if (_.isEmpty(sheet.data)) initSheetData(ctx, j, sheet);
    const { data } = sheet;
    if (!data) return;
    const changed: { r: number; c: number; id: string }[] = [];
    selection.forEach(({ row, column }) => {
      const r2 = Math.min(row[1] ?? row[0], data.length - 1);
      for (let r = row[0]; r <= r2; r += 1) {
        const c2 = Math.min(column[1] ?? column[0], (data[r]?.length ?? 0) - 1);
        for (let c = column[0]; c <= c2; c += 1) {
          const cell = data[r][c];
          if (cell && (cell.v != null || cell.f != null || cell.m != null)) {
            if (cell.f) delFunctionGroup(ctx, r, c, id);
            const kept: Cell = _.omit(cell, ["v", "m", "f", "spl", "qp", "hl"]);
            if (kept.ct?.t === "inlineStr") kept.ct = { fa: "General", t: "g" };
            data[r][c] = kept;
            changed.push({ r, c, id });
          }
          if (sheet.hyperlink?.[`${r}_${c}`]) {
            delete sheet.hyperlink[`${r}_${c}`];
          }
        }
      }
    });
    if (changed.length === 0) return;
    const prev = ctx.currentSheetId;
    ctx.currentSheetId = id;
    try {
      recalculate(ctx, changed, null);
    } finally {
      ctx.currentSheetId = prev;
    }
  });
}

const MIRRORED_CONFIG_MAPS = [
  "rowlen",
  "columnlen",
  "customHeight",
  "customWidth",
  "rowhidden",
  "colhidden",
  "merge",
] as const;

/**
 * Grouped sheets: repeats on every other grouped sheet the cell edits and
 * formatting (cells, row heights, column widths, hidden rows/columns, merges
 * and new borders) that one context update made on the active sheet.
 * `base` is the context before the update, `draft` the updated one; call it
 * at the end of the update so everything lands in the same undo step.
 * Structural changes (sheet added/removed/switched, rows or columns
 * inserted/deleted) are not mirrored.
 */
export function mirrorGroupedSheetEdits(base: Context, draft: Context) {
  // the update already handled every grouped sheet itself
  if (GROUP_EDIT_HANDLED.delete(draft)) return;
  const ids = getGroupedSheetIds(draft);
  if (ids.length < 2) return;
  if (base.currentSheetId !== draft.currentSheetId) return;
  if (base.luckysheetfile.length !== draft.luckysheetfile.length) return;
  const idx = getSheetIndex(draft, draft.currentSheetId);
  if (idx == null) return;
  const baseSheet = base.luckysheetfile[idx];
  const draftSheet = draft.luckysheetfile[idx];
  if (!baseSheet || baseSheet.id !== draftSheet.id) return;
  const before = baseSheet.data;
  const after = draftSheet.data ? plainValue(draftSheet.data) : null;
  if (!before || !after) return;
  if (
    before.length !== after.length ||
    (before[0]?.length ?? 0) !== (after[0]?.length ?? 0)
  ) {
    return;
  }

  const changed: [number, number, Cell | null][] = [];
  if (after !== before) {
    for (let r = 0; r < after.length; r += 1) {
      const nr = after[r];
      const br = before[r];
      if (nr !== br) {
        for (let c = 0; c < nr.length; c += 1) {
          if (nr[c] !== br?.[c] && !_.isEqual(nr[c], br?.[c])) {
            changed.push([r, c, nr[c]]);
          }
        }
      }
    }
  }
  const baseConfig: any = baseSheet.config ?? {};
  const nextConfig: any = draftSheet.config
    ? plainValue(draftSheet.config)
    : {};
  const configChanged =
    baseConfig !== nextConfig && !_.isEqual(baseConfig, nextConfig);
  if (changed.length === 0 && !configChanged) return;

  ids.forEach((id) => {
    if (id === draft.currentSheetId) return;
    const j = getSheetIndex(draft, id);
    if (j == null) return;
    const target = draft.luckysheetfile[j];
    if (_.isEmpty(target.data)) initSheetData(draft, j, target);
    const { data } = target;
    if (!data) return;
    const rows = data.length;
    const cols = data[0]?.length ?? 0;
    const formulas: [number, number, string][] = [];
    const values: { r: number; c: number; id: string }[] = [];
    changed.forEach(([r, c, cell]) => {
      if (r >= rows || c >= cols) return;
      if (cell == null) {
        data[r][c] = null;
        values.push({ r, c, id });
        return;
      }
      const copy: any = _.cloneDeep(cell);
      delete copy.spill;
      delete copy.spillFrom;
      if (copy.f) {
        const { f } = copy;
        delete copy.f;
        delete copy.v;
        delete copy.m;
        data[r][c] = copy;
        formulas.push([r, c, f]);
      } else {
        data[r][c] = copy;
        values.push({ r, c, id });
      }
    });
    if (configChanged) {
      target.config ??= {};
      const cfg: any = target.config;
      MIRRORED_CONFIG_MAPS.forEach((key) => {
        const a = baseConfig[key] ?? {};
        const b = nextConfig[key] ?? {};
        if (a === b) return;
        _.union(Object.keys(a), Object.keys(b)).forEach((k) => {
          if (_.isEqual(a[k], b[k])) return;
          cfg[key] ??= {};
          if (b[k] === undefined) delete cfg[key][k];
          else cfg[key][k] = _.cloneDeep(b[k]);
        });
      });
      const ba = baseConfig.borderInfo ?? [];
      const bb = nextConfig.borderInfo ?? [];
      if (bb.length > ba.length) {
        cfg.borderInfo = [
          ...(cfg.borderInfo ?? []),
          ..._.cloneDeep(bb.slice(ba.length)),
        ];
      }
    }
    const prev = draft.currentSheetId;
    draft.currentSheetId = id;
    try {
      formulas.forEach(([r, c, f]) => updateCell(draft, r, c, null, f));
      if (values.length > 0) recalculate(draft, values, null);
    } finally {
      draft.currentSheetId = prev;
    }
  });
}

export function editSheetName(ctx: Context, editable: HTMLSpanElement) {
  const index = getSheetIndex(ctx, ctx.currentSheetId);
  if (ctx.allowEdit === false) {
    if (index == null) return;
    editable.innerText = ctx.luckysheetfile[index].name;
    return;
  }
  const oldtxt = editable.dataset.oldText || "";
  const txt = editable.innerText;

  if (
    ctx.hooks.beforeUpdateSheetName?.(ctx.currentSheetId, oldtxt, txt) === false
  ) {
    return;
  }

  if (index == null) return;

  const error = validateSheetName(ctx, txt, ctx.currentSheetId);
  if (error) {
    editable.innerText = oldtxt;
    throw new Error(sheetNameErrorMessage(ctx, error));
  }

  applySheetRename(ctx, index, txt);

  if (ctx.hooks.afterUpdateSheetName) {
    setTimeout(() => {
      ctx.hooks.afterUpdateSheetName?.(ctx.currentSheetId, oldtxt, txt);
    });
  }
}
