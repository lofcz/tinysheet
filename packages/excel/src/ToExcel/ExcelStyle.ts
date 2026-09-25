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
      text: text == null ? String(link.linkAddress) : String(text),
      hyperlink: target_,
      ...(link.linkTooltip ? { tooltip: String(link.linkTooltip) } : {}),
    } as ExcelJS.CellHyperlinkValue;
    return;
  }

  if (isInlineString(cell)) {
    const rich = richText(cell);
    target.value = rich
      ? ({ richText: rich } as ExcelJS.CellRichTextValue)
      : inlineText(cell).replace(/\r\n/g, "\n");
    return;
  }

  const value = plainCellValue(cell);
  if (value != null) target.value = value;
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
