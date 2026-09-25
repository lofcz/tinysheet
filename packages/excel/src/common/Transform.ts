import { exportSheetExcel, SheetExportOptions } from "../ToExcel/ExcelFile";
import { IFileType } from "./ICommon";

export { transformExcelToFortune } from "../compat/transformExcelToFortune";

export const transformFortuneToExcel = async (
  luckysheetRef: any,
  fileType: IFileType = IFileType.XLSX,
  download: boolean = true,
  options: SheetExportOptions = {}
) => {
  const result = await exportSheetExcel(
    luckysheetRef,
    fileType,
    download,
    options
  );
  return result;
};
