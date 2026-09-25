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
import { ReadXml, Element, IStyleCollections } from "./ReadXml";
import { IuploadfileList } from "../common/ICommon";
import { escapeCharacter, getcellrange } from "../common/method";
import type { FortuneSheet } from "./FortuneSheet";

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

function setNote(sheet: FortuneSheet, ref: string, value: string) {
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
    isShow: false,
  };
}

const COMMENTS_REL = /\/comments$/;
const THREADED_REL = /\/threadedComment$/;

/** Notes (legacy comments) and threaded comments -> `cell.ps`. */
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

  // Threaded comments replace their legacy placeholder text.
  rels
    .filter((x) => THREADED_REL.test(x.type) && ctx.files[x.target])
    .forEach((rel) => {
      const threads = new Map<string, string[]>();
      const items = ctx.readXml.getElementsByTagName(
        "ThreadedComments/threadedComment",
        rel.target
      );
      items.forEach((item) => {
        const { ref } = item.attributeList;
        const text = item.getInnerElements("text");
        if (!ref || text == null) return;
        const value = escapeCharacter(text[0].value || "").replace(
          /\r\n/g,
          "\n"
        );
        if (!threads.has(ref)) threads.set(ref, []);
        threads.get(ref)!.push(value);
      });
      threads.forEach((texts, ref) => notes.set(ref, texts.join("\n")));
    });

  notes.forEach((value, ref) => setNote(ctx.sheet, ref, value));
}

/** Per-sheet readers, in order. */
export const sheetImportFeatures: SheetImportFeature[] = [
  { name: "notes", read: readNotes },
  // Conditional formatting (P5) and charts (P12) plug in here.
];

/** Workbook-level readers (defined names (P3), ...). */
export const workbookImportFeatures: WorkbookImportFeature[] = [];

export function registerSheetImportFeature(feature: SheetImportFeature) {
  sheetImportFeatures.push(feature);
}

export function registerWorkbookImportFeature(feature: WorkbookImportFeature) {
  workbookImportFeatures.push(feature);
}
