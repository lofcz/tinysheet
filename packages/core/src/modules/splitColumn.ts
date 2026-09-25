import _ from "lodash";
import { Context, getFlowdata } from "../context";
import { Cell } from "../types";
import { getCellValue, setCellValue } from "./cell";
import { genarate, update } from "./format";
import { jfrefreshgrid } from "./refresh";

// 生成二维数组
export function getNullData(rlen: number, clen: number) {
  const arr = [];
  for (let r = 0; r < rlen; r += 1) {
    const rowArr = [];

    for (let c = 0; c < clen; c += 1) {
      rowArr.push("");
    }
    arr.push(rowArr);
  }
  return arr;
}

// 批量更新数据到表格
export function updateMoreCell(
  r: number,
  c: number,
  dataMatrix: string[][],
  ctx: Context
) {
  if (ctx.allowEdit === false) return;
  const flowdata = getFlowdata(ctx);
  dataMatrix.forEach((datas, i) => {
    datas.forEach((data, j) => {
      const v = dataMatrix[i][j];
      setCellValue(ctx, r + i, c + j, flowdata, v);
    });
  });
  // jfrefreshgrid(d, range);
  // selectHightlightShow();
}

// 处理分隔符
export function getRegStr(regStr: string, splitSymbols: any) {
  regStr = "";
  let mark = 0;
  for (let i = 0; i < splitSymbols.length; i += 1) {
    const split = splitSymbols[i];
    const inputNode = split.childNodes[0];
    if (inputNode.checked) {
      const { id } = inputNode;
      if (id === "Tab") {
        // Tab键
        regStr += "\\t";
        mark += 1;
      } else if (id === "semicolon") {
        // 分号
        if (mark > 0) {
          regStr += "|";
        }
        regStr += ";";
        mark = 1;
      } else if (id === "comma") {
        // 逗号
        if (mark > 0) {
          regStr += "|";
        }
        regStr += ",";
        mark += 1;
      } else if (id === "space") {
        // 空格
        if (mark > 0) {
          regStr += "|";
        }

        regStr += "\\s";
        mark += 1;
      } else if (id === "splitsimple") {
        // 连续分隔符号视为单个处理
        regStr = `[${regStr}]+`;
      } else if (id === "other") {
        // 其他
        const txt = split.childNodes[2].value;
        if (txt !== "") {
          if (mark > 0) {
            regStr += "|";
          }
          regStr += txt;
        }
      }
    }
  }
  return regStr;
}

// 获得分割数据
export function getDataArr(regStr: string, ctx: Context) {
  let arr = [];
  const r1 = ctx.luckysheet_select_save![0].row[0];
  const r2 = ctx.luckysheet_select_save![0].row[1];
  const c = ctx.luckysheet_select_save![0].column[0];
  const data = getFlowdata(ctx);
  if (!_.isNull(regStr) && regStr !== "") {
    const reg = new RegExp(regStr, "g");
    const dataArr = [];
    for (let r = r1; r <= r2; r += 1) {
      let rowArr = [];
      const cell = data![r][c];
      let value;
      if (!_.isNull(cell) && !_.isNull(cell.m)) {
        value = cell.m;
      } else {
        value = getCellValue(r, c, data!);
      }
      if (_.isNull(value) || _.isUndefined(value)) {
        value = "";
      }
      rowArr = value.toString().split(reg);
      dataArr.push(rowArr);
    }
    const rlen = dataArr.length;
    let clen = 0;
    for (let i = 0; i < rlen; i += 1) {
      if (dataArr[i].length > clen) {
        clen = dataArr[i].length;
      }
    }
    arr = getNullData(rlen, clen);
    for (let i = 0; i < arr.length; i += 1) {
      for (let j = 0; j < arr[0].length; j += 1) {
        if (dataArr[i][j] != null) {
          arr[i][j] = dataArr[i][j];
        }
      }
    }
  } else {
    for (let r = r1; r <= r2; r += 1) {
      const rowArr = [];
      const cell = data![r][c];
      let value;
      if (!_.isNull(cell) && !_.isNull(cell.m)) {
        value = cell.m;
      } else {
        value = getCellValue(r, c, data!);
      }

      if (_.isNull(value)) {
        value = "";
      }

      rowArr.push(value);

      arr.push(rowArr);
    }
  }
  return arr;
}

