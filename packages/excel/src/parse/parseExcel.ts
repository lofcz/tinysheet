import { FortuneFile } from "../ToFortuneSheet/FortuneFile";
import { HandleZip } from "../ToFortuneSheet/HandleZip";
import { CsvParseOptions, parseCsv } from "../csv";
import type { ExcelImportResult, ExcelImportSizing } from "./types";

export type ParseExcelOptions = {
  /** Options for .csv / .tsv / .txt input (delimiter, encoding, locale). */
  csv?: CsvParseOptions;
};

const TEXT_EXTENSIONS = /\.(csv|tsv|tab|txt)$/i;
const TEXT_TYPES = new Set([
  "text/csv",
  "text/tab-separated-values",
  "text/plain",
]);

function sizingOf(sheets: ExcelImportResult["sheets"]): ExcelImportSizing[] {
  return sheets.map((sheet) => ({
    id: sheet.id as string,
    columnlen: sheet.config?.columnlen,
    rowlen: sheet.config?.rowlen,
  }));
}

async function parseTextFile(
  file: File | Blob | ArrayBuffer,
  name: string,
  options: CsvParseOptions = {}
): Promise<ExcelImportResult> {
  const csvOptions: CsvParseOptions = { ...options };
  if (!csvOptions.delimiter && /\.(tsv|tab)$/i.test(name)) {
    csvOptions.delimiter = "\t";
  }
  if (!csvOptions.sheetName) {
    csvOptions.sheetName =
      name
        .replace(TEXT_EXTENSIONS, "")
        .replace(/[:\\/?*[\]]/g, "_")
        .slice(0, 31) || "Sheet1";
  }
  const { sheet } = await parseCsv(file, csvOptions);
  const sheets = [
    { ...sheet, id: "1" },
  ] as unknown as ExcelImportResult["sheets"];
  return { sheets, sizing: sizingOf(sheets) };
}

/**
 * Parse an .xlsx (or .csv / .tsv / .txt) file into TinySheet sheets without
 * mounting a Workbook. Chart images include `chartSpec` for later hydration
 * after formula calculation.
 */
export async function parseExcel(
  input: File | Blob | ArrayBuffer | Uint8Array,
  fileName?: string,
  options: ParseExcelOptions = {}
): Promise<ExcelImportResult> {
  const file: File | Blob | ArrayBuffer =
    ArrayBuffer.isView(input) &&
    typeof (input as any).arrayBuffer !== "function"
      ? (input.buffer.slice(
          input.byteOffset,
          input.byteOffset + input.byteLength
        ) as ArrayBuffer)
      : (input as File | Blob | ArrayBuffer);
  const blob = file as Blob & { name?: string };
  const name =
    fileName ||
    (!(file instanceof ArrayBuffer) && blob.name) ||
    "workbook.xlsx";

  if (
    TEXT_EXTENSIONS.test(name) ||
    (!(file instanceof ArrayBuffer) && TEXT_TYPES.has(blob.type))
  ) {
    return parseTextFile(file, name, options.csv);
  }

  const buffer =
    file instanceof ArrayBuffer ? file : await (file as Blob).arrayBuffer();
  const files = await new HandleZip(new File([buffer], name)).unzipFile();
  const fortuneFile = new FortuneFile(files, name);
  fortuneFile.Parse();
  const serialized = fortuneFile.serialize();
  const sheets = serialized.sheets as unknown as ExcelImportResult["sheets"];
  return { sheets, sizing: sizingOf(sheets) };
}
