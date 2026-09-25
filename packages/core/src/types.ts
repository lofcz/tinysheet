import { Patch as ImmerPatch } from "immer";
import { PatchOptions } from "./utils";
import type { Chart } from "./modules/chart";
import type { SparklineGroup } from "./modules/sparkline";
import type { Shape } from "./modules/shapes";
import type { EditorHistory } from "./modules/formulaEditor";

export type Op = {
  op:
    | "replace"
    | "remove"
    | "add"
    | "insertRowCol"
    | "deleteRowCol"
    | "addSheet"
    | "deleteSheet";
  id?: string;
  path: (string | number)[];
  value?: any;
};

export type Rect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

export type CellStyle = {
  bl?: number;
  it?: number;
  ff?: number | string;
  fs?: number;
  fc?: string;
  ht?: number;
  vt?: number;
  tb?: string;
  cl?: number;
  un?: number;
  tr?: string;
};

/**
 * A picture inside a cell. `sizing`: 0 (default) fit keeping the aspect
 * ratio, 1 fill the cell, 2 original size, 3 custom `h` x `w` pixels.
 * `src` is an http(s) or data:image URL.
 */
export type CellImage = {
  src: string;
  alt?: string;
  sizing?: 0 | 1 | 2 | 3;
  h?: number;
  w?: number;
};

export type Cell = {
  v?: string | number | boolean;
  m?: string | number;
  mc?: { r: number; c: number; rs?: number; cs?: number };
  f?: string;
  ct?: { fa?: string; t?: string; s?: any };
  qp?: number;
  bg?: string;
  lo?: number;
  rt?: number;
  ps?: {
    left: number | null;
    top: number | null;
    width: number | null;
    height: number | null;
    value: string;
    isShow: boolean;
  };
  hl?: { r: number; c: number; id: string };
  /**
   * A picture in the cell (Place in Cell, or an IMAGE() result); `v`/`m`
   * hold its alt text. See modules/cellImage.ts.
   */
  img?: CellImage;
  /** Styles a PivotTable wrote into this cell (see modules/pivot.ts). */
  pvs?: Record<string, any>;
  /** Checkbox cell format (Insert › Checkbox); see modules/checkbox.ts. */
  cb?: number;
} & CellStyle;

export type CellWithRowAndCol = {
  r: number;
  c: number;
  v: Cell | null;
};

export type CellMatrix = (Cell | null)[][];

export type Selection = {
  left?: number;
  width?: number;
  top?: number;
  height?: number;
  left_move?: number;
  width_move?: number;
  top_move?: number;
  height_move?: number;
  row: number[];
  column: number[];
  row_focus?: number;
  column_focus?: number;
  moveXY?: { x: number; y: number };
  row_select?: boolean;
  column_select?: boolean;
};

export type Presence = {
  sheetId: string;
  username: string;
  userId?: string;
  color: string;
  selection: {
    r: number;
    c: number;
  };
};

export type SheetConfig = {
  merge?: Record<string, { r: number; c: number; rs: number; cs: number }>; // 合并单元格
  rowlen?: Record<string, number>; // 表格行高
  columnlen?: Record<string, number>; // 表格列宽
  rowhidden?: Record<string, number>; // 隐藏行
  colhidden?: Record<string, number>; // 隐藏列
  customHeight?: Record<string, number>;
  customWidth?: Record<string, number>;
  borderInfo?: any[]; // 边框
  /**
   * Sheet protection (Review › Protect Sheet), Luckysheet-compatible: see
   * `SheetProtection` and modules/protection.ts.
   */
  // eslint-disable-next-line no-use-before-define
  authority?: SheetProtection;
  rowReadOnly?: Record<number, number>;
  colReadOnly?: Record<number, number>;
  /**
   * Outline (Data › Group) level of each grouped row / column, 1–7; rows
   * and columns without an entry are level 0. See modules/outline.ts.
   */
  rowOutlineLevel?: Record<string, number>;
  colOutlineLevel?: Record<string, number>;
  /**
   * Collapsed outline groups, keyed by the group's summary row / column
   * (Excel's `collapsed` flag); the value is a bit mask of the collapsed
   * group levels (bit 0 = level 1) ending at that summary.
   */
  rowOutlineCollapsed?: Record<string, number>;
  colOutlineCollapsed?: Record<string, number>;
  /** Summary rows below their detail (default true; Excel `summaryBelow`). */
  outlineSummaryBelow?: boolean;
  /** Summary columns right of their detail (default true; `summaryRight`). */
  outlineSummaryRight?: boolean;
  /**
   * Manual page breaks: 0-based rows that start a new printed page (written
   * by Data › Subtotal "Page break between groups").
   */
  rowPageBreaks?: number[];
};

