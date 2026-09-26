import _ from "lodash";
import { defaultContext, getFlowdata } from "./context";
import { getRealCellValue, normalizedAttr } from "./modules/cell";
import {
  defaultFont,
  getCellTextInfo,
  getFontSet,
  getMeasureText,
} from "./modules/text";
import { isInlineStringCell } from "./modules/inline-string";
import {
  defaultFontFamily,
  HEADER_FONT_FAMILY,
  HEADER_FONT_SIZE,
} from "./modules/fonts";
import { getSheetIndex, indexToColumnChar } from "./utils";
import { getBorderInfoComputeRange } from "./modules/border";
import {
  checkCF,
  drawCellPlaceholder,
  drawDataVerificationMarks,
  getComputeMap,
} from "./modules";
import { cfTextCell, drawCFDecorations } from "./modules/cfDraw";
import { drawCornerMark } from "./modules/cellMarks";
import {
  CellDecoratorArgs,
  drawCellBackgroundDecorators,
  drawCellContentDecorators,
  drawCellForegroundDecorators,
  hasCellDecorators,
} from "./modules/extensions";
import {
  getCanvasTheme,
  resolveBorderColor,
  resolveCellFill,
  resolveCellTextColor,
} from "./theme";
import {
  fitCellToWidth,
  getCellFormatColor,
  shrinkCellToWidth,
} from "./modules/format";

export const defaultStyle = {
  fillStyle: "#000000",
  textBaseline: "middle",
  strokeStyle: "#dfdfdf",
  rowFillStyle: "#5e5e5e",
  textAlign: "center",
};

// 是否是纯数字
function isRealNum(val: any) {
  return !Number.isNaN(Number(val));
}

function getBorderFix() {
  return [-1, 0, 0, -1];
}

/**
 * Whether a single-line, unrotated text layout lies inside its cell's clip
 * rectangle (with a pixel of slack for glyph bearings), so drawing it without
 * clipping gives the same pixels.
 */
function textFitsCell(
  textInfo: any,
  cell: any,
  cellWidth: number,
  cellHeight: number
) {
  if (!textInfo || textInfo.type !== "plain" || textInfo.rotate) return false;
  // italic glyphs overhang their advance width
  if (cell?.it && cell.it !== "0") return false;
  const { values } = textInfo;
  if (!values || values.length !== 1) return false;
  const word = values[0];
  if (word.cancelLine || word.underLine || typeof word.content !== "string") {
    return false;
  }
  const asc = textInfo.asc ?? 0;
  const desc = textInfo.desc ?? 0;
  return (
    word.left >= 1 &&
    word.left + word.width <= cellWidth - 1 &&
    word.top - asc >= 0 &&
    word.top + desc <= cellHeight
  );
}

/** Left/right indent (Format Cells > Alignment > Indent) in px. */
function cellIndent(cell: any, zoomRatio: number) {
  const ind = cell?.ind;
  if (!ind || cell.ht == null || `${cell.ht}` === "0") return 0;
  return ind * 9 * zoomRatio;
}

/**
 * The cell as it is laid out in a column `width` px wide: shrink-to-fit
 * text gets a smaller font, and numbers and dates that don't fit show fewer
 * decimals (General) or `####` (see fitCellToWidth). Everything else is
 * returned as is.
 */
function fitNumberCell(
  cell: any,
  width: number,
  renderCtx: CanvasRenderingContext2D,
  sheetCtx: any
) {
  if (!cell || (typeof cell.v !== "number" && !cell.sk)) return cell;
  const font = getFontSet(cell, sheetCtx.defaultFontSize, sheetCtx);
  const measure = (s: string) =>
    getMeasureText(s, renderCtx, sheetCtx, font).width;
  const avail = width - cellIndent(cell, sheetCtx.zoomRatio);
  const shrunk = shrinkCellToWidth(
    cell,
    avail,
    measure,
    sheetCtx.defaultFontSize
  );
  if (shrunk !== cell) return shrunk;
  return fitCellToWidth(cell, avail, measure);
}

function setLineDash(
  canvasborder: CanvasRenderingContext2D,
  type: any,
  hv: string,
  moveX: number,
  moveY: number,
  toX: number,
  toY: number
) {
  const borderType: any = {
    "0": "none",
    "1": "Thin",
    "2": "Hair",
    "3": "Dotted",
    "4": "Dashed",
    "5": "DashDot",
    "6": "DashDotDot",
    "7": "Double",
    "8": "Medium",
    "9": "MediumDashed",
    "10": "MediumDashDot",
    "11": "MediumDashDotDot",
    "12": "SlantedDashDot",
    "13": "Thick",
  };

  type = borderType[type.toString()];

  try {
    if (type === "Hair") {
      canvasborder.setLineDash([1, 2]);
    } else if (type.indexOf("DashDotDot") > -1) {
      canvasborder.setLineDash([2, 2, 5, 2, 2]);
    } else if (type.indexOf("DashDot") > -1) {
      canvasborder.setLineDash([2, 5, 2]);
    } else if (type.indexOf("Dotted") > -1) {
      canvasborder.setLineDash([2]);
    } else if (type.indexOf("Dashed") > -1) {
      canvasborder.setLineDash([3]);
    } else {
      canvasborder.setLineDash([0]);
    }
  } catch (e) {
    console.error(e);
  }

  canvasborder.beginPath();

  if (type.indexOf("Medium") > -1) {
    if (hv === "h") {
      canvasborder.moveTo(moveX, moveY - 0.5);
      canvasborder.lineTo(toX, toY - 0.5);
    } else {
      canvasborder.moveTo(moveX - 0.5, moveY);
      canvasborder.lineTo(toX - 0.5, toY);
    }

    canvasborder.lineWidth = 2;
  } else if (type === "Thick") {
    canvasborder.moveTo(moveX, moveY);
    canvasborder.lineTo(toX, toY);
    canvasborder.lineWidth = 3;
  } else {
    canvasborder.moveTo(moveX, moveY);
    canvasborder.lineTo(toX, toY);
    canvasborder.lineWidth = 1;
  }
}

/**
 * Whether a floating object (chart, shape, picture, slicer) is selected:
 * the cell selection is not shown then.
 */
export function objectSelected(ctx: {
  activeChart?: string;
  selectedCharts?: string[];
  activeShapes?: string[];
  activeImg?: string;
  activeSlicer?: unknown;
}) {
  return !!(
    ctx.activeChart ||
    ctx.selectedCharts?.length ||
    ctx.activeShapes?.length ||
    ctx.activeImg ||
    ctx.activeSlicer
  );
}

export class Canvas {
  canvasElement: HTMLCanvasElement;

  sheetCtx: ReturnType<typeof defaultContext>;

  cellOverflowMapCache: any;

  /**
   * While drawMain runs without per-cell render hooks, default grid lines are
   * collected here (x1, y1, x2, y2 per segment) and stroked as one path after
   * all cells are filled, instead of one stroke() per cell edge.
   */
  gridLineBatch: number[] | null = null;

  /** Bottom (endY) of the last row drawn by the running drawMain. */
  gridLineBottomY = 0;

  /** Transform in effect for cell drawing (devicePixelRatio scale). */
  baseTransform: DOMMatrix | null = null;

  constructor(
    canvasElement: HTMLCanvasElement,
    ctx: ReturnType<typeof defaultContext>
  ) {
    this.canvasElement = canvasElement;
    this.sheetCtx = ctx;
    this.cellOverflowMapCache = {};
  }

  /**
   * Selection state of each row (`axis` "row") or column header: 0 none,
   * 1 part of the selection (Excel: tinted header, accent edge), 2 whole
   * row / column selected (stronger tint).
   */
  headerSelection(axis: "row" | "column"): (index: number) => 0 | 1 | 2 {
    const ranges = this.sheetCtx.luckysheet_select_save;
    if (!ranges || ranges.length === 0) return () => 0;
    // a selected chart / shape / picture: no cell selection shows (Excel)
    if (objectSelected(this.sheetCtx)) return () => 0;
    const acrossCount =
      axis === "row"
        ? this.sheetCtx.visibledatacolumn.length
        : this.sheetCtx.visibledatarow.length;
    const spans: [number, number, boolean][] = [];
    ranges.forEach((range) => {
      const along = axis === "row" ? range.row : range.column;
      const across = axis === "row" ? range.column : range.row;
      if (!along || !across || along[0] == null) return;
      const full =
        acrossCount > 0 &&
        Math.min(across[0], across[1] ?? across[0]) <= 0 &&
        Math.max(across[0], across[1] ?? across[0]) >= acrossCount - 1;
      const a = Math.min(along[0], along[1] ?? along[0]);
      const b = Math.max(along[0], along[1] ?? along[0]);
      spans.push([a, b, full]);
    });
    return (index: number) => {
      let state: 0 | 1 | 2 = 0;
      for (let i = 0; i < spans.length; i += 1) {
        const [a, b, full] = spans[i];
        if (index >= a && index <= b) {
          if (full) return 2;
          state = 1;
        }
      }
      return state;
    };
  }

  /** Header label font at the current zoom (drawn in a zoom-scaled space). */
  headerFont() {
    return `normal normal normal ${HEADER_FONT_SIZE}px ${HEADER_FONT_FAMILY}`;
  }

