// GROUPBY and PIVOTBY. See ./index.js for the calling convention.
//
// GROUPBY(row_fields, values, function, [field_headers], [total_depth],
//         [sort_order], [filter_array], [field_relationship])
// PIVOTBY(row_fields, col_fields, values, function, [field_headers],
//         [row_total_depth], [row_sort_order], [col_total_depth],
//         [col_sort_order], [filter_array], [relative_to])
//
// `function` is a LAMBDA (one argument: the group's values as a column; two
// arguments: the group's values and the values it is relative to, as
// PERCENTOF expects), an eta-reduced function (a LAMBDA with a
// `functionName`, see ./eta.js) or, as a fallback until the evaluator turns a
// bare `SUM` into an eta LAMBDA, the function name as text ("SUM"). A row or
// column vector of functions computes several aggregations; a two-row array
// whose first row is text and second row functions supplies custom labels.
//
// Implemented semantics (Microsoft documentation, plus decisions where the
// documentation is silent):
// * field_headers: omitted = automatic (headers assumed when the first
//   value is text and the second is a number; they are not shown), 0 no,
//   1 yes but hidden, 2 no but generated ("Row Field 1", "Col Field 1",
//   "Value 1"), 3 yes and shown.
// * Several functions always add a header row with the function names.
//   Value columns are ordered function-major (f1:v1, f1:v2, f2:v1, ...).
// * total_depth: omitted/1 grand total, 0 none, 2+ grand total and
//   subtotals down to that depth, negative = totals above their rows.
//   The total row is labelled "Total"; subtotal rows show their group's
//   labels and leave deeper fields blank.
// * sort_order: column numbers counted over the row fields then the value
//   columns, negative for descending; a vector gives several keys. In
//   hierarchy mode each level is sorted within its parent and a value column
//   sorts a group by its (sub)total. Default: ascending by the fields.
//   Grouping and sorting are case-insensitive (numbers < text < logicals,
//   blanks last); a group is labelled with its first occurrence.
// * filter_array: booleans, one per data row.
// * field_relationship: 0 hierarchy (default), 1 table (no subtotals).
// * PIVOTBY relative_to (two-argument functions): 0 column total
//   (default), 1 row total, 2 grand total, 3 parent column total, 4 parent
//   row total. GROUPBY passes the whole (filtered) value column.
// * An aggregation that returns an error keeps the error in its cell; empty
//   PIVOTBY intersections are blank; no data left → #CALC!.

import { ERROR_CALC, ERROR_VALUE } from "../error";
import {
  compare,
  isErrorString,
  toBoolean,
  toErrorValue,
  toNumber,
} from "../helper/value";
import { isLambda } from "./lambda";
import { functionByName } from "./eta";

function fail(code) {
  throw new Error(code);
}

function isBlank(v) {
  return v === null || v === undefined;
}

function throwIfError(v) {
  if (v instanceof Error) throw v;
  return v;
}

function grid(value) {
  throwIfError(value);
  if (!Array.isArray(value)) return [[value]];
  if (value.length === 0) return [[]];
  if (!Array.isArray(value[0])) return [value];
  return value;
}

/* -------------------------------------------------------------------------- */
/* Aggregation functions                                                      */
/* -------------------------------------------------------------------------- */

function toElement(value) {
  if (Array.isArray(value)) {
    const g = grid(value);
    if (g.length === 1 && g[0].length === 1) return g[0][0];
    return toErrorValue(ERROR_CALC);
  }
  if (isLambda(value)) return toErrorValue(ERROR_CALC);
  if (isBlank(value)) return 0;
  return value;
}

function aggregatorFrom(item) {
  if (isLambda(item)) {
    const twoArgs = item.params.length >= 2;
    return {
      name: item.functionName || "LAMBDA",
      call: (subset, all) => (twoArgs ? item(subset, all) : item(subset)),
    };
  }
  if (typeof item === "string") {
    const fn = functionByName(item);
    if (!fn) return null;
    const name = item.trim().toUpperCase();
    const twoArgs = name === "PERCENTOF";
    return {
      name,
      call: (subset, all) => (twoArgs ? fn(subset, all) : fn(subset)),
    };
  }
  return null;
}

