import _ from "lodash";
import { Context, getFlowdata } from "../context";
import { CellMatrix, Sheet } from "../types";
import { getSheetIndex } from "../utils";
import { getCellValue, getRangeByTxt } from "./cell";
import { checkProtectionFormatCells } from "./protection";
import { computeCFRules, getCFComputeMap } from "./cfEngine";
import type { CFCellResult, CFComputeMap } from "./cfTypes";

export * from "./cfTypes";
export * from "./cfRules";
export * from "./cfManage";
export {
  computeCFMap,
  computeCFRules,
  getCFComputeMap,
  cfDatePeriod,
  cfCellValue,
  compareCFValues,
  mixCFColors,
  parseCFColor,
  dataBarGeometry,
  cfClock,
} from "./cfEngine";
export {
  compileCFFormula,
  shiftCFFormula,
  evaluateCFFormula,
} from "./cfFormula";
export {
  drawCFDecorations,
  drawCFIcon,
  drawCFDataBar,
  cfTextCell,
} from "./cfDraw";

// 得到历史的规则
export function getHistoryRules(fileH: Sheet[]) {
  const historyRules = [];
  for (let h = 0; h < fileH.length; h += 1) {
    historyRules.push({
      sheetIndex: h,
      luckysheet_conditionformat_save: fileH[h].luckysheet_conditionformat_save,
    });
  }
  return historyRules;
}

// 得到当前的规则
export function getCurrentRules(fileC: Sheet[]) {
  const currentRules = [];
  for (let c = 0; c < fileC.length; c += 1) {
    currentRules.push({
      sheetIndex: c,
      luckysheet_conditionformat_save: fileC[c].luckysheet_conditionformat_save,
    });
  }
  return currentRules;
}

