import { Patch as ImmerPatch } from "immer";
import { PatchOptions } from "./utils";
import type { Chart } from "./modules/chart";

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

export type Cell = {
  v?: string | number | boolean;
  m?: string | number;
  mc?: { r: number; c: number; rs?: number; cs?: number };
  f?: string;
  ct?: { fa?: string; t?: string; s?: any };
  qp?: number;
  spl?: any;
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
  /** Styles a PivotTable wrote into this cell (see modules/pivot.ts). */
  pvs?: Record<string, any>;
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
  authority?: any;
  rowReadOnly?: Record<number, number>;
  colReadOnly?: Record<number, number>;
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
  /** PivotTables whose report is on this sheet, see modules/pivot.ts */
  // eslint-disable-next-line no-use-before-define
  pivotTables?: PivotTable[];
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
  editingCommentBoxEle?: HTMLDivElement;
  freezen?: Record<string, Freezen>;
  image?: {
    imgInitialPosition: Rect | undefined;
    cursorMoveStartPosition: { x: number; y: number } | undefined;
    resizingSide: string | undefined;
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