/** Parse the `function` argument into [{ name, call }]. */
function aggregators(fnArg) {
  throwIfError(fnArg);
  if (!Array.isArray(fnArg)) {
    const agg = aggregatorFrom(fnArg);
    if (!agg) fail(ERROR_VALUE);
    return [agg];
  }
  const g = grid(fnArg);
  // Two rows: labels over functions.
  if (g.length === 2 && g[0].length === g[1].length) {
    const fns = g[1].map(aggregatorFrom);
    const labelsAreFunctions = g[0].every((x) => aggregatorFrom(x));
    if (fns.every(Boolean) && !labelsAreFunctions) {
      return fns.map((agg, i) => ({
        ...agg,
        name: isBlank(g[0][i]) ? agg.name : String(g[0][i]),
      }));
    }
  }
  const items = [];
  g.forEach((row) => row.forEach((x) => items.push(x)));
  const aggs = items.map(aggregatorFrom);
  if (!aggs.length || !aggs.every(Boolean)) fail(ERROR_VALUE);
  return aggs;
}

function runAggregate(agg, subset, all) {
  try {
    return toElement(agg.call(subset, all));
  } catch (ex) {
    return toErrorValue(ex);
  }
}

/* -------------------------------------------------------------------------- */
/* Inputs                                                                     */
/* -------------------------------------------------------------------------- */

function mode(value, def, allowed) {
  if (isBlank(value)) return def;
  const n = Math.trunc(toNumber(throwIfError(value)));
  if (allowed && !allowed.includes(n)) fail(ERROR_VALUE);
  return n;
}

function hasAutoHeaders(values) {
  if (values.length < 2) return false;
  const first = values[0][0];
  const second = values[1][0];
  return typeof first === "string" && typeof second === "number";
}

function checkRows(arrays) {
  const rows = arrays[0].length;
  arrays.forEach((a) => {
    if (a.length !== rows) fail(ERROR_VALUE);
  });
  return rows;
}

function filterMask(filterArg, rows, hasHeaders) {
  if (isBlank(filterArg)) return null;
  const g = grid(filterArg);
  const flat = [];
  g.forEach((row) => row.forEach((x) => flat.push(x)));
  let items = flat;
  if (hasHeaders && items.length === rows + 1) items = items.slice(1);
  if (items.length !== rows) fail(ERROR_VALUE);
  return items.map((x) => (isBlank(x) ? false : toBoolean(throwIfError(x))));
}

function headerText(v) {
  if (isBlank(v)) return "";
  return v;
}

/**
 * Split headers from data according to field_headers.
 * Returns { rowsData: [grids], headers: [header rows], show, dataRows }.
 */
function prepare(gridsByKind, fieldHeaders) {
  const valuesGrid = gridsByKind.values;
  const auto = isBlank(fieldHeaders);
  const fh = auto
    ? hasAutoHeaders(valuesGrid)
      ? 1
      : 0
    : mode(fieldHeaders, 0, [0, 1, 2, 3]);
  const hasHeaders = fh === 1 || fh === 3;
  const out = { hasHeaders, show: fh === 2 || fh === 3, generate: fh === 2 };
  Object.keys(gridsByKind).forEach((kind) => {
    const g = gridsByKind[kind];
    out[`${kind}Header`] = hasHeaders ? g[0].map(headerText) : null;
    out[kind] = hasHeaders ? g.slice(1) : g;
  });
  return out;
}

/* -------------------------------------------------------------------------- */
/* Grouping trees                                                             */
/* -------------------------------------------------------------------------- */

function groupKey(v) {
  if (isBlank(v) || v === "") return "b:";
  if (v instanceof Error) return `e:${v.message}`;
  if (typeof v === "string") {
    if (isErrorString(v)) return `e:${toErrorValue(v).message}`;
    return `s:${v.toLowerCase()}`;
  }
  if (typeof v === "number") return `n:${v}`;
  if (typeof v === "boolean") return `l:${v}`;
  return `o:${String(v)}`;
}

function compareKeys(a, b) {
  const aBlank = isBlank(a) || a === "";
  const bBlank = isBlank(b) || b === "";
  if (aBlank || bBlank) return aBlank === bBlank ? 0 : aBlank ? 1 : -1;
  const aErr = a instanceof Error;
  const bErr = b instanceof Error;
  if (aErr || bErr) {
    if (aErr && bErr)
      return a.message < b.message ? -1 : a.message > b.message ? 1 : 0;
    return aErr ? 1 : -1;
  }
  try {
    return compare(a, b);
  } catch (ex) {
    return 0;
  }
}

