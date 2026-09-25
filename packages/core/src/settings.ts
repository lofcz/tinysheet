import { v4 as uuidv4 } from "uuid";
import React from "react";
import { Sheet, Selection, CellMatrix, Cell } from "./types";
import type { ThemeSetting } from "./theme";

export type Hooks = {
  beforeUpdateCell?: (r: number, c: number, value: any) => boolean;
  afterUpdateCell?: (
    row: number,
    column: number,
    oldValue: any,
    newValue: any
  ) => void;
  afterSelectionChange?: (sheetId: string, selection: Selection) => void;
  beforeRenderRowHeaderCell?: (
    rowNumber: string,
    rowIndex: number,
    top: number,
    width: number,
    height: number,
    ctx: CanvasRenderingContext2D
  ) => boolean;
  afterRenderRowHeaderCell?: (
    rowNumber: string,
    rowIndex: number,
    top: number,
    width: number,
    height: number,
    ctx: CanvasRenderingContext2D
  ) => void;
  beforeRenderColumnHeaderCell?: (
    columnChar: string,
    columnIndex: number,
    left: number,
    width: number,
    height: number,
    ctx: CanvasRenderingContext2D
  ) => boolean;
  afterRenderColumnHeaderCell?: (
    columnChar: string,
    columnIndex: number,
    left: number,
    width: number,
    height: number,
    ctx: CanvasRenderingContext2D
  ) => void;
  beforeRenderCellArea?: (
    cells: CellMatrix,
    ctx: CanvasRenderingContext2D
  ) => boolean;
  beforeRenderCell?: (
    cell: Cell | null,
    cellInfo: {
      row: number;
      column: number;
      startX: number;
      startY: number;
      endX: number;
      endY: number;
    },
    ctx: CanvasRenderingContext2D
  ) => boolean;
  afterRenderCell?: (
    cell: Cell | null,
    cellInfo: {
      row: number;
      column: number;
      startX: number;
      startY: number;
      endX: number;
      endY: number;
    },
    ctx: CanvasRenderingContext2D
  ) => void;
  beforeCellMouseDown?: (
    cell: Cell | null,
    cellInfo: {
      row: number;
      column: number;
      startRow: number;
      startColumn: number;
      endRow: number;
      endColumn: number;
    }
  ) => boolean;
  afterCellMouseDown?: (
    cell: Cell | null,
    cellInfo: {
      row: number;
      column: number;
      startRow: number;
      startColumn: number;
      endRow: number;
      endColumn: number;
    }
  ) => void;
  beforePaste?: (
    selection: Selection[] | undefined,
    content: string
  ) => boolean;
  beforeUpdateComment?: (row: number, column: number, value: any) => boolean;
  afterUpdateComment?: (
    row: number,
    column: number,
    oldValue: any,
    value: any
  ) => void;
  beforeInsertComment?: (row: number, column: number) => boolean;
  afterInsertComment?: (row: number, column: number) => void;
  beforeDeleteComment?: (row: number, column: number) => boolean;
  afterDeleteComment?: (row: number, column: number) => void;
  beforeAddSheet?: (sheet: Sheet) => boolean;
  afterAddSheet?: (sheet: Sheet) => void;
  beforeActivateSheet?: (id: string) => boolean;
  afterActivateSheet?: (id: string) => void;
  beforeDeleteSheet?: (id: string) => boolean;
  afterDeleteSheet?: (id: string) => void;
  beforeUpdateSheetName?: (
    id: string,
    oldName: string,
    newName: string
  ) => boolean;
  afterUpdateSheetName?: (id: string, oldName: string, newName: string) => void;
};

