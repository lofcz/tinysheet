import { makeContext, input, parseA1 } from "../formula/helpers";
import { computeCFMap, parseSqref } from "../../src/modules/ConditionFormat";

export { makeContext, input, parseA1 };

/** Store a constant like a typed value (numbers get ct.t "n"). */
export function put(ctx, a1, v, sheetId = "id_1") {
  const { r, c } = parseA1(a1);
  const sheet = ctx.luckysheetfile.find((s) => s.id === sheetId);
  if (v === null || v === undefined) {
    sheet.data[r][c] = null;
  } else if (typeof v === "number") {
    sheet.data[r][c] = { v, m: `${v}`, ct: { fa: "General", t: "n" } };
  } else if (typeof v === "boolean") {
    sheet.data[r][c] = {
      v,
      m: `${v}`.toUpperCase(),
      ct: { fa: "General", t: "b" },
    };
  } else {
    sheet.data[r][c] = { v, m: v, ct: { fa: "General", t: "g" } };
  }
}

/** Fill a column downwards from `a1` with values. */
export function column(ctx, a1, list, sheetId = "id_1") {
  const { r, c } = parseA1(a1);
  list.forEach((v, i) => {
    const col = String.fromCharCode(65 + c);
    put(ctx, `${col}${r + 1 + i}`, v, sheetId);
  });
}

export function rules(ctx, list, sheetId = "id_1") {
  const sheet = ctx.luckysheetfile.find((s) => s.id === sheetId);
  sheet.luckysheet_conditionformat_save = list;
}

export function range(txt) {
  return parseSqref(txt);
}

export function cf(ctx, a1, sheetId = "id_1") {
  const map = computeCFMap(ctx, sheetId);
  const { r, c } = parseA1(a1);
  return map[`${r}_${c}`] ?? null;
}

/** Cells (A1 names) of the range that got the given property. */
export function marked(ctx, prop = "cellColor", sheetId = "id_1") {
  const map = computeCFMap(ctx, sheetId);
  return Object.keys(map)
    .filter((k) => map[k][prop] !== undefined)
    .map((k) => {
      const [r, c] = k.split("_").map(Number);
      return `${String.fromCharCode(65 + c)}${r + 1}`;
    })
    .sort((a, b) => {
      const pa = parseA1(a);
      const pb = parseA1(b);
      return pa.c - pb.c || pa.r - pb.r;
    });
}

export function highlight(name, cellrange, conditionValue = [], extra = {}) {
  return {
    type: "default",
    cellrange: range(cellrange),
    conditionName: name,
    conditionValue,
    format: { cellColor: "#FF0000" },
    ...extra,
  };
}
