import {
  formatSqref,
  normalizeRule,
  parseCFColor,
  formatCFRange,
} from "@lofcz/tinysheet-core";
import JSZip from "jszip";
import type {
  CFRule,
  CFStyle,
  CFValueObject,
  SingleRange,
} from "@lofcz/tinysheet-core";

/*
 * Conditional formatting to xlsx (through ExcelJS's addConditionalFormatting).
 *
 * TinySheet stores rules in ascending priority (the last one wins); Excel's
 * priority 1 is the highest, so priority = rules.length - index.
 *
 * Rule types ExcelJS cannot write correctly (not-contains, blanks, errors,
 * duplicate/unique, average with "equal" or standard deviations, explicit
 * date ranges) are written as equivalent formula rules.
 */

function argb(color: string | null | undefined) {
  const rgb = parseCFColor(color ?? "");
  if (!rgb) return undefined;
  return {
    argb: `FF${rgb
      .map((x) => Math.round(x).toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()}`,
  };
}

/** ExcelJS differential style (dxf) of a highlight rule. */
export function cfStyleToDxf(format: CFStyle | undefined) {
  const f = format ?? {};
  const style: any = {};
  const font: any = {};
  if (f.textColor) font.color = argb(f.textColor);
  if (f.bold) font.bold = true;
  if (f.italic) font.italic = true;
  if (f.strikethrough) font.strike = true;
  if (f.underline) font.underline = true;
  if (Object.keys(font).length) style.font = font;
  if (f.cellColor) {
    const color = argb(f.cellColor);
    style.fill = {
      type: "pattern",
      pattern: "solid",
      bgColor: color,
      fgColor: color,
    };
  }
  if (f.borderColor) {
    const side = { style: "thin", color: argb(f.borderColor) };
    style.border = { top: side, left: side, bottom: side, right: side };
  }
  if (f.numberFormat) style.numFmt = f.numberFormat;
  return style;
}

function topLeftA1(ranges: SingleRange[]) {
  const first = ranges[0];
  return formatCFRange({
    row: [first.row[0], first.row[0]],
    column: [first.column[0], first.column[0]],
  });
}

function absRange(range: SingleRange) {
  return formatCFRange(range).replace(/([A-Z]+)(\d+)/g, "$$$1$$$2");
}

/** An operand as a formula: numbers stay, text is quoted, "=..." is kept. */
function operandFormula(v: any): string {
  if (typeof v === "number" || typeof v === "boolean") {
    return `${v}`.toUpperCase();
  }
  const s = `${v ?? ""}`;
  if (s.trim().startsWith("=")) return s.trim().substring(1);
  if (s.trim() !== "" && !Number.isNaN(Number(s))) return s.trim();
  return `"${s.replace(/"/g, '""')}"`;
}

function quote(text: any) {
  return `"${`${text ?? ""}`.replace(/"/g, '""')}"`;
}

function cfvo(
  vo: CFValueObject | undefined,
  ranges: SingleRange[],
  fallback: string
) {
  const type = vo?.type ?? fallback;
  const all = ranges.map(absRange).join(",");
  switch (type) {
    case "autoMin":
      return { type: "formula", value: `MIN(0,MIN(${all}))` };
    case "autoMax":
      return { type: "formula", value: `MAX(0,MAX(${all}))` };
    case "min":
    case "max":
      return { type };
    case "formula": {
      const f = `${vo?.value ?? ""}`.trim();
      return { type: "formula", value: f.startsWith("=") ? f.substring(1) : f };
    }
    default: {
      const raw = vo?.value;
      if (typeof raw === "string" && raw.trim().startsWith("=")) {
        return { type: "formula", value: raw.trim().substring(1) };
      }
      return { type, value: Number(raw ?? 0) };
    }
  }
}

const CELL_IS: Record<string, string> = {
  greaterThan: "greaterThan",
  lessThan: "lessThan",
  greaterThanOrEqual: "greaterThanOrEqual",
  lessThanOrEqual: "lessThanOrEqual",
  equal: "equal",
  notEqual: "notEqual",
  between: "between",
  notBetween: "notBetween",
};

