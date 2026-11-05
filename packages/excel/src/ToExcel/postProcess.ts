import JSZip from "jszip";

export type XlsxPostProcessInfo = {
  worksheetIds: number[];
  /** Worksheet id -> cells (0-based) whose note is always shown. */
  visibleNotes?: Record<number, { r: number; c: number }[]>;
  /**
   * Worksheet id -> edits of the written worksheet XML, for elements or
   * attributes ExcelJS cannot write (feature writers push them).
   */
  sheetXmlFixups?: Record<number, ((xml: string) => string)[]>;
  /** Further zip edits registered by export features (run last). */
  fixups?: ((zip: JSZip) => Promise<void> | void)[];
  /**
   * Free-form data sheet writers hand to their zip post-processor, keyed by
   * feature name (see postProcessors.ts).
   */
  features?: Record<string, any>;
  /** Worksheet id -> `<ext>` elements to add to the worksheet's extLst. */
  worksheetExts?: Record<number, string[]>;
};

const HYPERLINK_REL_TYPE =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink";

export function xmlUnescape(s: string) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) =>
      String.fromCharCode(parseInt(h, 16))
    )
    .replace(/&amp;/g, "&");
}

export function xmlEscape(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function fixSheetLinks(zip: JSZip, relFile: JSZip.JSZipObject) {
  let rels = await relFile.async("string");
  const internal = new Map<string, string>();
  rels = rels.replace(/<Relationship\b[^>]*\/>/g, (rel) => {
    const type = /Type="([^"]*)"/.exec(rel)?.[1];
    const target = /Target="([^"]*)"/.exec(rel)?.[1];
    const id = /Id="([^"]*)"/.exec(rel)?.[1];
    if (type !== HYPERLINK_REL_TYPE || !target || !id) return rel;
    const raw = xmlUnescape(target);
    if (!raw.startsWith("#")) return rel;
    internal.set(id, raw.slice(1));
    return "";
  });
  if (internal.size === 0) return;
  const sheetPath = relFile.name.replace("_rels/", "").replace(/\.rels$/, "");
  const sheetFile = zip.file(sheetPath);
  if (!sheetFile) return;
  let xml = await sheetFile.async("string");
  xml = xml.replace(/<hyperlink\b[^>]*\/>/g, (el) => {
    const id = /r:id="([^"]*)"/.exec(el)?.[1];
    if (!id || !internal.has(id)) return el;
    const location = xmlEscape(internal.get(id)!);
    let out = el
      .replace(/\s+r:id="[^"]*"/, "")
      .replace(/\s+location="[^"]*"/, "");
    out = out.replace(/\s*\/>$/, ` location="${location}"/>`);
    return out;
  });
  zip.file(sheetPath, xml);
  zip.file(relFile.name, rels);
}

export async function fixInternalHyperlinks(zip: JSZip) {
  const relFiles = zip.file(/^xl\/worksheets\/_rels\/sheet\d+\.xml\.rels$/);
  await Promise.all(relFiles.map((relFile) => fixSheetLinks(zip, relFile)));
}

const VML_REL_TYPE =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/vmlDrawing";

/** Make the note shapes of the given cells visible in a sheet's VML part. */
export function showVmlNotes(vml: string, cells: { r: number; c: number }[]) {
  const wanted = new Set(cells.map(({ r, c }) => `${r}_${c}`));
  return vml.replace(/<v:shape\b[\s\S]*?<\/v:shape>/g, (shape) => {
    const row = /<x:Row>\s*(\d+)\s*<\/x:Row>/.exec(shape)?.[1];
    const col = /<x:Column>\s*(\d+)\s*<\/x:Column>/.exec(shape)?.[1];
    if (row == null || col == null || !wanted.has(`${row}_${col}`)) {
      return shape;
    }
    let out = shape.replace(/visibility:hidden/g, "visibility:visible");
    if (!/<x:Visible\s*\/?>/.test(out)) {
      out = out.replace(/<\/x:ClientData>/, "<x:Visible/></x:ClientData>");
    }
    return out;
  });
}

export async function showNotes(zip: JSZip, info: XlsxPostProcessInfo) {
  const entries = Object.entries(info.visibleNotes ?? {}).filter(
    ([, cells]) => cells.length > 0
  );
  await Promise.all(
    entries.map(async ([id, cells]) => {
      const rels = await zip
        .file(`xl/worksheets/_rels/sheet${id}.xml.rels`)
        ?.async("string");
      const rel = (rels?.match(/<Relationship\b[^>]*>/g) ?? []).find((el) =>
        el.includes(`Type="${VML_REL_TYPE}"`)
      );
      const target = rel && /Target="([^"]*)"/.exec(rel)?.[1];
      if (!target) return;
      const path = target.startsWith("/")
        ? target.slice(1)
        : `xl/${target.replace(/^\.\.\//, "")}`;
      const file = zip.file(path);
      if (!file) return;
      zip.file(path, showVmlNotes(await file.async("string"), cells));
    })
  );
}

export async function applySheetXmlFixups(
  zip: JSZip,
  info: XlsxPostProcessInfo
) {
  await Promise.all(
    Object.entries(info.sheetXmlFixups ?? {}).map(async ([id, fixups]) => {
      const path = `xl/worksheets/sheet${id}.xml`;
      const file = zip.file(path);
      if (!file || fixups.length === 0) return;
      const xml = await file.async("string");
      zip.file(
        path,
        fixups.reduce((acc, fix) => fix(acc), xml)
      );
    })
  );
}

/** Add `<ext>` elements to a worksheet XML's `extLst` (created if needed). */
export function appendWorksheetExts(xml: string, exts: string[]) {
  if (exts.length === 0) return xml;
  const body = exts.join("");
  const close = xml.lastIndexOf("</extLst>");
  if (close >= 0 && /<extLst\b/.test(xml)) {
    return xml.slice(0, close) + body + xml.slice(close);
  }
  // extLst is the last child of <worksheet>
  const end = xml.lastIndexOf("</worksheet>");
  if (end < 0) return xml;
  return `${xml.slice(0, end)}<extLst>${body}</extLst>${xml.slice(end)}`;
}

export async function addWorksheetExts(zip: JSZip, info: XlsxPostProcessInfo) {
  const entries = Object.entries(info.worksheetExts ?? {}).filter(
    ([, exts]) => exts.length > 0
  );
  await Promise.all(
    entries.map(async ([id, exts]) => {
      const path = `xl/worksheets/sheet${id}.xml`;
      const file = zip.file(path);
      if (!file) return;
      zip.file(path, appendWorksheetExts(await file.async("string"), exts));
    })
  );
}

/**
 * Apply the dynamic-array, internal-hyperlink and shown-note fixups to an
 * xlsx buffer. `exportToXlsx` runs these (and every other registered step)
 * through the post-processor registry (postProcessors.ts); this stays for
 * callers that only want these three.
 */
export async function postProcessXlsx(
  buffer: ArrayBuffer | Uint8Array,
  info: XlsxPostProcessInfo
): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(buffer);
  // after the dynamic arrays: shares xl/metadata.xml with them
  await fixInternalHyperlinks(zip);
  await showNotes(zip, info);
  await applySheetXmlFixups(zip, info);
  for (const fixup of info.fixups ?? []) {
    // eslint-disable-next-line no-await-in-loop
    await fixup(zip);
  }
  return zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
