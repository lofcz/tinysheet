import fs from "fs";
import path from "path";
import SUPPORTED_FORMULAS from "../../../src/supported-formulas";

// Functions implemented by core (packages/core/src/modules/formulaFunctions.ts,
// WORKBOOK_FUNCTION_NAMES) rather than by this package.
const CORE_FUNCTIONS = [
  "ISREF",
  "ISFORMULA",
  "FORMULATEXT",
  "INDIRECT",
  "OFFSET",
  "ADDRESS",
  "SHEET",
  "SHEETS",
  "HYPERLINK",
  "CELL",
];

const STATUSES = ["Supported", "Partial", "Missing", "Excluded"];

function readTable() {
  const file = path.resolve(__dirname, "../../../FUNCTIONS.md");
  const rows = [];

  fs.readFileSync(file, "utf8")
    .split("\n")
    .forEach((line) => {
      const m = /^\|\s*([A-Z][A-Z0-9.]*)\s*\|\s*(\w+)\s*\|(.*)\|$/.exec(line);

      if (m) {
        rows.push({ name: m[1], status: m[2], note: m[3].trim() });
      }
    });

  return rows;
}

describe("FUNCTIONS.md coverage table", () => {
  const rows = readTable();
  const known = new Set([...SUPPORTED_FORMULAS, ...CORE_FUNCTIONS]);

  it("lists Excel's functions once each", () => {
    expect(rows.length).toBeGreaterThan(500);
    const names = rows.map((r) => r.name);
    expect(names.filter((n, i) => names.indexOf(n) !== i)).toEqual([]);
  });

  it("uses the documented statuses, with a note unless supported", () => {
    rows.forEach((row) => {
      expect(STATUSES).toContain(row.status);
      if (row.status !== "Supported") {
        expect(row.note.length).toBeGreaterThan(0);
      }
    });
  });

  it("supported and partial functions exist in the engine or core", () => {
    const unknown = rows
      .filter((r) => r.status === "Supported" || r.status === "Partial")
      .filter((r) => !known.has(r.name))
      .map((r) => r.name);

    expect(unknown).toEqual([]);
  });

  it("missing and excluded functions are really not implemented", () => {
    const implemented = rows
      .filter((r) => r.status === "Missing" || r.status === "Excluded")
      .filter((r) => known.has(r.name))
      .map((r) => r.name);

    expect(implemented).toEqual([]);
  });
});