export type Image = {
  id: string;
  width: number;
  height: number;
  left: number;
  top: number;
  src: string;
};

export type Sheet = {
  name: string;
  config?: SheetConfig;
  order?: number;
  color?: string;
  data?: CellMatrix;
  celldata?: CellWithRowAndCol[];
  id?: string;
  images?: Image[];
  /** Live chart objects (see `modules/chart.ts`). */
  charts?: Chart[];
  /** In-cell sparklines (see `modules/sparkline.ts`). */
  sparklineGroups?: SparklineGroup[];
  /** Shapes and text boxes (see `modules/shapes.ts`); array order is z-order. */
  shapes?: Shape[];
  zoomRatio?: number;
  column?: number;
  row?: number;
  addRows?: number;
  status?: number;
  hide?: number;
  luckysheet_select_save?: Selection[];
  luckysheet_selection_range?: {
    row: number[];
    column: number[];
  }[];
  calcChain?: any[];
  defaultRowHeight?: number;
  defaultColWidth?: number;
  showGridLines?: boolean | number;
  /** View › Headings: false hides the row and column headers. */
  showRowColHeaders?: boolean;
  /**
   * Sheet direction right-to-left (xlsx `sheetView rightToLeft`). Stored and
   * round-tripped; the grid is still drawn left-to-right (see ROADMAP R9).
   */
  rightToLeft?: boolean;
  /**
   * Protect Workbook (structure). Kept on one sheet of the workbook (the
   * first one by order when set from the UI); see modules/protection.ts.
   */
  // eslint-disable-next-line no-use-before-define
  workbookProtection?: WorkbookProtection;
  pivotTable?: any;
  isPivotTable?: boolean;
  filter?: Record<string, any>;
  filter_select?: { row: number[]; column: number[] };
  luckysheet_conditionformat_save?: any[];
  luckysheet_alternateformat_save?: any[];
  dataVerification?: any;
  hyperlink?: Record<string, { linkType: string; linkAddress: string }>;
  dynamicArray_compute?: any;
  dynamicArray?: any[];
  frozen?: {
    type: "row" | "column" | "both" | "rangeRow" | "rangeColumn" | "rangeBoth";
    range?: { row_focus: number; column_focus: number };
    /** Split panes (not frozen): the top/left pane scrolls on its own. */
    split?: boolean;
    /** Split panes: first row / column shown in the top / left pane. */
    top?: number;
    left?: number;
  };
  /**
   * Defined names stored on this sheet (see modules/names.ts). Names with
   * `local: true` are scoped to this sheet; the others are workbook-scoped
   * (they live on whichever sheet stores them, normally the first one).
   */
  // eslint-disable-next-line no-use-before-define
  definedNames?: DefinedName[];
  /** Excel-style tables ("Format as Table") of this sheet, see modules/tables.ts */
  // eslint-disable-next-line no-use-before-define
  tables?: SheetTable[];
  /** Page Setup and print settings of this sheet, see modules/pageSetup.ts */
  // eslint-disable-next-line no-use-before-define
  pageSetup?: PageSetup;
  /**
   * Threaded comments (Excel "Comments", distinct from notes stored in
   * `cell.ps`), see modules/threadedComments.ts.
   */
  // eslint-disable-next-line no-use-before-define
  threadedComments?: ThreadedComment[];
  /**
   * Workbook calculation options (Formulas > Calculation Options), stored
   * on every sheet; see modules/calculation.ts.
   */
  // eslint-disable-next-line no-use-before-define
  calcSettings?: CalcSettings;
  /** PivotTables whose report is on this sheet, see modules/pivot.ts */
  // eslint-disable-next-line no-use-before-define
  pivotTables?: PivotTable[];
  /** What-If data tables of this sheet (see modules/whatIf.ts). */
  // eslint-disable-next-line no-use-before-define
  dataTables?: DataTableSpec[];
  /** In-place Advanced Filter (see modules/advancedFilter.ts). */
  advancedFilter?: {
    list: { row: [number, number]; column: [number, number] };
    hidden: number[];
  };
};

