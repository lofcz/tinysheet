/**
 * Write TinySheet chart objects into an xlsx package as native DrawingML
 * charts (xl/charts/chartN.xml + drawing anchors).
 *
 * exceljs (including the @protobi fork) has no API for creating charts; it
 * only round-trips chart parts it read from a file. So the workbook is first
 * written by exceljs and the chart parts are then added to the zip:
 * chart XML, a drawing (or extra anchors in the drawing exceljs wrote for
 * images), the relationships and the content-type overrides.
 */
import JSZip from "jszip";
import { Chart, ChartAnchorPoint, Sheet } from "@lofcz/tinysheet-core";
import { escapeXmlText as esc } from "./xml";
import { chartToXml, NS_A, NS_C, NS_R, SheetsCtx } from "./chartXml";
import {
  chartExRequires,
  chartExToXml,
  CT_CHARTEX,
  isChartExType,
  NS_CX,
  REL_CHARTEX,
} from "./chartEx";

export { chartToXml } from "./chartXml";
export { chartExToXml } from "./chartEx";

const NS_XDR =
  "http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing";
const REL_CHART =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart";
const REL_DRAWING =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing";
const CT_CHART =
  "application/vnd.openxmlformats-officedocument.drawingml.chart+xml";
const CT_DRAWING = "application/vnd.openxmlformats-officedocument.drawing+xml";
const EMU_PER_PX = 9525;
const NS_MC = "http://schemas.openxmlformats.org/markup-compatibility/2006";

// ---------------------------------------------------------------------------
// Anchors
// ---------------------------------------------------------------------------

type CellOffset = { index: number; offsetPx: number };

/** Sheet pixel offset (zoom 1, grid lines included) → cell + offset. */
export function pixelToCell(
  px: number,
  sizes: (i: number) => number,
  hidden: (i: number) => boolean,
  max = 20000
): CellOffset {
  let pos = 0;
  for (let i = 0; i < max; i += 1) {
    if (!hidden(i)) {
      const size = sizes(i) + 1;
      if (px < pos + size) {
        return {
          index: i,
          offsetPx: Math.max(0, Math.min(sizes(i), px - pos)),
        };
      }
      pos += size;
    }
  }
  return { index: max, offsetPx: 0 };
}

function sheetGeometry(sheet: Sheet) {
  const cfg = sheet.config || {};
  const colW = (c: number) =>
    Number(cfg.columnlen?.[c] ?? sheet.defaultColWidth ?? 73);
  const rowH = (r: number) =>
    Number(cfg.rowlen?.[r] ?? sheet.defaultRowHeight ?? 19);
  const colHidden = (c: number) => cfg.colhidden?.[c] != null;
  const rowHidden = (r: number) => cfg.rowhidden?.[r] != null;
  const start = (
    i: number,
    size: (k: number) => number,
    hidden: (k: number) => boolean
  ) => {
    let px = 0;
    for (let k = 0; k < i; k += 1) if (!hidden(k)) px += size(k) + 1;
    return px;
  };
  return {
    colW,
    rowH,
    colHidden,
    rowHidden,
    colLeft: (c: number) => start(c, colW, colHidden),
    rowTop: (r: number) => start(r, rowH, rowHidden),
  };
}

type CellAnchor = {
  from: { col: CellOffset; row: CellOffset };
  to: { col: CellOffset; row: CellOffset };
};

/**
 * Cell anchor of a chart: its own anchor cells when it has them (move and
 * size with cells / move only), else the cells under its pixel box.
 */
export function anchorFor(sheet: Sheet, chart: Chart): CellAnchor {
  const g = sheetGeometry(sheet);
  const fromPixels = (left: number, top: number, w: number, h: number) => ({
    from: {
      col: pixelToCell(left, g.colW, g.colHidden),
      row: pixelToCell(top, g.rowH, g.rowHidden),
    },
    to: {
      col: pixelToCell(left + w, g.colW, g.colHidden),
      row: pixelToCell(top + h, g.rowH, g.rowHidden),
    },
  });
  const placement = chart.placement ?? "twoCell";
  const a = chart.anchor;
  if (!a || placement === "absolute")
    return fromPixels(chart.left, chart.top, chart.width, chart.height);
  const point = (p: ChartAnchorPoint) => ({
    col: {
      index: p.col,
      offsetPx: Math.max(0, Math.min(g.colW(p.col), p.colOff)),
    },
    row: {
      index: p.row,
      offsetPx: Math.max(0, Math.min(g.rowH(p.row), p.rowOff)),
    },
  });
  const from = point(a.from);
  if (placement === "twoCell") return { from, to: point(a.to) };
  // move but don't size: the end follows the stored size
  const left = g.colLeft(a.from.col) + from.col.offsetPx;
  const top = g.rowTop(a.from.row) + from.row.offsetPx;
  const box = fromPixels(left, top, chart.width, chart.height);
  return { from, to: box.to };
}

