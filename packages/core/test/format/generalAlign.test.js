import { normalizedCellAttr } from "../../src/modules/cell";

describe("General horizontal alignment", () => {
  test.each([
    [{ v: 1, ct: { fa: "General", t: "n" } }, "2"],
    [{ v: 45366, ct: { fa: "m/d/yyyy", t: "d" } }, "2"],
    [{ v: 3 }, "2"],
    [{ v: true, ct: { fa: "General", t: "b" } }, "0"],
    [{ v: "#N/A", ct: { fa: "General", t: "e" } }, "0"],
    [{ v: "text", ct: { fa: "General", t: "g" } }, "1"],
    [{ v: "007", ct: { fa: "@", t: "s" } }, "1"],
    [{ v: "3" }, "1"],
    [null, "1"],
  ])("%j aligns %s", (cell, ht) => {
    expect(normalizedCellAttr(cell, "ht")).toBe(ht);
  });

  test("an explicit alignment wins", () => {
    expect(normalizedCellAttr({ v: 1, ht: 1, ct: { t: "n" } }, "ht")).toBe("1");
    expect(normalizedCellAttr({ v: "a", ht: "2" }, "ht")).toBe("2");
  });
});
