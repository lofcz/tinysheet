/**
 * TinySheet tables -> native workbook tables. Cell formulas and cached values
 * remain owned by TinySheet; the table describes their range, columns and style.
 * Filters, slicers and richer table metadata are applied by ExcelTableZip.ts.
 */
import type * as Xlsx from "@lofcz/ts-xlsx/core";
import { cellAddress } from "../common/formulaText";
import { qualifyStructuredReferences } from "../common/structuredRefs";
import type { SheetExportContext } from "./buildWorkbook";
import {
  filterColumnXml,
  slicerExport,
  tableFormulaText,
  TableZipExport,
} from "./ExcelTableZip";
import type { XlsxPostProcessContext } from "./postProcessors";
import { setTagAttr, tagAttr } from "./xlsxParts";

const FEATURE = "tables";

function rowIsEmpty(
  ctx: SheetExportContext,
  r: number,
  c1: number,
  c2: number
) {
  const row = ctx.data[r];
  if (!row) return true;
  for (let c = c1; c <= c2; c += 1) {
    const cell: any = row[c];
    if (cell && (cell.v != null || cell.f != null || cell.ct?.s != null))
      return false;
  }
  return true;
}

/**
 * Zip post-processor: header-only tables get `insertRow="1"` (their one
 * data row is Excel's empty insert row).
 */
export async function markEmptyTables(ctx: XlsxPostProcessContext) {
  const names: string[] | undefined = ctx.post.features?.[FEATURE]?.insertRow;
  if (!names?.length) return;
  const wanted = new Set(names);
  const parts = ctx.zip.file(/^xl\/tables\/[^/]+\.xml$/);
  await Promise.all(
    parts.map(async (part) => {
      const xml = await part.async("string");
      const out = xml.replace(/<table\b[^>]*>/, (tag) =>
        wanted.has(tagAttr(tag, "name") ?? "")
          ? setTagAttr(tag, "insertRow", "1")
          : tag
      );
      if (out !== xml) ctx.writeText(part.name, out);
    })
  );
}

const TOTAL_FUNCTIONS = new Set([
  "sum",
  "average",
  "count",
  "countNums",
  "max",
  "min",
  "stdDev",
  "var",
  "custom",
]);

/** Display text of a TinySheet cell (value filters compare it). */
function cellText(cell: any) {
  if (cell == null) return "";
  if (cell.ct?.t === "inlineStr") {
    return (cell.ct.s || []).map((x: any) => x?.v ?? "").join("");
  }
  const v = cell.m ?? cell.v;
  return v == null ? "" : String(v);
}

function snapshot(worksheet: Xlsx.Worksheet, table: any) {
  const [r1, r2] = table.range.row;
  const [c1, c2] = table.range.column;
  const values: Xlsx.CellValue[][] = [];
  for (let r = r1; r <= r2; r += 1) {
    const row: Xlsx.CellValue[] = [];
    for (let c = c1; c <= c2; c += 1) {
      const cell = worksheet.getCell(cellAddress(r, c));
      const value = cell.value;
      row.push(value);
    }
    values.push(row);
  }
  return values;
}

