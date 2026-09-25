/**
 * Cell checkboxes (Excel 365 Insert › Checkbox) in xlsx.
 *
 * Excel stores a checkbox as a cell format feature, not as a control: the
 * cell holds a boolean (`t="b"`), and its cell format (`cellXfs/xf`) points
 * through an extension to a feature property bag:
 *
 *   xl/styles.xml
 *     <xf ...><extLst>
 *       <ext uri="{C7286773-470A-42A8-94C5-96B5CB345126}"
 *            xmlns:xfpb="http://schemas.microsoft.com/office/spreadsheetml/2022/featurepropertybag">
 *         <xfpb:xfComplement i="0"/>
 *       </ext></extLst></xf>
 *
 *   xl/featurePropertyBag/featurePropertyBag.xml
 *     <FeaturePropertyBags xmlns="…/2022/featurepropertybag">
 *       <bag type="Checkbox"/>                                  (bag 0)
 *       <bag type="XFControls"><bagId k="CellControl">0</bagId></bag>   (1)
 *       <bag type="XFComplement"><bagId k="XFControls">1</bagId></bag>  (2)
 *       <bag type="XFComplements" extRef="XFComplementsMapperExtRef">
 *         <a k="MappedFeaturePropertyBags"><bagId>2</bagId></a></bag>   (3)
 *     </FeaturePropertyBags>
 *
 * `xfComplement i` indexes the MappedFeaturePropertyBags list. The part is
 * related from the workbook (relationship type
 * http://schemas.microsoft.com/office/2022/11/relationships/FeaturePropertyBag)
 * with content type application/vnd.ms-excel.featurepropertybag+xml.
 *
 * This is the layout Excel 365 writes (and XlsxWriter reproduces). ExcelJS
 * cannot write any of it, so export marks the checkbox cells while the
 * sheets are written and a zip post-process clones their cell formats with
 * the extension, adds the part, its content type and relationship. Import
 * reads the same chain back into `cell.cb`.
 */
import type JSZip from "jszip";
import type { SheetExportContext } from "./buildWorkbook";
import type { XlsxPostProcessInfo } from "./postProcess";

export const FEATURE_BAG_PATH = "xl/featurePropertyBag/featurePropertyBag.xml";
export const FEATURE_BAG_CONTENT_TYPE =
  "application/vnd.ms-excel.featurepropertybag+xml";
export const FEATURE_BAG_REL_TYPE =
  "http://schemas.microsoft.com/office/2022/11/relationships/FeaturePropertyBag";
const FEATURE_BAG_NS =
  "http://schemas.microsoft.com/office/spreadsheetml/2022/featurepropertybag";
const XF_COMPLEMENT_URI = "{C7286773-470A-42A8-94C5-96B5CB345126}";

export const FEATURE_BAG_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
  `<FeaturePropertyBags xmlns="${FEATURE_BAG_NS}">` +
  '<bag type="Checkbox"/>' +
  '<bag type="XFControls"><bagId k="CellControl">0</bagId></bag>' +
  '<bag type="XFComplement"><bagId k="XFControls">1</bagId></bag>' +
  '<bag type="XFComplements" extRef="XFComplementsMapperExtRef">' +
  '<a k="MappedFeaturePropertyBags"><bagId>2</bagId></a></bag>' +
  "</FeaturePropertyBags>";

const XF_EXT =
  `<extLst><ext uri="${XF_COMPLEMENT_URI}" xmlns:xfpb="${FEATURE_BAG_NS}">` +
  '<xfpb:xfComplement i="0"/></ext></extLst>';

/** Worksheet id -> A1 addresses of checkbox cells, per export. */
const checkboxCells = new WeakMap<XlsxPostProcessInfo, Map<number, string[]>>();

