/**
 * Cell writers: values, formulas, number formats, fonts, fills, alignment,
 * rich text, hyperlinks and notes.
 */
import type ExcelJS from "@protobi/exceljs";
import {
  alignmentConvert,
  fillConvert,
  fontConvert,
  protectionConvert,
} from "./ExcelConvert";
import { cellAddress, toExcelFormula } from "../common/formulaText";
import type { SheetExportContext } from "./buildWorkbook";
import type { XlsxPostProcessContext } from "./postProcessors";
import {
  REL_NS,
  ensureNamespace,
  escapeXmlAttr,
  findElement,
  insertWorksheetElement,
} from "./xlsxParts";

const ERROR_VALUES = new Set([
  "#NULL!",
  "#DIV/0!",
  "#VALUE!",
  "#REF!",
  "#NAME?",
  "#NUM!",
  "#N/A",
  "#GETTING_DATA",
  "#SPILL!",
  "#CALC!",
  "#FIELD!",
  "#BLOCKED!",
  "#CONNECT!",
  "#BUSY!",
  "#UNKNOWN!",
]);

/** Excel's limit for the text of one cell. */
export const MAX_CELL_TEXT = 32767;

const clampText = (s: string) =>
  s.length > MAX_CELL_TEXT ? s.slice(0, MAX_CELL_TEXT) : s;

/** Rich-text runs cut to MAX_CELL_TEXT characters in total. */
function clampRuns(runs: ExcelJS.RichText[]) {
  let left = MAX_CELL_TEXT;
  const out: ExcelJS.RichText[] = [];
  runs.forEach((run) => {
    if (left <= 0) return;
    const text = run.text.length > left ? run.text.slice(0, left) : run.text;
    left -= text.length;
    out.push(text === run.text ? run : { ...run, text });
  });
  return out;
}

const isGeneral = (fa: any) =>
  fa == null || fa === "" || String(fa).toLowerCase() === "general";

function isInlineString(cell: any) {
  return cell?.ct?.t === "inlineStr" && Array.isArray(cell.ct.s);
}

function inlineText(cell: any) {
  return (cell.ct.s as any[]).map((run) => run?.v ?? "").join("");
}

function toNumber(v: any): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) {
    return Number(v);
  }
  return null;
}

function toBoolean(v: any): boolean | null {
  if (typeof v === "boolean") return v;
  if (v === 1 || v === "1" || String(v).toUpperCase() === "TRUE") return true;
  if (v === 0 || v === "0" || String(v).toUpperCase() === "FALSE") return false;
  return null;
}

function errorValue(v: any): ExcelJS.CellErrorValue | null {
  const s = String(v ?? "").toUpperCase();
  return ERROR_VALUES.has(s) ? ({ error: s } as ExcelJS.CellErrorValue) : null;
}

/** The plain (non-formula) value of a cell as ExcelJS understands it. */
export function plainCellValue(cell: any): ExcelJS.CellValue {
  if (isInlineString(cell)) return inlineText(cell);
  const { v } = cell;
  const t = cell.ct?.t;
  if (v == null || (typeof v === "number" && Number.isNaN(v))) {
    return cell.m != null && cell.m !== "" ? String(cell.m) : null;
  }
  if (t === "e" || (typeof v === "string" && errorValue(v) && t !== "s")) {
    return errorValue(v) ?? String(v);
  }
  if (t === "b" || typeof v === "boolean") {
    const b = toBoolean(v);
    return b == null ? String(v) : b;
  }
  if (typeof v === "number") return v;
  if (t === "n" || t === "d") {
    const n = toNumber(v);
    if (n != null) return n;
  }
  return String(v);
}

function richText(cell: any): ExcelJS.RichText[] | null {
  const runs = (cell.ct.s as any[]).filter((run) => run && run.v != null);
  if (runs.length === 0) return null;
  const styled = runs.some((run) => fontConvert(run));
  if (!styled) return null;
  return runs.map((run) => {
    const text: ExcelJS.RichText = {
      text: String(run.v).replace(/\r\n/g, "\n"),
    };
    const font = fontConvert(run);
    if (font) text.font = font;
    return text;
  });
}

function quoteSheet(name: string) {
  if (/^'.*'$/.test(name)) return name;
  if (
    /^[A-Za-z_][A-Za-z0-9_.]*$/.test(name) &&
    !/^[A-Za-z]{1,3}\d+$/.test(name)
  )
    return name;
  return `'${name.replace(/'/g, "''")}'`;
}