  drawRowHeader(scrollHeight: number, drawHeight?: number, offsetTop?: number) {
    if (_.isNil(drawHeight)) {
      [, drawHeight] = this.sheetCtx.luckysheetTableContentHW;
    }

    if (_.isNil(offsetTop)) {
      offsetTop = this.sheetCtx.columnHeaderHeight;
    }

    const renderCtx = this.canvasElement.getContext("2d");
    if (!renderCtx) return;

    const theme = getCanvasTheme(this.sheetCtx);
    const selected = this.headerSelection("row");
    const { rowHeaderWidth, zoomRatio } = this.sheetCtx;
    const rowhidden = this.sheetCtx.config?.rowhidden;

    renderCtx.save();
    renderCtx.scale(
      this.sheetCtx.devicePixelRatio,
      this.sheetCtx.devicePixelRatio
    );

    renderCtx.clearRect(0, offsetTop, rowHeaderWidth - 1, drawHeight);

    const headerFont = this.headerFont();
    renderCtx.font = headerFont;
    // @ts-ignore
    renderCtx.textBaseline = defaultStyle.textBaseline; // 基准线 垂直居中
    renderCtx.fillStyle = defaultStyle.fillStyle;

    let dataset_row_st;
    let dataset_row_ed;
    dataset_row_st = _.sortedIndex(this.sheetCtx.visibledatarow, scrollHeight);
    dataset_row_ed = _.sortedIndex(
      this.sheetCtx.visibledatarow,
      scrollHeight + drawHeight
    );

    if (dataset_row_st === -1) {
      dataset_row_st = 0;
    }
    if (dataset_row_ed === -1) {
      dataset_row_ed = this.sheetCtx.visibledatarow.length - 1;
    }

    renderCtx.save();
    renderCtx.beginPath();
    // down to (not over) the frozen-pane line below a frozen part
    renderCtx.rect(0, offsetTop - 1, rowHeaderWidth - 1, drawHeight - 1);
    renderCtx.clip();

    let end_r;
    let start_r;
    const bodrder05 = 0.5; // Default 0.5
    let preEndR;
    // accent edges of selected rows, drawn over the separators
    const edges: [number, number][] = [];
    for (let r = dataset_row_st; r <= dataset_row_ed; r += 1) {
      if (r === 0) {
        start_r = -scrollHeight - 1;
      } else {
        start_r = this.sheetCtx.visibledatarow[r - 1] - scrollHeight - 1;
      }
      end_r = this.sheetCtx.visibledatarow[r] - scrollHeight;

      const firstOffset = dataset_row_st === r ? -2 : 0;
      const lastOffset = dataset_row_ed === r ? -2 : 0;
      // 行标题单元格渲染前触发，return false 则不渲染该单元格
      if (
        this.sheetCtx.hooks.beforeRenderRowHeaderCell?.(
          `${r + 1}`,
          r,
          start_r + offsetTop + firstOffset,
          rowHeaderWidth - 1,
          end_r - start_r + 1 + lastOffset - firstOffset,
          renderCtx
        ) === false
      ) {
        continue;
      }

      if (rowhidden?.[r] == null) {
        const state = selected(r);
        renderCtx.fillStyle =
          state === 2
            ? theme.headerFullBackground
            : state === 1
              ? theme.headerSelectedBackground
              : theme.headerBackground;
        renderCtx.fillRect(
          0,
          start_r + offsetTop + firstOffset,
          rowHeaderWidth - 1,
          end_r - start_r + 1 + lastOffset - firstOffset
        );
        if (state) edges.push([start_r + offsetTop - 1, end_r - start_r]);
        renderCtx.fillStyle =
          state === 2
            ? theme.headerFullText
            : state === 1
              ? theme.headerSelectedText
              : theme.headerText;

        // 行标题栏序列号 (the label, centred on whole device pixels)
        renderCtx.save(); // save scale before draw text
        renderCtx.scale(zoomRatio, zoomRatio);
        const textMetrics = getMeasureText(
          r + 1,
          renderCtx,
          this.sheetCtx,
          headerFont
        );
        const horizonAlignPos = Math.round(
          (rowHeaderWidth - 2 - textMetrics.width * zoomRatio) / 2
        );
        const verticalAlignPos = Math.round(
          start_r + (end_r - start_r) / 2 + offsetTop
        );

        renderCtx.fillText(
          `${r + 1}`,
          horizonAlignPos / zoomRatio,
          verticalAlignPos / zoomRatio
        );
        renderCtx.restore(); // restore scale after draw text
      }

      renderCtx.lineWidth = 1;
      renderCtx.strokeStyle = theme.headerLine;

      // vertical: the header's edge towards the cells
      renderCtx.beginPath();
      renderCtx.moveTo(rowHeaderWidth - 2 + bodrder05, start_r + offsetTop - 2);
      renderCtx.lineTo(rowHeaderWidth - 2 + bodrder05, end_r + offsetTop - 2);
      renderCtx.stroke();

      // 行标题栏横线,horizen (a hidden row below shows as a double line)
      if (rowhidden && rowhidden[r] == null && rowhidden[r + 1] != null) {
        renderCtx.beginPath();
        renderCtx.moveTo(-1, end_r + offsetTop - 4 + bodrder05);
        renderCtx.lineTo(rowHeaderWidth - 1, end_r + offsetTop - 4 + bodrder05);
        renderCtx.stroke();
      } else if (rowhidden == null || rowhidden[r] == null) {
        renderCtx.beginPath();
        renderCtx.moveTo(-1, end_r + offsetTop - 2 + bodrder05);
        renderCtx.lineTo(rowHeaderWidth - 1, end_r + offsetTop - 2 + bodrder05);
        renderCtx.stroke();
      }

      if (rowhidden?.[r - 1] != null && preEndR !== undefined) {
        renderCtx.beginPath();
        renderCtx.moveTo(-1, preEndR + offsetTop + bodrder05);
        renderCtx.lineTo(rowHeaderWidth - 1, preEndR + offsetTop + bodrder05);
        renderCtx.stroke();
      }

      preEndR = end_r;

      this.sheetCtx.hooks.afterRenderRowHeaderCell?.(
        `${r + 1}`,
        r,
        start_r + offsetTop + firstOffset,
        rowHeaderWidth - 1,
        end_r - start_r + 1 + lastOffset - firstOffset,
        renderCtx
      );
    }

    // 2px accent edge on the side facing the cells, over the separators
    if (edges.length > 0) {
      renderCtx.fillStyle = theme.accent;
      edges.forEach(([y, h]) => {
        renderCtx.fillRect(rowHeaderWidth - 3, y, 2, h);
      });
    }

    // Must be restored twice, otherwise it will be enlarged under window.devicePixelRatio = 1.5
    renderCtx.restore();
    renderCtx.restore();
  }

  drawColumnHeader(
    scrollWidth: number,
    drawWidth?: number,
    offsetLeft?: number
  ) {
    if (drawWidth === undefined) {
      [drawWidth] = this.sheetCtx.luckysheetTableContentHW;
    }

    if (offsetLeft === undefined) {
      offsetLeft = this.sheetCtx.rowHeaderWidth;
    }

    const renderCtx = this.canvasElement.getContext("2d");
    if (!renderCtx) return;

    const theme = getCanvasTheme(this.sheetCtx);
    const selected = this.headerSelection("column");
    const { columnHeaderHeight, zoomRatio } = this.sheetCtx;
    const colhidden = this.sheetCtx.config?.colhidden;

    renderCtx.save();
    renderCtx.scale(
      this.sheetCtx.devicePixelRatio,
      this.sheetCtx.devicePixelRatio
    );
    renderCtx.clearRect(offsetLeft, 0, drawWidth, columnHeaderHeight - 1);

    const headerFont = this.headerFont();
    renderCtx.font = headerFont;
    // @ts-ignore
    renderCtx.textBaseline = defaultStyle.textBaseline; // 基准线 垂直居中
    renderCtx.fillStyle = defaultStyle.fillStyle;

    let dataset_col_st;
    let dataset_col_ed;
    dataset_col_st = _.sortedIndex(
      this.sheetCtx.visibledatacolumn,
      scrollWidth
    );
    dataset_col_ed = _.sortedIndex(
      this.sheetCtx.visibledatacolumn,
      scrollWidth + drawWidth
    );

    if (dataset_col_st === -1) {
      dataset_col_st = 0;
    }
    if (dataset_col_ed === -1) {
      dataset_col_ed = this.sheetCtx.visibledatacolumn.length - 1;
    }

    renderCtx.save();
    renderCtx.beginPath();
    renderCtx.rect(offsetLeft - 1, 0, drawWidth, columnHeaderHeight - 1);
    renderCtx.clip();

    let end_c;
    let start_c;
    const bodrder05 = 0.5; // Default 0.5
    let preEndC;
    // accent edges of selected columns, drawn over the separators
    const edges: [number, number][] = [];
    for (let c = dataset_col_st; c <= dataset_col_ed; c += 1) {
      if (c === 0) {
        start_c = -scrollWidth;
      } else {
        start_c = this.sheetCtx.visibledatacolumn[c - 1] - scrollWidth;
      }
      end_c = this.sheetCtx.visibledatacolumn[c] - scrollWidth;

      const abc = indexToColumnChar(c);
      // 列标题单元格渲染前触发，return false 则不渲染该单元格
      if (
        this.sheetCtx.hooks.beforeRenderColumnHeaderCell?.(
          abc,
          c,
          start_c + offsetLeft - 1,
          end_c - start_c,
          columnHeaderHeight - 1,
          renderCtx
        ) === false
      ) {
        continue;
      }

      if (colhidden?.[c] == null) {
        const state = selected(c);
        renderCtx.fillStyle =
          state === 2
            ? theme.headerFullBackground
            : state === 1
              ? theme.headerSelectedBackground
              : theme.headerBackground;
        renderCtx.fillRect(
          start_c + offsetLeft - 1,
          0,
          end_c - start_c,
          columnHeaderHeight - 1
        );
        if (state) edges.push([start_c + offsetLeft - 2, end_c - start_c + 1]);
        renderCtx.fillStyle =
          state === 2
            ? theme.headerFullText
            : state === 1
              ? theme.headerSelectedText
              : theme.headerText;

        // 列标题栏序列号 (the label, centred on whole device pixels)
        renderCtx.save(); // save scale before draw text
        renderCtx.scale(zoomRatio, zoomRatio);

        const textMetrics = getMeasureText(
          abc,
          renderCtx,
          this.sheetCtx,
          headerFont
        );

        const horizonAlignPos = Math.round(
          start_c +
            (end_c - start_c) / 2 +
            offsetLeft -
            1 -
            (textMetrics.width * zoomRatio) / 2
        );
        const verticalAlignPos = Math.round((columnHeaderHeight - 1) / 2);

        renderCtx.fillText(
          abc,
          horizonAlignPos / zoomRatio,
          verticalAlignPos / zoomRatio
        );
        renderCtx.restore(); // restore scale after draw text
      }

      renderCtx.lineWidth = 1;
      renderCtx.strokeStyle = theme.headerLine;

      // 列标题栏竖线 vertical (a hidden column shows as a double line)
      if (colhidden && colhidden[c] != null && colhidden[c + 1] != null) {
        renderCtx.beginPath();
        renderCtx.moveTo(end_c + offsetLeft - 4 + bodrder05, 0);
        renderCtx.lineTo(
          end_c + offsetLeft - 4 + bodrder05,
          columnHeaderHeight - 2
        );
        renderCtx.stroke();
      } else if (colhidden == null || colhidden[c] == null) {
        renderCtx.beginPath();
        renderCtx.moveTo(end_c + offsetLeft - 2 + bodrder05, 0);
        renderCtx.lineTo(
          end_c + offsetLeft - 2 + bodrder05,
          columnHeaderHeight - 2
        );
        renderCtx.stroke();
      }

      if (colhidden?.[c - 1] != null && preEndC !== undefined) {
        renderCtx.beginPath();
        renderCtx.moveTo(preEndC + offsetLeft + bodrder05, 0);
        renderCtx.lineTo(
          preEndC + offsetLeft + bodrder05,
          columnHeaderHeight - 2
        );
        renderCtx.stroke();
      }

      // horizen: the header's edge towards the cells
      renderCtx.beginPath();
      renderCtx.moveTo(
        start_c + offsetLeft - 1,
        columnHeaderHeight - 2 + bodrder05
      );
      renderCtx.lineTo(
        end_c + offsetLeft - 1,
        columnHeaderHeight - 2 + bodrder05
      );
      renderCtx.stroke();

      preEndC = end_c;

      this.sheetCtx.hooks.afterRenderColumnHeaderCell?.(
        abc,
        c,
        start_c + offsetLeft - 1,
        end_c - start_c,
        columnHeaderHeight - 1,
        renderCtx
      );
    }

    // 2px accent edge on the side facing the cells, over the separators
    if (edges.length > 0) {
      renderCtx.fillStyle = theme.accent;
      edges.forEach(([x, w]) => {
        renderCtx.fillRect(x, columnHeaderHeight - 3, w, 2);
      });
    }

    // Must be restored twice, otherwise it will be enlarged under window.devicePixelRatio = 1.5
    renderCtx.restore();
    renderCtx.restore();
  }

