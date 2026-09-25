/**
 * PivotTables in xlsx (see core modules/pivot.ts for the model).
 *
 * Export: a report's cells are ordinary cells and are written as values by
 * the cell writer. On top of that every PivotTable whose source can be
 * described gets its parts, so Excel opens it as a live PivotTable:
 * `xl/pivotCache/pivotCacheDefinitionN.xml` (source range or table, the
 * fields and their shared items), `pivotCacheRecordsN.xml` (the source
 * rows) and `xl/pivotTables/pivotTableN.xml` (location, row / column /
 * page / data fields, layout, subtotals, grand totals, sorting, hidden
 * items, "show values as"). The cache is marked `refreshOnLoad`, so Excel
 * rebuilds the report from the definition when the file is opened.
 * Not written (the report keeps its values): date grouping, label and
 * value filters, and number formats of value fields.
 *
 * Import: the parts are read back into `sheet.pivotTables` (source, fields,
 * layout options, sorting, hidden items, report filter selections, data
 * fields with their functions and "show values as", years / quarters /
 * months / days date groups). The cells keep Excel's cached values until
 * TinySheet refreshes the report.
 */
import JSZip from "jszip";
import { pivotItemKey } from "@lofcz/tinysheet-core";
import type {
  PivotAggregate,
  PivotDateGroup,
  PivotFieldSettings,
  PivotShowAs,
  PivotTable,
  PivotValueField,
} from "@lofcz/tinysheet-core";
import type { WorkbookImportContext } from "../ToFortuneSheet/importFeatures";

const NS_MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const NS_R =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const REL_BASE =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const REL_PIVOT_TABLE = `${REL_BASE}/pivotTable`;
const REL_CACHE_DEF = `${REL_BASE}/pivotCacheDefinition`;
const REL_CACHE_RECORDS = `${REL_BASE}/pivotCacheRecords`;
const CT_BASE = "application/vnd.openxmlformats-officedocument.spreadsheetml";
const CT_PIVOT_TABLE = `${CT_BASE}.pivotTable+xml`;
const CT_CACHE_DEF = `${CT_BASE}.pivotCacheDefinition+xml`;
const CT_CACHE_RECORDS = `${CT_BASE}.pivotCacheRecords+xml`;

/* ------------------------------------------------------------------------ */
/* Small XML helpers                                                        */
/* ------------------------------------------------------------------------ */

