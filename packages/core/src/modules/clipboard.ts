/**
 * System clipboard I/O.
 *
 * Copy writes two flavours, like Excel and Google Sheets do:
 * - `text/html`: a table with inline styles (fonts, colours, fills,
 *   alignment, wrap, borders, merges via rowspan/colspan, number formats via
 *   `mso-number-format`, exact numbers via `x:num`, column widths), which
 *   Excel, Google Sheets, LibreOffice and word processors read;
 * - `text/plain`: tab-separated values, quoting cells that contain tabs,
 *   line breaks or quotes (Excel's format).
 *
 * Paste reads HTML from Excel, Google Sheets, WPS, LibreOffice and web pages
 * ({@link parseClipboardHtml}: class and inline CSS, `x:num`,
 * `data-sheets-value`, borders, merges, number formats) and TSV
 * ({@link parseTsv}).
 */
import _ from "lodash";
import type { Context } from "../context";
import type { Cell, CellMatrix } from "../types";
import { locale } from "../locale";
import { getSheetIndex } from "../utils";
import { getBorderInfoCompute } from "./border";
import { genarate, update } from "./format";
import { formatHasDate, formatHasTime } from "./inputParse";

/* -------------------------------------------------------------------------- */
/*                               Clipboard state                              */
/* -------------------------------------------------------------------------- */

/**
 * What the last copy of this page wrote. The token is embedded in the HTML
 * so a paste can tell our own copy (paste with formulas, from the live
 * cells) from foreign content, without comparing cell texts.
 */
export const clipboardState: {
  token: string;
  text: string;
  /** the cut that was already pasted (a cut can only be pasted once) */
  consumedCutToken: string;
} = { token: "", text: "", consumedCutToken: "" };

let tokenCounter = 0;
export function newClipboardToken() {
  tokenCounter += 1;
  return `${Date.now().toString(36)}-${tokenCounter}`;
}

/** Token embedded by {@link rangeToClipboard} in `html`, or null. */
export function getClipboardToken(html: string | null | undefined) {
  if (!html) return null;
  const m = /data-fortune-copy="([^"]+)"/.exec(html);
  return m ? m[1] : null;
}

export default class clipboard {
  /**
   * Put `html` (and `text` as the plain-text flavour, defaulting to the
   * visible text of the html) on the system clipboard.
   */
  static writeHtml(str: string, text?: string) {
    try {
      let ele = document.getElementById("fortune-copy-content");
      if (!ele) {
        ele = document.createElement("div");
        ele.setAttribute("contentEditable", "true");
        ele.id = "fortune-copy-content";
        ele.style.position = "fixed";
        ele.style.height = "0";
        ele.style.width = "0";
        ele.style.left = "-10000px";
        document.querySelector(".fortune-container")?.append(ele);
      }
      const previouslyFocusedElement = document.activeElement as HTMLElement;
      ele.style.display = "block";
      ele.innerHTML = str;
      ele.focus({ preventScroll: true });
      document.execCommand("selectAll");

      // set both flavours explicitly, so the plain text is proper TSV and
      // the html keeps its <style>/attributes
      const onCopy = (e: ClipboardEvent) => {
        if (!e.clipboardData) return;
        e.clipboardData.setData("text/html", str);
        e.clipboardData.setData(
          "text/plain",
          text ?? (ele?.innerText || ele?.textContent || "")
        );
        e.preventDefault();
      };
      document.addEventListener("copy", onCopy);
      try {
        document.execCommand("copy");
      } finally {
        document.removeEventListener("copy", onCopy);
      }

      // Fallback when the clipboard API is blocked (context-menu paste)
      const plainText = text ?? (ele.innerText || ele.textContent || "");
      sessionStorage.setItem("localClipboard", plainText);

      setTimeout(() => {
        ele?.blur();
        previouslyFocusedElement?.focus?.();
      }, 10);
    } catch (e) {
      console.error(e);
    }
  }
}

/* -------------------------------------------------------------------------- */
/*                                     TSV                                    */
/* -------------------------------------------------------------------------- */

