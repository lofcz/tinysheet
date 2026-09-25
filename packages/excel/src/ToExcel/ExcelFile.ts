import * as fileSaver from "file-saver";
import { IFileType } from "../common/ICommon";
import { exportToXlsx, XlsxExportOptions } from "./buildWorkbook";
import { CsvExportOptions, exportCsv } from "../csv";

export type SheetExportOptions = XlsxExportOptions & {
  /** CSV/TSV only: see CsvExportOptions (values: "displayed" | "raw", ...). */
  csv?: CsvExportOptions;
  /** File name without extension (default: the current sheet's name). */
  fileName?: string;
};

/**
 * Export a mounted Workbook (ref with getAllSheets/getSheet): the whole
 * workbook as .xlsx, or the current sheet as .csv / .tsv.
 */
export async function exportSheetExcel(
  luckysheetRef: any,
  fileType: IFileType,
  download: boolean = true,
  options: SheetExportOptions = {}
) {
  const api = luckysheetRef.current;
  const current = api.getSheet();
  let fileData: Blob;
  if (fileType === IFileType.CSV || fileType === IFileType.TSV) {
    fileData = exportCsv(current, {
      ...(fileType === IFileType.TSV ? { delimiter: "\t" } : {}),
      ...options.csv,
    });
  } else {
    const bytes = await exportToXlsx(api.getAllSheets(), options);
    fileData = new Blob([bytes as Uint8Array<ArrayBuffer>], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
  }
  if (download) {
    const name = options.fileName ?? current?.name ?? "workbook";
    fileSaver.saveAs(fileData, `${name}.${fileType}`);
  }
  return fileData;
}
