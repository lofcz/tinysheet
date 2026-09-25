/**
 * Pictures in cells: loading and drawing.
 *
 * `installCellImages()` registers a cell decorator that draws `cell.img`
 * instead of the cell's text. Pictures load asynchronously into a bounded
 * LRU cache; while one loads the cell shows a placeholder, a picture that
 * fails to load shows a broken-picture mark (and its alt text when there is
 * room). Listeners registered with `onCellImageLoad` are told when a picture
 * finished loading (or failed), so the UI can redraw the sheet.
 *
 * Security: only http(s) and data:image sources are ever loaded
 * (`isAllowedImageSource`); anything else draws as broken. Remote pictures
 * are first requested with CORS (so the canvas stays readable for exports
 * such as screenshots) and, when the server refuses, without it: the
 * picture then still shows, but taints the canvas. Hosts can route loads
 * through their own code (a proxy, authentication) with
 * `setCellImageLoader`.
 */
import type { CellImage } from "../types";
import type { CellDecorator, CellDecoratorArgs } from "./extensions";
import { registerCellDecorator } from "./extensions";
import { isAllowedImageSource } from "./cellImage";
import { getCanvasTheme } from "../theme";

/** A loaded picture: anything canvas can draw, with its natural size. */
export type LoadedCellImage = {
  image: Parameters<CanvasRenderingContext2D["drawImage"]>[0];
  width: number;
  height: number;
};

export type CellImageLoader = (src: string) => Promise<LoadedCellImage>;

type Entry = {
  status: "loading" | "loaded" | "error";
  loaded?: LoadedCellImage;
};

/** Most pictures kept decoded at once (least recently drawn go first). */
export const CELL_IMAGE_CACHE_SIZE = 200;

const cache = new Map<string, Entry>();
const listeners = new Set<(src: string) => void>();

function loadWith(src: string, cors: boolean): Promise<LoadedCellImage> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (cors) img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => {
      // SVGs without a size report 0: draw them as a square
      const width = img.naturalWidth || img.width || 100;
      const height = img.naturalHeight || img.height || width;
      resolve({ image: img, width, height });
    };
    img.onerror = () => reject(new Error("load"));
    img.src = src;
  });
}

/** Browser loader: CORS first for remote pictures, then without. */
export const defaultCellImageLoader: CellImageLoader = (src) => {
  if (typeof Image === "undefined") {
    return Promise.reject(new Error("no Image"));
  }
  if (/^data:/i.test(src)) return loadWith(src, false);
  return loadWith(src, true).catch(() => loadWith(src, false));
};

let loader: CellImageLoader = defaultCellImageLoader;

/** Replace how pictures are loaded (null restores the browser loader). */
export function setCellImageLoader(next: CellImageLoader | null) {
  loader = next ?? defaultCellImageLoader;
  cache.clear();
}

