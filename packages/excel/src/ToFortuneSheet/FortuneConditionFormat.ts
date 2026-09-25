import { parseSqref, makeDataBar } from "@lofcz/tinysheet-core";
import type {
  CFColorScaleStop,
  CFIconSetName,
  CFRule,
  CFStyle,
  CFValueObject,
} from "@lofcz/tinysheet-core";
import { ReadXml, IStyleCollections, Element, getColor } from "./ReadXml";
import { stylesFile } from "../common/constant";

/*
 * Conditional formatting from xlsx: <conditionalFormatting> rules of a sheet,
 * their Excel 2010 extensions (<x14:conditionalFormatting>: data bar
 * negative/axis settings, extra icon sets) and the differential styles
 * (<dxfs>) of styles.xml. A small XML reader keeps this independent of
 * DOMParser (the importer also runs under Node).
 */

export interface XNode {
  name: string;
  local: string;
  attrs: Record<string, string>;
  children: XNode[];
  text: string;
}

function decode(s: string) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (m, e) => {
    const k = e.toLowerCase();
    if (k === "amp") return "&";
    if (k === "lt") return "<";
    if (k === "gt") return ">";
    if (k === "quot") return '"';
    if (k === "apos") return "'";
    if (k.startsWith("#x"))
      return String.fromCharCode(parseInt(k.slice(2), 16));
    if (k.startsWith("#")) return String.fromCharCode(parseInt(k.slice(1), 10));
    return m;
  });
}

const TOKEN_RE =
  /<!\[CDATA\[([\s\S]*?)\]\]>|<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<(\/?)([\w:.-]+)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g;
const ATTR_RE = /([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

/** Parse an XML fragment into a tree (the returned root has no name). */
export function parseXmlTree(xml: string): XNode {
  const root: XNode = {
    name: "",
    local: "",
    attrs: {},
    children: [],
    text: "",
  };
  const stack: XNode[] = [root];
  TOKEN_RE.lastIndex = 0;
  let m: RegExpExecArray | null = TOKEN_RE.exec(xml);
  while (m) {
    const top = stack[stack.length - 1];
    if (m[1] !== undefined) {
      top.text += m[1];
    } else if (m[3]) {
      if (m[2] === "/") {
        if (stack.length > 1) stack.pop();
      } else {
        const attrs: Record<string, string> = {};
        ATTR_RE.lastIndex = 0;
        let a: RegExpExecArray | null = ATTR_RE.exec(m[4] ?? "");
        while (a) {
          attrs[a[1]] = decode(a[2] ?? a[3] ?? "");
          a = ATTR_RE.exec(m[4] ?? "");
        }
        const name = m[3];
        const node: XNode = {
          name,
          local: name.includes(":") ? name.split(":")[1] : name,
          attrs,
          children: [],
          text: "",
        };
        top.children.push(node);
        if (m[5] !== "/") stack.push(node);
      }
    } else if (m[6] !== undefined) {
      top.text += decode(m[6]);
    }
    m = TOKEN_RE.exec(xml);
  }
  return root;
}

function kids(node: XNode | undefined, local: string) {
  return (node?.children ?? []).filter((c) => c.local === local);
}

function kid(node: XNode | undefined, local: string) {
  return node?.children.find((c) => c.local === local);
}

function bool(v: string | undefined, fallback: boolean) {
  if (v === undefined) return fallback;
  return v === "1" || v === "true";
}

export type CFColorResolver = (
  attrs: Record<string, string>
) => string | undefined;

/** rgb / indexed / theme+tint colours; themes need the workbook's resolver. */
function colorOf(node: XNode | undefined, resolve?: CFColorResolver) {
  if (!node) return undefined;
  if (resolve) {
    const c = resolve(node.attrs);
    if (c) return c.toUpperCase();
  }
  const { rgb } = node.attrs;
  if (rgb) return `#${rgb.slice(-6).toUpperCase()}`;
  return undefined;
}

/** Differential formats (<dxfs>) of styles.xml as CFStyle list. */
export function readDxfStyles(stylesXml: string, resolve?: CFColorResolver) {
  const m = /<dxfs\b[\s\S]*?<\/dxfs>/.exec(stylesXml ?? "");
  if (!m) return [] as CFStyle[];
  const dxfs = kid(parseXmlTree(m[0]), "dxfs");
  return kids(dxfs, "dxf").map((dxf) => {
    const style: CFStyle = {};
    const font = kid(dxf, "font");
    if (font) {
      const on = (local: string) => {
        const n = kid(font, local);
        return !!n && n.attrs.val !== "0" && n.attrs.val !== "false";
      };
      if (on("b")) style.bold = true;
      if (on("i")) style.italic = true;
      if (on("strike")) style.strikethrough = true;
      const u = kid(font, "u");
      if (u && u.attrs.val !== "none") style.underline = true;
      const color = colorOf(kid(font, "color"), resolve);
      if (color) style.textColor = color;
    }
    const pattern = kid(kid(dxf, "fill"), "patternFill");
    if (pattern && pattern.attrs.patternType !== "none") {
      const color =
        colorOf(kid(pattern, "bgColor"), resolve) ??
        colorOf(kid(pattern, "fgColor"), resolve);
      if (color) style.cellColor = color;
    }
    const border = kid(dxf, "border");
    if (border) {
      const side = ["left", "right", "top", "bottom"]
        .map((s) => kid(border, s))
        .find((s) => s && s.attrs.style && s.attrs.style !== "none");
      if (side)
        style.borderColor = colorOf(kid(side, "color"), resolve) ?? "#000000";
    }
    const numFmt = kid(dxf, "numFmt");
    if (numFmt?.attrs.formatCode) style.numberFormat = numFmt.attrs.formatCode;
    return style;
  });
}

const AUTO_MIN_RE = /^MIN\(0,MIN\([^()]*\)\)$/i;
const AUTO_MAX_RE = /^MAX\(0,MAX\([^()]*\)\)$/i;

function readCfvo(node: XNode): CFValueObject {
  const type = (node.attrs.type ?? "min") as CFValueObject["type"];
  // x14:cfvo keeps its value in <xm:f>
  const raw = node.attrs.val ?? kid(node, "f")?.text;
  const out: CFValueObject = { type };
  if (type === "formula") {
    const f = `${raw ?? ""}`.trim();
    if (AUTO_MIN_RE.test(f)) return { type: "autoMin" };
    if (AUTO_MAX_RE.test(f)) return { type: "autoMax" };
    out.value = `=${f}`;
  } else if (raw !== undefined && raw !== "") {
    const n = Number(raw);
    out.value = Number.isNaN(n) ? `=${raw}` : n;
  }
  if (node.attrs.gte !== undefined) out.gte = bool(node.attrs.gte, true);
  return out;
}

function operandFromFormula(f: string | undefined): any {
  const s = `${f ?? ""}`.trim();
  if (s === "") return "";
  if (!Number.isNaN(Number(s))) return Number(s);
  const q = /^"((?:[^"]|"")*)"$/.exec(s);
  if (q) return q[1].replace(/""/g, '"');
  return `=${s}`;
}