/** Excel's calculation modes. */
export type CalcMode = "auto" | "autoNoTable" | "manual";

/** Calculation options of a workbook (xlsx `<calcPr>`). */
export type CalcSettings = {
  /** @default "auto" */
  mode?: CalcMode;
  /** Iterative calculation of circular references. @default false */
  iterate?: boolean;
  /** @default 100 */
  maxIterations?: number;
  /** @default 0.001 */
  maxChange?: number;
  /** Recalculate everything when the workbook is opened. */
  fullCalcOnLoad?: boolean;
};

/** A person who writes or is @mentioned in threaded comments. */
export type CommentUser = {
  id: string;
  name: string;
  /** Picture URL shown next to the user's posts. */
  avatar?: string;
  email?: string;
};

/** One post of a threaded comment (the first one or a reply). */
export type ThreadedCommentPost = {
  id: string;
  author: CommentUser;
  /** ISO 8601 creation time. */
  created: string;
  /** ISO 8601 time of the last edit. */
  edited?: string;
  /**
   * The text; @mentions are stored as `@[Display Name](userId)` tokens
   * (see `parseCommentText`).
   */
  text: string;
};

/** A comment thread anchored to cell (r, c); its first post is the thread. */
export type ThreadedComment = ThreadedCommentPost & {
  r: number;
  c: number;
  replies: ThreadedCommentPost[];
  resolved?: boolean;
};

/**
 * A protection password as a hash (passwords are never stored in plain
 * text): Excel's iterated hash (`algorithmName` SHA-512 by default,
 * base64 `hashValue`/`saltValue`, `spinCount`) or the legacy 16-bit hash of
 * xlsx `password` attributes (hex). No hash: no password.
 */
export type ProtectionPasswordHash = {
  algorithmName?: string;
  hashValue?: string;
  saltValue?: string;
  spinCount?: number;
  /** Excel 97-2003 password hash (4 hex digits). */
  legacyHash?: string;
  /**
   * Luckysheet data only: a plain-text password (`algorithmName` "None").
   * Read for compatibility, never written.
   */
  password?: string;
};

/** Review › Allow Edit Ranges: a range editable while the sheet is protected. */
export type AllowEditRange = ProtectionPasswordHash & {
  /** Title (Excel's protectedRange `name`). */
  name: string;
  /** Space-separated A1 references ("A1:B5 D1"). */
  sqref: string;
  hintText?: string;
};

/**
 * Sheet protection settings (Luckysheet's `config.authority`). The allow
 * flags are 1 when users may do that on the protected sheet; a missing flag
 * uses Excel's default (select locked / unlocked cells allowed, everything
 * else not allowed).
 */
export type SheetProtection = ProtectionPasswordHash & {
  /** 1: the sheet is protected. */
  sheet?: number | boolean;
  selectLockedCells?: number;
  selectunLockedCells?: number;
  formatCells?: number;
  formatColumns?: number;
  formatRows?: number;
  insertColumns?: number;
  insertRows?: number;
  insertHyperlinks?: number;
  deleteColumns?: number;
  deleteRows?: number;
  sort?: number;
  /** Use AutoFilter */
  filter?: number;
  /** Use PivotTable & PivotChart */
  usePivotTablereports?: number;
  editObjects?: number;
  editScenarios?: number;
  /** Message shown instead of Excel's when an edit is refused. */
  hintText?: string;
  allowRangeList?: AllowEditRange[];
  [key: string]: any;
};

/** Review › Protect Workbook. */
export type WorkbookProtection = ProtectionPasswordHash & {
  /** No adding, deleting, renaming, moving, copying, hiding sheets. */
  lockStructure?: boolean;
  /** Kept for round trips (Excel 2013+ ignores it). */
  lockWindows?: boolean;
};

/**
 * A What-If data table (`{=TABLE(row_input, col_input)}`). `range` is the
 * whole table: the first row and column hold the input values and the
 * formulas, the rest is the body filled by substituting the inputs.
 */
export type DataTableSpec = {
  id: string;
  range: { row: [number, number]; column: [number, number] };
  /** Row input cell (values across the first row are substituted here). */
  rowInput?: { r: number; c: number } | null;
  /** Column input cell (values down the first column are substituted here). */
  colInput?: { r: number; c: number } | null;
};

