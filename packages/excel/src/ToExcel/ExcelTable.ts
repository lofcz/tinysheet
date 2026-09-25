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
    const dataEnd = r2 - (totalsRow ? 1 : 0);
    // an Excel table has at least one data row
    if (dataEnd < dataStart) return;

    const saved = snapshot(worksheet, table);
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

    // put the cells back (the header keeps the column names ExcelJS wrote),
    // with the structured references Excel expects
    saved.forEach((row, i) => {
      if (headerRow && i === 0) return;
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
