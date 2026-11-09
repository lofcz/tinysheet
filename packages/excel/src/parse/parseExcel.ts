import { CsvParseOptions, parseCsv } from "../csv";
import type { ExcelImportResult, ExcelImportSizing } from "./types";
import { workBookFile } from "../common/constant";
import { encodeWorkbookBytes } from "../preservation";
import { prepareSourceImport, bindSourceImport } from "./source";

/** Why a file could not be imported (`code`), with a readable message. */
export class ExcelImportError extends Error {
  code: "unsupported-format" | "not-a-zip" | "no-workbook";

  constructor(code: ExcelImportError["code"], message: string) {
    super(message);
    this.name = "ExcelImportError";
    this.code = code;
  }
}

export type ParseExcelOptions = {
  /** Keep the original package for loss-aware export. Defaults to true. */
  preserve?: boolean;
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
  return parseExcelDocument(input, fileName, options, true);
}

/** Worker requests return the source descriptor; the receiving thread owns cell views. */
export async function parseExcelDocument(
  input: File | Blob | ArrayBuffer | Uint8Array,
  fileName: string | undefined,
  options: ParseExcelOptions,
  bindSources: boolean
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
  const head = new Uint8Array(buffer, 0, Math.min(8, buffer.byteLength));
  if (head[0] === 0xd0 && head[1] === 0xcf && head[2] === 0x11) {
    // OLE2 compound file: a legacy .xls, or an encrypted .xlsx
    throw new ExcelImportError(
      "unsupported-format",
      "This file is a legacy .xls or a password-protected workbook; save it as an unprotected .xlsx first."
    );
  }
  let result: ExcelImportResult;
  try {
    result = prepareSourceImport(new Uint8Array(buffer), name);
  } catch (e) {
    if (
      head[0] === 0x50 &&
      head[1] === 0x4b &&
      (e as any)?.format === "unknown"
    ) {
      throw new ExcelImportError(
        "no-workbook",
        "Not an .xlsx workbook: the package has no workbook part."
      );
    }
    throw new ExcelImportError(
      "not-a-zip",
      `Not an .xlsx file (${e instanceof Error ? e.message : String(e)})`
    );
  }
  if (!result.source.files[workBookFile]) {
    throw new ExcelImportError(
      "no-workbook",
      "Not an .xlsx workbook: the package has no workbook part."
    );
  }
  if (options.preserve !== false)
    result.preservation = {
      version: 3,
      source: encodeWorkbookBytes(new Uint8Array(buffer)),
      sheets: result.sheets.map((sheet) => ({
        id: String(sheet.id),
        name: sheet.name,
      })),
      macroEnabled: /macroEnabled\.main\+xml/i.test(
        result.source.files["[Content_Types].xml"] || ""
      ),
    };
  return bindSources ? bindSourceImport(result) : result;
}
