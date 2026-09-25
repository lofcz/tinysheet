/**
 * Page Setup, print areas, print titles and page breaks (Excel's Page
 * Layout tab), and the pagination the print renderer, Print Preview and
 * Page Break Preview share.
 *
 * The model lives on the sheet (`sheet.pageSetup`, see types.ts). Sizes are
 * CSS pixels at 96 dpi, the unit of row heights and column widths, so a
 * Letter page is 816 x 1056 px. Margins are stored in inches, as in xlsx.
 *
 * Page breaks are stored as the index of the first row / column of the
 * page they start (`rowBreaks: [20]` starts a page at row 21), which is
 * also the `id` Excel writes in `<rowBreaks><brk id="20"/>`.
 */
import _ from "lodash";
import type { Context } from "../context";
import type {
  Cell,
  CellMatrix,
  HeaderFooterText,
  PageMargins,
  PageSetup,
  PaperSizeId,
  PrintRange,
  Sheet,
} from "../types";
import { columnCharToIndex, getSheetIndex, indexToColumnChar } from "../utils";
import { computeAxisPositions } from "./geometry";
import {
  ReferenceChange,
  ReferenceAdjusterApi,
  registerReferenceAdjuster,
} from "./refAdjust";

/** CSS pixels per inch. */
export const PX_PER_INCH = 96;

export type PaperSize = {
  id: PaperSizeId;
  /** xlsx `paperSize` code. */
  excel: number;
  /** Portrait width and height in inches. */
  width: number;
  height: number;
  /** Size as shown in the UI ("8.5\" x 11\"", "210 x 297 mm"). */
  label: string;
};

const mm = (v: number) => Math.round((v / 25.4) * 1000) / 1000;

function paper(
  id: PaperSizeId,
  excel: number,
  width: number,
  height: number,
  metric = false
): PaperSize {
  return {
    id,
    excel,
    width: metric ? mm(width) : width,
    height: metric ? mm(height) : height,
    label: metric ? `${width} x ${height} mm` : `${width}" x ${height}"`,
  };
}

/** Paper sizes of the Page Setup dialog (Excel's list, most common ones). */
export const PAPER_SIZES: PaperSize[] = [
  paper("letter", 1, 8.5, 11),
  paper("tabloid", 3, 11, 17),
  paper("ledger", 4, 17, 11),
  paper("legal", 5, 8.5, 14),
  paper("statement", 6, 5.5, 8.5),
  paper("executive", 7, 7.25, 10.5),
  paper("a3", 8, 297, 420, true),
  paper("a4", 9, 210, 297, true),
  paper("a5", 11, 148, 210, true),
  paper("b4", 12, 257, 364, true),
  paper("b5", 13, 182, 257, true),
  paper("folio", 14, 8.5, 13),
  paper("envelope10", 20, 4.125, 9.5),
  paper("envelopeDL", 27, 110, 220, true),
  paper("envelopeC5", 28, 162, 229, true),
];

export function getPaperSize(id?: PaperSizeId | null): PaperSize {
  return PAPER_SIZES.find((p) => p.id === id) ?? PAPER_SIZES[0];
}

export function paperSizeFromExcel(code: number): PaperSizeId | undefined {
  return PAPER_SIZES.find((p) => p.excel === code)?.id;
}

/** Excel's margin presets (Page Layout > Margins), in inches. */
export const MARGIN_PRESETS: Record<"normal" | "wide" | "narrow", PageMargins> =
  {
    normal: {
      top: 0.75,
      bottom: 0.75,
      left: 0.7,
      right: 0.7,
      header: 0.3,
      footer: 0.3,
    },
    wide: { top: 1, bottom: 1, left: 1, right: 1, header: 0.5, footer: 0.5 },
    narrow: {
      top: 0.75,
      bottom: 0.75,
      left: 0.25,
      right: 0.25,
      header: 0.3,
      footer: 0.3,
    },
  };

/** Page Setup with every default filled in. */
export type ResolvedPageSetup = Required<
  Omit<
    PageSetup,
    | "firstPageNumber"
    | "printQuality"
    | "printArea"
    | "printTitleRows"
    | "printTitleColumns"
    | "margins"
  >
> & {
  margins: PageMargins;
  firstPageNumber?: number;
  printQuality?: number;
  printArea?: PrintRange[];
  printTitleRows?: [number, number];
  printTitleColumns?: [number, number];
};

const EMPTY_HF: HeaderFooterText = {};

