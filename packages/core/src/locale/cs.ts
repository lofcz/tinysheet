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
  },
};