/** Quote a TSV field when needed (tab, line break or quote inside). */
export function tsvField(text: string) {
  if (/[\t\r\n"]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

/** Serialise rows as TSV with Excel's CRLF line endings. */
export function toTsv(rows: string[][]) {
  return rows.map((row) => row.map(tsvField).join("\t")).join("\r\n");
}

/**
 * Parse tab-separated text as Excel does: rows end at CR, LF or CRLF, a
 * field starting with `"` is quoted (may contain tabs and line breaks, `""`
 * is a quote). A single trailing line break is ignored.
 */
export function parseTsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let i = 0;
  const n = text.length;
  let field = "";
  let atFieldStart = true;
  const endField = () => {
    row.push(field);
    field = "";
    atFieldStart = true;
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };
  while (i < n) {
    const ch = text[i];
    if (atFieldStart && ch === '"') {
      // quoted field; only valid if the closing quote is followed by a
      // separator (otherwise Excel reads the quote literally)
      let j = i + 1;
      let buf = "";
      let closed = false;
      while (j < n) {
        if (text[j] === '"') {
          if (text[j + 1] === '"') {
            buf += '"';
            j += 2;
            continue;
          }
          closed = true;
          j += 1;
          break;
        }
        buf += text[j];
        j += 1;
      }
      const next = text[j];
      if (
        closed &&
        (j >= n || next === "\t" || next === "\n" || next === "\r")
      ) {
        field = buf;
        i = j;
        atFieldStart = false;
        continue;
      }
    }
    atFieldStart = false;
    if (ch === "\t") {
      endField();
      i += 1;
    } else if (ch === "\r" || ch === "\n") {
      endRow();
      i += ch === "\r" && text[i + 1] === "\n" ? 2 : 1;
    } else {
      field += ch;
      i += 1;
    }
  }
  if (field !== "" || row.length > 0) endRow();
  // pad ragged rows to the widest one
  const width = rows.reduce((w, r) => Math.max(w, r.length), 0);
  rows.forEach((r) => {
    while (r.length < width) r.push("");
  });
  return rows;
}

/* -------------------------------------------------------------------------- */
/*                                  Copy HTML                                 */
/* -------------------------------------------------------------------------- */

const BORDER_CSS: Record<string, string> = {
  "1": "0.5pt solid",
  "2": "0.5pt dotted", // hair
  "3": "0.5pt dotted",
  "4": "0.5pt dashed",
  "5": "0.5pt dashed", // dash-dot
  "6": "0.5pt dotted", // dash-dot-dot
  "7": "2.0pt double",
  "8": "1.0pt solid",
  "9": "1.0pt dashed",
  "10": "1.0pt dashed",
  "11": "1.0pt dotted",
  "12": "1.0pt dashed",
  "13": "1.5pt solid",
};

function borderCss(b: { style: any; color: string } | undefined | null) {
  if (!b || b.style == null || String(b.style) === "0") return null;
  const css = BORDER_CSS[String(b.style)] ?? "0.5pt solid";
  return `${css} ${b.color || "#000000"}`;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Cell text as HTML: line breaks become `<br>` and significant whitespace
 * (tabs, runs of spaces, leading/trailing spaces) is kept in
 * `mso-spacerun` spans, like Excel writes it.
 */
function htmlCellContent(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) =>
      escapeHtml(line).replace(
        /[ \t]{2,}|\t|^ | $/g,
        (m) => `<span style="mso-spacerun:yes">${m}</span>`
      )
    )
    .join('<br style="mso-data-placement:same-cell;">');
}

/** Escape a CSS string value (for `mso-number-format:"..."`). */
function cssString(s: string) {
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, "\\0022 ")}"`;
}

/** Text shown by a cell (formatted value, rich text joined). */
export function cellDisplayText(cell: Cell | null | undefined): string {
  if (!cell) return "";
  if (cell.ct?.t === "inlineStr" && Array.isArray(cell.ct.s)) {
    return cell.ct.s.map((s: any) => s.v ?? "").join("");
  }
  if (cell.m != null) return String(cell.m);
  if (cell.v != null) return String(cell.v);
  return "";
}

/** Inline CSS for a cell (without borders). */
export function cellCss(cell: Cell, fontarray?: string[]) {
  const css: string[] = [];
  if (cell.bl === 1) css.push("font-weight:700");
  if (cell.it === 1) css.push("font-style:italic");
  const deco = [];
  if (cell.un != null && Number(cell.un) > 0) deco.push("underline");
  if (cell.cl === 1) deco.push("line-through");
  if (deco.length) css.push(`text-decoration:${deco.join(" ")}`);
  if (cell.fc) css.push(`color:${cell.fc}`);
  if (cell.bg) css.push(`background:${cell.bg}`);
  if (cell.fs) css.push(`font-size:${cell.fs}pt`);
  const ff =
    typeof cell.ff === "number" || /^\d+$/.test(String(cell.ff ?? ""))
      ? fontarray?.[Number(cell.ff)]
      : cell.ff;
  if (ff) css.push(`font-family:${/[\s,]/.test(String(ff)) ? `"${ff}"` : ff}`);
  if (cell.ht != null) {
    const ht = Number(cell.ht);
    if (ht === 0) css.push("text-align:center");
    else if (ht === 1) css.push("text-align:left");
    else if (ht === 2) css.push("text-align:right");
  }
  if (cell.vt != null) {
    const vt = Number(cell.vt);
    if (vt === 0) css.push("vertical-align:middle");
    else if (vt === 1) css.push("vertical-align:top");
    else if (vt === 2) css.push("vertical-align:bottom");
  }
  css.push(cell.tb === "2" ? "white-space:normal" : "white-space:nowrap");
  const fa = cell.ct?.fa;
  if (fa && fa !== "General" && cell.ct?.t !== "inlineStr") {
    css.push(`mso-number-format:${cssString(fa)}`);
  }
  if (cell.rt != null && Number(cell.rt) !== 0) {
    css.push(`mso-rotate:${cell.rt}`);
  }
  return css.join(";");
}

export type ClipboardRange = { row: number[]; column: number[] };

