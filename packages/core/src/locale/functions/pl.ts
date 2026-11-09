import type { FunctionListTranslation } from "./types";

const translations: FunctionListTranslation[] = [
  {
    n: "ABS",
    d: "Zwraca wartość bezwzględną liczby, czyli liczbę bez jej znaku.",
    a: "Wartość bezwzględna liczby.",
    p: [
      {
        name: "numer",
        detail: "Liczba rzeczywista, której wartość bezwzględną chcesz.",
      },
    ],
  },
  {
    n: "ACCRINT",
    d: "Zwraca naliczone odsetki dla papieru wartościowego, który płaci odsetki okresowe.",
    a: "Odsetki naliczone od papieru wartościowego o oprocentowaniu okresowym.",
    p: [
      {
        name: "data_emisji",
        detail: "Data emisji papieru wartościowego.",
      },
      {
        name: "pierwsze_odsetki",
        detail: "Data pierwszego oprocentowania papieru wartościowego.",
      },
      {
        name: "data_rozrachunku",
        detail:
          "Data rozliczenia papieru wartościowego, przypadająca po dacie emisji, w której papier wartościowy jest przedmiotem obrotu na rzecz kupującego.",
      },
      {
        name: "stawka",
        detail: "Roczna stopa kuponu papieru wartościowego.",
      },
      {
        name: "wartość_nominalna",
        detail:
          "Wartość nominalna papieru wartościowego; domyślnie wynosi 1000 dolarów.",
      },
      {
        name: "częstotliwość",
        detail:
          "Liczba wypłat kuponowych w ciągu roku: 1 roczna, 2 półroczne, 4 kwartalne.",
      },
      {
        name: "podstawa",
        detail:
          "Podstawa liczenia dni: 0 lub pominięty US 30/360, 1 faktyczny/rzeczywisty, 2 rzeczywisty/360, 3 rzeczywisty/365, 4 europejski 30/360.",
      },
      {
        name: "metoda_obliczania",
        detail:
          "TRUE lub pominięte zwraca całkowite odsetki naliczone od emisji do rozliczenia; FALSE od pierwsze_odsetki do rozliczenia.",
      },
    ],
  },
  {
    n: "ACCRINTM",
    d: "Zwraca naliczone odsetki dla papieru wartościowego, który płaci odsetki w terminie zapadalności.",
    a: "Naliczone odsetki od papieru wartościowego płatne w terminie zapadalności.",
    p: [
      {
        name: "data_emisji",
        detail: "Data emisji papieru wartościowego.",
      },
      {
        name: "data_rozrachunku",
        detail: "Termin zapadalności papieru wartościowego.",
      },
      {
        name: "stawka",
        detail: "Roczna stopa kuponu papieru wartościowego.",
      },
      {
        name: "wartość_nominalna",
        detail:
          "Wartość nominalna papieru wartościowego; domyślnie wynosi 1000 dolarów.",
      },
      {
        name: "podstawa",
        detail:
          "Podstawa liczenia dni: 0 lub pominięty US 30/360, 1 faktyczny/rzeczywisty, 2 rzeczywisty/360, 3 rzeczywisty/365, 4 europejski 30/360.",
      },
    ],
  },
  {
    n: "ACOS",
    d: "Zwraca arccosinus (odwrotny cosinus) liczby w radianach z zakresu od 0 do pi.",
    a: "Cosinus odwrotny w radianach.",
    p: [
      {
        name: "numer",
        detail: "Cosinus żądanego kąta; musi wynosić od -1 do 1.",
      },
    ],
  },
  {
    n: "ACOSH",
    d: "Zwraca odwrotny cosinus hiperboliczny liczby.",
    a: "Odwrotny cosinus hiperboliczny.",
    p: [
      {
        name: "numer",
        detail: "Dowolna liczba rzeczywista większa lub równa 1.",
      },
    ],
  },
  {
    n: "ACOT",
    d: "Zwraca główną wartość arccotangens (odwrotny cotangens) liczby w radianach z zakresu od 0 do pi.",
    a: "Odwrotny cotangens w radianach.",
    p: [
      {
        name: "numer",
        detail: "Cotangens żądanego kąta.",
      },
    ],
  },
  {
    n: "ACOTH",
    d: "Zwraca odwrotny kottangens hiperboliczny liczby.",
    a: "Odwrotny kotangens hiperboliczny.",
    p: [
      {
        name: "numer",
        detail: "Liczba, której wartość bezwzględna musi być większa niż 1.",
      },
    ],
  },
  {
    n: "ADDRESS",
    d: "Zwraca adres komórki w arkuszu jako tekst, z podanymi numerami wierszy i kolumn.",
    a: "Adres komórki jako tekst.",
    p: [
      {
        name: "numer_wiersza",
        detail: "Numer wiersza, który ma być użyty w odwołaniu do komórki.",
      },
      {
        name: "nr_kolumny",
        detail: "Numer kolumny, który ma być używany w odwołaniu do komórki.",
      },
      {
        name: "typ_odwołania",
        detail:
          "Rodzaj odniesienia: 1 lub pominięte bezwzględne, 2 bezwzględne wiersze, 3 bezwzględne kolumny, 4 względne.",
      },
      {
        name: "a1",
        detail:
          "TRUE lub pominięty zwraca odwołanie w stylu A1; FALSE zwraca odwołanie w stylu R1C1.",
      },
      {
        name: "tekst_arkusza",
        detail: "Nazwa arkusza, który będzie używany jako odnośnik zewnętrzny.",
      },
    ],
  },
  {
    n: "AGGREGATE",
    d: "Zwraca agregat (taki jak SUM, AVERAGE, COUNT lub LARGE) listy lub bazy danych, z opcjami ignorowania ukrytych wierszy i wartości błędów.",
    a: "Agregat, który może ignorować ukryte wiersze i błędy.",
    p: [
      {
        name: "numer_funkcji",
        detail:
          "Liczba od 1 do 19 wybierająca funkcję: 1 AVERAGE, 2 COUNT, 3 COUNTA, 4 MAX, 5 MIN, 6 PRODUCT, 7 STDEV.S, 8 STDEV.P, 9 SUM, 10 VAR.S, 11 VAR.P, 12 MEDIAN, 13 MODE.SNGL, 14 LARGE, 15 SMALL, 16 PERCENTILE.INC, 17 QUARTILE.INC, 18 PERCENTILE.EXC, 19 QUARTILE.EXC.",
      },
      {
        name: "opcje",
        detail:
          "Które wartości zignorować: 0 lub pominięte zagnieżdżone SUBTOTAL/AGGREGATE, 1 także ukryte wiersze, 2 także wartości błędów, 3 wszystkie, 4 nic, 5 tylko ukrytych wierszy, tylko 6 wartości błędów, 7 ukrytych wierszy i wartości błędów.",
      },
      {
        name: "ref1",
        detail:
          "Pierwszy argument numeryczny lub zakres. W przypadku funkcji od 14 do 19 jest to tablica do obliczenia.",
      },
      {
        name: "ref2",
        detail:
          "Dalsze zakresy do agregacji lub dla funkcji od 14 do 19 wymagany drugi argument k (pozycja lub kwartyl).",
      },
    ],
  },
  {
    n: "AMORDEGRC",
    d: "Zwraca amortyzację dla każdego okresu rozliczeniowego przy użyciu współczynnika amortyzacji (francuski system księgowy).",
    a: "Amortyzacja degresywna w poszczególnych okresach obrachunkowych.",
    p: [
      {
        name: "koszt_początkowy",
        detail: "Koszt środka trwałego.",
      },
      {
        name: "data_zakupu",
        detail: "Data zakupu środka trwałego.",
      },
      {
        name: "pierwszy_okres",
        detail: "Data zakończenia pierwszego okresu.",
      },
      {
        name: "wartość_końcowa",
        detail: "Wartość odzysku na koniec okresu użytkowania środka trwałego.",
      },
      {
        name: "okres",
        detail: "Okres.",
      },
      {
        name: "stawka",
        detail: "Stawka amortyzacji.",
      },
      {
        name: "podstawa",
        detail:
          "Podstawa roku: 0 360 dni, 1 rzeczywisty, 3 365 dni, 4 europejskie 360.",
      },
    ],
  },
  {
    n: "AMORLINC",
    d: "Zwraca amortyzację dla każdego okresu rozliczeniowego (francuski system księgowy, liniowy).",
    a: "Amortyzacja liniowa na okres rozliczeniowy.",
    p: [
      {
        name: "koszt_początkowy",
        detail: "Koszt środka trwałego.",
      },
      {
        name: "data_zakupu",
        detail: "Data zakupu środka trwałego.",
      },
      {
        name: "pierwszy_okres",
        detail: "Data zakończenia pierwszego okresu.",
      },
      {
        name: "wartość_końcowa",
        detail: "Wartość odzysku na koniec okresu użytkowania środka trwałego.",
      },
      {
        name: "okres",
        detail: "Okres.",
      },
      {
        name: "stawka",
        detail: "Stawka amortyzacji.",
      },
      {
        name: "podstawa",
        detail:
          "Podstawa roku: 0 360 dni, 1 rzeczywisty, 3 365 dni, 4 europejskie 360.",
      },
    ],
  },
  {
    n: "AND",
    d: "Zwraca TRUE, jeśli wszystkie jego argumenty mają wartość TRUE i FALSE, jeśli jeden lub więcej argumentów ma wartość FALSE.",
    a: "TRUE jeśli wszystkie argumenty to TRUE.",
    p: [
      {
        name: "logiczne1",
        detail:
          "Pierwszy warunek do przetestowania, który może mieć wartość TRUE lub FALSE.",
      },
      {
        name: "logiczne2",
        detail: "Dodatkowe warunki do przetestowania, łącznie do 255.",
      },
    ],
  },
  {
    n: "ARABIC",
    d: "Konwertuje cyfrę rzymską na liczbę arabską.",
    a: "Konwertuje cyfrę rzymską na liczbę.",
    p: [
      {
        name: "tekst",
        detail:
          "Ciąg znaków w cudzysłowie, pusty ciąg znaków lub odwołanie do komórki zawierającej tekst.",
      },
    ],
  },
  {
    n: "AREAS",
    d: "Zwraca liczbę obszarów w odniesieniu.",
    a: "Liczba obszarów w odnośniku.",
    p: [
      {
        name: "odniesienie",
        detail: "Odniesienie do komórki lub zakresu komórek.",
      },
    ],
  },
  {
    n: "ARRAYTOTEXT",
    d: "Zwraca tablicę wartości tekstowych z dowolnego określonego zakresu.",
    a: "Konwertuje tablicę na tekst.",
    p: [
      {
        name: "tablica",
        detail: "Tablica do zwrócenia jako tekst.",
      },
      {
        name: "formacie",
        detail:
          "0 lub pominięte zwraca zwięzły, łatwy do odczytania format; 1 zwraca ścisły format ze znakami ucieczki i ogranicznikami wierszy, które można analizować jako formułę.",
      },
    ],
  },
  {
    n: "ASC",
    d: "Zmienia znaki o pełnej szerokości (dwubajtowe) na znaki o połowie szerokości (jednobajtowe).",
    a: "Konwertuj na znaki o połowie szerokości.",
    p: [
      {
        name: "tekst",
        detail: "Tekst lub odwołanie do komórki zawierającej tekst do zmiany.",
      },
    ],
  },
  {
    n: "ASIN",
    d: "Zwraca arcusinus (odwrotny sinus) liczby w radianach z zakresu od -pi/2 do pi/2.",
    a: "Odwrotność sinusa w radianach.",
    p: [
      {
        name: "numer",
        detail: "Sinus żądanego kąta; musi wynosić od -1 do 1.",
      },
    ],
  },
  {
    n: "ASINH",
    d: "Zwraca odwrotny sinus hiperboliczny liczby.",
    a: "Odwrotny sinus hiperboliczny.",
    p: [
      {
        name: "numer",
        detail: "Dowolna liczba rzeczywista.",
      },
    ],
  },
  {
    n: "ATAN",
    d: "Zwraca arcus tangens (odwrotny tangens) liczby w radianach z zakresu od -pi/2 do pi/2.",
    a: "Odwrotna tangens w radianach.",
    p: [
      {
        name: "numer",
        detail: "Tangens żądanego kąta.",
      },
    ],
  },
  {
    n: "ATAN2",
    d: "Zwraca arcus tangens określonych współrzędnych x i y, w radianach pomiędzy -pi i pi, z wyłączeniem -pi.",
    a: "Arcus tangens ze współrzędnych x i y.",
    p: [
      {
        name: "liczba_x",
        detail: "Współrzędna x punktu.",
      },
      {
        name: "liczba_y",
        detail: "Współrzędna y punktu.",
      },
    ],
  },
  {
    n: "ATANH",
    d: "Zwraca arcus tangens hiperboliczny liczby.",
    a: "Arcus tangens hiperboliczny.",
    p: [
      {
        name: "numer",
        detail: "Dowolna liczba rzeczywista od -1 do 1, wyłączna.",
      },
    ],
  },
  {
    n: "AVEDEV",
    d: "Zwraca średnią bezwzględnych odchyleń punktów danych od ich średniej.",
    a: "Średnie bezwzględne odchylenie od średniej.",
    p: [
      {
        name: "numer_1",
        detail: "Pierwsza liczba lub zakres.",
      },
      {
        name: "numer2",
        detail: "Dodatkowe numery lub zakresy, łącznie do 255.",
      },
    ],
  },
  {
    n: "AVERAGE",
    d: "Zwraca średnią (arytmetyczną) argumentów, ignorując tekst i wartości logiczne w zakresach.",
    a: "Średnia arytmetyczna liczb.",
    p: [
      {
        name: "numer_1",
        detail:
          "Pierwsza liczba, odwołanie do komórki lub zakres, dla którego chcesz uzyskać średnią.",
      },
      {
        name: "numer2",
        detail: "Dodatkowe numery lub zakresy, łącznie do 255.",
      },
    ],
  },
  {
    n: "AVERAGEA",
    d: "Zwraca średnią argumentów, oceniając tekst jako 0, a wartości logiczne jako 1 lub 0.",
    a: "Średnia zawierająca tekst i wartości logiczne.",
    p: [
      {
        name: "wartość_1",
        detail: "Pierwsza wartość, odwołanie do komórki lub zakres.",
      },
      {
        name: "wartość2",
        detail: "Dodatkowe wartości lub zakresy, łącznie do 255.",
      },
    ],
  },
  {
    n: "AVERAGEIF",
    d: "Zwraca średnią (średnią arytmetyczną) wszystkich komórek w zakresie spełniających dane kryterium.",
    a: "Średnia komórek spełniających warunek.",
    p: [
      {
        name: "zakres",
        detail: "Komórki do testu przeciwko `kryteria`.",
      },
      {
        name: "kryteria",
        detail:
          "Warunek w postaci liczby, wyrażenia, odwołania do komórki lub tekstu, który określa, które komórki są uśredniane.",
      },
      {
        name: "zakres_średniej",
        detail: "Komórki do uśrednienia, jeśli różnią się od `zakres`.",
      },
    ],
  },
  {
    n: "AVERAGEIFS",
    d: "Zwraca średnią (średnią arytmetyczną) wszystkich komórek spełniających wiele kryteriów.",
    a: "Średnia komórek spełniających wiele kryteriów.",
    p: [
      {
        name: "zakres_średniej",
        detail: "Komórki do uśrednienia.",
      },
      {
        name: "zakres_kryteriów1",
        detail: "Zakres testowany przy użyciu `kryteria1`.",
      },
      {
        name: "kryteria1",
        detail:
          "Kryteria definiujące, które komórki w `zakres_kryteriów1` są uwzględnione.",
      },
      {
        name: "zakres_kryteriów2",
        detail:
          "Dodatkowe zakresy do przetestowania, do 127 par zakres/kryteria.",
      },
      {
        name: "kryteria2",
        detail: "Kryteria dla odpowiedniego dodatkowego zakresu.",
      },
    ],
  },
  {
    n: "BAHTTEXT",
    d: 'Konwertuje liczbę na tekst tajski i dodaje przyrostek "Baht".',
    a: "Liczba w formacie bahta tajskiego.",
    p: [
      {
        name: "numer",
        detail: "Liczba do konwersji na tekst.",
      },
    ],
  },
  {
    n: "BASE",
    d: "Konwertuje liczbę na reprezentację tekstową o podanej podstawie.",
    a: "Konwertuje liczbę na tekst w innej bazie.",
    p: [
      {
        name: "numer",
        detail:
          "Liczba do konwersji; liczba całkowita większa lub równa 0 i mniejsza niż 2^53.",
      },
      {
        name: "podstawa_systemu",
        detail: "Baza do przekształcenia; liczba całkowita od 2 do 36.",
      },
      {
        name: "długość_min",
        detail:
          "Minimalna długość zwracanego ciągu znaków, uzupełniona zerami wiodącymi.",
      },
    ],
  },
  {
    n: "BESSELI",
    d: "Zwraca zmodyfikowaną funkcję Bessela In(x), która jest równoważna funkcji Bessela obliczonej dla czysto urojonych argumentów.",
    a: "Zmodyfikowana funkcja Bessela In(x).",
    p: [
      {
        name: "x",
        detail: "Wartość, przy której funkcja ma zostać oszacowana.",
      },
      {
        name: "n",
        detail: "Rząd funkcji Bessela; obcięty do liczby całkowitej.",
      },
    ],
  },
  {
    n: "BESSELJ",
    d: "Zwraca funkcję Bessela Jn(x).",
    a: "Funkcja Bessela Jn(x).",
    p: [
      {
        name: "x",
        detail: "Wartość, przy której funkcja ma zostać oszacowana.",
      },
      {
        name: "n",
        detail: "Rząd funkcji Bessela; obcięty do liczby całkowitej.",
      },
    ],
  },
  {
    n: "BESSELK",
    d: "Zwraca zmodyfikowaną funkcję Bessela Kn(x), która jest równoważna funkcjom Bessela obliczonym dla czysto urojonych argumentów.",
    a: "Zmodyfikowana funkcja Bessela Kn(x).",
    p: [
      {
        name: "x",
        detail: "Wartość, przy której funkcja ma zostać oszacowana.",
      },
      {
        name: "n",
        detail: "Rząd funkcji; obcięty do liczby całkowitej.",
      },
    ],
  },
  {
    n: "BESSELY",
    d: "Zwraca funkcję Bessela Yn(x), zwaną także funkcją Webera lub funkcją Neumanna.",
    a: "Funkcja Bessela Yn(x).",
    p: [
      {
        name: "x",
        detail: "Wartość, przy której funkcja ma zostać oszacowana.",
      },
      {
        name: "n",
        detail: "Rząd funkcji; obcięty do liczby całkowitej.",
      },
    ],
  },
  {
    n: "BETA.DIST",
    d: "Zwraca rozkład beta, powszechnie używany do badania zmienności procentowej czegoś w próbkach.",
    a: "Dystrybucja Beta.",
    p: [
      {
        name: "x",
        detail:
          "Wartość pomiędzy `A` i `B`, przy której funkcja ma zostać obliczona.",
      },
      {
        name: "alfa",
        detail: "Parametr rozkładu.",
      },
      {
        name: "beta",
        detail: "Parametr rozkładu.",
      },
      {
        name: "kumulatywne",
        detail:
          "TRUE zwraca funkcję rozkładu skumulowanego, FALSE funkcję gęstości prawdopodobieństwa.",
      },
      {
        name: "A",
        detail: "Dolna granica przedziału x; domyślnie wynosi 0.",
      },
      {
        name: "B",
        detail: "Górna granica przedziału x; domyślnie 1.",
      },
    ],
  },
  {
    n: "BETA.INV",
    d: "Zwraca odwrotność funkcji skumulowanej gęstości prawdopodobieństwa beta.",
    a: "Odwrotność rozkładu beta.",
    p: [
      {
        name: "prawdopodobieństwo",
        detail: "Prawdopodobieństwo związane z rozkładem beta.",
      },
      {
        name: "alfa",
        detail: "Parametr rozkładu.",
      },
      {
        name: "beta",
        detail: "Parametr rozkładu.",
      },
      {
        name: "A",
        detail: "Dolna granica przedziału x; domyślnie wynosi 0.",
      },
      {
        name: "B",
        detail: "Górna granica przedziału x; domyślnie 1.",
      },
    ],
  },
  {
    n: "BETADIST",
    d: "Zwraca skumulowaną funkcję gęstości prawdopodobieństwa beta. Zachowane ze względu na kompatybilność; zobacz BETA.DIST.",
    a: "Skumulowany rozkład beta (starsza wersja).",
    p: [
      {
        name: "x",
        detail:
          "Wartość pomiędzy `A` i `B`, przy której funkcja ma zostać obliczona.",
      },
      {
        name: "alfa",
        detail: "Parametr rozkładu.",
      },
      {
        name: "beta",
        detail: "Parametr rozkładu.",
      },
      {
        name: "A",
        detail: "Dolna granica przedziału x; domyślnie wynosi 0.",
      },
      {
        name: "B",
        detail: "Górna granica przedziału x; domyślnie 1.",
      },
    ],
  },
  {
    n: "BETAINV",
    d: "Zwraca odwrotność funkcji skumulowanej gęstości prawdopodobieństwa beta. Zachowane ze względu na kompatybilność; zobacz BETA.INV.",
    a: "Odwrotny rozkład beta (starsza wersja).",
    p: [
      {
        name: "prawdopodobieństwo",
        detail: "Prawdopodobieństwo związane z rozkładem beta.",
      },
      {
        name: "alfa",
        detail: "Parametr rozkładu.",
      },
      {
        name: "beta",
        detail: "Parametr rozkładu.",
      },
      {
        name: "A",
        detail: "Dolna granica przedziału x; domyślnie wynosi 0.",
      },
      {
        name: "B",
        detail: "Górna granica przedziału x; domyślnie 1.",
      },
    ],
  },
  {
    n: "BIN2DEC",
    d: "Konwertuje liczbę binarną na dziesiętną.",
    a: "Binarny na dziesiętny.",
    p: [
      {
        name: "numer",
        detail:
          "Liczba binarna do konwersji; maksymalnie 10 znaków (bitów). Najbardziej znaczącym bitem jest bit znaku.",
      },
    ],
  },
  {
    n: "BIN2HEX",
    d: "Konwertuje liczbę binarną na liczbę szesnastkową.",
    a: "Konwersja z systemu dwójkowego na szesnastkowy.",
    p: [
      {
        name: "numer",
        detail: "Liczba binarna do konwersji; maksymalnie 10 znaków (bitów).",
      },
      {
        name: "liczba_miejsc",
        detail:
          "Liczba znaków do użycia; wynik jest uzupełniany zerami wiodącymi.",
      },
    ],
  },
  {
    n: "BIN2OCT",
    d: "Konwertuje liczbę binarną na ósemkową.",
    a: "Konwersja z systemu dwójkowego na ósemkowy.",
    p: [
      {
        name: "numer",
        detail: "Liczba binarna do konwersji; maksymalnie 10 znaków (bitów).",
      },
      {
        name: "liczba_miejsc",
        detail:
          "Liczba znaków do użycia; wynik jest uzupełniany zerami wiodącymi.",
      },
    ],
  },
  {
    n: "BINOM.DIST",
    d: "Zwraca prawdopodobieństwo rozkładu dwumianowego dla pojedynczego składnika.",
    a: "Prawdopodobieństwo rozkładu dwumianowego.",
    p: [
      {
        name: "liczba_sukcesów",
        detail: "Liczba sukcesów w próbach.",
      },
      {
        name: "prób",
        detail: "Liczba niezależnych prób.",
      },
      {
        name: "prawdopodobieństwo_sukcesu",
        detail: "Prawdopodobieństwo sukcesu w każdej próbie.",
      },
      {
        name: "kumulatywne",
        detail:
          "TRUE zwraca funkcję rozkładu skumulowanego, FALSE funkcję masy prawdopodobieństwa.",
      },
    ],
  },
  {
    n: "BINOM.DIST.RANGE",
    d: "Zwraca prawdopodobieństwo wyniku próby przy użyciu rozkładu dwumianowego.",
    a: "Prawdopodobieństwo szeregu wyników dwumianowych.",
    p: [
      {
        name: "prób",
        detail: "Liczba niezależnych prób.",
      },
      {
        name: "prawdopodobieństwo_sukcesu",
        detail: "Prawdopodobieństwo sukcesu w każdej próbie.",
      },
      {
        name: "liczba_sukcesów",
        detail: "Liczba sukcesów w próbach.",
      },
      {
        name: "liczba_sukcesów2",
        detail:
          "Jeśli podano, zwraca prawdopodobieństwo, że liczba sukcesów mieści się w przedziale od `liczba_sukcesów` do `liczba_sukcesów2`.",
      },
    ],
  },
  {
    n: "BINOM.INV",
    d: "Zwraca najmniejszą wartość, dla której skumulowany rozkład dwumianowy jest większy lub równy wartości kryterium.",
    a: "Odwrotny skumulowany rozkład dwumianowy.",
    p: [
      {
        name: "prób",
        detail: "Liczba prób Bernoulliego.",
      },
      {
        name: "prawdopodobieństwo_sukcesu",
        detail: "Prawdopodobieństwo sukcesu w każdej próbie.",
      },
      {
        name: "alfa",
        detail: "Wartość kryterium.",
      },
    ],
  },
  {
    n: "BINOMDIST",
    d: "Zwraca prawdopodobieństwo rozkładu dwumianowego dla pojedynczego składnika. Zachowane ze względu na kompatybilność; zobacz BINOM.DIST.",
    a: "Rozkład dwumianowy (starsza wersja).",
    p: [
      {
        name: "liczba_sukcesów",
        detail: "Liczba sukcesów w próbach.",
      },
      {
        name: "prób",
        detail: "Liczba niezależnych prób.",
      },
      {
        name: "prawdopodobieństwo_sukcesu",
        detail: "Prawdopodobieństwo sukcesu w każdej próbie.",
      },
      {
        name: "kumulatywne",
        detail:
          "TRUE zwraca funkcję rozkładu skumulowanego, FALSE funkcję masy prawdopodobieństwa.",
      },
    ],
  },
  {
    n: "BITAND",
    d: "Zwraca bitową wartość 'AND' dwóch liczb.",
    a: "Bitowo AND.",
    p: [
      {
        name: "numer_1",
        detail: "Liczba dziesiętna większa lub równa 0.",
      },
      {
        name: "numer2",
        detail: "Liczba dziesiętna większa lub równa 0.",
      },
    ],
  },
  {
    n: "BITLSHIFT",
    d: "Zwraca liczbę przesuniętą w lewo o określoną liczbę bitów.",
    a: "Przesunięcie bitowe w lewo.",
    p: [
      {
        name: "numer",
        detail: "Liczba całkowita większa lub równa 0.",
      },
      {
        name: "liczba_bitów_przesunięcia",
        detail:
          "Liczba bitów do przesunięcia; wartość ujemna przesuwa się w prawo.",
      },
    ],
  },
  {
    n: "BITOR",
    d: "Zwraca bitową wartość 'OR' dwóch liczb.",
    a: "Bitowo OR.",
    p: [
      {
        name: "numer_1",
        detail: "Liczba dziesiętna większa lub równa 0.",
      },
      {
        name: "numer2",
        detail: "Liczba dziesiętna większa lub równa 0.",
      },
    ],
  },
  {
    n: "BITRSHIFT",
    d: "Zwraca liczbę przesuniętą w prawo o określoną liczbę bitów.",
    a: "Bitowe przesunięcie w prawo.",
    p: [
      {
        name: "numer",
        detail: "Liczba całkowita większa lub równa 0.",
      },
      {
        name: "liczba_bitów_przesunięcia",
        detail:
          "Liczba bitów do przesunięcia; wartość ujemna przesuwa się w lewo.",
      },
    ],
  },
  {
    n: "BITXOR",
    d: "Zwraca bitową wartość 'XOR' (wyłącznie lub) dwóch liczb.",
    a: "Bitowo XOR.",
    p: [
      {
        name: "numer_1",
        detail: "Liczba większa lub równa 0.",
      },
      {
        name: "numer2",
        detail: "Liczba większa lub równa 0.",
      },
    ],
  },
  {
    n: "BYCOL",
    d: "Stosuje LAMBDA do każdej kolumny i zwraca tablicę wyników.",
    a: "Stosuje LAMBDA do każdej kolumny.",
    p: [
      {
        name: "tablica",
        detail: "Tablica, która ma być rozdzielona kolumnami.",
      },
      {
        name: "lambda",
        detail:
          "LAMBDA, który przyjmuje kolumnę jako pojedynczy parametr i oblicza jeden wynik.",
      },
    ],
  },
  {
    n: "BYROW",
    d: "Stosuje LAMBDA do każdego wiersza i zwraca tablicę wyników.",
    a: "Stosuje LAMBDA do każdego wiersza.",
    p: [
      {
        name: "tablica",
        detail: "Tablica do rozdzielenia wierszami.",
      },
      {
        name: "lambda",
        detail:
          "A LAMBDA, który przyjmuje wiersz jako pojedynczy parametr i oblicza jeden wynik.",
      },
    ],
  },
  {
    n: "CEILING",
    d: "Zaokrągla liczbę w górę od zera do najbliższej wielokrotności istotności.",
    a: "Zaokrągla w górę do najbliższej wielokrotności.",
    p: [
      {
        name: "numer",
        detail: "Wartość, którą chcesz zaokrąglić.",
      },
      {
        name: "wielokrotność",
        detail: "Wielokrotność, do której chcesz zaokrąglić.",
      },
    ],
  },
  {
    n: "CEILING.MATH",
    d: "Zaokrągla liczbę w górę do najbliższej liczby całkowitej lub do najbliższej wielokrotności istotności, z kontrolą kierunku w przypadku liczb ujemnych.",
    a: "Zaokrągla w górę do najbliższej liczby całkowitej lub wielokrotności.",
    p: [
      {
        name: "numer",
        detail: "Wartość, którą chcesz zaokrąglić.",
      },
      {
        name: "wielokrotność",
        detail:
          "Wielokrotność, do której należy zaokrąglić; domyślnie 1.\nTryb",
      },
      {
        name: "tryb",
        detail:
          "W przypadku liczb ujemnych wartość różna od zera zaokrągla się od zera; 0 lub pominięte zaokrąglenia w kierunku zera.",
      },
    ],
  },
  {
    n: "CEILING.PRECISE",
    d: "Zaokrągla liczbę w górę do najbliższej liczby całkowitej lub do najbliższej wielokrotności istotności, niezależnie od znaku liczby.",
    a: "Zaokrągla w górę niezależnie od znaku.",
    p: [
      {
        name: "numer",
        detail: "Wartość do zaokrąglenia.",
      },
      {
        name: "wielokrotność",
        detail:
          "Wielokrotność, do której zaokrąglana jest liczba; domyślnie 1. Jego znak jest ignorowany.",
      },
    ],
  },
  {
    n: "CELL",
    d: "Zwraca informację o formatowaniu, lokalizacji lub zawartości komórki.",
    a: "Informacja o komórce.",
    p: [
      {
        name: "typ_informacji",
        detail:
          'Typ żądanych informacji, na przykład "address", "col", "row", "contents", "type", "format", "width" lub "filename".',
      },
      {
        name: "odniesienie",
        detail:
          "Komórka, o której chcesz uzyskać informacje; domyślnie jest to ostatnia zmieniona komórka.",
      },
    ],
  },
  {
    n: "CHAR",
    d: "Zwraca znak określony numerem kodu.",
    a: "Znak z numeru kodu.",
    p: [
      {
        name: "numer",
        detail: "Liczba od 1 do 255 określająca, jaki znak chcesz.",
      },
    ],
  },
  {
    n: "CHIDIST",
    d: "Zwraca prawostronne prawdopodobieństwo rozkładu chi-kwadrat. Zachowane ze względu na kompatybilność; zobacz CHISQ.DIST.RT.",
    a: "Prawostronny rozkład chi-kwadrat (starsza wersja).",
    p: [
      {
        name: "x",
        detail: "Wartość, dla której chcesz oszacować rozkład.",
      },
      {
        name: "stopnie_swobody",
        detail: "Liczba stopni swobody.",
      },
    ],
  },
  {
    n: "CHIINV",
    d: "Zwraca odwrotność prawdopodobieństwa rozkładu chi-kwadrat. Zachowane ze względu na kompatybilność; zobacz CHISQ.INV.RT.",
    a: "Odwrotna prawostronna chi-kwadrat (starsza wersja).",
    p: [
      {
        name: "prawdopodobieństwo",
        detail: "Prawdopodobieństwo powiązane z rozkładem chi-kwadrat.",
      },
      {
        name: "stopnie_swobody",
        detail: "Liczba stopni swobody.",
      },
    ],
  },
  {
    n: "CHISQ.DIST",
    d: "Zwraca lewostronne prawdopodobieństwo rozkładu chi-kwadrat.",
    a: "Lewostronny rozkład chi-kwadrat.",
    p: [
      {
        name: "x",
        detail: "Wartość, dla której chcesz oszacować rozkład.",
      },
      {
        name: "stopnie_swobody",
        detail: "Liczba stopni swobody.",
      },
      {
        name: "kumulatywne",
        detail:
          "TRUE zwraca funkcję rozkładu skumulowanego, FALSE funkcję gęstości prawdopodobieństwa.",
      },
    ],
  },
  {
    n: "CHISQ.DIST.RT",
    d: "Zwraca prawostronne prawdopodobieństwo rozkładu chi-kwadrat.",
    a: "Rozkład prawostronny chi-kwadrat.",
    p: [
      {
        name: "x",
        detail: "Wartość, dla której chcesz oszacować rozkład.",
      },
      {
        name: "stopnie_swobody",
        detail: "Liczba stopni swobody.",
      },
    ],
  },
  {
    n: "CHISQ.INV",
    d: "Zwraca odwrotność lewostronnego prawdopodobieństwa rozkładu chi-kwadrat.",
    a: "Odwrotny lewostronny rozkład chi-kwadrat.",
    p: [
      {
        name: "prawdopodobieństwo",
        detail: "Prawdopodobieństwo powiązane z rozkładem chi-kwadrat.",
      },
      {
        name: "stopnie_swobody",
        detail: "Liczba stopni swobody.",
      },
    ],
  },
  {
    n: "CHISQ.INV.RT",
    d: "Zwraca odwrotność prawdopodobieństwa rozkładu chi-kwadrat.",
    a: "Odwrotny prawostronny rozkład chi-kwadrat.",
    p: [
      {
        name: "prawdopodobieństwo",
        detail: "Prawdopodobieństwo powiązane z rozkładem chi-kwadrat.",
      },
      {
        name: "stopnie_swobody",
        detail: "Liczba stopni swobody.",
      },
    ],
  },
  {
    n: "CHISQ.TEST",
    d: "Zwraca test niezależności: wartość z rozkładu chi-kwadrat dla statystyki i odpowiednich stopni swobody.",
    a: "Test niezależności chi-kwadrat.",
    p: [
      {
        name: "wartości_rzeczywiste",
        detail:
          "Zakres danych zawierający obserwacje do sprawdzenia względem oczekiwanych wartości.",
      },
      {
        name: "wartości_oczekiwane",
        detail:
          "Zakres danych zawierający stosunek iloczynu sum wierszy i sum kolumn do sumy całkowitej.",
      },
    ],
  },
  {
    n: "CHITEST",
    d: "Zwraca test niezależności. Zachowane ze względu na kompatybilność; zobacz CHISQ.TEST.",
    a: "Test chi-kwadrat (starsza wersja).",
    p: [
      {
        name: "wartości_rzeczywiste",
        detail:
          "Zakres danych zawierający obserwacje do sprawdzenia względem oczekiwanych wartości.",
      },
      {
        name: "wartości_oczekiwane",
        detail: "Zakres danych zawierający oczekiwane wartości.",
      },
    ],
  },
  {
    n: "CHOOSE",
    d: "Używa numer_indeksu do zwrócenia wartości z listy argumentów wartości.",
    a: "Wybiera wartość z listy według indeksu.",
    p: [
      {
        name: "numer_indeksu",
        detail: "Którą wartość zwrócić; liczba od 1 do 254.",
      },
      {
        name: "wartość_1",
        detail: "Pierwsza wartość do wyboru.",
      },
      {
        name: "wartość2",
        detail: "Dodatkowe wartości do wyboru, łącznie aż 254.",
      },
    ],
  },
  {
    n: "CHOOSECOLS",
    d: "Zwraca określone kolumny z tablicy.",
    a: "Wybrane kolumny tablicy.",
    p: [
      {
        name: "tablica",
        detail: "Tablica zawierająca kolumny, które mają zostać zwrócone.",
      },
      {
        name: "numer_kolumny1",
        detail: "Pierwsza zwracana kolumna; Liczby ujemne liczą się od końca.",
      },
      {
        name: "numer_kolumny2",
        detail: "Dodatkowe kolumny do zwrócenia.",
      },
    ],
  },
  {
    n: "CHOOSEROWS",
    d: "Zwraca określone wiersze z tablicy.",
    a: "Wybrane wiersze tablicy.",
    p: [
      {
        name: "tablica",
        detail: "Tablica zawierająca wiersze do zwrócenia.",
      },
      {
        name: "numer_wiersza1",
        detail:
          "Numer pierwszego wiersza do zwrócenia; Liczby ujemne liczą się od końca.",
      },
      {
        name: "numer_wiersza2",
        detail: "Dodatkowe numery wierszy do zwrócenia.",
      },
    ],
  },
  {
    n: "CLEAN",
    d: "Usuwa z tekstu wszystkie znaki niedrukowalne.",
    a: "Usuwa znaki niedrukowalne.",
    p: [
      {
        name: "tekst",
        detail:
          "Dowolne informacje z arkusza, z których chcesz usunąć znaki niedrukowalne.",
      },
    ],
  },
  {
    n: "CODE",
    d: "Zwraca kod numeryczny dla pierwszego znaku ciągu tekstowego.",
    a: "Kod pierwszego znaku.",
    p: [
      {
        name: "tekst",
        detail: "Tekst, dla którego chcesz podać kod pierwszego znaku.",
      },
    ],
  },
  {
    n: "COLUMN",
    d: "Zwraca numer kolumny danego odwołania do komórki lub komórki zawierającej formułę, jeśli została pominięta.",
    a: "Numer kolumny odniesienia.",
    p: [
      {
        name: "odniesienie",
        detail:
          "Komórka lub zakres komórek, dla którego chcesz zwrócić numer kolumny.",
      },
    ],
  },
  {
    n: "COLUMNS",
    d: "Zwraca liczbę kolumn w tablicy lub odwołaniu.",
    a: "Liczba kolumn w zakresie.",
    p: [
      {
        name: "tablica",
        detail:
          "Tablica, formuła tablicowa lub odniesienie do zakresu komórek.",
      },
    ],
  },
  {
    n: "COMBIN",
    d: "Zwraca liczbę kombinacji (bez powtórzeń) dla danej liczby elementów.",
    a: "Liczba kombinacji.",
    p: [
      {
        name: "numer",
        detail: "Liczba pozycji.\nWybrano numer",
      },
      {
        name: "liczba_wybranych",
        detail: "Liczba elementów w każdej kombinacji.",
      },
    ],
  },
  {
    n: "COMBINA",
    d: "Zwraca liczbę kombinacji z powtórzeniami dla danej liczby elementów.",
    a: "Ilość kombinacji z powtórzeniami.",
    p: [
      {
        name: "numer",
        detail:
          "Liczba pozycji; musi być większa lub równa 0 i `liczba_wybranych`.",
      },
      {
        name: "liczba_wybranych",
        detail: "Liczba elementów w każdej kombinacji.",
      },
    ],
  },
  {
    n: "COMPLEX",
    d: "Konwertuje współczynniki rzeczywiste i urojone na liczbę zespoloną w postaci x + yi lub x + yj.",
    a: "Buduje liczbę zespoloną.",
    p: [
      {
        name: "część_rzeczywista",
        detail: "Rzeczywisty współczynnik liczby zespolonej.",
      },
      {
        name: "część_urojona",
        detail: "Urojony współczynnik liczby zespolonej.",
      },
      {
        name: "przyrostek",
        detail: 'Przyrostek komponentu urojonego, "i" lub "j"; domyślnie "i".',
      },
    ],
  },
  {
    n: "CONCAT",
    d: "Łączy tekst z wielu zakresów i/lub ciągów znaków, bez separatora.",
    a: "Łączy tekst z zakresów i ciągów znaków.",
    p: [
      {
        name: "tekst1",
        detail: "Pierwszy element tekstowy lub zakres do połączenia.",
      },
      {
        name: "tekst2",
        detail:
          "Dodatkowe elementy tekstowe lub zakresy do połączenia, łącznie do 253.",
      },
    ],
  },
  {
    n: "CONCATENATE",
    d: "Łączy dwa lub więcej ciągów tekstowych w jeden ciąg.",
    a: "Łączy ciągi tekstowe.",
    p: [
      {
        name: "tekst1",
        detail:
          "Pierwszy element do połączenia; wartość tekstowa, liczba lub odwołanie do komórki.",
      },
      {
        name: "tekst2",
        detail: "Dodatkowe elementy tekstowe do połączenia, łącznie do 255.",
      },
    ],
  },
  {
    n: "CONFIDENCE",
    d: "Zwraca przedział ufności dla średniej populacji przy użyciu rozkładu normalnego.",
    a: "Normalny przedział ufności (kompatybilność).",
    p: [
      {
        name: "alfa",
        detail: "Poziom istotności zastosowany do obliczenia poziomu ufności.",
      },
      {
        name: "odchylenie_standardowe",
        detail: "Odchylenie standardowe populacji.",
      },
      {
        name: "rozmiar",
        detail: "Wielkość próbki.",
      },
    ],
  },
  {
    n: "CONFIDENCE.NORM",
    d: "Zwraca przedział ufności dla średniej populacji, stosując rozkład normalny.",
    a: "Przedział ufności przy użyciu rozkładu normalnego.",
    p: [
      {
        name: "alfa",
        detail: "Poziom istotności zastosowany do obliczenia poziomu ufności.",
      },
      {
        name: "odchylenie_standardowe",
        detail:
          "Odchylenie standardowe populacji dla zakresu danych; zakłada się, że jest znany.",
      },
      {
        name: "rozmiar",
        detail: "Wielkość próbki.",
      },
    ],
  },
  {
    n: "CONFIDENCE.T",
    d: "Zwraca przedział ufności dla średniej populacji przy użyciu rozkładu t-Studenta.",
    a: "Przedział ufności przy użyciu rozkładu t.",
    p: [
      {
        name: "alfa",
        detail: "Poziom istotności zastosowany do obliczenia poziomu ufności.",
      },
      {
        name: "odchylenie_standardowe",
        detail:
          "Odchylenie standardowe populacji dla zakresu danych; zakłada się, że jest znany.",
      },
      {
        name: "rozmiar",
        detail: "Wielkość próbki.",
      },
    ],
  },
  {
    n: "CONVERT",
    d: "Konwertuje liczbę z jednego systemu miar na inny, na przykład tabelę odległości w milach na kilometry.",
    a: "Konwersja jednostek miary.",
    p: [
      {
        name: "numer",
        detail: "Wartość w `jednostka_źródłowa` do konwersji.",
      },
      {
        name: "jednostka_źródłowa",
        detail: "Jednostki dla `numer`.",
      },
      {
        name: "jednostka_docelowa",
        detail: "Jednostki wyniku.",
      },
    ],
  },
  {
    n: "CORREL",
    d: "Zwraca współczynnik korelacji dwóch zakresów komórek.",
    a: "Współczynnik korelacji dwóch zbiorów danych.",
    p: [
      {
        name: "tablica1",
        detail: "Zakres wartości komórek.",
      },
      {
        name: "tablica2",
        detail: "Drugi zakres wartości komórek.",
      },
    ],
  },
  {
    n: "COS",
    d: "Zwraca cosinus kąta podanego w radianach.",
    a: "Cosinus kąta w radianach.",
    p: [
      {
        name: "numer",
        detail:
          "Kąt w radianach. Pomnóż stopnie przez PI()/180 lub użyj RADIANS do konwersji.",
      },
    ],
  },
  {
    n: "COSH",
    d: "Zwraca cosinus hiperboliczny liczby.",
    a: "Cosinus hiperboliczny.",
    p: [
      {
        name: "numer",
        detail: "Dowolna liczba rzeczywista.",
      },
    ],
  },
  {
    n: "COT",
    d: "Zwraca cotangens kąta podanego w radianach.",
    a: "Cotangens kąta w radianach.",
    p: [
      {
        name: "numer",
        detail:
          "Kąt w radianach; jego wartość bezwzględna musi być mniejsza niż 2^27.",
      },
    ],
  },
  {
    n: "COTH",
    d: "Zwraca cotangens hiperboliczny kąta hiperbolicznego.",
    a: "Kotangens hiperboliczny.",
    p: [
      {
        name: "numer",
        detail: "Dowolna liczba rzeczywista różna od 0.",
      },
    ],
  },
  {
    n: "COUNT",
    d: "Zlicza komórki zawierające liczby i zlicza liczby na liście argumentów.",
    a: "Liczba wartości numerycznych.",
    p: [
      {
        name: "wartość_1",
        detail:
          "Pierwszy element, odwołanie do komórki lub zakres, w którym chcesz policzyć liczby.",
      },
      {
        name: "wartość2",
        detail: "Dodatkowe pozycje lub zakresy, łącznie do 255.",
      },
    ],
  },
  {
    n: "COUNTA",
    d: "Zlicza liczbę komórek, które nie są puste w zakresie.",
    a: "Liczba niepustych wartości.",
    p: [
      {
        name: "wartość_1",
        detail:
          "Pierwszy argument reprezentujący wartości, które chcesz zliczyć.",
      },
      {
        name: "wartość2",
        detail: "Dodatkowe wartości lub zakresy, łącznie do 255.",
      },
    ],
  },
  {
    n: "COUNTBLANK",
    d: 'Zlicza liczbę pustych komórek w zakresie. Zliczane są także komórki zawierające formuły zwracające "".',
    a: "Liczba pustych komórek.",
    p: [
      {
        name: "zakres",
        detail: "Zakres, od którego chcesz policzyć puste komórki.",
      },
    ],
  },
  {
    n: "COUNTIF",
    d: "Zlicza liczbę komórek w zakresie spełniających jedno kryterium.",
    a: "Liczba komórek spełniających warunek.",
    p: [
      {
        name: "zakres",
        detail: "Grupa komórek, którą chcesz policzyć.",
      },
      {
        name: "kryteria",
        detail:
          "Liczba, wyrażenie, odwołanie do komórki lub ciąg tekstowy określające, które komórki będą liczone.",
      },
    ],
  },
  {
    n: "COUNTIFS",
    d: "Zlicza liczbę komórek spełniających wiele kryteriów w jednym lub większej liczbie zakresów.",
    a: "Liczba komórek spełniających wiele kryteriów.",
    p: [
      {
        name: "zakres_kryteriów1",
        detail: "Pierwszy zakres, w którym oceniane są powiązane kryteria.",
      },
      {
        name: "kryteria1",
        detail: "Kryteria definiujące, które komórki będą zliczane.",
      },
      {
        name: "zakres_kryteriów2",
        detail:
          "Dodatkowe zakresy, do 127 par zakres/kryteria, każdy o takim samym kształcie jak `zakres_kryteriów1`.",
      },
      {
        name: "kryteria2",
        detail: "Kryteria dla odpowiedniego dodatkowego zakresu.",
      },
    ],
  },
  {
    n: "COUPDAYBS",
    d: "Zwraca liczbę dni od początku okresu kuponowego do daty rozliczenia.",
    a: "Dni od rozpoczęcia okresu kuponowego do rozliczenia.",
    p: [
      {
        name: "data_rozrachunku",
        detail: "Data rozliczenia papieru wartościowego.",
      },
      {
        name: "termin_zapadalności",
        detail:
          "Termin zapadalności papieru wartościowego, kiedy papier wartościowy wygasa.",
      },
      {
        name: "częstotliwość",
        detail:
          "Liczba wypłat kuponowych w ciągu roku: 1 roczna, 2 półroczne, 4 kwartalne.",
      },
      {
        name: "podstawa",
        detail:
          "Podstawa liczenia dni: 0 lub pominięty US 30/360, 1 faktyczny/rzeczywisty, 2 rzeczywisty/360, 3 rzeczywisty/365, 4 europejski 30/360.",
      },
    ],
  },
  {
    n: "COUPDAYS",
    d: "Zwraca liczbę dni w okresie kuponu, który zawiera datę rozliczenia.",
    a: "Dni w okresie rozliczeniowym kuponu.",
    p: [
      {
        name: "data_rozrachunku",
        detail: "Data rozliczenia papieru wartościowego.",
      },
      {
        name: "termin_zapadalności",
        detail:
          "Termin zapadalności papieru wartościowego, kiedy papier wartościowy wygasa.",
      },
      {
        name: "częstotliwość",
        detail:
          "Liczba wypłat kuponowych w ciągu roku: 1 roczna, 2 półroczne, 4 kwartalne.",
      },
      {
        name: "podstawa",
        detail:
          "Podstawa liczenia dni: 0 lub pominięty US 30/360, 1 faktyczny/rzeczywisty, 2 rzeczywisty/360, 3 rzeczywisty/365, 4 europejski 30/360.",
      },
    ],
  },
  {
    n: "COUPDAYSNC",
    d: "Zwraca liczbę dni od daty rozliczenia do daty następnego kuponu.",
    a: "Dni od rozliczenia do następnego kuponu.",
    p: [
      {
        name: "data_rozrachunku",
        detail: "Data rozliczenia papieru wartościowego.",
      },
      {
        name: "termin_zapadalności",
        detail:
          "Termin zapadalności papieru wartościowego, kiedy papier wartościowy wygasa.",
      },
      {
        name: "częstotliwość",
        detail:
          "Liczba wypłat kuponowych w ciągu roku: 1 roczna, 2 półroczne, 4 kwartalne.",
      },
      {
        name: "podstawa",
        detail:
          "Podstawa liczenia dni: 0 lub pominięty US 30/360, 1 faktyczny/rzeczywisty, 2 rzeczywisty/360, 3 rzeczywisty/365, 4 europejski 30/360.",
      },
    ],
  },
  {
    n: "COUPNCD",
    d: "Zwraca liczbę oznaczającą datę następnego kuponu po dacie rozliczenia.",
    a: "Data następnego kuponu po rozliczeniu.",
    p: [
      {
        name: "data_rozrachunku",
        detail: "Data rozliczenia papieru wartościowego.",
      },
      {
        name: "termin_zapadalności",
        detail:
          "Termin zapadalności papieru wartościowego, kiedy papier wartościowy wygasa.",
      },
      {
        name: "częstotliwość",
        detail:
          "Liczba wypłat kuponowych w ciągu roku: 1 roczna, 2 półroczne, 4 kwartalne.",
      },
      {
        name: "podstawa",
        detail:
          "Podstawa liczenia dni: 0 lub pominięty US 30/360, 1 faktyczny/rzeczywisty, 2 rzeczywisty/360, 3 rzeczywisty/365, 4 europejski 30/360.",
      },
    ],
  },
  {
    n: "COUPNUM",
    d: "Zwraca liczbę kuponów płatnych pomiędzy datą rozliczenia a datą zapadalności, w zaokrągleniu w górę do najbliższego pełnego kuponu.",
    a: "Liczba kuponów do terminu zapadalności.",
    p: [
      {
        name: "data_rozrachunku",
        detail: "Data rozliczenia papieru wartościowego.",
      },
      {
        name: "termin_zapadalności",
        detail:
          "Termin zapadalności papieru wartościowego, kiedy papier wartościowy wygasa.",
      },
      {
        name: "częstotliwość",
        detail:
          "Liczba wypłat kuponowych w ciągu roku: 1 roczna, 2 półroczne, 4 kwartalne.",
      },
      {
        name: "podstawa",
        detail:
          "Podstawa liczenia dni: 0 lub pominięty US 30/360, 1 faktyczny/rzeczywisty, 2 rzeczywisty/360, 3 rzeczywisty/365, 4 europejski 30/360.",
      },
    ],
  },
  {
    n: "COUPPCD",
    d: "Zwraca liczbę reprezentującą datę poprzedniego kuponu przed datą rozliczenia.",
    a: "Data poprzedniego kuponu przed rozliczeniem.",
    p: [
      {
        name: "data_rozrachunku",
        detail: "Data rozliczenia papieru wartościowego.",
      },
      {
        name: "termin_zapadalności",
        detail:
          "Termin zapadalności papieru wartościowego, kiedy papier wartościowy wygasa.",
      },
      {
        name: "częstotliwość",
        detail:
          "Liczba wypłat kuponowych w ciągu roku: 1 roczna, 2 półroczne, 4 kwartalne.",
      },
      {
        name: "podstawa",
        detail:
          "Podstawa liczenia dni: 0 lub pominięty US 30/360, 1 faktyczny/rzeczywisty, 2 rzeczywisty/360, 3 rzeczywisty/365, 4 europejski 30/360.",
      },
    ],
  },
  {
    n: "COVAR",
    d: "Zwraca kowariancję, średnią produktów sparowanych odchyleń. Zachowane ze względu na kompatybilność; zobacz COVARIANCE.P.",
    a: "Kowariancja populacji (starsza wersja).",
    p: [
      {
        name: "tablica1",
        detail: "Pierwszy zakres komórek zawierających liczby całkowite.",
      },
      {
        name: "tablica2",
        detail: "Drugi zakres komórek zawierających liczby całkowite.",
      },
    ],
  },
  {
    n: "COVARIANCE.P",
    d: "Zwraca kowariancję populacji, średnią produktów odchyleń dla każdej pary punktów danych.",
    a: "Kowariancja populacji.",
    p: [
      {
        name: "tablica1",
        detail: "Pierwszy zakres komórek zawierających liczby całkowite.",
      },
      {
        name: "tablica2",
        detail: "Drugi zakres komórek zawierających liczby całkowite.",
      },
    ],
  },
  {
    n: "COVARIANCE.S",
    d: "Zwraca kowariancję próbki, średnią produktów odchyleń dla każdej pary punktów danych.",
    a: "Kowariancja próby.",
    p: [
      {
        name: "tablica1",
        detail: "Pierwszy zakres komórek zawierających liczby całkowite.",
      },
      {
        name: "tablica2",
        detail: "Drugi zakres komórek zawierających liczby całkowite.",
      },
    ],
  },
  {
    n: "CRITBINOM",
    d: "Zwraca najmniejszą wartość, dla której skumulowany rozkład dwumianowy jest większy lub równy wartości kryterium. Zachowane ze względu na kompatybilność; zobacz BINOM.INV.",
    a: "Odwrotny dwumian skumulowany (starsza wersja).",
    p: [
      {
        name: "prób",
        detail: "Liczba prób Bernoulliego.",
      },
      {
        name: "prawdopodobieństwo_sukcesu",
        detail: "Prawdopodobieństwo sukcesu w każdej próbie.",
      },
      {
        name: "alfa",
        detail: "Wartość kryterium.",
      },
    ],
  },
  {
    n: "CSC",
    d: "Zwraca cosecans kąta podanego w radianach.",
    a: "Cosecans kąta w radianach.",
    p: [
      {
        name: "numer",
        detail:
          "Kąt w radianach; jego wartość bezwzględna musi być mniejsza niż 2^27.",
      },
    ],
  },
  {
    n: "CSCH",
    d: "Zwraca cosekans hiperboliczny kąta podanego w radianach.",
    a: "Cosekans hiperboliczny.",
    p: [
      {
        name: "numer",
        detail: "Dowolna liczba rzeczywista różna od 0.",
      },
    ],
  },
  {
    n: "CUMIPMT",
    d: "Zwraca skumulowane odsetki zapłacone od pożyczki pomiędzy Okres_początkowy i okres_końcowy.",
    a: "Odsetki skumulowane zapłacone pomiędzy dwoma okresami.",
    p: [
      {
        name: "stawka",
        detail: "Stopa procentowa za okres.",
      },
      {
        name: "liczba_okresów",
        detail: "Całkowita liczba okresów płatności.",
      },
      {
        name: "wartość_bieżąca",
        detail: "Wartość bieżąca.",
      },
      {
        name: "Okres_początkowy",
        detail:
          "Pierwszy okres w obliczeniach; okresy są numerowane począwszy od 1.",
      },
      {
        name: "okres_końcowy",
        detail: "Ostatni okres w obliczeniach.",
      },
      {
        name: "typ",
        detail: "Moment płatności: 0 na koniec okresu, 1 na początku.",
      },
    ],
  },
  {
    n: "CUMPRINC",
    d: "Zwraca skumulowaną kwotę główną zapłaconą z tytułu pożyczki pomiędzy Okres_początkowy a okres_końcowy.",
    a: "Skumulowana kwota główna zapłacona w dwóch okresach.",
    p: [
      {
        name: "stawka",
        detail: "Stopa procentowa za okres.",
      },
      {
        name: "liczba_okresów",
        detail: "Całkowita liczba okresów płatności.",
      },
      {
        name: "wartość_bieżąca",
        detail: "Wartość bieżąca.",
      },
      {
        name: "Okres_początkowy",
        detail:
          "Pierwszy okres w obliczeniach; okresy są numerowane począwszy od 1.",
      },
      {
        name: "okres_końcowy",
        detail: "Ostatni okres w obliczeniach.",
      },
      {
        name: "typ",
        detail: "Moment płatności: 0 na koniec okresu, 1 na początku.",
      },
    ],
  },
  {
    n: "DATE",
    d: "Zwraca kolejny numer seryjny reprezentujący konkretną datę.",
    a: "Data z roku, miesiąca i dnia.",
    p: [
      {
        name: "rok",
        detail:
          "Rok; Do 1900 dodaje się wartości od 0 do 1899, wartości od 1900 do 9999 stosuje się w niezmienionej postaci.",
      },
      {
        name: "miesiąc",
        detail:
          "Miesiąc roku od 1 do 12; wartości spoza tego zakresu przechodzą na kolejne lata.",
      },
      {
        name: "dzień",
        detail:
          "Dzień miesiąca od 1 do 31; wartości spoza tego zakresu przechodzą na sąsiednie miesiące.",
      },
    ],
  },
  {
    n: "DATEDIF",
    d: "Oblicza liczbę dni, miesięcy lub lat pomiędzy dwiema datami.",
    a: "Różnica pomiędzy dwiema datami.",
    p: [
      {
        name: "data_rozpoczęcia",
        detail: "Pierwsza lub początkowa data okresu.",
      },
      {
        name: "data_zakończenia",
        detail: "Ostatnia lub końcowa data okresu.",
      },
      {
        name: "jednostka",
        detail:
          'Rodzaj zwracanych informacji: "Y" lat, "M" miesięcy, "D" dni, "MD", "YM" lub "YD" dla reszty.',
      },
    ],
  },
  {
    n: "DATEVALUE",
    d: "Konwertuje datę zapisaną jako tekst na liczbę kolejną rozpoznawaną przez Excel jako datę.",
    a: "Konwertuje tekst daty na numer seryjny.",
    p: [
      {
        name: "data_jako_tekst",
        detail: "Tekst reprezentujący datę w uznanym formacie daty.",
      },
    ],
  },
  {
    n: "DAVERAGE",
    d: "Uśrednia wartości w polu (kolumnie) rekordów na liście lub w bazie danych, które spełniają określone przez Ciebie warunki.",
    a: "Średnia pasujących rekordów bazy danych.",
    p: [
      {
        name: "baza_danych",
        detail:
          "Zakres komórek tworzących listę lub bazę danych; pierwszy wiersz zawiera etykiety dla każdej kolumny.\nPole",
      },
      {
        name: ".",
        detail:
          "Etykieta kolumny w podwójnym cudzysłowie lub liczba reprezentująca położenie kolumny.",
      },
      {
        name: "kryteria",
        detail:
          "Zakres komórek zawierający warunki: co najmniej jedna etykieta kolumny i komórka pod nią.",
      },
    ],
  },
  {
    n: "DAY",
    d: "Zwraca dzień daty reprezentowany przez liczbę kolejną jako liczbę całkowitą od 1 do 31.",
    a: "Dzień miesiąca.",
    p: [
      {
        name: "numer_seryjny",
        detail: "Data dnia, który szukasz.",
      },
    ],
  },
  {
    n: "DAYS",
    d: "Zwraca liczbę dni pomiędzy dwiema datami.",
    a: "Dni pomiędzy dwiema datami.",
    p: [
      {
        name: "data_zakończenia",
        detail: "Późniejsza z dwóch dat.",
      },
      {
        name: "data_rozpoczęcia",
        detail: "Wcześniejsza z dwóch dat.",
      },
    ],
  },
  {
    n: "DAYS360",
    d: "Zwraca liczbę dni pomiędzy dwiema datami w oparciu o rok 360-dniowy (dwanaście 30-dniowych miesięcy).",
    a: "Dni pomiędzy datami w roku 360-dniowym.",
    p: [
      {
        name: "data_rozpoczęcia",
        detail: "Data rozpoczęcia.",
      },
      {
        name: "data_zakończenia",
        detail: "Data końcowa.",
      },
      {
        name: "metoda",
        detail:
          "FALSE lub pominięty wykorzystuje metodę amerykańską (NASD); TRUE wykorzystuje metodę europejską.",
      },
    ],
  },
  {
    n: "DB",
    d: "Zwraca amortyzację środka trwałego za określony okres przy użyciu metody salda o stałym spadku.",
    a: "Amortyzacja salda o stałym spadku.",
    p: [
      {
        name: "koszt_początkowy",
        detail: "Początkowy koszt środka trwałego.",
      },
      {
        name: "wartość_końcowa",
        detail:
          "Wartość na koniec amortyzacji (wartość ratunkowa środka trwałego).",
      },
      {
        name: "okres_użytkowania",
        detail:
          "Liczba okresów, przez które składnik aktywów jest amortyzowany.",
      },
      {
        name: "okres",
        detail:
          "Okres, za który chcesz obliczyć amortyzację, w tych samych jednostkach co `okres_użytkowania`.",
      },
      {
        name: "miesiąc",
        detail: "Liczba miesięcy w pierwszym roku; domyślnie 12.",
      },
    ],
  },
  {
    n: "DBCS",
    d: "Zmienia znaki o połowie szerokości (jednobajtowe) na znaki o pełnej szerokości (dwubajtowe).",
    a: "Konwertuj na znaki o pełnej szerokości.",
    p: [
      {
        name: "tekst",
        detail: "Tekst lub odwołanie do komórki zawierającej tekst do zmiany.",
      },
    ],
  },
  {
    n: "DCOUNT",
    d: "Zlicza komórki zawierające liczby w polu (kolumnie) rekordów na liście lub w bazie danych, które spełniają określone warunki.",
    a: "Liczba liczb w pasujących rekordach.",
    p: [
      {
        name: "baza_danych",
        detail:
          "Zakres komórek tworzących listę lub bazę danych; pierwszy wiersz zawiera etykiety dla każdej kolumny.\nPole",
      },
      {
        name: ".",
        detail:
          "Etykieta kolumny w podwójnym cudzysłowie lub liczba reprezentująca położenie kolumny.",
      },
      {
        name: "kryteria",
        detail:
          "Zakres komórek zawierający warunki: co najmniej jedna etykieta kolumny i komórka pod nią.",
      },
    ],
  },
  {
    n: "DCOUNTA",
    d: "Zlicza niepuste komórki w polu (kolumnie) rekordów na liście lub w bazie danych, które spełniają określone przez Ciebie warunki.",
    a: "Liczba niepustych wartości w pasujących rekordach.",
    p: [
      {
        name: "baza_danych",
        detail:
          "Zakres komórek tworzących listę lub bazę danych; pierwszy wiersz zawiera etykiety dla każdej kolumny.\nPole",
      },
      {
        name: ".",
        detail:
          "Etykieta kolumny w podwójnym cudzysłowie lub liczba reprezentująca położenie kolumny.",
      },
      {
        name: "kryteria",
        detail:
          "Zakres komórek zawierający warunki: co najmniej jedna etykieta kolumny i komórka pod nią.",
      },
    ],
  },
  {
    n: "DDB",
    d: "Zwraca amortyzację środka trwałego za określony okres przy użyciu metody salda podwójnie malejącego lub innej określonej przez użytkownika metody.",
    a: "Podwójnie malejąca amortyzacja salda.",
    p: [
      {
        name: "koszt_początkowy",
        detail: "Początkowy koszt środka trwałego.",
      },
      {
        name: "wartość_końcowa",
        detail: "Wartość na koniec amortyzacji.\nWspółczynnik",
      },
      {
        name: "okres_użytkowania",
        detail:
          "Liczba okresów, przez które składnik aktywów jest amortyzowany.",
      },
      {
        name: "okres",
        detail:
          "Okres, za który chcesz obliczyć amortyzację, w tych samych jednostkach co `okres_użytkowania`.",
      },
      {
        name: ".",
        detail:
          "Tempo spadku salda; domyślnie wynosi 2 (saldo podwójnie malejące).",
      },
    ],
  },
  {
    n: "DEC2BIN",
    d: "Konwertuje liczbę dziesiętną na binarną.",
    a: "Konwersja z systemu dziesiętnego na dwójkowy.",
    p: [
      {
        name: "numer",
        detail: "Dziesiętna liczba całkowita do konwersji, od -512 do 511.",
      },
      {
        name: "liczba_miejsc",
        detail:
          "Liczba znaków do użycia; wynik jest uzupełniany zerami wiodącymi.",
      },
    ],
  },
  {
    n: "DEC2HEX",
    d: "Konwertuje liczbę dziesiętną na liczbę szesnastkową.",
    a: "Konwersja z systemu dziesiętnego na szesnastkowy.",
    p: [
      {
        name: "numer",
        detail: "Dziesiętna liczba całkowita do konwersji.",
      },
      {
        name: "liczba_miejsc",
        detail:
          "Liczba znaków do użycia; wynik jest uzupełniany zerami wiodącymi.",
      },
    ],
  },
  {
    n: "DEC2OCT",
    d: "Konwertuje liczbę dziesiętną na ósemkową.",
    a: "Konwersja z systemu dziesiętnego na ósemkowy.",
    p: [
      {
        name: "numer",
        detail: "Dziesiętna liczba całkowita do konwersji.",
      },
      {
        name: "liczba_miejsc",
        detail:
          "Liczba znaków do użycia; wynik jest uzupełniany zerami wiodącymi.",
      },
    ],
  },
  {
    n: "DECIMAL",
    d: "Konwertuje tekstową reprezentację liczby o podanej podstawie na liczbę dziesiętną.",
    a: "Konwertuje tekst o innej podstawie na liczbę.",
    p: [
      {
        name: "tekst",
        detail: "Tekst do konwersji; maksymalnie 255 znaków.",
      },
      {
        name: "podstawa_systemu",
        detail: "Baza `tekst`; liczba całkowita od 2 do 36.",
      },
    ],
  },
  {
    n: "DEGREES",
    d: "Konwertuje radiany na stopnie.",
    a: "Konwertuje radiany na stopnie.",
    p: [
      {
        name: "kąt",
        detail: "Kąt w radianach, który chcesz przeliczyć.",
      },
    ],
  },
  {
    n: "DELTA",
    d: "Sprawdza, czy dwie wartości są równe. Zwraca 1, jeśli liczba1 = liczba2; w przeciwnym razie zwraca 0.",
    a: "Sprawdza, czy dwie liczby są równe.",
    p: [
      {
        name: "numer_1",
        detail: "Pierwsza liczba.",
      },
      {
        name: "numer2",
        detail: "Druga liczba; domyślnie wynosi 0.",
      },
    ],
  },
  {
    n: "DEVSQ",
    d: "Zwraca sumę kwadratów odchyleń punktów danych od ich średniej z próbki.",
    a: "Suma kwadratów odchyleń.",
    p: [
      {
        name: "numer_1",
        detail: "Pierwsza liczba lub zakres.",
      },
      {
        name: "numer2",
        detail: "Dodatkowe numery lub zakresy, łącznie do 255.",
      },
    ],
  },
  {
    n: "DGET",
    d: "Wyodrębnia pojedynczą wartość z kolumny listy lub bazy danych, która spełnia określone warunki.",
    a: "Pojedyncza wartość z pasujących rekordów.",
    p: [
      {
        name: "baza_danych",
        detail:
          "Zakres komórek tworzących listę lub bazę danych; pierwszy wiersz zawiera etykiety dla każdej kolumny.\nPole",
      },
      {
        name: ".",
        detail:
          "Etykieta kolumny w podwójnym cudzysłowie lub liczba reprezentująca położenie kolumny.",
      },
      {
        name: "kryteria",
        detail:
          "Zakres komórek zawierający warunki: co najmniej jedna etykieta kolumny i komórka pod nią.",
      },
    ],
  },
  {
    n: "DISC",
    d: "Zwraca stopę dyskontową papieru wartościowego.",
    a: "Stopa dyskontowa papieru wartościowego.",
    p: [
      {
        name: "data_rozrachunku",
        detail: "Data rozliczenia papieru wartościowego.",
      },
      {
        name: "termin_zapadalności",
        detail: "Termin zapadalności papieru wartościowego.",
      },
      {
        name: "cena",
        detail: "Cena papieru wartościowego za wartość nominalną 100 dolarów.",
      },
      {
        name: "wartość_wykupu",
        detail:
          "Wartość wykupu papieru wartościowego według wartości nominalnej 100 dolarów.",
      },
      {
        name: "podstawa",
        detail:
          "Podstawa liczenia dni: 0 lub pominięty US 30/360, 1 faktyczny/rzeczywisty, 2 rzeczywisty/360, 3 rzeczywisty/365, 4 europejski 30/360.",
      },
    ],
  },
  {
    n: "DMAX",
    d: "Zwraca największą liczbę w polu (kolumnie) rekordów na liście lub w bazie danych spełniających określone warunki.",
    a: "Maksymalna liczba pasujących rekordów bazy danych.",
    p: [
      {
        name: "baza_danych",
        detail:
          "Zakres komórek tworzących listę lub bazę danych; pierwszy wiersz zawiera etykiety dla każdej kolumny.\nPole",
      },
      {
        name: ".",
        detail:
          "Etykieta kolumny w podwójnym cudzysłowie lub liczba reprezentująca położenie kolumny.",
      },
      {
        name: "kryteria",
        detail:
          "Zakres komórek zawierający warunki: co najmniej jedna etykieta kolumny i komórka pod nią.",
      },
    ],
  },
  {
    n: "DMIN",
    d: "Zwraca najmniejszą liczbę w polu (kolumnie) rekordów na liście lub w bazie danych, która spełnia określone warunki.",
    a: "Minimum z pasujących rekordów bazy danych.",
    p: [
      {
        name: "baza_danych",
        detail:
          "Zakres komórek tworzących listę lub bazę danych; pierwszy wiersz zawiera etykiety dla każdej kolumny.\nPole",
      },
      {
        name: ".",
        detail:
          "Etykieta kolumny w podwójnym cudzysłowie lub liczba reprezentująca położenie kolumny.",
      },
      {
        name: "kryteria",
        detail:
          "Zakres komórek zawierający warunki: co najmniej jedna etykieta kolumny i komórka pod nią.",
      },
    ],
  },
  {
    n: "DOLLAR",
    d: "Konwertuje liczbę na tekst w formacie walutowym, z zaokrągleniem miejsc po przecinku do określonego miejsca.",
    a: "Formatuje liczbę jako tekst waluty.",
    p: [
      {
        name: "numer",
        detail:
          "Liczba, odwołanie do komórki zawierającej liczbę lub formuła, której wynikiem jest liczba.",
      },
      {
        name: "miejsc_dziesiętnych",
        detail:
          "Liczba cyfr po prawej stronie przecinka dziesiętnego; domyślnie 2.",
      },
    ],
  },
  {
    n: "DOLLARDE",
    d: "Konwertuje cenę w dolarach wyrażoną jako część całkowitą i część ułamkową, taką jak 1,02, na cenę w dolarach wyrażoną jako liczba dziesiętna.",
    a: "Konwertuje cenę ułamkową na dziesiętną.",
    p: [
      {
        name: "dolar_ułamkowy",
        detail:
          "Liczba wyrażona jako część całkowita i część ułamkowa, oddzielona symbolem dziesiętnym.",
      },
      {
        name: "frakcja",
        detail: "Liczba całkowita używana w mianowniku ułamka.",
      },
    ],
  },
  {
    n: "DOLLARFR",
    d: "Konwertuje cenę w dolarach wyrażoną jako liczba dziesiętną na cenę w dolarach wyrażoną jako ułamek zwykły.",
    a: "Konwertuje cenę dziesiętną na ułamkową.",
    p: [
      {
        name: "dolar_dziesiętny",
        detail: "Liczba dziesiętna.",
      },
      {
        name: "frakcja",
        detail: "Liczba całkowita używana w mianowniku ułamka.",
      },
    ],
  },
  {
    n: "DPRODUCT",
    d: "Mnoży wartości w polu (kolumnie) rekordów na liście lub w bazie danych, które odpowiadają określonym warunkom.",
    a: "Iloczyn wartości pasujących rekordów bazy danych.",
    p: [
      {
        name: "baza_danych",
        detail:
          "Zakres komórek tworzących listę lub bazę danych; pierwszy wiersz zawiera etykiety dla każdej kolumny.\nPole",
      },
      {
        name: ".",
        detail:
          "Etykieta kolumny w podwójnym cudzysłowie lub liczba reprezentująca położenie kolumny.",
      },
      {
        name: "kryteria",
        detail:
          "Zakres komórek zawierający warunki: co najmniej jedna etykieta kolumny i komórka pod nią.",
      },
    ],
  },
  {
    n: "DROP",
    d: "Wyklucza określoną liczbę wierszy lub kolumn z początku lub końca tablicy.",
    a: "Tablica bez pierwszych i ostatnich wierszy/kolumn.",
    p: [
      {
        name: "tablica",
        detail: "Tablica, z której mają być usuwane wiersze lub kolumny.",
      },
      {
        name: "wiersze",
        detail: "Liczba wierszy do usunięcia; wartość ujemna spada od końca.",
      },
      {
        name: "kolumny",
        detail: "Liczba kolumn do wykluczenia; wartość ujemna spada od końca.",
      },
    ],
  },
  {
    n: "DSTDEV",
    d: "Szacuje odchylenie standardowe populacji na podstawie próby, używając liczb w polu rekordów spełniających określone warunki.",
    a: "Odchylenie standardowe próby pasujących rekordów.",
    p: [
      {
        name: "baza_danych",
        detail:
          "Zakres komórek tworzących listę lub bazę danych; pierwszy wiersz zawiera etykiety dla każdej kolumny.\nPole",
      },
      {
        name: ".",
        detail:
          "Etykieta kolumny w podwójnym cudzysłowie lub liczba reprezentująca położenie kolumny.",
      },
      {
        name: "kryteria",
        detail:
          "Zakres komórek zawierający warunki: co najmniej jedna etykieta kolumny i komórka pod nią.",
      },
    ],
  },
  {
    n: "DSTDEVP",
    d: "Oblicza odchylenie standardowe populacji na podstawie całej populacji, używając liczb w polu rekordów spełniających określone warunki.",
    a: "Odchylenie standardowe populacji pasujących rekordów.",
    p: [
      {
        name: "baza_danych",
        detail:
          "Zakres komórek tworzących listę lub bazę danych; pierwszy wiersz zawiera etykiety dla każdej kolumny.\nPole",
      },
      {
        name: ".",
        detail:
          "Etykieta kolumny w podwójnym cudzysłowie lub liczba reprezentująca położenie kolumny.",
      },
      {
        name: "kryteria",
        detail:
          "Zakres komórek zawierający warunki: co najmniej jedna etykieta kolumny i komórka pod nią.",
      },
    ],
  },
  {
    n: "DSUM",
    d: "Dodaje liczby w polu (kolumnie) rekordów na liście lub w bazie danych, które spełniają określone przez Ciebie warunki.",
    a: "Suma pasujących rekordów bazy danych.",
    p: [
      {
        name: "baza_danych",
        detail:
          "Zakres komórek tworzących listę lub bazę danych; pierwszy wiersz zawiera etykiety dla każdej kolumny.\nPole",
      },
      {
        name: ".",
        detail:
          "Etykieta kolumny w podwójnym cudzysłowie lub liczba reprezentująca położenie kolumny.",
      },
      {
        name: "kryteria",
        detail:
          "Zakres komórek zawierający warunki: co najmniej jedna etykieta kolumny i komórka pod nią.",
      },
    ],
  },
  {
    n: "DURATION",
    d: "Zwraca czas trwania Macaulaya dla przyjętej wartości nominalnej wynoszącej 100 USD.",
    a: "Duracja Macaulaya papieru wartościowego.",
    p: [
      {
        name: "data_rozrachunku",
        detail: "Data rozliczenia papieru wartościowego.",
      },
      {
        name: "termin_zapadalności",
        detail: "Termin zapadalności papieru wartościowego.",
      },
      {
        name: "kupon",
        detail: "Roczna stopa kuponu papieru wartościowego.",
      },
      {
        name: "rentowność",
        detail: "Roczna stopa zwrotu papieru wartościowego.",
      },
      {
        name: "częstotliwość",
        detail:
          "Liczba wypłat kuponowych w ciągu roku: 1 roczna, 2 półroczne, 4 kwartalne.",
      },
      {
        name: "podstawa",
        detail:
          "Podstawa liczenia dni: 0 lub pominięty US 30/360, 1 faktyczny/rzeczywisty, 2 rzeczywisty/360, 3 rzeczywisty/365, 4 europejski 30/360.",
      },
    ],
  },
  {
    n: "DVAR",
    d: "Szacuje wariancję populacji na podstawie próby, używając liczb w polu rekordów, które spełniają określone warunki.",
    a: "Wariancja próby pasujących rekordów.",
    p: [
      {
        name: "baza_danych",
        detail:
          "Zakres komórek tworzących listę lub bazę danych; pierwszy wiersz zawiera etykiety dla każdej kolumny.\nPole",
      },
      {
        name: ".",
        detail:
          "Etykieta kolumny w podwójnym cudzysłowie lub liczba reprezentująca położenie kolumny.",
      },
      {
        name: "kryteria",
        detail:
          "Zakres komórek zawierający warunki: co najmniej jedna etykieta kolumny i komórka pod nią.",
      },
    ],
  },
  {
    n: "DVARP",
    d: "Oblicza wariancję populacji na podstawie całej populacji, używając liczb w polu rekordów, które spełniają określone warunki.",
    a: "Wariancja populacji pasujących rekordów.",
    p: [
      {
        name: "baza_danych",
        detail:
          "Zakres komórek tworzących listę lub bazę danych; pierwszy wiersz zawiera etykiety dla każdej kolumny.\nPole",
      },
      {
        name: ".",
        detail:
          "Etykieta kolumny w podwójnym cudzysłowie lub liczba reprezentująca położenie kolumny.",
      },
      {
        name: "kryteria",
        detail:
          "Zakres komórek zawierający warunki: co najmniej jedna etykieta kolumny i komórka pod nią.",
      },
    ],
  },
  {
    n: "EDATE",
    d: "Zwraca liczbę kolejną daty będącej wskazaną liczbą miesięcy przed lub po dacie początkowej.",
    a: "Data za kilka miesięcy.",
    p: [
      {
        name: "data_rozpoczęcia",
        detail: "Data rozpoczęcia.",
      },
      {
        name: "miesiące",
        detail:
          "Liczba miesięcy przed (ujemna) lub po (dodatnia) `data_rozpoczęcia`.",
      },
    ],
  },
  {
    n: "EFFECT",
    d: "Zwraca efektywną roczną stopę procentową, biorąc pod uwagę nominalną roczną stopę procentową i liczbę okresów kapitalizacji w roku.",
    a: "Efektywna roczna stopa procentowa.",
    p: [
      {
        name: "stopa_nominalna",
        detail: "Nominalna stopa procentowa.",
      },
      {
        name: "okresy_w_roku",
        detail: "Liczba okresów kapitalizacji w roku.",
      },
    ],
  },
  {
    n: "ENCODEURL",
    d: "Zwraca ciąg zakodowany w adresie URL.",
    a: "Tekst kodowany w adresie URL.",
    p: [
      {
        name: "tekst",
        detail: "Ciąg znaków do kodowania adresu URL.",
      },
    ],
  },
  {
    n: "EOMONTH",
    d: "Zwraca liczbę kolejną dla ostatniego dnia miesiąca czyli wskazanej liczby miesięcy przed lub po data_rozpoczęcia.",
    a: "Ostatni dzień miesiąca.",
    p: [
      {
        name: "data_rozpoczęcia",
        detail: "Data rozpoczęcia.",
      },
      {
        name: "miesiące",
        detail:
          "Liczba miesięcy przed (ujemna) lub po (dodatnia) `data_rozpoczęcia`.",
      },
    ],
  },
  {
    n: "ERF",
    d: "Zwraca funkcję błędu zintegrowaną pomiędzy Dolna_granica i górna_granica.",
    a: "Funkcja błędu.",
    p: [
      {
        name: "Dolna_granica",
        detail: "Dolna granica całkowania ERF.",
      },
      {
        name: "górna_granica",
        detail:
          "Górna granica całkowania ERF; jeśli zostanie pominięty, integruje od 0 do `Dolna_granica`.",
      },
    ],
  },
  {
    n: "ERF.PRECISE",
    d: "Zwraca funkcję błędu zintegrowaną pomiędzy 0 a x.",
    a: "Funkcja błędu.",
    p: [
      {
        name: "x",
        detail: "Górna granica całkowania ERF.PRECISE.",
      },
    ],
  },
  {
    n: "ERFC",
    d: "Zwraca funkcję komplementarną ERF całkowaną pomiędzy x i nieskończonością.",
    a: "Dodatkowa funkcja błędu.",
    p: [
      {
        name: "x",
        detail: "Dolna granica całkowania ERFC.",
      },
    ],
  },
  {
    n: "ERFC.PRECISE",
    d: "Zwraca komplementarną funkcję błędu zintegrowaną pomiędzy x a nieskończonością.",
    a: "Dodatkowa funkcja błędu.",
    p: [
      {
        name: "x",
        detail: "Dolna granica całkowania ERFC.PRECISE.",
      },
    ],
  },
  {
    n: "ERROR.TYPE",
    d: "Zwraca numer odpowiadający błędowi: 1 #NULL!, 2 #DIV/0!, 3 #VALUE!, 4 #REF!, 5 #NAME?, 6 #NUM!, 7 #N/A; jeśli nie ma błędu, zwraca #N/A.",
    a: "Numer identyfikujący rodzaj błędu.",
    p: [
      {
        name: "wartość_błędu",
        detail: "Wartość błędu, którego numer identyfikacyjny chcesz znaleźć.",
      },
    ],
  },
  {
    n: "EUROCONVERT",
    d: "Konwertuje liczbę na euro, z euro na walutę państwa członkowskiego euro lub pomiędzy walutami członkowskimi euro, wykorzystując euro jako pośrednika.",
    a: "Przeliczanie walut euro.",
    p: [
      {
        name: "numer",
        detail: "Wartość waluty, którą chcesz przeliczyć.",
      },
      {
        name: "źródło",
        detail: 'Kod ISO waluty źródłowej, np.: "DEM".',
      },
      {
        name: "cel",
        detail: 'Kod ISO waluty docelowej, np.: "EUR".',
      },
      {
        name: "pełna_precyzja",
        detail:
          "TRUE aby zachować wszystkie cyfry znaczące; FALSE (domyślnie) zaokrągla do waluty.",
      },
      {
        name: "Precyzja_triangulacji",
        detail:
          "Miejsca dziesiętne (3 lub więcej) dla pośredniej wartości w euro.",
      },
    ],
  },
  {
    n: "EVEN",
    d: "Zaokrągla liczbę w górę od zera do najbliższej parzystej liczby całkowitej.",
    a: "Zaokrągla w górę do najbliższej parzystej liczby całkowitej.",
    p: [
      {
        name: "numer",
        detail: "Wartość do zaokrąglenia.",
      },
    ],
  },
  {
    n: "EXACT",
    d: "Porównuje dwa ciągi tekstowe i zwraca TRUE, jeśli są dokładnie takie same, FALSE w przeciwnym razie. Wielkość liter ma znaczenie.",
    a: "Sprawdza, czy dwa teksty są identyczne.",
    p: [
      {
        name: "tekst1",
        detail: "Pierwszy ciąg tekstowy.",
      },
      {
        name: "tekst2",
        detail: "Drugi ciąg tekstowy.",
      },
    ],
  },
  {
    n: "EXP",
    d: "Zwraca e podniesione do potęgi danej liczby.",
    a: "Liczba e podniesiona do podanej potęgi.",
    p: [
      {
        name: "numer",
        detail: "Wykładnik zastosowany do podstawy e (2,71828182845904).",
      },
    ],
  },
  {
    n: "EXPAND",
    d: "Rozwija lub wypełnia tablicę do określonych wymiarów wierszy i kolumn.",
    a: "Dopełnia tablicę do zadanego rozmiaru.",
    p: [
      {
        name: "tablica",
        detail: "Tablica do rozwinięcia.",
      },
      {
        name: "wiersze",
        detail: "Liczba wierszy rozwiniętej tablicy.",
      },
      {
        name: "kolumny",
        detail:
          "Liczba kolumn w rozwiniętej tablicy; domyślnie szerokość wynosi `tablica`.",
      },
      {
        name: "uzupełnij_wartością",
        detail: "Wartość do uzupełnienia; domyślnie #N/A.",
      },
    ],
  },
  {
    n: "EXPON.DIST",
    d: "Zwraca rozkład wykładniczy.",
    a: "Rozkład wykładniczy.",
    p: [
      {
        name: "x",
        detail: "Wartość funkcji.",
      },
      {
        name: "lambda",
        detail: "Wartość parametru.",
      },
      {
        name: "kumulatywne",
        detail:
          "TRUE zwraca funkcję rozkładu skumulowanego, FALSE funkcję gęstości prawdopodobieństwa.",
      },
    ],
  },
  {
    n: "EXPONDIST",
    d: "Zwraca rozkład wykładniczy. Zachowane ze względu na kompatybilność; zobacz EXPON.DIST.",
    a: "Rozkład wykładniczy (starsza wersja).",
    p: [
      {
        name: "x",
        detail: "Wartość funkcji.",
      },
      {
        name: "lambda",
        detail: "Wartość parametru.",
      },
      {
        name: "kumulatywne",
        detail:
          "TRUE zwraca funkcję rozkładu skumulowanego, FALSE funkcję gęstości prawdopodobieństwa.",
      },
    ],
  },
  {
    n: "F.DIST",
    d: "Zwraca (lewostronny) rozkład prawdopodobieństwa F, czyli stopień zróżnicowania pomiędzy dwoma zbiorami danych.",
    a: "Lewostronny rozkład F.",
    p: [
      {
        name: "x",
        detail: "Wartość, przy której funkcja ma zostać oszacowana.",
      },
      {
        name: "stopnie_swobody1",
        detail: "Licznik stopni swobody.",
      },
      {
        name: "stopnie_swobody2",
        detail: "Mianownik stopni swobody.",
      },
      {
        name: "kumulatywne",
        detail:
          "TRUE zwraca funkcję rozkładu skumulowanego, FALSE funkcję gęstości prawdopodobieństwa.",
      },
    ],
  },
  {
    n: "F.DIST.RT",
    d: "Zwraca prawostronny rozkład prawdopodobieństwa F, czyli stopień zróżnicowania pomiędzy dwoma zbiorami danych.",
    a: "Prawostronny rozkład F.",
    p: [
      {
        name: "x",
        detail: "Wartość, przy której funkcja ma zostać oszacowana.",
      },
      {
        name: "stopnie_swobody1",
        detail: "Licznik stopni swobody.",
      },
      {
        name: "stopnie_swobody2",
        detail: "Mianownik stopni swobody.",
      },
    ],
  },
  {
    n: "F.INV",
    d: "Zwraca odwrotność (lewostronnego) rozkładu prawdopodobieństwa F.",
    a: "Odwrotny lewostronny rozkład F.",
    p: [
      {
        name: "prawdopodobieństwo",
        detail: "Prawdopodobieństwo powiązane z rozkładem skumulowanym F.",
      },
      {
        name: "stopnie_swobody1",
        detail: "Licznik stopni swobody.",
      },
      {
        name: "stopnie_swobody2",
        detail: "Mianownik stopni swobody.",
      },
    ],
  },
  {
    n: "F.INV.RT",
    d: "Zwraca odwrotność prawostronnego rozkładu prawdopodobieństwa F.",
    a: "Odwrotny prawostronny rozkład F.",
    p: [
      {
        name: "prawdopodobieństwo",
        detail: "Prawdopodobieństwo powiązane z rozkładem skumulowanym F.",
      },
      {
        name: "stopnie_swobody1",
        detail: "Licznik stopni swobody.",
      },
      {
        name: "stopnie_swobody2",
        detail: "Mianownik stopni swobody.",
      },
    ],
  },
  {
    n: "F.TEST",
    d: "Zwraca wynik testu F, czyli dwustronne prawdopodobieństwo, że wariancje w dwóch tablicach nie różnią się znacząco.",
    a: "Wynik testu F.",
    p: [
      {
        name: "tablica1",
        detail: "Pierwsza tablica lub zakres danych.",
      },
      {
        name: "tablica2",
        detail: "Druga tablica lub zakres danych.",
      },
    ],
  },
  {
    n: "FACT",
    d: "Zwraca silnię liczby równą 1*2*3*...*liczba.",
    a: "Silnia liczby.",
    p: [
      {
        name: "numer",
        detail:
          "Liczba nieujemna, dla której chcesz uzyskać silnię; miejsca dziesiętne są obcinane.",
      },
    ],
  },
  {
    n: "FACTDOUBLE",
    d: "Zwraca podwójną silnię liczby.",
    a: "Podwójna silnia liczby.",
    p: [
      {
        name: "numer",
        detail:
          "Wartość, dla której ma zostać zwrócona silnia podwójna; miejsca dziesiętne są obcinane.",
      },
    ],
  },
  {
    n: "FALSE",
    d: "Zwraca wartość logiczną FALSE.",
    a: "Wartość logiczna FALSE.",
    p: [],
  },
  {
    n: "FDIST",
    d: "Zwraca prawostronny rozkład prawdopodobieństwa F. Zachowane ze względu na kompatybilność; zobacz F.DIST.RT.",
    a: "Prawostronny rozkład F (starsza wersja).",
    p: [
      {
        name: "x",
        detail: "Wartość, przy której funkcja ma zostać oszacowana.",
      },
      {
        name: "stopnie_swobody1",
        detail: "Licznik stopni swobody.",
      },
      {
        name: "stopnie_swobody2",
        detail: "Mianownik stopni swobody.",
      },
    ],
  },
  {
    n: "FILTER",
    d: "Filtruje zakres danych w oparciu o zdefiniowane przez Ciebie kryteria.",
    a: "Wiersze lub kolumny spełniające kryteria.",
    p: [
      {
        name: "tablica",
        detail: "Tablica lub zakres do filtrowania.",
      },
      {
        name: "zawiera",
        detail:
          "Tablica logiczna o tej samej wysokości lub szerokości co `tablica`, gdzie TRUE przechowuje wiersz lub kolumnę.",
      },
      {
        name: "jeśli_pusty",
        detail:
          "Wartość do zwrócenia, jeśli wszystkie wartości w dołączonej tablicy są puste (nic nie pasuje).",
      },
    ],
  },
  {
    n: "FIND",
    d: "Lokalizuje jeden ciąg tekstowy w drugim ciągu tekstowym i zwraca pozycję początkową pierwszego. Wielkość liter ma znaczenie, brak symboli wieloznacznych.",
    a: "Pozycja tekstu w tekście (wielkość liter ma znaczenie).",
    p: [
      {
        name: "szukany_tekst",
        detail: "Tekst, który chcesz znaleźć.",
      },
      {
        name: "w_tekście",
        detail: "Tekst zawierający tekst, który chcesz znaleźć.",
      },
      {
        name: "pozycja_początkowa",
        detail: "Znak, od którego należy rozpocząć wyszukiwanie; domyślnie 1.",
      },
    ],
  },
  {
    n: "FINDB",
    d: "Znajduje jeden ciąg tekstowy w innym i zwraca jego pozycję początkową, zliczając bajty (np. FIND, chyba że domyślnym językiem jest DBCS).",
    a: "Pozycja tekstu (w bajtach).",
    p: [
      {
        name: "szukany_tekst",
        detail: "Tekst, który chcesz znaleźć.",
      },
      {
        name: "w_tekście",
        detail: "Tekst zawierający tekst, który chcesz znaleźć.",
      },
      {
        name: "pozycja_początkowa",
        detail: "Znak, od którego należy rozpocząć wyszukiwanie.",
      },
    ],
  },
  {
    n: "FINV",
    d: "Zwraca odwrotność prawostronnego rozkładu prawdopodobieństwa F. Zachowane ze względu na kompatybilność; zobacz F.INV.RT.",
    a: "Odwrotny prawostronny rozkład F (starszy model).",
    p: [
      {
        name: "prawdopodobieństwo",
        detail: "Prawdopodobieństwo powiązane z rozkładem skumulowanym F.",
      },
      {
        name: "stopnie_swobody1",
        detail: "Licznik stopni swobody.",
      },
      {
        name: "stopnie_swobody2",
        detail: "Mianownik stopni swobody.",
      },
    ],
  },
  {
    n: "FISHER",
    d: "Zwraca transformację Fishera przy x.",
    a: "Transformacja Fishera.",
    p: [
      {
        name: "x",
        detail: "Wartość liczbowa większa niż -1 i mniejsza niż 1.",
      },
    ],
  },
  {
    n: "FISHERINV",
    d: "Zwraca odwrotność transformacji Fishera.",
    a: "Odwrotna transformacja Fishera.",
    p: [
      {
        name: "y",
        detail: "Wartość, dla której chcesz wykonać odwrotność transformacji.",
      },
    ],
  },
  {
    n: "FIXED",
    d: "Zaokrągla liczbę do określonej liczby miejsc po przecinku, formatuje ją w formacie dziesiętnym z kropkami i przecinkami i zwraca wynik w postaci tekstowej.",
    a: "Formatuje liczbę jako tekst ze stałymi miejscami dziesiętnymi.",
    p: [
      {
        name: "numer",
        detail: "Liczba, którą chcesz zaokrąglić i zamienić na tekst.",
      },
      {
        name: "miejsc_dziesiętnych",
        detail:
          "Liczba cyfr po prawej stronie przecinka dziesiętnego; domyślnie 2.",
      },
      {
        name: "bez_przecinków",
        detail:
          "TRUE uniemożliwia FIXED dołączanie przecinków w zwracanym tekście.",
      },
    ],
  },
  {
    n: "FLOOR",
    d: "Zaokrągla liczbę w dół, w kierunku zera, do najbliższej wielokrotności istotności.",
    a: "Zaokrągla w dół do najbliższej wielokrotności.",
    p: [
      {
        name: "numer",
        detail: "Wartość liczbowa, którą chcesz zaokrąglić.",
      },
      {
        name: "wielokrotność",
        detail: "Wielokrotność, do której chcesz zaokrąglić.",
      },
    ],
  },
  {
    n: "FLOOR.MATH",
    d: "Zaokrągla liczbę w dół do najbliższej liczby całkowitej lub najbliższej wielokrotności istotności, z kontrolą kierunku w przypadku liczb ujemnych.",
    a: "Zaokrągla w dół do najbliższej liczby całkowitej lub wielokrotności.",
    p: [
      {
        name: "numer",
        detail: "Liczba, która ma zostać zaokrąglona w dół.",
      },
      {
        name: "wielokrotność",
        detail:
          "Wielokrotność, do której należy zaokrąglić; domyślnie 1.\nTryb",
      },
      {
        name: "tryb",
        detail:
          "W przypadku liczb ujemnych wartość różna od zera zaokrągla się w stronę zera; 0 lub pominięte zaokrąglenia od zera.",
      },
    ],
  },
  {
    n: "FLOOR.PRECISE",
    d: "Zaokrągla liczbę w dół do najbliższej liczby całkowitej lub najbliższej wielokrotności istotności, niezależnie od znaku liczby.",
    a: "Zaokrągla w dół niezależnie od znaku.",
    p: [
      {
        name: "numer",
        detail: "Wartość do zaokrąglenia.",
      },
      {
        name: "wielokrotność",
        detail:
          "Wielokrotność, do której zaokrąglana jest liczba; domyślnie 1. Jego znak jest ignorowany.",
      },
    ],
  },
  {
    n: "FORECAST",
    d: "Oblicza lub przewiduje przyszłą wartość przy użyciu istniejących wartości i regresji liniowej. Zachowane ze względu na kompatybilność; zobacz FORECAST.LINEAR.",
    a: "Przewiduje wartość metodą regresji liniowej.",
    p: [
      {
        name: "x",
        detail: "Punkt danych, dla którego chcesz przewidzieć wartość.",
      },
      {
        name: "znane_y",
        detail: "Zależna tablica lub zakres danych.",
      },
      {
        name: "znane_x",
        detail: "Niezależna tablica lub zakres danych.",
      },
    ],
  },
  {
    n: "FORECAST.ETS",
    d: "Prognozuje przyszłą wartość na podstawie wartości historycznych przy użyciu addytywnego wygładzania wykładniczego (wersja AAA ETS).",
    a: "Prognoza wygładzania wykładniczego.",
    p: [
      {
        name: "data_docelowa",
        detail: "Data lub liczba, dla której prognozowana jest wartość.",
      },
      {
        name: "wartości",
        detail: "Wartości historyczne, na podstawie których można prognozować.",
      },
      {
        name: "oś_czasu",
        detail: "Daty lub numery wartości historycznych, ze stałym krokiem.",
      },
      {
        name: "sezonowość",
        detail:
          "Długość wzorca sezonowego: 1 lub pominięty wykrywa go, 0 oznacza brak.",
      },
      {
        name: "Uzupełnianie_danych",
        detail:
          "1 (domyślnie) interpoluje brakujące punkty, 0 traktuje je jako zera.",
      },
      {
        name: "agregacja",
        detail:
          "Sposób łączenia wartości z tym samym znacznikiem czasu: 1 AVERAGE (domyślnie) do 7 SUM.",
      },
    ],
  },
  {
    n: "FORECAST.ETS.CONFINT",
    d: "Zwraca połowę szerokości przedziału ufności dla prognozy FORECAST.ETS.",
    a: "Przedział ufności prognozy ETS.",
    p: [
      {
        name: "data_docelowa",
        detail: "Data lub numer, na który dotyczy prognoza.",
      },
      {
        name: "wartości",
        detail: "Wartości historyczne, na podstawie których można prognozować.",
      },
      {
        name: "oś_czasu",
        detail: "Daty lub numery wartości historycznych, ze stałym krokiem.",
      },
      {
        name: "poziom_ufności",
        detail: "Poziom ufności pomiędzy 0 a 1; domyślnie 0,95.",
      },
      {
        name: "sezonowość",
        detail:
          "Długość wzorca sezonowego: 1 lub pominięty wykrywa go, 0 oznacza brak.",
      },
      {
        name: "Uzupełnianie_danych",
        detail:
          "1 (domyślnie) interpoluje brakujące punkty, 0 traktuje je jako zera.",
      },
      {
        name: "agregacja",
        detail:
          "Sposób łączenia wartości z tym samym znacznikiem czasu: 1 AVERAGE (domyślnie) do 7 SUM.",
      },
    ],
  },
  {
    n: "FORECAST.ETS.SEASONALITY",
    d: "Zwraca długość powtarzalnego wzorca wykrytego przez FORECAST.ETS w szeregu czasowym.",
    a: "Wykryta długość sezonowości.",
    p: [
      {
        name: "wartości",
        detail: "Wartości historyczne, na podstawie których można prognozować.",
      },
      {
        name: "oś_czasu",
        detail: "Daty lub numery wartości historycznych, ze stałym krokiem.",
      },
      {
        name: "Uzupełnianie_danych",
        detail:
          "1 (domyślnie) interpoluje brakujące punkty, 0 traktuje je jako zera.",
      },
      {
        name: "agregacja",
        detail:
          "Sposób łączenia wartości z tym samym znacznikiem czasu: 1 AVERAGE (domyślnie) do 7 SUM.",
      },
    ],
  },
  {
    n: "FORECAST.ETS.STAT",
    d: "Zwraca statystykę modelu FORECAST.ETS: 1 alfa, 2 beta, 3 gamma, 4 MASE, 5 SMAPE, 6 MAE, 7 RMSE, 8 kroków.",
    a: "Statystyka prognozy ETS.",
    p: [
      {
        name: "wartości",
        detail: "Wartości historyczne, na podstawie których można prognozować.",
      },
      {
        name: "oś_czasu",
        detail: "Daty lub numery wartości historycznych, ze stałym krokiem.",
      },
      {
        name: "typ_statystyki",
        detail: "Która statystyka ma zostać zwrócona, od 1 do 8.",
      },
      {
        name: "sezonowość",
        detail:
          "Długość wzorca sezonowego: 1 lub pominięty wykrywa go, 0 oznacza brak.",
      },
      {
        name: "Uzupełnianie_danych",
        detail:
          "1 (domyślnie) interpoluje brakujące punkty, 0 traktuje je jako zera.",
      },
      {
        name: "agregacja",
        detail:
          "Sposób łączenia wartości z tym samym znacznikiem czasu: 1 AVERAGE (domyślnie) do 7 SUM.",
      },
    ],
  },
  {
    n: "FORECAST.LINEAR",
    d: "Oblicza lub przewiduje przyszłą wartość, korzystając z istniejących wartości i regresji liniowej.",
    a: "Przewiduje wartość metodą regresji liniowej.",
    p: [
      {
        name: "x",
        detail: "Punkt danych, dla którego chcesz przewidzieć wartość.",
      },
      {
        name: "znane_y",
        detail: "Zależna tablica lub zakres danych.",
      },
      {
        name: "znane_x",
        detail: "Niezależna tablica lub zakres danych.",
      },
    ],
  },
  {
    n: "FORMULATEXT",
    d: "Zwraca formułę w postaci ciągu znaków.",
    a: "Formuła komórki jako tekst.",
    p: [
      {
        name: "odniesienie",
        detail: "Odniesienie do komórki lub zakresu komórek.",
      },
    ],
  },
  {
    n: "FREQUENCY",
    d: "Oblicza, jak często wartości występują w zakresach wartości i zwraca tablicę pionową zawierającą o jeden element więcej niż granice_przedziałów.",
    a: "Rozkład częstotliwości wartości.",
    p: [
      {
        name: "tablica_danych",
        detail:
          "Tablica lub zakres wartości, dla których chcesz policzyć częstotliwości.",
      },
      {
        name: "granice_przedziałów",
        detail:
          "Tablica lub zakres przedziałów, w które chcesz pogrupować wartości.",
      },
    ],
  },
  {
    n: "FTEST",
    d: "Zwraca wynik testu F. Zachowane ze względu na kompatybilność; zobacz F.TEST.",
    a: "Wynik testu F (starsza wersja).",
    p: [
      {
        name: "tablica1",
        detail: "Pierwsza tablica lub zakres danych.",
      },
      {
        name: "tablica2",
        detail: "Druga tablica lub zakres danych.",
      },
    ],
  },
  {
    n: "FV",
    d: "Oblicza przyszłą wartość inwestycji w oparciu o stałą stopę procentową, z okresowymi stałymi opłatami lub jednorazową kwotą ryczałtową.",
    a: "Przyszła wartość inwestycji.",
    p: [
      {
        name: "stawka",
        detail: "Stopa procentowa za okres.",
      },
      {
        name: "liczba_okresów",
        detail: "Całkowita liczba okresów płatności.",
      },
      {
        name: "płatność",
        detail:
          "Płatność dokonywana w każdym okresie; nie może się ona zmienić w trakcie trwania renty.",
      },
      {
        name: "wartość_bieżąca",
        detail:
          "Wartość bieżąca lub kwota ryczałtowa, jaką w tej chwili jest warta seria przyszłych płatności; domyślnie wynosi 0.",
      },
      {
        name: "typ",
        detail:
          "Kiedy płatności są wymagalne: 0 lub pominięte na koniec okresu, 1 na początku.",
      },
    ],
  },
  {
    n: "FVSCHEDULE",
    d: "Zwraca przyszłą wartość początkowego kapitału po zastosowaniu serii składanych stóp procentowych.",
    a: "Przyszła wartość ze zmiennymi stawkami.",
    p: [
      {
        name: "kapitał",
        detail: "Wartość bieżąca.",
      },
      {
        name: "stopy_okresów",
        detail: "Tablica stóp procentowych do zastosowania.",
      },
    ],
  },
  {
    n: "GAMMA",
    d: "Zwraca wartość funkcji gamma.",
    a: "Wartość funkcji gamma.",
    p: [
      {
        name: "x",
        detail: "Liczba, dla której należy obliczyć współczynnik gamma.",
      },
    ],
  },
  {
    n: "GAMMA.DIST",
    d: "Zwraca rozkład gamma.",
    a: "Rozkład gamma.",
    p: [
      {
        name: "x",
        detail: "Wartość, dla której chcesz oszacować rozkład.",
      },
      {
        name: "alfa",
        detail: "Parametr rozkładu.",
      },
      {
        name: "beta",
        detail: "Parametr rozkładu. Jeśli 1, zwraca standardowy rozkład gamma.",
      },
      {
        name: "kumulatywne",
        detail:
          "TRUE zwraca funkcję rozkładu skumulowanego, FALSE funkcję gęstości prawdopodobieństwa.",
      },
    ],
  },
  {
    n: "GAMMA.INV",
    d: "Zwraca odwrotność skumulowanego rozkładu gamma.",
    a: "Odwrotny rozkład gamma.",
    p: [
      {
        name: "prawdopodobieństwo",
        detail: "Prawdopodobieństwo związane z rozkładem gamma.",
      },
      {
        name: "alfa",
        detail: "Parametr rozkładu.",
      },
      {
        name: "beta",
        detail: "Parametr rozkładu.",
      },
    ],
  },
  {
    n: "GAMMADIST",
    d: "Zwraca rozkład gamma. Zachowane ze względu na kompatybilność; zobacz GAMMA.DIST.",
    a: "Rozkład gamma (starsza wersja).",
    p: [
      {
        name: "x",
        detail: "Wartość, dla której chcesz oszacować rozkład.",
      },
      {
        name: "alfa",
        detail: "Parametr rozkładu.",
      },
      {
        name: "beta",
        detail: "Parametr rozkładu.",
      },
      {
        name: "kumulatywne",
        detail:
          "TRUE zwraca funkcję rozkładu skumulowanego, FALSE funkcję gęstości prawdopodobieństwa.",
      },
    ],
  },
  {
    n: "GAMMAINV",
    d: "Zwraca odwrotność skumulowanego rozkładu gamma. Zachowane ze względu na kompatybilność; zobacz GAMMA.INV.",
    a: "Odwrotny rozkład gamma (starsza wersja).",
    p: [
      {
        name: "prawdopodobieństwo",
        detail: "Prawdopodobieństwo związane z rozkładem gamma.",
      },
      {
        name: "alfa",
        detail: "Parametr rozkładu.",
      },
      {
        name: "beta",
        detail: "Parametr rozkładu.",
      },
    ],
  },
  {
    n: "GAMMALN",
    d: "Zwraca logarytm naturalny funkcji gamma.",
    a: "Logarytm naturalny gamma.",
    p: [
      {
        name: "x",
        detail: "Wartość dla której chcesz obliczyć GAMMALN.",
      },
    ],
  },
  {
    n: "GAMMALN.PRECISE",
    d: "Zwraca logarytm naturalny funkcji gamma.",
    a: "Logarytm naturalny gamma.",
    p: [
      {
        name: "x",
        detail: "Wartość dla której chcesz obliczyć GAMMALN.PRECISE.",
      },
    ],
  },
  {
    n: "GAUSS",
    d: "Oblicza prawdopodobieństwo, że członek standardowej populacji normalnej będzie mieścił się pomiędzy średnią a z odchyleniami standardowymi od średniej.",
    a: "Prawdopodobieństwo między średnią a z w standardowym rozkładzie normalnym.",
    p: [
      {
        name: "z",
        detail: "Liczba odchyleń standardowych od średniej.",
      },
    ],
  },
  {
    n: "GCD",
    d: "Zwraca największy wspólny dzielnik dwóch lub więcej liczb całkowitych.",
    a: "Największy wspólny dzielnik.",
    p: [
      {
        name: "numer_1",
        detail: "Pierwsza wartość lub zakres; miejsca dziesiętne są obcinane.",
      },
      {
        name: "numer2",
        detail: "Dodatkowe wartości lub zakresy, łącznie do 255.",
      },
    ],
  },
  {
    n: "GEOMEAN",
    d: "Zwraca średnią geometryczną tablicy lub zakresu danych dodatnich.",
    a: "Średnia geometryczna.",
    p: [
      {
        name: "numer_1",
        detail: "Pierwsza liczba lub zakres.",
      },
      {
        name: "numer2",
        detail: "Dodatkowe numery lub zakresy, łącznie do 255.",
      },
    ],
  },
  {
    n: "GESTEP",
    d: "Zwraca 1 jeśli liczba jest większa lub równa krokowi; w przeciwnym razie zwraca 0.",
    a: "Sprawdza, czy liczba stanowi co najmniej próg.",
    p: [
      {
        name: "numer",
        detail: "Wartość do sprawdzenia względem `krok`.",
      },
      {
        name: "krok",
        detail: "Wartość progowa; domyślnie wynosi 0.",
      },
    ],
  },
  {
    n: "GETPIVOTDATA",
    d: "Zwraca dane zapisane w raporcie w formie tabeli przestawnej: wartość pola danych dla podanych par pole/element.",
    a: "Wartość z tabeli przestawnej.",
    p: [
      {
        name: "pole_danych",
        detail: 'Nazwa pola wartości, np.: `"Sales"` lub `"Sum of Sales"`.',
      },
      {
        name: "tabela_przestawna",
        detail: "Odniesienie do dowolnej komórki tabeli przestawnej.",
      },
      {
        name: "pole1",
        detail: "Pole zawierające wiersze lub kolumny tabeli przestawnej.",
      },
      {
        name: "poz.1",
        detail: "Element `pole1`, dla którego ma zostać zwrócona wartość.",
      },
    ],
  },
  {
    n: "GROUPBY",
    d: "Grupuje wiersze według wartości jednego lub większej liczby pól i agreguje wartości każdej grupy, z opcjonalnymi nagłówkami, sumami, sortowaniem i filtrowaniem.",
    a: "Grupuj i agreguj wiersze.",
    p: [
      {
        name: "pola_wierszy",
        detail:
          "Wartości zorientowane kolumnowo do grupowania; kilka kolumn tworzy hierarchię.",
      },
      {
        name: "wartości",
        detail: "Wartości zorientowane kolumnowo do agregacji.\nFunkcja",
      },
      {
        name: ".",
        detail:
          "LAMBDA lub nazwa funkcji (SUM, AVERAGE, COUNT, PERCENTOF, ...), która agreguje każdą grupę; kilka jako HSTACK lub tablica.",
      },
      {
        name: "nagłówki_pól",
        detail:
          "Czy dane mają nagłówki i czy je pokazać: 0 nie, 1 tak, ale ukryj, 2 nie, ale wygeneruj, 3 tak i pokaż.",
      },
      {
        name: "poziom_sum",
        detail:
          "Sumy: 0 brak, 1 suma całkowita (domyślnie), 2 sumy częściowe i częściowe; wartość ujemna stawia je na szczycie.",
      },
      {
        name: "Porządek_sortowania",
        detail: "Numery kolumn do sortowania, ujemne dla malejącego.",
      },
      {
        name: "tablica_filtrów",
        detail:
          "Wartość logiczna określająca, które wiersze mają zostać uwzględnione.",
      },
      {
        name: "zależność_pola",
        detail:
          "0 hierarchii (domyślnie) lub 1 tabela dla kilku pól wierszowych.",
      },
    ],
  },
  {
    n: "GROWTH",
    d: "Oblicza przewidywany wzrost wykładniczy przy użyciu istniejących danych, zwracając wartości y dla serii nowych wartości x.",
    a: "Przewidywany wzrost wykładniczy.",
    p: [
      {
        name: "znane_y",
        detail: "Znany już zbiór wartości y w zależności y = b*m^x.",
      },
      {
        name: "znane_x",
        detail: "Opcjonalny zestaw wartości x, który być może już znasz.",
      },
      {
        name: "nowe_x",
        detail:
          "Nowe wartości x, dla których chcesz, aby GROWTH zwracało odpowiednie wartości y.",
      },
      {
        name: "stała",
        detail:
          "TRUE lub pominięty oblicza b normalnie; FALSE wymusza b równe 1.",
      },
    ],
  },
  {
    n: "HARMEAN",
    d: "Zwraca średnią harmoniczną zbioru danych, odwrotność średniej arytmetycznej odwrotności.",
    a: "Średnia harmoniczna.",
    p: [
      {
        name: "numer_1",
        detail: "Pierwsza liczba lub zakres.",
      },
      {
        name: "numer2",
        detail: "Dodatkowe numery lub zakresy, łącznie do 255.",
      },
    ],
  },
  {
    n: "HEX2BIN",
    d: "Konwertuje liczbę szesnastkową na binarną.",
    a: "Konwersja z systemu szesnastkowego na dwójkowy.",
    p: [
      {
        name: "numer",
        detail: "Liczba szesnastkowa do konwersji; maksymalnie 10 znaków.",
      },
      {
        name: "liczba_miejsc",
        detail:
          "Liczba znaków do użycia; wynik jest uzupełniany zerami wiodącymi.",
      },
    ],
  },
  {
    n: "HEX2DEC",
    d: "Konwertuje liczbę szesnastkową na dziesiętną.",
    a: "Konwersja z systemu szesnastkowego na dziesiętny.",
    p: [
      {
        name: "numer",
        detail:
          "Liczba szesnastkowa do konwersji; maksymalnie 10 znaków (40 bitów).",
      },
    ],
  },
  {
    n: "HEX2OCT",
    d: "Konwertuje liczbę szesnastkową na ósemkową.",
    a: "Konwersja z systemu szesnastkowego na ósemkowy.",
    p: [
      {
        name: "numer",
        detail: "Liczba szesnastkowa do konwersji; maksymalnie 10 znaków.",
      },
      {
        name: "liczba_miejsc",
        detail:
          "Liczba znaków do użycia; wynik jest uzupełniany zerami wiodącymi.",
      },
    ],
  },
  {
    n: "HLOOKUP",
    d: "Wyszukuje wartość w górnym wierszu tabeli lub tablicy i zwraca wartość w tej samej kolumnie z określonego wiersza.",
    a: "Wyszukiwanie poziome.",
    p: [
      {
        name: "szukana_wartość",
        detail: "Wartość znajdująca się w pierwszym wierszu tabeli.",
      },
      {
        name: "tablica_tabel",
        detail: "Tabela informacyjna, w której wyszukiwane są dane.",
      },
      {
        name: "indeks_wiersza",
        detail:
          "Numer wiersza w `tablica_tabel`, z którego zostanie zwrócona pasująca wartość.",
      },
      {
        name: "dopasowanie_przybliżone",
        detail:
          "TRUE lub pominięty znajduje przybliżone dopasowanie; FALSE znajduje dokładne dopasowanie.",
      },
    ],
  },
  {
    n: "HOUR",
    d: "Zwraca godzinę wartości czasu jako liczbę całkowitą od 0 (12:00) do 23 (23:00).",
    a: "Składowa godzinowa czasu.",
    p: [
      {
        name: "numer_seryjny",
        detail: "Czas zawierający godzinę, którą chcesz znaleźć.",
      },
    ],
  },
  {
    n: "HSTACK",
    d: "Dołącza tablice poziomo i po kolei, aby zwrócić większą tablicę.",
    a: "Układa tablice obok siebie.",
    p: [
      {
        name: "tablica1",
        detail: "Pierwsza tablica do dołączenia.",
      },
      {
        name: "tablica2",
        detail: "Dodatkowe tablice do dołączenia.",
      },
    ],
  },
  {
    n: "HYPERLINK",
    d: "Tworzy skrót, który przeskakuje do innej lokalizacji w bieżącym skoroszycie lub otwiera dokument lub stronę internetową.",
    a: "Tworzy hiperłącze.",
    p: [
      {
        name: "lokalizacja_łącza",
        detail:
          "Ścieżka i nazwa pliku dokumentu lub strony internetowej do otwarcia lub lokalizacja w skoroszycie.",
      },
      {
        name: "wyświetlana_nazwa",
        detail:
          "Tekst skoku lub wartość numeryczna wyświetlana w komórce; domyślnie `lokalizacja_łącza`.",
      },
    ],
  },
  {
    n: "HYPGEOM.DIST",
    d: "Zwraca rozkład hipergeometryczny, czyli prawdopodobieństwo określonej liczby sukcesów w próbie.",
    a: "Rozkład hipergeometryczny.",
    p: [
      {
        name: "sukcesy_w_próbie",
        detail: "Liczba sukcesów w próbie.",
      },
      {
        name: "wielkość_próby",
        detail: "Wielkość próbki.",
      },
      {
        name: "sukcesy_w_populacji",
        detail: "Liczba sukcesów w populacji.",
      },
      {
        name: "wielkość_populacji",
        detail: "Wielkość populacji.",
      },
      {
        name: "kumulatywne",
        detail:
          "TRUE zwraca funkcję rozkładu skumulowanego, FALSE funkcję masy prawdopodobieństwa.",
      },
    ],
  },
  {
    n: "HYPGEOMDIST",
    d: "Zwraca rozkład hipergeometryczny. Zachowane ze względu na kompatybilność; zobacz HYPGEOM.DIST.",
    a: "Rozkład hipergeometryczny (starsza wersja).",
    p: [
      {
        name: "sukcesy_w_próbie",
        detail: "Liczba sukcesów w próbie.",
      },
      {
        name: "wielkość_próby",
        detail: "Wielkość próbki.",
      },
      {
        name: "sukcesy_w_populacji",
        detail: "Liczba sukcesów w populacji.",
      },
      {
        name: "wielkość_populacji",
        detail: "Wielkość populacji.",
      },
    ],
  },
  {
    n: "IF",
    d: "Zwraca jedną wartość, jeśli wynik testu logicznego wynosi TRUE i inną wartość, jeśli wynik testu logicznego wynosi FALSE.",
    a: "Wybiera wartość na podstawie warunku.",
    p: [
      {
        name: "test_logiczny",
        detail: "Warunek, który chcesz przetestować.",
      },
      {
        name: "wartość,_jeśli_jest_prawdziwa",
        detail: "Wartość do zwrócenia, jeśli `test_logiczny` wynosi TRUE.",
      },
      {
        name: "wartość,_jeśli_jest_fałszywa",
        detail:
          "Wartość do zwrócenia, jeśli `test_logiczny` wynosi FALSE; domyślnie FALSE.",
      },
    ],
  },
  {
    n: "IFERROR",
    d: "Zwraca określoną wartość, jeśli formuła zakończy się błędem; w przeciwnym razie zwraca wynik formuły.",
    a: "Wartość zastępcza w przypadku błędu.\nWartość",
    p: [
      {
        name: ".",
        detail: "Argument sprawdzany pod kątem błędu.",
      },
      {
        name: "wartość_w_przypadku_błędu",
        detail:
          "Wartość zwracana, jeśli `.` jest błędem (#N/A, #VALUE!, #REF!, #DIV/0!, #NUM!, #NAME? lub #NULL!).",
      },
    ],
  },
  {
    n: "IFNA",
    d: "Zwraca podaną wartość, jeśli wyrażenie ma postać #N/A; w przeciwnym razie zwraca wynik wyrażenia.",
    a: "Wartość rezerwowa na #N/A.",
    p: [
      {
        name: ".",
        detail: "Argument sprawdzany pod kątem wartości błędu #N/A.",
      },
      {
        name: "wartość_dla_NA",
        detail: "Wartość do zwrócenia, jeśli `.` ma wartość #N/A.",
      },
    ],
  },
  {
    n: "IFS",
    d: "Sprawdza, czy spełniony jest jeden lub więcej warunków i zwraca wartość odpowiadającą pierwszemu warunkowi TRUE.",
    a: "Wartość pierwszego warunku TRUE.",
    p: [
      {
        name: "test_logiczny1",
        detail: "Pierwszy warunek, którego wynikiem jest TRUE lub FALSE.",
      },
      {
        name: "wartość_dla_TRUE1",
        detail: "Wynik do zwrócenia, jeśli `test_logiczny1` wynosi TRUE.",
      },
      {
        name: "test_logiczny2",
        detail: "Warunki dodatkowe, do 127 par warunek/wartość.",
      },
      {
        name: "wartość_dla_TRUE2",
        detail: "Wynik do zwrócenia, jeśli odpowiedni warunek to TRUE.",
      },
    ],
  },
  {
    n: "IMABS",
    d: "Zwraca wartość bezwzględną (moduł) liczby zespolonej w formacie tekstowym x + yi lub x + yj.",
    a: "Wartość bezwzględna liczby zespolonej.",
    p: [
      {
        name: "liczba_zespolona",
        detail:
          "Liczba zespolona, dla której chcesz uzyskać wartość bezwzględną.",
      },
    ],
  },
  {
    n: "IMAGE",
    d: "Wstawia do komórki obraz z lokalizacji źródłowej (adres URL https lub data:image) z tekstem alternatywnym.",
    a: "Obraz z adresu URL.",
    p: [
      {
        name: "źródło",
        detail: "Adres URL obrazka (https:// lub adres URL data:image).",
      },
      {
        name: "tekst_alternatywny",
        detail: "Tekst alternatywny opisujący obraz.",
      },
      {
        name: "wymiarowanie",
        detail:
          "Wymiary obrazu: 0 dopasowania, 1 wypełnienie, 2 oryginały, 3 niestandardowe.",
      },
      {
        name: "wysokość",
        detail: "Niestandardowa wysokość w pikselach (rozmiar 3).",
      },
      {
        name: "szerokość",
        detail: "Niestandardowa szerokość w pikselach (rozmiar 3).",
      },
    ],
  },
  {
    n: "IMAGINARY",
    d: "Zwraca urojony współczynnik liczby zespolonej w formacie tekstowym x + yi lub x + yj.",
    a: "Urojony współczynnik liczby zespolonej.",
    p: [
      {
        name: "liczba_zespolona",
        detail:
          "Liczba zespolona, ​​dla której chcesz uzyskać urojony współczynnik.",
      },
    ],
  },
  {
    n: "IMARGUMENT",
    d: "Zwraca argument theta, kąt wyrażony w radianach, liczby zespolonej.",
    a: "Argument (kąt) liczby zespolonej.",
    p: [
      {
        name: "liczba_zespolona",
        detail: "Liczba zespolona, ​​dla której chcesz podać argument.",
      },
    ],
  },
  {
    n: "IMCONJUGATE",
    d: "Zwraca sprzężoną liczbę zespoloną liczby zespolonej w formacie tekstowym x + yi lub x + yj.",
    a: "Koniugat złożony.",
    p: [
      {
        name: "liczba_zespolona",
        detail: "Liczba zespolona, ​​dla której chcesz uzyskać koniugat.",
      },
    ],
  },
  {
    n: "IMCOS",
    d: "Zwraca cosinus liczby zespolonej w formacie tekstowym x + yi lub x + yj.",
    a: "Cosinus liczby zespolonej.",
    p: [
      {
        name: "liczba_zespolona",
        detail: "Liczba zespolona, ​​dla której chcesz uzyskać cosinus.",
      },
    ],
  },
  {
    n: "IMCOSH",
    d: "Zwraca cosinus hiperboliczny liczby zespolonej w formacie tekstowym x + yi lub x + yj.",
    a: "Cosinus hiperboliczny liczby zespolonej.",
    p: [
      {
        name: "liczba_zespolona",
        detail:
          "Liczba zespolona, ​​dla której chcesz uzyskać cosinus hiperboliczny.",
      },
    ],
  },
  {
    n: "IMCOT",
    d: "Zwraca cotangens liczby zespolonej w formacie tekstowym x + yi lub x + yj.",
    a: "Cotangens liczby zespolonej.",
    p: [
      {
        name: "liczba_zespolona",
        detail: "Liczba zespolona, ​​dla której chcesz uzyskać cotangens.",
      },
    ],
  },
  {
    n: "IMCSC",
    d: "Zwraca cosecans liczby zespolonej w formacie tekstowym x + yi lub x + yj.",
    a: "Cosecans liczby zespolonej.",
    p: [
      {
        name: "liczba_zespolona",
        detail: "Liczba zespolona, ​​dla której chcesz mieć cosecans.",
      },
    ],
  },
  {
    n: "IMCSCH",
    d: "Zwraca cosecans hiperboliczny liczby zespolonej w formacie tekstowym x + yi lub x + yj.",
    a: "Cosekans hiperboliczny liczby zespolonej.",
    p: [
      {
        name: "liczba_zespolona",
        detail:
          "Liczba zespolona, ​​dla której chcesz mieć współsekans hiperboliczny.",
      },
    ],
  },
  {
    n: "IMDIV",
    d: "Zwraca iloraz dwóch liczb zespolonych w formacie tekstowym x + yi lub x + yj.",
    a: "Iloraz dwóch liczb zespolonych.",
    p: [
      {
        name: "liczba_zespolona1",
        detail: "Licznik zespolony lub dywidenda.",
      },
      {
        name: "liczba_zespolona2",
        detail: "Zespolony mianownik lub dzielnik.",
      },
    ],
  },
  {
    n: "IMEXP",
    d: "Zwraca wykładniczą liczbę zespoloną w formacie tekstowym x + yi lub x + yj.",
    a: "Wykładniczy liczby zespolonej.",
    p: [
      {
        name: "liczba_zespolona",
        detail: "Liczba zespolona, ​​dla której chcesz mieć wykładniczą wartość.",
      },
    ],
  },
  {
    n: "IMLN",
    d: "Zwraca logarytm naturalny liczby zespolonej w formacie tekstowym x + yi lub x + yj.",
    a: "Logarytm naturalny liczby zespolonej.",
    p: [
      {
        name: "liczba_zespolona",
        detail:
          "Liczba zespolona, ​​dla której potrzebny jest logarytm naturalny.",
      },
    ],
  },
  {
    n: "IMLOG10",
    d: "Zwraca logarytm wspólny (o podstawie 10) liczby zespolonej w formacie tekstowym x + yi lub x + yj.",
    a: "Logarytm o podstawie 10 liczby zespolonej.",
    p: [
      {
        name: "liczba_zespolona",
        detail: "Liczba zespolona, ​​dla której chcesz mieć logarytm wspólny.",
      },
    ],
  },
  {
    n: "IMLOG2",
    d: "Zwraca logarytm o podstawie 2 liczby zespolonej w formacie tekstowym x + yi lub x + yj.",
    a: "Logarytm o podstawie 2 liczby zespolonej.",
    p: [
      {
        name: "liczba_zespolona",
        detail:
          "Liczba zespolona, ​​dla której potrzebny jest logarytm o podstawie 2.",
      },
    ],
  },
  {
    n: "IMPOWER",
    d: "Zwraca liczbę zespoloną w formacie tekstowym x + yi lub x + yj podniesioną do potęgi.",
    a: "Liczba zespolona podniesiona do potęgi.",
    p: [
      {
        name: "liczba_zespolona",
        detail: "Liczba zespolona, ​​którą chcesz podnieść do potęgi.",
      },
      {
        name: "numer",
        detail: "Potęga, do której chcesz podnieść liczbę zespoloną.",
      },
    ],
  },
  {
    n: "IMPRODUCT",
    d: "Zwraca iloczyn od 1 do 255 liczb zespolonych w formacie tekstowym x + yi lub x + yj.",
    a: "Iloczyn liczb zespolonych.",
    p: [
      {
        name: "liczba_zespolona1",
        detail: "Pierwsza liczba zespolona do pomnożenia.",
      },
      {
        name: "liczba_zespolona2",
        detail: "Dodatkowe liczby zespolone do pomnożenia, łącznie do 255.",
      },
    ],
  },
  {
    n: "IMREAL",
    d: "Zwraca rzeczywisty współczynnik liczby zespolonej w formacie tekstowym x + yi lub x + yj.",
    a: "Współczynnik rzeczywisty liczby zespolonej.",
    p: [
      {
        name: "liczba_zespolona",
        detail:
          "Liczba zespolona, ​​dla której chcesz uzyskać rzeczywisty współczynnik.",
      },
    ],
  },
  {
    n: "IMSEC",
    d: "Zwraca secans liczby zespolonej w formacie tekstowym x + yi lub x + yj.",
    a: "Sekans liczby zespolonej.",
    p: [
      {
        name: "liczba_zespolona",
        detail: "Liczba zespolona, ​​dla której chcesz uzyskać sieczną.",
      },
    ],
  },
  {
    n: "IMSECH",
    d: "Zwraca secans hiperboliczny liczby zespolonej w formacie tekstowym x + yi lub x + yj.",
    a: "Sekans hiperboliczny liczby zespolonej.",
    p: [
      {
        name: "liczba_zespolona",
        detail:
          "Liczba zespolona, ​​dla której chcesz uzyskać sieczną hiperboliczną.",
      },
    ],
  },
  {
    n: "IMSIN",
    d: "Zwraca sinus liczby zespolonej w formacie tekstowym x + yi lub x + yj.",
    a: "Sinus liczby zespolonej.",
    p: [
      {
        name: "liczba_zespolona",
        detail: "Liczba zespolona, ​​dla której chcesz uzyskać sinus.",
      },
    ],
  },
  {
    n: "IMSINH",
    d: "Zwraca sinus hiperboliczny liczby zespolonej w formacie tekstowym x + yi lub x + yj.",
    a: "Sinus hiperboliczny liczby zespolonej.",
    p: [
      {
        name: "liczba_zespolona",
        detail: "Liczba zespolona, ​​dla której chcesz mieć sinus hiperboliczny.",
      },
    ],
  },
  {
    n: "IMSQRT",
    d: "Zwraca pierwiastek kwadratowy liczby zespolonej w formacie tekstowym x + yi lub x + yj.",
    a: "Pierwiastek kwadratowy z liczby zespolonej.",
    p: [
      {
        name: "liczba_zespolona",
        detail: "Liczba zespolona, ​​dla której chcesz pierwiastek kwadratowy.",
      },
    ],
  },
  {
    n: "IMSUB",
    d: "Zwraca różnicę dwóch liczb zespolonych w formacie tekstowym x + yi lub x + yj.",
    a: "Różnica dwóch liczb zespolonych.",
    p: [
      {
        name: "liczba_zespolona1",
        detail: "Liczba zespolona, ​​od której należy odjąć `liczba_zespolona2`.",
      },
      {
        name: "liczba_zespolona2",
        detail: "Liczba zespolona do odjęcia od `liczba_zespolona1`.",
      },
    ],
  },
  {
    n: "IMSUM",
    d: "Zwraca sumę dwóch lub więcej liczb zespolonych w formacie tekstowym x + yi lub x + yj.",
    a: "Suma liczb zespolonych.",
    p: [
      {
        name: "liczba_zespolona1",
        detail: "Pierwsza liczba zespolona do dodania.",
      },
      {
        name: "liczba_zespolona2",
        detail: "Dodatkowe liczby zespolone do dodania, łącznie do 255.",
      },
    ],
  },
  {
    n: "IMTAN",
    d: "Zwraca tangens liczby zespolonej w formacie tekstowym x + yi lub x + yj.",
    a: "Tangens liczby zespolonej.",
    p: [
      {
        name: "liczba_zespolona",
        detail: "Liczba zespolona, ​​dla której chcesz uzyskać tangens.",
      },
    ],
  },
  {
    n: "INDEX",
    d: "Zwraca wartość elementu w tabeli lub tablicy, wybranej na podstawie indeksów numerów wierszy i kolumn.",
    a: "Wartość w wierszu i kolumnie zakresu.",
    p: [
      {
        name: "tablica",
        detail: "Zakres komórek lub stała tablicowa.",
      },
      {
        name: "numer_wiersza",
        detail: "Wiersz w `tablica`, z którego ma zostać zwrócona wartość.",
      },
      {
        name: "nr_kolumny",
        detail: "Kolumna w `tablica`, z której ma zostać zwrócona wartość.",
      },
    ],
  },
  {
    n: "INDIRECT",
    d: "Zwraca referencję określoną przez ciąg tekstowy. Odniesienia są natychmiast oceniane w celu wyświetlenia ich zawartości.",
    a: "Odniesienie z ciągu tekstowego.",
    p: [
      {
        name: "tekst_odwołania",
        detail:
          "Odwołanie do komórki zawierające odwołanie w stylu A1 lub R1C1, nazwę zdefiniowaną jako odwołanie lub odwołanie w postaci ciągu tekstowego.",
      },
      {
        name: "a1",
        detail:
          "TRUE lub pominięty interpretuje `tekst_odwołania` jako odniesienie w stylu A1; FALSE w stylu R1C1.",
      },
    ],
  },
  {
    n: "INFO",
    d: "Zwraca informacje o bieżącym środowisku pracy według podanego typu: directory, numfile, origin, osversion, recalc, release, system.",
    a: "Informacje o środowisku pracy.",
    p: [
      {
        name: "typ_jako_tekst",
        detail: "Tekst określający jakiego rodzaju informacje chcesz.",
      },
    ],
  },
  {
    n: "INT",
    d: "Zaokrągla liczbę w dół do najbliższej liczby całkowitej.",
    a: "Zaokrągla w dół do najbliższej liczby całkowitej.",
    p: [
      {
        name: "numer",
        detail:
          "Liczba rzeczywista, którą chcesz zaokrąglić w dół do liczby całkowitej.",
      },
    ],
  },
  {
    n: "INTERCEPT",
    d: "Oblicza punkt, w którym linia przetnie oś y, korzystając z istniejących wartości x i y.",
    a: "Przecięcie Y linii regresji.",
    p: [
      {
        name: "znane_y",
        detail: "Zależny zbiór obserwacji lub danych.",
      },
      {
        name: "znane_x",
        detail: "Niezależny zbiór obserwacji lub danych.",
      },
    ],
  },
  {
    n: "INTRATE",
    d: "Zwraca stopę procentową w pełni zainwestowanego papieru wartościowego.",
    a: "Stopa procentowa w pełni zainwestowanego papieru wartościowego.",
    p: [
      {
        name: "data_rozrachunku",
        detail: "Data rozliczenia papieru wartościowego.",
      },
      {
        name: "termin_zapadalności",
        detail: "Termin zapadalności papieru wartościowego.",
      },
      {
        name: "inwestycja",
        detail: "Kwota zainwestowana w papier wartościowy.",
      },
      {
        name: "wartość_wykupu",
        detail: "Kwota do otrzymania w terminie zapadalności.",
      },
      {
        name: "podstawa",
        detail:
          "Podstawa liczenia dni: 0 lub pominięty US 30/360, 1 faktyczny/rzeczywisty, 2 rzeczywisty/360, 3 rzeczywisty/365, 4 europejski 30/360.",
      },
    ],
  },
  {
    n: "IPMT",
    d: "Zwraca płatność odsetek za dany okres dla inwestycji w oparciu o okresowe, stałe płatności i stałą stopę procentową.",
    a: "Część odsetkowa płatności.",
    p: [
      {
        name: "stawka",
        detail: "Stopa procentowa za okres.",
      },
      {
        name: "okres",
        detail:
          "Okres, za który chcesz znaleźć odsetki, od 1 do `liczba_okresów`.",
      },
      {
        name: "liczba_okresów",
        detail: "Całkowita liczba okresów płatności.",
      },
      {
        name: "wartość_bieżąca",
        detail: "Wartość bieżąca.",
      },
      {
        name: "wartość_przyszła",
        detail:
          "Przyszła wartość lub saldo gotówkowe, które chcesz po ostatniej płatności; domyślnie wynosi 0.",
      },
      {
        name: "typ",
        detail:
          "Kiedy płatności są wymagalne: 0 lub pominięte na koniec okresu, 1 na początku.",
      },
    ],
  },
  {
    n: "IRR",
    d: "Zwraca wewnętrzną stopę zwrotu dla serii przepływów pieniężnych reprezentowanych przez liczby w wartościach.",
    a: "Wewnętrzna stopa zwrotu.",
    p: [
      {
        name: "wartości",
        detail:
          "Tablica lub odniesienie zawierające co najmniej jeden dodatni i jeden ujemny przepływ pieniężny.",
      },
      {
        name: "przypuszczenie",
        detail:
          "Liczba, którą odgadniesz, jest bliska wyniku; domyślnie wynosi 0,1 (10 procent).",
      },
    ],
  },
  {
    n: "ISBLANK",
    d: "Zwraca TRUE jeśli wartość odnosi się do pustej komórki.",
    a: "Sprawdza, czy komórka jest pusta.",
    p: [
      {
        name: ".",
        detail: "Wartość, którą chcesz przetestować.",
      },
    ],
  },
  {
    n: "ISERR",
    d: "Zwraca TRUE jeśli wartość odnosi się do dowolnej wartości błędu z wyjątkiem #N/A.",
    a: "Sprawdza, czy nie wystąpił błąd inny niż #N/A.",
    p: [
      {
        name: ".",
        detail: "Wartość, którą chcesz przetestować.",
      },
    ],
  },
  {
    n: "ISERROR",
    d: "Zwraca TRUE, jeśli wartość jest dowolnym błędem (#N/A, #VALUE!, #REF!, #DIV/0!, #NUM!, #NAME? lub #NULL!).",
    a: "Sprawdza, czy nie ma błędów.",
    p: [
      {
        name: ".",
        detail: "Wartość, którą chcesz przetestować.",
      },
    ],
  },
  {
    n: "ISEVEN",
    d: "Zwraca TRUE, jeśli liczba jest parzysta, lub FALSE, jeśli liczba jest nieparzysta.",
    a: "Sprawdza, czy liczba jest parzysta.",
    p: [
      {
        name: "numer",
        detail: "Wartość do sprawdzenia; miejsca dziesiętne są obcinane.",
      },
    ],
  },
  {
    n: "ISFORMULA",
    d: "Sprawdza, czy istnieje odwołanie do komórki zawierającej formułę i zwraca TRUE lub FALSE.",
    a: "Sprawdza, czy komórka zawiera formułę.",
    p: [
      {
        name: "odniesienie",
        detail: "Odniesienie do komórki, którą chcesz przetestować.",
      },
    ],
  },
  {
    n: "ISLOGICAL",
    d: "Zwraca TRUE jeśli wartość odnosi się do wartości logicznej.",
    a: "Sprawdza wartość logiczną.",
    p: [
      {
        name: ".",
        detail: "Wartość, którą chcesz przetestować.",
      },
    ],
  },
  {
    n: "ISNA",
    d: "Zwraca TRUE, jeśli wartość odnosi się do wartości błędu #N/A (wartość niedostępna).",
    a: "Sprawdza #N/A.",
    p: [
      {
        name: ".",
        detail: "Wartość, którą chcesz przetestować.",
      },
    ],
  },
  {
    n: "ISNONTEXT",
    d: "Zwraca TRUE, jeśli wartość odnosi się do dowolnego elementu niebędącego tekstem, łącznie z pustą komórką.",
    a: "Sprawdza wartość nietekstową.",
    p: [
      {
        name: ".",
        detail: "Wartość, którą chcesz przetestować.",
      },
    ],
  },
  {
    n: "ISNUMBER",
    d: "Zwraca TRUE jeśli wartość odnosi się do liczby.",
    a: "Sprawdza liczbę.",
    p: [
      {
        name: ".",
        detail: "Wartość, którą chcesz przetestować.",
      },
    ],
  },
  {
    n: "ISO.CEILING",
    d: "Zaokrągla liczbę w górę do najbliższej liczby całkowitej lub do najbliższej wielokrotności istotności, niezależnie od znaku liczby.",
    a: "Zaokrągla w górę niezależnie od znaku (ISO).",
    p: [
      {
        name: "numer",
        detail: "Wartość do zaokrąglenia.",
      },
      {
        name: "wielokrotność",
        detail:
          "Wielokrotność, do której zaokrąglana jest liczba; domyślnie 1.",
      },
    ],
  },
  {
    n: "ISODD",
    d: "Zwraca TRUE, jeśli liczba jest nieparzysta, lub FALSE, jeśli liczba jest parzysta.",
    a: "Sprawdza, czy liczba jest nieparzysta.",
    p: [
      {
        name: "numer",
        detail: "Wartość do sprawdzenia; miejsca dziesiętne są obcinane.",
      },
    ],
  },
  {
    n: "ISOMITTED",
    d: "Sprawdza, czy brakuje wartości w LAMBDA i zwraca TRUE lub FALSE.",
    a: "Sprawdza brakujący argument LAMBDA.",
    p: [
      {
        name: "argument",
        detail: "Parametr LAMBDA, który chcesz przetestować.",
      },
    ],
  },
  {
    n: "ISOWEEKNUM",
    d: "Zwraca numer tygodnia w roku ISO dla podanej daty.",
    a: "Numer tygodnia ISO.",
    p: [
      {
        name: "data",
        detail: "Kod daty i godziny używany do obliczania daty i godziny.",
      },
    ],
  },
  {
    n: "ISPMT",
    d: "Oblicza zapłacone lub otrzymane odsetki za podany okres pożyczki lub inwestycji przy równych spłatach kapitału.",
    a: "Odsetki przy równych spłatach kapitału.",
    p: [
      {
        name: "stawka",
        detail: "Stopa procentowa inwestycji.",
      },
      {
        name: "okres",
        detail:
          "Okres, za który chcesz znaleźć odsetki, od 1 do `liczba_okresów`.",
      },
      {
        name: "liczba_okresów",
        detail: "Łączna liczba okresów płatności dla inwestycji.",
      },
      {
        name: "wartość_bieżąca",
        detail:
          "Wartość bieżąca inwestycji; w przypadku pożyczki, kwota pożyczki.",
      },
    ],
  },
  {
    n: "ISREF",
    d: "Zwraca TRUE jeśli wartość odnosi się do referencji.",
    a: "Sprawdza referencję.",
    p: [
      {
        name: ".",
        detail: "Wartość, którą chcesz przetestować.",
      },
    ],
  },
  {
    n: "ISTEXT",
    d: "Zwraca TRUE jeśli wartość odnosi się do tekstu.",
    a: "Sprawdza tekst.",
    p: [
      {
        name: ".",
        detail: "Wartość, którą chcesz przetestować.",
      },
    ],
  },
  {
    n: "JIS",
    d: "Zmienia znaki o połowie szerokości (jednobajtowe) na znaki o pełnej szerokości (dwubajtowe).",
    a: "Konwertuj na znaki o pełnej szerokości.",
    p: [
      {
        name: "tekst",
        detail: "Tekst lub odwołanie do komórki zawierającej tekst do zmiany.",
      },
    ],
  },
  {
    n: "KURT",
    d: "Zwraca kurtozę zbioru danych, która charakteryzuje względną szczytowość lub płaskość rozkładu.",
    a: "Kurtoza zbioru danych.",
    p: [
      {
        name: "numer_1",
        detail: "Pierwsza liczba lub zakres.",
      },
      {
        name: "numer2",
        detail: "Dodatkowe numery lub zakresy, łącznie do 255.",
      },
    ],
  },
  {
    n: "LAMBDA",
    d: "Tworzy niestandardową funkcję wielokrotnego użytku, którą można wywołać za pomocą przyjaznej nazwy lub wywołać bezpośrednio z argumentami.",
    a: "Tworzy funkcję niestandardową.\nParametr",
    p: [
      {
        name: ".",
        detail:
          "Nazwa wartości przekazywanej do funkcji, np. odwołanie do komórki, ciąg znaków lub liczba. Do 253 parametrów.",
      },
      {
        name: "obliczenia",
        detail:
          "Formuła do wykonania i zwrócenia wyniku funkcji; to musi być ostatni argument.",
      },
    ],
  },
  {
    n: "LARGE",
    d: "Zwraca k-tą największą wartość w zbiorze danych.",
    a: "K-ta największa wartość.",
    p: [
      {
        name: "tablica",
        detail:
          "Tablica lub zakres danych, dla którego chcesz określić k-tą największą wartość.",
      },
      {
        name: "k",
        detail:
          "Pozycja (od największej) w tablicy lub zakresie komórek danych do zwrócenia.",
      },
    ],
  },
  {
    n: "LCM",
    d: "Zwraca najmniejszą wspólną wielokrotność liczb całkowitych.",
    a: "Najmniejsza wspólna wielokrotność.",
    p: [
      {
        name: "numer_1",
        detail: "Pierwsza wartość lub zakres; miejsca dziesiętne są obcinane.",
      },
      {
        name: "numer2",
        detail: "Dodatkowe wartości lub zakresy, łącznie do 255.",
      },
    ],
  },
  {
    n: "LEFT",
    d: "Zwraca pierwszy znak lub znaki w ciągu tekstowym, na podstawie określonej liczby znaków.",
    a: "Skrajne lewe znaki tekstu.",
    p: [
      {
        name: "tekst",
        detail: "Ciąg tekstowy zawierający znaki, które chcesz wyodrębnić.",
      },
      {
        name: "liczba_znaków",
        detail: "Liczba znaków, które chcesz wyodrębnić LEFT; domyślnie 1.",
      },
    ],
  },
  {
    n: "LEFTB",
    d: "Zwraca pierwsze znaki ciągu tekstowego na podstawie liczby bajtów.",
    a: "Znaki skrajnie lewe (bajty).",
    p: [
      {
        name: "tekst",
        detail: "Ciąg tekstowy zawierający znaki, które chcesz wyodrębnić.",
      },
      {
        name: "liczba_bajtów",
        detail: "Liczba bajtów do wyodrębnienia; domyślnie 1.",
      },
    ],
  },
  {
    n: "LEN",
    d: "Zwraca liczbę znaków w ciągu tekstowym.",
    a: "Długość tekstu.",
    p: [
      {
        name: "tekst",
        detail:
          "Tekst, którego długość chcesz znaleźć. Spacje liczą się jako znaki.",
      },
    ],
  },
  {
    n: "LENB",
    d: "Zwraca liczbę bajtów używanych do reprezentacji znaków w ciągu tekstowym.",
    a: "Długość tekstu (w bajtach).",
    p: [
      {
        name: "tekst",
        detail: "Tekst, którego długość chcesz znaleźć.",
      },
    ],
  },
  {
    n: "LET",
    d: "Przypisuje nazwy wynikom obliczeń, umożliwiając zapisanie obliczeń pośrednich, wartości lub nazw we wzorze.",
    a: "Nazywa wartości wewnątrz formuły.",
    p: [
      {
        name: "nazwa1",
        detail: "Imię do przypisania; musi zaczynać się od litery.",
      },
      {
        name: "wartość_nazwy1",
        detail: "Wartość przypisana do `nazwa1`.",
      },
      {
        name: "obliczenie_lub_nazwa2",
        detail:
          "Albo obliczenie wykorzystujące wszystkie nazwy w ramach funkcji LET (musi to być ostatni argument), albo drugą nazwę do przypisania.",
      },
      {
        name: "wartość_nazwy2",
        detail: "Wartość przypisana do `obliczenie_lub_nazwa2`.",
      },
      {
        name: "obliczenie_lub_nazwa3",
        detail:
          "Albo obliczenie wykorzystujące wszystkie nazwy, albo kolejną nazwę do przypisania.",
      },
    ],
  },
  {
    n: "LINEST",
    d: "Oblicza statystyki dla linii przy użyciu metody najmniejszych kwadratów w celu obliczenia linii prostej, która najlepiej pasuje do danych, i zwraca tablicę opisującą tę linię.",
    a: "Statystyka regresji liniowej.",
    p: [
      {
        name: "znane_y",
        detail: "Zbiór wartości y, który już znasz w zależności y = mx + b.",
      },
      {
        name: "znane_x",
        detail: "Opcjonalny zestaw wartości x, który być może już znasz.",
      },
      {
        name: "stała",
        detail:
          "TRUE lub pominięty oblicza b normalnie; FALSE wymusza b równe 0.",
      },
      {
        name: "statystyki",
        detail:
          "TRUE zwraca dodatkowe statystyki regresji; FALSE lub pominięte zwraca tylko m i b.",
      },
    ],
  },
  {
    n: "LN",
    d: "Zwraca logarytm naturalny liczby.",
    a: "Logarytm naturalny.",
    p: [
      {
        name: "numer",
        detail:
          "Dodatnia liczba rzeczywista, dla której chcesz uzyskać logarytm naturalny.",
      },
    ],
  },
  {
    n: "LOG",
    d: "Zwraca logarytm liczby o podanej podstawie.",
    a: "Logarytm o podanej podstawie.",
    p: [
      {
        name: "numer",
        detail:
          "Dodatnia liczba rzeczywista, dla której chcesz uzyskać logarytm.",
      },
      {
        name: "baza",
        detail: "Podstawa logarytmu; domyślnie 10.",
      },
    ],
  },
  {
    n: "LOG10",
    d: "Zwraca logarytm dziesiętny liczby.",
    a: "Logarytm o podstawie 10.",
    p: [
      {
        name: "numer",
        detail:
          "Dodatnia liczba rzeczywista, dla której ma być logarytm dziesiętny.",
      },
    ],
  },
  {
    n: "LOGEST",
    d: "Oblicza krzywą wykładniczą pasującą do danych i zwraca tablicę wartości opisującą krzywą.",
    a: "Statystyka regresji wykładniczej.",
    p: [
      {
        name: "znane_y",
        detail: "Znany już zbiór wartości y w zależności y = b*m^x.",
      },
      {
        name: "znane_x",
        detail: "Opcjonalny zestaw wartości x, który być może już znasz.",
      },
      {
        name: "stała",
        detail:
          "TRUE lub pominięty oblicza b normalnie; FALSE wymusza b równe 1.",
      },
      {
        name: "statystyki",
        detail:
          "TRUE zwraca dodatkowe statystyki regresji; FALSE lub pominięte zwraca tylko m i b.",
      },
    ],
  },
  {
    n: "LOGINV",
    d: "Zwraca odwrotność funkcji rozkładu logarytmiczno-normalnego. Zachowane ze względu na kompatybilność; zobacz LOGNORM.INV.",
    a: "Odwrotny rozkład lognormalny (starszy).",
    p: [
      {
        name: "prawdopodobieństwo",
        detail:
          "Prawdopodobieństwo powiązane z rozkładem logarytmiczno-normalnym.",
      },
      {
        name: "średnia",
        detail: "Średnia z ln(x).",
      },
      {
        name: "odchylenie_standardowe",
        detail: "Odchylenie standardowe ln(x).",
      },
    ],
  },
  {
    n: "LOGNORM.DIST",
    d: "Zwraca rozkład lognormalny x, gdzie ln(x) ma rozkład normalny z parametrami średnia i odchylenie_standardowe.",
    a: "Rozkład lognormalny.",
    p: [
      {
        name: "x",
        detail: "Wartość, przy której funkcja ma zostać oszacowana.",
      },
      {
        name: "średnia",
        detail: "Średnia z ln(x).",
      },
      {
        name: "odchylenie_standardowe",
        detail: "Odchylenie standardowe ln(x).",
      },
      {
        name: "kumulatywne",
        detail:
          "TRUE zwraca funkcję rozkładu skumulowanego, FALSE funkcję gęstości prawdopodobieństwa.",
      },
    ],
  },
  {
    n: "LOGNORM.INV",
    d: "Zwraca odwrotność funkcji skumulowanego rozkładu logarytmiczno-normalnego x.",
    a: "Odwrotny rozkład lognormalny.",
    p: [
      {
        name: "prawdopodobieństwo",
        detail:
          "Prawdopodobieństwo powiązane z rozkładem logarytmiczno-normalnym.",
      },
      {
        name: "średnia",
        detail: "Średnia z ln(x).",
      },
      {
        name: "odchylenie_standardowe",
        detail: "Odchylenie standardowe ln(x).",
      },
    ],
  },
  {
    n: "LOGNORMDIST",
    d: "Zwraca skumulowany rozkład logarytmiczno-normalny. Zachowane ze względu na kompatybilność; zobacz LOGNORM.DIST.",
    a: "Skumulowany rozkład logarytmiczno-normalny (starszy model).",
    p: [
      {
        name: "x",
        detail: "Wartość, przy której funkcja ma zostać oszacowana.",
      },
      {
        name: "średnia",
        detail: "Średnia z ln(x).",
      },
      {
        name: "odchylenie_standardowe",
        detail: "Odchylenie standardowe ln(x).",
      },
    ],
  },
  {
    n: "LOOKUP",
    d: "Wyszukuje wartość w zakresie jednowierszowym lub jednokolumnowym (wektor) i zwraca wartość z tej samej pozycji w drugim zakresie.",
    a: "Wyszukuje wartość w wektorze.",
    p: [
      {
        name: "szukana_wartość",
        detail: "Wartość, której szuka LOOKUP w `wektor_wyszukiwania`.",
      },
      {
        name: "wektor_wyszukiwania",
        detail:
          "Zakres zawierający tylko jeden wiersz lub jedną kolumnę, posortowany rosnąco.",
      },
      {
        name: "wektor_wynikowy",
        detail:
          "Zakres zawierający tylko jeden wiersz lub kolumnę, o takim samym rozmiarze jak `wektor_wyszukiwania`.",
      },
    ],
  },
  {
    n: "LOWER",
    d: "Konwertuje wszystkie wielkie litery w ciągu tekstowym na małe.",
    a: "Konwertuje tekst na małe litery.",
    p: [
      {
        name: "tekst",
        detail: "Tekst, który chcesz zamienić na małe litery.",
      },
    ],
  },
  {
    n: "MAKEARRAY",
    d: "Zwraca obliczoną tablicę o określonym rozmiarze wiersza i kolumny, poprzez zastosowanie LAMBDA.",
    a: "Tworzy tablicę z LAMBDA.",
    p: [
      {
        name: "wiersze",
        detail: "Liczba wierszy w tablicy; musi być większa od zera.",
      },
      {
        name: "kolumny",
        detail: "Liczba kolumn w tablicy; musi być większa od zera.",
      },
      {
        name: "lambda",
        detail:
          "Wywołanie LAMBDA z indeksem wiersza i kolumny w celu utworzenia każdej wartości tablicy.",
      },
    ],
  },
  {
    n: "MAP",
    d: "Zwraca tablicę utworzoną przez mapowanie każdej wartości w tablicach na nową wartość poprzez zastosowanie LAMBDA.",
    a: "Przekształca każdą wartość za pomocą LAMBDA.",
    p: [
      {
        name: "tablica1",
        detail: "Pierwsza tablica do odwzorowania.",
      },
      {
        name: "tablica2",
        detail: "Dodatkowe tablice do mapowania.",
      },
      {
        name: "lambda",
        detail:
          "LAMBDA, który musi być ostatnim argumentem, z jednym parametrem dla każdej przekazanej tablicy.",
      },
    ],
  },
  {
    n: "MATCH",
    d: "Wyszukuje określony element w zakresie komórek i zwraca względną pozycję tego elementu w zakresie.",
    a: "Pozycja wartości w zakresie.",
    p: [
      {
        name: "szukana_wartość",
        detail: "Wartość, którą chcesz dopasować w `tablica_wyszukiwania`.",
      },
      {
        name: "tablica_wyszukiwania",
        detail: "Zakres przeszukiwanych komórek.",
      },
      {
        name: "typ_dopasowania",
        detail:
          "1 lub pominięty znajduje największą wartość mniejszą lub równą `szukana_wartość`, 0 dokładne dopasowanie, -1 najmniejszą wartość większą lub równą tej wartości.",
      },
    ],
  },
  {
    n: "MAX",
    d: "Zwraca największą wartość ze zbioru wartości, ignorując tekst i wartości logiczne w zakresach.",
    a: "Największa wartość.",
    p: [
      {
        name: "numer_1",
        detail: "Pierwsza liczba lub zakres.",
      },
      {
        name: "numer2",
        detail: "Dodatkowe numery lub zakresy, łącznie do 255.",
      },
    ],
  },
  {
    n: "MAXA",
    d: "Zwraca największą wartość z listy argumentów, oceniając tekst jako 0, a wartości logiczne jako 1 lub 0.",
    a: "Największa wartość zawierająca tekst i elementy logiczne.",
    p: [
      {
        name: "wartość_1",
        detail: "Pierwsza wartość lub zakres.",
      },
      {
        name: "wartość2",
        detail: "Dodatkowe wartości lub zakresy, łącznie do 255.",
      },
    ],
  },
  {
    n: "MAXIFS",
    d: "Zwraca maksymalną wartość spośród komórek określonych przez dany zestaw warunków lub kryteriów.",
    a: "Największa wartość spełniająca kryteria.",
    p: [
      {
        name: "zakres_maksimum",
        detail: "Zakres komórek, w którym zostanie określone maksimum.",
      },
      {
        name: "zakres_kryteriów1",
        detail: "Zestaw komórek do oceny za pomocą `kryteria1`.",
      },
      {
        name: "kryteria1",
        detail:
          "Kryteria definiujące, które komórki zostaną ocenione jako maksymalne.",
      },
      {
        name: "zakres_kryteriów2",
        detail: "Dodatkowe zakresy, do 126 par zakres/kryteria.",
      },
      {
        name: "kryteria2",
        detail: "Kryteria dla odpowiedniego dodatkowego zakresu.",
      },
    ],
  },
  {
    n: "MDETERM",
    d: "Zwraca wyznacznik macierzy tablicy.",
    a: "Wyznacznik macierzy.",
    p: [
      {
        name: "tablica",
        detail: "Tablica numeryczna z taką samą liczbą wierszy i kolumn.",
      },
    ],
  },
  {
    n: "MDURATION",
    d: "Zwraca zmodyfikowany czas trwania Macaulaya dla papieru wartościowego o przyjętej wartości nominalnej 100 USD.",
    a: "Zmodyfikowana duracja papieru wartościowego.",
    p: [
      {
        name: "data_rozrachunku",
        detail: "Data rozliczenia papieru wartościowego.",
      },
      {
        name: "termin_zapadalności",
        detail: "Termin zapadalności papieru wartościowego.",
      },
      {
        name: "kupon",
        detail: "Roczna stopa kuponu papieru wartościowego.",
      },
      {
        name: "rentowność",
        detail: "Roczna stopa zwrotu papieru wartościowego.",
      },
      {
        name: "częstotliwość",
        detail:
          "Liczba wypłat kuponowych w ciągu roku: 1 roczna, 2 półroczne, 4 kwartalne.",
      },
      {
        name: "podstawa",
        detail:
          "Podstawa liczenia dni: 0 lub pominięty US 30/360, 1 faktyczny/rzeczywisty, 2 rzeczywisty/360, 3 rzeczywisty/365, 4 europejski 30/360.",
      },
    ],
  },
  {
    n: "MEDIAN",
    d: "Zwraca medianę podanych liczb, liczbę znajdującą się w środku zbioru liczb.",
    a: "Mediana liczb.",
    p: [
      {
        name: "numer_1",
        detail: "Pierwsza liczba lub zakres.",
      },
      {
        name: "numer2",
        detail: "Dodatkowe numery lub zakresy, łącznie do 255.",
      },
    ],
  },
  {
    n: "MID",
    d: "Zwraca określoną liczbę znaków z ciągu tekstowego, zaczynając od określonej pozycji.",
    a: "Znaki ze środka tekstu.",
    p: [
      {
        name: "tekst",
        detail: "Ciąg tekstowy zawierający znaki, które chcesz wyodrębnić.",
      },
      {
        name: "pozycja_początkowa",
        detail:
          "Pozycja pierwszego znaku, który chcesz wyodrębnić; pierwszy znak to 1.",
      },
      {
        name: "liczba_znaków",
        detail: "Liczba znaków, które ma zwrócić MID.",
      },
    ],
  },
  {
    n: "MIDB",
    d: "Zwraca znaki ze środka ciągu tekstowego, podając pozycję początkową i liczbę bajtów.",
    a: "Znaki środkowe (bajty).",
    p: [
      {
        name: "tekst",
        detail: "Ciąg tekstowy zawierający znaki, które chcesz wyodrębnić.",
      },
      {
        name: "pozycja_początkowa",
        detail: "Pozycja pierwszego znaku do wyodrębnienia.",
      },
      {
        name: "liczba_bajtów",
        detail: "Liczba bajtów do wyodrębnienia.",
      },
    ],
  },
  {
    n: "MIN",
    d: "Zwraca najmniejszą liczbę ze zbioru wartości, ignorując tekst i wartości logiczne w zakresach.",
    a: "Najmniejsza wartość.",
    p: [
      {
        name: "numer_1",
        detail: "Pierwsza liczba lub zakres.",
      },
      {
        name: "numer2",
        detail: "Dodatkowe numery lub zakresy, łącznie do 255.",
      },
    ],
  },
  {
    n: "MINA",
    d: "Zwraca najmniejszą wartość z listy argumentów, oceniając tekst jako 0, a wartości logiczne jako 1 lub 0.",
    a: "Najmniejsza wartość zawierająca tekst i elementy logiczne.",
    p: [
      {
        name: "wartość_1",
        detail: "Pierwsza wartość lub zakres.",
      },
      {
        name: "wartość2",
        detail: "Dodatkowe wartości lub zakresy, łącznie do 255.",
      },
    ],
  },
  {
    n: "MINIFS",
    d: "Zwraca minimalną wartość spośród komórek określonych przez dany zestaw warunków lub kryteriów.",
    a: "Najmniejsza wartość spełniająca kryteria.",
    p: [
      {
        name: "zakres_minimum",
        detail: "Zakres komórek, w którym zostanie określone minimum.",
      },
      {
        name: "zakres_kryteriów1",
        detail: "Zestaw komórek do oceny za pomocą `kryteria1`.",
      },
      {
        name: "kryteria1",
        detail:
          "Kryteria definiujące, które komórki będą oceniane jako minimalne.",
      },
      {
        name: "zakres_kryteriów2",
        detail: "Dodatkowe zakresy, do 126 par zakres/kryteria.",
      },
      {
        name: "kryteria2",
        detail: "Kryteria dla odpowiedniego dodatkowego zakresu.",
      },
    ],
  },
  {
    n: "MINUTE",
    d: "Zwraca minuty wartości czasu jako liczbę całkowitą od 0 do 59.",
    a: "Minutowy składnik czasu.",
    p: [
      {
        name: "numer_seryjny",
        detail: "Czas zawierający minutę, którą chcesz znaleźć.",
      },
    ],
  },
  {
    n: "MINVERSE",
    d: "Zwraca macierz odwrotną dla macierzy zapisanej w tablicy.",
    a: "Odwrotność macierzy.",
    p: [
      {
        name: "tablica",
        detail: "Tablica numeryczna z taką samą liczbą wierszy i kolumn.",
      },
    ],
  },
  {
    n: "MIRR",
    d: "Zwraca zmodyfikowaną wewnętrzną stopę zwrotu dla serii okresowych przepływów pieniężnych, biorąc pod uwagę zarówno koszt inwestycji, jak i odsetki otrzymane z tytułu reinwestycji środków pieniężnych.",
    a: "Zmodyfikowana wewnętrzna stopa zwrotu.",
    p: [
      {
        name: "wartości",
        detail:
          "Tablica lub odniesienie zawierające co najmniej jeden dodatni i jeden ujemny przepływ pieniężny.",
      },
      {
        name: "stopa_finansowania",
        detail:
          "Stopa procentowa, jaką płacisz od pieniędzy wykorzystywanych w przepływach pieniężnych.",
      },
      {
        name: "stopa_reinwestycji",
        detail:
          "Stopa procentowa otrzymywana od przepływów pieniężnych w wyniku ich reinwestycji.",
      },
    ],
  },
  {
    n: "MMULT",
    d: "Zwraca iloczyn macierzowy dwóch tablic. Wynik ma tyle wierszy, ile tablica1 i tyle kolumn, ile tablica2.",
    a: "Iloczyn macierzowy dwóch tablic.",
    p: [
      {
        name: "tablica1",
        detail:
          "Pierwsza tablica; liczba jego kolumn musi być równa liczbie wierszy `tablica2`.",
      },
      {
        name: "tablica2",
        detail: "Druga tablica.",
      },
    ],
  },
  {
    n: "MOD",
    d: "Zwraca resztę z dzielenia liczby przez dzielnik. Wynik ma ten sam znak co dzielnik.",
    a: "Reszta z dzielenia.",
    p: [
      {
        name: "numer",
        detail: "Liczba, dla której chcesz otrzymać resztę.",
      },
      {
        name: "dzielnik",
        detail: "Liczba, przez którą chcesz podzielić `numer`.",
      },
    ],
  },
  {
    n: "MODE.MULT",
    d: "Zwraca pionową tablicę najczęściej występujących lub powtarzających się wartości w tablicy lub zakresie danych.",
    a: "Wszystkie najczęściej występujące wartości.",
    p: [
      {
        name: "numer_1",
        detail: "Pierwsza liczba lub zakres, dla którego chcesz obliczyć modę.",
      },
      {
        name: "numer2",
        detail: "Dodatkowe numery lub zakresy, łącznie do 254.",
      },
    ],
  },
  {
    n: "MODE.SNGL",
    d: "Zwraca najczęściej występującą lub powtarzającą się wartość w tablicy lub zakresie danych.",
    a: "Najczęstsza wartość.",
    p: [
      {
        name: "numer_1",
        detail: "Pierwsza liczba lub zakres, dla którego chcesz obliczyć modę.",
      },
      {
        name: "numer2",
        detail: "Dodatkowe numery lub zakresy, łącznie do 254.",
      },
    ],
  },
  {
    n: "MONTH",
    d: "Zwraca miesiąc daty reprezentowanej przez liczbę kolejną, jako liczbę całkowitą od 1 (styczeń) do 12 (grudzień).",
    a: "Miesiąc daty.",
    p: [
      {
        name: "numer_seryjny",
        detail: "Data miesiąca, który szukasz.",
      },
    ],
  },
  {
    n: "MROUND",
    d: "Zwraca liczbę zaokrągloną do żądanej wielokrotności.",
    a: "Zaokrągla do najbliższej wielokrotności.",
    p: [
      {
        name: "numer",
        detail: "Wartość do zaokrąglenia.",
      },
      {
        name: "wielokrotność",
        detail: "Wielokrotność, do której chcesz zaokrąglić `numer`.",
      },
    ],
  },
  {
    n: "MULTINOMIAL",
    d: "Zwraca stosunek silni sumy wartości do iloczynu ich silni.",
    a: "Wielomian zbioru liczb.",
    p: [
      {
        name: "numer_1",
        detail: "Pierwsza wartość lub zakres.",
      },
      {
        name: "numer2",
        detail: "Dodatkowe wartości lub zakresy, łącznie do 255.",
      },
    ],
  },
  {
    n: "MUNIT",
    d: "Zwraca macierz jednostkową dla podanego wymiaru.",
    a: "Macierz jednostkowa.",
    p: [
      {
        name: "wymiar",
        detail:
          "Liczba całkowita większa od zera określająca rozmiar macierzy.",
      },
    ],
  },
  {
    n: "N",
    d: "Zwraca wartość przekonwertowaną na liczbę: liczby bez zmian, daty jako liczby kolejne, TRUE jako 1 i wszystko inne jako 0.",
    a: "Konwertuje wartość na liczbę.",
    p: [
      {
        name: ".",
        detail: "Wartość, którą chcesz przekonwertować.",
      },
    ],
  },
  {
    n: "NA",
    d: 'Zwraca wartość błędu #N/A, czyli "no value is available".',
    a: "Wartość błędu #N/A.",
    p: [],
  },
  {
    n: "NEGBINOM.DIST",
    d: "Zwraca ujemny rozkład dwumianowy, prawdopodobieństwo, że wystąpią błędy liczba_niepowodzeń przed liczba_sukcesów-tym sukcesem.",
    a: "Ujemny rozkład dwumianowy.",
    p: [
      {
        name: "liczba_niepowodzeń",
        detail: "Liczba awarii.",
      },
      {
        name: "liczba_sukcesów",
        detail: "Próg liczby sukcesów.",
      },
      {
        name: "prawdopodobieństwo_sukcesu",
        detail: "Prawdopodobieństwo sukcesu.",
      },
      {
        name: "kumulatywne",
        detail:
          "TRUE zwraca funkcję rozkładu skumulowanego, FALSE funkcję gęstości prawdopodobieństwa.",
      },
    ],
  },
  {
    n: "NEGBINOMDIST",
    d: "Zwraca ujemny rozkład dwumianowy. Zachowane ze względu na kompatybilność; zobacz NEGBINOM.DIST.",
    a: "Ujemny rozkład dwumianowy (starszy model).",
    p: [
      {
        name: "liczba_niepowodzeń",
        detail: "Liczba awarii.",
      },
      {
        name: "liczba_sukcesów",
        detail: "Próg liczby sukcesów.",
      },
      {
        name: "prawdopodobieństwo_sukcesu",
        detail: "Prawdopodobieństwo sukcesu.",
      },
    ],
  },
  {
    n: "NETWORKDAYS",
    d: "Zwraca liczbę pełnych dni roboczych pomiędzy data_rozpoczęcia a data_zakończenia, z wyłączeniem weekendów i określonych świąt.",
    a: "Dni robocze pomiędzy dwiema datami.",
    p: [
      {
        name: "data_rozpoczęcia",
        detail: "Data reprezentująca datę początkową.",
      },
      {
        name: "data_zakończenia",
        detail: "Data reprezentująca datę końcową.",
      },
      {
        name: "święta",
        detail:
          "Opcjonalny zakres jednej lub większej liczby dat do wykluczenia z kalendarza roboczego.",
      },
    ],
  },
  {
    n: "NETWORKDAYS.INTL",
    d: "Zwraca liczbę pełnych dni roboczych pomiędzy dwiema datami, używając parametrów do wskazania, które i ile dni jest dniami weekendowymi.",
    a: "Dni robocze z niestandardowymi weekendami.",
    p: [
      {
        name: "data_rozpoczęcia",
        detail: "Data rozpoczęcia.",
      },
      {
        name: "data_zakończenia",
        detail: "Data końcowa.",
      },
      {
        name: "weekendu",
        detail:
          'Numer weekendowy (1 sobota-niedziela, 2 niedziela-poniedziałek, ..., 11 tylko niedziela, ..., 17 tylko sobota) lub ciąg siedmioznakowy, np. "0000011".',
      },
      {
        name: "święta",
        detail:
          "Opcjonalny zestaw jednej lub więcej dat do wykluczenia z kalendarza roboczego.",
      },
    ],
  },
  {
    n: "NOMINAL",
    d: "Zwraca nominalną roczną stopę procentową, biorąc pod uwagę stopę efektywną i liczbę okresów kapitalizacji w roku.",
    a: "Nominalna roczna stopa procentowa.",
    p: [
      {
        name: "stopa_efektywna",
        detail: "Efektywna stopa procentowa.",
      },
      {
        name: "okresy_w_roku",
        detail: "Liczba okresów kapitalizacji w roku.",
      },
    ],
  },
  {
    n: "NORM.DIST",
    d: "Zwraca rozkład normalny dla określonej średniej i odchylenia standardowego.",
    a: "Rozkład normalny.",
    p: [
      {
        name: "x",
        detail: "Wartość, dla której chcesz uzyskać rozkład.",
      },
      {
        name: "średnia",
        detail: "Średnia arytmetyczna rozkładu.",
      },
      {
        name: "odchylenie_standardowe",
        detail: "Odchylenie standardowe rozkładu.",
      },
      {
        name: "kumulatywne",
        detail:
          "TRUE zwraca funkcję rozkładu skumulowanego, FALSE funkcję gęstości prawdopodobieństwa.",
      },
    ],
  },
  {
    n: "NORM.INV",
    d: "Zwraca odwrotność skumulowanego rozkładu normalnego dla określonej średniej i odchylenia standardowego.",
    a: "Odwrotny rozkład normalny.",
    p: [
      {
        name: "prawdopodobieństwo",
        detail: "Prawdopodobieństwo odpowiadające rozkładowi normalnemu.",
      },
      {
        name: "średnia",
        detail: "Średnia arytmetyczna rozkładu.",
      },
      {
        name: "odchylenie_standardowe",
        detail: "Odchylenie standardowe rozkładu.",
      },
    ],
  },
  {
    n: "NORM.S.DIST",
    d: "Zwraca standardowy rozkład normalny, którego średnia wynosi zero, a odchylenie standardowe wynosi jeden.",
    a: "Standardowy rozkład normalny.",
    p: [
      {
        name: "z",
        detail: "Wartość, dla której chcesz uzyskać rozkład.",
      },
      {
        name: "kumulatywne",
        detail:
          "TRUE zwraca funkcję rozkładu skumulowanego, FALSE funkcję gęstości prawdopodobieństwa.",
      },
    ],
  },
  {
    n: "NORM.S.INV",
    d: "Zwraca odwrotność standardowego skumulowanego rozkładu normalnego, którego średnia wynosi zero, a odchylenie standardowe wynosi jeden.",
    a: "Odwrotny standardowy rozkład normalny.",
    p: [
      {
        name: "prawdopodobieństwo",
        detail: "Prawdopodobieństwo odpowiadające rozkładowi normalnemu.",
      },
    ],
  },
  {
    n: "NORMDIST",
    d: "Zwraca rozkład normalny dla określonej średniej i odchylenia standardowego. Zachowane ze względu na kompatybilność; zobacz NORM.DIST.",
    a: "Rozkład normalny (starszy).",
    p: [
      {
        name: "x",
        detail: "Wartość, dla której chcesz uzyskać rozkład.",
      },
      {
        name: "średnia",
        detail: "Średnia arytmetyczna rozkładu.",
      },
      {
        name: "odchylenie_standardowe",
        detail: "Odchylenie standardowe rozkładu.",
      },
      {
        name: "kumulatywne",
        detail:
          "TRUE zwraca funkcję rozkładu skumulowanego, FALSE funkcję gęstości prawdopodobieństwa.",
      },
    ],
  },
  {
    n: "NORMINV",
    d: "Zwraca odwrotność skumulowanego rozkładu normalnego. Zachowane ze względu na kompatybilność; zobacz NORM.INV.",
    a: "Odwrotny rozkład normalny (starsza wersja).",
    p: [
      {
        name: "prawdopodobieństwo",
        detail: "Prawdopodobieństwo odpowiadające rozkładowi normalnemu.",
      },
      {
        name: "średnia",
        detail: "Średnia arytmetyczna rozkładu.",
      },
      {
        name: "odchylenie_standardowe",
        detail: "Odchylenie standardowe rozkładu.",
      },
    ],
  },
  {
    n: "NORMSDIST",
    d: "Zwraca standardową funkcję skumulowanego rozkładu normalnego. Zachowane ze względu na kompatybilność; zobacz NORM.S.DIST.",
    a: "Standardowy rozkład normalny (starszy).",
    p: [
      {
        name: "z",
        detail: "Wartość, dla której chcesz uzyskać rozkład.",
      },
    ],
  },
  {
    n: "NORMSINV",
    d: "Zwraca odwrotność standardowego skumulowanego rozkładu normalnego. Zachowane ze względu na kompatybilność; zobacz NORM.S.INV.",
    a: "Odwrotny standard normalny (starszy).",
    p: [
      {
        name: "prawdopodobieństwo",
        detail: "Prawdopodobieństwo odpowiadające rozkładowi normalnemu.",
      },
    ],
  },
  {
    n: "NOT",
    d: "Odwraca wartość swojego argumentu: FALSE staje się TRUE, a TRUE staje się FALSE.",
    a: "Odwraca wartość logiczną.",
    p: [
      {
        name: "logiczne",
        detail:
          "Wartość lub wyrażenie, które można ocenić jako TRUE lub FALSE.",
      },
    ],
  },
  {
    n: "NOW",
    d: "Zwraca numer seryjny bieżącej daty i godziny. Jest aktualizowany przy każdym obliczeniu arkusza.",
    a: "Aktualna data i godzina.",
    p: [],
  },
  {
    n: "NPER",
    d: "Zwraca liczbę okresów inwestycji w oparciu o okresowe, stałe płatności i stałą stopę procentową.",
    a: "Liczba okresów płatności.",
    p: [
      {
        name: "stawka",
        detail: "Stopa procentowa za okres.",
      },
      {
        name: "płatność",
        detail:
          "Płatność dokonywana w każdym okresie; nie może się ona zmienić w trakcie trwania renty.",
      },
      {
        name: "wartość_bieżąca",
        detail:
          "Wartość bieżąca lub kwota ryczałtowa, jaką obecnie jest warta seria przyszłych płatności.",
      },
      {
        name: "wartość_przyszła",
        detail:
          "Przyszła wartość lub saldo gotówkowe, które chcesz po ostatniej płatności; domyślnie wynosi 0.",
      },
      {
        name: "typ",
        detail:
          "Kiedy płatności są wymagalne: 0 lub pominięte na koniec okresu, 1 na początku.",
      },
    ],
  },
  {
    n: "NPV",
    d: "Oblicza bieżącą wartość netto inwestycji przy użyciu stopy dyskontowej i szeregu przyszłych płatności (wartości ujemne) i dochodu (wartości dodatnie).",
    a: "Wartość bieżąca netto przepływów pieniężnych.",
    p: [
      {
        name: "stawka",
        detail: "Stopa dyskonta w jednym okresie.",
      },
      {
        name: "wartość_1",
        detail:
          "Pierwsza płatność lub dochód, równomiernie rozłożony w czasie i występujący na koniec każdego okresu.",
      },
      {
        name: "wartość2",
        detail: "Dopłaty i dochody, łącznie do 254.",
      },
    ],
  },
  {
    n: "NUMBERVALUE",
    d: "Konwertuje tekst na liczbę w sposób niezależny od ustawień regionalnych.",
    a: "Konwertuje tekst na liczbę z niestandardowymi separatorami.",
    p: [
      {
        name: "tekst",
        detail: "Tekst do konwersji na liczbę.",
      },
      {
        name: "separator_dziesiętny",
        detail:
          "Znak używany do oddzielenia części całkowitej i ułamkowej wyniku.",
      },
      {
        name: "separator_grup",
        detail: "Znak używany do oddzielania grup liczb, np. tysięcy.",
      },
    ],
  },
  {
    n: "OCT2BIN",
    d: "Konwertuje liczbę ósemkową na binarną.",
    a: "Oktalny na binarny.",
    p: [
      {
        name: "numer",
        detail: "Liczba ósemkowa do konwersji; maksymalnie 10 znaków.",
      },
      {
        name: "liczba_miejsc",
        detail:
          "Liczba znaków do użycia; wynik jest uzupełniany zerami wiodącymi.",
      },
    ],
  },
  {
    n: "OCT2DEC",
    d: "Konwertuje liczbę ósemkową na dziesiętną.",
    a: "Konwersja z systemu ósemkowego na dziesiętny.",
    p: [
      {
        name: "numer",
        detail:
          "Liczba ósemkowa do przeliczenia; maksymalnie 10 znaków ósemkowych (30 bitów).",
      },
    ],
  },
  {
    n: "OCT2HEX",
    d: "Konwertuje liczbę ósemkową na liczbę szesnastkową.",
    a: "Konwersja z systemu ósemkowego na szesnastkowy.",
    p: [
      {
        name: "numer",
        detail:
          "Liczba ósemkowa do konwersji; maksymalnie 10 znaków ósemkowych.",
      },
      {
        name: "liczba_miejsc",
        detail:
          "Liczba znaków do użycia; wynik jest uzupełniany zerami wiodącymi.",
      },
    ],
  },
  {
    n: "ODD",
    d: "Zaokrągla liczbę w górę od zera do najbliższej nieparzystej liczby całkowitej.",
    a: "Zaokrągla w górę do najbliższej nieparzystej liczby całkowitej.",
    p: [
      {
        name: "numer",
        detail: "Wartość do zaokrąglenia.",
      },
    ],
  },
  {
    n: "ODDFPRICE",
    d: "Zwraca cenę za 100 USD wartości nominalnej papieru wartościowego z nieregularnym pierwszym okresem.",
    a: "Cena obligacji z nieregularnym pierwszym okresem.",
    p: [
      {
        name: "data_rozrachunku",
        detail: "Data rozliczenia papieru wartościowego.",
      },
      {
        name: "termin_zapadalności",
        detail: "Termin zapadalności papieru wartościowego.",
      },
      {
        name: "data_emisji",
        detail: "Data emisji papieru wartościowego.",
      },
      {
        name: "pierwszy_kupon",
        detail: "Data pierwszego kuponu papieru wartościowego.",
      },
      {
        name: "stawka",
        detail: "Oprocentowanie papieru wartościowego.",
      },
      {
        name: "rentowność",
        detail: "Roczna stopa zwrotu papieru wartościowego.",
      },
      {
        name: "wartość_wykupu",
        detail:
          "Wartość wykupu papieru wartościowego według wartości nominalnej 100 dolarów.",
      },
      {
        name: "częstotliwość",
        detail:
          "Płatność kuponowa w ciągu roku: 1 roczna, 2 półroczna, 4 kwartalna.",
      },
      {
        name: "podstawa",
        detail:
          "Podstawa liczenia dni: 0 US 30/360 (domyślnie), 1 rzeczywista/rzeczywista, 2 rzeczywista/360, 3 rzeczywista/365, 4 europejska 30/360.",
      },
    ],
  },
  {
    n: "ODDFYIELD",
    d: "Zwraca rentowność papieru wartościowego z nieregularnym pierwszym okresem.",
    a: "Rentowność obligacji z nieregularnym pierwszym okresem.",
    p: [
      {
        name: "data_rozrachunku",
        detail: "Data rozliczenia papieru wartościowego.",
      },
      {
        name: "termin_zapadalności",
        detail: "Termin zapadalności papieru wartościowego.",
      },
      {
        name: "data_emisji",
        detail: "Data emisji papieru wartościowego.",
      },
      {
        name: "pierwszy_kupon",
        detail: "Data pierwszego kuponu papieru wartościowego.",
      },
      {
        name: "stawka",
        detail: "Oprocentowanie papieru wartościowego.",
      },
      {
        name: "cena",
        detail: "Cena papieru wartościowego.",
      },
      {
        name: "wartość_wykupu",
        detail:
          "Wartość wykupu papieru wartościowego według wartości nominalnej 100 dolarów.",
      },
      {
        name: "częstotliwość",
        detail:
          "Płatność kuponowa w ciągu roku: 1 roczna, 2 półroczna, 4 kwartalna.",
      },
      {
        name: "podstawa",
        detail:
          "Podstawa liczenia dni: 0 US 30/360 (domyślnie), 1 rzeczywista/rzeczywista, 2 rzeczywista/360, 3 rzeczywista/365, 4 europejska 30/360.",
      },
    ],
  },
  {
    n: "ODDLPRICE",
    d: "Zwraca cenę za 100 USD wartości nominalnej papieru wartościowego z nieregularnym ostatnim okresem.",
    a: "Cena obligacji z nieregularnym ostatnim okresem.",
    p: [
      {
        name: "data_rozrachunku",
        detail: "Data rozliczenia papieru wartościowego.",
      },
      {
        name: "termin_zapadalności",
        detail: "Termin zapadalności papieru wartościowego.",
      },
      {
        name: "ostatnie_odsetki",
        detail: "Data ostatniego kuponu papieru wartościowego.",
      },
      {
        name: "stawka",
        detail: "Oprocentowanie papieru wartościowego.",
      },
      {
        name: "rentowność",
        detail: "Roczna stopa zwrotu papieru wartościowego.",
      },
      {
        name: "wartość_wykupu",
        detail:
          "Wartość wykupu papieru wartościowego według wartości nominalnej 100 dolarów.",
      },
      {
        name: "częstotliwość",
        detail:
          "Płatność kuponowa w ciągu roku: 1 roczna, 2 półroczna, 4 kwartalna.",
      },
      {
        name: "podstawa",
        detail:
          "Podstawa liczenia dni: 0 US 30/360 (domyślnie), 1 rzeczywista/rzeczywista, 2 rzeczywista/360, 3 rzeczywista/365, 4 europejska 30/360.",
      },
    ],
  },
  {
    n: "ODDLYIELD",
    d: "Zwraca rentowność papieru wartościowego z nieregularnym ostatnim okresem.",
    a: "Rentowność obligacji z nieregularnym ostatnim okresem.",
    p: [
      {
        name: "data_rozrachunku",
        detail: "Data rozliczenia papieru wartościowego.",
      },
      {
        name: "termin_zapadalności",
        detail: "Termin zapadalności papieru wartościowego.",
      },
      {
        name: "ostatnie_odsetki",
        detail: "Data ostatniego kuponu papieru wartościowego.",
      },
      {
        name: "stawka",
        detail: "Oprocentowanie papieru wartościowego.",
      },
      {
        name: "cena",
        detail: "Cena papieru wartościowego.",
      },
      {
        name: "wartość_wykupu",
        detail:
          "Wartość wykupu papieru wartościowego według wartości nominalnej 100 dolarów.",
      },
      {
        name: "częstotliwość",
        detail:
          "Płatność kuponowa w ciągu roku: 1 roczna, 2 półroczna, 4 kwartalna.",
      },
      {
        name: "podstawa",
        detail:
          "Podstawa liczenia dni: 0 US 30/360 (domyślnie), 1 rzeczywista/rzeczywista, 2 rzeczywista/360, 3 rzeczywista/365, 4 europejska 30/360.",
      },
    ],
  },
  {
    n: "OFFSET",
    d: "Zwraca odwołanie do zakresu będącego określoną liczbą wierszy i kolumn z komórki lub zakresu komórek.",
    a: "Przesunięcie odniesienia od punktu początkowego.",
    p: [
      {
        name: "odniesienie",
        detail: "Odniesienie, od którego chcesz oprzeć przesunięcie.",
      },
      {
        name: "wiersze",
        detail:
          "Liczba wierszy, w górę lub w dół, do których ma się odnosić lewa górna komórka.",
      },
      {
        name: "kolumny",
        detail:
          "Liczba kolumn, po lewej lub prawej stronie, do których ma odnosić się lewa górna komórka.",
      },
      {
        name: "wysokość",
        detail:
          "Wysokość w liczbie wierszy zwróconego odniesienia; domyślnie wysokość wynosi `odniesienie`.",
      },
      {
        name: "szerokość",
        detail:
          "Szerokość zwracanego odniesienia w liczbie kolumn; domyślnie szerokość wynosi `odniesienie`.",
      },
    ],
  },
  {
    n: "OR",
    d: "Zwraca TRUE, jeśli którykolwiek argument to TRUE i FALSE, jeśli wszystkie argumenty to FALSE.",
    a: "TRUE, jeśli jakikolwiek argument to TRUE.",
    p: [
      {
        name: "logiczne1",
        detail:
          "Pierwszy warunek do przetestowania, który może mieć wartość TRUE lub FALSE.",
      },
      {
        name: "logiczne2",
        detail: "Dodatkowe warunki do przetestowania, łącznie do 255.",
      },
    ],
  },
  {
    n: "PDURATION",
    d: "Zwraca liczbę okresów wymaganych przez inwestycję, aby osiągnęła określoną wartość.",
    a: "Okresy potrzebne do osiągnięcia wartości.",
    p: [
      {
        name: "stawka",
        detail: "Stopa procentowa za okres.",
      },
      {
        name: "wartość_bieżąca",
        detail: "Wartość bieżąca inwestycji.",
      },
      {
        name: "wartość_przyszła",
        detail: "Pożądana przyszła wartość inwestycji.",
      },
    ],
  },
  {
    n: "PEARSON",
    d: "Zwraca współczynnik korelacji momentu iloczynu Pearsona, r.",
    a: "Współczynnik korelacji Pearsona.",
    p: [
      {
        name: "tablica1",
        detail: "Zbiór niezależnych wartości.",
      },
      {
        name: "tablica2",
        detail: "Zbiór wartości zależnych.",
      },
    ],
  },
  {
    n: "PERCENTILE.EXC",
    d: "Zwraca k-ty percentyl wartości w zakresie, gdzie k należy do zakresu od 0 do 1, wyłącznie.",
    a: "K-ty percentyl, wyłączny.",
    p: [
      {
        name: "tablica",
        detail: "Tablica lub zakres danych definiujący względną pozycję.",
      },
      {
        name: "k",
        detail: "Wartość percentyla, z wyłączeniem 0 i 1.",
      },
    ],
  },
  {
    n: "PERCENTILE.INC",
    d: "Zwraca k-ty percentyl wartości w zakresie, gdzie k należy do zakresu od 0 do 1 włącznie.",
    a: "K-ty percentyl włącznie.",
    p: [
      {
        name: "tablica",
        detail: "Tablica lub zakres danych definiujący względną pozycję.",
      },
      {
        name: "k",
        detail: "Wartość percentyla w zakresie od 0 do 1 włącznie.",
      },
    ],
  },
  {
    n: "PERCENTOF",
    d: "Zwraca procent, jaki podzbiór danych składa się ze wszystkich danych, czyli SUM(podzbiór_danych)/SUM(wszystkie_dane).",
    a: "Podzbiór jako procent całości.",
    p: [
      {
        name: "podzbiór_danych",
        detail: "Wartości będące częścią podzbioru.",
      },
      {
        name: "wszystkie_dane",
        detail: "Wartości tworzące cały zbiór.",
      },
    ],
  },
  {
    n: "PERCENTRANK",
    d: "Zwraca rangę wartości w zestawie danych jako procent (0..1 włącznie) zbioru danych.",
    a: "Ranga procentowa (zgodność).",
    p: [
      {
        name: "tablica",
        detail: "Tablica lub zakres wartości liczbowych.",
      },
      {
        name: "x",
        detail: "Wartość, której rangę chcesz.",
      },
      {
        name: "cyfry_znaczące",
        detail: "Liczba cyfr znaczących; domyślny 3.",
      },
    ],
  },
  {
    n: "PERCENTRANK.EXC",
    d: "Zwraca rangę wartości w zestawie danych jako procent (0 do 1, wyłącznie) zbioru danych.",
    a: "Ranga procentowa, wyłączna.",
    p: [
      {
        name: "tablica",
        detail:
          "Tablica lub zakres danych z wartościami liczbowymi, który definiuje względną pozycję.",
      },
      {
        name: "x",
        detail: "Wartość, dla której chcesz poznać rangę.",
      },
      {
        name: "cyfry_znaczące",
        detail:
          "Liczba cyfr znaczących zwracanej wartości procentowej; domyślnie 3.",
      },
    ],
  },
  {
    n: "PERCENTRANK.INC",
    d: "Zwraca rangę wartości w zestawie danych jako procent (od 0 do 1 włącznie) zbioru danych.",
    a: "Pozycja procentowa włącznie.",
    p: [
      {
        name: "tablica",
        detail:
          "Tablica lub zakres danych z wartościami liczbowymi, który definiuje względną pozycję.",
      },
      {
        name: "x",
        detail: "Wartość, dla której chcesz poznać rangę.",
      },
      {
        name: "cyfry_znaczące",
        detail:
          "Liczba cyfr znaczących zwracanej wartości procentowej; domyślnie 3.",
      },
    ],
  },
  {
    n: "PERMUT",
    d: "Zwraca liczbę permutacji dla danej liczby obiektów, które można wybrać spośród obiektów liczbowych.",
    a: "Liczba permutacji.",
    p: [
      {
        name: "numer",
        detail: "Liczba całkowita opisująca liczbę obiektów.",
      },
      {
        name: "liczba_wybranych",
        detail:
          "Liczba całkowita opisująca liczbę obiektów w każdej permutacji.",
      },
    ],
  },
  {
    n: "PERMUTATIONA",
    d: "Zwraca liczbę permutacji dla danej liczby obiektów (z powtórzeniami), które można wybrać z całkowitej liczby obiektów.",
    a: "Liczba permutacji z powtórzeniami.",
    p: [
      {
        name: "numer",
        detail: "Liczba całkowita opisująca całkowitą liczbę obiektów.",
      },
      {
        name: "liczba_wybranych",
        detail:
          "Liczba całkowita opisująca liczbę obiektów w każdej permutacji.",
      },
    ],
  },
  {
    n: "PHI",
    d: "Zwraca wartość funkcji gęstości dla standardowego rozkładu normalnego.",
    a: "Standardowa gęstość normalna.",
    p: [
      {
        name: "x",
        detail:
          "Liczba, dla której chcesz uzyskać gęstość standardowego rozkładu normalnego.",
      },
    ],
  },
  {
    n: "PHONETIC",
    d: "Wyodrębnia znaki fonetyczne (furigana) z ciągu tekstowego; zwraca sam tekst, gdy go nie ma.",
    a: "Znaki fonetyczne tekstu.",
    p: [
      {
        name: "odniesienie",
        detail: "Ciąg tekstowy lub odwołanie do komórki.",
      },
    ],
  },
  {
    n: "PI",
    d: "Zwraca liczbę 3,14159265358979, stałą matematyczną pi, z dokładnością do 15 cyfr.",
    a: "Wartość pi.",
    p: [],
  },
  {
    n: "PIVOTBY",
    d: "Podsumowuje dane według pól wierszy i kolumn, agregując wartości każdego przecięcia, z opcjonalnymi nagłówkami, sumami, sortowaniem i filtrowaniem.",
    a: "Tabela krzyżowa i agregacja.",
    p: [
      {
        name: "pola_wierszy",
        detail:
          "Wartości zorientowane na kolumny, które stają się nagłówkami wierszy.",
      },
      {
        name: "pola_kolumn",
        detail:
          "Wartości zorientowane na kolumny, które stają się nagłówkami kolumn.",
      },
      {
        name: "wartości",
        detail: "Wartości zorientowane kolumnowo do agregacji.\nFunkcja",
      },
      {
        name: ".",
        detail:
          "LAMBDA lub nazwa funkcji (SUM, AVERAGE, COUNT, PERCENTOF, ...), która agreguje każdą komórkę.",
      },
      {
        name: "nagłówki_pól",
        detail:
          "Czy dane mają nagłówki i czy je pokazać: 0 nie, 1 tak, ale ukryj, 2 nie, ale wygeneruj, 3 tak i pokaż.",
      },
      {
        name: "poziom_sum_wierszy",
        detail:
          "Sumy wierszy: 0 brak, 1 suma całkowita (domyślnie), 2 z sumami częściowymi; negatyw stawia je na pierwszym miejscu.",
      },
      {
        name: "Porządek_sortowania_wierszy",
        detail:
          "Numery kolumn, według których sortowane są wiersze, wartość ujemna w przypadku malejącego.",
      },
      {
        name: "poziom_sum_kolumn",
        detail:
          "Sumy kolumn: 0 brak, 1 suma całkowita (domyślnie), 2 z sumami częściowymi; negatyw stawia je na pierwszym miejscu.",
      },
      {
        name: "kolejność_sortowania_kolumn",
        detail:
          "Numery kolumn, według których sortowane są kolumny, ujemne dla malejącego.",
      },
      {
        name: "tablica_filtrów",
        detail:
          "Wartość logiczna określająca, które wiersze mają zostać uwzględnione.",
      },
      {
        name: "względem",
        detail:
          "Dla funkcji dwuargumentowych, takich jak PERCENTOF: 0 sum w kolumnach, 1 sum w wierszach, 2 sumy końcowe, 3 kolumny nadrzędne, 4 wiersze nadrzędne.",
      },
    ],
  },
  {
    n: "PMT",
    d: "Oblicza spłatę kredytu w oparciu o stałe raty i stałą stopę procentową.",
    a: "Okresowa spłata kredytu.",
    p: [
      {
        name: "stawka",
        detail: "Oprocentowanie pożyczki.",
      },
      {
        name: "liczba_okresów",
        detail: "Łączna liczba spłat kredytu.",
      },
      {
        name: "wartość_bieżąca",
        detail:
          "Wartość bieżąca lub całkowita kwota, jaką obecnie jest warta seria przyszłych płatności (kapitał).",
      },
      {
        name: "wartość_przyszła",
        detail:
          "Przyszła wartość lub saldo gotówkowe, które chcesz po ostatniej płatności; domyślnie wynosi 0.",
      },
      {
        name: "typ",
        detail:
          "Kiedy płatności są wymagalne: 0 lub pominięte na koniec okresu, 1 na początku.",
      },
    ],
  },
  {
    n: "POISSON",
    d: "Zwraca rozkład Poissona.",
    a: "Rozkład Poissona (zgodność).",
    p: [
      {
        name: "x",
        detail: "Liczba zdarzeń.",
      },
      {
        name: "średnia",
        detail: "Oczekiwana wartość liczbowa.",
      },
      {
        name: "kumulatywne",
        detail:
          "TRUE dla prawdopodobieństwa skumulowanego, FALSE dla masy prawdopodobieństwa.",
      },
    ],
  },
  {
    n: "POISSON.DIST",
    d: "Zwraca rozkład Poissona, powszechnie używany do przewidywania liczby zdarzeń w określonym czasie.",
    a: "Rozkład Poissona.",
    p: [
      {
        name: "x",
        detail: "Liczba zdarzeń.",
      },
      {
        name: "średnia",
        detail: "Oczekiwana wartość liczbowa.",
      },
      {
        name: "kumulatywne",
        detail:
          "TRUE zwraca skumulowane prawdopodobieństwo, FALSE funkcję masy prawdopodobieństwa.",
      },
    ],
  },
  {
    n: "POWER",
    d: "Zwraca wynik liczby podniesionej do potęgi.",
    a: "Liczba podniesiona do potęgi.",
    p: [
      {
        name: "numer",
        detail: "Numer podstawowy; dowolną liczbę rzeczywistą.",
      },
      {
        name: "wykładnik",
        detail: "Wykładnik, do którego podnoszona jest liczba podstawowa.",
      },
    ],
  },
  {
    n: "PPMT",
    d: "Zwraca spłatę kapitału za dany okres dla inwestycji w oparciu o okresowe, stałe płatności i stałą stopę procentową.",
    a: "Część kapitałowa płatności.",
    p: [
      {
        name: "stawka",
        detail: "Stopa procentowa za okres.",
      },
      {
        name: "okres",
        detail: "Okres od 1 do `liczba_okresów`.",
      },
      {
        name: "liczba_okresów",
        detail: "Całkowita liczba okresów płatności.",
      },
      {
        name: "wartość_bieżąca",
        detail:
          "Wartość bieżąca, całkowita kwota, jaką obecnie jest warta seria przyszłych płatności.",
      },
      {
        name: "wartość_przyszła",
        detail:
          "Przyszła wartość lub saldo gotówkowe, które chcesz po ostatniej płatności; domyślnie wynosi 0.",
      },
      {
        name: "typ",
        detail:
          "Kiedy płatności są wymagalne: 0 lub pominięte na koniec okresu, 1 na początku.",
      },
    ],
  },
  {
    n: "PRICE",
    d: "Zwraca cenę za 100 dolarów wartości nominalnej papieru wartościowego oprocentowanego okresowo.",
    a: "Cena papieru wartościowego o oprocentowaniu okresowym.",
    p: [
      {
        name: "data_rozrachunku",
        detail: "Data rozliczenia papieru wartościowego.",
      },
      {
        name: "termin_zapadalności",
        detail: "Termin zapadalności papieru wartościowego.",
      },
      {
        name: "stawka",
        detail: "Roczna stopa kuponu papieru wartościowego.",
      },
      {
        name: "rentowność",
        detail: "Roczna stopa zwrotu papieru wartościowego.",
      },
      {
        name: "wartość_wykupu",
        detail:
          "Wartość wykupu papieru wartościowego według wartości nominalnej 100 dolarów.",
      },
      {
        name: "częstotliwość",
        detail:
          "Liczba wypłat kuponowych w ciągu roku: 1 roczna, 2 półroczne, 4 kwartalne.",
      },
      {
        name: "podstawa",
        detail:
          "Podstawa liczenia dni: 0 lub pominięty US 30/360, 1 faktyczny/rzeczywisty, 2 rzeczywisty/360, 3 rzeczywisty/365, 4 europejski 30/360.",
      },
    ],
  },
  {
    n: "PRICEDISC",
    d: "Zwraca cenę za 100 dolarów wartości nominalnej papieru wartościowego z dyskontem.",
    a: "Cena zdyskontowanego papieru wartościowego.",
    p: [
      {
        name: "data_rozrachunku",
        detail: "Data rozliczenia papieru wartościowego.",
      },
      {
        name: "termin_zapadalności",
        detail: "Termin zapadalności papieru wartościowego.",
      },
      {
        name: "stopa_dyskontowa",
        detail: "Stopa dyskonta papieru wartościowego.",
      },
      {
        name: "wartość_wykupu",
        detail:
          "Wartość wykupu papieru wartościowego według wartości nominalnej 100 dolarów.",
      },
      {
        name: "podstawa",
        detail:
          "Podstawa liczenia dni: 0 lub pominięty US 30/360, 1 faktyczny/rzeczywisty, 2 rzeczywisty/360, 3 rzeczywisty/365, 4 europejski 30/360.",
      },
    ],
  },
  {
    n: "PRICEMAT",
    d: "Zwraca cenę za 100 dolarów wartości nominalnej papieru wartościowego, który płaci odsetki w terminie zapadalności.",
    a: "Cena papieru wartościowego płatnego w terminie zapadalności.",
    p: [
      {
        name: "data_rozrachunku",
        detail: "Data rozliczenia papieru wartościowego.",
      },
      {
        name: "termin_zapadalności",
        detail: "Termin zapadalności papieru wartościowego.",
      },
      {
        name: "data_emisji",
        detail: "Data emisji papieru wartościowego.",
      },
      {
        name: "stawka",
        detail: "Oprocentowanie papieru wartościowego w dniu emisji.",
      },
      {
        name: "rentowność",
        detail: "Roczna stopa zwrotu papieru wartościowego.",
      },
      {
        name: "podstawa",
        detail:
          "Podstawa liczenia dni: 0 lub pominięty US 30/360, 1 faktyczny/rzeczywisty, 2 rzeczywisty/360, 3 rzeczywisty/365, 4 europejski 30/360.",
      },
    ],
  },
  {
    n: "PROB",
    d: "Zwraca prawdopodobieństwo, że wartości w zakresie mieszczą się pomiędzy dwiema granicami lub są równe dolnej granicy, jeśli pominięto górną granicę.",
    a: "Prawdopodobieństwo, że wartości mieszczą się w granicach.",
    p: [
      {
        name: "x_zakres",
        detail:
          "Zakres wartości numerycznych x, z którymi powiązane są prawdopodobieństwa.",
      },
      {
        name: "zakres_prawdopodobieństw",
        detail:
          "Zbiór prawdopodobieństw powiązanych z wartościami w `x_zakres`; muszą sumować się do 1.",
      },
      {
        name: "Dolna_granica",
        detail:
          "Dolna granica wartości, dla której chcesz określić prawdopodobieństwo.",
      },
      {
        name: "górna_granica",
        detail:
          "Opcjonalna górna granica wartości, dla której chcesz określić prawdopodobieństwo.",
      },
    ],
  },
  {
    n: "PRODUCT",
    d: "Mnoży wszystkie liczby podane jako argumenty i zwraca iloczyn.",
    a: "Iloczyn liczb.",
    p: [
      {
        name: "numer_1",
        detail: "Pierwsza liczba lub zakres, który chcesz pomnożyć.",
      },
      {
        name: "numer2",
        detail: "Dodatkowe numery lub zakresy, łącznie do 255.",
      },
    ],
  },
  {
    n: "PROPER",
    d: "Zamienia pierwszą literę w ciągu tekstowym na wielką literę oraz wszelkie inne litery, które następują po znaku innym niż litera; konwertuje wszystkie pozostałe litery na małe.",
    a: "Zamienia pierwszą literę każdego słowa na wielką.",
    p: [
      {
        name: "tekst",
        detail:
          "Tekst w cudzysłowie, formuła zwracająca tekst lub odwołanie do komórki zawierającej tekst.",
      },
    ],
  },
  {
    n: "PV",
    d: "Oblicza wartość bieżącą kredytu lub inwestycji w oparciu o stałą stopę procentową.",
    a: "Wartość bieżąca inwestycji.",
    p: [
      {
        name: "stawka",
        detail: "Stopa procentowa za okres.",
      },
      {
        name: "liczba_okresów",
        detail: "Całkowita liczba okresów płatności w ramach renty.",
      },
      {
        name: "płatność",
        detail:
          "Płatność dokonywana w każdym okresie; nie może się ona zmienić w trakcie trwania renty.",
      },
      {
        name: "wartość_przyszła",
        detail:
          "Przyszła wartość lub saldo gotówkowe, które chcesz po ostatniej płatności; domyślnie wynosi 0.",
      },
      {
        name: "typ",
        detail:
          "Kiedy płatności są wymagalne: 0 lub pominięte na koniec okresu, 1 na początku.",
      },
    ],
  },
  {
    n: "QUARTILE.EXC",
    d: "Zwraca kwartyl zbioru danych na podstawie wartości percentyla od 0 do 1, wyłącznie.",
    a: "Kwartyl, wyłączny.",
    p: [
      {
        name: "tablica",
        detail:
          "Tablica lub zakres komórek zawierających wartości liczbowe, dla których ma zostać utworzony kwartyl.",
      },
      {
        name: "kwartyl",
        detail: "Który kwartyl zwrócić: 1, 2 lub 3.",
      },
    ],
  },
  {
    n: "QUARTILE.INC",
    d: "Zwraca kwartyl zbioru danych na podstawie wartości percentyla od 0 do 1 włącznie.",
    a: "Kwartyl włącznie.",
    p: [
      {
        name: "tablica",
        detail:
          "Tablica lub zakres komórek zawierających wartości liczbowe, dla których ma zostać utworzony kwartyl.",
      },
      {
        name: "kwartyl",
        detail:
          "Który kwartyl zwrócić: 0 minimum, 1 pierwszy kwartyl, 2 mediana, 3 trzeci kwartyl, 4 maksimum.",
      },
    ],
  },
  {
    n: "QUOTIENT",
    d: "Zwraca część całkowitą dzielenia, odrzucając resztę.",
    a: "Część całkowita dzielenia.",
    p: [
      {
        name: "licznik",
        detail: "Dywidenda.",
      },
      {
        name: "mianownik",
        detail: "Dzielnik.",
      },
    ],
  },
  {
    n: "RADIANS",
    d: "Konwertuje stopnie na radiany.",
    a: "Konwertuje stopnie na radiany.",
    p: [
      {
        name: "kąt",
        detail: "Kąt w stopniach, który chcesz przeliczyć.",
      },
    ],
  },
  {
    n: "RAND",
    d: "Zwraca równomiernie rozłożoną losową liczbę rzeczywistą większą lub równą 0 i mniejszą niż 1. Przy każdym obliczaniu arkusza zwracana jest nowa liczba.",
    a: "Liczba losowa z zakresu od 0 do 1.",
    p: [],
  },
  {
    n: "RANDARRAY",
    d: "Zwraca tablicę liczb losowych. Możesz ustawić liczbę wierszy i kolumn, wartości minimalne i maksymalne oraz określić, czy zwracane mają być liczby całkowite czy dziesiętne.",
    a: "Tablica liczb losowych.",
    p: [
      {
        name: "wiersze",
        detail: "Liczba wierszy do zwrócenia; domyślnie 1.",
      },
      {
        name: "kolumny",
        detail: "Liczba kolumn do zwrócenia; domyślnie 1.",
      },
      {
        name: "min",
        detail: "Minimalna liczba do zwrócenia; domyślnie wynosi 0.",
      },
      {
        name: "max",
        detail: "Maksymalna liczba do zwrócenia; domyślnie 1.",
      },
      {
        name: "liczba_całkowita",
        detail:
          "TRUE zwraca liczby całkowite, FALSE lub pominięte zwraca liczby dziesiętne.",
      },
    ],
  },
  {
    n: "RANDBETWEEN",
    d: "Zwraca losową liczbę całkowitą pomiędzy określonymi liczbami. Przy każdym obliczeniu arkusza zwracana jest nowa liczba.",
    a: "Losowa liczba całkowita pomiędzy dwiema wartościami.",
    p: [
      {
        name: "dół",
        detail: "Zwróci najmniejszą liczbę całkowitą RANDBETWEEN.",
      },
      {
        name: "góra",
        detail: "Zwróci największą liczbę całkowitą RANDBETWEEN.",
      },
    ],
  },
  {
    n: "RANK.AVG",
    d: "Zwraca rangę liczby na liście liczb; jeśli więcej niż jedna wartość ma tę samą rangę, zwracana jest średnia ranga.",
    a: "Pozycja liczby; przy równych wartościach zwracana jest średnia pozycja.",
    p: [
      {
        name: "numer",
        detail: "Liczba, której rangę chcesz znaleźć.",
      },
      {
        name: "odwołanie",
        detail:
          "Tablica lub odniesienie do listy liczb. Wartości inne niż numeryczne są ignorowane.",
      },
      {
        name: "kolejność",
        detail:
          "0 lub pominięte rangi w kolejności malejącej; każda wartość różna od zera jest szeregowana w kolejności rosnącej.",
      },
    ],
  },
  {
    n: "RANK.EQ",
    d: "Zwraca rangę liczby na liście liczb; jeśli więcej niż jedna wartość ma tę samą rangę, zwracana jest najwyższa ranga z tego zestawu.",
    a: "Pozycja liczby; równe wartości mają tę samą najwyższą pozycję.",
    p: [
      {
        name: "numer",
        detail: "Liczba, której rangę chcesz znaleźć.",
      },
      {
        name: "odwołanie",
        detail:
          "Tablica lub odniesienie do listy liczb. Wartości inne niż numeryczne są ignorowane.",
      },
      {
        name: "kolejność",
        detail:
          "0 lub pominięte rangi w kolejności malejącej; każda wartość różna od zera jest szeregowana w kolejności rosnącej.",
      },
    ],
  },
  {
    n: "RATE",
    d: "Zwraca stopę procentową za okres renty. Wartość RATE jest obliczana metodą iteracji i może mieć zero lub więcej rozwiązań.",
    a: "Oprocentowanie za okres renty.",
    p: [
      {
        name: "liczba_okresów",
        detail: "Całkowita liczba okresów płatności w ramach renty.",
      },
      {
        name: "płatność",
        detail:
          "Płatność dokonywana w każdym okresie; nie może się ona zmienić w trakcie trwania renty.",
      },
      {
        name: "wartość_bieżąca",
        detail:
          "Wartość bieżąca, całkowita kwota, jaką obecnie jest warta seria przyszłych płatności.",
      },
      {
        name: "wartość_przyszła",
        detail:
          "Przyszła wartość lub saldo gotówkowe, które chcesz po ostatniej płatności; domyślnie wynosi 0.",
      },
      {
        name: "typ",
        detail:
          "Kiedy płatności są wymagalne: 0 lub pominięte na koniec okresu, 1 na początku.",
      },
      {
        name: "przypuszczenie",
        detail:
          "Twoje przypuszczenie, jaka będzie stawka; domyślnie wynosi 10 procent.",
      },
    ],
  },
  {
    n: "RECEIVED",
    d: "Zwraca kwotę otrzymaną w terminie zapadalności w pełni zainwestowanego papieru wartościowego.",
    a: "Kwota otrzymana w terminie zapadalności.",
    p: [
      {
        name: "data_rozrachunku",
        detail: "Data rozliczenia papieru wartościowego.",
      },
      {
        name: "termin_zapadalności",
        detail: "Termin zapadalności papieru wartościowego.",
      },
      {
        name: "inwestycja",
        detail: "Kwota zainwestowana w papier wartościowy.",
      },
      {
        name: "stopa_dyskontowa",
        detail: "Stopa dyskonta papieru wartościowego.",
      },
      {
        name: "podstawa",
        detail:
          "Podstawa liczenia dni: 0 lub pominięty US 30/360, 1 faktyczny/rzeczywisty, 2 rzeczywisty/360, 3 rzeczywisty/365, 4 europejski 30/360.",
      },
    ],
  },
  {
    n: "REDUCE",
    d: "Redukuje tablicę do wartości skumulowanej, stosując LAMBDA do każdej wartości i zwracając całkowitą wartość w akumulatorze.",
    a: "Redukuje tablicę do pojedynczej wartości.",
    p: [
      {
        name: "wartość_początkowa",
        detail: "Wartość początkowa akumulatora.",
      },
      {
        name: "tablica",
        detail: "Tablica, która ma zostać zmniejszona.",
      },
      {
        name: "lambda",
        detail: "Wywołanie LAMBDA z akumulatorem i bieżącą wartością.",
      },
    ],
  },
  {
    n: "REGEXEXTRACT",
    d: "Wyodrębnia ciągi znaków z podanego tekstu, które pasują do wzorca.",
    a: "Tekst pasujący do wyrażenia regularnego.",
    p: [
      {
        name: "tekst",
        detail:
          "Tekst lub odwołanie do komórki zawierającej tekst, z którego chcesz wyodrębnić ciągi znaków.",
      },
      {
        name: "wzór",
        detail:
          "Wyrażenie regularne opisujące wzór tekstu, który chcesz wyodrębnić.",
      },
      {
        name: "tryb_powrotu",
        detail:
          "0 lub pominięte zwraca pierwsze dopasowanie, 1 wszystkie dopasowania jako tablicę, 2 grupy przechwytujące pierwszego dopasowania jako tablicę.",
      },
      {
        name: "rozróżnianie_wielkości_liter",
        detail:
          "Wartość 0 lub pominięta uwzględnia wielkość liter, wartość 1 nie uwzględnia wielkości liter.",
      },
    ],
  },
  {
    n: "REGEXREPLACE",
    d: "Zastępuje ciągi znaków w podanym tekście, które pasują do wzorca zamiennikiem.",
    a: "Zastępuje tekst pasujący do wyrażenia regularnego.",
    p: [
      {
        name: "tekst",
        detail:
          "Tekst lub odwołanie do komórki zawierającej tekst, w którym chcesz zastąpić ciągi znaków.",
      },
      {
        name: "wzór",
        detail:
          "Wyrażenie regularne opisujące wzór tekstu, który chcesz zastąpić.",
      },
      {
        name: "wymiana",
        detail: "Tekst, który chcesz zastąpić wystąpieniami `wzór`.",
      },
      {
        name: "wystąpienie",
        detail:
          "Które wystąpienie zastąpić: 0 lub pominięte zastępuje wszystko, liczba ujemna liczy się od końca.",
      },
      {
        name: "rozróżnianie_wielkości_liter",
        detail:
          "Wartość 0 lub pominięta uwzględnia wielkość liter, wartość 1 nie uwzględnia wielkości liter.",
      },
    ],
  },
  {
    n: "REGEXTEST",
    d: "Pozwala sprawdzić, czy jakakolwiek część podanego tekstu pasuje do wyrażenia regularnego.",
    a: "Sprawdza tekst pod kątem wyrażenia regularnego.",
    p: [
      {
        name: "tekst",
        detail:
          "Tekst lub odwołanie do komórki zawierającej tekst, do którego chcesz dopasować.",
      },
      {
        name: "wzór",
        detail:
          "Wyrażenie regularne opisujące wzór tekstu, który chcesz dopasować.",
      },
      {
        name: "rozróżnianie_wielkości_liter",
        detail:
          "Wartość 0 lub pominięta uwzględnia wielkość liter, wartość 1 nie uwzględnia wielkości liter.",
      },
    ],
  },
  {
    n: "REPLACE",
    d: "Zastępuje część ciągu tekstowego, w oparciu o określoną liczbę znaków, innym ciągiem tekstowym.",
    a: "Zastępuje znaki na pozycji.",
    p: [
      {
        name: "stary_tekst",
        detail: "Tekst, w którym chcesz zamienić niektóre znaki.",
      },
      {
        name: "pozycja_początkowa",
        detail:
          "Pozycja znaku w `stary_tekst`, który chcesz zastąpić `nowy_tekst`.",
      },
      {
        name: "liczba_znaków",
        detail: "Liczba znaków w `stary_tekst`, które chcesz zastąpić REPLACE.",
      },
      {
        name: "nowy_tekst",
        detail: "Tekst, który zastąpi znaki w `stary_tekst`.",
      },
    ],
  },
  {
    n: "REPLACEB",
    d: "Zastępuje część ciągu tekstowego, w oparciu o liczbę bajtów, innym ciągiem tekstowym.",
    a: "Zamień część tekstu (bajty).",
    p: [
      {
        name: "stary_tekst",
        detail: "Tekst, w którym chcesz zamienić niektóre znaki.",
      },
      {
        name: "pozycja_początkowa",
        detail: "Pozycja pierwszego znaku do zastąpienia.",
      },
      {
        name: "liczba_bajtów",
        detail: "Liczba bajtów do zastąpienia.",
      },
      {
        name: "nowy_tekst",
        detail: "Tekst zastępujący znaki.",
      },
    ],
  },
  {
    n: "REPT",
    d: "Powtarza tekst określoną liczbę razy.",
    a: "Powtarza tekst.",
    p: [
      {
        name: "tekst",
        detail: "Tekst, który chcesz powtórzyć.",
      },
      {
        name: "liczba_powtórzeń",
        detail: "Liczba dodatnia określająca liczbę powtórzeń `tekst`.",
      },
    ],
  },
  {
    n: "RIGHT",
    d: "Zwraca ostatni znak lub znaki w ciągu tekstowym, na podstawie określonej liczby znaków.",
    a: "Znaki tekstu znajdujące się najbardziej na prawo.",
    p: [
      {
        name: "tekst",
        detail: "Ciąg tekstowy zawierający znaki, które chcesz wyodrębnić.",
      },
      {
        name: "liczba_znaków",
        detail: "Liczba znaków, które chcesz wyodrębnić RIGHT; domyślnie 1.",
      },
    ],
  },
  {
    n: "RIGHTB",
    d: "Zwraca ostatnie znaki ciągu tekstowego na podstawie liczby bajtów.",
    a: "Znaki znajdujące się skrajnie na prawo (bajty).",
    p: [
      {
        name: "tekst",
        detail: "Ciąg tekstowy zawierający znaki, które chcesz wyodrębnić.",
      },
      {
        name: "liczba_bajtów",
        detail: "Liczba bajtów do wyodrębnienia; domyślnie 1.",
      },
    ],
  },
  {
    n: "ROMAN",
    d: "Konwertuje cyfrę arabską na rzymską jako tekst.",
    a: "Konwertuje liczbę na cyfrę rzymską.",
    p: [
      {
        name: "numer",
        detail: "Cyfra arabska, którą chcesz przekonwertować, od 1 do 3999.",
      },
      {
        name: "forma",
        detail:
          "Rodzaj cyfry rzymskiej: 0 lub TRUE klasyczny, 1 do 3 stopniowo bardziej zwięzły, 4 lub FALSE uproszczony.",
      },
    ],
  },
  {
    n: "ROUND",
    d: "Zaokrągla liczbę do określonej liczby cyfr.",
    a: "Zaokrągla do liczby cyfr.",
    p: [
      {
        name: "numer",
        detail: "Liczba, którą chcesz zaokrąglić.",
      },
      {
        name: "liczba_cyfr",
        detail:
          "Liczba cyfr do zaokrąglenia. Wartości ujemne zaokrągla się w lewo od przecinka dziesiętnego.",
      },
    ],
  },
  {
    n: "ROUNDDOWN",
    d: "Zaokrągla liczbę w dół, w stronę zera, do określonej liczby cyfr.",
    a: "Zaokrągla w kierunku zera.",
    p: [
      {
        name: "numer",
        detail: "Dowolna liczba rzeczywista, którą chcesz zaokrąglić w dół.",
      },
      {
        name: "liczba_cyfr",
        detail:
          "Liczba cyfr do zaokrąglenia. Wartości ujemne zaokrągla się w lewo od przecinka dziesiętnego.",
      },
    ],
  },
  {
    n: "ROUNDUP",
    d: "Zaokrągla liczbę w górę od zera do określonej liczby cyfr.",
    a: "Zaokrągla od zera.",
    p: [
      {
        name: "numer",
        detail: "Dowolna liczba rzeczywista, którą chcesz zaokrąglić w górę.",
      },
      {
        name: "liczba_cyfr",
        detail:
          "Liczba cyfr do zaokrąglenia. Wartości ujemne zaokrągla się w lewo od przecinka dziesiętnego.",
      },
    ],
  },
  {
    n: "ROW",
    d: "Zwraca numer wiersza odwołania lub komórki zawierającej formułę, jeżeli został pominięty.",
    a: "Numer wiersza odniesienia.",
    p: [
      {
        name: "odniesienie",
        detail:
          "Komórka lub zakres komórek, dla którego chcesz podać numer wiersza.",
      },
    ],
  },
  {
    n: "ROWS",
    d: "Zwraca liczbę wierszy w odwołaniu lub tablicy.",
    a: "Liczba wierszy w zakresie.",
    p: [
      {
        name: "tablica",
        detail:
          "Tablica, formuła tablicowa lub odniesienie do zakresu komórek.",
      },
    ],
  },
  {
    n: "RRI",
    d: "Zwraca równoważną stopę procentową dla wzrostu inwestycji.",
    a: "Równoważna stopa procentowa dla wzrostu.",
    p: [
      {
        name: "liczba_okresów",
        detail: "Liczba okresów inwestycji.",
      },
      {
        name: "wartość_bieżąca",
        detail: "Wartość bieżąca inwestycji.",
      },
      {
        name: "wartość_przyszła",
        detail: "Przyszła wartość inwestycji.",
      },
    ],
  },
  {
    n: "RSQ",
    d: "Zwraca kwadrat współczynnika korelacji momentu iloczynu Pearsona poprzez punkty danych w known_y i known_x.",
    a: "R-kwadrat regresji liniowej.",
    p: [
      {
        name: "znane_y",
        detail: "Tablica lub zakres punktów danych.",
      },
      {
        name: "znane_x",
        detail: "Tablica lub zakres punktów danych.",
      },
    ],
  },
  {
    n: "SCAN",
    d: "Skanuje tablicę, stosując LAMBDA do każdej wartości i zwraca tablicę zawierającą każdą wartość pośrednią.",
    a: "Bieżąca akumulacja z LAMBDA.",
    p: [
      {
        name: "wartość_początkowa",
        detail: "Wartość początkowa akumulatora.",
      },
      {
        name: "tablica",
        detail: "Tablica do przeskanowania.",
      },
      {
        name: "lambda",
        detail: "Wywołanie LAMBDA z akumulatorem i bieżącą wartością.",
      },
    ],
  },
  {
    n: "SEARCH",
    d: "Lokalizuje jeden ciąg tekstowy w drugim ciągu tekstowym i zwraca pozycję początkową pierwszego. Nie rozróżniana jest wielkość liter; obsługuje symbole wieloznaczne? I *.",
    a: "Pozycja tekstu w tekście (wielkość liter nie ma znaczenia).",
    p: [
      {
        name: "szukany_tekst",
        detail:
          "Tekst, który chcesz znaleźć; może zawierać symbole wieloznaczne? I *.",
      },
      {
        name: "w_tekście",
        detail: "Tekst, w którym chcesz szukać `szukany_tekst`.",
      },
      {
        name: "pozycja_początkowa",
        detail:
          "Numer znaku w `w_tekście`, od którego chcesz rozpocząć wyszukiwanie; domyślnie 1.",
      },
    ],
  },
  {
    n: "SEARCHB",
    d: "Znajduje jeden ciąg tekstowy w innym (wielkość liter nie ma znaczenia, dozwolone są symbole wieloznaczne) i zwraca jego pozycję początkową, zliczając bajty.",
    a: "Pozycja tekstu (w bajtach) nie uwzględnia wielkości liter.",
    p: [
      {
        name: "szukany_tekst",
        detail: "Tekst, który chcesz znaleźć.",
      },
      {
        name: "w_tekście",
        detail: "Tekst, w którym chcesz szukać.",
      },
      {
        name: "pozycja_początkowa",
        detail: "Znak, od którego należy rozpocząć wyszukiwanie.",
      },
    ],
  },
  {
    n: "SEC",
    d: "Zwraca secans kąta podanego w radianach.",
    a: "Sieczna kąta w radianach.",
    p: [
      {
        name: "numer",
        detail:
          "Kąt w radianach; jego wartość bezwzględna musi być mniejsza niż 2^27.",
      },
    ],
  },
  {
    n: "SECH",
    d: "Zwraca secans hiperboliczny kąta.",
    a: "Sieczna hiperboliczna.",
    p: [
      {
        name: "numer",
        detail: "Dowolna liczba rzeczywista.",
      },
    ],
  },
  {
    n: "SECOND",
    d: "Zwraca sekundy wartości czasu jako liczbę całkowitą od 0 do 59.",
    a: "Składowa sekundowa czasu.",
    p: [
      {
        name: "numer_seryjny",
        detail: "Czas zawierający sekundy, które chcesz znaleźć.",
      },
    ],
  },
  {
    n: "SEQUENCE",
    d: "Generuje tablicę kolejnych liczb, np. 1, 2, 3, 4.",
    a: "Tablica kolejnych numerów.",
    p: [
      {
        name: "wiersze",
        detail: "Liczba wierszy do zwrócenia.",
      },
      {
        name: "kolumny",
        detail: "Liczba kolumn do zwrócenia; domyślnie 1.",
      },
      {
        name: "początek",
        detail: "Pierwsza liczba w sekwencji; domyślnie 1.",
      },
      {
        name: "krok",
        detail:
          "Wartość o jaką należy zwiększyć każdą kolejną wartość; domyślnie 1.",
      },
    ],
  },
  {
    n: "SERIESSUM",
    d: "Zwraca sumę szeregu potęgowego na podstawie wzoru a1*x^n + a2*x^(n+m) + a3*x^(n+2m) + ...",
    a: "Suma szeregu potęgowego.",
    p: [
      {
        name: "x",
        detail: "Wartość wejściowa szeregu potęgowego.",
      },
      {
        name: "n",
        detail: "Potęga początkowa, do której chcesz podnieść `x`.",
      },
      {
        name: "m",
        detail:
          "Krok, o jaki należy zwiększyć `n` dla każdego wyrazu w szeregu.",
      },
      {
        name: "współczynników",
        detail:
          "Zestaw współczynników, przez które mnożona jest każda kolejna potęga `x`.",
      },
    ],
  },
  {
    n: "SHEET",
    d: "Zwraca numer arkusza, do którego odnosi się odnośnik.",
    a: "Numer arkusza referencyjnego.",
    p: [
      {
        name: ".",
        detail:
          "Nazwa arkusza lub odnośnika; domyślnie jest to arkusz zawierający formułę.",
      },
    ],
  },
  {
    n: "SHEETS",
    d: "Zwraca liczbę arkuszy w odwołaniu.",
    a: "Liczba arkuszy w odnośniku.",
    p: [
      {
        name: "odniesienie",
        detail:
          "Referencja dla której chcesz podać ilość arkuszy; domyślnie dla wszystkich arkuszy w skoroszycie.",
      },
    ],
  },
  {
    n: "SIGN",
    d: "Zwraca znak liczby: 1 jeśli liczba jest dodatnia, 0 jeśli jest zerowa i -1 jeśli jest ujemna.",
    a: "Znak liczby.",
    p: [
      {
        name: "numer",
        detail: "Dowolna liczba rzeczywista.",
      },
    ],
  },
  {
    n: "SIN",
    d: "Zwraca sinus kąta podanego w radianach.",
    a: "Sinus kąta w radianach.",
    p: [
      {
        name: "numer",
        detail: "Kąt w radianach.",
      },
    ],
  },
  {
    n: "SINH",
    d: "Zwraca sinus hiperboliczny liczby.",
    a: "Sinus hiperboliczny.",
    p: [
      {
        name: "numer",
        detail: "Dowolna liczba rzeczywista.",
      },
    ],
  },
  {
    n: "SKEW",
    d: "Zwraca skośność rozkładu, stopień asymetrii rozkładu wokół jego średniej.",
    a: "Skośność próbki.",
    p: [
      {
        name: "numer_1",
        detail: "Pierwsza liczba lub zakres.",
      },
      {
        name: "numer2",
        detail: "Dodatkowe numery lub zakresy, łącznie do 255.",
      },
    ],
  },
  {
    n: "SKEW.P",
    d: "Zwraca skośność rozkładu na podstawie populacji.",
    a: "Skośność populacji.",
    p: [
      {
        name: "numer_1",
        detail: "Pierwsza liczba lub zakres.",
      },
      {
        name: "numer2",
        detail: "Dodatkowe numery lub zakresy, łącznie do 254.",
      },
    ],
  },
  {
    n: "SLN",
    d: "Zwraca liniową amortyzację środka trwałego w jednym okresie.",
    a: "Amortyzacja liniowa.",
    p: [
      {
        name: "koszt_początkowy",
        detail: "Początkowy koszt środka trwałego.",
      },
      {
        name: "wartość_końcowa",
        detail: "Wartość na koniec amortyzacji.\nWspółczynnik",
      },
      {
        name: "okres_użytkowania",
        detail:
          "Liczba okresów, przez które składnik aktywów jest amortyzowany.",
      },
    ],
  },
  {
    n: "SLOPE",
    d: "Zwraca nachylenie linii regresji liniowej przechodzącej przez punkty danych w known_y i known_x.",
    a: "Nachylenie linii regresji.",
    p: [
      {
        name: "znane_y",
        detail: "Tablica lub zakres komórek liczbowo zależnych punktów danych.",
      },
      {
        name: "znane_x",
        detail: "Zbiór niezależnych punktów danych.",
      },
    ],
  },
  {
    n: "SMALL",
    d: "Zwraca k-tą najmniejszą wartość w zbiorze danych.",
    a: "K-ta najmniejsza wartość.",
    p: [
      {
        name: "tablica",
        detail:
          "Tablica lub zakres danych liczbowych, dla którego chcesz wyznaczyć k-tą najmniejszą wartość.",
      },
      {
        name: "k",
        detail:
          "Pozycja (od najmniejszej) w tablicy lub zakresie danych do zwrócenia.",
      },
    ],
  },
  {
    n: "SORT",
    d: "Sortuje zawartość zakresu lub tablicy.",
    a: "Sortuje zakres lub tablicę.",
    p: [
      {
        name: "tablica",
        detail: "Zakres lub tablica do sortowania.",
      },
      {
        name: "indeks_sortowania",
        detail:
          "Liczba wskazująca wiersz lub kolumnę, według której należy sortować; domyślnie 1.",
      },
      {
        name: "Porządek_sortowania",
        detail: "1 lub pominięte sortowanie rosnące, -1 malejące.",
      },
      {
        name: "według_kolumn",
        detail:
          "FALSE lub pominięte sortuje według wierszy, TRUE sortuje według kolumn.",
      },
    ],
  },
  {
    n: "SORTBY",
    d: "Sortuje zawartość zakresu lub tablicy na podstawie wartości w odpowiednim zakresie lub tablicy.",
    a: "Sortuje według wartości z innych zakresów.",
    p: [
      {
        name: "tablica",
        detail: "Tablica lub zakres do sortowania.",
      },
      {
        name: "według_tablicy1",
        detail: "Tablica lub zakres, według którego ma nastąpić sortowanie.",
      },
      {
        name: "kolejność_sortowania1",
        detail: "Kolejność sortowania: 1 rosnąco (domyślnie), -1 malejąco.",
      },
      {
        name: "według_tablicy2",
        detail: "Dodatkowe tablice lub zakresy do sortowania.",
      },
      {
        name: "porządek_sortowania2",
        detail: "Kolejność odpowiedniej dodatkowej tablicy.",
      },
    ],
  },
  {
    n: "SQRT",
    d: "Zwraca dodatni pierwiastek kwadratowy.",
    a: "Dodatni pierwiastek kwadratowy.",
    p: [
      {
        name: "numer",
        detail: "Liczba, dla której chcesz uzyskać pierwiastek kwadratowy.",
      },
    ],
  },
  {
    n: "SQRTPI",
    d: "Zwraca pierwiastek kwadratowy z (liczba * pi).",
    a: "Pierwiastek kwadratowy z liczby razy pi.",
    p: [
      {
        name: "numer",
        detail: "Liczba, przez którą mnożone jest pi.",
      },
    ],
  },
  {
    n: "STANDARDIZE",
    d: "Zwraca znormalizowaną wartość z rozkładu charakteryzującego się średnią i odchylenie_standardowe.",
    a: "Wartość znormalizowana (wynik z).",
    p: [
      {
        name: "x",
        detail: "Wartość, którą chcesz znormalizować.",
      },
      {
        name: "średnia",
        detail: "Średnia arytmetyczna rozkładu.",
      },
      {
        name: "odchylenie_standardowe",
        detail: "Odchylenie standardowe rozkładu.",
      },
    ],
  },
  {
    n: "STDEV.P",
    d: "Oblicza odchylenie standardowe na podstawie całej populacji podanej jako argumenty, ignorując wartości logiczne i tekst.",
    a: "Odchylenie standardowe populacji.",
    p: [
      {
        name: "numer_1",
        detail: "Pierwsza liczba lub zakres odpowiadający populacji.",
      },
      {
        name: "numer2",
        detail: "Dodatkowe numery lub zakresy, łącznie do 254.",
      },
    ],
  },
  {
    n: "STDEV.S",
    d: "Oszacowuje odchylenie standardowe na podstawie próbki, ignorując wartości logiczne i tekst.",
    a: "Odchylenie standardowe próby.",
    p: [
      {
        name: "numer_1",
        detail: "Pierwsza liczba lub zakres odpowiadający próbce populacji.",
      },
      {
        name: "numer2",
        detail: "Dodatkowe numery lub zakresy, łącznie do 254.",
      },
    ],
  },
  {
    n: "STDEVA",
    d: "Szacuje odchylenie standardowe na podstawie próbki, oceniając tekst jako 0, a wartości logiczne jako 1 lub 0.",
    a: "Odchylenie standardowe próby z uwzględnieniem tekstu i wartości logicznych.",
    p: [
      {
        name: "wartość_1",
        detail: "Pierwsza wartość lub zakres odpowiadający próbce populacji.",
      },
      {
        name: "wartość2",
        detail: "Dodatkowe wartości lub zakresy, łącznie do 255.",
      },
    ],
  },
  {
    n: "STDEVP",
    d: "Oblicza odchylenie standardowe na podstawie całej populacji. Zachowane ze względu na kompatybilność; zobacz STDEV.P.",
    a: "Odchylenie standardowe populacji (starsze).",
    p: [
      {
        name: "numer_1",
        detail: "Pierwsza liczba lub zakres odpowiadający populacji.",
      },
      {
        name: "numer2",
        detail: "Dodatkowe numery lub zakresy, łącznie do 255.",
      },
    ],
  },
  {
    n: "STDEVPA",
    d: "Oblicza odchylenie standardowe na podstawie całej populacji, oceniając tekst jako 0, a wartości logiczne jako 1 lub 0.",
    a: "Odchylenie standardowe populacji obejmujące tekst i elementy logiczne.",
    p: [
      {
        name: "wartość_1",
        detail: "Pierwsza wartość lub zakres odpowiadający populacji.",
      },
      {
        name: "wartość2",
        detail: "Dodatkowe wartości lub zakresy, łącznie do 255.",
      },
    ],
  },
  {
    n: "STEYX",
    d: "Zwraca błąd standardowy przewidywanej wartości y dla każdego x w regresji.",
    a: "Błąd standardowy regresji.",
    p: [
      {
        name: "znane_y",
        detail: "Tablica lub zakres zależnych punktów danych.",
      },
      {
        name: "znane_x",
        detail: "Tablica lub zakres niezależnych punktów danych.",
      },
    ],
  },
  {
    n: "SUBSTITUTE",
    d: "Zastępuje nowy_tekst zamiast stary_tekst w ciągu tekstowym.",
    a: "Zastępuje wystąpienia tekstu.",
    p: [
      {
        name: "tekst",
        detail:
          "Tekst lub odwołanie do komórki zawierającej tekst, który chcesz zastąpić znakami.",
      },
      {
        name: "stary_tekst",
        detail: "Tekst, który chcesz zastąpić.",
      },
      {
        name: "nowy_tekst",
        detail: "Tekst, którym chcesz zastąpić `stary_tekst`.",
      },
      {
        name: "nr_instancji",
        detail:
          "Które wystąpienie `stary_tekst` zastąpić; w przypadku pominięcia każde wystąpienie zostaje zastąpione.",
      },
    ],
  },
  {
    n: "SUBTOTAL",
    d: "Zwraca sumę częściową na liście lub w bazie danych przy użyciu podanej funkcji. Kody od 101 do 111 również ignorują ręcznie ukryte wiersze; odfiltrowane wiersze są zawsze ignorowane.",
    a: "Suma częściowa przy użyciu wybranej funkcji.",
    p: [
      {
        name: "numer_funkcji",
        detail:
          "Od 1 do 11 lub od 101 do 111: AVERAGE, COUNT, COUNTA, MAX, MIN, PRODUCT, STDEV, STDEVP, SUM, VAR, VARP.",
      },
      {
        name: "ref1",
        detail:
          "Pierwszy nazwany zakres lub odniesienie, dla którego chcesz uzyskać sumę częściową.",
      },
      {
        name: "ref2",
        detail:
          "Dodatkowe zakresy do 254, dla których chcesz uzyskać sumę częściową.",
      },
    ],
  },
  {
    n: "SUM",
    d: "Dodaje wszystkie liczby w zakresie komórek.",
    a: "Suma liczb.",
    p: [
      {
        name: "numer_1",
        detail: "Pierwsza liczba lub zakres do dodania.",
      },
      {
        name: "numer2",
        detail: "Dodatkowe liczby lub zakresy do dodania, łącznie do 255.",
      },
    ],
  },
  {
    n: "SUMIF",
    d: "Dodaje komórki w zakresie spełniającym pojedynczy warunek.",
    a: "Suma warunkowa zakresu.",
    p: [
      {
        name: "zakres",
        detail: "Zakres komórek, który ma zostać oceniony przez `kryteria`.",
      },
      {
        name: "kryteria",
        detail:
          "Warunek w postaci liczby, wyrażenia, odwołania do komórki, tekstu lub funkcji, który określa, które komórki zostaną dodane.",
      },
      {
        name: "zakres_sumy",
        detail: "Komórki do dodania, jeśli różnią się od `zakres`.",
      },
    ],
  },
  {
    n: "SUMIFS",
    d: "Dodaje wszystkie swoje argumenty, które spełniają wiele kryteriów.",
    a: "Suma komórek spełniających wiele kryteriów.",
    p: [
      {
        name: "zakres_sumy",
        detail: "Zakres komórek do sumowania.",
      },
      {
        name: "zakres_kryteriów1",
        detail: "Zakres testowany przy użyciu `kryteria1`.",
      },
      {
        name: "kryteria1",
        detail:
          "Kryteria definiujące, które komórki w `zakres_kryteriów1` zostaną dodane.",
      },
      {
        name: "zakres_kryteriów2",
        detail:
          "Dodatkowe zakresy do przetestowania, do 127 par zakres/kryteria.",
      },
      {
        name: "kryteria2",
        detail: "Kryteria dla odpowiedniego dodatkowego zakresu.",
      },
    ],
  },
  {
    n: "SUMPRODUCT",
    d: "Zwraca sumę iloczynów odpowiednich zakresów lub tablic.",
    a: "Suma iloczynów tablic.",
    p: [
      {
        name: "tablica1",
        detail:
          "Pierwsza tablica, której składniki chcesz pomnożyć, a następnie dodać.",
      },
      {
        name: "tablica2",
        detail:
          "Dodatkowe tablice, do 255, o takich samych wymiarach jak `tablica1`.",
      },
    ],
  },
  {
    n: "SUMSQ",
    d: "Zwraca sumę kwadratów argumentów.",
    a: "Suma kwadratów.",
    p: [
      {
        name: "numer_1",
        detail: "Pierwsza liczba lub zakres do podniesienia i dodania.",
      },
      {
        name: "numer2",
        detail: "Dodatkowe numery lub zakresy, łącznie do 255.",
      },
    ],
  },
  {
    n: "SUMX2MY2",
    d: "Zwraca sumę różnicy kwadratów odpowiednich wartości w dwóch tablicach.",
    a: "Suma różnic kwadratów.",
    p: [
      {
        name: "tablica_x",
        detail: "Pierwsza tablica lub zakres wartości.",
      },
      {
        name: "tablica_y",
        detail: "Druga tablica lub zakres wartości.",
      },
    ],
  },
  {
    n: "SUMX2PY2",
    d: "Zwraca sumę kwadratów odpowiednich wartości w dwóch tablicach.",
    a: "Suma sum kwadratów.",
    p: [
      {
        name: "tablica_x",
        detail: "Pierwsza tablica lub zakres wartości.",
      },
      {
        name: "tablica_y",
        detail: "Druga tablica lub zakres wartości.",
      },
    ],
  },
  {
    n: "SUMXMY2",
    d: "Zwraca sumę kwadratów różnic odpowiednich wartości w dwóch tablicach.",
    a: "Suma kwadratów różnic.",
    p: [
      {
        name: "tablica_x",
        detail: "Pierwsza tablica lub zakres wartości.",
      },
      {
        name: "tablica_y",
        detail: "Druga tablica lub zakres wartości.",
      },
    ],
  },
  {
    n: "SWITCH",
    d: "Oblicza jedną wartość (wyrażenie) na podstawie listy wartości i zwraca wynik odpowiadający pierwszej pasującej wartości. Jeśli nie ma dopasowania, zwracana jest opcjonalna wartość domyślna.",
    a: "Wynik dla pierwszej pasującej wartości.",
    p: [
      {
        name: "wyrażenie",
        detail:
          "Wartość, która będzie porównywana z każdym argumentem wartości.",
      },
      {
        name: "wartość_1",
        detail: "Wartość do porównania z `wyrażenie`.",
      },
      {
        name: "wynik1",
        detail: "Wartość do zwrócenia, gdy `wartość_1` pasuje do `wyrażenie`.",
      },
      {
        name: "wartość_domyślna_lub_wartość2",
        detail:
          "Kolejna wartość do porównania lub, jako ostatni argument, wartość domyślna zwracana, gdy nic nie pasuje.",
      },
      {
        name: "wynik2",
        detail:
          "Wartość zwracana w przypadku dopasowania odpowiadającej wartości.",
      },
    ],
  },
  {
    n: "SYD",
    d: "Zwraca sumę cyfr lat amortyzacji środka trwałego w określonym okresie.",
    a: "Amortyzacja metodą sumy cyfr lat.",
    p: [
      {
        name: "koszt_początkowy",
        detail: "Początkowy koszt środka trwałego.",
      },
      {
        name: "wartość_końcowa",
        detail: "Wartość na koniec amortyzacji.\nWspółczynnik",
      },
      {
        name: "okres_użytkowania",
        detail:
          "Liczba okresów, przez które składnik aktywów jest amortyzowany.",
      },
      {
        name: "okres",
        detail: "Okres w tych samych jednostkach co `okres_użytkowania`.",
      },
    ],
  },
  {
    n: "T",
    d: "Zwraca tekst, do którego odnosi się wartość, lub pusty ciąg znaków, jeśli wartość nie jest tekstem.",
    a: 'Zwraca tekst lub "" dla innych wartości.',
    p: [
      {
        name: ".",
        detail: "Wartość, którą chcesz przetestować.",
      },
    ],
  },
  {
    n: "T.DIST",
    d: "Zwraca lewostronny rozkład t-Studenta.",
    a: "Lewostronny rozkład t.",
    p: [
      {
        name: "x",
        detail: "Wartość liczbowa, według której należy oszacować rozkład.",
      },
      {
        name: "stopnie_swobody",
        detail: "Liczba całkowita wskazująca liczbę stopni swobody.",
      },
      {
        name: "kumulatywne",
        detail:
          "TRUE zwraca funkcję rozkładu skumulowanego, FALSE funkcję gęstości prawdopodobieństwa.",
      },
    ],
  },
  {
    n: "T.DIST.2T",
    d: "Zwraca dwustronny rozkład t-Studenta.",
    a: "Dwustronny rozkład t.",
    p: [
      {
        name: "x",
        detail: "Wartość liczbowa, według której należy oszacować rozkład.",
      },
      {
        name: "stopnie_swobody",
        detail: "Liczba całkowita wskazująca liczbę stopni swobody.",
      },
    ],
  },
  {
    n: "T.DIST.RT",
    d: "Zwraca prawostronny rozkład t-Studenta.",
    a: "Prawostronny rozkład t.",
    p: [
      {
        name: "x",
        detail: "Wartość liczbowa, według której należy oszacować rozkład.",
      },
      {
        name: "stopnie_swobody",
        detail: "Liczba całkowita wskazująca liczbę stopni swobody.",
      },
    ],
  },
  {
    n: "T.INV",
    d: "Zwraca lewostronną odwrotność rozkładu t-Studenta.",
    a: "Odwrotny lewostronny rozkład t.",
    p: [
      {
        name: "prawdopodobieństwo",
        detail: "Prawdopodobieństwo związane z rozkładem t-Studenta.",
      },
      {
        name: "stopnie_swobody",
        detail: "Liczba stopni swobody.",
      },
    ],
  },
  {
    n: "T.INV.2T",
    d: "Zwraca dwustronną odwrotność rozkładu t-Studenta.",
    a: "Odwrotny dwustronny rozkład t.",
    p: [
      {
        name: "prawdopodobieństwo",
        detail: "Prawdopodobieństwo związane z rozkładem t-Studenta.",
      },
      {
        name: "stopnie_swobody",
        detail: "Liczba stopni swobody.",
      },
    ],
  },
  {
    n: "T.TEST",
    d: "Zwraca prawdopodobieństwo powiązane z testem t-Studenta.",
    a: "Prawdopodobieństwo z testu t.",
    p: [
      {
        name: "tablica1",
        detail: "Pierwszy zestaw danych.",
      },
      {
        name: "tablica2",
        detail: "Drugi zestaw danych.",
      },
      {
        name: "liczba_ogonów",
        detail: "Liczba ogonów dystrybucyjnych: 1 jednostronny, 2 dwustronne.",
      },
      {
        name: "typ",
        detail:
          "Rodzaj testu: 1 dla par, 2 dla dwóch prób o równej wariancji, 3 dla dwóch prób o nierównej wariancji.",
      },
    ],
  },
  {
    n: "TAKE",
    d: "Zwraca określoną liczbę sąsiadujących wierszy lub kolumn od początku lub końca tablicy.",
    a: "Pierwszy lub ostatni wiersz/kolumna tablicy.",
    p: [
      {
        name: "tablica",
        detail: "Tablica, z której mają zostać pobrane wiersze lub kolumny.",
      },
      {
        name: "wiersze",
        detail:
          "Liczba wierszy do wykonania; wartość ujemna pobierana jest od końca.",
      },
      {
        name: "kolumny",
        detail:
          "Liczba kolumn do wykorzystania; wartość ujemna pobierana jest od końca.",
      },
    ],
  },
  {
    n: "TAN",
    d: "Zwraca tangens kąta podanego w radianach.",
    a: "Tangens kąta w radianach.",
    p: [
      {
        name: "numer",
        detail: "Kąt w radianach.",
      },
    ],
  },
  {
    n: "TANH",
    d: "Zwraca tangens hiperboliczny liczby.",
    a: "Tangens hiperboliczny.",
    p: [
      {
        name: "numer",
        detail: "Dowolna liczba rzeczywista.",
      },
    ],
  },
  {
    n: "TBILLEQ",
    d: "Zwraca rentowność bonu skarbowego równoważną obligacji.",
    a: "Rentowność bonu skarbowego równoważna obligacji.",
    p: [
      {
        name: "data_rozrachunku",
        detail: "Data rozliczenia bonu skarbowego.",
      },
      {
        name: "termin_zapadalności",
        detail: "Termin zapadalności bonu skarbowego.",
      },
      {
        name: "stopa_dyskontowa",
        detail: "Stopa dyskontowa bonów skarbowych.",
      },
    ],
  },
  {
    n: "TBILLPRICE",
    d: "Zwraca cenę za 100 USD wartości nominalnej bonu skarbowego.",
    a: "Cena bonu skarbowego.",
    p: [
      {
        name: "data_rozrachunku",
        detail: "Data rozliczenia bonu skarbowego.",
      },
      {
        name: "termin_zapadalności",
        detail: "Termin zapadalności bonu skarbowego.",
      },
      {
        name: "stopa_dyskontowa",
        detail: "Stopa dyskontowa bonów skarbowych.",
      },
    ],
  },
  {
    n: "TBILLYIELD",
    d: "Zwraca rentowność bonu skarbowego.",
    a: "Rentowność bonu skarbowego.",
    p: [
      {
        name: "data_rozrachunku",
        detail: "Data rozliczenia bonu skarbowego.",
      },
      {
        name: "termin_zapadalności",
        detail: "Termin zapadalności bonu skarbowego.",
      },
      {
        name: "cena",
        detail: "Cena bonu skarbowego za wartość nominalną 100 dolarów.",
      },
    ],
  },
  {
    n: "TDIST",
    d: "Zwraca liczbę punktów procentowych (prawdopodobieństwo) rozkładu t-Studenta. Zachowane ze względu na kompatybilność; zobacz T.DIST.RT i T.DIST.2T.",
    a: "Rozkład t-Studenta (starsza wersja).",
    p: [
      {
        name: "x",
        detail: "Wartość liczbowa, według której należy oszacować rozkład.",
      },
      {
        name: "stopnie_swobody",
        detail: "Liczba całkowita wskazująca liczbę stopni swobody.",
      },
      {
        name: "liczba_ogonów",
        detail: "Liczba ogonów dystrybucji do zwrócenia: 1 lub 2.",
      },
    ],
  },
  {
    n: "TEXT",
    d: "Konwertuje wartość liczbową na tekst i pozwala określić formatowanie wyświetlania przy użyciu specjalnych ciągów formatujących.",
    a: "Formatuje liczbę jako tekst.",
    p: [
      {
        name: ".",
        detail: "Wartość liczbowa, którą chcesz zamienić na tekst.",
      },
      {
        name: "tekst_formatu",
        detail:
          "Ciąg tekstowy definiujący formatowanie, które chcesz zastosować do `.`.",
      },
    ],
  },
  {
    n: "TEXTAFTER",
    d: "Zwraca tekst występujący po podanym znaku lub ciągu znaków.",
    a: "Tekst po ograniczniku.",
    p: [
      {
        name: "tekst",
        detail: "Tekst, w którym szukasz. Znaki wieloznaczne są niedozwolone.",
      },
      {
        name: "ogranicznik",
        detail: "Tekst oznaczający punkt, za którym chcesz wyodrębnić.",
      },
      {
        name: "nr_instancji",
        detail:
          "Instancja ogranicznika, po której chcesz wyodrębnić tekst; liczba ujemna jest przeszukiwana od końca. Domyślnie 1.",
      },
      {
        name: "tryb_dopasowania",
        detail:
          "0 (domyślnie) rozróżnia wielkość liter w ograniczniku, a 1 nie uwzględnia wielkości liter.",
      },
      {
        name: "dopasowanie_końca",
        detail:
          "1 traktuje koniec tekstu jako ogranicznik; domyślnie wynosi 0 (dokładne dopasowanie).",
      },
      {
        name: "jeśli_nie_znaleziono",
        detail:
          "Wartość zwracana w przypadku braku dopasowania; domyślnie #N/A.",
      },
    ],
  },
  {
    n: "TEXTBEFORE",
    d: "Zwraca tekst występujący przed danym znakiem lub ciągiem znaków.",
    a: "Tekst przed ogranicznikiem.",
    p: [
      {
        name: "tekst",
        detail: "Tekst, w którym szukasz. Znaki wieloznaczne są niedozwolone.",
      },
      {
        name: "ogranicznik",
        detail: "Tekst oznaczający punkt, przed którym chcesz wyodrębnić.",
      },
      {
        name: "nr_instancji",
        detail:
          "Instancja ogranicznika, przed którym chcesz wyodrębnić tekst; liczba ujemna jest przeszukiwana od końca. Domyślnie 1.",
      },
      {
        name: "tryb_dopasowania",
        detail:
          "0 (domyślnie) rozróżnia wielkość liter w ograniczniku, a 1 nie uwzględnia wielkości liter.",
      },
      {
        name: "dopasowanie_końca",
        detail:
          "1 traktuje koniec tekstu jako ogranicznik; domyślnie wynosi 0 (dokładne dopasowanie).",
      },
      {
        name: "jeśli_nie_znaleziono",
        detail:
          "Wartość zwracana w przypadku braku dopasowania; domyślnie #N/A.",
      },
    ],
  },
  {
    n: "TEXTJOIN",
    d: "Łączy tekst z wielu zakresów i/lub ciągów znaków i zawiera określony przez Ciebie ogranicznik pomiędzy każdą wartością tekstową.",
    a: "Łączy tekst za pomocą ogranicznika.",
    p: [
      {
        name: "ogranicznik",
        detail:
          "Ciąg tekstowy, pusty lub zawierający jeden lub więcej znaków, wstawiany pomiędzy każdą wartość tekstową.",
      },
      {
        name: "Ignoruj_puste",
        detail: "Jeśli TRUE, ignoruje puste komórki.",
      },
      {
        name: "tekst1",
        detail: "Pierwszy element tekstowy lub zakres do połączenia.",
      },
      {
        name: "tekst2",
        detail:
          "Dodatkowe elementy tekstowe lub zakresy do połączenia, łącznie do 252.",
      },
    ],
  },
  {
    n: "TEXTSPLIT",
    d: "Dzieli ciągi tekstowe za pomocą ograniczników kolumn i wierszy.",
    a: "Dzieli tekst na tablicę.",
    p: [
      {
        name: "tekst",
        detail: "Tekst, który chcesz podzielić.",
      },
      {
        name: "ogranicznik_kol",
        detail:
          "Tekst oznaczający punkt, w którym tekst ma zostać rozłożony na kolumny.",
      },
      {
        name: "ogranicznik_wiersza",
        detail:
          "Tekst oznaczający punkt, w którym należy rozdzielić tekst w wierszach.",
      },
      {
        name: "Ignoruj_puste",
        detail:
          "TRUE ignoruje kolejne ograniczniki; FALSE lub pominięty tworzy pustą komórkę.",
      },
      {
        name: "tryb_dopasowania",
        detail:
          "0 (domyślnie) wykonuje dopasowanie z uwzględnieniem wielkości liter, 1 dopasowanie bez uwzględniania wielkości liter.",
      },
      {
        name: "uzupełnij_wartością",
        detail: "Wartość, którą należy wypełnić wynik; domyślnie #N/A.",
      },
    ],
  },
  {
    n: "TIME",
    d: "Zwraca liczbę dziesiętną dla określonego czasu, od 0 (12:00:00) do 0,99988426 (23:59:59).",
    a: "Czas z godziny, minuty i sekundy.",
    p: [
      {
        name: "godz",
        detail:
          "Liczba od 0 do 32767 reprezentująca godzinę; wartości powyżej 23 dzieli się przez 24.",
      },
      {
        name: "minuta",
        detail:
          "Liczba od 0 do 32767 reprezentująca minuty; wartości powyżej 59 przechodzą na godziny.",
      },
      {
        name: "sekunda",
        detail:
          "Liczba od 0 do 32767 reprezentująca sekundę; wartości powyżej 59 przechodzą na minuty.",
      },
    ],
  },
  {
    n: "TIMEVALUE",
    d: "Zwraca liczbę dziesiętną czasu reprezentowanego przez ciąg tekstowy.",
    a: "Konwertuje tekst czasu na liczbę.",
    p: [
      {
        name: "czas_jako_tekst",
        detail:
          "Ciąg tekstowy reprezentujący godzinę w uznanym formacie czasu.",
      },
    ],
  },
  {
    n: "TINV",
    d: "Zwraca dwustronną odwrotność rozkładu t-Studenta. Zachowane ze względu na kompatybilność; zobacz T.INV.2T.",
    a: "Odwrotny dwustronny rozkład t (starszy model).",
    p: [
      {
        name: "prawdopodobieństwo",
        detail:
          "Prawdopodobieństwo związane z dwustronnym rozkładem t-Studenta.",
      },
      {
        name: "stopnie_swobody",
        detail: "Liczba stopni swobody.",
      },
    ],
  },
  {
    n: "TOCOL",
    d: "Zwraca tablicę w pojedynczej kolumnie.",
    a: "Spłaszcza tablicę do jednej kolumny.",
    p: [
      {
        name: "tablica",
        detail: "Tablica lub odwołanie do zwrócenia jako kolumna.",
      },
      {
        name: "ignoruj",
        detail:
          "Czy ignorować określone wartości: 0 zachować wszystkie (domyślnie), 1 ignorować spacje, 2 ignorować błędy, 3 ignorować spacje i błędy.",
      },
      {
        name: "skanowanie_według_kolumny",
        detail:
          "FALSE lub pominięty skanuje tablicę po wierszu; TRUE skanuje według kolumn.",
      },
    ],
  },
  {
    n: "TODAY",
    d: "Zwraca numer seryjny bieżącej daty. Jest aktualizowany przy każdym obliczeniu arkusza.",
    a: "Aktualna data.",
    p: [],
  },
  {
    n: "TOROW",
    d: "Zwraca tablicę w jednym wierszu.",
    a: "Spłaszcza tablicę do jednego wiersza.",
    p: [
      {
        name: "tablica",
        detail: "Tablica lub odwołanie do zwrócenia jako wiersz.",
      },
      {
        name: "ignoruj",
        detail:
          "Czy ignorować określone wartości: 0 zachować wszystkie (domyślnie), 1 ignorować spacje, 2 ignorować błędy, 3 ignorować spacje i błędy.",
      },
      {
        name: "skanowanie_według_kolumny",
        detail:
          "FALSE lub pominięty skanuje tablicę po wierszu; TRUE skanuje według kolumn.",
      },
    ],
  },
  {
    n: "TRANSPOSE",
    d: "Zwraca pionowy zakres komórek jako zakres poziomy i odwrotnie.",
    a: "Zamiana wierszy i kolumn.",
    p: [
      {
        name: "tablica",
        detail:
          "Tablica lub zakres komórek w arkuszu, który chcesz transponować.",
      },
    ],
  },
  {
    n: "TREND",
    d: "Zwraca wartości wzdłuż trendu liniowego, dopasowując linię prostą do known_y i known_x przy użyciu metody najmniejszych kwadratów.",
    a: "Wartości w trendzie liniowym.",
    p: [
      {
        name: "znane_y",
        detail: "Znany już zbiór wartości y w zależności y = mx + b.",
      },
      {
        name: "znane_x",
        detail: "Opcjonalny zestaw wartości x, który być może już znasz.",
      },
      {
        name: "nowe_x",
        detail:
          "Nowe wartości x, dla których chcesz, aby TREND zwracało odpowiednie wartości y.",
      },
      {
        name: "stała",
        detail:
          "TRUE lub pominięty oblicza b normalnie; FALSE wymusza b równe 0.",
      },
    ],
  },
  {
    n: "TRIM",
    d: "Usuwa wszystkie spacje z tekstu z wyjątkiem pojedynczych spacji pomiędzy wyrazami.",
    a: "Usuwa dodatkowe spacje.",
    p: [
      {
        name: "tekst",
        detail: "Tekst, z którego chcesz usunąć spacje.",
      },
    ],
  },
  {
    n: "TRIMMEAN",
    d: "Zwraca średnią wnętrza zbioru danych, z wyłączeniem procentu punktów danych z górnego i dolnego ogona.",
    a: "Średnia z wyłączeniem wartości odstających.",
    p: [
      {
        name: "tablica",
        detail: "Tablica lub zakres wartości do przycięcia i średniej.",
      },
      {
        name: "procent",
        detail: "Ułamkowa liczba punktów danych do wykluczenia z obliczeń.",
      },
    ],
  },
  {
    n: "TRIMRANGE",
    d: "Wyklucza wszystkie puste wiersze i/lub kolumny z zewnętrznych krawędzi zakresu lub tablicy.",
    a: "Przycina puste krawędzie z zakresu.",
    p: [
      {
        name: "zakres",
        detail: "Zakres lub tablica, która ma zostać przycięta.",
      },
      {
        name: "przycięcie_wierszy",
        detail:
          "Które wiersze przyciąć: 0 brak, 1 początkowe puste wiersze, 2 końcowe puste wiersze, 3 oba (domyślnie).",
      },
      {
        name: "przycięcie_kolumn",
        detail:
          "Które kolumny przyciąć: 0 brak, 1 początkowe puste kolumny, 2 końcowe puste kolumny, 3 obie (domyślnie).",
      },
    ],
  },
  {
    n: "TRUE",
    d: "Zwraca wartość logiczną TRUE.",
    a: "Wartość logiczna TRUE.",
    p: [],
  },
  {
    n: "TRUNC",
    d: "Obcina liczbę do liczby całkowitej (lub do określonej precyzji) poprzez usunięcie części ułamkowej.",
    a: "Obcina liczbę.",
    p: [
      {
        name: "numer",
        detail: "Liczba, którą chcesz obciąć.",
      },
      {
        name: "liczba_cyfr",
        detail: "Dokładność obcięcia; domyślnie wynosi 0.",
      },
    ],
  },
  {
    n: "TTEST",
    d: "Zwraca prawdopodobieństwo powiązane z testem t-Studenta. Zachowane ze względu na kompatybilność; zobacz T.TEST.",
    a: "Prawdopodobieństwo z testu t (starsza wersja).",
    p: [
      {
        name: "tablica1",
        detail: "Pierwszy zestaw danych.",
      },
      {
        name: "tablica2",
        detail: "Drugi zestaw danych.",
      },
      {
        name: "liczba_ogonów",
        detail: "Liczba ogonów dystrybucyjnych: 1 jednostronny, 2 dwustronne.",
      },
      {
        name: "typ",
        detail:
          "Rodzaj testu: 1 dla par, 2 dla dwóch prób o równej wariancji, 3 dla dwóch prób o nierównej wariancji.",
      },
    ],
  },
  {
    n: "TYPE",
    d: "Zwraca typ wartości: 1 liczba, 2 tekst, 4 wartość logiczna, 16 wartość błędu, 64 tablica.",
    a: "Typ wartości.",
    p: [
      {
        name: ".",
        detail: "Dowolna wartość, np. liczba, tekst lub wartość logiczna.",
      },
    ],
  },
  {
    n: "UNICHAR",
    d: "Zwraca znak Unicode, do którego odwołuje się podana wartość liczbowa.",
    a: "Znak Unicode z punktu kodowego.",
    p: [
      {
        name: "numer",
        detail: "Numer Unicode reprezentujący znak.",
      },
    ],
  },
  {
    n: "UNICODE",
    d: "Zwraca liczbę (punkt kodowy) odpowiadającą pierwszemu znakowi tekstu.",
    a: "Punkt kodowy pierwszego znaku.",
    p: [
      {
        name: "tekst",
        detail: "Znak, dla którego chcesz mieć wartość Unicode.",
      },
    ],
  },
  {
    n: "UNIQUE",
    d: "Zwraca listę unikalnych wartości na liście lub zakresie.",
    a: "Unikalne wartości zakresu.",
    p: [
      {
        name: "tablica",
        detail:
          "Zakres lub tablica, z której mają zostać zwrócone unikalne wiersze lub kolumny.",
      },
      {
        name: "według_kolumn",
        detail:
          "FALSE lub pominięty porównuje wiersze względem siebie; TRUE porównuje kolumny.",
      },
      {
        name: "dokładnie_raz",
        detail:
          "TRUE zwraca tylko te wiersze lub kolumny, które występują dokładnie raz; FALSE lub pominięty zwraca wszystkie odrębne.",
      },
    ],
  },
  {
    n: "UPPER",
    d: "Konwertuje tekst na wielkie litery.",
    a: "Konwertuje tekst na wielkie litery.",
    p: [
      {
        name: "tekst",
        detail: "Tekst, który chcesz zamienić na wielkie litery.",
      },
    ],
  },
  {
    n: "VALUE",
    d: "Konwertuje ciąg tekstowy reprezentujący liczbę na liczbę.",
    a: "Konwertuje tekst na liczbę.",
    p: [
      {
        name: "tekst",
        detail:
          "Tekst ujęty w cudzysłów lub odwołanie do komórki zawierającej tekst, który chcesz przekonwertować.",
      },
    ],
  },
  {
    n: "VALUETOTEXT",
    d: "Zwraca tekst z dowolnej określonej wartości. Przekazuje wartości tekstowe bez zmian i konwertuje wartości nietekstowe na tekst.",
    a: "Konwertuje wartość na tekst.",
    p: [
      {
        name: ".",
        detail: "Wartość zwracana jako tekst.",
      },
      {
        name: "formacie",
        detail:
          "0 lub pominięte zwraca zwięzły, łatwy do odczytania format; 1 zwraca ścisły format ze znakami ucieczki, które można przeanalizować jako formułę.",
      },
    ],
  },
  {
    n: "VAR.P",
    d: "Oblicza wariancję na podstawie całej populacji, ignorując wartości logiczne i tekst.",
    a: "Wariancja populacji.",
    p: [
      {
        name: "numer_1",
        detail: "Pierwsza liczba lub zakres odpowiadający populacji.",
      },
      {
        name: "numer2",
        detail: "Dodatkowe numery lub zakresy, łącznie do 254.",
      },
    ],
  },
  {
    n: "VAR.S",
    d: "Oszacowuje wariancję na podstawie próbki, ignorując wartości logiczne i tekst.",
    a: "Wariancja próbki.",
    p: [
      {
        name: "numer_1",
        detail: "Pierwsza liczba lub zakres odpowiadający próbce populacji.",
      },
      {
        name: "numer2",
        detail: "Dodatkowe numery lub zakresy, łącznie do 254.",
      },
    ],
  },
  {
    n: "VARA",
    d: "Oszacowuje wariancję na podstawie próbki, oceniając tekst jako 0, a wartości logiczne jako 1 lub 0.",
    a: "Wariancja próby z uwzględnieniem tekstu i wartości logicznych.",
    p: [
      {
        name: "wartość_1",
        detail: "Pierwsza wartość lub zakres odpowiadający próbce populacji.",
      },
      {
        name: "wartość2",
        detail: "Dodatkowe wartości lub zakresy, łącznie do 255.",
      },
    ],
  },
  {
    n: "VARP",
    d: "Oblicza wariancję na podstawie całej populacji. Zachowane ze względu na kompatybilność; zobacz VAR.P.",
    a: "Wariancja populacji (starsza wersja).",
    p: [
      {
        name: "numer_1",
        detail: "Pierwsza liczba lub zakres odpowiadający populacji.",
      },
      {
        name: "numer2",
        detail: "Dodatkowe numery lub zakresy, łącznie do 255.",
      },
    ],
  },
  {
    n: "VARPA",
    d: "Oblicza wariancję na podstawie całej populacji, oceniając tekst jako 0, a wartości logiczne jako 1 lub 0.",
    a: "Wariancja populacji, w tym tekst i logika.",
    p: [
      {
        name: "wartość_1",
        detail: "Pierwsza wartość lub zakres odpowiadający populacji.",
      },
      {
        name: "wartość2",
        detail: "Dodatkowe wartości lub zakresy, łącznie do 255.",
      },
    ],
  },
  {
    n: "VDB",
    d: "Zwraca amortyzację środka trwałego za dowolny okres, w tym okresy częściowe, przy użyciu metody salda podwójnie malejącego lub innej określonej przez użytkownika metody.",
    a: "Zmienna amortyzacja malejąca.",
    p: [
      {
        name: "koszt_początkowy",
        detail: "Początkowy koszt środka trwałego.",
      },
      {
        name: "wartość_końcowa",
        detail: "Wartość na koniec amortyzacji.\nWspółczynnik",
      },
      {
        name: "okres_użytkowania",
        detail:
          "Liczba okresów, przez które składnik aktywów jest amortyzowany.",
      },
      {
        name: "Okres_początkowy",
        detail: "Okres początkowy amortyzacji.",
      },
      {
        name: "okres_końcowy",
        detail: "Okres końcowy amortyzacji.",
      },
      {
        name: ".",
        detail: "Tempo spadku salda; domyślnie 2 (podwójnie malejące).",
      },
      {
        name: "bez_zmiany_metody",
        detail: "TRUE, aby nigdy nie przełączać się na amortyzację liniową.",
      },
    ],
  },
  {
    n: "VLOOKUP",
    d: "Wyszukuje wartość w skrajnej lewej kolumnie tabeli i zwraca wartość w tym samym wierszu z określonej kolumny.",
    a: "Wyszukiwanie pionowe.",
    p: [
      {
        name: "szukana_wartość",
        detail:
          "Wartość, którą chcesz sprawdzić; musi znajdować się w pierwszej kolumnie `tablica_tabel`.",
      },
      {
        name: "tablica_tabel",
        detail:
          "Zakres komórek, w których VLOOKUP będzie szukać `szukana_wartość` i zwróconej wartości.",
      },
      {
        name: "indeks_kolumny",
        detail:
          "Numer kolumny (zaczynający się od 1 dla skrajnej lewej kolumny `tablica_tabel`), który zawiera zwracaną wartość.",
      },
      {
        name: "dopasowanie_przybliżone",
        detail:
          "TRUE lub pominięty znajduje przybliżone dopasowanie; FALSE znajduje dokładne dopasowanie.",
      },
    ],
  },
  {
    n: "VSTACK",
    d: "Dołącza tablice pionowo i po kolei, aby zwrócić większą tablicę.",
    a: "Układa tablice jedna na drugiej.",
    p: [
      {
        name: "tablica1",
        detail: "Pierwsza tablica do dołączenia.",
      },
      {
        name: "tablica2",
        detail: "Dodatkowe tablice do dołączenia.",
      },
    ],
  },
  {
    n: "WEEKDAY",
    d: "Domyślnie zwraca dzień tygodnia odpowiadający dacie jako liczbę całkowitą od 1 (niedziela) do 7 (sobota).",
    a: "Dzień tygodnia.",
    p: [
      {
        name: "numer_seryjny",
        detail:
          "Numer kolejny reprezentujący datę dnia, który próbujesz znaleźć.",
      },
      {
        name: "typ_zwrotu",
        detail:
          "Liczba określająca numerację: 1 lub pominięta Niedziela=1, 2 Poniedziałek=1, 3 Poniedziałek=0, 11 do 17 tygodnia od poniedziałku do niedzieli.",
      },
    ],
  },
  {
    n: "WEEKNUM",
    d: "Zwraca numer tygodnia dla określonej daty.",
    a: "Numer tygodnia w roku.",
    p: [
      {
        name: "numer_seryjny",
        detail: "Data w tygodniu.",
      },
      {
        name: "typ_zwrotu",
        detail:
          "Dzień rozpoczęcia tygodnia: 1 lub pominięta niedziela, 2 poniedziałek, 11 do 17 od poniedziałku do niedzieli, 21 ISO 8601.",
      },
    ],
  },
  {
    n: "WEIBULL",
    d: "Zwraca rozkład Weibulla.",
    a: "Rozkład Weibulla (zgodność).",
    p: [
      {
        name: "x",
        detail: "Wartość, przy której funkcja ma zostać oszacowana.",
      },
      {
        name: "alfa",
        detail: "Parametr rozkładu.",
      },
      {
        name: "beta",
        detail: "Parametr rozkładu.",
      },
      {
        name: "kumulatywne",
        detail: "TRUE dla rozkładu skumulowanego, FALSE dla gęstości.",
      },
    ],
  },
  {
    n: "WEIBULL.DIST",
    d: "Zwraca rozkład Weibulla, powszechnie stosowany w analizie niezawodności.",
    a: "Rozkład Weibulla.",
    p: [
      {
        name: "x",
        detail: "Wartość, przy której funkcja ma zostać oszacowana.",
      },
      {
        name: "alfa",
        detail: "Parametr rozkładu.",
      },
      {
        name: "beta",
        detail: "Parametr rozkładu.",
      },
      {
        name: "kumulatywne",
        detail:
          "TRUE zwraca funkcję rozkładu skumulowanego, FALSE funkcję gęstości prawdopodobieństwa.",
      },
    ],
  },
  {
    n: "WORKDAY",
    d: "Zwraca liczbę kolejną daty poprzedzającej lub następującej po określonej liczbie dni roboczych, z wyłączeniem weekendów i świąt.",
    a: "Data oddalona o kilka dni roboczych.",
    p: [
      {
        name: "data_rozpoczęcia",
        detail: "Data reprezentująca datę początkową.",
      },
      {
        name: "dni",
        detail:
          "Liczba dni nieweekendowych i nieświątecznych przed lub po `data_rozpoczęcia`.",
      },
      {
        name: "święta",
        detail:
          "Opcjonalny zakres jednej lub większej liczby dat do wykluczenia z kalendarza roboczego.",
      },
    ],
  },
  {
    n: "WORKDAY.INTL",
    d: "Zwraca liczbę kolejną daty poprzedzającej lub następującej po określonej liczbie dni roboczych, z niestandardowymi parametrami weekendowymi.",
    a: "Data przesunięta o liczbę dni roboczych z niestandardowymi weekendami.",
    p: [
      {
        name: "data_rozpoczęcia",
        detail: "Data rozpoczęcia.",
      },
      {
        name: "dni",
        detail: "Liczba dni roboczych przed lub po `data_rozpoczęcia`.",
      },
      {
        name: "weekendu",
        detail:
          'Numer weekendowy (1 sobota-niedziela, 2 niedziela-poniedziałek, ..., 11 tylko niedziela, ..., 17 tylko sobota) lub ciąg siedmioznakowy, np. "0000011".',
      },
      {
        name: "święta",
        detail:
          "Opcjonalny zestaw jednej lub więcej dat do wykluczenia z kalendarza roboczego.",
      },
    ],
  },
  {
    n: "WRAPCOLS",
    d: "Zawija podany wiersz lub kolumnę wartości po kolumnach po określonej liczbie elementów, tworząc nową tablicę.",
    a: "Zawija wektor w kolumny.",
    p: [
      {
        name: "wektor",
        detail: "Wektor lub odniesienie do zawijania.",
      },
      {
        name: "liczba_przed_zawinięciem",
        detail: "Maksymalna liczba wartości w każdej kolumnie.",
      },
      {
        name: "uzupełnij_wartością",
        detail: "Wartość do uzupełnienia; domyślnie #N/A.",
      },
    ],
  },
  {
    n: "WRAPROWS",
    d: "Zawija podany wiersz lub kolumnę wartości wierszami po określonej liczbie elementów, tworząc nową tablicę.",
    a: "Zawija wektor w wiersze.",
    p: [
      {
        name: "wektor",
        detail: "Wektor lub odniesienie do zawijania.",
      },
      {
        name: "liczba_przed_zawinięciem",
        detail: "Maksymalna liczba wartości w każdym wierszu.",
      },
      {
        name: "uzupełnij_wartością",
        detail: "Wartość do uzupełnienia; domyślnie #N/A.",
      },
    ],
  },
  {
    n: "XIRR",
    d: "Zwraca wewnętrzną stopę zwrotu dla harmonogramu przepływów pieniężnych, który niekoniecznie jest okresowy.",
    a: "IRR nieregularnych przepływów pieniężnych.",
    p: [
      {
        name: "wartości",
        detail:
          "Szereg przepływów pieniężnych odpowiadający harmonogramowi płatności w `daty`.",
      },
      {
        name: "daty",
        detail:
          "Harmonogram dat płatności odpowiadający płatnościom z tytułu przepływu środków pieniężnych.",
      },
      {
        name: "przypuszczenie",
        detail:
          "Liczba, którą odgadniesz, jest bliska wyniku; domyślnie wynosi 0,1 (10 procent).",
      },
    ],
  },
  {
    n: "XLOOKUP",
    d: "Przeszukuje zakres lub tablicę i zwraca element odpowiadający pierwszemu znalezionemu dopasowaniu. Jeśli nie ma żadnego dopasowania, XLOOKUP może zwrócić najbliższe (przybliżone) dopasowanie.",
    a: "Wyszukuje wartość i zwraca dopasowanie.",
    p: [
      {
        name: "szukana_wartość",
        detail: "Wartość do wyszukania.",
      },
      {
        name: "tablica_wyszukiwania",
        detail: "Tablica lub zakres do przeszukania.",
      },
      {
        name: "tablica_zwrotna",
        detail: "Tablica lub zakres do zwrócenia.",
      },
      {
        name: "jeśli_nie_znaleziono",
        detail:
          "Wartość zwracana w przypadku braku prawidłowego dopasowania; domyślnie #N/A.",
      },
      {
        name: "tryb_dopasowania",
        detail:
          "0 dokładnych dopasowań (domyślnie), -1 dokładne dopasowanie lub następny mniejszy element, 1 dokładne dopasowanie lub następny większy element, 2 dopasowania wieloznaczne, 3 dopasowania wyrażeń regularnych.",
      },
      {
        name: "tryb_wyszukiwania",
        detail:
          "1 wyszukiwanie od pierwszego do ostatniego (domyślnie), -1 od ostatniego do pierwszego, 2 wyszukiwanie binarne rosnąco, -2 wyszukiwanie binarne malejąco.",
      },
    ],
  },
  {
    n: "XMATCH",
    d: "Wyszukuje określony element w tablicy lub zakresie komórek i zwraca względną pozycję elementu.",
    a: "Pozycja wartości w zakresie.",
    p: [
      {
        name: "szukana_wartość",
        detail: "Wartość do wyszukania.",
      },
      {
        name: "tablica_wyszukiwania",
        detail: "Tablica lub zakres do przeszukania.",
      },
      {
        name: "tryb_dopasowania",
        detail:
          "0 dokładnych dopasowań (domyślnie), -1 dokładne dopasowanie lub następny mniejszy element, 1 dokładne dopasowanie lub następny większy element, 2 dopasowania wieloznaczne, 3 dopasowania wyrażeń regularnych.",
      },
      {
        name: "tryb_wyszukiwania",
        detail:
          "1 wyszukiwanie od pierwszego do ostatniego (domyślnie), -1 od ostatniego do pierwszego, 2 wyszukiwanie binarne rosnąco, -2 wyszukiwanie binarne malejąco.",
      },
    ],
  },
  {
    n: "XNPV",
    d: "Zwraca wartość bieżącą netto dla harmonogramu przepływów pieniężnych, który niekoniecznie jest okresowy.",
    a: "NPV nieregularnych przepływów pieniężnych.",
    p: [
      {
        name: "stawka",
        detail: "Stopa dyskontowa stosowana do przepływów pieniężnych.",
      },
      {
        name: "wartości",
        detail:
          "Szereg przepływów pieniężnych odpowiadający harmonogramowi płatności w `daty`.",
      },
      {
        name: "daty",
        detail:
          "Harmonogram dat płatności odpowiadający płatnościom z tytułu przepływu środków pieniężnych.",
      },
    ],
  },
  {
    n: "XOR",
    d: "Zwraca logiczną wyłączność OR wszystkich argumentów: TRUE, gdy nieparzysta liczba argumentów wynosi TRUE.",
    a: "Ekskluzywne OR argumentów.",
    p: [
      {
        name: "logiczne1",
        detail:
          "Pierwszy warunek do przetestowania, który może mieć wartość TRUE lub FALSE.",
      },
      {
        name: "logiczne2",
        detail: "Dodatkowe warunki do przetestowania, łącznie do 254.",
      },
    ],
  },
  {
    n: "YEAR",
    d: "Zwraca rok odpowiadający dacie jako liczbę całkowitą z zakresu od 1900 do 9999.",
    a: "Rok daty.",
    p: [
      {
        name: "numer_seryjny",
        detail: "Data roku, którą chcesz znaleźć.",
      },
    ],
  },
  {
    n: "YEARFRAC",
    d: "Oblicza część roku reprezentowaną przez liczbę pełnych dni pomiędzy dwiema datami.",
    a: "Część roku pomiędzy datami.",
    p: [
      {
        name: "data_rozpoczęcia",
        detail: "Data reprezentująca datę początkową.",
      },
      {
        name: "data_zakończenia",
        detail: "Data reprezentująca datę końcową.",
      },
      {
        name: "podstawa",
        detail:
          "Podstawa liczenia dni: 0 lub pominięty US 30/360, 1 faktyczny/rzeczywisty, 2 rzeczywisty/360, 3 rzeczywisty/365, 4 europejski 30/360.",
      },
    ],
  },
  {
    n: "YIELD",
    d: "Zwraca rentowność papieru wartościowego oprocentowanego okresowo.",
    a: "Rentowność papieru wartościowego o oprocentowaniu okresowym.",
    p: [
      {
        name: "data_rozrachunku",
        detail: "Data rozliczenia papieru wartościowego.",
      },
      {
        name: "termin_zapadalności",
        detail: "Termin zapadalności papieru wartościowego.",
      },
      {
        name: "stawka",
        detail: "Roczna stopa kuponu papieru wartościowego.",
      },
      {
        name: "cena",
        detail: "Cena papieru wartościowego za wartość nominalną 100 dolarów.",
      },
      {
        name: "wartość_wykupu",
        detail:
          "Wartość wykupu papieru wartościowego według wartości nominalnej 100 dolarów.",
      },
      {
        name: "częstotliwość",
        detail:
          "Liczba wypłat kuponowych w ciągu roku: 1 roczna, 2 półroczne, 4 kwartalne.",
      },
      {
        name: "podstawa",
        detail:
          "Podstawa liczenia dni: 0 lub pominięty US 30/360, 1 faktyczny/rzeczywisty, 2 rzeczywisty/360, 3 rzeczywisty/365, 4 europejski 30/360.",
      },
    ],
  },
  {
    n: "YIELDDISC",
    d: "Zwraca roczną rentowność zdyskontowanego papieru wartościowego.",
    a: "Rentowność zdyskontowanego papieru wartościowego.",
    p: [
      {
        name: "data_rozrachunku",
        detail: "Data rozliczenia papieru wartościowego.",
      },
      {
        name: "termin_zapadalności",
        detail: "Termin zapadalności papieru wartościowego.",
      },
      {
        name: "cena",
        detail: "Cena papieru wartościowego za wartość nominalną 100 dolarów.",
      },
      {
        name: "wartość_wykupu",
        detail:
          "Wartość wykupu papieru wartościowego według wartości nominalnej 100 dolarów.",
      },
      {
        name: "podstawa",
        detail:
          "Podstawa liczenia dni: 0 lub pominięty US 30/360, 1 faktyczny/rzeczywisty, 2 rzeczywisty/360, 3 rzeczywisty/365, 4 europejski 30/360.",
      },
    ],
  },
  {
    n: "YIELDMAT",
    d: "Zwraca roczną rentowność papieru wartościowego oprocentowanego w terminie zapadalności.",
    a: "Rentowność papieru wartościowego płatnego w terminie zapadalności.",
    p: [
      {
        name: "data_rozrachunku",
        detail: "Data rozliczenia papieru wartościowego.",
      },
      {
        name: "termin_zapadalności",
        detail: "Termin zapadalności papieru wartościowego.",
      },
      {
        name: "data_emisji",
        detail: "Data emisji papieru wartościowego.",
      },
      {
        name: "stawka",
        detail: "Oprocentowanie papieru wartościowego w dniu emisji.",
      },
      {
        name: "cena",
        detail: "Cena papieru wartościowego za wartość nominalną 100 dolarów.",
      },
      {
        name: "podstawa",
        detail:
          "Podstawa liczenia dni: 0 lub pominięty US 30/360, 1 faktyczny/rzeczywisty, 2 rzeczywisty/360, 3 rzeczywisty/365, 4 europejski 30/360.",
      },
    ],
  },
  {
    n: "Z.TEST",
    d: "Zwraca jednostronną wartość P testu z.",
    a: "Jednostronna wartość P testu z.",
    p: [
      {
        name: "tablica",
        detail:
          "Tablica lub zakres danych, względem których ma zostać przetestowany `x`.",
      },
      {
        name: "x",
        detail: "Wartość do sprawdzenia.",
      },
      {
        name: "sigma",
        detail:
          "Odchylenie standardowe populacji (znane); jeśli pominięto, stosuje się odchylenie standardowe próbki.",
      },
    ],
  },
  {
    n: "ZTEST",
    d: "Zwraca jednostronną wartość P testu z. Zachowane ze względu na kompatybilność; zobacz Z.TEST.",
    a: "Wartość P jednostronnego testu z (starsza wersja).",
    p: [
      {
        name: "tablica",
        detail:
          "Tablica lub zakres danych, względem których ma zostać przetestowany `x`.",
      },
      {
        name: "x",
        detail: "Wartość do sprawdzenia.",
      },
      {
        name: "sigma",
        detail:
          "Odchylenie standardowe populacji (znane); jeśli pominięto, stosuje się odchylenie standardowe próbki.",
      },
    ],
  },
  {
    n: "MODE",
    d: "Zwraca najczęściej występującą wartość w zbiorze danych. Zachowane ze względu na kompatybilność; zobacz MODE.SNGL.",
    a: "Najpopularniejsza wartość (starsza wersja).",
    p: [
      {
        name: "numer_1",
        detail: "Pierwsza liczba lub zakres do oceny.",
      },
      {
        name: "numer2",
        detail: "Dodatkowe numery lub zakresy, łącznie do 254.",
      },
    ],
  },
  {
    n: "STDEV",
    d: "Oszacowuje odchylenie standardowe na podstawie próbki. Zachowane ze względu na kompatybilność; zobacz STDEV.S.",
    a: "Odchylenie standardowe próbki (starsze).",
    p: [
      {
        name: "numer_1",
        detail: "Pierwsza liczba lub zakres odpowiadający próbce populacji.",
      },
      {
        name: "numer2",
        detail: "Dodatkowe numery lub zakresy, łącznie do 254.",
      },
    ],
  },
  {
    n: "VAR",
    d: "Oszacowuje wariancję na podstawie próbki. Zachowane ze względu na kompatybilność; zobacz VAR.S.",
    a: "Wariancja próbki (starsza wersja).",
    p: [
      {
        name: "numer_1",
        detail: "Pierwsza liczba lub zakres odpowiadający próbce populacji.",
      },
      {
        name: "numer2",
        detail: "Dodatkowe numery lub zakresy, łącznie do 254.",
      },
    ],
  },
  {
    n: "RANK",
    d: "Zwraca rangę liczby na liście liczb. Zachowane ze względu na kompatybilność; zobacz RANK.EQ.",
    a: "Ranga liczby (starsza wersja).",
    p: [
      {
        name: "numer",
        detail: "Liczba, której rangę chcesz znaleźć.",
      },
      {
        name: "odwołanie",
        detail: "Lista numerów; wartości inne niż numeryczne są ignorowane.",
      },
      {
        name: "kolejność",
        detail:
          "0 lub pominięte rangi w kolejności malejącej; wszelkie inne wartości są szeregowane w kolejności rosnącej.",
      },
    ],
  },
  {
    n: "PERCENTILE",
    d: "Zwraca k-ty percentyl wartości w zakresie. Zachowane ze względu na kompatybilność; zobacz PERCENTILE.INC.",
    a: "k-ty percentyl (starsza wersja).",
    p: [
      {
        name: "tablica",
        detail: "Tablica lub zakres danych definiujący względną pozycję.",
      },
      {
        name: "k",
        detail: "Wartość percentyla w zakresie od 0 do 1 włącznie.",
      },
    ],
  },
  {
    n: "QUARTILE",
    d: "Zwraca kwartyl zbioru danych. Zachowane ze względu na kompatybilność; zobacz QUARTILE.INC.",
    a: "Kwartyl zbioru danych (starsza wersja).",
    p: [
      {
        name: "tablica",
        detail: "Tablica lub zakres wartości liczbowych.",
      },
      {
        name: "kwartyl",
        detail:
          "Która wartość ma zostać zwrócona: 0 minimum, 1 pierwszy kwartyl, 2 mediana, 3 trzeci kwartyl, 4 maksimum.",
      },
    ],
  },
];

export default translations;