function esc(s: string) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function unesc(s: string) {
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

function attr(tag: string, name: string): string | undefined {
  const m = new RegExp(`\\s${name.replace(":", "\\:")}="([^"]*)"`).exec(tag);
  return m ? unesc(m[1]) : undefined;
}

function tags(xml: string, name: string): string[] {
  return xml.match(new RegExp(`<${name}\\b[^>]*?/?>`, "g")) || [];
}

/** Elements with their content: `<name ...>...</name>` or `<name .../>`. */
function elements(xml: string, name: string): string[] {
  const re = new RegExp(`<${name}\\b[^>]*?(?:/>|>[\\s\\S]*?</${name}>)`, "g");
  return xml.match(re) || [];
}

function colName(c: number) {
  let s = "";
  let n = c + 1;
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function colIndex(letters: string) {
  let c = 0;
  for (let i = 0; i < letters.length; i += 1) {
    c = c * 26 + (letters.toUpperCase().charCodeAt(i) - 64);
  }
  return c - 1;
}

function a1(r: number, c: number) {
  return `${colName(c)}${r + 1}`;
}

function rangeRef(row: [number, number], column: [number, number]) {
  return `${a1(row[0], column[0])}:${a1(row[1], column[1])}`;
}

function parseRef(
  ref: string
): { row: [number, number]; column: [number, number] } | null {
  const m = /^\$?([A-Za-z]+)\$?(\d+)(?::\$?([A-Za-z]+)\$?(\d+))?$/.exec(
    ref.trim()
  );
  if (!m) return null;
  const c1 = colIndex(m[1]);
  const r1 = Number(m[2]) - 1;
  const c2 = m[3] ? colIndex(m[3]) : c1;
  const r2 = m[4] ? Number(m[4]) - 1 : r1;
  return {
    row: [Math.min(r1, r2), Math.max(r1, r2)],
    column: [Math.min(c1, c2), Math.max(c1, c2)],
  };
}

type Rel = { id: string; type: string; target: string };

function relsOf(xml: string | null | undefined): Rel[] {
  return tags(xml ?? "", "Relationship").map((t) => ({
    id: attr(t, "Id") ?? "",
    type: attr(t, "Type") ?? "",
    target: attr(t, "Target") ?? "",
  }));
}

function resolvePath(from: string, target: string) {
  if (target.startsWith("/")) return target.slice(1);
  const parts = from.split("/").slice(0, -1);
  target.split("/").forEach((seg) => {
    if (seg === "..") parts.pop();
    else if (seg !== "." && seg) parts.push(seg);
  });
  return parts.join("/");
}

function relsPathFor(part: string) {
  const i = part.lastIndexOf("/");
  return `${part.slice(0, i)}/_rels/${part.slice(i + 1)}.rels`;
}

function nextRid(xml: string | null) {
  let n = 1;
  while ((xml ?? "").includes(`Id="rId${n}"`)) n += 1;
  return `rId${n}`;
}

function addRel(xml: string | null, id: string, type: string, target: string) {
  const rel = `<Relationship Id="${id}" Type="${type}" Target="${esc(
    target
  )}"/>`;
  if (!xml) {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rel}</Relationships>`;
  }
  return xml.replace("</Relationships>", `${rel}</Relationships>`);
}

/* ------------------------------------------------------------------------ */
/* Source values                                                            */
/* ------------------------------------------------------------------------ */

type Val = string | number | boolean | null;

function cellValue(cell: any): Val {
  const v = cell?.v;
  if (v == null || v === "") return null;
  if (typeof v === "number" || typeof v === "boolean") return v;
  return String(v);
}

function matrixOf(sheet: any): any[][] {
  if (Array.isArray(sheet?.data) && sheet.data.length) return sheet.data;
  const out: any[][] = [];
  (sheet?.celldata ?? []).forEach((c: any) => {
    if (!out[c.r]) out[c.r] = [];
    out[c.r][c.c] = c.v;
  });
  return out;
}

type SourceInfo = {
  ref: string;
  sheetName?: string;
  tableName?: string;
  names: string[];
  records: Val[][];
};

function readSource(pivot: PivotTable, sheets: any[]): SourceInfo | null {
  let sheet: any;
  let span: { row: [number, number]; column: [number, number] } | undefined;
  let tableName: string | undefined;
  if (pivot.source.table) {
    const upper = pivot.source.table.toUpperCase();
    sheets.forEach((s) => {
      (s.tables ?? []).forEach((t: any) => {
        if (String(t.name).toUpperCase() !== upper) return;
        sheet = s;
        tableName = t.name;
        const end = t.totalRow ? t.range.row[1] - 1 : t.range.row[1];
        span = { row: [t.range.row[0], end], column: t.range.column };
      });
    });
  } else {
    sheet = sheets.find((s) => s.id === pivot.source.sheetId);
    span = pivot.source.range;
  }
  if (!sheet || !span) return null;
  const data = matrixOf(sheet);
  const names: string[] = [];
  for (let c = span.column[0]; c <= span.column[1]; c += 1) {
    const h = cellValue(data[span.row[0]]?.[c]);
    if (h == null) return null;
    const text = String(h);
    const taken = new Set(names.map((x) => x.toUpperCase()));
    let name = text;
    for (let n = 2; taken.has(name.toUpperCase()); n += 1) {
      name = `${text}${n}`;
    }
    names.push(name);
  }
  const lastRow = Math.min(span.row[1], data.length - 1);
  const records: Val[][] = [];
  for (let r = span.row[0] + 1; r <= lastRow; r += 1) {
    const rec: Val[] = [];
    for (let c = span.column[0]; c <= span.column[1]; c += 1) {
      rec.push(cellValue(data[r]?.[c]));
    }
    records.push(rec);
  }
  while (
    records.length &&
    records[records.length - 1].every((v) => v == null)
  ) {
    records.pop();
  }
  const row: [number, number] = [span.row[0], span.row[0] + records.length];
  return {
    ref: rangeRef(row, span.column),
    sheetName: sheet.name,
    tableName,
    names,
    records,
  };
}

/* ------------------------------------------------------------------------ */
/* Export                                                                   */
/* ------------------------------------------------------------------------ */

const SHOW_AS_XML: Record<string, string> = {
  percentOfGrandTotal: "percentOfTotal",
  percentOfRowTotal: "percentOfRow",
  percentOfColumnTotal: "percentOfCol",
  difference: "difference",
  percentDifference: "percentDiff",
};

/** Excel's default data field names ("Sum of Sales"). */
const CAPTION_PREFIX: Record<string, string> = {
  sum: "Sum",
  count: "Count",
  average: "Average",
  max: "Max",
  min: "Min",
  product: "Product",
  countNums: "Count",
  stdDev: "StdDev",
  stdDevp: "StdDevp",
  var: "Var",
  varp: "Varp",
};

function defaultCaption(v: { aggregate: string; field: string }) {
  return `${CAPTION_PREFIX[v.aggregate] ?? "Sum"} of ${v.field}`;
}

const BASE_PREVIOUS = 1048828;
const BASE_NEXT = 1048829;

function compareVals(a: Val, b: Val) {
  const rank = (v: Val) => {
    if (typeof v === "number") return 0;
    if (typeof v === "string") return 1;
    if (typeof v === "boolean") return 2;
    return 3;
  };
  if (rank(a) !== rank(b)) return rank(a) - rank(b);
  if (typeof a === "string" && typeof b === "string") {
    return a.toLowerCase() < b.toLowerCase()
      ? -1
      : a.toLowerCase() > b.toLowerCase()
      ? 1
      : 0;
  }
  return Number(a) - Number(b);
}

type CacheField = {
  name: string;
  /** Distinct values (enumerated fields) in shared-item order. */
  items?: Val[];
  index?: Map<string, number>;
};

function sharedItemsXml(values: Val[], enumerate: boolean, items?: Val[]) {
  const nonNull = values.filter((v) => v != null);
  const hasBlank = nonNull.length < values.length;
  const strings = nonNull.some((v) => typeof v === "string");
  const numbers = nonNull.filter((v): v is number => typeof v === "number");
  const bools = nonNull.some((v) => typeof v === "boolean");
  const flags: string[] = [];
  if (!strings) {
    flags.push('containsSemiMixedTypes="0"', 'containsString="0"');
  }
  if (numbers.length) {
    flags.push('containsNumber="1"');
    if (numbers.every((n) => Number.isInteger(n)))
      flags.push('containsInteger="1"');
    flags.push(
      `minValue="${Math.min(...numbers)}"`,
      `maxValue="${Math.max(...numbers)}"`
    );
  }
  if (bools) flags.push('containsMixedTypes="1"');
  if (hasBlank) flags.push('containsBlank="1"');
  const head = ["<sharedItems", ...flags].join(" ");
  if (!enumerate || !items) return `${head}/>`;
  const body = items
    .map((v) => {
      if (v == null) return "<m/>";
      if (typeof v === "number") return `<n v="${v}"/>`;
      if (typeof v === "boolean") return `<b v="${v ? 1 : 0}"/>`;
      return `<s v="${esc(v)}"/>`;
    })
    .join("");
  return `${head} count="${items.length}">${body}</sharedItems>`;
}

function valueXml(v: Val) {
  if (v == null) return "<m/>";
  if (typeof v === "number") return `<n v="${v}"/>`;
  if (typeof v === "boolean") return `<b v="${v ? 1 : 0}"/>`;
  return `<s v="${esc(v)}"/>`;
}

type PivotParts = { definition: string; records: string; table: string };

/** The xlsx parts of a PivotTable, or null when it can't be described. */
export function pivotToXlsxParts(
  pivot: PivotTable,
  sheets: any[],
  cacheId: number
): PivotParts | null {
  if (!pivot.layout || !pivot.output) return null;
  const hasGroups =
    Object.values(pivot.fields ?? {}).some((f) => f.dateGroups?.length) ||
    [
      ...pivot.rows,
      ...pivot.columns,
      ...pivot.filters.map((f) => f.field),
    ].some((id) => id.includes("|"));
  if (hasGroups) return null;
  const src = readSource(pivot, sheets);
  if (!src) return null;
  const upperNames = src.names.map((n) => n.toUpperCase());
  const fieldOf = (name: string) => upperNames.indexOf(name.toUpperCase());
  const axisIds = [
    ...pivot.rows,
    ...pivot.columns,
    ...pivot.filters.map((f) => f.field),
  ];
  if (
    axisIds.some((id) => fieldOf(id) < 0) ||
    pivot.values.some((v) => fieldOf(v.field) < 0)
  ) {
    return null;
  }
  const axisSet = new Set(axisIds.map(fieldOf));

  // cache fields: axis fields and text fields enumerate their items
  const fields: CacheField[] = src.names.map((name, i) => {
    const values = src.records.map((r) => r[i]);
    const enumerate =
      axisSet.has(i) || values.some((v) => typeof v === "string");
    if (!enumerate) return { name };
    const seen = new Map<string, Val>();
    values.forEach((v) => {
      const k = pivotItemKey(v);
      if (!seen.has(k)) seen.set(k, v);
    });
    const items = [...seen.values()].sort(compareVals);
    const index = new Map<string, number>();
    items.forEach((v, j) => index.set(pivotItemKey(v), j));
    return { name, items, index };
  });

  const cacheFieldsXml = fields
    .map((f, i) => {
      const values = src.records.map((r) => r[i]);
      return `<cacheField name="${esc(f.name)}" numFmtId="0">${sharedItemsXml(
        values,
        !!f.items,
        f.items
      )}</cacheField>`;
    })
    .join("");
  const source = src.tableName
    ? `<worksheetSource name="${esc(src.tableName)}"/>`
    : `<worksheetSource ref="${src.ref}" sheet="${esc(src.sheetName ?? "")}"/>`;
  const definition =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<pivotCacheDefinition xmlns="${NS_MAIN}" xmlns:r="${NS_R}" r:id="rId1" refreshOnLoad="1" refreshedBy="TinySheet" createdVersion="6" refreshedVersion="6" minRefreshableVersion="3" recordCount="${src.records.length}">` +
    `<cacheSource type="worksheet">${source}</cacheSource>` +
    `<cacheFields count="${fields.length}">${cacheFieldsXml}</cacheFields>` +
    `</pivotCacheDefinition>`;
  const records =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<pivotCacheRecords xmlns="${NS_MAIN}" xmlns:r="${NS_R}" count="${src.records.length}">` +
    src.records
      .map(
        (rec) =>
          `<r>${rec
            .map((v, i) =>
              fields[i].index
                ? `<x v="${fields[i].index!.get(pivotItemKey(v)) ?? 0}"/>`
                : valueXml(v)
            )
            .join("")}</r>`
      )
      .join("") +
    `</pivotCacheRecords>`;

  // pivot fields
  const { options } = pivot;
  const tabular = options.layout === "tabular";
  const outline = options.layout === "outline";
  const dataFieldSet = new Set(pivot.values.map((v) => fieldOf(v.field)));
  const pivotFieldsXml = src.names
    .map((name, i) => {
      const settings: PivotFieldSettings = pivot.fields?.[name] ?? {};
      const a: string[] = [];
      const upper = name.toUpperCase();
      const onRows = pivot.rows.some((x) => x.toUpperCase() === upper);
      const onCols = pivot.columns.some((x) => x.toUpperCase() === upper);
      const filter = pivot.filters.find((f) => f.field.toUpperCase() === upper);
      if (onRows) a.push('axis="axisRow"');
      else if (onCols) a.push('axis="axisCol"');
      else if (filter) a.push('axis="axisPage"');
      if (dataFieldSet.has(i)) a.push('dataField="1"');
      if (tabular) a.push('compact="0" outline="0"');
      else if (outline) a.push('compact="0"');
      a.push('showAll="0"');
      const axis = onRows || onCols || !!filter;
      const noSubtotal =
        settings.subtotal === false || (axis && options.subtotals === "off");
      if (noSubtotal) a.push('defaultSubtotal="0"');
      else if (options.subtotals === "bottom" && onRows) {
        a.push('subtotalTop="0"');
      }
      if (axis && settings.sort === "desc") a.push('sortType="descending"');
      else if (axis && settings.sort !== "none") {
        a.push('sortType="ascending"');
      }
      if (filter?.selected && filter.selected.length > 1) {
        a.push('multipleItemSelectionAllowed="1"');
      }
      let inner = "";
      const f = fields[i];
      if (axis && f.items) {
        let hidden = new Set(settings.hiddenItems ?? []);
        if (filter?.selected && filter.selected.length > 1) {
          const keep = new Set(filter.selected);
          hidden = new Set(
            f.items.map((v) => pivotItemKey(v)).filter((k) => !keep.has(k))
          );
        }
        const items = f.items.map(
          (v, j) =>
            `<item x="${j}"${hidden.has(pivotItemKey(v)) ? ' h="1"' : ""}/>`
        );
        if (!noSubtotal) items.push('<item t="default"/>');
        inner += `<items count="${items.length}">${items.join("")}</items>`;
      }
      if (settings.sortByValue != null && pivot.values[settings.sortByValue]) {
        inner +=
          `<autoSortScope><pivotArea dataOnly="0" outline="0" fieldPosition="0">` +
          `<references count="1"><reference field="4294967294" count="1" selected="0"><x v="${settings.sortByValue}"/></reference></references>` +
          `</pivotArea></autoSortScope>`;
      }
      return inner
        ? `<pivotField ${a.join(" ")}>${inner}</pivotField>`
        : `<pivotField ${a.join(" ")}/>`;
    })
    .join("");

  const sigma = pivot.values.length > 1;
  const fieldList = (ids: string[], withValues: boolean) => {
    const xs = ids.map((id) => `<field x="${fieldOf(id)}"/>`);
    if (withValues) xs.push('<field x="-2"/>');
    return xs;
  };
  const rowFields = fieldList(pivot.rows, sigma && !!options.valuesOnRows);
  const colFields = fieldList(pivot.columns, sigma && !options.valuesOnRows);
  const pageFields = pivot.filters.map((flt) => {
    const i = fieldOf(flt.field);
    const item =
      flt.selected?.length === 1
        ? fields[i].index?.get(flt.selected[0])
        : undefined;
    return `<pageField fld="${i}" hier="-1"${
      item != null ? ` item="${item}"` : ""
    }/>`;
  });
  const baseFieldIndex = (v: PivotValueField) =>
    v.baseField != null ? Math.max(0, fieldOf(v.baseField)) : 0;
  const baseItemIndex = (v: PivotValueField) => {
    if (v.baseItem == null || v.baseItem === "(previous)") return BASE_PREVIOUS;
    if (v.baseItem === "(next)") return BASE_NEXT;
    const f = fields[baseFieldIndex(v)];
    const j = (f.items ?? []).findIndex(
      (x) => String(x ?? "").toLowerCase() === v.baseItem!.toLowerCase()
    );
    return j < 0 ? 0 : j;
  };
  const dataFields = pivot.values.map((v) => {
    const a = [
      `name="${esc(v.name ?? defaultCaption(v))}"`,
      `fld="${fieldOf(v.field)}"`,
    ];
    if (v.aggregate !== "sum") a.push(`subtotal="${v.aggregate}"`);
    const showAs = v.showAs && SHOW_AS_XML[v.showAs];
    if (showAs) a.push(`showDataAs="${showAs}"`);
    a.push(
      `baseField="${baseFieldIndex(v)}"`,
      `baseItem="${baseItemIndex(v)}"`
    );
    return `<dataField ${a.join(" ")}/>`;
  });

  const { layout, output } = pivot;
  const locRow: [number, number] = [layout.row, output.row[1]];
  const width = layout.labelCols + layout.colItems.length;
  const locCol: [number, number] = [
    layout.col,
    layout.col + Math.max(1, width) - 1,
  ];
  const loc = [
    `ref="${rangeRef(locRow, locCol)}"`,
    `firstHeaderRow="1"`,
    `firstDataRow="${Math.max(1, layout.headerRows)}"`,
    `firstDataCol="${Math.max(0, layout.labelCols)}"`,
  ];
  if (pivot.filters.length) {
    loc.push(`rowPageCount="${pivot.filters.length}"`, `colPageCount="1"`);
  }
  const t: string[] = [
    `name="${esc(pivot.name)}"`,
    `cacheId="${cacheId}"`,
    'applyNumberFormats="0" applyBorderFormats="0" applyFontFormats="0" applyPatternFormats="0" applyAlignmentFormats="0" applyWidthHeightFormats="1"',
    'dataCaption="Values"',
    'updatedVersion="6" minRefreshableVersion="3" useAutoFormatting="1" itemPrintTitles="1" createdVersion="6" indent="0"',
  ];
  if (tabular || outline) t.push('compact="0" compactData="0"');
  t.push(
    tabular ? 'outline="0" outlineData="0"' : 'outline="1" outlineData="1"'
  );
  t.push('multipleFieldFilters="0"');
  // rowGrandTotals: the grand total column (totals of each row)
  if (!options.grandTotalColumn) t.push('rowGrandTotals="0"');
  if (!options.grandTotalRow) t.push('colGrandTotals="0"');
  if (sigma && options.valuesOnRows) t.push('dataOnRows="1"');
  if (options.emptyText) {
    t.push(`missingCaption="${esc(options.emptyText)}"`);
  }
  if (options.preserveFormatting === false) t.push('preserveFormatting="0"');
  if (pivot.rowHeaderCaption) {
    t.push(`rowHeaderCaption="${esc(pivot.rowHeaderCaption)}"`);
  }
  if (pivot.colHeaderCaption) {
    t.push(`colHeaderCaption="${esc(pivot.colHeaderCaption)}"`);
  }
  const table =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<pivotTableDefinition xmlns="${NS_MAIN}" ${t.join(" ")}>` +
    `<location ${loc.join(" ")}/>` +
    `<pivotFields count="${src.names.length}">${pivotFieldsXml}</pivotFields>` +
    (rowFields.length
      ? `<rowFields count="${rowFields.length}">${rowFields.join(
          ""
        )}</rowFields>`
      : "") +
    (colFields.length
      ? `<colFields count="${colFields.length}">${colFields.join(
          ""
        )}</colFields>`
      : "") +
    (pageFields.length
      ? `<pageFields count="${pageFields.length}">${pageFields.join(
          ""
        )}</pageFields>`
      : "") +
    (dataFields.length
      ? `<dataFields count="${dataFields.length}">${dataFields.join(
          ""
        )}</dataFields>`
      : "") +
    `<pivotTableStyleInfo name="PivotStyleLight16" showRowHeaders="1" showColHeaders="1" showRowStripes="0" showColStripes="0" showLastColumn="1"/>` +
    `</pivotTableDefinition>`;
  return { definition, records, table };
}

/**
 * Adds the PivotTable parts of `sheets` to an xlsx written by the cell
 * pipeline. Sheets are matched with the workbook's sheets by name.
 */
export async function addPivotTablesToXlsx(
  buffer: ArrayBuffer | Uint8Array,
  sheets: any[]
): Promise<ArrayBuffer | Uint8Array> {
  if (!sheets.some((s) => s?.pivotTables?.length)) return buffer;
  const zip = await JSZip.loadAsync(buffer);
  let workbookXml = await zip.file("xl/workbook.xml")?.async("string");
  let workbookRels = await zip
    .file("xl/_rels/workbook.xml.rels")
    ?.async("string");
  let types = await zip.file("[Content_Types].xml")?.async("string");
  if (!workbookXml || !workbookRels || !types) return buffer;
  const wbRels = relsOf(workbookRels);
  const sheetTags = tags(workbookXml, "sheet");
  const existing = Object.keys(zip.files);
  let n = existing.filter((f) =>
    /^xl\/pivotTables\/pivotTable\d+\.xml$/.test(f)
  ).length;
  let cacheId = 100;
  const caches: string[] = [];
  let added = 0;

  /* eslint-disable no-await-in-loop */
  for (let s = 0; s < sheetTags.length; s += 1) {
    const tag = sheetTags[s];
    const name = attr(tag, "name") ?? "";
    const sheet = sheets.find((x) => x?.name === name);
    const rel = wbRels.find((r) => r.id === attr(tag, "r:id"));
    if (!sheet?.pivotTables?.length || !rel) continue;
    const sheetPath = resolvePath("xl/workbook.xml", rel.target);
    const sheetRelsPath = relsPathFor(sheetPath);
    let sheetRels = (await zip.file(sheetRelsPath)?.async("string")) ?? null;
    for (let p = 0; p < sheet.pivotTables.length; p += 1) {
      const parts = pivotToXlsxParts(sheet.pivotTables[p], sheets, cacheId);
      if (parts) {
        n += 1;
        const defPath = `xl/pivotCache/pivotCacheDefinition${n}.xml`;
        const recPath = `xl/pivotCache/pivotCacheRecords${n}.xml`;
        const tablePath = `xl/pivotTables/pivotTable${n}.xml`;
        zip.file(defPath, parts.definition);
        zip.file(recPath, parts.records);
        zip.file(tablePath, parts.table);
        zip.file(
          relsPathFor(defPath),
          addRel(null, "rId1", REL_CACHE_RECORDS, `pivotCacheRecords${n}.xml`)
        );
        zip.file(
          relsPathFor(tablePath),
          addRel(
            null,
            "rId1",
            REL_CACHE_DEF,
            `../pivotCache/pivotCacheDefinition${n}.xml`
          )
        );
        sheetRels = addRel(
          sheetRels,
          nextRid(sheetRels),
          REL_PIVOT_TABLE,
          `../pivotTables/pivotTable${n}.xml`
        );
        const wbRid = nextRid(workbookRels);
        workbookRels = addRel(
          workbookRels,
          wbRid,
          REL_CACHE_DEF,
          `pivotCache/pivotCacheDefinition${n}.xml`
        );
        caches.push(`<pivotCache cacheId="${cacheId}" r:id="${wbRid}"/>`);
        types = types!.replace(
          "</Types>",
          `<Override PartName="/${defPath}" ContentType="${CT_CACHE_DEF}"/>` +
            `<Override PartName="/${recPath}" ContentType="${CT_CACHE_RECORDS}"/>` +
            `<Override PartName="/${tablePath}" ContentType="${CT_PIVOT_TABLE}"/></Types>`
        );
        cacheId += 1;
        added += 1;
      }
    }
    if (sheetRels) zip.file(sheetRelsPath, sheetRels);
  }
  /* eslint-enable no-await-in-loop */
  if (!added) return buffer;
  // <pivotCaches> follows definedNames / calcPr (schema order)
  const block = `<pivotCaches>${caches.join("")}</pivotCaches>`;
  if (
    !/xmlns:r=/.test(
      workbookXml.slice(
        0,
        workbookXml.indexOf(">", workbookXml.indexOf("<workbook"))
      )
    )
  ) {
    workbookXml = workbookXml.replace(
      "<workbook ",
      `<workbook xmlns:r="${NS_R}" `
    );
  }
  const after = ["</calcPr>", "<calcPr", "</definedNames>", "</sheets>"];
  let inserted = false;
  for (let i = 0; i < after.length && !inserted; i += 1) {
    const key = after[i];
    const at = workbookXml.indexOf(key);
    if (at >= 0) {
      const end =
        key === "<calcPr" ? workbookXml.indexOf(">", at) + 1 : at + key.length;
      workbookXml = workbookXml.slice(0, end) + block + workbookXml.slice(end);
      inserted = true;
    }
  }
  zip.file("xl/workbook.xml", workbookXml);
  zip.file("xl/_rels/workbook.xml.rels", workbookRels);
  zip.file("[Content_Types].xml", types!);
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}

/* ------------------------------------------------------------------------ */
/* Import                                                                   */
/* ------------------------------------------------------------------------ */

const SHOW_AS_MODEL: Record<string, PivotShowAs> = {
  percentOfTotal: "percentOfGrandTotal",
  percentOfRow: "percentOfRowTotal",
  percentOfCol: "percentOfColumnTotal",
  difference: "difference",
  percentDiff: "percentDifference",
};

const AGGREGATES = new Set([
  "sum",
  "count",
  "average",
  "max",
  "min",
  "product",
  "countNums",
  "stdDev",
  "stdDevp",
  "var",
  "varp",
]);

const GROUPS: Record<string, PivotDateGroup> = {
  years: "years",
  quarters: "quarters",
  months: "months",
  days: "days",
};

function isoToSerial(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2}))?/.exec(iso);
  if (!m) return null;
  const ms = Date.UTC(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4] ?? 0),
    Number(m[5] ?? 0),
    Number(m[6] ?? 0)
  );
  return ms / 86400000 + 25569;
}

