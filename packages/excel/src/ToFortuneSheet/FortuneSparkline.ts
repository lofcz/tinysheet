/**
 * xlsx -> sparklines: reads the worksheet's `x14:sparklineGroups`
 * extension (Excel 2010+) into `sheet.sparklineGroups`, with every option
 * (type, markers, colours, axis, empty/hidden cells, date axis).
 */
import {
  DEFAULT_SPARKLINE_COLORS,
  generateSparklineGroupId,
} from "@lofcz/tinysheet-core";
import type { SheetImportContext } from "./importFeatures";
import { Element, getColor, IStyleCollections } from "./ReadXml";
import { xmlUnescape } from "../ToExcel/postProcess";

const P = "(?:[\\w.-]+:)?";

const COLOR_KEYS: Record<string, string> = {
  Series: "series",
  Negative: "negative",
  Axis: "axis",
  Markers: "markers",
  First: "first",
  Last: "last",
  High: "high",
  Low: "low",
};

function attrsOf(tag: string) {
  const attrs: Record<string, string> = {};
  const re = /([\w:]+)\s*=\s*"([^"]*)"/g;
  let m = re.exec(tag);
  while (m) {
    attrs[m[1].replace(/^\w+:/, "")] = xmlUnescape(m[2]);
    m = re.exec(tag);
  }
  return attrs;
}

const isOn = (v: string | undefined) => v === "1" || v === "true";

function columnIndex(letters: string) {
  let n = 0;
  const s = letters.toUpperCase();
  for (let i = 0; i < s.length; i += 1) n = n * 26 + (s.charCodeAt(i) - 64);
  return n - 1;
}

/** First cell of an sqref ("F2", "F2:F9 H1") as 0-based (r, c). */
function sqrefCell(sqref: string) {
  const m = /\$?([A-Za-z]{1,3})\$?(\d+)/.exec(sqref);
  if (!m) return null;
  return { r: parseInt(m[2], 10) - 1, c: columnIndex(m[1]) };
}

function textOf(xml: string, tag: string) {
  const m = new RegExp(`<${P}${tag}\\b[^>]*>([\\s\\S]*?)</${P}${tag}>`).exec(
    xml
  );
  return m ? xmlUnescape(m[1]).trim() : null;
}

export type SparklineColorResolver = (
  attrs: Record<string, string>
) => string | undefined;

/** Parse the `x14:sparklineGroups` of a worksheet XML. */
export function parseSparklineGroups(
  sheetXml: string,
  resolveColor: SparklineColorResolver = (a) =>
    a.rgb ? `#${a.rgb.slice(-6)}` : undefined
): any[] {
  if (!sheetXml || sheetXml.indexOf("sparklineGroup") < 0) return [];
  const groups: any[] = [];
  const groupRe = new RegExp(
    `<${P}sparklineGroup\\b([^>]*?)(?:/>|>([\\s\\S]*?)</${P}sparklineGroup>)`,
    "g"
  );
  let m = groupRe.exec(sheetXml);
  while (m) {
    const a = attrsOf(m[1]);
    const body = m[2] ?? "";
    const listXml =
      new RegExp(`<${P}sparklines\\b[^>]*>([\\s\\S]*?)</${P}sparklines>`).exec(
        body
      )?.[1] ?? "";
    const sparklines: any[] = [];
    const itemRe = new RegExp(
      `<${P}sparkline\\b[^>]*>([\\s\\S]*?)</${P}sparkline>`,
      "g"
    );
    let s = itemRe.exec(listXml);
    while (s) {
      const cell = sqrefCell(textOf(s[1], "sqref") ?? "");
      if (cell) sparklines.push({ ...cell, f: textOf(s[1], "f") ?? "" });
      s = itemRe.exec(listXml);
    }
    if (sparklines.length > 0) {
      const outside = body.replace(
        new RegExp(`<${P}sparklines\\b[\\s\\S]*?</${P}sparklines>`),
        ""
      );
      const colors: Record<string, string> = {
        ...DEFAULT_SPARKLINE_COLORS,
      };
      const colorRe = new RegExp(
        `<${P}color(Series|Negative|Axis|Markers|First|Last|High|Low)\\b([^>]*?)/?>`,
        "g"
      );
      let c = colorRe.exec(outside);
      while (c) {
        const color = resolveColor(attrsOf(c[2]));
        if (color) colors[COLOR_KEYS[c[1]]] = color;
        c = colorRe.exec(outside);
      }
      let type = "line";
      if (a.type === "column") type = "column";
      else if (a.type === "stacked") type = "winloss";
      const group: any = {
        id: generateSparklineGroupId(),
        type,
        sparklines,
        colors,
        // the schema default is "zero"; Excel writes "gap" explicitly
        displayEmptyCellsAs: ["gap", "zero", "span"].includes(
          a.displayEmptyCellsAs
        )
          ? a.displayEmptyCellsAs
          : "zero",
      };
      (
        [
          "markers",
          "high",
          "low",
          "first",
          "last",
          "negative",
          "displayXAxis",
          "displayHidden",
          "rightToLeft",
        ] as const
      ).forEach((k) => {
        if (isOn(a[k])) group[k] = true;
      });
      (["minAxisType", "maxAxisType"] as const).forEach((k) => {
        if (a[k] === "group" || a[k] === "custom") group[k] = a[k];
      });
      if (a.manualMin != null && Number.isFinite(Number(a.manualMin))) {
        group.manualMin = Number(a.manualMin);
      }
      if (a.manualMax != null && Number.isFinite(Number(a.manualMax))) {
        group.manualMax = Number(a.manualMax);
      }
      if (a.lineWeight != null && Number.isFinite(Number(a.lineWeight))) {
        const w = Number(a.lineWeight);
        if (w !== 0.75) group.lineWeight = w;
      }
      if (isOn(a.dateAxis)) {
        const dates = textOf(outside, "f");
        if (dates) group.dateAxis = dates;
      }
      groups.push(group);
    }
    m = groupRe.exec(sheetXml);
  }
  return groups;
}

function styleColorResolver(styles: IStyleCollections): SparklineColorResolver {
  return (attrs) => {
    if (!attrs.rgb && !attrs.theme && !attrs.indexed) return undefined;
    const text = Object.keys(attrs)
      .map((k) => `${k}="${attrs[k]}"`)
      .join(" ");
    const c = getColor(new Element(`<color ${text}/>`), styles, "b");
    return typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c) ? c : undefined;
  };
}

/** Sheet import feature: `x14:sparklineGroups` -> `sheet.sparklineGroups`. */
export function readSparklines(ctx: SheetImportContext) {
  const xml = ctx.files[ctx.sheetFile];
  if (!xml) return;
  const groups = parseSparklineGroups(xml, styleColorResolver(ctx.styles));
  if (groups.length > 0) (ctx.sheet as any).sparklineGroups = groups;
}