export type Settings = {
  column?: number;
  row?: number;
  addRows?: number;
  allowEdit?: boolean;
  showToolbar?: boolean;
  showFormulaBar?: boolean;
  showSheetTabs?: boolean;
  /**
   * Bottom status bar with the selection aggregates (Average, Count, Sum…;
   * right-click it to choose). When false, nothing is computed on selection
   * changes — useful for read-only / embedded previews.
   * @default true
   */
  showStatsBar?: boolean;
  data: Sheet[];
  config?: any;
  devicePixelRatio?: number;
  lang?: string | null;
  forceCalculation?: boolean;
  rowHeaderWidth?: number;
  columnHeaderHeight?: number;
  defaultColWidth?: number;
  defaultRowHeight?: number;
  defaultFontSize?: number;
  toolbarItems?: string[];
  cellContextMenu?: string[];
  headerContextMenu?: string[];
  sheetTabContextMenu?: string[];
  filterContextMenu?: string[];
  generateSheetId?: () => string;
  hooks?: Hooks;
  customToolbarItems?: {
    key: string;
    tooltip?: string;
    children?: React.ReactNode;
    iconName?: string;
    icon?: React.ReactNode;
    onClick?: (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
  }[];
  currency?: string;
  /**
   * Colour theme of the workbook UI and canvas. `auto` follows the
   * `prefers-color-scheme` media query and updates live.
   * @default "light"
   */
  theme?: ThemeSetting;
};

export const defaultSettings: Required<Settings> = {
  column: 60, // 空表格默认的列数量
  row: 84, // 空表格默认的行数据量
  addRows: 50, // It will add the rows when we click on add row button
  showToolbar: true, // 是否显示工具栏
  showFormulaBar: true, // 是否显示公式栏
  showSheetTabs: true, // 是否显示底部表格名称区域
  showStatsBar: true, // 是否显示底部选区统计（关闭可显著降低拖拽选区时的开销）
  data: [], // 客户端sheet数据[sheet1, sheet2, sheet3]
  config: {}, // 表格行高、列宽、合并单元格、公式等设置
  devicePixelRatio: 0, // 设备比例，比例越大表格分标率越高，0表示自动
  allowEdit: true, // 是否允许前台编辑
  lang: null, // language
  forceCalculation: false, // 强制刷新公式，公式较多会有性能问题，慎用
  rowHeaderWidth: 46,
  columnHeaderHeight: 20,
  defaultColWidth: 73,
  defaultRowHeight: 19,
  defaultFontSize: 10,
  // Excel's Home tab order, grouped like its ribbon groups; items that do
  // not fit move to the "More" menu from the end.
  toolbarItems: [
    // Undo / Clipboard
    "undo",
    "redo",
    "format-painter",
    "|",
    // Font
    "font",
    "font-size",
    "|",
    "bold",
    "italic",
    "underline",
    "strike-through",
    "|",
    "border",
    "background",
    "font-color",
    "|",
    // Alignment
    "vertical-align",
    "horizontal-align",
    "text-wrap",
    "text-rotation",
    "merge-cell",
    "|",
    // Number
    "format",
    "currency-format",
    "percentage-format",
    "number-increase",
    "number-decrease",
    "|",
    // Styles
    "conditionFormat",
    "formatAsTable",
    "cell-styles",
    "|",
    // Editing
    "quick-formula",
    "clear-format",
    "filter",
    "search",
    "|",
    // View / Insert
    "freeze",
    "image",
    "chart",
    "pivotTable",
    "link",
    "comment",
    "|",
    // Formulas / Data
    "nameManager",
    "dataVerification",
    "splitColumn",
    "locationCondition",
    "screenshot",
  ], // 自定义工具栏
  // Excel's cell menu. Entries backed by other modules ("paste-special",
  // "cell-format", "define-name", "chart") appear once registered; see
  // react/src/components/ContextMenu/actions.ts. Also available:
  // "insert-row" / "insert-column" (insert n rows/columns with a count),
  // "delete-row" / "delete-column", "orderAZ", "orderZA", "sort", "filter".
  cellContextMenu: [
    "cut",
    "copy",
    "paste",
    "paste-special",
    "|",
    // PivotTable entries (shown inside a report, see react PivotTable)
    "pivot-refresh",
    "pivot-value-settings",
    "pivot-field-list",
    "|",
    "insert-cells", // Insert… (shift cells right / down, entire row / column)
    "delete-cells", // Delete… (shift cells left / up, entire row / column)
    "clear", // Clear Contents
    "|",
    "filter-menu",
    "sort-menu",
    "|",
    "comment", // insert / edit / delete / show notes
    "|",
    "cell-format", // Format Cells…
    "pick-list", // Pick From Drop-down List…
    "define-name",
    "link",
    "image",
    "data", // Data Validation…
    "chart",
  ], // 自定义单元格右键菜单
  // row / column header menu
  headerContextMenu: [
    "cut",
    "copy",
    "paste",
    "paste-special",
    "|",
    "insert-rowcol",
    "delete-rowcol",
    "clear",
    "|",
    "cell-format",
    "set-row-height", // Row Height…
    "set-column-width", // Column Width…
    "autofit",
    "hide-row", // Hide / Unhide
    "hide-column",
  ], // header菜单
  sheetTabContextMenu: [
    "delete",
    "copy",
    "rename",
    "color",
    "hide",
    "|",
    "move",
    // "focus",
  ], // 自定义底部sheet页右击菜单
  filterContextMenu: [
    "sort-by-asc",
    "sort-by-desc",
    "|",
    "clear-column-filter",
    "filter-by-color",
    "filter-by-condition",
    "|",
    "filter-by-value",
  ], // 筛选菜单
  generateSheetId: () => uuidv4(),
  hooks: {},
  customToolbarItems: [],
  currency: "¥",
  theme: "light", // "light" | "dark" | "auto"
};
