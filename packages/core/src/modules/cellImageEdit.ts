/**
 * Pictures in cells: editing commands (Place in Cell / Place over Cells, alt
 * text). Every command mutates a context draft, so the UI records it as one
 * undo step, and recalculates the formulas reading the changed cell.
 */
import _ from "lodash";
import type { Context } from "../context";
import { getFlowdata } from "../context";
import type { Cell, CellImage, Image } from "../types";
import { isAllowEdit } from "../utils";
import {
  applyCellImage,
  cellImageValue,
  isAllowedImageSource,
  isPlacedImageCell,
} from "./cellImage";
import { getCellImage } from "./cellImageDraw";
import { mergeBorder } from "./cell";
import { delFunctionGroup, execFunctionGroup } from "./formula";
import { setFormulaCellInfo } from "./formulaHelper";
import { generateRandomId, saveImage } from "./image";
import { colLocation, rowLocation } from "./location";

/** The active cell of the selection (the merge's master cell), or null. */
function activePictureCell(ctx: Context) {
  const last =
    ctx.luckysheet_select_save?.[ctx.luckysheet_select_save.length - 1];
  if (!last) return null;
  let r = last.row_focus ?? last.row[0];
  let c = last.column_focus ?? last.column[0];
  const d = getFlowdata(ctx);
  const mc = d?.[r]?.[c]?.mc;
  if (mc) {
    r = mc.r;
    c = mc.c;
  }
  return { r, c };
}

function canEdit(ctx: Context, r: number, c: number) {
  if (ctx.allowEdit === false) return false;
  return isAllowEdit(ctx, [{ row: [r, r], column: [c, c] }]);
}

/** Recalculate the dependents of (r, c) after its value changed. */
function recalcFrom(ctx: Context, r: number, c: number, value: any) {
  execFunctionGroup(ctx, r, c, value);
  setFormulaCellInfo(ctx, { r, c, id: ctx.currentSheetId });
  ctx.formulaCache.execFunctionGlobalData = null;
}

/**
 * Put a picture into cell (r, c) of the current sheet as the cell's value
 * (not a formula), replacing its content and keeping its format. Returns
 * false when the cell cannot be edited or the source is not allowed.
 */
export function placeImageInCell(
  ctx: Context,
  r: number,
  c: number,
  img: CellImage
): boolean {
  if (!img || !isAllowedImageSource(img.src)) return false;
  const d = getFlowdata(ctx);
  if (!d?.[r] || c < 0 || c >= d[r].length) return false;
  const mc = d[r][c]?.mc;
  if (mc && (mc.r !== r || mc.c !== c)) {
    // a merged area holds its value in the top-left cell
    return placeImageInCell(ctx, mc.r, mc.c, img);
  }
  if (!canEdit(ctx, r, c)) return false;
  const old = d[r][c];
  if (old?.f) delFunctionGroup(ctx, r, c);
  const next: Cell = old ? _.omit(old, ["f", "spl", "qp", "hl"]) : {};
  if (next.ct?.t === "inlineStr") next.ct = { fa: "General", t: "g" };
  const clean: CellImage = { src: img.src.trim() };
  if (img.alt) clean.alt = img.alt;
  if (img.sizing) clean.sizing = img.sizing;
  if (img.sizing === 3) {
    if (img.h) clean.h = img.h;
    if (img.w) clean.w = img.w;
  }
  applyCellImage(next, clean);
  d[r][c] = next;
  recalcFrom(ctx, r, c, cellImageValue(clean));
  return true;
}

/** Place a picture into the active cell. */
export function placeImageInActiveCell(ctx: Context, img: CellImage) {
  const at = activePictureCell(ctx);
  return at ? placeImageInCell(ctx, at.r, at.c, img) : false;
}

/**
 * Change the alt text of a placed picture (IMAGE() takes it from its
 * arguments). Returns false when (r, c) holds no placed picture.
 */
