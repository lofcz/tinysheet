/**
 * Table details ExcelJS cannot write, added to the xlsx zip after it was
 * written (see postProcess.ts `xlsxPostProcessors`):
 *
 * - the table's filter state: `<autoFilter>` with one `<filterColumn>` per
 *   filtered column (value lists, custom criteria, top 10, above/below
 *   average and date periods; colour filters are not written), or no
 *   `<autoFilter>` when the filter buttons are off;
 * - calculated columns (`<calculatedColumnFormula>`) and custom total
 *   formulas (`<totalsRowFormula>`);
 * - slicers: a slicer cache per slicer (`xl/slicerCaches/`, an x15
 *   `tableSlicerCache` pointing at the table column), a slicers part per
 *   sheet (`xl/slicers/`), the drawing anchor of each slicer (with a text
 *   box fallback for older readers), the workbook and sheet `extLst`
 *   entries and the hidden `Slicer_…` defined names Excel keeps.
 *
 * A slicer's selection is the table's filter on its column, so Excel shows
 * the same selection. Not written: "hide items with no data" (TinySheet
 * only) and slicers of tables ExcelJS could not write.
 */
import type JSZip from "jszip";
import { qualifyStructuredReferences } from "../common/structuredRefs";
import { toExcelFormula } from "../common/formulaText";
import { pixelToCell } from "../chart/exportXlsx";
import { xmlEscape } from "./postProcess";
import type { XlsxPostProcessInfo } from "./postProcess";

const EMU_PER_PX = 9525;

const NS_MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const NS_R =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const NS_X14 = "http://schemas.microsoft.com/office/spreadsheetml/2009/9/main";
const NS_X15 = "http://schemas.microsoft.com/office/spreadsheetml/2010/11/main";
const NS_MC = "http://schemas.openxmlformats.org/markup-compatibility/2006";
const NS_XDR =
  "http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing";
const NS_A = "http://schemas.openxmlformats.org/drawingml/2006/main";
const NS_SLE = "http://schemas.microsoft.com/office/drawing/2010/slicer";
const NS_SLE15 = "http://schemas.microsoft.com/office/drawing/2012/slicer";

const REL_SLICER =
  "http://schemas.microsoft.com/office/2007/relationships/slicer";
const REL_SLICER_CACHE =
  "http://schemas.microsoft.com/office/2007/relationships/slicerCache";
const REL_DRAWING =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing";
const CT_SLICER = "application/vnd.ms-excel.slicer+xml";
const CT_SLICER_CACHE = "application/vnd.ms-excel.slicerCache+xml";
const CT_DRAWING = "application/vnd.openxmlformats-officedocument.drawing+xml";

/** Workbook extLst entry of table slicer caches. */
const EXT_WB_TABLE_SLICER_CACHES = "{46BE6895-7355-4a93-B00E-2C351335B9C9}";
/** Worksheet extLst entry of table slicers. */
const EXT_WS_TABLE_SLICERS = "{3A4CF648-6AED-40f4-86FF-DC5316D8AED3}";
/** Slicer cache extLst entry of a table slicer cache. */
const EXT_TABLE_SLICER_CACHE = "{2F2917AC-EB37-4324-AD4E-5DD8C200BD13}";

export type TableSlicerExport = {
  /** Slicer (cache) name, e.g. `Slicer_Region`. */
  name: string;
  caption: string;
  showCaption: boolean;
  /** 0-based column of the table. */
  column: number;
  columnName: string;
  columnCount: number;
  buttonHeight: number;
  style: string;
  sortOrder: "ascending" | "descending";
  noDataLast: boolean;
  /** Drawing anchor (0-based cells, px offsets at 100%) and size (px). */
  from: { col: number; colOffPx: number; row: number; rowOffPx: number };
  to: { col: number; colOffPx: number; row: number; rowOffPx: number };
  width: number;
  height: number;
};

export type TableZipExport = {
  worksheetId: number;
  name: string;
  /** Range of the header row through the last data row, e.g. `A1:C6`. */
  filterRef: string | null;
  filterColumns: string[];
  calculated: Record<number, string>;
  totals: Record<number, string>;
  slicers: TableSlicerExport[];
};