/**
 * Build a grouping tree over `records` (indices) keyed by the columns of
 * `fields` (rows x levels). Table mode groups by the whole tuple (one level).
 */
function buildTree(fields, records, table) {
  const levels = fields.length ? fields[0].length : 0;
  const root = {
    level: 0,
    path: [],
    indices: records.slice(),
    children: [],
    parent: null,
  };
  if (table) {
    const map = new Map();
    records.forEach((r) => {
      const tuple = fields[r];
      const key = tuple.map(groupKey).join("\u0000");
      let node = map.get(key);
      if (!node) {
        node = {
          level: levels,
          path: tuple.slice(),
          indices: [],
          children: [],
          parent: root,
          tuple: true,
        };
        map.set(key, node);
        root.children.push(node);
      }
      node.indices.push(r);
    });
    return { root, levels };
  }
  const maps = new Map([[root, new Map()]]);
  records.forEach((r) => {
    let node = root;
    for (let level = 1; level <= levels; level++) {
      const value = fields[r][level - 1];
      const key = groupKey(value);
      const childMap = maps.get(node);
      let child = childMap.get(key);
      if (!child) {
        child = {
          level,
          path: node.path.concat([value]),
          indices: [],
          children: [],
          parent: node,
        };
        childMap.set(key, child);
        maps.set(child, new Map());
        node.children.push(child);
      }
      child.indices.push(r);
      node = child;
    }
  });
  return { root, levels };
}

function sortSpecs(sortArg) {
  if (isBlank(sortArg)) return [];
  const g = grid(sortArg);
  const specs = [];
  g.forEach((row) =>
    row.forEach((x) => {
      if (isBlank(x)) return;
      const n = Math.trunc(toNumber(throwIfError(x)));
      if (n === 0) fail(ERROR_VALUE);
      specs.push(n);
    })
  );
  return specs;
}

/**
 * Sort a tree in place. `levels` row-field columns; spec |n| <= levels sorts
 * by a field, larger numbers by `valueOf(node, n - levels - 1)`.
 */
function sortTree(tree, specs, valueCount, valueOf) {
  const { levels } = tree;
  specs.forEach((n) => {
    if (Math.abs(n) > levels + valueCount) fail(ERROR_VALUE);
  });
  const sortChildren = (node) => {
    if (!node.children.length) return;
    const cache = new Map();
    const cached = (child, index) => {
      const key = `${index}`;
      let perNode = cache.get(child);
      if (!perNode) {
        perNode = new Map();
        cache.set(child, perNode);
      }
      if (!perNode.has(key)) perNode.set(key, valueOf(child, index));
      return perNode.get(key);
    };
    const tupleMode = node.children[0].tuple;
    node.children.sort((a, b) => {
      for (let i = 0; i < specs.length; i++) {
        const n = specs[i];
        const col = Math.abs(n);
        const dir = n < 0 ? -1 : 1;
        let c = 0;
        if (col <= levels) {
          if (tupleMode) c = compareKeys(a.path[col - 1], b.path[col - 1]);
          else if (col === a.level)
            c = compareKeys(a.path[col - 1], b.path[col - 1]);
          else continue;
        } else {
          c = compareKeys(
            cached(a, col - levels - 1),
            cached(b, col - levels - 1)
          );
        }
        if (c !== 0) return c * dir;
      }
      if (tupleMode) {
        for (let i = 0; i < a.path.length; i++) {
          const c = compareKeys(a.path[i], b.path[i]);
          if (c !== 0) return c;
        }
        return 0;
      }
      return compareKeys(a.path[a.level - 1], b.path[b.level - 1]);
    });
    node.children.forEach(sortChildren);
  };
  sortChildren(tree.root);
}

/**
 * Flatten a tree into display entries: { kind: "leaf"|"sub"|"total", node }.
 */
