import produce from "immer";
import { expandCellData } from "../../src/modules/sheetLoad";

describe("expandCellData", () => {
  test("places cells and sizes the matrix like the legacy loader", () => {
    const sheet = {
      celldata: [
        { r: 0, c: 0, v: { v: 1 } },
        { r: 4, c: 2, v: { v: "x" } },
      ],
    };
    const data = expandCellData(sheet, 3, 2);
    expect(data.length).toBe(5);
    expect(data[0].length).toBe(3);
    expect(data[4][2]).toEqual({ v: "x" });
    expect(data[1][1]).toBeNull();
    // defaults win when larger
    expect(expandCellData({ celldata: [] }, 84, 60).length).toBe(84);
    expect(expandCellData({ celldata: [] }, 84, 60)[0].length).toBe(60);
    // explicit row/column win over defaults
    const sized = expandCellData({ celldata: [], row: 10, column: 4 }, 84, 60);
    expect(sized.length).toBe(10);
    expect(sized[0].length).toBe(4);
  });

  test("returns frozen rows that immer copies on write", () => {
    const data = expandCellData(
      { celldata: [{ r: 1, c: 1, v: { v: 2 } }] },
      3,
      3
    );
    expect(Object.isFrozen(data)).toBe(true);
    expect(Object.isFrozen(data[0])).toBe(true);
    const next = produce({ data }, (d) => {
      d.data[1][1].v = 3;
      d.data[2][0] = { v: 4 };
    });
    expect(next.data[1][1].v).toBe(3);
    expect(next.data[2][0]).toEqual({ v: 4 });
    expect(data[1][1].v).toBe(2);
    expect(data[2][0]).toBeNull();
    expect(next.data[0]).toBe(data[0]);
  });

  test("reads celldata through an immer draft without drafting cells", () => {
    const base = { sheet: { celldata: [{ r: 0, c: 1, v: { v: "a" } }] } };
    produce(base, (d) => {
      const data = expandCellData(d.sheet, 1, 1);
      expect(data[0][1]).toBe(base.sheet.celldata[0].v);
    });
  });
});