export function resolvePageSetup(setup?: PageSetup | null): ResolvedPageSetup {
  const s = setup ?? {};
  const scale = Number(s.scale);
  return {
    orientation: s.orientation === "landscape" ? "landscape" : "portrait",
    paperSize: getPaperSize(s.paperSize).id,
    scale: Number.isFinite(scale) && scale > 0 ? _.clamp(scale, 10, 400) : 100,
    fitToPage: !!s.fitToPage,
    fitToWidth: Math.max(0, Math.floor(Number(s.fitToWidth ?? 1) || 0)),
    fitToHeight: Math.max(0, Math.floor(Number(s.fitToHeight ?? 1) || 0)),
    firstPageNumber:
      s.firstPageNumber != null && Number.isFinite(Number(s.firstPageNumber))
        ? Math.floor(Number(s.firstPageNumber))
        : undefined,
    printQuality: s.printQuality,
    margins: { ...MARGIN_PRESETS.normal, ..._.omitBy(s.margins, _.isNil) },
    centerHorizontally: !!s.centerHorizontally,
    centerVertically: !!s.centerVertically,
    printArea: s.printArea?.length ? s.printArea : undefined,
    printTitleRows: s.printTitleRows,
    printTitleColumns: s.printTitleColumns,
    gridLines: !!s.gridLines,
    headings: !!s.headings,
    blackAndWhite: !!s.blackAndWhite,
    draft: !!s.draft,
    pageOrder: s.pageOrder === "overThenDown" ? "overThenDown" : "downThenOver",
    comments: s.comments ?? "none",
    cellErrors: s.cellErrors ?? "displayed",
    header: s.header ?? EMPTY_HF,
    footer: s.footer ?? EMPTY_HF,
    differentFirst: !!s.differentFirst,
    differentOddEven: !!s.differentOddEven,
    firstHeader: s.firstHeader ?? EMPTY_HF,
    firstFooter: s.firstFooter ?? EMPTY_HF,
    evenHeader: s.evenHeader ?? EMPTY_HF,
    evenFooter: s.evenFooter ?? EMPTY_HF,
    scaleWithDoc: s.scaleWithDoc !== false,
    alignWithMargins: s.alignWithMargins !== false,
    rowBreaks: _.sortedUniq([...(s.rowBreaks ?? [])].sort((a, b) => a - b)),
    colBreaks: _.sortedUniq([...(s.colBreaks ?? [])].sort((a, b) => a - b)),
  };
}

/** Paper size of a setup in CSS px, oriented. */
export function pagePaperPx(setup: ResolvedPageSetup) {
  const p = getPaperSize(setup.paperSize);
  const w = p.width * PX_PER_INCH;
  const h = p.height * PX_PER_INCH;
  return setup.orientation === "landscape"
    ? { width: h, height: w }
    : { width: w, height: h };
}

function sheetById(ctx: Context, sheetId?: string | null) {
  const i = getSheetIndex(ctx, sheetId ?? ctx.currentSheetId);
  return i == null ? undefined : ctx.luckysheetfile[i];
}

/** The stored Page Setup of a sheet (current sheet by default). */
export function getPageSetup(ctx: Context, sheetId?: string): PageSetup {
  return sheetById(ctx, sheetId)?.pageSetup ?? {};
}

const isEmptyHF = (hf?: HeaderFooterText) =>
  !hf || (!hf.left && !hf.center && !hf.right);

/** Drop defaults and empty values so the stored model stays small. */
export function normalizePageSetup(setup: PageSetup): PageSetup {
  const out: PageSetup = {};
  Object.entries(setup).forEach(([key, value]) => {
    if (value == null) return;
    if (Array.isArray(value) && value.length === 0) return;
    if (
      (key.endsWith("eader") || key.endsWith("ooter")) &&
      typeof value === "object" &&
      isEmptyHF(value as HeaderFooterText)
    ) {
      return;
    }
    (out as any)[key] = value;
  });
  if (out.rowBreaks) {
    out.rowBreaks = _.sortedUniq([...out.rowBreaks].sort((a, b) => a - b));
  }
  if (out.colBreaks) {
    out.colBreaks = _.sortedUniq([...out.colBreaks].sort((a, b) => a - b));
  }
  return out;
}

/** Replace a sheet's Page Setup. */
export function setPageSetup(ctx: Context, setup: PageSetup, sheetId?: string) {
  const i = getSheetIndex(ctx, sheetId ?? ctx.currentSheetId);
  if (i == null) return;
  const next = normalizePageSetup(setup);
  if (Object.keys(next).length === 0) {
    delete ctx.luckysheetfile[i].pageSetup;
  } else {
    ctx.luckysheetfile[i].pageSetup = next;
  }
}

/** Merge `patch` into a sheet's Page Setup (undefined values clear fields). */
export function updatePageSetup(
  ctx: Context,
  patch: Partial<PageSetup>,
  sheetId?: string
) {
  const current = getPageSetup(ctx, sheetId);
  setPageSetup(ctx, { ...current, ...patch } as PageSetup, sheetId);
}

function selectionRanges(ctx: Context): PrintRange[] {
  return (ctx.luckysheet_select_save ?? [])
    .filter((s) => s.row?.length === 2 && s.column?.length === 2)
    .map((s) => ({
      row: [Math.min(s.row[0], s.row[1]), Math.max(s.row[0], s.row[1])] as [
        number,
        number
      ],
      column: [
        Math.min(s.column[0], s.column[1]),
        Math.max(s.column[0], s.column[1]),
      ] as [number, number],
    }));
}

