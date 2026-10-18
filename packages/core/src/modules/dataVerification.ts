import _ from "lodash";
import { getLL } from "../i18n/runtime";
import { checkProtection } from "./protection";
import {
  colLocationByIndex,
  Context,
  getcellrange,
  getFlowdata,
  getRangeByTxt,
  getRangetxt,
  getSheetIndex,
  GlobalCache,
  isAllowEdit,
  iscelldata,
  isdatetime,
  isRealNull,
  isRealNum,
  jfrefreshgrid,
  mergeBorder,
  rowLocationByIndex,
  setCellValue,
  updateCell,
} from "..";
import { Cell, CellMatrix } from "../types";
import { dataToolsLocale } from "../locale/dataTools";
import { execfunction } from "./formula";
import { setEditMode } from "./editMode";
// eslint-disable-next-line import/no-cycle
import { normalizeSelection } from "./selection";
import { drawCornerMark } from "./cellMarks";
import { genarate } from "./format";
import { shiftFormula } from "./sort";
import { registerReferenceAdjuster, ReferenceAdjuster } from "./refAdjust";

export { dataToolsLocale, formatLocaleText } from "../locale/dataTools";
export type { DataToolsLocale } from "../locale/dataTools";

/*
 * Data validation (Excel's Data › Data Validation).
 *
 * Rules are stored per cell in `sheet.dataVerification["r_c"]`. A rule
 * applied to a range remembers the range's top-left cell as `anchor`, so
 * relative references in its formulas (custom formula, list source, bounds)
 * shift from cell to cell like in Excel.
 */

export type DataVerificationType =
  | "any"
  | "dropdown"
  | "checkbox"
  | "number"
  | "number_integer"
  | "number_decimal"
  | "text_content"
  | "text_length"
  | "date"
  | "time"
  | "custom"
  | "validity";

export type DataVerificationErrorStyle = "stop" | "warning" | "information";

export type DataVerificationItem = {
  type: DataVerificationType | string;
  /** operator; "true" marks a multi-select list */
  type2: string;
  value1: string;
  value2: string;
  rangeTxt?: string;
  validity?: string;
  remote?: boolean;
  checked?: boolean;
  /** show an error alert on invalid input ("Stop" blocks it) */
  prohibitInput: boolean;
  /** show the input message when the cell is selected */
  hintShow: boolean;
  hintValue: string;
  hintTitle?: string;
  errorStyle?: DataVerificationErrorStyle;
  errorTitle?: string;
  errorMessage?: string;
  /** blanks are valid (default true) */
  ignoreBlank?: boolean;
  /** list: show the dropdown arrow (default true) */
  showDropdown?: boolean;
  /**
   * list: draw the arrow in every cell of the rule, not only in the active
   * one, so the cells read as choices before they are clicked (default false)
   */
  arrowAlways?: boolean;
  /** grey text drawn while the cell is empty */
  placeholder?: string;
  /** top-left cell of the range the rule was applied to */
  anchor?: { r: number; c: number };
};

/** Operators on numbers, dates, times and lengths, as stored in `type2`. */
export const DATA_VERIFICATION_OPERATORS = [
  "between",
  "notBetween",
  "equal",
  "notEqualTo",
  "moreThanThe",
  "lessThan",
  "greaterOrEqualTo",
  "lessThanOrEqualTo",
];

const DATE_OPERATOR_ALIASES: Record<string, string> = {
  earlierThan: "lessThan",
  noEarlierThan: "greaterOrEqualTo",
  laterThan: "moreThanThe",
  noLaterThan: "lessThanOrEqualTo",
};

function escapeHtml(text: string) {
  return `${text ?? ""}`
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getSheetDV(ctx: Context, sheetId?: string) {
  const index = getSheetIndex(ctx, sheetId ?? ctx.currentSheetId);
  if (index == null) return null;
  return ctx.luckysheetfile[index]?.dataVerification ?? null;
}

/**
 * Keep each rule's anchor on its range's top-left cell when rows or columns
 * are inserted or deleted or cells move (the formulas themselves are
 * rewritten by refAdjust). Registered lazily to stay clear of module cycles.
 */
const adjustAnchors: ReferenceAdjuster = (ctx, change, api) => {
  if (change.type === "renameSheet" || change.type === "deleteSheet") return;
  ctx.luckysheetfile.forEach((file) => {
    const dv = file.dataVerification;
    if (!dv || file.id == null) return;
    const seen = new Set<any>();
    Object.keys(dv).forEach((key) => {
      const item = dv[key];
      const a = item?.anchor;
      if (!a || seen.has(item)) return;
      seen.add(item);
      const rect = api.adjustRange(
        { row: [a.r, a.r], column: [a.c, a.c] },
        file.id!
      );
      if (rect && (rect.row[0] !== a.r || rect.column[0] !== a.c)) {
        item.anchor = { r: rect.row[0], c: rect.column[0] };
      }
    });
  });
};

let anchorAdjusterInstalled = false;
function installAnchorAdjuster() {
  if (anchorAdjusterInstalled) return;
  anchorAdjusterInstalled = true;
  registerReferenceAdjuster("dataVerification.anchor", adjustAnchors);
}
Promise.resolve().then(installAnchorAdjuster);

/** The validation rule of a cell, if any. */
export function getDataVerificationItem(
  ctx: Context,
  r: number,
  c: number,
  sheetId?: string
): DataVerificationItem | null {
  return getSheetDV(ctx, sheetId)?.[`${r}_${c}`] ?? null;
}

/**
 * Evaluate a rule formula for cell (r, c). Relative references shift from
 * the rule's anchor. Safe on frozen (immer) contexts: evaluation runs on a
 * shallow copy. Returns the value, or an error string such as "#VALUE!".
 */
export function evaluateDataVerificationFormula(
  ctx: Context,
  formula: string,
  r: number,
  c: number,
  anchor?: { r: number; c: number } | null
): any {
  let f = `${formula ?? ""}`.trim();
  if (f === "") return null;
  if (!f.startsWith("=")) f = `=${f}`;
  try {
    if (anchor && (r !== anchor.r || c !== anchor.c)) {
      f = shiftFormula(ctx, f, r - anchor.r, c - anchor.c);
    }
    const evalCtx = Object.isFrozen(ctx) ? ({ ...ctx } as Context) : ctx;
    const res = execfunction(
      evalCtx,
      f,
      r,
      c,
      undefined,
      undefined,
      false,
      true
    );
    return res[1];
  } catch (e) {
    return "#VALUE!";
  }
}

function isErrorString(v: any) {
  return (
    typeof v === "string" &&
    /^#(NULL!|DIV\/0!|VALUE!|REF!|NAME\?|NUM!|N\/A|SPILL!|CALC!|GETTING_DATA)$/.test(
      v
    )
  );
}

