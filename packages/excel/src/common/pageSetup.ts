/**
 * Page layout in xlsx <-> `sheet.pageSetup` (core modules/pageSetup.ts).
 *
 * Worksheet part: `<pageMargins>`, `<pageSetup>`, `<sheetPr><pageSetUpPr
 * fitToPage>`, `<printOptions>`, `<headerFooter>`, `<rowBreaks>` and
 * `<colBreaks>`. Workbook part: the built-in defined names
 * `_xlnm.Print_Area` and `_xlnm.Print_Titles` (sheet-scoped).
 *
 * Export goes through ExcelJS where it models the element; what it cannot
 * write (column breaks, "as displayed" notes, header/footer scaling and
 * alignment flags) is patched into the sheet XML afterwards, and the print
 * names are added to the defined names ExcelJS writes.
 */
import {
  PageSetup,
  PrintRange,
  headerFooterFromXlsx,
  headerFooterToXlsx,
  paperSizeFromExcel,
  getPaperSize,
  parsePrintRange,
  printRangeToText,
} from "@lofcz/tinysheet-core";
import type {
  SheetImportContext,
  WorkbookImportContext,
} from "../ToFortuneSheet/importFeatures";
import type {
  SheetExportContext,
  WorkbookExportContext,
} from "../ToExcel/buildWorkbook";
import { readDefinedNamesXml } from "./definedNames";
import { workBookFile } from "./constant";

// ---------------------------------------------------------------------------
// XML helpers.

function unescapeXml(text: string) {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_m, h) =>
      String.fromCharCode(parseInt(h, 16))
    )
    .replace(/&#(\d+);/g, (_m, d) => String.fromCharCode(parseInt(d, 10)))
    .replace(/&amp;/g, "&");
}

function attrs(tag: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!tag) return out;
  const re = /([\w:]+)="([^"]*)"/g;
  let m = re.exec(tag);
  while (m) {
    out[m[1].replace(/^\w+:/, "")] = unescapeXml(m[2]);
    m = re.exec(tag);
  }
  return out;
}

const openTag = (xml: string, name: string) =>
  new RegExp(`<(?:\\w+:)?${name}\\b[^>]*>`).exec(xml)?.[0];

const on = (v: string | undefined) => v === "1" || v === "true";

