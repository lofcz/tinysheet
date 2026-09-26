/**
 * Chart data assignment, as Excel's Select Data Source / Edit Series /
 * Axis Labels dialogs and the chart's data range outlines on the sheet do
 * it:
 *
 * - literals (`={1,2,3}`, `={"Q1","Q2"}`) and the text of a series' name,
 *   values and categories fields;
 * - `=SERIES(name, categories, values, order[, sizes])` formulas;
 * - the chart's data range ("Chart data range"), when the series form one
 *   block, and the block itself (series names, categories and values) that
 *   the colour outlines on the sheet resize and move;
 * - Add Chart Element options and Excel's Quick Layouts.
 *
 * Everything mutates a chart (an immer draft), like chart.ts.
 */
import type { Context } from "../context";
import {
  Chart,
  ChartRange,
  ChartRangeArea,
  ChartSeries,
  chartHasAxes,
  chartRangeAreas,
  chartRangeToText,
  chartSupportsTrendlines,
  detectChartSeries,
  findChart,
  parseChartRange,
  readChartRange,
  splitChartArgs,
  stripChartParens,
} from "./chart";
import type {
  ChartDataLabelPosition,
  ChartErrorBarType,
  ChartTrendline,
} from "./chartRender";

type Ctx = Pick<Context, "luckysheetfile">;

// ---------------------------------------------------------------------------
// Literals
// ---------------------------------------------------------------------------

/** The items of an array constant `{1,2,"a"}` (null: not one). */
function parseArrayConstant(text: string): (string | number)[] | null {
  const t = text.trim();
  if (!t.startsWith("{") || !t.endsWith("}")) return null;
  const body = t.slice(1, -1).trim();
  if (body === "") return [];
  // rows (;) and columns (,) both list points
  return splitChartArgs(body.replace(/;/g, ",")).map((item) => {
    if (item.startsWith('"') && item.endsWith('"') && item.length >= 2) {
      return item.slice(1, -1).replace(/""/g, '"');
    }
    const n = Number(item);
    return item !== "" && Number.isFinite(n) ? n : item;
  });
}

/**
 * A literal list typed into a series or axis-label field: an array
 * constant (`={1,2,3}`, `={"Q1","Q2"}`), or (axis labels) plain text
 * separated by commas (`Q1,Q2,Q3`, what Excel accepts). Null when the text
 * is neither.
 */
export function parseChartLiteral(
  text: string,
  options: { plainList?: boolean } = {}
): (string | number)[] | null {
  let t = String(text ?? "").trim();
  if (t.startsWith("=")) t = t.slice(1).trim();
  const array = parseArrayConstant(t);
  if (array) return array;
  if (!options.plainList || t === "") return null;
  return splitChartArgs(t).map((item) => {
    const unquoted =
      item.startsWith('"') && item.endsWith('"') && item.length >= 2
        ? item.slice(1, -1)
        : item;
    const n = Number(unquoted);
    return unquoted !== "" && Number.isFinite(n) && unquoted === item
      ? n
      : unquoted;
  });
}

/** `={1,2,3}` / `={"Q1","Q2"}` for a literal list. */
export function formatChartLiteral(values: (string | number | null)[]) {
  return `={${values
    .map((v) => {
      if (v == null) return "";
      if (typeof v === "number") return String(v);
      return `"${String(v).replace(/"/g, '""')}"`;
    })
    .join(",")}}`;
}

// ---------------------------------------------------------------------------
// Series fields as text (Edit Series, Axis Labels, SERIES formulas)
// ---------------------------------------------------------------------------

/** "Series name": `=Sheet1!$B$1`, or the typed name. */
export function seriesNameText(ctx: Ctx, s: ChartSeries) {
  if (s.name != null && s.name !== "") return s.name;
  if (s.nameRef) return `=${chartRangeToText(ctx, s.nameRef)}`;
  return "";
}

/** "Series values": `=Sheet1!$B$2:$B$7`, a literal, or `=#REF!`. */
export function seriesValuesText(ctx: Ctx, s: ChartSeries) {
  if (s.values) return `=${chartRangeToText(ctx, s.values)}`;
  if (s.cache?.values) return formatChartLiteral(s.cache.values);
  return "=#REF!";
}

/** "Axis label range" / "Series X values" of a series ("" when none). */
export function seriesCategoriesText(ctx: Ctx, s: ChartSeries) {
  if (s.categories) return `=${chartRangeToText(ctx, s.categories)}`;
  if (s.cache?.categories?.length) {
    return formatChartLiteral(
      s.cache.categories.map((c) => {
        const n = Number(c);
        return c !== "" && Number.isFinite(n) ? n : c;
      })
    );
  }
  return "";
}

/** "Series bubble size" of a series. */
export function seriesSizesText(ctx: Ctx, s: ChartSeries) {
  if (s.sizes) return `=${chartRangeToText(ctx, s.sizes)}`;
  if (s.cache?.sizes) return formatChartLiteral(s.cache.sizes);
  return "";
}

/** Why a field was refused (for the dialog's message). */
export type ChartFieldError = "invalidReference";

/**
 * Parse a reference field: a range (`=Sheet1!$A$1:$A$5`, unions) or a
 * literal. `plainList`: text without `=` is a comma list (axis labels).
 */
export function parseChartField(
  ctx: Ctx,
  text: string,
  defaultSheetId: string,
  options: { plainList?: boolean; allowEmpty?: boolean } = {}
):
  | { kind: "empty" }
  | { kind: "range"; range: ChartRange }
  | { kind: "literal"; values: (string | number)[] }
  | { kind: "error" } {
  const t = String(text ?? "").trim();
  if (t === "" || t === "=") {
    return options.allowEmpty === false ? { kind: "error" } : { kind: "empty" };
  }
  const body = t.startsWith("=") ? t.slice(1).trim() : t;
  if (body.startsWith("{")) {
    const values = parseChartLiteral(body);
    return values ? { kind: "literal", values } : { kind: "error" };
  }
  if (t.startsWith("=") || !options.plainList) {
    const range = parseChartRange(ctx, body, defaultSheetId);
    return range ? { kind: "range", range } : { kind: "error" };
  }
  // axis labels typed without "=": text separated by commas (Excel)
  const values = parseChartLiteral(body, { plainList: true });
  return values ? { kind: "literal", values } : { kind: "error" };
}

const toNumber = (v: string | number) => {
  if (typeof v === "number") return v;
  const n = Number(v);
  return v !== "" && Number.isFinite(n) ? n : null;
};

/** Set a series' name from "Series name" (a reference, or text). */
export function setSeriesName(
  ctx: Ctx,
  s: ChartSeries,
  text: string,
  defaultSheetId: string
): ChartFieldError | null {
  const t = String(text ?? "").trim();
  if (t.startsWith("=")) {
    const body = t.slice(1).trim();
    if (body.startsWith('"') && body.endsWith('"') && body.length >= 2) {
      s.name = body.slice(1, -1).replace(/""/g, '"');
      delete s.nameRef;
      return null;
    }
    const range = parseChartRange(ctx, body, defaultSheetId);
    if (!range) return "invalidReference";
    delete s.name;
    s.nameRef = range;
    if (s.cache) delete s.cache.name;
    return null;
  }
  delete s.nameRef;
  if (t === "") delete s.name;
  else s.name = t;
  if (s.cache) delete s.cache.name;
  return null;
}