/** Page Layout > Print Area > Set Print Area (the selection by default). */
export function setPrintArea(ctx: Context, ranges?: PrintRange[]) {
  const areas = ranges ?? selectionRanges(ctx);
  if (areas.length === 0) return;
  updatePageSetup(ctx, { printArea: areas.map((r) => _.cloneDeep(r)) });
}

/** Page Layout > Print Area > Add to Print Area. */
export function addToPrintArea(ctx: Context, ranges?: PrintRange[]) {
  const areas = ranges ?? selectionRanges(ctx);
  const current = getPageSetup(ctx).printArea ?? [];
  setPrintArea(ctx, [...current, ...areas]);
}

/** Page Layout > Print Area > Clear Print Area. */
export function clearPrintArea(ctx: Context) {
  updatePageSetup(ctx, { printArea: undefined });
}

function flowdataSize(ctx: Context, sheet?: Sheet) {
  const data = sheet?.data;
  return {
    rows: data?.length ?? sheet?.row ?? ctx.defaultrowNum,
    cols: data?.[0]?.length ?? sheet?.column ?? ctx.defaultcolumnNum,
  };
}

function activeCell(ctx: Context) {
  const last = _.last(ctx.luckysheet_select_save);
  if (!last) return null;
  return {
    r: last.row_focus ?? last.row[0],
    c: last.column_focus ?? last.column[0],
    whole: last,
  };
}

/**
 * Page Layout > Breaks > Insert Page Break at the active cell (Excel): a
 * cell in column A or a whole row inserts a break above it, a cell in row
 * 1 or a whole column a break left of it, any other cell both.
 */
export function insertPageBreak(ctx: Context, at?: { r: number; c: number }) {
  const sheet = sheetById(ctx);
  const cell = at ?? activeCell(ctx);
  if (!sheet || !cell) return;
  const { rows, cols } = flowdataSize(ctx, sheet);
  const sel = !at ? activeCell(ctx)?.whole : undefined;
  const wholeRow =
    sel != null && sel.column[0] === 0 && sel.column[1] >= cols - 1;
  const wholeCol = sel != null && sel.row[0] === 0 && sel.row[1] >= rows - 1;
  const r = wholeRow && sel ? sel.row[0] : cell.r;
  const c = wholeCol && sel ? sel.column[0] : cell.c;
  const setup = getPageSetup(ctx);
  const rowBreaks = [...(setup.rowBreaks ?? [])];
  const colBreaks = [...(setup.colBreaks ?? [])];
  const addRow = !wholeCol && r > 0;
  const addCol = !wholeRow && c > 0;
  if (addRow && !rowBreaks.includes(r)) rowBreaks.push(r);
  if (addCol && !colBreaks.includes(c)) colBreaks.push(c);
  updatePageSetup(ctx, { rowBreaks, colBreaks });
}

/**
 * Page Layout > Breaks > Remove Page Break: removes the manual breaks
 * above and left of the active cell.
 */
export function removePageBreak(ctx: Context, at?: { r: number; c: number }) {
  const cell = at ?? activeCell(ctx);
  if (!cell) return;
  const setup = getPageSetup(ctx);
  updatePageSetup(ctx, {
    rowBreaks: (setup.rowBreaks ?? []).filter((b) => b !== cell.r),
    colBreaks: (setup.colBreaks ?? []).filter((b) => b !== cell.c),
  });
}

/** Whether the active cell has a manual break above or left of it. */
export function hasPageBreakAt(ctx: Context, at?: { r: number; c: number }) {
  const cell = at ?? activeCell(ctx);
  if (!cell) return false;
  const setup = getPageSetup(ctx);
  return (
    (setup.rowBreaks ?? []).includes(cell.r) ||
    (setup.colBreaks ?? []).includes(cell.c)
  );
}

/** Page Layout > Breaks > Reset All Page Breaks. */
export function resetAllPageBreaks(ctx: Context, sheetId?: string) {
  updatePageSetup(ctx, { rowBreaks: undefined, colBreaks: undefined }, sheetId);
}

/**
 * Drag a page break line in Page Break Preview: the break starting page
 * `from` moves to `to` and becomes manual. Dragging it onto the start or
 * past the end of its print area removes it.
 */
export function movePageBreak(
  ctx: Context,
  axis: "row" | "column",
  from: number,
  to: number,
  bounds?: [number, number]
) {
  const setup = getPageSetup(ctx);
  const key = axis === "row" ? "rowBreaks" : "colBreaks";
  const list = (setup[key] ?? []).filter((b) => b !== from);
  const inside = bounds ? to > bounds[0] && to <= bounds[1] : to > 0;
  if (inside && !list.includes(to)) list.push(to);
  updatePageSetup(ctx, { [key]: list });
}

// ---------------------------------------------------------------------------
// Page Break Preview / Normal view page break lines (view state).

function toggleId(list: string[] | undefined, id: string, on: boolean) {
  const rest = (list ?? []).filter((x) => x !== id);
  return on ? [...rest, id] : rest;
}