type ListSource = { display: string[]; raw: any[] };

function cellDisplay(cell: Cell | null | undefined): string | null {
  if (cell == null) return null;
  if (cell.ct?.t === "inlineStr") {
    return (cell.ct.s || []).map((s: any) => s?.v ?? "").join("");
  }
  const v = cell.m ?? cell.v;
  if (v == null || v === "") return null;
  return `${v}`;
}

/**
 * The items of a list rule: a literal "a,b,c", a range ("A1:A5",
 * "=$A$1:$A$5", "=Sheet2!A1:A5") or a formula / defined name ("=MyList").
 */
export function getDataVerificationListSource(
  ctx: Context,
  txt: string,
  r?: number,
  c?: number,
  anchor?: { r: number; c: number } | null
): ListSource {
  const out: ListSource = { display: [], raw: [] };
  const add = (display: string, raw: any) => {
    if (display === "" || out.display.includes(display)) return;
    out.display.push(display);
    out.raw.push(raw);
  };
  const source = `${txt ?? ""}`.trim();
  if (source === "") return out;
  const isFormula = source.startsWith("=");
  let refText = isFormula ? source.slice(1).trim() : source;
  if (iscelldata(refText)) {
    if (
      anchor &&
      r != null &&
      c != null &&
      (r !== anchor.r || c !== anchor.c)
    ) {
      refText = shiftFormula(ctx, `=${refText}`, r - anchor.r, c - anchor.c)
        .slice(1)
        .trim();
    }
    const range = getcellrange(ctx, refText);
    if (!range) return out;
    const index = getSheetIndex(ctx, range.sheetId || ctx.currentSheetId);
    const d = index == null ? null : ctx.luckysheetfile[index].data;
    if (!d) return out;
    const lastRow = Math.min(range.row[1], d.length - 1);
    for (let rr = range.row[0]; rr <= lastRow; rr += 1) {
      for (let cc = range.column[0]; cc <= range.column[1]; cc += 1) {
        const cell = d[rr]?.[cc];
        const display = cellDisplay(cell);
        if (display != null) add(display, cell?.v);
      }
    }
    return out;
  }
  // a bare defined name (as xlsx imports store it) is a formula too
  const bareName =
    !isFormula &&
    /^[A-Za-z_\\][A-Za-z0-9_.\\]*$/.test(source) &&
    !isErrorString(
      evaluateDataVerificationFormula(ctx, `=${source}`, r ?? 0, c ?? 0)
    );
  if (isFormula || bareName) {
    const v = evaluateDataVerificationFormula(
      ctx,
      isFormula ? source : `=${source}`,
      r ?? 0,
      c ?? 0,
      anchor
    );
    const values = Array.isArray(v) ? _.flattenDeep(v) : [v];
    values.forEach((x) => {
      if (x == null || isErrorString(x)) return;
      add(`${typeof x === "boolean" ? `${x}`.toUpperCase() : x}`, x);
    });
    return out;
  }
  source.split(",").forEach((item) => {
    const t = item.trim();
    add(t, t);
  });
  return out;
}

/** "A1:B5" → "$A$1:$B$5" (sheet prefixes kept), for picked list sources. */
export function toAbsoluteReference(txt: string) {
  return `${txt ?? ""}`
    .split(",")
    .map((part) => {
      const bang = part.lastIndexOf("!");
      const sheet = bang >= 0 ? part.slice(0, bang + 1) : "";
      const ref = bang >= 0 ? part.slice(bang + 1) : part;
      return sheet + ref.replace(/\$?([A-Za-z]+)\$?(\d+)/g, "$$$1$$$2");
    })
    .join(",");
}

/** The items a list rule offers, as shown in the dropdown. */
export function getDropdownList(
  ctx: Context,
  txt: string,
  r?: number,
  c?: number,
  anchor?: { r: number; c: number } | null
) {
  return getDataVerificationListSource(ctx, txt, r, c, anchor).display as (
    | string
    | number
    | boolean
  )[];
}

// TODO: 后期增加鼠标可以选择多个选区
// 开启范围选区
// TODO: 后期增加鼠标可以选择多个选区
// 开启范围选区
export function dataRangeSelection(
  ctx: Context,
  cache: GlobalCache,
  rangT: string,
  type: string,
  value: string
) {
  ctx.rangeDialog!.show = true;
  ctx.rangeDialog!.type = type;
  ctx.rangeDialog!.rangeTxt = value;
  if (ctx.luckysheet_select_save && !!rangT) {
    const last =
      ctx.luckysheet_select_save[ctx.luckysheet_select_save.length - 1];
    const row_index = last.row_focus as number;
    const col_index = last.column_focus as number;
    ctx.luckysheetCellUpdate = [row_index, col_index];

    const range = getRangeByTxt(ctx, rangT);
    const r = range[0]?.row;
    const c = range[0]?.column;
    if (_.isNil(r) || _.isNil(c)) return;
    const row_pre = rowLocationByIndex(r[0], ctx.visibledatarow)[0];
    const row = rowLocationByIndex(r[1], ctx.visibledatarow)[1];
    const col_pre = colLocationByIndex(c[0], ctx.visibledatacolumn)[0];
    const col = colLocationByIndex(c[1], ctx.visibledatacolumn)[1];

    ctx.formulaRangeSelect = {
      height: row - row_pre - 1,
      left: col_pre,
      rangeIndex: ctx.formulaRangeSelect?.rangeIndex ?? 0,
      top: row_pre,
      width: col - col_pre - 1,
    };
  } else {
    ctx.luckysheetCellUpdate = [0, 0];
  }

  // cache.doNotUpdateCell = true;
  // ctx.formulaCache.rangestart = true;
  // ctx.formulaCache.rangedrag_column_start = false;
  // ctx.formulaCache.rangedrag_row_start = false;
  // ctx.formulaCache.rangechangeindex = 0;
}

