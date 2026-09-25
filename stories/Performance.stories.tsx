import React, { useCallback, useEffect, useRef, useState } from "react";
import { Meta, StoryFn } from "@storybook/react";
import { Sheet, CellWithRowAndCol } from "@lofcz/tinysheet-core";
import { Workbook, WorkbookInstance } from "@lofcz/tinysheet-react";

export default {
  title: "Performance",
  component: Workbook,
  // data generators, not stories
  excludeStories: /^make/,
  parameters: {
    // Storybook's JSX source decorator would otherwise serialise the whole
    // data prop on every render and dominate the measurements.
    docs: { source: { code: "<Workbook data={largeSheet} />" } },
  },
} as Meta<typeof Workbook>;

/** Deterministic PRNG so every run renders the same workbook. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const WORDS = [
  "alpha",
  "bravo",
  "charlie",
  "delta",
  "echo",
  "foxtrot",
  "golf",
  "hotel",
  "india",
  "juliet",
  "kilo",
  "lima",
];
const COLORS = ["#fde2e2", "#e2f0fd", "#e7fde2", "#fdf6e2", "#efe2fd"];

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

/**
 * A large sheet: `rows` x 30 columns with numbers, text, styled cells,
 * overflowing and wrapped text, merged blocks, range borders, and one
 * formula column (=SUM over four number cells) per row.
 */
export function makeLargeSheet(rows = 5000, id = "perf"): Sheet {
  const rand = mulberry32(42);
  const celldata: CellWithRowAndCol[] = [];
  const merge: Record<
    string,
    { r: number; c: number; rs: number; cs: number }
  > = {};
  const numbers: number[][] = [];
  const cols = 30;
  for (let r = 0; r < rows; r += 1) {
    numbers[r] = [];
    // A: label
    celldata.push({ r, c: 0, v: { v: `Item ${r + 1}`, m: `Item ${r + 1}` } });
    // B..S: numbers, some styled
    for (let c = 1; c <= 18; c += 1) {
      const v = Math.round(rand() * 100000) / 100;
      numbers[r][c] = v;
      const cell: any = { v, m: String(v), ct: { fa: "General", t: "n" } };
      if ((r + c) % 7 === 0) cell.bg = COLORS[(r + c) % COLORS.length];
      if ((r * 3 + c) % 11 === 0) cell.bl = 1;
      if ((r + c * 5) % 13 === 0) cell.fc = "#c0392b";
      if (c % 6 === 0) cell.ht = 2;
      celldata.push({ r, c, v: cell });
    }
    // T: formula (5k formula cells for 5k rows)
    const sum =
      Math.round(
        (numbers[r][1] + numbers[r][2] + numbers[r][3] + numbers[r][4]) * 100
      ) / 100;
    celldata.push({
      r,
      c: 19,
      v: {
        v: sum,
        m: String(sum),
        f: `=SUM(B${r + 1}:E${r + 1})`,
        ct: { fa: "General", t: "n" },
      },
    });
    // U: text, every 4th row overflows into the empty V
    const words = WORDS[r % WORDS.length];
    const long =
      r % 4 === 0
        ? `${words} ${WORDS[(r + 3) % WORDS.length]} overflowing text ${r}`
        : words;
    celldata.push({ r, c: 20, v: { v: long, m: long, tb: "1" } });
    // W: wrapped text every 10th row
    if (r % 10 === 0) {
      const t = `wrapped ${words} text that needs several lines ${r}`;
      celldata.push({ r, c: 22, v: { v: t, m: t, tb: "2" } });
    }
    // X..Z: numbers with centered alignment and italics
    for (let c = 23; c <= 25; c += 1) {
      const v = Math.floor(rand() * 1000);
      celldata.push({
        r,
        c,
        v: { v, m: String(v), ht: 0, it: r % 5 === 0 ? 1 : 0 },
      });
    }
    // AA..AD: merged 2x2 block every 25 rows, text otherwise
    if (r % 25 === 0 && r + 1 < rows) {
      merge[`${r}_26`] = { r, c: 26, rs: 2, cs: 2 };
    }
    for (let c = 28; c < cols; c += 1) {
      const t = `${colName(c)}${r + 1}`;
      celldata.push({ r, c, v: { v: t, m: t } });
    }
  }
  // merged cells need mc markers on every covered cell
  Object.values(merge).forEach(({ r, c, rs, cs }) => {
    for (let dr = 0; dr < rs; dr += 1) {
      for (let dc = 0; dc < cs; dc += 1) {
        if (dr === 0 && dc === 0) {
          celldata.push({
            r,
            c,
            v: {
              v: `Merged ${r}`,
              m: `Merged ${r}`,
              mc: { r, c, rs, cs },
              ht: 0,
              vt: 0,
              bg: "#fff5cc",
            },
          });
        } else {
          celldata.push({ r: r + dr, c: c + dc, v: { mc: { r, c } } });
        }
      }
    }
  });
  const borderInfo: any[] = [];
  for (let r = 0; r < rows; r += 40) {
    borderInfo.push({
      rangeType: "range",
      borderType: "border-all",
      style: "1",
      color: "#3a6ea5",
      range: [{ row: [r + 2, r + 6], column: [1, 5] }],
    });
    borderInfo.push({
      rangeType: "range",
      borderType: "border-outside",
      style: "8",
      color: "#000",
      range: [{ row: [r + 10, r + 14], column: [7, 11] }],
    });
  }
  return {
    name: "Large",
    id,
    status: 1,
    order: 0,
    row: rows,
    column: cols + 4,
    celldata,
    config: { merge, borderInfo, columnlen: { 0: 90, 20: 110, 22: 130 } },
  } as Sheet;
}