function textOperand(rule: XNode) {
  if (rule.attrs.text !== undefined) return rule.attrs.text;
  const f = kid(rule, "formula")?.text ?? "";
  const q = /"((?:[^"]|"")*)"/.exec(f);
  return q ? q[1].replace(/""/g, '"') : "";
}

const CELL_IS = new Set([
  "greaterThan",
  "lessThan",
  "greaterThanOrEqual",
  "lessThanOrEqual",
  "equal",
  "notEqual",
  "between",
  "notBetween",
]);

function highlightOf(rule: XNode): Partial<CFRule> | null {
  const { type } = rule.attrs;
  const formulas = kids(rule, "formula").map((f) => f.text);
  switch (type) {
    case "cellIs": {
      const op = rule.attrs.operator ?? "equal";
      if (!CELL_IS.has(op)) return null;
      return {
        conditionName: op as CFRule["conditionName"],
        conditionValue: formulas.map(operandFromFormula),
      };
    }
    case "expression":
      return {
        conditionName: "formula",
        conditionValue: [`=${formulas[0] ?? ""}`],
      };
    case "containsText":
      return {
        conditionName: "textContains",
        conditionValue: [textOperand(rule)],
      };
    case "notContainsText":
      return {
        conditionName: "textNotContains",
        conditionValue: [textOperand(rule)],
      };
    case "beginsWith":
      return {
        conditionName: "textBeginsWith",
        conditionValue: [textOperand(rule)],
      };
    case "endsWith":
      return {
        conditionName: "textEndsWith",
        conditionValue: [textOperand(rule)],
      };
    case "containsBlanks":
      return { conditionName: "blanks", conditionValue: [] };
    case "notContainsBlanks":
      return { conditionName: "noBlanks", conditionValue: [] };
    case "containsErrors":
      return { conditionName: "errors", conditionValue: [] };
    case "notContainsErrors":
      return { conditionName: "noErrors", conditionValue: [] };
    case "timePeriod":
      return {
        conditionName: "occurrenceDate",
        conditionValue: [rule.attrs.timePeriod ?? "today"],
      };
    case "duplicateValues":
      return { conditionName: "duplicateValue", conditionValue: ["0"] };
    case "uniqueValues":
      return { conditionName: "duplicateValue", conditionValue: ["1"] };
    case "top10": {
      const percent = bool(rule.attrs.percent, false);
      const bottom = bool(rule.attrs.bottom, false);
      return {
        conditionName: `${bottom ? "last10" : "top10"}${
          percent ? "_percent" : ""
        }` as CFRule["conditionName"],
        conditionValue: [Number(rule.attrs.rank ?? 10)],
      };
    }
    case "aboveAverage": {
      const above = bool(rule.attrs.aboveAverage, true);
      const out: Partial<CFRule> = {
        conditionName: above ? "aboveAverage" : "belowAverage",
        conditionValue: [],
      };
      if (bool(rule.attrs.equalAverage, false)) out.equalAverage = true;
      const sd = Number(rule.attrs.stdDev ?? 0);
      if (sd > 0) out.stdDev = sd;
      return out;
    }
    default:
      return null;
  }
}

