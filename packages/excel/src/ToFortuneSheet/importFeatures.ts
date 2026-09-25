/**
 * xlsx -> TinySheet import hooks.
 *
 * The core of the importer (FortuneSheet / FortuneCell) reads cells, styles,
 * sizes, merges, drawings, validation and hyperlinks. Features that live in
 * their own part files (notes, and in the future defined names, conditional
 * formatting, charts, ...) are read by small functions registered here, so
 * other feature owners can add their reader without touching the cell code.
 *
 * Sheet readers run after a sheet was parsed, in array order; workbook
 * readers run once after every sheet was parsed.
 */
import { applyTableFormatting } from "@lofcz/tinysheet-core";
import { ReadXml, Element, IStyleCollections } from "./ReadXml";
import { IuploadfileList } from "../common/ICommon";
import { escapeCharacter, getcellrange } from "../common/method";
import { unqualifyStructuredReferences } from "../common/structuredRefs";
import type { FortuneSheet } from "./FortuneSheet";
import { readThreadedComments, threadedCommentCells } from "./threadedComments";
import { readPageSetup, readPrintNames } from "../common/pageSetup";
import { readCellImages } from "./FortuneCellImage";
import { importCalcProperties } from "../common/calcProperties";

export type WorkbookImportInfo = {
  date1904?: boolean;
};

export type SheetImportContext = {
  /** Parsed sheet (celldata, config, id, name, ...); readers mutate it. */
  sheet: FortuneSheet;
  /** Path of the worksheet part, e.g. "xl/worksheets/sheet1.xml". */
  sheetFile: string;
  readXml: ReadXml;
  files: IuploadfileList;
  styles: IStyleCollections;
  workbook: WorkbookImportInfo;
};

export type WorkbookImportContext = {
  sheets: FortuneSheet[];
  readXml: ReadXml;
  files: IuploadfileList;
  workbook: WorkbookImportInfo;
};

export type SheetImportFeature = {
  name: string;
  read: (ctx: SheetImportContext) => void;
};

export type WorkbookImportFeature = {
  name: string;
  read: (ctx: WorkbookImportContext) => void;
};

export type PartRelationship = { id: string; type: string; target: string };

export function resolvePartPath(baseDir: string, target: string) {
  if (target.startsWith("/")) return target.slice(1);
  const parts = baseDir.split("/").filter(Boolean);
  target.split("/").forEach((seg) => {
    if (seg === "..") parts.pop();
    else if (seg !== "." && seg !== "") parts.push(seg);
  });
  return parts.join("/");
}

/** Relationships of a part ("xl/worksheets/sheet1.xml" -> its .rels), targets resolved to zip paths. */
export function partRelationships(
  files: IuploadfileList,
  partPath: string
): PartRelationship[] {
  const slash = partPath.lastIndexOf("/");
  const dir = partPath.slice(0, slash);
  const relsPath = `${dir}/_rels/${partPath.slice(slash + 1)}.rels`;
  const xml = files[relsPath];
  if (!xml) return [];
  const rels: PartRelationship[] = [];
  (xml.match(/<Relationship\b[^>]*>/g) || []).forEach((el) => {
    const id = /\bId="([^"]*)"/.exec(el)?.[1];
    const type = /\bType="([^"]*)"/.exec(el)?.[1];
    const target = /\bTarget="([^"]*)"/.exec(el)?.[1];
    if (!id || !type || !target) return;
    if (/TargetMode="External"/.test(el)) {
      rels.push({ id, type, target: escapeCharacter(target) });
      return;
    }
    rels.push({ id, type, target: resolvePartPath(dir, target) });
  });
  return rels;
}

function textOf(element: Element) {
  const ts = element.getInnerElements("t") || [];
  const text = ts.map((t) => t.value || "").join("");
  return escapeCharacter(text)
    .replace(/_x000D_/g, "")
    .replace(/\r\n/g, "\n");
}

function setNote(
  sheet: FortuneSheet,
  ref: string,
  value: string,
  shown: Set<string>
) {
  const range = getcellrange(ref);
  if (range == null) return;
  const r = range.row[0];
  const c = range.column[0];
  let cell = sheet.celldata.find((item) => item.r === r && item.c === c);
  if (cell == null) {
    cell = { r, c, v: {} as any };
    sheet.celldata.push(cell);
  }
  if (cell.v == null || typeof cell.v !== "object") cell.v = {} as any;
  (cell.v as any).ps = {
    left: null,
    top: null,
    width: null,
    height: null,
    value,
    isShow: shown.has(`${r}_${c}`),
  };
}

