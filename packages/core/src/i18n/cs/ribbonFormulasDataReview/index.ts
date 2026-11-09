import type { NamespaceRibbonFormulasDataReviewTranslation } from "../../i18n-types";

const cs = {
  formulas: {
    insertFunction: "Vložit funkci",
    insertFunctionShortcut: "Shift+F3",
    insertFunctionTip:
      "Pracujte se vzorcem v aktuální buňce. Vyberte funkci a získejte pomoc s vyplněním jejích argumentů.",
    insertFunctionMenu: "Vložit funkci…",
    autoSum: "Automatické shrnutí",
    autoSumShortcut: "Alt+=",
    autoSumTip:
      "Automaticky to sečíst. Váš součet se zobrazí po vybraných buňkách.",
    sum: "Součet",
    average: "Průměr",
    countNumbers: "Počet čísel",
    max: "Maximum",
    min: "Minimum",
    moreFunctions: "Další funkce…",
    recentlyUsed: "Nedávno použité",
    recentlyUsedTip:
      "Procházení a výběr ze seznamu naposledy použitých funkcí.",
    financial: "Finanční",
    financialTip: "Procházejte a vybírejte ze seznamu finančních funkcí.",
    logical: "Logické",
    logicalTip: "Procházet a vybírat ze seznamu logických funkcí.",
    text: "Text",
    textTip: "Procházení a výběr ze seznamu textových funkcí.",
    dateTime: "Datum a čas",
    dateTimeTip: "Procházejte a vybírejte ze seznamu funkcí data a času.",
    lookup: "Vyhledávací a referenční",
    lookupTip:
      "Procházet a vybírat ze seznamu vyhledávacích a referenčních funkcí.",
    math: "Matematické a trigonometrické",
    mathTip:
      "Procházejte a vybírejte ze seznamu matematických a trigonometrických funkcí.",
    more: "Více funkcí",
    moreTip:
      "Procházet a vybírat ze seznamů statistických, inženýrských, informačních a dalších funkcí.",
    statistical: "Statistické",
    engineering: "Technické",
    information: "Informační",
    compatibility: "Kompatibilita",
    web: "Web",
    database: "Databáze",
    allFunctions: "Vše",
    functionsLabel: "Funkce: {category}",
    functionHint: "Ukažte na funkci, abyste viděli, co dělá.",
    nameManager: "Správce názvů",
    nameManagerShortcut: "Ctrl+F3",
    nameManagerTip:
      "Vytvářejte, upravujte, odstraňujte a vyhledávejte názvy používané v sešitu.",
    defineName: "Definovat název",
    defineNameTip:
      "Pojmenujte buňky, abyste mohli tento název použít ve vzorcích místo odkazů na buňky.",
    useInFormula: "Použití ve vzorci",
    useInFormulaTip:
      "Vyberte název použitý v tomto sešitu a vložte jej do aktuálního vzorce.",
    noNames: "Nejsou definovány žádné názvy",
    createFromSelection: "Vytvořit z výběru",
    createFromSelectionShortcut: "Ctrl+Shift+F3",
    createFromSelectionTip:
      "Automaticky generovat názvy z vybraných buněk pomocí textu v horním řádku nebo ve sloupci zcela vlevo.",
    tracePrecedentsTip:
      "Zobrazit šipky, které označují, které buňky ovlivňují hodnotu vybrané buňky.",
    traceDependentsTip:
      "Zobrazit šipky, které označují, které buňky jsou ovlivněny hodnotou vybrané buňky.",
    removeArrowsTip:
      "Odstranit šipky zobrazené příkazy Předchůdci a Následníci.",
    showFormulasShortcut: "Ctrl+`",
    showFormulasTip: "Zobrazit vzorec v každé buňce místo výsledné hodnoty.",
    errorCheckingTip:
      "Zkontrolujte běžné chyby, které se vyskytují ve vzorcích.",
    errorCheckingMenu: "Kontrola chyb…",
    noErrors: "Kontrola chyb byla dokončena pro celý list.",
    circularReferences: "Cyklické odkazy",
    evaluateFormulaTip:
      "Ladění složitého vzorce, vyhodnocování každé části jednotlivě.",
    watchWindowTip:
      "Monitorování hodnot určitých buněk při provádění změn v listu. Hodnoty se zobrazí v podokně vedle mřížky.",
    calculationOptionsTip:
      "Zvolte, zda chcete vzorce vypočítat automaticky nebo ručně.",
    calculateNowShortcut: "F9",
    calculateNowTip: "Vypočítejte nyní celý sešit.",
    calculateSheetShortcut: "Shift+F9",
    calculateSheetTip: "Vypočítejte aktuální list nyní.",
  },
  data: {
    sortAsc: "Seřadit od A do Z",
    sortAscTip: "Seřadit od nejnižší po nejvyšší.",
    sortDesc: "Seřadit od Z do A",
    sortDescTip: "Seřadit od nejvyšší po nejnižší.",
    sort: "Seřadit",
    sortTip:
      "V dialogu Seřadit můžete data seřadit podle více kritérií najednou.",
    filter: "Filtr",
    filterShortcut: "Ctrl+Shift+L",
    filterTip:
      "Zapnout filtrování pro vybrané buňky. Poté kliknutím na šipku v záhlaví sloupce zúžit data.",
    clear: "Vymazat",
    clearTip: "Vymažte stav filtru a řazení pro aktuální rozsah dat.",
    reapply: "Znovu použít",
    reapplyShortcut: "Ctrl+Alt+L",
    reapplyTip: "Znovu použijte filtr a seřaďte v aktuálním rozsahu.",
    advanced: "Pokročilé",
    advancedTip: "Filtr s komplexními kritérii z řady buněk.",
    textToColumns: "Text do sloupců",
    textToColumnsTip:
      "Rozdělte jeden sloupec textu do více sloupců, například jména a příjmení.",
    flashFill: "Dynamické vyplňování",
    flashFillShortcut: "Ctrl+E",
    flashFillTip:
      "Automaticky vyplnit hodnoty. Zadejte několik příkladů požadovaného výstupu a ponechte aktivní buňku ve sloupci, který chcete vyplnit.",
    removeDuplicates: "Odebrat duplicity",
    removeDuplicatesTip: "Odstranit duplicitní řádky z listu.",
    dataValidation: "Ověření dat",
    dataValidationTip:
      "Vyberte ze seznamu pravidel pro omezení typu dat, která lze zadávat do buňky.",
    dataValidationMenu: "Ověření dat…",
    circleInvalid: "Zakroužkovat neplatná data",
    clearCircles: "Vymazat kroužky ověřování",
    validationRules: "Panel ověřovacích pravidel",
    whatIf: "Citlivostní analýza",
    whatIfTip:
      "Vyzkoušejte různé hodnoty pro vzorce v listu: Hledání cíle najde správný vstup pro požadovanou hodnotu, tabulka dat ukazuje výsledky několika vstupů najednou.",
    goalSeek: "Hledání řešení…",
    dataTable: "Tabulka dat…",
    recalcDataTables: "Přepočítat tabulky dat",
    group: "Seskupit",
    groupShortcut: "Shift+Alt+→",
    groupTip:
      "Spojte řadu řádků nebo sloupců dohromady tak, aby je bylo možné sbalit nebo rozšířit.",
    groupMenu: "Seskupit…",
    autoOutline: "Automatický přehled",
    ungroup: "Zrušit seskupení",
    ungroupShortcut: "Shift+Alt+←",
    ungroupTip:
      "Zrušte seskupení rozsahu řádků nebo sloupců, které byly seskupeny.",
    ungroupMenu: "Zrušit seskupení…",
    clearOutline: "Vymazat osnovu",
    subtotal: "Souhrn",
    subtotalTip:
      "Sečte několik řádků souvisejících dat dohromady automatickým vložením mezisoučtů a součtů pro vybrané buňky.",
    showDetail: "Zobrazit podrobnosti",
    showDetailTip: "Rozbalte sbalenou skupinu buněk.",
    hideDetail: "Skrýt podrobnosti",
    hideDetailTip: "Sbalte skupinu buněk.",
    outlineSettings: "Nastavení osnovy…",
  },
  review: {
    newComment: "Nový komentář",
    newCommentShortcut: "Ctrl+Shift+F2",
    newCommentTip:
      "Zahájit konverzaci o vybrané buňce. Odpovědi zůstávají ve stejném vlákně.",
    delete: "Odstranit",
    deleteTip: "Smazat vybraný komentář.",
    previous: "Předchozí",
    previousTip: "Přejít na předchozí komentář v sešitu.",
    next: "Další",
    nextTip: "Přejít na další komentář v sešitu.",
    showComments: "Zobrazit komentáře",
    showCommentsTip:
      "Zobrazit všechny komentáře sešitu v podokně vedle mřížky.",
    notes: "Poznámky",
    notesTip:
      "Přidat rychlou poznámku do vybrané buňky nebo zobrazit a skrýt poznámky.",
    newNote: "Nová poznámka",
    newNoteShortcut: "Shift+F2",
    editNote: "Upravit poznámku",
    deleteNote: "Smazat poznámku",
    previousNote: "Předchozí poznámka",
    nextNote: "Další poznámka",
    showHideNote: "Zobrazit/skrýt poznámku",
    showAllNotes: "Zobrazit všechny poznámky",
    convertToComments: "Převést na komentáře",
    convertConfirm:
      "Převést všechny poznámky tohoto listu na komentáře s vlákny? Převedené poznámky jsou odstraněny.",
    protectSheet: "Zamknout list",
    unprotectSheet: "Odemknout list",
    protectSheetTip:
      "Zabraňte nechtěným změnám omezením toho, co mohou ostatní upravovat. Můžete například zabránit úpravám nebo formátování buněk.",
    unprotectSheetTip: "Znovu povolit změny v chráněném listu.",
    protectWorkbook: "Chránit sešit",
    unprotectWorkbook: "Odemknout sešit",
    protectWorkbookTip:
      "Zabránit ostatním v provádění změn ve struktuře sešitu, jako je přidávání, odstraňování nebo skrývání listů.",
    allowEditRanges: "Povolit úpravy rozsahů",
    allowEditRangesTip:
      "Vyberte rozsahy, které mohou lidé upravovat, když je list chráněn, volitelně heslem.",
  },
  insertFunction: {
    title: "Vložit funkci",
    search: "Vyhledání funkce",
    searchPlaceholder: "Zadejte název funkce nebo požadovanou činnost",
    category: "Kategorie",
    functions: "Vyberte funkci",
    noMatch: "Vašemu vyhledávání neodpovídá žádná funkce.",
    ok: "Vložit",
    cancel: "Zrušit",
    mostRecentlyUsed: "Naposledy použité",
  },
  file: {
    newDescription: "Vytvořit prázdný sešit",
    openDescription: "Otevřete soubor .xlsx nebo .csv z tohoto zařízení",
    saveAsDescription: "Stáhněte si kopii tohoto sešitu",
    saveAsXlsxDescription: "Pracovní sešit se vzorci, formátováním a listy",
    saveAsCsvDescription: "Pouze hodnoty aktuálního listu",
    printDescription: "Náhled a tisk sešitu",
  },
} as const satisfies NamespaceRibbonFormulasDataReviewTranslation;

export default cs;
