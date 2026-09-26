import { v4 as uuidv4 } from "uuid";
import React from "react";
import {
  Sheet,
  Selection,
  CellMatrix,
  Cell,
  CommentUser,
  ThreadedComment,
  ThreadedCommentPost,
  CalcSettings,
} from "./types";
import type { ErrorCheckingOptions } from "./modules/errorChecking";
import type { ThemeSetting } from "./theme";
import { DEFAULT_FONT_FAMILY, DEFAULT_FONT_SIZE } from "./modules/fonts";

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
  /**
   * A threaded comment was added, replied to, edited, deleted, resolved or
   * reopened from the UI (for back-end persistence / collaboration).
   */
  // eslint-disable-next-line no-use-before-define
  onCommentChange?: (change: ThreadedCommentChange) => void;
  /** A posted comment @mentions `users` (e.g. to notify them). */
  onMention?: (
    // eslint-disable-next-line no-use-before-define
    comment: ThreadedCommentEvent,
    users: CommentUser[]
  ) => void;
};

/** A post of a threaded comment together with where it lives. */
export type ThreadedCommentEvent = {
  sheetId: string;
  /** The thread after the change (null once deleted). */
  thread: ThreadedComment | null;
  threadId: string;
  /** The post concerned (the thread's first post for thread events). */
  post?: ThreadedCommentPost;
};

export type ThreadedCommentChange = ThreadedCommentEvent & {
  type:
    | "add"
    | "reply"
    | "edit"
    | "delete"
    | "deleteThread"
    | "resolve"
    | "reopen";
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
  /** Font size (pt) of cells without a size of their own. @default 11 */
  defaultFontSize?: number;
  /**
   * CSS font-family of cells without a font of their own (Excel's "Body"
   * font). A stored numeric `ff` keeps meaning an index into the locale's
   * font list; this only replaces what an unset font shows as.
   * @default 'Calibri, Carlito, "Segoe UI", Arial, sans-serif'
   */
  defaultFontFamily?: string;
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
  /**
   * Currency symbol of the Currency / Accounting formats. Unset: the
   * language's symbol (`$` for English, `¥` for Chinese, ...).
   */
  currency?: string;
  /**
   * Colour theme of the workbook UI and canvas. `auto` follows the
   * `prefers-color-scheme` media query and updates live.
   *
   * Controlled: when set, the workbook always shows this theme and the
   * toolbar's theme switch only reports the user's choice through
   * `onThemeChange`. Leave it unset (and use `defaultTheme`) to let the
   * user switch themes from the toolbar.
   */
  theme?: ThemeSetting;
  /**
   * Initial theme when `theme` is not controlled; the toolbar's theme
   * switch (toolbar item "theme") changes it afterwards. Nothing is
   * persisted: store the value from `onThemeChange` to remember it.
   * @default "light"
   */
  defaultTheme?: ThemeSetting;
  /** Author of new threaded comments (who may edit/delete their posts). */
  currentUser?: CommentUser | null;
  /** People offered by the @mention picker of threaded comments. */
  users?: CommentUser[];
  /** Looks people up for the @mention picker (instead of `users`). */
  searchUsers?:
    | ((query: string) => CommentUser[] | Promise<CommentUser[]>)
    | null;
  /**
   * Show the automatic page breaks (dashed lines) in Normal view once a
   * sheet was previewed or printed, or a page break was inserted, as Excel
   * does.
   * @default true
   */
  showPageBreaksAfterPrint?: boolean;
  /**
   * Calculation options used while the workbook data carries none
   * (`sheet.calcSettings`, set from Formulas > Calculation Options).
   */
  calculation?: CalcSettings;
  /** Background error checking rules (green triangles). */
  errorChecking?: ErrorCheckingOptions;
  /**
   * A custom ribbon: tabs → groups → items (toolbar item names or ribbon
   * command ids). `null` shows the default Excel-like ribbon, filtered by
   * `toolbarItems` when that list is not the default. See the react
   * package's components/Ribbon.
   */
  ribbon?: RibbonTabConfig[] | null;
  /**
   * Chrome around the grid: "suite" (default) lays the ribbon, grid and
   * status bar out as padded panes on the surface colour, like the other
   * apps of the suite; "compact" drops the outer padding for embedding.
   */
  chrome?: "suite" | "compact";
  /** File > New; the menu item shows when set. */
  onNewWorkbook?: (() => void) | null;
  /** File > Open (.xlsx, .csv); the menu item shows when set. */
  onOpenFile?: ((file: File) => void) | null;
  /** File > Save As; the menu item shows when set. */
  onSaveAs?: ((format: "xlsx" | "csv") => void) | null;
};

