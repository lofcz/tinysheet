/**
 * Data validation export (TinySheet `sheet.dataVerification` -> Excel).
 *
 * TinySheet keeps one rule per cell (`"r_c"` keys); ExcelJS squeezes equal
 * neighbouring rules back into ranges. Supported: dropdown (list or range),
 * checkbox (as a two-value list), number / integer / decimal, text length,
 * date, text contains / excludes / equals (as custom formulas) and custom
 * formulas (`type: "custom"`, value1 = formula). ID card / phone validity
 * has no Excel equivalent and is skipped.
 *
 * A rule applied to a range keeps the range's top-left cell as `anchor`;
 * its relative references (custom formula, list source, formula bounds) are
 * relative to that cell, as in Excel. The cells of each rule are written as
 * rectangles whose formulas are shifted from the anchor to the rectangle's
 * top-left cell (Excel reads a rule's formulas relative to that cell).
 * Error styles (stop / warning / information), error and input titles and
 * messages, and "ignore blank" are kept.
 */
import type ExcelJS from "@protobi/exceljs";
import { cellAddress, shiftFormula } from "../common/formulaText";

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

const ERROR_STYLES = new Set(["stop", "warning", "information"]);

/** A bound (value1 / value2): a number, or a formula ("=B1") as its text. */
function bound(v: any): number | string {
  const text = String(v ?? "").trim();
  if (text.startsWith("=") && text.length > 1) return text.slice(1);
  return text === "" ? "" : Number(text);
}

/**
 * The Excel rule for a TinySheet rule written at (r, c). `shift` moves the
 * rule's relative references by (dr, dc) first (from its anchor to r, c).
 */
export function getExcelValidation(
  item: any,
  r: number,
  c: number,
  shift: [number, number] = [0, 0]
): ExcelJS.DataValidation | null {
  if (!item?.type) return null;
  const moved = (text: string) =>
    shift[0] || shift[1] ? shiftFormula(text, shift[0], shift[1]) : text;
  const prompt = item.hintValue || item.hintText || undefined;
  const promptTitle = item.hintTitle || item.promptTitle || undefined;
  const base: any = {
    allowBlank: item.ignoreBlank !== false,
    showInputMessage: !!item.hintShow && !!(prompt || promptTitle),
    prompt,
    showErrorMessage: !!item.prohibitInput,
    errorStyle: item.prohibitInput ? "stop" : undefined,
  };
  if (promptTitle) base.promptTitle = promptTitle;
  if (item.errorTitle) base.errorTitle = item.errorTitle;
  if (item.errorMessage) base.error = item.errorMessage;
  if (item.errorStyle && ERROR_STYLES.has(item.errorStyle)) {
    base.errorStyle = item.errorStyle;
    base.showErrorMessage = true;
  }
  const operator = DV_OPERATOR_TO_EXCEL[item.type2] || "between";
  const self = cellAddress(r, c);

  switch (item.type) {
    case "dropdown": {
      const v = String(item.value1 ?? "").trim();
      let formula: string;
      if (v.startsWith("=") && v.length > 1) formula = moved(v.slice(1));
      else if (RANGE_RE.test(v)) formula = moved(v);
      else formula = quoteText(String(item.value1 ?? ""));
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
      const formulae = operands(item, needsTwo(operator) ? 2 : 1, (v) => {
        const b = bound(v);
        return typeof b === "string" && b !== "" ? moved(b) : b;
      });
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
      return { ...base, type: "custom", formulae: [moved(formula)] };
    }
    default:
      return null;
  }
}

type Rect = { r1: number; c1: number; r2: number; c2: number };

/** Cover a set of cells ("r_c" keys) with rectangles, top to bottom. */
export function cellRectangles(cells: [number, number][]): Rect[] {
  const key = (r: number, c: number) => `${r}_${c}`;
  const free = new Set(cells.map(([r, c]) => key(r, c)));
  const sorted = cells.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const rects: Rect[] = [];
  sorted.forEach(([r, c]) => {
    if (!free.has(key(r, c))) return;
    let c2 = c;
    while (free.has(key(r, c2 + 1))) c2 += 1;
    let r2 = r;
    const rowFree = (row: number) => {
      for (let x = c; x <= c2; x += 1) if (!free.has(key(row, x))) return false;
      return true;
    };
    while (rowFree(r2 + 1)) r2 += 1;
    for (let y = r; y <= r2; y += 1) {
      for (let x = c; x <= c2; x += 1) free.delete(key(y, x));
    }
    rects.push({ r1: r, c1: c, r2, c2 });
  });
  return rects;
}

export function setDataValidations(sheet: any, worksheet: ExcelJS.Worksheet) {
  const rules = sheet?.dataVerification;
  if (!rules) return;
  // cells sharing a rule (same settings, same anchor) are written together
  const groups = new Map<string, { item: any; cells: [number, number][] }>();
  Object.keys(rules).forEach((key) => {
    const [r, c] = key.split("_").map(Number);
    const item = rules[key];
    if (!Number.isInteger(r) || !Number.isInteger(c) || !item) return;
    const id = JSON.stringify(item);
    let group = groups.get(id);
    if (!group) {
      group = { item, cells: [] };
      groups.set(id, group);
    }
    group.cells.push([r, c]);
  });
  groups.forEach(({ item, cells }) => {
    const { anchor } = item;
    cellRectangles(cells).forEach((rect) => {
      const shift: [number, number] =
        anchor && Number.isInteger(anchor.r) && Number.isInteger(anchor.c)
          ? [rect.r1 - anchor.r, rect.c1 - anchor.c]
          : [0, 0];
      const dv = getExcelValidation(item, rect.r1, rect.c1, shift);
      if (!dv) return;
      const single = rect.r1 === rect.r2 && rect.c1 === rect.c2;
      if (single) {
        worksheet.getCell(rect.r1 + 1, rect.c1 + 1).dataValidation = dv;
      } else {
        // (not in ExcelJS's typings) a range key is written as one rule
        (worksheet as any).dataValidations.add(
          `${cellAddress(rect.r1, rect.c1)}:${cellAddress(rect.r2, rect.c2)}`,
          dv
        );
      }
    });
  });
}
