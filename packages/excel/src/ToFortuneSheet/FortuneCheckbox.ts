/**
 * Cell checkboxes from xlsx: cells whose cell format carries the checkbox
 * feature property bag (see ToExcel/ExcelCheckbox.ts) get `cb: 1`.
 */
import type { SheetImportContext } from "./importFeatures";
import {
  checkboxCellsOf,
  checkboxXfIndexes,
  FEATURE_BAG_PATH,
} from "../ToExcel/ExcelCheckbox";

const cache = new WeakMap<object, Set<number>>();

export function readCheckboxes(ctx: SheetImportContext) {
  const { files } = ctx;
  let xfs = cache.get(files);
  if (!xfs) {
    xfs = checkboxXfIndexes(files["xl/styles.xml"], files[FEATURE_BAG_PATH]);
    cache.set(files, xfs);
  }
  if (xfs.size === 0) return;
  const sheetXml = files[ctx.sheetFile];
  if (!sheetXml) return;
  checkboxCellsOf(sheetXml, xfs).forEach(({ r, c }) => {
    const entry = ctx.sheet.celldata.find((x) => x.r === r && x.c === c);
    if (!entry || entry.v == null || typeof entry.v !== "object") return;
    (entry.v as any).cb = 1;
  });
}
