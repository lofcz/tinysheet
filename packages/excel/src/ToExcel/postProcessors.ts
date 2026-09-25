/**
 * Zip post-processor registry: the stable extension hook for everything
 * ExcelJS cannot write.
 *
 * `exportToXlsx` lets ExcelJS serialise the workbook, opens the package once
 * and runs every registered post-processor on it, in order, then zips it
 * once. A post-processor receives an `XlsxPostProcessContext` (the JSZip
 * package, the exported sheets and their worksheet parts, the info feature
 * writers collected in `post`) and patches or adds parts.
 *
 * Adding one (from a feature module):
 *
 *   registerXlsxPostProcessor("sparklines", async (ctx) => {
 *     for (const ws of ctx.worksheets) {
 *       let xml = await ctx.readText(ws.path);
 *       ...
 *       ctx.writeText(ws.path, xml);
 *     }
 *   }, { before: "charts" });
 *
 * Rules:
 * - Names are unique; registering an existing name replaces it in place.
 * - Order is registration order unless `before` / `after` names another
 *   processor. Built-ins run as: conditional-formatting, dynamic-arrays,
 *   cell-images, internal-hyperlinks, visible-notes, threaded-comments,
 *   sheet-xml-fixups, worksheet-exts, cell-hyperlinks, data-validation, tables, charts,
 *   feature-fixups.
 * - Share data from a sheet writer (SheetExportFeature) with its
 *   post-processor through `ctx.post.features[<your name>]`.
 * - Use the helpers (`addRelationship`, `addContentTypeOverride`,
 *   `insertWorksheetElement` in xlsxParts.ts, ...) instead of string
 *   appends, so parts written by different features do not collide.
 */
import JSZip from "jszip";
import type ExcelJS from "@protobi/exceljs";
import type { XlsxExportOptions } from "./buildWorkbook";
import type { XlsxPostProcessInfo } from "./postProcess";
import {
  addWorksheetExts,
  applySheetXmlFixups,
  fixInternalHyperlinks,
  markDynamicArrays,
  showNotes,
} from "./postProcess";
import { writeCellImageParts } from "./ExcelCellImage";
import { writeThreadedCommentParts } from "./ExcelThreadedComments";
import { finalizeConditionalFormattingZip } from "./ExcelConditionFormat";
import { addChartsToZip } from "../chart/exportXlsx";
import {
  addContentTypeOverride,
  addRelationship,
  relsPathFor,
} from "./xlsxParts";
import { markHiddenDropdowns } from "./ExcelValidation";
import { markEmptyTables } from "./ExcelTable";
import { addCellHyperlinks } from "./ExcelStyle";

/** A worksheet part of the written package. */
export type XlsxWorksheetPart = {
  /** ExcelJS worksheet id (the N of xl/worksheets/sheetN.xml). */
  id: number;
  /** Sheet name as written (made valid for Excel). */
  name: string;
  /** Zip path of the worksheet part. */
  path: string;
  /** The TinySheet sheet it was written from. */
  sheet: any;
};

export type XlsxPostProcessContext = {
  zip: JSZip;
  /** Exported TinySheet sheets, in workbook order. */
  sheets: any[];
  /** Worksheet parts of the exported sheets (skipped sheets excluded). */
  worksheets: XlsxWorksheetPart[];
  /** The ExcelJS workbook that was serialised (null for raw buffers). */
  workbook: ExcelJS.Workbook | null;
  /** Info collected by the sheet writers. */
  post: XlsxPostProcessInfo;
  options: XlsxExportOptions;
  /** Text of a part, or null when the package has no such part. */
  readText(path: string): Promise<string | null>;
  writeText(path: string, text: string): void;
  /** Add an Override to [Content_Types].xml. */
  addContentType(partName: string, contentType: string): Promise<void>;
  /**
   * Add a relationship from `fromPart` (e.g. a worksheet path) and return
   * its id; the .rels part is created when missing.
   */
  addRelationship(
    fromPart: string,
    type: string,
    target: string,
    external?: boolean
  ): Promise<string>;
};

export type XlsxPostProcessorFn = (
  ctx: XlsxPostProcessContext
) => void | Promise<void>;

export type XlsxPostProcessor = {
  name: string;
  process: XlsxPostProcessorFn;
};