const TIME_PERIODS = new Set([
  "yesterday",
  "today",
  "tomorrow",
  "last7Days",
  "lastWeek",
  "thisWeek",
  "nextWeek",
  "lastMonth",
  "thisMonth",
  "nextMonth",
]);

function dateSerialToExcel(text: string) {
  const m = /^\s*(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\s*$/.exec(text);
  return m ? `DATE(${m[1]},${Number(m[2])},${Number(m[3])})` : null;
}

/** The ExcelJS rule for one TinySheet rule (without priority), or null. */
export function cfRuleToExcel(raw: CFRule): any | null {
  const rule = normalizeRule(raw);
  const ranges = rule.cellrange ?? [];
  if (ranges.length === 0) return null;
  const tl = topLeftA1(ranges);
  const all = ranges.map(absRange).join(",");
  const stopIfTrue = rule.stopIfTrue ? true : undefined;

  if (rule.type === "dataBar" && rule.dataBar) {
    const db = rule.dataBar;
    const same = !!db.sameNegativeColor;
    const axis = {
      automatic: "auto",
      midpoint: "middle",
      none: "none",
    } as const;
    return {
      type: "dataBar",
      cfvo: [cfvo(db.min, ranges, "autoMin"), cfvo(db.max, ranges, "autoMax")],
      color: argb(db.color),
      // ExcelJS only writes the Excel 2010 extension (negative bars, axis,
      // border) for solid bars; finalizeConditionalFormatting restores the
      // gradient afterwards.
      gradient: false,
      tsGradient: !!db.gradient,
      border: !!(db.border ?? db.gradient),
      borderColor: argb(db.borderColor ?? db.color),
      negativeFillColor: argb(
        same ? db.color : (db.negativeColor ?? "#FF0000")
      ),
      negativeBorderColor: argb(
        same
          ? (db.borderColor ?? db.color)
          : (db.negativeBorderColor ?? db.negativeColor ?? "#FF0000")
      ),
      negativeBarColorSameAsPositive: same,
      negativeBarBorderColorSameAsPositive: same,
      axisColor: argb(db.axisColor ?? "#000000"),
      axisPosition: axis[db.axisPosition ?? "automatic"],
      direction: db.direction ?? "context",
      minLength: db.minLength ?? 0,
      maxLength: db.maxLength ?? 100,
      showValue: db.showValue !== false,
    };
  }
  if (rule.type === "colorGradation" && rule.colorScale) {
    const { stops } = rule.colorScale;
    return {
      type: "colorScale",
      cfvo: stops.map((s, i) =>
        cfvo(s, ranges, i === stops.length - 1 ? "max" : "min")
      ),
      color: stops.map((s) => argb(s.color)),
    };
  }
  if (rule.type === "icons" && rule.iconSet) {
    const set = rule.iconSet;
    return {
      type: "iconSet",
      iconSet: set.name,
      reverse: !!set.reverse,
      showValue: set.showValue !== false,
      cfvo: [
        { type: "percent", value: 0 },
        ...set.thresholds.map((t) => cfvo(t, ranges, "percent")),
      ],
    };
  }

  const style = cfStyleToDxf(rule.format);
  const values = rule.conditionValue ?? [];
  const name = rule.conditionName ?? "";
  const expression = (formula: string) => ({
    type: "expression",
    formulae: [formula],
    style,
    stopIfTrue,
  });

  if (CELL_IS[name]) {
    const formulae = [operandFormula(values[0])];
    if (name === "between" || name === "notBetween") {
      formulae.push(operandFormula(values[1]));
    }
    return {
      type: "cellIs",
      operator: CELL_IS[name],
      formulae,
      style,
      stopIfTrue,
    };
  }
  switch (name) {
    case "textContains":
      return {
        type: "containsText",
        operator: "containsText",
        text: `${values[0] ?? ""}`,
        formulae: [`NOT(ISERROR(SEARCH(${quote(values[0])},${tl})))`],
        style,
        stopIfTrue,
      };
    case "textBeginsWith":
      return {
        type: "containsText",
        operator: "beginsWith",
        text: `${values[0] ?? ""}`,
        formulae: [`LEFT(${tl},LEN(${quote(values[0])}))=${quote(values[0])}`],
        style,
        stopIfTrue,
      };
    case "textEndsWith":
      return {
        type: "containsText",
        operator: "endsWith",
        text: `${values[0] ?? ""}`,
        formulae: [`RIGHT(${tl},LEN(${quote(values[0])}))=${quote(values[0])}`],
        style,
        stopIfTrue,
      };
    case "textNotContains":
      return expression(`ISERROR(SEARCH(${quote(values[0])},${tl}))`);
    case "blanks":
      return expression(`LEN(TRIM(${tl}))=0`);
    case "noBlanks":
      return expression(`LEN(TRIM(${tl}))>0`);
    case "errors":
      return expression(`ISERROR(${tl})`);
    case "noErrors":
      return expression(`NOT(ISERROR(${tl}))`);
    case "occurrenceDate": {
      const period = `${values[0] ?? ""}`;
      if (TIME_PERIODS.has(period)) {
        return { type: "timePeriod", timePeriod: period, style, stopIfTrue };
      }
      const parts = period.split(/\s+[-~]\s+|\s*~\s*/);
      const a = dateSerialToExcel(parts[0] ?? "");
      const b = dateSerialToExcel(parts[1] ?? parts[0] ?? "");
      if (!a || !b) return null;
      return expression(
        `AND(INT(${tl})>=MIN(${a},${b}),INT(${tl})<=MAX(${a},${b}))`
      );
    }
    case "duplicateValue": {
      const count = ranges
        .map((r) => `COUNTIF(${absRange(r)},${tl})`)
        .join("+");
      const unique = `${values[0] ?? "0"}` === "1";
      return expression(
        `AND(LEN(TRIM(${tl}))>0,${count}${unique ? "=1" : ">1"})`
      );
    }
    case "top10":
    case "top10_percent":
    case "last10":
    case "last10_percent":
      return {
        type: "top10",
        rank: Number(values[0] ?? 10),
        percent: name.endsWith("_percent"),
        bottom: name.startsWith("last"),
        style,
        stopIfTrue,
      };
    case "aboveAverage":
    case "belowAverage": {
      const above = name === "aboveAverage";
      const k = Number(rule.stdDev ?? 0);
      if (k > 0) {
        return expression(
          `AND(ISNUMBER(${tl}),${tl}${above ? ">" : "<"}AVERAGE(${all})${
            above ? "+" : "-"
          }${k}*STDEV(${all}))`
        );
      }
      if (rule.equalAverage) {
        return expression(
          `AND(ISNUMBER(${tl}),${tl}${above ? ">=" : "<="}AVERAGE(${all}))`
        );
      }
      return { type: "aboveAverage", aboveAverage: above, style, stopIfTrue };
    }
    case "formula": {
      const f = `${values[0] ?? ""}`.trim();
      if (!f) return null;
      return expression(f.startsWith("=") ? f.substring(1) : f);
    }
    default:
      return null;
  }
}

interface XmlFix {
  priority: number;
  gradient?: boolean;
  barShowValue?: boolean;
  /** icon sets: ">=" (true) or ">" (false) per threshold */
  gte?: boolean[];
}

const pendingFixes = new WeakMap<object, XmlFix[]>();

/** Add a sheet's conditional formatting to an ExcelJS worksheet. */
export function setConditionalFormatting(table: any, worksheet: any) {
  const rules: CFRule[] = table?.luckysheet_conditionformat_save ?? [];
  const n = rules.length;
  const fixes: XmlFix[] = [];
  rules.forEach((rule, i) => {
    let model: any;
    try {
      model = cfRuleToExcel(rule);
    } catch (e) {
      model = null;
    }
    if (!model) return;
    const priority = n - i;
    const { tsGradient, ...excelModel } = model;
    worksheet.addConditionalFormatting({
      ref: formatSqref(normalizeRule(rule).cellrange, " "),
      rules: [{ ...excelModel, priority }],
    });
    const norm = normalizeRule(rule);
    if (model.type === "dataBar") {
      fixes.push({
        priority,
        gradient: !!tsGradient,
        barShowValue: norm.dataBar?.showValue !== false,
      });
    } else if (model.type === "iconSet") {
      const gte = (norm.iconSet?.thresholds ?? []).map((t) => t.gte !== false);
      if (gte.some((g) => !g)) fixes.push({ priority, gte });
    }
  });
  if (fixes.length) pendingFixes.set(worksheet, fixes);
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Set gte="0" on the cfvo tags (after the first) that need ">". */
function patchCfvos(xml: string, tag: string, gte: boolean[]) {
  let k = -1;
  return xml.replace(new RegExp(`<${escapeRe(tag)}\\b`, "g"), (m) => {
    k += 1;
    return k > 0 && gte[k - 1] === false ? `${m} gte="0"` : m;
  });
}

/** Apply what ExcelJS cannot write to one worksheet XML. */
export function patchConditionalFormattingXml(xml: string, fixes: XmlFix[]) {
  let out = xml;
  fixes.forEach((fix) => {
    const main = new RegExp(
      `<cfRule type="(dataBar|iconSet)" priority="${fix.priority}"[^>]*>[\\s\\S]*?</cfRule>`
    );
    const m = main.exec(out);
    if (m) {
      let rule = m[0];
      if (m[1] === "dataBar" && fix.barShowValue === false) {
        rule = rule.replace("<dataBar>", '<dataBar showValue="0">');
      }
      if (m[1] === "iconSet" && fix.gte)
        rule = patchCfvos(rule, "cfvo", fix.gte);
      out = out.slice(0, m.index) + rule + out.slice(m.index + m[0].length);
      const id = /<x14:id>([^<]+)<\/x14:id>/.exec(rule)?.[1];
      if (m[1] === "dataBar" && id && fix.gradient) {
        const ext = new RegExp(
          `(<x14:cfRule type="dataBar" id="${escapeRe(
            id
          )}"[^>]*>\\s*<x14:dataBar\\b[^>]*?) gradient="0"`
        );
        out = out.replace(ext, "$1");
      }
    }
    if (fix.gte) {
      const ext = new RegExp(
        `<x14:cfRule type="iconSet" priority="${fix.priority}"[^>]*>[\\s\\S]*?</x14:cfRule>`
      );
      const e = ext.exec(out);
      if (e) {
        out =
          out.slice(0, e.index) +
          patchCfvos(e[0], "x14:cfvo", fix.gte) +
          out.slice(e.index + e[0].length);
      }
    }
  });
  return out;
}

/**
 * Patch the worksheet parts of an opened package (the "conditional-formatting"
 * zip post-processor): gradient data bars with the Excel 2010 extension,
 * "show bar only", and ">" icon thresholds.
 */
export async function finalizeConditionalFormattingZip(
  workbook: any,
  zip: JSZip
): Promise<void> {
  const sheets = (workbook?.worksheets ?? []).filter((ws: any) =>
    pendingFixes.has(ws)
  );
  for (let i = 0; i < sheets.length; i += 1) {
    const ws = sheets[i];
    const path = `xl/worksheets/sheet${ws.id}.xml`;
    const file = zip.file(path);
    if (file) {
      // eslint-disable-next-line no-await-in-loop
      const xml = await file.async("string");
      zip.file(path, patchConditionalFormattingXml(xml, pendingFixes.get(ws)!));
    }
    pendingFixes.delete(ws);
  }
}

/**
 * Post-process a workbook written by ExcelJS: gradient data bars with the
 * Excel 2010 extension, "show bar only", and ">" icon thresholds.
 */
export async function finalizeConditionalFormatting(
  workbook: any,
  buffer: ArrayBuffer | Uint8Array
): Promise<ArrayBuffer | Uint8Array> {
  const pending = (workbook?.worksheets ?? []).some((ws: any) =>
    pendingFixes.has(ws)
  );
  if (!pending) return buffer;
  const zip = await JSZip.loadAsync(buffer);
  await finalizeConditionalFormattingZip(workbook, zip);
  return zip.generateAsync({ type: "arraybuffer" });
}
