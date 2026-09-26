/**
 * Shapes drawn in a chart (Format › Insert Shapes): the chart drawing part
 * `c:userShapes` (xl/drawings/drawingN.xml, related from the chart part)
 * with one `cdr:relSizeAnchor` per shape, its corners as fractions of the
 * chart area — Excel's form.
 */
import {
  chartShapeAsShape,
  chartShapeBox,
  generateShapeId,
} from "@lofcz/tinysheet-core";
import type { Chart, ChartShape } from "@lofcz/tinysheet-core";
import { shapeXml } from "../shapes/exportXlsx";
import {
  DEFAULT_THEME_COLORS,
  readShapeNode,
  ThemeColors,
} from "../shapes/importXlsx";
import { effectsXml, readEffects } from "./effectsXml";
import { child, find, parseXml, XmlNode } from "./xml";
import { NS_A, NS_C } from "./chartXml";

export const NS_CDR =
  "http://schemas.openxmlformats.org/drawingml/2006/chartDrawing";
export const REL_USER_SHAPES =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/chartUserShapes";
export const CT_CHART_SHAPES =
  "application/vnd.openxmlformats-officedocument.drawingml.chartshapes+xml";

const round = (n: number) => Math.round(n * 100000) / 100000;
const frac = (n: number) => String(round(n));

/** The chart drawing part of a chart's shapes ("" when it has none). */
export function chartUserShapesXml(chart: Chart): string {
  if (!chart.shapes?.length) return "";
  let body = "";
  chart.shapes.forEach((s, i) => {
    const box = chartShapeBox(chart, s);
    let sp = shapeXml(chartShapeAsShape(s), box, i + 2)
      .replace(/<xdr:/g, "<cdr:")
      .replace(/<\/xdr:/g, "</cdr:");
    const fx = effectsXml(s.effects);
    if (fx) {
      // Shape Effects: the shape's shadow flag is replaced by its effects
      sp = sp
        .replace(/<a:effectLst>[\s\S]*?<\/a:effectLst>/, "")
        .replace("</cdr:spPr>", `${fx}</cdr:spPr>`);
    }
    body +=
      `<cdr:relSizeAnchor xmlns:cdr="${NS_CDR}">` +
      `<cdr:from><cdr:x>${frac(s.x)}</cdr:x><cdr:y>${frac(s.y)}</cdr:y></cdr:from>` +
      `<cdr:to><cdr:x>${frac(s.x + s.w)}</cdr:x><cdr:y>${frac(
        s.y + s.h
      )}</cdr:y></cdr:to>${sp}</cdr:relSizeAnchor>`;
  });
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<c:userShapes xmlns:c="${NS_C}" xmlns:a="${NS_A}">${body}</c:userShapes>`
  );
}

const num = (node: XmlNode | undefined, name: string) => {
  const n = parseFloat(child(node, name)?.text ?? "");
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
};

/** A unit grid: the anchors of the imported shape are not used. */
const UNIT_GEOMETRY = {
  rowTop: (r: number) => r * 20,
  rowHeight: () => 20,
  colLeft: (c: number) => c * 64,
  colWidth: () => 64,
};

/** The shapes of a chart drawing part (relative anchors). */
export function readChartUserShapes(
  xml: string,
  theme: ThemeColors = DEFAULT_THEME_COLORS
): ChartShape[] {
  const root = parseXml(xml);
  const space = root.name === "userShapes" ? root : find(root, "userShapes");
  const out: ChartShape[] = [];
  space?.children.forEach((anchor) => {
    if (anchor.name !== "relSizeAnchor") return;
    const from = child(anchor, "from");
    const to = child(anchor, "to");
    const node = anchor.children.find(
      (c) => c.name === "sp" || c.name === "cxnSp"
    );
    if (!node) return;
    const x = num(from, "x");
    const y = num(from, "y");
    const shape = readShapeNode(
      node,
      { left: 0, top: 0, width: 100, height: 100 },
      UNIT_GEOMETRY,
      theme
    );
    if (!shape) return;
    const { from: _f, to: _t, group: _g, ...look } = shape;
    const s: ChartShape = {
      ...look,
      id: look.id || generateShapeId(),
      x,
      y,
      w: round(Math.max(0, num(to, "x") - x)),
      h: round(Math.max(0, num(to, "y") - y)),
    };
    const effects = readEffects(child(node, "spPr"));
    if (effects) {
      s.effects = effects;
      delete s.shadow;
    }
    out.push(s);
  });
  return out;
}
