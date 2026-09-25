import _ from "lodash";
import { checkProtection } from "./protection";
import { GlobalCache } from "../types";
import { mergeBorder } from ".";
import { Context, getFlowdata } from "../context";
import { getSheetIndex } from "../utils";

type ImageProps = {
  defaultWidth: number;
  defaultHeight: number;
  currentObj: null;
  currentWinW: null;
  currentWinH: null;
  resize: null;
  resizeXY: null;
  move: boolean;
  moveXY: object | null;
  cursorStartPosition: { x: number; y: number } | null;
};

export const imageProps: ImageProps = {
  defaultWidth: 144,
  defaultHeight: 84,
  currentObj: null,
  currentWinW: null,
  currentWinH: null,
  resize: null,
  resizeXY: null,
  move: false,
  moveXY: null,
  cursorStartPosition: null,
};

export function generateRandomId(prefix: string) {
  if (prefix == null) {
    prefix = "img";
  }

  const userAgent = window.navigator.userAgent
    .replace(/[^a-zA-Z0-9]/g, "")
    .split("");

  let mid = "";

  for (let i = 0; i < 12; i += 1) {
    mid += userAgent[Math.round(Math.random() * (userAgent.length - 1))];
  }

  const time = new Date().getTime();

  return `${prefix}_${mid}_${time}`;
}

export function showImgChooser() {
  const chooser = document.getElementById(
    "fortune-img-upload"
  ) as HTMLInputElement;
  if (chooser) chooser.click();
}

export function saveImage(ctx: Context) {
  const index = getSheetIndex(ctx, ctx.currentSheetId);
  if (index == null) return;
  const file = ctx.luckysheetfile[index];

  file.images = ctx.insertedImgs;
}

export function removeActiveImage(ctx: Context) {
  if (!checkProtection(ctx, "editObjects")) return;
  ctx.insertedImgs = _.filter(
    ctx.insertedImgs,
    (image) => image.id !== ctx.activeImg
  );
  ctx.activeImg = undefined;
  saveImage(ctx);
}

export function insertImage(ctx: Context, image: HTMLImageElement) {
  if (!checkProtection(ctx, "editObjects")) return;
  try {
    const last =
      ctx.luckysheet_select_save?.[ctx.luckysheet_select_save.length - 1];
    let rowIndex = last?.row_focus;
    let colIndex = last?.column_focus;
    if (!last) {
      rowIndex = 0;
      colIndex = 0;
    } else {
      if (rowIndex == null) {
        [rowIndex] = last.row;
      }
      if (colIndex == null) {
        [colIndex] = last.column;
      }
    }
    const flowdata = getFlowdata(ctx);
    let left = colIndex === 0 ? 0 : ctx.visibledatacolumn[colIndex - 1];
    let top = rowIndex === 0 ? 0 : ctx.visibledatarow[rowIndex - 1];
    if (flowdata) {
      const margeset = mergeBorder(ctx, flowdata, rowIndex, colIndex);
      if (margeset) {
        [top] = margeset.row;
        [left] = margeset.column;
      }
    }
    const { width } = image;
    const { height } = image;
    const img = {
      id: generateRandomId("img"),
      src: image.src,
      left,
      top,
      width: width * 0.5,
      height: height * 0.5,
      originWidth: width,
      originHeight: height,
    };
    ctx.insertedImgs = (ctx.insertedImgs || []).concat(img);
    saveImage(ctx);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.info(err);
  }
}

/** The active picture's box in screen px (zoomed), from its data. */
function activeImageRect(ctx: Context, id = ctx.activeImg) {
  const img = _.find(ctx.insertedImgs, (v) => v.id === id);
  if (!img) return undefined;
  const zoom = ctx.zoomRatio || 1;
  return {
    left: img.left * zoom,
    top: img.top * zoom,
    width: img.width * zoom,
    height: img.height * zoom,
  };
}