/**
 * Hyperlink target for ExcelJS. Internal targets start with "#" and are
 * turned into `location` attributes by postProcessXlsx.
 */
export function hyperlinkTarget(link: any, sheetName: string): string | null {
  const address = String(link?.linkAddress ?? "").trim();
  if (!address) return null;
  if (link.linkType === "sheet") return `#${quoteSheet(address)}!A1`;
  if (link.linkType === "cellrange") {
    const bang = address.lastIndexOf("!");
    if (bang > 0) {
      return `#${quoteSheet(address.slice(0, bang))}!${address.slice(
        bang + 1
      )}`;
    }
    return `#${quoteSheet(sheetName)}!${address}`;
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(address)) return address;
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address)) return `mailto:${address}`;
  return `https://${address}`;
}

function spillRef(cell: any, r: number, c: number) {
  const { spill } = cell;
  if (!spill || spill.blocked) return null;
  const rs = Math.max(1, Number(spill.rs) || 1);
  const cs = Math.max(1, Number(spill.cs) || 1);
  if (rs === 1 && cs === 1) return null;
  return `${cellAddress(r, c)}:${cellAddress(r + rs - 1, c + cs - 1)}`;
}

function formulaValue(
  ctx: SheetExportContext,
  cell: any,
  r: number,
  c: number
): ExcelJS.CellFormulaValue {
  const { formula, dynamic } = toExcelFormula(String(cell.f));
  let result: any = plainCellValue(cell);
  if (typeof result === "string") result = clampText(result);
  if (result && typeof result === "object" && !("error" in result)) {
    result = undefined;
  }
  const value: any = { formula, result: result ?? undefined };
  const ref = spillRef(cell, r, c);
  if (ref || dynamic || cell.spill) {
    value.shareType = "array";
    value.ref = ref ?? cellAddress(r, c);
    const { id } = ctx.worksheet;
    (ctx.post.dynamicArrayCells[id] ||= []).push(cellAddress(r, c));
  }
  return value;
}

function writeCell(ctx: SheetExportContext, cell: any, r: number, c: number) {
  const { worksheet, sheet } = ctx;
  const target = worksheet.getCell(r + 1, c + 1);

  const font = fontConvert(cell);
  if (font) target.font = font as ExcelJS.Font;
  const fill = fillConvert(cell.bg);
  if (fill) target.fill = fill;
  const alignment = alignmentConvert(cell);
  if (alignment) target.alignment = alignment as ExcelJS.Alignment;
  const fa = cell.ct?.fa;
  if (!isGeneral(fa)) target.numFmt = String(fa);
  const protection = protectionConvert(cell);
  if (protection) target.protection = protection;

  // Merge slaves only carry style.
  const { mc } = cell;
  if (mc && (mc.r !== r || mc.c !== c)) return;

  if (cell.f != null && String(cell.f).trim() !== "") {
    target.value = formulaValue(ctx, cell, r, c);
    return;
  }

  const link = sheet.hyperlink?.[`${r}_${c}`];
  const target_ = link ? hyperlinkTarget(link, worksheet.name) : null;
  if (target_) {
    const text = plainCellValue(cell);
    target.value = {
      text: clampText(text == null ? String(link.linkAddress) : String(text)),
      hyperlink: target_,
      ...(link.linkTooltip ? { tooltip: String(link.linkTooltip) } : {}),
    } as ExcelJS.CellHyperlinkValue;
    return;
  }

  if (isInlineString(cell)) {
    const rich = richText(cell);
    target.value = rich
      ? ({ richText: clampRuns(rich) } as ExcelJS.CellRichTextValue)
      : clampText(inlineText(cell).replace(/\r\n/g, "\n"));
    return;
  }

  // longer text makes Excel "repair" the file
  const value = plainCellValue(cell);
  if (value != null)
    target.value = typeof value === "string" ? clampText(value) : value;
}

/** Values, formulas, styles and hyperlinks of every cell. */
export function writeCells(ctx: SheetExportContext) {
  const { data } = ctx;
  for (let r = 0; r < data.length; r += 1) {
    const row = data[r];
    if (!row) continue;
    for (let c = 0; c < row.length; c += 1) {
      const cell = row[c];
      if (cell == null || typeof cell !== "object") continue;
      writeCell(ctx, cell, r, c);
    }
  }
  collectLinksWithoutValue(ctx);
}