function sharedValue(el: string): Val {
  const name = /^<(\w+)/.exec(el)?.[1];
  const v = attr(el, "v");
  switch (name) {
    case "n":
      return Number(v);
    case "b":
      return v === "1" || v === "true";
    case "d":
      return v ? isoToSerial(v) : null;
    case "m":
      return null;
    default:
      return v ?? "";
  }
}

type ImportCacheField = {
  name: string;
  items: Val[];
  /** Grouped by: base field index and group. */
  group?: { base: number; by: PivotDateGroup };
  database: boolean;
};

function parseCache(xml: string) {
  const ws = tags(xml, "worksheetSource")[0];
  const fields: ImportCacheField[] = elements(xml, "cacheField").map((el) => {
    const open = /^<cacheField\b[^>]*>/.exec(el)?.[0] ?? el;
    const shared = elements(el, "sharedItems")[0] ?? "";
    const inner = shared.replace(/^<sharedItems\b[^>]*>/, "");
    const items = (inner.match(/<(?:s|n|b|d|m|e)\b[^>]*\/?>/g) || []).map(
      sharedValue
    );
    const groupTag = tags(el, "fieldGroup")[0];
    const rangePr = tags(el, "rangePr")[0];
    const by = rangePr ? GROUPS[attr(rangePr, "groupBy") ?? ""] : undefined;
    const base = groupTag ? attr(groupTag, "base") : undefined;
    return {
      name: attr(open, "name") ?? "",
      items,
      group: by ? { base: base != null ? Number(base) : -1, by } : undefined,
      database: attr(open, "databaseField") !== "0",
    };
  });
  return {
    ref: ws ? attr(ws, "ref") : undefined,
    sheet: ws ? attr(ws, "sheet") : undefined,
    tableName: ws ? attr(ws, "name") : undefined,
    fields,
  };
}

