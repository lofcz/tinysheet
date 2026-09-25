/**
 * Pictures in cells -> xlsx (Excel 365 "Place in Cell").
 *
 * Excel stores a picture placed in a cell as a rich value: the cell is a
 * `#VALUE!` error cell with a `vm` attribute pointing at a record in
 * `xl/metadata.xml` (`valueMetadata` -> `futureMetadata name="XLRICHVALUE"`
 * -> rich value index), and the rich value (`xl/richData/rdrichvalue.xml`,
 * structure `_localImage` in rdrichvaluestructure.xml) names the picture
 * through `xl/richData/richValueRel.xml` and its relationships into
 * `xl/media`. ExcelJS cannot write any of that, so:
 *
 * - `writeCellImages` (a sheet export feature running after the cells)
 *   turns a placed picture with a data:image source into a `#VALUE!` cell
 *   and records it in the post-processing info; a placed picture with a web
 *   address is written as `=IMAGE("address","alt")` (`_xlfn.IMAGE`), which
 *   Excel shows the same way. IMAGE() formula cells are written like any
 *   formula (the cells writer adds the `_xlfn.` prefix); the workbook is then
 *   flagged for a full recalculation on load so Excel draws them.
 * - `writeCellImageParts` (called by postProcessXlsx) adds the media, the
 *   richData parts, the metadata records (merged with the dynamic-array
 *   ones), the `vm` attributes and the relationships / content types.
 */
import type JSZip from "jszip";
import type { SheetExportContext } from "./buildWorkbook";
import { cellAddress, toExcelFormula } from "../common/formulaText";

export type CellImageExport = { address: string; src: string; alt: string };

/** What writeCellImages records for postProcessXlsx. */
export type CellImagePostInfo = Record<number, CellImageExport[]>;

const DATA_IMAGE_RE = /^data:image\/([a-z0-9.+-]+)(?:;[a-z0-9=.+-]+)*;base64,/i;

function quote(s: string) {
  return `"${s.replace(/"/g, '""')}"`;
}

