/**
 * Data validation export (TinySheet `sheet.dataVerification` -> Excel).
 *
 * TinySheet keeps one rule per cell (`"r_c"` keys); ExcelJS squeezes equal
 * neighbouring rules back into ranges. Supported: dropdown (list or range),
 * checkbox (as a two-value list), number / integer / decimal, text length,
 * date, text contains / excludes / equals (as custom formulas) and custom
 * formulas (`type: "custom"`, value1 = formula). ID card / phone validity
 * has no Excel equivalent and is skipped.
 */
import type ExcelJS from "@protobi/exceljs";
import { cellAddress } from "../common/formulaText";

export const DV_OPERATOR_TO_EXCEL: Record<string, string> = {
  between: "between",
  notBetween: "notBetween",
  equal: "equal",
  notEqualTo: "notEqual",
  moreThanThe: "greaterThan",
  lessThan: "lessThan",
  greaterOrEqualTo: "greaterThanOrEqual",
  lessThanOrEqualTo: "lessThanOrEqual",
  // date rules
  earlierThan: "lessThan",
  noEarlierThan: "greaterThanOrEqual",
  laterThan: "greaterThan",
  noLaterThan: "lessThanOrEqual",
};

const RANGE_RE =
  /^=?(?:(?:'[^']+'|[^!'"]+)!)?\$?[A-Za-z]{1,3}\$?\d+(?::\$?[A-Za-z]{1,3}\$?\d+)?$/;

function quoteText(s: string) {
  return `"${String(s).replace(/"/g, '""')}"`;
}

function operands(item: any, count: number, parse: (v: any) => any) {
  const values = [item.value1, item.value2].slice(0, count).map(parse);
  return values.filter((v) => v !== "" && v != null && !Number.isNaN(v));
}

function needsTwo(operator: string) {
  return operator === "between" || operator === "notBetween";
}

export function getExcelValidation(
  item: any,
  r: number,
  c: number
): ExcelJS.DataValidation | null {
  if (!item?.type) return null;
  const base: any = {
    allowBlank: true,
    showInputMessage: !!item.hintShow && !!(item.hintValue || item.hintText),
    prompt: item.hintValue || item.hintText || undefined,
    showErrorMessage: !!item.prohibitInput,
    errorStyle: item.prohibitInput ? "stop" : undefined,
  };
  if (item.promptTitle) base.promptTitle = item.promptTitle;
  if (item.errorTitle) base.errorTitle = item.errorTitle;
  if (item.errorMessage) base.error = item.errorMessage;
  if (item.errorStyle) {
    base.errorStyle = item.errorStyle;
    base.showErrorMessage = true;
  }
  const operator = DV_OPERATOR_TO_EXCEL[item.type2] || "between";
  const self = cellAddress(r, c);

  switch (item.type) {
    case "dropdown": {
      const v = String(item.value1 ?? "");
      const formula = RANGE_RE.test(v.trim())
        ? v.trim().replace(/^=/, "")
        : quoteText(v);
      return { ...base, type: "list", formulae: [formula] };
    }
    case "checkbox":
      return {
        ...base,
        type: "list",
        formulae: [quoteText(`${item.value1 ?? ""},${item.value2 ?? ""}`)],
      };
    case "number":
    case "number_decimal":
    case "number_integer":
    case "text_length": {
      const types: Record<string, ExcelJS.DataValidation["type"]> = {
        number_integer: "whole",
        text_length: "textLength",
      };
      const type = types[item.type] ?? "decimal";
      const formulae = operands(item, needsTwo(operator) ? 2 : 1, (v) =>
        v === "" || v == null ? "" : Number(v)
      );
      if (formulae.length === 0) return null;
      return { ...base, type, operator, formulae };
    }
    case "date": {
      const formulae = operands(item, needsTwo(operator) ? 2 : 1, (v) =>
        v ? String(v) : ""
      ).filter((v) => !Number.isNaN(new Date(v).getTime()));
      if (formulae.length === 0) return null;
      return { ...base, type: "date", operator, formulae };
    }
    case "text_content": {
      const text = quoteText(String(item.value1 ?? ""));
      let formula: string;
      if (item.type2 === "exclude")
        formula = `ISERROR(SEARCH(${text},${self}))`;
      else if (item.type2 === "equal") formula = `${self}=${text}`;
      else formula = `ISNUMBER(SEARCH(${text},${self}))`;
      return { ...base, type: "custom", formulae: [formula] };
    }
    case "custom": {
      const formula = String(item.value1 ?? "").replace(/^=/, "");
      if (!formula) return null;
      return { ...base, type: "custom", formulae: [formula] };
    }
    default:
      return null;
  }
}

export function setDataValidations(sheet: any, worksheet: ExcelJS.Worksheet) {
  const rules = sheet?.dataVerification;
  if (!rules) return;
  Object.keys(rules).forEach((key) => {
    const [r, c] = key.split("_").map(Number);
    if (!Number.isInteger(r) || !Number.isInteger(c)) return;
    const dv = getExcelValidation(rules[key], r, c);
    if (dv) worksheet.getCell(r + 1, c + 1).dataValidation = dv;
  });
}