/** View > Page Break Preview (on) / Normal (off) for the current sheet. */
export function setPageBreakPreview(ctx: Context, on: boolean) {
  const id = ctx.currentSheetId;
  ctx.pageLayout = {
    ...ctx.pageLayout,
    breakPreviewSheets: toggleId(ctx.pageLayout?.breakPreviewSheets, id, on),
  };
}

export function isPageBreakPreview(ctx: Context, sheetId?: string) {
  return !!ctx.pageLayout?.breakPreviewSheets?.includes(
    sheetId ?? ctx.currentSheetId
  );
}

/** Show (or hide) the automatic page break lines in Normal view. */
export function setShowPageBreaks(ctx: Context, on: boolean, sheetId?: string) {
  const id = sheetId ?? ctx.currentSheetId;
  ctx.pageLayout = {
    ...ctx.pageLayout,
    shownBreakSheets: toggleId(ctx.pageLayout?.shownBreakSheets, id, on),
  };
}

export function isShowingPageBreaks(ctx: Context, sheetId?: string) {
  return !!ctx.pageLayout?.shownBreakSheets?.includes(
    sheetId ?? ctx.currentSheetId
  );
}

/** Ask the UI to open Print Preview (Ctrl+P). */
export function requestPrintPreview(ctx: Context) {
  ctx.pageLayout = { ...ctx.pageLayout, printPreviewRequest: Date.now() };
}

// ---------------------------------------------------------------------------
// Range text (Page Setup > Sheet: "$A$1:$D$20", "$1:$2", "$A:$B").

const MAX_ROW = 1048575;
const MAX_COL = 16383;

/** "A1:D20" (absolute) text of a range, whole rows/columns as "$1:$2". */
export function printRangeToText(range: PrintRange, absolute = true) {
  const d = absolute ? "$" : "";
  const [r1, r2] = range.row;
  const [c1, c2] = range.column;
  if (c1 === 0 && c2 >= MAX_COL) return `${d}${r1 + 1}:${d}${r2 + 1}`;
  if (r1 === 0 && r2 >= MAX_ROW) {
    return `${d}${indexToColumnChar(c1)}:${d}${indexToColumnChar(c2)}`;
  }
  const a = `${d}${indexToColumnChar(c1)}${d}${r1 + 1}`;
  if (r1 === r2 && c1 === c2) return a;
  return `${a}:${d}${indexToColumnChar(c2)}${d}${r2 + 1}`;
}

/** Parses one "A1", "A1:B2", "1:3" or "A:C" reference (sheet prefix allowed). */
export function parsePrintRange(text: string): PrintRange | null {
  const t = text.trim().replace(/^.*!/, "").replace(/\$/g, "").toUpperCase();
  let m = /^([A-Z]{1,3})(\d+)(?::([A-Z]{1,3})(\d+))?$/.exec(t);
  if (m) {
    const c1 = columnCharToIndex(m[1]);
    const r1 = Number(m[2]) - 1;
    const c2 = m[3] ? columnCharToIndex(m[3]) : c1;
    const r2 = m[4] ? Number(m[4]) - 1 : r1;
    if (r1 < 0 || r2 < 0) return null;
    return {
      row: [Math.min(r1, r2), Math.max(r1, r2)],
      column: [Math.min(c1, c2), Math.max(c1, c2)],
    };
  }
  m = /^(\d+):(\d+)$/.exec(t);
  if (m) {
    const r1 = Number(m[1]) - 1;
    const r2 = Number(m[2]) - 1;
    if (r1 < 0 || r2 < 0) return null;
    return {
      row: [Math.min(r1, r2), Math.max(r1, r2)],
      column: [0, MAX_COL],
    };
  }
  m = /^([A-Z]{1,3}):([A-Z]{1,3})$/.exec(t);
  if (m) {
    const c1 = columnCharToIndex(m[1]);
    const c2 = columnCharToIndex(m[2]);
    return {
      row: [0, MAX_ROW],
      column: [Math.min(c1, c2), Math.max(c1, c2)],
    };
  }
  return null;
}

/** Splits a comma-separated list of references; null when one is invalid. */
export function parsePrintRanges(text: string): PrintRange[] | null {
  const parts = text
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  const out: PrintRange[] = [];
  for (let i = 0; i < parts.length; i += 1) {
    const r = parsePrintRange(parts[i]);
    if (!r) return null;
    out.push(r);
  }
  return out;
}

export function printRangesToText(ranges?: PrintRange[] | null) {
  return (ranges ?? []).map((r) => printRangeToText(r)).join(",");
}

/** "$1:$2" for title rows. */
export function titleRowsToText(rows?: [number, number]) {
  return rows ? `$${rows[0] + 1}:$${rows[1] + 1}` : "";
}

/** "$A:$B" for title columns. */
export function titleColumnsToText(cols?: [number, number]) {
  return cols
    ? `$${indexToColumnChar(cols[0])}:$${indexToColumnChar(cols[1])}`
    : "";
}

/** Rows of a "$1:$2" (or "A1:B2") reference; undefined for "", null when invalid. */
export function parseTitleRows(
  text: string
): [number, number] | undefined | null {
  if (!text.trim()) return undefined;
  const r = parsePrintRange(text);
  return r ? r.row : null;
}

