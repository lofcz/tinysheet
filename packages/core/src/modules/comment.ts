import _ from "lodash";
import { checkProtection } from "./protection";
import { mergeBorder } from "./cell";
import { peekCell } from "./dependencyGraph";

import { Context, getFlowdata } from "../context";
import { CellMatrix, GlobalCache } from "../types";
import { colLocation, rowLocation } from "./location";
import { isAllowEdit } from "../utils";

export function getArrowCanvasSize(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number
) {
  let left = toX - 5;

  if (fromX < toX) {
    left = fromX - 5;
  }

  let top = toY - 5;

  if (fromY < toY) {
    top = fromY - 5;
  }

  const width = Math.abs(fromX - toX) + 10;
  const height = Math.abs(fromY - toY) + 10;

  let x1 = width - 5;
  let x2 = 5;

  if (fromX < toX) {
    x1 = 5;
    x2 = width - 5;
  }

  let y1 = height - 5;
  let y2 = 5;

  if (fromY < toY) {
    y1 = 5;
    y2 = height - 5;
  }

  return { left, top, width, height, fromX: x1, fromY: y1, toX: x2, toY: y2 };
}

export function drawArrow(
  rc: string,
  {
    left,
    top,
    width,
    height,
    fromX,
    fromY,
    toX,
    toY,
  }: {
    left: number;
    top: number;
    width: number;
    height: number;
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
  },
  color?: string,
  theta?: number,
  headlen?: number
) {
  const canvas = document.getElementById(
    `arrowCanvas-${rc}`
  ) as HTMLCanvasElement | null;
  const ctx = canvas?.getContext("2d");
  if (!canvas || !ctx) return;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  canvas.width = width;
  canvas.height = height;
  canvas.style.left = `${left}px`;
  canvas.style.top = `${top}px`;
  const { width: canvasWidth, height: canvasHeight } =
    canvas.getBoundingClientRect();
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  theta = theta || 30;
  headlen = headlen || 6;
  // width = width || 1;
  const arrowWidth = 1;
  // follow the theme: --fortune-note-arrow is set on the workbook container
  color =
    color ||
    (typeof getComputedStyle === "function"
      ? getComputedStyle(canvas).getPropertyValue("--fortune-note-arrow").trim()
      : "") ||
    "#000";

  const angle = (Math.atan2(fromY - toY, fromX - toX) * 180) / Math.PI;
  const angle1 = ((angle + theta) * Math.PI) / 180;
  const angle2 = ((angle - theta) * Math.PI) / 180;
  const topX = headlen * Math.cos(angle1);
  const topY = headlen * Math.sin(angle1);
  const botX = headlen * Math.cos(angle2);
  const botY = headlen * Math.sin(angle2);

  ctx.save();
  ctx.beginPath();

  let arrowX = fromX - topX;
  let arrowY = fromY - topY;

  ctx.moveTo(arrowX, arrowY);
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX, toY);

  ctx.lineWidth = arrowWidth;
  ctx.strokeStyle = color;
  ctx.stroke();

  arrowX = toX + topX;
  arrowY = toY + topY;
  ctx.moveTo(arrowX, arrowY);
  ctx.lineTo(toX, toY);
  arrowX = toX + botX;
  arrowY = toY + botY;
  ctx.lineTo(arrowX, arrowY);

  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

