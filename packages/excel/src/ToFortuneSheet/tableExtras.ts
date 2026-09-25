/**
 * xlsx -> TinySheet: the table details beyond range, columns and style
 * (see importFeatures.ts `readTables`):
 *
 * - the table's filter state (`<autoFilter>` filter columns: value lists,
 *   custom criteria, top 10, dynamic filters), the filter-button option;
 * - calculated column formulas and custom total formulas;
 * - table slicers: `xl/slicers/` parts of the sheet, their x15
 *   `tableSlicerCache` in `xl/slicerCaches/` and their drawing anchors.
 *
 * Fidelity: value lists become TinySheet value filters (the rows they hide
 * are recomputed from the cells); other criteria keep the rows the file
 * hides. Colour and icon filters, pivot-table slicers and timeline slicers
 * are skipped.
 */
import { escapeCharacter } from "../common/method";
import { fromExcelFormula } from "../common/formulaText";
import { unqualifyStructuredReferences } from "../common/structuredRefs";
import type { IuploadfileList } from "../common/ICommon";

const EMU_PER_PX = 9525;

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

const openTag = (xml: string, name: string) =>
  new RegExp(`<(?:\\w+:)?${name}\\b[^>]*>`).exec(xml)?.[0];

/* ------------------------------------------------------------------------ */
/* Table part                                                               */
/* ------------------------------------------------------------------------ */

export type RawTableFilter = {
  colId: number;
  condition: any;
  /** value lists: the shown texts and whether blanks are shown */
  shown?: string[];
  blank?: boolean;
};

export type TablePartExtras = {
  /** `id` of the table part (slicer caches refer to it). */
  id: string;
  /** `id` of each table column, in order. */
  columnIds: string[];
  hasAutoFilter: boolean;
  filters: RawTableFilter[];
  calculated: Record<number, string>;
  totals: Record<number, string>;
};

const OPERATORS: Record<string, string> = {
  equal: "equals",
  notEqual: "notEquals",
  greaterThan: "greaterThan",
  greaterThanOrEqual: "greaterOrEqual",
  lessThan: "lessThan",
  lessThanOrEqual: "lessOrEqual",
};

/** A custom criterion (`equal` with wildcards -> beginsWith, ...). */
function criterion(tag: string) {
  const a = xmlAttrs(tag);
  const op = OPERATORS[a.operator ?? "equal"] ?? "equals";
  const val = a.val ?? "";
  if (op === "equals" || op === "notEquals") {
    const not = op === "notEquals";
    const inner = /^\*(.+)\*$/.exec(val);
    if (inner && !/[*?]/.test(inner[1])) {
      return { op: not ? "notContains" : "contains", value: inner[1] };
    }
    const begins = /^([^*?]+)\*$/.exec(val);
    if (begins) {
      return { op: not ? "notBeginsWith" : "beginsWith", value: begins[1] };
    }
    const ends = /^\*([^*?]+)$/.exec(val);
    if (ends) return { op: not ? "notEndsWith" : "endsWith", value: ends[1] };
  }
  return { op, value: val };
}

/** One `<filterColumn>` as a TinySheet condition, or null. */
export function parseFilterColumn(xml: string): RawTableFilter | null {
  const colId = Number(xmlAttrs(openTag(xml, "filterColumn") ?? "").colId);
  if (!Number.isFinite(colId)) return null;
  const filters = openTag(xml, "filters");
  if (filters) {
    const shown = (xml.match(/<(?:\w+:)?filter\b[^>]*>/g) || []).map(
      (tag) => xmlAttrs(tag).val ?? ""
    );
    return {
      colId,
      condition: { type: "values" },
      shown,
      blank: xmlAttrs(filters).blank === "1",
    };
  }
  const custom = openTag(xml, "customFilters");
  if (custom) {
    const items = (xml.match(/<(?:\w+:)?customFilter\b[^>]*>/g) || []).map(
      criterion
    );
    if (items.length === 0) return null;
    const condition: any = {
      type: "custom",
      op1: items[0].op,
      value1: items[0].value,
    };
    if (items[1]) {
      condition.join = xmlAttrs(custom).and === "1" ? "and" : "or";
      condition.op2 = items[1].op;
      condition.value2 = items[1].value;
    }
    return { colId, condition };
  }
  const top = openTag(xml, "top10");
  if (top) {
    const a = xmlAttrs(top);
    const condition: any = { type: "top10", count: Number(a.val) || 10 };
    if (a.top === "0") condition.bottom = true;
    if (a.percent === "1") condition.percent = true;
    return { colId, condition };
  }
  const dynamic = openTag(xml, "dynamicFilter");
  if (dynamic) {
    const type = xmlAttrs(dynamic).type ?? "";
    if (type === "aboveAverage") {
      return { colId, condition: { type: "average" } };
    }
    if (type === "belowAverage") {
      return { colId, condition: { type: "average", below: true } };
    }
    return { colId, condition: { type: "datePeriod", period: type } };
  }
  return null;
}