/** Set "Series values" (Y values). */
export function setSeriesValues(
  ctx: Ctx,
  s: ChartSeries,
  text: string,
  defaultSheetId: string
): ChartFieldError | null {
  const field = parseChartField(ctx, text, defaultSheetId);
  if (field.kind === "error") return "invalidReference";
  if (field.kind === "range") {
    s.values = field.range;
    if (s.cache) delete s.cache.values;
  } else {
    s.values = null;
    s.cache = {
      ...s.cache,
      values: field.kind === "literal" ? field.values.map(toNumber) : [],
    };
  }
  return null;
}

/** Set the categories ("Axis label range", "Series X values"). */
export function setSeriesCategories(
  ctx: Ctx,
  s: ChartSeries,
  text: string,
  defaultSheetId: string
): ChartFieldError | null {
  const field = parseChartField(ctx, text, defaultSheetId, {
    plainList: true,
  });
  if (field.kind === "error") return "invalidReference";
  if (field.kind === "range") {
    s.categories = field.range;
    if (s.cache) delete s.cache.categories;
  } else {
    delete s.categories;
    if (field.kind === "literal") {
      s.cache = { ...s.cache, categories: field.values.map(String) };
    } else if (s.cache) delete s.cache.categories;
  }
  return null;
}

/** Set "Series bubble size". */
export function setSeriesSizes(
  ctx: Ctx,
  s: ChartSeries,
  text: string,
  defaultSheetId: string
): ChartFieldError | null {
  const field = parseChartField(ctx, text, defaultSheetId);
  if (field.kind === "error") return "invalidReference";
  if (field.kind === "range") {
    s.sizes = field.range;
    if (s.cache) delete s.cache.sizes;
  } else {
    delete s.sizes;
    if (field.kind === "literal")
      s.cache = { ...s.cache, sizes: field.values.map(toNumber) };
    else if (s.cache) delete s.cache.sizes;
  }
  return null;
}

/**
 * What a field refers to, as Excel shows it right of the field:
 * `= 120, 135, 150` or `= Revenue`.
 */
export function chartFieldPreview(
  ctx: Ctx,
  text: string,
  defaultSheetId: string,
  options: { plainList?: boolean; name?: boolean } = {}
) {
  const t = String(text ?? "").trim();
  if (options.name && !t.startsWith("=")) return t ? `= ${t}` : "";
  if (options.name && /^=\s*"/.test(t)) {
    return `= ${t.replace(/^=\s*"/, "").replace(/"$/, "")}`;
  }
  const field = parseChartField(ctx, text, defaultSheetId, options);
  if (field.kind === "empty") return "";
  if (field.kind === "error") return "";
  const values =
    field.kind === "range"
      ? readChartRange(ctx, field.range).map((c) => c.display)
      : field.values.map(String);
  if (options.name) return `= ${values.filter(Boolean).join(" ")}`;
  const shown = values.slice(0, 12).map((v) => v || "");
  return `= ${shown.join(", ")}${values.length > 12 ? ", …" : ""}`;
}

// ---------------------------------------------------------------------------
// =SERIES(name, categories, values, order[, sizes])
// ---------------------------------------------------------------------------