  drawMain({
    scrollWidth,
    scrollHeight,
    drawWidth,
    drawHeight,
    offsetLeft,
    offsetTop,
    columnOffsetCell,
    rowOffsetCell,
    clear,
  }: {
    scrollWidth: number;
    scrollHeight: number;
    drawWidth?: number;
    drawHeight?: number;
    offsetLeft?: number;
    offsetTop?: number;
    columnOffsetCell?: number;
    rowOffsetCell?: number;
    clear?: boolean;
  }) {
    const flowdata = getFlowdata(this.sheetCtx);
    if (_.isNil(flowdata)) {
      return;
    }

    // 参数未定义处理
    if (drawWidth === undefined) {
      [drawWidth] = this.sheetCtx.luckysheetTableContentHW;
    }
    if (drawHeight === undefined) {
      [, drawHeight] = this.sheetCtx.luckysheetTableContentHW;
    }

    if (offsetLeft === undefined) {
      offsetLeft = this.sheetCtx.rowHeaderWidth;
    }
    if (offsetTop === undefined) {
      offsetTop = this.sheetCtx.columnHeaderHeight;
    }

    if (columnOffsetCell === undefined) {
      columnOffsetCell = 0;
    }
    if (rowOffsetCell === undefined) {
      rowOffsetCell = 0;
    }

    // //表格canvas
    // let renderCtx = null;
    // if (_.isNil(mycanvas)) {
    //   renderCtx = $("#renderCtx")
    //     .get(0)
    //     .getContext("2d");
    // } else {
    //   if (getObjType(mycanvas) === "object") {
    //     try {
    //       renderCtx = mycanvas.get(0).getContext("2d");
    //     } catch (err) {
    //       renderCtx = mycanvas;
    //     }
    //   } else {
    //     renderCtx = $("#" + mycanvas)
    //       .get(0)
    //       .getContext("2d");
    //   }
    // }
    const renderCtx = this.canvasElement.getContext("2d");
    if (!renderCtx) return;

    renderCtx.save();
    renderCtx.scale(
      this.sheetCtx.devicePixelRatio,
      this.sheetCtx.devicePixelRatio
    );
    if (clear) {
      renderCtx.clearRect(
        0,
        0,
        this.sheetCtx.luckysheetTableContentHW[0],
        this.sheetCtx.luckysheetTableContentHW[1]
      );
    }

    // 表格渲染区域, 起止行列index
    let rowStart: number;
    let rowEnd: number;
    let colStart: number;
    let colEnd: number;

    rowStart = _.sortedIndex(this.sheetCtx.visibledatarow, scrollHeight);
    rowEnd = _.sortedIndex(
      this.sheetCtx.visibledatarow,
      scrollHeight + drawHeight
    );

    if (rowStart === -1) {
      rowStart = 0;
    }

    rowStart += rowOffsetCell;

    if (rowEnd === -1) {
      rowEnd = this.sheetCtx.visibledatarow.length - 1;
    }

    rowEnd += rowOffsetCell;

    if (rowEnd >= this.sheetCtx.visibledatarow.length) {
      rowEnd = this.sheetCtx.visibledatarow.length - 1;
    }

    colStart = _.sortedIndex(this.sheetCtx.visibledatacolumn, scrollWidth);
    colEnd = _.sortedIndex(
      this.sheetCtx.visibledatacolumn,
      scrollWidth + drawWidth
    );

    if (colStart === -1) {
      colStart = 0;
    }

    colStart += columnOffsetCell;

    if (colEnd === -1) {
      colEnd = this.sheetCtx.visibledatacolumn.length - 1;
    }

    colEnd += columnOffsetCell;

    if (colEnd >= this.sheetCtx.visibledatacolumn.length) {
      colEnd = this.sheetCtx.visibledatacolumn.length - 1;
    }

    // 表格渲染区域 起止行列坐标
    const rowEndY = this.sheetCtx.visibledatarow[rowEnd];
    const colEndX = this.sheetCtx.visibledatacolumn[colEnd];

    // 表格canvas 初始化处理
    renderCtx.fillStyle = getCanvasTheme(this.sheetCtx).cellBackground;
    renderCtx.fillRect(
      offsetLeft - 1,
      offsetTop - 1,
      colEndX - scrollWidth,
      rowEndY - scrollHeight
    );
    renderCtx.font = defaultFont(
      this.sheetCtx.defaultFontSize,
      defaultFontFamily(this.sheetCtx)
    );
    renderCtx.fillStyle = defaultStyle.fillStyle;

    // 表格渲染区域 非空单元格行列 起止坐标
    const cellupdate: {
      r: number;
      c: number;
      startX: number;
      startY: number;
      endY: number;
      endX: number;
      firstcolumnlen: number;
    }[] = [];
    const mergeCache: any = {};
    const borderOffset: any = {};

    const bodrder05 = 0.5; // Default 0.5

    this.sheetCtx.hooks.beforeRenderCellArea?.(flowdata, renderCtx);

    // Batching reorders grid lines after cell fills. That is pixel-identical
    // only when lines are pixel-aligned (anti-aliased edges at fractional
    // zoom / devicePixelRatio blend differently), and per-cell hooks may draw
    // over cell edges, so keep the interleaved order otherwise.
    this.gridLineBatch =
      this.sheetCtx.zoomRatio === 1 &&
      Number.isInteger(this.sheetCtx.devicePixelRatio) &&
      !this.sheetCtx.hooks.beforeRenderCell &&
      !this.sheetCtx.hooks.afterRenderCell
        ? []
        : null;
    this.gridLineBottomY = rowEndY - scrollHeight;
    this.baseTransform =
      typeof renderCtx.getTransform === "function"
        ? renderCtx.getTransform()
        : null;
    const needBorderOffset =
      (this.sheetCtx.config?.borderInfo?.length ?? 0) > 0;

    for (let r = rowStart; r <= rowEnd; r += 1) {
      let startY;
      if (r === 0) {
        startY = -scrollHeight - 1;
      } else {
        startY = this.sheetCtx.visibledatarow[r - 1] - scrollHeight - 1;
      }

      const endY = this.sheetCtx.visibledatarow[r] - scrollHeight;

      if (this.sheetCtx.config?.rowhidden?.[r] != null) {
        continue;
      }

      for (let c = colStart; c <= colEnd; c += 1) {
        let startX;
        if (c === 0) {
          startX = -scrollWidth;
        } else {
          startX = this.sheetCtx.visibledatacolumn[c - 1] - scrollWidth;
        }

        const endX = this.sheetCtx.visibledatacolumn[c] - scrollWidth;

        if (this.sheetCtx.config?.colhidden?.[c] != null) {
          continue;
        }

        let firstcolumnlen = this.sheetCtx.defaultcollen;
        if (this.sheetCtx.config?.columnlen?.[c]) {
          firstcolumnlen = this.sheetCtx.config.columnlen[c];
        }

        if (flowdata?.[r]?.[c]) {
          const value = flowdata[r][c];

          if (value?.mc) {
            if (needBorderOffset) {
              borderOffset[`${r}_${c}`] = {
                startY,
                startX,
                endY,
                endX,
              };
            }

            if ("rs" in value.mc) {
              const key = `r${r}c${c}`;
              mergeCache[key] = cellupdate.length;
            } else {
              const key = `r${value.mc.r}c${value.mc.c}`;
              const margeMain = cellupdate[mergeCache[key]];

              if (_.isNil(margeMain)) {
                mergeCache[key] = cellupdate.length;
                cellupdate.push({
                  r,
                  c,
                  startX,
                  startY,
                  endY,
                  endX,
                  firstcolumnlen,
                });
              } else {
                if (margeMain.c === c) {
                  margeMain.endY += endY - startY - 1;
                }

                if (margeMain.r === r) {
                  margeMain.endX += endX - startX;
                  margeMain.firstcolumnlen += firstcolumnlen;
                }
              }

              continue;
            }
          }
        }

        cellupdate.push({
          r,
          c,
          startY,
          startX,
          endY,
          endX,
          firstcolumnlen,
        });
        if (needBorderOffset) {
          borderOffset[`${r}_${c}`] = {
            startY,
            startX,
            endY,
            endX,
          };
        }
      }
    }

    // 动态数组公式计算
    // const dynamicArrayCompute = dynamicArrayCompute(
    //   this.sheetCtx.luckysheetfile[
    //     getSheetIndex(this.sheetCtx.currentSheetId)
    //   ].dynamicArray
    // );
    const dynamicArrayCompute: any = {};

    // 交替颜色计算
    // const afCompute = alternateformat.getComputeMap();
    const afCompute: any = {};

    // 条件格式计算
    // const cfCompute = conditionformat.getComputeMap();
    const cfCompute: any = getComputeMap(this.sheetCtx);

    // 表格渲染区域 溢出单元格配置保存
    const cellOverflowMap = this.getCellOverflowMap(
      renderCtx,
      colStart,
      colEnd,
      rowStart,
      rowEnd
    );

    const mcArr: typeof cellupdate = [];

    for (let cud = 0; cud < cellupdate.length; cud += 1) {
      const item = cellupdate[cud];
      const { r } = item;
      const { c } = item;
      const { startY } = item;
      const { startX } = item;
      const { endY } = item;
      const { endX } = item;

      if (_.isNil(flowdata[r])) {
        continue;
      }

      if (_.isNil(flowdata[r][c])) {
        // 空单元格
        this.nullCellRender(
          r,
          c,
          startY,
          startX,
          endY,
          endX,
          renderCtx,
          afCompute,
          cfCompute,
          offsetLeft,
          offsetTop,
          dynamicArrayCompute,
          cellOverflowMap,
          colStart,
          colEnd,
          scrollHeight,
          scrollWidth,
          bodrder05
        );
      } else {
        const cell = flowdata[r][c];
        let value = null;

        if (cell?.mc) {
          mcArr.push(cellupdate[cud]);
          // continue;
        } else {
          value = getRealCellValue(r, c, flowdata);
        }

        if (_.isNil(value) || value.toString().length === 0) {
          this.nullCellRender(
            r,
            c,
            startY,
            startX,
            endY,
            endX,
            renderCtx,
            afCompute,
            cfCompute,
            offsetLeft,
            offsetTop,
            dynamicArrayCompute,
            cellOverflowMap,
            colStart,
            colEnd,
            scrollHeight,
            scrollWidth,
            bodrder05
          );

          // sparklines渲染
          // const borderfix = getBorderFix(flowdata, r, c);
          // const cellsize = [
          //   startX + offsetLeft + borderfix[0],
          //   startY + offsetTop + borderfix[1],
          //   endX - startX - 3 + borderfix[2],
          //   endY - startY - 3 - 1 + borderfix[3],
          // ];
          // this.sparklinesRender(
          //   r,
          //   c,
          //   cellsize[0],
          //   cellsize[1],
          //   "renderCtx",
          //   renderCtx
          // );
        } else {
          if (`${r}_${c}` in dynamicArrayCompute) {
            // 动态数组公式
            value = dynamicArrayCompute[`${r}_${c}`].v;
          }

          this.cellRender(
            r,
            c,
            startY,
            startX,
            endY,
            endX,
            value,
            renderCtx,
            afCompute,
            cfCompute,
            offsetLeft,
            offsetTop,
            dynamicArrayCompute,
            cellOverflowMap,
            colStart,
            colEnd,
            scrollHeight,
            scrollWidth,
            bodrder05
          );
        }
      }
    }

    // 合并单元格再处理
    for (let m = 0; m < mcArr.length; m += 1) {
      const item = mcArr[m];
      let { r } = item;
      let { c } = item;
      let { startY } = item;
      let { startX } = item;
      let endY = item.endY - 1;
      let endX = item.endX - 1;

      const cell = flowdata[r][c];
      if (!cell) continue;

      let value = null;

      const mergeMaindata = cell.mc;
      if (!mergeMaindata) continue;

      value = getRealCellValue(mergeMaindata.r, mergeMaindata.c, flowdata);

      r = mergeMaindata.r;
      c = mergeMaindata.c;

      const mainCell = flowdata[r][c];

      if (!mainCell?.mc?.rs || !mainCell.mc?.cs) {
        continue;
      }

      if (c === 0) {
        startX = -scrollWidth;
      } else {
        startX = this.sheetCtx.visibledatacolumn[c - 1] - scrollWidth;
      }

      if (r === 0) {
        startY = -scrollHeight - 1;
      } else {
        startY = this.sheetCtx.visibledatarow[r - 1] - scrollHeight - 1;
      }

      endY =
        this.sheetCtx.visibledatarow[r + mainCell.mc.rs - 1] - scrollHeight;
      endX =
        this.sheetCtx.visibledatacolumn[c + mainCell.mc.cs - 1] - scrollWidth;

      if (_.isNil(value) || value.toString().length === 0) {
        this.nullCellRender(
          r,
          c,
          startY,
          startX,
          endY,
          endX,
          renderCtx,
          afCompute,
          cfCompute,
          offsetLeft,
          offsetTop,
          dynamicArrayCompute,
          cellOverflowMap,
          colStart,
          colEnd,
          scrollHeight,
          scrollWidth,
          bodrder05,
          true
        );

        // sparklines渲染
        // const borderfix = getBorderFix(flowdata, r, c);
        // const cellsize = [
        //   startX + offsetLeft + borderfix[0],
        //   startY + offsetTop + borderfix[1],
        //   endX - startX - 3 + borderfix[2],
        //   endY - startY - 3 - 1 + borderfix[3],
        // ];
        // this.sparklinesRender(
        //   r,
        //   c,
        //   cellsize[0],
        //   cellsize[1],
        //   "renderCtx",
        //   renderCtx
        // );
      } else {
        if (`${r}_${c}` in dynamicArrayCompute) {
          // 动态数组公式
          value = dynamicArrayCompute[`${r}_${c}`].v;
        }
        this.cellRender(
          r,
          c,
          startY,
          startX,
          endY,
          endX,
          value,
          renderCtx,
          afCompute,
          cfCompute,
          offsetLeft,
          offsetTop,
          dynamicArrayCompute,
          cellOverflowMap,
          colStart,
          colEnd,
          scrollHeight,
          scrollWidth,
          bodrder05,
          true
        );
      }
    }

    // 数据透视表边框渲染
    /*
    for (let r = rowStart; r <= rowEnd; r += 1) {
      let startY;
      if (r === 0) {
        startY = -scrollHeight - 1;
      } else {
        startY = this.sheetCtx.visibledatarow[r - 1] - scrollHeight - 1;
      }

      const endY = this.sheetCtx.visibledatarow[r] - scrollHeight;

      for (let c = colStart; c <= colEnd; c += 1) {
        let startX;
        if (c === 0) {
          startX = -scrollWidth;
        } else {
          startX = this.sheetCtx.visibledatacolumn[c - 1] - scrollWidth;
        }

        const endX = this.sheetCtx.visibledatacolumn[c] - scrollWidth;

        // 数据透视表
        if (
          !!this.sheetCtx.luckysheetcurrentisPivotTable &&
          pivotTable.drawPivotTable
        ) {
          if ((c === 0 || c === 5) && r <= 11) {
            renderCtx.beginPath();
            renderCtx.moveTo(
              endX - 2 + bodrder05 + offsetLeft,
              startY + offsetTop
            );
            renderCtx.lineTo(
              endX - 2 + bodrder05 + offsetLeft,
              endY - 2 + bodrder05 + offsetTop
            );
            renderCtx.lineWidth = 1;
            renderCtx.strokeStyle = "#000000";
            renderCtx.closePath();
            renderCtx.stroke();
          }

          if ((r === 2 || r === 11) && c <= 5) {
            renderCtx.beginPath();
            renderCtx.moveTo(
              startX - 1 + offsetLeft,
              endY - 2 + bodrder05 + offsetTop
            );
            renderCtx.lineTo(
              endX - 2 + bodrder05 + offsetLeft,
              endY - 2 + bodrder05 + offsetTop
            );
            renderCtx.lineWidth = 1;
            renderCtx.strokeStyle = "#000000";
            renderCtx.closePath();
            renderCtx.stroke();
          }

          if (r === 6 && c === 3) {
            renderCtx.save();
            renderCtx.font = "bold 30px Arial";
            renderCtx.fillStyle = "#626675";
            renderCtx.textAlign = "center";
            renderCtx.fillText(
              locale().pivotTable.title,
              startX + (endX - startX) / 2 + 4 + offsetLeft,
              startY + (endY - startY) / 2 - 1 + offsetTop
            );
            renderCtx.restore();
          }
        } else if (this.sheetCtx.luckysheetcurrentisPivotTable) {
          if (
            c < pivotTable.pivotTableBoundary[1] &&
            r < pivotTable.pivotTableBoundary[0]
          ) {
            renderCtx.beginPath();
            renderCtx.moveTo(
              endX - 2 + bodrder05 + offsetLeft,
              startY + offsetTop
            );
            renderCtx.lineTo(
              endX - 2 + bodrder05 + offsetLeft,
              endY - 2 + bodrder05 + offsetTop
            );
            renderCtx.lineWidth = 1;
            renderCtx.strokeStyle = "#000000";
            renderCtx.closePath();
            renderCtx.stroke();

            renderCtx.beginPath();
            renderCtx.moveTo(
              startX - 1 + offsetLeft,
              endY - 2 + bodrder05 + offsetTop
            );
            renderCtx.lineTo(
              endX - 2 + offsetLeft,
              endY - 2 + bodrder05 + offsetTop
            );
            renderCtx.lineWidth = 1;
            renderCtx.strokeStyle = "#000000";
            renderCtx.closePath();
            renderCtx.stroke();
          }
        }
      }
    }
    */

    // default grid lines go under explicit cell borders
    this.flushGridLines(renderCtx);

    // 边框单独渲染
    if ((this.sheetCtx.config?.borderInfo?.length ?? 0) > 0) {
      // 边框渲染
      type BorderRender = (
        style: any,
        color: string,
        startY: number,
        startX: number,
        endY: number,
        endX: number,
        _offsetLeft: number,
        _offsetTop: number,
        canvas: CanvasRenderingContext2D
      ) => void;

      const borderSlashRender: BorderRender = (
        style,
        color,
        startY,
        startX,
        endY,
        endX,
        _offsetLeft,
        _offsetTop,
        canvas
      ) => {
        const linetype = style;

        const moveX = startX - 2 + bodrder05 + _offsetLeft;
        const moveY = startY + _offsetTop;
        const toX = endX - 2 + bodrder05 + _offsetLeft;
        const toY = endY - 2 + bodrder05 + _offsetTop;
        canvas.save();
        setLineDash(canvas, linetype, "v", moveX, moveY, toX, toY);

        canvas.strokeStyle = resolveBorderColor(this.sheetCtx, color);

        canvas.stroke();
        canvas.closePath();
        canvas.restore();
      };

      const borderLeftRender: BorderRender = (
        style,
        color,
        startY,
        startX,
        endY,
        endX,
        _offsetLeft,
        _offsetTop,
        canvas
      ) => {
        const linetype = style;

        const moveX = startX - 2 + bodrder05 + _offsetLeft;
        const moveY = startY + _offsetTop - 1;
        const toX = startX - 2 + bodrder05 + _offsetLeft;
        const toY = endY - 2 + bodrder05 + _offsetTop;
        canvas.save();
        setLineDash(canvas, linetype, "v", moveX, moveY, toX, toY);

        canvas.strokeStyle = resolveBorderColor(this.sheetCtx, color);

        canvas.stroke();
        canvas.closePath();
        canvas.restore();
      };

      const borderRightRender: BorderRender = (
        style,
        color,
        startY,
        startX,
        endY,
        endX,
        _offsetLeft,
        _offsetTop,
        canvas
      ) => {
        const linetype = style;

        const moveX = endX - 2 + bodrder05 + _offsetLeft;
        const moveY = startY + _offsetTop - 1;
        const toX = endX - 2 + bodrder05 + _offsetLeft;
        const toY = endY - 2 + bodrder05 + _offsetTop;
        canvas.save();
        setLineDash(canvas, linetype, "v", moveX, moveY, toX, toY);

        canvas.strokeStyle = resolveBorderColor(this.sheetCtx, color);

        canvas.stroke();
        canvas.closePath();
        canvas.restore();
      };

      const borderBottomRender: BorderRender = (
        style,
        color,
        startY,
        startX,
        endY,
        endX,
        _offsetLeft,
        _offsetTop,
        canvas
      ) => {
        const linetype = style;

        const moveX = startX - 2 + bodrder05 + _offsetLeft;
        const moveY = endY - 2 + bodrder05 + _offsetTop;
        const toX = endX - 2 + bodrder05 + _offsetLeft;
        const toY = endY - 2 + bodrder05 + _offsetTop;
        canvas.save();
        setLineDash(canvas, linetype, "h", moveX, moveY, toX, toY);

        canvas.strokeStyle = resolveBorderColor(this.sheetCtx, color);

        canvas.stroke();
        canvas.closePath();
        canvas.restore();
      };

      const borderTopRender: BorderRender = (
        style,
        color,
        startY,
        startX,
        endY,
        endX,
        _offsetLeft,
        _offsetTop,
        canvas
      ) => {
        const linetype = style;

        const moveX = startX - 2 + bodrder05 + _offsetLeft;
        const moveY = startY - 1 + bodrder05 + _offsetTop;
        const toX = endX - 2 + bodrder05 + _offsetLeft;
        const toY = startY - 1 + bodrder05 + _offsetTop;
        canvas.save();
        setLineDash(canvas, linetype, "h", moveX, moveY, toX, toY);

        canvas.strokeStyle = resolveBorderColor(this.sheetCtx, color);

        canvas.stroke();
        canvas.closePath();
        canvas.restore();
      };

      const borderInfoCompute = getBorderInfoComputeRange(
        this.sheetCtx,
        rowStart,
        rowEnd,
        colStart,
        colEnd
      );

      Object.keys(borderInfoCompute).forEach((x) => {
        const bdRow = Number(x.substring(0, x.indexOf("_")));
        const bdCol = Number(x.substring(x.indexOf("_") + 1));

        if (borderOffset[`${bdRow}_${bdCol}`]) {
          const { startY } = borderOffset[`${bdRow}_${bdCol}`];
          const { startX } = borderOffset[`${bdRow}_${bdCol}`];
          const { endY } = borderOffset[`${bdRow}_${bdCol}`];
          const { endX } = borderOffset[`${bdRow}_${bdCol}`];

          const cellOverflow_colInObj = this.cellOverflow_colIn(
            cellOverflowMap,
            bdRow,
            bdCol,
            colStart,
            colEnd
          );

          const borderSlash = borderInfoCompute[x].s;
          if (
            borderSlash &&
            (!cellOverflow_colInObj.colIn ||
              cellOverflow_colInObj.stc === bdCol)
          ) {
            const mergeMap = this.sheetCtx.config.merge;
            const mergeCell = mergeMap?.[`${bdRow}_${bdCol}`];
            let mergeCellEndX;
            let mergeCellEndY;
            if (mergeCell) {
              const mergeCellOffset =
                borderOffset[
                  `${bdRow + mergeCell.rs - 1}_${bdCol + mergeCell.cs - 1}`
                ];
              mergeCellEndX = mergeCellOffset.endX;
              mergeCellEndY = mergeCellOffset.endY;
            }
            borderSlashRender(
              borderSlash.style,
              borderSlash.color,
              startY,
              startX,
              mergeCellEndY ?? endY,
              mergeCellEndX ?? endX,
              offsetLeft!,
              offsetTop!,
              renderCtx
            );
          }

          const borderLeft = borderInfoCompute[x].l;
          if (
            borderLeft &&
            (!cellOverflow_colInObj.colIn ||
              cellOverflow_colInObj.stc === bdCol)
          ) {
            borderLeftRender(
              borderLeft.style,
              borderLeft.color,
              startY,
              startX,
              endY,
              endX,
              offsetLeft!,
              offsetTop!,
              renderCtx
            );
          }

          const borderRight = borderInfoCompute[x].r;
          if (
            borderRight &&
            (!cellOverflow_colInObj.colIn || cellOverflow_colInObj.colLast)
          ) {
            borderRightRender(
              borderRight.style,
              borderRight.color,
              startY,
              startX,
              endY,
              endX,
              offsetLeft!,
              offsetTop!,
              renderCtx
            );
          }

          const borderTop = borderInfoCompute[x].t;
          if (borderTop) {
            borderTopRender(
              borderTop.style,
              borderTop.color,
              startY,
              startX,
              endY,
              endX,
              offsetLeft!,
              offsetTop!,
              renderCtx
            );
          }

          const borderBottom = borderInfoCompute[x].b;
          if (borderBottom) {
            borderBottomRender(
              borderBottom.style,
              borderBottom.color,
              startY,
              startX,
              endY,
              endX,
              offsetLeft!,
              offsetTop!,
              renderCtx
            );
          }
        }
      });
    }

    // 渲染表格时有尾列时，清除右边灰色区域，防止表格有值溢出
    if (colEnd === this.sheetCtx.visibledatacolumn.length - 1) {
      renderCtx.clearRect(
        colEndX - scrollWidth + offsetLeft - 1,
        offsetTop - 1,
        this.sheetCtx.ch_width - this.sheetCtx.visibledatacolumn[colEnd],
        rowEndY - scrollHeight
      );
    }

    renderCtx.restore();
    this.baseTransform = null;
  }