export function parseTitleColumns(
  text: string
): [number, number] | undefined | null {
  if (!text.trim()) return undefined;
  const r = parsePrintRange(text);
  return r ? r.column : null;
}

// ---------------------------------------------------------------------------
// Pagination.

/** Row/column sizes of a sheet at 100% zoom (grid line included). */
export type PrintGeometry = {
  rowCount: number;
  colCount: number;
  /** Bottom edge of each row (like `ctx.visibledatarow` at 100%). */
  rowEnds: number[];
  /** Right edge of each column. */
  colEnds: number[];
  rowTop: (r: number) => number;
  colLeft: (c: number) => number;
  rowHeight: (r: number) => number;
  colWidth: (c: number) => number;
};

function sheetDefaults(ctx: Context, sheet: Sheet) {
  const current = sheet.id === ctx.currentSheetId;
  return {
    rowLen:
      (current ? ctx.defaultrowlen : undefined) ??
      sheet.defaultRowHeight ??
      ctx.defaultrowlen ??
      19,
    colLen:
      (current ? ctx.defaultcollen : undefined) ??
      sheet.defaultColWidth ??
      ctx.defaultcollen ??
      73,
  };
}

/** Cells of a sheet as a matrix, built from celldata for unloaded sheets. */
export function printCellMatrix(sheet: Sheet): CellMatrix {
  if (Array.isArray(sheet.data) && sheet.data.length > 0) return sheet.data;
  const out: CellMatrix = [];
  let cols = 0;
  (sheet.celldata ?? []).forEach((cell) => {
    if (!out[cell.r]) out[cell.r] = [];
    out[cell.r][cell.c] = cell.v as Cell | null;
    cols = Math.max(cols, cell.c + 1);
  });
  for (let r = 0; r < out.length; r += 1) {
    if (!out[r]) out[r] = [];
    for (let c = 0; c < cols; c += 1) {
      if (out[r][c] === undefined) out[r][c] = null;
    }
  }
  return out;
}

export function sheetPrintGeometry(
  ctx: Context,
  sheet: Sheet,
  minRows = 0,
  minCols = 0
): PrintGeometry {
  const data = printCellMatrix(sheet);
  const { rowLen, colLen } = sheetDefaults(ctx, sheet);
  const config = sheet.config ?? {};
  const rowCount = Math.max(
    data.length,
    sheet.row ?? 0,
    minRows,
    ...Object.keys(config.rowlen ?? {}).map((k) => Number(k) + 1)
  );
  const colCount = Math.max(
    data[0]?.length ?? 0,
    sheet.column ?? 0,
    minCols,
    ...Object.keys(config.columnlen ?? {}).map((k) => Number(k) + 1)
  );
  const rowEnds = computeAxisPositions(
    rowCount,
    rowLen,
    config.rowlen,
    config.rowhidden,
    1
  ).positions;
  const colEnds = computeAxisPositions(
    colCount,
    colLen,
    config.columnlen,
    config.colhidden,
    1
  ).positions;
  const rowTop = (r: number) => (r <= 0 ? 0 : rowEnds[r - 1] ?? 0);
  const colLeft = (c: number) => (c <= 0 ? 0 : colEnds[c - 1] ?? 0);
  return {
    rowCount,
    colCount,
    rowEnds,
    colEnds,
    rowTop,
    colLeft,
    rowHeight: (r) => (rowEnds[r] ?? 0) - rowTop(r),
    colWidth: (c) => (colEnds[c] ?? 0) - colLeft(c),
  };
}

function hasContent(cell: Cell | null | undefined) {
  if (!cell) return false;
  if (cell.mc) return true;
  if (cell.v != null && `${cell.v}` !== "") return true;
  if (cell.f) return true;
  if ((cell as any).ct?.s?.length) return true;
  if (cell.bg) return true;
  return false;
}

function indexAt(ends: number[], px: number) {
  const i = _.sortedIndex(ends, px);
  return Math.min(i, Math.max(0, ends.length - 1));
}

/**
 * Excel's printed range when there is no print area: every cell with a
 * value, a fill, a border or a merge, and every picture and chart.
 */
