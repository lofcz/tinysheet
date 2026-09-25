/**
 * xlsx -> TinySheet: sheet / workbook protection and the sheet view flags
 * the cell importer does not read.
 *
 * - `<sheetProtection>` -> `config.authority` (allowed actions as 1/0,
 *   the password hash: algorithmName/hashValue/saltValue/spinCount or the
 *   legacy `password` hash as `legacyHash`),
 * - `<protectedRanges>` -> `config.authority.allowRangeList`,
 * - `<workbookProtection lockStructure>` -> `workbookProtection` of the
 *   first sheet,
 * - `<sheetView showRowColHeaders rightToLeft showGridLines>`.
 */
import { escapeCharacter } from "../common/method";
import type {
  SheetImportContext,
  WorkbookImportContext,
} from "./importFeatures";

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

const truthy = (v: string | undefined) => v === "1" || v === "true";
const falsy = (v: string | undefined) => v === "0" || v === "false";

function readHash(a: Record<string, string>, prefix = "") {
  const key = (k: string) =>
    prefix ? `${prefix}${k[0].toUpperCase()}${k.slice(1)}` : k;
  const out: Record<string, any> = {};
  if (a[key("hashValue")]) {
    out.algorithmName = a[key("algorithmName")] || "SHA-512";
    out.hashValue = a[key("hashValue")];
    if (a[key("saltValue")]) out.saltValue = a[key("saltValue")];
    const spin = Number(a[key("spinCount")]);
    out.spinCount = Number.isFinite(spin) ? spin : 0;
  }
  const legacy = a[prefix ? `${prefix}Password` : "password"];
  if (legacy && /^[0-9a-f]{1,4}$/i.test(legacy)) {
    out.legacyHash = legacy.toUpperCase().padStart(4, "0");
  }
  return out;
}

/** xlsx attribute (1 = protected, default) -> TinySheet allowed action. */
const LOCKED_BY_DEFAULT: [string, string][] = [
  ["formatCells", "formatCells"],
  ["formatColumns", "formatColumns"],
  ["formatRows", "formatRows"],
  ["insertColumns", "insertColumns"],
  ["insertRows", "insertRows"],
  ["insertHyperlinks", "insertHyperlinks"],
  ["deleteColumns", "deleteColumns"],
  ["deleteRows", "deleteRows"],
  ["sort", "sort"],
  ["autoFilter", "filter"],
  ["pivotTables", "usePivotTablereports"],
];

/** `<sheetProtection>` as TinySheet's `config.authority`, or null. */
export function parseSheetProtection(tag: string) {
  const a = xmlAttrs(tag);
  const out: Record<string, any> = {
    sheet: truthy(a.sheet) ? 1 : 0,
    // allowed unless the attribute protects them
    selectLockedCells: truthy(a.selectLockedCells) ? 0 : 1,
    selectunLockedCells: truthy(a.selectUnlockedCells) ? 0 : 1,
    editObjects: truthy(a.objects) ? 0 : 1,
    editScenarios: truthy(a.scenarios) ? 0 : 1,
  };
  LOCKED_BY_DEFAULT.forEach(([attr, flag]) => {
    out[flag] = falsy(a[attr]) ? 1 : 0;
  });
  Object.assign(out, readHash(a));
  return out;
}

/** `<protectedRange>` elements as Allow Edit Ranges. */
export function parseProtectedRanges(xml: string) {
  const block =
    /<(?:\w+:)?protectedRanges\b[^>]*>([\s\S]*?)<\/(?:\w+:)?protectedRanges>/.exec(
      xml
    );
  if (!block) return [];
  return (block[1].match(/<(?:\w+:)?protectedRange\b[^>]*>/g) || [])
    .map((tag) => {
      const a = xmlAttrs(tag);
      if (!a.name || !a.sqref) return null;
      const sqref = a.sqref
        .split(/\s+/)
        .filter(Boolean)
        .map((part) =>
          part
            .split(":")
            .map((cell) => cell.replace(/^([A-Z]+)(\d+)$/i, "$$$1$$$2"))
            .join(":")
        )
        .join(" ");
      return { name: a.name, sqref, ...readHash(a) };
    })
    .filter((x): x is NonNullable<typeof x> => x != null);
}

/** `<workbookProtection>` as TinySheet's `workbookProtection`, or null. */
export function parseWorkbookProtection(xml: string) {
  const tag = /<(?:\w+:)?workbookProtection\b[^>]*>/.exec(xml)?.[0];
  if (!tag) return null;
  const a = xmlAttrs(tag);
  if (!truthy(a.lockStructure)) return null;
  const out: Record<string, any> = {
    lockStructure: true,
    ...readHash(a, "workbook"),
  };
  if (truthy(a.lockWindows)) out.lockWindows = true;
  return out;
}

/** Sheet reader: protection, Allow Edit Ranges and sheet view flags. */
export function readSheetProtection(ctx: SheetImportContext) {
  const xml = ctx.files[ctx.sheetFile];
  if (!xml) return;
  const sheet = ctx.sheet as any;
  const tag = /<(?:\w+:)?sheetProtection\b[^>]*>/.exec(xml)?.[0];
  const ranges = parseProtectedRanges(xml);
  if (tag || ranges.length) {
    const authority: Record<string, any> = tag
      ? parseSheetProtection(tag)
      : { sheet: 0 };
    if (ranges.length) authority.allowRangeList = ranges;
    if (!sheet.config) sheet.config = {};
    sheet.config.authority = authority;
  }
  const view = /<(?:\w+:)?sheetView\b[^>]*>/.exec(xml)?.[0];
  if (view) {
    const a = xmlAttrs(view);
    if (falsy(a.showRowColHeaders)) sheet.showRowColHeaders = false;
    if (truthy(a.rightToLeft)) sheet.rightToLeft = true;
    // the importer keeps "0"/"1" strings; TinySheet reads 0/1
    sheet.showGridLines = falsy(a.showGridLines) ? 0 : 1;
  }
}

/** Workbook reader: structure protection onto the first sheet. */
export function readWorkbookProtection(ctx: WorkbookImportContext) {
  const xml = ctx.files["xl/workbook.xml"];
  if (!xml || ctx.sheets.length === 0) return;
  const protection = parseWorkbookProtection(xml);
  if (protection) (ctx.sheets[0] as any).workbookProtection = protection;
}
