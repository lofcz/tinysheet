/**
 * TinySheet -> xlsx export pipeline.
 *
 * `buildExcelWorkbook` turns TinySheet sheets (with `data` or `celldata`)
 * into an ExcelJS workbook by running a list of feature writers per sheet,
 * then per workbook. `exportToXlsx` serialises it and runs the registered
 * zip post-processors on the package for what ExcelJS cannot express (see
 * postProcessors.ts, `registerXlsxPostProcessor`).
 *
 * Extending: other feature owners (defined names, conditional formatting,
 * charts, ...) add a writer to `sheetExportFeatures` /
 * `workbookExportFeatures` (or call `registerSheetExportFeature`) instead of
 * editing the cell writer. Writers run in array order; the built-in order is
 * sheet properties -> sizes -> cells -> tables -> notes -> threaded comments
 * -> merges ->
 * borders -> images -> data validation -> views.
 */
import ExcelJS from "@protobi/exceljs";
import type { XlsxPostProcessInfo } from "./postProcess";
import type { XlsxWorksheetPart } from "./postProcessors";
import { runXlsxPostProcessors } from "./postProcessors";
import { writeCells, writeNotes } from "./ExcelStyle";
import { setBorder } from "./ExcelBorder";
import { setImages } from "./ExcelImage";
import { writeCellImages } from "./ExcelCellImage";
import { setDataValidations } from "./ExcelValidation";
import { writeTables } from "./ExcelTable";
import { writeThreadedComments } from "./ExcelThreadedComments";
import {
  writeColumnsAndRows,
  writeMerges,
  writeSheetViews,
} from "./ExcelConfig";
import { colorToArgb } from "../common/units";
import { setDefinedNames } from "../common/definedNames";
import { exportCalcProperties } from "../common/calcProperties";
import { writePageSetup, writePrintNames } from "../common/pageSetup";
import { setConditionalFormatting } from "./ExcelConditionFormat";

export type XlsxExportOptions = {
  /** Skip sheets with hide=1 instead of exporting them as hidden. */
  skipHiddenSheets?: boolean;
  /** Column width (px) used for columns without an explicit width. */
  defaultColumnWidth?: number;
  /** Workbook creator metadata. */
  creator?: string;
};

export type ExportCell = Record<string, any>;
export type ExportCellMatrix = (ExportCell | null)[][];

export type SheetExportContext = {
  workbook: ExcelJS.Workbook;
  worksheet: ExcelJS.Worksheet;
  /** The TinySheet sheet being exported. */
  sheet: any;
  /** Cell matrix of the sheet (built from celldata when data is absent). */
  data: ExportCellMatrix;
  /** All sheets being exported (for cross-sheet lookups). */
  sheets: any[];
  options: XlsxExportOptions;
  /** Zip-level fixups collected while writing (dynamic arrays, ...). */
  post: XlsxPostProcessInfo;
};

export type WorkbookExportContext = {
  workbook: ExcelJS.Workbook;
  sheets: any[];
  /** Worksheet per exported sheet, in the same order as `sheets`. */
  worksheets: (ExcelJS.Worksheet | null)[];
  options: XlsxExportOptions;
  post: XlsxPostProcessInfo;
};

export type SheetExportFeature = {
  name: string;
  write: (ctx: SheetExportContext) => void;
};

export type WorkbookExportFeature = {
  name: string;
  write: (ctx: WorkbookExportContext) => void;
};

function borders(ctx: SheetExportContext) {
  const { config } = ctx.sheet;
  if (!config?.borderInfo?.length) return;
  // Borders on hidden rows/columns are still borders in Excel.
  const visibleConfig = { ...config };
  delete visibleConfig.rowhidden;
  delete visibleConfig.colhidden;
  setBorder(
    { ...ctx.sheet, config: visibleConfig, data: ctx.data },
    ctx.worksheet
  );
}

/** Per-sheet writers, in order. */
export const sheetExportFeatures: SheetExportFeature[] = [
  { name: "columns-rows", write: writeColumnsAndRows },
  { name: "cells", write: writeCells },
  // pictures placed in cells (rich values, see ExcelCellImage.ts)
  { name: "cell-images", write: writeCellImages },
  { name: "tables", write: writeTables },
  { name: "notes", write: writeNotes },
  // after notes: a thread's legacy note replaces a note on the same cell
  { name: "threaded-comments", write: writeThreadedComments },
  { name: "merges", write: writeMerges },
  { name: "borders", write: borders },
  {
    name: "images",
    write: (ctx) =>
      setImages({ ...ctx.sheet, data: ctx.data }, ctx.worksheet, ctx.workbook),
  },
  {
    name: "data-validation",
    write: (ctx) => setDataValidations(ctx.sheet, ctx.worksheet, ctx.post),
  },
  {
    name: "conditional-formatting",
    write: (ctx) => setConditionalFormatting(ctx.sheet, ctx.worksheet),
  },
  { name: "views", write: writeSheetViews },
  { name: "page-setup", write: writePageSetup },
  // Charts are added to the written zip (the "charts" post-processor).
];

/** Workbook-level writers (run after every sheet was written). */
export const workbookExportFeatures: WorkbookExportFeature[] = [
  {
    name: "defined-names",
    write: (ctx) => setDefinedNames(ctx.workbook, ctx.sheets),
  },
  { name: "print-names", write: writePrintNames },
  { name: "calc-properties", write: exportCalcProperties },
];

export function registerSheetExportFeature(
  feature: SheetExportFeature,
  before?: string
) {
  const at = before
    ? sheetExportFeatures.findIndex((f) => f.name === before)
    : -1;
  if (at >= 0) sheetExportFeatures.splice(at, 0, feature);
  else sheetExportFeatures.push(feature);
}

