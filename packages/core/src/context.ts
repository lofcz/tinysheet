import _ from "lodash";
import { SheetConfig } from ".";
import { FormulaCache } from "./modules";
import { normalizeSelection } from "./modules/selection";
import { computeAxisPositions } from "./modules/geometry";
import { Hooks } from "./settings";
import type { ThemeName } from "./theme";
import type { EditState } from "./modules/editMode";
import {
  Sheet,
  Selection,
  Cell,
  CommentBox,
  Rect,
  Image,
  Presence,
  LinkCardProps,
  FilterOptions,
  RangeDialogProps,
  DataRegulationProps,
  ConditionRulesProps,
  GlobalCache,
} from "./types";
import { getSheetIndex } from "./utils";

interface MutableRefObject<T> {
  current: T;
}

type RefValues = {
  globalCache: GlobalCache;
  cellInput: MutableRefObject<HTMLDivElement | null>;
  fxInput: MutableRefObject<HTMLDivElement | null>;
  canvas: MutableRefObject<HTMLCanvasElement | null>;
  cellArea: MutableRefObject<HTMLDivElement | null>;
  workbookContainer: MutableRefObject<HTMLDivElement | null>;
};

export type Context = {
  luckysheetfile: Sheet[];
  defaultcolumnNum: number;
  defaultrowNum: number;
  addDefaultRows: number;
  fullscreenmode: boolean;
  devicePixelRatio: number;
  commentBoxes?: CommentBox[];
  editingCommentBox?: CommentBox;
  hoveredCommentBox?: CommentBox;
  insertedImgs?: Image[];
  editingInsertedImgs?: Image;
  activeImg?: string;
  /** Id of the selected chart object, if any. */
  activeChart?: string;
  /** Whether the chart editor panel is open for `activeChart`. */
  chartEditorOpen?: boolean;
  presences?: Presence[];
  showSearch?: boolean;
  showReplace?: boolean;
  /** Paste Special dialog open (Ctrl+Alt+V, Ctrl+Shift+V) */
  showPasteSpecial?: boolean;
  linkCard?: LinkCardProps;
  rangeDialog?: RangeDialogProps; // 坐标选区鼠标选择
  // 提醒弹窗
  warnDialog?: string;
  /** Open Format Cells dialog and its tab (see openFormatCells). */
  formatCellsDialog?: { tab: string };
  currency?: string;
  /** Resolved colour theme (from `settings.theme`); read by the canvas. */
  theme?: ThemeName;
  dataVerification?: {
    selectStatus: boolean;
    selectRange: [];
    optionLabel_en: any; // 英文提示消息
    optionLabel_zh: any; // 中文提示消息
    optionLabel_zh_tw: any; // 中文提示消息
    optionLabel_es: any; // 中文提示消息
    optionLabel_hi: any;
    optionLabel_ru: any;
    dataRegulation?: DataRegulationProps; // 数据验证规则
    /** rule edited from the rules sidebar (see getDataVerificationRules) */
    editingRuleId?: string;
  };
  // 数据验证下拉列表
  dataVerificationDropDownList?: boolean;
  /** pending data validation error alert (see checkDataVerificationInput) */
  dataVerificationAlert?: {
    sheetId: string;
    r: number;
    c: number;
    value: string;
    style: "stop" | "warning" | "information";
    title: string;
    message: string;
  };
  /** sheets whose invalid cells are circled (Circle Invalid Data) */
  dataVerificationCircles?: Record<string, boolean>;
  /** the data validation rules sidebar is open */
  dataVerificationSidebar?: boolean;
  conditionRules: ConditionRulesProps; // 条件格式

  contextMenu: {
    x?: number;
    y?: number;
    headerMenu?: boolean;
    pageX?: number;
    pageY?: number;
  };
  sheetTabContextMenu: {
    x?: number;
    y?: number;
    sheet?: Sheet;
    onRename?: () => void;
  };
  filterContextMenu?: {
    x: number;
    y: number;
    col: number;
    startRow: number;
    endRow: number;
    startCol: number;
    endCol: number;
    hiddenRows: number[];
    listBoxMaxHeight: number;
  };

  currentSheetId: string;
  calculateSheetId: string;
  config: SheetConfig;

  visibledatarow: number[];
  visibledatacolumn: number[];
  ch_width: number;
  rh_height: number;

  cellmainWidth: number;
  cellmainHeight: number;
  toolbarHeight: number;
  infobarHeight: number;
  calculatebarHeight: number;
  rowHeaderWidth: number;
  columnHeaderHeight: number;
  cellMainSrollBarSize: number;
  sheetBarHeight: number;
  statisticBarHeight: number;
  luckysheetTableContentHW: number[];

  defaultcollen: number;
  defaultrowlen: number;

  scrollLeft: number;
  scrollTop: number;

  sheetScrollRecord: Record<string, any>;

  luckysheet_select_status: boolean;
  luckysheet_select_save: Sheet["luckysheet_select_save"];
  luckysheet_selection_range: Sheet["luckysheet_selection_range"];
  formulaRangeHighlight: ({
    rangeIndex: number;
    backgroundColor: string;
  } & Rect)[];
  formulaRangeSelect: ({ rangeIndex: number } & Rect) | undefined;
  functionCandidates: any[];
  functionHint: string | null | undefined;
  /** highlighted item of `functionCandidates` (formula autocomplete) */
  functionCandidateIndex?: number;
  /** argument of `functionHint` the caret is in */
  functionHintArgIndex?: number;

  luckysheet_copy_save?: {
    dataSheetId: string;
    copyRange: { row: number[]; column: number[] }[];
    RowlChange: boolean;
    HasMC: boolean;
  }; // 复制粘贴
  luckysheet_paste_iscut: boolean;

  filterchage: boolean; // 筛选
  filterOptions?: FilterOptions;
  luckysheet_filter_save?: { row: number[]; column: number[] } | undefined;
  filter: Record<
    string,
    {
      caljs: any;
      rowhidden: Record<string, number>;
      optionstate: boolean;
      str: number;
      edr: number;
      cindex: number;
      stc: number;
      edc: number;
    }
  >;

  luckysheet_sheet_move_status: boolean;
  luckysheet_sheet_move_data: any[];
  luckysheet_scroll_status: boolean;

  luckysheetcurrentisPivotTable: boolean;

  luckysheet_rows_selected_status: boolean; // 行列标题相关参
  luckysheet_cols_selected_status: boolean;
  luckysheet_rows_change_size: boolean;
  luckysheet_rows_change_size_start: any[];
  luckysheet_cols_change_size: boolean;
  luckysheet_cols_change_size_start: any[];
  luckysheet_cols_freeze_drag: boolean;
  luckysheet_rows_freeze_drag: boolean;

  luckysheetCellUpdate: any[];
  /** Enter/Edit/Point mode of the edit session (see modules/editMode) */
  editState?: EditState;
  /** Excel's End mode: the next arrow key jumps like Ctrl+arrow */
  endMode?: boolean;
  /** column where a run of Tab presses started (Enter returns to it) */
  tabReturn?: { col: number; at: [number, number] };

  luckysheet_shiftkeydown: boolean;
  luckysheet_shiftpositon: Selection | undefined;

  iscopyself: boolean;

  orderbyindex: number; // 排序下标

  luckysheet_model_move_state: boolean; // 模态框拖动
  luckysheet_model_xy: number[];
  luckysheet_model_move_obj: any;

  luckysheet_cell_selected_move: boolean; // 选区拖动替换
  luckysheet_cell_selected_move_index: any[];

  luckysheet_cell_selected_extend: boolean; // 选区下拉
  luckysheet_cell_selected_extend_index: any[];

  lang: string | null; // language

  chart_selection: any;

  zoomRatio: number;

  showGridLines: boolean;
  allowEdit: boolean;

  fontList: any[];
  defaultFontSize: number;

  luckysheetPaintModelOn: boolean;
  luckysheetPaintSingle: boolean;

  // 默认单元格
  defaultCell: Cell;

  groupValuesRefreshData: any[];
  formulaCache: FormulaCache;
  hooks: Hooks;
  showSheetList?: Boolean;
  /** Grouped sheets (Ctrl/Shift+click on tabs); edits apply to all of them. */
  groupedSheetIds?: string[];
  /** Go To dialog (Ctrl+G / F5) visibility. */
  showGoTo?: boolean;
  /**
   * Group / Ungroup asked for a range that is neither whole rows nor whole
   * columns (Shift+Alt+Right / Left): the UI asks which one (outline.ts).
   */
  outlinePrompt?: "group" | "ungroup";
  // 只读模式公式被引用单元格强制高光
  forceFormulaRef?: Boolean;

  sheetFocused: boolean; // property to track sheet focus for keyboard navigation

  getRefs: () => RefValues;
};