/** A defined name (Excel Name Manager entry). */
export type DefinedName = {
  /** Case-insensitively unique within its scope. */
  name: string;
  /**
   * The definition as formula text starting with "=": a reference
   * (`=Sheet1!$A$1:$B$5`), a constant (`=0.2`), a formula or a LAMBDA
   * (`=LAMBDA(x, x*2)`, callable as `Name(1)`).
   */
  refersTo: string;
  /** true: scoped to the sheet storing the name; otherwise workbook-scoped. */
  local?: boolean;
  comment?: string;
  /** Hidden names are resolved in formulas but not listed in the UI. */
  hidden?: boolean;
};

export type TableTotalFunction =
  | "none"
  | "sum"
  | "average"
  | "count"
  | "countNums"
  | "max"
  | "min"
  | "stdDev"
  | "var"
  | "custom";

export type SheetTableColumn = {
  name: string;
  /** Aggregate shown in the total row (SUBTOTAL formula). */
  totalFunction?: TableTotalFunction;
  /** Text shown in the total row when there is no function. */
  totalLabel?: string;
  /**
   * Calculated column: the formula every data cell of the column holds,
   * written as in the first data row (relative references follow the row).
   * New rows of the table inherit it.
   */
  calculatedFormula?: string;
  /** Total-row formula of a "custom" total function (More Functions…). */
  totalFormula?: string;
};

/**
 * Filter state of one table column (the header filter button or a slicer).
 * `condition` is a filter.ts FilterCondition; `{ type: "values" }` keeps the
 * rows whose display text is not in `hidden` ("" stands for blanks).
 */
export type TableColumnFilter = {
  condition: { type: string; hidden?: string[]; [key: string]: any };
  /** Rows (absolute, sheet-wide) this column's filter hides. */
  rowhidden: Record<string, number>;
};

/**
 * A slicer: a floating panel of buttons that filters one table column.
 * Anchored to the cell (r, c) at an offset (px at 100% zoom), so it follows
 * row and column resizes.
 */
export type TableSlicer = {
  /** Unique within the workbook (`Slicer_Region`). */
  name: string;
  /** Table column the slicer filters (column name). */
  column: string;
  caption: string;
  showCaption?: boolean;
  r: number;
  c: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  /** Buttons per row (default 1). */
  columnCount?: number;
  /** Button height in px (default 26). */
  buttonHeight?: number;
  /** Button width in px (default: fill the panel width). */
  buttonWidth?: number;
  /** Key of a slicer style (SLICER_STYLES in react Tables/slicers). */
  style?: string;
  /** Multi-select mode: clicks toggle items instead of selecting one. */
  multiSelect?: boolean;
  sortOrder?: "ascending" | "descending";
  /** Hide items with no data (rows all hidden by other filters). */
  hideNoData?: boolean;
  /** Show items with no data last (default true). */
  noDataLast?: boolean;
};

/** An Excel-style table on a sheet. */
export type SheetTable = {
  /** Workbook-unique name (`Table1`), usable in structured references. */
  name: string;
  /** Whole table: header row + data rows + total row. */
  range: { row: [number, number]; column: [number, number] };
  headerRow: boolean;
  totalRow: boolean;
  bandedRows: boolean;
  bandedColumns: boolean;
  firstColumn: boolean;
  lastColumn: boolean;
  /** Key of a style from TABLE_STYLES (modules/tables.ts). */
  style: string;
  columns: SheetTableColumn[];
  /** Filter buttons in the header row (default true). */
  filterButton?: boolean;
  /** Per-column filters, keyed by the column's index in the table. */
  filters?: Record<string, TableColumnFilter>;
  /** Slicers filtering this table (on the table's sheet). */
  slicers?: TableSlicer[];
};

/* ------------------------------------------------------------------------ */
/* PivotTables (modules/pivot.ts)                                            */
/* ------------------------------------------------------------------------ */

export type PivotAggregate =
  | "sum"
  | "count"
  | "average"
  | "max"
  | "min"
  | "product"
  | "countNums"
  | "stdDev"
  | "stdDevp"
  | "var"
  | "varp";

export type PivotShowAs =
  | "normal"
  | "percentOfGrandTotal"
  | "percentOfColumnTotal"
  | "percentOfRowTotal"
  | "difference"
  | "percentDifference";

export type PivotDateGroup = "years" | "quarters" | "months" | "days";