function columnName(c: number) {
  let n = c;
  let s = "";
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

/** Sheet writer: note the checkbox cells of the sheet. */
export function collectCheckboxes(ctx: SheetExportContext) {
  const found: string[] = [];
  ctx.data.forEach((row, r) =>
    row?.forEach((cell, c) => {
      if (cell && typeof cell === "object" && cell.cb) {
        found.push(`${columnName(c)}${r + 1}`);
      }
    })
  );
  if (found.length === 0) return;
  let map = checkboxCells.get(ctx.post);
  if (!map) {
    map = new Map();
    checkboxCells.set(ctx.post, map);
  }
  map.set(ctx.worksheet.id, found);
}

export function hasCheckboxes(post: XlsxPostProcessInfo) {
  return (checkboxCells.get(post)?.size ?? 0) > 0;
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** The `<xf>` elements of `<cellXfs>` (outer XML each). */
function splitXfs(inner: string) {
  return inner.match(/<xf\b[^>]*\/>|<xf\b[^>]*>[\s\S]*?<\/xf>/g) ?? [];
}

function withComplement(xf: string) {
  if (/xfComplement/.test(xf)) return xf;
  if (/\/>$/.test(xf)) return xf.replace(/\s*\/>$/, `>${XF_EXT}</xf>`);
  if (/<extLst>/.test(xf)) {
    return xf.replace(
      /<\/extLst>/,
      `${XF_EXT.slice("<extLst>".length, -"</extLst>".length)}</extLst>`
    );
  }
  return xf.replace(/<\/xf>$/, `${XF_EXT}</xf>`);
}

/** Zip post-process: give the checkbox cells a checkbox cell format. */
export async function writeCheckboxParts(
  zip: JSZip,
  post: XlsxPostProcessInfo
) {
  const map = checkboxCells.get(post);
  if (!map || map.size === 0) return;
  const stylesFile = zip.file("xl/styles.xml");
  if (!stylesFile) return;
  let styles = await stylesFile.async("string");
  const cellXfs = /<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/.exec(styles);
  if (!cellXfs) return;
  const xfs = splitXfs(cellXfs[1]);
  const clones = new Map<number, number>();
  const cloneOf = (s: number) => {
    let idx = clones.get(s);
    if (idx == null) {
      idx = xfs.length;
      xfs.push(withComplement(xfs[s] ?? xfs[0] ?? '<xf numFmtId="0"/>'));
      clones.set(s, idx);
    }
    return idx;
  };

  await Promise.all(
    [...map.entries()].map(async ([id, cells]) => {
      const path = `xl/worksheets/sheet${id}.xml`;
      const file = zip.file(path);
      if (!file) return;
      let xml = await file.async("string");
      cells.forEach((address) => {
        const re = new RegExp(
          `<c r="${escapeRegExp(address)}"(?=[\\s>/])[^>]*`
        );
        xml = xml.replace(re, (tag) => {
          const s = Number(/\ss="(\d+)"/.exec(tag)?.[1] ?? 0);
          const next = cloneOf(s);
          return /\ss="\d+"/.test(tag)
            ? tag.replace(/\ss="\d+"/, ` s="${next}"`)
            : tag.replace(/(\/?)$/, ` s="${next}"$1`);
        });
      });
      zip.file(path, xml);
    })
  );
  if (clones.size === 0) return;
  const open = /<cellXfs\b[^>]*>/.exec(cellXfs[0])![0];
  const newOpen = /count="\d+"/.test(open)
    ? open.replace(/count="\d+"/, `count="${xfs.length}"`)
    : open.replace(/>$/, ` count="${xfs.length}">`);
  styles = styles.replace(cellXfs[0], `${newOpen}${xfs.join("")}</cellXfs>`);
  zip.file("xl/styles.xml", styles);

  zip.file(FEATURE_BAG_PATH, FEATURE_BAG_XML);
  const typesPath = "[Content_Types].xml";
  let types = await zip.file(typesPath)!.async("string");
  if (!types.includes(`/${FEATURE_BAG_PATH}`)) {
    types = types.replace(
      "</Types>",
      `<Override PartName="/${FEATURE_BAG_PATH}" ContentType="${FEATURE_BAG_CONTENT_TYPE}"/></Types>`
    );
    zip.file(typesPath, types);
  }
  const relsPath = "xl/_rels/workbook.xml.rels";
  let rels = await zip.file(relsPath)!.async("string");
  if (!rels.includes(FEATURE_BAG_REL_TYPE)) {
    let n = 1;
    while (rels.includes(`Id="rIdFpb${n}"`)) n += 1;
    rels = rels.replace(
      "</Relationships>",
      `<Relationship Id="rIdFpb${n}" Type="${FEATURE_BAG_REL_TYPE}" Target="featurePropertyBag/featurePropertyBag.xml"/></Relationships>`
    );
    zip.file(relsPath, rels);
  }
}

/* ------------------------------------------------------------------ */
/* Import                                                              */
/* ------------------------------------------------------------------ */

type Bag = { type: string; body: string };

function parseBags(xml: string): Bag[] {
  const out: Bag[] = [];
  const re = /<(?:\w+:)?bag\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?bag>)/g;
  let m = re.exec(xml);
  while (m) {
    out.push({
      type: /\btype="([^"]*)"/.exec(m[1])?.[1] ?? "",
      body: m[2] ?? "",
    });
    m = re.exec(xml);
  }
  return out;
}

