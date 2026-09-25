/**
 * Excel cell checkboxes (Insert › Checkbox, Excel 2024 / 365).
 *
 * A checkbox is a cell format (`cell.cb = 1`), not an object: a boolean cell
 * with the format is drawn as a checkbox instead of TRUE/FALSE, any other
 * value is drawn as text. Applying the format turns empty cells into FALSE;
 * clearing the format (Clear Formats, or the Checkbox button again) leaves
 * the TRUE/FALSE values behind.
 *
 * - Clicking the box (not the cell margin) toggles it; Space toggles every
 *   selected checkbox (all checked become unchecked, otherwise all become
 *   checked, as Excel does for a mixed selection).
 * - Delete unchecks; Delete on checkboxes that are all unchecked removes
 *   them (Excel's "press Delete again to remove the checkboxes").
 * - Formulas returning booleans render read-only checkboxes.
 *
 * The format is an ordinary cell property, so copy/paste, fill and undo
 * carry it; the xlsx round-trip lives in the excel package
 * (ToExcel/ExcelCheckbox.ts).
 */
import type { Context } from "../context";
import { getFlowdata } from "../context";
import type { Cell, CellMatrix, Selection } from "../types";
import { getCanvasTheme, resolveCellTextColor } from "../theme";
import { getSheetIndex } from "../utils";
import {
  registerCellDecorator,
  registerCellPointerHandler,
  registerShortcut,
} from "./extensions";
import { jfrefreshgrid } from "./refresh";

type RangeLike = { row: number[]; column: number[] };

/** Whether the cell carries the checkbox format. */
export function hasCheckboxFormat(cell: Cell | null | undefined) {
  return !!cell && !!(cell as any).cb;
}

/** The cell's boolean value, or undefined for any other value. */
export function checkboxValue(cell: Cell | null | undefined) {
  if (!cell) return undefined;
  const { v } = cell;
  if (typeof v === "boolean") return v;
  if (cell.ct?.t === "b" && typeof v === "string") {
    if (/^true$/i.test(v)) return true;
    if (/^false$/i.test(v)) return false;
  }
  return undefined;
}

/** Whether the cell is drawn as a checkbox (format + boolean value). */
export function isCheckboxCell(cell: Cell | null | undefined) {
  return hasCheckboxFormat(cell) && checkboxValue(cell) !== undefined;
}

function setBoolean(cell: Cell, value: boolean) {
  cell.v = value;
  cell.m = value ? "TRUE" : "FALSE";
  cell.ct = { fa: cell.ct?.fa || "General", t: "b" };
}

function isEmptyValue(cell: Cell | null | undefined) {
  if (!cell) return true;
  if (cell.f) return false;
  if (cell.ct?.t === "inlineStr" && cell.ct.s?.length) return false;
  return cell.v == null || cell.v === "";
}

function forEachCell(ranges: RangeLike[], fn: (r: number, c: number) => void) {
  const seen = new Set<string>();
  ranges.forEach((range) => {
    for (let r = range.row[0]; r <= range.row[1]; r += 1) {
      for (let c = range.column[0]; c <= range.column[1]; c += 1) {
        const key = `${r}_${c}`;
        if (!seen.has(key)) {
          seen.add(key);
          fn(r, c);
        }
      }
    }
  });
}

function isHidden(ctx: Context, r: number, c: number) {
  return (
    ctx.config?.rowhidden?.[r] != null || ctx.config?.colhidden?.[c] != null
  );
}

/** Whether every cell of the ranges carries the checkbox format. */
export function selectionHasCheckboxes(
  data: CellMatrix | null | undefined,
  ranges: RangeLike[] | undefined
) {
  if (!data || !ranges?.length) return false;
  let all = true;
  forEachCell(ranges, (r, c) => {
    if (!hasCheckboxFormat(data[r]?.[c])) all = false;
  });
  return all;
}

function refresh(ctx: Context, data: CellMatrix, ranges: RangeLike[]) {
  jfrefreshgrid(ctx, data, ranges as Selection[]);
}

/**
 * Insert › Checkbox: apply the checkbox format to the ranges (default: the
 * selection). Empty cells become FALSE; other values are kept.
 */
export function insertCheckboxes(ctx: Context, ranges?: RangeLike[]) {
  if (ctx.allowEdit === false) return 0;
  const data = getFlowdata(ctx);
  const target = ranges ?? ctx.luckysheet_select_save;
  if (!data || !target?.length) return 0;
  let count = 0;
  forEachCell(target, (r, c) => {
    if (!data[r] || isHidden(ctx, r, c)) return;
    const cell = data[r][c];
    if (cell?.mc && cell.mc.rs == null) return; // covered by a merge
    const next: Cell = cell ? { ...cell } : {};
    if (isEmptyValue(next)) setBoolean(next, false);
    (next as any).cb = 1;
    data[r][c] = next;
    count += 1;
  });
  refresh(ctx, data, target);
  return count;
}