// 身份证
// 身份证
export function validateIdCard(ctx: Context, idCard: string) {
  // 15位和18位身份证号码的正则表达式
  const regIdCard =
    /^(^[1-9]\d{7}((0\d)|(1[0-2]))(([0|1|2]\d)|3[0-1])\d{3}$)|(^[1-9]\d{5}[1-9]\d{3}((0\d)|(1[0-2]))(([0|1|2]\d)|3[0-1])((\d{4})|\d{3}[Xx])$)$/;

  // 如果通过该验证，说明身份证格式正确，但准确性还需计算
  if (regIdCard.test(idCard)) {
    if (idCard.length === 18) {
      const idCardWi = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2]; // 将前17位加权因子保存在数组里
      const idCardY = [1, 0, 10, 9, 8, 7, 6, 5, 4, 3, 2]; // 这是除以11后，可能产生的11位余数、验证码，也保存成数组
      let idCardWiSum = 0; // 用来保存前17位各自乖以加权因子后的总和
      for (let i = 0; i < 17; i += 1) {
        idCardWiSum += Number(idCard.substring(i, i + 1)) * idCardWi[i];
      }

      const idCardMod = idCardWiSum % 11; // 计算出校验码所在数组的位置
      const idCardLast = idCard.substring(17); // 得到最后一位身份证号码

      // 如果等于2，则说明校验码是10，身份证号码最后一位应该是X
      if (idCardMod === 2) {
        if (idCardLast === "X" || idCardLast === "x") {
          return true;
        }
        return false;
      }
      // 用计算出的验证码与最后一位身份证号码匹配，如果一致，说明通过，否则是无效的身份证号码
      if (idCardLast === idCardY[idCardMod].toString()) {
        return true;
      }
      return false;
    }
  } else {
    return false;
  }
  return false;
}

function toNumberValue(v: any): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "boolean" || v == null) return null;
  const str = `${v}`.trim();
  if (str === "") return null;
  if (isRealNum(str)) return Number(str);
  const parsed = genarate(str);
  if (parsed && typeof parsed[2] === "number") return parsed[2];
  return null;
}

/** A bound (value1/value2) as a number: literal, date/time text or formula. */
function resolveBound(
  ctx: Context,
  bound: any,
  r: number | undefined,
  c: number | undefined,
  anchor: { r: number; c: number } | null | undefined
): number | null {
  const str = `${bound ?? ""}`.trim();
  if (str.startsWith("=")) {
    if (r == null || c == null) return null;
    return toNumberValue(
      evaluateDataVerificationFormula(ctx, str, r, c, anchor)
    );
  }
  return toNumberValue(str);
}

function compareWithOperator(
  op: string,
  v: number,
  b1: number | null,
  b2: number | null
): boolean {
  const o = DATE_OPERATOR_ALIASES[op] ?? op;
  const eps = 1e-9;
  if (b1 == null) return true; // nothing to compare with
  switch (o) {
    case "between":
      return b2 == null ? v >= b1 - eps : v >= b1 - eps && v <= b2 + eps;
    case "notBetween":
      return b2 == null ? v < b1 - eps : v < b1 - eps || v > b2 + eps;
    case "equal":
      return Math.abs(v - b1) <= eps;
    case "notEqualTo":
      return Math.abs(v - b1) > eps;
    case "moreThanThe":
      return v > b1 + eps;
    case "lessThan":
      return v < b1 - eps;
    case "greaterOrEqualTo":
      return v >= b1 - eps;
    case "lessThanOrEqualTo":
      return v <= b1 + eps;
    default:
      return true;
  }
}

function isBlankValue(v: any) {
  return isRealNull(v) || v === "";
}

/**
 * Is `cellValue` valid under a rule? `r`/`c` (the cell) are needed for
 * custom formulas and formula bounds; without them those checks pass.
 */
export function validateCellData(
  ctx: Context,
  item: any,
  cellValue: any,
  r?: number,
  c?: number
): boolean {
  if (item == null) return true;
  const { type, type2 } = item;
  const anchor = item.anchor ?? null;
  if (type === "any" || type === "checkbox") return true;
  if (isBlankValue(cellValue)) return item.ignoreBlank !== false;
  if (isErrorString(cellValue) && type !== "custom") return false;

  if (type === "dropdown") {
    const { display, raw } = getDataVerificationListSource(
      ctx,
      item.value1,
      r,
      c,
      anchor
    );
    const allowed = new Set<string>();
    display.forEach((d) => allowed.add(d.toLowerCase()));
    raw.forEach((v) => {
      if (v != null) allowed.add(`${v}`.toLowerCase());
    });
    const has = (v: any) => allowed.has(`${v}`.trim().toLowerCase());
    if (type2 === "true" && typeof cellValue === "string") {
      return cellValue
        .split(",")
        .filter((s) => s !== "")
        .every(has);
    }
    return has(cellValue);
  }

  if (
    type === "number" ||
    type === "number_integer" ||
    type === "number_decimal" ||
    type === "date" ||
    type === "time"
  ) {
    const v = toNumberValue(cellValue);
    if (v == null) return false;
    if (type === "number_integer" && Math.abs(v - Math.round(v)) > 1e-9) {
      return false;
    }
    const b1 = resolveBound(ctx, item.value1, r, c, anchor);
    const b2 = resolveBound(ctx, item.value2, r, c, anchor);
    return compareWithOperator(type2, v, b1, b2);
  }

  if (type === "text_length") {
    const len = `${cellValue}`.length;
    const b1 = resolveBound(ctx, item.value1, r, c, anchor);
    const b2 = resolveBound(ctx, item.value2, r, c, anchor);
    return compareWithOperator(type2, len, b1, b2);
  }

  if (type === "custom") {
    if (r == null || c == null) return true;
    const res = evaluateDataVerificationFormula(ctx, item.value1, r, c, anchor);
    if (Array.isArray(res)) {
      const first = _.flattenDeep(res)[0];
      return first === true || (typeof first === "number" && first !== 0);
    }
    return res === true || (typeof res === "number" && res !== 0);
  }

  if (type === "text_content") {
    const text = `${cellValue}`;
    const value1 = `${item.value1 ?? ""}`;
    if (type2 === "include") return text.indexOf(value1) > -1;
    if (type2 === "exclude") return text.indexOf(value1) === -1;
    if (type2 === "equal") return text === value1;
    return true;
  }

  if (type === "validity") {
    if (type2 === "identificationNumber") {
      // eslint-disable-next-line no-use-before-define
      return validateIdCard(ctx, `${cellValue}`);
    }
    if (type2 === "phoneNumber")
      return /^1[3456789]\d{9}$/.test(`${cellValue}`);
  }
  return true;
}

/** The value a cell shows to validation (formula results included). */
function validationValue(cell: Cell | null | undefined) {
  if (cell == null) return null;
  if (cell.ct?.t === "inlineStr") {
    return (cell.ct.s || []).map((s: any) => s?.v ?? "").join("");
  }
  return cell.v ?? null;
}