interface Parsed {
  priority: number;
  rule: CFRule;
  extId?: string;
}

const ICON_SETS = new Set<string>([
  "3Arrows",
  "3ArrowsGray",
  "3Flags",
  "3TrafficLights1",
  "3TrafficLights2",
  "3Signs",
  "3Symbols",
  "3Symbols2",
  "3Stars",
  "3Triangles",
  "4Arrows",
  "4ArrowsGray",
  "4RedToBlack",
  "4Rating",
  "4TrafficLights",
  "5Arrows",
  "5ArrowsGray",
  "5Rating",
  "5Quarters",
  "5Boxes",
]);

function iconSetOf(node: XNode) {
  let name = node.attrs.iconSet ?? "3TrafficLights1";
  if (name === "3TrafficLights") name = "3TrafficLights1";
  if (!ICON_SETS.has(name)) return null;
  const cfvos = kids(node, "cfvo").map(readCfvo);
  return {
    name: name as CFIconSetName,
    thresholds: cfvos.slice(1).map((c) => ({ ...c, gte: c.gte !== false })),
    reverse: bool(node.attrs.reverse, false) || undefined,
    showValue: bool(node.attrs.showValue, true) ? undefined : false,
  };
}

/**
 * Rules of one worksheet XML, in TinySheet order (ascending priority).
 * `dxfs` comes from readDxfStyles; `resolve` turns theme/indexed colours
 * into hex.
 */