function elementText(xml: string, name: string) {
  const m = new RegExp(
    `<(?:\\w+:)?${name}\\b[^>]*>([\\s\\S]*?)</(?:\\w+:)?${name}>`
  ).exec(xml);
  return m ? escapeCharacter(m[1]) : null;
}

/** The extras of a table part (filters, formulas, ids). */
export function parseTablePartExtras(
  xml: string,
  tableName: string
): TablePartExtras {
  const open = openTag(xml, "table") ?? "";
  const af =
    /<(?:\w+:)?autoFilter\b[^>]*?(?:\/>|>([\s\S]*?)<\/(?:\w+:)?autoFilter>)/.exec(
      xml
    );
  const filters: RawTableFilter[] = [];
  (
    af?.[1]?.match(
      /<(?:\w+:)?filterColumn\b[^>]*?(?:\/>|>[\s\S]*?<\/(?:\w+:)?filterColumn>)/g
    ) || []
  )
    .map(parseFilterColumn)
    .forEach((f) => {
      if (f) filters.push(f);
    });
  const columnIds: string[] = [];
  const calculated: Record<number, string> = {};
  const totals: Record<number, string> = {};
  const formula = (text: string) =>
    unqualifyStructuredReferences(fromExcelFormula(text), tableName);
  (
    xml.match(
      /<(?:\w+:)?tableColumn\b[^>]*?(?:\/>|>[\s\S]*?<\/(?:\w+:)?tableColumn>)/g
    ) || []
  ).forEach((el, i) => {
    columnIds.push(xmlAttrs(openTag(el, "tableColumn") ?? "").id ?? "");
    const calc = elementText(el, "calculatedColumnFormula");
    if (calc) calculated[i] = formula(calc);
    const total = elementText(el, "totalsRowFormula");
    if (total) totals[i] = formula(total);
  });
  return {
    id: xmlAttrs(open).id ?? "",
    columnIds,
    hasAutoFilter: !!af,
    filters,
    calculated,
    totals,
  };
}

/* ------------------------------------------------------------------------ */
/* Filters on the imported cells                                            */
/* ------------------------------------------------------------------------ */

function cellText(v: any) {
  if (v == null) return "";
  if (typeof v !== "object") return String(v);
  if (v.ct?.t === "inlineStr") {
    return (v.ct.s || []).map((x: any) => x?.v ?? "").join("");
  }
  const t = v.m ?? v.v;
  return t == null ? "" : String(t);
}

/**
 * The table's filters (`table.filters`) from the raw filter columns: value
 * lists hide the rows whose text is not shown; other criteria keep the
 * rows the file hides.
 */
export function tableFiltersFromXlsx(
  sheet: { celldata: any[]; config?: any },
  table: any,
  raw: RawTableFilter[]
) {
  if (raw.length === 0) return undefined;
  const [r1, r2] = table.range.row;
  const dataStart = r1 + (table.headerRow !== false ? 1 : 0);
  const dataEnd = r2 - (table.totalRow ? 1 : 0);
  const c1 = table.range.column[0];
  const texts = new Map<string, string>();
  sheet.celldata.forEach((cell) => {
    if (cell.r >= dataStart && cell.r <= dataEnd) {
      texts.set(`${cell.r}_${cell.c}`, cellText(cell.v));
    }
  });
  const sheetHidden = sheet.config?.rowhidden ?? {};
  const out: Record<string, any> = {};
  raw.forEach((f) => {
    if (f.colId < 0 || f.colId >= table.columns.length) return;
    const c = c1 + f.colId;
    const rowhidden: Record<string, number> = {};
    if (f.condition.type === "values") {
      const shown = new Set(f.shown ?? []);
      if (f.blank) shown.add("");
      const hidden = new Set<string>();
      for (let r = dataStart; r <= dataEnd; r += 1) {
        const text = texts.get(`${r}_${c}`) ?? "";
        if (!shown.has(text)) {
          hidden.add(text);
          rowhidden[r] = 0;
        }
      }
      out[f.colId] = {
        condition: { type: "values", hidden: Array.from(hidden) },
        rowhidden,
      };
      return;
    }
    for (let r = dataStart; r <= dataEnd; r += 1) {
      if (sheetHidden[r] != null) rowhidden[r] = 0;
    }
    out[f.colId] = { condition: f.condition, rowhidden };
  });
  return Object.keys(out).length > 0 ? out : undefined;
}