// 设置规则
export function setConditionRules(
  ctx: Context,
  protection: any,
  generalDialog: any,
  conditionformat: any,
  rules: any
) {
  if (!checkProtectionFormatCells(ctx)) {
    return;
  }

  // 条件名称
  const conditionName = rules.rulesType;

  // 条件单元格
  const conditionRange = [];

  // 条件值
  const conditionValue = [];

  if (
    conditionName === "greaterThan" ||
    conditionName === "lessThan" ||
    conditionName === "equal" ||
    conditionName === "textContains"
  ) {
    let v = rules.rulesValue;
    const rangeArr = getRangeByTxt(ctx, v);
    // 判断条件值是不是选区
    if (rangeArr.length > 1) {
      const r1 = rangeArr[0]?.row[0];
      const r2 = rangeArr[0]?.row[1];
      const c1 = rangeArr[0]?.column[0];
      const c2 = rangeArr[0]?.column[1];
      if (r1 === r2 && c1 === c2) {
        const d = getFlowdata(ctx);
        if (!d || _.isNil(r1) || _.isNil(c1)) return;
        v = getCellValue(r1, c1, d);
        conditionRange.push({
          row: rangeArr?.[0]?.row,
          column: rangeArr?.[0]?.column,
        });
        conditionValue.push(v);
      } else {
        ctx.warnDialog = conditionformat.onlySingleCell;
      }
    } else if (rangeArr.length === 0) {
      if (_.isNaN(v) || v === "") {
        ctx.warnDialog = conditionformat.conditionValueCanOnly;
        return;
      }
      conditionValue.push(v);
    }
  } else if (conditionName === "between") {
    let v1 = rules.betweenValue.value1;
    let v2 = rules.betweenValue.value2;

    // 值转为数组坐标
    const rangeArr1 = getRangeByTxt(ctx, v1);
    if (rangeArr1.length > 1) {
      ctx.warnDialog = conditionformat.onlySingleCell;
      return;
    }
    if (rangeArr1.length === 1) {
      const r1 = rangeArr1[0]?.row[0];
      const r2 = rangeArr1[0]?.row[1];
      const c1 = rangeArr1[0]?.column[0];
      const c2 = rangeArr1[0]?.column[1];
      if (r1 === r2 && c1 === c2) {
        const d = getFlowdata(ctx);
        if (!d || _.isNil(r1) || _.isNil(c1)) return;
        v1 = getCellValue(r1, c1, d);
        conditionRange.push({
          row: rangeArr1?.[0]?.row,
          column: rangeArr1?.[0]?.column,
        });
        conditionValue.push(v1);
      } else {
        ctx.warnDialog = conditionformat.onlySingleCell;
        return;
      }
    } else if (rangeArr1.length === 0) {
      if (_.isNaN(v1) || v1 === "") {
        ctx.warnDialog = conditionformat.conditionValueCanOnly;
        return;
      }
      conditionValue.push(v1);
    }
    const rangeArr2 = getRangeByTxt(ctx, v2);
    if (rangeArr2.length > 1) {
      ctx.warnDialog = conditionformat.onlySingleCell;
      return;
    }
    if (rangeArr2.length === 1) {
      const r1 = rangeArr2[0]?.row[0];
      const r2 = rangeArr2[0]?.row[1];
      const c1 = rangeArr2[0]?.column[0];
      const c2 = rangeArr2[0]?.column[1];
      if (r1 === r2 && c1 === c2) {
        const d = getFlowdata(ctx);
        if (!d || _.isNil(r1) || _.isNil(c1)) return;
        v2 = getCellValue(r1, c1, d);
        conditionRange.push({
          row: rangeArr2?.[0]?.row,
          column: rangeArr2?.[0]?.column,
        });
      } else {
        ctx.warnDialog = conditionformat.onlySingleCell;
        return;
      }
    } else if (rangeArr2.length === 0) {
      if (_.isNaN(v2) || v2 === "") {
        ctx.warnDialog = conditionformat.conditionValueCanOnly;
      } else {
        conditionValue.push(v2);
      }
    }
  } else if (conditionName === "occurrenceDate") {
    const v = rules.dateValue;
    if (!v) {
      ctx.warnDialog = conditionformat.pleaseSelectADate;
      return;
    }
    conditionValue.push(v);
  } else if (conditionName === "duplicateValue") {
    conditionValue.push(rules.repeatValue);
  } else if (
    conditionName === "top10" ||
    conditionName === "top10_percent" ||
    conditionName === "last10" ||
    conditionName === "last10_percent"
  ) {
    const v = rules.projectValue;
    if (
      parseInt(v, 10).toString() !== v ||
      parseInt(v, 10) < 1 ||
      parseInt(v, 10) > 1000
    ) {
      ctx.warnDialog = conditionformat.pleaseEnterInteger;
      return;
    }
    conditionValue.push(v);
  } else {
    conditionValue.push(conditionName);
  }
  //  else if (conditionName === "aboveAverage") {
  //   conditionValue.push("aboveAverage");
  // } else if (conditionName === "belowAverage") {
  //   conditionValue.push("belowAverage");
  // }

  // 颜色
  let textColor = null;
  if (rules.textColor.check) {
    textColor = rules.textColor.color;
  }

  let cellColor = null;
  if (rules.cellColor.check) {
    cellColor = rules.cellColor.color;
  }

  // 获得之前的规则
  // const fileH = ctx.luckysheetfile ?? [];
  // const historyRules = getHistoryRules(fileH);

  // 构造现在的规则
  const rule = {
    type: "default",
    cellrange: ctx.luckysheet_select_save ?? [],
    format: {
      textColor,
      cellColor,
    },
    conditionName,
    conditionRange,
    conditionValue,
  };
  const index = getSheetIndex(ctx, ctx.currentSheetId) as number;
  const ruleArr =
    ctx.luckysheetfile[index].luckysheet_conditionformat_save ?? [];
  ruleArr?.push(rule);

  ctx.luckysheetfile[index].luckysheet_conditionformat_save = ruleArr;
  // const fileC = ctx.luckysheetfile ?? [];
  // const currentRules = getCurrentRules(fileC);
}