/** Remove the checkbox format from the ranges; TRUE/FALSE values stay. */
export function removeCheckboxes(ctx: Context, ranges?: RangeLike[]) {
  if (ctx.allowEdit === false) return 0;
  const data = getFlowdata(ctx);
  const target = ranges ?? ctx.luckysheet_select_save;
  if (!data || !target?.length) return 0;
  let count = 0;
  forEachCell(target, (r, c) => {
    const cell = data[r]?.[c];
    if (!hasCheckboxFormat(cell)) return;
    const next = { ...cell } as any;
    delete next.cb;
    data[r][c] = next;
    count += 1;
  });
  return count;
}

/** The toolbar button: remove when every cell has the format, else insert. */
export function toggleCheckboxFormat(ctx: Context, ranges?: RangeLike[]) {
  const target = ranges ?? ctx.luckysheet_select_save;
  if (selectionHasCheckboxes(getFlowdata(ctx), target)) {
    removeCheckboxes(ctx, target);
    return "removed" as const;
  }
  insertCheckboxes(ctx, target);
  return "inserted" as const;
}

/** Checkbox cells of the ranges that can be toggled (not formulas). */
function toggleable(data: CellMatrix, ranges: RangeLike[]) {
  const out: { r: number; c: number; value: boolean }[] = [];
  forEachCell(ranges, (r, c) => {
    const cell = data[r]?.[c];
    if (!hasCheckboxFormat(cell) || cell?.f) return;
    const value = checkboxValue(cell);
    if (value === undefined && !isEmptyValue(cell)) return;
    out.push({ r, c, value: !!value });
  });
  return out;
}

/**
 * Toggle the checkboxes of the ranges (default: the selection). A single
 * checkbox flips; several become checked unless all of them already are.
 * Returns how many cells changed, or -1 when the ranges hold no toggleable
 * checkbox.
 */
export function toggleCheckboxes(ctx: Context, ranges?: RangeLike[]) {
  const data = getFlowdata(ctx);
  const target = ranges ?? ctx.luckysheet_select_save;
  if (!data || !target?.length) return -1;
  const cells = toggleable(data, target);
  if (cells.length === 0) return -1;
  if (ctx.allowEdit === false) return 0;
  const next = !cells.every((x) => x.value);
  cells.forEach(({ r, c }) => {
    const cell = { ...data[r][c] } as Cell;
    setBoolean(cell, next);
    data[r][c] = cell;
  });
  refresh(ctx, data, target);
  return cells.length;
}

/** Toggle the checkbox of one cell (a click on the box). */
export function toggleCheckboxAt(ctx: Context, r: number, c: number) {
  return toggleCheckboxes(ctx, [{ row: [r, r], column: [c, c] }]) > 0;
}

/**
 * How Delete treats the checkbox cells of the selection: "uncheck" sets
 * them to FALSE, "remove" (every checkbox already unchecked) removes the
 * format with the value.
 */
export function checkboxClearMode(
  data: CellMatrix | null | undefined,
  ranges: RangeLike[] | undefined
): "uncheck" | "remove" | null {
  if (!data || !ranges?.length) return null;
  let any = false;
  let anyChecked = false;
  forEachCell(ranges, (r, c) => {
    const cell = data[r]?.[c];
    if (!hasCheckboxFormat(cell)) return;
    any = true;
    if (cell?.f || checkboxValue(cell) !== false) anyChecked = true;
  });
  if (!any) return null;
  return anyChecked ? "uncheck" : "remove";
}

/** Apply the Delete key to a checkbox cell whose content was just cleared. */
export function clearCheckboxCell(
  cell: Cell,
  mode: "uncheck" | "remove" | null
): Cell {
  if (!hasCheckboxFormat(cell) || mode == null) return cell;
  if (mode === "remove") {
    const next = { ...cell } as any;
    delete next.cb;
    return next;
  }
  const next = { ...cell };
  setBoolean(next, false);
  return next;
}

/* ------------------------------------------------------------------ */
/* Geometry and drawing                                                */
/* ------------------------------------------------------------------ */

/** The checkbox's box inside a cell box (all values in zoomed pixels). */
export function checkboxRect(
  cell: Cell | null | undefined,
  x: number,
  y: number,
  w: number,
  h: number,
  zoom: number,
  defaultFontSize = 10
) {
  const fs = Number(cell?.fs) || defaultFontSize || 10;
  // Excel scales the box with the font: about the height of a capital
  const size = Math.max(6, Math.min(fs * (4 / 3) * 0.95, 200)) * zoom;
  const side = Math.min(size, Math.max(2, w - 4 * zoom), Math.max(2, h - 2));
  const pad = 4 * zoom;
  // horizontal: 0 centre (default for checkboxes), 1 left, 2 right
  const ht = cell?.ht == null ? 0 : Number(cell.ht);
  let left = x + (w - side) / 2;
  if (ht === 1) left = x + pad;
  else if (ht === 2) left = x + w - pad - side;
  // vertical: 0 middle (default), 1 top, 2 bottom
  const vt = cell?.vt == null ? 0 : Number(cell.vt);
  let top = y + (h - side) / 2;
  if (vt === 1) top = y + 2 * zoom;
  else if (vt === 2) top = y + h - 3 * zoom - side;
  return { x: left, y: top, size: side };
}