/**
 * A tall, sparse sheet: `rows` x `cols` with a populated header block and a
 * marker row every 1000 rows, for geometry and scrolling at 1M rows.
 */
export function makeHugeSheet(
  rows = 1_000_000,
  cols = 100,
  id = "huge"
): Sheet {
  const celldata: CellWithRowAndCol[] = [];
  for (let r = 0; r < Math.min(rows, 200); r += 1) {
    for (let c = 0; c < Math.min(cols, 20); c += 1) {
      const v = r * cols + c;
      celldata.push({
        r,
        c,
        v: { v, m: String(v), ct: { fa: "General", t: "n" } },
      });
    }
  }
  for (let r = 999; r < rows; r += 1000) {
    const t = `Row ${r + 1}`;
    celldata.push({ r, c: 0, v: { v: t, m: t, bg: "#e2f0fd" } });
    celldata.push({ r, c: cols - 1, v: { v: r + 1, m: String(r + 1) } });
  }
  return {
    name: "Huge",
    id,
    status: 1,
    order: 0,
    row: rows,
    column: cols,
    celldata,
    config: { rowlen: { 5: 40 }, columnlen: { 0: 110 } },
  } as Sheet;
}

/**
 * A long dependency chain: A1 = 1, A{r} = A{r-1}+1 down to row `rows`, and
 * B{r} = A{r}*2 on every 10th row. Editing A1 recalculates all of it.
 */
export function makeChainSheet(rows = 100_000, id = "chain"): Sheet {
  const celldata: CellWithRowAndCol[] = [
    { r: 0, c: 0, v: { v: 1, m: "1", ct: { fa: "General", t: "n" } } },
  ];
  const calcChain: { r: number; c: number; id: string }[] = [];
  for (let r = 1; r < rows; r += 1) {
    const v = r + 1;
    celldata.push({
      r,
      c: 0,
      v: { v, m: String(v), f: `=A${r}+1`, ct: { fa: "General", t: "n" } },
    });
    calcChain.push({ r, c: 0, id });
  }
  for (let r = 0; r < rows; r += 10) {
    const v = (r + 1) * 2;
    celldata.push({
      r,
      c: 1,
      v: { v, m: String(v), f: `=A${r + 1}*2`, ct: { fa: "General", t: "n" } },
    });
    calcChain.push({ r, c: 1, id });
  }
  return {
    name: "Chain",
    id,
    status: 1,
    order: 0,
    row: rows,
    column: 10,
    celldata,
    calcChain,
  } as Sheet;
}

declare global {
  interface Window {
    __perf?: {
      workbook: WorkbookInstance | null;
      /** performance.now() when the Workbook first committed */
      mountedAt: number;
      /** ms spent generating the sheet data (not part of load time) */
      createdAt: number;
      /** performance.now() once the data was generated */
      dataReadyAt: number;
      cells: number;
    };
  }
}