export function defaultContext(refs: RefValues): Context {
  return {
    luckysheetfile: [],
    defaultcolumnNum: 60,
    defaultrowNum: 84,
    addDefaultRows: 50,
    fullscreenmode: true,
    devicePixelRatio: (typeof globalThis !== "undefined" ? globalThis : window)
      .devicePixelRatio,

    contextMenu: {},
    sheetTabContextMenu: {},

    currentSheetId: "",
    calculateSheetId: "",
    config: {},
    // 提醒弹窗
    warnDialog: undefined,
    currency: "¥",
    rangeDialog: {
      show: false,
      rangeTxt: "",
      type: "",
      singleSelect: false,
    },

    dataVerification: {
      selectStatus: false,
      selectRange: [],
      optionLabel_en: {
        number: "numeric",
        number_integer: "integer",
        number_decimal: "decimal",
        between: "between",
        notBetween: "not between",
        equal: "equal to",
        notEqualTo: "not equal to",
        moreThanThe: "greater",
        lessThan: "less than",
        greaterOrEqualTo: "greater or equal to",
        lessThanOrEqualTo: "less than or equal to",
        include: "include",
        exclude: "not include",
        earlierThan: "earlier than",
        noEarlierThan: "not earlier than",
        laterThan: "later than",
        noLaterThan: "not later than",
        identificationNumber: "identification number",
        phoneNumber: "phone number",
      },
      optionLabel_ru: {
        number: "числовое",
        number_integer: "целое число",
        number_decimal: "десятичное число",
        between: "между",
        notBetween: "не между",
        equal: "равно",
        notEqualTo: "не равно",
        moreThanThe: "больше",
        lessThan: "меньше",
        greaterOrEqualTo: "больше или равно",
        lessThanOrEqualTo: "меньше или равно",
        include: "содержит",
        exclude: "не содержит",
        earlierThan: "раньше",
        noEarlierThan: "не раньше",
        laterThan: "позже",
        noLaterThan: "не позже",
        identificationNumber: "идентификационный номер",
        phoneNumber: "номер телефона",
      },
      optionLabel_hi: {
        number: "संख्यात्मक",
        number_integer: "पूर्णांक",
        number_decimal: "दशमलव",
        between: "के बीच",
        notBetween: "के बीच नहीं",
        equal: "के बराबर",
        notEqualTo: "के बराबर नहीं",
        moreThanThe: "से अधिक",
        lessThan: "से कम",
        greaterOrEqualTo: "के बराबर या अधिक",
        lessThanOrEqualTo: "के बराबर या कम",
        include: "शामिल",
        exclude: "शामिल नहीं",
        earlierThan: "से पहले",
        noEarlierThan: "से पहले नहीं",
        laterThan: "के बाद",
        noLaterThan: "के बाद नहीं",
        identificationNumber: "पहचान संख्या",
        phoneNumber: "फोन नंबर",
      },
      optionLabel_zh: {
        number: "数值",
        number_integer: "整数",
        number_decimal: "小数",
        between: "介于",
        notBetween: "不介于",
        equal: "等于",
        notEqualTo: "不等于",
        moreThanThe: "大于",
        lessThan: "小于",
        greaterOrEqualTo: "大于等于",
        lessThanOrEqualTo: "小于等于",
        include: "包括",
        exclude: "不包括",
        earlierThan: "早于",
        noEarlierThan: "不早于",
        laterThan: "晚于",
        noLaterThan: "不晚于",
        identificationNumber: "身份证号码",
        phoneNumber: "手机号",
      },
      optionLabel_zh_tw: {
        number: "數位",
        number_integer: "數位-整數",
        number_decimal: "數位-小數",
        between: "介於",
        notBetween: "不介於",
        equal: "等於",
        notEqualTo: "不等於",
        moreThanThe: "大於",
        lessThan: "小於",
        greaterOrEqualTo: "大於等於",
        lessThanOrEqualTo: "小於等於",
        include: "包括",
        exclude: "不包括",
        earlierThan: "早於",
        noEarlierThan: "不早於",
        laterThan: "晚於",
        noLaterThan: "不晚於",
        identificationNumber: "身份證號碼",
        phoneNumber: "手機號",
      },
      optionLabel_es: {
        number: "Número",
        number_integer: "Número entero",
        number_decimal: "Número decimal",
        between: "Entre",
        notBetween: "No entre",
        equal: "Iqual",
        notEqualTo: "No iqual a",
        moreThanThe: "Más que el",
        lessThan: "Menos que",
        greaterOrEqualTo: "Mayor o igual a",
        lessThanOrEqualTo: "Menor o igual a",
        include: "Incluir",
        exclude: "Excluir",
        earlierThan: "Antes de",
        noEarlierThan: "No antes de",
        laterThan: "Después de",
        noLaterThan: "No después de",
        identificationNumber: "Número de identificación",
        phoneNumber: "Número de teléfono",
      },
      dataRegulation: {
        type: "",
        type2: "",
        rangeTxt: "",
        value1: "",
        value2: "",
        validity: "",
        remote: false,
        prohibitInput: false,
        hintShow: false,
        hintValue: "",
      },
    },

    dataVerificationDropDownList: false,

    conditionRules: {
      rulesType: "",
      rulesValue: "",
      textColor: { check: true, color: "#000000" },
      cellColor: { check: true, color: "#000000" },
      betweenValue: { value1: "", value2: "" },
      dateValue: "",
      repeatValue: "0",
      projectValue: "10",
    },

    visibledatarow: [],
    visibledatacolumn: [],
    ch_width: 0,
    rh_height: 0,

    cellmainWidth: 0,
    cellmainHeight: 0,
    toolbarHeight: 41,
    infobarHeight: 57,
    calculatebarHeight: 29,
    rowHeaderWidth: 46,
    columnHeaderHeight: 20,
    cellMainSrollBarSize: 12,
    sheetBarHeight: 31,
    statisticBarHeight: 23,
    luckysheetTableContentHW: [0, 0],

    defaultcollen: 73,
    defaultrowlen: 19,

    scrollLeft: 0,
    scrollTop: 0,

    sheetScrollRecord: {},

    luckysheet_select_status: false,
    luckysheet_select_save: undefined,
    luckysheet_selection_range: [],
    formulaRangeHighlight: [],
    formulaRangeSelect: undefined,
    functionCandidates: [],
    functionHint: null,

    luckysheet_copy_save: undefined, // 复制粘贴
    luckysheet_paste_iscut: false,

    filterchage: true, // 筛选
    filter: {},

    luckysheet_sheet_move_status: false,
    luckysheet_sheet_move_data: [],
    luckysheet_scroll_status: false,

    luckysheetcurrentisPivotTable: false,

    luckysheet_rows_selected_status: false, // 行列标题相关参
    luckysheet_cols_selected_status: false,
    luckysheet_rows_change_size: false,
    luckysheet_rows_change_size_start: [],
    luckysheet_cols_change_size: false,
    luckysheet_cols_change_size_start: [],
    luckysheet_cols_freeze_drag: false,
    luckysheet_rows_freeze_drag: false,

    luckysheetCellUpdate: [],

    luckysheet_shiftkeydown: false,
    luckysheet_shiftpositon: undefined,

    iscopyself: true,
    activeImg: undefined,

    orderbyindex: 0, // 排序下标

    luckysheet_model_move_state: false, // 模态框拖动
    luckysheet_model_xy: [0, 0],
    luckysheet_model_move_obj: null,

    luckysheet_cell_selected_move: false, // 选区拖动替换
    luckysheet_cell_selected_move_index: [],

    luckysheet_cell_selected_extend: false, // 选区下拉
    luckysheet_cell_selected_extend_index: [],

    lang: null, // language
    chart_selection: {},

    zoomRatio: 1,

    showGridLines: true,
    allowEdit: true,

    fontList: [],
    defaultFontSize: 10,

    luckysheetPaintModelOn: false,
    luckysheetPaintSingle: false,

    sheetFocused: true,

    // 默认单元格
    defaultCell: {
      bl: 0,
      ct: { fa: "General", t: "n" },
      fc: "rgb(51, 51, 51)",
      ff: 0,
      fs: 11,
      ht: 1,
      it: 0,
      vt: 1,
      m: "",
      v: "",
    },

    groupValuesRefreshData: [],
    formulaCache: new FormulaCache(), // class will not be frozen by immer, can be mutated at any time.
    hooks: {},

    getRefs: () => refs,
  };
}

