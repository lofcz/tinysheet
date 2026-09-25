/**
 * Pictures in cells (Excel 365 "images in cells"): the cell model.
 *
 * A cell holding a picture carries it in `cell.img` (a CellImage) next to
 * its text form: `v` and `m` are the picture's alt text, so text functions,
 * sorting, filtering, CSV and "copy as text" see the alt text, while copy,
 * paste, fill, sort, undo and collaboration move `img` with the cell like
 * any other cell field. Two kinds of cells hold one:
 *
 * - formula cells whose result is an image value (`=IMAGE(...)`, `=A1` of a
 *   picture cell, spilled arrays of pictures): `img` is recomputed with the
 *   formula;
 * - placed pictures (Insert > Picture > Place in Cell, paste of an image):
 *   `img` is the cell's value, there is no formula.
 *
 * Formulas reading a picture cell get an image value (see
 * `@lofcz/tinysheet-formula-parser`'s `isImageValue`), so `=A1` or
 * `=XLOOKUP(..., pictures)` return the picture itself.
 *
 * Drawing lives in cellImageDraw.ts, editing commands in cellImageEdit.ts.
 */
import {
  createImageValue,
  isAllowedImageSource,
  isImageValue,
} from "@lofcz/tinysheet-formula-parser";
import type { Cell, CellImage } from "../types";

export { isAllowedImageSource, isImageValue };

/** The cell field of an image value (formula result or placed picture). */
export function cellImageFromValue(value: any): CellImage {
  const img: CellImage = { src: String(value.src) };
  if (value.alt != null && value.alt !== "") img.alt = String(value.alt);
  const sizing = Number(value.sizing);
  if (sizing === 1 || sizing === 2 || sizing === 3) img.sizing = sizing;
  if (img.sizing === 3) {
    if (Number(value.h) > 0) img.h = Number(value.h);
    if (Number(value.w) > 0) img.w = Number(value.w);
  }
  return img;
}

/** The image value formulas read from a picture cell. */
export function cellImageValue(img: CellImage) {
  return createImageValue({
    src: img.src,
    alt: img.alt ?? "",
    sizing: img.sizing ?? 0,
    h: img.h,
    w: img.w,
  });
}

/** Text form of a picture: its alt text. */
export function cellImageText(img: CellImage | null | undefined) {
  return img?.alt ?? "";
}

/**
 * Store a picture (an image value or a CellImage) as the cell's value: `img`
 * plus its text form in `v`/`m`. Keeps the cell's number format.
 */
export function applyCellImage(cell: Cell, value: CellImage | any) {
  const img = cellImageFromValue(value);
  const text = cellImageText(img);
  cell.img = img;
  cell.v = text;
  cell.m = text;
  const fa = cell.ct?.fa || "General";
  cell.ct = { fa, t: fa === "@" ? "s" : "g" };
  delete cell.qp;
}

/** Whether the cell holds a picture (placed or computed). */
export function isImageCell(cell: Cell | null | undefined): boolean {
  return !!cell?.img && typeof cell.img.src === "string";
}

/** Whether the cell holds a placed picture (not a formula result). */
export function isPlacedImageCell(cell: Cell | null | undefined): boolean {
  return isImageCell(cell) && !cell!.f;
}

/**
 * Whether a spilled value `v` (image value or scalar) is what cell `cell`
 * already shows, so an unchanged spill does not rewrite its cells.
 */
export function sameImageValue(cell: Cell | null | undefined, v: any) {
  const img = cell?.img;
  if (!isImageValue(v)) return !img;
  if (!img) return false;
  const next = cellImageFromValue(v);
  return (
    img.src === next.src &&
    (img.alt ?? "") === (next.alt ?? "") &&
    (img.sizing ?? 0) === (next.sizing ?? 0) &&
    img.h === next.h &&
    img.w === next.w
  );
}