export function setCellImageAltText(
  ctx: Context,
  r: number,
  c: number,
  alt: string
): boolean {
  const d = getFlowdata(ctx);
  const cell = d?.[r]?.[c];
  if (!cell || !isPlacedImageCell(cell) || !canEdit(ctx, r, c)) return false;
  const img: CellImage = { ...cell.img!, alt: alt || undefined };
  if (!img.alt) delete img.alt;
  const next: Cell = { ...cell };
  applyCellImage(next, img);
  d![r][c] = next;
  recalcFrom(ctx, r, c, cellImageValue(img));
  return true;
}

/**
 * Place over Cells: turn the picture of cell (r, c) into a floating picture
 * over that cell (its natural size, scaled down to at most 400 x 300), and
 * clear the cell's content. Works for placed pictures and IMAGE() results
 * (the formula is removed, like Excel's "Place over Cells" on a formula
 * picture). Returns the new floating picture's id, or null.
 */
export function convertCellImageToFloating(
  ctx: Context,
  r: number,
  c: number
): string | null {
  const d = getFlowdata(ctx);
  const cell = d?.[r]?.[c];
  const img = cell?.img;
  if (!cell || !img || !canEdit(ctx, r, c)) return null;
  const zoom = ctx.zoomRatio || 1;
  const left = (c === 0 ? 0 : ctx.visibledatacolumn[c - 1] ?? 0) / zoom;
  const top = (r === 0 ? 0 : ctx.visibledatarow[r - 1] ?? 0) / zoom;
  const cellW = (ctx.visibledatacolumn[c] ?? 0) / zoom - left;
  const cellH = (ctx.visibledatarow[r] ?? 0) / zoom - top;
  const { loaded } = getCellImage(img.src);
  let width = loaded?.width ?? Math.max(cellW, 72);
  let height = loaded?.height ?? Math.max(cellH, 48);
  const scale = Math.min(1, 400 / width, 300 / height);
  width *= scale;
  height *= scale;
  const id = generateRandomId("img");
  const floating: Image & Record<string, any> = {
    id,
    src: img.src,
    left,
    top,
    width,
    height,
    originWidth: loaded?.width ?? width,
    originHeight: loaded?.height ?? height,
  };
  if (img.alt) floating.alt = img.alt;
  ctx.insertedImgs = (ctx.insertedImgs || []).concat(floating);
  saveImage(ctx);
  if (cell.f) delFunctionGroup(ctx, r, c);
  const kept: Cell = _.omit(cell, ["v", "m", "f", "spl", "qp", "img"]);
  if (!kept.ct?.fa || kept.ct.fa === "General") delete kept.ct;
  d![r][c] = _.isEmpty(kept) ? null : kept;
  recalcFrom(ctx, r, c, null);
  ctx.activeImg = id;
  return id;
}

/**
 * Place in Cell: move a floating picture (the active one by default) into
 * the cell under its top-left corner. Returns the target cell, or null.
 */
export function convertFloatingImageToCell(
  ctx: Context,
  imageId: string | undefined = ctx.activeImg
): { r: number; c: number } | null {
  const images = ctx.insertedImgs || [];
  const image = images.find((i) => i.id === imageId);
  if (!image || !isAllowedImageSource(image.src)) return null;
  const zoom = ctx.zoomRatio || 1;
  // the centre of the picture's top-left corner area picks the cell
  let r = rowLocation(image.top * zoom + 1, ctx.visibledatarow)[2];
  let c = colLocation(image.left * zoom + 1, ctx.visibledatacolumn)[2];
  const d = getFlowdata(ctx);
  if (!d) return null;
  r = Math.max(0, Math.min(r, d.length - 1));
  c = Math.max(0, Math.min(c, (d[0]?.length ?? 1) - 1));
  const margeset = mergeBorder(ctx, d, r, c);
  if (margeset) {
    [, , r] = margeset.row;
    [, , c] = margeset.column;
  }
  const alt = (image as any).alt as string | undefined;
  if (!placeImageInCell(ctx, r, c, { src: image.src, alt })) return null;
  ctx.insertedImgs = images.filter((i) => i.id !== image.id);
  if (ctx.activeImg === image.id) ctx.activeImg = undefined;
  saveImage(ctx);
  return { r, c };
}
