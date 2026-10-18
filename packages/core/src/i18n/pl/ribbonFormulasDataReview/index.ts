import type { NamespaceRibbonFormulasDataReviewTranslation } from "../../i18n-types";

const pl = {
  formulas: {
    insertFunction: "Wstaw funkcję",
    insertFunctionShortcut: "Shift+F3",
    insertFunctionTip:
      "Work with the formula in the current cell. Pick a function and get help filling in its arguments.",
    insertFunctionMenu: "Insert Function…",
    autoSum: "Autosumowanie",
    autoSumShortcut: "Alt+=",
    autoSumTip:
      "Automatically add it up. Your total will appear after the selected cells.",
    sum: "Suma",
    average: "Średnia",
    countNumbers: "Count Numbers",
    max: "Maksimum",
    min: "Minimum",
    moreFunctions: "More Functions…",
    recentlyUsed: "Recently Used",
    recentlyUsedTip:
      "Browse and select from a list of recently used functions.",
    financial: "Financial",
    financialTip: "Browse and select from a list of financial functions.",
    logical: "Logical",
    logicalTip: "Browse and select from a list of logical functions.",
    text: "Tekst",
    textTip: "Browse and select from a list of text functions.",
    dateTime: "Data i godzina",
    dateTimeTip: "Browse and select from a list of date and time functions.",
    lookup: "Lookup & Reference",
    lookupTip:
      "Browse and select from a list of lookup and reference functions.",
    math: "Math & Trig",
    mathTip:
      "Browse and select from a list of math and trigonometry functions.",
    more: "More Functions",
    moreTip:
      "Browse and select from lists of statistical, engineering, information and more functions.",
    statistical: "Statistical",
    engineering: "Engineering",
    information: "Information",
    compatibility: "Compatibility",
    web: "Web",
    database: "Database",
    allFunctions: "Wszystko",
    functionsLabel: "{category} functions",
    functionHint: "Point to a function to see what it does.",
    nameManager: "Menedżer nazw",
    nameManagerShortcut: "Ctrl+F3",
    nameManagerTip:
      "Create, edit, delete and find all the names used in the workbook.",
    defineName: "Define Name",
    defineNameTip:
      "Name cells so you can use that name in formulas instead of cell references.",
    useInFormula: "Use in Formula",
    useInFormulaTip:
      "Choose a name used in this workbook and insert it into the current formula.",
    noNames: "No names defined",
    createFromSelection: "Create from Selection",
    createFromSelectionShortcut: "Ctrl+Shift+F3",
    createFromSelectionTip:
      "Automatically generate names from the selected cells, using the text in the top row or the leftmost column.",
    tracePrecedentsTip:
      "Show arrows that indicate which cells affect the value of the selected cell.",
    traceDependentsTip:
      "Show arrows that indicate which cells are affected by the value of the selected cell.",
    removeArrowsTip:
      "Remove the arrows drawn by Trace Precedents or Trace Dependents.",
    showFormulasShortcut: "Ctrl+`",
    showFormulasTip:
      "Display the formula in each cell instead of the resulting value.",
    errorCheckingTip: "Check for common errors that occur in formulas.",
    errorCheckingMenu: "Error Checking…",
    noErrors: "The error check has been completed for the entire sheet.",
    circularReferences: "Circular References",
    evaluateFormulaTip:
      "Debug a complex formula, evaluating each part individually.",
    watchWindowTip:
      "Monitor the values of certain cells as changes are made to the sheet. The values show in a pane beside the grid.",
    calculationOptionsTip:
      "Choose to calculate formulas automatically or manually.",
    calculateNowShortcut: "F9",
    calculateNowTip: "Calculate the entire workbook now.",
    calculateSheetShortcut: "Shift+F9",
    calculateSheetTip: "Calculate the current sheet now.",
  },
  data: {
    sortAsc: "Sort A to Z",
    sortAscTip: "Sort lowest to highest.",
    sortDesc: "Sort Z to A",
    sortDescTip: "Sort highest to lowest.",
    sort: "Sortuj",
    sortTip: "Sort data by several criteria at once in the Sort dialog.",
    filter: "Filtr",
    filterShortcut: "Ctrl+Shift+L",
    filterTip:
      "Turn on filtering for the selected cells. Then click the arrow in the column header to narrow down the data.",
    clear: "Wyczyść",
    clearTip: "Clear the filter and sort state for the current range of data.",
    reapply: "Reapply",
    reapplyShortcut: "Ctrl+Alt+L",
    reapplyTip: "Reapply the filter and sort in the current range.",
    advanced: "Zaawansowane",
    advancedTip: "Filter with complex criteria from a range of cells.",
    textToColumns: "Tekst jako kolumny",
    textToColumnsTip:
      "Split a single column of text into multiple columns, for example first and last names.",
    flashFill: "Wypełnianie błyskawiczne",
    flashFillShortcut: "Ctrl+E",
    flashFillTip:
      "Automatically fill in values. Enter a couple of examples of the output you want and keep the active cell in the column you want filled in.",
    removeDuplicates: "Usuń duplikaty",
    removeDuplicatesTip: "Delete duplicate rows from a sheet.",
    dataValidation: "Sprawdzanie poprawności danych",
    dataValidationTip:
      "Pick from a list of rules to limit the type of data that can be entered in a cell.",
    dataValidationMenu: "Data Validation…",
    circleInvalid: "Circle Invalid Data",
    clearCircles: "Clear Validation Circles",
    validationRules: "Validation Rules Pane",
    whatIf: "Analiza warunkowa",
    whatIfTip:
      "Try out various values for the formulas in the sheet: Goal Seek finds the right input for the value you want, a Data Table shows the results of several inputs at once.",
    goalSeek: "Szukaj wyniku…",
    dataTable: "Tabela danych…",
    recalcDataTables: "Przelicz tabele danych",
    group: "Grupuj",
    groupShortcut: "Shift+Alt+→",
    groupTip:
      "Tie a range of rows or columns together so they can be collapsed or expanded.",
    groupMenu: "Group…",
    autoOutline: "Auto Outline",
    ungroup: "Rozgrupuj",
    ungroupShortcut: "Shift+Alt+←",
    ungroupTip: "Ungroup a range of rows or columns that were grouped.",
    ungroupMenu: "Ungroup…",
    clearOutline: "Clear Outline",
    subtotal: "Subtotal",
    subtotalTip:
      "Total several rows of related data together by automatically inserting subtotals and totals for the selected cells.",
    showDetail: "Show Detail",
    showDetailTip: "Expand a collapsed group of cells.",
    hideDetail: "Hide Detail",
    hideDetailTip: "Collapse a group of cells.",
    outlineSettings: "Outline Settings…",
  },
  review: {
    newComment: "New Comment",
    newCommentShortcut: "Ctrl+Shift+F2",
    newCommentTip:
      "Start a conversation about the selected cell. Replies stay in the same thread.",
    delete: "Usuń",
    deleteTip: "Delete the selected comment.",
    previous: "Poprzedni",
    previousTip: "Go to the previous comment in the workbook.",
    next: "Dalej",
    nextTip: "Go to the next comment in the workbook.",
    showComments: "Show Comments",
    showCommentsTip:
      "See all the comments of the workbook in a pane beside the grid.",
    notes: "Notatki",
    notesTip: "Add a quick note to the selected cell, or show and hide notes.",
    newNote: "New Note",
    newNoteShortcut: "Shift+F2",
    editNote: "Edytuj notatkę",
    deleteNote: "Delete Note",
    previousNote: "Previous Note",
    nextNote: "Next Note",
    showHideNote: "Show/Hide Note",
    showAllNotes: "Show All Notes",
    convertToComments: "Convert to Comments",
    convertConfirm:
      "Convert all notes of this sheet to threaded comments? Converted notes are removed.",
    protectSheet: "Protect Sheet",
    unprotectSheet: "Unprotect Sheet",
    protectSheetTip:
      "Prevent unwanted changes by limiting what others can edit. For example, you can keep cells from being edited or formatted.",
    unprotectSheetTip: "Allow changes to the protected sheet again.",
    protectWorkbook: "Protect Workbook",
    unprotectWorkbook: "Unprotect Workbook",
    protectWorkbookTip:
      "Prevent others from making changes to the structure of the workbook, such as adding, deleting or hiding sheets.",
    allowEditRanges: "Allow Edit Ranges",
    allowEditRangesTip:
      "Choose ranges that people can edit when the sheet is protected, optionally with a password.",
  },
  insertFunction: {
    title: "Wstaw funkcję",
    search: "Search for a function",
    searchPlaceholder: "Type a name or what you want to do",
    category: "Kategoria",
    functions: "Select a function",
    noMatch: "No function matches your search.",
    ok: "Wstawianie",
    cancel: "Anuluj",
    mostRecentlyUsed: "Most Recently Used",
  },
  file: {
    newDescription: "Start a blank workbook",
    openDescription: "Open an .xlsx or .csv file from this device",
    saveAsDescription: "Download a copy of this workbook",
    saveAsXlsxDescription: "Workbook with formulas, formatting and sheets",
    saveAsCsvDescription: "Values of the current sheet only",
    printDescription: "Preview and print the workbook",
  },
} as const satisfies NamespaceRibbonFormulasDataReviewTranslation;

export default pl;