export type PivotValueField = {
  /** Source field (column header). */
  field: string;
  aggregate: PivotAggregate;
  /** Custom caption ("Sum of Sales" by default). */
  name?: string;
  showAs?: PivotShowAs;
  /** difference / percentDifference: the field and item compared with. */
  baseField?: string;
  /** An item label, or "(previous)" / "(next)". */
  baseItem?: string;
  /** Number format code of the values (General by default). */
  numberFormat?: string;
};

export type PivotLabelFilter = {
  op:
    | "equals"
    | "notEquals"
    | "beginsWith"
    | "endsWith"
    | "contains"
    | "notContains"
    | "greaterThan"
    | "lessThan"
    | "between";
  value: string;
  value2?: string;
};

export type PivotValueFilter = {
  op:
    | "greaterThan"
    | "greaterOrEqual"
    | "lessThan"
    | "lessOrEqual"
    | "equals"
    | "notEquals"
    | "between"
    | "top"
    | "bottom";
  /** Index into `values`. */
  valueIndex: number;
  /** The threshold, or the item count for top / bottom. */
  value: number;
  value2?: number;
};

/** Per-field settings (keyed by field name, or `Field|years` levels). */
export type PivotFieldSettings = {
  /** Items (keys, see `pivotItemKey`) unchecked in the field's filter. */
  hiddenItems?: string[];
  /** Label order; "none" keeps the source order. */
  sort?: "asc" | "desc" | "none";
  /** Sort by a value field (index into `values`) instead of the labels. */
  sortByValue?: number;
  labelFilter?: PivotLabelFilter;
  valueFilter?: PivotValueFilter;
  /** Date grouping of the source field (on the field name only). */
  dateGroups?: PivotDateGroup[];
  /** false: no subtotals for this field. */
  subtotal?: boolean;
};

export type PivotFilterField = {
  field: string;
  /** Item keys shown; undefined = (All). */
  selected?: string[];
};

export type PivotOptions = {
  layout: "compact" | "outline" | "tabular";
  subtotals: "top" | "bottom" | "off";
  /** The Grand Total row under the rows. */
  grandTotalRow: boolean;
  /** The Grand Total column right of the columns. */
  grandTotalColumn: boolean;
  /** With several value fields: Σ Values on the rows instead of columns. */
  valuesOnRows?: boolean;
  /** Shown in value cells without data. */
  emptyText?: string;
  /** Keep formatting applied to the report's cells on refresh. */
  preserveFormatting: boolean;
  /** Refresh when the source data changes. */
  autoRefresh: boolean;
  /** Tabular / outline: repeat item labels on every row. */
  repeatLabels?: boolean;
};

/** An item of a row / column axis of a rendered report. */
export type PivotAxisItem = {
  /** item, subtotal, grand total, or a label-only row (no values) */
  t: "item" | "subtotal" | "grand" | "label";
  /** Item keys along the axis levels (a prefix for subtotals). */
  p: string[];
  /** Value field index when Σ Values is on this axis. */
  v?: number;
};

/** Where the last refresh put things (for GETPIVOTDATA, drill-down). */
export type PivotLayout = {
  /** Sheet row / column of the report's top-left cell. */
  row: number;
  col: number;
  headerRows: number;
  labelCols: number;
  rowLevels: string[];
  colLevels: string[];
  rowItems: PivotAxisItem[];
  colItems: PivotAxisItem[];
  /** Level index -> item key -> label. */
  labels: Record<string, Record<string, string>>;
};

export type PivotSource = {
  /** A range of a sheet (header row included)... */
  sheetId?: string;
  range?: { row: [number, number]; column: [number, number] };
  /** ...or a table name. */
  table?: string;
};

export type PivotTable = {
  /** Unique id (stable across renames). */
  id: string;
  /** "PivotTable1" */
  name: string;
  source: PivotSource;
  /** Top-left cell of the report body (the report filters sit above). */
  anchor: { r: number; c: number };
  rows: string[];
  columns: string[];
  values: PivotValueField[];
  filters: PivotFilterField[];
  fields?: Record<string, PivotFieldSettings>;
  options: PivotOptions;
  /** Captions (compact layout); default "Row Labels" / "Column Labels". */
  rowHeaderCaption?: string;
  colHeaderCaption?: string;
  /** Cells covered by the last refresh (filters included). */
  output?: { row: [number, number]; column: [number, number] };
  layout?: PivotLayout;
};