type CommentBoxProps = {
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

export const commentBoxProps: CommentBoxProps = {
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

export function getCellTopRightPostion(
  ctx: Context,
  flowdata: CellMatrix,
  r: number,
  c: number
) {
  // let row = ctx.visibledatarow[r];
  let row_pre = r - 1 === -1 ? 0 : ctx.visibledatarow[r - 1];
  let col = ctx.visibledatacolumn[c];
  //  let col_pre = c - 1 === -1 ? 0 : ctx.visibledatacolumn[c - 1];

  const margeset = mergeBorder(ctx, flowdata, r, c);
  if (margeset) {
    // row = margeset.row[1];
    [row_pre] = margeset.row;
    // col_pre = margeset.column[0];
    [, col] = margeset.column;
  }

  const toX = col;
  const toY = row_pre;
  return { toX, toY };
}

export function getCommentBoxByRC(
  ctx: Context,
  flowdata: CellMatrix,
  r: number,
  c: number
) {
  const comment = flowdata[r][c]?.ps;
  const { toX, toY } = getCellTopRightPostion(ctx, flowdata, r, c);
  // let scrollLeft = $("#luckysheet-cell-main").scrollLeft();
  // let scrollTop = $("#luckysheet-cell-main").scrollTop();

  // if(luckysheetFreezen.freezenverticaldata != null && toX < (luckysheetFreezen.freezenverticaldata[0] - luckysheetFreezen.freezenverticaldata[2])){
  //     toX += scrollLeft;
  // }
  // if(luckysheetFreezen.freezenhorizontaldata != null && toY < (luckysheetFreezen.freezenhorizontaldata[0] - luckysheetFreezen.freezenhorizontaldata[2])){
  //     toY += scrollTop;
  // }
  const left =
    comment?.left == null
      ? toX + 18 * ctx.zoomRatio
      : comment.left * ctx.zoomRatio;
  let top =
    comment?.top == null
      ? toY - 18 * ctx.zoomRatio
      : comment.top * ctx.zoomRatio;
  const width =
    comment?.width == null
      ? commentBoxProps.defaultWidth * ctx.zoomRatio
      : comment.width * ctx.zoomRatio;
  const height =
    comment?.height == null
      ? commentBoxProps.defaultHeight * ctx.zoomRatio
      : comment.height * ctx.zoomRatio;
  const value = comment?.value == null ? "" : comment.value;

  if (top < 0) {
    top = 2;
  }
  const size = getArrowCanvasSize(left, top, toX, toY);
  const rc = `${r}_${c}`;
  return { r, c, rc, left, top, width, height, value, size, autoFocus: false };
}

export function setEditingComment(
  ctx: Context,
  flowdata: CellMatrix,
  r: number,
  c: number
) {
  ctx.editingCommentBox = getCommentBoxByRC(ctx, flowdata, r, c);
}

export function removeEditingComment(ctx: Context, globalCache: GlobalCache) {
  const { editingCommentBoxEle } = globalCache;
  ctx.editingCommentBox = undefined;
  let r: any = editingCommentBoxEle?.dataset.r;
  let c: any = editingCommentBoxEle?.dataset.c;
  if (!r || !c || !editingCommentBoxEle) return;
  r = parseInt(r, 10);
  c = parseInt(c, 10);
  const value = editingCommentBoxEle.innerHTML || "";
  const flowdata = getFlowdata(ctx);
  globalCache.editingCommentBoxEle = undefined;
  if (!flowdata) return;

  if (ctx.hooks.beforeUpdateComment?.(r, c, value) === false) {
    return;
  }

  //  const prevCell = _.cloneDeep(flowdata?.[r][c]) || {};
  const cell = flowdata?.[r][c];
  if (!cell?.ps) return;

  const oldValue = cell.ps.value;
  cell.ps.value = value;
  if (!cell.ps.isShow) {
    ctx.commentBoxes = _.filter(ctx.commentBoxes, (v) => v.rc !== `${r}_${c}`);
  }

  if (ctx.hooks.afterUpdateComment) {
    setTimeout(() => {
      ctx.hooks.afterUpdateComment?.(r, c, oldValue, value);
    });
  }
}

export function newComment(
  ctx: Context,
  globalCache: GlobalCache,
  r: number,
  c: number
) {
  if (!checkProtection(ctx, "editObjects")) return;
  // if(!checkProtectionAuthorityNormal(Store.currentSheetId, "editObjects")){
  //     return;
  // }
  // notes are objects: Edit Objects decides, not the cell's lock
  const allowEdit = isAllowEdit(ctx, undefined, true);
  if (!allowEdit) return;
  if (ctx.hooks.beforeInsertComment?.(r, c) === false) {
    return;
  }
  removeEditingComment(ctx, globalCache);
  const flowdata = getFlowdata(ctx);
  if (!flowdata) return;

  let cell = flowdata[r][c];
  if (cell == null) {
    cell = {};
    flowdata[r][c] = cell;
  }
  cell.ps = {
    left: null,
    top: null,
    width: null,
    height: null,
    value: "",
    isShow: false,
  };
  ctx.editingCommentBox = {
    ...getCommentBoxByRC(ctx, flowdata, r, c),
    autoFocus: true,
  };

  if (ctx.hooks.afterInsertComment) {
    setTimeout(() => {
      ctx.hooks.afterInsertComment?.(r, c);
    });
  }
}

export function editComment(
  ctx: Context,
  globalCache: GlobalCache,
  r: number,
  c: number
) {
  if (!checkProtection(ctx, "editObjects")) return;
  // if(!checkProtectionAuthorityNormal(Store.currentSheetId, "editObjects")){
  //     return;
  // }
  // notes are objects: Edit Objects decides, not the cell's lock
  const allowEdit = isAllowEdit(ctx, undefined, true);
  if (!allowEdit) return;
  const flowdata = getFlowdata(ctx);
  removeEditingComment(ctx, globalCache);
  const comment = flowdata?.[r][c]?.ps;
  const commentBoxes = _.concat(ctx.commentBoxes, ctx.editingCommentBox);
  if (_.findIndex(commentBoxes, (v) => v?.rc === `${r}_${c}`) !== -1) {
    const editCommentBox = document.getElementById(
      `comment-editor-${r}_${c}`
    ) as HTMLDivElement;
    editCommentBox?.focus();
  }
  if (comment) {
    ctx.editingCommentBox = {
      ...getCommentBoxByRC(ctx, flowdata, r, c),
      autoFocus: true,
    };
  }
}

export function deleteComment(
  ctx: Context,
  globalCache: GlobalCache,
  r: number,
  c: number
) {
  if (!checkProtection(ctx, "editObjects")) return;
  // if(!checkProtectionAuthorityNormal(Store.currentSheetId, "editObjects")){
  //     return;
  // }
  // notes are objects: Edit Objects decides, not the cell's lock
  const allowEdit = isAllowEdit(ctx, undefined, true);
  if (!allowEdit) return;
  if (ctx.hooks.beforeDeleteComment?.(r, c) === false) {
    return;
  }

  const flowdata = getFlowdata(ctx);
  if (!flowdata) return;

  const cell = flowdata[r][c];
  if (!cell) return;
  cell.ps = undefined;

  if (ctx.hooks.afterDeleteComment) {
    setTimeout(() => {
      ctx.hooks.afterDeleteComment?.(r, c);
    });
  }
}

export function showComments(
  ctx: Context,
  commentShowCells: { r: number; c: number }[]
) {
  const flowdata = getFlowdata(ctx);
  if (flowdata) {
    const commentBoxes = commentShowCells.map(({ r, c }) =>
      getCommentBoxByRC(ctx, flowdata, r, c)
    );
    ctx.commentBoxes = commentBoxes;
  }
}

export function showHideComment(
  ctx: Context,
  globalCache: GlobalCache,
  r: number,
  c: number
) {
  const flowdata = getFlowdata(ctx);
  const comment = flowdata?.[r][c]?.ps;
  if (!comment) return;
  const { isShow } = comment;
  const rc = `${r}_${c}`;

  if (isShow) {
    comment.isShow = false;
    ctx.commentBoxes = _.filter(ctx.commentBoxes, (v) => v.rc !== rc);
  } else {
    comment.isShow = true;
  }
}

export function showHideAllComments(ctx: Context) {
  const flowdata = getFlowdata(ctx);
  if (!flowdata) return;

  let isAllShow = true;
  const allComments = [];

  for (let r = 0; r < flowdata.length; r += 1) {
    for (let c = 0; c < flowdata[0].length; c += 1) {
      const cell = flowdata[r][c];
      if (cell?.ps) {
        allComments.push({ r, c });

        if (!cell.ps.isShow) {
          isAllShow = false;
        }
      }
    }
  }

  const rcs = [];
  if (allComments.length > 0) {
    if (isAllShow) {
      for (let i = 0; i < allComments.length; i += 1) {
        const { r, c } = allComments[i];
        const comment = flowdata[r][c]?.ps;

        if (comment?.isShow) {
          comment.isShow = false;
          rcs.push(`${r}_${c}`);
        }
      }
      ctx.commentBoxes = [];
    } else {
      for (let i = 0; i < allComments.length; i += 1) {
        const { r, c } = allComments[i];
        const comment = flowdata[r][c]?.ps;

        if (comment && !comment.isShow) {
          comment.isShow = true;
        }
      }
    }
  }
}

// show comment when mouse is over cell with comment
export function overShowComment(
  ctx: Context,
  e: MouseEvent,
  scrollX: HTMLDivElement,
  scrollY: HTMLDivElement,
  container: HTMLDivElement
) {
  const flowdata = getFlowdata(ctx);
  if (!flowdata) return;
  const { scrollLeft } = scrollX;
  const { scrollTop } = scrollY;
  // $("#luckysheet-postil-overshow").remove();

  // if($(event.target).closest("#luckysheet-cell-main").length == 0){
  //     return;
  // }

  const rect = container.getBoundingClientRect();
  // const mouse = mousePosition(e.pageX, e.pageY, ctx);
  let x = e.pageX - rect.left - ctx.rowHeaderWidth;
  let y = e.pageY - rect.top - ctx.columnHeaderHeight;
  const offsetX = 0;
  const offsetY = 0;

  //   if (
  //     luckysheetFreezen.freezenverticaldata != null &&
  //     mouse[0] <
  //       luckysheetFreezen.freezenverticaldata[0] -
  //         luckysheetFreezen.freezenverticaldata[2]
  //   ) {
  //     offsetX = scrollLeft;
  //   } else {
  x += scrollLeft;
  //   }

  //   if (
  //     luckysheetFreezen.freezenhorizontaldata != null &&
  //     mouse[1] <
  //       luckysheetFreezen.freezenhorizontaldata[0] -
  //         luckysheetFreezen.freezenhorizontaldata[2]
  //   ) {
  //     offsetY = scrollTop;
  //   } else {
  y += scrollTop;
  //   }

  let r = rowLocation(y, ctx.visibledatarow)[2];
  let c = colLocation(x, ctx.visibledatacolumn)[2];

  const margeset = mergeBorder(ctx, flowdata, r, c);
  if (margeset) {
    [, , r] = margeset.row;
    [, , c] = margeset.column;
  }
  const rc = `${r}_${c}`;

  // read without drafting: a draft row read makes immer copy every row
  const comment = peekCell(flowdata, r, c)?.ps;
  if (
    comment == null ||
    comment.isShow ||
    _.findIndex(ctx.commentBoxes, (v) => v.rc === rc) !== -1 ||
    ctx.editingCommentBox?.rc === rc
  ) {
    ctx.hoveredCommentBox = undefined;
    return;
  }
  if (ctx.hoveredCommentBox?.rc === rc) return;

  // let row = ctx.visibledatarow[row_index];
  let row_pre = r - 1 === -1 ? 0 : ctx.visibledatarow[r - 1];
  let col = ctx.visibledatacolumn[c];
  // let col_pre = col_index - 1 === -1 ? 0 : ctx.visibledatacolumn[col_index - 1];

  if (margeset) {
    //  [, row] = margeset.row;
    [row_pre] = margeset.row;

    [, col] = margeset.column;
    //  [col_pre] = margeset.column;
  }

  const toX = col + offsetX;
  const toY = row_pre + offsetY;

  const left =
    comment.left == null
      ? toX + 18 * ctx.zoomRatio
      : comment.left * ctx.zoomRatio;
  let top =
    comment.top == null
      ? toY - 18 * ctx.zoomRatio
      : comment.top * ctx.zoomRatio;

  if (top < 0) {
    top = 2;
  }

  const width =
    comment.width == null
      ? commentBoxProps.defaultWidth * ctx.zoomRatio
      : comment.width * ctx.zoomRatio;
  const height =
    comment.height == null
      ? commentBoxProps.defaultHeight * ctx.zoomRatio
      : comment.height * ctx.zoomRatio;
  const size = getArrowCanvasSize(left, top, toX, toY);
  const value = comment.value == null ? "" : comment.value;

  ctx.hoveredCommentBox = {
    r,
    c,
    rc,
    left,
    top,
    width,
    height,
    size,
    value,
    autoFocus: false,
  };
}

export function getCommentBoxPosition(commentId: string) {
  const box = document.getElementById(commentId);
  if (!box) return undefined;
  const { width, height } = box.getBoundingClientRect();
  const left = box.offsetLeft;
  const top = box.offsetTop;
  return { left, top, width, height };
}

/** Esc while a note box is moved or resized: it goes back (Excel). */
export function cancelCommentBoxDrag(globalCache: GlobalCache) {
  const commentBox = globalCache.commentBox;
  const id = commentBox?.movingId ?? commentBox?.resizingId;
  if (!commentBox || !id) return false;
  const box = document.getElementById(id);
  const start = commentBox.boxInitialPosition;
  if (box && start) {
    box.style.left = `${start.left}px`;
    box.style.top = `${start.top}px`;
    if (commentBox.resizingId) {
      box.style.width = `${start.width}px`;
      box.style.height = `${start.height}px`;
    }
  }
  commentBox.movingId = undefined;
  commentBox.resizingId = undefined;
  return true;
}

export function onCommentBoxResizeStart(
  ctx: Context,
  globalCache: GlobalCache,
  e: MouseEvent,
  { r, c, rc }: { r: number; c: number; rc: string },
  resizingId: string,
  resizingSide: string
) {
  const position = getCommentBoxPosition(resizingId);
  if (position) {
    _.set(globalCache, "commentBox", {
      cursorMoveStartPosition: {
        x: e.pageX,
        y: e.pageY,
      },
      resizingId,
      resizingSide,
      commentRC: { r, c, rc },
      boxInitialPosition: position,
    });
  }
}

export function onCommentBoxResize(
  ctx: Context,
  globalCache: GlobalCache,
  e: MouseEvent
) {
  if (ctx.allowEdit === false) return false;
  const commentBox = globalCache?.commentBox;
  if (commentBox?.resizingId && commentBox.resizingSide) {
    const box = document.getElementById(commentBox.resizingId);
    const { x: startX, y: startY } = commentBox.cursorMoveStartPosition!;
    let { top, left, width, height } = commentBox.boxInitialPosition!;
    const dx = e.pageX - startX;
    const dy = e.pageY - startY;
    const minHeight = 60 * ctx.zoomRatio;
    const minWidth = 1.5 * 60 * ctx.zoomRatio;
    if (["lm", "lt", "lb"].includes(commentBox.resizingSide)) {
      if (width - dx < minWidth) {
        left += width - minWidth;
        width = minWidth;
      } else {
        left += dx;
        width -= dx;
      }
      if (left < 0) left = 0;
      (box as HTMLDivElement).style.left = `${left}px`;
    }
    if (["rm", "rt", "rb"].includes(commentBox.resizingSide)) {
      width = width + dx < minWidth ? minWidth : width + dx;
    }
    if (["mt", "lt", "rt"].includes(commentBox.resizingSide)) {
      if (height - dy < minHeight) {
        top += height - minHeight;
        height = minHeight;
      } else {
        top += dy;
        height -= dy;
      }
      if (top < 0) top = 0;
      (box as HTMLDivElement).style.top = `${top}px`;
    }
    if (["mb", "lb", "rb"].includes(commentBox.resizingSide)) {
      height = height + dy < minHeight ? minHeight : height + dy;
    }
    (box as HTMLDivElement).style.width = `${width}px`;
    (box as HTMLDivElement).style.height = `${height}px`;
    return true;
  }
  return false;
}

export function onCommentBoxResizeEnd(ctx: Context, globalCache: GlobalCache) {
  if (globalCache.commentBox?.resizingId) {
    const {
      resizingId,
      commentRC: { r, c },
    } = globalCache.commentBox;
    globalCache.commentBox.resizingId = undefined;
    const position = getCommentBoxPosition(resizingId);
    if (position) {
      const { top, left, width, height } = position;
      const flowdata = getFlowdata(ctx);
      const cell = flowdata?.[r][c];
      if (!flowdata || !cell?.ps) return;
      cell.ps.left = left / ctx.zoomRatio;
      cell.ps.top = top / ctx.zoomRatio;
      cell.ps.width = width / ctx.zoomRatio;
      cell.ps.height = height / ctx.zoomRatio;
      setEditingComment(ctx, flowdata, r, c);
    }
  }
}

export function onCommentBoxMoveStart(
  ctx: Context,
  globalCache: GlobalCache,
  e: MouseEvent,
  { r, c, rc }: { r: number; c: number; rc: string },
  movingId: string
) {
  const position = getCommentBoxPosition(movingId);
  if (position) {
    const { top, left } = position;
    _.set(globalCache, "commentBox", {
      cursorMoveStartPosition: {
        x: e.pageX,
        y: e.pageY,
      },
      movingId,
      commentRC: { r, c, rc },
      boxInitialPosition: { left, top },
    });
  }
}

export function onCommentBoxMove(
  ctx: Context,
  globalCache: GlobalCache,
  e: MouseEvent
) {
  const allowEdit = isAllowEdit(ctx);
  if (!allowEdit) return false;
  const commentBox = globalCache?.commentBox;
  if (commentBox?.movingId) {
    const box = document.getElementById(commentBox.movingId);
    const { x: startX, y: startY } = commentBox.cursorMoveStartPosition!;
    let { top, left } = commentBox.boxInitialPosition!;
    left += e.pageX - startX;
    top += e.pageY - startY;
    if (top < 0) top = 0;
    (box as HTMLDivElement).style.left = `${left}px`;
    (box as HTMLDivElement).style.top = `${top}px`;
    return true;
  }
  return false;
}

export function onCommentBoxMoveEnd(ctx: Context, globalCache: GlobalCache) {
  if (globalCache.commentBox?.movingId) {
    const {
      movingId,
      commentRC: { r, c },
    } = globalCache.commentBox;
    globalCache.commentBox.movingId = undefined;
    const position = getCommentBoxPosition(movingId);
    if (position) {
      const { top, left } = position;
      const flowdata = getFlowdata(ctx);
      const cell = flowdata?.[r][c];
      if (!flowdata || !cell?.ps) return;
      cell.ps.left = left / ctx.zoomRatio;
      cell.ps.top = top / ctx.zoomRatio;
      setEditingComment(ctx, flowdata, r, c);
    }
  }
}