/** Is cell (r, c) of a sheet valid under its rule (true without a rule)? */
export function isCellDataValid(
  ctx: Context,
  r: number,
  c: number,
  sheetId?: string
): boolean {
  const item = getDataVerificationItem(ctx, r, c, sheetId);
  if (!item) return true;
  const index = getSheetIndex(ctx, sheetId ?? ctx.currentSheetId);
  const data =
    index == null ? null : (ctx.luckysheetfile[index].data as CellMatrix);
  return validateCellData(ctx, item, validationValue(data?.[r]?.[c]), r, c);
}

/** Every cell of a sheet whose value breaks its validation rule. */
export function getInvalidDataCells(
  ctx: Context,
  sheetId?: string
): { r: number; c: number }[] {
  const dv = getSheetDV(ctx, sheetId);
  if (!dv) return [];
  const out: { r: number; c: number }[] = [];
  Object.keys(dv).forEach((key) => {
    const [r, c] = key.split("_").map(Number);
    if (!isCellDataValid(ctx, r, c, sheetId)) out.push({ r, c });
  });
  return out.sort((a, b) => a.r - b.r || a.c - b.c);
}

/** Data › Data Validation › Circle Invalid Data / Clear Validation Circles. */
export function setInvalidDataCircles(
  ctx: Context,
  show: boolean,
  sheetId?: string
) {
  const id = sheetId ?? ctx.currentSheetId;
  const circles = { ...(ctx.dataVerificationCircles || {}) };
  if (show) circles[id] = true;
  else delete circles[id];
  ctx.dataVerificationCircles = circles;
}

export function isShowingInvalidDataCircles(ctx: Context, sheetId?: string) {
  return !!ctx.dataVerificationCircles?.[sheetId ?? ctx.currentSheetId];
}

/**
 * Canvas hook: draw the invalid-data marker (and Excel's red circle when
 * circles are on) for a cell. `rect` is the cell's box on the canvas.
 */
export function drawDataVerificationMarks(
  ctx: Context,
  renderCtx: CanvasRenderingContext2D,
  r: number,
  c: number,
  value: any,
  rect: { x: number; y: number; w: number; h: number },
  color: string
) {
  const item = getDataVerificationItem(ctx, r, c);
  if (!item) return;
  if (isBlankValue(value) && item.ignoreBlank !== false) return;
  if (validateCellData(ctx, item, value, r, c)) return;
  const zoom = ctx.zoomRatio || 1;
  // the small triangle in the top-left corner
  drawCornerMark(renderCtx, "tl", rect.x, rect.y, rect.w, 6 * zoom, color);
  if (!isShowingInvalidDataCircles(ctx)) return;
  renderCtx.save();
  renderCtx.beginPath();
  renderCtx.strokeStyle = color;
  renderCtx.lineWidth = Math.max(1, 1.5 * zoom);
  renderCtx.ellipse(
    rect.x + rect.w / 2,
    rect.y + rect.h / 2,
    Math.max(rect.w / 2 - 1, 2),
    Math.max(rect.h / 2 - 1.5, 2),
    0,
    0,
    Math.PI * 2
  );
  renderCtx.stroke();
  renderCtx.closePath();
  renderCtx.restore();
}

/**
 * Canvas hook: the chevron of a list cell whose rule has `arrowAlways`, so every
 * cell offering a choice looks like one (the active cell also gets the button).
 */
export function drawDropdownArrow(
  ctx: Context,
  renderCtx: CanvasRenderingContext2D,
  r: number,
  c: number,
  rect: { x: number; y: number; w: number; h: number },
  color: string
) {
  const item = getDataVerificationItem(ctx, r, c);
  if (
    !item ||
    item.type !== "dropdown" ||
    !item.arrowAlways ||
    item.showDropdown === false
  )
    return;
  const zoom = ctx.zoomRatio || 1;
  const half = 3.5 * zoom;
  if (rect.w < half * 6) return;
  const cx = rect.x + rect.w - 9 * zoom;
  const cy = rect.y + rect.h / 2;
  renderCtx.save();
  renderCtx.beginPath();
  renderCtx.moveTo(cx - half, cy - half / 2);
  renderCtx.lineTo(cx, cy + half / 2);
  renderCtx.lineTo(cx + half, cy - half / 2);
  renderCtx.lineWidth = Math.max(1, 1.25 * zoom);
  renderCtx.lineCap = "round";
  renderCtx.lineJoin = "round";
  renderCtx.strokeStyle = color;
  renderCtx.stroke();
  renderCtx.restore();
}

/** Canvas hook: draw a cell's placeholder text while it is empty. */
export function drawCellPlaceholder(
  ctx: Context,
  renderCtx: CanvasRenderingContext2D,
  r: number,
  c: number,
  rect: { x: number; y: number; w: number; h: number },
  color: string
) {
  const text = getDataVerificationItem(ctx, r, c)?.placeholder;
  if (!text) return;
  const zoom = ctx.zoomRatio || 1;
  const fontSize = Math.round((ctx.defaultFontSize || 10) * zoom * (4 / 3));
  renderCtx.save();
  renderCtx.beginPath();
  renderCtx.rect(rect.x, rect.y, rect.w, rect.h);
  renderCtx.clip();
  renderCtx.font = `italic ${fontSize}px Arial`;
  renderCtx.fillStyle = color;
  renderCtx.textBaseline = "middle";
  renderCtx.fillText(text, rect.x + 4 * zoom, rect.y + rect.h / 2);
  renderCtx.restore();
}

/* ------------------------------------------------------------------ */
/* Rules as ranges (for the sidebar and the API)                        */
/* ------------------------------------------------------------------ */

export type DataVerificationRule = {
  /** stable id: the rule's settings */
  id: string;
  item: DataVerificationItem;
  ranges: { row: [number, number]; column: [number, number] }[];
  cellCount: number;
};

function ruleKey(item: any) {
  return JSON.stringify(_.omit(item, ["checked", "rangeTxt"]));
}