export function getPrintUsedRange(
  ctx: Context,
  sheet: Sheet,
  geometry?: PrintGeometry
): PrintRange | null {
  let r1 = Infinity;
  let r2 = -1;
  let c1 = Infinity;
  let c2 = -1;
  const add = (ra: number, rb: number, ca: number, cb: number) => {
    r1 = Math.min(r1, ra);
    r2 = Math.max(r2, rb);
    c1 = Math.min(c1, ca);
    c2 = Math.max(c2, cb);
  };
  const data = printCellMatrix(sheet);
  for (let r = 0; r < data.length; r += 1) {
    const row = data[r];
    if (row) {
      for (let c = 0; c < row.length; c += 1) {
        const cell = row[c];
        if (hasContent(cell)) {
          const mc = cell?.mc;
          if (mc?.rs != null && mc.cs != null) {
            add(r, r + mc.rs - 1, c, c + mc.cs - 1);
          } else add(r, r, c, c);
        }
      }
    }
  }
  (sheet.config?.borderInfo ?? []).forEach((b: any) => {
    if (b?.rangeType === "cell" && b.value) {
      add(
        b.value.row_index,
        b.value.row_index,
        b.value.col_index,
        b.value.col_index
      );
    } else {
      (b?.range ?? []).forEach((rg: any) => {
        if (rg?.row && rg?.column) {
          add(rg.row[0], rg.row[1], rg.column[0], rg.column[1]);
        }
      });
    }
  });
  const objects = [...(sheet.images ?? []), ...(sheet.charts ?? [])];
  if (objects.length > 0) {
    const g = geometry ?? sheetPrintGeometry(ctx, sheet);
    objects.forEach((o: any) => {
      const left = Number(o.left) || 0;
      const top = Number(o.top) || 0;
      add(
        indexAt(g.rowEnds, top + 1),
        indexAt(g.rowEnds, top + (Number(o.height) || 0)),
        indexAt(g.colEnds, left + 1),
        indexAt(g.colEnds, left + (Number(o.width) || 0))
      );
    });
  }
  if (r2 < 0) return null;
  return { row: [r1, r2], column: [c1, c2] };
}

export type PrintScope = "sheet" | "workbook" | "selection";

/** One printed page of a sheet (cell rectangles are inclusive). */
export type PrintPageInfo = {
  sheetId: string;
  /** Index of the print area the page belongs to. */
  area: number;
  rows: [number, number];
  cols: [number, number];
  /** Title rows / columns repeated on this page. */
  titleRows: [number, number] | null;
  titleCols: [number, number] | null;
  /** Unscaled size of the printed content (headings and titles included). */
  width: number;
  height: number;
  /** Size of the row / column headings (0 without headings). */
  headingWidth: number;
  headingHeight: number;
  /** Top-left corner of the content on the page (scaled page px). */
  x: number;
  y: number;
};

export type PageBreakLine = {
  /** First row / column of the page the break starts. */
  index: number;
  manual: boolean;
};

export type PrintAreaLayout = {
  range: PrintRange;
  rowBands: [number, number][];
  colBands: [number, number][];
  rowBreaks: PageBreakLine[];
  colBreaks: PageBreakLine[];
};

export type SheetPageLayout = {
  sheetId: string;
  setup: ResolvedPageSetup;
  /** Print scale (1 = 100%). */
  scale: number;
  /** Oriented paper size in px. */
  paper: { width: number; height: number };
  /** Printable width and height between the margins (px). */
  printable: { width: number; height: number };
  areas: PrintAreaLayout[];
  pages: PrintPageInfo[];
  geometry: PrintGeometry;
};

export const PRINT_HEADING_HEIGHT = 20;

export function printHeadingWidth(lastRow: number) {
  return Math.max(28, String(lastRow + 1).length * 8 + 12);
}

function clampRange(range: PrintRange, g: PrintGeometry): PrintRange | null {
  const r1 = Math.max(0, range.row[0]);
  const c1 = Math.max(0, range.column[0]);
  const r2 = Math.min(range.row[1], g.rowCount - 1);
  const c2 = Math.min(range.column[1], g.colCount - 1);
  if (r2 < r1 || c2 < c1) return null;
  return { row: [r1, r2], column: [c1, c2] };
}

function span(a: number, b: number, size: (i: number) => number): number {
  let total = 0;
  for (let i = a; i <= b; i += 1) total += size(i);
  return total;
}

/** Splits [start, end] into bands no longer than `avail` px. */
function splitBands(
  start: number,
  end: number,
  size: (i: number) => number,
  avail: (bandStart: number) => number,
  manual: Set<number> | null
): [number, number][] {
  const bands: [number, number][] = [];
  let s = start;
  while (s <= end) {
    const room = avail(s);
    let used = size(s);
    let e = s;
    while (e + 1 <= end) {
      if (manual?.has(e + 1)) break;
      const next = size(e + 1);
      if (used + next > room + 0.01) break;
      used += next;
      e += 1;
    }
    bands.push([s, e]);
    s = e + 1;
  }
  return bands;
}

function titleApplies(titles: [number, number] | undefined, bandStart: number) {
  return titles != null && titles[0] <= titles[1] && bandStart > titles[1];
}

type LayoutOptions = {
  /** Print these ranges instead of the print area / used range. */
  ranges?: PrintRange[];
  /** Ignore the print area (print the used range). */
  ignorePrintArea?: boolean;
};