export type CommentBox = {
  r: number;
  c: number;
  rc: string;
  autoFocus: boolean;
  value: string;
  size: {
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
  } & Rect;
} & Rect;

export type SearchResult = {
  r: number;
  c: number;
  sheetName: string;
  sheetId: string;
  cellPosition: string;
  value: string;
};

export type LinkCardProps = {
  sheetId: string;
  r: number;
  c: number;
  rc: string;
  originText: string;
  originType: string;
  originAddress: string;
  position: { cellLeft: number; cellBottom: number };
  isEditing: boolean;
  selectingCellRange?: boolean;
};

export type RangeDialogProps = {
  show: boolean;
  rangeTxt: string;
  type: string;
  singleSelect: boolean;
};

export type DataRegulationProps = {
  type: string;
  type2: string;
  rangeTxt: string;
  value1: string;
  value2: string;
  validity: string;
  remote: boolean;
  prohibitInput: boolean;
  hintShow: boolean;
  hintValue: string;
  hintTitle?: string;
  errorStyle?: "stop" | "warning" | "information";
  errorTitle?: string;
  errorMessage?: string;
  ignoreBlank?: boolean;
  showDropdown?: boolean;
  placeholder?: string;
};

export type ConditionRulesProps = {
  rulesType: string;
  rulesValue: string;
  textColor: { check: boolean; color: string };
  cellColor: { check: boolean; color: string };
  betweenValue: { value1: string; value2: string };
  dateValue: string;
  repeatValue: string;
  projectValue: string;
};

export type FilterOptions = {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
  left: number;
  top: number;
  width: number;
  height: number;
  items: {
    col: number;
    left: number;
    top: number;
  }[];
};

export type History = {
  patches: ImmerPatch[];
  inversePatches: ImmerPatch[];
  options?: PatchOptions;
  /** steps sharing a group are undone/redone together (withUndoGroup) */
  group?: number;
};

export type Freezen = {
  horizontal?: { freezenhorizontaldata: any[]; top: number };
  vertical?: { freezenverticaldata: any[]; left: number };
};

export type GlobalCache = {
  verticalScrollLock?: boolean;
  horizontalScrollLock?: boolean;
  overwriteCell?: boolean;
  ignoreWriteCell?: boolean;
  doNotFocus?: boolean;
  doNotUpdateCell?: boolean;
  recentTextColor?: string;
  recentBackgroundColor?: string;
  visibleColumnsUnique?: number[];
  visibleRowsUnique?: number[];
  undoList: History[];
  redoList: History[];
  /** undo group being recorded (see withUndoGroup) */
  undoGroup?: { id: number; depth: number };
  /** undo steps of the text being edited in a cell (see recordEditorState) */
  editorHistory?: EditorHistory;
  editingCommentBoxEle?: HTMLDivElement;
  freezen?: Record<string, Freezen>;
  image?: {
    imgInitialPosition: Rect | undefined;
    cursorMoveStartPosition: { x: number; y: number } | undefined;
    resizingSide: string | undefined;
    /** the box shown while dragging (screen px), once the pointer moved */
    current?: { left: number; top: number; width: number; height: number };
  };
  commentBox?: {
    movingId: string | undefined;
    resizingId: string | undefined;
    resizingSide: string | undefined;
    commentRC: { r: number; c: number; rc: string };
    boxInitialPosition: Rect | undefined;
    cursorMoveStartPosition: { x: number; y: number } | undefined;
  };
  searchDialog?: {
    mouseEnter?: boolean;
    moveProps?: {
      initialPosition: Rect | undefined;
      cursorMoveStartPosition: { x: number; y: number } | undefined;
    };
  };
  linkCard?: {
    mouseEnter?: boolean;
    rangeSelectionModal?: {
      initialPosition: Rect | undefined;
      cursorMoveStartPosition: { x: number; y: number } | undefined;
    };
  };
  dragCellStartPos?: {
    x: number;
    y: number;
  };
  touchMoveStatus?: boolean;
  touchHandleStatus?: boolean;
  touchMoveStartPos?: {
    x: number;
    y: number;
    vy: number;
    moveType: string;
    vy_x?: number;
    vy_y?: number;
    scrollTop?: number;
    scrollLeft?: number;
  };
};