  /** Default grid line segment: batched during drawMain, else stroked now. */
  gridLine(
    renderCtx: CanvasRenderingContext2D,
    x1: number,
    y1: number,
    x2: number,
    y2: number
  ) {
    if (this.gridLineBatch) {
      this.gridLineBatch.push(x1, y1, x2, y2);
      return;
    }
    renderCtx.beginPath();
    renderCtx.moveTo(x1, y1);
    renderCtx.lineTo(x2, y2);
    renderCtx.lineWidth = 1;
    renderCtx.strokeStyle = getCanvasTheme(this.sheetCtx).gridLine;
    renderCtx.stroke();
    renderCtx.closePath();
  }

  /**
   * A cell's right grid line reaches 1px into the row below, where that
   * row's fill used to paint over it. Batched lines are stroked after all
   * fills, so they stop short instead, unless no row is drawn below.
   */
  gridLineTrim(endY: number) {
    return this.gridLineBatch && endY < this.gridLineBottomY ? 1 : 0;
  }

  flushGridLines(renderCtx: CanvasRenderingContext2D) {
    const lines = this.gridLineBatch;
    this.gridLineBatch = null;
    if (!lines || lines.length === 0) return;
    renderCtx.beginPath();
    for (let i = 0; i < lines.length; i += 4) {
      renderCtx.moveTo(lines[i], lines[i + 1]);
      renderCtx.lineTo(lines[i + 2], lines[i + 3]);
    }
    renderCtx.lineWidth = 1;
    renderCtx.strokeStyle = getCanvasTheme(this.sheetCtx).gridLine;
    renderCtx.stroke();
  }

