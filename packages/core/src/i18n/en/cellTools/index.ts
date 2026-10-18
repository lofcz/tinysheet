import type { BaseTranslation } from "typesafe-i18n";

const en = {
  toolbar: {
    checkbox: "Checkbox",
    dataTools: "Data tools",
    flashFill: "Flash Fill",
    flashFillShortcut: "Ctrl+E",
    advancedFilter: "Advanced Filter…",
    clearAdvancedFilter: "Clear Advanced Filter",
    whatIf: "What-If Analysis",
    goalSeek: "Goal Seek…",
    dataTable: "Data Table…",
    recalcDataTables: "Recalculate Data Tables",
  },
  checkbox: {
    insert: "Insert checkboxes",
    remove: "Remove checkboxes",
  },
  flashFill: {
    filled: "Flash Fill: {count} cells changed",
    filledOne: "Flash Fill: 1 cell changed",
    noPattern:
      "Flash Fill couldn't find a pattern. Type a few more examples next to your data, then try again.",
    noData:
      "Select a cell in the column to fill, next to the data, after typing an example.",
    undo: "Undo",
  },
  goalSeek: {
    title: "Goal Seek",
    setCell: "Set cell",
    toValue: "To value",
    changingCell: "By changing cell",
    ok: "OK",
    cancel: "Cancel",
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
    title: "Data Table",
    rowInput: "Row input cell",
    colInput: "Column input cell",
    hint: "Select the whole table first: input values in the first row and/or column, formulas next to them.",
    ok: "OK",
    cancel: "Cancel",
    errInput: "Enter a valid row or column input cell.",
    errTooSmall: "Select a range of at least two rows and two columns.",
    errInputInTable: "The input cell can't be inside the table.",
    errOverlap: "The selection overlaps another data table.",
    partError: "Cannot change part of a data table.",
  },
  advancedFilter: {
    title: "Advanced Filter",
    action: "Action",
    inPlace: "Filter the list, in-place",
    copy: "Copy to another location",
    listRange: "List range",
    criteriaRange: "Criteria range",
    copyTo: "Copy to",
    unique: "Unique records only",
    ok: "OK",
    cancel: "Cancel",
    clear: "Clear",
    errList:
      "The list range must be a range with a header row and at least one record.",
    errCriteria:
      "The criteria range must have a label row and at least one condition row.",
    errCopyTo:
      "The copy-to reference is invalid, names a column the list doesn't have, or doesn't fit the sheet.",
    errOverlap: "The copy-to range can't overlap the list range.",
    result: "{matched} of {total} records found.",
  },
} as const satisfies BaseTranslation;

export default en;
