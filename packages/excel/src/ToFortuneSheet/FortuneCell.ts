import { IfortuneSheetborderInfoCellForImp } from "./IFortune";
import {
  ReadXml,
  Element,
  IStyleCollections,
  getColor,
  getlineStringAttr,
} from "./ReadXml";
import { formatValue } from "@lofcz/tinysheet-core";
import { getcellrange, escapeCharacter } from "../common/method";
import { fromExcelFormula } from "../common/formulaText";
import { ST_CellType, borderTypes } from "../common/constant";
import { IattributeList } from "../common/ICommon";
import {
  FortuneSheetborderInfoCellValueStyle,
  FortuneSheetborderInfoCellForImp,
  FortuneSheetborderInfoCellValue,
  FortuneSheetCelldataBase,
  FortuneSheetCelldataValue,
  FortuneSheetCellFormat,
} from "./FortuneBase";
import { childElement, ScannedElement } from "./xmlScan";

export type FortuneCellWorkbookInfo = {
  /** The workbook uses the 1904 date system (serials are shifted on import). */
  date1904?: boolean;
};

/** Days between the 1900 and 1904 date systems. */
const DATE1904_OFFSET = 1462;

/** Cell font attributes a rich-text run inherits when it does not set them. */
const INHERITED_RUN_KEYS = ["ff", "fc", "fs", "cl", "un", "bl", "it"];

const dateFormatCache = new Map<string, boolean>();

/** Whether a number format shows a date or time (first section). */
export function isDateFormat(fa: string | null | undefined) {
  if (!fa || /^general$/i.test(fa)) return false;
  let isDate = dateFormatCache.get(fa);
  if (isDate === undefined) {
    isDate = formatHasDate(fa) || formatHasTime(fa);
    if (dateFormatCache.size < 10000) dateFormatCache.set(fa, isDate);
  }
  return isDate;
}

/**
 * Display text of a number. Integers in General format print as they are
 * (the common case, and the slow path of the format engine); everything
 * else goes through core's formatValue.
 */
function displayNumber(format: string, num: number) {
  if (
    Number.isInteger(num) &&
    num > -1e10 &&
    num < 1e10 &&
    (format === "General" || format === "general") &&
    !Object.is(num, -0)
  ) {
    return String(num);
  }
  return formatValue(format, num);
}

function formatHasDate(fa: string) {
  const f = stripFormatLiterals(fa.split(";")[0]).toLowerCase();
  if (/[yd]/.test(f) || /(^|[^a-z])e+([^a-z]|$)/.test(f)) return true;
  const mm = f.replace(/h+[^a-z0-9]*m+/g, "").replace(/m+[^a-z0-9]*s/g, "");
  return /m/.test(mm);
}

function formatHasTime(fa: string) {
  const raw = fa.split(";")[0];
  if (/\[(h+|m+|s+)\]/i.test(raw)) return true;
  const f = stripFormatLiterals(raw).toLowerCase();
  return /[hs]/.test(f) || /am\/pm|a\/p/.test(f);
}

function stripFormatLiterals(fa: string) {
  return fa
    .replace(/"[^"]*"/g, "")
    .replace(/\\./g, "")
    .replace(/_./g, "")
    .replace(/\*./g, "")
    .replace(/\[[^\]]*\]/g, "");
}

/** "AB12" -> { r: 11, c: 27 }, or null. */
export function decodeCellRef(ref: string | undefined) {
  if (!ref) return null;
  let c = 0;
  let i = 0;
  const n = ref.length;
  for (; i < n; i += 1) {
    let ch = ref.charCodeAt(i);
    if (ch === 36) continue; // $
    if (ch >= 97 && ch <= 122) ch -= 32;
    if (ch < 65 || ch > 90) break;
    c = c * 26 + (ch - 64);
  }
  let r = 0;
  let digits = 0;
  for (; i < n; i += 1) {
    const ch = ref.charCodeAt(i);
    if (ch === 36 && digits === 0) continue;
    if (ch < 48 || ch > 57) return null;
    r = r * 10 + (ch - 48);
    digits += 1;
  }
  if (c === 0 || digits === 0 || r === 0) return null;
  return { r: r - 1, c: c - 1 };
}