/**
 * HTML and TSV for `ranges` of a sheet, as written to the clipboard by copy.
 * Multiple ranges must share their rows or their columns (Excel's rule);
 * hidden rows and columns are skipped.
 */
export function rangeToClipboard(
  ctx: Context,
  sheetId: string,
  ranges: ClipboardRange[],
  token = ""
): { html: string; text: string } | null {
  const idx = getSheetIndex(ctx, sheetId);
  if (idx == null) return null;
  const sheet = ctx.luckysheetfile[idx];
  const d = sheet.data;
  if (!d || !ranges || ranges.length === 0) return null;
  const cfg =
    (sheetId === ctx.currentSheetId ? ctx.config : sheet.config) || {};

  const rows: number[] = [];
  const cols: number[] = [];
  ranges.forEach((range) => {
    for (let r = range.row[0]; r <= range.row[1]; r += 1) {
      if (!rows.includes(r) && cfg.rowhidden?.[r] == null) rows.push(r);
    }
    for (let c = range.column[0]; c <= range.column[1]; c += 1) {
      if (!cols.includes(c) && cfg.colhidden?.[c] == null) cols.push(c);
    }
  });
  rows.sort((a, b) => a - b);
  cols.sort((a, b) => a - b);

  let borders: Record<string, any> = {};
  if (cfg.borderInfo && cfg.borderInfo.length > 0) {
    borders = getBorderInfoCompute(
      ctx,
      sheetId === ctx.currentSheetId ? undefined : sheetId
    );
  }
  const { fontarray } = locale(ctx) as { fontarray?: string[] };

  const colHtml = cols
    .map((c) => {
      const w = cfg.columnlen?.[c] ?? ctx.defaultcollen ?? 73;
      return `<col width="${Math.round(w)}" style="width:${Math.round(
        w * 0.75
      )}pt">`;
    })
    .join("");

  const text: string[][] = [];
  let body = "";
  const rowSet = new Set(rows);
  const colSet = new Set(cols);
  rows.forEach((r) => {
    const h = cfg.rowlen?.[r] ?? ctx.defaultrowlen ?? 19;
    body += `<tr height="${Math.round(h)}" style="height:${Math.round(
      h * 0.75
    )}pt">`;
    const textRow: string[] = [];
    cols.forEach((c) => {
      const cell = d[r]?.[c];
      const shown = cellDisplayText(cell);
      textRow.push(cell?.mc && cell.mc.rs == null ? "" : shown);
      // merged cells: the anchor spans, covered cells are omitted
      if (cell?.mc && cell.mc.rs == null) return;
      let span = "";
      let rs = 1;
      let cs = 1;
      if (cell?.mc?.rs != null) {
        for (let i = r; i < r + cell.mc.rs; i += 1)
          if (i !== r && rowSet.has(i)) rs += 1;
        for (let j = c; j < c + (cell.mc.cs ?? 1); j += 1)
          if (j !== c && colSet.has(j)) cs += 1;
        if (rs > 1) span += ` rowspan="${rs}"`;
        if (cs > 1) span += ` colspan="${cs}"`;
      }
      let style = cell ? cellCss(cell, fontarray) : "";
      const bdTop = borders[`${r}_${c}`];
      const bdEnd = borders[`${r + rs - 1}_${c + cs - 1}`];
      const sides: [string, any][] = [
        ["top", bdTop?.t],
        ["left", bdTop?.l],
        ["bottom", (rs > 1 || cs > 1 ? bdEnd : bdTop)?.b],
        ["right", (rs > 1 || cs > 1 ? bdEnd : bdTop)?.r],
      ];
      sides.forEach(([side, b]) => {
        const css = borderCss(b);
        if (css) style += `${style ? ";" : ""}border-${side}:${css}`;
      });
      let attrs = span;
      const v = cell?.v;
      if (typeof v === "number") {
        attrs += ` x:num="${v}"`;
      } else if (typeof v === "boolean") {
        attrs += ` x:bool="${v ? "TRUE" : "FALSE"}"`;
      } else if (cell?.ct?.fa === "@" || typeof v === "string") {
        attrs += " x:str";
      }
      const content = htmlCellContent(shown);
      body += `<td${attrs}${
        style ? ` style="${escapeHtml(style)}"` : ""
      }>${content}</td>`;
    });
    body += "</tr>";
    text.push(textRow);
  });

  const html =
    '<html xmlns:o="urn:schemas-microsoft-com:office:office" ' +
    'xmlns:x="urn:schemas-microsoft-com:office:excel" ' +
    'xmlns="http://www.w3.org/TR/REC-html40"><head>' +
    '<meta http-equiv="Content-Type" content="text/html; charset=utf-8">' +
    '<meta name="generator" content="TinySheet">' +
    "<style>br{mso-data-placement:same-cell;}" +
    "td{mso-number-format:General;vertical-align:bottom;}</style>" +
    "</head><body><!--StartFragment-->" +
    `<table data-type="fortune-copy-action-table"${
      token ? ` data-fortune-copy="${token}"` : ""
    } border="0" cellpadding="0" cellspacing="0" ` +
    'style="border-collapse:collapse;table-layout:fixed">' +
    `<colgroup>${colHtml}</colgroup><tbody>${body}</tbody></table>` +
    "<!--EndFragment--></body></html>";

  return { html, text: toTsv(text) };
}

