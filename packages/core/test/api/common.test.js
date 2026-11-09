import { contextFactory } from "../factories/context";
import { getSheet, getSheetWithLatestCelldata } from "../../src/api/common";
import {
  createSourceMatrix,
  getSourceMatrixStats,
} from "../../src/modules/rowStore";

describe("common", () => {
  const expectedSheet = {
    id: "id_2",
    data: [[{ v: "rose" }]],
    celldat: [
      {
        c: 0,
        r: 0,
        v: {
          v: "rose",
        },
      },
    ],
  };
  const getContext = () =>
    contextFactory({
      luckysheetfile: [
        {
          id: "id_1",
          data: [[]],
        },
        expectedSheet,
      ],
    });

  test("getSheet", async () => {
    const ctx = getContext();
    expect(getSheet(ctx, { id: "id_2" })).toEqual(expectedSheet);
  });

  test("reading sheet metadata does not materialize cells; explicit snapshots still do", () => {
    const data = createSourceMatrix(1000, 3, (r, c) => ({ v: r + c }));
    const ctx = contextFactory({
      luckysheetfile: [{ id: "id_1", data, config: { rowhidden: { 42: 0 } } }],
    });
    const snapshot = getSheetWithLatestCelldata(ctx, { id: "id_1" });
    expect(snapshot.config.rowhidden).toEqual({ 42: 0 });
    expect(getSourceMatrixStats(data).decodedCells).toBe(0);
    expect(Array.isArray(snapshot.data)).toBe(true);
    expect(getSourceMatrixStats(data).decodedCells).toBe(0);
    expect(snapshot.celldata).toHaveLength(3000);
    expect(snapshot.celldata[2999]).toEqual({ r: 999, c: 2, v: { v: 1001 } });
    expect(snapshot.celldata).toBe(snapshot.celldata);
    const untouched = getSheetWithLatestCelldata(ctx, { id: "id_1" });
    untouched.celldata = [];
    expect(untouched.celldata).toEqual([]);
    expect(snapshot.celldata).toHaveLength(3000);
  });
});
