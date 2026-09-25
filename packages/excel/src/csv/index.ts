/**
 * CSV / TSV import and export.
 *
 * Lives in the excel package (next to xlsx I/O) so that core stays free of
 * file-format code; typed values go through core's Excel-compatible input
 * parser (`genarate`), after a locale normalisation step that rewrites
 * "1.234,5" / "31.12.2024" style input into the en-US form that parser
 * understands.
 *
 * Import: `parseCsv(file)` (async, bytes/Blob/string) or `csvToSheet(text)`.
 * Export: `sheetToCsv(sheet)` / `exportCsv(sheet)` (Blob).
 */
import { formatValue, genarate } from "@lofcz/tinysheet-core";

export type CsvDelimiter = "," | ";" | "\t" | "|";
export type CsvEncoding =
  | "auto"
  | "utf-8"
  | "utf-16le"
  | "utf-16be"
  | "windows-1252";
export type CsvDateOrder = "MDY" | "DMY" | "YMD";

export type CsvParseOptions = {
  /** Field delimiter, or "auto" (default) to sniff , ; tab and |. */
  delimiter?: CsvDelimiter | string | "auto";
  /** Byte decoding for binary input; "auto" (default) uses the BOM / UTF-8 validity. */
  encoding?: CsvEncoding;
  /**
   * Decimal separator of numbers in the file. "auto" (default): "," when the
   * delimiter is ";" (the usual European export), otherwise ".".
   */
  decimalSeparator?: "." | "," | "auto";
  /** Thousands separator; defaults to "," for "." decimals and "." for "," decimals. Spaces are always accepted. */
  thousandsSeparator?: string;
  /** Order of numeric dates such as 01/02/2024. Default "MDY" ("DMY" when decimalSeparator is ","). */
  dateOrder?: CsvDateOrder;
  /** Recognise numbers, dates, booleans and errors (default true). When false every field is text. */
  parseValues?: boolean;
  /** Keep "=..." fields as formulas (default false: imported as text, which avoids CSV formula injection). */
  parseFormulas?: boolean;
  /** Name of the created sheet (default "Sheet1"). */
  sheetName?: string;
};

export type CsvExportOptions = {
  /** Field delimiter (default ","; use "\t" for TSV). */
  delimiter?: string;
  /** "displayed" (default): what the cell shows; "raw": the stored value. */
  values?: "displayed" | "raw";
  /** Write formulas ("=SUM(A1:A3)") instead of their values (default false). */
  formulas?: boolean;
  /** Line ending (default "\r\n", as Excel writes). */
  lineEnding?: "\r\n" | "\n";
  /** Prefix a UTF-8 byte order mark when producing bytes (default true, so Excel detects UTF-8). */
  bom?: boolean;
};

// ---------------------------------------------------------------------------
// Decoding
// ---------------------------------------------------------------------------

const CP1252_HIGH: Record<number, number> = {
  0x80: 0x20ac,
  0x82: 0x201a,
  0x83: 0x0192,
  0x84: 0x201e,
  0x85: 0x2026,
  0x86: 0x2020,
  0x87: 0x2021,
  0x88: 0x02c6,
  0x89: 0x2030,
  0x8a: 0x0160,
  0x8b: 0x2039,
  0x8c: 0x0152,
  0x8e: 0x017d,
  0x91: 0x2018,
  0x92: 0x2019,
  0x93: 0x201c,
  0x94: 0x201d,
  0x95: 0x2022,
  0x96: 0x2013,
  0x97: 0x2014,
  0x98: 0x02dc,
  0x99: 0x2122,
  0x9a: 0x0161,
  0x9b: 0x203a,
  0x9c: 0x0153,
  0x9e: 0x017e,
  0x9f: 0x0178,
};

function decodeWindows1252(bytes: Uint8Array) {
  let out = "";
  for (let i = 0; i < bytes.length; i += 1) {
    const b = bytes[i];
    out += String.fromCharCode(CP1252_HIGH[b] ?? b);
  }
  return out;
}

function decodeUtf16(bytes: Uint8Array, littleEndian: boolean) {
  let out = "";
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    out += String.fromCharCode(
      littleEndian
        ? bytes[i] | (bytes[i + 1] << 8)
        : (bytes[i] << 8) | bytes[i + 1]
    );
  }
  return out;
}

function decodeUtf8(bytes: Uint8Array, fatal: boolean) {
  return new TextDecoder("utf-8", { fatal }).decode(bytes);
}