/* -------------------------------------------------------------------------- */
/*                                 Paste HTML                                 */
/* -------------------------------------------------------------------------- */

export type BorderSide = { style: number; color: string };
export type ParsedBorders = Record<
  string,
  { l?: BorderSide; r?: BorderSide; t?: BorderSide; b?: BorderSide }
>;

export type ParsedClipboard = {
  /** cells relative to the paste anchor; merges use relative `mc` */
  cells: CellMatrix;
  /** computed borders keyed `r_c` (relative) */
  borders: ParsedBorders;
  /** column widths in px, when the source gave them */
  colWidths: (number | undefined)[];
  /** row heights in px, when the source gave them */
  rowHeights: (number | undefined)[];
  source: "excel" | "google" | "wps" | "libreoffice" | "tinysheet" | "html";
};

/**
 * Undo CSS escapes (`\.` → `.`, `\0022` → `"`). A hex escape needs two or
 * more digits or a terminating space, so `\d\a\y` stays "day".
 */
export function cssUnescape(s: string) {
  return s.replace(
    // Excel writes 4-digit escapes (\0022) directly followed by text
    /\\(?:(00[0-9a-fA-F]{2}) ?|([0-9a-fA-F]{2,6}) ?|([0-9a-fA-F]) |([\s\S]))/g,
    (_m, hex4: string, hex: string, hex1: string, ch: string) => {
      const h = hex4 || hex || hex1;
      if (h) return String.fromCodePoint(parseInt(h, 16));
      return ch;
    }
  );
}

function stripCssString(v: string) {
  const s = v.trim();
  if (
    s.length >= 2 &&
    ((s[0] === '"' && s[s.length - 1] === '"') ||
      (s[0] === "'" && s[s.length - 1] === "'"))
  ) {
    return s.slice(1, -1);
  }
  return s;
}

/** Parse `a:b; c:"d;e"` into a map (keys lower-cased). */
export function parseCssDeclarations(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  let i = 0;
  const n = text.length;
  while (i < n) {
    // property
    let j = i;
    while (j < n && text[j] !== ":" && text[j] !== ";") j += 1;
    const prop = text.slice(i, j).trim().toLowerCase();
    if (j >= n || text[j] === ";") {
      i = j + 1;
      continue;
    }
    // value (respect quotes and escapes)
    let k = j + 1;
    let quote = "";
    while (k < n) {
      const ch = text[k];
      if (ch === "\\") {
        k += 2;
        continue;
      }
      if (quote) {
        if (ch === quote) quote = "";
      } else if (ch === '"' || ch === "'") quote = ch;
      else if (ch === ";") break;
      k += 1;
    }
    const value = text.slice(j + 1, k).trim();
    if (prop) out[prop] = value.replace(/\s*!important$/i, "");
    i = k + 1;
  }
  return out;
}

/** Parse the rules of `<style>` blocks: selector → declarations. */
export function parseStyleSheet(css: string) {
  const rules: Record<string, Record<string, string>> = {};
  const text = css.replace(/<!--|-->/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
  const re = /([^{}@]+)\{([^{}]*)\}/g;
  let m = re.exec(text);
  while (m) {
    const decls = parseCssDeclarations(m[2]);
    m[1].split(",").forEach((sel) => {
      const key = sel.trim().toLowerCase();
      if (!key) return;
      rules[key] = { ...(rules[key] || {}), ...decls };
    });
    m = re.exec(text);
  }
  return rules;
}

const NAMED_COLORS: Record<string, string> = {
  black: "#000000",
  white: "#ffffff",
  red: "#ff0000",
  green: "#008000",
  blue: "#0000ff",
  yellow: "#ffff00",
  gray: "#808080",
  grey: "#808080",
  silver: "#c0c0c0",
  maroon: "#800000",
  navy: "#000080",
  purple: "#800080",
  teal: "#008080",
  olive: "#808000",
  lime: "#00ff00",
  aqua: "#00ffff",
  fuchsia: "#ff00ff",
  orange: "#ffa500",
  windowtext: "#000000",
  window: "#ffffff",
};

/** Normalise a CSS colour to `#rrggbb` (null for transparent/auto). */
export function normalizeColor(value: string | undefined | null) {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  if (!v || v === "transparent" || v === "none" || v === "auto") return null;
  if (v === "inherit" || v === "initial") return null;
  if (NAMED_COLORS[v]) return NAMED_COLORS[v];
  let m = /^#([0-9a-f]{3})$/.exec(v);
  if (m) {
    return `#${m[1]
      .split("")
      .map((x) => x + x)
      .join("")}`;
  }
  m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/.exec(v);
  if (m) {
    if (m[2] === "00") return null;
    return `#${m[1]}`;
  }
  m = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)(?:[\s,/]+([\d.]+%?))?\s*\)$/.exec(
    v
  );
  if (m) {
    if (m[4] != null && parseFloat(m[4]) === 0) return null;
    const hex = (x: string) =>
      Math.max(0, Math.min(255, parseInt(x, 10)))
        .toString(16)
        .padStart(2, "0");
    return `#${hex(m[1])}${hex(m[2])}${hex(m[3])}`;
  }
  return v;
}

