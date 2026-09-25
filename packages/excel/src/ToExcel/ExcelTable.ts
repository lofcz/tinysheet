/**
 * Tables (TinySheet `sheet.tables`, "Format as Table") -> Excel table parts.
 *
 * ExcelJS's `addTable` writes the header, data and total cells itself, so
 * the cells written by the cell writer are saved first and put back
 * afterwards: the table part only describes the table (range, columns,
 * total functions, style options). Structured references are written the
 * way Excel stores them: qualified with the table name, `[@Col]` as
 * `Table1[[#This Row],[Col]]`.
 */
import type ExcelJS from "@protobi/exceljs";
import { cellAddress } from "../common/formulaText";
import { qualifyStructuredReferences } from "../common/structuredRefs";
import type { SheetExportContext } from "./buildWorkbook";
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
]);

function snapshot(worksheet: ExcelJS.Worksheet, table: any) {
  const [r1, r2] = table.range.row;
  const [c1, c2] = table.range.column;
  const values: ExcelJS.CellValue[][] = [];
  for (let r = r1; r <= r2; r += 1) {
    const row: ExcelJS.CellValue[] = [];
    for (let c = c1; c <= c2; c += 1) {
      row.push(worksheet.getCell(r + 1, c + 1).value);
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
    const fn = (col: any) =>
      TOTAL_FUNCTIONS.has(col?.totalFunction) ? col.totalFunction : "none";
    const added: any = worksheet.addTable({
      name: table.name,
      displayName: table.name,
      ref: cellAddress(r1, c1),
      headerRow,
      totalsRow,
      style: {
        theme: (table.style || "TableStyleMedium2") as any,
        showFirstColumn: !!table.firstColumn,
        showLastColumn: !!table.lastColumn,
        showRowStripes: !!table.bandedRows,
        showColumnStripes: !!table.bandedColumns,
      },
      columns: columns.map((col, j) => ({
        name: String(col?.name ?? `Column${j + 1}`),
        filterButton: headerRow,
        totalsRowFunction: j === 0 ? undefined : fn(col),
        totalsRowLabel: col?.totalLabel || undefined,
      })) as any,
      rows: saved
        .slice(dataStart - r1, dataEnd - r1 + 1)
        .map((row) => row.map((v) => v ?? null)),
    });
    // ExcelJS gives the first column a "Total" label instead of a function
    const first = added?.table?.columns?.[0];
    if (first && totalsRow) {
      const f = fn(columns[0]);
      if (f !== "none") {
        first.totalsRowFunction = f;
        delete first.totalsRowLabel;
      } else {
        first.totalsRowLabel = columns[0]?.totalLabel || undefined;
      }
    }

    if (insertRow) {
      const features = (ctx.post.features ||= {});
      const tablesInfo = (features[FEATURE] ||= { insertRow: [] });
      tablesInfo.insertRow.push(String(table.name));
    }

    // put the cells back (the header keeps the column names ExcelJS wrote),
    // with the structured references Excel expects
    saved.forEach((row, i) => {
      if ((headerRow && i === 0) || (insertRow && i > 0)) return;
      row.forEach((value, j) => {
        const cell = worksheet.getCell(r1 + i + 1, c1 + j + 1);
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
  });
}