const num = (v: string | undefined) => {
  if (v == null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

function breaks(xml: string, name: "rowBreaks" | "colBreaks") {
  const block = new RegExp(
    `<(?:\\w+:)?${name}\\b[^>]*>([\\s\\S]*?)</(?:\\w+:)?${name}>`
  ).exec(xml)?.[1];
  if (!block) return undefined;
  const ids = (block.match(/<(?:\w+:)?brk\b[^>]*>/g) ?? [])
    .map((tag) => attrs(tag))
    .filter((a) => a.man == null || on(a.man))
    .map((a) => Number(a.id))
    .filter((id) => Number.isFinite(id) && id > 0);
  return ids.length ? [...new Set(ids)].sort((a, b) => a - b) : undefined;
}

function headerFooter(xml: string, setup: PageSetup) {
  const block =
    /<(?:\w+:)?headerFooter\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?headerFooter>)/.exec(
      xml
    );
  if (!block) return;
  const a = attrs(`<x ${block[1]}>`);
  if (on(a.differentOddEven)) setup.differentOddEven = true;
  if (on(a.differentFirst)) setup.differentFirst = true;
  if (a.scaleWithDoc != null && !on(a.scaleWithDoc)) setup.scaleWithDoc = false;
  if (a.alignWithMargins != null && !on(a.alignWithMargins)) {
    setup.alignWithMargins = false;
  }
  const body = block[2] ?? "";
  const part = (name: string) => {
    const text = new RegExp(
      `<(?:\\w+:)?${name}\\b[^>]*>([\\s\\S]*?)</(?:\\w+:)?${name}>`
    ).exec(body)?.[1];
    if (!text) return undefined;
    const hf = headerFooterFromXlsx(unescapeXml(text));
    return hf.left || hf.center || hf.right ? hf : undefined;
  };
  setup.header = part("oddHeader");
  setup.footer = part("oddFooter");
  setup.evenHeader = part("evenHeader");
  setup.evenFooter = part("evenFooter");
  setup.firstHeader = part("firstHeader");
  setup.firstFooter = part("firstFooter");
}

function compact(setup: PageSetup): PageSetup | undefined {
  const out: any = {};
  Object.entries(setup).forEach(([k, v]) => {
    if (v !== undefined) out[k] = v;
  });
  return Object.keys(out).length ? out : undefined;
}

/** The page layout elements of a worksheet part as a Page Setup. */
export function parseWorksheetPageSetup(xml: string): PageSetup | undefined {
  const setup: PageSetup = {};
  const m = attrs(openTag(xml, "pageMargins"));
  const margins: Record<string, number> = {};
  (["left", "right", "top", "bottom", "header", "footer"] as const).forEach(
    (k) => {
      const v = num(m[k]);
      if (v != null) margins[k] = v;
    }
  );
  // Excel's defaults are not stored
  const defaults: Record<string, number> = {
    left: 0.7,
    right: 0.7,
    top: 0.75,
    bottom: 0.75,
    header: 0.3,
    footer: 0.3,
  };
  if (
    Object.entries(margins).some(([k, v]) => Math.abs(v - defaults[k]) > 1e-6)
  ) {
    setup.margins = margins;
  }

  const p = attrs(openTag(xml, "pageSetup"));
  const paper = paperSizeFromExcel(Number(p.paperSize));
  if (paper && paper !== "letter") setup.paperSize = paper;
  if (p.orientation === "landscape") setup.orientation = "landscape";
  const scale = num(p.scale);
  if (scale != null && scale !== 100) setup.scale = scale;
  const fit = on(attrs(openTag(xml, "pageSetUpPr")).fitToPage);
  if (fit) {
    setup.fitToPage = true;
    setup.fitToWidth = num(p.fitToWidth) ?? 1;
    setup.fitToHeight = num(p.fitToHeight) ?? 1;
  }
  if (on(p.useFirstPageNumber) && num(p.firstPageNumber) != null) {
    setup.firstPageNumber = num(p.firstPageNumber);
  }
  const dpi = num(p.horizontalDpi);
  if (dpi != null && dpi > 0 && dpi < 10000) setup.printQuality = dpi;
  if (p.pageOrder === "overThenDown") setup.pageOrder = "overThenDown";
  if (on(p.blackAndWhite)) setup.blackAndWhite = true;
  if (on(p.draft)) setup.draft = true;
  if (p.cellComments === "atEnd" || p.cellComments === "asDisplayed") {
    setup.comments = p.cellComments;
  }
  if (p.errors === "blank" || p.errors === "dash" || p.errors === "NA") {
    setup.cellErrors = p.errors;
  }

  const o = attrs(openTag(xml, "printOptions"));
  if (on(o.gridLines)) setup.gridLines = true;
  if (on(o.headings)) setup.headings = true;
  if (on(o.horizontalCentered)) setup.centerHorizontally = true;
  if (on(o.verticalCentered)) setup.centerVertically = true;

  headerFooter(xml, setup);
  setup.rowBreaks = breaks(xml, "rowBreaks");
  setup.colBreaks = breaks(xml, "colBreaks");
  return compact(setup);
}

/** Sheet import feature: the worksheet's page layout -> sheet.pageSetup. */
export function readPageSetup(ctx: SheetImportContext) {
  const xml = ctx.files[ctx.sheetFile];
  if (!xml) return;
  const setup = parseWorksheetPageSetup(xml);
  if (setup) (ctx.sheet as any).pageSetup = setup;
}

/** Splits a defined name's text on commas outside quotes. */
function splitRefs(text: string) {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === "'") quoted = !quoted;
    if (ch === "," && !quoted) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  if (cur) out.push(cur);
  return out.map((s) => s.trim()).filter(Boolean);
}

/** `_xlnm.Print_Area` text -> ranges. */
export function parsePrintAreaName(text: string): PrintRange[] {
  return splitRefs(text)
    .map((ref) => parsePrintRange(ref))
    .filter((r): r is PrintRange => r != null);
}

/** `_xlnm.Print_Titles` text -> title rows and columns. */
export function parsePrintTitlesName(text: string) {
  const out: {
    rows?: [number, number];
    cols?: [number, number];
  } = {};
  splitRefs(text).forEach((ref) => {
    const bare = ref.replace(/^.*!/, "").replace(/\$/g, "");
    const r = parsePrintRange(ref);
    if (!r) return;
    if (/^\d+:\d+$/.test(bare)) out.rows = r.row;
    else if (/^[A-Za-z]+:[A-Za-z]+$/.test(bare)) out.cols = r.column;
  });
  return out;
}