/* ------------------------------------------------------------------------ */
/* Slicers                                                                  */
/* ------------------------------------------------------------------------ */

export type SlicerCacheInfo = {
  name: string;
  tableId: string;
  columnId: string;
  sortOrder?: string;
  crossFilter?: string;
};

/** Every table slicer cache of the workbook, by name. */
export function readSlicerCaches(files: IuploadfileList) {
  const caches = new Map<string, SlicerCacheInfo>();
  Object.keys(files)
    .filter((path) => /^xl\/slicerCaches\/[^/]+\.xml$/.test(path))
    .forEach((path) => {
      const xml = files[path];
      const def = openTag(xml, "slicerCacheDefinition");
      const tsc = openTag(xml, "tableSlicerCache");
      if (!def || !tsc) return;
      const d = xmlAttrs(def);
      const t = xmlAttrs(tsc);
      if (!d.name) return;
      caches.set(d.name.toUpperCase(), {
        name: d.name,
        tableId: t.tableId ?? "",
        columnId: t.column ?? "",
        sortOrder: t.sortOrder,
        crossFilter: t.crossFilter,
      });
    });
  return caches;
}

export type SlicerAnchor = {
  r: number;
  c: number;
  offsetX: number;
  offsetY: number;
  width?: number;
  height?: number;
  toR?: number;
  toC?: number;
};

/** Anchors of the slicer shapes of a drawing part, by shape name. */
export function readSlicerAnchors(drawingXml: string) {
  const out = new Map<string, SlicerAnchor>();
  (
    drawingXml.match(
      /<xdr:(?:twoCellAnchor|oneCellAnchor)\b[\s\S]*?<\/xdr:(?:twoCellAnchor|oneCellAnchor)>/g
    ) || []
  ).forEach((anchor) => {
    const slicer = /<(?:\w+:)?slicer\b[^>]*\bname="([^"]*)"/.exec(anchor);
    if (!slicer) return;
    const pos = (tag: string) => {
      const m = new RegExp(`<xdr:${tag}>([\\s\\S]*?)</xdr:${tag}>`).exec(
        anchor
      );
      if (!m) return null;
      const num = (name: string) =>
        Number(
          new RegExp(`<xdr:${name}>(-?\\d+)</xdr:${name}>`).exec(m[1])?.[1] ?? 0
        );
      return {
        col: num("col"),
        colOff: num("colOff") / EMU_PER_PX,
        row: num("row"),
        rowOff: num("rowOff") / EMU_PER_PX,
      };
    };
    const from = pos("from");
    if (!from) return;
    const to = pos("to");
    const ext = /<a:ext\b[^>]*\bcx="(\d+)"[^>]*\bcy="(\d+)"/g;
    let size: [number, number] | null = null;
    let m = ext.exec(anchor);
    while (m) {
      if (Number(m[1]) > 0 && Number(m[2]) > 0) {
        size = [Number(m[1]) / EMU_PER_PX, Number(m[2]) / EMU_PER_PX];
      }
      m = ext.exec(anchor);
    }
    out.set(escapeCharacter(slicer[1]).toUpperCase(), {
      r: from.row,
      c: from.col,
      offsetX: Math.round(from.colOff),
      offsetY: Math.round(from.rowOff),
      width: size ? Math.round(size[0]) : undefined,
      height: size ? Math.round(size[1]) : undefined,
      toR: to?.row,
      toC: to?.col,
    });
  });
  return out;
}

/** The `<slicer>` elements of a slicers part. */
export function readSlicerPart(xml: string) {
  return (xml.match(/<(?:\w+:)?slicer\b[^>]*>/g) || [])
    .map((tag) => xmlAttrs(tag))
    .filter((a) => a.name && a.cache);
}