function layoutAt(
  scale: number,
  ranges: PrintRange[],
  setup: ResolvedPageSetup,
  g: PrintGeometry,
  printable: { width: number; height: number },
  useManual: boolean
): PrintAreaLayout[] {
  const titleRows = setup.printTitleRows;
  const titleCols = setup.printTitleColumns;
  const titleRowsH = titleRows
    ? span(titleRows[0], Math.min(titleRows[1], g.rowCount - 1), g.rowHeight)
    : 0;
  const titleColsW = titleCols
    ? span(titleCols[0], Math.min(titleCols[1], g.colCount - 1), g.colWidth)
    : 0;
  const rowManual = useManual ? new Set(setup.rowBreaks) : null;
  const colManual = useManual ? new Set(setup.colBreaks) : null;
  return ranges.map((range) => {
    const headH = setup.headings ? PRINT_HEADING_HEIGHT : 0;
    const headW = setup.headings ? printHeadingWidth(range.row[1]) : 0;
    const rowBands = splitBands(
      range.row[0],
      range.row[1],
      g.rowHeight,
      (s) =>
        printable.height / scale -
        headH -
        (titleApplies(titleRows, s) ? titleRowsH : 0),
      rowManual
    );
    const colBands = splitBands(
      range.column[0],
      range.column[1],
      g.colWidth,
      (s) =>
        printable.width / scale -
        headW -
        (titleApplies(titleCols, s) ? titleColsW : 0),
      colManual
    );
    const breaks = (bands: [number, number][], manual: Set<number> | null) =>
      bands.slice(1).map(([s]) => ({ index: s, manual: !!manual?.has(s) }));
    return {
      range,
      rowBands,
      colBands,
      rowBreaks: breaks(rowBands, rowManual),
      colBreaks: breaks(colBands, colManual),
    };
  });
}

/** The ranges a sheet prints: explicit ranges, its print area or its used range. */
export function getSheetPrintRanges(
  ctx: Context,
  sheet: Sheet,
  options: LayoutOptions,
  geometry?: PrintGeometry
): PrintRange[] {
  if (options.ranges) return options.ranges;
  const setup = sheet.pageSetup;
  if (!options.ignorePrintArea && setup?.printArea?.length) {
    return setup.printArea;
  }
  const used = getPrintUsedRange(ctx, sheet, geometry);
  return used ? [used] : [];
}

/**
 * Pagination of a sheet: print scale, page bands per print area, page
 * break lines and the pages in print order.
 */
export function computeSheetPageLayout(
  ctx: Context,
  sheetId?: string,
  options: LayoutOptions = {}
): SheetPageLayout | null {
  const sheet = sheetById(ctx, sheetId);
  if (!sheet?.id) return null;
  const setup = resolvePageSetup(sheet.pageSetup);
  const wanted = getSheetPrintRanges(ctx, sheet, options);
  const maxRow = Math.max(0, ...wanted.map((r) => Math.min(r.row[1], 1e5) + 1));
  const maxCol = Math.max(
    0,
    ...wanted.map((r) => Math.min(r.column[1], 1e4) + 1)
  );
  const g = sheetPrintGeometry(ctx, sheet, maxRow, maxCol);
  const ranges = wanted
    .map((r) => clampRange(r, g))
    .filter((r): r is PrintRange => r != null);
  const paperPx = pagePaperPx(setup);
  const m = setup.margins;
  const printable = {
    width: Math.max(
      PX_PER_INCH / 2,
      paperPx.width - (m.left + m.right) * PX_PER_INCH
    ),
    height: Math.max(
      PX_PER_INCH / 2,
      paperPx.height - (m.top + m.bottom) * PX_PER_INCH
    ),
  };

  let scale = setup.scale / 100;
  let areas: PrintAreaLayout[];
  if (setup.fitToPage) {
    const W = setup.fitToWidth;
    const H = setup.fitToHeight;
    const fits = (list: PrintAreaLayout[]) =>
      list.every(
        (a) =>
          (W === 0 || a.colBands.length <= W) &&
          (H === 0 || a.rowBands.length <= H)
      );
    // a first guess from the total size, then shrink 1% at a time
    let guess = 1;
    ranges.forEach((range) => {
      const headW = setup.headings ? printHeadingWidth(range.row[1]) : 0;
      const headH = setup.headings ? PRINT_HEADING_HEIGHT : 0;
      const w = span(range.column[0], range.column[1], g.colWidth) + headW;
      const h = span(range.row[0], range.row[1], g.rowHeight) + headH;
      if (W > 0 && w > 0) guess = Math.min(guess, (W * printable.width) / w);
      if (H > 0 && h > 0) guess = Math.min(guess, (H * printable.height) / h);
    });
    scale = Math.max(0.1, Math.floor(guess * 100) / 100);
    areas = layoutAt(scale, ranges, setup, g, printable, false);
    while (!fits(areas) && scale > 0.1) {
      scale = Math.max(0.1, Math.round((scale - 0.01) * 100) / 100);
      areas = layoutAt(scale, ranges, setup, g, printable, false);
    }
  } else {
    areas = layoutAt(scale, ranges, setup, g, printable, true);
  }

  const pages: PrintPageInfo[] = [];
  areas.forEach((area, ai) => {
    const headW = setup.headings ? printHeadingWidth(area.range.row[1]) : 0;
    const headH = setup.headings ? PRINT_HEADING_HEIGHT : 0;
    const make = (rows: [number, number], cols: [number, number]) => {
      const titleRows = titleApplies(setup.printTitleRows, rows[0])
        ? ([
            setup.printTitleRows![0],
            Math.min(setup.printTitleRows![1], g.rowCount - 1),
          ] as [number, number])
        : null;
      const titleCols = titleApplies(setup.printTitleColumns, cols[0])
        ? ([
            setup.printTitleColumns![0],
            Math.min(setup.printTitleColumns![1], g.colCount - 1),
          ] as [number, number])
        : null;
      const width =
        headW +
        (titleCols ? span(titleCols[0], titleCols[1], g.colWidth) : 0) +
        span(cols[0], cols[1], g.colWidth);
      const height =
        headH +
        (titleRows ? span(titleRows[0], titleRows[1], g.rowHeight) : 0) +
        span(rows[0], rows[1], g.rowHeight);
      const x =
        m.left * PX_PER_INCH +
        (setup.centerHorizontally
          ? Math.max(0, (printable.width - width * scale) / 2)
          : 0);
      const y =
        m.top * PX_PER_INCH +
        (setup.centerVertically
          ? Math.max(0, (printable.height - height * scale) / 2)
          : 0);
      pages.push({
        sheetId: sheet.id!,
        area: ai,
        rows,
        cols,
        titleRows,
        titleCols,
        width,
        height,
        headingWidth: headW,
        headingHeight: headH,
        x,
        y,
      });
    };
    if (setup.pageOrder === "overThenDown") {
      area.rowBands.forEach((rows) =>
        area.colBands.forEach((cols) => make(rows, cols))
      );
    } else {
      area.colBands.forEach((cols) =>
        area.rowBands.forEach((rows) => make(rows, cols))
      );
    }
  });

  return {
    sheetId: sheet.id,
    setup,
    scale,
    paper: paperPx,
    printable,
    areas,
    pages,
    geometry: g,
  };
}