/** A pivotTableDefinition + its cache -> the TinySheet model. */
export function parsePivotTableXml(
  tableXml: string,
  cacheXml: string,
  resolveSheet: (name: string | undefined) => string | undefined,
  id: string
): PivotTable | null {
  const cache = parseCache(cacheXml);
  const root = /<pivotTableDefinition\b[^>]*>/.exec(tableXml)?.[0];
  const locTag = tags(tableXml, "location")[0];
  if (!root || !locTag) return null;
  const loc = parseRef(attr(locTag, "ref") ?? "");
  if (!loc) return null;
  // field ids: base fields keep their name, grouped ones are "Field|years"
  const fieldIds = cache.fields.map((f, i) => {
    if (f.group && (!f.database || f.group.base !== i)) {
      const base = f.group.base >= 0 ? cache.fields[f.group.base] : undefined;
      return base ? `${base.name}|${f.group.by}` : f.name;
    }
    return f.name;
  });
  const settings: Record<string, PivotFieldSettings> = {};
  cache.fields.forEach((f, i) => {
    if (!f.group) return;
    const baseIndex = f.database ? i : f.group.base;
    const base = cache.fields[baseIndex];
    if (!base) return;
    const s = (settings[base.name] ??= {});
    s.dateGroups = [...(s.dateGroups ?? []), f.group.by];
  });
  Object.values(settings).forEach((s) => {
    if (s.dateGroups) {
      const order = ["years", "quarters", "months", "days"];
      s.dateGroups.sort((a, b) => order.indexOf(a) - order.indexOf(b));
    }
  });
  const keyOf = (fieldIndex: number, v: Val) => {
    const f = cache.fields[fieldIndex];
    if (f?.group) {
      // date-group items are labels ("2023", "Qtr1", "Jan") -> group keys
      const text = String(v ?? "");
      if (f.group.by === "years" && /^\d{4}$/.test(text)) return `y:${text}`;
      if (f.group.by === "quarters") {
        const q = /(\d)$/.exec(text)?.[1];
        if (q) return `q:${q}`;
      }
      if (f.group.by === "months") {
        const months = [
          "jan",
          "feb",
          "mar",
          "apr",
          "may",
          "jun",
          "jul",
          "aug",
          "sep",
          "oct",
          "nov",
          "dec",
        ];
        const m = months.indexOf(text.slice(0, 3).toLowerCase());
        if (m >= 0) return `m:${m + 1}`;
      }
    }
    return pivotItemKey(v);
  };

  const pivotFields = elements(tableXml, "pivotField");
  const layoutCompact = attr(root, "compact") !== "0";
  const layoutOutline = attr(root, "outline") !== "0";
  let subtotalsOff = false;
  let subtotalsBottom = false;
  let anyAxis = false;
  const pageSelected = new Map<number, string[]>();
  pivotFields.forEach((pf, i) => {
    const open = /^<pivotField\b[^>]*>/.exec(pf)?.[0] ?? pf;
    const axis = attr(open, "axis");
    const id = fieldIds[i];
    if (!id) return;
    const s: PivotFieldSettings = settings[id] ?? {};
    const sortType = attr(open, "sortType");
    if (sortType === "descending") s.sort = "desc";
    const sortRef = /<reference field="4294967294"[\s\S]*?<x v="(\d+)"/.exec(
      pf
    );
    if (sortRef) s.sortByValue = Number(sortRef[1]);
    const items = tags(pf, "item")
      .filter((it) => attr(it, "x") != null)
      .map((it) => ({
        x: Number(attr(it, "x")),
        hidden: attr(it, "h") === "1" || attr(it, "h") === "true",
      }));
    const hiddenKeys = items
      .filter((it) => it.hidden)
      .map((it) => keyOf(i, cache.fields[i]?.items[it.x] ?? null));
    if (axis === "axisPage") {
      if (hiddenKeys.length) {
        pageSelected.set(
          i,
          items
            .filter((it) => !it.hidden)
            .map((it) => keyOf(i, cache.fields[i]?.items[it.x] ?? null))
        );
      }
    } else if (hiddenKeys.length) {
      s.hiddenItems = hiddenKeys;
    }
    if (axis === "axisRow" || axis === "axisCol") {
      anyAxis = true;
      if (attr(open, "defaultSubtotal") === "0") {
        subtotalsOff = true;
      }
      if (attr(open, "subtotalTop") === "0") subtotalsBottom = true;
    }
    if (Object.keys(s).length) settings[id] = s;
  });

  const axisOf = (name: string) => {
    const el = elements(tableXml, name)[0] ?? "";
    return tags(el, "field").map((t) => Number(attr(t, "x")));
  };
  const rowXs = axisOf("rowFields");
  const colXs = axisOf("colFields");
  const rows = rowXs
    .filter((x) => x >= 0)
    .map((x) => fieldIds[x])
    .filter(Boolean);
  const columns = colXs
    .filter((x) => x >= 0)
    .map((x) => fieldIds[x])
    .filter(Boolean);
  const pageEl = elements(tableXml, "pageFields")[0] ?? "";
  const filters = tags(pageEl, "pageField").map((t) => {
    const fld = Number(attr(t, "fld"));
    const item = attr(t, "item");
    const field = fieldIds[fld];
    let selected = pageSelected.get(fld);
    if (item != null) {
      const pf = pivotFields[fld] ?? "";
      const xs = tags(pf, "item")
        .filter((it) => attr(it, "x") != null)
        .map((it) => Number(attr(it, "x")));
      const x = xs[Number(item)] ?? Number(item);
      selected = [keyOf(fld, cache.fields[fld]?.items[x] ?? null)];
    }
    return selected ? { field, selected } : { field };
  });
  const dataEl = elements(tableXml, "dataFields")[0] ?? "";
  const values: PivotValueField[] = tags(dataEl, "dataField").map((t) => {
    const fld = Number(attr(t, "fld"));
    const subtotal = attr(t, "subtotal") ?? "sum";
    const v: PivotValueField = {
      field: cache.fields[fld]?.name ?? "",
      aggregate: (AGGREGATES.has(subtotal)
        ? subtotal
        : "sum") as PivotAggregate,
    };
    const name = attr(t, "name");
    if (name && name.trim() !== defaultCaption(v)) v.name = name;
    const showAs = SHOW_AS_MODEL[attr(t, "showDataAs") ?? ""];
    if (showAs) {
      v.showAs = showAs;
      if (showAs === "difference" || showAs === "percentDifference") {
        const bf = Number(attr(t, "baseField") ?? 0);
        const bi = Number(attr(t, "baseItem") ?? BASE_PREVIOUS);
        v.baseField = fieldIds[bf];
        if (bi === BASE_PREVIOUS) v.baseItem = "(previous)";
        else if (bi === BASE_NEXT) v.baseItem = "(next)";
        else {
          const item = cache.fields[bf]?.items[bi];
          v.baseItem = item == null ? "(previous)" : String(item);
        }
      }
    }
    return v;
  });

  const pageCount = filters.length;
  const output = {
    row: [loc.row[0] - (pageCount ? pageCount + 1 : 0), loc.row[1]] as [
      number,
      number
    ],
    column: [
      loc.column[0],
      Math.max(loc.column[1], loc.column[0] + (pageCount ? 1 : 0)),
    ] as [number, number],
  };
  let layout: "compact" | "outline" | "tabular" = "compact";
  if (!layoutOutline) layout = "tabular";
  else if (!layoutCompact) layout = "outline";
  const firstField = pivotFields[rowXs.find((x) => x >= 0) ?? -1] ?? "";
  if (/^<pivotField\b[^>]*\boutline="0"/.test(firstField)) layout = "tabular";
  else if (
    /^<pivotField\b[^>]*\bcompact="0"/.test(firstField) &&
    layout === "compact"
  ) {
    layout = "outline";
  }
  const missing = attr(root, "missingCaption");
  const pivot: PivotTable = {
    id,
    name: attr(root, "name") ?? "PivotTable1",
    source: cache.tableName
      ? { table: cache.tableName }
      : {
          sheetId: resolveSheet(cache.sheet),
          range: cache.ref ? parseRef(cache.ref) ?? undefined : undefined,
        },
    anchor: { r: loc.row[0], c: loc.column[0] },
    rows,
    columns,
    values,
    filters,
    options: {
      layout,
      subtotals:
        subtotalsOff && anyAxis ? "off" : subtotalsBottom ? "bottom" : "top",
      grandTotalRow: attr(root, "colGrandTotals") !== "0",
      grandTotalColumn: attr(root, "rowGrandTotals") !== "0",
      preserveFormatting: attr(root, "preserveFormatting") !== "0",
      autoRefresh: false,
    },
    output,
  };
  if (attr(root, "dataOnRows") === "1") pivot.options.valuesOnRows = true;
  if (missing && attr(root, "showMissing") !== "0") {
    pivot.options.emptyText = missing;
  }
  const rowCaption = attr(root, "rowHeaderCaption");
  if (rowCaption) pivot.rowHeaderCaption = rowCaption;
  const colCaption = attr(root, "colHeaderCaption");
  if (colCaption) pivot.colHeaderCaption = colCaption;
  if (Object.keys(settings).length) pivot.fields = settings;
  return pivot;
}

