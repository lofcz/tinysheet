/**
 * Print renderer: turns a sheet's pagination (pageSetup.ts) into
 * print-ready pages outside the live grid, and the browser print flow.
 *
 * Cells are drawn by the grid's own `Canvas.drawMain` (formats, fills,
 * borders, merges, conditional formats, cell decorators) on an offscreen
 * canvas per page, with a print context: 100% zoom, the light theme, the
 * page's scale times the output pixel ratio as device pixel ratio, and the
 * printed sheet as the current one. Pictures and charts, headers and
 * footers are laid over it as DOM, so a page is a self-contained element
 * the Print Preview shows and `window.print()` prints (`@page` sizes it).
 */
import type { Context } from "../context";
import type {
  Cell,
  CellMatrix,
  HeaderFooterText,
  PrintRange,
  Sheet,
} from "../types";
import { Canvas } from "../canvas";
import { getSheetIndex, indexToColumnChar } from "../utils";
import {
  PX_PER_INCH,
  PrintPageInfo,
  PrintScope,
  SheetPageLayout,
  computeSheetPageLayout,
  printCellMatrix,
} from "./pageSetup";
import {
  HeaderFooterFields,
  HeaderFooterRun,
  parseHeaderFooterSection,
} from "./headerFooter";
import { renderChartToSvg } from "./chart";

export type PrintJobOptions = {
  /** Active sheet (default), every visible sheet, or the selection. */
  scope?: PrintScope;
  /** Sheet to print (default: the current sheet). */
  sheetId?: string;
  /** Print the used range even when the sheet has a print area. */
  ignorePrintArea?: boolean;
  /** For &F / &Z. */
  fileName?: string;
  filePath?: string;
  /** For &D / &T (default: now). */
  date?: Date;
  /** Locale of &D / &T. */
  locale?: string;
};

export type PrintNote = { ref: string; text: string };

export type PrintJobPage =
  | {
      kind: "cells";
      sheetId: string;
      sheetName: string;
      layout: SheetPageLayout;
      info: PrintPageInfo;
      /** Printed page number (&P). */
      number: number;
      /** Index of the page within its sheet. */
      sheetPage: number;
    }
  | {
      kind: "notes";
      sheetId: string;
      sheetName: string;
      layout: SheetPageLayout;
      notes: PrintNote[];
      number: number;
      sheetPage: number;
    };

export type PrintJob = {
  pages: PrintJobPage[];
  options: PrintJobOptions;
  date: Date;
};

const NOTES_PER_PAGE = 24;

function visibleSheets(ctx: Context) {
  return ctx.luckysheetfile
    .map((sheet, i) => ({ sheet, i }))
    .filter(({ sheet }) => sheet.hide !== 1)
    .sort(
      (a, b) =>
        Number(a.sheet.order ?? a.i) - Number(b.sheet.order ?? b.i) || a.i - b.i
    )
    .map(({ sheet }) => sheet);
}

function selectionRanges(ctx: Context): PrintRange[] {
  return (ctx.luckysheet_select_save ?? []).map((s) => ({
    row: [Math.min(s.row[0], s.row[1]), Math.max(s.row[0], s.row[1])],
    column: [
      Math.min(s.column[0], s.column[1]),
      Math.max(s.column[0], s.column[1]),
    ],
  }));
}

function notesOf(sheet: Sheet, layout: SheetPageLayout): PrintNote[] {
  const data = printCellMatrix(sheet);
  const inside = (r: number, c: number) =>
    layout.areas.some(
      (a) =>
        r >= a.range.row[0] &&
        r <= a.range.row[1] &&
        c >= a.range.column[0] &&
        c <= a.range.column[1]
    );
  const notes: PrintNote[] = [];
  data.forEach((row, r) =>
    row?.forEach((cell, c) => {
      const text = cell?.ps?.value;
      if (text && inside(r, c)) {
        notes.push({ ref: `${indexToColumnChar(c)}${r + 1}`, text });
      }
    })
  );
  return notes;
}

