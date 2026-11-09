import type { NamespaceFormulaAuditTranslation } from "../../i18n-types";

const pl = {
  auditing: {
    menu: "Inspekcja formuł",
    tracePrecedents: "Śledź poprzedniki",
    traceDependents: "Śledź zależności",
    removeArrows: "Usuń strzałki",
    removePrecedentArrows: "Usuń strzałki poprzedników",
    removeDependentArrows: "Usuń strzałki zależności",
    showFormulas: "Pokaż formuły",
    evaluateFormula: "Szacuj formułę",
    watchWindow: "Okno czujki",
    addWatch: "Dodaj czujkę",
    noFormula: "Aktywna komórka nie zawiera formuły z prawidłowym odwołaniem.",
    noDependents: "Żadna formuła nie odwołuje się do aktywnej komórki.",
    otherSheet: "Odwołanie do innego arkusza",
  },
  calc: {
    options: "Opcje obliczania",
    automatic: "Automatycznie",
    automaticExceptTables: "Automatycznie z wyjątkiem tabel danych",
    manual: "Ręcznie",
    calculateNow: "Oblicz teraz",
    calculateSheet: "Oblicz arkusz",
    calculateFull: "Oblicz wszystko ponownie",
    iterativeSettings: "Obliczanie iteracyjne…",
    workbookCalculation: "Obliczenia skoroszytu",
    enableIterative: "Włącz obliczanie iteracyjne",
    maxIterations: "Maksymalna liczba iteracji:",
    maxChange: "Maksymalna zmiana:",
    calculate: "Oblicz",
    calculateHint:
      "Formuły oczekują na obliczenie. Kliknij tutaj lub naciśnij F9.",
    circularReferences: "Odwołania cykliczne",
    circularWarning:
      "Skoroszyt zawiera co najmniej jedno odwołanie cykliczne: formuła odwołuje się bezpośrednio lub pośrednio do własnej komórki. Może to powodować nieprawidłowe wyniki obliczeń. Usuń lub zmień te odwołania albo przenieś formuły do innych komórek.",
    ok: "OK",
    cancel: "Anuluj",
  },
  evaluate: {
    title: "Szacuj formułę",
    reference: "Odwołanie:",
    evaluation: "Szacowanie:",
    evaluate: "Szacuj",
    restart: "Restartuj",
    stepIn: "Wkrocz",
    stepOut: "Wyjdź",
    close: "Zamknij",
    hint: "Aby wyświetlić wynik podkreślonego wyrażenia, kliknij Szacuj. Ostatni wynik jest wyświetlany kursywą.",
    noFormula: "Aktywna komórka nie zawiera formuły.",
  },
  watch: {
    title: "Okno czujki",
    addWatch: "Dodaj czujkę…",
    deleteWatch: "Usuń czujkę",
    book: "Skoroszyt",
    sheet: "Arkusz",
    name: "Nazwa",
    cell: "Komórka",
    value: "Wartość",
    formula: "Wzór",
    bookName: "Skoroszyt1",
    empty:
      "Zaznacz komórki i kliknij Dodaj czujkę, aby obserwować ich wartości.",
    close: "Zamknij",
  },
  errors: {
    checking: "Sprawdzanie błędów",
    options: "Opcje sprawdzania błędów…",
    tagLabel: "Opcje sprawdzania błędów",
    enable: "Włącz sprawdzanie błędów w tle",
    rulesTitle: "Reguły sprawdzania błędów",
    resetIgnored: "Resetuj ignorowane błędy",
    rules: {
      evaluationError:
        "Komórki zawierające formuły, których wynikiem jest błąd",
      inconsistentFormula: "Formuły niespójne z innymi formułami w obszarze",
      omitsCells: "Formuły pomijające komórki w obszarze",
      unlockedFormula: "Odblokowane komórki zawierające formuły",
      emptyCellRef: "Formuły odwołujące się do pustych komórek",
      numberAsText: "Liczby sformatowane jako tekst lub poprzedzone apostrofem",
    },
    titles: {
      evaluationError: "Błąd wartości",
      inconsistentFormula: "Niespójna formuła",
      omitsCells: "Formuła pomija sąsiednie komórki",
      unlockedFormula: "Niechroniona formuła",
      emptyCellRef: "Formuła odwołuje się do pustych komórek",
      numberAsText: "Liczba zapisana jako tekst",
    },
    details: {
      evaluationError: "Wartość użyta w formule ma nieprawidłowy typ.",
      inconsistentFormula:
        "Formuła w tej komórce różni się od formuł w otaczającym obszarze arkusza.",
      omitsCells:
        "Formuła w tej komórce odwołuje się do zakresu, obok którego znajdują się dodatkowe liczby.",
      unlockedFormula:
        "Formuła w tej komórce nie jest zablokowana przed przypadkowymi zmianami.",
      emptyCellRef: "Formuła w tej komórce odwołuje się do pustych komórek.",
      numberAsText:
        "Liczba w tej komórce jest sformatowana jako tekst lub poprzedzona apostrofem.",
    },
    convertToNumber: "Konwertuj na liczbę",
    copyFromAbove: "Kopiuj formułę z góry",
    copyFromLeft: "Kopiuj formułę z lewej",
    includeCells: "Uwzględnij komórki w formule",
    lockCell: "Zablokuj komórkę",
    traceError: "Śledź błąd",
    ignore: "Ignoruj błąd",
  },
} as const satisfies NamespaceFormulaAuditTranslation;

export default pl;