/** Workbook import reader: every sheet's PivotTables -> `pivotTables`. */
export function readPivotTables(ctx: WorkbookImportContext) {
  const { files, sheets } = ctx;
  const workbookXml = files["xl/workbook.xml"];
  const wbRels = relsOf(files["xl/_rels/workbook.xml.rels"]);
  if (!workbookXml) return;
  const sheetTags = tags(workbookXml, "sheet");
  const idByName = new Map<string, string>();
  sheets.forEach((s: any) => idByName.set(String(s.name), String(s.id)));
  let counter = 0;
  sheetTags.forEach((tag) => {
    const name = attr(tag, "name") ?? "";
    const rel = wbRels.find((r) => r.id === attr(tag, "r:id"));
    const sheet = sheets.find((s: any) => s.name === name) as any;
    if (!rel || !sheet) return;
    const sheetPath = resolvePath("xl/workbook.xml", rel.target);
    const pivots: PivotTable[] = [];
    relsOf(files[relsPathFor(sheetPath)])
      .filter((r) => r.type === REL_PIVOT_TABLE)
      .forEach((r) => {
        const tablePath = resolvePath(sheetPath, r.target);
        const tableXml = files[tablePath];
        const cacheRel = relsOf(files[relsPathFor(tablePath)]).find(
          (x) => x.type === REL_CACHE_DEF
        );
        const cacheXml = cacheRel
          ? files[resolvePath(tablePath, cacheRel.target)]
          : undefined;
        if (!tableXml || !cacheXml) return;
        counter += 1;
        try {
          const pivot = parsePivotTableXml(
            tableXml,
            cacheXml,
            (n) => (n == null ? sheet.id : idByName.get(n)),
            `xlsx-pivot-${counter}`
          );
          if (pivot) pivots.push(pivot);
        } catch {
          // a definition we can't read: the cells keep their values
        }
      });
    if (pivots.length) sheet.pivotTables = pivots;
  });
}