  // 获取表格渲染范围 溢出单元格
  getCellOverflowMap(
    canvas: CanvasRenderingContext2D,
    colStart: number,
    colEnd: number,
    rowStart: number,
    rowEnd: number
  ) {
    const flowdata = getFlowdata(this.sheetCtx);
    const map: any = {};
    const data = flowdata;
    if (!data) {
      return map;
    }

    for (let r = rowStart; r <= rowEnd; r += 1) {
      if (_.isNil(data[r])) {
        continue;
      }

      if (this.cellOverflowMapCache[r]) {
        map[r] = this.cellOverflowMapCache[r];
        continue;
      }

      let hasCellOver = false;

      for (let c = 0; c < data[r].length; c += 1) {
        const cell = data[r][c];

        // cheapest test first: only overflow-mode (tb "1") cells matter
        if (!cell || cell.tb !== "1") {
          continue;
        }

        if (this.sheetCtx.config?.colhidden?.[c] != null) {
          continue;
        }

        if (
          (!_.isEmpty(cell.v) || isInlineStringCell(cell)) &&
          _.isNil(cell.mc) &&
          cell.tb === "1"
        ) {
          // 水平对齐
          const horizonAlign = normalizedAttr(data, r, c, "ht");

          const textMetricsObj = getCellTextInfo(cell, canvas, this.sheetCtx, {
            r,
            c,
          });
          let textMetrics = 0;
          if (textMetricsObj) {
            textMetrics = textMetricsObj.textWidthAll;
          }

          // canvas.measureText(value).width;

          const startX = c - 1 < 0 ? 0 : this.sheetCtx.visibledatacolumn[c - 1];
          const endX = this.sheetCtx.visibledatacolumn[c];

          let stc;
          let edc;

          if (endX - startX < textMetrics) {
            if (horizonAlign === "0") {
              // 居中对齐
              const trace_forward = this.cellOverflow_trace(
                r,
                c,
                c - 1,
                "forward",
                horizonAlign,
                textMetrics
              );
              const trace_backward = this.cellOverflow_trace(
                r,
                c,
                c + 1,
                "backward",
                horizonAlign,
                textMetrics
              );

              if (trace_forward.success) {
                stc = trace_forward.c;
              } else {
                stc = trace_forward.c + 1;
              }

              if (trace_backward.success) {
                edc = trace_backward.c;
              } else {
                edc = trace_backward.c - 1;
              }
            } else if (horizonAlign === "1") {
              // 左对齐
              const trace = this.cellOverflow_trace(
                r,
                c,
                c + 1,
                "backward",
                horizonAlign,
                textMetrics
              );
              stc = c;

              if (trace.success) {
                edc = trace.c;
              } else {
                edc = trace.c - 1;
              }
            } else if (horizonAlign === "2") {
              // 右对齐
              const trace = this.cellOverflow_trace(
                r,
                c,
                c - 1,
                "forward",
                horizonAlign,
                textMetrics
              );
              edc = c;

              if (trace.success) {
                stc = trace.c;
              } else {
                stc = trace.c + 1;
              }
            }
          } else {
            stc = c;
            edc = c;
          }

          if ((stc <= colEnd || edc >= colStart) && stc < edc) {
            const item = {
              r,
              stc,
              edc,
            };

            if (_.isNil(map[r])) {
              map[r] = {};
            }

            map[r][c] = item;

            hasCellOver = true;
          }
        }
      }

      if (hasCellOver) {
        this.cellOverflowMapCache[r] = map[r];
      }
    }

    return map;
  }

  // 空白单元格渲染
  /** Arguments for registered cell decorators (modules/extensions.ts). */
  decoratorArgs(
    renderCtx: CanvasRenderingContext2D,
    r: number,
    c: number,
    cell: any,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    offsetLeft: number,
    offsetTop: number
  ): CellDecoratorArgs {
    return {
      ctx: this.sheetCtx,
      renderCtx,
      r,
      c,
      cell,
      x: startX + offsetLeft,
      y: startY + offsetTop,
      w: endX - startX,
      h: endY - startY,
      zoom: this.sheetCtx.zoomRatio,
    };
  }