export type SingleRange = { row: number[]; column: number[] };
export type Range = SingleRange[];

// FORMULA
export type FormulaDependency = {
  row: [number, number];
  column: [number, number];
  sheetId: string | undefined;
};

type AncestorFormulaCell = {
  [rxcxix: string]: number;
};

export type FormulaCellInfo = {
  formulaDependency: FormulaDependency[];
  calc_funcStr: string;
  key: string;
  r: number;
  c: number;
  id: string;
  parents: AncestorFormulaCell;
  chidren: AncestorFormulaCell;
  color: string;
};

export type FormulaCellInfoMap = {
  [rxcxix: string]: FormulaCellInfo;
};

export type FormulaCell = {
  r: number;
  c: number;
  id: string;
  parent?: AncestorFormulaCell;
  func?: [boolean, number, string];
  color?: string;
  chidren?: AncestorFormulaCell;
  times?: number;
};

/** A rectangle of cells (0-based, inclusive). */
export type PrintRange = { row: [number, number]; column: [number, number] };

export type PageOrientation = "portrait" | "landscape";

/** Paper sizes of Page Setup (see PAPER_SIZES in modules/pageSetup.ts). */
export type PaperSizeId =
  | "letter"
  | "tabloid"
  | "ledger"
  | "legal"
  | "statement"
  | "executive"
  | "a3"
  | "a4"
  | "a5"
  | "b4"
  | "b5"
  | "folio"
  | "envelope10"
  | "envelopeDL"
  | "envelopeC5";

/** Page margins in inches (as Excel stores them). */
export type PageMargins = {
  top: number;
  bottom: number;
  left: number;
  right: number;
  header: number;
  footer: number;
};

/**
 * A header or footer: the text of its left, centre and right sections with
 * Excel's codes (`&P` page, `&N` pages, `&D` date, `&T` time, `&F` file,
 * `&A` sheet, `&Z` path, `&G` picture, `&B` / `&I` / `&U` / `&S` bold,
 * italic, underline, strikethrough, `&"font,style"`, `&nn` font size,
 * `&K` colour, `&&` a literal ampersand).
 */
export type HeaderFooterText = {
  left?: string;
  center?: string;
  right?: string;
};

/**
 * Excel's Page Setup of a sheet. Every field is optional; missing fields
 * use Excel's defaults (portrait Letter, Normal margins, 100% scale, ...).
 */
export type PageSetup = {
  orientation?: PageOrientation;
  paperSize?: PaperSizeId;
  /** Adjust to: percent of normal size (10–400). */
  scale?: number;
  /** Fit to `fitToWidth` pages wide by `fitToHeight` tall instead of `scale`. */
  fitToPage?: boolean;
  /** Pages wide (0: automatic, as many as needed). */
  fitToWidth?: number;
  /** Pages tall (0: automatic). */
  fitToHeight?: number;
  /** First page number (undefined: automatic). */
  firstPageNumber?: number;
  /** Print quality in dpi. */
  printQuality?: number;
  margins?: Partial<PageMargins>;
  centerHorizontally?: boolean;
  centerVertically?: boolean;
  /** Print area: printed instead of the used range. */
  printArea?: PrintRange[];
  /** Rows to repeat at top (0-based, inclusive). */
  printTitleRows?: [number, number];
  /** Columns to repeat at left (0-based, inclusive). */
  printTitleColumns?: [number, number];
  gridLines?: boolean;
  headings?: boolean;
  blackAndWhite?: boolean;
  draft?: boolean;
  pageOrder?: "downThenOver" | "overThenDown";
  comments?: "none" | "atEnd" | "asDisplayed";
  cellErrors?: "displayed" | "blank" | "dash" | "NA";
  header?: HeaderFooterText;
  footer?: HeaderFooterText;
  differentFirst?: boolean;
  differentOddEven?: boolean;
  firstHeader?: HeaderFooterText;
  firstFooter?: HeaderFooterText;
  evenHeader?: HeaderFooterText;
  evenFooter?: HeaderFooterText;
  /** Scale the header/footer with the document (default true). */
  scaleWithDoc?: boolean;
  /** Align the header/footer with the page margins (default true). */
  alignWithMargins?: boolean;
  /** Manual page breaks before these rows (0-based; a page starts there). */
  rowBreaks?: number[];
  /** Manual page breaks before these columns (0-based). */
  colBreaks?: number[];
};