// ---------------------------------------------------------------------------
// Keep print areas, titles and breaks on their cells when rows/columns move.

function shiftBreaks(
  list: number[] | undefined,
  change: ReferenceChange,
  axis: "row" | "column"
) {
  if (!list?.length) return list;
  if (change.type === "insert" && change.axis === axis) {
    return list.map((b) => (b >= change.index ? b + change.count : b));
  }
  if (change.type === "delete" && change.axis === axis) {
    const n = change.end - change.start + 1;
    return list
      .filter((b) => b < change.start || b > change.end)
      .map((b) => (b > change.end ? b - n : b))
      .filter((b) => b > 0);
  }
  return list;
}

function shiftTitles(
  titles: [number, number] | undefined,
  change: ReferenceChange,
  axis: "row" | "column"
): [number, number] | undefined {
  if (!titles) return titles;
  const [a, b] = titles;
  if (change.type === "insert" && change.axis === axis) {
    if (change.index > b) return titles;
    if (change.index <= a) return [a + change.count, b + change.count];
    return [a, b + change.count];
  }
  if (change.type === "delete" && change.axis === axis) {
    const n = change.end - change.start + 1;
    if (change.start > b) return titles;
    if (change.end < a) return [a - n, b - n];
    const keptBefore = Math.max(0, change.start - a);
    const keptAfter = Math.max(0, b - change.end);
    if (keptBefore + keptAfter === 0) return undefined;
    const start = Math.min(a, change.start);
    return [start, start + keptBefore + keptAfter - 1];
  }
  return titles;
}

export function adjustPageSetupForChange(
  ctx: Context,
  change: ReferenceChange,
  api: Pick<ReferenceAdjusterApi, "adjustRange">
) {
  ctx.luckysheetfile.forEach((sheet) => {
    const setup = sheet.pageSetup;
    if (!setup || !sheet.id) return;
    const next: PageSetup = { ...setup };
    let changed = false;
    if (setup.printArea?.length) {
      const areas = setup.printArea
        .map((r) => api.adjustRange(r, sheet.id!))
        .filter((r): r is PrintRange => r != null);
      if (!_.isEqual(areas, setup.printArea)) {
        next.printArea = areas;
        changed = true;
      }
    }
    if ("sheetId" in change && change.sheetId === sheet.id) {
      const rows = shiftTitles(setup.printTitleRows, change, "row");
      const cols = shiftTitles(setup.printTitleColumns, change, "column");
      const rb = shiftBreaks(setup.rowBreaks, change, "row");
      const cb = shiftBreaks(setup.colBreaks, change, "column");
      if (
        !_.isEqual(rows, setup.printTitleRows) ||
        !_.isEqual(cols, setup.printTitleColumns) ||
        !_.isEqual(rb, setup.rowBreaks) ||
        !_.isEqual(cb, setup.colBreaks)
      ) {
        next.printTitleRows = rows;
        next.printTitleColumns = cols;
        next.rowBreaks = rb;
        next.colBreaks = cb;
        changed = true;
      }
    }
    if (changed) sheet.pageSetup = normalizePageSetup(next);
  });
}

export function installPageSetupAdjuster() {
  registerReferenceAdjuster("model.pageSetup", adjustPageSetupForChange);
}

installPageSetupAdjuster();
