/**
 * Workbook calculation options <-> xlsx `<calcPr>` (xl/workbook.xml).
 *
 * TinySheet keeps them as `sheet.calcSettings` on every sheet (core
 * calculation.ts); the file stores
 *   <calcPr calcId="191029" calcMode="manual" iterate="1"
 *           iterateCount="50" iterateDelta="0.0001" fullCalcOnLoad="1"/>
 * ExcelJS only writes `calcId` / `fullCalcOnLoad`, so the export rewrites
 * the element in the zip (a post-processing fixup).
 */
import type JSZip from "jszip";
import type { WorkbookExportContext } from "../ToExcel/buildWorkbook";
import type { WorkbookImportContext } from "../ToFortuneSheet/importFeatures";

export type CalcSettingsModel = {
  mode?: "auto" | "autoNoTable" | "manual";
  iterate?: boolean;
  maxIterations?: number;
  maxChange?: number;
  fullCalcOnLoad?: boolean;
};

const MODES = ["auto", "autoNoTable", "manual"];

function attr(el: string, name: string) {
  return new RegExp(`\\b${name}="([^"]*)"`).exec(el)?.[1];
}

const isTrue = (v: string | undefined) => v === "1" || v === "true";

/** `<calcPr>` of a workbook.xml as calculation options (null: defaults). */
export function readCalcPr(workbookXml: string): CalcSettingsModel | null {
  const el = /<(?:\w+:)?calcPr\b[^>]*>/.exec(workbookXml)?.[0];
  if (!el) return null;
  const out: CalcSettingsModel = {};
  const mode = attr(el, "calcMode");
  if (mode && MODES.includes(mode) && mode !== "auto") {
    out.mode = mode as CalcSettingsModel["mode"];
  }
  if (isTrue(attr(el, "iterate"))) out.iterate = true;
  const count = Number(attr(el, "iterateCount"));
  if (attr(el, "iterateCount") != null && Number.isFinite(count)) {
    out.maxIterations = count;
  }
  const delta = Number(attr(el, "iterateDelta"));
  if (attr(el, "iterateDelta") != null && Number.isFinite(delta)) {
    out.maxChange = delta;
  }
  if (isTrue(attr(el, "fullCalcOnLoad"))) out.fullCalcOnLoad = true;
  return Object.keys(out).length > 0 ? out : null;
}

/** The `<calcPr>` element for calculation options. */
export function calcPrElement(s: CalcSettingsModel, calcId = "191029") {
  const attrs = [`calcId="${calcId}"`];
  if (s.mode && s.mode !== "auto") attrs.push(`calcMode="${s.mode}"`);
  if (s.fullCalcOnLoad) attrs.push('fullCalcOnLoad="1"');
  if (s.iterate) attrs.push('iterate="1"');
  if (s.maxIterations != null && s.maxIterations !== 100) {
    attrs.push(`iterateCount="${Math.round(s.maxIterations)}"`);
  }
  if (s.maxChange != null && s.maxChange !== 0.001) {
    attrs.push(`iterateDelta="${s.maxChange}"`);
  }
  return `<calcPr ${attrs.join(" ")}/>`;
}

/** Replace (or add) the `<calcPr>` element of a workbook.xml. */
export function writeCalcPr(workbookXml: string, s: CalcSettingsModel) {
  const existing = /<calcPr\b[^>]*\/>|<calcPr\b[^>]*>[\s\S]*?<\/calcPr>/.exec(
    workbookXml
  );
  if (existing) {
    const calcId = attr(existing[0], "calcId");
    return workbookXml.replace(existing[0], calcPrElement(s, calcId));
  }
  const at = workbookXml.lastIndexOf("</workbook>");
  if (at < 0) return workbookXml;
  return workbookXml.slice(0, at) + calcPrElement(s) + workbookXml.slice(at);
}

/** Workbook export feature: TinySheet calcSettings -> `<calcPr>`. */
export function exportCalcProperties(ctx: WorkbookExportContext) {
  const settings = ctx.sheets.find((s) => s?.calcSettings)?.calcSettings as
    | CalcSettingsModel
    | undefined;
  if (!settings) return;
  if (settings.fullCalcOnLoad) {
    (ctx.workbook as any).calcProperties = {
      ...((ctx.workbook as any).calcProperties ?? {}),
      fullCalcOnLoad: true,
    };
  }
  ctx.post.fixups = [
    ...(ctx.post.fixups ?? []),
    async (zip: JSZip) => {
      const file = zip.file("xl/workbook.xml");
      if (!file) return;
      zip.file(
        "xl/workbook.xml",
        writeCalcPr(await file.async("string"), settings)
      );
    },
  ];
}

/** Workbook import feature: `<calcPr>` -> calcSettings on every sheet. */
export function importCalcProperties(ctx: WorkbookImportContext) {
  const key = Object.keys(ctx.files).find((k) => /xl\/workbook\.xml$/.test(k));
  const settings = key ? readCalcPr(ctx.files[key]) : null;
  if (!settings) return;
  ctx.sheets.forEach((sheet) => {
    (sheet as any).calcSettings = { ...settings };
  });
}
