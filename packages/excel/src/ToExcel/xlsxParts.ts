/**
 * String helpers for editing the parts of an xlsx package (OPC): content
 * types, relationships and worksheet children in schema order. They are
 * pure (XML text in, XML text out) and used by the zip post-processors
 * (see postProcessors.ts), so features that write parts ExcelJS cannot
 * create do not each reinvent them.
 */

export const REL_NS =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
export const PKG_REL_NS =
  "http://schemas.openxmlformats.org/package/2006/relationships";

const EMPTY_RELS =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
  `<Relationships xmlns="${PKG_REL_NS}"></Relationships>`;

/** CT_Worksheet children, in the order the schema requires. */
export const WORKSHEET_CHILD_ORDER = [
  "sheetPr",
  "dimension",
  "sheetViews",
  "sheetFormatPr",
  "cols",
  "sheetData",
  "sheetCalcPr",
  "sheetProtection",
  "protectedRanges",
  "scenarios",
  "autoFilter",
  "sortState",
  "dataConsolidate",
  "customSheetViews",
  "mergeCells",
  "phoneticPr",
  "conditionalFormatting",
  "dataValidations",
  "hyperlinks",
  "printOptions",
  "pageMargins",
  "pageSetup",
  "headerFooter",
  "rowBreaks",
  "colBreaks",
  "customProperties",
  "cellWatches",
  "ignoredErrors",
  "smartTags",
  "drawing",
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

export function escapeXmlAttr(s: string) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Value of attribute `name` in a start tag (raw, still XML-escaped). */
export function tagAttr(tag: string, name: string): string | undefined {
  const m = new RegExp(`\\s${escapeRegExp(name)}="([^"]*)"`).exec(tag);
  return m ? m[1] : undefined;
}

/** Set (or replace) attribute `name` on the start tag `tag`. */
export function setTagAttr(tag: string, name: string, value: string) {
  const escaped = escapeXmlAttr(value);
  const re = new RegExp(`(\\s${escapeRegExp(name)}=)"[^"]*"`);
  if (re.test(tag)) return tag.replace(re, `$1"${escaped}"`);
  return tag.replace(/\s*(\/?>)$/, ` ${name}="${escaped}"$1`);
}

/** "xl/worksheets/sheet1.xml" -> "xl/worksheets/_rels/sheet1.xml.rels" */
export function relsPathFor(part: string) {
  const i = part.lastIndexOf("/");
  return `${part.slice(0, i)}/_rels/${part.slice(i + 1)}.rels`;
}

/** Resolve a relationship target of `fromPart` to a zip path. */
export function resolveTarget(fromPart: string, target: string) {
  if (target.startsWith("/")) return target.slice(1);
  const parts = fromPart.split("/");
  parts.pop();
  target.split("/").forEach((p) => {
    if (p === "..") parts.pop();
    else if (p !== "." && p !== "") parts.push(p);
  });
  return parts.join("/");
}

/** Relative target from `fromPart` to `toPart` ("../drawings/drawing1.xml"). */
export function relativeTarget(fromPart: string, toPart: string) {
  const from = fromPart.split("/").slice(0, -1);
  const to = toPart.split("/");
  let i = 0;
  while (i < from.length && i < to.length - 1 && from[i] === to[i]) i += 1;
  return [...from.slice(i).map(() => ".."), ...to.slice(i)].join("/");
}

export type Relationship = {
  id: string;
  type: string;
  target: string;
  external: boolean;
};

export function parseRelationships(xml: string | null | undefined) {
  const rels: Relationship[] = [];
  (xml?.match(/<Relationship\b[^>]*>/g) ?? []).forEach((tag) => {
    const id = tagAttr(tag, "Id");
    const type = tagAttr(tag, "Type");
    const target = tagAttr(tag, "Target");
    if (!id || !type || target == null) return;
    rels.push({
      id,
      type,
      target,
      external: /TargetMode="External"/.test(tag),
    });
  });
  return rels;
}

/** A relationship id not used in `xml` ("rId7"). */
export function nextRelationshipId(xml: string | null | undefined) {
  let max = 0;
  parseRelationships(xml).forEach((r) => {
    const n = parseInt(r.id.replace(/\D/g, ""), 10);
    if (Number.isFinite(n) && n > max) max = n;
  });
  return `rId${max + 1}`;
}

/**
 * Add a relationship to a .rels part (created when `xml` is null). An
 * existing relationship with the same type and target is reused.
 */
export function addRelationship(
  xml: string | null | undefined,
  type: string,
  target: string,
  external = false
): { xml: string; id: string } {
  const base = xml || EMPTY_RELS;
  const existing = parseRelationships(base).find(
    (r) => r.type === type && r.target === escapeXmlAttr(target)
  );
  if (existing) return { xml: base, id: existing.id };
  const id = nextRelationshipId(base);
  const mode = external ? ' TargetMode="External"' : "";
  return {
    id,
    xml: base.replace(
      /<\/Relationships>\s*$/,
      `<Relationship Id="${id}" Type="${type}" Target="${escapeXmlAttr(
        target
      )}"${mode}/></Relationships>`
    ),
  };
}

/** Add an `<Override>` for a part to [Content_Types].xml (idempotent). */
export function addContentTypeOverride(
  types: string,
  partName: string,
  contentType: string
) {
  const name = partName.startsWith("/") ? partName : `/${partName}`;
  if (types.includes(`PartName="${name}"`)) return types;
  return types.replace(
    "</Types>",
    `<Override PartName="${name}" ContentType="${contentType}"/></Types>`
  );
}

/** Add a `<Default>` for a file extension to [Content_Types].xml (idempotent). */
export function addContentTypeDefault(
  types: string,
  extension: string,
  contentType: string
) {
  const ext = extension.replace(/^\./, "");
  if (new RegExp(`Extension="${escapeRegExp(ext)}"`, "i").test(types))
    return types;
  return types.replace(
    /<Types\b[^>]*>/,
    (open) =>
      `${open}<Default Extension="${ext}" ContentType="${contentType}"/>`
  );
}

/** Declare `xmlns:prefix` on the root element of a part (idempotent). */
export function ensureNamespace(xml: string, prefix: string, uri: string) {
  const root = /<([A-Za-z_][\w.-]*:)?[A-Za-z_][\w.-]*\b[^>]*>/.exec(
    xml.replace(/^<\?xml[^>]*\?>\s*/, "")
  );
  if (!root || root[0].includes(`xmlns:${prefix}=`)) return xml;
  const tag = root[0];
  return xml.replace(
    tag,
    tag.replace(/(\s*\/?>)$/, ` xmlns:${prefix}="${uri}"$1`)
  );
}

function childIndex(xml: string, name: string) {
  const re = new RegExp(`<${escapeRegExp(name)}[\\s/>]`);
  const m = re.exec(xml);
  return m ? m.index : -1;
}

/** The complete element `<name ...>...</name>` or `<name .../>`, or null. */
export function findElement(xml: string, name: string) {
  const start = childIndex(xml, name);
  if (start < 0) return null;
  const open = xml.indexOf(">", start);
  if (open < 0) return null;
  if (xml[open - 1] === "/") {
    return { start, end: open + 1, text: xml.slice(start, open + 1) };
  }
  const close = `</${name}>`;
  const end = xml.indexOf(close, open);
  if (end < 0) return null;
  return {
    start,
    end: end + close.length,
    text: xml.slice(start, end + close.length),
  };
}

/**
 * Put a child element into a worksheet part at its schema position.
 * `replace` (default) swaps an existing element of the same name.
 */
export function insertWorksheetElement(
  sheetXml: string,
  name: string,
  elementXml: string,
  replace = true
) {
  const existing = findElement(sheetXml, name);
  if (existing) {
    if (!replace) return sheetXml;
    return (
      sheetXml.slice(0, existing.start) +
      elementXml +
      sheetXml.slice(existing.end)
    );
  }
  const at = WORKSHEET_CHILD_ORDER.indexOf(name);
  const later = at < 0 ? [] : WORKSHEET_CHILD_ORDER.slice(at + 1);
  for (let i = 0; i < later.length; i += 1) {
    const idx = childIndex(sheetXml, later[i]);
    if (idx >= 0)
      return sheetXml.slice(0, idx) + elementXml + sheetXml.slice(idx);
  }
  return sheetXml.replace(/<\/worksheet>\s*$/, `${elementXml}</worksheet>`);
}

/**
 * Add an `<ext uri="...">` to a part's `<extLst>` (worksheet or workbook),
 * replacing an ext with the same uri. `extXml` is the full `<ext>` element.
 */
export function addExtension(xml: string, uri: string, extXml: string) {
  const list = findElement(xml, "extLst");
  if (!list) {
    if (/<\/worksheet>\s*$/.test(xml)) {
      return insertWorksheetElement(
        xml,
        "extLst",
        `<extLst>${extXml}</extLst>`
      );
    }
    return xml.replace(/(<\/[\w:]+>)\s*$/, `<extLst>${extXml}</extLst>$1`);
  }
  const re = new RegExp(
    `<ext\\b[^>]*uri="${escapeRegExp(uri)}"[\\s\\S]*?</ext>`
  );
  const inner = re.test(list.text)
    ? list.text.replace(re, extXml)
    : list.text.replace(/<\/extLst>$/, `${extXml}</extLst>`);
  return xml.slice(0, list.start) + inner + xml.slice(list.end);
}
