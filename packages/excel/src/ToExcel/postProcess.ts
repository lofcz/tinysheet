/**
 * Zip-level fixups for what ExcelJS cannot write:
 *
 * - Dynamic-array formulas: ExcelJS writes `<f t="array" ref="...">`, which
 *   Excel shows as a legacy CSE array formula. Excel 365 marks spilling
 *   formulas with `cm="1"` pointing at an XLDAPR cell-metadata record in
 *   xl/metadata.xml; we add both.
 * - Internal hyperlinks: ExcelJS stores every link as an external
 *   relationship. Links whose target starts with "#" are rewritten to a
 *   `location` attribute and their relationship is removed.
 * - Shown notes: ExcelJS writes every note hidden. Notes TinySheet shows
 *   permanently (`ps.isShow`) get `<x:Visible/>` and a visible shape.
 * - Threaded comments: their thread and person parts
 *   (ExcelThreadedComments.ts).
 */
import JSZip from "jszip";
import type { ThreadedCommentExportInfo } from "./ExcelThreadedComments";
import { writeThreadedCommentParts } from "./ExcelThreadedComments";

export type XlsxPostProcessInfo = {
  /** Worksheet id -> addresses of dynamic-array formula cells. */
  dynamicArrayCells: Record<number, string[]>;
  worksheetIds: number[];
  /** Worksheet id -> cells (0-based) whose note is always shown. */
  visibleNotes?: Record<number, { r: number; c: number }[]>;
  /** Threads and persons to write (writeThreadedComments). */
  threadedComments?: ThreadedCommentExportInfo;
};

const METADATA_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
  '<metadata xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
  'xmlns:xda="http://schemas.microsoft.com/office/spreadsheetml/2017/dynamicarray">' +
  '<metadataTypes count="1"><metadataType name="XLDAPR" minSupportedVersion="120000" ' +
  'copy="1" pasteAll="1" pasteValues="1" merge="1" splitFirst="1" rowColShift="1" ' +
  'clearFormats="1" clearComments="1" assign="1" coerce="1" cellMeta="1"/></metadataTypes>' +
  '<futureMetadata name="XLDAPR" count="1"><bk><extLst>' +
  '<ext uri="{bdbb8cdc-fa1e-496e-a857-3c3f30c029c3}">' +
  '<xda:dynamicArrayProperties fDynamic="1" fCollapsed="0"/></ext></extLst></bk>' +
  "</futureMetadata>" +
  '<cellMetadata count="1"><bk><rc t="1" v="0"/></bk></cellMetadata></metadata>';

const METADATA_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheetMetadata+xml";
const METADATA_REL_TYPE =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/sheetMetadata";
const HYPERLINK_REL_TYPE =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink";

export function xmlUnescape(s: string) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) =>
      String.fromCharCode(parseInt(h, 16))
    )
    .replace(/&amp;/g, "&");
}