  nullCellRender(
    r: number,
    c: number,
    startY: number,
    startX: number,
    endY: number,
    endX: number,
    renderCtx: CanvasRenderingContext2D,
    afCompute: any,
    cfCompute: any,
    offsetLeft: number,
    offsetTop: number,
    dynamicArrayCompute: any,
    cellOverflowMap: any,
    colStart: number,
    colEnd: number,
    scrollHeight: number,
    scrollWidth: number,
    bodrder05: any,
    isMerge = false
  ) {
    // const checksAF = alternateformat.checksAF(r, c, afCompute); // 交替颜色
    const checksCF = checkCF(r, c, cfCompute); // 条件格式
    const flowdata = getFlowdata(this.sheetCtx);
    if (!flowdata) return;

    const borderfix = getBorderFix();

    // // 背景色
    let fillStyle = normalizedAttr(flowdata, r, c, "bg");

    // if (checksAF?.[1] {
    //   // 交替颜色
    //   fillStyle = checksAF[1];
    // }

    if (!_.isNil(checksCF) && !_.isNil(checksCF.cellColor)) {
      // 条件格式
      fillStyle = checksCF.cellColor;
    }

    // if (flowdata?.[r]?.[c]?.tc) {
    //   // 标题色
    //   fillStyle = flowdata[r][c].tc;
    // }

    renderCtx.fillStyle =
      resolveCellFill(this.sheetCtx, fillStyle) ??
      getCanvasTheme(this.sheetCtx).cellBackground;

    const cellsize = [
      startX + offsetLeft + borderfix[0],
      startY + offsetTop + borderfix[1],
      endX - startX + borderfix[2] - (isMerge ? 1 : 0),
      endY - startY + borderfix[3],
    ];

    // 单元格渲染前，考虑到合并单元格会再次渲染一遍，统一放到这里
    if (
      this.sheetCtx.hooks.beforeRenderCell?.(
        flowdata[r][c],
        {
          row: r,
          column: c,
          startX: cellsize[0],
          startY: cellsize[1],
          endX: cellsize[2] + cellsize[0],
          endY: cellsize[3] + cellsize[1],
        },
        renderCtx
      ) === false
    ) {
      return;
    }

    renderCtx.fillRect(cellsize[0], cellsize[1], cellsize[2], cellsize[3]);
    drawCFDecorations(
      renderCtx,
      checksCF,
      startX + offsetLeft,
      startY + offsetTop,
      endX - startX,
      endY - startY,
      this.sheetCtx.zoomRatio
    );
    const decor = hasCellDecorators()
      ? this.decoratorArgs(
          renderCtx,
          r,
          c,
          flowdata[r]?.[c],
          startX,
          startY,
          endX,
          endY,
          offsetLeft,
          offsetTop
        )
      : null;
    if (decor) {
      drawCellBackgroundDecorators(decor);
      drawCellContentDecorators(decor);
    }

    if (`${r}_${c}` in dynamicArrayCompute) {
      const value = dynamicArrayCompute[`${r}_${c}`].v;

      renderCtx.fillStyle = getCanvasTheme(this.sheetCtx).cellText;
      // 文本宽度和高度
      const fontset = defaultFont(
        this.sheetCtx.defaultFontSize,
        defaultFontFamily(this.sheetCtx)
      );
      renderCtx.font = fontset;

      // 水平对齐 (默认为1，左对齐)
      const horizonAlignPos = startX + 4 + offsetLeft;

      // 垂直对齐 (默认为2，下对齐)
      const verticalAlignPos = endY + offsetTop - 2;
      renderCtx.textBaseline = "bottom";

      renderCtx.fillText(
        _.isNil(value) ? "" : value,
        horizonAlignPos,
        verticalAlignPos
      );
    }

    // data validation on an empty cell: placeholder text, blank markers
    const dvIndex = getSheetIndex(this.sheetCtx, this.sheetCtx.currentSheetId);
    if (
      dvIndex != null &&
      this.sheetCtx.luckysheetfile[dvIndex]?.dataVerification?.[`${r}_${c}`] &&
      !(`${r}_${c}` in dynamicArrayCompute)
    ) {
      const dvRect = {
        x: startX + offsetLeft,
        y: startY + offsetTop,
        w: endX - startX,
        h: endY - startY,
      };
      const theme = getCanvasTheme(this.sheetCtx);
      drawCellPlaceholder(
        this.sheetCtx,
        renderCtx,
        r,
        c,
        dvRect,
        theme.headerText
      );
      drawDataVerificationMarks(
        this.sheetCtx,
        renderCtx,
        r,
        c,
        null,
        dvRect,
        theme.commentMarker
      );
    }

    // 若单元格有批注
    if (flowdata?.[r]?.[c]?.ps) {
      drawCornerMark(
        renderCtx,
        "tr",
        startX + offsetLeft,
        startY + offsetTop,
        endX - startX,
        6 * this.sheetCtx.zoomRatio,
        getCanvasTheme(this.sheetCtx).commentMarker
      );
    }

    // 此单元格 与  溢出单元格关系
    const cellOverflow_colInObj = this.cellOverflow_colIn(
      cellOverflowMap,
      r,
      c,
      colStart,
      colEnd
    );

    // 此单元格 为 溢出单元格渲染范围最后一列，绘制溢出单元格内容
    if (
      cellOverflow_colInObj.colLast &&
      !_.isNil(cellOverflow_colInObj.rowIndex) &&
      !_.isNil(cellOverflow_colInObj.colIndex) &&
      !_.isNil(cellOverflow_colInObj.stc) &&
      !_.isNil(cellOverflow_colInObj.edc)
    ) {
      this.cellOverflowRender(
        cellOverflow_colInObj.rowIndex,
        cellOverflow_colInObj.colIndex,
        cellOverflow_colInObj.stc,
        cellOverflow_colInObj.edc,
        renderCtx,
        scrollHeight,
        scrollWidth,
        offsetLeft,
        offsetTop,
        afCompute,
        cfCompute
      );
    }

    // 即溢出单元格跨此单元格，此单元格不绘制右边框
    if (!cellOverflow_colInObj.colIn || cellOverflow_colInObj.colLast) {
      // 右边框
      // 无论是否有背景色，都默认绘制右边框
      if (
        !this.sheetCtx.luckysheetcurrentisPivotTable &&
        this.sheetCtx.showGridLines
      ) {
        this.gridLine(
          renderCtx,
          endX + offsetLeft - 2 + bodrder05,
          startY + offsetTop,
          endX + offsetLeft - 2 + bodrder05,
          endY + offsetTop - this.gridLineTrim(endY)
        );
      }
    }

    // 下边框
    // 无论是否有背景色，都默认绘制下边框
    if (
      !this.sheetCtx.luckysheetcurrentisPivotTable &&
      this.sheetCtx.showGridLines
    ) {
      this.gridLine(
        renderCtx,
        startX + offsetLeft - 1,
        endY + offsetTop - 2 + bodrder05,
        endX + offsetLeft - 1,
        endY + offsetTop - 2 + bodrder05
      );
    }

    if (decor) drawCellForegroundDecorators(decor);

    // 单元格渲染后
    this.sheetCtx.hooks.afterRenderCell?.(
      flowdata[r][c],
      {
        row: r,
        column: c,
        startY: cellsize[1],
        startX: cellsize[0],
        endY: cellsize[3] + cellsize[1],
        endX: cellsize[2] + cellsize[0],
      },
      renderCtx
    );
  }

