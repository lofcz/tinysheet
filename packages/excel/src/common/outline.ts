/**
 * xlsx round trip of outlines (Data › Group, Subtotal):
 *
 * - `<row outlineLevel collapsed hidden>` / `<col outlineLevel collapsed>`
 * - `<sheetFormatPr outlineLevelRow outlineLevelCol>`
 * - `<sheetPr><outlinePr summaryBelow summaryRight/>`
 *
 * TinySheet keeps them in `sheet.config` (rowOutlineLevel, colOutlineLevel,
 * rowOutlineCollapsed, colOutlineCollapsed, outlineSummaryBelow,
 * outlineSummaryRight; see core modules/outline.ts). Hidden rows and
 * columns are written and read by the sheet-structure code already.
 */
import { getOutlineGroups } from "@lofcz/tinysheet-core";
import type { SheetExportContext } from "../ToExcel/buildWorkbook";
import type { SheetImportContext } from "../ToFortuneSheet/importFeatures";

const MAX_LEVEL = 7;

function keysOf(...maps: (Record<string, number> | undefined)[]) {
  const keys = new Set<number>();
  maps.forEach((m) =>
    Object.keys(m || {}).forEach((k) => {
      const i = Number(k);
      if (Number.isInteger(i) && i >= 0) keys.add(i);
    })
  );
  return [...keys].sort((a, b) => a - b);
}

/** Sheet export feature: outline levels, collapsed flags, summary position. */
export function writeOutline(ctx: SheetExportContext) {
  const { sheet, worksheet } = ctx;
  const cfg = sheet.config || {};
  const rowLevels: Record<string, number> = cfg.rowOutlineLevel || {};
  const colLevels: Record<string, number> = cfg.colOutlineLevel || {};
  const rowFlags: Record<string, number> = cfg.rowOutlineCollapsed || {};
  const colFlags: Record<string, number> = cfg.colOutlineCollapsed || {};

  keysOf(rowLevels, rowFlags).forEach((r) => {
    if (r >= 1048576) return;
    const level = Math.min(MAX_LEVEL, Math.max(0, rowLevels[r] || 0));
    const collapsed = !!rowFlags[r];
    if (!level && !collapsed) return;
    const row = worksheet.getRow(r + 1);
    row.outlineLevel = level;
    row.collapsed = collapsed;
  });

  keysOf(colLevels, colFlags).forEach((c) => {
    if (c >= 16384) return;
    const level = Math.min(MAX_LEVEL, Math.max(0, colLevels[c] || 0));
    const collapsed = !!colFlags[c];
    if (!level && !collapsed) return;
    const column = worksheet.getColumn(c + 1);
    column.outlineLevel = level;
    column.collapsed = collapsed;
  });

  if (cfg.outlineSummaryBelow === false) worksheet.outline.summaryBelow = false;
  if (cfg.outlineSummaryRight === false) worksheet.outline.summaryRight = false;
}

const attr = (tag: string, name: string) =>
  new RegExp(`\\b${name}="([^"]*)"`).exec(tag)?.[1];

const isTrue = (v: string | undefined) => v === "1" || v === "true";

/**
 * Collapsed flags by level: Excel marks the summary row of a collapsed
 * group; the flag belongs to the outermost group ending there whose rows
 * are all hidden.
 */
function collapsedFlags(
  config: any,
  axis: "row" | "column",
  marked: number[],
  hidden: Record<string, number>
) {
  const flags: Record<string, number> = {};
  if (marked.length === 0) return flags;
  const groups = getOutlineGroups(config, axis);
  marked.forEach((s) => {
    const g = groups.find((x) => {
      if (x.summary !== s) return false;
      for (let i = x.start; i <= x.end; i += 1)
        if (!(i in hidden)) return false;
      return true;
    });
    if (g) flags[s] = (flags[s] ?? 0) | (1 << (g.level - 1));
  });
  return flags;
}

/** Sheet import feature: outline levels, collapsed flags, summary position. */
export function readOutline(ctx: SheetImportContext) {
  const xml = ctx.files[ctx.sheetFile];
  if (!xml || xml.indexOf("outline") < 0) return;
  const { sheet } = ctx;
  const config: any = sheet.config || ((sheet as any).config = {});

  const outlinePr = /<(?:\w+:)?outlinePr\b[^>]*>/.exec(xml)?.[0];
  if (outlinePr) {
    if (attr(outlinePr, "summaryBelow") === "0")
      config.outlineSummaryBelow = false;
    if (attr(outlinePr, "summaryRight") === "0")
      config.outlineSummaryRight = false;
  }

  const rowLevels: Record<string, number> = {};
  const rowMarked: number[] = [];
  (xml.match(/<(?:\w+:)?row\b[^>]*>/g) || []).forEach((tag) => {
    const r = Number(attr(tag, "r")) - 1;
    if (!(r >= 0)) return;
    const level = Math.min(MAX_LEVEL, Number(attr(tag, "outlineLevel")) || 0);
    if (level > 0) rowLevels[r] = level;
    if (isTrue(attr(tag, "collapsed"))) rowMarked.push(r);
  });

  const colLevels: Record<string, number> = {};
  const colMarked: number[] = [];
  (xml.match(/<(?:\w+:)?col\b[^>]*>/g) || []).forEach((tag) => {
    const min = Number(attr(tag, "min")) - 1;
    const max = Number(attr(tag, "max")) - 1;
    if (!(min >= 0) || !(max >= min)) return;
    const level = Math.min(MAX_LEVEL, Number(attr(tag, "outlineLevel")) || 0);
    const collapsed = isTrue(attr(tag, "collapsed"));
    // a <col> run can span the whole sheet: only the used part matters
    for (let c = min; c <= Math.min(max, 16383); c += 1) {
      if (level > 0) colLevels[c] = level;
      if (collapsed) colMarked.push(c);
    }
  });

  if (Object.keys(rowLevels).length) config.rowOutlineLevel = rowLevels;
  if (Object.keys(colLevels).length) config.colOutlineLevel = colLevels;
  const rowFlags = collapsedFlags(
    config,
    "row",
    rowMarked,
    config.rowhidden || {}
  );
  const colFlags = collapsedFlags(
    config,
    "column",
    colMarked,
    config.colhidden || {}
  );
  if (Object.keys(rowFlags).length) config.rowOutlineCollapsed = rowFlags;
  if (Object.keys(colFlags).length) config.colOutlineCollapsed = colFlags;
}