/** Excel table parts for the sheet's tables. */
export function writeTables(ctx: SheetExportContext) {
  const tables: any[] = ctx.sheet?.tables;
  if (!Array.isArray(tables) || tables.length === 0) return;
  const { worksheet } = ctx;
  tables.forEach((table) => {
    const [r1, r2] = table?.range?.row ?? [];
    const [c1, c2] = table?.range?.column ?? [];
    const columns: any[] = table?.columns ?? [];
    if (!table?.name || columns.length !== c2 - c1 + 1) return;
    const headerRow = table.headerRow !== false;
    const totalsRow = !!table.totalRow;
    const dataStart = r1 + (headerRow ? 1 : 0);
    let dataEnd = r2 - (totalsRow ? 1 : 0);
    // An Excel table has at least one data row. A header-only table is
    // written the way Excel stores one: with the empty row below it as its
    // "insert row" (insertRow="1", set by the "tables" post-processor).
    let insertRow = false;
    if (dataEnd < dataStart) {
      if (!headerRow || totalsRow || !rowIsEmpty(ctx, r1 + 1, c1, c2)) return;
      insertRow = true;
      dataEnd = dataStart;
    }

    const saved = snapshot(worksheet, table);
    if (insertRow) saved.push(columns.map(() => null));
    const fn = (col: any) => {
      const f = TOTAL_FUNCTIONS.has(col?.totalFunction)
        ? col.totalFunction
        : "none";
      return f === "custom" && !col?.totalFormula ? "none" : f;
    };
    const buttons = headerRow && table.filterButton !== false;
    worksheet.addTable({
      name: table.name,
      ref: cellAddress(r1, c1),
      headerRow,
      totalsRow,
      style: {
        name: (table.style || "TableStyleMedium2") as any,
        showFirstColumn: !!table.firstColumn,
        showLastColumn: !!table.lastColumn,
        showRowStripes: !!table.bandedRows,
        showColumnStripes: !!table.bandedColumns,
      },
      columns: columns.map((col, j) => ({
        name: String(col?.name ?? `Column${j + 1}`),
        totalsRowFunction: fn(col),
        totalsRowLabel: col?.totalLabel || undefined,
      })) as any,
      rowCount: dataEnd - dataStart + 1,
      autoFilter: buttons,
    });
    if (headerRow)
      columns.forEach((col, j) => {
        worksheet.getCell(cellAddress(r1, c1 + j)).value = String(
          col?.name ?? `Column${j + 1}`
        );
      });

    if (insertRow) {
      const features = (ctx.post.features ||= {});
      const tablesInfo = (features[FEATURE] ||= { insertRow: [] });
      tablesInfo.insertRow.push(String(table.name));
    }

    // Keep the original cells and authoritative table header names,
    // with the structured references Excel expects
    saved.forEach((row, i) => {
      if ((headerRow && i === 0) || (insertRow && i > 0)) return;
      row.forEach((value, j) => {
        const cell = worksheet.getCell(cellAddress(r1 + i, c1 + j));
        let v: any = value;
        if (v && typeof v === "object" && typeof v.formula === "string") {
          v = {
            ...v,
            formula: qualifyStructuredReferences(v.formula, table.name),
          };
        }
        cell.value = v;
      });
    });

    // filter state, calculated columns, custom totals and slicers
    const extras: TableZipExport = {
      worksheetId: worksheet.id,
      name: table.name,
      filterRef: buttons
        ? `${cellAddress(r1, c1)}:${cellAddress(dataEnd, c2)}`
        : null,
      filterColumns: [],
      calculated: {},
      totals: {},
      slicers: [],
    };
    columns.forEach((col, j) => {
      const filter = table.filters?.[j];
      if (buttons && filter?.condition) {
        const texts: string[] = [];
        for (let r = dataStart; r <= dataEnd; r += 1) {
          texts.push(cellText(ctx.data[r]?.[c1 + j]));
        }
        const xml = filterColumnXml(j, filter.condition, texts);
        if (xml) extras.filterColumns.push(xml);
      }
      if (typeof col?.calculatedFormula === "string") {
        extras.calculated[j] = tableFormulaText(
          col.calculatedFormula,
          table.name
        );
      }
      if (fn(col) === "custom") {
        extras.totals[j] = tableFormulaText(col.totalFormula, table.name);
      }
    });
    (table.slicers ?? []).forEach((slicer: any) => {
      const s = slicerExport(ctx.sheet, table, slicer);
      if (s) extras.slicers.push(s);
    });
    const features = (ctx.post.features ||= {});
    features.tableExtras = [...(features.tableExtras ?? []), extras];
  });
}