export function getColorGradation(
  color1: string,
  color2: string,
  value1: number,
  value2: number,
  value: number
) {
  const rgb1 = color1.split(",");
  const r1 = parseInt(rgb1[0].split("(")[1], 10);
  const g1 = parseInt(rgb1[1], 10);
  const b1 = parseInt(rgb1[2].split(")")[0], 10);

  const rgb2 = color2.split(",");
  const r2 = parseInt(rgb2[0].split("(")[1], 10);
  const g2 = parseInt(rgb2[1], 10);
  const b2 = parseInt(rgb2[2].split(")")[0], 10);

  const v12 = value1 - value2;
  const v10 = value1 - value;

  const r = Math.round(r1 - ((r1 - r2) / v12) * v10);
  const g = Math.round(g1 - ((g1 - g2) / v12) * v10);
  const b = Math.round(b1 - ((b1 - b2) / v12) * v10);

  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Evaluate a list of rules (ascending priority) against a cell matrix.
 * Returns a map from "r_c" to the formatting of that cell; see cfEngine.ts.
 */
export function compute(
  ctx: Context,
  ruleArr: any,
  d: CellMatrix,
  sheetId?: string
): CFComputeMap {
  return computeCFRules(ctx, ruleArr, d, sheetId ?? ctx.currentSheetId);
}

/** Conditional formatting of the current sheet, cached per recalculation. */
export function getComputeMap(ctx: Context): CFComputeMap | null {
  const index = getSheetIndex(ctx, ctx.currentSheetId);
  if (index == null || _.isNil(ctx.luckysheetfile[index]?.data)) return null;
  return getCFComputeMap(ctx, ctx.currentSheetId);
}

export function checkCF(
  r: number,
  c: number,
  computeMap: any
): CFCellResult | null {
  if (!_.isNil(computeMap)) {
    const hit = computeMap[`${r}_${c}`];
    if (hit !== undefined) return hit;
  }
  return null;
}

/**
 * Legacy entry point: "delSheet" clears the sheet's rules; "dataBar",
 * "colorGradation" and "icons" add a rule for the selection using
 * `ctx.conditionRules` colours.
 */
export function updateItem(ctx: Context, type: string) {
  if (!checkProtectionFormatCells(ctx)) {
    return;
  }
  const index = getSheetIndex(ctx, ctx.currentSheetId) as number;
  if (type === "delSheet") {
    ctx.luckysheetfile[index].luckysheet_conditionformat_save = [];
    return;
  }
  const rule = {
    type,
    cellrange: ctx.luckysheet_select_save ?? [],
    format: {
      textColor: ctx.conditionRules.textColor,
      cellColor: ctx.conditionRules.cellColor,
    },
  };
  const ruleArr =
    ctx.luckysheetfile[index].luckysheet_conditionformat_save ?? [];
  ruleArr.push(rule);
  ctx.luckysheetfile[index].luckysheet_conditionformat_save = ruleArr;
}

export function CFSplitRange(
  range1: any,
  range2: any,
  range3: any,
  type: string
) {
  let range: any = [];

  const offset_r = range3.row[0] - range2.row[0];
  const offset_c = range3.column[0] - range2.column[0];

  const r1 = range1.row[0];
  const r2 = range1.row[1];
  const c1 = range1.column[0];
  const c2 = range1.column[1];

  if (
    r1 >= range2.row[0] &&
    r2 <= range2.row[1] &&
    c1 >= range2.column[0] &&
    c2 <= range2.column[1]
  ) {
    // 选区 包含 条件格式应用范围 全部

    if (type === "allPart") {
      // 所有部分
      range = [
        {
          row: [r1 + offset_r, r2 + offset_r],
          column: [c1 + offset_c, c2 + offset_c],
        },
      ];
    } else if (type === "restPart") {
      // 剩余部分
      range = [];
    } else if (type === "operatePart") {
      // 操作部分
      range = [
        {
          row: [r1 + offset_r, r2 + offset_r],
          column: [c1 + offset_c, c2 + offset_c],
        },
      ];
    }
  } else if (
    r1 >= range2.row[0] &&
    r1 <= range2.row[1] &&
    c1 >= range2.column[0] &&
    c2 <= range2.column[1]
  ) {
    // 选区 行贯穿 条件格式应用范围 上部分

    if (type === "allPart") {
      // 所有部分
      range = [
        { row: [range2.row[1] + 1, r2], column: [c1, c2] },
        {
          row: [r1 + offset_r, range2.row[1] + offset_r],
          column: [c1 + offset_c, c2 + offset_c],
        },
      ];
    } else if (type === "restPart") {
      // 剩余部分
      range = [{ row: [range2.row[1] + 1, r2], column: [c1, c2] }];
    } else if (type === "operatePart") {
      // 操作部分
      range = [
        {
          row: [r1 + offset_r, range2.row[1] + offset_r],
          column: [c1 + offset_c, c2 + offset_c],
        },
      ];
    }
  } else if (
    r2 >= range2.row[0] &&
    r2 <= range2.row[1] &&
    c1 >= range2.column[0] &&
    c2 <= range2.column[1]
  ) {
    // 选区 行贯穿 条件格式应用范围 下部分

    if (type === "allPart") {
      // 所有部分
      range = [
        { row: [r1, range2.row[0] - 1], column: [c1, c2] },
        {
          row: [range2.row[0] + offset_r, r2 + offset_r],
          column: [c1 + offset_c, c2 + offset_c],
        },
      ];
    } else if (type === "restPart") {
      // 剩余部分
      range = [{ row: [r1, range2.row[0] - 1], column: [c1, c2] }];
    } else if (type === "operatePart") {
      // 操作部分
      range = [
        {
          row: [range2.row[0] + offset_r, r2 + offset_r],
          column: [c1 + offset_c, c2 + offset_c],
        },
      ];
    }
  } else if (
    r1 < range2.row[0] &&
    r2 > range2.row[1] &&
    c1 >= range2.column[0] &&
    c2 <= range2.column[1]
  ) {
    // 选区 行贯穿 条件格式应用范围 中间部分

    if (type === "allPart") {
      // 所有部分
      range = [
        { row: [r1, range2.row[0] - 1], column: [c1, c2] },
        { row: [range2.row[1] + 1, r2], column: [c1, c2] },
        {
          row: [range2.row[0] + offset_r, range2.row[1] + offset_r],
          column: [c1 + offset_c, c2 + offset_c],
        },
      ];
    } else if (type === "restPart") {
      // 剩余部分
      range = [
        { row: [r1, range2.row[0] - 1], column: [c1, c2] },
        { row: [range2.row[1] + 1, r2], column: [c1, c2] },
      ];
    } else if (type === "operatePart") {
      // 操作部分
      range = [
        {
          row: [range2.row[0] + offset_r, range2.row[1] + offset_r],
          column: [c1 + offset_c, c2 + offset_c],
        },
      ];
    }
  } else if (
    c1 >= range2.column[0] &&
    c1 <= range2.column[1] &&
    r1 >= range2.row[0] &&
    r2 <= range2.row[1]
  ) {
    // 选区 列贯穿 条件格式应用范围 左部分

    if (type === "allPart") {
      // 所有部分
      range = [
        { row: [r1, r2], column: [range2.column[1] + 1, c2] },
        {
          row: [r1 + offset_r, r2 + offset_r],
          column: [c1 + offset_c, range2.column[1] + offset_c],
        },
      ];
    } else if (type === "restPart") {
      // 剩余部分
      range = [{ row: [r1, r2], column: [range2.column[1] + 1, c2] }];
    } else if (type === "operatePart") {
      // 操作部分
      range = [
        {
          row: [r1 + offset_r, r2 + offset_r],
          column: [c1 + offset_c, range2.column[1] + offset_c],
        },
      ];
    }
  } else if (
    c2 >= range2.column[0] &&
    c2 <= range2.column[1] &&
    r1 >= range2.row[0] &&
    r2 <= range2.row[1]
  ) {
    // 选区 列贯穿 条件格式应用范围 右部分

    if (type === "allPart") {
      // 所有部分
      range = [
        { row: [r1, r2], column: [c1, range2.column[0] - 1] },
        {
          row: [r1 + offset_r, r2 + offset_r],
          column: [range2.column[0] + offset_c, c2 + offset_c],
        },
      ];
    } else if (type === "restPart") {
      // 剩余部分
      range = [{ row: [r1, r2], column: [c1, range2.column[0] - 1] }];
    } else if (type === "operatePart") {
      // 操作部分
      range = [
        {
          row: [r1 + offset_r, r2 + offset_r],
          column: [range2.column[0] + offset_c, c2 + offset_c],
        },
      ];
    }
  } else if (
    c1 < range2.column[0] &&
    c2 > range2.column[1] &&
    r1 >= range2.row[0] &&
    r2 <= range2.row[1]
  ) {
    // 选区 列贯穿 条件格式应用范围 中间部分

    if (type === "allPart") {
      // 所有部分
      range = [
        { row: [r1, r2], column: [c1, range2.column[0] - 1] },
        { row: [r1, r2], column: [range2.column[1] + 1, c2] },
        {
          row: [r1 + offset_r, r2 + offset_r],
          column: [range2.column[0] + offset_c, range2.column[1] + offset_c],
        },
      ];
    } else if (type === "restPart") {
      // 剩余部分
      range = [
        { row: [r1, r2], column: [c1, range2.column[0] - 1] },
        { row: [r1, r2], column: [range2.column[1] + 1, c2] },
      ];
    } else if (type === "operatePart") {
      // 操作部分
      range = [
        {
          row: [r1 + offset_r, r2 + offset_r],
          column: [range2.column[0] + offset_c, range2.column[1] + offset_c],
        },
      ];
    }
  } else if (
    r1 >= range2.row[0] &&
    r1 <= range2.row[1] &&
    c1 >= range2.column[0] &&
    c1 <= range2.column[1]
  ) {
    // 选区 包含 条件格式应用范围 左上角部分

    if (type === "allPart") {
      // 所有部分
      range = [
        { row: [r1, range2.row[1]], column: [range2.column[1] + 1, c2] },
        { row: [range2.row[1] + 1, r2], column: [c1, c2] },
        {
          row: [r1 + offset_r, range2.row[1] + offset_r],
          column: [c1 + offset_c, range2.column[1] + offset_c],
        },
      ];
    } else if (type === "restPart") {
      // 剩余部分
      range = [
        { row: [r1, range2.row[1]], column: [range2.column[1] + 1, c2] },
        { row: [range2.row[1] + 1, r2], column: [c1, c2] },
      ];
    } else if (type === "operatePart") {
      // 操作部分
      range = [
        {
          row: [r1 + offset_r, range2.row[1] + offset_r],
          column: [c1 + offset_c, range2.column[1] + offset_c],
        },
      ];
    }
  } else if (
    r1 >= range2.row[0] &&
    r1 <= range2.row[1] &&
    c2 >= range2.column[0] &&
    c2 <= range2.column[1]
  ) {
    // 选区 包含 条件格式应用范围 右上角部分

    if (type === "allPart") {
      // 所有部分
      range = [
        { row: [r1, range2.row[1]], column: [c1, range2.column[0] - 1] },
        { row: [range2.row[1] + 1, r2], column: [c1, c2] },
        {
          row: [r1 + offset_r, range2.row[1] + offset_r],
          column: [range2.column[0] + offset_c, c2 + offset_c],
        },
      ];
    } else if (type === "restPart") {
      // 剩余部分
      range = [
        { row: [r1, range2.row[1]], column: [c1, range2.column[0] - 1] },
        { row: [range2.row[1] + 1, r2], column: [c1, c2] },
      ];
    } else if (type === "operatePart") {
      // 操作部分
      range = [
        {
          row: [r1 + offset_r, range2.row[1] + offset_r],
          column: [range2.column[0] + offset_c, c2 + offset_c],
        },
      ];
    }
  } else if (
    r2 >= range2.row[0] &&
    r2 <= range2.row[1] &&
    c1 >= range2.column[0] &&
    c1 <= range2.column[1]
  ) {
    // 选区 包含 条件格式应用范围 左下角部分

    if (type === "allPart") {
      // 所有部分
      range = [
        { row: [r1, range2.row[0] - 1], column: [c1, c2] },
        { row: [range2.row[0], r2], column: [range2.column[1] + 1, c2] },
        {
          row: [range2.row[0] + offset_r, r2 + offset_r],
          column: [c1 + offset_c, range2.column[1] + offset_c],
        },
      ];
    } else if (type === "restPart") {
      // 剩余部分
      range = [
        { row: [r1, range2.row[0] - 1], column: [c1, c2] },
        { row: [range2.row[0], r2], column: [range2.column[1] + 1, c2] },
      ];
    } else if (type === "operatePart") {
      // 操作部分
      range = [
        {
          row: [range2.row[0] + offset_r, r2 + offset_r],
          column: [c1 + offset_c, range2.column[1] + offset_c],
        },
      ];
    }
  } else if (
    r2 >= range2.row[0] &&
    r2 <= range2.row[1] &&
    c2 >= range2.column[0] &&
    c2 <= range2.column[1]
  ) {
    // 选区 包含 条件格式应用范围 右下角部分

    if (type === "allPart") {
      // 所有部分
      range = [
        { row: [r1, range2.row[0] - 1], column: [c1, c2] },
        { row: [range2.row[0], r2], column: [c1, range2.column[0] - 1] },
        {
          row: [range2.row[0] + offset_r, r2 + offset_r],
          column: [range2.column[0] + offset_c, c2 + offset_c],
        },
      ];
    } else if (type === "restPart") {
      // 剩余部分
      range = [
        { row: [r1, range2.row[0] - 1], column: [c1, c2] },
        { row: [range2.row[0], r2], column: [c1, range2.column[0] - 1] },
      ];
    } else if (type === "operatePart") {
      // 操作部分
      range = [
        {
          row: [range2.row[0] + offset_r, r2 + offset_r],
          column: [range2.column[0] + offset_c, c2 + offset_c],
        },
      ];
    }
  } else if (
    r1 < range2.row[0] &&
    r2 > range2.row[1] &&
    c1 >= range2.column[0] &&
    c1 <= range2.column[1]
  ) {
    // 选区 包含 条件格式应用范围 左中间部分

    if (type === "allPart") {
      // 所有部分
      range = [
        { row: [r1, range2.row[0] - 1], column: [c1, c2] },
        {
          row: [range2.row[0], range2.row[1]],
          column: [range2.column[1] + 1, c2],
        },
        { row: [range2.row[1] + 1, r2], column: [c1, c2] },
        {
          row: [range2.row[0] + offset_r, range2.row[1] + offset_r],
          column: [c1 + offset_c, range2.column[1] + offset_c],
        },
      ];
    } else if (type === "restPart") {
      // 剩余部分
      range = [
        { row: [r1, range2.row[0] - 1], column: [c1, c2] },
        {
          row: [range2.row[0], range2.row[1]],
          column: [range2.column[1] + 1, c2],
        },
        { row: [range2.row[1] + 1, r2], column: [c1, c2] },
      ];
    } else if (type === "operatePart") {
      // 操作部分
      range = [
        {
          row: [range2.row[0] + offset_r, range2.row[1] + offset_r],
          column: [c1 + offset_c, range2.column[1] + offset_c],
        },
      ];
    }
  } else if (
    r1 < range2.row[0] &&
    r2 > range2.row[1] &&
    c2 >= range2.column[0] &&
    c2 <= range2.column[1]
  ) {
    // 选区 包含 条件格式应用范围 右中间部分

    if (type === "allPart") {
      // 所有部分
      range = [
        { row: [r1, range2.row[0] - 1], column: [c1, c2] },
        {
          row: [range2.row[0], range2.row[1]],
          column: [c1, range2.column[0] - 1],
        },
        { row: [range2.row[1] + 1, r2], column: [c1, c2] },
        {
          row: [range2.row[0] + offset_r, range2.row[1] + offset_r],
          column: [range2.column[0] + offset_c, c2 + offset_c],
        },
      ];
    } else if (type === "restPart") {
      // 剩余部分
      range = [
        { row: [r1, range2.row[0] - 1], column: [c1, c2] },
        {
          row: [range2.row[0], range2.row[1]],
          column: [c1, range2.column[0] - 1],
        },
        { row: [range2.row[1] + 1, r2], column: [c1, c2] },
      ];
    } else if (type === "operatePart") {
      // 操作部分
      range = [
        {
          row: [range2.row[0] + offset_r, range2.row[1] + offset_r],
          column: [range2.column[0] + offset_c, c2 + offset_c],
        },
      ];
    }
  } else if (
    c1 < range2.column[0] &&
    c2 > range2.column[1] &&
    r1 >= range2.row[0] &&
    r1 <= range2.row[1]
  ) {
    // 选区 包含 条件格式应用范围 上中间部分

    if (type === "allPart") {
      // 所有部分
      range = [
        { row: [r1, range2.row[1]], column: [c1, range2.column[0] - 1] },
        { row: [r1, range2.row[1]], column: [range2.column[1] + 1, c2] },
        { row: [range2.row[1] + 1, r2], column: [c1, c2] },
        {
          row: [r1 + offset_r, range2.row[1] + offset_r],
          column: [range2.column[0] + offset_c, range2.column[1] + offset_c],
        },
      ];
    } else if (type === "restPart") {
      // 剩余部分
      range = [
        { row: [r1, range2.row[1]], column: [c1, range2.column[0] - 1] },
        { row: [r1, range2.row[1]], column: [range2.column[1] + 1, c2] },
        { row: [range2.row[1] + 1, r2], column: [c1, c2] },
      ];
    } else if (type === "operatePart") {
      // 操作部分
      range = [
        {
          row: [r1 + offset_r, range2.row[1] + offset_r],
          column: [range2.column[0] + offset_c, range2.column[1] + offset_c],
        },
      ];
    }
  } else if (
    c1 < range2.column[0] &&
    c2 > range2.column[1] &&
    r2 >= range2.row[0] &&
    r2 <= range2.row[1]
  ) {
    // 选区 包含 条件格式应用范围 下中间部分

    if (type === "allPart") {
      // 所有部分
      range = [
        { row: [r1, range2.row[0] - 1], column: [c1, c2] },
        { row: [range2.row[0], r2], column: [c1, range2.column[0] - 1] },
        { row: [range2.row[0], r2], column: [range2.column[1] + 1, c2] },
        {
          row: [range2.row[0] + offset_r, r2 + offset_r],
          column: [range2.column[0] + offset_c, range2.column[1] + offset_c],
        },
      ];
    } else if (type === "restPart") {
      // 剩余部分
      range = [
        { row: [r1, range2.row[0] - 1], column: [c1, c2] },
        { row: [range2.row[0], r2], column: [c1, range2.column[0] - 1] },
        { row: [range2.row[0], r2], column: [range2.column[1] + 1, c2] },
      ];
    } else if (type === "operatePart") {
      // 操作部分
      range = [
        {
          row: [range2.row[0] + offset_r, r2 + offset_r],
          column: [range2.column[0] + offset_c, range2.column[1] + offset_c],
        },
      ];
    }
  } else if (
    r1 < range2.row[0] &&
    r2 > range2.row[1] &&
    c1 < range2.column[0] &&
    c2 > range2.column[1]
  ) {
    // 选区 包含 条件格式应用范围 正中间部分

    if (type === "allPart") {
      // 所有部分
      range = [
        { row: [r1, range2.row[0] - 1], column: [c1, c2] },
        {
          row: [range2.row[0], range2.row[1]],
          column: [c1, range2.column[0] - 1],
        },
        {
          row: [range2.row[0], range2.row[1]],
          column: [range2.column[1] + 1, c2],
        },
        { row: [range2.row[1] + 1, r2], column: [c1, c2] },
        {
          row: [range2.row[0] + offset_r, range2.row[1] + offset_r],
          column: [range2.column[0] + offset_c, range2.column[1] + offset_c],
        },
      ];
    } else if (type === "restPart") {
      // 剩余部分
      range = [
        { row: [r1, range2.row[0] - 1], column: [c1, c2] },
        {
          row: [range2.row[0], range2.row[1]],
          column: [c1, range2.column[0] - 1],
        },
        {
          row: [range2.row[0], range2.row[1]],
          column: [range2.column[1] + 1, c2],
        },
        { row: [range2.row[1] + 1, r2], column: [c1, c2] },
      ];
    } else if (type === "operatePart") {
      // 操作部分
      range = [
        {
          row: [range2.row[0] + offset_r, range2.row[1] + offset_r],
          column: [range2.column[0] + offset_c, range2.column[1] + offset_c],
        },
      ];
    }
  } else {
    // 选区 在 条件格式应用范围 之外

    if (type === "allPart") {
      // 所有部分
      range = [{ row: [r1, r2], column: [c1, c2] }];
    } else if (type === "restPart") {
      // 剩余部分
      range = [{ row: [r1, r2], column: [c1, c2] }];
    } else if (type === "operatePart") {
      // 操作部分
      range = [];
    }
  }

  return range;
}
