import type { NamespaceOutlineTranslation } from "../../i18n-types";

const pl = {
  toolbar: {
    outline: "Grupowanie i konspekt",
  },
  menu: {
    group: "Grupuj",
    ungroup: "Rozgrupuj",
    showDetail: "Pokaż szczegóły",
    hideDetail: "Ukryj szczegóły",
    autoOutline: "Autokonspekt",
    clearOutline: "Wyczyść konspekt",
    subtotal: "Sumy częściowe…",
    settings: "Ustawienia konspektu…",
  },
  groupDialog: {
    group: "Grupuj",
    ungroup: "Rozgrupuj",
    rows: "Wiersze",
    columns: "Kolumny",
  },
  errors: {
    maxLevel: "Nie można grupować: konspekt może mieć najwyżej 8 poziomów.",
    notGrouped: "Nie można rozgrupować: zaznaczenie nie jest zgrupowane.",
    noAutoOutline:
      "Nie można utworzyć konspektu: żadne formuły podsumowujące (np. SUM lub SUBTOTAL) nie odwołują się do sąsiednich wierszy lub kolumn.",
    noDetail: "Zaznaczenie nie należy do grupy.",
  },
  subtotal: {
    title: "Suma częściowa",
    atEachChange: "Dla każdej zmiany w:",
    useFunction: "Użyj funkcji:",
    addTo: "Dodaj sumę częściową do:",
    replace: "Zastąp bieżące sumy częściowe",
    pageBreaks: "Podział strony między grupami",
    summaryBelow: "Podsumowanie poniżej danych",
    removeAll: "Usuń wszystko",
    ok: "OK",
    cancel: "Anuluj",
    column: "Kolumna {name}",
    noData:
      "Zaznacz listę z wierszem nagłówka i co najmniej jednym wierszem danych, a następnie spróbuj ponownie.",
    noColumns:
      "Wybierz co najmniej jedną kolumnę, do której chcesz dodać sumę częściową.",
    tooManyLevels:
      "Nie można dodać sum częściowych: konspekt może mieć najwyżej 8 poziomów.",
    tooManyRows:
      "Nie można dodać sum częściowych: arkusz miałby zbyt wiele wierszy.",
    functions: {
      sum: "Suma",
      count: "Licznik",
      average: "Średnia",
      max: "Maksimum",
      min: "Minimum",
      product: "Produkt",
      countNums: "Licznik liczb",
      stdDev: "Odchylenie standardowe próby",
      stdDevp: "Odchylenie standardowe populacji",
      var: "Wariancja próby",
      varp: "Wariancja populacji",
    },
    labels: {
      sum: "Suma",
      count: "Licznik",
      average: "Średnia",
      max: "Maksimum",
      min: "Minimum",
      product: "Produkt",
      countNums: "Licznik",
      stdDev: "Odchylenie standardowe próby",
      stdDevp: "Odchylenie standardowe populacji",
      var: "Wariancja próby",
      varp: "Wariancja populacji",
    },
    groupLabel: "{value} {label}",
    grandLabel: "{label} łącznie",
  },
  settings: {
    title: "Ustawienia konspektu",
    direction: "Kierunek",
    summaryBelow: "Wiersze podsumowania poniżej szczegółów",
    summaryRight: "Kolumny podsumowania po prawej stronie szczegółów",
    ok: "OK",
    cancel: "Anuluj",
  },
  gutter: {
    level: "Pokaż poziom konspektu {level}",
    expand: "Rozwiń grupę (wiersze {from}–{to})",
    collapse: "Zwiń grupę (wiersze {from}–{to})",
    expandColumns: "Rozwiń grupę (kolumny {from}–{to})",
    collapseColumns: "Zwiń grupę (kolumny {from}–{to})",
  },
} as const satisfies NamespaceOutlineTranslation;

export default pl;