/** Paginates what `options` prints into numbered pages. */
export function buildPrintJob(
  ctx: Context,
  options: PrintJobOptions = {}
): PrintJob {
  const scope = options.scope ?? "sheet";
  const currentId = options.sheetId ?? ctx.currentSheetId;
  const sheets =
    scope === "workbook"
      ? visibleSheets(ctx)
      : ctx.luckysheetfile.filter((s) => s.id === currentId);
  const pages: PrintJobPage[] = [];
  let next = 1;
  sheets.forEach((sheet) => {
    if (!sheet.id) return;
    const layout = computeSheetPageLayout(ctx, sheet.id, {
      ranges: scope === "selection" ? selectionRanges(ctx) : undefined,
      ignorePrintArea: options.ignorePrintArea,
    });
    if (!layout || layout.pages.length === 0) return;
    let number = layout.setup.firstPageNumber ?? next;
    let sheetPage = 0;
    layout.pages.forEach((info) => {
      pages.push({
        kind: "cells",
        sheetId: sheet.id!,
        sheetName: sheet.name,
        layout,
        info,
        number,
        sheetPage,
      });
      number += 1;
      sheetPage += 1;
    });
    if (layout.setup.comments === "atEnd") {
      const notes = notesOf(sheet, layout);
      for (let i = 0; i < notes.length; i += NOTES_PER_PAGE) {
        pages.push({
          kind: "notes",
          sheetId: sheet.id,
          sheetName: sheet.name,
          layout,
          notes: notes.slice(i, i + NOTES_PER_PAGE),
          number,
          sheetPage,
        });
        number += 1;
        sheetPage += 1;
      }
    }
    next = number;
  });
  return { pages, options, date: options.date ?? new Date() };
}

// ---------------------------------------------------------------------------
// Cells.

const ERROR_RE =
  /^#(NULL!|DIV\/0!|VALUE!|REF!|NAME\?|NUM!|N\/A|SPILL!|CALC!|GETTING_DATA|FIELD!|BLOCKED!|CONNECT!|BUSY!|UNKNOWN!)$/;

function isErrorCell(cell: Cell) {
  return (
    (typeof cell.v === "string" && ERROR_RE.test(cell.v)) ||
    (typeof cell.m === "string" && ERROR_RE.test(cell.m))
  );
}

const ERROR_TEXT = { blank: "", dash: "--", NA: "#N/A" } as const;

/**
 * The cells as printed: no note markers, and error values replaced per
 * "Cell errors as". Rows outside `rows` and unchanged rows are shared.
 */
function printedCells(
  sheet: Sheet,
  layout: SheetPageLayout,
  rows: Set<number>
): CellMatrix {
  const src = printCellMatrix(sheet);
  const out = src.slice();
  const errors = layout.setup.cellErrors;
  rows.forEach((r) => {
    const row = src[r];
    if (!row) return;
    let copy: (Cell | null)[] | null = null;
    for (let c = 0; c < row.length; c += 1) {
      const cell = row[c];
      if (cell) {
        let next: Cell = cell;
        if (cell.ps) {
          next = { ...next };
          delete next.ps;
        }
        if (errors !== "displayed" && isErrorCell(cell)) {
          next = { ...next, v: ERROR_TEXT[errors], m: ERROR_TEXT[errors] };
        }
        if (next !== cell) {
          if (!copy) copy = row.slice();
          copy[c] = next;
        }
      }
    }
    if (copy) out[r] = copy;
  });
  return out;
}

const contextCache = new WeakMap<PrintJob, Map<string, Context>>();