export function getFlowdata(ctx?: Context, id?: string | null) {
  if (!ctx) return null;
  const i = getSheetIndex(ctx, id || ctx.currentSheetId);
  if (_.isNil(i)) {
    return null;
  }
  return ctx.luckysheetfile?.[i]?.data;
}

function calcRowColSize(ctx: Context, rowCount: number, colCount: number) {
  // Tight loops over plain (non-draft) objects: this runs inside immer
  // producers, where every proxied read costs as much as the loop body.
  const rows = computeAxisPositions(
    rowCount,
    ctx.defaultrowlen,
    ctx.config?.rowlen,
    ctx.config?.rowhidden,
    ctx.zoomRatio
  );
  // Frozen up front so immer's auto-freeze does not walk every entry.
  ctx.visibledatarow = Object.freeze(rows.positions) as number[];

  // 如果增加行和回到顶部按钮隐藏，则减少底部空白区域，但是预留足够空间给单元格下拉按钮
  ctx.rh_height = rows.total + 80; // 最底部增加空白

  const maxColumnlen = 120;

  // Legacy clamp: columns with content in the first row get an explicit
  // width when the default width lies outside [defaultcollen, 300].
  if (ctx.defaultcollen > 300) {
    const flowdata = getFlowdata(ctx);
    for (let c = 0; c < colCount; c += 1) {
      if (!ctx.config?.columnlen?.[c] && flowdata?.[0]?.[c]) {
        if (!ctx.config?.columnlen) {
          ctx.config.columnlen = {};
        }
        ctx.config.columnlen[c] = 300;
      }
    }
  }

  const cols = computeAxisPositions(
    colCount,
    ctx.defaultcollen,
    ctx.config?.columnlen,
    ctx.config?.colhidden,
    ctx.zoomRatio
  );
  ctx.visibledatacolumn = Object.freeze(cols.positions) as number[];
  ctx.ch_width = cols.total + maxColumnlen;
}

