import type { NamespaceCellToolsTranslation } from "../../i18n-types";

const pl = {
  toolbar: {
    checkbox: "Pole wyboru",
    dataTools: "Narzędzia danych",
    flashFill: "Wypełnianie błyskawiczne",
    flashFillShortcut: "Ctrl+E",
    advancedFilter: "Filtr zaawansowany…",
    clearAdvancedFilter: "Wyczyść filtr zaawansowany",
    whatIf: "Analiza warunkowa",
    goalSeek: "Szukaj wyniku…",
    dataTable: "Tabela danych…",
    recalcDataTables: "Przelicz tabele danych",
  },
  checkbox: {
    insert: "Wstaw pola wyboru",
    remove: "Usuń pola wyboru",
  },
  flashFill: {
    filled: "Wypełnianie błyskawiczne: liczba zmienionych komórek: {count}",
    filledOne: "Wypełnianie błyskawiczne: zmieniono 1 komórkę",
    noPattern:
      "Wypełnianie błyskawiczne nie znalazło wzorca. Wpisz obok danych kilka dodatkowych przykładów i spróbuj ponownie.",
    noData:
      "Po wpisaniu przykładu zaznacz komórkę w kolumnie obok danych, którą chcesz wypełnić.",
    undo: "Cofnij",
  },
  goalSeek: {
    title: "Szukaj wyniku",
    setCell: "Ustaw komórkę",
    toValue: "Wartość",
    changingCell: "Zmieniana komórka",
    ok: "OK",
    cancel: "Anuluj",
    statusTitle: "Stan szukania wyniku",
    found: "Znaleziono rozwiązanie podczas szukania wyniku dla komórki {cell}.",
    notFound:
      "Szukanie wyniku dla komórki {cell} mogło nie znaleźć rozwiązania.",
    targetValue: "Wartość docelowa",
    currentValue: "Bieżąca wartość",
    iterations: "Iteracje",
    errSetCell: "Ustawiana komórka musi zawierać formułę.",
    errSetCellRef: "Ustawiana komórka musi być odwołaniem do jednej komórki.",
    errChangingCell:
      "Zmieniana komórka musi być pojedynczą komórką zawierającą wartość, a nie formułę.",
    errValue: "Wprowadź liczbę jako wartość docelową.",
  },
  dataTable: {
    title: "Tabela danych",
    rowInput: "Komórka wejściowa wiersza",
    colInput: "Komórka wejściowa kolumny",
    hint: "Najpierw zaznacz całą tabelę: wartości wejściowe w pierwszym wierszu lub kolumnie oraz formuły obok nich.",
    ok: "OK",
    cancel: "Anuluj",
    errInput: "Wprowadź prawidłową komórkę wejściową wiersza lub kolumny.",
    errTooSmall:
      "Zaznacz zakres obejmujący co najmniej dwa wiersze i dwie kolumny.",
    errInputInTable:
      "Komórka wejściowa nie może znajdować się wewnątrz tabeli.",
    errOverlap: "Zaznaczenie nakłada się na inną tabelę danych.",
    partError: "Nie można zmienić części tabeli danych.",
  },
  advancedFilter: {
    title: "Filtr zaawansowany",
    action: "Akcja",
    inPlace: "Filtruj listę na miejscu",
    copy: "Kopiuj w inne miejsce",
    listRange: "Zakres listy",
    criteriaRange: "Zakres kryteriów",
    copyTo: "Kopiuj do",
    unique: "Tylko unikatowe rekordy",
    ok: "OK",
    cancel: "Anuluj",
    clear: "Wyczyść",
    errList:
      "Zakres listy musi zawierać wiersz nagłówka i co najmniej jeden rekord.",
    errCriteria:
      "Zakres kryteriów musi zawierać wiersz etykiet i co najmniej jeden wiersz warunków.",
    errCopyTo:
      "Odwołanie docelowe jest nieprawidłowe, wskazuje kolumnę nieobecną na liście lub wykracza poza arkusz.",
    errOverlap: "Zakres docelowy nie może nakładać się na zakres listy.",
    result: "Znaleziono {matched} z {total} rekordów.",
  },
} as const satisfies NamespaceCellToolsTranslation;

export default pl;