/* ------------------------------------------------------------------ */
/* Text to Columns (Excel's Convert Text to Columns wizard)            */
/* ------------------------------------------------------------------ */

export type TextToColumnsFormat =
  | "general"
  | "text"
  | "skip"
  | "MDY"
  | "DMY"
  | "YMD"
  | "MYD"
  | "DYM"
  | "YDM";

export type TextToColumnsOptions = {
  mode: "delimited" | "fixed";
  delimiters?: {
    tab?: boolean;
    semicolon?: boolean;
    comma?: boolean;
    space?: boolean;
    /** one extra delimiter character */
    other?: string;
  };
  treatConsecutiveAsOne?: boolean;
  /** Text wrapped in the qualifier keeps its delimiters ("" for none). */
  textQualifier?: string;
  /** Fixed width: character positions where columns start. */
  breaks?: number[];
  /** Per output column; missing entries are "general". */
  columnFormats?: TextToColumnsFormat[];
};

function delimiterSet(options: TextToColumnsOptions) {
  const d = options.delimiters || {};
  const set = new Set<string>();
  if (d.tab) set.add("\t");
  if (d.semicolon) set.add(";");
  if (d.comma) set.add(",");
  if (d.space) set.add(" ");
  if (d.other) set.add(d.other[0]);
  return set;
}

/** Split one line of text into fields. */
export function splitTextLine(
  text: string,
  options: TextToColumnsOptions
): string[] {
  const str = text ?? "";
  if (options.mode === "fixed") {
    const breaks = _.uniq((options.breaks || []).filter((b) => b > 0)).sort(
      (a, b) => a - b
    );
    const fields: string[] = [];
    let prev = 0;
    breaks.forEach((b) => {
      fields.push(str.substring(prev, b));
      prev = b;
    });
    fields.push(str.substring(prev));
    // Excel trims the padding spaces of fixed-width fields
    return fields.map((f) => f.trim());
  }
  const delims = delimiterSet(options);
  const q = options.textQualifier ?? '"';
  const fields: string[] = [];
  let cur = "";
  let fieldStart = true;
  let i = 0;
  while (i < str.length) {
    const ch = str[i];
    if (q && fieldStart && ch === q) {
      // qualified field: up to the closing qualifier (doubled = literal)
      i += 1;
      while (i < str.length) {
        if (str[i] === q) {
          if (str[i + 1] === q) {
            cur += q;
            i += 2;
          } else {
            i += 1;
            break;
          }
        } else {
          cur += str[i];
          i += 1;
        }
      }
      fieldStart = false;
    } else if (delims.has(ch)) {
      fields.push(cur);
      cur = "";
      fieldStart = true;
      i += 1;
      if (options.treatConsecutiveAsOne) {
        while (i < str.length && delims.has(str[i])) i += 1;
      }
    } else {
      cur += ch;
      fieldStart = false;
      i += 1;
    }
  }
  fields.push(cur);
  return fields;
}

/** Split every line; rows are padded to the widest one (the preview). */
export function parseTextToColumns(
  lines: string[],
  options: TextToColumnsOptions
): string[][] {
  const rows = lines.map((l) => splitTextLine(l, options));
  const width = _.max(rows.map((r) => r.length)) ?? 0;
  return rows.map((r) => r.concat(Array(width - r.length).fill("")));
}

/**
 * Excel's fixed-width guess: break where every line has a space followed
 * by a non-space (a new field starts), or has ended.
 */
export function suggestFixedWidthBreaks(lines: string[]): number[] {
  const nonEmpty = lines.filter((l) => l && l.trim() !== "");
  const maxLen = _.max(nonEmpty.map((l) => l.length)) ?? 0;
  const breaks: number[] = [];
  for (let p = 1; p < maxLen; p += 1) {
    let starts = false;
    const ok = nonEmpty.every((l) => {
      if (p >= l.length) return true;
      if (l[p - 1] !== " ") return false;
      if (l[p] !== " ") starts = true;
      return true;
    });
    if (ok && starts) breaks.push(p);
  }
  return breaks;
}