function bagIds(body: string) {
  return [...body.matchAll(/<(?:\w+:)?bagId\b[^>]*>\s*(\d+)\s*</g)].map((x) =>
    Number(x[1])
  );
}

/**
 * Indexes of the `cellXfs` formats that are checkboxes, from styles.xml and
 * the feature property bag part (empty when either is missing).
 */
export function checkboxXfIndexes(
  stylesXml: string | undefined,
  bagXml: string | undefined
): Set<number> {
  const out = new Set<number>();
  if (!stylesXml || !bagXml) return out;
  const bags = parseBags(bagXml);
  const mapper = bags.find((b) => b.type === "XFComplements");
  const mappedList =
    /<(?:\w+:)?a\b[^>]*k="MappedFeaturePropertyBags"[^>]*>([\s\S]*?)<\/(?:\w+:)?a>/.exec(
      mapper?.body ?? ""
    )?.[1];
  const mapped = mappedList ? bagIds(mappedList) : [];
  const reachesCheckbox = (start: number) => {
    const seen = new Set<number>();
    const stack = [start];
    while (stack.length) {
      const i = stack.pop()!;
      if (seen.has(i) || !bags[i]) continue;
      seen.add(i);
      if (bags[i].type === "Checkbox") return true;
      stack.push(...bagIds(bags[i].body));
    }
    return false;
  };
  const cellXfs = /<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/.exec(stylesXml);
  if (!cellXfs) return out;
  splitXfs(cellXfs[1]).forEach((xf, index) => {
    const i = /<(?:\w+:)?xfComplement\b[^>]*\bi="(\d+)"/.exec(xf)?.[1];
    if (i == null) return;
    const bag = mapped[Number(i)];
    if (bag != null && reachesCheckbox(bag)) out.add(index);
  });
  return out;
}

function decodeAddress(a: string) {
  const m = /^([A-Z]+)(\d+)$/.exec(a);
  if (!m) return null;
  let c = 0;
  for (let i = 0; i < m[1].length; i += 1) c = c * 26 + m[1].charCodeAt(i) - 64;
  return { r: Number(m[2]) - 1, c: c - 1 };
}

/** The checkbox cells of a worksheet part, given the checkbox formats. */
export function checkboxCellsOf(sheetXml: string, xfs: Set<number>) {
  const out: { r: number; c: number }[] = [];
  if (xfs.size === 0) return out;
  const re = /<c\b([^>]*)>/g;
  let m = re.exec(sheetXml);
  while (m) {
    const s = /\ss="(\d+)"/.exec(m[1])?.[1];
    const r = /\sr="([A-Z]+\d+)"/.exec(m[1])?.[1];
    if (s != null && r && xfs.has(Number(s))) {
      const pos = decodeAddress(r);
      if (pos) out.push(pos);
    }
    m = re.exec(sheetXml);
  }
  return out;
}
