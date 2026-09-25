/**
 * Fast, allocation-light scanning of the hot xlsx parts.
 *
 * The generic reader (ReadXml / Element) builds regular expressions and
 * element objects for every match; for `<sheetData>` with 100k+ cells that
 * dominates import time. These helpers walk the text with indexOf instead:
 * rows and cells are reported with their attributes and inner XML, and the
 * few children a cell has (`<v>`, `<f>`, `<is>`) are cut out directly.
 *
 * Main-namespace prefixes (`<x:row>`) are removed beforehand by
 * `normalizeSpreadsheetNamespace`.
 */
import { IattributeList } from "../common/ICommon";

const isSpace = (ch: number) => ch === 32 || ch === 9 || ch === 10 || ch === 13;

/**
 * Attributes of a start tag's attribute text (`r="A1" s="3"`; values raw,
 * still XML-escaped). Hand-rolled: this runs for every cell and row.
 */
export function parseAttributes(text: string): IattributeList {
  const attrs: IattributeList = {};
  const n = text.length;
  let i = 0;
  while (i < n) {
    while (i < n && isSpace(text.charCodeAt(i))) i += 1;
    const nameStart = i;
    while (i < n) {
      const ch = text.charCodeAt(i);
      if (ch === 61 || isSpace(ch) || ch === 47 || ch === 62) break;
      i += 1;
    }
    if (i === nameStart) {
      i += 1;
      continue;
    }
    const name = text.slice(nameStart, i);
    while (i < n && isSpace(text.charCodeAt(i))) i += 1;
    if (text.charCodeAt(i) !== 61) continue; // no value
    i += 1;
    while (i < n && isSpace(text.charCodeAt(i))) i += 1;
    const quote = text.charCodeAt(i);
    if (quote !== 34 && quote !== 39) continue;
    const end = text.indexOf(quote === 34 ? '"' : "'", i + 1);
    if (end < 0) break;
    attrs[name] = text.slice(i + 1, end);
    i = end + 1;
  }
  return attrs;
}

const NO_ATTRIBUTES: IattributeList = Object.freeze({}) as IattributeList;

/** Index just past the `>` closing the start tag at `start` (quote-aware). */
function tagEnd(xml: string, start: number): number {
  let quote = 0;
  for (let i = start; i < xml.length; i += 1) {
    const ch = xml.charCodeAt(i);
    if (quote) {
      if (ch === quote) quote = 0;
    } else if (ch === 34 || ch === 39) {
      quote = ch;
    } else if (ch === 62) {
      return i + 1;
    }
  }
  return -1;
}

/** Whether `xml[i]` ends a tag name (space, `>`, `/`). */
function nameEnds(xml: string, i: number) {
  const ch = xml.charCodeAt(i);
  return (
    ch === 32 || ch === 62 || ch === 47 || ch === 9 || ch === 10 || ch === 13
  );
}

/** Position of the next `<name` start tag (not `<nameLonger`) from `from`. */
function nextStartTag(xml: string, name: string, from: number, until: number) {
  const open = `<${name}`;
  let i = xml.indexOf(open, from);
  while (i >= 0 && i < until) {
    if (nameEnds(xml, i + open.length)) return i;
    i = xml.indexOf(open, i + open.length);
  }
  return -1;
}

export type ScannedElement = {
  /** Attributes of the start tag. */
  attrs: IattributeList;
  /** Inner XML, or null for an empty element (`<c r="A1"/>`). */
  inner: string | null;
};

/**
 * Call `fn` for every `<name>` element directly inside `xml[from, until)`
 * (elements of that name are assumed not to nest).
 */
export function scanElements(
  xml: string,
  name: string,
  fn: (el: ScannedElement) => void,
  from = 0,
  until = xml.length
) {
  const close = `</${name}>`;
  let i = nextStartTag(xml, name, from, until);
  while (i >= 0) {
    const end = tagEnd(xml, i);
    if (end < 0 || end > until) return;
    const selfClosing = xml.charCodeAt(end - 2) === 47;
    const attrs = parseAttributes(
      xml.slice(i + name.length + 1, selfClosing ? end - 2 : end - 1)
    );
    if (selfClosing) {
      fn({ attrs, inner: null });
      i = nextStartTag(xml, name, end, until);
    } else {
      let closeAt = xml.indexOf(close, end);
      if (closeAt < 0 || closeAt > until) closeAt = until;
      fn({ attrs, inner: xml.slice(end, closeAt) });
      i = nextStartTag(xml, name, closeAt + close.length, until);
    }
  }
}

/** Bounds of the content of the first `<name>` element, or null. */
export function elementContent(xml: string, name: string) {
  const start = nextStartTag(xml, name, 0, xml.length);
  if (start < 0) return null;
  const end = tagEnd(xml, start);
  if (end < 0 || xml.charCodeAt(end - 2) === 47) return null;
  const closeAt = xml.indexOf(`</${name}>`, end);
  return { from: end, until: closeAt < 0 ? xml.length : closeAt };
}

/** Rows of a worksheet's `<sheetData>`. */
export function scanRows(xml: string, fn: (row: ScannedElement) => void) {
  const data = elementContent(xml, "sheetData");
  if (!data) return;
  scanElements(xml, "row", fn, data.from, data.until);
}

/**
 * The first `<name>` child of a cell: its attributes and text, or null.
 * (`<v>`, `<f>` and `<is>` never nest inside themselves.)
 */
export function childElement(inner: string, name: string): ScannedElement {
  const at = nextStartTag(inner, name, 0, inner.length);
  if (at < 0) return null;
  const end = tagEnd(inner, at);
  if (end < 0) return null;
  const selfClosing = inner.charCodeAt(end - 2) === 47;
  const attrs =
    end - at > name.length + 2
      ? parseAttributes(
          inner.slice(at + name.length + 1, selfClosing ? end - 2 : end - 1)
        )
      : NO_ATTRIBUTES;
  if (selfClosing) return { attrs, inner: "" };
  const closeAt = inner.indexOf(`</${name}>`, end);
  return {
    attrs,
    inner: inner.slice(end, closeAt < 0 ? inner.length : closeAt),
  };
}

const MAIN_NAMESPACES = [
  "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
  "http://purl.oclc.org/ooxml/spreadsheetml/main",
];

/**
 * Some writers bind SpreadsheetML to a prefix (`<x:worksheet
 * xmlns:x="...main">`, `<x:row>`, `<x:c>`). The readers expect unprefixed
 * names, so the prefix is dropped from the part's element names.
 */
export function normalizeSpreadsheetNamespace(xml: string): string {
  if (typeof xml !== "string") return xml;
  const root = /<([A-Za-z_][\w.-]*):[A-Za-z_][\w.-]*[\s>/]/.exec(
    xml
      .slice(0, 2048)
      .replace(/<\?[\s\S]*?\?>/g, "")
      .replace(/<!--[\s\S]*?-->/g, "")
  );
  if (!root) return xml;
  const prefix = root[1];
  const declared = new RegExp(`xmlns:${prefix}\\s*=\\s*["']([^"']*)["']`).exec(
    xml.slice(0, 4096)
  );
  if (!declared || MAIN_NAMESPACES.indexOf(declared[1]) < 0) return xml;
  const tags = new RegExp(`<(/?)${prefix}:`, "g");
  return xml
    .replace(tags, "<$1")
    .replace(new RegExp(`xmlns:${prefix}(\\s*=)`), "xmlns$1");
}