export function registerWorkbookExportFeature(feature: WorkbookExportFeature) {
  workbookExportFeatures.push(feature);
}

/** The sheet's cells as a matrix, whether it is loaded (data) or not (celldata). */
export function sheetCellMatrix(sheet: any): ExportCellMatrix {
  if (Array.isArray(sheet?.data) && sheet.data.length > 0) return sheet.data;
  const matrix: ExportCellMatrix = [];
  const celldata: any[] = sheet?.celldata || [];
  let cols = 0;
  celldata.forEach((cell) => {
    if (cell?.v == null) return;
    if (!matrix[cell.r]) matrix[cell.r] = [];
    matrix[cell.r][cell.c] = cell.v;
    cols = Math.max(cols, cell.c + 1);
  });
  for (let r = 0; r < matrix.length; r += 1) {
    if (!matrix[r]) matrix[r] = [];
    for (let c = 0; c < cols; c += 1) {
      if (matrix[r][c] === undefined) matrix[r][c] = null;
    }
  }
  return matrix;
}

function sortedSheets(sheets: any[]) {
  return sheets
    .map((sheet, i) => ({ sheet, i }))
    .sort((a, b) => {
      const oa = Number(a.sheet?.order ?? a.i);
      const ob = Number(b.sheet?.order ?? b.i);
      return oa - ob || a.i - b.i;
    })
    .map((x) => x.sheet);
}

/** Excel sheet names: max 31 chars, none of : \ / ? * [ ], unique. */
function excelSheetName(name: string, used: Set<string>) {
  let base = String(name ?? "Sheet")
    .replace(/[:\\/?*[\]]/g, "_")
    .replace(/^'+|'+$/g, "")
    .slice(0, 31);
  if (!base) base = "Sheet";
  let candidate = base;
  let n = 2;
  while (used.has(candidate.toLowerCase())) {
    const suffix = ` (${n})`;
    candidate = base.slice(0, 31 - suffix.length) + suffix;
    n += 1;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

export type BuiltWorkbook = {
  workbook: ExcelJS.Workbook;
  post: XlsxPostProcessInfo;
  /** Exported sheets in workbook order. */
  sheets: any[];
  /** Worksheet part per exported sheet (for the zip post-processors). */
  worksheets: XlsxWorksheetPart[];
};

/**
 * Build an ExcelJS workbook from TinySheet sheets. Returns the workbook and
 * the post-processing info `postProcessXlsx` needs.
 */
export function buildExcelWorkbookWithInfo(
  sheets: any[],
  options: XlsxExportOptions = {}
): BuiltWorkbook {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = options.creator ?? "TinySheet";
  workbook.created = new Date();
  const post: XlsxPostProcessInfo = {
    dynamicArrayCells: {},
    worksheetIds: [],
    visibleNotes: {},
    features: {},
  };
  const parts: XlsxWorksheetPart[] = [];
  const ordered = sortedSheets(sheets || []);
  const used = new Set<string>();
  const worksheets: (ExcelJS.Worksheet | null)[] = [];

  ordered.forEach((sheet) => {
    if (options.skipHiddenSheets && sheet?.hide === 1) {
      worksheets.push(null);
      return;
    }
    const tab = colorToArgb(sheet?.color);
    const worksheet = workbook.addWorksheet(excelSheetName(sheet?.name, used), {
      properties: tab ? ({ tabColor: { argb: tab } } as any) : undefined,
      state: sheet?.hide === 1 ? "hidden" : "visible",
    });
    worksheets.push(worksheet);
    post.worksheetIds.push(worksheet.id);
    parts.push({
      id: worksheet.id,
      name: worksheet.name,
      path: `xl/worksheets/sheet${worksheet.id}.xml`,
      sheet,
    });
    const ctx: SheetExportContext = {
      workbook,
      worksheet,
      sheet,
      data: sheetCellMatrix(sheet),
      sheets: ordered,
      options,
      post,
    };
    sheetExportFeatures.forEach((feature) => feature.write(ctx));
  });

  // Excel needs at least one visible sheet.
  const visible = workbook.worksheets.filter((ws) => ws.state === "visible");
  if (workbook.worksheets.length > 0 && visible.length === 0) {
    workbook.worksheets[0].state = "visible";
  }
  if (workbook.worksheets.length === 0) workbook.addWorksheet("Sheet1");

  const wbCtx: WorkbookExportContext = {
    workbook,
    sheets: ordered,
    worksheets,
    options,
    post,
  };
  workbookExportFeatures.forEach((feature) => feature.write(wbCtx));
  return { workbook, post, sheets: ordered, worksheets: parts };
}

export function buildExcelWorkbook(
  sheets: any[],
  options: XlsxExportOptions = {}
): ExcelJS.Workbook {
  return buildExcelWorkbookWithInfo(sheets, options).workbook;
}

/** Serialise TinySheet sheets as an .xlsx file. */
export async function exportToXlsx(
  sheets: any[],
  options: XlsxExportOptions = {}
): Promise<Uint8Array> {
  const built = buildExcelWorkbookWithInfo(sheets, options);
  const buffer = await built.workbook.xlsx.writeBuffer();
  // what ExcelJS cannot write: CF details, dynamic arrays, internal links,
  // shown notes, hidden dropdowns, empty tables, charts, and every
  // post-processor other features registered
  return runXlsxPostProcessors(buffer as ArrayBuffer, {
    sheets: built.sheets,
    worksheets: built.worksheets,
    workbook: built.workbook,
    post: built.post,
    options,
  });
}