/** Show `rect` (screen px) on the active picture while it is dragged. */
function showImageRect(rect: {
  left: number;
  top: number;
  width: number;
  height: number;
}) {
  const box = document.getElementById("luckysheet-modal-dialog-activeImage");
  if (!box) return;
  box.style.left = `${rect.left}px`;
  box.style.top = `${rect.top}px`;
  box.style.width = `${rect.width}px`;
  box.style.height = `${rect.height}px`;
  const content = box.querySelector<HTMLElement>(
    ".luckysheet-modal-dialog-content"
  );
  if (content) {
    content.style.width = `${rect.width}px`;
    content.style.height = `${rect.height}px`;
    content.style.backgroundSize = `${rect.width}px ${rect.height}px`;
  }
}

/** The nearest row / column edge (sheet px, zoomed) to `pos`: Alt snaps. */
function snapToGrid(edges: number[], pos: number) {
  let best = 0;
  let bestDist = Math.abs(pos);
  const i = _.sortedIndex(edges, pos);
  [i - 1, i].forEach((k) => {
    const edge = edges[k];
    if (edge == null) return;
    const dist = Math.abs(edge - pos);
    if (dist < bestDist) {
      best = edge;
      bestDist = dist;
    }
  });
  return best;
}

/** A picture moves or resizes only once the pointer moved this far (px). */
const IMAGE_DRAG_THRESHOLD = 3;

export function cancelActiveImgItem(ctx: Context, globalCache: GlobalCache) {
  ctx.activeImg = undefined;
  globalCache.image = undefined;
}

/**
 * Mouse down on a picture: select it (`id`, when it is not the active one)
 * and start moving it. Like Excel, one gesture selects and drags.
 */
export function onImageMoveStart(
  ctx: Context,
  globalCache: GlobalCache,
  e: MouseEvent,
  id?: string
) {
  if (id != null) ctx.activeImg = id;
  if (!checkProtection(ctx, "editObjects")) return;
  const position = activeImageRect(ctx);
  if (position) {
    globalCache.image = {
      cursorMoveStartPosition: { x: e.pageX, y: e.pageY },
      imgInitialPosition: position,
      resizingSide: undefined,
    };
  }
}

export function onImageMove(
  ctx: Context,
  globalCache: GlobalCache,
  e: MouseEvent
) {
  if (ctx.allowEdit === false) return false;
  const image = globalCache?.image;
  if (!image || image.resizingSide) return false;
  const { x: startX, y: startY } = image.cursorMoveStartPosition!;
  let dx = e.pageX - startX;
  let dy = e.pageY - startY;
  if (
    !image.current &&
    Math.abs(dx) < IMAGE_DRAG_THRESHOLD &&
    Math.abs(dy) < IMAGE_DRAG_THRESHOLD
  ) {
    return true;
  }
  // Shift: only horizontally or vertically (Excel)
  if (e.shiftKey) {
    if (Math.abs(dx) >= Math.abs(dy)) dy = 0;
    else dx = 0;
  }
  const init = image.imgInitialPosition!;
  let left = init.left + dx;
  let top = init.top + dy;
  // Alt: the top-left corner snaps to the cell grid (Excel)
  if (e.altKey) {
    left = snapToGrid(ctx.visibledatacolumn, left);
    top = snapToGrid(ctx.visibledatarow, top);
  }
  image.current = {
    ...init,
    left: Math.max(0, left),
    top: Math.max(0, top),
  };
  showImageRect(image.current);
  return true;
}

export function onImageMoveEnd(ctx: Context, globalCache: GlobalCache) {
  const image = globalCache.image;
  if (!image || image.resizingSide) return;
  globalCache.image = undefined;
  const img = _.find(ctx.insertedImgs, (v) => v.id === ctx.activeImg);
  if (!img || !image.current) return;
  const zoom = ctx.zoomRatio || 1;
  img.left = image.current.left / zoom;
  img.top = image.current.top / zoom;
  saveImage(ctx);
}

export function onImageResizeStart(
  ctx: Context,
  globalCache: GlobalCache,
  e: MouseEvent,
  resizingSide: string
) {
  if (!checkProtection(ctx, "editObjects")) return;
  const position = activeImageRect(ctx);
  if (position) {
    globalCache.image = {
      cursorMoveStartPosition: { x: e.pageX, y: e.pageY },
      resizingSide,
      imgInitialPosition: position,
    };
  }
}

