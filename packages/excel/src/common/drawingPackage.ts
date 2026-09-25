/**
 * Zip-level plumbing for adding DrawingML objects to an xlsx package that
 * exceljs wrote: find (or create) a worksheet's drawing part, and add
 * relationships and content types. Every feature that adds drawing
 * anchors (shapes, and possibly charts) shares one drawing part per sheet,
 * as Excel does.
 */
import type JSZip from "jszip";

export const NS_A = "http://schemas.openxmlformats.org/drawingml/2006/main";
export const NS_R =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
export const NS_XDR =
  "http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing";
export const REL_DRAWING =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing";
export const CT_DRAWING =
  "application/vnd.openxmlformats-officedocument.drawing+xml";

export function xmlAttr(tag: string, name: string) {
  const m = tag.match(new RegExp(`\\s${name}="([^"]*)"`));
  return m ? m[1] : undefined;
}

export function decodeAttr(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

export type Rel = { id: string; target: string; type: string };

export function relsOf(xml: string): Rel[] {
  return (xml.match(/<Relationship\b[^>]*>/g) || []).map((tag) => ({
    id: xmlAttr(tag, "Id") ?? "",
    target: xmlAttr(tag, "Target") ?? "",
    type: xmlAttr(tag, "Type") ?? "",
  }));
}

export function nextRid(xml: string) {
  let max = 0;
  relsOf(xml).forEach((r) => {
    const n = parseInt(r.id.replace(/\D/g, ""), 10);
    if (Number.isFinite(n) && n > max) max = n;
  });
  return `rId${max + 1}`;
}

export function addRel(
  xml: string | null,
  id: string,
  type: string,
  target: string
) {
  const base =
    xml ??
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
  return base.replace(
    "</Relationships>",
    `<Relationship Id="${id}" Type="${type}" Target="${target}"/></Relationships>`
  );
}

export function resolvePath(from: string, target: string) {
  if (target.startsWith("/")) return target.slice(1);
  const parts = from.split("/");
  parts.pop();
  target.split("/").forEach((p) => {
    if (p === "..") parts.pop();
    else if (p !== ".") parts.push(p);
  });
  return parts.join("/");
}

export function relsPathFor(part: string) {
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

export function insertDrawingElement(sheetXml: string, rid: string) {
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

export function addOverride(types: string, part: string, contentType: string) {
  if (types.includes(`PartName="/${part}"`)) return types;
  return types.replace(
    "</Types>",
    `<Override PartName="/${part}" ContentType="${contentType}"/></Types>`
  );
}

/** Worksheet part path per sheet name, from workbook.xml and its rels. */
export async function worksheetParts(zip: JSZip) {
  const out = new Map<string, string>();
  const workbookXml = await zip.file("xl/workbook.xml")?.async("string");
  const workbookRels = await zip
    .file("xl/_rels/workbook.xml.rels")
    ?.async("string");
  if (!workbookXml || !workbookRels) return out;
  const rels = relsOf(workbookRels);
  (workbookXml.match(/<sheet\b[^>]*>/g) || []).forEach((tag) => {
    const name = decodeAttr(xmlAttr(tag, "name") ?? "");
    const rel = rels.find((r) => r.id === xmlAttr(tag, "r:id"));
    if (rel) out.set(name, resolvePath("xl/workbook.xml", rel.target));
  });
  return out;
}

/**
 * Append anchors (`<xdr:twoCellAnchor>...`) to the drawing of the worksheet
 * part `sheetPath`, creating the drawing when the sheet has none. `types`
 * is the [Content_Types].xml text; the updated text is returned.
 */
export async function appendDrawingAnchors(
  zip: JSZip,
  sheetPath: string,
  anchors: (firstShapeId: number) => string,
  types: string
): Promise<string> {
  let sheetXml = await zip.file(sheetPath)?.async("string");
  if (!sheetXml) return types;
  const sheetRelsPath = relsPathFor(sheetPath);
  let sheetRels = (await zip.file(sheetRelsPath)?.async("string")) ?? null;
  let nextTypes = types;

  let drawingPath: string | undefined;
  const drawingTag = sheetXml.match(/<drawing\b[^>]*>/);
  if (drawingTag && sheetRels) {
    const rid = xmlAttr(drawingTag[0], "r:id");
    const rel = relsOf(sheetRels).find((r) => r.id === rid);
    if (rel) drawingPath = resolvePath(sheetPath, rel.target);
  }
  let drawingXml = drawingPath
    ? await zip.file(drawingPath)?.async("string")
    : undefined;
  if (!drawingPath || !drawingXml) {
    const used = Object.keys(zip.files)
      .map((f) => /^xl\/drawings\/drawing(\d+)\.xml$/.exec(f)?.[1])
      .filter(Boolean)
      .map(Number);
    const n = (used.length ? Math.max(...used) : 0) + 1;
    drawingPath = `xl/drawings/drawing${n}.xml`;
    drawingXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<xdr:wsDr xmlns:xdr="${NS_XDR}" xmlns:a="${NS_A}"></xdr:wsDr>`;
    const rid = nextRid(sheetRels ?? "");
    sheetRels = addRel(
      sheetRels,
      rid,
      REL_DRAWING,
      `../drawings/drawing${n}.xml`
    );
    sheetXml = insertDrawingElement(sheetXml, rid);
    nextTypes = addOverride(nextTypes, drawingPath, CT_DRAWING);
    zip.file(sheetPath, sheetXml);
    zip.file(sheetRelsPath, sheetRels);
  }
  // DrawingML object ids are unique per drawing
  let maxId = 0;
  (drawingXml.match(/<xdr:cNvPr\b[^>]*>/g) || []).forEach((tag) => {
    const id = Number(xmlAttr(tag, "id"));
    if (Number.isFinite(id) && id > maxId) maxId = id;
  });
  // the drawing's root must declare the namespaces the anchors use
  const root = drawingXml.match(/<xdr:wsDr\b[^>]*>/);
  if (root && !/xmlns:a=/.test(root[0])) {
    drawingXml = drawingXml.replace(
      root[0],
      root[0].replace("<xdr:wsDr", `<xdr:wsDr xmlns:a="${NS_A}"`)
    );
  }
  drawingXml = drawingXml.replace(
    /<\/xdr:wsDr>\s*$/,
    `${anchors(maxId + 1)}</xdr:wsDr>`
  );
  zip.file(drawingPath, drawingXml);
  return nextTypes;
}