/** CSS length to points. */
function toPt(len: string): number | null {
  const m = /^(-?[\d.]+)\s*(pt|px|em|rem|%)?$/i.exec(len.trim());
  if (!m) {
    const k = len.trim().toLowerCase();
    if (k === "thin") return 0.75;
    if (k === "medium") return 1.5;
    if (k === "thick") return 2.25;
    return null;
  }
  const n = parseFloat(m[1]);
  const unit = (m[2] || "px").toLowerCase();
  if (unit === "pt") return n;
  if (unit === "px") return n * 0.75;
  if (unit === "em" || unit === "rem") return n * 12;
  return null;
}

const BORDER_STYLES = [
  "none",
  "hidden",
  "solid",
  "dashed",
  "dotted",
  "double",
  "hairline",
  "dot-dash",
  "dot-dot-dash",
  "dot-dash-slanted",
  "groove",
  "ridge",
  "inset",
  "outset",
];

/** Parse a CSS border shorthand into our border style code and colour. */
export function parseBorder(
  value: string | undefined | null
): BorderSide | null {
  if (!value) return null;
  const parts = value
    .replace(/rgba?\([^)]*\)/gi, (m) => m.replace(/\s+/g, ""))
    .trim()
    .split(/\s+/);
  // line weight: 0 thin, 1 medium, 2 thick. Excel writes .5pt/1.0pt/1.5pt,
  // browsers and Google Sheets 1px/2px/3px.
  let weight = 0;
  let zero = false;
  let style: string | null = null;
  let color: string | null = null;
  parts.forEach((p) => {
    const lower = p.toLowerCase();
    if (BORDER_STYLES.includes(lower)) {
      style = lower;
      return;
    }
    const pt = toPt(lower);
    if (pt != null) {
      if (pt <= 0) zero = true;
      if (/px$/.test(lower)) {
        const px = pt / 0.75;
        if (px >= 3) weight = 2;
        else if (px >= 2) weight = 1;
      } else if (pt >= 1.5) weight = 2;
      else if (pt >= 1) weight = 1;
      return;
    }
    color = normalizeColor(lower) ?? color;
  });
  if (style == null || style === "none" || style === "hidden" || zero) {
    return null;
  }
  const medium = weight >= 1;
  const thick = weight >= 2;
  let code: number;
  if (style === "hairline") code = 2;
  else if (style === "dotted") code = 3; // Excel has a single dotted style
  else if (style === "dashed") code = medium ? 9 : 4;
  else if (style === "dot-dash") code = medium ? 10 : 5;
  else if (style === "dot-dot-dash") code = medium ? 11 : 6;
  else if (style === "dot-dash-slanted") code = 12;
  else if (style === "double") code = 7;
  else if (thick) code = 13;
  else if (medium) code = 8;
  else code = 1;
  return { style: code, color: color ?? "#000000" };
}

const NAMED_NUMBER_FORMATS: Record<string, string> = {
  general: "General",
  "general number": "General",
  standard: "#,##0.00",
  fixed: "0.00",
  percent: "0.00%",
  scientific: "0.00E+00",
  "short date": "m/d/yyyy",
  "medium date": "d-mmm-yy",
  "long date": "dddd, mmmm d, yyyy",
  "short time": "h:mm",
  "medium time": "h:mm AM/PM",
  "long time": "h:mm:ss",
  currency: "$#,##0.00",
  "yes/no": "General",
  "true/false": "General",
  "on/off": "General",
};

/** Number format code from an `mso-number-format` value. */
export function parseMsoNumberFormat(value: string | undefined | null) {
  if (!value) return null;
  const raw = cssUnescape(stripCssString(value));
  const named = NAMED_NUMBER_FORMATS[raw.trim().toLowerCase()];
  if (named) return named;
  return raw;
}

/** Visible text of an element: <br> and block ends are line breaks. */
export function elementText(el: Element): string {
  const SPACE_KEEP = "\u0001";
  let out = "";
  const blocks = new Set(["DIV", "P", "LI", "TR", "H1", "H2", "H3", "H4"]);
  const walk = (node: Node, keepSpaces: boolean) => {
    if (node.nodeType === 3) {
      const t = node.nodeValue || "";
      if (keepSpaces) out += t.replace(/[ \u00a0]/g, SPACE_KEEP);
      // (\s matches a non-breaking space too: keep those first)
      else out += t.replace(/\u00a0/g, SPACE_KEEP).replace(/\s+/g, " ");
      return;
    }
    if (node.nodeType !== 1) return;
    const e = node as Element;
    const tag = e.tagName.toUpperCase();
    if (tag === "BR") {
      out += "\n";
      return;
    }
    if (tag === "STYLE" || tag === "SCRIPT") return;
    const style = (e.getAttribute("style") || "").toLowerCase();
    const keep =
      keepSpaces ||
      style.includes("mso-spacerun") ||
      /white-space\s*:\s*pre/.test(style);
    const isBlock = blocks.has(tag);
    if (isBlock && out.length > 0 && !out.endsWith("\n")) out += "\n";
    e.childNodes.forEach((child) => walk(child, keep));
  };
  el.childNodes.forEach((child) => walk(child, false));
  return out
    .split("\n")
    .map((line) => line.replace(/^ +| +$/g, ""))
    .join("\n")
    .replace(/^\n+|\n+$/g, "")
    .replace(new RegExp(SPACE_KEEP, "g"), " ");
}

