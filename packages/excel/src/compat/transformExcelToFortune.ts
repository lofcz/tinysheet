import { parseExcel } from "../parse/parseExcel";
import { applyExcelImport } from "../hydrate/applyExcelImport";

/**
 * @deprecated Prefer parseExcel() + applyExcelImport(workbook, result).
 * Kept for one release cycle; no longer uses setTimeout for sizing.
 */
export const transformExcelToFortune = async (
  file: any,
  setSheets: any,
  setKey: any,
  sheetRef: any
) => {
  const result = await parseExcel(file);
  setSheets(result.sheets);
  setKey((k: number) => k + 1);

  // When sheetRef is already mounted, hydrate immediately.
  // After a key-bump remount, callers should use applyExcelImport in useLayoutEffect.
  if (sheetRef?.current?.setContext) {
    applyExcelImport(sheetRef.current, result);
  }
};