/** UTF-16 without a BOM: lots of zero bytes on one side of each pair. */
function guessUtf16(bytes: Uint8Array): "utf-16le" | "utf-16be" | null {
  const n = Math.min(bytes.length - (bytes.length % 2), 2048);
  if (n < 4) return null;
  let evenZeros = 0;
  let oddZeros = 0;
  for (let i = 0; i < n; i += 2) {
    if (bytes[i] === 0) evenZeros += 1;
    if (bytes[i + 1] === 0) oddZeros += 1;
  }
  const pairs = n / 2;
  if (oddZeros > pairs * 0.4 && evenZeros < pairs * 0.05) return "utf-16le";
  if (evenZeros > pairs * 0.4 && oddZeros < pairs * 0.05) return "utf-16be";
  return null;
}

/**
 * Decode CSV bytes. "auto" honours a BOM (UTF-8, UTF-16 LE/BE), detects
 * BOM-less UTF-16, then uses UTF-8 when the bytes are valid UTF-8 and
 * Windows-1252 otherwise.
 */
export function decodeCsvBytes(
  input: ArrayBuffer | Uint8Array,
  encoding: CsvEncoding = "auto"
): { text: string; encoding: Exclude<CsvEncoding, "auto"> } {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  let enc = encoding;
  let start = 0;
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    if (enc === "auto" || enc === "utf-8") {
      enc = "utf-8";
      start = 3;
    }
  } else if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    if (enc === "auto" || enc === "utf-16le") {
      enc = "utf-16le";
      start = 2;
    }
  } else if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    if (enc === "auto" || enc === "utf-16be") {
      enc = "utf-16be";
      start = 2;
    }
  }
  const body = bytes.subarray(start);
  if (enc === "auto") enc = guessUtf16(body) ?? "auto";
  switch (enc) {
    case "utf-16le":
      return { text: decodeUtf16(body, true), encoding: enc };
    case "utf-16be":
      return { text: decodeUtf16(body, false), encoding: enc };
    case "windows-1252":
      return { text: decodeWindows1252(body), encoding: enc };
    case "utf-8":
      return { text: decodeUtf8(body, false), encoding: enc };
    default:
      try {
        return { text: decodeUtf8(body, true), encoding: "utf-8" };
      } catch (e) {
        return { text: decodeWindows1252(body), encoding: "windows-1252" };
      }
  }
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/**
 * RFC 4180 parsing: quoted fields may contain delimiters, doubled quotes and
 * line breaks; CRLF, LF and CR all end a record. A trailing empty line is
 * dropped.
 */