/** Split a set of cells into rectangles (rows first, greedy). */
export function cellsToValidationRanges(cells: { r: number; c: number }[]) {
  const set = new Set(cells.map(({ r, c }) => `${r}_${c}`));
  const sorted = cells.slice().sort((a, b) => a.r - b.r || a.c - b.c);
  const ranges: { row: [number, number]; column: [number, number] }[] = [];
  sorted.forEach(({ r, c }) => {
    if (!set.has(`${r}_${c}`)) return;
    let c2 = c;
    while (set.has(`${r}_${c2 + 1}`)) c2 += 1;
    let r2 = r;
    const rowFull = (rr: number) => {
      for (let cc = c; cc <= c2; cc += 1) {
        if (!set.has(`${rr}_${cc}`)) return false;
      }
      return true;
    };
    while (rowFull(r2 + 1)) r2 += 1;
    for (let rr = r; rr <= r2; rr += 1) {
      for (let cc = c; cc <= c2; cc += 1) set.delete(`${rr}_${cc}`);
    }
    ranges.push({ row: [r, r2], column: [c, c2] });
  });
  return ranges;
}

/** The sheet's validation rules, grouping cells that share settings. */
export function getDataVerificationRules(
  ctx: Context,
  sheetId?: string
): DataVerificationRule[] {
  const dv = getSheetDV(ctx, sheetId);
  if (!dv) return [];
  const groups = new Map<
    string,
    { item: any; cells: { r: number; c: number }[] }
  >();
  Object.keys(dv).forEach((key) => {
    const item = dv[key];
    if (item == null) return;
    const [r, c] = key.split("_").map(Number);
    const k = ruleKey(item);
    if (!groups.has(k)) groups.set(k, { item, cells: [] });
    groups.get(k)!.cells.push({ r, c });
  });
  const rules: DataVerificationRule[] = [];
  groups.forEach(({ item, cells }, id) => {
    const ranges = cellsToValidationRanges(cells);
    rules.push({ id, item, ranges, cellCount: cells.length });
  });
  return rules.sort(
    (a, b) =>
      a.ranges[0].row[0] - b.ranges[0].row[0] ||
      a.ranges[0].column[0] - b.ranges[0].column[0]
  );
}

/** A one-line description of a rule, e.g. "Whole number between 1 - 10". */
export function describeDataVerificationRule(
  ctx: Context,
  item: DataVerificationItem
): string {
  const t = dataToolsLocale(ctx).dataValidation;
  const typeName = t.types[item.type] ?? `${item.type}`;
  const op = DATE_OPERATOR_ALIASES[item.type2] ?? item.type2;
  switch (item.type) {
    case "dropdown":
    case "custom":
      return `${typeName}: ${item.value1}`;
    case "checkbox":
      return `${typeName}: ${item.value1} / ${item.value2}`;
    case "number":
    case "number_integer":
    case "number_decimal":
    case "date":
    case "time":
    case "text_length": {
      const opText = t.operators[op] ?? op;
      const two = op === "between" || op === "notBetween";
      return `${typeName} ${opText} ${item.value1}${
        two ? ` - ${item.value2}` : ""
      }`;
    }
    case "text_content": {
      const labels = t.textOperators;
      return `${typeName}: ${labels[item.type2] ?? item.type2} "${
        item.value1
      }"`;
    }
    default:
      return typeName;
  }
}

/** "A1:B3,D1" for a list of ranges on the current sheet. */
export function rangesToText(
  ctx: Context,
  ranges: { row: number[]; column: number[] }[]
) {
  return ranges
    .map((rg) =>
      getRangetxt(ctx, ctx.currentSheetId, rg as any, ctx.currentSheetId)
    )
    .join(",");
}

type RangeArg = { row: number[]; column: number[] }[] | string;

type RangeLike = { row: number[]; column: number[] };

function toRanges(ctx: Context, ranges: RangeArg): RangeLike[] {
  const list: (RangeLike | null | undefined)[] =
    typeof ranges === "string"
      ? ranges
          .split(",")
          .map((t) => t.trim())
          .filter((t) => t !== "")
          .flatMap((t) => getRangeByTxt(ctx, t) as RangeLike[])
      : ranges;
  return list.filter(
    (rg): rg is RangeLike => rg?.row != null && rg?.column != null
  );
}

/**
 * Apply a rule to one or more ranges (replacing their rules). The first
 * range's top-left cell becomes the rule's anchor.
 */
export function setDataVerification(
  ctx: Context,
  ranges: RangeArg,
  item: Partial<DataVerificationItem>,
  sheetId?: string
) {
  if (!checkProtection(ctx, "protected", null, sheetId)) return;
  installAnchorAdjuster();
  const list = toRanges(ctx, ranges);
  if (list.length === 0) return;
  const index = getSheetIndex(ctx, sheetId ?? ctx.currentSheetId);
  if (index == null) return;
  const file = ctx.luckysheetfile[index];
  const dv = { ...(file.dataVerification || {}) };
  const rule: DataVerificationItem = {
    type: "any",
    type2: "",
    value1: "",
    value2: "",
    prohibitInput: false,
    hintShow: false,
    hintValue: "",
    ...item,
    anchor: { r: list[0].row[0], c: list[0].column[0] },
  } as DataVerificationItem;
  delete rule.rangeTxt;
  delete rule.checked;
  const data = file.data as CellMatrix | undefined;
  list.forEach((rg) => {
    for (let r = rg.row[0]; r <= rg.row[1]; r += 1) {
      for (let c = rg.column[0]; c <= rg.column[1]; c += 1) {
        dv[`${r}_${c}`] =
          rule.type === "checkbox" ? { ...rule, checked: false } : { ...rule };
        if (rule.type === "checkbox" && data) {
          setCellValue(ctx, r, c, data, rule.value2);
        }
      }
    }
  });
  file.dataVerification = dv;
}

/** Remove the validation rules of one or more ranges. */
export function removeDataVerification(
  ctx: Context,
  ranges: RangeArg,
  sheetId?: string
) {
  if (!checkProtection(ctx, "protected", null, sheetId)) return;
  const index = getSheetIndex(ctx, sheetId ?? ctx.currentSheetId);
  if (index == null) return;
  const file = ctx.luckysheetfile[index];
  if (!file.dataVerification) return;
  const dv = { ...file.dataVerification };
  toRanges(ctx, ranges).forEach((rg) => {
    for (let r = rg.row[0]; r <= rg.row[1]; r += 1) {
      for (let c = rg.column[0]; c <= rg.column[1]; c += 1) {
        delete dv[`${r}_${c}`];
      }
    }
  });
  file.dataVerification = dv;
}

/** Delete a whole rule (all its cells) by its id from getDataVerificationRules. */
export function deleteDataVerificationRule(
  ctx: Context,
  ruleId: string,
  sheetId?: string
) {
  if (!checkProtection(ctx, "protected", null, sheetId)) return;
  const rule = getDataVerificationRules(ctx, sheetId).find(
    (x) => x.id === ruleId
  );
  if (rule) removeDataVerification(ctx, rule.ranges, sheetId);
}