function flattenTree(tree, depth, table) {
  const out = [];
  const absDepth = Math.abs(depth);
  const top = depth < 0;
  const subtotalLevels = table ? 0 : Math.max(0, absDepth - 1);
  const walk = (node) => {
    node.children.forEach((child) => {
      if (child.level >= tree.levels || child.tuple) {
        out.push({ kind: "leaf", node: child });
        return;
      }
      const sub = child.level <= subtotalLevels;
      if (sub && top) out.push({ kind: "sub", node: child });
      walk(child);
      if (sub && !top) out.push({ kind: "sub", node: child });
    });
  };
  if (absDepth >= 1 && top) out.push({ kind: "total", node: tree.root });
  walk(tree.root);
  if (absDepth >= 1 && !top) out.push({ kind: "total", node: tree.root });
  return out;
}

function labelCells(entry, levels) {
  const cells = new Array(levels).fill(null);
  if (entry.kind === "total") {
    if (levels) cells[0] = "Total";
    return cells;
  }
  const path = entry.node.path;
  for (let i = 0; i < path.length && i < levels; i++) {
    const v = path[i];
    cells[i] = v instanceof Error ? v : isBlank(v) ? null : v;
  }
  return cells;
}

function column(values, indices, j) {
  return indices.map((r) => [values[r][j]]);
}

function generatedNames(prefix, count) {
  return Array.from({ length: count }, (_, i) => `${prefix} ${i + 1}`);
}

/** Value-column descriptors in function-major order. */
function valueColumns(aggs, valueCount) {
  const cols = [];
  aggs.forEach((agg, f) => {
    for (let v = 0; v < valueCount; v++) cols.push({ agg, f, v });
  });
  return cols;
}

function valueHeaderRows(cols, aggs, valueNames, show) {
  const rows = [];
  if (show && valueNames) rows.push(cols.map((c) => valueNames[c.v]));
  if (aggs.length > 1) rows.push(cols.map((c) => c.agg.name));
  return rows;
}

/* -------------------------------------------------------------------------- */
/* GROUPBY                                                                    */
/* -------------------------------------------------------------------------- */

function GROUPBY(
  rowFields,
  values,
  fn,
  fieldHeaders,
  totalDepth,
  sortOrder,
  filterArray,
  fieldRelationship
) {
  if (fn === undefined) fail(ERROR_VALUE);
  const aggs = aggregators(fn);
  const input = prepare(
    { rows: grid(rowFields), values: grid(values) },
    fieldHeaders
  );
  const dataRows = checkRows([input.rows, input.values]);
  const levels = input.rows.length
    ? input.rows[0].length
    : grid(rowFields)[0].length;
  const valueCount = input.values.length
    ? input.values[0].length
    : grid(values)[0].length;
  const relationship = mode(fieldRelationship, 0, [0, 1]);
  const table = relationship === 1 && levels > 1;
  const depth = mode(totalDepth, 1);
  const mask = filterMask(filterArray, dataRows, input.hasHeaders);
  const records = [];
  for (let r = 0; r < dataRows; r++) if (!mask || mask[r]) records.push(r);
  if (!records.length) fail(ERROR_CALC);

  const cols = valueColumns(aggs, valueCount);
  const allColumns = [];
  for (let v = 0; v < valueCount; v++)
    allColumns.push(column(input.values, records, v));
  const cellFor = (node, c) =>
    runAggregate(
      c.agg,
      column(input.values, node.indices, c.v),
      allColumns[c.v]
    );

  const tree = buildTree(input.rows, records, table);
  sortTree(tree, sortSpecs(sortOrder), cols.length, (node, i) =>
    cellFor(node, cols[i])
  );
  const entries = flattenTree(tree, depth, table);

  let rowNames = null;
  let valueNames = null;
  if (input.show) {
    rowNames = input.generate
      ? generatedNames("Row Field", levels)
      : input.rowsHeader;
    valueNames = input.generate
      ? generatedNames("Value", valueCount)
      : input.valuesHeader;
  }
  const out = [];
  const headerRows = valueHeaderRows(cols, aggs, valueNames, input.show);
  headerRows.forEach((row, i) => {
    const last = i === headerRows.length - 1;
    const left =
      last && rowNames ? rowNames.slice() : new Array(levels).fill(null);
    out.push(left.concat(row));
  });
  entries.forEach((entry) => {
    out.push(
      labelCells(entry, levels).concat(cols.map((c) => cellFor(entry.node, c)))
    );
  });
  return out;
}

/* -------------------------------------------------------------------------- */
/* PIVOTBY                                                                    */
/* -------------------------------------------------------------------------- */

