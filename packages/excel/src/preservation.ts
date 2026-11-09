import { mergeXlsxEdits, type FidelityDiagnostic } from "@lofcz/ts-xlsx/xlsx";
import type { Sheet } from "@lofcz/tinysheet-core";
import type { ExcelImportResult } from "./parse/types";
import { exportToXlsx } from "./ToExcel/buildWorkbook";
import JSZip from "jszip";

/** Plain JSON: safe to persist alongside the editor's sheets and restore in a later session. */
type PreservationSource = {
  source: string;
  sheets: { id: string; name: string }[];
  macroEnabled: boolean;
};

export type XlsxPreservation = PreservationSource &
  (
    | { version: 1; baseline: string }
    // Compressed JSON captures the imported model before edits or hydration.
    // Materialize its XLSX only on export, not on the loading path. Compression
    // also keeps worker transfers and persisted workbook metadata small.
    | { version: 2; baselineSheetsZip: string }
    // The package is the backing store. No second workbook or baseline is
    // constructed during import; export can reconstruct a baseline on demand.
    | { version: 3 }
  );

export type XlsxFidelityDiagnostic = FidelityDiagnostic;

export function encodeWorkbookBytes(bytes: Uint8Array): string {
  const native = (bytes as Uint8Array & { toBase64?: () => string }).toBase64;
  if (native) return native.call(bytes);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 32768)
    binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return btoa(binary);
}

function decodeWorkbookBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function restoreWorkbookSheets(snapshot: string): Promise<Sheet[]> {
  const zip = await JSZip.loadAsync(decodeWorkbookBytes(snapshot));
  const file = zip.file("sheets.json");
  if (!file) throw new Error("Invalid workbook preservation snapshot");
  return JSON.parse(await file.async("string"));
}

export async function preserveWorkbookEdits(
  source: XlsxPreservation,
  sheets: Sheet[],
  edited: Uint8Array
) {
  if (
    (source.version !== 1 && source.version !== 2 && source.version !== 3) ||
    !Array.isArray(source.sheets)
  )
    throw new Error("Unsupported workbook preservation state");
  const original = new Map(
    source.sheets.map((sheet) => [sheet.id, sheet.name])
  );
  const baseline =
    source.version === 1
      ? decodeWorkbookBytes(source.baseline)
      : await exportToXlsx(
          source.version === 2
            ? await restoreWorkbookSheets(source.baselineSheetsZip)
            : (
                await (
                  await import("./parse/parseExcel")
                ).parseExcel(
                  decodeWorkbookBytes(source.source),
                  "workbook.xlsx",
                  { preserve: false }
                )
              ).sheets,
          {
            timestamp: new Date("2000-01-01T00:00:00.000Z"),
          }
        );
  return mergeXlsxEdits(decodeWorkbookBytes(source.source), baseline, edited, {
    sheets: sheets.map((sheet) => {
      const name = original.get(String(sheet.id));
      return {
        name: sheet.name,
        ...(name ? { originalName: name, baselineName: name } : {}),
      };
    }),
  });
}

/** Capture editor content and its import metadata together, so saves cannot silently drop fidelity. */
export function captureExcelWorkbook(api: {
  getAllSheets(): Sheet[];
  getWorkbookMetadata?(): Record<string, unknown>;
}): ExcelImportResult {
  const preservation = api.getWorkbookMetadata?.().xlsxPreservation as
    | XlsxPreservation
    | undefined;
  return {
    sheets: structuredClone(api.getAllSheets()),
    sizing: [],
    ...(preservation ? { preservation: structuredClone(preservation) } : {}),
  };
}