/**
 * Give cells a placeholder (grey text shown while empty). Cells without a
 * rule get an "Any value" rule carrying it; empty text removes it.
 */
export function setCellPlaceholder(
  ctx: Context,
  ranges: RangeArg,
  text: string,
  sheetId?: string
) {
  const index = getSheetIndex(ctx, sheetId ?? ctx.currentSheetId);
  if (index == null) return;
  const file = ctx.luckysheetfile[index];
  const dv = { ...(file.dataVerification || {}) };
  const list = toRanges(ctx, ranges);
  const anchor = list[0] ? { r: list[0].row[0], c: list[0].column[0] } : null;
  const blank: DataVerificationItem = {
    type: "any",
    type2: "",
    value1: "",
    value2: "",
    prohibitInput: false,
    hintShow: false,
    hintValue: "",
    anchor: anchor ?? undefined,
  };
  list.forEach((rg) => {
    for (let r = rg.row[0]; r <= rg.row[1]; r += 1) {
      for (let c = rg.column[0]; c <= rg.column[1]; c += 1) {
        const key = `${r}_${c}`;
        const prev = dv[key];
        if (text) {
          dv[key] = { ...(prev ?? blank), placeholder: text };
        } else if (prev) {
          const next = _.omit(prev, ["placeholder"]);
          if (next.type === "any" && !next.hintShow) delete dv[key];
          else dv[key] = next;
        }
      }
    }
  });
  file.dataVerification = dv;
}

/* ------------------------------------------------------------------ */
/* Error alert on input                                                 */
/* ------------------------------------------------------------------ */

export type DataVerificationAlert = {
  sheetId: string;
  r: number;
  c: number;
  value: string;
  style: DataVerificationErrorStyle;
  title: string;
  message: string;
};

let bypassKey: string | null = null;