export function parseCsvText(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let fieldStarted = false;
  const s = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"' && !fieldStarted) {
      inQuotes = true;
      fieldStarted = true;
    } else if (s.startsWith(delimiter, i)) {
      row.push(field);
      field = "";
      fieldStarted = false;
      i += delimiter.length - 1;
    } else if (ch === "\r" || ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      fieldStarted = false;
      if (ch === "\r" && s[i + 1] === "\n") i += 1;
    } else {
      field += ch;
      fieldStarted = true;
    }
  }
  if (fieldStarted || field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const CANDIDATES: CsvDelimiter[] = [",", ";", "\t", "|"];

/**
 * Pick the delimiter that splits the first lines into the most consistent
 * number of fields (quote aware). Ties prefer , then ; then tab then |.
 */
export function sniffDelimiter(text: string): CsvDelimiter {
  const sample = text.slice(0, 64 * 1024);
  let best: CsvDelimiter = ",";
  let bestScore = 0;
  CANDIDATES.forEach((d) => {
    const rows = parseCsvText(sample, d)
      .slice(0, 50)
      .filter((r) => !(r.length === 1 && r[0] === ""));
    if (rows.length === 0) return;
    const counts = new Map<number, number>();
    rows.forEach((r) => counts.set(r.length, (counts.get(r.length) || 0) + 1));
    let mode = 1;
    let modeCount = 0;
    counts.forEach((n, len) => {
      if (n > modeCount || (n === modeCount && len > mode)) {
        mode = len;
        modeCount = n;
      }
    });
    if (mode < 2) return;
    const consistency = modeCount / rows.length;
    const score = consistency * consistency * Math.min(mode, 50);
    if (score > bestScore + 1e-9) {
      best = d;
      bestScore = score;
    }
  });
  return best;
}

const DATE_RE = /^(\d{1,4})([./-])(\d{1,2})\2(\d{1,4})(.*)$/;

/**
 * Rewrite a locale-formatted field into the en-US form core's input parser
 * understands. Only unambiguous numeric and numeric-date shapes are touched.
 */
export function normalizeLocaleInput(
  text: string,
  decimal: "." | ",",
  thousands: string,
  dateOrder: CsvDateOrder
): string {
  const s = text.trim();
  const date = DATE_RE.exec(s);
  if (date && dateOrder !== "MDY") {
    const [, a, , b, c, rest] = date;
    if (
      dateOrder === "DMY" &&
      a.length <= 2 &&
      (c.length === 2 || c.length === 4)
    ) {
      return `${b}/${a}/${c}${rest}`;
    }
    if (dateOrder === "YMD" && a.length === 4 && c.length <= 2) {
      return `${b}/${c}/${a}${rest}`;
    }
  }
  if (date && dateOrder === "MDY" && date[2] === ".") {
    return `${date[1]}/${date[3]}/${date[4]}${date[5]}`;
  }

  const groups = [thousands, " ", " ", " "]
    .filter(Boolean)
    .map((g) => g.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  const dec = decimal === "," ? "," : "\\.";
  const num = new RegExp(
    `^([^\\d]*?)(\\d{1,3}(?:(?:${groups})\\d{3})+|\\d+)(?:${dec}(\\d+))?([^\\d]*)$`
  ).exec(s);
  if (!num) return text;
  const [, prefix, intPart, frac, suffix] = num;
  if (/[\d]/.test(prefix + suffix)) return text;
  // Prefix/suffix may only be signs, currency, percent, parentheses, spaces.
  if (!/^[\s+\-($€£¥₹₩₽¢]*$/.test(prefix) || !/^[\s%)€£¥₹₩₽¢-]*$/.test(suffix))
    return text;
  const digits = intPart.replace(new RegExp(groups, "g"), "");
  return `${prefix}${digits}${frac != null ? `.${frac}` : ""}${suffix}`;
}

export type CsvSheet = {
  name: string;
  celldata: { r: number; c: number; v: any }[];
  config: Record<string, any>;
  row?: number;
  column?: number;
  order: number;
  status: number;
};

type ParseSettings = {
  decimal: "." | ",";
  thousands: string;
  dateOrder: CsvDateOrder;
  parseValues: boolean;
  parseFormulas: boolean;
};

function makeCell(raw: string, options: Required<ParseSettings>): any | null {
  if (raw === "") return null;
  if (!options.parseValues) {
    return { v: raw, m: raw, ct: { fa: "@", t: "s" } };
  }
  if (raw.startsWith("=") && raw.length > 1) {
    if (options.parseFormulas) return { f: raw, ct: { fa: "General", t: "g" } };
    return { v: raw, m: raw, ct: { fa: "@", t: "s" } };
  }
  const normalized = normalizeLocaleInput(
    raw,
    options.decimal,
    options.thousands,
    options.dateOrder
  );
  const parsed = genarate(normalized);
  if (!parsed) return { v: raw, m: raw, ct: { fa: "General", t: "g" } };
  const [m, ct, v] = parsed;
  if (ct.t === "g" || ct.t === "s") {
    // Keep the original text (normalisation only applies to values).
    return { v: raw, m: raw, ct: { fa: "General", t: "g" } };
  }
  let { fa } = ct;
  let display = m;
  if (ct.t === "d" && options.dateOrder === "DMY") {
    const swapped = fa.replace(/^(m{1,2})([/.-])(d{1,2})\2/, "$3$2$1$2");
    if (swapped !== fa) {
      fa = swapped;
      display = formatValue(fa, v);
    }
  }
  return { v, m: display, ct: { fa, t: ct.t } };
}

/** Parse CSV text into a TinySheet sheet (celldata). */
export function csvToSheet(
  text: string,
  options: CsvParseOptions = {}
): CsvSheet & { delimiter: string } {
  const delimiter =
    !options.delimiter || options.delimiter === "auto"
      ? sniffDelimiter(text)
      : options.delimiter;
  let decimal: "." | "," = delimiter === ";" ? "," : ".";
  if (options.decimalSeparator && options.decimalSeparator !== "auto") {
    decimal = options.decimalSeparator;
  }
  const settings: Required<ParseSettings> = {
    decimal,
    thousands: options.thousandsSeparator ?? (decimal === "," ? "." : ","),
    dateOrder: options.dateOrder ?? (decimal === "," ? "DMY" : "MDY"),
    parseValues: options.parseValues !== false,
    parseFormulas: !!options.parseFormulas,
  };
  const rows = parseCsvText(text, delimiter);
  const celldata: CsvSheet["celldata"] = [];
  let columns = 0;
  rows.forEach((fields, r) => {
    columns = Math.max(columns, fields.length);
    fields.forEach((raw, c) => {
      const v = makeCell(raw, settings);
      if (v) celldata.push({ r, c, v });
    });
  });
  return {
    name: options.sheetName || "Sheet1",
    celldata,
    config: {},
    order: 0,
    status: 1,
    delimiter,
  };
}

/** Parse a CSV/TSV file (Blob, bytes or text) into import sheets. */
export async function parseCsv(
  file: Blob | ArrayBuffer | Uint8Array | string,
  options: CsvParseOptions = {}
) {
  let text: string;
  if (typeof file === "string") {
    text = file;
  } else if (file instanceof ArrayBuffer || file instanceof Uint8Array) {
    text = decodeCsvBytes(file, options.encoding).text;
  } else {
    text = decodeCsvBytes(await file.arrayBuffer(), options.encoding).text;
  }
  const { delimiter, ...sheet } = csvToSheet(text, options);
  return { sheet, delimiter };
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

function cellMatrix(sheet: any): any[][] {
  if (Array.isArray(sheet?.data)) return sheet.data;
  const matrix: any[][] = [];
  (sheet?.celldata || []).forEach((cell: any) => {
    if (!matrix[cell.r]) matrix[cell.r] = [];
    matrix[cell.r][cell.c] = cell.v;
  });
  return matrix;
}

function rawText(cell: any): string {
  const { v } = cell;
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (typeof v === "number") return String(v);
  if (cell.ct?.t === "b" && v != null) {
    return String(v).toUpperCase() === "TRUE" || v === 1 || v === "1"
      ? "TRUE"
      : "FALSE";
  }
  return v == null ? "" : String(v);
}

/** The text a cell contributes to a CSV file. */
export function cellCsvText(cell: any, options: CsvExportOptions = {}): string {
  if (cell == null) return "";
  if (typeof cell !== "object") return String(cell);
  if (options.formulas && cell.f) return String(cell.f);
  if (cell.ct?.t === "inlineStr" && Array.isArray(cell.ct.s)) {
    return cell.ct.s.map((run: any) => run?.v ?? "").join("");
  }
  if (options.values === "raw") return rawText(cell);
  if (cell.m != null && cell.m !== "") return String(cell.m);
  if (cell.v == null) return "";
  if (typeof cell.v === "number" && cell.ct?.fa) {
    return formatValue(cell.ct.fa, cell.v);
  }
  return rawText(cell);
}

function quoteField(text: string, delimiter: string) {
  if (
    text.includes(delimiter) ||
    /["\r\n]/.test(text) ||
    /^\s|\s$/.test(text)
  ) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/** Serialise a sheet (data or celldata) as CSV text (no BOM). */
export function sheetToCsv(sheet: any, options: CsvExportOptions = {}): string {
  const delimiter = options.delimiter ?? ",";
  const eol = options.lineEnding ?? "\r\n";
  const data = cellMatrix(sheet);
  const hiddenMergeSlave = (cell: any, r: number, c: number) =>
    cell?.mc && (cell.mc.r !== r || cell.mc.c !== c);
  const lines: string[] = [];
  let lastRow = -1;
  const rowTexts: string[][] = [];
  for (let r = 0; r < data.length; r += 1) {
    const row = data[r] || [];
    const texts: string[] = [];
    let last = -1;
    for (let c = 0; c < row.length; c += 1) {
      const cell = row[c];
      const text = hiddenMergeSlave(cell, r, c)
        ? ""
        : cellCsvText(cell, options);
      texts.push(text);
      if (text !== "") last = c;
    }
    rowTexts.push(texts.slice(0, last + 1));
    if (last >= 0) lastRow = r;
  }
  for (let r = 0; r <= lastRow; r += 1) {
    lines.push(
      rowTexts[r].map((t) => quoteField(t, delimiter)).join(delimiter)
    );
  }
  return lines.length ? lines.join(eol) + eol : "";
}

/** CSV bytes (UTF-8, with a BOM unless `bom: false`). */
export function sheetToCsvBytes(
  sheet: any,
  options: CsvExportOptions = {}
): Uint8Array {
  const text = sheetToCsv(sheet, options);
  const body = new TextEncoder().encode(text);
  if (options.bom === false) return body;
  const out = new Uint8Array(body.length + 3);
  out.set([0xef, 0xbb, 0xbf], 0);
  out.set(body, 3);
  return out;
}

export function exportCsv(sheet: any, options: CsvExportOptions = {}): Blob {
  const type =
    options.delimiter === "\t"
      ? "text/tab-separated-values;charset=utf-8"
      : "text/csv;charset=utf-8";
  return new Blob(
    [sheetToCsvBytes(sheet, options) as Uint8Array<ArrayBuffer>],
    { type }
  );
}
