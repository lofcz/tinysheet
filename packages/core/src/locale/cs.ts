/*
 * Czech: the strings an embedded grid shows with the toolbar, formula bar and
 * sheet tabs off (validation and read-only messages, the add-rows bar, screen
 * reader hints). Everything else falls back to English key by key.
 */
export default {
  generalDialog: {
    partiallyError: "Tuto operaci nelze provést na částečně sloučených buňkách",
    readOnlyError: "Tuto operaci nelze provést v režimu jen pro čtení",
    dataNullError: "Tuto operaci nelze provést s neexistujícími daty",
    noSeletionError: "Nejprve vyberte buňky",
    cannotSelectMultiple: "Nelze vybrat více oblastí",
  },
  info: {
    loading: "Načítání…",
    add: "Přidat",
    addLast: "řádků na konec",
    backTop: "Zpět nahoru",
    sheetIsFocused: "Zaměření na list zapnuto.",
    sheetNotFocused: "Zaměření na list vypnuto.",
    sheetSrIntro:
      "Zaměření na list přepnete klávesami Shift, Control, F.",
    currentCellInput: "Obsah buňky",
    Dropdown: "Rozbalovací seznam",
    toggleSheetFocusShortcut: "Zaměření na list: Shift, Control, F.",
    selectRangeShortcut: "Výběr oblasti: Shift a šipky.",
    autoFillDownShortcut: "Vyplnit dolů z první buňky: Control nebo Meta, D.",
    autoFillRightShortcut: "Vyplnit doprava z první buňky: Control nebo Meta, R.",
    boldTextShortcut: "Tučné písmo: Control nebo Meta, B.",
    copyShortcut: "Kopírovat: Control nebo Meta, C.",
    pasteShortcut: "Vložit: Control nebo Meta, V.",
    undoShortcut: "Zpět: Control nebo Meta, Z.",
    redoShortcut: "Znovu: Control nebo Meta, Shift, Z.",
    deleteCellContentShortcut: "Smazat obsah buňky: Delete nebo Backspace.",
    confirmCellEditShortcut: "Potvrdit a přejít dolů: Enter.",
    moveRightShortcut: "Doprava: Tab.",
    moveLeftShortcut: "Doleva: Shift, Tab.",
    shortcuts: "Klávesové zkratky",
  },
};