// getFailureText is defined further down (with the per-language texts)
function describeFailure(ctx: Context, item: any): string {
  // eslint-disable-next-line no-use-before-define
  const text = getFailureText(ctx, item);
  // sentence case for the alert ("What you entered ...")
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

/**
 * Called by updateCell before committing typed input. Returns false when
 * the input must not be committed now; `ctx.dataVerificationAlert` then
 * describes the error alert to show (Stop, Warning or Information).
 */
export function checkDataVerificationInput(
  ctx: Context,
  r: number,
  c: number,
  value: any
): boolean {
  const item = getDataVerificationItem(ctx, r, c);
  if (!item || !item.prohibitInput) return true;
  const key = `${ctx.currentSheetId}_${r}_${c}`;
  if (bypassKey === key) return true;
  let checked = value;
  if (typeof value === "string" && value.startsWith("=") && value.length > 1) {
    checked = evaluateDataVerificationFormula(ctx, value, r, c, null);
  }
  if (validateCellData(ctx, item, checked, r, c)) return true;
  const locale = dataToolsLocale(ctx).dataValidation;
  ctx.dataVerificationAlert = {
    sheetId: ctx.currentSheetId,
    r,
    c,
    value: value == null ? "" : `${value}`,
    style: item.errorStyle ?? "stop",
    title: item.errorTitle || locale.invalidTitle,
    message:
      item.errorMessage || describeFailure(ctx, item) || locale.defaultError,
  };
  return false;
}

/**
 * "Yes" (Warning) or "OK" (Information): commit the value the alert was
 * raised for, without validating it again.
 */
export function acceptDataVerificationAlert(ctx: Context) {
  const alert = ctx.dataVerificationAlert;
  ctx.dataVerificationAlert = undefined;
  if (!alert || alert.sheetId !== ctx.currentSheetId) return;
  bypassKey = `${alert.sheetId}_${alert.r}_${alert.c}`;
  try {
    const $input = { innerText: alert.value, innerHTML: alert.value };
    updateCell(ctx, alert.r, alert.c, $input as any, alert.value);
  } finally {
    bypassKey = null;
  }
}

/** "Cancel" / "No" / "Retry": drop the value and keep the old one. */
export function dismissDataVerificationAlert(ctx: Context) {
  const alert = ctx.dataVerificationAlert;
  ctx.dataVerificationAlert = undefined;
  if (!alert || alert.sheetId !== ctx.currentSheetId) return;
  // with its pixel geometry, which the selection box and the editor use
  ctx.luckysheet_select_save = normalizeSelection(ctx, [
    {
      row: [alert.r, alert.r],
      column: [alert.c, alert.c],
      row_focus: alert.r,
      column_focus: alert.c,
    },
  ]);
}

/**
 * "Retry" (Stop alert): back to editing the cell, in Edit mode, with the
 * rejected text. Returns that text for the editor, or null when there is
 * nothing to retry (no alert, or it belongs to another sheet).
 */
export function retryDataVerificationAlert(ctx: Context): string | null {
  const alert = ctx.dataVerificationAlert;
  dismissDataVerificationAlert(ctx);
  if (!alert || alert.sheetId !== ctx.currentSheetId) return null;
  ctx.luckysheetCellUpdate = [alert.r, alert.c];
  setEditMode(ctx, "edit");
  return alert.value;
}

// 复选框处理
// 复选框处理
export function checkboxChange(ctx: Context, r: number, c: number) {
  const index = getSheetIndex(ctx, ctx.currentSheetId) as number;
  // let historyDataVerification = $.extend(true, {}, _this.dataVerification);
  const currentDataVerification =
    ctx.luckysheetfile[index].dataVerification ?? {};
  const item = currentDataVerification[`${r}_${c}`];
  item.checked = !item.checked;
  let value = item.value2;
  if (item.checked) {
    value = item.value1;
  }
  const d = getFlowdata(ctx);
  setCellValue(ctx, r, c, d, value);
}

// 数据无效时的提示信息
// 数据无效时的提示信息
function validationDescription(ctx: Context, item: any) {
  const tools = dataToolsLocale(ctx).dataValidation;
  const op = DATE_OPERATOR_ALIASES[item.type2] ?? item.type2;
  const value =
    op === "between" || op === "notBetween"
      ? `${item.value1} - ${item.value2}`
      : `${item.value1 ?? ""}`;
  return {
    type: tools.types[item.type] ?? item.type,
    op: tools.operators[op] ?? tools.textOperators[op] ?? op ?? "",
    value,
  };
}

export function getFailureText(ctx: Context, item: any) {
  const LL = getLL(ctx.lang).dataTools.dataValidation;
  if (item.type === "any" || item.type === "checkbox") return "";
  if (item.type === "dropdown") return LL.dropdownFailure();
  if (item.type === "custom")
    return LL.customFailure({ formula: `${item.value1}` });
  const description = validationDescription(ctx, item);
  if (item.type === "time") return LL.timeFailure(description);
  return LL.valueFailure(description);
}

export function getHintText(ctx: Context, item: any) {
  if (item.hintValue) return item.hintValue;
  const LL = getLL(ctx.lang).dataTools.dataValidation;
  if (item.type === "any" || item.type === "checkbox") return "";
  if (item.type === "dropdown") return LL.dropdownHint();
  return LL.inputHint(validationDescription(ctx, item));
}

// 单元格聚焦处理: dropdown arrow, input message and invalid-value hint
export function cellFocus(
  ctx: Context,
  r: number,
  c: number,
  clickMode: boolean
) {
  const allowEdit = isAllowEdit(ctx);
  if (!allowEdit) return;
  const showHintBox = document.getElementById(
    "luckysheet-dataVerification-showHintBox"
  );
  const dropDownBtn = document.getElementById(
    "luckysheet-dataVerification-dropdown-btn"
  );
  ctx.dataVerificationDropDownList = false;
  if (!showHintBox || !dropDownBtn) return;
  showHintBox.style.display = "none";
  dropDownBtn.style.display = "none";
  const index = getSheetIndex(ctx, ctx.currentSheetId) as number;
  const { dataVerification } = ctx.luckysheetfile[index];
  if (!dataVerification) return;
  let row = ctx.visibledatarow[r];
  let row_pre = r === 0 ? 0 : ctx.visibledatarow[r - 1];
  let col = ctx.visibledatacolumn[c];
  let col_pre = c === 0 ? 0 : ctx.visibledatacolumn[c - 1];
  const d = getFlowdata(ctx);
  if (!d) return;
  const margeSet = mergeBorder(ctx, d, r, c);
  if (margeSet) {
    [row_pre, row] = margeSet.row;
    [col_pre, col] = margeSet.column;
  }
  const item = dataVerification[`${r}_${c}`];
  if (!item) return;

  // 单元格数据验证 类型是 复选
  if (clickMode && item.type === "checkbox") {
    // eslint-disable-next-line no-use-before-define
    checkboxChange(ctx, r, c);
  }

  // 单元格数据验证 类型是 下拉列表
  if (item.type === "dropdown" && item.showDropdown !== false) {
    dropDownBtn.style.display = "block";
    dropDownBtn.style.maxWidth = `${col - col_pre}px`;
    dropDownBtn.style.maxHeight = `${row - row_pre}px`;
    dropDownBtn.style.left = `${col - 20}px`;
    dropDownBtn.style.top = `${row_pre + (row - row_pre - 20) / 2 - 2}px`;
  }

  const showBox = (html: string, kind: string) => {
    showHintBox.innerHTML = html;
    showHintBox.dataset.kind = kind;
    showHintBox.style.display = "block";
    showHintBox.style.left = `${col_pre}px`;
    showHintBox.style.top = `${row}px`;
  };

  // input message: bold title over the message, like Excel
  if (item.hintShow) {
    // promptTitle: the name xlsx import/export uses
    const hintTitle = item.hintTitle ?? item.promptTitle;
    const title = hintTitle
      ? `<div class="fortune-dv-hint-title">${escapeHtml(hintTitle)}</div>`
      : "";
    let message = item.hintValue ? escapeHtml(item.hintValue) : "";
    if (!title && !message) {
      // eslint-disable-next-line no-use-before-define
      message = escapeHtml(getHintText(ctx, item));
    }
    if (title || message) {
      showBox(
        `${title}<div class="fortune-dv-hint-message">${message}</div>`,
        "hint"
      );
    }
  }

  // 数据验证未通过,失效提醒
  const cellValue = validationValue(d[r]?.[c]);
  if (isBlankValue(cellValue)) return;
  if (!validateCellData(ctx, item, cellValue, r, c)) {
    // eslint-disable-next-line no-use-before-define
    const failure = escapeHtml(getFailureText(ctx, item));
    if (failure) {
      showBox(
        `<div class="fortune-dv-hint-message fortune-dv-hint-invalid">${failure}</div>`,
        "invalid"
      );
    }
  }
}

// 设置下拉列表的值
export function setDropcownValue(ctx: Context, value: string, arr: any) {
  if (!ctx.luckysheet_select_save) return;
  const d = getFlowdata(ctx);
  if (!d) return;
  const last =
    ctx.luckysheet_select_save[ctx.luckysheet_select_save.length - 1];
  const rowIndex = last.row_focus;
  const colIndex = last.column_focus;
  if (rowIndex == null || colIndex == null) return;
  const index = getSheetIndex(ctx, ctx.currentSheetId) as number;
  const item =
    ctx.luckysheetfile[index].dataVerification[`${rowIndex}_${colIndex}`];
  if (item.type2 === "true") {
    const list = getDropdownList(
      ctx,
      item.value1,
      rowIndex,
      colIndex,
      item.anchor
    );
    value = list
      .map((v) => `${v}`)
      .filter((v: any) => arr.indexOf(v) >= 0)
      .join(",");
  } else {
    ctx.dataVerificationDropDownList = false;
  }
  setCellValue(ctx, rowIndex, colIndex, d, value);
  jfrefreshgrid(ctx, null, undefined);
}

function isFormulaText(v: any) {
  return typeof v === "string" && v.trim().startsWith("=");
}

function isNumberLike(v: any) {
  return isFormulaText(v) || (`${v ?? ""}`.trim() !== "" && isRealNum(v));
}

function isDateOrTimeLike(v: any) {
  if (isFormulaText(v)) return true;
  const str = `${v ?? ""}`.trim();
  if (str === "") return false;
  if (isdatetime(str) || isRealNum(str)) return true;
  const parsed = genarate(str);
  return !!parsed && typeof parsed[2] === "number";
}

// 输入数据验证: check the dialog's settings before applying them
export function confirmMessage(
  ctx: Context,
  generalDialog: any,
  dataVerification: any
): boolean {
  const regulation = ctx.dataVerification?.dataRegulation;
  if (!regulation) return false;
  const range = toRanges(ctx, `${regulation.rangeTxt ?? ""}`);
  if (range.length === 0) {
    ctx.warnDialog = generalDialog.noSeletionError;
    return false;
  }
  const d = getFlowdata(ctx);
  if (!d) return false;
  const tools = dataToolsLocale(ctx).dataValidation;
  const verifacationT = regulation.type;
  const { value1, value2, type2 } = regulation;
  const twoValues = type2 === "between" || type2 === "notBetween";
  const fail = (msg: string) => {
    ctx.warnDialog = msg;
    return false;
  };
  if (verifacationT === "dropdown") {
    if (!`${value1 ?? ""}`.trim()) return fail(dataVerification.tooltipInfo1);
  } else if (verifacationT === "checkbox") {
    if (!value1 || !value2) return fail(dataVerification.tooltipInfo2);
  } else if (
    verifacationT === "number" ||
    verifacationT === "number_integer" ||
    verifacationT === "number_decimal"
  ) {
    if (!isNumberLike(value1)) return fail(dataVerification.tooltipInfo3);
    if (twoValues) {
      if (!isNumberLike(value2)) return fail(dataVerification.tooltipInfo3);
      if (
        !isFormulaText(value1) &&
        !isFormulaText(value2) &&
        Number(value2) < Number(value1)
      ) {
        return fail(dataVerification.tooltipInfo4);
      }
    }
  } else if (verifacationT === "text_content") {
    if (!value1) return fail(dataVerification.tooltipInfo5);
  } else if (verifacationT === "text_length") {
    if (!isNumberLike(value1)) return fail(dataVerification.tooltipInfo3);
    if (
      !isFormulaText(value1) &&
      (!Number.isInteger(Number(value1)) || Number(value1) < 0)
    ) {
      return fail(dataVerification.textlengthInteger);
    }
    if (twoValues) {
      if (!isNumberLike(value2)) return fail(dataVerification.tooltipInfo3);
      if (
        !isFormulaText(value2) &&
        (!Number.isInteger(Number(value2)) || Number(value2) < 0)
      ) {
        return fail(dataVerification.textlengthInteger);
      }
      if (
        !isFormulaText(value1) &&
        !isFormulaText(value2) &&
        Number(value2) < Number(value1)
      ) {
        return fail(dataVerification.tooltipInfo4);
      }
    }
  } else if (verifacationT === "date" || verifacationT === "time") {
    const msg =
      verifacationT === "date"
        ? dataVerification.tooltipInfo6
        : tools.invalidValue;
    if (!isDateOrTimeLike(value1)) return fail(msg);
    if (twoValues) {
      if (!isDateOrTimeLike(value2)) return fail(msg);
      const a = toNumberValue(value1);
      const b = toNumberValue(value2);
      if (a != null && b != null && b < a) {
        return fail(
          verifacationT === "date"
            ? dataVerification.tooltipInfo7
            : dataVerification.tooltipInfo4
        );
      }
    }
  } else if (verifacationT === "custom") {
    if (!`${value1 ?? ""}`.trim()) return fail(tools.formulaEmpty);
  }
  return true;
}

/**
 * The dialog's OK: check and apply `ctx.dataVerification.dataRegulation`
 * to its ranges. When a rule is being edited (from the rules sidebar), its
 * old cells are cleared first.
 */
export function confirmDataVerification(
  ctx: Context,
  generalDialog: any,
  dataVerification: any
): boolean {
  if (!confirmMessage(ctx, generalDialog, dataVerification)) return false;
  const regulation = ctx.dataVerification!.dataRegulation! as any;
  const editing = ctx.dataVerification?.editingRuleId;
  if (editing) {
    deleteDataVerificationRule(ctx, editing);
    ctx.dataVerification!.editingRuleId = undefined;
  }
  const item = _.omit(regulation, ["rangeTxt", "checked", "anchor"]);
  // no error alert: no style either (exporters read errorStyle as "show")
  if (!item.prohibitInput) delete item.errorStyle;
  if (item.hintTitle) item.promptTitle = item.hintTitle;
  else delete item.promptTitle;
  if (item.type === "dropdown") item.value1 = `${item.value1}`.trim();
  if (item.type !== "dropdown") delete item.showDropdown;
  setDataVerification(ctx, `${regulation.rangeTxt}`, item);
  return true;
}

/** The dialog's Clear All: remove the rules of the dialog's ranges. */
export function clearDataVerificationDialog(ctx: Context) {
  const regulation = ctx.dataVerification?.dataRegulation;
  const editing = ctx.dataVerification?.editingRuleId;
  if (editing) {
    deleteDataVerificationRule(ctx, editing);
    ctx.dataVerification!.editingRuleId = undefined;
  }
  if (regulation?.rangeTxt) {
    removeDataVerification(ctx, `${regulation.rangeTxt}`);
  }
}

/**
 * Fill `ctx.dataVerification.dataRegulation` for the dialog: from a rule
 * being edited, or from the selection's active cell.
 */
export function initDataVerificationDialog(ctx: Context, ruleId?: string) {
  if (!ctx.dataVerification) return;
  const defaults: DataVerificationItem & { rangeTxt: string } = {
    type: "any",
    type2: "",
    rangeTxt: "",
    value1: "",
    value2: "",
    validity: "",
    remote: false,
    prohibitInput: true,
    hintShow: false,
    hintValue: "",
    hintTitle: "",
    errorStyle: "stop",
    errorTitle: "",
    errorMessage: "",
    ignoreBlank: true,
    showDropdown: true,
    placeholder: "",
  };
  if (ruleId) {
    const rule = getDataVerificationRules(ctx).find((x) => x.id === ruleId);
    if (rule) {
      ctx.dataVerification.editingRuleId = ruleId;
      ctx.dataVerification.dataRegulation = {
        ...defaults,
        ..._.omit(rule.item, ["checked", "anchor"]),
        hintTitle: rule.item.hintTitle ?? (rule.item as any).promptTitle ?? "",
        rangeTxt: rangesToText(ctx, rule.ranges),
      } as any;
      return;
    }
  }
  ctx.dataVerification.editingRuleId = undefined;
  const sel = ctx.luckysheet_select_save;
  let rangeTxt = "";
  let item: any = null;
  if (sel && sel.length > 0) {
    rangeTxt = rangesToText(ctx, sel);
    const last = sel[sel.length - 1];
    const r = last.row_focus ?? last.row[0];
    const c = last.column_focus ?? last.column[0];
    item = getDataVerificationItem(ctx, r, c);
  }
  ctx.dataVerification.dataRegulation = {
    ...defaults,
    ...(item ? _.omit(item, ["checked", "anchor"]) : {}),
    ...(item ? { hintTitle: item.hintTitle ?? item.promptTitle ?? "" } : {}),
    rangeTxt,
  } as any;
}