  cellRender(
    r: number,
    c: number,
    startY: number,
    startX: number,
    endY: number,
    endX: number,
    value: any,
    renderCtx: CanvasRenderingContext2D,
    afCompute: any,
    cfCompute: any,
    offsetLeft: number,
    offsetTop: number,
    dynamicArrayCompute: any,
    cellOverflowMap: any,
    colStart: number,
    colEnd: number,
    scrollHeight: number,
    scrollWidth: number,
    bodrder05: number,
    isMerge = false
  ) {
    const flowdata = getFlowdata(this.sheetCtx);
    if (!flowdata) {
      return;
    }
    const cell = flowdata[r][c];
    const cellWidth = endX - startX - 2;
    const cellHeight = endY - startY - 2;
    const space_width = 2;
    const space_height = 2; // 宽高方向 间隙

    // 水平对齐
    const horizonAlign = Number(normalizedAttr(flowdata, r, c, "ht"));
    // 垂直对齐
    const verticalAlign = Number(normalizedAttr(flowdata, r, c, "vt"));

    // 交替颜色
    // const checksAF = alternateformat.checksAF(r, c, afCompute);
    const checksAF: any = {};
    // 条件格式
    const checksCF = checkCF(r, c, cfCompute);

    // 单元格 背景颜色
    let fillStyle = normalizedAttr(flowdata, r, c, "bg");
    // if (checksAF?.[1]) {
    //   // 若单元格有交替颜色 背景颜色
    //   fillStyle = checksAF[1];
    // }
    if (!_.isNil(checksCF) && !_.isNil(checksCF.cellColor)) {
      // 若单元格有条件格式 背景颜色
      fillStyle = checksCF.cellColor;
    }
    renderCtx.fillStyle =
      resolveCellFill(this.sheetCtx, fillStyle) ??
      getCanvasTheme(this.sheetCtx).cellBackground;

    const borderfix = getBorderFix();

    const cellsize = [
      startX + offsetLeft + borderfix[0],
      startY + offsetTop + borderfix[1],
      endX - startX + borderfix[2] - (isMerge ? 1 : 0),
      endY - startY + borderfix[3],
    ];

    // 单元格渲染前，考虑到合并单元格会再次渲染一遍，统一放到这里
    if (
      this.sheetCtx.hooks.beforeRenderCell?.(
        flowdata[r][c],
        {
          row: r,
          column: c,
          startY: cellsize[1],
          startX: cellsize[0],
          endY: cellsize[3] + cellsize[1],
          endX: cellsize[2] + cellsize[0],
        },
        renderCtx
      ) === false
    ) {
      return;
    }

    renderCtx.fillRect(cellsize[0], cellsize[1], cellsize[2], cellsize[3]);

    const index = getSheetIndex(
      this.sheetCtx,
      this.sheetCtx.currentSheetId
    ) as number;

    const { dataVerification } = this.sheetCtx.luckysheetfile[index];

    // data validation: invalid marker and Circle Invalid Data
    if (dataVerification?.[`${r}_${c}`]) {
      drawDataVerificationMarks(
        this.sheetCtx,
        renderCtx,
        r,
        c,
        value,
        {
          x: startX + offsetLeft,
          y: startY + offsetTop,
          w: endX - startX,
          h: endY - startY,
        },
        getCanvasTheme(this.sheetCtx).commentMarker
      );
    }

    // 若单元格有批注（单元格右上角红色小三角标示）
    if (cell?.ps) {
      drawCornerMark(
        renderCtx,
        "tr",
        startX + offsetLeft,
        startY + offsetTop,
        endX - startX,
        6 * this.sheetCtx.zoomRatio,
        getCanvasTheme(this.sheetCtx).commentMarker
      );
    }

    // 若单元格强制为字符串，则显示绿色小三角
    if (cell?.qp === 1 && isRealNum(cell?.v)) {
      drawCornerMark(
        renderCtx,
        "tl",
        startX + offsetLeft,
        startY + offsetTop,
        endX - startX,
        6 * this.sheetCtx.zoomRatio,
        getCanvasTheme(this.sheetCtx).numberAsTextMarker
      );
    }

    // 溢出单元格
    let cellOverflow_bd_r_render = true; // 溢出单元格右边框是否需要绘制
    const cellOverflow_colInObj = this.cellOverflow_colIn(
      cellOverflowMap,
      r,
      c,
      colStart,
      colEnd
    );

    // set in the plain-text branch below: registered decorators and the
    // cell's text are drawn only there
    let cellDecor: CellDecoratorArgs | null = null;
    let textPending = false;
    if (cell?.tb === "1" && cellOverflow_colInObj.colIn) {
      // 此单元格 为 溢出单元格渲染范围最后一列，绘制溢出单元格内容
      if (
        cellOverflow_colInObj.colLast &&
        !_.isNil(cellOverflow_colInObj.rowIndex) &&
        !_.isNil(cellOverflow_colInObj.colIndex) &&
        !_.isNil(cellOverflow_colInObj.stc) &&
        !_.isNil(cellOverflow_colInObj.edc)
      ) {
        this.cellOverflowRender(
          cellOverflow_colInObj.rowIndex,
          cellOverflow_colInObj.colIndex,
          cellOverflow_colInObj.stc,
          cellOverflow_colInObj.edc,
          renderCtx,
          scrollHeight,
          scrollWidth,
          offsetLeft,
          offsetTop,
          afCompute,
          cfCompute
        );
      } else {
        cellOverflow_bd_r_render = false;
      }
    }
    // 数据验证 复选框
    else if (dataVerification?.[`${r}_${c}`]?.type === "checkbox") {
      const pos_x = startX + offsetLeft;
      const pos_y = startY + offsetTop + 1;

      renderCtx.save();
      renderCtx.beginPath();
      renderCtx.rect(pos_x, pos_y, cellWidth, cellHeight);
      renderCtx.clip();
      renderCtx.scale(this.sheetCtx.zoomRatio, this.sheetCtx.zoomRatio);
      // the label uses the default font (cells drawn before may leave theirs)
      renderCtx.font = defaultFont(
        this.sheetCtx.defaultFontSize,
        defaultFontFamily(this.sheetCtx)
      );
      renderCtx.textAlign = "start";

      const measureText = getMeasureText(value, renderCtx, this.sheetCtx);
      const textMetrics = measureText.width + 14;
      const oneLineTextHeight =
        measureText.actualBoundingBoxDescent +
        measureText.actualBoundingBoxAscent;

      let horizonAlignPos = pos_x + space_width; // 默认为1，左对齐
      if (horizonAlign === 0) {
        // 居中对齐
        horizonAlignPos = pos_x + cellWidth / 2 - textMetrics / 2;
      } else if (horizonAlign === 2) {
        // 右对齐
        horizonAlignPos = pos_x + cellWidth - space_width - textMetrics;
      }

      const verticalCellHeight =
        cellHeight > oneLineTextHeight ? cellHeight : oneLineTextHeight;

      let verticalAlignPos_text = pos_y + verticalCellHeight - space_height; // 文本垂直方向基准线
      renderCtx.textBaseline = "bottom";
      let verticalAlignPos_checkbox =
        verticalAlignPos_text - 13 * this.sheetCtx.zoomRatio;

      if (verticalAlign === 0) {
        // 居中对齐
        verticalAlignPos_text = pos_y + verticalCellHeight / 2;
        renderCtx.textBaseline = "middle";
        verticalAlignPos_checkbox =
          verticalAlignPos_text - 6 * this.sheetCtx.zoomRatio;
      } else if (verticalAlign === 1) {
        // 上对齐
        verticalAlignPos_text = pos_y + space_height;
        renderCtx.textBaseline = "top";
        verticalAlignPos_checkbox =
          verticalAlignPos_text + 1 * this.sheetCtx.zoomRatio;
      }

      horizonAlignPos /= this.sheetCtx.zoomRatio;
      verticalAlignPos_text /= this.sheetCtx.zoomRatio;
      verticalAlignPos_checkbox /= this.sheetCtx.zoomRatio;

      // 复选框
      renderCtx.lineWidth = 1;
      renderCtx.strokeStyle = getCanvasTheme(this.sheetCtx).checkboxStroke;
      renderCtx.strokeRect(horizonAlignPos, verticalAlignPos_checkbox, 10, 10);

      if (dataVerification[`${r}_${c}`].checked) {
        renderCtx.beginPath();
        renderCtx.lineTo(horizonAlignPos + 1, verticalAlignPos_checkbox + 6);
        renderCtx.lineTo(horizonAlignPos + 4, verticalAlignPos_checkbox + 9);
        renderCtx.lineTo(horizonAlignPos + 9, verticalAlignPos_checkbox + 2);
        renderCtx.stroke();
        renderCtx.closePath();
      }

      // 文本
      renderCtx.fillStyle = resolveCellTextColor(
        this.sheetCtx,
        normalizedAttr(flowdata, r, c, "fc"),
        fillStyle
      );
      renderCtx.fillText(
        _.isNil(value) ? "" : value,
        horizonAlignPos + 14,
        verticalAlignPos_text
      );

      renderCtx.restore();
    } else {
      // conditional formatting: data bar, icon and border
      drawCFDecorations(
        renderCtx,
        checksCF,
        startX + offsetLeft,
        startY + offsetTop,
        endX - startX,
        endY - startY,
        this.sheetCtx.zoomRatio
      );
      cellDecor = hasCellDecorators()
        ? this.decoratorArgs(
            renderCtx,
            r,
            c,
            cell,
            startX,
            startY,
            endX,
            endY,
            offsetLeft,
            offsetTop
          )
        : null;
      if (cellDecor) drawCellBackgroundDecorators(cellDecor);
      textPending = true;
    }
    // a registered decorator (image in cell, checkbox, sparkline, ...) may
    // draw the content instead of the text
    if (cellDecor && drawCellContentDecorators(cellDecor)) {
      // content drawn by the decorator
    } else if (textPending) {
      const pos_x = startX + offsetLeft;
      const pos_y = startY + offsetTop + 1;

      const textInfo = cell
        ? getCellTextInfo(
            fitNumberCell(
              cfTextCell(cell, checksCF),
              cellWidth - 2 * space_width,
              renderCtx,
              this.sheetCtx
            ),
            renderCtx,
            this.sheetCtx,
            {
              cellWidth,
              cellHeight,
              space_width:
                space_width + cellIndent(cell, this.sheetCtx.zoomRatio),
              space_height,
              r,
              c,
            },
            this.sheetCtx
          )
        : undefined;

      // Text that provably stays inside the cell needs no clip region, which
      // saves a save()/clip()/restore() round trip for most cells.
      const { zoomRatio } = this.sheetCtx;
      const noClip =
        (zoomRatio === 1 || this.baseTransform != null) &&
        textFitsCell(textInfo, cell, cellWidth, cellHeight);
      if (noClip) {
        if (zoomRatio !== 1) renderCtx.scale(zoomRatio, zoomRatio);
      } else {
        renderCtx.save();
        renderCtx.beginPath();
        renderCtx.rect(pos_x, pos_y, cellWidth, cellHeight);
        renderCtx.clip();
        renderCtx.scale(zoomRatio, zoomRatio);
      }

      // 单元格 文本颜色
      renderCtx.fillStyle = resolveCellTextColor(
        this.sheetCtx,
        normalizedAttr(flowdata, r, c, "fc"),
        fillStyle
      );

      // 若单元格有交替颜色 文本颜色
      if (checksAF?.[0]) {
        [renderCtx.fillStyle] = checksAF;
      }
      // 若单元格有条件格式 文本颜色
      if (checksCF?.textColor) {
        renderCtx.fillStyle = resolveCellTextColor(
          this.sheetCtx,
          checksCF.textColor,
          fillStyle
        );
      }

      // Number-format colour ([Red], [Color10], conditional sections)
      const fc = getCellFormatColor(cell);
      if (fc)
        renderCtx.fillStyle = resolveCellTextColor(
          this.sheetCtx,
          fc,
          fillStyle
        );

      this.cellTextRender(textInfo, renderCtx, {
        pos_x,
        pos_y,
        bg: fillStyle,
      });

      if (!noClip) {
        renderCtx.restore();
      } else if (zoomRatio !== 1) {
        renderCtx.setTransform(this.baseTransform!);
      }
    }

    if (cellOverflow_bd_r_render) {
      // 右边框
      if (
        !this.sheetCtx.luckysheetcurrentisPivotTable &&
        this.sheetCtx.showGridLines
      ) {
        this.gridLine(
          renderCtx,
          endX + offsetLeft - 2 + bodrder05,
          startY + offsetTop,
          endX + offsetLeft - 2 + bodrder05,
          endY + offsetTop - this.gridLineTrim(endY)
        );
      }
    }

    // 下边框
    if (
      !this.sheetCtx.luckysheetcurrentisPivotTable &&
      this.sheetCtx.showGridLines
    ) {
      this.gridLine(
        renderCtx,
        startX + offsetLeft - 1,
        endY + offsetTop - 2 + bodrder05,
        endX + offsetLeft - 1,
        endY + offsetTop - 2 + bodrder05
      );
    }

    if (cellDecor) drawCellForegroundDecorators(cellDecor);

    // 单元格渲染后
    this.sheetCtx.hooks.afterRenderCell?.(
      flowdata[r]?.[c],
      {
        row: r,
        column: c,
        startX: cellsize[0],
        startY: cellsize[1],
        endX: cellsize[2] + cellsize[0],
        endY: cellsize[3] + cellsize[1],
      },
      renderCtx
    );
  }

