/**
 * Headers and footers with Excel's formatting codes.
 *
 * A section's text is parsed into styled runs with the fields filled in:
 *
 *   &P page number (&P+n / &P-n offsets)   &N number of pages
 *   &D date   &T time   &F file name   &Z file path   &A sheet name
 *   &G picture (not printed)   && a literal "&"
 *   &B bold   &I italic   &U underline   &E double underline
 *   &S strikethrough   &X superscript   &Y subscript (toggles)
 *   &"Font,Style" font name and style   &nn font size in points
 *   &Krrggbb colour
 *
 * xlsx stores the three sections in one string (`&Lleft&Ccentre&Rright`).
 */
import type { HeaderFooterText } from "../types";

export type HeaderFooterRun = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  doubleUnderline?: boolean;
  strike?: boolean;
  superscript?: boolean;
  subscript?: boolean;
  font?: string;
  /** Size in points. */
  size?: number;
  color?: string;
};

export type HeaderFooterFields = {
  page: number;
  pages: number;
  date?: Date;
  sheetName?: string;
  fileName?: string;
  filePath?: string;
  /** Locale for &D / &T (browser default when omitted). */
  locale?: string;
};

type Style = Omit<HeaderFooterRun, "text">;

function formatDate(date: Date, locale?: string) {
  try {
    return date.toLocaleDateString(locale);
  } catch {
    return date.toDateString();
  }
}

function formatTime(date: Date, locale?: string) {
  try {
    return date.toLocaleTimeString(locale, {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return date.toTimeString().slice(0, 5);
  }
}

/** Parses one header/footer section into runs, fields substituted. */
export function parseHeaderFooterSection(
  text: string | undefined,
  fields: HeaderFooterFields
): HeaderFooterRun[] {
  const runs: HeaderFooterRun[] = [];
  if (!text) return runs;
  let style: Style = {};
  let buf = "";
  const flush = () => {
    if (!buf) return;
    const last = runs[runs.length - 1];
    const same =
      last &&
      JSON.stringify({ ...last, text: "" }) ===
        JSON.stringify({ ...style, text: "" });
    if (same) last.text += buf;
    else runs.push({ ...style, text: buf });
    buf = "";
  };
  const restyle = (next: Style) => {
    flush();
    style = next;
  };
  const date = fields.date ?? new Date();
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch !== "&" || i === text.length - 1) {
      buf += ch;
      continue;
    }
    const code = text[i + 1];
    i += 1;
    switch (code) {
      case "&":
        buf += "&";
        break;
      case "P":
      case "p": {
        const m = /^([+-])(\d+)/.exec(text.slice(i + 1));
        let n = fields.page;
        if (m) {
          n += (m[1] === "+" ? 1 : -1) * Number(m[2]);
          i += m[0].length;
        }
        buf += String(n);
        break;
      }
      case "N":
      case "n":
        buf += String(fields.pages);
        break;
      case "D":
      case "d":
        buf += formatDate(date, fields.locale);
        break;
      case "T":
      case "t":
        buf += formatTime(date, fields.locale);
        break;
      case "F":
      case "f":
        buf += fields.fileName ?? "";
        break;
      case "Z":
      case "z":
        buf += fields.filePath ?? "";
        break;
      case "A":
      case "a":
        buf += fields.sheetName ?? "";
        break;
      case "G":
      case "g":
        break;
      case "B":
      case "b":
        restyle({ ...style, bold: !style.bold });
        break;
      case "I":
      case "i":
        restyle({ ...style, italic: !style.italic });
        break;
      case "U":
      case "u":
        restyle({ ...style, underline: !style.underline });
        break;
      case "E":
      case "e":
        restyle({ ...style, doubleUnderline: !style.doubleUnderline });
        break;
      case "S":
      case "s":
        restyle({ ...style, strike: !style.strike });
        break;
      case "X":
      case "x":
        restyle({ ...style, superscript: !style.superscript });
        break;
      case "Y":
      case "y":
        restyle({ ...style, subscript: !style.subscript });
        break;
      case "K":
      case "k": {
        const hex = /^[0-9A-Fa-f]{6}/.exec(text.slice(i + 1));
        const theme = /^\d\d[+-]\d{3}/.exec(text.slice(i + 1));
        if (hex) {
          restyle({ ...style, color: `#${hex[0].toLowerCase()}` });
          i += 6;
        } else if (theme) {
          i += theme[0].length;
        }
        break;
      }
      case '"': {
        const end = text.indexOf('"', i + 1);
        if (end < 0) {
          buf += text.slice(i + 1);
          i = text.length;
          break;
        }
        const [font, fontStyle = ""] = text.slice(i + 1, end).split(",");
        const next: Style = { ...style };
        if (font && font !== "-") next.font = font.trim();
        if (fontStyle) {
          const s = fontStyle.toLowerCase();
          next.bold = /bold/.test(s);
          next.italic = /italic|oblique/.test(s);
        }
        restyle(next);
        i = end;
        break;
      }
      default: {
        const size = /^\d{1,3}/.exec(text.slice(i));
        if (size) {
          restyle({ ...style, size: Number(size[0]) });
          i += size[0].length - 1;
        } else {
          // an unknown code prints nothing (as in Excel)
        }
      }
    }
  }
  flush();
  return runs;
}

