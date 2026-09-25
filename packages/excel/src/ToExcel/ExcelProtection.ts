/**
 * Sheet / workbook protection -> xlsx.
 *
 * ExcelJS cannot write the legacy `password` hash, `protectedRanges` or
 * `workbookProtection`, so the elements are built here and inserted into
 * the written zip (see postProcess.ts): `<sheetProtection>` and
 * `<protectedRanges>` right after `<sheetData>`, `<workbookProtection>`
 * before `<bookViews>`. Only password hashes are written (TinySheet never
 * stores passwords).
 */
import type JSZip from "jszip";
import type {
  SheetExportContext,
  WorkbookExportContext,
} from "./buildWorkbook";
import type { XlsxPostProcessInfo } from "./postProcess";

function xmlEscape(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type Hash = {
  algorithmName?: string;
  hashValue?: string;
  saltValue?: string;
  spinCount?: number;
  legacyHash?: string;
};

/** TinySheet allowed action -> xlsx attribute (1 = protected). */
const FLAG_ATTRS: [string, string][] = [
  ["formatCells", "formatCells"],
  ["formatColumns", "formatColumns"],
  ["formatRows", "formatRows"],
  ["insertColumns", "insertColumns"],
  ["insertRows", "insertRows"],
  ["insertHyperlinks", "insertHyperlinks"],
  ["deleteColumns", "deleteColumns"],
  ["deleteRows", "deleteRows"],
  ["sort", "sort"],
  ["filter", "autoFilter"],
  ["usePivotTablereports", "pivotTables"],
];

const isOn = (v: unknown) => v === 1 || v === true || v === "1";

function attrs(list: [string, string | number | undefined][]) {
  return list
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => ` ${k}="${xmlEscape(String(v))}"`)
    .join("");
}

function hashAttrs(
  hash: Hash,
  prefix = ""
): [string, string | number | undefined][] {
  const name = (k: string) =>
    prefix ? `${prefix}${k[0].toUpperCase()}${k.slice(1)}` : k;
  if (hash.hashValue) {
    return [
      [name("algorithmName"), hash.algorithmName || "SHA-512"],
      [name("hashValue"), hash.hashValue],
      [name("saltValue"), hash.saltValue],
      [name("spinCount"), hash.spinCount],
    ];
  }
  if (hash.legacyHash)
    return [[prefix ? `${prefix}Password` : "password", hash.legacyHash]];
  return [];
}

/** `<sheetProtection>` of a sheet's `config.authority`, null when unprotected. */
export function sheetProtectionXml(authority: any): string | null {
  if (!authority || !isOn(authority.sheet)) return null;
  const list: [string, string | number | undefined][] = [
    ...hashAttrs(authority),
    ["sheet", 1],
  ];
  // objects / scenarios: 1 = editing them is not allowed (Excel's default)
  list.push(["objects", isOn(authority.editObjects) ? undefined : 1]);
  list.push(["scenarios", isOn(authority.editScenarios) ? undefined : 1]);
  // selecting cells is allowed unless switched off
  if (
    authority.selectLockedCells != null &&
    !isOn(authority.selectLockedCells)
  ) {
    list.push(["selectLockedCells", 1]);
  }
  FLAG_ATTRS.forEach(([flag, attr]) => {
    if (isOn(authority[flag])) list.push([attr, 0]);
  });
  if (
    authority.selectunLockedCells != null &&
    !isOn(authority.selectunLockedCells)
  ) {
    list.push(["selectUnlockedCells", 1]);
  }
  return `<sheetProtection${attrs(list)}/>`;
}

/** `<protectedRanges>` (Allow Edit Ranges), null when there are none. */
export function protectedRangesXml(ranges: any[] | undefined): string | null {
  const valid = (ranges ?? []).filter((r) => r?.name && r?.sqref);
  if (valid.length === 0) return null;
  const items = valid.map((r) => {
    const sqref = String(r.sqref)
      .replace(/^=/, "")
      .replace(/\$/g, "")
      .split(/[\s,;]+/)
      .filter(Boolean)
      .join(" ");
    return `<protectedRange${attrs([
      ...hashAttrs(r),
      ["sqref", sqref],
      ["name", r.name],
    ])}/>`;
  });
  return `<protectedRanges>${items.join("")}</protectedRanges>`;
}

/** `<workbookProtection>`, null when the structure is not protected. */
export function workbookProtectionXml(protection: any): string | null {
  if (!protection?.lockStructure) return null;
  return `<workbookProtection${attrs([
    ...hashAttrs(protection, "workbook"),
    ["lockStructure", 1],
    ["lockWindows", protection.lockWindows ? 1 : undefined],
  ])}/>`;
}

type ProtectionPost = {
  sheets: Record<number, string>;
  workbook?: string;
};

function protectionInfo(post: XlsxPostProcessInfo): ProtectionPost {
  const extras = post.features ?? (post.features = {});
  if (!extras.protection) extras.protection = { sheets: {} };
  return extras.protection as ProtectionPost;
}

/** Sheet writer: remember the sheet's protection elements for the zip. */
export function writeSheetProtection(ctx: SheetExportContext) {
  const authority = ctx.sheet?.config?.authority;
  const xml = [
    sheetProtectionXml(authority),
    protectedRangesXml(authority?.allowRangeList),
  ]
    .filter(Boolean)
    .join("");
  if (xml) protectionInfo(ctx.post).sheets[ctx.worksheet.id] = xml;
}

/** Workbook writer: remember `<workbookProtection>` for the zip. */
export function writeWorkbookProtection(ctx: WorkbookExportContext) {
  const holder = ctx.sheets.find((s) => s?.workbookProtection?.lockStructure);
  const xml = workbookProtectionXml(holder?.workbookProtection);
  if (xml) protectionInfo(ctx.post).workbook = xml;
}

/** Insert the collected protection elements into the written zip. */
export async function applyProtectionToZip(
  zip: JSZip,
  info: XlsxPostProcessInfo
) {
  const data = info.features?.protection as ProtectionPost | undefined;
  if (!data) return;
  await Promise.all(
    Object.entries(data.sheets).map(async ([id, xml]) => {
      const path = `xl/worksheets/sheet${id}.xml`;
      const file = zip.file(path);
      if (!file) return;
      let text = await file.async("string");
      text = text.replace(/<sheetProtection\b[^>]*\/>/g, "");
      const at = /<\/sheetData>|<sheetData\s*\/>/.exec(text);
      if (!at) return;
      let end = at.index + at[0].length;
      const calc = /^\s*<sheetCalcPr\b[^>]*\/>/.exec(text.slice(end));
      if (calc) end += calc[0].length;
      zip.file(path, text.slice(0, end) + xml + text.slice(end));
    })
  );
  if (data.workbook) {
    const path = "xl/workbook.xml";
    const file = zip.file(path);
    if (!file) return;
    let text = await file.async("string");
    text = text.replace(/<workbookProtection\b[^>]*\/>/g, "");
    const at = /<bookViews\b|<sheets\b/.exec(text);
    if (!at) return;
    zip.file(
      path,
      text.slice(0, at.index) + data.workbook + text.slice(at.index)
    );
  }
}