/** Parse a date written in a given part order ("DMY", ...). */
export function parseDateByOrder(text: string, order: string): number | null {
  const parts = `${text}`
    .trim()
    .split(/[^0-9]+/)
    .filter((p) => p !== "");
  if (parts.length !== 3) return null;
  const at = (ch: string) => parts[order.indexOf(ch)];
  let y = parseInt(at("Y"), 10);
  const m = parseInt(at("M"), 10);
  const d = parseInt(at("D"), 10);
  if (at("Y").length <= 2) y += y < 30 ? 2000 : 1900;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1) return null;
  const pad = (n: number) => `${n}`.padStart(2, "0");
  const parsed = genarate(`${y}-${pad(m)}-${pad(d)}`);
  return parsed && typeof parsed[2] === "number" ? parsed[2] : null;
}

/** The cell a converted field becomes (null for an empty field). */
export function convertTextToColumnsField(
  text: string,
  format: TextToColumnsFormat = "general"
): Cell | null {
  if (format === "skip") return null;
  if (text === "") return null;
  if (format === "text") {
    return { v: text, m: text, ct: { fa: "@", t: "s" } };
  }
  if (format !== "general") {
    const serial = parseDateByOrder(text, format);
    if (serial != null) {
      const fa = "yyyy-mm-dd";
      return { v: serial, m: update(fa, serial), ct: { fa, t: "d" } };
    }
    return { v: text, m: text, ct: { fa: "General", t: "g" } };
  }
  const parsed = genarate(text);
  if (!parsed) return null;
  const [m, ct, v] = parsed;
  return { v, m: `${m}`, ct };
}

/** The text of each cell of a one-column range (what gets split). */
export function getTextToColumnsSource(
  ctx: Context,
  range: { row: number[]; column: number[] }
): string[] {
  const data = getFlowdata(ctx);
  const lines: string[] = [];
  if (!data) return lines;
  const col = range.column[0];
  for (let r = range.row[0]; r <= range.row[1]; r += 1) {
    const cell = data[r]?.[col];
    let text = "";
    if (cell?.ct?.t === "inlineStr") {
      text = (cell.ct.s || []).map((s: any) => s?.v ?? "").join("");
    } else if (cell != null) {
      text = `${cell.m ?? cell.v ?? ""}`;
    }
    lines.push(text);
  }
  return lines;
}

/**
 * Convert the text of a one-column range into several columns, starting at
 * `destination` (default: the range's top-left cell). Cell styles at the
 * destination are kept; values and number formats are replaced.
 */
export function applyTextToColumns(
  ctx: Context,
  range: { row: number[]; column: number[] },
  options: TextToColumnsOptions & { destination?: { r: number; c: number } }
) {
  if (ctx.allowEdit === false) return;
  const data = getFlowdata(ctx);
  if (!data) return;
  const rows = parseTextToColumns(getTextToColumnsSource(ctx, range), options);
  const formats = options.columnFormats || [];
  const dest = options.destination ?? { r: range.row[0], c: range.column[0] };
  let maxC = dest.c;
  rows.forEach((fields, i) => {
    const r = dest.r + i;
    if (!data[r]) return;
    let { c } = dest;
    fields.forEach((text, j) => {
      const format = formats[j] ?? "general";
      if (format === "skip") return;
      if (c >= data[r].length) return;
      const next = convertTextToColumnsField(text, format);
      const prev = data[r][c];
      const style = prev
        ? _.omit(prev, ["v", "m", "f", "ct", "spill", "qp"])
        : {};
      if (next == null) {
        data[r][c] = _.isEmpty(style) ? null : (style as Cell);
      } else {
        data[r][c] = { ...style, ...next };
      }
      maxC = Math.max(maxC, c);
      c += 1;
    });
  });
  jfrefreshgrid(ctx, data, [
    {
      row: [dest.r, Math.min(dest.r + rows.length - 1, data.length - 1)],
      column: [dest.c, maxC],
    },
  ]);
}