/** One ribbon item: a toolbar item name / ribbon command id, and its size. */
export type RibbonItemConfig =
  | string
  | {
      id: string;
      /** large: icon over label (Paste, PivotTable); small: 32px button. */
      size?: "large" | "small";
    };

/** A ribbon group entry: one item, or small items stacked in rows. */
export type RibbonEntryConfig =
  | RibbonItemConfig
  | { rows: RibbonItemConfig[][] };

export type RibbonGroupConfig = {
  id: string;
  /** Shown under the group; built-in group ids have translated labels. */
  label?: string;
  /** Icon name of the collapsed group button (see react ui/icons). */
  icon?: string;
  items: RibbonEntryConfig[];
  /**
   * Scaling order when the window narrows: lower collapses first. Groups
   * without one collapse right to left.
   */
  priority?: number;
};

export type RibbonTabConfig = {
  id: string;
  /** Built-in tab ids have translated labels. */
  label?: string;
  groups: RibbonGroupConfig[];
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
  defaultFontSize: DEFAULT_FONT_SIZE,
  defaultFontFamily: DEFAULT_FONT_FAMILY,
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
    "theme", // View › Light / Dark / System theme
    "image",
    "picture-in-cell", // Place picture in cell (pictures in cells)
    "chart",
    "sparkline",
    "shapes",
    "pivotTable",
    "slicer",
    "link",
    "comment",
    "threaded-comment", // New Comment, Previous/Next, Comments pane
    "checkbox", // Insert › Checkbox (cell controls)
    "|",
    // Formulas / Data
    "nameManager",
    "dataVerification",
    "splitColumn",
    "outline", // Group / Ungroup, Subtotal, Auto Outline (Data › Outline)
    "data-tools", // Flash Fill, Advanced Filter, What-If Analysis
    "locationCondition",
    "screenshot",
    "|",
    // Page Layout / File > Print (registered by the react package)
    "pageLayout",
    "print",
    "|",
    // Formula Auditing / Calculation
    "trace-precedents",
    "trace-dependents",
    "remove-arrows",
    "show-formulas",
    "error-checking",
    "evaluate-formula",
    "watch-window",
    "calculation-options",
    "|",
    // View options / Review › Protection (react/src/components/Protection)
    "view-options",
    "protection",
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
    "new-comment", // threaded comments: new / reply / delete
    "comment", // insert / edit / delete / show notes
    "|",
    "cell-format", // Format Cells…
    "pick-list", // Pick From Drop-down List…
    "define-name",
    "link",
    "image",
    "picture-in-cell", // Place Picture in Cell…
    "picture-over-cells", // on a picture cell: Place over Cells
    "picture-alt-text", // on a placed picture: Alt Text…
    "data", // Data Validation…
    "chart",
    "|",
    "formula-auditing", // Trace Precedents / Dependents, Evaluate, Watch…
    "sparkline", // Sparklines submenu on cells with sparklines
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
    "insert",
    "delete",
    "rename",
    "copy",
    "protect",
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
  // empty: the locale's currency symbol ($ for English, see
  // defaultCurrencySymbol)
  currency: "",
  // "light" | "dark" | "auto". A `theme` prop controls it; without one the
  // workbook starts from `defaultTheme` and the toolbar switch changes it.
  theme: "light",
  defaultTheme: "light",
  currentUser: null,
  users: [],
  searchUsers: null,
  showPageBreaksAfterPrint: true,
  calculation: {},
  errorChecking: {},
  ribbon: null,
  chrome: "suite",
  onNewWorkbook: null,
  onOpenFile: null,
  onSaveAs: null,
};
