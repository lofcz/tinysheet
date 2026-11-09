import {
  readXlsxSource,
  indexSharedStrings,
  indexWorksheetSource,
  worksheetSourceRow,
  worksheetSourceCell,
  type WorksheetSource,
} from "@lofcz/ts-xlsx/xlsx";
import {
  createSourceMatrix,
  tableCellFormatter,
  peekCell,
  type Sheet,
} from "@lofcz/tinysheet-core";
import { FortuneFile } from "../ToFortuneSheet/FortuneFile";
import { resolvePackageParts } from "../ToFortuneSheet/HandleZip";
import { decodeCellRef } from "../ToFortuneSheet/FortuneCell";
import {
  normalizeSpreadsheetNamespace,
  scanElements,
  type ScannedElement,
} from "../ToFortuneSheet/xmlScan";
import { encodeWorkbookBytes } from "../preservation";
import type { IuploadfileList } from "../common/ICommon";
import type { ExcelImportResult } from "./types";
import { checkboxXfIndexes, FEATURE_BAG_PATH } from "../ToExcel/ExcelCheckbox";
import { sourceRangeLookup } from "./sourceRanges";
import { tableFiltersFromXlsx } from "../ToFortuneSheet/tableExtras";

/** Transferable source and metadata; contains no decoded ordinary cells. */
export type ExcelSource = {
  files: IuploadfileList;
  worksheets: (WorksheetSource & { name: string; path: string })[];
  sheets: Sheet[];
  fileName: string;
  stringOffsets: Uint32Array;
};

export function prepareSourceImport(
  bytes: Uint8Array,
  fileName: string
): ExcelImportResult {
  const opened = readXlsxSource(bytes);
  const files: IuploadfileList = {};
  const worksheets = opened.worksheets.map((sheet) => {
    const normalized = normalizeSpreadsheetNamespace(sheet.xml);
    return normalized === sheet.xml
      ? sheet
      : {
          ...indexWorksheetSource(normalized),
          name: sheet.name,
          path: sheet.path,
        };
  });
  const byPath = new Map(worksheets.map((sheet) => [sheet.path, sheet]));
  const decoder = new TextDecoder();
  for (const [path, content] of Object.entries(opened.files)) {
    const sheet = byPath.get(path);
    if (sheet) files[path] = sheet.metadataXml;
    else if (/\.(png|jpe?g|gif|bmp|tif|webp)$/i.test(path)) {
      files[path] =
        `data:image/${path.split(".").pop().toLowerCase()};base64,${encodeWorkbookBytes(content)}`;
    } else if (/\.emf$/i.test(path))
      files[path] = content.slice().buffer as any;
    else files[path] = normalizeSpreadsheetNamespace(decoder.decode(content));
  }
  resolvePackageParts(files);
  const stringOffsets = indexSharedStrings(files["xl/sharedStrings.xml"] ?? "");
  const parser = new FortuneFile(files, fileName, true, stringOffsets);
  parser.Parse();
  const sheets = structuredClone(
    parser.serialize().sheets
  ) as unknown as Sheet[];
  const source: ExcelSource = {
    files,
    worksheets,
    sheets,
    fileName,
    stringOffsets,
  };
  return {
    sheets,
    sizing: sheets.map((sheet) => ({
      id: String(sheet.id),
      columnlen: sheet.config?.columnlen,
      rowlen: sheet.config?.rowlen,
    })),
    source,
  };
}