/** Plain text of a section with the fields filled in. */
export function headerFooterPlainText(
  text: string | undefined,
  fields: HeaderFooterFields
) {
  return parseHeaderFooterSection(text, fields)
    .map((r) => r.text)
    .join("");
}

/** `{left, center, right}` -> the xlsx string (`&L...&C...&R...`). */
export function headerFooterToXlsx(hf?: HeaderFooterText | null) {
  if (!hf) return "";
  let out = "";
  if (hf.left) out += `&L${hf.left}`;
  if (hf.center) out += `&C${hf.center}`;
  if (hf.right) out += `&R${hf.right}`;
  return out;
}

/** The xlsx string -> `{left, center, right}` (text before a code is centred). */
export function headerFooterFromXlsx(text?: string | null): HeaderFooterText {
  const out: HeaderFooterText = {};
  if (!text) return out;
  let section: keyof HeaderFooterText = "center";
  let buf = "";
  const flush = () => {
    if (buf) out[section] = (out[section] ?? "") + buf;
    buf = "";
  };
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === "&" && i + 1 < text.length) {
      const code = text[i + 1];
      if (code === "L" || code === "C" || code === "R") {
        flush();
        section = ({ L: "left", C: "center", R: "right" } as const)[code];
        i += 1;
        continue;
      }
      // keep the code (and a quoted font name) verbatim
      if (code === '"') {
        const end = text.indexOf('"', i + 2);
        const stop = end < 0 ? text.length - 1 : end;
        buf += text.slice(i, stop + 1);
        i = stop;
        continue;
      }
      buf += ch + code;
      i += 1;
      continue;
    }
    buf += ch;
  }
  flush();
  return out;
}

/** Built-in header/footer choices of Excel's Header/Footer tab. */
export const HEADER_FOOTER_PRESETS: {
  key: string;
  value: HeaderFooterText;
}[] = [
  { key: "none", value: {} },
  { key: "page", value: { center: "Page &P" } },
  { key: "pageOf", value: { center: "Page &P of &N" } },
  { key: "sheet", value: { center: "&A" } },
  { key: "file", value: { center: "&F" } },
  { key: "sheetPage", value: { left: "&A", right: "Page &P" } },
  { key: "filePage", value: { left: "&F", right: "Page &P" } },
  { key: "dateTime", value: { left: "&D", right: "&T" } },
  {
    key: "confidential",
    value: { left: "Confidential", center: "&D", right: "Page &P" },
  },
];
