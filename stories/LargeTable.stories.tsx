import React, { useLayoutEffect, useRef, useState } from "react";
import { Sheet, CellWithRowAndCol } from "@lofcz/tinysheet-core";
import { Workbook, WorkbookInstance } from "@lofcz/tinysheet-react";

export default {
  title: "Performance/Large Table",
  parameters: { docs: { source: { code: "<Workbook data={largeTable} />" } } },
};

// No customer data: 500k cells, unique and repeated values, blanks, dates,
// imported-style per-cell outside borders, banded rows and two small sheets.
function workbook(rows: number, autoFilter: boolean): Sheet[] {
  const names = [
    "ID",
    "Region",
    "Date",
    "Blank",
    "Amount",
    "Owner",
    "City",
    "Status",
    "Code",
    "Note",
  ];
  const celldata: CellWithRowAndCol[] = [];
  const borderInfo: any[] = [];
  const edge = { style: "1", color: "#305496" };
  for (let r = 0; r <= rows; r += 1) {
    for (let c = 0; c < names.length; c += 1) {
      const v =
        r === 0
          ? names[c]
          : c === 0
            ? `ID-${String(r).padStart(5, "0")}`
            : c === 1
              ? ["East", "West"][r % 2]
              : c === 2
                ? 45000 + (r % 365)
                : c === 3
                  ? null
                  : c === 4
                    ? r / 100
                    : `Value ${c}-${r % 100}`;
      celldata.push({
        r,
        c,
        v: {
          v: v ?? undefined,
          m: v == null ? "" : String(v),
          bg: r === 0 ? "#4472C4" : r % 2 ? "#D9E1F2" : "#FFFFFF",
          ...(r > 0 && c === 2 ? { ct: { t: "d", fa: "yyyy-mm-dd" } } : {}),
        },
      });
      if (c === 0 || c === 9 || r === 0 || r === rows) {
        borderInfo.push({
          rangeType: "cell",
          value: {
            row_index: r,
            col_index: c,
            ...(c === 0 ? { l: edge } : {}),
            ...(c === 9 ? { r: edge } : {}),
            ...(r === 0 ? { t: edge } : {}),
            ...(r === rows ? { b: edge } : {}),
          },
        });
      }
    }
  }
  return [
    {
      id: "large-table",
      name: "Data",
      order: 0,
      status: 1,
      row: rows + 1,
      column: 12,
      celldata,
      config: { borderInfo, columnlen: { 0: 110, 2: 110 } },
      ...(autoFilter
        ? { filter_select: { row: [0, rows], column: [0, 9] }, filter: {} }
        : {
            tables: [
              {
                name: "Records",
                displayName: "Records",
                range: { row: [0, rows], column: [0, 9] },
                columns: names.map((name) => ({ name })),
                headerRow: true,
                totalRow: false,
                filterButton: true,
                bandedRows: true,
                style: "TableStyleMedium2",
              },
            ],
          }),
    },
    ...[100, 500].map((count, i) => ({
      id: `lookup-${i}`,
      name: `Lookup ${i + 1}`,
      order: i + 1,
      status: 0,
      row: count,
      column: 10,
      celldata: Array.from({ length: count }, (_, r) => ({
        r,
        c: 0,
        v: { v: `Lookup ${r}`, m: `Lookup ${r}` },
      })),
    })),
  ] as Sheet[];
}

const LargeTable = ({ autoFilter = false }: { autoFilter?: boolean }) => {
  const ref = useRef<WorkbookInstance>(null);
  const [data] = useState(() => workbook(50_000, autoFilter));
  const started = useRef(performance.now());
  useLayoutEffect(() => {
    (window as any).__largeTable = {
      get workbook() {
        return ref.current;
      },
      started: started.current,
    };
  });
  return (
    <div style={{ width: "100%", height: "100vh" }}>
      <Workbook ref={ref} data={data} />
    </div>
  );
};

export const Table50k = () => <LargeTable />;
export const AutoFilter50k = () => <LargeTable autoFilter />;