export function readConditionalFormats(
  sheetXml: string,
  dxfs: CFStyle[],
  resolve?: CFColorResolver
): CFRule[] {
  if (!sheetXml || sheetXml.indexOf("conditionalFormatting") < 0) return [];
  const parsed: Parsed[] = [];
  const byExtId = new Map<string, Parsed>();

  const blocks =
    sheetXml.match(
      /<conditionalFormatting\b[\s\S]*?<\/conditionalFormatting>/g
    ) ?? [];
  blocks.forEach((block) => {
    const cf = kid(parseXmlTree(block), "conditionalFormatting");
    const ranges = parseSqref(cf?.attrs.sqref ?? "");
    if (!cf || !ranges) return;
    kids(cf, "cfRule").forEach((node) => {
      const priority = Number(node.attrs.priority ?? 0);
      const stopIfTrue = bool(node.attrs.stopIfTrue, false) || undefined;
      const extId = kid(kid(kid(node, "extLst"), "ext"), "id")?.text?.trim();
      let rule: CFRule | null = null;
      const { type } = node.attrs;
      if (type === "colorScale") {
        const scale = kid(node, "colorScale");
        const cfvos = kids(scale, "cfvo").map(readCfvo);
        const colors = kids(scale, "color").map(
          (c) => colorOf(c, resolve) ?? "#FFFFFF"
        );
        const stops: CFColorScaleStop[] = cfvos.map((c, i) => ({
          type: c.type,
          ...(c.value !== undefined ? { value: c.value } : {}),
          color: colors[i] ?? "#FFFFFF",
        }));
        if (stops.length >= 2) {
          rule = {
            type: "colorGradation",
            cellrange: ranges,
            colorScale: { stops },
          };
        }
      } else if (type === "dataBar") {
        const bar = kid(node, "dataBar");
        const cfvos = kids(bar, "cfvo").map(readCfvo);
        const color = colorOf(kid(bar, "color"), resolve) ?? "#638EC6";
        // Excel 2007 bars; the x14 extension below upgrades them
        rule = {
          type: "dataBar",
          cellrange: ranges,
          format: [color],
          dataBar: makeDataBar(color, true, {
            border: false,
            min: cfvos[0] ?? { type: "min" },
            max: cfvos[1] ?? { type: "max" },
            minLength: Number(bar?.attrs.minLength ?? 10),
            maxLength: Number(bar?.attrs.maxLength ?? 90),
            showValue: bool(bar?.attrs.showValue, true),
          }),
        };
      } else if (type === "iconSet") {
        const set = iconSetOf(kid(node, "iconSet")!);
        if (set) rule = { type: "icons", cellrange: ranges, iconSet: set };
      } else {
        const hl = highlightOf(node);
        if (hl) {
          const { dxfId } = node.attrs;
          const format = dxfId !== undefined ? dxfs[Number(dxfId)] ?? {} : {};
          rule = {
            type: "default",
            cellrange: ranges,
            conditionRange: [],
            format,
            ...hl,
          };
        }
      }
      if (!rule) return;
      if (stopIfTrue && rule.type === "default") rule.stopIfTrue = true;
      const p: Parsed = { priority, rule, extId };
      parsed.push(p);
      if (extId) byExtId.set(extId, p);
    });
  });

  // Excel 2010 extensions
  const ext =
    /<(\w+:)?conditionalFormattings\b[\s\S]*?<\/(\w+:)?conditionalFormattings>/.exec(
      sheetXml
    );
  if (ext) {
    const root = kid(parseXmlTree(ext[0]), "conditionalFormattings");
    kids(root, "conditionalFormatting").forEach((cf) => {
      const ranges = parseSqref(kid(cf, "sqref")?.text ?? "");
      kids(cf, "cfRule").forEach((node) => {
        const id = node.attrs.id?.trim();
        const bar = kid(node, "dataBar");
        const target = id ? byExtId.get(id) : undefined;
        if (bar && target?.rule.dataBar) {
          const db = target.rule.dataBar;
          const cfvos = kids(bar, "cfvo").map(readCfvo);
          const same = bool(bar.attrs.negativeBarColorSameAsPositive, false);
          const axis: Record<string, "automatic" | "midpoint" | "none"> = {
            automatic: "automatic",
            middle: "midpoint",
            none: "none",
          };
          const border = bool(bar.attrs.border, false);
          target.rule.dataBar = {
            ...db,
            gradient: bool(bar.attrs.gradient, true),
            border,
            borderColor: colorOf(kid(bar, "borderColor"), resolve) ?? db.color,
            negativeColor:
              colorOf(kid(bar, "negativeFillColor"), resolve) ?? "#FF0000",
            negativeBorderColor:
              colorOf(kid(bar, "negativeBorderColor"), resolve) ?? "#FF0000",
            sameNegativeColor: same,
            axisPosition:
              axis[bar.attrs.axisPosition ?? "automatic"] ?? "automatic",
            axisColor: colorOf(kid(bar, "axisColor"), resolve) ?? "#000000",
            direction: (bar.attrs.direction as any) ?? "context",
            minLength: Number(bar.attrs.minLength ?? 0),
            maxLength: Number(bar.attrs.maxLength ?? 100),
            min: cfvos[0] ?? db.min,
            max: cfvos[1] ?? db.max,
          };
          return;
        }
        const iconSet = kid(node, "iconSet");
        if (iconSet && ranges && node.attrs.type === "iconSet") {
          const set = iconSetOf(iconSet);
          if (set) {
            parsed.push({
              priority: Number(node.attrs.priority ?? 0),
              rule: { type: "icons", cellrange: ranges, iconSet: set },
            });
          }
        }
      });
    });
  }

  // priority 1 is Excel's highest; TinySheet's highest is the last rule
  return parsed
    .map((p, i) => ({ ...p, i }))
    .sort((a, b) => b.priority - a.priority || b.i - a.i)
    .map((p) => p.rule);
}

function fileByName(files: Record<string, string>, name: string) {
  const key = Object.keys(files ?? {}).find((k) => k.indexOf(name) > -1);
  return key ? files[key] : "";
}

const dxfCache = new WeakMap<object, CFStyle[]>();

/** The conditional formatting of one sheet of an unzipped workbook. */
export function readSheetConditionalFormats(
  readXml: ReadXml,
  sheetFile: string,
  styles: IStyleCollections
): CFRule[] {
  const files = readXml.originFile as unknown as Record<string, string>;
  const sheetXml = fileByName(files, sheetFile);
  if (!sheetXml || sheetXml.indexOf("conditionalFormatting") < 0) return [];
  const resolve: CFColorResolver = (attrs) => {
    if (!attrs.rgb && !attrs.theme && !attrs.indexed) return undefined;
    const attrText = Object.keys(attrs)
      .map((k) => `${k}="${attrs[k]}"`)
      .join(" ");
    const c = getColor(new Element(`<color ${attrText}/>`), styles, "b");
    return typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c) ? c : undefined;
  };
  let dxfs = dxfCache.get(readXml);
  if (!dxfs) {
    dxfs = readDxfStyles(fileByName(files, stylesFile), resolve);
    dxfCache.set(readXml, dxfs);
  }
  return readConditionalFormats(sheetXml, dxfs, resolve);
}