function roundedRect(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  radius: number
) {
  g.beginPath();
  g.moveTo(x + radius, y);
  g.lineTo(x + s - radius, y);
  g.quadraticCurveTo(x + s, y, x + s, y + radius);
  g.lineTo(x + s, y + s - radius);
  g.quadraticCurveTo(x + s, y + s, x + s - radius, y + s);
  g.lineTo(x + radius, y + s);
  g.quadraticCurveTo(x, y + s, x, y + s - radius);
  g.lineTo(x, y + radius);
  g.quadraticCurveTo(x, y, x + radius, y);
  g.closePath();
}

/** Draws a checkbox in the cell box. */
export function drawCheckbox(
  g: CanvasRenderingContext2D,
  ctx: Context,
  cell: Cell,
  box: { x: number; y: number; w: number; h: number },
  zoom: number
) {
  const checked = checkboxValue(cell) === true;
  const rect = checkboxRect(
    cell,
    box.x,
    box.y,
    box.w,
    box.h,
    zoom,
    ctx.defaultFontSize
  );
  const theme = getCanvasTheme(ctx);
  const color = resolveCellTextColor(ctx, cell.fc, cell.bg);
  const lineWidth = Math.max(1, Math.round(rect.size / 12));
  // align strokes to the pixel grid
  const off = lineWidth % 2 ? 0.5 : 0;
  const x = Math.round(rect.x) + off;
  const y = Math.round(rect.y) + off;
  const s = Math.round(rect.size) - lineWidth;
  g.beginPath();
  g.rect(box.x, box.y, box.w, box.h);
  g.clip();
  roundedRect(g, x, y, s, Math.max(1, s / 7));
  if (!checked) {
    g.fillStyle = cell.bg || theme.cellBackground;
    g.fill();
  }
  g.lineWidth = lineWidth;
  g.strokeStyle = color;
  g.stroke();
  if (checked) {
    // the check mark in the cell background colour on a filled box
    g.fillStyle = color;
    g.fill();
    g.beginPath();
    g.moveTo(x + s * 0.22, y + s * 0.52);
    g.lineTo(x + s * 0.42, y + s * 0.72);
    g.lineTo(x + s * 0.78, y + s * 0.3);
    g.lineWidth = Math.max(1.25, s / 7);
    g.lineCap = "round";
    g.lineJoin = "round";
    g.strokeStyle = cell.bg || theme.cellBackground;
    g.stroke();
  }
}

/* ------------------------------------------------------------------ */
/* Registration                                                        */
/* ------------------------------------------------------------------ */

registerCellDecorator("checkbox", {
  drawContent: ({ ctx, renderCtx, cell, x, y, w, h, zoom }) => {
    if (!cell || !isCheckboxCell(cell)) return false;
    drawCheckbox(renderCtx, ctx, cell, { x, y, w, h }, zoom);
    return true;
  },
});

registerCellPointerHandler(
  "checkbox",
  ({ ctx, r, c, cell, x, y, w, h, offsetX, offsetY, zoom }) => {
    if (!isCheckboxCell(cell) || cell?.f || ctx.allowEdit === false) return;
    const rect = checkboxRect(cell, x, y, w, h, zoom, ctx.defaultFontSize);
    const px = x + offsetX;
    const py = y + offsetY;
    const slop = 1;
    if (
      px < rect.x - slop ||
      px > rect.x + rect.size + slop ||
      py < rect.y - slop ||
      py > rect.y + rect.size + slop
    ) {
      return;
    }
    toggleCheckboxAt(ctx, r, c);
  }
);

registerShortcut("checkbox-toggle", {
  key: " ",
  handler: (ctx) => {
    const data = getFlowdata(ctx);
    const ranges = ctx.luckysheet_select_save;
    if (!data || !ranges?.length) return false;
    let any = false;
    forEachCell(ranges, (r, c) => {
      if (!any && hasCheckboxFormat(data[r]?.[c])) any = true;
    });
    if (!any) return false;
    toggleCheckboxes(ctx, ranges);
    return true;
  },
});

/** Checkbox cells of a sheet (for exporters). */
export function checkboxCells(ctx: Context, sheetId?: string) {
  const idx = getSheetIndex(ctx, sheetId ?? ctx.currentSheetId);
  const data = idx == null ? null : ctx.luckysheetfile[idx]?.data;
  const out: { r: number; c: number }[] = [];
  data?.forEach((row, r) =>
    row?.forEach((cell, c) => {
      if (hasCheckboxFormat(cell)) out.push({ r, c });
    })
  );
  return out;
}