const EDIT_AS = {
  twoCell: "twoCell",
  oneCell: "oneCell",
  absolute: "absolute",
};

function anchorXml(sheet: Sheet, chart: Chart, rid: string, shapeId: number) {
  const a = anchorFor(sheet, chart);
  const cell = (tag: string, c: CellOffset, r: CellOffset) =>
    `<xdr:${tag}><xdr:col>${c.index}</xdr:col><xdr:colOff>${Math.round(
      c.offsetPx * EMU_PER_PX
    )}</xdr:colOff><xdr:row>${r.index}</xdr:row><xdr:rowOff>${Math.round(
      r.offsetPx * EMU_PER_PX
    )}</xdr:rowOff></xdr:${tag}>`;
  const name = esc(chart.title?.trim() || `Chart ${shapeId}`);
  const ex = isChartExType(chart.type);
  const nv = `<xdr:nvGraphicFramePr><xdr:cNvPr id="${shapeId}" name="${name}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>`;
  let frame: string;
  if (ex) {
    // chartex parts need Excel 2016+; older readers get a text box
    const req = chartExRequires(chart.type);
    frame =
      `<mc:AlternateContent xmlns:mc="${NS_MC}"><mc:Choice xmlns:${req.prefix}="${req.ns}" Requires="${req.prefix}">` +
      `<xdr:graphicFrame macro="">${nv}<a:graphic><a:graphicData uri="${NS_CX}"><cx:chart xmlns:cx="${NS_CX}" xmlns:r="${NS_R}" r:id="${rid}"/></a:graphicData></a:graphic></xdr:graphicFrame>` +
      `</mc:Choice><mc:Fallback><xdr:sp macro="" textlink=""><xdr:nvSpPr><xdr:cNvPr id="${shapeId}" name="${name}"/><xdr:cNvSpPr><a:spLocks noTextEdit="1"/></xdr:cNvSpPr></xdr:nvSpPr>` +
      `<xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="4572000" cy="2743200"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:prstClr val="white"/></a:solidFill><a:ln w="1"><a:solidFill><a:prstClr val="green"/></a:solidFill></a:ln></xdr:spPr>` +
      `<xdr:txBody><a:bodyPr vertOverflow="clip" horzOverflow="clip"/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US" sz="1100"/><a:t>This chart isn't available in your version of Excel.</a:t></a:r></a:p></xdr:txBody></xdr:sp></mc:Fallback></mc:AlternateContent>`;
  } else {
    frame =
      `<xdr:graphicFrame macro="">${nv}` +
      `<a:graphic><a:graphicData uri="${NS_C}"><c:chart xmlns:c="${NS_C}" xmlns:r="${NS_R}" r:id="${rid}"/></a:graphicData></a:graphic>` +
      `</xdr:graphicFrame>`;
  }
  return `<xdr:twoCellAnchor editAs="${
    EDIT_AS[chart.placement ?? "twoCell"]
  }">${cell("from", a.from.col, a.from.row)}${cell(
    "to",
    a.to.col,
    a.to.row
  )}${frame}<xdr:clientData/></xdr:twoCellAnchor>`;
}
// ---------------------------------------------------------------------------
// Package plumbing
// ---------------------------------------------------------------------------

function attr(tag: string, name: string) {
  const m = tag.match(new RegExp(`\\s${name}="([^"]*)"`));
  return m ? m[1] : undefined;
}