/** A context that renders `sheet` for print (see the module comment). */
function printContext(
  ctx: Context,
  job: PrintJob,
  sheet: Sheet,
  layout: SheetPageLayout,
  pixelRatio: number
): Context {
  let perJob = contextCache.get(job);
  if (!perJob) {
    perJob = new Map();
    contextCache.set(job, perJob);
  }
  const key = `${sheet.id}|${pixelRatio}`;
  const hit = perJob.get(key);
  if (hit) return hit;
  const rows = new Set<number>();
  const addRows = (span: [number, number] | null | undefined) => {
    if (!span) return;
    for (let r = span[0]; r <= span[1]; r += 1) rows.add(r);
  };
  layout.areas.forEach((a) => addRows(a.range.row));
  addRows(layout.setup.printTitleRows);
  const data = printedCells(sheet, layout, rows);
  const g = layout.geometry;
  const current = sheet.id === ctx.currentSheetId;
  const pctx = {
    ...ctx,
    luckysheetfile: ctx.luckysheetfile.map((s) =>
      s.id === sheet.id ? { ...s, data } : s
    ),
    currentSheetId: sheet.id!,
    config: sheet.config ?? {},
    visibledatarow: g.rowEnds,
    visibledatacolumn: g.colEnds,
    zoomRatio: 1,
    devicePixelRatio: layout.scale * pixelRatio,
    showGridLines: layout.setup.gridLines && !layout.setup.draft,
    theme: "light",
    defaultrowlen: current
      ? ctx.defaultrowlen
      : (sheet.defaultRowHeight ?? ctx.defaultrowlen),
    defaultcollen: current
      ? ctx.defaultcollen
      : (sheet.defaultColWidth ?? ctx.defaultcollen),
    luckysheetTableContentHW: [g.colEnds[g.colEnds.length - 1] ?? 0, 0],
    luckysheet_select_save: [],
    luckysheetcurrentisPivotTable: false,
  } as Context;
  perJob.set(key, pctx);
  return pctx;
}

type Block = {
  rows: [number, number];
  cols: [number, number];
  x: number;
  y: number;
  w: number;
  h: number;
};

/** The cell blocks of a page (corner / title rows / title columns / body). */
export function pageBlocks(page: PrintPageInfo, layout: SheetPageLayout) {
  const g = layout.geometry;
  const width = (c: [number, number]) => g.colEnds[c[1]] - g.colLeft(c[0]);
  const height = (r: [number, number]) => g.rowEnds[r[1]] - g.rowTop(r[0]);
  const hx = page.headingWidth;
  const hy = page.headingHeight;
  const tw = page.titleCols ? width(page.titleCols) : 0;
  const th = page.titleRows ? height(page.titleRows) : 0;
  const blocks: Block[] = [];
  const add = (
    rows: [number, number],
    cols: [number, number],
    x: number,
    y: number
  ) => blocks.push({ rows, cols, x, y, w: width(cols), h: height(rows) });
  if (page.titleRows && page.titleCols)
    add(page.titleRows, page.titleCols, hx, hy);
  if (page.titleRows) add(page.titleRows, page.cols, hx + tw, hy);
  if (page.titleCols) add(page.rows, page.titleCols, hx, hy + th);
  add(page.rows, page.cols, hx + tw, hy + th);
  return blocks;
}

function drawHeadings(
  c2d: CanvasRenderingContext2D,
  page: PrintPageInfo,
  layout: SheetPageLayout,
  blocks: Block[]
) {
  const g = layout.geometry;
  const hx = page.headingWidth;
  const hy = page.headingHeight;
  c2d.save();
  c2d.fillStyle = "#ffffff";
  c2d.fillRect(0, 0, page.width, hy);
  c2d.fillRect(0, 0, hx, page.height);
  c2d.strokeStyle = "#808080";
  c2d.lineWidth = 1;
  c2d.fillStyle = "#000000";
  c2d.font = "11px Arial, sans-serif";
  c2d.textAlign = "center";
  c2d.textBaseline = "middle";
  const cols = new Map<number, number>();
  const rows = new Map<number, number>();
  blocks.forEach((b) => {
    if (b.y === hy || !page.titleRows) {
      for (let c = b.cols[0]; c <= b.cols[1]; c += 1) {
        cols.set(c, b.x + g.colLeft(c) - g.colLeft(b.cols[0]));
      }
    }
    if (b.x === hx || !page.titleCols) {
      for (let r = b.rows[0]; r <= b.rows[1]; r += 1) {
        rows.set(r, b.y + g.rowTop(r) - g.rowTop(b.rows[0]));
      }
    }
  });
  cols.forEach((x, c) => {
    const w = g.colWidth(c);
    if (w <= 0) return;
    c2d.strokeRect(x + 0.5, 0.5, w, hy - 1);
    c2d.fillText(indexToColumnChar(c), x + w / 2, hy / 2);
  });
  rows.forEach((y, r) => {
    const h = g.rowHeight(r);
    if (h <= 0) return;
    c2d.strokeRect(0.5, y + 0.5, hx - 1, h);
    c2d.fillText(String(r + 1), hx / 2, y + h / 2);
  });
  c2d.strokeRect(0.5, 0.5, hx - 1, hy - 1);
  c2d.restore();
}

