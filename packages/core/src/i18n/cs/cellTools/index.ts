import type { NamespaceCellToolsTranslation } from "../../i18n-types";

const cs = {
  toolbar: {
    checkbox: "Zaškrtávací políčko",
    dataTools: "Datové nástroje",
    flashFill: "Dynamické vyplňování",
    flashFillShortcut: "Ctrl+E",
    advancedFilter: "Rozšířený filtr…",
    clearAdvancedFilter: "Vymazat rozšířený filtr",
    whatIf: "Citlivostní analýza",
    goalSeek: "Hledání řešení…",
    dataTable: "Tabulka dat…",
    recalcDataTables: "Přepočítat tabulky dat",
  },
  checkbox: {
    insert: "Vložit zaškrtávací políčka",
    remove: "Odstranit zaškrtávací políčka",
  },
  flashFill: {
    filled: "Flash Fill: {count} cells changed",
    filledOne: "Flash Fill: 1 cell changed",
    noPattern:
      "Flash Fill couldn't find a pattern. Type a few more examples next to your data, then try again.",
    noData:
      "Select a cell in the column to fill, next to the data, after typing an example.",
    undo: "Zpět",
  },
  goalSeek: {
    title: "Hledání řešení",
    setCell: "Nastavená buňka",
    toValue: "Cílová hodnota",
    changingCell: "Měněná buňka",
    ok: "OK",
    cancel: "Zrušit",
    statusTitle: "Goal Seek Status",
    found: "Goal Seeking with Cell {cell} found a solution.",
    notFound: "Goal Seeking with Cell {cell} may not have found a solution.",
    targetValue: "Target value",
    currentValue: "Current value",
    iterations: "Iterations",
    errSetCell: "The set cell must contain a formula.",
    errSetCellRef: "The set cell must be a single cell reference.",
    errChangingCell:
      "The changing cell must be a single cell with a value, not a formula.",
    errValue: "Enter a number for the target value.",
  },
  dataTable: {
    title: "Tabulka dat",
    rowInput: "Vstupní buňka řádku",
    colInput: "Vstupní buňka sloupce",
    hint: "Select the whole table first: input values in the first row and/or column, formulas next to them.",
    ok: "OK",
    cancel: "Zrušit",
    errInput: "Enter a valid row or column input cell.",
    errTooSmall: "Select a range of at least two rows and two columns.",
    errInputInTable: "The input cell can't be inside the table.",
    errOverlap: "The selection overlaps another data table.",
    partError: "Cannot change part of a data table.",
  },
  advancedFilter: {
    title: "Advanced Filter",
    action: "Akce",
    inPlace: "Filter the list, in-place",
    copy: "Copy to another location",
    listRange: "List range",
    criteriaRange: "Criteria range",
    copyTo: "Copy to",
    unique: "Unique records only",
    ok: "OK",
    cancel: "Zrušit",
    clear: "Vymazat",
    errList:
      "The list range must be a range with a header row and at least one record.",
    errCriteria:
      "The criteria range must have a label row and at least one condition row.",
    errCopyTo:
      "The copy-to reference is invalid, names a column the list doesn't have, or doesn't fit the sheet.",
    errOverlap: "The copy-to range can't overlap the list range.",
    result: "{matched} of {total} records found.",
  },
} as const satisfies NamespaceCellToolsTranslation;

export default cs;