/** Call `listener(src)` whenever a picture finished loading or failed. */
export function onCellImageLoad(listener: (src: string) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify(src: string) {
  listeners.forEach((l) => {
    try {
      l(src);
    } catch (e) {
      // a failing listener must not stop the others
    }
  });
}

/** Forget every cached picture (e.g. to reload them). */
export function clearCellImageCache() {
  cache.clear();
}

/**
 * The cache entry of a picture, starting its load on first use. Recently
 * used entries move to the end of the LRU order.
 */
export function getCellImage(src: string): Entry {
  let entry = cache.get(src);
  if (entry) {
    cache.delete(src);
    cache.set(src, entry);
    return entry;
  }
  entry = { status: "loading" };
  cache.set(src, entry);
  while (cache.size > CELL_IMAGE_CACHE_SIZE) {
    const oldest = cache.keys().next().value as string;
    cache.delete(oldest);
  }
  const current = entry;
  if (!isAllowedImageSource(src)) {
    current.status = "error";
    return current;
  }
  let promise: Promise<LoadedCellImage>;
  try {
    promise = loader(src);
  } catch (e) {
    promise = Promise.reject(e);
  }
  promise.then(
    (loaded) => {
      current.status = "loaded";
      current.loaded = loaded;
      notify(src);
    },
    () => {
      current.status = "error";
      notify(src);
    }
  );
  return current;
}

export type ImageRect = { x: number; y: number; w: number; h: number };

/**
 * Where a picture of natural size `natW` x `natH` goes in the cell box
 * (canvas pixels, zoom applied), for its sizing mode and the cell's
 * alignment (`ht`: 0 centre, 1 left, 2 right; `vt`: 0 middle, 1 top,
 * 2 bottom; pictures default to centred).
 */
export function cellImageRect(
  img: Pick<CellImage, "sizing" | "h" | "w">,
  natW: number,
  natH: number,
  box: ImageRect,
  zoomRatio?: number,
  ht?: number | string | null,
  vt?: number | string | null
): ImageRect {
  const zoom = zoomRatio ?? 1;
  const pad = Math.max(1, Math.round(2 * zoom));
  const bw = Math.max(0, box.w - 2 * pad);
  const bh = Math.max(0, box.h - 2 * pad);
  const nw = natW > 0 ? natW : 1;
  const nh = natH > 0 ? natH : 1;
  let w: number;
  let h: number;
  switch (img.sizing) {
    case 1:
      w = bw;
      h = bh;
      break;
    case 2:
      w = nw * zoom;
      h = nh * zoom;
      break;
    case 3: {
      const cw = img.w && img.w > 0 ? img.w : null;
      const ch = img.h && img.h > 0 ? img.h : null;
      if (cw != null && ch != null) {
        w = cw;
        h = ch;
      } else if (ch != null) {
        h = ch;
        w = (ch * nw) / nh;
      } else if (cw != null) {
        w = cw;
        h = (cw * nh) / nw;
      } else {
        w = nw;
        h = nh;
      }
      w *= zoom;
      h *= zoom;
      break;
    }
    default: {
      const scale = Math.min(bw / nw, bh / nh);
      w = nw * scale;
      h = nh * scale;
    }
  }
  const hAlign = ht == null || ht === "" ? 0 : Number(ht);
  const vAlign = vt == null || vt === "" ? 0 : Number(vt);
  let x = box.x + pad + (bw - w) / 2;
  if (hAlign === 1) x = box.x + pad;
  else if (hAlign === 2) x = box.x + pad + bw - w;
  let y = box.y + pad + (bh - h) / 2;
  if (vAlign === 1) y = box.y + pad;
  else if (vAlign === 2) y = box.y + pad + bh - h;
  return { x, y, w, h };
}

/** A small picture glyph (frame, sun, mountain), optionally struck out. */
function drawPictureGlyph(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  color: string,
  broken: string | null
) {
  const w = size;
  const h = size * 0.78;
  const x = cx - w / 2;
  const y = cy - h / 2;
  g.lineWidth = Math.max(1, size / 14);
  g.strokeStyle = color;
  g.fillStyle = color;
  g.strokeRect(x, y, w, h);
  g.beginPath();
  g.arc(x + w * 0.7, y + h * 0.3, size * 0.09, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.moveTo(x + w * 0.08, y + h * 0.92);
  g.lineTo(x + w * 0.38, y + h * 0.48);
  g.lineTo(x + w * 0.6, y + h * 0.78);
  g.lineTo(x + w * 0.72, y + h * 0.62);
  g.lineTo(x + w * 0.92, y + h * 0.92);
  g.closePath();
  g.fill();
  if (broken) {
    g.strokeStyle = broken;
    g.lineWidth = Math.max(1.5, size / 9);
    g.beginPath();
    g.moveTo(x - size * 0.1, y + h + size * 0.1);
    g.lineTo(x + w + size * 0.1, y - size * 0.1);
    g.stroke();
  }
}

function drawPlaceholder(
  args: CellDecoratorArgs,
  img: CellImage,
  broken: boolean
) {
  const { renderCtx: g, x, y, w, h, zoom } = args;
  const theme = getCanvasTheme(args.ctx);
  const pad = Math.max(1, Math.round(2 * zoom));
  const size = Math.max(0, Math.min(16 * zoom, w - 2 * pad, h - 2 * pad));
  if (size < 4) return;
  g.fillStyle = theme.headerBackground;
  g.fillRect(x + pad, y + pad, w - 2 * pad, h - 2 * pad);
  const alt = broken ? (img.alt ?? "") : "";
  const fontPx = Math.max(8, Math.round(11 * zoom));
  g.font = `${fontPx}px sans-serif`;
  const textW = alt ? g.measureText(alt).width : 0;
  const room = w - 2 * pad - size - 6 * zoom;
  const showText = alt !== "" && room > fontPx * 1.5;
  const total = showText ? size + 4 * zoom + Math.min(textW, room) : size;
  const left = x + (w - total) / 2;
  drawPictureGlyph(
    g,
    left + size / 2,
    y + h / 2,
    size,
    theme.headerText,
    broken ? theme.commentMarker : null
  );
  if (showText) {
    g.fillStyle = theme.headerText;
    g.textBaseline = "middle";
    g.textAlign = "left";
    g.fillText(alt, left + size + 4 * zoom, y + h / 2, room);
  }
}

/** The decorator drawing `cell.img`. */
export const cellImageDecorator: CellDecorator = {
  drawContent(args) {
    const img = args.cell?.img;
    if (!img || typeof img.src !== "string") return false;
    const { renderCtx: g, x, y, w, h, zoom } = args;
    if (w <= 1 || h <= 1) return true;
    g.beginPath();
    g.rect(x, y, w, h);
    g.clip();
    const entry = getCellImage(img.src);
    if (entry.status !== "loaded" || !entry.loaded) {
      drawPlaceholder(args, img, entry.status === "error");
      return true;
    }
    const { image, width, height } = entry.loaded;
    const cell = args.cell!;
    const rect = cellImageRect(
      img,
      width,
      height,
      { x, y, w, h },
      zoom,
      // explicit alignment only: pictures are centred by default
      cell.ht,
      cell.vt
    );
    if (rect.w <= 0 || rect.h <= 0) return true;
    g.imageSmoothingEnabled = true;
    try {
      g.drawImage(image, rect.x, rect.y, rect.w, rect.h);
    } catch (e) {
      drawPlaceholder(args, img, true);
    }
    return true;
  },
};

let uninstall: (() => void) | null = null;

/** Draw `cell.img` pictures on the grid (idempotent). */
export function installCellImages() {
  if (!uninstall) {
    uninstall = registerCellDecorator("cellImage", cellImageDecorator);
  }
  return () => {
    uninstall?.();
    uninstall = null;
  };
}
