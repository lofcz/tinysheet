/**
 * Image values: what IMAGE() returns and what a cell holding a picture reads
 * as (Excel 365 "images in cells").
 *
 * An image value is an object `{ type: "image", src, alt, sizing, h, w }`:
 *
 * - `src`: the picture's address. Only `http:`/`https:` URLs and
 *   `data:image/...` URLs are accepted (see `isAllowedImageSource`): other
 *   schemes (`javascript:`, `file:`, `blob:`, relative paths, ...) would let a
 *   workbook reach local or page-relative resources, so IMAGE() rejects them
 *   with #VALUE! like Excel rejects non-https sources.
 * - `alt`: alternative text (""); it is also the value's text form, used when
 *   the image meets text (`&`, LEN, CONCAT, copy as text, CSV).
 * - `sizing`: 0 fit in the cell keeping the aspect ratio, 1 fill the cell,
 *   2 original size, 3 custom size `h` x `w` (pixels).
 *
 * Values are instances of ImageValue so they are not mistaken for plain
 * objects (cells) by hosts, but any object with `type: "image"` and a string
 * `src` counts as an image value (`isImageValue`).
 */

export const IMAGE_SIZING_FIT = 0;
export const IMAGE_SIZING_FILL = 1;
export const IMAGE_SIZING_ORIGINAL = 2;
export const IMAGE_SIZING_CUSTOM = 3;

export class ImageValue {
  constructor({ src, alt = "", sizing = 0, h, w }) {
    this.type = "image";
    this.src = src;
    this.alt = alt;
    this.sizing = sizing;
    if (h !== undefined && h !== null) this.h = h;
    if (w !== undefined && w !== null) this.w = w;
  }

  /** The text form of the picture: its alternative text. */
  toString() {
    return this.alt || "";
  }
}

/**
 * @param {*} value
 * @returns {Boolean} Whether `value` is an image value.
 */
export function isImageValue(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    value.type === "image" &&
    typeof value.src === "string"
  );
}

/**
 * @param {Object} props {src, alt, sizing, h, w}
 * @returns {ImageValue}
 */
export function createImageValue(props) {
  return new ImageValue(props);
}

/**
 * Text form of an image value (its alt text).
 *
 * @param {Object} value Image value.
 * @returns {String}
 */
export function imageValueText(value) {
  return value && value.alt != null ? String(value.alt) : "";
}

const DATA_IMAGE_RE = /^data:image\/[a-z0-9.+-]+(;[a-z0-9=.+-]+)*(;base64)?,/i;

/**
 * Sources a picture may be loaded from: absolute http(s) URLs and inline
 * `data:image/...` URLs.
 *
 * @param {*} src
 * @returns {Boolean}
 */
export function isAllowedImageSource(src) {
  if (typeof src !== "string") return false;
  const s = src.trim();
  if (s === "") return false;
  if (DATA_IMAGE_RE.test(s)) return true;
  return /^https?:\/\/[^\s/?#]+/i.test(s);
}
