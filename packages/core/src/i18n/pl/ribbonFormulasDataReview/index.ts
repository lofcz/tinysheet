import type { NamespaceRibbonFormulasDataReviewTranslation } from "../../i18n-types";

const pl = {
  formulas: {
    insertFunction: "Wstaw funkcję",
    insertFunctionShortcut: "Shift+F3",
    insertFunctionTip:
      "Pracuj z formułą w bieżącej komórce. Wybierz funkcję i uzyskaj pomoc w uzupełnieniu jej argumentów.",
    insertFunctionMenu: "Wstaw funkcję…",
    autoSum: "Autosumowanie",
    autoSumShortcut: "Alt+=",
    autoSumTip:
      "Dodaj automatycznie. Twoja suma pojawi się po wybranych komórkach.",
    sum: "Suma",
    average: "Średnia",
    countNumbers: "Licznik liczb",
    max: "Maksimum",
    min: "Minimum",
    moreFunctions: "Więcej funkcji…",
    recentlyUsed: "Ostatnio używane",
    recentlyUsedTip:
      "Przeglądaj i wybieraj z listy ostatnio używanych funkcji.",
    financial: "Finansowe",
    financialTip: "Przeglądaj i wybieraj z listy funkcji finansowych.",
    logical: "Logiczne",
    logicalTip: "Przeglądaj i wybieraj z listy funkcji logicznych.",
    text: "Tekst",
    textTip: "Przeglądaj i wybieraj z listy funkcji tekstowych.",
    dateTime: "Data i godzina",
    dateTimeTip: "Przeglądaj i wybieraj z listy funkcji daty i czasu.",
    lookup: "Wyszukiwania i odwołań",
    lookupTip:
      "Przeglądaj i wybieraj z listy funkcji wyszukiwania i referencji.",
    math: "Matematyczne i trygonometryczne",
    mathTip:
      "Przeglądaj i wybieraj z listy funkcji matematycznych i trygonometrycznych.",
    more: "Więcej funkcji",
    moreTip:
      "Przeglądaj i wybieraj z list funkcji statystycznych, inżynieryjnych, informacyjnych i innych.",
    statistical: "Statystyczne",
    engineering: "Inżynierskie",
    information: "Informacyjne",
    compatibility: "Kompatybilność",
    web: "Sieć",
    database: "Baza danych",
    allFunctions: "Wszystko",
    functionsLabel: "Funkcje: {category}",
    functionHint: "Wskaż funkcję, aby zobaczyć, co robi.",
    nameManager: "Menedżer nazw",
    nameManagerShortcut: "Ctrl+F3",
    nameManagerTip:
      "Twórz, edytuj, usuwaj i wyszukuj nazwy używane w skoroszycie.",
    defineName: "Definiuj nazwę",
    defineNameTip:
      "Nazwij komórki, aby móc używać tej nazwy w formułach zamiast odwołań do komórek.",
    useInFormula: "Zastosowanie we wzorze",
    useInFormulaTip:
      "Wybierz nazwę używaną w tym skoroszycie i wstaw ją do aktualnej formuły.",
    noNames: "Nie zdefiniowano żadnych nazw",
    createFromSelection: "Utwórz z zaznaczenia",
    createFromSelectionShortcut: "Ctrl+Shift+F3",
    createFromSelectionTip:
      "Automatycznie generuj nazwy z wybranych komórek, korzystając z tekstu w górnym wierszu lub w lewej kolumnie.",
    tracePrecedentsTip:
      "Pokaż strzałki wskazujące, które komórki wpływają na wartość wybranej komórki.",
    traceDependentsTip:
      "Pokaż strzałki wskazujące, na które komórki wpływa wartość wybranej komórki.",
    removeArrowsTip:
      "Usuń strzałki wyświetlone przez polecenia Śledź poprzedniki i Śledź zależności.",
    showFormulasShortcut: "Ctrl+`",
    showFormulasTip:
      "Wyświetl formułę w każdej komórce zamiast wartości wynikowej.",
    errorCheckingTip: "Sprawdź typowe błędy występujące we wzorach.",
    errorCheckingMenu: "Błąd podczas sprawdzania…",
    noErrors: "Kontrola błędów została zakończona dla całego arkusza.",
    circularReferences: "Odwołania cykliczne",
    evaluateFormulaTip:
      "Debuguj złożoną formułę, oceniając każdą część indywidualnie.",
    watchWindowTip:
      "Monitoruj wartości niektórych komórek podczas wprowadzania zmian w arkuszu. Wartości są wyświetlane w panelu obok siatki.",
    calculationOptionsTip: "Wybierz automatyczne lub ręczne obliczanie formuł.",
    calculateNowShortcut: "F9",
    calculateNowTip: "Oblicz teraz cały skoroszyt.",
    calculateSheetShortcut: "Shift+F9",
    calculateSheetTip: "Oblicz teraz aktualny arkusz.",
  },
  data: {
    sortAsc: "Sortuj od A do Z",
    sortAscTip: "Sortuj od najniższego do najwyższego.",
    sortDesc: "Sortuj Z do A",
    sortDescTip: "Sortuj od najwyższego do najniższego.",
    sort: "Sortuj",
    sortTip:
      "W oknie Sortowanie możesz sortować dane według wielu kryteriów jednocześnie.",
    filter: "Filtr",
    filterShortcut: "Ctrl+Shift+L",
    filterTip:
      "Włącz filtrowanie dla wybranych komórek. Następnie kliknij strzałkę w nagłówku kolumny, aby zawęzić dane.",
    clear: "Wyczyść",
    clearTip: "Wyczyść stan filtra i sortowania dla bieżącego zakresu danych.",
    reapply: "Zastosuj ponownie",
    reapplyShortcut: "Ctrl+Alt+L",
    reapplyTip: "Zastosuj ponownie filtr i posortuj w bieżącym zakresie.",
    advanced: "Zaawansowane",
    advancedTip: "Filtruj według złożonych kryteriów z zakresu komórek.",
    textToColumns: "Tekst jako kolumny",
    textToColumnsTip:
      "Podziel pojedynczą kolumnę tekstu na wiele kolumn, na przykład imię i nazwisko.",
    flashFill: "Wypełnianie błyskawiczne",
    flashFillShortcut: "Ctrl+E",
    flashFillTip:
      "Automatycznie uzupełnij wartości. Wprowadź kilka przykładów żądanych wyników i pozostaw aktywną komórkę w kolumnie, którą chcesz wypełnić.",
    removeDuplicates: "Usuń duplikaty",
    removeDuplicatesTip: "Usuń zduplikowane wiersze z arkusza.",
    dataValidation: "Sprawdzanie poprawności danych",
    dataValidationTip:
      "Wybierz z listy reguł ograniczających typ danych, które można wprowadzić w komórce.",
    dataValidationMenu: "Walidacja danych…",
    circleInvalid: "Zakreśl nieprawidłowe dane",
    clearCircles: "Wyczyść kółka zakreślenia",
    validationRules: "Okienko Reguły walidacji",
    whatIf: "Analiza warunkowa",
    whatIfTip:
      "Wypróbuj różne wartości formuł w arkuszu: Wyszukiwanie wyniku znajduje odpowiednie dane wejściowe dla żądanej wartości, tabela danych pokazuje wyniki kilku danych wejściowych jednocześnie.",
    goalSeek: "Szukaj wyniku…",
    dataTable: "Tabela danych…",
    recalcDataTables: "Przelicz tabele danych",
    group: "Grupuj",
    groupShortcut: "Shift+Alt+→",
    groupTip:
      "Powiąż ze sobą zakres wierszy lub kolumn, aby można je było zwinąć lub rozwinąć.",
    groupMenu: "Grupuj…",
    autoOutline: "Autokonspekt",
    ungroup: "Rozgrupuj",
    ungroupShortcut: "Shift+Alt+←",
    ungroupTip:
      "Rozgrupuj zakres wierszy lub kolumn, które zostały zgrupowane.",
    ungroupMenu: "Rozgrupuj…",
    clearOutline: "Wyczyść konspekt",
    subtotal: "Suma częściowa",
    subtotalTip:
      "Zsumuj kilka wierszy powiązanych danych, automatycznie wstawiając podsumy i sumy dla wybranych komórek.",
    showDetail: "Pokaż szczegóły",
    showDetailTip: "Rozwiń zwiniętą grupę komórek.",
    hideDetail: "Ukryj szczegóły",
    hideDetailTip: "Zwija grupę komórek.",
    outlineSettings: "Ustawienia konspektu…",
  },
  review: {
    newComment: "Nowy komentarz",
    newCommentShortcut: "Ctrl+Shift+F2",
    newCommentTip:
      "Rozpocznij rozmowę na temat wybranej komórki. Odpowiedzi pozostają w tym samym wątku.",
    delete: "Usuń",
    deleteTip: "Usuń wybrany komentarz.",
    previous: "Poprzedni",
    previousTip: "Przejdź do poprzedniego komentarza w skoroszycie.",
    next: "Dalej",
    nextTip: "Przejdź do następnego komentarza w skoroszycie.",
    showComments: "Pokaż komentarze",
    showCommentsTip:
      "Zobacz wszystkie komentarze skoroszytu w panelu obok siatki.",
    notes: "Notatki",
    notesTip:
      "Dodaj szybką notatkę do wybranej komórki lub pokaż i ukryj notatki.",
    newNote: "Nowa notatka",
    newNoteShortcut: "Shift+F2",
    editNote: "Edytuj notatkę",
    deleteNote: "Usuń notatkę",
    previousNote: "Poprzednia notatka",
    nextNote: "Następna notatka",
    showHideNote: "Pokaż/ukryj notatkę",
    showAllNotes: "Pokaż wszystkie notatki",
    convertToComments: "Konwertuj na komentarze",
    convertConfirm:
      "Zamienić wszystkie notatki tego arkusza na komentarze z wątkami? Przekonwertowane notatki są usuwane.",
    protectSheet: "Chroń arkusz",
    unprotectSheet: "Nie chroń arkusza",
    protectSheetTip:
      "Zapobiegaj niechcianym zmianom, ograniczając to, co inni mogą edytować. Można na przykład uniemożliwić edycję lub formatowanie komórek.",
    unprotectSheetTip: "Zezwól ponownie na zmiany w chronionym arkuszu.",
    protectWorkbook: "Chroń skoroszyt",
    unprotectWorkbook: "Nie chroń skoroszytu",
    protectWorkbookTip:
      "Uniemożliwiaj innym wprowadzanie zmian w strukturze skoroszytu, takich jak dodawanie, usuwanie lub ukrywanie arkuszy.",
    allowEditRanges: "Zezwól na edycję zakresów",
    allowEditRangesTip:
      "Wybierz zakresy, które użytkownicy będą mogli edytować, gdy arkusz będzie chroniony, opcjonalnie hasłem.",
  },
  insertFunction: {
    title: "Wstaw funkcję",
    search: "Wyszukaj funkcję",
    searchPlaceholder: "Wpisz nazwę funkcji lub czynność, którą chcesz wykonać",
    category: "Kategoria",
    functions: "Wybierz funkcję",
    noMatch: "Żadna funkcja nie pasuje do Twojego wyszukiwania.",
    ok: "Wstawianie",
    cancel: "Anuluj",
    mostRecentlyUsed: "Ostatnio używane",
  },
  file: {
    newDescription: "Utwórz pusty skoroszyt",
    openDescription: "Otwórz plik .xlsx lub .csv z tego urządzenia",
    saveAsDescription: "Pobierz kopię tego skoroszytu",
    saveAsXlsxDescription: "Skoroszyt z formułami, formatowaniem i arkuszami",
    saveAsCsvDescription: "Tylko wartości bieżącego arkusza",
    printDescription: "Podgląd i wydruk skoroszytu",
  },
} as const satisfies NamespaceRibbonFormulasDataReviewTranslation;

export default pl;
