/**
 * Default fonts of the grid.
 *
 * A cell without a font (`ff`) uses the workbook's default font,
 * `settings.defaultFontFamily` (Excel's "Body" font: Calibri, with its
 * metric-compatible Carlito and common sans fallbacks), at
 * `settings.defaultFontSize` (11pt). A numeric `ff` still indexes the
 * locale's `fontarray` (0 = Times New Roman, 1 = Arial, ...), so stored
 * workbooks keep their fonts; a string `ff` is a font name.
 */

/** CSS font-family of cells without a font of their own. */
export const DEFAULT_FONT_FAMILY =
  'Calibri, Carlito, "Segoe UI", Arial, sans-serif';

/** Default cell font size in points (Excel: 11). */
export const DEFAULT_FONT_SIZE = 11;

/** Row / column header labels (the suite's UI font). */
export const HEADER_FONT_FAMILY =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

/** Header label size in CSS px at 100% zoom. */
export const HEADER_FONT_SIZE = 12;

/** Families appended to every cell font (glyph fallback: CJK and sans). */
export const FALLBACK_FONT_FAMILY =
  '"Helvetica Neue", Helvetica, Arial, "PingFang SC", "Hiragino Sans GB", "Heiti SC", "Microsoft YaHei", "WenQuanYi Micro Hei", sans-serif';

/** The workbook's default cell font-family (`ctx.defaultFontFamily`). */
export function defaultFontFamily(
  ctx?: { defaultFontFamily?: string | null } | null
): string {
  return ctx?.defaultFontFamily || DEFAULT_FONT_FAMILY;
}

/**
 * The name shown for a font-family list: its first family, unquoted
 * (`Calibri, Carlito, sans-serif` -> `Calibri`).
 */
export function fontDisplayName(family: string): string {
  const first = family.split(",")[0] ?? "";
  return first.trim().replace(/^["']|["']$/g, "");
}
