import _ from "lodash";
import { checkWorkbookStructure } from "../modules/protection";
import { getSheet } from "./common";
import { Context } from "../context";
import { CellMatrix, CellWithRowAndCol, Sheet, SingleRange } from "../types";
import { getSheetIndex } from "../utils";
import { api, execfunction, insertUpdateFunctionGroup } from "..";
import { duplicateSheet, hideSheets } from "../modules/sheet";

export function getAllSheets(ctx: Context) {
  return ctx.luckysheetfile;
}

export { getSheet };

export function initSheetData(
  draftCtx: Context,
  index: number,
  newData: Sheet
): CellMatrix | null {
  const { celldata, row, column } = newData;
  const lastRow = _.maxBy<CellWithRowAndCol>(celldata, "r");
  const lastCol = _.maxBy(celldata, "c");
  let lastRowNum = (lastRow?.r ?? 0) + 1;
  let lastColNum = (lastCol?.c ?? 0) + 1;
  if (row != null && column != null && row > 0 && column > 0) {
    lastRowNum = Math.max(lastRowNum, row);
    lastColNum = Math.max(lastColNum, column);
  } else {
    lastRowNum = Math.max(lastRowNum, draftCtx.defaultrowNum);
    lastColNum = Math.max(lastColNum, draftCtx.defaultcolumnNum);
  }
  if (lastRowNum && lastColNum) {
    const expandedData: Sheet["data"] = _.times(lastRowNum, () =>
      _.times(lastColNum, () => null)
    );
    celldata?.forEach((d) => {
      expandedData[d.r][d.c] = d.v;
    });
    if (draftCtx.luckysheetfile[index] == null) {
      newData.data = expandedData;
      delete newData.celldata;
      draftCtx.luckysheetfile.push(newData);
    } else {
      draftCtx.luckysheetfile[index].data = expandedData;
      delete draftCtx.luckysheetfile[index].celldata;
    }
    return expandedData;
  }
  return null;
}

export function hideSheet(ctx: Context, sheetId: string) {
  hideSheets(ctx, [sheetId]);
}

export function showSheet(ctx: Context, sheetId: string) {
  if (!checkWorkbookStructure(ctx)) return;
  const index = getSheetIndex(ctx, sheetId) as number;
  ctx.luckysheetfile[index].hide = undefined;
}

/**
 * Copies a sheet like Excel's Duplicate: "Name (2)", placed right after the
 * original, with references to the original pointing at the copy.
 */
export function copySheet(ctx: Context, sheetId: string) {
  return duplicateSheet(ctx, sheetId);
}

function calculateSheetFromula(ctx: Context, id: string, range?: SingleRange) {
  const index = getSheetIndex(ctx, id) as number;
  if (!ctx.luckysheetfile[index].data) return;

  if (!range) {
    range = {
      row: [0, ctx.luckysheetfile[index].data!.length - 1],
      column: [0, ctx.luckysheetfile[index].data![0].length - 1],
    };
  }
  const rowCount = range.row[1] - range.row[0] + 1;
  const columnCount = range.column[1] - range.column[0] + 1;

  for (let _r = 0; _r < rowCount; _r += 1) {
    for (let _c = 0; _c < columnCount; _c += 1) {
      const r = range.row[0] + _r;
      const c = range.column[0] + _c;

      if (!ctx.luckysheetfile[index].data![r][c]?.f) {
        continue;
      }
      const result = execfunction(
        ctx,
        ctx.luckysheetfile[index].data![r][c]?.f!,
        r,
        c,
        id
      );
      api.setCellValue(ctx, r, c, result[1], null);
      insertUpdateFunctionGroup(ctx, r, c, id);
    }
  }
}

export function calculateFormula(
  ctx: Context,
  id?: string,
  range?: SingleRange
) {
  if (id) {
    calculateSheetFromula(ctx, id, range);
    return;
  }
  _.forEach(ctx.luckysheetfile, (sheet_obj) => {
    calculateSheetFromula(ctx, sheet_obj.id as string, range);
  });
}