const LINKS_FEATURE = "cell-hyperlinks";

type PendingLink = {
  ref: string;
  target: string;
  tooltip?: string;
};

/**
 * ExcelJS writes a hyperlink only as a cell value, so links on formula
 * cells and on empty cells are dropped; they are recorded here and added
 * by the "cell-hyperlinks" zip post-processor.
 */
function collectLinksWithoutValue(ctx: SheetExportContext) {
  const { sheet, data, worksheet, post } = ctx;
  const links = sheet?.hyperlink;
  if (!links) return;
  const pending: PendingLink[] = [];
  Object.keys(links).forEach((key) => {
    const [r, c] = key.split("_").map(Number);
    if (!Number.isInteger(r) || !Number.isInteger(c) || r < 0 || c < 0) return;
    const cell: any = data[r]?.[c];
    if (cell && typeof cell === "object") {
      const { mc } = cell;
      if (mc && (mc.r !== r || mc.c !== c)) return;
      if (cell.f == null || String(cell.f).trim() === "") return;
    }
    const target = hyperlinkTarget(links[key], worksheet.name);
    if (!target) return;
    const tooltip = links[key]?.linkTooltip;
    pending.push({
      ref: cellAddress(r, c),
      target,
      ...(tooltip ? { tooltip: String(tooltip) } : {}),
    });
  });
  if (pending.length === 0) return;
  const features = (post.features ||= {});
  const bySheet = (features[LINKS_FEATURE] ||= {}) as Record<
    number,
    PendingLink[]
  >;
  bySheet[worksheet.id] = pending;
}

const HYPERLINK_REL =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink";

/** Zip post-processor: the links collectLinksWithoutValue recorded. */
export async function addCellHyperlinks(ctx: XlsxPostProcessContext) {
  const bySheet: Record<number, PendingLink[]> | undefined =
    ctx.post.features?.[LINKS_FEATURE];
  if (!bySheet) return;
  // one sheet at a time: each adds to its own .rels part
  /* eslint-disable no-await-in-loop */
  for (const [id, links] of Object.entries(bySheet)) {
    const path = `xl/worksheets/sheet${id}.xml`;
    let xml = await ctx.readText(path);
    if (xml == null) continue;
    let items = "";
    for (const link of links) {
      const tip = link.tooltip
        ? ` tooltip="${escapeXmlAttr(link.tooltip)}"`
        : "";
      if (link.target.startsWith("#")) {
        items += `<hyperlink ref="${link.ref}" location="${escapeXmlAttr(
          link.target.slice(1)
        )}"${tip}/>`;
      } else {
        const rid = await ctx.addRelationship(
          path,
          HYPERLINK_REL,
          link.target,
          true
        );
        items += `<hyperlink ref="${link.ref}" r:id="${rid}"${tip}/>`;
      }
    }
    xml = ensureNamespace(xml, "r", REL_NS);
    const existing = findElement(xml, "hyperlinks");
    if (existing) {
      const inner = existing.text.endsWith("/>")
        ? `<hyperlinks>${items}</hyperlinks>`
        : existing.text.replace(/<\/hyperlinks>$/, `${items}</hyperlinks>`);
      xml = xml.slice(0, existing.start) + inner + xml.slice(existing.end);
    } else {
      xml = insertWorksheetElement(
        xml,
        "hyperlinks",
        `<hyperlinks>${items}</hyperlinks>`
      );
    }
    ctx.writeText(path, xml);
  }
  /* eslint-enable no-await-in-loop */
}

/**
 * Cell notes (TinySheet comments, `cell.ps`). Notes shown permanently
 * (`isShow`) are made visible by postProcessXlsx.
 */
export function writeNotes(ctx: SheetExportContext) {
  const { data, worksheet, post } = ctx;
  for (let r = 0; r < data.length; r += 1) {
    const row = data[r];
    if (!row) continue;
    for (let c = 0; c < row.length; c += 1) {
      const note = row[c]?.ps;
      if (note?.value == null || String(note.value) === "") continue;
      worksheet.getCell(r + 1, c + 1).note = String(note.value);
      if (note.isShow) {
        const shown = (post.visibleNotes ||= {});
        (shown[worksheet.id] ||= []).push({ r, c });
      }
    }
  }
}