const COMMENTS_REL = /\/comments$/;
const VML_REL = /\/vmlDrawing$/;

/** Cells ("r_c", 0-based) whose note shape is visible (`<x:Visible/>`). */
export function visibleVmlNotes(vml: string): Set<string> {
  const out = new Set<string>();
  (vml.match(/<v:shape\b[\s\S]*?<\/v:shape>/g) || []).forEach((shape) => {
    if (!/ObjectType="Note"/.test(shape) || !/<x:Visible\s*\/?>/.test(shape))
      return;
    const row = /<x:Row>\s*(\d+)\s*<\/x:Row>/.exec(shape)?.[1];
    const col = /<x:Column>\s*(\d+)\s*<\/x:Column>/.exec(shape)?.[1];
    if (row != null && col != null) out.add(`${row}_${col}`);
  });
  return out;
}

/**
 * Notes (legacy comments) -> `cell.ps`. The legacy placeholders of threaded
 * comments are skipped: threads are read by readThreadedComments.
 */
export function readNotes(ctx: SheetImportContext) {
  const rels = partRelationships(ctx.files, ctx.sheetFile);
  const notes = new Map<string, string>();

  rels
    .filter((x) => COMMENTS_REL.test(x.type) && ctx.files[x.target])
    .forEach((rel) => {
      ctx.readXml
        .getElementsByTagName("commentList/comment", rel.target)
        .forEach((comment) => {
          const { ref } = comment.attributeList;
          const text = comment.getInnerElements("text");
          if (!ref || text == null) return;
          notes.set(ref, textOf(text[0]));
        });
    });

  // cells with a threaded comment: their note is its legacy placeholder
  const threaded = threadedCommentCells(ctx);
  if (threaded.size > 0) {
    Array.from(notes.keys()).forEach((ref) => {
      const range = getcellrange(ref);
      if (range && threaded.has(`${range.row[0]}_${range.column[0]}`)) {
        notes.delete(ref);
      }
    });
  }

  // notes shown permanently (Show/Hide Note)
  const shown = new Set<string>();
  rels
    .filter((x) => VML_REL.test(x.type) && ctx.files[x.target])
    .forEach((rel) => {
      visibleVmlNotes(ctx.files[rel.target]).forEach((k) => shown.add(k));
    });

  notes.forEach((value, ref) => setNote(ctx.sheet, ref, value, shown));
}

const TABLE_REL = /\/table$/;

const TOTAL_FUNCTIONS = new Set([
  "sum",
  "average",
  "count",
  "countNums",
  "max",
  "min",
  "stdDev",
  "var",
  "custom",
]);

function xmlAttrs(tag: string) {
  const attrs: Record<string, string> = {};
  const re = /([\w:]+)="([^"]*)"/g;
  let m = re.exec(tag);
  while (m) {
    attrs[m[1]] = escapeCharacter(m[2]);
    m = re.exec(tag);
  }
  return attrs;
}

const isOn = (v: string | undefined) => v === "1" || v === "true";

/** One table part (xl/tables/tableN.xml) as a TinySheet table, or null. */
export function parseTablePart(xml: string) {
  const open = /<(?:\w+:)?table\b[^>]*>/.exec(xml)?.[0];
  if (!open) return null;
  const attrs = xmlAttrs(open);
  const range = getcellrange(attrs.ref ?? "");
  const name = attrs.displayName || attrs.name;
  if (!range || !name) return null;
  const columns = (xml.match(/<(?:\w+:)?tableColumn\b[^>]*>/g) || []).map(
    (tag) => {
      const a = xmlAttrs(tag);
      const fn = TOTAL_FUNCTIONS.has(a.totalsRowFunction)
        ? a.totalsRowFunction
        : "none";
      const col: Record<string, any> = {
        name: a.name ?? "",
        totalFunction: fn,
      };
      if (a.totalsRowLabel) col.totalLabel = a.totalsRowLabel;
      return col;
    }
  );
  const styleTag = /<(?:\w+:)?tableStyleInfo\b[^>]*>/.exec(xml)?.[0];
  const style = styleTag ? xmlAttrs(styleTag) : {};
  return {
    name,
    range: {
      row: [range.row[0], range.row[1]] as [number, number],
      column: [range.column[0], range.column[1]] as [number, number],
    },
    headerRow: attrs.headerRowCount !== "0",
    totalRow: Number(attrs.totalsRowCount ?? 0) > 0,
    bandedRows: isOn(style.showRowStripes),
    bandedColumns: isOn(style.showColumnStripes),
    firstColumn: isOn(style.showFirstColumn),
    lastColumn: isOn(style.showLastColumn),
    style: style.name || "TableStyleMedium2",
    columns,
  };
}