/** `_xHHHH_` escapes (control characters) and XML line-break references. */
export function decodeCellText(text: string): string {
  if (text == null) return text;
  let out = text;
  if (out.indexOf("_x") >= 0) {
    out = out
      .replace(/_x000D_/g, "")
      .replace(/_x([0-9A-Fa-f]{4})_/g, (_m, h) =>
        String.fromCharCode(parseInt(h, 16))
      );
  }
  if (out.indexOf("&#") >= 0) {
    out = out
      .replace(/&#13;&#10;/g, "\r\n")
      .replace(/&#13;/g, "\r")
      .replace(/&#10;/g, "\n");
  }
  return out;
}

// ---------------------------------------------------------------------------
// Style records, resolved once per `s` index
// ---------------------------------------------------------------------------

type ResolvedStyle = {
  /** Number format code (escaped), when the style sets one. */
  fa?: string;
  /** Cell style properties in the order they are set. */
  props: [string, any][];
  border: {
    l?: FortuneSheetborderInfoCellValueStyle;
    r?: FortuneSheetborderInfoCellValueStyle;
    t?: FortuneSheetborderInfoCellValueStyle;
    b?: FortuneSheetborderInfoCellValueStyle;
  } | null;
  quotePrefix?: string;
};

const styleCaches = new WeakMap<
  IStyleCollections,
  Map<string, ResolvedStyle>
>();

function borderInfo(
  borders: Element[] | null,
  styles: IStyleCollections
): FortuneSheetborderInfoCellValueStyle {
  if (borders == null) return null;
  const border = borders[0];
  const style: string = border.attributeList.style;
  if (style == null || style == "none") return null;
  const colors = border.getInnerElements("color");
  let colorRet = "#000000";
  if (colors != null) {
    colorRet = getColor(colors[0], styles, "b") ?? "#000000";
  }
  const ret = new FortuneSheetborderInfoCellValueStyle();
  ret.style = borderTypes[style];
  ret.color = colorRet;
  return ret;
}

function backgroundOfFill(
  fill: Element | undefined,
  styles: IStyleCollections
): string | null {
  if (fill == null) return null;
  const patternFills = fill.getInnerElements("patternFill");
  if (patternFills != null) {
    const patternFill = patternFills[0];
    const fgColors = patternFill.getInnerElements("fgColor");
    const bgColors = patternFill.getInnerElements("bgColor");
    let fg;
    let bg;
    if (fgColors != null) fg = getColor(fgColors[0], styles);
    if (bgColors != null) bg = getColor(bgColors[0], styles);
    if (fg != null) return fg;
    if (bg != null) return bg;
  }
  // gradient fills are not supported
  return null;
}

const HORIZONTAL: Record<string, number> = {
  center: 0,
  centerContinuous: 0,
  left: 1,
  right: 2,
  distributed: 0,
  fill: 1,
  general: 1,
  justify: 0,
};

const VERTICAL: Record<string, number> = {
  bottom: 2,
  center: 0,
  distributed: 0,
  justify: 0,
  top: 1,
};

const isTrue = (v: any) => v == "1" || v == "true";

const lookup = (map: Record<string, number>, key: string, fallback: number) =>
  Object.prototype.hasOwnProperty.call(map, key) ? map[key] : fallback;

function resolveStyle(s: string, styles: IStyleCollections): ResolvedStyle {
  const cellXfs = styles["cellXfs"] as Element[];
  const cellStyleXfs = styles["cellStyleXfs"] as Element[];
  const fonts = styles["fonts"] as Element[];
  const fills = styles["fills"] as Element[];
  const borders = styles["borders"] as Element[];
  const numfmts = styles["numfmts"] as IattributeList;

  const sNum = parseInt(s);
  const cellXf = cellXfs[sNum] ?? cellXfs[0] ?? new Element("<xf/>");
  const xfId = cellXf.attributeList.xfId;

  let numFmtId, fontId, fillId, borderId;
  let horizontal,
    vertical,
    wrapText,
    textRotation,
    shrinkToFit,
    indent,
    applyProtection,
    locked,
    formulaHidden,
    quotePrefix;
  // <protection locked=".." hidden=".."/> of a style record
  const readProtection = (xf: Element) => {
    const protection = xf.getInnerElements("protection");
    if (protection == null || protection.length === 0) return;
    const attrs = protection[0].attributeList;
    if (attrs.locked != null) locked = attrs.locked;
    if (attrs.hidden != null) formulaHidden = attrs.hidden;
  };
  const readAlignment = (xf: Element) => {
    const alignment = xf.getInnerElements("alignment");
    if (alignment == null || alignment.length === 0) return;
    const a = alignment[0].attributeList;
    if (a.horizontal != null) horizontal = a.horizontal;
    if (a.vertical != null) vertical = a.vertical;
    if (a.wrapText != null) wrapText = a.wrapText;
    if (a.textRotation != null) textRotation = a.textRotation;
    if (a.shrinkToFit != null) shrinkToFit = a.shrinkToFit;
    if (a.indent != null) indent = a.indent;
  };

  if (xfId != null) {
    const cellStyleXf = cellStyleXfs[parseInt(xfId)] ?? new Element("<xf/>");
    const a = cellStyleXf.attributeList;
    applyProtection = a.applyProtection;
    quotePrefix = a.quotePrefix;
    if (applyProtection != null && applyProtection != "0") {
      readProtection(cellStyleXf);
    }
    if (a.applyNumberFormat != "0" && a.numFmtId != null) numFmtId = a.numFmtId;
    if (a.applyFont != "0" && a.fontId != null) fontId = a.fontId;
    if (a.applyFill != "0" && a.fillId != null) fillId = a.fillId;
    if (a.applyBorder != "0" && a.borderId != null) borderId = a.borderId;
    if (a.applyAlignment != null && a.applyAlignment != "0") {
      readAlignment(cellStyleXf);
    }
  }

  const x = cellXf.attributeList;
  if (x.applyProtection != null) applyProtection = x.applyProtection;
  if (applyProtection != "0") readProtection(cellXf);
  if (x.quotePrefix != null) quotePrefix = x.quotePrefix;
  if (x.applyNumberFormat != "0" && x.numFmtId != null) numFmtId = x.numFmtId;
  if (x.applyFont != "0") fontId = x.fontId;
  if (x.applyFill != "0") fillId = x.fillId;
  if (x.applyBorder != "0") borderId = x.borderId;
  if (x.applyAlignment != "0") readAlignment(cellXf);

  const out: ResolvedStyle = { props: [], border: null, quotePrefix };
  const set = (key: string, value: any) => out.props.push([key, value]);

  if (numFmtId != undefined) {
    const numf = numfmts[parseInt(numFmtId)];
    out.fa = numf != null ? escapeCharacter(numf) : "General";
  }

  if (fillId != undefined) {
    const bg = backgroundOfFill(fills[parseInt(fillId)], styles);
    if (bg != null) set("bg", bg);
  }

  const font = fontId != undefined ? fonts[parseInt(fontId)] : null;
  if (font != null) {
    const sz = font.getInnerElements("sz");
    const colors = font.getInnerElements("color");
    const family = font.getInnerElements("name");
    const bolds = font.getInnerElements("b");
    const italics = font.getInnerElements("i");
    const strikes = font.getInnerElements("strike");
    const underlines = font.getInnerElements("u");
    if (sz != null && sz.length > 0 && sz[0].attributeList.val != null) {
      set("fs", parseFloat(sz[0].attributeList.val));
    }
    if (colors != null && colors.length > 0) {
      const fc = getColor(colors[0], styles, "t");
      if (fc != null) set("fc", fc);
    }
    if (family != null && family.length > 0) {
      const val = family[0].attributeList.val;
      if (val != null) set("ff", val);
    }
    if (bolds != null && bolds.length > 0) {
      set("bl", bolds[0].attributeList.val == "0" ? 0 : 1);
    }
    if (italics != null && italics.length > 0) {
      set("it", italics[0].attributeList.val == "0" ? 0 : 1);
    }
    if (strikes != null && strikes.length > 0) {
      set("cl", strikes[0].attributeList.val == "0" ? 0 : 1);
    }
    if (underlines != null && underlines.length > 0) {
      const u = underlines[0].attributeList.val;
      if (u == null || u == "single") set("un", 1);
      else if (u == "double") set("un", 2);
      else if (u == "singleAccounting") set("un", 3);
      else if (u == "doubleAccounting") set("un", 4);
      else set("un", 0);
    }
  }

  if (horizontal != undefined) set("ht", lookup(HORIZONTAL, horizontal, 1));
  // sometimes the bottom style is lost after setting it in Excel: an
  // unset vertical alignment is bottom
  set("vt", vertical != undefined ? lookup(VERTICAL, vertical, 1) : 2);
  set("tb", wrapText != undefined && wrapText == "1" ? "2" : "1");
  if (textRotation != undefined) {
    if (textRotation == "255") {
      set("tr", "3");
    } else {
      set("tr", "0");
      set("rt", parseInt(textRotation));
    }
  }
  if (shrinkToFit != undefined && isTrue(shrinkToFit)) set("sk", 1);
  if (indent != undefined) {
    const level = parseInt(indent, 10);
    if (level > 0) set("ind", Math.min(level, 250));
  }
  // Excel cells are locked unless the style says otherwise
  if (locked != undefined && !isTrue(locked)) set("lo", 0);
  if (formulaHidden != undefined && isTrue(formulaHidden)) set("hi", 1);

  const border = borderId != undefined ? borders[parseInt(borderId)] : null;
  if (border != null) {
    const sides: ResolvedStyle["border"] = {};
    const pick = (tag: string) =>
      borderInfo(border.getInnerElements(tag), styles);
    const start = pick("start");
    const end = pick("end");
    const left = pick("left");
    const right = pick("right");
    const top = pick("top");
    const bottom = pick("bottom");
    if (start?.color != null) sides.l = start;
    if (end?.color != null) sides.r = end;
    if (left?.color != null) sides.l = left;
    if (right?.color != null) sides.r = right;
    if (top?.color != null) sides.t = top;
    if (bottom?.color != null) sides.b = bottom;
    if (Object.keys(sides).length) out.border = sides;
  }
  return out;
}

function cachedStyle(s: string, styles: IStyleCollections): ResolvedStyle {
  let cache = styleCaches.get(styles);
  if (!cache) {
    cache = new Map();
    styleCaches.set(styles, cache);
  }
  let style = cache.get(s);
  if (!style) {
    style = resolveStyle(s, styles);
    cache.set(s, style);
  }
  return style;
}

// ---------------------------------------------------------------------------
// Shared strings, parsed once per index
// ---------------------------------------------------------------------------

type ParsedRun = { v?: string; own: Record<string, any> | null };
type ParsedString =
  | { rich: false; text: string }
  | { rich: true; runs: ParsedRun[] };

const stringCaches = new WeakMap<Element[], ParsedString[]>();

function parseStringItem(si: Element, styles: IStyleCollections): ParsedString {
  // Phonetic runs (<rPh>) are not part of the text.
  const item =
    si.elementString.indexOf("<rPh") >= 0
      ? new Element(si.elementString.replace(/<rPh\b[\s\S]*?<\/rPh>/g, ""))
      : si;
  const rFlag = item.getInnerElements("r");
  if (rFlag == null) {
    const tFlag = item.getInnerElements("t");
    let text = "";
    if (tFlag != null) {
      tFlag.forEach((tt) => {
        text += tt.value;
      });
    }
    return { rich: false, text: decodeCellText(escapeCharacter(text)) };
  }
  const runs = rFlag.map((r) => {
    const run: ParsedRun = { own: null };
    const tFlag = r.getInnerElements("t");
    if (tFlag != null && tFlag.length > 0) {
      run.v = decodeCellText(escapeCharacter(tFlag[0].value)).replace(
        /\r?\n/g,
        "\r\n"
      );
    }
    const rPr = r.getInnerElements("rPr");
    if (rPr != null && rPr.length > 0) {
      const frpr = rPr[0];
      const own: Record<string, any> = {};
      const sz = getlineStringAttr(frpr, "sz");
      const rFont = getlineStringAttr(frpr, "rFont");
      const b = getlineStringAttr(frpr, "b");
      const i = getlineStringAttr(frpr, "i");
      const u = getlineStringAttr(frpr, "u");
      const strike = getlineStringAttr(frpr, "strike");
      const vertAlign = getlineStringAttr(frpr, "vertAlign");
      let color;
      const cEle = frpr.getInnerElements("color");
      if (cEle != null && cEle.length > 0) {
        color = getColor(cEle[0], styles, "t");
      }
      if (rFont != null) own.ff = rFont;
      if (color != null) own.fc = color;
      if (sz != null) own.fs = parseFloat(sz);
      if (strike != null) own.cl = parseInt(strike);
      if (u != null) own.un = parseInt(u);
      if (b != null) own.bl = parseInt(b);
      if (i != null) own.it = parseInt(i);
      if (vertAlign != null) own.va = parseInt(vertAlign);
      run.own = own;
    }
    return run;
  });
  return { rich: true, runs };
}

function sharedString(
  index: number,
  sharedStrings: Element[],
  styles: IStyleCollections
): ParsedString | null {
  let cache = stringCaches.get(sharedStrings);
  if (!cache) {
    cache = new Array(sharedStrings.length);
    stringCaches.set(sharedStrings, cache);
  }
  let parsed = cache[index];
  if (parsed === undefined) {
    const si = sharedStrings[index];
    parsed = si != null ? parseStringItem(si, styles) : null;
    cache[index] = parsed;
  }
  return parsed;
}

/** Put a (shared or inline) string item into a cell value. */
function assignParsedString(cellValue: any, parsed: ParsedString) {
  const ct = cellValue.ct ?? ({} as FortuneSheetCellFormat);
  ct.fa = ct.fa ?? "General";
  cellValue.ct = ct;
  if (!parsed.rich) {
    const { text } = parsed as { rich: false; text: string };
    if (text.indexOf("\n") > -1) {
      const run: any = { v: text.replace(/\r?\n/g, "\r\n") };
      for (const key of INHERITED_RUN_KEYS) {
        if (cellValue[key] != null) run[key] = cellValue[key];
      }
      ct.t = "inlineStr";
      ct.s = [run];
    } else {
      cellValue.v = text;
      cellValue.m = text;
      ct.t = ct.fa === "@" ? "s" : "g";
      // Keep numeric-looking text as text when edited.
      cellValue.qp = 1;
    }
    return;
  }
  ct.t = "inlineStr";
  ct.s = (parsed as { runs: ParsedRun[] }).runs.map((run) => {
    const out: any = {};
    if (run.v !== undefined) out.v = run.v;
    if (run.own) {
      for (const key of INHERITED_RUN_KEYS) {
        const own = run.own[key];
        if (own != null) out[key] = own;
        else if (cellValue[key] != null) out[key] = cellValue[key];
      }
      if (run.own.va != null) out.va = run.own.va;
    } else {
      for (const key of INHERITED_RUN_KEYS) {
        if (cellValue[key] != null) out[key] = cellValue[key];
      }
    }
    return out;
  });
}

/** A `<c>` element as read by the fast sheet scanner. */
export type RawCell = ScannedElement;

export class FortuneSheetCelldata extends FortuneSheetCelldataBase {
  _borderObject: IfortuneSheetborderInfoCellForImp;
  _fomulaRef: string;
  _formulaSi: string;
  _formulaType: string;
  /** `ref` of an array formula master (`<f t="array" ref=...>`). */
  _arrayRef: string;
  /** The array formula carries dynamic-array cell metadata (`cm`). */
  _dynamicArray: boolean;

  /**
   * @param cell The `<c>` element (a ReadXml Element or a scanned cell).
   * @param position Used when the cell has no (valid) `r` attribute.
   */
  constructor(
    cell: Element | RawCell,
    styles: IStyleCollections,
    sharedStrings: Element[],
    _mergeCells?: Element[],
    _sheetFile?: string,
    _readXml?: ReadXml,
    workbookInfo: FortuneCellWorkbookInfo = {},
    position?: { r: number; c: number }
  ) {
    super();
    let attrs: IattributeList;
    let inner: string | null;
    if (cell instanceof Element) {
      attrs = cell.attributeList;
      inner = cell.elementString.endsWith("/>") ? null : cell.value;
    } else {
      attrs = cell.attrs;
      inner = cell.inner;
    }
    const ref = decodeCellRef(attrs.r) ??
      (attrs.r != null ? toPosition(getcellrange(attrs.r)) : null) ??
      position ?? { r: 0, c: 0 };
    this.r = ref.r;
    this.c = ref.c;
    this.v = this.generateValue(
      attrs,
      inner,
      styles,
      sharedStrings,
      workbookInfo
    );
  }

  private generateValue(
    attrs: IattributeList,
    inner: string | null,
    styles: IStyleCollections,
    sharedStrings: Element[],
    workbookInfo: FortuneCellWorkbookInfo
  ) {
    const s = attrs.s;
    const t = attrs.t;
    const cellValue = {} as FortuneSheetCelldataValue;
    const v = inner ? childElement(inner, "v") : null;
    const f = inner ? childElement(inner, "f") : null;

    if (f != null) {
      const ft = f.attrs.t;
      if (ft == "shared") {
        this._fomulaRef = f.attrs.ref;
        this._formulaType = ft;
        this._formulaSi = f.attrs.si;
      } else if (ft == "array" && f.attrs.ref != null) {
        this._formulaType = ft;
        this._arrayRef = f.attrs.ref;
        this._dynamicArray = attrs.cm != null;
      }
      if (f.inner != null && f.inner.length > 0) {
        cellValue.f = fromExcelFormula(escapeCharacter(f.inner));
      }
    }

    let quotePrefix;
    if (s != null) {
      const style = cachedStyle(s, styles);
      if (style.fa !== undefined) {
        const cellFormat = {} as FortuneSheetCellFormat;
        cellFormat.fa = style.fa;
        cellValue.ct = cellFormat;
      }
      const target = cellValue as any;
      for (let i = 0; i < style.props.length; i += 1) {
        target[style.props[i][0]] = style.props[i][1];
      }
      if (style.border) {
        const borderObject = new FortuneSheetborderInfoCellForImp();
        borderObject.rangeType = "cell";
        const value = new FortuneSheetborderInfoCellValue();
        value.row_index = this.r;
        value.col_index = this.c;
        Object.assign(value, style.border);
        borderObject.value = value;
        this._borderObject = borderObject;
      }
      quotePrefix = style.quotePrefix;
    } else {
      cellValue.tb = "1";
    }

    this.assignValue(
      cellValue,
      t,
      v,
      inner,
      styles,
      sharedStrings,
      workbookInfo
    );

    if (quotePrefix != null) {
      cellValue.qp = parseInt(quotePrefix);
    }
    return cellValue;
  }

  /** Cell value (v / m / ct) from the cell's type and `<v>` / `<is>`. */
  private assignValue(
    cellValue: FortuneSheetCelldataValue,
    t: string,
    v: ScannedElement | null,
    inner: string | null,
    styles: IStyleCollections,
    sharedStrings: Element[],
    workbookInfo: FortuneCellWorkbookInfo
  ) {
    const fa = cellValue.ct?.fa;
    const setType = (type: string, format?: string) => {
      const ct = cellValue.ct ?? ({} as FortuneSheetCellFormat);
      ct.fa = format ?? ct.fa ?? "General";
      ct.t = type;
      cellValue.ct = ct;
    };

    if (t == ST_CellType["SharedString"]) {
      if (v == null) return;
      const parsed = sharedString(parseInt(v.inner), sharedStrings, styles);
      if (parsed != null) assignParsedString(cellValue, parsed);
      return;
    }

    if (t == ST_CellType["InlineString"]) {
      const is = inner ? childElement(inner, "is") : null;
      if (is != null) {
        const item = new Element(`<is>${is.inner ?? ""}</is>`);
        assignParsedString(cellValue, parseStringItem(item, styles));
      }
      return;
    }

    const raw = v == null ? null : escapeCharacter(v.inner ?? "");

    // No value; generators (openpyxl/XlsxWriter) also often emit `<v></v>`
    // for formulas that were never calculated: leave `v` unset so the
    // formula is evaluated.
    if (raw == null || (raw === "" && cellValue.f != null)) {
      if (cellValue.ct != null && cellValue.ct.t == null) cellValue.ct.t = "n";
      return;
    }

    if (t == ST_CellType["Boolean"]) {
      const b = raw === "1" || raw.toUpperCase() === "TRUE";
      cellValue.v = b as any;
      cellValue.m = b ? "TRUE" : "FALSE";
      setType("b", "General");
      return;
    }
    if (t == ST_CellType["Error"]) {
      cellValue.v = raw;
      cellValue.m = raw;
      setType("e");
      return;
    }
    if (t == ST_CellType["String"]) {
      const text = decodeCellText(raw);
      cellValue.v = text;
      cellValue.m = text;
      setType(fa === "@" ? "s" : "g");
      return;
    }

    // Numbers (t="n" or no type) and ISO dates (t="d").
    let num = Number(raw);
    if (t == ST_CellType["Date"] && isNaN(num)) {
      const ms = Date.parse(raw);
      if (!isNaN(ms)) num = ms / 86400000 + 25569;
    }
    if (raw.trim() === "" || !isFinite(num)) {
      cellValue.v = raw;
      setType("g");
      return;
    }
    const format = fa ?? "General";
    const isDate = isDateFormat(format);
    if (isDate && workbookInfo.date1904) num += DATE1904_OFFSET;
    cellValue.v = num as any;
    cellValue.m = displayNumber(format, num);
    setType(isDate ? "d" : "n", format);
  }
}

function toPosition(range: any): { r: number; c: number } | null {
  if (!range) return null;
  const r = range.row?.[0];
  const c = range.column?.[0];
  return Number.isInteger(r) && Number.isInteger(c) && r >= 0 && c >= 0
    ? { r, c }
    : null;
}