/** Workbook import feature: print areas and print titles. */
export function readPrintNames(ctx: WorkbookImportContext) {
  const xml = ctx.files[workBookFile];
  if (!xml) return;
  const names = readDefinedNamesXml(xml).filter((n) =>
    /^_xlnm\.(Print_Area|Print_Titles)$/i.test(n.name)
  );
  if (names.length === 0) return;
  const order = (xml.match(/<(?:\w+:)?sheet\b[^>]*>/g) ?? []).map(
    (tag) => attrs(tag).name
  );
  names.forEach((n) => {
    if (n.localSheetId == null) return;
    const sheetName = order[n.localSheetId];
    const sheet: any = ctx.sheets.find((s) => s.name === sheetName);
    if (!sheet) return;
    const setup: PageSetup = { ...(sheet.pageSetup ?? {}) };
    if (/Print_Area$/i.test(n.name)) {
      const areas = parsePrintAreaName(n.text);
      if (areas.length) setup.printArea = areas;
    } else {
      const titles = parsePrintTitlesName(n.text);
      if (titles.rows) setup.printTitleRows = titles.rows;
      if (titles.cols) setup.printTitleColumns = titles.cols;
    }
    sheet.pageSetup = setup;
  });
}

// ---------------------------------------------------------------------------
// Export.

const hf = (text?: { left?: string; center?: string; right?: string }) =>
  headerFooterToXlsx(text) || null;

/** Sheet export feature: sheet.pageSetup -> the worksheet's page layout. */
export function writePageSetup(ctx: SheetExportContext) {
  const setup: PageSetup | undefined = ctx.sheet?.pageSetup;
  if (!setup) return;
  const ws: any = ctx.worksheet;
  const m = setup.margins ?? {};
  ws.pageSetup.margins = {
    left: m.left ?? 0.7,
    right: m.right ?? 0.7,
    top: m.top ?? 0.75,
    bottom: m.bottom ?? 0.75,
    header: m.header ?? 0.3,
    footer: m.footer ?? 0.3,
  };
  Object.assign(ws.pageSetup, {
    orientation: setup.orientation === "landscape" ? "landscape" : "portrait",
    paperSize: setup.paperSize
      ? getPaperSize(setup.paperSize).excel
      : undefined,
    scale: setup.scale ?? 100,
    fitToPage: !!setup.fitToPage,
    fitToWidth: setup.fitToPage ? setup.fitToWidth ?? 1 : undefined,
    fitToHeight: setup.fitToPage ? setup.fitToHeight ?? 1 : undefined,
    firstPageNumber: setup.firstPageNumber,
    pageOrder: setup.pageOrder ?? "downThenOver",
    blackAndWhite: !!setup.blackAndWhite,
    draft: !!setup.draft,
    cellComments: setup.comments === "atEnd" ? "atEnd" : "None",
    errors: setup.cellErrors ?? "displayed",
    showGridLines: !!setup.gridLines,
    showRowColHeaders: !!setup.headings,
    horizontalCentered: !!setup.centerHorizontally,
    verticalCentered: !!setup.centerVertically,
  });
  if (setup.printQuality) {
    ws.pageSetup.horizontalDpi = setup.printQuality;
    ws.pageSetup.verticalDpi = setup.printQuality;
  }
  ws.headerFooter = {
    differentFirst: !!setup.differentFirst,
    differentOddEven: !!setup.differentOddEven,
    oddHeader: hf(setup.header),
    oddFooter: hf(setup.footer),
    evenHeader: hf(setup.evenHeader),
    evenFooter: hf(setup.evenFooter),
    firstHeader: hf(setup.firstHeader),
    firstFooter: hf(setup.firstFooter),
  };
  (setup.rowBreaks ?? []).forEach((id) => {
    if (id > 0) ws.rowBreaks.push({ id, max: 16383, man: 1 });
  });

  // what ExcelJS cannot write
  const fixups: ((xml: string) => string)[] = [];
  const cols = (setup.colBreaks ?? []).filter((id) => id > 0);
  if (cols.length) {
    const block =
      `<colBreaks count="${cols.length}" manualBreakCount="${cols.length}">` +
      `${cols
        .map((id) => `<brk id="${id}" max="1048575" man="1"/>`)
        .join("")}` +
      `</colBreaks>`;
    fixups.push((xml) => insertAfterPageElements(xml, block));
  }
  if (setup.comments === "asDisplayed") {
    fixups.push((xml) =>
      xml.replace(
        /<pageSetup\b([^>]*?)\/>/,
        (tag, rest: string) =>
          `<pageSetup${rest.replace(
            /\s*cellComments="[^"]*"/,
            ""
          )} cellComments="asDisplayed"/>`
      )
    );
  }
  const hfAttrs: string[] = [];
  if (setup.scaleWithDoc === false) hfAttrs.push('scaleWithDoc="0"');
  if (setup.alignWithMargins === false) hfAttrs.push('alignWithMargins="0"');
  if (hfAttrs.length) {
    fixups.push((xml) =>
      /<headerFooter\b/.test(xml)
        ? xml.replace(/<headerFooter\b/, `<headerFooter ${hfAttrs.join(" ")}`)
        : insertAfterPageElements(
            xml,
            `<headerFooter ${hfAttrs.join(" ")}/>`,
            true
          )
    );
  }
  if (fixups.length) {
    const post = ctx.post as any;
    post.sheetXmlFixups = post.sheetXmlFixups ?? {};
    const list = post.sheetXmlFixups[ctx.worksheet.id] ?? [];
    post.sheetXmlFixups[ctx.worksheet.id] = [...list, ...fixups];
  }
}