/* ------------------------------------------------------------------------ */
/* Filters                                                                  */
/* ------------------------------------------------------------------------ */

const OPERATORS: Record<string, [string, (v: string) => string]> = {
  equals: ["equal", (v) => v],
  notEquals: ["notEqual", (v) => v],
  greaterThan: ["greaterThan", (v) => v],
  greaterOrEqual: ["greaterThanOrEqual", (v) => v],
  lessThan: ["lessThan", (v) => v],
  lessOrEqual: ["lessThanOrEqual", (v) => v],
  beginsWith: ["equal", (v) => `${v}*`],
  notBeginsWith: ["notEqual", (v) => `${v}*`],
  endsWith: ["equal", (v) => `*${v}`],
  notEndsWith: ["notEqual", (v) => `*${v}`],
  contains: ["equal", (v) => `*${v}*`],
  notContains: ["notEqual", (v) => `*${v}*`],
};

function customFilter(op: string, value: string) {
  const [operator, wrap] = OPERATORS[op] ?? OPERATORS.equals;
  const opAttr = operator === "equal" ? "" : ` operator="${operator}"`;
  return `<customFilter${opAttr} val="${xmlEscape(
    wrap(String(value ?? ""))
  )}"/>`;
}

/**
 * The `<filterColumn>` of a table column filter, or null when it cannot be
 * written. `texts` are the display texts of the column's data cells.
 */
export function filterColumnXml(
  colId: number,
  condition: any,
  texts: string[]
): string | null {
  if (!condition?.type) return null;
  let body: string | null = null;
  switch (condition.type) {
    case "values": {
      const hidden = new Set<string>(condition.hidden ?? []);
      const shown = Array.from(new Set(texts)).filter((t) => !hidden.has(t));
      const blank = shown.includes("") ? ' blank="1"' : "";
      const items = shown
        .filter((t) => t !== "")
        .map((t) => `<filter val="${xmlEscape(t)}"/>`)
        .join("");
      body = `<filters${blank}>${items}</filters>`;
      break;
    }
    case "custom": {
      const two =
        condition.op2 != null &&
        condition.value2 != null &&
        `${condition.value2}` !== "";
      const and = two && condition.join !== "or" ? ' and="1"' : "";
      body = `<customFilters${and}>${customFilter(
        condition.op1,
        condition.value1
      )}${
        two ? customFilter(condition.op2, condition.value2) : ""
      }</customFilters>`;
      break;
    }
    case "top10": {
      const top = condition.bottom ? ' top="0"' : "";
      const percent = condition.percent ? ' percent="1"' : "";
      body = `<top10${top}${percent} val="${Number(condition.count) || 0}"/>`;
      break;
    }
    case "average":
      body = `<dynamicFilter type="${
        condition.below ? "belowAverage" : "aboveAverage"
      }"/>`;
      break;
    case "datePeriod":
      body = `<dynamicFilter type="${xmlEscape(String(condition.period))}"/>`;
      break;
    default:
      return null;
  }
  return `<filterColumn colId="${colId}">${body}</filterColumn>`;
}

/* ------------------------------------------------------------------------ */
/* Zip helpers                                                              */
/* ------------------------------------------------------------------------ */

function attr(tag: string, name: string) {
  const m = tag.match(new RegExp(`\\s${name}="([^"]*)"`));
  return m ? m[1] : undefined;
}

function relsOf(xml: string) {
  return (xml.match(/<Relationship\b[^>]*>/g) || []).map((tag) => ({
    id: attr(tag, "Id") ?? "",
    target: attr(tag, "Target") ?? "",
    type: attr(tag, "Type") ?? "",
  }));
}

function nextRid(xml: string) {
  let max = 0;
  relsOf(xml).forEach((r) => {
    const n = parseInt(r.id.replace(/\D/g, ""), 10);
    if (Number.isFinite(n) && n > max) max = n;
  });
  return `rId${max + 1}`;
}

const EMPTY_RELS =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';