function detectSource(html: string): ParsedClipboard["source"] {
  if (/data-fortune-copy=|fortune-copy-action-table/.test(html)) {
    return "tinysheet";
  }
  if (/google-sheets-html-origin|data-sheets-value/.test(html)) {
    return "google";
  }
  if (
    /ProgId content=Excel|Microsoft Excel|urn:schemas-microsoft-com:office:excel/i.test(
      html
    )
  ) {
    return /\bet\d+\b|WPS|Kingsoft/i.test(html) ? "wps" : "excel";
  }
  if (/LibreOffice|OpenOffice|sdval=/i.test(html)) return "libreoffice";
  return "html";
}

function typedFromGoogle(json: string | null) {
  if (!json) return undefined;
  try {
    const o = JSON.parse(json);
    if (o["1"] === 3 && typeof o["3"] === "number") return o["3"];
    if (o["1"] === 4) return !!o["4"];
    if (o["1"] === 2 && typeof o["2"] === "string") return o["2"];
  } catch (e) {
    // ignore malformed attributes
  }
  return undefined;
}

function googleNumberFormat(json: string | null) {
  if (!json) return null;
  try {
    const o = JSON.parse(json);
    if (typeof o["2"] === "string" && o["2"]) return o["2"];
  } catch (e) {
    // ignore malformed attributes
  }
  return null;
}

function numberType(fa: string) {
  return formatHasDate(fa) || formatHasTime(fa) ? "d" : "n";
}

/**
 * Build a cell from parsed styles and text. `fontjson` maps lower-cased
 * family names to our font indexes.
 */
function buildCell(
  text: string,
  styles: Record<string, string>,
  opts: {
    num?: number;
    bool?: boolean;
    forceText?: boolean;
    typed?: string | number | boolean;
    format?: string | null;
    fontjson?: Record<string, number>;
    tags: { b: boolean; i: boolean; u: boolean; s: boolean };
  }
): Cell {
  const cell: Cell = {};
  let format = opts.format ?? parseMsoNumberFormat(styles["mso-number-format"]);
  if (format === "General") format = null;

  // value
  if (opts.num != null && !Number.isNaN(opts.num)) {
    cell.v = opts.num;
    const fa = format || "General";
    cell.ct = { fa, t: numberType(fa) };
    cell.m = format ? update(fa, opts.num) : genarate(opts.num)?.[0];
    if (!format) cell.ct = genarate(opts.num)?.[1] ?? cell.ct;
  } else if (opts.bool != null) {
    cell.v = opts.bool;
    cell.m = opts.bool ? "TRUE" : "FALSE";
    cell.ct = { fa: "General", t: "b" };
  } else if (text === "") {
    // empty cell: formats only
    if (format) cell.ct = { fa: format, t: "n" };
  } else if (format === "@" || opts.forceText) {
    cell.v = text;
    cell.m = text;
    cell.ct = {
      fa: format === "@" ? "@" : "General",
      t: format === "@" ? "s" : "g",
    };
  } else if (
    typeof opts.typed === "number" ||
    typeof opts.typed === "boolean"
  ) {
    return buildCell(text, styles, {
      ...opts,
      typed: undefined,
      num: typeof opts.typed === "number" ? opts.typed : undefined,
      bool: typeof opts.typed === "boolean" ? opts.typed : undefined,
      format,
    });
  } else if (typeof opts.typed === "string") {
    cell.v = opts.typed;
    cell.m = opts.typed;
    cell.ct = { fa: "General", t: "g" };
  } else {
    const mask = genarate(text);
    if (mask) {
      [cell.m, cell.ct, cell.v] = mask as any;
      if (format && typeof cell.v === "number") {
        cell.ct = { fa: format, t: numberType(format) };
        cell.m = update(format, cell.v);
      }
    }
    if (text.indexOf("\n") >= 0) cell.tb = "2";
  }

  // font
  const fw = (styles["font-weight"] || "").toLowerCase();
  if (
    opts.tags.b ||
    fw === "bold" ||
    fw === "bolder" ||
    (parseInt(fw, 10) || 0) >= 600
  ) {
    cell.bl = 1;
  }
  const fst = (styles["font-style"] || "").toLowerCase();
  if (opts.tags.i || fst === "italic" || fst === "oblique") cell.it = 1;
  const deco = `${styles["text-decoration"] || ""} ${
    styles["text-decoration-line"] || ""
  }`.toLowerCase();
  if (opts.tags.u || deco.includes("underline")) cell.un = 1;
  if (opts.tags.s || deco.includes("line-through")) cell.cl = 1;
  const color = normalizeColor(styles.color);
  if (color && color !== "#000000") cell.fc = color;
  // Excel writes a solid fill as `background:#rrggbb; mso-pattern:auto none`
  const bg = normalizeColor(styles["background-color"] || styles.background);
  if (bg) cell.bg = bg;
  if (styles["font-size"]) {
    const pt = toPt(styles["font-size"]);
    if (pt != null && pt > 0) cell.fs = Math.round(pt * 2) / 2;
  }
  const family = (styles["font-family"] || "")
    .split(",")
    .map((f) => stripCssString(f.trim()))
    .filter(Boolean);
  if (family.length > 0) {
    const known = family.find((f) => opts.fontjson?.[f.toLowerCase()] != null);
    if (known) cell.ff = opts.fontjson![known.toLowerCase()];
    else if (!/^(auto|inherit|serif|sans-serif|monospace)$/i.test(family[0])) {
      [cell.ff] = family;
    }
  }

  // alignment
  const ta = (styles["text-align"] || "").toLowerCase();
  if (ta === "center" || ta === "centre" || ta === "center-across") cell.ht = 0;
  else if (ta === "left" || ta === "start") cell.ht = 1;
  else if (ta === "right" || ta === "end") cell.ht = 2;
  const va = (styles["vertical-align"] || "").toLowerCase();
  if (va === "middle" || va === "center") cell.vt = 0;
  else if (va === "top" || va === "text-top") cell.vt = 1;
  else if (va === "bottom" || va === "text-bottom") cell.vt = 2;
  const ws = (styles["white-space"] || "").toLowerCase();
  const wrap =
    ws === "normal" ||
    ws === "pre-wrap" ||
    ws === "break-spaces" ||
    (styles["overflow-wrap"] || styles["word-wrap"] || "").includes(
      "break-word"
    ) ||
    (styles["wrap-strategy"] || "") === "4";
  if (wrap) cell.tb = "2";
  if (styles["mso-rotate"] != null) {
    const rt = parseFloat(styles["mso-rotate"]);
    if (!Number.isNaN(rt) && rt !== 0) cell.rt = rt;
  }
  return cell;
}