function intersect(a, bSet) {
  return a.filter((r) => bSet.has(r));
}

function PIVOTBY(
  rowFields,
  colFields,
  values,
  fn,
  fieldHeaders,
  rowTotalDepth,
  rowSortOrder,
  colTotalDepth,
  colSortOrder,
  filterArray,
  relativeTo
) {
  if (fn === undefined) fail(ERROR_VALUE);
  const aggs = aggregators(fn);
  const input = prepare(
    { rows: grid(rowFields), cols: grid(colFields), values: grid(values) },
    fieldHeaders
  );
  const dataRows = checkRows([input.rows, input.cols, input.values]);
  const rowLevels = grid(rowFields)[0].length;
  const colLevels = grid(colFields)[0].length;
  const valueCount = grid(values)[0].length;
  const relative = mode(relativeTo, 0, [0, 1, 2, 3, 4]);
  const mask = filterMask(filterArray, dataRows, input.hasHeaders);
  const records = [];
  for (let r = 0; r < dataRows; r++) if (!mask || mask[r]) records.push(r);
  if (!records.length) fail(ERROR_CALC);

  const cols = valueColumns(aggs, valueCount);
  const rowTree = buildTree(input.rows, records, false);
  const colTree = buildTree(input.cols, records, false);
  const cellFor = (rowNode, colNode, c) => {
    const colSet = new Set(colNode.indices);
    const indices = intersect(rowNode.indices, colSet);
    if (!indices.length) return null;
    let context;
    switch (relative) {
      case 1:
        context = rowNode.indices;
        break;
      case 2:
        context = records;
        break;
      case 3:
        context = (colNode.parent || colNode).indices;
        break;
      case 4:
        context = intersect((rowNode.parent || rowNode).indices, colSet);
        break;
      default:
        context = colNode.indices;
    }
    if (relative === 3) context = intersect(context, new Set(records));
    return runAggregate(
      c.agg,
      column(input.values, indices, c.v),
      column(input.values, context, c.v)
    );
  };
  sortTree(rowTree, sortSpecs(rowSortOrder), valueCount, (node, i) =>
    cellFor(node, colTree.root, { agg: aggs[0], v: i })
  );
  sortTree(colTree, sortSpecs(colSortOrder), valueCount, (node, i) =>
    cellFor(rowTree.root, node, { agg: aggs[0], v: i })
  );
  const rowEntries = flattenTree(rowTree, mode(rowTotalDepth, 1), false);
  const colEntries = flattenTree(colTree, mode(colTotalDepth, 1), false);

  let rowNames = null;
  let colNames = null;
  let valueNames = null;
  if (input.show) {
    rowNames = input.generate
      ? generatedNames("Row Field", rowLevels)
      : input.rowsHeader;
    colNames = input.generate
      ? generatedNames("Col Field", colLevels)
      : input.colsHeader;
    valueNames = input.generate
      ? generatedNames("Value", valueCount)
      : input.valuesHeader;
  }

  // Header block: one row per column level, then value/function rows.
  const dataColumns = [];
  colEntries.forEach((entry) => {
    cols.forEach((c) => dataColumns.push({ entry, c }));
  });
  const out = [];
  for (let level = 0; level < colLevels; level++) {
    const left = new Array(rowLevels).fill(null);
    if (colNames && rowLevels) left[rowLevels - 1] = colNames[level];
    out.push(
      left.concat(
        dataColumns.map(({ entry }) => labelCells(entry, colLevels)[level])
      )
    );
  }
  const extra = valueHeaderRows(cols, aggs, valueNames, input.show);
  const extraRows = extra.length
    ? extra.map((row) => dataColumns.map(({ c }) => row[cols.indexOf(c)]))
    : [];
  if (rowNames && !extraRows.length)
    extraRows.push(dataColumns.map(() => null));
  extraRows.forEach((row, i) => {
    const last = i === extraRows.length - 1;
    const left =
      last && rowNames ? rowNames.slice() : new Array(rowLevels).fill(null);
    out.push(left.concat(row));
  });
  rowEntries.forEach((rowEntry) => {
    out.push(
      labelCells(rowEntry, rowLevels).concat(
        dataColumns.map(({ entry, c }) => cellFor(rowEntry.node, entry.node, c))
      )
    );
  });
  return out;
}

export default { GROUPBY, PIVOTBY };
