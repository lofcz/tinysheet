// Shared helpers for the node --test suites (they run against ../dist).
import JSZip from "jszip";
import ExcelJS from "@protobi/exceljs";
import { parseExcel, exportToXlsx } from "../dist/index.js";

export const XLSX_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Import xlsx bytes. */
export async function importXlsx(bytes, name = "book.xlsx") {
  return parseExcel(Buffer.from(bytes), name);
}

/** Export TinySheet sheets and import the result again. */
export async function roundTrip(sheets, options) {
  const bytes = await exportToXlsx(sheets, options);
  return { bytes, result: await importXlsx(bytes) };
}

/** Read xlsx bytes back with ExcelJS (to check what Excel sees). */
export async function readWithExcelJS(bytes) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(bytes));
  return wb;
}

export async function zipText(bytes, path) {
  const zip = await JSZip.loadAsync(Buffer.from(bytes));
  const file = zip.file(path);
  return file ? file.async("string") : null;
}

export async function patchZip(bytes, patches) {
  const zip = await JSZip.loadAsync(Buffer.from(bytes));
  for (const [path, fn] of Object.entries(patches)) {
    const file = zip.file(path);
    const text = file ? await file.async("string") : null;
    zip.file(path, fn(text));
  }
  return zip.generateAsync({ type: "nodebuffer" });
}

export async function excelJsBytes(workbook) {
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

/** Cell values of a parsed sheet keyed "r_c". */
export function cellMap(sheet) {
  const map = new Map();
  for (const cell of sheet.celldata || [])
    map.set(`${cell.r}_${cell.c}`, cell.v);
  return map;
}

export function sheetByName(result, name) {
  return result.sheets.find((s) => s.name === name);
}

const STYLE_KEYS = [
  "bl",
  "it",
  "cl",
  "un",
  "ff",
  "fs",
  "fc",
  "bg",
  "ht",
  "tb",
  "rt",
  "tr",
];

/** The parts of a cell that must survive a round trip. */
export function comparableCell(cell) {
  if (cell == null) return null;
  const out = {};
  if (cell.f != null) out.f = cell.f;
  if (cell.v != null) out.v = cell.v;
  if (cell.ct?.fa != null && !/^general$/i.test(cell.ct.fa))
    out.fa = cell.ct.fa;
  if (cell.ct?.t != null)
    out.t = cell.ct.t === "s" && cell.ct.fa !== "@" ? "g" : cell.ct.t;
  if (cell.ct?.t === "inlineStr") {
    out.s = cell.ct.s.map((run) => {
      const r = { v: run.v };
      for (const k of ["bl", "it", "cl", "un", "fc", "fs", "ff"]) {
        if (run[k] != null && run[k] !== 0)
          r[k] = typeof run[k] === "string" ? run[k].toUpperCase() : run[k];
      }
      return r;
    });
  }
  for (const key of STYLE_KEYS) {
    let value = cell[key];
    if (value == null) continue;
    // tb 1 (overflow) is the default; 0 is "off" except for ht (center).
    if (key === "tb" && String(value) === "1") continue;
    if (key !== "ht" && (value === 0 || value === "0")) continue;
    if (typeof value === "string" && value.startsWith("#"))
      value = value.toUpperCase();
    if (key === "fs") value = Number(value);
    out[key] =
      typeof value === "number" || key === "ff" ? value : String(value);
  }
  if (cell.ps?.value) out.note = cell.ps.value;
  if (cell.spill) out.spill = { rs: cell.spill.rs, cs: cell.spill.cs };
  if (cell.spillFrom) out.spillFrom = cell.spillFrom;
  if (cell.mc) out.mc = cell.mc;
  return out;
}

/** All comparable cells of a sheet, keyed "r_c", skipping empty ones. */
export function comparableSheet(sheet, { ignoreStyleOnly = false } = {}) {
  const out = {};
  for (const cell of sheet.celldata || []) {
    const c = comparableCell(cell.v);
    if (!c || Object.keys(c).length === 0) continue;
    if (
      ignoreStyleOnly &&
      c.v == null &&
      c.f == null &&
      !c.s &&
      !c.note &&
      !c.mc
    )
      continue;
    out[`${cell.r}_${cell.c}`] = c;
  }
  return out;
}