/**
 * Draws the cells of a page on `canvas` (sized here: the page's unscaled
 * content size times scale times `pixelRatio`).
 */
export function renderPrintPageCells(
  ctx: Context,
  job: PrintJob,
  page: Extract<PrintJobPage, { kind: "cells" }>,
  canvas: HTMLCanvasElement,
  pixelRatio = 2
) {
  const { layout, info } = page;
  const sheet = ctx.luckysheetfile[getSheetIndex(ctx, page.sheetId) ?? -1];
  if (!sheet) return;
  const dpr = layout.scale * pixelRatio;
  canvas.width = Math.max(1, Math.ceil(info.width * dpr));
  canvas.height = Math.max(1, Math.ceil(info.height * dpr));
  canvas.style.width = `${info.width}px`;
  canvas.style.height = `${info.height}px`;
  const c2d = canvas.getContext("2d");
  if (!c2d) return;
  c2d.fillStyle = "#ffffff";
  c2d.fillRect(0, 0, canvas.width, canvas.height);
  const pctx = printContext(ctx, job, sheet, layout, pixelRatio);
  const grid = new Canvas(canvas, pctx);
  const blocks = pageBlocks(info, layout);
  const g = layout.geometry;
  blocks.forEach((b) => {
    if (b.w <= 0 || b.h <= 0) return;
    c2d.save();
    c2d.beginPath();
    c2d.rect(b.x * dpr, b.y * dpr, b.w * dpr, b.h * dpr);
    c2d.clip();
    try {
      grid.drawMain({
        scrollWidth: g.colLeft(b.cols[0]),
        scrollHeight: g.rowTop(b.rows[0]),
        drawWidth: b.w,
        drawHeight: b.h,
        offsetLeft: b.x + 1,
        offsetTop: b.y + 1,
      });
    } finally {
      c2d.restore();
    }
  });
  c2d.save();
  c2d.scale(dpr, dpr);
  if (pctx.showGridLines) {
    // the grid draws right and bottom cell edges: close the left and top
    c2d.strokeStyle = "#e1e1e1";
    c2d.lineWidth = 1;
    c2d.beginPath();
    blocks.forEach((b) => {
      c2d.moveTo(b.x + 0.5, b.y);
      c2d.lineTo(b.x + 0.5, b.y + b.h);
      c2d.moveTo(b.x, b.y + 0.5);
      c2d.lineTo(b.x + b.w, b.y + 0.5);
    });
    c2d.stroke();
  }
  if (info.headingWidth > 0) drawHeadings(c2d, info, layout, blocks);
  c2d.restore();
}

// ---------------------------------------------------------------------------
// Page elements.

