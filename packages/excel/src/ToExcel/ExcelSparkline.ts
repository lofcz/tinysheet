/**
 * Sparklines -> xlsx. ExcelJS does not know sparklines, so the writer
 * builds the worksheet's `x14:sparklineGroups` extension (Excel 2010) and
 * hands it to the zip post-processing (postProcess.ts `worksheetExts`),
 * which adds it to the worksheet's `extLst`.
 */
import { DEFAULT_SPARKLINE_COLORS } from "@lofcz/tinysheet-core";
import type { SheetExportContext } from "./buildWorkbook";
import { xmlEscape } from "./postProcess";
import { colorToArgb } from "../common/units";

/** `ext` uri of the sparkline groups (MS-XLSX). */
export const SPARKLINE_EXT_URI = "{05C60535-1F16-4fd2-B633-F4F36F0B64E0}";

const X14_NS = "http://schemas.microsoft.com/office/spreadsheetml/2009/9/main";
const XM_NS = "http://schemas.microsoft.com/office/excel/2006/main";

const COLOR_ELEMENTS: [string, string][] = [
  ["series", "colorSeries"],
  ["negative", "colorNegative"],
  ["axis", "colorAxis"],
  ["markers", "colorMarkers"],
  ["first", "colorFirst"],
  ["last", "colorLast"],
  ["high", "colorHigh"],
  ["low", "colorLow"],
];

function columnName(c: number) {
  let n = c + 1;
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

const flag = (name: string, on: unknown) => (on ? ` ${name}="1"` : "");

/** One `x14:sparklineGroup` element, or "" when it has no sparklines. */
export function sparklineGroupXml(group: any): string {
  const sparklines = (group?.sparklines ?? []).filter(
    (s: any) => s && Number.isInteger(s.r) && Number.isInteger(s.c)
  );
  if (sparklines.length === 0) return "";
  let attrs = "";
  const custom = (t: unknown) => t === "custom";
  if (custom(group.maxAxisType) && Number.isFinite(group.manualMax)) {
    attrs += ` manualMax="${group.manualMax}"`;
  }
  if (custom(group.minAxisType) && Number.isFinite(group.manualMin)) {
    attrs += ` manualMin="${group.manualMin}"`;
  }
  if (Number.isFinite(group.lineWeight) && group.lineWeight !== 0.75) {
    attrs += ` lineWeight="${group.lineWeight}"`;
  }
  if (group.type === "column") attrs += ' type="column"';
  else if (group.type === "winloss") attrs += ' type="stacked"';
  attrs += flag("dateAxis", !!group.dateAxis);
  const empty = ["gap", "zero", "span"].includes(group.displayEmptyCellsAs)
    ? group.displayEmptyCellsAs
    : "gap";
  attrs += ` displayEmptyCellsAs="${empty}"`;
  attrs += flag("markers", group.markers);
  attrs += flag("high", group.high);
  attrs += flag("low", group.low);
  attrs += flag("first", group.first);
  attrs += flag("last", group.last);
  attrs += flag("negative", group.negative);
  attrs += flag("displayXAxis", group.displayXAxis);
  attrs += flag("displayHidden", group.displayHidden);
  if (group.minAxisType === "group" || group.minAxisType === "custom") {
    attrs += ` minAxisType="${group.minAxisType}"`;
  }
  if (group.maxAxisType === "group" || group.maxAxisType === "custom") {
    attrs += ` maxAxisType="${group.maxAxisType}"`;
  }
  attrs += flag("rightToLeft", group.rightToLeft);

  const colors = COLOR_ELEMENTS.map(([key, tag]) => {
    const argb =
      colorToArgb(group.colors?.[key]) ??
      colorToArgb((DEFAULT_SPARKLINE_COLORS as Record<string, string>)[key]);
    return `<x14:${tag} rgb="${argb}"/>`;
  }).join("");
  const dateAxis = group.dateAxis
    ? `<xm:f>${xmlEscape(String(group.dateAxis))}</xm:f>`
    : "";
  const items = sparklines
    .map(
      (s: any) =>
        `<x14:sparkline><xm:f>${xmlEscape(
          String(s.f || "#REF!")
        )}</xm:f><xm:sqref>${columnName(s.c)}${
          s.r + 1
        }</xm:sqref></x14:sparkline>`
    )
    .join("");
  return `<x14:sparklineGroup${attrs}>${colors}${dateAxis}<x14:sparklines>${items}</x14:sparklines></x14:sparklineGroup>`;
}

/** The worksheet `ext` element holding the sparkline groups, or "". */
export function sparklineExtXml(groups: any[] | undefined): string {
  const body = (groups ?? []).map(sparklineGroupXml).join("");
  if (!body) return "";
  return `<ext uri="${SPARKLINE_EXT_URI}" xmlns:x14="${X14_NS}"><x14:sparklineGroups xmlns:xm="${XM_NS}">${body}</x14:sparklineGroups></ext>`;
}

/** Sheet export feature: queue the sheet's sparklines for the zip pass. */
export function writeSparklines(ctx: SheetExportContext) {
  const xml = sparklineExtXml(ctx.sheet?.sparklineGroups);
  if (!xml) return;
  const exts = ctx.post.worksheetExts ?? {};
  ctx.post.worksheetExts = exts;
  const { id } = ctx.worksheet;
  exts[id] = [...(exts[id] ?? []), xml];
}