/**
 * Write a table's look (header, total and band fills, bold rows) into its
 * cells, as TinySheet keeps it (core's applyTableFormatting): Excel draws
 * it from the table style instead. Fills the file sets itself are kept.
 */
function applyTableLook(sheet: FortuneSheet, table: any) {
  const [r1, r2] = table.range.row;
  const [c1, c2] = table.range.column;
  const inside = (r: number, c: number) =>
    r >= r1 && r <= r2 && c >= c1 && c <= c2;
  const entries = new Map<string, any>();
  sheet.celldata.forEach((cell) => {
    if (inside(cell.r, cell.c)) entries.set(`${cell.r}_${cell.c}`, cell);
  });
  const data: any[][] = [];
  for (let r = r1; r <= r2; r += 1) {
    data[r] = [];
    for (let c = c1; c <= c2; c += 1) {
      const v = entries.get(`${r}_${c}`)?.v;
      data[r][c] = v && typeof v === "object" ? v : null;
    }
  }
  const id = "__import__";
  applyTableFormatting({ luckysheetfile: [{ id, data }] } as any, id, table);
  for (let r = r1; r <= r2; r += 1) {
    for (let c = c1; c <= c2; c += 1) {
      const v = data[r][c];
      if (!v || Object.keys(v).length === 0) continue;
      const entry = entries.get(`${r}_${c}`);
      if (entry) entry.v = v;
      else sheet.celldata.push({ r, c, v });
    }
  }
}

/**
 * Table parts -> `sheet.tables`, with their look written into the cells.
 * Formulas inside a table refer to it unqualified, as in Excel's formula
 * bar (`[@Price]`, `[Sales]`).
 */
export function readTables(ctx: SheetImportContext) {
  const tables = partRelationships(ctx.files, ctx.sheetFile)
    .filter((x) => TABLE_REL.test(x.type) && ctx.files[x.target])
    .map((rel) => parseTablePart(ctx.files[rel.target]))
    .filter((t): t is NonNullable<typeof t> => t != null)
    .filter(
      (t) => t.columns.length === t.range.column[1] - t.range.column[0] + 1
    );
  if (tables.length === 0) return;
  (ctx.sheet as any).tables = tables;
  tables.forEach((table) => applyTableLook(ctx.sheet, table));
  ctx.sheet.celldata.forEach((cell) => {
    const v = cell.v as any;
    if (!v || typeof v.f !== "string" || v.f.indexOf("[") < 0) return;
    const table = tables.find(
      (t) =>
        cell.r >= t.range.row[0] &&
        cell.r <= t.range.row[1] &&
        cell.c >= t.range.column[0] &&
        cell.c <= t.range.column[1]
    );
    if (table) v.f = unqualifyStructuredReferences(v.f, table.name);
  });
}

/** Per-sheet readers, in order. */
export const sheetImportFeatures: SheetImportFeature[] = [
  { name: "notes", read: readNotes },
  { name: "threadedComments", read: readThreadedComments },
  { name: "tables", read: readTables },
  { name: "page-setup", read: readPageSetup },
  // pictures in cells (rich values, see FortuneCellImage.ts)
  { name: "cell-images", read: (ctx) => readCellImages(ctx) },
  // Conditional formatting (P5) and charts (P12) plug in here.
];

/** Workbook-level readers (defined names (P3), ...). */
export const workbookImportFeatures: WorkbookImportFeature[] = [
  // _xlnm.Print_Area / _xlnm.Print_Titles -> sheet.pageSetup
  { name: "print-names", read: readPrintNames },
  { name: "calc-properties", read: importCalcProperties },
];

export function registerSheetImportFeature(feature: SheetImportFeature) {
  sheetImportFeatures.push(feature);
}

export function registerWorkbookImportFeature(feature: WorkbookImportFeature) {
  workbookImportFeatures.push(feature);
}