type PerfProps = {
  rows: number;
  frozen?: boolean;
  /** number of sheets; the first one is active */
  sheets?: number;
  /** build sheets with makeHugeSheet(rows, cols) instead */
  huge?: boolean;
  /** build sheets with makeChainSheet(rows) instead */
  chain?: boolean;
  cols?: number;
};

// State lives in an inner component so onChange does not re-render the story
// function itself (keeps Storybook decorators out of the measurements).
const PerfWorkbook: React.FC<PerfProps> = ({
  rows,
  frozen,
  sheets = 1,
  huge,
  chain,
  cols,
}) => {
  const ref = useRef<WorkbookInstance>(null);
  const [data, setData] = useState<Sheet[]>(() => {
    const t0 = performance.now();
    const list: Sheet[] = [];
    for (let i = 0; i < sheets; i += 1) {
      let sheet: Sheet;
      if (chain) sheet = makeChainSheet(rows, `chain${i}`);
      else if (huge) sheet = makeHugeSheet(rows, cols, `huge${i}`);
      else sheet = makeLargeSheet(rows, i === 0 ? "perf" : `perf${i}`);
      sheet.name = i === 0 ? sheet.name : `${sheet.name} ${i + 1}`;
      sheet.order = i;
      sheet.status = i === 0 ? 1 : 0;
      if (frozen) {
        sheet.frozen = {
          type: "rangeBoth",
          range: { row_focus: 0, column_focus: 0 },
        };
      }
      list.push(sheet);
    }
    window.__perf = {
      workbook: null,
      mountedAt: 0,
      createdAt: performance.now() - t0,
      dataReadyAt: performance.now(),
      cells: list.reduce((n, s) => n + (s.celldata?.length ?? 0), 0),
    };
    return list;
  });
  const onChange = useCallback((d: Sheet[]) => setData(d), []);
  useEffect(() => {
    if (window.__perf) {
      window.__perf.workbook = ref.current;
      if (!window.__perf.mountedAt) window.__perf.mountedAt = performance.now();
    }
  });
  return (
    <div style={{ width: "100%", height: "100vh" }}>
      <Workbook ref={ref} data={data} onChange={onChange} />
    </div>
  );
};

/** ~130k populated cells: numbers, text, styles, merges, borders, 5k formulas. */
export const LargeSheet: StoryFn<{ rows: number }> = ({ rows }) => (
  <PerfWorkbook rows={rows} />
);
LargeSheet.args = { rows: 5000 };

/** Same data with the first row and column frozen. */
export const LargeSheetFrozen: StoryFn<{ rows: number }> = ({ rows }) => (
  <PerfWorkbook rows={rows} frozen />
);
LargeSheetFrozen.args = { rows: 5000 };

/** Load benchmark: ~100k populated cells. */
export const Load100k: StoryFn<{ rows: number }> = ({ rows }) => (
  <PerfWorkbook rows={rows} />
);
Load100k.args = { rows: 3800 };

/** Load benchmark: ~1M populated cells on one sheet. */
export const Load1M: StoryFn<{ rows: number }> = ({ rows }) => (
  <PerfWorkbook rows={rows} />
);
Load1M.args = { rows: 38000 };

/** Load benchmark: ~1M populated cells over four sheets (one active). */
export const Load1MFourSheets: StoryFn<{ rows: number; sheets: number }> = ({
  rows,
  sheets,
}) => <PerfWorkbook rows={rows} sheets={sheets} />;
Load1MFourSheets.args = { rows: 9500, sheets: 4 };

/** 1M rows x 100 columns, sparsely populated: geometry and scrolling. */
export const MillionRows: StoryFn<{ rows: number; cols: number }> = ({
  rows,
  cols,
}) => <PerfWorkbook rows={rows} cols={cols} huge />;
MillionRows.args = { rows: 1_000_000, cols: 100 };

/**
 * A 100k-formula dependency chain: editing A1 recalculates every formula
 * (in slices, with a progress indicator in the status bar).
 */
export const LongChain: StoryFn<{ rows: number }> = ({ rows }) => (
  <PerfWorkbook rows={rows} chain />
);
LongChain.args = { rows: 100_000 };