  // 溢出单元格渲染
  cellOverflowRender(
    r: number,
    c: number,
    stc: number,
    edc: number,
    renderCtx: CanvasRenderingContext2D,
    scrollHeight: number,
    scrollWidth: number,
    offsetLeft: number,
    offsetTop: number,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    afCompute: any,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    cfCompute: any
  ) {
    // 溢出单元格 起止行列坐标
    let startY;
    if (r === 0) {
      startY = -scrollHeight - 1;
    } else {
      startY = this.sheetCtx.visibledatarow[r - 1] - scrollHeight - 1;
    }

    const endY = this.sheetCtx.visibledatarow[r] - scrollHeight;

    let startX;
    if (stc === 0) {
      startX = -scrollWidth;
    } else {
      startX = this.sheetCtx.visibledatacolumn[stc - 1] - scrollWidth;
    }

    const endX = this.sheetCtx.visibledatacolumn[edc] - scrollWidth;

    //
    const flowdata = getFlowdata(this.sheetCtx);
    if (!flowdata) {
      return;
    }
    const cell = flowdata[r][c];
    const cellWidth = endX - startX - 2;
    const cellHeight = endY - startY - 2;
    const space_width = 2;
    const space_height = 2; // 宽高方向 间隙

    const pos_x = startX + offsetLeft;
    const pos_y = startY + offsetTop + 1;

    const fontset = getFontSet(
      cell,
      this.sheetCtx.defaultFontSize,
      this.sheetCtx
    );
    renderCtx.font = fontset;

    renderCtx.save();
    renderCtx.beginPath();
    renderCtx.rect(pos_x, pos_y, cellWidth, cellHeight);
    renderCtx.clip();
    renderCtx.scale(this.sheetCtx.zoomRatio, this.sheetCtx.zoomRatio);

    const textInfo = cell
      ? getCellTextInfo(
          cell,
          renderCtx,
          this.sheetCtx,
          {
            cellWidth,
            cellHeight,
            space_width,
            space_height,
            r,
            c,
          },
          this.sheetCtx
        )
      : undefined;

    // 交替颜色
    // const checksAF = alternateformat.checksAF(r, c, afCompute);
    const checksAF: any = {};
    // 条件格式
    // const checksCF = conditionformat.checksCF(r, c, cfCompute);
    const checksCF: any = checkCF(r, c, cfCompute);

    // 单元格 文本颜色
    renderCtx.fillStyle = resolveCellTextColor(
      this.sheetCtx,
      normalizedAttr(flowdata, r, c, "fc"),
      cell?.bg
    );

    // 若单元格有交替颜色 文本颜色
    if (checksAF?.[0]) {
      [renderCtx.fillStyle] = checksAF;
    }
    // 若单元格有条件格式 文本颜色
    if (checksCF?.textColor) {
      renderCtx.fillStyle = resolveCellTextColor(
        this.sheetCtx,
        checksCF.textColor,
        checksCF.cellColor ?? cell?.bg
      );
    }

    this.cellTextRender(textInfo, renderCtx, {
      pos_x,
      pos_y,
      bg: cell?.bg,
    });

    renderCtx.restore();
  }

  cellOverflow_trace(
    r: number,
    curC: number,
    traceC: number,
    traceDir: string,
    horizonAlign: string,
    textMetrics: number
  ): any {
    const flowdata = getFlowdata(this.sheetCtx);
    if (!flowdata) return {};
    const data = flowdata;

    // 追溯单元格列超出数组范围 则追溯终止
    if (traceDir === "forward" && traceC < 0) {
      return {
        success: false,
        r,
        c: traceC,
      };
    }

    if (traceDir === "backward" && traceC > data[r].length - 1) {
      return {
        success: false,
        r,
        c: traceC,
      };
    }

    // 追溯单元格是 非空单元格或合并单元格 则追溯终止
    const cell = data[r][traceC];
    if (cell && (!_.isEmpty(cell.v) || cell.mc)) {
      return {
        success: false,
        r,
        c: traceC,
      };
    }

    let start_curC =
      curC - 1 < 0 ? 0 : this.sheetCtx.visibledatacolumn[curC - 1];
    let end_curC = this.sheetCtx.visibledatacolumn[curC];

    const w = textMetrics - (end_curC - start_curC);

    if (horizonAlign === "0") {
      // 居中对齐
      start_curC -= w / 2;
      end_curC += w / 2;
    } else if (horizonAlign === "1") {
      // 左对齐
      end_curC += w;
    } else if (horizonAlign === "2") {
      // 右对齐
      start_curC -= w;
    }

    const start_traceC =
      traceC - 1 < 0 ? 0 : this.sheetCtx.visibledatacolumn[traceC - 1];
    const end_traceC = this.sheetCtx.visibledatacolumn[traceC];

    if (traceDir === "forward") {
      if (start_curC < start_traceC) {
        return this.cellOverflow_trace(
          r,
          curC,
          traceC - 1,
          traceDir,
          horizonAlign,
          textMetrics
        );
      }
      if (start_curC < end_traceC) {
        return {
          success: true,
          r,
          c: traceC,
        };
      }
      return {
        success: false,
        r,
        c: traceC,
      };
    }

    if (traceDir === "backward") {
      if (end_curC > end_traceC) {
        return this.cellOverflow_trace(
          r,
          curC,
          traceC + 1,
          traceDir,
          horizonAlign,
          textMetrics
        );
      }
      if (end_curC > start_traceC) {
        return {
          success: true,
          r,
          c: traceC,
        };
      }
      return {
        success: false,
        r,
        c: traceC,
      };
    }
    return null;
  }

  cellOverflow_colIn(
    map: any,
    r: number,
    c: number,
    col_st: number,
    col_ed: number
  ) {
    let colIn = false; // 此单元格 是否在 某个溢出单元格的渲染范围
    let colLast = false; // 此单元格 是否是 某个溢出单元格的渲染范围的最后一列
    let rowIndex: number | undefined; // 溢出单元格 行下标
    let colIndex: number | undefined; // 溢出单元格 列下标
    let stc: number | undefined;
    let edc: number | undefined;

    // Only overflow ranges of row r can contain (r, c).
    const row = map?.[r];
    if (row) {
      const ckeys = Object.keys(row);
      for (let i = 0; i < ckeys.length; i += 1) {
        const mapItem = row[ckeys[i]];
        if (c >= mapItem.stc && c <= mapItem.edc) {
          colIn = true;
          rowIndex = r;
          colIndex = Number(ckeys[i]);
          stc = mapItem.stc;
          edc = mapItem.edc;

          if (c === edc || c === col_ed) {
            colLast = true;
            break;
          }
        }
      }
    }

    return {
      colIn,
      colLast,
      rowIndex,
      colIndex,
      stc,
      edc,
    };
  }

  cellTextRender(textInfo: any, ctx: CanvasRenderingContext2D, option: any) {
    if (!textInfo) {
      return;
    }
    const { values } = textInfo;
    const { pos_x } = option;
    const { pos_y } = option;
    if (!values) {
      return;
    }
    // console.log(textInfo, pos_x, pos_y, values[0].width, values[0].left, ctx);

    // for(let i=0;i<values.length;i++){
    //     let word = values[i];
    //     ctx.font = word.style;
    //     ctx.fillText(word.content, (pos_x + word.left)/this.sheetCtx.zoomRatio, (pos_y+word.top)/this.sheetCtx.zoomRatio);
    // }

    // ctx.fillStyle = "rgba(255,255,0,0.2)";
    // ctx.fillRect((pos_x + values[0].left)/this.sheetCtx.zoomRatio, (pos_y+values[0].top-values[0].asc)/this.sheetCtx.zoomRatio, textInfo.textWidthAll, textInfo.textHeightAll)

    if (textInfo.rotate !== 0 && textInfo.type !== "verticalWrap") {
      ctx.save();
      ctx.translate(
        (pos_x + textInfo.textLeftAll) / this.sheetCtx.zoomRatio,
        (pos_y + textInfo.textTopAll) / this.sheetCtx.zoomRatio
      );
      ctx.rotate((-textInfo.rotate * Math.PI) / 180);
      ctx.translate(
        -(textInfo.textLeftAll + pos_x) / this.sheetCtx.zoomRatio,
        -(pos_y + textInfo.textTopAll) / this.sheetCtx.zoomRatio
      );
    }

    for (let i = 0; i < values.length; i += 1) {
      const word = values[i];
      if (word.inline === true && word.style) {
        ctx.font = word.style.fontset;
        ctx.fillStyle = resolveCellTextColor(
          this.sheetCtx,
          word.style.fc,
          option.bg
        );
      } else {
        ctx.font = word.style;
      }

      // 暂时未排查到word.content第一次会是object，先做下判断来渲染，后续找到问题再复原
      const txt = _.isPlainObject(word.content) ? word.content.m : word.content;
      ctx.fillText(
        txt,
        (pos_x + word.left) / this.sheetCtx.zoomRatio,
        (pos_y + word.top) / this.sheetCtx.zoomRatio
      );

      if (word.cancelLine) {
        const c = word.cancelLine;
        ctx.beginPath();
        ctx.moveTo(
          Math.floor((pos_x + c.startX) / this.sheetCtx.zoomRatio) + 0.5,
          Math.floor((pos_y + c.startY) / this.sheetCtx.zoomRatio) + 0.5
        );
        ctx.lineTo(
          Math.floor((pos_x + c.endX) / this.sheetCtx.zoomRatio) + 0.5,
          Math.floor((pos_y + c.endY) / this.sheetCtx.zoomRatio) + 0.5
        );
        ctx.lineWidth = Math.floor(c.fs / 9);
        ctx.strokeStyle = ctx.fillStyle;
        ctx.stroke();
        ctx.closePath();
      }

      if (word.underLine) {
        const underLines = word.underLine;
        for (let a = 0; a < underLines.length; a += 1) {
          const item = underLines[a];
          ctx.beginPath();
          ctx.moveTo(
            Math.floor((pos_x + item.startX) / this.sheetCtx.zoomRatio) + 0.5,
            Math.floor((pos_y + item.startY) / this.sheetCtx.zoomRatio)
          );
          ctx.lineTo(
            Math.floor((pos_x + item.endX) / this.sheetCtx.zoomRatio) + 0.5,
            Math.floor((pos_y + item.endY) / this.sheetCtx.zoomRatio) + 0.5
          );
          ctx.lineWidth = Math.floor(item.fs / 9);
          ctx.strokeStyle = ctx.fillStyle;
          ctx.stroke();
          ctx.closePath();
        }
      }
    }
    if (textInfo.rotate !== 0 && textInfo.type !== "verticalWrap") {
      ctx.restore();
    }
  }

  drawFreezeLine({
    horizontalTop,
    verticalLeft,
  }: {
    horizontalTop?: number;
    verticalLeft?: number;
  }) {
    const renderCtx = this.canvasElement.getContext("2d");
    if (!renderCtx) return;

    renderCtx.save();
    renderCtx.scale(
      this.sheetCtx.devicePixelRatio,
      this.sheetCtx.devicePixelRatio
    );
    // A 1px line in a darker grey on the frozen rows' (columns') last grid
    // line, like Excel; pixel-aligned so it stays sharp at any DPR.
    renderCtx.strokeStyle = getCanvasTheme(this.sheetCtx).freezeLine;
    renderCtx.lineWidth = 1;

    if (horizontalTop) {
      renderCtx.beginPath();
      renderCtx.moveTo(0, horizontalTop + 0.5);
      renderCtx.lineTo(this.canvasElement.width, horizontalTop + 0.5);
      renderCtx.stroke();
      renderCtx.closePath();
    }

    if (verticalLeft) {
      renderCtx.beginPath();
      renderCtx.moveTo(verticalLeft + 0.5, 0);
      renderCtx.lineTo(verticalLeft + 0.5, this.canvasElement.height);
      renderCtx.stroke();
      renderCtx.closePath();
    }

    renderCtx.restore();
  }
}