export function xmlEscape(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function markDynamicArrays(zip: JSZip, info: XlsxPostProcessInfo) {
  const entries = Object.entries(info.dynamicArrayCells).filter(
    ([, cells]) => cells.length > 0
  );
  if (entries.length === 0) return;

  await Promise.all(
    entries.map(async ([id, cells]) => {
      const path = `xl/worksheets/sheet${id}.xml`;
      const file = zip.file(path);
      if (!file) return;
      let xml = await file.async("string");
      cells.forEach((address) => {
        const re = new RegExp(`<c r="${escapeRegExp(address)}"(?=[ >/])`);
        xml = xml.replace(re, `<c r="${address}" cm="1"`);
      });
      zip.file(path, xml);
    })
  );

  zip.file("xl/metadata.xml", METADATA_XML);

  const typesPath = "[Content_Types].xml";
  let types = await zip.file(typesPath)!.async("string");
  if (!types.includes("/xl/metadata.xml")) {
    types = types.replace(
      "</Types>",
      `<Override PartName="/xl/metadata.xml" ContentType="${METADATA_CONTENT_TYPE}"/></Types>`
    );
    zip.file(typesPath, types);
  }

  const relsPath = "xl/_rels/workbook.xml.rels";
  let rels = await zip.file(relsPath)!.async("string");
  if (!rels.includes(METADATA_REL_TYPE)) {
    let n = 1;
    while (rels.includes(`Id="rIdMeta${n}"`)) n += 1;
    rels = rels.replace(
      "</Relationships>",
      `<Relationship Id="rIdMeta${n}" Type="${METADATA_REL_TYPE}" Target="metadata.xml"/></Relationships>`
    );
    zip.file(relsPath, rels);
  }
}

async function fixSheetLinks(zip: JSZip, relFile: JSZip.JSZipObject) {
  let rels = await relFile.async("string");
  const internal = new Map<string, string>();
  rels = rels.replace(/<Relationship\b[^>]*\/>/g, (rel) => {
    const type = /Type="([^"]*)"/.exec(rel)?.[1];
    const target = /Target="([^"]*)"/.exec(rel)?.[1];
    const id = /Id="([^"]*)"/.exec(rel)?.[1];
    if (type !== HYPERLINK_REL_TYPE || !target || !id) return rel;
    const raw = xmlUnescape(target);
    if (!raw.startsWith("#")) return rel;
    internal.set(id, raw.slice(1));
    return "";
  });
  if (internal.size === 0) return;
  const sheetPath = relFile.name.replace("_rels/", "").replace(/\.rels$/, "");
  const sheetFile = zip.file(sheetPath);
  if (!sheetFile) return;
  let xml = await sheetFile.async("string");
  xml = xml.replace(/<hyperlink\b[^>]*\/>/g, (el) => {
    const id = /r:id="([^"]*)"/.exec(el)?.[1];
    if (!id || !internal.has(id)) return el;
    const location = xmlEscape(internal.get(id)!);
    let out = el
      .replace(/\s+r:id="[^"]*"/, "")
      .replace(/\s+location="[^"]*"/, "");
    out = out.replace(/\s*\/>$/, ` location="${location}"/>`);
    return out;
  });
  zip.file(sheetPath, xml);
  zip.file(relFile.name, rels);
}

async function fixInternalHyperlinks(zip: JSZip) {
  const relFiles = zip.file(/^xl\/worksheets\/_rels\/sheet\d+\.xml\.rels$/);
  await Promise.all(relFiles.map((relFile) => fixSheetLinks(zip, relFile)));
}

const VML_REL_TYPE =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/vmlDrawing";

/** Make the note shapes of the given cells visible in a sheet's VML part. */
export function showVmlNotes(vml: string, cells: { r: number; c: number }[]) {
  const wanted = new Set(cells.map(({ r, c }) => `${r}_${c}`));
  return vml.replace(/<v:shape\b[\s\S]*?<\/v:shape>/g, (shape) => {
    const row = /<x:Row>\s*(\d+)\s*<\/x:Row>/.exec(shape)?.[1];
    const col = /<x:Column>\s*(\d+)\s*<\/x:Column>/.exec(shape)?.[1];
    if (row == null || col == null || !wanted.has(`${row}_${col}`)) {
      return shape;
    }
    let out = shape.replace(/visibility:hidden/g, "visibility:visible");
    if (!/<x:Visible\s*\/?>/.test(out)) {
      out = out.replace(/<\/x:ClientData>/, "<x:Visible/></x:ClientData>");
    }
    return out;
  });
}

async function showNotes(zip: JSZip, info: XlsxPostProcessInfo) {
  const entries = Object.entries(info.visibleNotes ?? {}).filter(
    ([, cells]) => cells.length > 0
  );
  await Promise.all(
    entries.map(async ([id, cells]) => {
      const rels = await zip
        .file(`xl/worksheets/_rels/sheet${id}.xml.rels`)
        ?.async("string");
      const rel = (rels?.match(/<Relationship\b[^>]*>/g) ?? []).find((el) =>
        el.includes(`Type="${VML_REL_TYPE}"`)
      );
      const target = rel && /Target="([^"]*)"/.exec(rel)?.[1];
      if (!target) return;
      const path = target.startsWith("/")
        ? target.slice(1)
        : `xl/${target.replace(/^\.\.\//, "")}`;
      const file = zip.file(path);
      if (!file) return;
      zip.file(path, showVmlNotes(await file.async("string"), cells));
    })
  );
}

export async function postProcessXlsx(
  buffer: ArrayBuffer | Uint8Array,
  info: XlsxPostProcessInfo
): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(buffer);
  await markDynamicArrays(zip, info);
  await fixInternalHyperlinks(zip);
  await showNotes(zip, info);
  await writeThreadedCommentParts(zip, info);
  return zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