function decodeAttr(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function relsOf(xml: string) {
  const out: { id: string; target: string; type: string }[] = [];
  (xml.match(/<Relationship\b[^>]*>/g) || []).forEach((tag) => {
    out.push({
      id: attr(tag, "Id") ?? "",
      target: attr(tag, "Target") ?? "",
      type: attr(tag, "Type") ?? "",
    });
  });
  return out;
}

function nextRid(xml: string) {
  let max = 0;
  relsOf(xml).forEach((r) => {
    const n = parseInt(r.id.replace(/\D/g, ""), 10);
    if (Number.isFinite(n) && n > max) max = n;
  });
  return `rId${max + 1}`;
}

function addRel(xml: string | null, id: string, type: string, target: string) {
  const base =
    xml ??
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
  return base.replace(
    "</Relationships>",
    `<Relationship Id="${id}" Type="${type}" Target="${target}"/></Relationships>`
  );
}

function resolvePath(from: string, target: string) {
  if (target.startsWith("/")) return target.slice(1);
  const parts = from.split("/");
  parts.pop();
  target.split("/").forEach((p) => {
    if (p === "..") parts.pop();
    else if (p !== ".") parts.push(p);
  });
  return parts.join("/");
}

function relsPathFor(part: string) {
  const i = part.lastIndexOf("/");
  return `${part.slice(0, i)}/_rels/${part.slice(i + 1)}.rels`;
}

const AFTER_DRAWING = [
  "legacyDrawing",
  "legacyDrawingHF",
  "drawingHF",
  "picture",
  "oleObjects",
  "controls",
  "webPublishItems",
  "tableParts",
  "extLst",
];

function insertDrawingElement(sheetXml: string, rid: string) {
  let xml = sheetXml;
  const rootTag = xml.match(/<worksheet\b[^>]*>/);
  if (rootTag && !/xmlns:r=/.test(rootTag[0])) {
    xml = xml.replace(
      rootTag[0],
      rootTag[0].replace("<worksheet", `<worksheet xmlns:r="${NS_R}"`)
    );
  }
  const el = `<drawing r:id="${rid}"/>`;
  for (let i = 0; i < AFTER_DRAWING.length; i += 1) {
    const idx = xml.search(new RegExp(`<${AFTER_DRAWING[i]}[\\s/>]`));
    if (idx >= 0) return xml.slice(0, idx) + el + xml.slice(idx);
  }
  return xml.replace("</worksheet>", `${el}</worksheet>`);
}

function addOverride(types: string, part: string, contentType: string) {
  if (types.includes(`PartName="/${part}"`)) return types;
  return types.replace(
    "</Types>",
    `<Override PartName="/${part}" ContentType="${contentType}"/></Types>`
  );
}

/**
 * Add native chart parts for every sheet's `charts` to an xlsx buffer written
 * by exceljs. Sheets are matched by name.
 */
export async function addChartsToXlsx(
  buffer: ArrayBuffer | Uint8Array,
  sheets: Sheet[]
): Promise<ArrayBuffer | Uint8Array> {
  if (!sheets.some((s) => s.charts?.length)) return buffer;
  const zip = await JSZip.loadAsync(buffer);
  if (!(await addChartsToZip(zip, sheets))) return buffer;
  return zip.generateAsync({
    type: buffer instanceof Uint8Array ? "uint8array" : "arraybuffer",
    compression: "DEFLATE",
  });
}

/**
 * Add the chart parts to an opened package (the "charts" zip
 * post-processor). `sheetForName` maps a written sheet name to its sheet
 * (names can differ from `sheet.name` once made valid for Excel); by
 * default sheets are matched by name. Returns whether anything was added.
 */
export async function addChartsToZip(
  zip: JSZip,
  sheets: Sheet[],
  sheetForName?: (name: string) => Sheet | undefined
): Promise<boolean> {
  if (!sheets.some((s) => s.charts?.length)) return false;
  const ctx: SheetsCtx = { luckysheetfile: sheets };
  const workbookXml = await zip.file("xl/workbook.xml")?.async("string");
  const workbookRels = await zip
    .file("xl/_rels/workbook.xml.rels")
    ?.async("string");
  let types = await zip.file("[Content_Types].xml")?.async("string");
  if (!workbookXml || !workbookRels || !types) return false;
  const wbRels = relsOf(workbookRels);

  const existing = Object.keys(zip.files);
  let chartNo = existing.filter((f) =>
    /^xl\/charts\/chart\d+\.xml$/.test(f)
  ).length;
  let chartExNo = existing.filter((f) =>
    /^xl\/charts\/chartEx\d+\.xml$/.test(f)
  ).length;
  let drawingNo = existing.filter((f) =>
    /^xl\/drawings\/drawing\d+\.xml$/.test(f)
  ).length;

  const sheetTags = workbookXml.match(/<sheet\b[^>]*>/g) || [];
  // Parts are read and rewritten one sheet at a time on purpose: every
  // sheet may add to the same content types and numbering.
  /* eslint-disable no-await-in-loop */
  for (let s = 0; s < sheetTags.length; s += 1) {
    const tag = sheetTags[s];
    const name = decodeAttr(attr(tag, "name") ?? "");
    const rid = attr(tag, "r:id");
    const sheet = sheetForName?.(name) ?? sheets.find((x) => x.name === name);
    const rel = wbRels.find((r) => r.id === rid);
    if (!sheet?.charts?.length || !rel) continue;
    const sheetPath = resolvePath("xl/workbook.xml", rel.target);
    const sheetRelsPath = relsPathFor(sheetPath);
    let sheetXml = await zip.file(sheetPath)?.async("string");
    if (!sheetXml) continue;
    let sheetRels = (await zip.file(sheetRelsPath)?.async("string")) ?? null;

    // Reuse the drawing exceljs wrote for images, or create one.
    let drawingPath: string | undefined;
    const drawingTag = sheetXml.match(/<drawing\b[^>]*>/);
    if (drawingTag && sheetRels) {
      const drawingRid = attr(drawingTag[0], "r:id");
      const drawingRel = relsOf(sheetRels).find((r) => r.id === drawingRid);
      if (drawingRel) drawingPath = resolvePath(sheetPath, drawingRel.target);
    }
    let drawingXml = drawingPath
      ? await zip.file(drawingPath)?.async("string")
      : undefined;
    if (!drawingPath || !drawingXml) {
      drawingNo += 1;
      drawingPath = `xl/drawings/drawing${drawingNo}.xml`;
      drawingXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<xdr:wsDr xmlns:xdr="${NS_XDR}" xmlns:a="${NS_A}"></xdr:wsDr>`;
      const newRid = nextRid(sheetRels ?? "");
      sheetRels = addRel(
        sheetRels,
        newRid,
        REL_DRAWING,
        `../drawings/drawing${drawingNo}.xml`
      );
      sheetXml = insertDrawingElement(sheetXml, newRid);
      types = addOverride(types, drawingPath, CT_DRAWING);
    }
    const drawingRelsPath = relsPathFor(drawingPath);
    let drawingRels =
      (await zip.file(drawingRelsPath)?.async("string")) ?? null;

    let anchors = "";
    for (let i = 0; i < sheet.charts.length; i += 1) {
      const chart = sheet.charts[i];
      const ex = isChartExType(chart.type);
      let file: string;
      if (ex) {
        chartExNo += 1;
        file = `chartEx${chartExNo}.xml`;
        zip.file(`xl/charts/${file}`, chartExToXml(ctx, chart));
        types = addOverride(types, `xl/charts/${file}`, CT_CHARTEX);
      } else {
        chartNo += 1;
        file = `chart${chartNo}.xml`;
        zip.file(`xl/charts/${file}`, chartToXml(ctx, chart));
        types = addOverride(types, `xl/charts/${file}`, CT_CHART);
      }
      const chartRid = nextRid(drawingRels ?? "");
      drawingRels = addRel(
        drawingRels,
        chartRid,
        ex ? REL_CHARTEX : REL_CHART,
        `../charts/${file}`
      );
      anchors += anchorXml(sheet, chart, chartRid, 1000 + i);
    }
    drawingXml = drawingXml.replace(
      /<\/xdr:wsDr>\s*$/,
      `${anchors}</xdr:wsDr>`
    );
    zip.file(drawingPath, drawingXml);
    zip.file(drawingRelsPath, drawingRels!);
    zip.file(sheetPath, sheetXml);
    if (sheetRels) zip.file(sheetRelsPath, sheetRels);
  }
  /* eslint-enable no-await-in-loop */
  zip.file("[Content_Types].xml", types);
  return true;
}