/** Attach copy-on-write matrices after a worker transfer, or for a direct import. */
export function bindSourceImport(result: ExcelImportResult): ExcelImportResult {
  const source = result.source;
  if (!source) return result;
  const parser = new FortuneFile(
    source.files,
    source.fileName,
    true,
    source.stringOffsets
  );
  const checkboxStyles = checkboxXfIndexes(
    source.files["xl/styles.xml"],
    source.files[FEATURE_BAG_PATH]
  );
  const sheets = source.sheets.map((metadata) => {
    const backing = source.worksheets.find(
      (item) => item.name === metadata.name
    );
    if (!backing) return metadata;
    const tableFormats = (metadata.tables ?? []).map((table) => ({
      table,
      format: tableCellFormatter(table),
    }));
    const spillAt = sourceRangeLookup(
      (metadata.celldata ?? []).flatMap(({ r, c, v }) => {
        const spill = (v as any)?.spill;
        return spill ? [{ r, c, ...spill }] : [];
      })
    );
    const mergeAt = sourceRangeLookup(
      Object.values(metadata.config?.merge ?? {})
    );
    const hyperlinks = Object.keys(metadata.hyperlink ?? {}).length
      ? metadata.hyperlink
      : undefined;
    const overrides = new Map<number, Map<number, any>>();
    for (const { r, c, v } of metadata.celldata ?? []) {
      let row = overrides.get(r);
      if (!row) {
        row = new Map();
        overrides.set(r, row);
      }
      row.set(c, v);
    }
    // A bounded raw-row cache makes reading a viewport cheap without retaining
    // every cell's XML when filtering a whole column.
    const rows = new Map<number, Map<number, ScannedElement>>();
    const readRow = (r: number) => {
      let cells = rows.get(r);
      if (!cells) {
        cells = new Map();
        const rowXml = worksheetSourceRow(backing, r + 1);
        let column = -1;
        if (rowXml)
          scanElements(rowXml, "c", (cell) => {
            column = decodeCellRef(cell.attrs.r)?.c ?? column + 1;
            cells.set(column, cell);
          });
        if (rows.size >= 64) rows.delete(rows.keys().next().value);
        rows.set(r, cells);
      }
      return cells;
    };
    const read = (r: number, c: number) => {
      let raw = rows.get(r)?.get(c);
      if (!raw) {
        const xml = worksheetSourceCell(backing, r + 1, c + 1);
        if (xml)
          scanElements(xml, "c", (cell) => {
            raw = cell;
          });
      }
      let cell: any = raw ? parser.readSourceCell(raw, r, c) : null;
      if (cell && raw && checkboxStyles.has(Number(raw.attrs.s))) cell.cb = 1;
      const override = overrides.get(r)?.get(c);
      if (override) cell = { ...cell, ...override };
      const merge = mergeAt(r, c);
      if (merge) {
        if (merge.r !== r || merge.c !== c)
          return { mc: { r: merge.r, c: merge.c } };
        cell = { ...cell, mc: { ...merge } };
      }
      const spill = spillAt(r, c);
      if (spill && (spill.r !== r || spill.c !== c) && cell) {
        cell = { ...cell, spillFrom: { dr: r - spill.r, dc: c - spill.c } };
        delete cell.f;
      }
      if (hyperlinks?.[`${r}_${c}`] && cell)
        cell = { ...cell, hl: { r, c, id: metadata.id } };
      for (const { table, format } of tableFormats) {
        if (
          r >= table.range.row[0] &&
          r <= table.range.row[1] &&
          c >= table.range.column[0] &&
          c <= table.range.column[1]
        ) {
          cell = format(r, c, cell ?? {});
        }
      }
      return cell;
    };
    let rowCount = Math.max(backing.rowCount, metadata.row ?? 0, 1);
    let columnCount = Math.max(backing.columnCount, metadata.column ?? 0, 1);
    for (const cell of metadata.celldata ?? []) {
      rowCount = Math.max(rowCount, cell.r + 1);
      columnCount = Math.max(columnCount, cell.c + 1);
    }
    for (const table of metadata.tables ?? []) {
      rowCount = Math.max(rowCount, table.range.row[1] + 1);
      columnCount = Math.max(columnCount, table.range.column[1] + 1);
    }
    const sheet: Sheet = {
      ...metadata,
      row: rowCount,
      column: columnCount,
      config: { ...metadata.config, sourceBorders: true },
      data: createSourceMatrix(rowCount, columnCount, read, {
        commentRows: [
          ...new Set(
            (metadata.celldata ?? [])
              .filter((cell) => cell.v?.ps?.isShow)
              .map((cell) => cell.r)
          ),
        ],
      }),
    };
    if (metadata.tables)
      sheet.tables = metadata.tables.map((table) => {
        const raw = (table as any)._sourceFilters;
        if (!raw) return table;
        const next = {
          ...table,
          filters: tableFiltersFromXlsx(sheet, table, raw),
        };
        delete (next as any)._sourceFilters;
        return next;
      });
    // Sparse output remains available to callers explicitly requesting it.
    // Non-enumerability prevents object spread/Workbook initialization from
    // accidentally materializing it.
    delete sheet.celldata;
    Object.defineProperty(sheet, "celldata", {
      configurable: true,
      get() {
        const cells = [];
        const borders: any[] = [];
        const usedRows = new Set(overrides.keys());
        for (let i = 0; i < backing.rows.length; i += 3)
          usedRows.add(backing.rows[i] - 1);
        for (const table of metadata.tables ?? []) {
          for (let r = table.range.row[0]; r <= table.range.row[1]; r += 1)
            usedRows.add(r);
        }
        for (const r of [...usedRows].sort((a, b) => a - b)) {
          const usedColumns = new Set([
            ...readRow(r).keys(),
            ...(overrides.get(r)?.keys() ?? []),
          ]);
          for (const table of metadata.tables ?? []) {
            if (r < table.range.row[0] || r > table.range.row[1]) continue;
            for (
              let c = table.range.column[0];
              c <= table.range.column[1];
              c += 1
            )
              usedColumns.add(c);
          }
          for (const c of [...usedColumns].sort((a, b) => a - b)) {
            const v = peekCell(sheet.data, r, c);
            if (v != null) {
              const owned = structuredClone(v);
              if (owned.sourceBorder) {
                borders.push({
                  rangeType: "cell",
                  value: { ...owned.sourceBorder, row_index: r, col_index: c },
                });
                delete owned.sourceBorder;
              }
              cells.push({ r, c, v: owned });
            }
          }
        }
        // Requesting the legacy sparse representation explicitly hands ownership
        // to the caller. Subsequent reads reuse it; edits to it remain observable
        // by consumers that expand/export celldata.
        delete sheet.data;
        sheet.config = {
          ...sheet.config,
          borderInfo: borders.concat(sheet.config?.borderInfo ?? []),
        };
        delete sheet.config.sourceBorders;
        Object.defineProperty(sheet, "celldata", {
          value: cells,
          enumerable: true,
          writable: true,
          configurable: true,
        });
        return cells;
      },
    });
    return sheet;
  });
  return { ...result, sheets };
}

/** Strip live matrix views at the worker boundary; only their backing source crosses it. */
export function sourceTransferResult(
  result: ExcelImportResult
): ExcelImportResult {
  if (!result.source) return result;
  if (result.sheets === result.source.sheets) return result;
  const detached = result.sheets.some(
    (sheet) =>
      result.source.worksheets.some((item) => item.name === sheet.name) &&
      Object.getOwnPropertyDescriptor(sheet, "celldata")?.enumerable
  );
  if (detached) {
    const sheets = result.sheets.map((sheet) => {
      const celldata = sheet.celldata;
      const { data, ...plain } = sheet;
      return { ...plain, celldata };
    });
    const { source, ...plain } = result;
    return { ...plain, sheets };
  }
  return { ...result, sheets: result.source.sheets };
}