/** Borders of a td from its styles. */
function cellBorders(styles: Record<string, string>) {
  const all = parseBorder(styles.border);
  const side = (name: string) => {
    const key = `border-${name}`;
    if (styles[key] != null) return parseBorder(styles[key]);
    return all;
  };
  return {
    t: side("top"),
    b: side("bottom"),
    l: side("left"),
    r: side("right"),
  };
}

/**
 * Parse clipboard HTML containing a table (Excel, Google Sheets, WPS,
 * LibreOffice, web pages) into cells, borders and sizes. Returns null when
 * there is no table.
 */
export function parseClipboardHtml(
  html: string,
  options: { fontjson?: Record<string, number> } = {}
): ParsedClipboard | null {
  if (!html || html.toLowerCase().indexOf("<table") < 0) return null;
  const source = detectSource(html);
  const doc = new DOMParser().parseFromString(html, "text/html");
  const table = doc.querySelector("table");
  if (!table) return null;

  // stylesheet rules; Google's generic `td { border: 1px solid #ccc }` is
  // its gridlines, not cell borders
  let rules: Record<string, Record<string, string>> = {};
  doc.querySelectorAll("style").forEach((st) => {
    rules = { ...rules, ...parseStyleSheet(st.textContent || "") };
  });
  if (source === "google" && rules.td) {
    rules.td = _.omitBy(rules.td, (_v, k) => k.startsWith("border"));
  }
  const tableStyles = parseCssDeclarations(table.getAttribute("style") || "");
  const inherited: Record<string, string> = _.pick(tableStyles, [
    "font-size",
    "font-family",
    "color",
  ]);

  const trs = Array.from(table.querySelectorAll("tr")).filter(
    (tr) => tr.closest("table") === table
  );
  const cells: CellMatrix = [];
  const borders: ParsedBorders = {};
  const rowHeights: (number | undefined)[] = [];
  const taken: boolean[][] = [];
  let width = 0;

  const setBorder = (
    r: number,
    c: number,
    key: "l" | "r" | "t" | "b",
    b: BorderSide | null
  ) => {
    if (!b) return;
    if (!borders[`${r}_${c}`]) borders[`${r}_${c}`] = {};
    borders[`${r}_${c}`][key] = b;
  };

  trs.forEach((tr, r) => {
    if (!cells[r]) cells[r] = [];
    if (!taken[r]) taken[r] = [];
    const trStyles = parseCssDeclarations(tr.getAttribute("style") || "");
    const hAttr = tr.getAttribute("height");
    const hPt = trStyles.height ? toPt(trStyles.height) : null;
    if (hPt != null) rowHeights[r] = Math.round(hPt / 0.75);
    else if (hAttr) rowHeights[r] = parseInt(hAttr, 10);

    let c = 0;
    Array.from(tr.children).forEach((td) => {
      const tag = td.tagName.toUpperCase();
      if (tag !== "TD" && tag !== "TH") return;
      while (taken[r][c]) c += 1;
      const rs = Math.max(
        1,
        parseInt(td.getAttribute("rowspan") || "1", 10) || 1
      );
      const cs = Math.max(
        1,
        parseInt(td.getAttribute("colspan") || "1", 10) || 1
      );

      // cascade: td rule < tag-qualified/class rules < inline style
      let styles: Record<string, string> = {
        ...inherited,
        ...(rules.td || {}),
      };
      if (tag === "TH") styles = { ...styles, ...(rules.th || {}) };
      (td.getAttribute("class") || "")
        .split(/\s+/)
        .filter(Boolean)
        .forEach((cls) => {
          const k = cls.toLowerCase();
          styles = {
            ...styles,
            ...(rules[`.${k}`] || {}),
            ...(rules[`td.${k}`] || {}),
          };
        });
      styles = {
        ...styles,
        ...parseCssDeclarations(td.getAttribute("style") || ""),
      };
      // legacy presentational attributes
      // (Excel/WPS write align=right for numbers under General alignment;
      // their explicit alignment is in the CSS)
      const align = td.getAttribute("align");
      if (
        align &&
        !styles["text-align"] &&
        source !== "excel" &&
        source !== "wps"
      ) {
        styles["text-align"] = align;
      }
      const valign = td.getAttribute("valign");
      if (valign && !styles["vertical-align"])
        styles["vertical-align"] = valign;
      const bgAttr = td.getAttribute("bgcolor");
      if (bgAttr && !styles.background && !styles["background-color"]) {
        styles["background-color"] = bgAttr;
      }
      if (tag === "TH" && !styles["font-weight"]) styles["font-weight"] = "700";

      const only = (sel: string) => {
        const el = td.querySelector(sel);
        return (
          !!el &&
          (el.textContent || "").trim() === (td.textContent || "").trim()
        );
      };
      const text = elementText(td);
      const xnum = td.getAttribute("x:num");
      const xbool = td.getAttribute("x:bool");
      const hasXStr = td.hasAttribute("x:str");
      const sdval = td.getAttribute("sdval"); // LibreOffice
      let num: number | undefined;
      if (xnum != null && xnum !== "") num = parseFloat(xnum);
      else if (sdval != null && sdval !== "") num = parseFloat(sdval);
      const cell = buildCell(text, styles, {
        num: num != null && !Number.isNaN(num) ? num : undefined,
        bool: xbool != null ? xbool.toUpperCase() === "TRUE" : undefined,
        forceText: hasXStr && xnum == null,
        typed: typedFromGoogle(td.getAttribute("data-sheets-value")),
        format: googleNumberFormat(td.getAttribute("data-sheets-numberformat")),
        fontjson: options.fontjson,
        tags: {
          b: only("b, strong"),
          i: only("i, em"),
          u: only("u"),
          s: only("s, strike, del"),
        },
      });

      const bd = cellBorders(styles);
      for (let i = 0; i < rs; i += 1) {
        if (!cells[r + i]) cells[r + i] = [];
        if (!taken[r + i]) taken[r + i] = [];
        for (let j = 0; j < cs; j += 1) {
          taken[r + i][c + j] = true;
          if (i === 0) setBorder(r, c + j, "t", bd.t);
          if (i === rs - 1) setBorder(r + i, c + j, "b", bd.b);
          if (j === 0) setBorder(r + i, c, "l", bd.l);
          if (j === cs - 1) setBorder(r + i, c + j, "r", bd.r);
          if (i === 0 && j === 0) continue;
          cells[r + i][c + j] = { mc: { r, c } };
        }
      }
      if (rs > 1 || cs > 1) cell.mc = { r, c, rs, cs };
      cells[r][c] = _.isEmpty(cell) ? null : cell;
      if (_.isEmpty(cell)) cells[r][c] = null;
      c += cs;
      width = Math.max(width, c);
    });
    width = Math.max(width, taken[r].length);
  });

  // rectangular matrix
  for (let r = 0; r < cells.length; r += 1) {
    if (!cells[r]) cells[r] = [];
    for (let c = 0; c < width; c += 1) {
      if (cells[r][c] === undefined) cells[r][c] = null;
    }
  }
  if (cells.length === 0 || width === 0) return null;

  // column widths from <col>
  const colWidths: (number | undefined)[] = [];
  let ci = 0;
  table.querySelectorAll("col").forEach((col) => {
    const span = Math.max(
      1,
      parseInt(col.getAttribute("span") || "1", 10) || 1
    );
    const st = parseCssDeclarations(col.getAttribute("style") || "");
    const wPt = st.width ? toPt(st.width) : null;
    const wAttr = col.getAttribute("width");
    let w: number | undefined;
    if (wAttr != null && /^\d+(\.\d+)?$/.test(wAttr)) w = parseFloat(wAttr);
    else if (wPt != null) w = wPt / 0.75;
    for (let k = 0; k < span; k += 1) {
      colWidths[ci] = w != null ? Math.round(w) : undefined;
      ci += 1;
    }
  });

  return { cells, borders, colWidths, rowHeights, source };
}
