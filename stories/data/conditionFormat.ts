import {
  CFRule,
  colorScaleFromPreset,
  CF_COLOR_SCALE_PRESETS,
  makeDataBar,
  makeIconSet,
  parseSqref,
} from "@lofcz/tinysheet-core";

const cells: { r: number; c: number; v: any }[] = [];

function put(r: number, c: number, value: any) {
  if (typeof value === "string" && value.startsWith("=")) {
    cells.push({ r, c, v: { f: value } });
  } else if (typeof value === "number") {
    cells.push({
      r,
      c,
      v: { v: value, m: `${value}`, ct: { fa: "General", t: "n" } },
    });
  } else {
    cells.push({
      r,
      c,
      v: { v: value, m: value, ct: { fa: "General", t: "g" } },
    });
  }
}

const headers = [
  "Data bar",
  "Neg. bar",
  "Bar only",
  "2-color",
  "3-color",
  "Arrows",
  "Lights",
  "Ratings",
  "Stars",
  "Highlight",
  "Formula",
];
headers.forEach((h, c) => put(0, c, h));

const values = [12, 45, 78, 3, 56, 90, 34, 67, 23, 100];
const signed = [-40, -15, 0, 20, 45, 70, -5, 90, 35, 100];
values.forEach((v, i) => {
  const r = i + 1;
  put(r, 0, v);
  put(r, 1, signed[i]);
  put(r, 2, v);
  put(r, 3, v);
  put(r, 4, v);
  put(r, 5, v);
  put(r, 6, v);
  put(r, 7, v);
  put(r, 8, v);
  put(r, 9, v);
  put(r, 10, i % 3 === 0 ? "yes" : "no");
});

function range(txt: string) {
  return parseSqref(txt)!;
}

// the last rule has the highest priority
const rules: CFRule[] = [
  {
    type: "dataBar",
    cellrange: range("A2:A11"),
    dataBar: makeDataBar("#638EC6", true),
  },
  {
    type: "dataBar",
    cellrange: range("B2:B11"),
    dataBar: makeDataBar("#63C384", false),
  },
  {
    type: "dataBar",
    cellrange: range("C2:C11"),
    dataBar: makeDataBar("#FFB628", true, { showValue: false }),
  },
  {
    type: "colorGradation",
    cellrange: range("D2:D11"),
    colorScale: { stops: colorScaleFromPreset(CF_COLOR_SCALE_PRESETS[8]) },
  },
  {
    type: "colorGradation",
    cellrange: range("E2:E11"),
    colorScale: { stops: colorScaleFromPreset(CF_COLOR_SCALE_PRESETS[0]) },
  },
  {
    type: "icons",
    cellrange: range("F2:F11"),
    iconSet: makeIconSet("3Arrows"),
  },
  {
    type: "icons",
    cellrange: range("G2:G11"),
    iconSet: makeIconSet("3TrafficLights2"),
  },
  {
    type: "icons",
    cellrange: range("H2:H11"),
    iconSet: makeIconSet("5Rating"),
  },
  {
    type: "icons",
    cellrange: range("I2:I11"),
    iconSet: makeIconSet("3Stars", { showValue: false }),
  },
  {
    type: "default",
    cellrange: range("J2:J11"),
    conditionName: "top10",
    conditionValue: [3],
    format: { cellColor: "#C6EFCE", textColor: "#006100", bold: true },
  },
  {
    type: "default",
    cellrange: range("J2:J11"),
    conditionName: "lessThan",
    conditionValue: [20],
    format: { cellColor: "#FFC7CE", textColor: "#9C0006", italic: true },
  },
  {
    type: "default",
    cellrange: range("K2:K11"),
    conditionName: "formula",
    conditionValue: ['=$K2="yes"'],
    format: {
      borderColor: "#9C0006",
      strikethrough: true,
      textColor: "#9C0006",
    },
  },
];

const data = {
  name: "Conditional formatting",
  id: "cf-demo",
  status: 1,
  celldata: cells,
  luckysheet_conditionformat_save: rules,
  config: { columnlen: { 0: 90, 1: 90, 2: 90, 5: 80, 6: 80, 7: 80, 8: 80 } },
};

export default data;
