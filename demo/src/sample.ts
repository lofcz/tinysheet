import type { Sheet } from "@lofcz/tinysheet-core";

type CellData = NonNullable<Sheet["celldata"]>[number];

const FONT = { ff: "Arial", fs: 10 };
const HEADER = { ...FONT, bl: 1, bg: "#f2f2f2" };
const MONEY = { fa: "#,##0", t: "n" };
const PERCENT = { fa: "0.0%", t: "n" };

const money = (n: number) => n.toLocaleString("en-US");
const percent = (n: number) => `${(n * 100).toFixed(1)}%`;
const col = (c: number) => String.fromCharCode(65 + c);

// A small sales table. Formulas carry their cached value (like a saved xlsx);
// editing a quarter recalculates the totals.
const regions: [string, number[]][] = [
  ["North", [12800, 14250, 13900, 16120]],
  ["South", [9350, 10120, 11480, 12030]],
  ["East", [15600, 14980, 16240, 17890]],
  ["West", [8420, 9110, 9870, 10560]],
];

function cells(): CellData[] {
  const out: CellData[] = [];
  const put = (r: number, c: number, v: CellData["v"]) =>
    out.push({ r, c, v: { ...FONT, ...v } });

  ["Region", "Q1", "Q2", "Q3", "Q4", "Total", "Share"].forEach((h, c) =>
    put(0, c, { ...HEADER, v: h, m: h })
  );

  const rowTotals = regions.map(([, q]) => q.reduce((a, b) => a + b, 0));
  const grand = rowTotals.reduce((a, b) => a + b, 0);

  regions.forEach(([name, quarters], i) => {
    const r = i + 1;
    put(r, 0, { v: name, m: name });
    quarters.forEach((n, j) => put(r, j + 1, { v: n, m: money(n), ct: MONEY }));
    put(r, 5, {
      v: rowTotals[i],
      m: money(rowTotals[i]),
      ct: MONEY,
      f: `=SUM(B${r + 1}:E${r + 1})`,
    });
    const share = rowTotals[i] / grand;
    put(r, 6, {
      v: share,
      m: percent(share),
      ct: PERCENT,
      f: `=F${r + 1}/$F$6`,
    });
  });

  const last = regions.length + 1;
  put(last, 0, { v: "Total", m: "Total", bl: 1 });
  for (let c = 1; c <= 5; c += 1) {
    const sum = c === 5 ? grand : regions.reduce((a, [, q]) => a + q[c - 1], 0);
    put(last, c, {
      v: sum,
      m: money(sum),
      ct: MONEY,
      bl: 1,
      f: `=SUM(${col(c)}2:${col(c)}${last})`,
    });
  }
  return out;
}

export const sample: Sheet[] = [
  {
    name: "Sales",
    celldata: cells(),
    config: { columnlen: { 0: 110 } },
    frozen: { type: "row" },
  },
  { name: "Sheet2", celldata: [] },
];
