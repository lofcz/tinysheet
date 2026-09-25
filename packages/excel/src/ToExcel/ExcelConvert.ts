import type ExcelJS from "@protobi/exceljs";
import { colorToArgb } from "../common/units";

/** TinySheet's legacy numeric font ids (locale fontarray, English). */
const NUMERIC_FONTS = ["Times New Roman", "Arial", "Tahoma", "Verdana"];

const UNDERLINE: Record<number, ExcelJS.Font["underline"]> = {
  1: "single",
  2: "double",
  3: "singleAccounting",
  4: "doubleAccounting",
};

const isOn = (v: any) => v != null && v !== 0 && v !== "0" && v !== false;

export function fontName(ff: any): string | undefined {
  if (ff == null || ff === "") return undefined;
  if (typeof ff === "number" || /^\d+$/.test(String(ff))) {
    return NUMERIC_FONTS[Number(ff)] ?? undefined;
  }
  return (
    String(ff)
      .replace(/^["']|["']$/g, "")
      .trim() || undefined
  );
}

/** Font of a cell or of a rich-text run; undefined when nothing is set. */
export function fontConvert(style: any): Partial<ExcelJS.Font> | undefined {
  if (!style) return undefined;
  const font: Partial<ExcelJS.Font> = {};
  const name = fontName(style.ff);
  if (name) font.name = name;
  if (style.fs != null && style.fs !== "" && !Number.isNaN(Number(style.fs))) {
    font.size = Number(style.fs);
  }
  const color = colorToArgb(style.fc);
  if (color) font.color = { argb: color };
  if (isOn(style.bl)) font.bold = true;
  if (isOn(style.it)) font.italic = true;
  if (isOn(style.cl)) font.strike = true;
  if (isOn(style.un)) font.underline = UNDERLINE[Number(style.un)] ?? "single";
  if (style.va === 1 || style.va === "1") font.vertAlign = "subscript";
  if (style.va === 2 || style.va === "2") font.vertAlign = "superscript";
  return Object.keys(font).length ? font : undefined;
}

export function fillConvert(bg: string | undefined): ExcelJS.Fill | undefined {
  const argb = colorToArgb(bg);
  if (!argb) return undefined;
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

const HORIZONTAL: Record<string, ExcelJS.Alignment["horizontal"]> = {
  "0": "center",
  "1": "left",
  "2": "right",
};

const VERTICAL: Record<string, ExcelJS.Alignment["vertical"]> = {
  "0": "middle",
  "1": "top",
  "2": "bottom",
};

const ROTATION: Record<string, number | "vertical"> = {
  "1": 45,
  "2": -45,
  "3": "vertical",
  "4": 90,
  "5": -90,
};

/**
 * TinySheet alignment -> Excel. `rt` holds Excel's textRotation encoding
 * (0-90 up, 91-180 down); `tr` is the legacy preset (1: 45, 2: -45,
 * 3: vertical, 4: 90, 5: -90). Undefined `vt` stays unset (Excel: bottom).
 */
export function alignmentConvert(
  cell: any
): Partial<ExcelJS.Alignment> | undefined {
  const alignment: Partial<ExcelJS.Alignment> = {};
  if (cell.ht != null && HORIZONTAL[String(cell.ht)]) {
    alignment.horizontal = HORIZONTAL[String(cell.ht)];
  }
  if (cell.vt != null && VERTICAL[String(cell.vt)]) {
    alignment.vertical = VERTICAL[String(cell.vt)];
  }
  if (String(cell.tb) === "2") alignment.wrapText = true;
  if (isOn(cell.sk)) alignment.shrinkToFit = true;
  // indents apply to left- and right-aligned text (as in Excel)
  const indent = Math.round(Number(cell.ind));
  if (
    indent > 0 &&
    (alignment.horizontal === "left" || alignment.horizontal === "right")
  ) {
    alignment.indent = Math.min(indent, 250);
  }
  if (String(cell.tr) === "3") {
    alignment.textRotation = "vertical";
  } else if (
    cell.rt != null &&
    !Number.isNaN(Number(cell.rt)) &&
    Number(cell.rt)
  ) {
    const rt = Number(cell.rt);
    alignment.textRotation = rt > 90 ? 90 - rt : rt;
  } else if (cell.tr != null && ROTATION[String(cell.tr)] != null) {
    alignment.textRotation = ROTATION[String(cell.tr)];
  }
  return Object.keys(alignment).length ? alignment : undefined;
}

/**
 * Cell protection (`lo: 0` unlocked, `hi: 1` formula hidden); undefined for
 * Excel's default (locked, visible).
 */
export function protectionConvert(
  cell: any
): Partial<ExcelJS.Protection> | undefined {
  const unlocked = cell.lo != null && Number(cell.lo) === 0;
  const hidden = isOn(cell.hi);
  if (!unlocked && !hidden) return undefined;
  return { locked: !unlocked, hidden };
}