function addRel(xml: string | null, type: string, target: string) {
  const base = xml ?? EMPTY_RELS;
  const id = nextRid(base);
  return {
    id,
    xml: base.replace(
      "</Relationships>",
      `<Relationship Id="${id}" Type="${type}" Target="${target}"/></Relationships>`
    ),
  };
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

function addOverride(types: string, part: string, contentType: string) {
  if (types.includes(`PartName="/${part}"`)) return types;
  return types.replace(
    "</Types>",
    `<Override PartName="/${part}" ContentType="${contentType}"/></Types>`
  );
}

async function read(zip: JSZip, path: string) {
  return (await zip.file(path)?.async("string")) ?? null;
}

/** Adds an `<ext>` to the root's `<extLst>` (created before `</root>`). */
function addExt(xml: string, root: string, ext: string) {
  const close = `</${root}>`;
  const lst = xml.lastIndexOf("</extLst>");
  if (lst >= 0 && lst > xml.lastIndexOf("<sheetData")) {
    return xml.slice(0, lst) + ext + xml.slice(lst);
  }
  return xml.replace(close, `<extLst>${ext}</extLst>${close}`);
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
  const el = `<drawing r:id="${rid}"/>`;
  for (let i = 0; i < AFTER_DRAWING.length; i += 1) {
    const idx = sheetXml.search(new RegExp(`<${AFTER_DRAWING[i]}[\\s/>]`));
    if (idx >= 0) return sheetXml.slice(0, idx) + el + sheetXml.slice(idx);
  }
  return sheetXml.replace("</worksheet>", `${el}</worksheet>`);
}

function ensureRootNs(xml: string, root: string, prefix: string, ns: string) {
  const tag = xml.match(new RegExp(`<${root}\\b[^>]*>`));
  if (!tag || tag[0].includes(`xmlns:${prefix}=`)) return xml;
  return xml.replace(
    tag[0],
    tag[0].replace(`<${root}`, `<${root} xmlns:${prefix}="${ns}"`)
  );
}

/* ------------------------------------------------------------------------ */
/* Table parts                                                              */
/* ------------------------------------------------------------------------ */

/** The table part written for table `name`, with its path and xml. */
async function findTablePart(zip: JSZip, name: string) {
  const files = zip.file(/^xl\/tables\/table\d+\.xml$/);
  for (let i = 0; i < files.length; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const xml = await files[i].async("string");
    const open = /<table\b[^>]*>/.exec(xml)?.[0] ?? "";
    if (attr(open, "displayName") === xmlEscape(name)) {
      return { path: files[i].name, xml };
    }
  }
  return null;
}

function patchTableColumns(
  xml: string,
  calculated: Record<number, string>,
  totals: Record<number, string>
) {
  let index = -1;
  return xml.replace(
    /<tableColumn\b([^>]*?)(\/>|>([\s\S]*?)<\/tableColumn>)/g,
    (whole, attrs: string, _end: string, inner?: string) => {
      index += 1;
      const calc = calculated[index];
      const total = totals[index];
      if (calc == null && total == null) return whole;
      let body = inner ?? "";
      body = body
        .replace(
          /<calculatedColumnFormula>[\s\S]*?<\/calculatedColumnFormula>/,
          ""
        )
        .replace(/<totalsRowFormula>[\s\S]*?<\/totalsRowFormula>/, "");
      const head =
        (calc != null
          ? `<calculatedColumnFormula>${xmlEscape(
              calc
            )}</calculatedColumnFormula>`
          : "") +
        (total != null
          ? `<totalsRowFormula>${xmlEscape(total)}</totalsRowFormula>`
          : "");
      return `<tableColumn${attrs}>${head}${body}</tableColumn>`;
    }
  );
}

function patchAutoFilter(xml: string, t: TableZipExport) {
  const re = /<autoFilter\b[^>]*?(\/>|>[\s\S]*?<\/autoFilter>)/;
  if (t.filterRef == null) return xml.replace(re, "");
  const el = `<autoFilter ref="${t.filterRef}"${
    t.filterColumns.length ? `>${t.filterColumns.join("")}</autoFilter>` : "/>"
  }`;
  if (re.test(xml)) return xml.replace(re, el);
  return xml.replace(/(<table\b[^>]*>)/, `$1${el}`);
}

/* ------------------------------------------------------------------------ */
/* Slicers                                                                  */
/* ------------------------------------------------------------------------ */

function slicerCacheXml(s: TableSlicerExport, tableId: string, colId: string) {
  const cross = s.noDataLast ? "" : ' crossFilter="showItemsWithNoData"';
  const sort = s.sortOrder === "descending" ? ' sortOrder="descending"' : "";
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<slicerCacheDefinition xmlns="${NS_X14}" xmlns:mc="${NS_MC}" mc:Ignorable="x" xmlns:x="${NS_MAIN}" name="${xmlEscape(
      s.name
    )}" sourceName="${xmlEscape(s.columnName)}">` +
    `<extLst><x:ext uri="${EXT_TABLE_SLICER_CACHE}" xmlns:x15="${NS_X15}">` +
    `<x15:tableSlicerCache tableId="${tableId}" column="${colId}"${sort}${cross}/>` +
    `</x:ext></extLst></slicerCacheDefinition>`
  );
}

