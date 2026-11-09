import type { NamespaceRibbonFormulasDataReviewTranslation } from "../../i18n-types";

const sk = {
  formulas: {
    insertFunction: "Vložiť funkciu",
    insertFunctionShortcut: "Shift+F3",
    insertFunctionTip:
      "Pracujte so vzorcom v aktuálnej bunke. Vyberte funkciu a získajte pomoc s vyplnením jej argumentov.",
    insertFunctionMenu: "Vložiť funkciu…",
    autoSum: "Automatický súčet",
    autoSumShortcut: "Alt+=",
    autoSumTip:
      "Automaticky to sčítať. Váš súčet sa zobrazí po vybratých bunkách.",
    sum: "Súčet",
    average: "Priemer",
    countNumbers: "Počet čísel",
    max: "Maximum",
    min: "Minimum",
    moreFunctions: "Ďalšie funkcie…",
    recentlyUsed: "Nedávno použité",
    recentlyUsedTip:
      "Prehľadávať a vyberať zo zoznamu naposledy použitých funkcií.",
    financial: "Finančné",
    financialTip: "Prehľadávať a vyberať zo zoznamu finančných funkcií.",
    logical: "Logické",
    logicalTip: "Prehľadávať a vyberať zo zoznamu logických funkcií.",
    text: "Text",
    textTip: "Prehľadávať a vyberať zo zoznamu textových funkcií.",
    dateTime: "Dátum a čas",
    dateTimeTip: "Prehľadávať a vyberať zo zoznamu funkcií dátumu a času.",
    lookup: "Vyhľadávacie a referenčné",
    lookupTip:
      "Prehľadávať a vyberať zo zoznamu vyhľadávacích a referenčných funkcií.",
    math: "Matematické a trigonometrické",
    mathTip:
      "Prehľadávať a vyberať zo zoznamu matematických a trigonometrických funkcií.",
    more: "Viac funkcií",
    moreTip:
      "Prehľadávať a vyberať zo zoznamov štatistických, inžinierskych, informačných a ďalších funkcií.",
    statistical: "Štatistické",
    engineering: "Technické",
    information: "Informačné",
    compatibility: "Kompatibilita",
    web: "Web",
    database: "Databáza",
    allFunctions: "Všetko",
    functionsLabel: "Funkcie: {category}",
    functionHint: "Ukážte na funkciu, aby ste videli, čo robí.",
    nameManager: "Správca názvov",
    nameManagerShortcut: "Ctrl+F3",
    nameManagerTip:
      "Vytvárajte, upravujte, odstraňujte a vyhľadávajte názvy používané v zošite.",
    defineName: "Definovať názov",
    defineNameTip:
      "Pomenujte bunky, aby ste tento názov mohli použiť vo vzorcoch namiesto odkazov na bunky.",
    useInFormula: "Použitie vo vzorci",
    useInFormulaTip:
      "Vyberte názov použitý v tomto zošite a vložte ho do aktuálneho vzorca.",
    noNames: "Nie sú definované žiadne názvy",
    createFromSelection: "Vytvoriť z výberu",
    createFromSelectionShortcut: "Ctrl+Shift+F3",
    createFromSelectionTip:
      "Automaticky vygenerovať názvy z vybratých buniek pomocou textu v hornom riadku alebo v stĺpci úplne vľavo.",
    tracePrecedentsTip:
      "Zobraziť šípky, ktoré označujú, ktoré bunky ovplyvňujú hodnotu vybranej bunky.",
    traceDependentsTip:
      "Zobraziť šípky, ktoré označujú, ktoré bunky sú ovplyvnené hodnotou vybranej bunky.",
    removeArrowsTip:
      "Odstrániť šípky zobrazené príkazmi Predchodcovia a Závislé bunky.",
    showFormulasShortcut: "Ctrl+`",
    showFormulasTip:
      "Zobrazte vzorec v každej bunke namiesto výslednej hodnoty.",
    errorCheckingTip:
      "Skontrolujte bežné chyby, ktoré sa vyskytujú vo vzorcoch.",
    errorCheckingMenu: "Kontrola chyby...",
    noErrors: "Kontrola chýb bola dokončená pre celý hárok.",
    circularReferences: "Cyklické odkazy",
    evaluateFormulaTip:
      "Odlaďte komplexný vzorec, pričom každú časť vyhodnotíte individuálne.",
    watchWindowTip:
      "Monitorujte hodnoty určitých buniek, keď sa na hárku vykonajú zmeny. Hodnoty sa zobrazia na table vedľa mriežky.",
    calculationOptionsTip:
      "Vyberte, či chcete vzorce vypočítať automaticky alebo manuálne.",
    calculateNowShortcut: "F9",
    calculateNowTip: "Teraz vypočítajte celý zošit.",
    calculateSheetShortcut: "Shift+F9",
    calculateSheetTip: "Teraz vypočítajte aktuálny list.",
  },
  data: {
    sortAsc: "Zoradiť od A po Z",
    sortAscTip: "Zoradiť od najnižšieho po najvyššie.",
    sortDesc: "Zoradiť Z po A",
    sortDescTip: "Zoradiť od najvyššieho po najnižšie.",
    sort: "Zoradiť",
    sortTip:
      "V dialógu Zoradiť môžete údaje zoradiť podľa viacerých kritérií naraz.",
    filter: "Filtrovať",
    filterShortcut: "Ctrl+Shift+L",
    filterTip:
      "Zapnúť filtrovanie pre vybraté bunky. Potom kliknite na šípku v hlavičke stĺpca, aby ste zúžili údaje.",
    clear: "Vymazať",
    clearTip: "Vymažte filter a stav triedenia pre aktuálny rozsah údajov.",
    reapply: "Znova použiť",
    reapplyShortcut: "Ctrl+Alt+L",
    reapplyTip: "Znovu použite filter a zoraďte v aktuálnom rozsahu.",
    advanced: "Pokročilé",
    advancedTip: "Filter s komplexnými kritériami z radu buniek.",
    textToColumns: "Text na stĺpce",
    textToColumnsTip:
      "Rozdeľte jeden stĺpec textu do viacerých stĺpcov, napríklad mená a priezviská.",
    flashFill: "Dynamické dopĺňanie",
    flashFillShortcut: "Ctrl+E",
    flashFillTip:
      "Automaticky vyplniť hodnoty. Zadajte niekoľko príkladov požadovaného výstupu a ponechajte aktívnu bunku v stĺpci, ktorý chcete vyplniť.",
    removeDuplicates: "Odstrániť duplicity",
    removeDuplicatesTip: "Odstrániť duplicitné riadky z hárka.",
    dataValidation: "Overenie údajov",
    dataValidationTip:
      "Vyberte si zo zoznamu pravidiel na obmedzenie typu údajov, ktoré možno zadať do bunky.",
    dataValidationMenu: "Overenie údajov…",
    circleInvalid: "Zakrúžkovať neplatné údaje",
    clearCircles: "Vymazať krúžky overovania",
    validationRules: "Tabla pravidiel overovania",
    whatIf: "Analýza hypotéz",
    whatIfTip:
      "Vyskúšajte rôzne hodnoty pre vzorce v hárku: Hľadanie cieľa nájde správny vstup pre požadovanú hodnotu, tabuľka údajov zobrazuje výsledky niekoľkých vstupov naraz.",
    goalSeek: "Hľadanie riešenia…",
    dataTable: "Tabuľka údajov…",
    recalcDataTables: "Prepočítať tabuľky údajov",
    group: "Zoskupiť",
    groupShortcut: "Shift+Alt+→",
    groupTip:
      "Spojte rad riadkov alebo stĺpcov dohromady, aby sa dali zbaliť alebo rozbaliť.",
    groupMenu: "Zoskupiť…",
    autoOutline: "Automatický prehľad",
    ungroup: "Zrušiť zoskupenie",
    ungroupShortcut: "Shift+Alt+←",
    ungroupTip:
      "Zrušte zoskupenie rozsahu riadkov alebo stĺpcov, ktoré boli zoskupené.",
    ungroupMenu: "Zrušiť zoskupenie…",
    clearOutline: "Vymazať prehľad",
    subtotal: "Medzisúčet",
    subtotalTip:
      "Spolu niekoľko riadkov súvisiacich údajov automatickým vložením medzisúčtov a súčtov pre vybrané bunky.",
    showDetail: "Zobraziť podrobnosti",
    showDetailTip: "Rozbaľte zbalenú skupinu buniek.",
    hideDetail: "Skryť podrobnosti",
    hideDetailTip: "Zbaľte skupinu buniek.",
    outlineSettings: "Nastavenia prehľadu…",
  },
  review: {
    newComment: "Nový komentár",
    newCommentShortcut: "Ctrl+Shift+F2",
    newCommentTip:
      "Začať konverzáciu o vybranej bunke. Odpovede zostávajú v rovnakom vlákne.",
    delete: "Odstrániť",
    deleteTip: "Odstrániť vybratý komentár.",
    previous: "Predchádzajúci",
    previousTip: "Prejsť na predchádzajúci komentár v zošite.",
    next: "Ďalej",
    nextTip: "Prejsť na ďalší komentár v zošite.",
    showComments: "Zobraziť komentáre",
    showCommentsTip:
      "Pozrite si všetky komentáre zošita na table vedľa mriežky.",
    notes: "Poznámky",
    notesTip:
      "Pridajte rýchlu poznámku do vybranej bunky alebo zobrazte a skryte poznámky.",
    newNote: "Nová poznámka",
    newNoteShortcut: "Shift+F2",
    editNote: "Upraviť poznámku",
    deleteNote: "Vymazať poznámku",
    previousNote: "Predchádzajúca poznámka",
    nextNote: "Ďalšia poznámka",
    showHideNote: "Zobraziť/skryť poznámku",
    showAllNotes: "Zobraziť všetky poznámky",
    convertToComments: "Previesť na komentáre",
    convertConfirm:
      "Previesť všetky poznámky tohto hárku na komentáre s vláknami? Konvertované poznámky sú odstránené.",
    protectSheet: "Zamknúť hárok",
    unprotectSheet: "Odomknúť hárok",
    protectSheetTip:
      "Zabráňte nechceným zmenám obmedzením toho, čo môžu ostatní upravovať. Môžete napríklad zabrániť úpravám alebo formátovaniu buniek.",
    unprotectSheetTip: "Znova povoliť zmeny v chránenom hárku.",
    protectWorkbook: "Ochranný zošit",
    unprotectWorkbook: "Odomknúť zošit",
    protectWorkbookTip:
      "Zabrániť ostatným vo vykonávaní zmien v štruktúre zošita, ako je pridávanie, mazanie alebo skrývanie listov.",
    allowEditRanges: "Povoliť úpravu rozsahov",
    allowEditRangesTip:
      "Vyberte rozsahy, ktoré môžu ľudia upravovať, keď je hárok chránený, voliteľne heslom.",
  },
  insertFunction: {
    title: "Vložiť funkciu",
    search: "Vyhľadajte funkciu",
    searchPlaceholder: "Zadajte názov funkcie alebo požadovanú činnosť",
    category: "Kategória",
    functions: "Vyberte funkciu",
    noMatch: "Vášmu vyhľadávaniu nezodpovedá žiadna funkcia.",
    ok: "Vložiť",
    cancel: "Zrušiť",
    mostRecentlyUsed: "Naposledy použité",
  },
  file: {
    newDescription: "Vytvoriť prázdny zošit",
    openDescription: "Otvorte súbor .xlsx alebo .csv z tohto zariadenia",
    saveAsDescription: "Stiahnite si kópiu tohto zošita",
    saveAsXlsxDescription: "Pracovný zošit so vzorcami, formátovaním a listami",
    saveAsCsvDescription: "Len hodnoty aktuálneho listu",
    printDescription: "Ukážka a tlač zošita",
  },
} as const satisfies NamespaceRibbonFormulasDataReviewTranslation;

export default sk;