/** Registered post-processors, in the order they run. */
export const xlsxPostProcessors: XlsxPostProcessor[] = [
  {
    // gradient data bars, "show bar only", ">" icon thresholds
    name: "conditional-formatting",
    process: (ctx) =>
      ctx.workbook
        ? finalizeConditionalFormattingZip(ctx.workbook, ctx.zip)
        : undefined,
  },
  {
    name: "dynamic-arrays",
    process: (ctx) => markDynamicArrays(ctx.zip, ctx.post),
  },
  // after the dynamic arrays: shares xl/metadata.xml with them
  {
    name: "cell-images",
    process: (ctx) => writeCellImageParts(ctx.zip, ctx.post),
  },
  {
    name: "internal-hyperlinks",
    process: (ctx) => fixInternalHyperlinks(ctx.zip),
  },
  { name: "visible-notes", process: (ctx) => showNotes(ctx.zip, ctx.post) },
  {
    name: "threaded-comments",
    process: (ctx) => writeThreadedCommentParts(ctx.zip, ctx.post),
  },
  {
    name: "sheet-xml-fixups",
    process: (ctx) => applySheetXmlFixups(ctx.zip, ctx.post),
  },
  // <ext> elements queued by sheet writers (sparkline groups, ...)
  {
    name: "worksheet-exts",
    process: (ctx) => addWorksheetExts(ctx.zip, ctx.post),
  },
  // links on formula cells and empty cells (ExcelJS only writes link values)
  { name: "cell-hyperlinks", process: addCellHyperlinks },
  // list validation "show in-cell dropdown" off (showDropDown="1")
  { name: "data-validation", process: markHiddenDropdowns },
  // tables without data rows (insertRow="1")
  { name: "tables", process: markEmptyTables },
  // native chart parts for `sheet.charts`
  {
    name: "charts",
    process: async (ctx) => {
      await addChartsToZip(
        ctx.zip,
        ctx.sheets,
        (name) => ctx.worksheets.find((ws) => ws.name === name)?.sheet
      );
    },
  },
  {
    // zip edits sheet/workbook writers queued in `post.fixups` (run last)
    name: "feature-fixups",
    process: async (ctx) => {
      await (ctx.post.fixups ?? []).reduce(
        (prev, fixup) => prev.then(() => fixup(ctx.zip)),
        Promise.resolve()
      );
    },
  },
];

export type RegisterXlsxPostProcessorOptions = {
  /** Run before the processor with this name. */
  before?: string;
  /** Run after the processor with this name. */
  after?: string;
};

/**
 * Register a zip post-processor (see the module comment). Returns a
 * function that unregisters it.
 */
export function registerXlsxPostProcessor(
  name: string,
  process: XlsxPostProcessorFn,
  options: RegisterXlsxPostProcessorOptions = {}
): () => void {
  const entry: XlsxPostProcessor = { name, process };
  const existing = xlsxPostProcessors.findIndex((p) => p.name === name);
  if (existing >= 0 && !options.before && !options.after) {
    xlsxPostProcessors[existing] = entry;
  } else {
    if (existing >= 0) xlsxPostProcessors.splice(existing, 1);
    const anchor = options.before ?? options.after;
    const at = anchor
      ? xlsxPostProcessors.findIndex((p) => p.name === anchor)
      : -1;
    if (at < 0) xlsxPostProcessors.push(entry);
    else xlsxPostProcessors.splice(options.before ? at : at + 1, 0, entry);
  }
  return () => {
    const i = xlsxPostProcessors.indexOf(entry);
    if (i >= 0) xlsxPostProcessors.splice(i, 1);
  };
}

export type RunXlsxPostProcessorsInput = {
  sheets?: any[];
  worksheets?: XlsxWorksheetPart[];
  workbook?: ExcelJS.Workbook | null;
  post?: XlsxPostProcessInfo;
  options?: XlsxExportOptions;
  /** Run only these processors (default: all registered ones). */
  processors?: XlsxPostProcessor[];
};

/** Build the context helpers around an opened package. */
export function createPostProcessContext(
  zip: JSZip,
  input: RunXlsxPostProcessorsInput = {}
): XlsxPostProcessContext {
  const readText = async (path: string) => {
    const file = zip.file(path);
    return file ? file.async("string") : null;
  };
  const writeText = (path: string, text: string) => {
    zip.file(path, text);
  };
  return {
    zip,
    sheets: input.sheets ?? [],
    worksheets: input.worksheets ?? [],
    workbook: input.workbook ?? null,
    post: input.post ?? {
      dynamicArrayCells: {},
      worksheetIds: [],
      visibleNotes: {},
      features: {},
    },
    options: input.options ?? {},
    readText,
    writeText,
    async addContentType(partName, contentType) {
      const types = await readText("[Content_Types].xml");
      if (types == null) return;
      writeText(
        "[Content_Types].xml",
        addContentTypeOverride(types, partName, contentType)
      );
    },
    async addRelationship(fromPart, type, target, external = false) {
      const relsPath = relsPathFor(fromPart);
      const added = addRelationship(
        await readText(relsPath),
        type,
        target,
        external
      );
      writeText(relsPath, added.xml);
      return added.id;
    },
  };
}

/**
 * Open an xlsx buffer, run the post-processors on it in order and zip it
 * again. Used by `exportToXlsx`; exposed for callers that write the
 * workbook themselves.
 */
export async function runXlsxPostProcessors(
  buffer: ArrayBuffer | Uint8Array,
  input: RunXlsxPostProcessorsInput = {}
): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(buffer);
  const ctx = createPostProcessContext(zip, input);
  const processors = (input.processors ?? xlsxPostProcessors).slice();
  for (const processor of processors) {
    // eslint-disable-next-line no-await-in-loop
    await processor.process(ctx);
  }
  return zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
