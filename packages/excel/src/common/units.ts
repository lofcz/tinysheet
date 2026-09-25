/**
 * Unit and colour conversions shared by import and export.
 *
 * Column widths: the importer has always mapped an Excel width `w`
 * (characters) to `round((w - 0.83) * 8 + 5)` pixels, which keeps Calibri
 * layouts readable with TinySheet's wider default font. Export uses the exact
 * inverse so that a width survives export -> import unchanged.
 *
 * Row heights: points <-> pixels at 96 DPI (1pt = 4/3 px).
 */

export function excelWidthToPx(width: number) {
  return Math.round((width - 0.83) * 8 + 5);
}

export function pxToExcelWidth(px: number) {
  return Math.round(((px - 5) / 8 + 0.83) * 256) / 256;
}

export function pointsToPx(pt: number) {
  return Math.round((pt * 4) / 3);
}

export function pxToPoints(px: number) {
  return Math.round(px * 0.75 * 100) / 100;
}

/**
 * Excel's default column width when a sheet only declares `baseColWidth`
 * (characters of the maximum digit width, 7px for Calibri 11): the width is
 * the character count plus 5px of padding, truncated to 1/256 character.
 */
export function baseColWidthToWidth(baseColWidth: number) {
  return Math.floor(((baseColWidth * 7 + 5) / 7) * 256) / 256;
}

function clamp255(n: number) {
  return Math.max(0, Math.min(255, Math.round(n)));
}

/**
 * Normalise a CSS-ish colour ("#abc", "#aabbcc", "rgb(1,2,3)",
 * "rgba(1,2,3,0.5)") to "RRGGBB" (upper case), or null.
 */
export function colorToHex6(color: string | null | undefined): string | null {
  if (color == null) return null;
  const s = String(color).trim();
  if (!s) return null;
  let m = /^#?([0-9a-f]{6})$/i.exec(s);
  if (m) return m[1].toUpperCase();
  m = /^#?([0-9a-f]{8})$/i.exec(s);
  if (m) return m[1].slice(2).toUpperCase();
  m = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(s);
  if (m) return `${m[1]}${m[1]}${m[2]}${m[2]}${m[3]}${m[3]}`.toUpperCase();
  m = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i.exec(s);
  if (m) {
    return [m[1], m[2], m[3]]
      .map((x) => clamp255(parseFloat(x)).toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
  }
  return null;
}

/** "RRGGBB" / "#RRGGBB" -> ExcelJS ARGB ("FFRRGGBB"). */
export function colorToArgb(color: string | null | undefined): string | null {
  const hex = colorToHex6(color);
  return hex ? `FF${hex}` : null;
}