function slicerXml(s: TableSlicerExport, shapeName: string) {
  const rowHeight = Math.round(s.buttonHeight * EMU_PER_PX);
  return (
    `<slicer name="${xmlEscape(shapeName)}" cache="${xmlEscape(
      s.name
    )}" caption="${xmlEscape(s.caption)}"` +
    `${s.columnCount > 1 ? ` columnCount="${s.columnCount}"` : ""}` +
    `${s.showCaption ? "" : ' showCaption="0"'}` +
    ` style="${xmlEscape(s.style)}" rowHeight="${rowHeight}"/>`
  );
}

function anchorXml(s: TableSlicerExport, shapeName: string, shapeId: number) {
  const cell = (tag: string, p: TableSlicerExport["from"]) =>
    `<xdr:${tag}><xdr:col>${p.col}</xdr:col><xdr:colOff>${Math.round(
      p.colOffPx * EMU_PER_PX
    )}</xdr:colOff><xdr:row>${p.row}</xdr:row><xdr:rowOff>${Math.round(
      p.rowOffPx * EMU_PER_PX
    )}</xdr:rowOff></xdr:${tag}>`;
  const cx = Math.round(s.width * EMU_PER_PX);
  const cy = Math.round(s.height * EMU_PER_PX);
  const name = xmlEscape(shapeName);
  return (
    `<xdr:twoCellAnchor editAs="oneCell">${cell("from", s.from)}${cell(
      "to",
      s.to
    )}` +
    `<mc:AlternateContent xmlns:mc="${NS_MC}"><mc:Choice xmlns:sle15="${NS_SLE15}" Requires="sle15">` +
    `<xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${shapeId}" name="${name}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr>` +
    `<xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>` +
    `<a:graphic><a:graphicData uri="${NS_SLE}"><sle:slicer xmlns:sle="${NS_SLE}" name="${name}"/></a:graphicData></a:graphic>` +
    `</xdr:graphicFrame></mc:Choice><mc:Fallback>` +
    `<xdr:sp macro="" textlink=""><xdr:nvSpPr><xdr:cNvPr id="0" name=""/><xdr:cNvSpPr><a:spLocks noTextEdit="1"/></xdr:cNvSpPr></xdr:nvSpPr>` +
    `<xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom>` +
    `<a:solidFill><a:prstClr val="white"/></a:solidFill><a:ln w="1"><a:solidFill><a:prstClr val="green"/></a:solidFill></a:ln></xdr:spPr>` +
    `<xdr:txBody><a:bodyPr vertOverflow="clip" horzOverflow="clip"/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US" sz="1100"/>` +
    `<a:t>This shape represents a table slicer. Table slicers are supported in Excel or later versions of Excel.</a:t></a:r></a:p></xdr:txBody></xdr:sp>` +
    `</mc:Fallback></mc:AlternateContent><xdr:clientData/></xdr:twoCellAnchor>`
  );
}

