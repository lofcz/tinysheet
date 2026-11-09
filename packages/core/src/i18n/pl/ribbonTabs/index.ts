import type { NamespaceRibbonTabsTranslation } from "../../i18n-types";

const pl = {
  insert: {
    pivotTable: "Tabela przestawna",
    pivotTableTip: "Uporządkuj i podsumuj złożone dane w tabeli przestawnej.",
    table: "Tabela",
    tableTip:
      "Utwórz tabelę do organizowania i analizowania powiązanych danych. Tabele z łatwością sortują, filtrują i formatują dane.",
    pictures: "Obrazy",
    picturesTip: "Wstaw obrazki w komórce lub nad komórkami arkusza.",
    placeInCell: "Umieść w komórce",
    placeOverCells: "Umieść nad komórkami",
    thisDevice: "To urządzenie…",
    fromWeb: "Z adresu internetowego…",
    shapes: "Kształty",
    shapesTip:
      "Wstawiaj gotowe kształty, takie jak koła, kwadraty i strzałki. Wybierz jeden, a następnie przeciągnij po arkuszu, aby go narysować.",
    screenshot: "Zrzut ekranu",
    screenshotTip: "Zrób zdjęcie wybranych komórek.",
    recommendedCharts: "Polecane wykresy",
    recommendedChartsTip:
      "Chcesz, żebyśmy polecili dobry wykres do zaprezentowania Twoich danych? Wybierz dane w arkuszu i kliknij ten przycisk.",
    chartColumn: "Wstaw wykres kolumnowy lub słupkowy",
    chartColumnTip:
      "Ten typ wykresu służy do wizualnego porównywania wartości w kilku kategoriach.",
    chartLine: "Wstaw wykres liniowy lub warstwowy",
    chartLineTip:
      "Ten typ wykresu służy do pokazywania trendów w czasie (lata, miesiące i dni) lub kategorii.",
    chartPie: "Wstaw wykres kołowy lub pączkowy",
    chartPieTip:
      "Ten typ wykresu służy do pokazywania proporcji całości. Użyj go, gdy suma twoich liczb wynosi 100%.",
    chartScatter: "Wstaw wykres punktowy (X, Y) lub bąbelkowy",
    chartScatterTip:
      "Ten typ wykresu służy do pokazywania relacji pomiędzy zestawami wartości.",
    chartOther:
      "Wstaw wykres kaskadowy, statystyczny, giełdowy, radarowy lub kombi",
    chartOtherTip:
      "Użyj tych typów wykresów, aby pokazać sumy bieżące, rozkłady, dane giełdowe, kilka miar lub serie mieszane.",
    moreCharts: "Więcej wykresów…",
    galleryGroups: {
      column2d: "Kolumnowy 2-W",
      bar2d: "Słupkowy 2-W",
      line2d: "Liniowy 2-W",
      area2d: "Warstwowy 2-W",
      pie2d: "Kołowy 2-W",
      doughnut: "Pierścieniowy",
      scatter: "Punktowy",
      bubble: "Bąbelkowy",
      statistic: "Statystyka",
      waterfall: "Wodospad i lejek",
      stock: "Giełdowy",
      radar: "Radarowy",
      combo: "Kombi",
    },
    sparkLine: "Linia",
    sparkLineTip: "Wstaw wykres liniowy w pojedynczej komórce.",
    sparkColumn: "Kolumna",
    sparkColumnTip: "Wstawianie wykresu kolumnowego w pojedynczej komórce.",
    sparkWinLoss: "Zysk/strata",
    sparkWinLossTip:
      "Wstaw wykres wygranych/przegranych w pojedynczej komórce.",
    slicer: "Fragmentator",
    slicerTip:
      "Użyj fragmentatora do wizualnego filtrowania danych. Fragmentatory ułatwiają i przyspieszają filtrowanie tabel.",
    link: "Łącze",
    linkTip:
      "Utwórz łącze w swoim dokumencie, aby uzyskać szybki dostęp do stron internetowych i innych miejsc w skoroszycie.",
    comment: "Komentarz",
    commentTip: "Rozpocznij rozmowę na temat wybranej komórki.",
    note: "Notatka",
    noteTip: "Dodaj notatkę dotyczącą wybranej komórki.",
    editNote: "Edytuj notatkę",
    textBox: "Pole tekstowe",
    textBoxTip: "Narysuj pole tekstowe w dowolnym miejscu arkusza.",
    headerFooter: "Nagłówek i stopka",
    headerFooterTip:
      "Edytuj nagłówek lub stopkę strony. Nagłówek i stopka pojawiają się u góry i u dołu każdej drukowanej strony.",
    checkbox: "Pole wyboru",
    checkboxTip:
      "Wstaw checkboxy w zaznaczonych komórkach. Zaznaczone jest TRUE, niezaznaczone to FALSE.",
    removeCheckbox: "Usuń checkboxy z wybranych komórek.",
  },
  chartDialog: {
    title: "Wstaw wykres",
    recommended: "Polecane wykresy",
    all: "Wszystkie wykresy",
    ok: "OK",
    cancel: "Anuluj",
    preview: "Podgląd",
    noData: "Zaznacz dane do wykresu i spróbuj ponownie.",
    families: {
      column: "Kolumna",
      line: "Linia",
      pie: "Kołowy",
      bar: "Słupkowy",
      area: "Warstwowy",
      scatter: "XY (punktowy)",
      stock: "Giełdowy",
      radar: "Radarowy",
      histogram: "Histogram",
      waterfall: "Kaskadowy",
      funnel: "Lejkowy",
      combo: "Kombi",
    },
    descriptions: {
      columnClustered:
        "Grupowany wykres kolumnowy służy do porównywania wartości w kilku kategoriach. Użyj go, gdy kolejność kategorii nie jest istotna.",
      columnStacked:
        "Skumulowany wykres kolumnowy służy do porównywania części całości. Użyj go, aby pokazać, jak zmienia się suma w różnych kategoriach.",
      columnPercent:
        "Wykres kolumnowy skumulowany 100% porównuje procentowy udział każdej wartości w sumie we wszystkich kategoriach.",
      barClustered:
        "Wykres słupkowy grupowany porównuje wartości kilku kategorii. Sprawdza się przy długich nazwach kategorii.",
      barStacked:
        "Skumulowany wykres słupkowy służy do porównywania części całości w kategoriach o długich nazwach.",
      barPercent:
        "Wykres słupkowy skumulowany 100% porównuje procentowy udział każdej wartości w całości.",
      line: "Wykres liniowy służy do wyświetlania trendów w czasie (lata, miesiące i dni) lub kategorii, gdy ważna jest kolejność.",
      lineMarkers:
        "Wykres liniowy ze znacznikami służy do wyświetlania trendów, gdy jest tylko kilka punktów danych.",
      lineStacked:
        "Skumulowany wykres liniowy pokazuje, jak każda część przyczynia się do sumy w czasie.",
      area: "Wykres warstwowy służy do wyświetlania trendów w czasie lub kategorii oraz do zwrócenia uwagi na wartość całkowitą.",
      areaStacked:
        "Skumulowany wykres warstwowy pokazuje trend udziału każdej wartości w czasie.",
      areaPercent:
        "Wykres warstwowy skumulowany 100% pokazuje trend procentowy udziału każdej wartości w czasie.",
      pie: "Wykres kołowy służy do pokazania proporcji całości. Użyj go dla pojedynczej serii, której wartości sumują się.",
      doughnut:
        "Wykres pierścieniowy przedstawia udziały w całości podobnie jak kołowy, z miejscem na etykietę pośrodku.",
      scatter:
        "Wykres punktowy służy do porównywania par wartości i pokazywania związku pomiędzy dwiema zmiennymi.",
      scatterLines:
        "Wykres punktowy z liniami łączy punkty w kolejności wartości X.",
      bubble:
        "Wykres bąbelkowy dodaje trzeci wymiar do wykresu punktowego: rozmiar każdego bąbelka.",
      histogram:
        "Histogram przedstawia rozkład danych: liczbę wartości w poszczególnych przedziałach.",
      pareto:
        "Wykres Pareto porządkuje przedziały histogramu malejąco i dodaje linię sumy skumulowanej.",
      waterfall:
        "Wykres kaskadowy przedstawia sumę bieżącą w miarę dodawania lub odejmowania wartości.",
      funnel:
        "Wykres lejkowy przedstawia wartości na etapach procesu, np. rurociągu sprzedaży.",
      stockHLC:
        "Wykres giełdowy maksimum–minimum–zamknięcie pokazuje zmiany cen akcji. Wymaga trzech serii: ceny maksymalnej, minimalnej i zamknięcia.",
      stockOHLC:
        "Wykres giełdowy otwarcie–maksimum–minimum–zamknięcie wymaga czterech serii: ceny otwarcia, maksymalnej, minimalnej i zamknięcia.",
      radar:
        "Wykres radarowy porównuje wartości kilku serii według różnych miar.",
      radarMarkers:
        "Wykres radarowy ze znacznikami porównuje kilka serii według różnych miar.",
      radarFilled:
        "Wypełniony wykres radarowy porównuje obszar zajmowany przez każdą serię według różnych miar.",
      comboColumnLine:
        "Wykres kombi wyróżnia różne rodzaje informacji: pierwszą serię pokazuje jako kolumny, a pozostałe jako linie.",
      comboColumnLineSecondary:
        "Wykres kombi z osią pomocniczą porównuje serie, których wartości znacznie się różnią pod względem wielkości.",
      comboAreaColumn:
        "Wykres kombi warstwowy i kolumnowy pokazuje całość wraz z jej częściami.",
    },
  },
  pageLayout: {
    margins: "Marginesy",
    marginsTip:
      "Ustaw rozmiary marginesów arkusza. Aby zastosować określone rozmiary marginesów, wybierz opcję Marginesy niestandardowe.",
    customMargins: "Marginesy niestandardowe…",
    marginDetails: "Góra: {top} Dół: {bottom} Lewa: {left} Prawa: {right}",
    lastCustom: "Ostatnie ustawienie niestandardowe",
    orientation: "Orientacja",
    orientationTip: "Przełączanie stron pomiędzy układem pionowym i poziomym.",
    size: "Rozmiar",
    sizeTip: "Wybierz rozmiar papieru dla arkusza.",
    moreSizes: "Więcej rozmiarów papieru…",
    printArea: "Obszar wydruku",
    printAreaTip: "Zaznacz konkretny obszar arkusza do druku.",
    breaks: "Podziały stron",
    breaksTip:
      "Dodaj podział strony w miejscu, w którym chcesz rozpoczynać następną stronę. Przerwa zostanie wstawiona powyżej i po lewej stronie zaznaczenia.",
    printTitles: "Tytuły wydruku",
    printTitlesTip:
      "Określ wiersze i kolumny, które mają być powtarzane na każdej drukowanej stronie, np. etykiety i nagłówki.",
    pageSetup: "Ustawienia strony…",
    pageSetupTip:
      "Wyświetl okno dialogowe Ustawienia strony: strona, marginesy, nagłówek i stopka oraz opcje arkusza.",
    printPreview: "Podgląd wydruku",
    printPreviewTip: "Podgląd wydrukowanych stron i wydrukowanie ich.",
    width: "Szerokość",
    widthTip:
      "Zmniejsz szerokość wydruku tak, aby zmieścił się na maksymalnej liczbie stron.",
    height: "Wysokość",
    heightTip:
      "Zmniejsz wysokość wydruku tak, aby zmieścił się na maksymalnej liczbie stron.",
    scale: "Dopasuj",
    scaleTip:
      "Rozciągnij lub zmniejsz wydruk do określonej wartości procentowej jego rzeczywistego rozmiaru. Szerokość i Wysokość muszą być ustawione na Automatycznie.",
    automatic: "Automatycznie",
    pages: "Liczba stron: {n}",
    onePage: "1 strona",
    gridlines: "Linie siatki",
    headings: "Nagłówki",
    view: "Widok",
    print: "Drukuj",
    gridlinesViewTip:
      "Pokaż linie pomiędzy wierszami i kolumnami, aby ułatwić edycję i czytanie.",
    gridlinesPrintTip: "Wydrukuj linie pomiędzy wierszami i kolumnami.",
    headingsViewTip:
      "Pokaż nagłówki wierszy i kolumn: numery wierszy po lewej stronie, litery kolumn u góry.",
    headingsPrintTip: "Wydrukuj nagłówki wierszy i kolumn.",
  },
  view: {
    normal: "Normalny",
    normalTip: "Wyświetl arkusz w widoku normalnym.",
    pageBreakPreview: "Podgląd podziału stron",
    pageBreakPreviewTip:
      "Zobacz podziały stron wydruku arkusza. Przeciągnij podział, aby go przesunąć.",
    pageLayout: "Układ strony",
    pageLayoutTip:
      "Zobacz jak będzie wyglądać wydrukowany arkusz: strony oraz miejsce ich rozpoczęcia i zakończenia.",
    gridlines: "Linie siatki",
    gridlinesTip:
      "Pokaż linie pomiędzy wierszami i kolumnami, aby ułatwić edycję i czytanie.",
    formulaBar: "Pasek formuły",
    formulaBarTip:
      "Wyświetla pasek formuły, w którym wpisuje się tekst i formuły do ​​komórek.",
    headings: "Nagłówki",
    headingsTip:
      "Pokaż nagłówki wierszy i kolumn: numery wierszy po lewej stronie, litery kolumn u góry.",
    zoom: "Powiększenie",
    zoomTip:
      "Otwórz okno dialogowe Zoom, aby określić stopień powiększenia arkusza.",
    zoom100: "100%",
    zoom100Tip: "Powiększ arkusz do 100% normalnego rozmiaru.",
    zoomToSelection: "Powiększ zaznaczenie",
    zoomToSelectionTip:
      "Powiększ arkusz tak, aby wybrane komórki wypełniały całe okno.",
    zoomTitle: "Powiększenie",
    magnification: "Powiększenie",
    fitSelection: "Dopasuj do zaznaczenia",
    custom: "Niestandardowe:",
    ok: "OK",
    cancel: "Anuluj",
    freezePanes: "Zablokuj okienka",
    freezePanesTip:
      "Część arkusza powinna być widoczna podczas przewijania reszty arkusza.",
    freezePanesItem:
      "Zachowaj widoczność wierszy i kolumn podczas przewijania reszty arkusza (w oparciu o bieżący wybór).",
    unfreezePanes: "Odblokuj okienka",
    unfreezePanesItem:
      "Odblokuj wszystkie wiersze i kolumny, aby przewijać cały arkusz.",
    freezeTopRow: "Zablokuj górny wiersz",
    freezeTopRowItem:
      "Zachowaj widoczność górnego wiersza podczas przewijania pozostałej części arkusza.",
    freezeFirstColumn: "Zablokuj pierwszą kolumnę",
    freezeFirstColumnItem:
      "Zachowaj widoczność pierwszej kolumny podczas przewijania pozostałej części arkusza.",
    split: "Rozdziel",
    splitTip:
      "Podział okna na okienka, z których każdy przewija się osobno. Kliknij ponownie, aby usunąć podział.",
    theme: "Motyw",
    themeTip:
      "Wybierz wygląd skoroszytu: jasny, ciemny lub podobny do systemu.",
    light: "Jasny",
    dark: "Ciemny",
    system: "Systemowy",
    themeCurrent: "Motyw: {theme}",
  },
} as const satisfies NamespaceRibbonTabsTranslation;

export default pl;