/**
 * Inserts an element after the page layout elements of a worksheet part
 * (schema order: printOptions, pageMargins, pageSetup, headerFooter,
 * rowBreaks, colBreaks, ... drawing).
 */
export function insertAfterPageElements(
  xml: string,
  element: string,
  beforeBreaks = false
) {
  const anchors = beforeBreaks
    ? [/<pageSetup\b[^>]*\/>/, /<pageMargins\b[^>]*\/>/]
    : [
        /<\/rowBreaks>/,
        /<\/headerFooter>|<headerFooter\b[^>]*\/>/,
        /<pageSetup\b[^>]*\/>/,
        /<pageMargins\b[^>]*\/>/,
      ];
  for (let i = 0; i < anchors.length; i += 1) {
    const m = anchors[i].exec(xml);
    if (m) {
      const at = m.index + m[0].length;
      return xml.slice(0, at) + element + xml.slice(at);
    }
  }
  return xml.replace(/<\/sheetData>|<sheetData\/>/, (tag) => tag + element);
}

function quoteSheet(name: string) {
  return `'${name.replace(/'/g, "''")}'`;
}

/** The `_xlnm.Print_Area` / `_xlnm.Print_Titles` names of a sheet. */
export function printNamesFor(
  setup: PageSetup | undefined,
  sheetName: string,
  localSheetId: number
) {
  const out: { name: string; localSheetId: number; ranges: string[] }[] = [];
  if (!setup) return out;
  const q = quoteSheet(sheetName);
  if (setup.printArea?.length) {
    out.push({
      name: "_xlnm.Print_Area",
      localSheetId,
      ranges: setup.printArea.map((r) => `${q}!${printRangeToText(r)}`),
    });
  }
  const titles: string[] = [];
  if (setup.printTitleColumns) {
    const [a, b] = setup.printTitleColumns;
    titles.push(
      `${q}!${printRangeToText({ row: [0, 1048575], column: [a, b] })}`
    );
  }
  if (setup.printTitleRows) {
    const [a, b] = setup.printTitleRows;
    titles.push(
      `${q}!${printRangeToText({ row: [a, b], column: [0, 16383] })}`
    );
  }
  if (titles.length) {
    out.push({ name: "_xlnm.Print_Titles", localSheetId, ranges: titles });
  }
  return out;
}

/** Workbook export feature: print areas and titles as defined names. */
export function writePrintNames(ctx: WorkbookExportContext) {
  const names: { name: string; localSheetId: number; ranges: string[] }[] = [];
  const written = ctx.workbook.worksheets;
  ctx.sheets.forEach((sheet, i) => {
    const ws = ctx.worksheets[i];
    if (!ws || !sheet?.pageSetup) return;
    const index = written.indexOf(ws);
    if (index < 0) return;
    names.push(...printNamesFor(sheet.pageSetup, ws.name, index));
  });
  if (names.length === 0) return;
  const wb: any = ctx.workbook;
  // eslint-disable-next-line no-underscore-dangle
  const original = wb._definedNames;
  if (!original) return;
  // eslint-disable-next-line no-underscore-dangle
  wb._definedNames = Object.create(original, {
    model: {
      get: () => [...(original.model ?? []), ...names],
      set: (value: any) => {
        original.model = value;
      },
    },
  });
}