export function writeCellImages(ctx: SheetExportContext) {
  const { data, worksheet, post } = ctx;
  for (let r = 0; r < data.length; r += 1) {
    const row = data[r];
    if (!row) continue;
    for (let c = 0; c < row.length; c += 1) {
      const cell = row[c];
      const img = cell?.img;
      if (!img || typeof img.src !== "string") continue;
      const { mc } = cell!;
      if (mc && (mc.r !== r || mc.c !== c)) continue;
      if (cell!.f != null && String(cell!.f).trim() !== "") {
        // Excel draws IMAGE() results once it recalculates
        (ctx.workbook as any).calcProperties = {
          ...((ctx.workbook as any).calcProperties || {}),
          fullCalcOnLoad: true,
        };
        continue;
      }
      const alt = img.alt == null ? "" : String(img.alt);
      const target = worksheet.getCell(r + 1, c + 1);
      if (DATA_IMAGE_RE.test(img.src)) {
        target.value = { error: "#VALUE!" } as any;
        const list = ((post as any).cellImages ||= {}) as CellImagePostInfo;
        (list[worksheet.id] ||= []).push({
          address: cellAddress(r, c),
          src: img.src,
          alt,
        });
      } else {
        const args = [quote(img.src)];
        if (alt || (img.sizing && img.sizing !== 0)) args.push(quote(alt));
        if (img.sizing) {
          args.push(String(img.sizing));
          if (img.sizing === 3)
            args.push(String(img.h ?? ""), String(img.w ?? ""));
        }
        const { formula } = toExcelFormula(`=IMAGE(${args.join(",")})`);
        target.value = { formula, result: alt } as any;
        (ctx.workbook as any).calcProperties = {
          ...((ctx.workbook as any).calcProperties || {}),
          fullCalcOnLoad: true,
        };
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Zip parts
// ---------------------------------------------------------------------------

const NS_MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const NS_RICH =
  "http://schemas.microsoft.com/office/spreadsheetml/2017/richdata";
const NS_RICH2 =
  "http://schemas.microsoft.com/office/spreadsheetml/2017/richdata2";
const NS_RVREL =
  "http://schemas.microsoft.com/office/spreadsheetml/2022/richvaluerel";
const NS_R =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const NS_PKG_RELS =
  "http://schemas.openxmlformats.org/package/2006/relationships";

export const REL_RICH_VALUE =
  "http://schemas.microsoft.com/office/2017/06/relationships/rdRichValue";
export const REL_RICH_STRUCTURE =
  "http://schemas.microsoft.com/office/2017/06/relationships/rdRichValueStructure";
export const REL_RICH_TYPES =
  "http://schemas.microsoft.com/office/2017/06/relationships/rdRichValueTypes";
export const REL_RICH_VALUE_REL =
  "http://schemas.microsoft.com/office/2022/10/relationships/richValueRel";
const REL_IMAGE = `${NS_R}/image`;
const REL_METADATA = `${NS_R}/sheetMetadata`;

const CT_METADATA =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheetMetadata+xml";
const PARTS: [string, string, string][] = [
  [
    "richData/rdrichvalue.xml",
    "application/vnd.ms-excel.rdrichvalue+xml",
    REL_RICH_VALUE,
  ],
  [
    "richData/rdrichvaluestructure.xml",
    "application/vnd.ms-excel.rdrichvaluestructure+xml",
    REL_RICH_STRUCTURE,
  ],
  [
    "richData/rdRichValueTypes.xml",
    "application/vnd.ms-excel.rdrichvaluetypes+xml",
    REL_RICH_TYPES,
  ],
  [
    "richData/richValueRel.xml",
    "application/vnd.ms-excel.richvaluerel+xml",
    REL_RICH_VALUE_REL,
  ],
];

const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

const RICH_TYPE_XML =
  '<metadataType name="XLRICHVALUE" minSupportedVersion="120000" copy="1" ' +
  'pasteAll="1" pasteValues="1" merge="1" splitFirst="1" rowColShift="1" ' +
  'clearFormats="1" clearComments="1" assign="1" coerce="1"/>';

const RICH_TYPES_XML =
  `${XML_HEAD}<rvTypesInfo xmlns="${NS_RICH2}" ` +
  'xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" ' +
  `mc:Ignorable="x" xmlns:x="${NS_MAIN}"><global><keyFlags>` +
  '<key name="_Self"><flag name="ExcludeFromFile" value="1"/>' +
  '<flag name="ExcludeFromCalcComparison" value="1"/></key>' +
  [
    "_DisplayString",
    "_Flags",
    "_Format",
    "_SubLabel",
    "_Attribution",
    "_Icon",
    "_Display",
    "_CanonicalPropertyNames",
    "_ClassificationId",
  ]
    .map(
      (k) =>
        `<key name="${k}"><flag name="ExcludeFromCalcComparison" value="1"/></key>`
    )
    .join("") +
  "</keyFlags></global></rvTypesInfo>";

const STRUCTURES_XML =
  `${XML_HEAD}<rvStructures xmlns="${NS_RICH}" count="2">` +
  '<s t="_localImage"><k n="_rvRel:LocalImageIdentifier" t="i"/>' +
  '<k n="CalcOrigin" t="i"/></s>' +
  '<s t="_localImage"><k n="_rvRel:LocalImageIdentifier" t="i"/>' +
  '<k n="CalcOrigin" t="i"/><k n="Text" t="s"/></s></rvStructures>';

function xmlEscape(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const EXTENSIONS: Record<string, string> = {
  jpeg: "jpeg",
  jpg: "jpeg",
  png: "png",
  gif: "gif",
  bmp: "bmp",
  webp: "webp",
  "svg+xml": "svg",
  tiff: "tiff",
};

/** A data:image URL as a media file (extension, content type, bytes). */
export function decodeDataImage(src: string) {
  const m = DATA_IMAGE_RE.exec(src);
  if (!m) return null;
  const subtype = m[1].toLowerCase();
  const ext = EXTENSIONS[subtype] ?? "png";
  const base64 = src.slice(m[0].length).replace(/\s/g, "");
  return { ext, contentType: `image/${subtype}`, base64 };
}

/**
 * Add the XLRICHVALUE records for `count` pictures to a metadata part
 * (null: a new part). Returns the part and the `vm` index of the first
 * picture (1-based).
 */
export function mergeRichMetadata(existing: string | null, count: number) {
  const future =
    `<futureMetadata name="XLRICHVALUE" count="${count}">` +
    Array.from(
      { length: count },
      (_, i) =>
        '<bk><extLst><ext uri="{3e2802c4-a4d2-4d8b-9148-e3be6c30e623}">' +
        `<xlrd:rvb i="${i}"/></ext></extLst></bk>`
    ).join("") +
    "</futureMetadata>";
  if (!existing) {
    const values = Array.from(
      { length: count },
      (_, i) => `<bk><rc t="1" v="${i}"/></bk>`
    ).join("");
    return {
      xml:
        `${XML_HEAD}<metadata xmlns="${NS_MAIN}" xmlns:xlrd="${NS_RICH}">` +
        `<metadataTypes count="1">${RICH_TYPE_XML}</metadataTypes>${future}` +
        `<valueMetadata count="${count}">${values}</valueMetadata></metadata>`,
      firstVm: 1,
    };
  }
  let xml = existing;
  if (!/xmlns:xlrd=/.test(xml)) {
    xml = xml.replace(/<metadata\b/, `<metadata xmlns:xlrd="${NS_RICH}"`);
  }
  // the new metadata type's (1-based) index
  let typeIndex = 1;
  if (/<metadataTypes\b/.test(xml)) {
    const types = xml.match(/<metadataType\b/g)?.length ?? 0;
    typeIndex = types + 1;
    xml = xml
      .replace(/<\/metadataTypes>/, `${RICH_TYPE_XML}</metadataTypes>`)
      .replace(
        /<metadataTypes\b[^>]*>/,
        `<metadataTypes count="${typeIndex}">`
      );
  } else {
    xml = xml.replace(
      /(<metadata\b[^>]*>)/,
      `$1<metadataTypes count="1">${RICH_TYPE_XML}</metadataTypes>`
    );
  }
  // children of <metadata> in schema order: metadataTypes, metadataStrings,
  // mdxMetadata, futureMetadata*, cellMetadata, valueMetadata, extLst
  const after = (tags: string[]) => {
    let idx = -1;
    tags.forEach((tag) => {
      const i = xml.lastIndexOf(tag);
      if (i >= 0) idx = Math.max(idx, i + tag.length);
    });
    return idx;
  };
  const futureAt = after([
    "</metadataTypes>",
    "</metadataStrings>",
    "</mdxMetadata>",
    "</futureMetadata>",
  ]);
  xml = `${xml.slice(0, futureAt)}${future}${xml.slice(futureAt)}`;
  const bks = Array.from(
    { length: count },
    (_, i) => `<bk><rc t="${typeIndex}" v="${i}"/></bk>`
  ).join("");
  let firstVm = 1;
  const values = /<valueMetadata\b[^>]*>([\s\S]*?)<\/valueMetadata>/.exec(xml);
  if (values) {
    const n = values[1].match(/<bk\b/g)?.length ?? 0;
    firstVm = n + 1;
    xml = xml.replace(
      values[0],
      `<valueMetadata count="${n + count}">${values[1]}${bks}</valueMetadata>`
    );
  } else {
    const at = after(["</futureMetadata>", "</cellMetadata>"]);
    xml = `${xml.slice(
      0,
      at
    )}<valueMetadata count="${count}">${bks}</valueMetadata>${xml.slice(at)}`;
  }
  return { xml, firstVm };
}

function nextRelId(rels: string, prefix: string) {
  let n = 1;
  while (rels.includes(`Id="${prefix}${n}"`)) n += 1;
  return `${prefix}${n}`;
}

async function addContentTypes(
  zip: JSZip,
  overrides: [string, string][],
  defaults: [string, string][]
) {
  const path = "[Content_Types].xml";
  let types = await zip.file(path)!.async("string");
  defaults.forEach(([ext, type]) => {
    if (
      !new RegExp(`<Default Extension="${escapeRegExp(ext)}"`, "i").test(types)
    ) {
      types = types.replace(
        /(<Types\b[^>]*>)/,
        `$1<Default Extension="${ext}" ContentType="${type}"/>`
      );
    }
  });
  overrides.forEach(([part, type]) => {
    if (!types.includes(`PartName="${part}"`)) {
      types = types.replace(
        "</Types>",
        `<Override PartName="${part}" ContentType="${type}"/></Types>`
      );
    }
  });
  zip.file(path, types);
}

/** Write the in-cell pictures recorded by writeCellImages into the zip. */
export async function writeCellImageParts(
  zip: JSZip,
  info: { cellImages?: CellImagePostInfo }
) {
  const entries = Object.entries(info.cellImages ?? {}).filter(
    ([, list]) => list.length > 0
  );
  if (entries.length === 0) return;

  // media (one file per distinct picture) and their richValueRel entries
  const relOf = new Map<string, number>();
  const media: { target: string }[] = [];
  const defaults: [string, string][] = [];
  let n = 1;
  const pictures: {
    sheetId: number;
    address: string;
    rel: number;
    alt: string;
  }[] = [];
  entries.forEach(([sheetId, list]) => {
    list.forEach(({ address, src, alt }) => {
      let rel = relOf.get(src);
      if (rel == null) {
        const decoded = decodeDataImage(src);
        if (!decoded) return;
        while (zip.file(`xl/media/cellimage${n}.${decoded.ext}`)) n += 1;
        const target = `cellimage${n}.${decoded.ext}`;
        n += 1;
        zip.file(`xl/media/${target}`, decoded.base64, { base64: true });
        media.push({ target });
        defaults.push([decoded.ext, decoded.contentType]);
        rel = media.length - 1;
        relOf.set(src, rel);
      }
      pictures.push({ sheetId: Number(sheetId), address, rel, alt });
    });
  });
  if (pictures.length === 0) return;

  zip.file(
    "xl/richData/rdrichvalue.xml",
    `${XML_HEAD}<rvData xmlns="${NS_RICH}" count="${pictures.length}">${pictures
      .map(({ rel, alt }) =>
        alt
          ? `<rv s="1"><v>${rel}</v><v>5</v><v>${xmlEscape(alt)}</v></rv>`
          : `<rv s="0"><v>${rel}</v><v>5</v></rv>`
      )
      .join("")}</rvData>`
  );
  zip.file("xl/richData/rdrichvaluestructure.xml", STRUCTURES_XML);
  zip.file("xl/richData/rdRichValueTypes.xml", RICH_TYPES_XML);
  zip.file(
    "xl/richData/richValueRel.xml",
    `${XML_HEAD}<richValueRels xmlns="${NS_RVREL}" xmlns:r="${NS_R}">${media
      .map((_, i) => `<rel r:id="rId${i + 1}"/>`)
      .join("")}</richValueRels>`
  );
  zip.file(
    "xl/richData/_rels/richValueRel.xml.rels",
    `${XML_HEAD}<Relationships xmlns="${NS_PKG_RELS}">${media
      .map(
        ({ target }, i) =>
          `<Relationship Id="rId${
            i + 1
          }" Type="${REL_IMAGE}" Target="../media/${target}"/>`
      )
      .join("")}</Relationships>`
  );

  // metadata records, merged with the dynamic-array ones
  const metaFile = zip.file("xl/metadata.xml");
  const { xml: metadata, firstVm } = mergeRichMetadata(
    metaFile ? await metaFile.async("string") : null,
    pictures.length
  );
  zip.file("xl/metadata.xml", metadata);

  // vm attributes on the cells
  const bySheet = new Map<number, { address: string; vm: number }[]>();
  pictures.forEach((p, i) => {
    if (!bySheet.has(p.sheetId)) bySheet.set(p.sheetId, []);
    bySheet.get(p.sheetId)!.push({ address: p.address, vm: firstVm + i });
  });
  await Promise.all(
    [...bySheet.entries()].map(async ([id, cells]) => {
      const path = `xl/worksheets/sheet${id}.xml`;
      const file = zip.file(path);
      if (!file) return;
      let xml = await file.async("string");
      cells.forEach(({ address, vm }) => {
        const re = new RegExp(`<c r="${escapeRegExp(address)}"(?=[ >/])`);
        xml = xml.replace(re, `<c r="${address}" vm="${vm}"`);
      });
      zip.file(path, xml);
    })
  );

  // workbook relationships and content types
  const relsPath = "xl/_rels/workbook.xml.rels";
  let rels = await zip.file(relsPath)!.async("string");
  const add = (type: string, target: string) => {
    if (rels.includes(`Type="${type}"`)) return;
    const id = nextRelId(rels, "rIdRich");
    rels = rels.replace(
      "</Relationships>",
      `<Relationship Id="${id}" Type="${type}" Target="${target}"/></Relationships>`
    );
  };
  add(REL_METADATA, "metadata.xml");
  PARTS.forEach(([target, , type]) => add(type, target));
  zip.file(relsPath, rels);
  await addContentTypes(
    zip,
    [
      ["/xl/metadata.xml", CT_METADATA],
      ...PARTS.map(
        ([target, type]) => [`/xl/${target}`, type] as [string, string]
      ),
    ],
    defaults
  );
}