function svgDataUrl(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function objectsLayer(
  doc: Document,
  ctx: Context,
  sheet: Sheet,
  page: PrintPageInfo,
  layout: SheetPageLayout
) {
  const body = pageBlocks(page, layout).slice(-1)[0];
  const g = layout.geometry;
  const layer = doc.createElement("div");
  layer.className = "fortune-print-objects";
  Object.assign(layer.style, {
    position: "absolute",
    left: `${body.x}px`,
    top: `${body.y}px`,
    width: `${body.w}px`,
    height: `${body.h}px`,
    overflow: "hidden",
  });
  const originX = g.colLeft(page.cols[0]);
  const originY = g.rowTop(page.rows[0]);
  const place = (
    el: HTMLElement,
    o: { left: number; top: number; width: number; height: number }
  ) => {
    const x = o.left - originX;
    const y = o.top - originY;
    if (x >= body.w || y >= body.h || x + o.width <= 0 || y + o.height <= 0) {
      return;
    }
    Object.assign(el.style, {
      position: "absolute",
      left: `${x}px`,
      top: `${y}px`,
      width: `${o.width}px`,
      height: `${o.height}px`,
    });
    layer.appendChild(el);
  };
  (sheet.images ?? []).forEach((img) => {
    if (!img?.src) return;
    const el = doc.createElement("img");
    el.src = img.src;
    el.alt = "";
    place(el, img);
  });
  (sheet.charts ?? []).forEach((chart) => {
    let svg = "";
    try {
      svg = renderChartToSvg({ ...ctx, theme: "light" }, chart, "light");
    } catch {
      return;
    }
    const el = doc.createElement("img");
    el.src = svgDataUrl(svg);
    el.alt = chart.title ?? "";
    place(el, chart);
  });
  if (layout.setup.comments === "asDisplayed") {
    const data = printCellMatrix(sheet);
    for (let r = page.rows[0]; r <= page.rows[1]; r += 1) {
      for (let c = page.cols[0]; c <= page.cols[1]; c += 1) {
        const ps = data[r]?.[c]?.ps;
        if (ps?.isShow && ps.value) {
          const note = doc.createElement("div");
          note.className = "fortune-print-note";
          note.textContent = ps.value;
          Object.assign(note.style, {
            background: "#ffffe1",
            border: "1px solid #000",
            padding: "2px 4px",
            font: "11px Tahoma, Arial, sans-serif",
            color: "#000",
            whiteSpace: "pre-wrap",
            overflow: "hidden",
            boxSizing: "border-box",
          });
          place(note, {
            left: ps.left ?? g.colEnds[c] + 12,
            top: ps.top ?? g.rowTop(r) - 4,
            width: ps.width ?? 144,
            height: ps.height ?? 72,
          });
        }
      }
    }
  }
  return layer;
}

function runElement(doc: Document, run: HeaderFooterRun, scale: number) {
  const span = doc.createElement("span");
  span.textContent = run.text;
  const deco = [
    run.underline || run.doubleUnderline ? "underline" : "",
    run.strike ? "line-through" : "",
  ]
    .filter(Boolean)
    .join(" ");
  Object.assign(span.style, {
    fontWeight: run.bold ? "bold" : "",
    fontStyle: run.italic ? "italic" : "",
    textDecoration: deco,
    textDecorationStyle: run.doubleUnderline ? "double" : "",
    verticalAlign:
      (run.superscript && "super") || (run.subscript && "sub") || "",
    fontFamily: run.font
      ? `"${run.font}", Calibri, Carlito, Arial, sans-serif`
      : "",
    fontSize: run.size ? `${run.size * scale}pt` : "",
    color: run.color ?? "",
  });
  return span;
}

/** A header or footer's three sections as an element. */
export function headerFooterElement(
  doc: Document,
  hf: HeaderFooterText,
  fields: HeaderFooterFields,
  scale = 1
) {
  const box = doc.createElement("div");
  Object.assign(box.style, {
    position: "absolute",
    left: "0",
    right: "0",
    fontFamily: "Calibri, Carlito, Arial, sans-serif",
    fontSize: `${11 * scale}pt`,
    lineHeight: "1.2",
    color: "#000",
    whiteSpace: "pre",
  });
  (["left", "center", "right"] as const).forEach((key) => {
    const runs = parseHeaderFooterSection(hf[key], fields);
    if (runs.length === 0) return;
    const sec = doc.createElement("div");
    sec.className = `fortune-print-hf-${key}`;
    Object.assign(sec.style, {
      position: "absolute",
      top: "0",
      left: key === "right" ? "auto" : "0",
      right: key === "left" ? "auto" : "0",
      textAlign: key,
    });
    runs.forEach((run) => sec.appendChild(runElement(doc, run, scale)));
    box.appendChild(sec);
  });
  return box;
}

function headerFooterFor(page: PrintJobPage) {
  const s = page.layout.setup;
  if (s.differentFirst && page.sheetPage === 0) {
    return { header: s.firstHeader, footer: s.firstFooter };
  }
  if (s.differentOddEven && page.number % 2 === 0) {
    return { header: s.evenHeader, footer: s.evenFooter };
  }
  return { header: s.header, footer: s.footer };
}

export type RenderPrintPageOptions = {
  document?: Document;
  /** Output pixels per CSS pixel of the cell canvas (default 2). */
  pixelRatio?: number;
};

/**
 * Renders page `index` of a job as a page-sized element (CSS px, white
 * paper, content, header and footer).
 */
export function renderPrintPage(
  ctx: Context,
  job: PrintJob,
  index: number,
  options: RenderPrintPageOptions = {}
): HTMLElement {
  const doc = options.document ?? document;
  const page = job.pages[index];
  const el = doc.createElement("div");
  el.className = "fortune-print-page";
  if (!page) return el;
  const { layout } = page;
  const { setup, paper } = layout;
  Object.assign(el.style, {
    position: "relative",
    width: `${paper.width}px`,
    height: `${paper.height}px`,
    background: "#ffffff",
    color: "#000000",
    overflow: "hidden",
    boxSizing: "border-box",
  });
  if (setup.blackAndWhite) el.style.filter = "grayscale(1)";
  el.dataset.page = String(page.number);
  el.dataset.sheet = page.sheetName;

  const sheet = ctx.luckysheetfile[getSheetIndex(ctx, page.sheetId) ?? -1];
  const fields: HeaderFooterFields = {
    page: page.number,
    pages: job.pages.length,
    date: job.date,
    sheetName: page.sheetName,
    fileName: job.options.fileName ?? "Book1",
    filePath: job.options.filePath ?? "",
    locale: job.options.locale,
  };
  const m = setup.margins;
  const inset = setup.alignWithMargins
    ? { left: m.left * PX_PER_INCH, right: m.right * PX_PER_INCH }
    : { left: 0.3 * PX_PER_INCH, right: 0.3 * PX_PER_INCH };
  const hfScale = setup.scaleWithDoc ? layout.scale : 1;
  const { header, footer } = headerFooterFor(page);
  const headerEl = headerFooterElement(doc, header, fields, hfScale);
  headerEl.className = "fortune-print-header";
  Object.assign(headerEl.style, {
    top: `${m.header * PX_PER_INCH}px`,
    left: `${inset.left}px`,
    right: `${inset.right}px`,
  });
  el.appendChild(headerEl);
  const footerEl = headerFooterElement(doc, footer, fields, hfScale);
  footerEl.className = "fortune-print-footer";
  Object.assign(footerEl.style, {
    top: "auto",
    bottom: `${m.footer * PX_PER_INCH}px`,
    left: `${inset.left}px`,
    right: `${inset.right}px`,
  });
  // sections sit on the footer line, growing upwards
  footerEl.querySelectorAll<HTMLElement>("div").forEach((sec) => {
    sec.style.top = "auto";
    sec.style.bottom = "0";
  });
  el.appendChild(footerEl);

  if (page.kind === "notes") {
    const list = doc.createElement("div");
    list.className = "fortune-print-notes";
    Object.assign(list.style, {
      position: "absolute",
      left: `${m.left * PX_PER_INCH}px`,
      top: `${m.top * PX_PER_INCH}px`,
      right: `${m.right * PX_PER_INCH}px`,
      font: "11pt Calibri, Carlito, Arial, sans-serif",
      whiteSpace: "pre-wrap",
    });
    page.notes.forEach((note) => {
      const item = doc.createElement("div");
      item.style.marginBottom = "8px";
      const cell = doc.createElement("div");
      cell.textContent = `${page.sheetName}!${note.ref}`;
      cell.style.fontWeight = "bold";
      const text = doc.createElement("div");
      text.textContent = note.text;
      item.appendChild(cell);
      item.appendChild(text);
      list.appendChild(item);
    });
    el.appendChild(list);
    return el;
  }

  const { info } = page;
  const content = doc.createElement("div");
  content.className = "fortune-print-content";
  Object.assign(content.style, {
    position: "absolute",
    left: `${info.x}px`,
    top: `${info.y}px`,
    width: `${info.width * layout.scale}px`,
    height: `${info.height * layout.scale}px`,
    overflow: "hidden",
  });
  const inner = doc.createElement("div");
  Object.assign(inner.style, {
    position: "absolute",
    left: "0",
    top: "0",
    width: `${info.width}px`,
    height: `${info.height}px`,
    transform: `scale(${layout.scale})`,
    transformOrigin: "0 0",
  });
  const canvas = doc.createElement("canvas");
  canvas.style.position = "absolute";
  canvas.style.left = "0";
  canvas.style.top = "0";
  inner.appendChild(canvas);
  if (sheet) {
    renderPrintPageCells(ctx, job, page, canvas, options.pixelRatio ?? 2);
    if (!setup.draft) {
      inner.appendChild(objectsLayer(doc, ctx, sheet, info, layout));
    }
  }
  content.appendChild(inner);
  el.appendChild(content);
  return el;
}

// ---------------------------------------------------------------------------
// Browser print.

const ROOT_ID = "fortune-print-root";
const STYLE_ID = "fortune-print-style";

function pageSizeCss(width: number, height: number) {
  const inch = (px: number) =>
    `${Math.round((px / PX_PER_INCH) * 1000) / 1000}in`;
  return `${inch(width)} ${inch(height)}`;
}

/** Removes the print container and its stylesheet. */
export function cleanupPrint(doc: Document = document) {
  doc.getElementById(ROOT_ID)?.remove();
  doc.getElementById(STYLE_ID)?.remove();
}

/**
 * Prints a job with the browser (its dialog also saves as PDF): the pages
 * are rendered into a container shown only in print media, sized per page
 * with named `@page` rules.
 */
export function printJob(
  ctx: Context,
  job: PrintJob,
  options: RenderPrintPageOptions & { window?: Window } = {}
) {
  const win = options.window ?? window;
  const doc = win.document;
  cleanupPrint(doc);
  const root = doc.createElement("div");
  root.id = ROOT_ID;
  const sizes = new Map<string, string>();
  job.pages.forEach((page, i) => {
    const el = renderPrintPage(ctx, job, i, { ...options, document: doc });
    const size = pageSizeCss(page.layout.paper.width, page.layout.paper.height);
    if (!sizes.has(size)) sizes.set(size, `fortune-page-${sizes.size}`);
    el.style.setProperty("page", sizes.get(size)!);
    if (i < job.pages.length - 1) el.style.breakAfter = "page";
    root.appendChild(el);
  });
  const style = doc.createElement("style");
  style.id = STYLE_ID;
  const named = [...sizes.entries()]
    .map(([size, name]) => `@page ${name} { size: ${size}; margin: 0; }`)
    .join("\n");
  const first = sizes.keys().next().value ?? "8.5in 11in";
  style.textContent = `
@page { size: ${first}; margin: 0; }
${named}
@media screen { #${ROOT_ID} { display: none; } }
@media print {
  html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; height: auto !important; overflow: visible !important; }
  body > *:not(#${ROOT_ID}) { display: none !important; }
  #${ROOT_ID} { display: block; }
  #${ROOT_ID} .fortune-print-page { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}`;
  doc.head.appendChild(style);
  doc.body.appendChild(root);
  const done = () => {
    win.removeEventListener("afterprint", done);
    cleanupPrint(doc);
  };
  win.addEventListener("afterprint", done);
  win.print();
}