/**
 * The picture's box after dragging handle `side` ("lt", "mt", "rb"...) by
 * (dx, dy) screen px. Corners keep the aspect ratio (a picture's aspect is
 * locked in Excel), edges stretch; Alt snaps a dragged edge to the grid.
 */
function resizedImageRect(
  ctx: Context,
  init: { left: number; top: number; width: number; height: number },
  side: string,
  dx: number,
  dy: number,
  alt: boolean
) {
  const min = 8;
  const leftSide = side[0] === "l";
  const rightSide = side[0] === "r";
  const topSide = side[1] === "t";
  const bottomSide = side[1] === "b";
  let width = init.width;
  let height = init.height;
  if (rightSide) width += dx;
  if (leftSide) width -= dx;
  if (bottomSide) height += dy;
  if (topSide) height -= dy;
  const corner = (leftSide || rightSide) && (topSide || bottomSide);
  if (alt && !corner) {
    if (rightSide) {
      width = snapToGrid(ctx.visibledatacolumn, init.left + width) - init.left;
    }
    if (leftSide) {
      const edge = init.left + init.width;
      width = edge - snapToGrid(ctx.visibledatacolumn, edge - width);
    }
    if (bottomSide) {
      height = snapToGrid(ctx.visibledatarow, init.top + height) - init.top;
    }
    if (topSide) {
      const edge = init.top + init.height;
      height = edge - snapToGrid(ctx.visibledatarow, edge - height);
    }
  }
  width = Math.max(min, width);
  height = Math.max(min, height);
  if (corner && init.width > 0 && init.height > 0) {
    // the axis dragged the most (relative to the size) sets the scale
    const sw = width / init.width;
    const sh = height / init.height;
    const scale = Math.abs(sw - 1) >= Math.abs(sh - 1) ? sw : sh;
    width = Math.max(min, init.width * scale);
    height = Math.max(min, init.height * scale);
  }
  let left = leftSide ? init.left + init.width - width : init.left;
  let top = topSide ? init.top + init.height - height : init.top;
  if (left < 0) {
    width += left;
    left = 0;
  }
  if (top < 0) {
    height += top;
    top = 0;
  }
  return { left, top, width, height };
}

export function onImageResize(
  ctx: Context,
  globalCache: GlobalCache,
  e: MouseEvent
) {
  if (ctx.allowEdit === false) return false;
  const image = globalCache?.image;
  if (!image?.resizingSide) return false;
  const { x: startX, y: startY } = image.cursorMoveStartPosition!;
  const dx = e.pageX - startX;
  const dy = e.pageY - startY;
  if (
    !image.current &&
    Math.abs(dx) < IMAGE_DRAG_THRESHOLD &&
    Math.abs(dy) < IMAGE_DRAG_THRESHOLD
  ) {
    return true;
  }
  image.current = resizedImageRect(
    ctx,
    image.imgInitialPosition!,
    image.resizingSide,
    dx,
    dy,
    e.altKey
  );
  showImageRect(image.current);
  return true;
}

export function onImageResizeEnd(ctx: Context, globalCache: GlobalCache) {
  const image = globalCache.image;
  if (!image?.resizingSide) return;
  globalCache.image = undefined;
  const img = _.find(ctx.insertedImgs, (v) => v.id === ctx.activeImg);
  if (!img || !image.current) return;
  const zoom = ctx.zoomRatio || 1;
  img.left = image.current.left / zoom;
  img.top = image.current.top / zoom;
  img.width = image.current.width / zoom;
  img.height = image.current.height / zoom;
  saveImage(ctx);
}

/** Esc while a picture is moved or resized: it goes back (Excel). */
export function cancelImageDrag(globalCache: GlobalCache) {
  const image = globalCache.image;
  if (!image) return false;
  globalCache.image = undefined;
  if (image.imgInitialPosition) showImageRect(image.imgInitialPosition);
  return true;
}