/** Adds the drawing anchors of `anchors` to the sheet's drawing part. */
async function addDrawingAnchors(
  zip: JSZip,
  sheetPath: string,
  anchors: (shapeIdBase: number) => string
) {
  let types = (await read(zip, "[Content_Types].xml"))!;
  const sheetRelsPath = relsPathFor(sheetPath);
  let sheetRels = await read(zip, sheetRelsPath);
  let sheetXml = (await read(zip, sheetPath))!;
  let drawingPath: string | undefined;
  const drawingTag = sheetXml.match(/<drawing\b[^>]*>/);
  if (drawingTag && sheetRels) {
    const rid = attr(drawingTag[0], "r:id");
    const rel = relsOf(sheetRels).find((r) => r.id === rid);
    if (rel) drawingPath = resolvePath(sheetPath, rel.target);
  }
  let drawingXml = drawingPath ? await read(zip, drawingPath) : null;
  if (!drawingPath || !drawingXml) {
    let n = 1;
    while (zip.file(`xl/drawings/drawing${n}.xml`)) n += 1;
    drawingPath = `xl/drawings/drawing${n}.xml`;
    drawingXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<xdr:wsDr xmlns:xdr="${NS_XDR}" xmlns:a="${NS_A}"></xdr:wsDr>`;
    const added = addRel(sheetRels, REL_DRAWING, `../drawings/drawing${n}.xml`);
    sheetRels = added.xml;
    sheetXml = insertDrawingElement(sheetXml, added.id);
    types = addOverride(types, drawingPath, CT_DRAWING);
  }
  drawingXml = ensureRootNs(drawingXml, "xdr:wsDr", "a", NS_A);
  const ids = (drawingXml.match(/<xdr:cNvPr\b[^>]*\sid="(\d+)"/g) || []).map(
    (m) => Number(/id="(\d+)"/.exec(m)?.[1] ?? 0)
  );
  const base = Math.max(1, ...ids) + 1;
  drawingXml = drawingXml.replace("</xdr:wsDr>", `${anchors(base)}</xdr:wsDr>`);
  zip.file(drawingPath, drawingXml);
  zip.file(sheetPath, sheetXml);
  if (sheetRels) zip.file(sheetRelsPath, sheetRels);
  zip.file("[Content_Types].xml", types);
}

async function writeSlicers(
  zip: JSZip,
  sheetPath: string,
  entries: { table: TableZipExport; tableId: string; colIds: string[] }[]
) {
  const slicers = entries.flatMap((e) =>
    e.table.slicers.map((s) => ({ ...e, slicer: s }))
  );
  if (slicers.length === 0) return;
  let types = (await read(zip, "[Content_Types].xml"))!;
  let wbRels = (await read(zip, "xl/_rels/workbook.xml.rels"))!;
  let wbXml = (await read(zip, "xl/workbook.xml"))!;

  // slicer caches (one per slicer) and the workbook's hidden names
  const cacheRids: string[] = [];
  const names: string[] = [];
  slicers.forEach(({ slicer, tableId, colIds }) => {
    let n = 1;
    while (zip.file(`xl/slicerCaches/slicerCache${n}.xml`)) n += 1;
    const path = `xl/slicerCaches/slicerCache${n}.xml`;
    zip.file(
      path,
      slicerCacheXml(slicer, tableId, colIds[slicer.column] ?? "1")
    );
    types = addOverride(types, path, CT_SLICER_CACHE);
    const added = addRel(
      wbRels,
      REL_SLICER_CACHE,
      `slicerCaches/slicerCache${n}.xml`
    );
    wbRels = added.xml;
    cacheRids.push(added.id);
    names.push(
      `<definedName name="${xmlEscape(slicer.name)}">#N/A</definedName>`
    );
  });
  wbXml = ensureRootNs(wbXml, "workbook", "r", NS_R);
  if (/<definedNames\b[^>]*\/>/.test(wbXml)) {
    wbXml = wbXml.replace(
      /<definedNames\b[^>]*\/>/,
      `<definedNames>${names.join("")}</definedNames>`
    );
  } else if (wbXml.includes("</definedNames>")) {
    wbXml = wbXml.replace(
      "</definedNames>",
      `${names.join("")}</definedNames>`
    );
  } else {
    wbXml = wbXml.replace(
      "</sheets>",
      `</sheets><definedNames>${names.join("")}</definedNames>`
    );
  }
  const caches = cacheRids
    .map((id) => `<x14:slicerCache r:id="${id}"/>`)
    .join("");
  const existing = wbXml.indexOf(`uri="${EXT_WB_TABLE_SLICER_CACHES}"`);
  if (existing >= 0) {
    wbXml = wbXml.replace(
      /<\/x15:slicerCaches>/,
      `${caches}</x15:slicerCaches>`
    );
  } else {
    wbXml = addExt(
      wbXml,
      "workbook",
      `<ext uri="${EXT_WB_TABLE_SLICER_CACHES}" xmlns:x15="${NS_X15}"><x15:slicerCaches xmlns:x14="${NS_X14}">${caches}</x15:slicerCaches></ext>`
    );
  }

  // the sheet's slicers part
  let m = 1;
  while (zip.file(`xl/slicers/slicer${m}.xml`)) m += 1;
  const slicerPath = `xl/slicers/slicer${m}.xml`;
  const used = new Set<string>();
  const shapeNames = slicers.map(({ slicer }) => {
    let base = slicer.caption || slicer.columnName;
    if (!base) base = slicer.name;
    let name = base;
    for (let i = 1; used.has(name.toUpperCase()); i += 1) name = `${base} ${i}`;
    used.add(name.toUpperCase());
    return name;
  });
  zip.file(
    slicerPath,
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<slicers xmlns="${NS_X14}" xmlns:mc="${NS_MC}" mc:Ignorable="x" xmlns:x="${NS_MAIN}">${slicers
      .map(({ slicer }, i) => slicerXml(slicer, shapeNames[i]))
      .join("")}</slicers>`
  );
  types = addOverride(types, slicerPath, CT_SLICER);
  zip.file("[Content_Types].xml", types);
  zip.file("xl/_rels/workbook.xml.rels", wbRels);
  zip.file("xl/workbook.xml", wbXml);

  const sheetRelsPath = relsPathFor(sheetPath);
  const rel = addRel(
    await read(zip, sheetRelsPath),
    REL_SLICER,
    `../slicers/slicer${m}.xml`
  );
  zip.file(sheetRelsPath, rel.xml);
  let sheetXml = (await read(zip, sheetPath))!;
  sheetXml = ensureRootNs(sheetXml, "worksheet", "r", NS_R);
  sheetXml = addExt(
    sheetXml,
    "worksheet",
    `<ext uri="${EXT_WS_TABLE_SLICERS}" xmlns:x15="${NS_X15}"><x14:slicerList xmlns:x14="${NS_X14}"><x14:slicer r:id="${rel.id}"/></x14:slicerList></ext>`
  );
  zip.file(sheetPath, sheetXml);

  await addDrawingAnchors(zip, sheetPath, (base) =>
    slicers
      .map(({ slicer }, i) => anchorXml(slicer, shapeNames[i], base + i))
      .join("")
  );
}

/** The zip post-processor: table filters, formulas and slicers. */
export async function writeTableExtras(zip: JSZip, info: XlsxPostProcessInfo) {
  const tables: TableZipExport[] = info.features?.tables ?? [];
  if (tables.length === 0) return;
  const bySheet = new Map<
    number,
    { table: TableZipExport; tableId: string; colIds: string[] }[]
  >();
  for (let i = 0; i < tables.length; i += 1) {
    const t = tables[i];
    // eslint-disable-next-line no-await-in-loop
    const part = await findTablePart(zip, t.name);
    if (!part) continue;
    let { xml } = part;
    xml = patchAutoFilter(xml, t);
    xml = patchTableColumns(xml, t.calculated, t.totals);
    zip.file(part.path, xml);
    const open = /<table\b[^>]*>/.exec(xml)?.[0] ?? "";
    const colIds = (xml.match(/<tableColumn\b[^>]*>/g) || []).map(
      (tag) => attr(tag, "id") ?? ""
    );
    const list = bySheet.get(t.worksheetId) ?? [];
    list.push({ table: t, tableId: attr(open, "id") ?? "1", colIds });
    bySheet.set(t.worksheetId, list);
  }
  const sheets = Array.from(bySheet.entries());
  for (let i = 0; i < sheets.length; i += 1) {
    const [id, entries] = sheets[i];
    // eslint-disable-next-line no-await-in-loop
    await writeSlicers(zip, `xl/worksheets/sheet${id}.xml`, entries);
  }
}

/* ------------------------------------------------------------------------ */
/* Collecting (called by the table writer)                                  */
/* ------------------------------------------------------------------------ */

function sheetSizes(sheet: any) {
  const cfg = sheet?.config || {};
  return {
    colW: (c: number) =>
      Number(cfg.columnlen?.[c] ?? sheet?.defaultColWidth ?? 73),
    rowH: (r: number) =>
      Number(cfg.rowlen?.[r] ?? sheet?.defaultRowHeight ?? 19),
    colHidden: (c: number) => cfg.colhidden?.[c] != null,
    rowHidden: (r: number) => cfg.rowhidden?.[r] != null,
  };
}

/** Sheet pixel of the start of cell index `i` (grid lines included). */
function startPx(
  index: number,
  size: (k: number) => number,
  hidden: (k: number) => boolean
) {
  let px = 0;
  for (let k = 0; k < index; k += 1) if (!hidden(k)) px += size(k) + 1;
  return px;
}

/** Slicer export data (anchor cells from the sheet's sizes). */
export function slicerExport(
  sheet: any,
  table: any,
  slicer: any
): TableSlicerExport | null {
  const column = (table.columns ?? []).findIndex(
    (c: any) =>
      String(c?.name).toUpperCase() === String(slicer?.column).toUpperCase()
  );
  if (column < 0 || !slicer?.name) return null;
  const s = sheetSizes(sheet);
  const r = Math.max(0, Number(slicer.r) || 0);
  const c = Math.max(0, Number(slicer.c) || 0);
  const width = Math.max(20, Number(slicer.width) || 180);
  const height = Math.max(20, Number(slicer.height) || 240);
  const left = startPx(c, s.colW, s.colHidden) + (Number(slicer.offsetX) || 0);
  const top = startPx(r, s.rowH, s.rowHidden) + (Number(slicer.offsetY) || 0);
  const fromCol = pixelToCell(left, s.colW, s.colHidden);
  const fromRow = pixelToCell(top, s.rowH, s.rowHidden);
  const toCol = pixelToCell(left + width, s.colW, s.colHidden);
  const toRow = pixelToCell(top + height, s.rowH, s.rowHidden);
  return {
    name: String(slicer.name),
    caption: String(slicer.caption ?? slicer.column ?? ""),
    showCaption: slicer.showCaption !== false,
    column,
    columnName: String(table.columns[column].name),
    columnCount: Math.max(1, Number(slicer.columnCount) || 1),
    buttonHeight: Number(slicer.buttonHeight) || 26,
    style: String(slicer.style || "SlicerStyleLight1"),
    sortOrder: slicer.sortOrder === "descending" ? "descending" : "ascending",
    noDataLast: slicer.noDataLast !== false,
    from: {
      col: fromCol.index,
      colOffPx: fromCol.offsetPx,
      row: fromRow.index,
      rowOffPx: fromRow.offsetPx,
    },
    to: {
      col: toCol.index,
      colOffPx: toCol.offsetPx,
      row: toRow.index,
      rowOffPx: toRow.offsetPx,
    },
    width,
    height,
  };
}

/** A table formula as stored in xlsx (qualified, `_xlfn.` prefixes). */
export function tableFormulaText(formula: string, tableName: string) {
  return toExcelFormula(qualifyStructuredReferences(formula, tableName))
    .formula;
}