/** The `=SERIES(…)` formula of series `index` (as Excel shows it). */
export function seriesFormula(ctx: Ctx, chart: Chart, index: number) {
  const s = chart.series[index];
  if (!s) return "";
  const nameArg = (() => {
    if (s.nameRef && !s.name) return chartRangeToText(ctx, s.nameRef);
    if (s.name) return `"${s.name.replace(/"/g, '""')}"`;
    return "";
  })();
  const refOrLiteral = (text: string) =>
    text.startsWith("=") ? text.slice(1) : text;
  const cat = refOrLiteral(seriesCategoriesText(ctx, s));
  const val = s.values
    ? chartRangeToText(ctx, s.values)
    : refOrLiteral(seriesValuesText(ctx, s)).replace(/^#REF!$/, "#REF!");
  const parts = [nameArg, cat, val, String(index + 1)];
  if (chart.type === "bubble")
    parts.push(refOrLiteral(seriesSizesText(ctx, s)));
  return `=SERIES(${parts.join(",")})`;
}

export type SeriesFormula = {
  /** Typed name (`"Revenue"`) or the name's cell. */
  name?: string;
  nameRef?: ChartRange;
  categories?: ChartRange;
  categoryLiteral?: (string | number)[];
  values: ChartRange | null;
  valueLiteral?: (string | number)[];
  sizes?: ChartRange;
  sizeLiteral?: (string | number)[];
  /** Plot order (1-based). */
  order: number;
};

/** Parse `=SERIES(…)`; null when it is not a valid series formula. */
export function parseSeriesFormula(
  ctx: Ctx,
  text: string,
  defaultSheetId: string
): SeriesFormula | null {
  let t = String(text ?? "").trim();
  if (t.startsWith("=")) t = t.slice(1).trim();
  const m = /^SERIES\s*\(([\s\S]*)\)$/i.exec(t);
  if (!m) return null;
  const args = splitChartArgs(m[1]);
  if (args.length < 3 || args.length > 5) return null;
  const [nameArg, catArg, valArg, orderArg = "", sizeArg] = args;
  const out: SeriesFormula = { values: null, order: 1 };
  if (nameArg) {
    if (nameArg.startsWith('"') && nameArg.endsWith('"')) {
      out.name = nameArg.slice(1, -1).replace(/""/g, '"');
    } else {
      const range = parseChartRange(ctx, nameArg, defaultSheetId);
      if (!range) return null;
      out.nameRef = range;
    }
  }
  const refOrLiteral = (
    arg: string
  ): { range?: ChartRange; literal?: (string | number)[] } | null => {
    if (!arg) return {};
    const literal = parseChartLiteral(arg);
    if (literal) return { literal };
    const range = parseChartRange(ctx, stripChartParens(arg), defaultSheetId);
    return range ? { range } : null;
  };
  const cat = refOrLiteral(catArg);
  const val = refOrLiteral(valArg);
  if (!cat || !val) return null;
  if (cat.range) out.categories = cat.range;
  if (cat.literal) out.categoryLiteral = cat.literal;
  out.values = val.range ?? null;
  if (val.literal) out.valueLiteral = val.literal;
  if (sizeArg != null) {
    const size = refOrLiteral(sizeArg);
    if (!size) return null;
    if (size.range) out.sizes = size.range;
    if (size.literal) out.sizeLiteral = size.literal;
  }
  const order = parseInt(orderArg, 10);
  out.order = Number.isFinite(order) && order > 0 ? order : 1;
  return out;
}

/** Apply a parsed `=SERIES(…)` to a series (its formatting stays). */
export function applySeriesFormula(s: ChartSeries, f: SeriesFormula) {
  delete s.name;
  delete s.nameRef;
  if (f.name != null) s.name = f.name;
  if (f.nameRef) s.nameRef = f.nameRef;
  const cache: NonNullable<ChartSeries["cache"]> = {};
  if (f.categories) s.categories = f.categories;
  else delete s.categories;
  if (f.categoryLiteral) cache.categories = f.categoryLiteral.map(String);
  s.values = f.values;
  if (f.valueLiteral) cache.values = f.valueLiteral.map(toNumber);
  if (f.sizes) s.sizes = f.sizes;
  else delete s.sizes;
  if (f.sizeLiteral) cache.sizes = f.sizeLiteral.map(toNumber);
  if (Object.keys(cache).length) s.cache = cache;
  else delete s.cache;
}

// ---------------------------------------------------------------------------
// The data block: series names, categories and values in one rectangle
// ---------------------------------------------------------------------------

/**
 * The chart's data as one block (what the sheet outlines show and their
 * handles resize): series along `series` (columns, or rows when
 * `seriesInRows`), points along `points`, names in line `nameAt` and
 * categories in line `categoryAt` (both optional).
 */
export type ChartDataBlock = {
  sheetId: string;
  seriesInRows: boolean;
  points: [number, number];
  series: [number, number];
  nameAt: number | null;
  categoryAt: number | null;
};

type Span = [number, number];

const single = (r: ChartRange | null | undefined) => !!r && !r.areas?.length;

/**
 * The block the chart's series form, or null when they do not form one
 * (Excel then calls the data range "too complex").
 */
export function getChartDataBlock(chart: Chart): ChartDataBlock | null {
  const list = chart.series;
  if (list.length === 0 || chart.type === "bubble") return null;
  const first = list[0].values;
  if (!first || !single(first)) return null;
  const { sheetId } = first;
  const byCol = first.column[0] === first.column[1];
  const byRow = first.row[0] === first.row[1];
  let seriesInRows: boolean;
  if (byCol && byRow) seriesInRows = !!chart.seriesInRows;
  else if (byCol) seriesInRows = false;
  else if (byRow) seriesInRows = true;
  else return null;
  const pointSpan = (r: ChartRange): Span => (seriesInRows ? r.column : r.row);
  const seriesPos = (r: ChartRange) => (seriesInRows ? r.row[0] : r.column[0]);
  const points = pointSpan(first);
  const start = seriesPos(first);
  let nameAt: number | null | undefined;
  let categoryAt: number | null | undefined;
  for (let i = 0; i < list.length; i += 1) {
    const s = list[i];
    const v = s.values;
    if (!v || !single(v) || v.sheetId !== sheetId) return null;
    const across = seriesInRows ? v.row : v.column;
    if (across[0] !== across[1] || across[0] !== start + i) return null;
    const p = pointSpan(v);
    if (p[0] !== points[0] || p[1] !== points[1]) return null;
    // names: one cell in a common line, in the series' own line
    let at: number | null = null;
    if (s.nameRef && !s.name) {
      const n = s.nameRef;
      if (!single(n) || n.sheetId !== sheetId) return null;
      if (n.row[0] !== n.row[1] || n.column[0] !== n.column[1]) return null;
      if (seriesPos(n) !== start + i) return null;
      at = seriesInRows ? n.column[0] : n.row[0];
    }
    if (nameAt === undefined) nameAt = at;
    else if (nameAt !== at) return null;
    // categories: the same strip for every series
    let cat: number | null = null;
    if (s.categories) {
      const c = s.categories;
      if (!single(c) || c.sheetId !== sheetId) return null;
      const cp = pointSpan(c);
      if (cp[0] !== points[0] || cp[1] !== points[1]) return null;
      const line = seriesInRows ? c.row : c.column;
      if (line[0] !== line[1]) return null;
      cat = line[0];
    } else if (s.cache?.categories?.length) return null;
    if (categoryAt === undefined) categoryAt = cat;
    else if (categoryAt !== cat) return null;
  }
  const block: ChartDataBlock = {
    sheetId,
    seriesInRows,
    points: [points[0], points[1]],
    series: [start, start + list.length - 1],
    nameAt: nameAt ?? null,
    categoryAt: categoryAt ?? null,
  };
  // names and categories must lie outside the values
  if (
    block.nameAt != null &&
    block.nameAt >= block.points[0] &&
    block.nameAt <= block.points[1]
  )
    return null;
  if (
    block.categoryAt != null &&
    block.categoryAt >= block.series[0] &&
    block.categoryAt <= block.series[1]
  )
    return null;
  return block;
}

const area = (
  sheetId: string,
  seriesInRows: boolean,
  points: Span,
  across: Span
): ChartRangeArea =>
  seriesInRows
    ? { sheetId, row: [across[0], across[1]], column: [points[0], points[1]] }
    : { sheetId, row: [points[0], points[1]], column: [across[0], across[1]] };

/** The outlined rectangles of a block (sheet coordinates). */
export function chartDataBlockRects(block: ChartDataBlock): {
  values: ChartRangeArea;
  names: ChartRangeArea | null;
  categories: ChartRangeArea | null;
} {
  const { sheetId, seriesInRows, points, series } = block;
  return {
    values: area(sheetId, seriesInRows, points, series),
    names:
      block.nameAt != null
        ? area(sheetId, seriesInRows, [block.nameAt, block.nameAt], series)
        : null,
    categories:
      block.categoryAt != null
        ? area(sheetId, seriesInRows, points, [
            block.categoryAt,
            block.categoryAt,
          ])
        : null,
  };
}

/**
 * The block after one of its outlines was dragged to `to` (a resize or a
 * move): the values give the points and series, the names strip its line
 * and the series, the categories strip its line and the points.
 */
export function reshapeChartDataBlock(
  block: ChartDataBlock,
  part: "values" | "names" | "categories",
  to: ChartRangeArea
): ChartDataBlock {
  const { seriesInRows } = block;
  const pointsOf = (a: ChartRangeArea): Span =>
    seriesInRows ? a.column : a.row;
  const acrossOf = (a: ChartRangeArea): Span =>
    seriesInRows ? a.row : a.column;
  const next: ChartDataBlock = {
    ...block,
    points: [...block.points] as Span,
    series: [...block.series] as Span,
    sheetId: to.sheetId,
  };
  if (part === "values") {
    next.points = [...pointsOf(to)] as Span;
    next.series = [...acrossOf(to)] as Span;
  } else if (part === "names") {
    next.nameAt = pointsOf(to)[0];
    next.series = [...acrossOf(to)] as Span;
  } else {
    next.categoryAt = acrossOf(to)[0];
    next.points = [...pointsOf(to)] as Span;
  }
  return next;
}

/**
 * Rebuild the series from a block: series `i` keeps the formatting of the
 * chart's series `i` (colour, type, axis, trendlines…); new ones get the
 * defaults, and names without a names line are `Series1`, `Series2`…
 */
export function applyChartDataBlock(chart: Chart, block: ChartDataBlock) {
  const { sheetId, seriesInRows, points } = block;
  const out: ChartSeries[] = [];
  for (let pos = block.series[0]; pos <= block.series[1]; pos += 1) {
    const k = pos - block.series[0];
    const old = chart.series[k];
    const s: ChartSeries = {
      values: area(sheetId, seriesInRows, points, [pos, pos]),
    };
    if (block.nameAt != null) {
      s.nameRef = area(
        sheetId,
        seriesInRows,
        [block.nameAt, block.nameAt],
        [pos, pos]
      );
    } else {
      s.name = old?.name && !old.nameRef ? old.name : `Series${k + 1}`;
    }
    if (block.categoryAt != null) {
      s.categories = area(sheetId, seriesInRows, points, [
        block.categoryAt,
        block.categoryAt,
      ]);
    }
    if (old) {
      if (old.color) s.color = old.color;
      if (old.outline !== undefined) s.outline = old.outline;
      if (old.effects) s.effects = old.effects;
      if (old.shadow) s.shadow = true;
      if (old.type) s.type = old.type;
      if (old.secondary) s.secondary = true;
      if (old.trendlines) s.trendlines = old.trendlines;
      if (old.errorBars) s.errorBars = old.errorBars;
      if (old.filtered) s.filtered = true;
    } else if (chart.type === "combo") s.type = "line";
    out.push(s);
  }
  chart.series = out;
  chart.seriesInRows = seriesInRows;
  chart.source = chartDataRangeOfBlock(block);
  if (chart.hiddenCategories) {
    const n = points[1] - points[0] + 1;
    chart.hiddenCategories = chart.hiddenCategories.filter((i) => i < n);
  }
}

/** The rectangle a block covers, when its lines are adjacent (else null). */
export function chartDataRangeOfBlock(
  block: ChartDataBlock
): ChartRange | null {
  const { sheetId, seriesInRows, points, series, nameAt, categoryAt } = block;
  if (nameAt != null && nameAt !== points[0] - 1) return null;
  if (categoryAt != null && categoryAt !== series[0] - 1) return null;
  const p0 = nameAt ?? points[0];
  const s0 = categoryAt ?? series[0];
  return area(sheetId, seriesInRows, [p0, points[1]], [s0, series[1]]);
}

/** Runs of consecutive numbers (sorted, no repeats) as spans. */
function toRuns(values: number[]): Span[] {
  const sorted = Array.from(new Set(values)).sort((a, b) => a - b);
  const out: Span[] = [];
  sorted.forEach((v) => {
    const last = out[out.length - 1];
    if (last && v === last[1] + 1) last[1] = v;
    else out.push([v, v]);
  });
  return out;
}

/**
 * The areas of a chart whose series fit one rectangle except for whole
 * rows or columns left out (Excel shows these as several areas, e.g.
 * `=Sheet1!$A$1:$A$5,Sheet1!$C$1:$D$5`): every series one line (or the
 * same pieces of it), names in one line before the points, categories in
 * one line before the series. Null when irregular ("too complex").
 */
function chartDataUnion(chart: Chart): ChartRange | null {
  const list = chart.series;
  if (list.length === 0 || chart.type === "bubble") return null;
  const firstValues = list[0].values;
  if (!firstValues) return null;
  const firstAreas = chartRangeAreas(firstValues);
  const { sheetId } = firstAreas[0];
  const colLines = firstAreas.every((a) => a.column[0] === a.column[1]);
  const rowLines = firstAreas.every((a) => a.row[0] === a.row[1]);
  let inRows: boolean;
  if (colLines && rowLines) inRows = !!chart.seriesInRows;
  else if (colLines) inRows = false;
  else if (rowLines) inRows = true;
  else return null;
  const lineOf = (a: ChartRangeArea) => (inRows ? a.row : a.column);
  const spanOf = (a: ChartRangeArea): Span => (inRows ? a.column : a.row);
  const shape = (areas: ChartRangeArea[]) =>
    areas.map((a) => spanOf(a).join(":")).join(",");
  const key = shape(firstAreas);
  /** The line of a one-line reference in the block's layout, else null. */
  const oneLine = (r: ChartRange | null | undefined) => {
    const areas = chartRangeAreas(r);
    if (!areas.length || areas.some((a) => a.sheetId !== sheetId)) return null;
    const line = lineOf(areas[0])[0];
    if (areas.some((a) => lineOf(a)[0] !== line || lineOf(a)[1] !== line)) {
      return null;
    }
    return { line, areas };
  };
  const lines: number[] = [];
  let nameAt: number | null | undefined;
  let categoryAt: number | null | undefined;
  for (let i = 0; i < list.length; i += 1) {
    const s = list[i];
    const values = oneLine(s.values);
    if (!values || shape(values.areas) !== key) return null;
    if (lines.length && values.line <= lines[lines.length - 1]) return null;
    lines.push(values.line);
    let at: number | null = null;
    if (s.nameRef && !s.name) {
      const n = s.nameRef;
      if (n.areas?.length || n.sheetId !== sheetId) return null;
      if (n.row[0] !== n.row[1] || n.column[0] !== n.column[1]) return null;
      if (lineOf(n)[0] !== values.line) return null;
      [at] = spanOf(n);
    }
    if (nameAt === undefined) nameAt = at;
    else if (nameAt !== at) return null;
    let cat: number | null = null;
    if (s.categories) {
      const c = oneLine(s.categories);
      if (!c || shape(c.areas) !== key) return null;
      cat = c.line;
    } else if (s.cache?.categories?.length) return null;
    if (categoryAt === undefined) categoryAt = cat;
    else if (categoryAt !== cat) return null;
  }
  const pointSpans = firstAreas.map(spanOf);
  const firstPoint = Math.min(...pointSpans.map((p) => p[0]));
  if (nameAt != null && nameAt >= firstPoint) return null;
  if (categoryAt != null && categoryAt >= lines[0]) return null;
  const points: number[] = [];
  pointSpans.forEach(([a, b]) => {
    for (let p = a; p <= b; p += 1) points.push(p);
  });
  if (nameAt != null) points.push(nameAt);
  const lineRuns = toRuns(categoryAt != null ? [categoryAt, ...lines] : lines);
  const pointRuns = toRuns(points);
  const areas: ChartRangeArea[] = [];
  lineRuns.forEach((lr) =>
    pointRuns.forEach((pr) => areas.push(area(sheetId, inRows, pr, lr)))
  );
  const [first, ...rest] = areas;
  return rest.length ? { ...first, areas: rest } : first;
}

/**
 * "Chart data range" of the Select Data Source dialog: the block's
 * rectangle, the areas of a block with whole rows / columns left out, or
 * null when the series are irregular (Excel: "The data range is too
 * complex to be displayed" — series of different lengths or places, names
 * out of line, series out of order).
 */
export function getChartDataRange(chart: Chart): ChartRange | null {
  const block = getChartDataBlock(chart);
  if (block) {
    const range = chartDataRangeOfBlock(block);
    if (range) return range;
  }
  return chartDataUnion(chart);
}

/** The part of `ref` inside `areas` (a union when in several), or null. */
function clipToAreas(
  ref: ChartRange | null | undefined,
  areas: ChartRangeArea[]
): ChartRange | null {
  if (!ref) return null;
  const pieces: ChartRangeArea[] = [];
  chartRangeAreas(ref).forEach((r) =>
    areas.forEach((a) => {
      if (a.sheetId !== r.sheetId) return;
      const r0 = Math.max(r.row[0], a.row[0]);
      const r1 = Math.min(r.row[1], a.row[1]);
      const c0 = Math.max(r.column[0], a.column[0]);
      const c1 = Math.min(r.column[1], a.column[1]);
      if (r0 > r1 || c0 > c1) return;
      pieces.push({ sheetId: r.sheetId, row: [r0, r1], column: [c0, c1] });
    })
  );
  if (!pieces.length) return null;
  // reading order, and pieces of the same line joined
  pieces.sort((x, y) => x.row[0] - y.row[0] || x.column[0] - y.column[0]);
  const merged: ChartRangeArea[] = [];
  pieces.forEach((p) => {
    const last = merged[merged.length - 1];
    if (
      last &&
      last.column[0] === p.column[0] &&
      last.column[1] === p.column[1] &&
      last.row[1] + 1 === p.row[0]
    ) {
      last.row = [last.row[0], p.row[1]];
    } else if (
      last &&
      last.row[0] === p.row[0] &&
      last.row[1] === p.row[1] &&
      last.column[1] + 1 === p.column[0]
    ) {
      last.column = [last.column[0], p.column[1]];
    } else merged.push({ ...p, row: [...p.row], column: [...p.column] });
  });
  const [first, ...rest] = merged;
  return rest.length ? { ...first, areas: rest } : first;
}

/**
 * Replace every series from a new data range, like typing or selecting a
 * range into "Chart data range" (the orientation follows the range's
 * shape unless given; formatting stays by position).
 */
export function setChartDataRange(
  ctx: Ctx,
  chart: Chart,
  range: ChartRange,
  seriesInRows?: boolean
) {
  const areas = chartRangeAreas(range);
  let first: ChartRangeArea = areas[0];
  const sameSheet = areas.every((a) => a.sheetId === first.sheetId);
  if (areas.length > 1 && sameSheet) {
    // a union (A1:A5,C1:C5): the series of its bounding block that lie in
    // one of its areas, like Excel
    first = {
      sheetId: first.sheetId,
      row: [
        Math.min(...areas.map((a) => a.row[0])),
        Math.max(...areas.map((a) => a.row[1])),
      ],
      column: [
        Math.min(...areas.map((a) => a.column[0])),
        Math.max(...areas.map((a) => a.column[1])),
      ],
    };
  }
  const detected = detectChartSeries(ctx, first, {
    type: chart.type,
    seriesInRows,
  });
  if (areas.length > 1 && sameSheet) {
    // what the union covers: series in left-out lines go, the others keep
    // the pieces of their references inside the areas
    detected.series = detected.series
      .map((s) => {
        const values = clipToAreas(s.values, areas);
        if (!values) return null;
        const next: ChartSeries = { ...s, values };
        if (s.nameRef) {
          const nameRef = clipToAreas(s.nameRef, areas);
          if (nameRef) next.nameRef = nameRef;
          else delete next.nameRef;
        }
        if (s.categories) {
          const categories = clipToAreas(s.categories, areas);
          if (categories) next.categories = categories;
          else delete next.categories;
        }
        return next;
      })
      .filter((s): s is ChartSeries => !!s);
  }
  detected.series.forEach((s, i) => {
    const old = chart.series[i];
    if (!old) {
      if (chart.type === "combo") s.type = i === 0 ? "column" : "line";
      return;
    }
    if (old.color) s.color = old.color;
    if (old.outline !== undefined) s.outline = old.outline;
    if (old.type) s.type = old.type;
    if (old.secondary) s.secondary = true;
    if (old.trendlines) s.trendlines = old.trendlines;
    if (old.errorBars) s.errorBars = old.errorBars;
  });
  chart.series = detected.series;
  chart.seriesInRows = detected.seriesInRows;
  chart.source = areas.length > 1 ? range : first;
  delete chart.hiddenCategories;
}

/**
 * Switch Row/Column: series become categories and categories series, for
 * a chart whose data is one block (Excel greys the button otherwise).
 */
export function switchChartDataRowColumn(ctx: Ctx, chart: Chart): boolean {
  const range = getChartDataRange(chart) ?? chart.source ?? null;
  if (!range) return false;
  const block = getChartDataBlock(chart);
  setChartDataRange(
    ctx,
    chart,
    range,
    block ? !block.seriesInRows : !chart.seriesInRows
  );
  return true;
}

/** Whether Switch Row/Column can act on the chart. */
export function canSwitchChartRowColumn(chart: Chart) {
  return (
    chart.type !== "bubble" && !!(getChartDataRange(chart) ?? chart.source)
  );
}

/** Excel's name for series `index` of a new series (Add). */
export function newSeriesDefaults(chart: Chart): ChartSeries {
  const last = chart.series[chart.series.length - 1];
  return {
    values: null,
    cache: { values: [1] },
    ...(last?.categories ? { categories: last.categories } : {}),
    ...(chart.type === "combo" ? { type: "line" as const } : {}),
  };
}

/**
 * Where the series names and the category labels come from (Chart Filters
 * › Names): the row or column of the data block holding them (null: none)
 * and the rows / columns before the data that could (Excel lists the
 * header lines; "(None)" names the series Series1, Series2… and numbers
 * the categories 1, 2, 3…). Null when the series do not form a block.
 */
export type ChartNameSource = {
  /** Lines run as rows (the series are in columns) or columns. */
  kind: "row" | "column";
  current: number | null;
  options: number[];
};

export function chartNameSources(
  chart: Chart
): { series: ChartNameSource; categories: ChartNameSource } | null {
  const block = getChartDataBlock(chart);
  if (!block) return null;
  const before = (first: number, current: number | null) => {
    const out: number[] = [];
    for (let l = first - 1; l >= 0 && out.length < 4; l -= 1) out.push(l);
    if (current != null && !out.includes(current)) out.push(current);
    return out.sort((a, b) => a - b);
  };
  return {
    // names lie in a line across the points (a row when series are columns)
    series: {
      kind: block.seriesInRows ? "column" : "row",
      current: block.nameAt,
      options: before(block.points[0], block.nameAt),
    },
    categories: {
      kind: block.seriesInRows ? "row" : "column",
      current: block.categoryAt,
      options: before(block.series[0], block.categoryAt),
    },
  };
}

/**
 * Take the series names (or category labels) from another row / column of
 * the data, or from none (Chart Filters › Names). False when the chart's
 * series do not form a block.
 */
export function setChartNameSource(
  chart: Chart,
  which: "series" | "categories",
  line: number | null
): boolean {
  const block = getChartDataBlock(chart);
  if (!block) return false;
  const next: ChartDataBlock = { ...block };
  if (which === "series") {
    if (line != null && line >= block.points[0] && line <= block.points[1])
      return false;
    next.nameAt = line;
  } else {
    if (line != null && line >= block.series[0] && line <= block.series[1])
      return false;
    next.categoryAt = line;
  }
  applyChartDataBlock(chart, next);
  if (which === "series" && line == null) {
    // "(None)": Excel's default names
    chart.series.forEach((s, i) => {
      delete s.nameRef;
      s.name = `Series${i + 1}`;
    });
  }
  return true;
}

/** Move series `from` to `to` (Select Data's Move Up / Move Down). */
export function moveChartSeries(chart: Chart, from: number, to: number) {
  if (to < 0 || to >= chart.series.length || from === to) return;
  const [s] = chart.series.splice(from, 1);
  chart.series.splice(to, 0, s);
}

// ---------------------------------------------------------------------------
// Chart elements (Add Chart Element, the Chart Elements button)
// ---------------------------------------------------------------------------

export type ChartAxisDirection = "horizontal" | "vertical";

/** Which axis runs horizontally / vertically ("category" or "value"). */
export function chartAxisFor(
  chart: Pick<Chart, "type">,
  dir: ChartAxisDirection
): "category" | "value" {
  const horizontalValue = chart.type === "bar";
  if (dir === "horizontal") return horizontalValue ? "value" : "category";
  return horizontalValue ? "category" : "value";
}

export type ChartElementName =
  | "axes"
  | "axisTitles"
  | "chartTitle"
  | "dataLabels"
  | "dataTable"
  | "errorBars"
  | "gridlines"
  | "legend"
  | "lines"
  | "trendline"
  | "upDownBars";

const LINE_LIKE = (chart: Chart) =>
  chart.type === "line" ||
  (chart.type === "combo" && chart.series.some((s) => s.type === "line"));

/** Elements a chart type offers (Excel greys the others). */
export function chartElementAvailable(chart: Chart, el: ChartElementName) {
  const axes = chartHasAxes(chart.type) && chart.type !== "radar";
  switch (el) {
    case "axes":
    case "axisTitles":
    case "gridlines":
      return axes;
    case "dataTable":
      return (
        ["column", "bar", "line", "area", "combo"].includes(chart.type) &&
        chart.type !== "bar"
      );
    case "errorBars":
    case "trendline":
      return (
        chartSupportsTrendlines(chart.type) &&
        chart.grouping !== "stacked" &&
        chart.grouping !== "percentStacked"
      );
    case "lines":
      return LINE_LIKE(chart) || chart.type === "area";
    case "upDownBars":
      return LINE_LIKE(chart) && chart.series.length > 1;
    default:
      return true;
  }
}

/** Whether an element is shown (the Chart Elements checkboxes). */
export function chartElementShown(chart: Chart, el: ChartElementName) {
  switch (el) {
    case "axes":
      return chart.axes?.category !== false || chart.axes?.value !== false;
    case "axisTitles":
      return !!(chart.categoryAxisTitle || chart.valueAxisTitle);
    case "chartTitle":
      return !!chart.title;
    case "dataLabels":
      return chart.type === "funnel"
        ? chart.dataLabels !== false
        : !!chart.dataLabels;
    case "dataTable":
      return !!chart.dataTable;
    case "errorBars":
      return chart.series.some((s) => !!s.errorBars);
    case "gridlines":
      return (
        chart.gridlines !== false ||
        !!chart.categoryGridlines ||
        !!chart.minorGridlines ||
        !!chart.minorCategoryGridlines
      );
    case "legend":
      return (chart.legend ?? "right") !== "none";
    case "lines":
      return !!(chart.dropLines || chart.hiLowLines);
    case "trendline":
      return chart.series.some((s) => !!s.trendlines?.length);
    case "upDownBars":
      return !!chart.upDownBars;
    default:
      return false;
  }
}

/** The option of an element's submenu that is on (radio items). */
export function chartElementOption(
  chart: Chart,
  el: ChartElementName
): string | null {
  switch (el) {
    case "chartTitle":
      if (!chart.title) return "none";
      return chart.titleOverlay ? "overlay" : "above";
    case "dataLabels":
      if (!chartElementShown(chart, "dataLabels")) return "none";
      if (chart.dataLabelOptions?.showCategory) return "callout";
      return chart.dataLabelOptions?.position ?? "auto";
    case "dataTable":
      if (!chart.dataTable) return "none";
      return chart.dataTable.legendKeys === false ? "noKeys" : "keys";
    case "legend":
      return chart.legend ?? "right";
    case "lines":
      if (chart.dropLines) return "dropLines";
      if (chart.hiLowLines) return "hiLowLines";
      return "none";
    case "upDownBars":
      return chart.upDownBars ? "on" : "none";
    case "errorBars": {
      const e = chart.series.find((s) => s.errorBars)?.errorBars;
      if (!e) return "none";
      return e.type;
    }
    case "trendline": {
      const t = chart.series.find((s) => s.trendlines?.length)?.trendlines?.[0];
      if (!t) return "none";
      if (t.type === "linear" && t.forward) return "linearForecast";
      return t.type;
    }
    default:
      return null;
  }
}

/** Checked items of a toggle submenu (Axes, Axis Titles, Gridlines). */
export function chartElementToggles(
  chart: Chart,
  el: "axes" | "axisTitles" | "gridlines"
): Record<string, boolean> {
  const h = chartAxisFor(chart, "horizontal");
  const v = chartAxisFor(chart, "vertical");
  if (el === "axes") {
    return {
      horizontal: chart.axes?.[h] !== false,
      vertical: chart.axes?.[v] !== false,
    };
  }
  if (el === "axisTitles") {
    const title = (a: "category" | "value") =>
      !!(a === "category" ? chart.categoryAxisTitle : chart.valueAxisTitle);
    return { horizontal: title(h), vertical: title(v) };
  }
  const major = (a: "category" | "value") =>
    a === "value" ? chart.gridlines !== false : !!chart.categoryGridlines;
  const minor = (a: "category" | "value") =>
    a === "value" ? !!chart.minorGridlines : !!chart.minorCategoryGridlines;
  return {
    majorHorizontal: major(v),
    majorVertical: major(h),
    minorHorizontal: minor(v),
    minorVertical: minor(h),
  };
}

const ERROR_TYPES: Record<string, ChartErrorBarType> = {
  stdErr: "stdErr",
  percentage: "percentage",
  stdDev: "stdDev",
};

/**
 * Apply an Add Chart Element option. `series`: the series a trendline or
 * error bars go to (default: all).
 */
export function applyChartElement(
  chart: Chart,
  el: ChartElementName,
  option: string,
  labels: { chartTitle: string; axisTitle: string } = {
    chartTitle: "Chart Title",
    axisTitle: "Axis Title",
  },
  series?: number[]
) {
  const targets = series ?? chart.series.map((_, i) => i);
  switch (el) {
    case "axes":
    case "axisTitles":
    case "gridlines": {
      const now = chartElementToggles(chart, el);
      const on = option === "all" ? true : !now[option];
      const keys = option === "all" ? Object.keys(now) : [option];
      if (option === "none") {
        Object.keys(now).forEach((k) => setToggle(chart, el, k, false, labels));
        return;
      }
      keys.forEach((k) => setToggle(chart, el, k, on, labels));
      return;
    }
    case "chartTitle":
      if (option === "none") {
        delete chart.title;
        delete chart.titleOverlay;
      } else {
        chart.title = chart.title || labels.chartTitle;
        if (option === "overlay") chart.titleOverlay = true;
        else delete chart.titleOverlay;
      }
      return;
    case "dataLabels": {
      if (option === "none") {
        chart.dataLabels = false;
        return;
      }
      chart.dataLabels = true;
      const next = { ...chart.dataLabelOptions };
      if (option === "callout") {
        next.showCategory = true;
        next.showValue = true;
        next.position =
          chart.type === "pie" || chart.type === "doughnut"
            ? "outsideEnd"
            : chart.type === "column" || chart.type === "bar"
              ? "outsideEnd"
              : "above";
      } else {
        delete next.showCategory;
        if (option === "auto" || option === "show") delete next.position;
        else next.position = option as ChartDataLabelPosition;
      }
      chart.dataLabelOptions = next;
      return;
    }
    case "dataTable":
      if (option === "none") delete chart.dataTable;
      else chart.dataTable = { legendKeys: option !== "noKeys" };
      return;
    case "errorBars":
      targets.forEach((i) => {
        const s = chart.series[i];
        if (!s) return;
        if (option === "none") delete s.errorBars;
        else {
          const type = ERROR_TYPES[option] ?? "stdErr";
          s.errorBars = {
            type,
            ...(type === "percentage" ? { value: 5 } : {}),
            ...(type === "stdDev" ? { value: 1 } : {}),
          };
        }
      });
      return;
    case "legend":
      chart.legend = option as Chart["legend"];
      return;
    case "lines":
      chart.dropLines = option === "dropLines";
      chart.hiLowLines = option === "hiLowLines";
      if (!chart.dropLines) delete chart.dropLines;
      if (!chart.hiLowLines) delete chart.hiLowLines;
      return;
    case "trendline":
      targets.forEach((i) => {
        const s = chart.series[i];
        if (!s) return;
        if (option === "none") {
          delete s.trendlines;
          return;
        }
        let t: ChartTrendline = { type: "linear" };
        if (option === "exponential") t = { type: "exponential" };
        else if (option === "linearForecast")
          t = { type: "linear", forward: 2 };
        else if (option === "movingAverage")
          t = { type: "movingAverage", period: 2 };
        s.trendlines = [t];
      });
      return;
    case "upDownBars":
      if (option === "none") delete chart.upDownBars;
      else chart.upDownBars = true;
      break;
    default:
      break;
  }
}

function setToggle(
  chart: Chart,
  el: "axes" | "axisTitles" | "gridlines",
  key: string,
  on: boolean,
  labels: { axisTitle: string }
) {
  const dir: ChartAxisDirection = /horizontal$/i.test(key)
    ? "horizontal"
    : "vertical";
  // gridlines are named after their direction: horizontal lines belong to
  // the vertical axis
  const axisDir: ChartAxisDirection =
    el === "gridlines"
      ? dir === "horizontal"
        ? "vertical"
        : "horizontal"
      : dir;
  const axis = chartAxisFor(chart, axisDir);
  if (el === "axes") {
    const axes = { ...chart.axes };
    if (on) delete axes[axis];
    else axes[axis] = false;
    if (Object.keys(axes).length) chart.axes = axes;
    else delete chart.axes;
    return;
  }
  if (el === "axisTitles") {
    const field = axis === "category" ? "categoryAxisTitle" : "valueAxisTitle";
    if (on) chart[field] = chart[field] || labels.axisTitle;
    else delete chart[field];
    return;
  }
  const minor = key.startsWith("minor");
  if (axis === "value") {
    if (minor) {
      if (on) chart.minorGridlines = true;
      else delete chart.minorGridlines;
    } else chart.gridlines = on;
  } else if (minor) {
    if (on) chart.minorCategoryGridlines = true;
    else delete chart.minorCategoryGridlines;
  } else if (on) chart.categoryGridlines = true;
  else delete chart.categoryGridlines;
}

// ---------------------------------------------------------------------------
// Quick Layout
// ---------------------------------------------------------------------------

type LayoutSpec = {
  title?: boolean;
  legend?: Chart["legend"];
  labels?: ChartDataLabelPosition | "callout";
  /** What the labels show (default: the value). */
  labelParts?: { value?: boolean; category?: boolean; percent?: boolean };
  /** Labels on the last category only (Layout 6). */
  lastOnly?: boolean;
  valueAxis?: boolean;
  categoryAxis?: boolean;
  gridlines?: boolean;
  minorGridlines?: boolean;
  categoryGridlines?: boolean;
  valueTitle?: boolean;
  categoryTitle?: boolean;
  dataTable?: boolean;
};

/**
 * Excel's eleven Quick Layouts of the charts with axes (column, bar, line,
 * area, combo, scatter…), with the elements each shows as Excel's gallery
 * describes them (thewindowsclub.com/how-to-change-layout-and-chart-style-
 * in-excel, a clustered column chart):
 *
 * 1. Chart Title, Legend (Right), Horizontal Axis, Vertical Axis, Major
 *    Gridlines.
 * 2. Chart Title, Legend (Top), Data Labels (Outside End), Horizontal Axis.
 * 3. Chart Title, Legend (Bottom), Horizontal Axis, Vertical Axis, Major
 *    Gridlines.
 * 4. Legend (Bottom), Data Labels (Outside End), Horizontal Axis, Vertical
 *    Axis.
 * 5. Chart Title, Data Table, Vertical Axis Title, Vertical Axis, Major
 *    Gridlines.
 * 6. Chart Title, Vertical Axis Title, Data Labels on Last Category
 *    (Outside End), Horizontal Axis, Vertical Axis, Major Gridlines.
 * 7. Legend (Right), Horizontal Axis Title, Vertical Axis Title, Vertical
 *    Axis, Major Gridlines, Minor Gridlines.
 * 8. Chart Title, Horizontal Axis Title, Vertical Axis Title, Horizontal
 *    Axis, Vertical Axis.
 * 9. Chart Title, Legend (Right), Horizontal Axis Title, Vertical Axis
 *    Title, Horizontal Axis, Vertical Axis, Major Gridlines.
 * 10. Chart Title, Legend (Right), Data Labels (Outside End), Horizontal
 *    Axis, Vertical Axis, Major Gridlines.
 * 11. Legend (Right), Horizontal Axis, Vertical Axis, Major Gridlines.
 */
export const CHART_QUICK_LAYOUTS: LayoutSpec[] = [
  { title: true, legend: "right", gridlines: true },
  {
    title: true,
    legend: "top",
    labels: "outsideEnd",
    valueAxis: false,
    gridlines: false,
  },
  { title: true, legend: "bottom", gridlines: true },
  { legend: "bottom", labels: "outsideEnd", gridlines: false },
  {
    title: true,
    legend: "none",
    dataTable: true,
    valueTitle: true,
    categoryAxis: false,
    gridlines: true,
  },
  {
    title: true,
    legend: "none",
    valueTitle: true,
    labels: "outsideEnd",
    lastOnly: true,
    gridlines: true,
  },
  {
    legend: "right",
    valueTitle: true,
    categoryTitle: true,
    categoryAxis: false,
    gridlines: true,
    minorGridlines: true,
  },
  {
    title: true,
    legend: "none",
    valueTitle: true,
    categoryTitle: true,
    gridlines: false,
  },
  {
    title: true,
    legend: "right",
    valueTitle: true,
    categoryTitle: true,
    gridlines: true,
  },
  { title: true, legend: "right", labels: "outsideEnd", gridlines: true },
  { legend: "right", gridlines: true },
];

/**
 * The seven Quick Layouts of pie and doughnut charts. Layouts 1 and 4
 * label the slices with their category names, 2 and 6 with percentages
 * only (ablebits.com/office-addins-blog/make-pie-chart-excel,
 * exceldemy.com/excel-pie-chart-percentage); 3 and 7 have a legend and no
 * labels, 5 the values.
 */
export const PIE_QUICK_LAYOUTS: LayoutSpec[] = [
  {
    title: true,
    legend: "none",
    labels: "bestFit",
    labelParts: { category: true, percent: true },
  },
  {
    title: true,
    legend: "top",
    labels: "bestFit",
    labelParts: { percent: true },
  },
  { legend: "bottom" },
  {
    legend: "none",
    labels: "outsideEnd",
    labelParts: { category: true, value: true },
  },
  {
    title: true,
    legend: "right",
    labels: "insideEnd",
    labelParts: { value: true },
  },
  {
    title: true,
    legend: "right",
    labels: "bestFit",
    labelParts: { percent: true },
  },
  { legend: "right" },
];

/** The Quick Layouts Excel offers for a chart's type. */
export function chartQuickLayouts(chart: Pick<Chart, "type">): LayoutSpec[] {
  if (chart.type === "pie" || chart.type === "doughnut") {
    return PIE_QUICK_LAYOUTS;
  }
  return CHART_QUICK_LAYOUTS;
}

/** The elements Quick Layout `n` (1-based) shows, for its screen tip. */
export function chartQuickLayoutElements(
  n: number,
  chart: Pick<Chart, "type"> = { type: "column" }
): string[] {
  const l = chartQuickLayouts(chart)[n - 1];
  if (!l) return [];
  const pie = chart.type === "pie" || chart.type === "doughnut";
  const out: string[] = [];
  if (l.title) out.push("chartTitle");
  if (l.legend && l.legend !== "none") out.push(`legend:${l.legend}`);
  if (l.labels) {
    out.push(
      l.lastOnly ? `dataLabelsLast:${l.labels}` : `dataLabels:${l.labels}`
    );
  }
  if (l.dataTable) out.push("dataTable");
  if (pie) return out;
  if (l.categoryTitle) out.push("categoryAxisTitle");
  if (l.valueTitle) out.push("valueAxisTitle");
  if (l.categoryAxis !== false) out.push("categoryAxis");
  if (l.valueAxis !== false) out.push("valueAxis");
  if (l.gridlines) out.push("majorGridlines");
  if (l.minorGridlines) out.push("minorGridlines");
  if (l.categoryGridlines) out.push("categoryGridlines");
  return out;
}

/** Apply Quick Layout `n` (1-based) of the chart's type. */
export function applyChartQuickLayout(
  chart: Chart,
  n: number,
  labels: { chartTitle: string; axisTitle: string } = {
    chartTitle: "Chart Title",
    axisTitle: "Axis Title",
  }
) {
  const l = chartQuickLayouts(chart)[n - 1];
  if (!l) return;
  const axes = chartHasAxes(chart.type);
  if (l.title) chart.title = chart.title || labels.chartTitle;
  else delete chart.title;
  delete chart.titleOverlay;
  chart.legend = l.legend ?? "right";
  if (l.labels) {
    chart.dataLabels = true;
    applyChartElement(chart, "dataLabels", l.labels, labels);
    const o = { ...chart.dataLabelOptions };
    if (l.labelParts) {
      o.showValue = !!l.labelParts.value;
      o.showCategory = !!l.labelParts.category;
      o.showPercent = !!l.labelParts.percent;
    } else {
      delete o.showCategory;
      delete o.showPercent;
      delete o.showValue;
    }
    if (l.lastOnly) o.lastPointOnly = true;
    else delete o.lastPointOnly;
    chart.dataLabelOptions = o;
  } else {
    chart.dataLabels = false;
    if (chart.dataLabelOptions?.lastPointOnly) {
      const { lastPointOnly, ...rest } = chart.dataLabelOptions;
      chart.dataLabelOptions = rest;
    }
  }
  if (!axes) return;
  const axesVisible: Chart["axes"] = {};
  if (l.valueAxis === false) axesVisible.value = false;
  if (l.categoryAxis === false) axesVisible.category = false;
  if (Object.keys(axesVisible).length) chart.axes = axesVisible;
  else delete chart.axes;
  chart.gridlines = !!l.gridlines;
  if (l.categoryGridlines) chart.categoryGridlines = true;
  else delete chart.categoryGridlines;
  if (l.minorGridlines) chart.minorGridlines = true;
  else delete chart.minorGridlines;
  delete chart.minorCategoryGridlines;
  if (l.valueTitle)
    chart.valueAxisTitle = chart.valueAxisTitle || labels.axisTitle;
  else delete chart.valueAxisTitle;
  if (l.categoryTitle)
    chart.categoryAxisTitle = chart.categoryAxisTitle || labels.axisTitle;
  else delete chart.categoryAxisTitle;
  if (l.dataTable && chartElementAvailable(chart, "dataTable"))
    chart.dataTable = { legendKeys: true };
  else delete chart.dataTable;
}

// ---------------------------------------------------------------------------
// Format tab: the chart's elements
// ---------------------------------------------------------------------------

/**
 * Elements of the Format tab's Current Selection list, in Excel's order:
 * Chart Area, Chart Title, the horizontal axis (and its title), Legend,
 * Plot Area, the series, the vertical axis, its gridlines and title.
 */
export function chartSelectableElements(chart: Chart): string[] {
  const out = ["chartArea"];
  if (chart.title) out.push("title");
  const axes = chartHasAxes(chart.type) && chart.type !== "radar";
  const h = chartAxisFor(chart, "horizontal");
  const v = chartAxisFor(chart, "vertical");
  const axisIds = (a: "category" | "value") => {
    const ids: string[] = [];
    if (!axes) return ids;
    if (chart.axes?.[a] !== false) ids.push(`${a}Axis`);
    if (a === "value" && chart.gridlines !== false) ids.push("majorGridlines");
    if (a === "category" ? chart.categoryAxisTitle : chart.valueAxisTitle)
      ids.push(`${a}AxisTitle`);
    return ids;
  };
  out.push(...axisIds(h));
  if ((chart.legend ?? "right") !== "none") out.push("legend");
  out.push("plotArea");
  chart.series.forEach((s, i) => {
    if (!s.filtered) out.push(`series:${i}`);
  });
  out.push(...axisIds(v));
  // shapes drawn in the chart, in their order (Excel lists them by name)
  chart.shapes?.forEach((shape) => out.push(`shape:${shape.id}`));
  return out;
}

/** Reset to Match Style: drop the element's own formatting. */
export function resetChartElementFormat(chart: Chart, element: string) {
  const m = /^series:(\d+)$/.exec(element);
  if (m) {
    const s = chart.series[Number(m[1])];
    if (s) {
      delete s.color;
      delete s.outline;
      delete s.pointColors;
    }
    return;
  }
  if (element === "chartArea") {
    // the chart area resets the whole chart (Excel)
    delete chart.formats;
    chart.series.forEach((s) => {
      delete s.color;
      delete s.outline;
      delete s.pointColors;
    });
    return;
  }
  if (chart.formats) {
    delete (chart.formats as Record<string, unknown>)[element];
    if (Object.keys(chart.formats).length === 0) delete chart.formats;
  }
}

/** The chart that `findChart` finds, for callers with only an id. */
export function chartById(ctx: Ctx, id: string | undefined) {
  return findChart(ctx, id)?.chart ?? null;
}