export function ensureSheetIndex(data: Sheet[], generateSheetId: () => string) {
  if (data?.length > 0) {
    let hasActive = false;
    const indexs: (string | number)[] = [];
    data.forEach((item) => {
      if (item.id == null) {
        item.id = generateSheetId();
      }
      if (indexs.includes(item.id)) {
        item.id = generateSheetId();
      } else {
        indexs.push(item.id);
      }

      if (item.status == null) {
        item.status = 0;
      }
      if (item.status === 1) {
        if (hasActive) {
          item.status = 0;
        } else {
          hasActive = true;
        }
      }
    });
    if (!hasActive) {
      data[0].status = 1;
    }
  }
}

export function initSheetIndex(ctx: Context) {
  // get current sheet
  const shownSheets = ctx.luckysheetfile.filter(
    (singleSheet) => _.isUndefined(singleSheet.hide) || singleSheet.hide !== 1
  );
  ctx.currentSheetId = _.sortBy(shownSheets, (sheet) => sheet.order)[0]
    .id as string;
  for (let i = 0; i < ctx.luckysheetfile.length; i += 1) {
    if (
      ctx.luckysheetfile[i].status === 1 &&
      ctx.luckysheetfile[i].hide !== 1
    ) {
      ctx.currentSheetId = ctx.luckysheetfile[i].id!;
      break;
    }
  }
}

export function updateContextWithSheetData(ctx: Context, data: any[][]) {
  const rowCount = data.length;
  const colCount = rowCount === 0 ? 0 : data[0].length;

  calcRowColSize(ctx, rowCount, colCount);
  normalizeSelection(ctx, ctx.luckysheet_select_save);
}

export function updateContextWithCanvas(
  ctx: Context,
  canvas: HTMLCanvasElement,
  placeholder: HTMLDivElement
) {
  ctx.luckysheetTableContentHW = [
    placeholder.clientWidth,
    placeholder.clientHeight,
  ];
  ctx.cellmainHeight = placeholder.clientHeight - ctx.columnHeaderHeight;
  ctx.cellmainWidth = placeholder.clientWidth - ctx.rowHeaderWidth;

  canvas.style.width = `${ctx.luckysheetTableContentHW[0]}px`;
  canvas.style.height = `${ctx.luckysheetTableContentHW[1]}px`;

  canvas.width = Math.ceil(
    ctx.luckysheetTableContentHW[0] * ctx.devicePixelRatio
  );
  canvas.height = Math.ceil(
    ctx.luckysheetTableContentHW[1] * ctx.devicePixelRatio
  );
}
