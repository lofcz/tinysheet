import type { FunctionListTranslation } from "./types";

const translations: FunctionListTranslation[] = [
  {
    n: "ABS",
    d: "Vrátí absolutní hodnotu čísla, tj. číslo bez znaménka.",
    a: "Absolutní hodnota čísla.",
    p: [
      {
        name: "číslo",
        detail: "Reálné číslo, jehož absolutní hodnotu chcete.",
      },
    ],
  },
  {
    n: "ACCRINT",
    d: "Vrátí naběhlý úrok pro cenný papír, který platí periodický úrok.",
    a: "Naběhlý úrok z cenného papíru s periodickým úrokem.",
    p: [
      {
        name: "datum_emise",
        detail: "Datum vydání cenného papíru.",
      },
      {
        name: "první_úrok",
        detail: "Datum prvního úroku cenného papíru.",
      },
      {
        name: "datum_vypořádání",
        detail:
          "Datum vypořádání cenného papíru po datu emise, kdy je cenný papír obchodován s kupujícím.",
      },
      {
        name: "sazba",
        detail: "Roční kupónová sazba cenného papíru.",
      },
      {
        name: "jmenovitá_hodnota",
        detail:
          "Nominální hodnota cenného papíru; výchozí hodnota je 1 000 USD.",
      },
      {
        name: "frekvence",
        detail:
          "Počet výplat kuponů za rok: 1 roční, 2 pololetní, 4 čtvrtletní.",
      },
      {
        name: "základna",
        detail:
          "Základ počtu dnů: 0 nebo vynecháno US 30/360, 1 skutečný/skutečný, 2 aktuální/360, 3 aktuální/365, 4 evropské 30/360.",
      },
      {
        name: "metoda_výpočtu",
        detail:
          "TRUE nebo vynecháno vrátí celkový naběhlý úrok od emise po vypořádání; FALSE od první_úrok do vypořádání.",
      },
    ],
  },
  {
    n: "ACCRINTM",
    d: "Vrátí naběhlý úrok pro cenný papír, který platí úrok při splatnosti.",
    a: "Naběhlý úrok cenného papíru vypláceného při splatnosti.",
    p: [
      {
        name: "datum_emise",
        detail: "Datum vydání cenného papíru.",
      },
      {
        name: "datum_vypořádání",
        detail: "Datum splatnosti cenného papíru.",
      },
      {
        name: "sazba",
        detail: "Roční kupónová sazba cenného papíru.",
      },
      {
        name: "jmenovitá_hodnota",
        detail:
          "Nominální hodnota cenného papíru; výchozí hodnota je 1 000 USD.",
      },
      {
        name: "základna",
        detail:
          "Základ počtu dnů: 0 nebo vynecháno US 30/360, 1 skutečný/skutečný, 2 aktuální/360, 3 aktuální/365, 4 evropské 30/360.",
      },
    ],
  },
  {
    n: "ACOS",
    d: "Vrátí arkkosinus (inverzní kosinus) čísla v radiánech v rozsahu 0 až pí.",
    a: "Inverzní kosinus, v radiánech.",
    p: [
      {
        name: "číslo",
        detail: "Kosinus požadovaného úhlu; musí být mezi -1 a 1.",
      },
    ],
  },
  {
    n: "ACOSH",
    d: "Vrátí inverzní hyperbolický kosinus čísla.",
    a: "Inverzní hyperbolický kosinus.",
    p: [
      {
        name: "číslo",
        detail: "Jakékoli reálné číslo větší nebo rovné 1.",
      },
    ],
  },
  {
    n: "ACOT",
    d: "Vrátí hlavní hodnotu arckotangens (inverzní kotangens) čísla v radiánech v rozsahu 0 až pí.",
    a: "Inverzní kotangens, v radiánech.",
    p: [
      {
        name: "číslo",
        detail: "Kotangens požadovaného úhlu.",
      },
    ],
  },
  {
    n: "ACOTH",
    d: "Vrátí inverzní hyperbolický kotangens čísla.",
    a: "Inverzní hyperbolický kotangens.",
    p: [
      {
        name: "číslo",
        detail: "Číslo, jehož absolutní hodnota musí být větší než 1.",
      },
    ],
  },
  {
    n: "ADDRESS",
    d: "Vrátí adresu buňky v listu jako text se zadanými čísly řádků a sloupců.",
    a: "Adresa buňky jako text.",
    p: [
      {
        name: "číslo_řádku",
        detail: "Číslo řádku, které se má použít v odkazu na buňku.",
      },
      {
        name: "číslo_sloupce",
        detail: "Číslo sloupce, které se má použít v odkazu na buňku.",
      },
      {
        name: "typ_odkazu",
        detail:
          "Typ odkazu: 1 nebo vynechaný absolutní, 2 absolutní řádek, 3 absolutní sloupec, 4 relativní.",
      },
      {
        name: "a1",
        detail:
          "TRUE nebo vynechaný vrátí odkaz ve stylu A1; FALSE vrátí odkaz ve stylu R1C1.",
      },
      {
        name: "text_listu",
        detail: "Název listu, který se má použít jako externí reference.",
      },
    ],
  },
  {
    n: "AGGREGATE",
    d: "Vrátí souhrn (například SUM, AVERAGE, COUNT nebo LARGE) seznamu nebo databáze s možnostmi ignorovat skryté řádky a chybové hodnoty.",
    a: "Agregát, který může ignorovat skryté řádky a chyby.",
    p: [
      {
        name: "číslo_funkce",
        detail:
          "Číslo od 1 do 19 vybírající funkci: 1 AVERAGE, 2 COUNT, 3 COUNTA, 4 MAX, 5 MIN, 6 PRODUCT, 7 STDEV.S, 8 STDEV.P, 9 SUM, 10 VAR.S, 11 VAR.P, 12 MEDIAN, 13 MODE.SNGL, 14 LARGE, 15 SMALL, 16 PERCENTILE.INC, 17 QUARTILE.INC, 18 PERCENTILE.EXC, 19 QUARTILE.EXC.",
      },
      {
        name: "možnosti",
        detail:
          "Které hodnoty ignorovat: 0 nebo vynechané vnořené SUBTOTAL/AGGREGATE, 1 také skryté řádky, 2 také chybové hodnoty, 3 všechny tyto, 4 nic, pouze 5 skrytých řádků, 6 pouze chybových hodnot, 7 skrytých řádků a chybové hodnoty.",
      },
      {
        name: "odkaz_1",
        detail:
          "První číselný argument nebo rozsah. Pro funkce 14 až 19 je to pole k vyhodnocení.",
      },
      {
        name: "odkaz_2",
        detail:
          "Další rozsahy k agregaci nebo pro funkce 14 až 19 požadovaný druhý argument k (pozice nebo kvartil).",
      },
    ],
  },
  {
    n: "AMORDEGRC",
    d: "Vrátí odpisy pro každé účetní období pomocí odpisového koeficientu (francouzský účetní systém).",
    a: "Degresivní odpisy za účetní období.",
    p: [
      {
        name: "pořizovací_cena",
        detail: "Pořizovací cena aktiva.",
      },
      {
        name: "datum_zakoupení",
        detail: "Datum nákupu aktiva.",
      },
      {
        name: "první_období",
        detail: "Datum konce prvního období.",
      },
      {
        name: "zůstatková_hodnota",
        detail: "Zbytková hodnota na konci životnosti aktiva.",
      },
      {
        name: "období",
        detail: "Období.",
      },
      {
        name: "sazba",
        detail: "Odpisová sazba.",
      },
      {
        name: "základna",
        detail:
          "Roční základ: 0 360 dní, 1 skutečný, 3 365 dní, 4 evropské 360.",
      },
    ],
  },
  {
    n: "AMORLINC",
    d: "Vrátí odpisy pro každé účetní období (francouzský účetní systém, lineární).",
    a: "Lineární odpisy za účetní období.",
    p: [
      {
        name: "pořizovací_cena",
        detail: "Pořizovací cena aktiva.",
      },
      {
        name: "datum_zakoupení",
        detail: "Datum nákupu aktiva.",
      },
      {
        name: "první_období",
        detail: "Datum konce prvního období.",
      },
      {
        name: "zůstatková_hodnota",
        detail: "Zbytková hodnota na konci životnosti aktiva.",
      },
      {
        name: "období",
        detail: "Období.",
      },
      {
        name: "sazba",
        detail: "Odpisová sazba.",
      },
      {
        name: "základna",
        detail:
          "Roční základ: 0 360 dní, 1 skutečný, 3 365 dní, 4 evropské 360.",
      },
    ],
  },
  {
    n: "AND",
    d: "Vrátí TRUE, pokud jsou všechny jeho argumenty vyhodnoceny jako TRUE, a FALSE, pokud je jeden nebo více argumentů vyhodnoceno jako FALSE.",
    a: "TRUE, pokud jsou všechny argumenty TRUE.",
    p: [
      {
        name: "logický1",
        detail:
          "První podmínka k testování, která může být vyhodnocena jako TRUE nebo FALSE.",
      },
      {
        name: "logický2",
        detail: "Další podmínky k testování, celkem až 255.",
      },
    ],
  },
  {
    n: "ARABIC",
    d: "Převede římské číslo na arabské číslo.",
    a: "Převede římské číslo na číslo.",
    p: [
      {
        name: "text",
        detail:
          "Řetězec v uvozovkách, prázdný řetězec nebo odkaz na buňku obsahující text.",
      },
    ],
  },
  {
    n: "AREAS",
    d: "Vrátí počet oblastí v odkazu.",
    a: "Počet oblastí v odkazu.",
    p: [
      {
        name: "odkaz",
        detail: "Odkaz na buňku nebo rozsah buněk.",
      },
    ],
  },
  {
    n: "ARRAYTOTEXT",
    d: "Vrátí pole textových hodnot z libovolného zadaného rozsahu.",
    a: "Převede pole na text.",
    p: [
      {
        name: "pole",
        detail: "Pole, které se má vrátit jako text.",
      },
      {
        name: "formát",
        detail:
          "0 nebo vynecháno vrátí stručný, snadno čitelný formát; 1 vrátí přísný formát se znaky escape a oddělovači řádků, které lze analyzovat jako vzorec.",
      },
    ],
  },
  {
    n: "ASC",
    d: "Změní znaky s plnou šířkou (dvoubajtové) na znaky s poloviční šířkou (jednobajtové).",
    a: "Převést na znaky poloviční šířky.",
    p: [
      {
        name: "text",
        detail:
          "Text nebo odkaz na buňku, která obsahuje text, který se má změnit.",
      },
    ],
  },
  {
    n: "ASIN",
    d: "Vrátí arkussinus (inverzní sinus) čísla v radiánech v rozsahu -pi/2 až pi/2.",
    a: "Inverzní sinus, v radiánech.",
    p: [
      {
        name: "číslo",
        detail: "Sinus požadovaného úhlu; musí být mezi -1 a 1.",
      },
    ],
  },
  {
    n: "ASINH",
    d: "Vrátí inverzní hyperbolický sinus čísla.",
    a: "Inverzní hyperbolický sinus.",
    p: [
      {
        name: "číslo",
        detail: "Jakékoli reálné číslo.",
      },
    ],
  },
  {
    n: "ATAN",
    d: "Vrátí arkustangens (inverzní tangens) čísla v radiánech v rozsahu -pi/2 až pi/2.",
    a: "Inverzní tangens, v radiánech.",
    p: [
      {
        name: "číslo",
        detail: "Tangent úhlu, který chcete.",
      },
    ],
  },
  {
    n: "ATAN2",
    d: "Vrátí arkustangens zadaných souřadnic x a y v radiánech mezi -pi a pi kromě -pi.",
    a: "Arktangens ze souřadnic x a y.",
    p: [
      {
        name: "číslo_x",
        detail: "X-ová souřadnice bodu.",
      },
      {
        name: "číslo_y",
        detail: "Y-ová souřadnice bodu.",
      },
    ],
  },
  {
    n: "ATANH",
    d: "Vrátí inverzní hyperbolický tangens čísla.",
    a: "Inverzní hyperbolický tangens.",
    p: [
      {
        name: "číslo",
        detail: "Libovolné reálné číslo mezi -1 a 1, s výjimkou.",
      },
    ],
  },
  {
    n: "AVEDEV",
    d: "Vrátí průměr absolutních odchylek datových bodů od jejich průměru.",
    a: "Průměrná absolutní odchylka od průměru.",
    p: [
      {
        name: "číslo1",
        detail: "První číslo nebo rozsah.",
      },
      {
        name: "číslo2",
        detail: "Další čísla nebo rozsahy, celkem až 255.",
      },
    ],
  },
  {
    n: "AVERAGE",
    d: "Vrátí průměr (aritmetický průměr) argumentů, ignoruje text a logické hodnoty v rozsazích.",
    a: "Aritmetický průměr čísel.",
    p: [
      {
        name: "číslo1",
        detail:
          "První číslo, odkaz na buňku nebo rozsah, pro který chcete průměr.",
      },
      {
        name: "číslo2",
        detail: "Další čísla nebo rozsahy, celkem až 255.",
      },
    ],
  },
  {
    n: "AVERAGEA",
    d: "Vrátí průměr svých argumentů, přičemž text vyhodnotí jako 0 a logické hodnoty jako 1 nebo 0.",
    a: "Průměr včetně textu a logických hodnot.",
    p: [
      {
        name: "hodnota1",
        detail: "První hodnota, odkaz na buňku nebo rozsah.",
      },
      {
        name: "hodnota2",
        detail: "Další hodnoty nebo rozsahy, celkem až 255.",
      },
    ],
  },
  {
    n: "AVERAGEIF",
    d: "Vrátí průměr (aritmetický průměr) všech buněk v rozsahu, které splňují dané kritérium.",
    a: "Průměr buněk, které splňují podmínku.",
    p: [
      {
        name: "oblast",
        detail: "Buňky k testování proti `kritéria`.",
      },
      {
        name: "kritéria",
        detail:
          "Podmínka, jako číslo, výraz, odkaz na buňku nebo text, která definuje, které buňky jsou zprůměrovány.",
      },
      {
        name: "průměrovaná_oblast",
        detail: "Buňky, které se mají zprůměrovat, pokud se liší od `oblast`.",
      },
    ],
  },
  {
    n: "AVERAGEIFS",
    d: "Vrátí průměr (aritmetický průměr) všech buněk, které splňují více kritérií.",
    a: "Průměr buněk, které splňují více kritérií.",
    p: [
      {
        name: "průměrovaná_oblast",
        detail: "Buňky k průměrování.",
      },
      {
        name: "rozsah_kritérií1",
        detail: "Rozsah, který je testován pomocí `kritéria1`.",
      },
      {
        name: "kritéria1",
        detail:
          "Kritéria, která definují, které buňky v `rozsah_kritérií1` jsou zahrnuty.",
      },
      {
        name: "rozsah_kritérií2",
        detail: "Další rozsahy k testování, až 127 párů rozsah/kritéria.",
      },
      {
        name: "kritéria2",
        detail: "Kritéria pro odpovídající doplňkový rozsah.",
      },
    ],
  },
  {
    n: "BAHTTEXT",
    d: 'Převede číslo na thajský text a přidá příponu "Baht".',
    a: "Číslo jako text thajských bahtů.",
    p: [
      {
        name: "číslo",
        detail: "Číslo, které se má převést na text.",
      },
    ],
  },
  {
    n: "BASE",
    d: "Převede číslo na textovou reprezentaci v daném radixu (základu).",
    a: "Převede číslo na text v jiném základu.",
    p: [
      {
        name: "číslo",
        detail:
          "Číslo, které se má převést; celé číslo větší nebo rovné 0 a menší než 2^53.",
      },
      {
        name: "základ_soustavy",
        detail: "Základ, na který se má převést; celé číslo od 2 do 36.",
      },
      {
        name: "délka_min",
        detail: "Minimální délka vráceného řetězce doplněného úvodními nulami.",
      },
    ],
  },
  {
    n: "BESSELI",
    d: "Vrátí upravenou Besselovu funkci In(x), která je ekvivalentní Besselově funkci vyhodnocené pro čistě imaginární argumenty.",
    a: "Upravená Besselova funkce In(x).",
    p: [
      {
        name: "x",
        detail: "Hodnota, při které se má funkce vyhodnotit.",
      },
      {
        name: "n",
        detail: "Pořadí Besselovy funkce; zkrácen na celé číslo.",
      },
    ],
  },
  {
    n: "BESSELJ",
    d: "Vrátí Besselovu funkci Jn(x).",
    a: "Besselova funkce Jn(x).",
    p: [
      {
        name: "x",
        detail: "Hodnota, při které se má funkce vyhodnotit.",
      },
      {
        name: "n",
        detail: "Pořadí Besselovy funkce; zkrácen na celé číslo.",
      },
    ],
  },
  {
    n: "BESSELK",
    d: "Vrátí upravenou Besselovu funkci Kn(x), která je ekvivalentní Besselovým funkcím vyhodnoceným pro čistě imaginární argumenty.",
    a: "Upravená Besselova funkce Kn(x).",
    p: [
      {
        name: "x",
        detail: "Hodnota, při které se má funkce vyhodnotit.",
      },
      {
        name: "n",
        detail: "Pořadí funkce; zkrácen na celé číslo.",
      },
    ],
  },
  {
    n: "BESSELY",
    d: "Vrátí Besselovu funkci Yn(x), nazývanou také Weberova funkce nebo Neumannova funkce.",
    a: "Besselova funkce Yn(x).",
    p: [
      {
        name: "x",
        detail: "Hodnota, při které se má funkce vyhodnotit.",
      },
      {
        name: "n",
        detail: "Pořadí funkce; zkrácen na celé číslo.",
      },
    ],
  },
  {
    n: "BETA.DIST",
    d: "Vrátí beta rozdělení, běžně používané ke studiu odchylek v procentech něčeho ve vzorcích.",
    a: "Beta distribuce.",
    p: [
      {
        name: "x",
        detail: "Hodnota mezi `A` a `B`, při které se má funkce vyhodnotit.",
      },
      {
        name: "alfa",
        detail: "Parametr rozdělení.",
      },
      {
        name: "beta",
        detail: "Parametr rozdělení.",
      },
      {
        name: "kumulativní",
        detail:
          "TRUE vrací funkci kumulativního rozdělení, FALSE funkci hustoty pravděpodobnosti.",
      },
      {
        name: "A",
        detail: "dolní mez intervalu x; výchozí je 0.",
      },
      {
        name: "B",
        detail: "Horní mez intervalu x; výchozí je 1.",
      },
    ],
  },
  {
    n: "BETA.INV",
    d: "Vrátí inverzní hodnotu funkce hustoty kumulativní pravděpodobnosti beta.",
    a: "Inverzní k distribuci beta.",
    p: [
      {
        name: "pravděpodobnost",
        detail: "Pravděpodobnost spojená s distribucí beta.",
      },
      {
        name: "alfa",
        detail: "Parametr rozdělení.",
      },
      {
        name: "beta",
        detail: "Parametr rozdělení.",
      },
      {
        name: "A",
        detail: "dolní mez intervalu x; výchozí je 0.",
      },
      {
        name: "B",
        detail: "Horní mez intervalu x; výchozí je 1.",
      },
    ],
  },
  {
    n: "BETADIST",
    d: "Vrátí kumulativní beta funkci hustoty pravděpodobnosti. Zachováno pro kompatibilitu; viz BETA.DIST.",
    a: "Kumulativní beta distribuce (starší).",
    p: [
      {
        name: "x",
        detail: "Hodnota mezi `A` a `B`, při které se má funkce vyhodnotit.",
      },
      {
        name: "alfa",
        detail: "Parametr rozdělení.",
      },
      {
        name: "beta",
        detail: "Parametr rozdělení.",
      },
      {
        name: "A",
        detail: "dolní mez intervalu x; výchozí je 0.",
      },
      {
        name: "B",
        detail: "Horní mez intervalu x; výchozí je 1.",
      },
    ],
  },
  {
    n: "BETAINV",
    d: "Vrátí inverzní hodnotu kumulativní funkce hustoty pravděpodobnosti beta. Zachováno pro kompatibilitu; viz BETA.INV.",
    a: "Inverzní beta distribuce (starší).",
    p: [
      {
        name: "pravděpodobnost",
        detail: "Pravděpodobnost spojená s distribucí beta.",
      },
      {
        name: "alfa",
        detail: "Parametr rozdělení.",
      },
      {
        name: "beta",
        detail: "Parametr rozdělení.",
      },
      {
        name: "A",
        detail: "dolní mez intervalu x; výchozí je 0.",
      },
      {
        name: "B",
        detail: "Horní mez intervalu x; výchozí je 1.",
      },
    ],
  },
  {
    n: "BIN2DEC",
    d: "Převede binární číslo na desítkové.",
    a: "Binární na desítkové.",
    p: [
      {
        name: "číslo",
        detail:
          "Binární číslo, které se má převést; maximálně 10 znaků (bitů). Nejvýznamnějším bitem je znaménkový bit.",
      },
    ],
  },
  {
    n: "BIN2HEX",
    d: "Převede binární číslo na šestnáctkové.",
    a: "Převod z dvojkové do šestnáctkové soustavy.",
    p: [
      {
        name: "číslo",
        detail:
          "Binární číslo, které se má převést; maximálně 10 znaků (bitů).",
      },
      {
        name: "počet_míst",
        detail:
          "Počet znaků, které se mají použít; výsledek je doplněn úvodními nulami.",
      },
    ],
  },
  {
    n: "BIN2OCT",
    d: "Převede binární číslo na osmičkové.",
    a: "Převod z dvojkové do osmičkové soustavy.",
    p: [
      {
        name: "číslo",
        detail:
          "Binární číslo, které se má převést; maximálně 10 znaků (bitů).",
      },
      {
        name: "počet_míst",
        detail:
          "Počet znaků, které se mají použít; výsledek je doplněn úvodními nulami.",
      },
    ],
  },
  {
    n: "BINOM.DIST",
    d: "Vrátí pravděpodobnost binomického rozdělení jednotlivých členů.",
    a: "Pravděpodobnost binomického rozdělení.",
    p: [
      {
        name: "počet_úspěchů",
        detail: "Počet úspěchů ve zkouškách.",
      },
      {
        name: "pokusy",
        detail: "Počet nezávislých pokusů.",
      },
      {
        name: "pravděpodobnost_úspěchu",
        detail: "Pravděpodobnost úspěchu každého pokusu.",
      },
      {
        name: "kumulativní",
        detail:
          "TRUE vrátí funkci kumulativního rozdělení, FALSE funkci hmotnosti pravděpodobnosti.",
      },
    ],
  },
  {
    n: "BINOM.DIST.RANGE",
    d: "Vrátí pravděpodobnost výsledku pokusu pomocí binomického rozdělení.",
    a: "Pravděpodobnost řady binomických výsledků.",
    p: [
      {
        name: "pokusy",
        detail: "Počet nezávislých pokusů.",
      },
      {
        name: "pravděpodobnost_úspěchu",
        detail: "Pravděpodobnost úspěchu v každém pokusu.",
      },
      {
        name: "počet_úspěchů",
        detail: "Počet úspěchů ve zkouškách.",
      },
      {
        name: "počet_úspěchů2",
        detail:
          "Pokud je zadán, vrací pravděpodobnost, že počet úspěchů spadá mezi `počet_úspěchů` a `počet_úspěchů2`.",
      },
    ],
  },
  {
    n: "BINOM.INV",
    d: "Vrátí nejmenší hodnotu, pro kterou je kumulativní binomické rozdělení větší nebo rovné hodnotě kritéria.",
    a: "Inverzní kumulativní binomické rozdělení.",
    p: [
      {
        name: "pokusy",
        detail: "Počet Bernoulliho pokusů.",
      },
      {
        name: "pravděpodobnost_úspěchu",
        detail: "Pravděpodobnost úspěchu každého pokusu.",
      },
      {
        name: "alfa",
        detail: "Hodnota kritéria.",
      },
    ],
  },
  {
    n: "BINOMDIST",
    d: "Vrátí pravděpodobnost binomického rozdělení jednotlivých členů. Zachováno pro kompatibilitu; viz BINOM.DIST.",
    a: "Binomické rozdělení (kompatibilita).",
    p: [
      {
        name: "počet_úspěchů",
        detail: "Počet úspěchů ve zkouškách.",
      },
      {
        name: "pokusy",
        detail: "Počet nezávislých pokusů.",
      },
      {
        name: "pravděpodobnost_úspěchu",
        detail: "Pravděpodobnost úspěchu každého pokusu.",
      },
      {
        name: "kumulativní",
        detail:
          "TRUE vrátí funkci kumulativního rozdělení, FALSE funkci hmotnosti pravděpodobnosti.",
      },
    ],
  },
  {
    n: "BITAND",
    d: "Vrátí bitově 'AND' dvou čísel.",
    a: "Bitově AND.",
    p: [
      {
        name: "číslo1",
        detail: "Desetinné číslo větší nebo rovné 0.",
      },
      {
        name: "číslo2",
        detail: "Desetinné číslo větší nebo rovné 0.",
      },
    ],
  },
  {
    n: "BITLSHIFT",
    d: "Vrací číslo posunuté doleva o zadaný počet bitů.",
    a: "Bitový posun doleva.",
    p: [
      {
        name: "číslo",
        detail: "Celé číslo větší nebo rovné 0.",
      },
      {
        name: "počet_bitů_posunu",
        detail: "Počet bitů k posunutí; záporná hodnota se posune doprava.",
      },
    ],
  },
  {
    n: "BITOR",
    d: "Vrátí bitově 'OR' dvou čísel.",
    a: "Bitově OR.",
    p: [
      {
        name: "číslo1",
        detail: "Desetinné číslo větší nebo rovné 0.",
      },
      {
        name: "číslo2",
        detail: "Desetinné číslo větší nebo rovné 0.",
      },
    ],
  },
  {
    n: "BITRSHIFT",
    d: "Vrátí číslo posunuté doprava o zadaný počet bitů.",
    a: "Bitový posun doprava.",
    p: [
      {
        name: "číslo",
        detail: "Celé číslo větší nebo rovné 0.",
      },
      {
        name: "počet_bitů_posunu",
        detail: "počet bitů k posunutí; záporná hodnota se posune doleva.",
      },
    ],
  },
  {
    n: "BITXOR",
    d: "Vrátí bitovou hodnotu 'XOR' (bez nebo) dvou čísel.",
    a: "Bitově XOR.",
    p: [
      {
        name: "číslo1",
        detail: "Číslo větší nebo rovné 0.",
      },
      {
        name: "číslo2",
        detail: "Číslo větší nebo rovné 0.",
      },
    ],
  },
  {
    n: "BYCOL",
    d: "Použije LAMBDA na každý sloupec a vrátí pole výsledků.",
    a: "Použije LAMBDA na každý sloupec.",
    p: [
      {
        name: "pole",
        detail: "Pole k oddělení podle sloupců.",
      },
      {
        name: "lambda",
        detail:
          "LAMBDA, který bere sloupec jako jeden parametr a počítá jeden výsledek.",
      },
    ],
  },
  {
    n: "BYROW",
    d: "Použije LAMBDA na každý řádek a vrátí pole výsledků.",
    a: "Použije LAMBDA na každý řádek.",
    p: [
      {
        name: "pole",
        detail: "Pole k oddělení řádkem.",
      },
      {
        name: "lambda",
        detail:
          "LAMBDA, který bere řádek jako jeden parametr a vypočítává jeden výsledek.",
      },
    ],
  },
  {
    n: "CEILING",
    d: "Zaokrouhlí číslo nahoru od nuly na nejbližší násobek významnosti.",
    a: "Zaokrouhlí nahoru na nejbližší násobek.",
    p: [
      {
        name: "číslo",
        detail: "Hodnota, kterou chcete zaokrouhlit.",
      },
      {
        name: "násobek",
        detail: "Násobek, na který chcete zaokrouhlit.",
      },
    ],
  },
  {
    n: "CEILING.MATH",
    d: "Zaokrouhlí číslo nahoru na nejbližší celé číslo nebo na nejbližší násobek významnosti s kontrolou nad směrem pro záporná čísla.",
    a: "Zaokrouhlí nahoru na nejbližší celé číslo nebo násobek.",
    p: [
      {
        name: "číslo",
        detail: "Hodnota, kterou chcete zaokrouhlit.",
      },
      {
        name: "násobek",
        detail: "Násobek, na který se má zaokrouhlit; výchozí je 1.\nrežim",
      },
      {
        name: "režim",
        detail:
          "Pro záporná čísla se nenulová hodnota zaokrouhluje od nuly; 0 nebo vynechané zaokrouhlování směrem k nule.",
      },
    ],
  },
  {
    n: "CEILING.PRECISE",
    d: "Zaokrouhlí číslo nahoru na nejbližší celé číslo nebo na nejbližší násobek významnosti, bez ohledu na znaménko čísla.",
    a: "Zaokrouhluje nahoru bez ohledu na znaménko.",
    p: [
      {
        name: "číslo",
        detail: "Hodnota, která se má zaokrouhlit.",
      },
      {
        name: "násobek",
        detail:
          "Násobek, na který je číslo zaokrouhleno; výchozí je 1. Jeho znaménko je ignorováno.",
      },
    ],
  },
  {
    n: "CELL",
    d: "Vrátí informace o formátování, umístění nebo obsahu buňky.",
    a: "Informace o buňce.",
    p: [
      {
        name: "typ_informace",
        detail:
          'Typ požadovaných informací, například "address", "col", "row", "contents", "type", "format", "width" nebo "filename".',
      },
      {
        name: "odkaz",
        detail:
          "Buňka, o které chcete informace; výchozí na poslední změněnou buňku.",
      },
    ],
  },
  {
    n: "CHAR",
    d: "Vrací znak určený číselným kódem.",
    a: "Znak z číselného kódu.",
    p: [
      {
        name: "číslo",
        detail: "Číslo mezi 1 a 255 určující, který znak chcete.",
      },
    ],
  },
  {
    n: "CHIDIST",
    d: "Vrátí pravostrannou pravděpodobnost rozdělení chí-kvadrát. Zachováno pro kompatibilitu; viz CHISQ.DIST.RT.",
    a: "Pravostranná distribuce chí-kvadrát (starší).",
    p: [
      {
        name: "x",
        detail: "Hodnota, při které chcete rozdělení vyhodnotit.",
      },
      {
        name: "stupně_volnosti",
        detail: "Počet stupňů volnosti.",
      },
    ],
  },
  {
    n: "CHIINV",
    d: "Vrátí inverzní hodnotu pravostranné pravděpodobnosti rozdělení chí-kvadrát. Zachováno pro kompatibilitu; viz CHISQ.INV.RT.",
    a: "Inverzní pravostranná chí-kvadrát (starší).",
    p: [
      {
        name: "pravděpodobnost",
        detail: "Pravděpodobnost spojená s rozdělením chí-kvadrát.",
      },
      {
        name: "stupně_volnosti",
        detail: "Počet stupňů volnosti.",
      },
    ],
  },
  {
    n: "CHISQ.DIST",
    d: "Vrátí levostrannou pravděpodobnost rozdělení chí-kvadrát.",
    a: "Levostranné rozdělení chí-kvadrát.",
    p: [
      {
        name: "x",
        detail: "Hodnota, při které chcete rozdělení vyhodnotit.",
      },
      {
        name: "stupně_volnosti",
        detail: "Počet stupňů volnosti.",
      },
      {
        name: "kumulativní",
        detail:
          "TRUE vrací funkci kumulativního rozdělení, FALSE funkci hustoty pravděpodobnosti.",
      },
    ],
  },
  {
    n: "CHISQ.DIST.RT",
    d: "Vrátí pravostrannou pravděpodobnost rozdělení chí-kvadrát.",
    a: "Pravostranné rozdělení chí-kvadrát.",
    p: [
      {
        name: "x",
        detail: "Hodnota, při které chcete rozdělení vyhodnotit.",
      },
      {
        name: "stupně_volnosti",
        detail: "Počet stupňů volnosti.",
      },
    ],
  },
  {
    n: "CHISQ.INV",
    d: "Vrátí inverzní hodnotu k levostranné pravděpodobnosti rozdělení chí-kvadrát.",
    a: "Inverzní levostranné rozdělení chí-kvadrát.",
    p: [
      {
        name: "pravděpodobnost",
        detail: "Pravděpodobnost spojená s rozdělením chí-kvadrát.",
      },
      {
        name: "stupně_volnosti",
        detail: "Počet stupňů volnosti.",
      },
    ],
  },
  {
    n: "CHISQ.INV.RT",
    d: "Vrátí inverzní hodnotu pravostranné pravděpodobnosti rozdělení chí-kvadrát.",
    a: "Inverzní pravostranné rozdělení chí-kvadrát.",
    p: [
      {
        name: "pravděpodobnost",
        detail: "Pravděpodobnost spojená s rozdělením chí-kvadrát.",
      },
      {
        name: "stupně_volnosti",
        detail: "Počet stupňů volnosti.",
      },
    ],
  },
  {
    n: "CHISQ.TEST",
    d: "Vrátí test nezávislosti: hodnotu z rozdělení chí-kvadrát pro statistiku a příslušné stupně volnosti.",
    a: "Chí-kvadrát test nezávislosti.",
    p: [
      {
        name: "skutečné_hodnoty",
        detail:
          "Rozsah dat, který obsahuje pozorování k testování proti očekávaným hodnotám.",
      },
      {
        name: "očekávané_hodnoty",
        detail:
          "Rozsah dat, který obsahuje poměr součinu součtů řádků a součtů sloupců k celkovému součtu.",
      },
    ],
  },
  {
    n: "CHITEST",
    d: "Vrátí test nezávislosti. Zachováno pro kompatibilitu; viz CHISQ.TEST.",
    a: "Chí-kvadrát test (starší).",
    p: [
      {
        name: "skutečné_hodnoty",
        detail:
          "Rozsah dat, který obsahuje pozorování k testování proti očekávaným hodnotám.",
      },
      {
        name: "očekávané_hodnoty",
        detail: "Rozsah dat, který obsahuje očekávané hodnoty.",
      },
    ],
  },
  {
    n: "CHOOSE",
    d: "Používá číslo_indexu k vrácení hodnoty ze seznamu argumentů hodnoty.",
    a: "Vybere hodnotu ze seznamu podle indexu.",
    p: [
      {
        name: "číslo_indexu",
        detail: "Jakou hodnotu vrátit; číslo mezi 1 a 254.",
      },
      {
        name: "hodnota1",
        detail: "První hodnota na výběr.",
      },
      {
        name: "hodnota2",
        detail: "Další hodnoty na výběr, celkem až 254.",
      },
    ],
  },
  {
    n: "CHOOSECOLS",
    d: "Vrátí zadané sloupce z pole.",
    a: "Vybrané sloupce pole.",
    p: [
      {
        name: "pole",
        detail: "Pole obsahující sloupce, které mají být vráceny.",
      },
      {
        name: "číslo_sloupce1",
        detail:
          "První sloupec, který má být vrácen; záporná čísla se počítají od konce.",
      },
      {
        name: "číslo_sloupce2",
        detail: "Další sloupce, které mají být vráceny.",
      },
    ],
  },
  {
    n: "CHOOSEROWS",
    d: "Vrátí zadané řádky z pole.",
    a: "Vybrané řádky pole.",
    p: [
      {
        name: "pole",
        detail: "Pole obsahující řádky, které mají být vráceny.",
      },
      {
        name: "číslo_řádku1",
        detail:
          "Číslo prvního řádku, které má být vráceno; záporná čísla se počítají od konce.",
      },
      {
        name: "číslo_řádku2",
        detail: "Další čísla řádků, která mají být vrácena.",
      },
    ],
  },
  {
    n: "CLEAN",
    d: "Odebere z textu všechny netisknutelné znaky.",
    a: "Odstraní netisknutelné znaky.",
    p: [
      {
        name: "text",
        detail:
          "Jakékoli informace listu, ze kterých chcete odstranit netisknutelné znaky.",
      },
    ],
  },
  {
    n: "CODE",
    d: "Vrátí číselný kód pro první znak v textovém řetězci.",
    a: "Kód prvního znaku.",
    p: [
      {
        name: "text",
        detail: "Text, pro který chcete kód prvního znaku.",
      },
    ],
  },
  {
    n: "COLUMN",
    d: "Vrátí číslo sloupce odkazu na danou buňku nebo buňky obsahující vzorec, pokud je vynechán.",
    a: "Číslo sloupce odkazu.",
    p: [
      {
        name: "odkaz",
        detail:
          "Buňka nebo rozsah buněk, pro které chcete vrátit číslo sloupce.",
      },
    ],
  },
  {
    n: "COLUMNS",
    d: "Vrátí počet sloupců v poli nebo odkazu.",
    a: "Počet sloupců v rozsahu.",
    p: [
      {
        name: "pole",
        detail: "Pole, maticový vzorec nebo odkaz na rozsah buněk.",
      },
    ],
  },
  {
    n: "COMBIN",
    d: "Vrátí počet kombinací (bez opakování) pro daný počet položek.",
    a: "Počet kombinací.",
    p: [
      {
        name: "číslo",
        detail: "Počet položek.",
      },
      {
        name: "počet_vybraných",
        detail: "Počet položek v každé kombinaci.",
      },
    ],
  },
  {
    n: "COMBINA",
    d: "Vrátí počet kombinací s opakováním pro daný počet položek.",
    a: "Počet kombinací s opakováním.",
    p: [
      {
        name: "číslo",
        detail:
          "Počet položek; musí být větší nebo rovno 0 a `počet_vybraných`.",
      },
      {
        name: "počet_vybraných",
        detail: "Počet položek v každé kombinaci.",
      },
    ],
  },
  {
    n: "COMPLEX",
    d: "Převede reálné a imaginární koeficienty na komplexní číslo ve tvaru x + yi nebo x + yj.",
    a: "Sestaví komplexní číslo.",
    p: [
      {
        name: "reálná_část",
        detail: "Reálný koeficient komplexního čísla.",
      },
      {
        name: "imaginární_část",
        detail: "Imaginární koeficient komplexního čísla.",
      },
      {
        name: "přípona",
        detail: 'Přípona imaginární složky, "i" nebo "j"; výchozí je "i".',
      },
    ],
  },
  {
    n: "CONCAT",
    d: "Kombinuje text z více rozsahů a/nebo řetězců bez oddělovače.",
    a: "Spojí text z rozsahů a řetězců.",
    p: [
      {
        name: "text1",
        detail: "První textová položka nebo rozsah, který má být spojen.",
      },
      {
        name: "text2",
        detail: "Další textové položky nebo rozsahy ke spojení, celkem až 253.",
      },
    ],
  },
  {
    n: "CONCATENATE",
    d: "Spojí dva nebo více textových řetězců do jednoho řetězce.",
    a: "Spojí textové řetězce.",
    p: [
      {
        name: "text1",
        detail:
          "První položka ke spojení; textovou hodnotu, číslo nebo odkaz na buňku.",
      },
      {
        name: "text2",
        detail: "Další textové položky ke spojení, celkem až 255.",
      },
    ],
  },
  {
    n: "CONFIDENCE",
    d: "Vrátí interval spolehlivosti pro průměr populace s použitím normálního rozdělení.",
    a: "Normální interval spolehlivosti (kompatibilita).",
    p: [
      {
        name: "alfa",
        detail:
          "Hladina významnosti použitá pro výpočet hladiny spolehlivosti.",
      },
      {
        name: "směrodatná_odchylka",
        detail: "Směrodatná odchylka základního souboru.",
      },
      {
        name: "velikost",
        detail: "Velikost vzorku.",
      },
    ],
  },
  {
    n: "CONFIDENCE.NORM",
    d: "Vrátí interval spolehlivosti pro průměr populace s použitím normálního rozdělení.",
    a: "Interval spolehlivosti s použitím normálního rozdělení.",
    p: [
      {
        name: "alfa",
        detail:
          "Hladina významnosti použitá pro výpočet hladiny spolehlivosti.",
      },
      {
        name: "směrodatná_odchylka",
        detail:
          "standardní odchylka základního souboru pro rozsah dat; předpokládá se, že je známý.",
      },
      {
        name: "velikost",
        detail: "Velikost vzorku.",
      },
    ],
  },
  {
    n: "CONFIDENCE.T",
    d: "Vrátí interval spolehlivosti pro střední hodnotu populace pomocí Studentova t rozdělení.",
    a: "Interval spolehlivosti pomocí t rozdělení.",
    p: [
      {
        name: "alfa",
        detail:
          "Hladina významnosti použitá pro výpočet hladiny spolehlivosti.",
      },
      {
        name: "směrodatná_odchylka",
        detail:
          "standardní odchylka základního souboru pro rozsah dat; předpokládá se, že je známý.",
      },
      {
        name: "velikost",
        detail: "Velikost vzorku.",
      },
    ],
  },
  {
    n: "CONVERT",
    d: "Převádí číslo z jednoho systému měření na jiný, například tabulku vzdáleností v mílích na kilometry.",
    a: "Převádí mezi měrnými jednotkami.",
    p: [
      {
        name: "číslo",
        detail: "Hodnota v `zdrojová_jednotka` k převodu.",
      },
      {
        name: "zdrojová_jednotka",
        detail: "Jednotky pro `číslo`.",
      },
      {
        name: "cílová_jednotka",
        detail: "Jednotky pro výsledek.",
      },
    ],
  },
  {
    n: "CORREL",
    d: "Vrátí korelační koeficient dvou rozsahů buněk.",
    a: "Korelační koeficient dvou souborů dat.",
    p: [
      {
        name: "pole1",
        detail: "Rozsah hodnot buněk.",
      },
      {
        name: "pole2",
        detail: "Druhý rozsah hodnot buněk.",
      },
    ],
  },
  {
    n: "COS",
    d: "Vrátí kosinus úhlu zadaného v radiánech.",
    a: "Kosinus úhlu v radiánech.",
    p: [
      {
        name: "číslo",
        detail:
          "Úhel v radiánech. Vynásobte stupně PI()/180 nebo použijte RADIANS pro převod.",
      },
    ],
  },
  {
    n: "COSH",
    d: "Vrátí hyperbolický kosinus čísla.",
    a: "Hyperbolický kosinus.",
    p: [
      {
        name: "číslo",
        detail: "Jakékoli reálné číslo.",
      },
    ],
  },
  {
    n: "COT",
    d: "Vrátí kotangens úhlu zadaného v radiánech.",
    a: "Kotangens úhlu v radiánech.",
    p: [
      {
        name: "číslo",
        detail:
          "Úhel v radiánech; jeho absolutní hodnota musí být menší než 2^27.",
      },
    ],
  },
  {
    n: "COTH",
    d: "Vrátí hyperbolický kotangens hyperbolického úhlu.",
    a: "Hyperbolický kotangens.",
    p: [
      {
        name: "číslo",
        detail: "Jakékoli reálné číslo jiné než 0.",
      },
    ],
  },
  {
    n: "COUNT",
    d: "Spočítá počet buněk, které obsahují čísla, a spočítá čísla v seznamu argumentů.",
    a: "Počet číselných hodnot.",
    p: [
      {
        name: "hodnota1",
        detail:
          "První položka, odkaz na buňku nebo rozsah, ve kterém chcete počítat čísla.",
      },
      {
        name: "hodnota2",
        detail: "Další položky nebo rozsahy, celkem až 255.",
      },
    ],
  },
  {
    n: "COUNTA",
    d: "Spočítá počet buněk, které nejsou prázdné v rozsahu.",
    a: "Počet neprázdných hodnot.",
    p: [
      {
        name: "hodnota1",
        detail: "První argument představující hodnoty, které chcete počítat.",
      },
      {
        name: "hodnota2",
        detail: "Další hodnoty nebo rozsahy, celkem až 255.",
      },
    ],
  },
  {
    n: "COUNTBLANK",
    d: 'Spočítá počet prázdných buněk v rozsahu. Počítají se také buňky se vzorci, které vracejí "".',
    a: "Počet prázdných buněk.",
    p: [
      {
        name: "oblast",
        detail: "Rozsah, od kterého chcete spočítat prázdné buňky.",
      },
    ],
  },
  {
    n: "COUNTIF",
    d: "Spočítá počet buněk v rozsahu, které splňují jediné kritérium.",
    a: "Počet buněk, které splňují podmínku.",
    p: [
      {
        name: "oblast",
        detail: "Skupina buněk, kterou chcete spočítat.",
      },
      {
        name: "kritéria",
        detail:
          "Číslo, výraz, odkaz na buňku nebo textový řetězec, který určuje, které buňky se budou počítat.",
      },
    ],
  },
  {
    n: "COUNTIFS",
    d: "Spočítá počet buněk, které splňují více kritérií v rámci jednoho nebo více rozsahů.",
    a: "Počet buněk, které splňují více kritérií.",
    p: [
      {
        name: "rozsah_kritérií1",
        detail: "První rozsah, ve kterém se vyhodnotí související kritéria.",
      },
      {
        name: "kritéria1",
        detail: "Kritéria, která definují, které buňky se budou počítat.",
      },
      {
        name: "rozsah_kritérií2",
        detail:
          "Další rozsahy, až 127 párů rozsah/kritéria, každý má stejný tvar jako `rozsah_kritérií1`.",
      },
      {
        name: "kritéria2",
        detail: "Kritéria pro odpovídající doplňkový rozsah.",
      },
    ],
  },
  {
    n: "COUPDAYBS",
    d: "Vrátí počet dní od začátku období kuponu do data vypořádání.",
    a: "Dny od začátku kupónového období do vypořádání.",
    p: [
      {
        name: "datum_vypořádání",
        detail: "Datum vypořádání cenného papíru.",
      },
      {
        name: "datum_splatnosti",
        detail:
          "Datum splatnosti cenného papíru, kdy skončí platnost cenného papíru.",
      },
      {
        name: "frekvence",
        detail:
          "Počet výplat kuponů za rok: 1 roční, 2 pololetní, 4 čtvrtletní.",
      },
      {
        name: "základna",
        detail:
          "Základ počtu dnů: 0 nebo vynecháno US 30/360, 1 skutečný/skutečný, 2 aktuální/360, 3 aktuální/365, 4 evropské 30/360.",
      },
    ],
  },
  {
    n: "COUPDAYS",
    d: "Vrátí počet dní v období kupónu, které obsahuje datum vypořádání.",
    a: "Dny v období vypořádání kuponu.",
    p: [
      {
        name: "datum_vypořádání",
        detail: "Datum vypořádání cenného papíru.",
      },
      {
        name: "datum_splatnosti",
        detail:
          "Datum splatnosti cenného papíru, kdy skončí platnost cenného papíru.",
      },
      {
        name: "frekvence",
        detail:
          "Počet výplat kuponů za rok: 1 roční, 2 pololetní, 4 čtvrtletní.",
      },
      {
        name: "základna",
        detail:
          "Základ počtu dnů: 0 nebo vynecháno US 30/360, 1 skutečný/skutečný, 2 aktuální/360, 3 aktuální/365, 4 evropské 30/360.",
      },
    ],
  },
  {
    n: "COUPDAYSNC",
    d: "Vrátí počet dní od data vypořádání do data dalšího kuponu.",
    a: "Dny od vypořádání do dalšího kupónu.",
    p: [
      {
        name: "datum_vypořádání",
        detail: "Datum vypořádání cenného papíru.",
      },
      {
        name: "datum_splatnosti",
        detail:
          "Datum splatnosti cenného papíru, kdy skončí platnost cenného papíru.",
      },
      {
        name: "frekvence",
        detail:
          "Počet výplat kuponů za rok: 1 roční, 2 pololetní, 4 čtvrtletní.",
      },
      {
        name: "základna",
        detail:
          "Základ počtu dnů: 0 nebo vynecháno US 30/360, 1 skutečný/skutečný, 2 aktuální/360, 3 aktuální/365, 4 evropské 30/360.",
      },
    ],
  },
  {
    n: "COUPNCD",
    d: "Vrátí číslo, které představuje datum dalšího kuponu po datu vypořádání.",
    a: "Datum dalšího kupónu po vypořádání.",
    p: [
      {
        name: "datum_vypořádání",
        detail: "Datum vypořádání cenného papíru.",
      },
      {
        name: "datum_splatnosti",
        detail:
          "Datum splatnosti cenného papíru, kdy skončí platnost cenného papíru.",
      },
      {
        name: "frekvence",
        detail:
          "Počet výplat kuponů za rok: 1 roční, 2 pololetní, 4 čtvrtletní.",
      },
      {
        name: "základna",
        detail:
          "Základ počtu dnů: 0 nebo vynecháno US 30/360, 1 skutečný/skutečný, 2 aktuální/360, 3 aktuální/365, 4 evropské 30/360.",
      },
    ],
  },
  {
    n: "COUPNUM",
    d: "Vrátí počet kuponů splatných mezi datem vypořádání a datem splatnosti, zaokrouhlený nahoru na nejbližší celý kupon.",
    a: "Počet kuponů do splatnosti.",
    p: [
      {
        name: "datum_vypořádání",
        detail: "Datum vypořádání cenného papíru.",
      },
      {
        name: "datum_splatnosti",
        detail:
          "Datum splatnosti cenného papíru, kdy skončí platnost cenného papíru.",
      },
      {
        name: "frekvence",
        detail:
          "Počet výplat kuponů za rok: 1 roční, 2 pololetní, 4 čtvrtletní.",
      },
      {
        name: "základna",
        detail:
          "Základ počtu dnů: 0 nebo vynecháno US 30/360, 1 skutečný/skutečný, 2 aktuální/360, 3 aktuální/365, 4 evropské 30/360.",
      },
    ],
  },
  {
    n: "COUPPCD",
    d: "Vrátí číslo, které představuje datum předchozího kuponu před datem vypořádání.",
    a: "Předchozí datum kupónu před vypořádáním.",
    p: [
      {
        name: "datum_vypořádání",
        detail: "Datum vypořádání cenného papíru.",
      },
      {
        name: "datum_splatnosti",
        detail:
          "Datum splatnosti cenného papíru, kdy skončí platnost cenného papíru.",
      },
      {
        name: "frekvence",
        detail:
          "Počet výplat kuponů za rok: 1 roční, 2 pololetní, 4 čtvrtletní.",
      },
      {
        name: "základna",
        detail:
          "Základ počtu dnů: 0 nebo vynecháno US 30/360, 1 skutečný/skutečný, 2 aktuální/360, 3 aktuální/365, 4 evropské 30/360.",
      },
    ],
  },
  {
    n: "COVAR",
    d: "Vrací kovarianci, průměr součinů párových odchylek. Zachováno pro kompatibilitu; viz COVARIANCE.P.",
    a: "Populační kovariance (kompatibilita).",
    p: [
      {
        name: "pole1",
        detail: "První buněčný rozsah celých čísel.",
      },
      {
        name: "pole2",
        detail: "Druhý buněčný rozsah celých čísel.",
      },
    ],
  },
  {
    n: "COVARIANCE.P",
    d: "Vrátí populační kovarianci, průměr součinů odchylek pro každý pár datových bodů.",
    a: "Populační kovariance.",
    p: [
      {
        name: "pole1",
        detail: "První buněčný rozsah celých čísel.",
      },
      {
        name: "pole2",
        detail: "Druhý buněčný rozsah celých čísel.",
      },
    ],
  },
  {
    n: "COVARIANCE.S",
    d: "Vrátí kovarianci vzorku, průměr součinů odchylek pro každý pár datových bodů.",
    a: "Výběrová kovariance.",
    p: [
      {
        name: "pole1",
        detail: "První buněčný rozsah celých čísel.",
      },
      {
        name: "pole2",
        detail: "Druhý buněčný rozsah celých čísel.",
      },
    ],
  },
  {
    n: "CRITBINOM",
    d: "Vrátí nejmenší hodnotu, pro kterou je kumulativní binomické rozdělení větší nebo rovné hodnotě kritéria. Zachováno pro kompatibilitu; viz BINOM.INV.",
    a: "Inverzní kumulativní binom (kompatibilita).",
    p: [
      {
        name: "pokusy",
        detail: "Počet Bernoulliho pokusů.",
      },
      {
        name: "pravděpodobnost_úspěchu",
        detail: "Pravděpodobnost úspěchu každého pokusu.",
      },
      {
        name: "alfa",
        detail: "Hodnota kritéria.",
      },
    ],
  },
  {
    n: "CSC",
    d: "Vrátí kosekans úhlu zadaného v radiánech.",
    a: "Kosekans úhlu v radiánech.",
    p: [
      {
        name: "číslo",
        detail:
          "Úhel v radiánech; jeho absolutní hodnota musí být menší než 2^27.",
      },
    ],
  },
  {
    n: "CSCH",
    d: "Vrátí hyperbolický kosekans úhlu zadaného v radiánech.",
    a: "Hyperbolický kosekant.",
    p: [
      {
        name: "číslo",
        detail: "Jakékoli reálné číslo jiné než 0.",
      },
    ],
  },
  {
    n: "CUMIPMT",
    d: "Vrátí kumulativní úrok zaplacený z půjčky mezi počáteční_období a konec_období.",
    a: "Kumulativní úrok zaplacený mezi dvěma obdobími.",
    p: [
      {
        name: "sazba",
        detail: "Úroková sazba za období.",
      },
      {
        name: "počet_období",
        detail: "Celkový počet platebních období.",
      },
      {
        name: "současná_hodnota",
        detail: "Současná hodnota.",
      },
      {
        name: "počáteční_období",
        detail: "První období ve výpočtu; období se číslují od 1.",
      },
      {
        name: "konec_období",
        detail: "Poslední období ve výpočtu.",
      },
      {
        name: "typ",
        detail: "Načasování platby: 0 na konci období, 1 na začátku.",
      },
    ],
  },
  {
    n: "CUMPRINC",
    d: "Vrátí kumulativní jistinu zaplacenou z půjčky mezi počáteční_období a konec_období.",
    a: "Kumulativní jistina zaplacená mezi dvěma obdobími.",
    p: [
      {
        name: "sazba",
        detail: "Úroková sazba za období.",
      },
      {
        name: "počet_období",
        detail: "Celkový počet platebních období.",
      },
      {
        name: "současná_hodnota",
        detail: "Současná hodnota.",
      },
      {
        name: "počáteční_období",
        detail: "První období ve výpočtu; období se číslují od 1.",
      },
      {
        name: "konec_období",
        detail: "Poslední období ve výpočtu.",
      },
      {
        name: "typ",
        detail: "Načasování platby: 0 na konci období, 1 na začátku.",
      },
    ],
  },
  {
    n: "DATE",
    d: "Vrátí pořadové číslo, které představuje konkrétní datum.",
    a: "Datum z roku, měsíce a dne.",
    p: [
      {
        name: "rok",
        detail:
          "Rok; 0 až 1899 se přidá k 1900, 1900 až 9999 se použije tak, jak je.",
      },
      {
        name: "měsíc",
        detail:
          "Měsíc v roce od 1 do 12; hodnoty mimo toto rozmezí se přenesou do sousedních let.",
      },
      {
        name: "den",
        detail:
          "Den v měsíci od 1 do 31; hodnoty mimo tento rozsah se přenesou do sousedních měsíců.",
      },
    ],
  },
  {
    n: "DATEDIF",
    d: "Vypočítá počet dní, měsíců nebo let mezi dvěma daty.",
    a: "Rozdíl mezi dvěma daty.",
    p: [
      {
        name: "datum_zahájení",
        detail: "První nebo počáteční datum období.",
      },
      {
        name: "koncové_datum",
        detail: "Poslední nebo končící datum období.",
      },
      {
        name: "jednotka",
        detail:
          'Typ informací, které se mají vrátit: "Y" let, "M" měsíců, "D" dnů, "MD", "YM" nebo "YD" pro zbytek.',
      },
    ],
  },
  {
    n: "DATEVALUE",
    d: "Převede datum uložené jako text na sériové číslo, které Excel rozpozná jako datum.",
    a: "Převede text data na sériové číslo.",
    p: [
      {
        name: "datum_jako_text",
        detail: "Text, který představuje datum v uznávaném formátu data.",
      },
    ],
  },
  {
    n: "DAVERAGE",
    d: "Zprůměruje hodnoty v poli (sloupci) záznamů v seznamu nebo databázi, které odpovídají zadaným podmínkám.",
    a: "Průměr odpovídajících databázových záznamů.",
    p: [
      {
        name: "databáze",
        detail:
          "Rozsah buněk, které tvoří seznam nebo databázi; první řádek obsahuje popisky pro každý sloupec.",
      },
      {
        name: "pole",
        detail:
          "Označení sloupce ve dvojitých uvozovkách nebo číslo představující pozici sloupce.",
      },
      {
        name: "kritéria",
        detail:
          "Rozsah buněk, který obsahuje podmínky: alespoň jeden štítek sloupce a buňka pod ním.",
      },
    ],
  },
  {
    n: "DAY",
    d: "Vrátí den data reprezentovaný pořadovým číslem jako celé číslo od 1 do 31.",
    a: "Den v měsíci.",
    p: [
      {
        name: "pořadové_číslo",
        detail: "Datum dne, který se snažíte najít.",
      },
    ],
  },
  {
    n: "DAYS",
    d: "Vrátí počet dní mezi dvěma daty.",
    a: "Dny mezi dvěma daty.",
    p: [
      {
        name: "koncové_datum",
        detail: "Poslední z těchto dvou dat.",
      },
      {
        name: "datum_zahájení",
        detail: "Starší z těchto dvou dat.",
      },
    ],
  },
  {
    n: "DAYS360",
    d: "Vrátí počet dní mezi dvěma daty na základě 360denního roku (dvanáct 30denních měsíců).",
    a: "Dny mezi daty v roce 360 ​​dnů.",
    p: [
      {
        name: "datum_zahájení",
        detail: "Datum zahájení.",
      },
      {
        name: "koncové_datum",
        detail: "Datum ukončení.",
      },
      {
        name: "metoda",
        detail:
          "FALSE nebo vynecháno používá metodu U.S. (NASD); TRUE používá evropskou metodu.",
      },
    ],
  },
  {
    n: "DB",
    d: "Vrátí odpis aktiva za zadané období pomocí metody fixně-klesajícího zůstatku.",
    a: "Pevně ​​klesající odpis zůstatku.",
    p: [
      {
        name: "pořizovací_cena",
        detail: "Počáteční cena aktiva.",
      },
      {
        name: "zůstatková_hodnota",
        detail: "Hodnota na konci odpisu (zbytková hodnota aktiva).",
      },
      {
        name: "životnost",
        detail: "Počet období, během kterých je aktivum odepisováno.",
      },
      {
        name: "období",
        detail:
          "Období, za které chcete vypočítat odpisy, ve stejných jednotkách jako `životnost`.",
      },
      {
        name: "měsíc",
        detail: "Počet měsíců v prvním roce; výchozí je 12.",
      },
    ],
  },
  {
    n: "DBCS",
    d: "Změní znaky s poloviční šířkou (jednobajtové) na znaky s plnou šířkou (dvoubajtové).",
    a: "Převést na znaky s plnou šířkou.",
    p: [
      {
        name: "text",
        detail:
          "Text nebo odkaz na buňku, která obsahuje text, který se má změnit.",
      },
    ],
  },
  {
    n: "DCOUNT",
    d: "Spočítá buňky, které obsahují čísla v poli (sloupci) záznamů v seznamu nebo databázi, které odpovídají zadaným podmínkám.",
    a: "Počet čísel v odpovídajících záznamech.",
    p: [
      {
        name: "databáze",
        detail:
          "Rozsah buněk, které tvoří seznam nebo databázi; první řádek obsahuje popisky pro každý sloupec.",
      },
      {
        name: "pole",
        detail:
          "Označení sloupce ve dvojitých uvozovkách nebo číslo představující pozici sloupce.",
      },
      {
        name: "kritéria",
        detail:
          "Rozsah buněk, který obsahuje podmínky: alespoň jeden štítek sloupce a buňka pod ním.",
      },
    ],
  },
  {
    n: "DCOUNTA",
    d: "Spočítá neprázdné buňky v poli (sloupci) záznamů v seznamu nebo databázi, které odpovídají zadaným podmínkám.",
    a: "Počet neprázdných hodnot v odpovídajících záznamech.",
    p: [
      {
        name: "databáze",
        detail:
          "Rozsah buněk, které tvoří seznam nebo databázi; první řádek obsahuje popisky pro každý sloupec.",
      },
      {
        name: "pole",
        detail:
          "Označení sloupce ve dvojitých uvozovkách nebo číslo představující pozici sloupce.",
      },
      {
        name: "kritéria",
        detail:
          "Rozsah buněk, který obsahuje podmínky: alespoň jeden štítek sloupce a buňka pod ním.",
      },
    ],
  },
  {
    n: "DDB",
    d: "Vrátí odpis aktiva za zadané období pomocí metody dvojitého klesajícího zůstatku nebo jiné metody, kterou určíte.",
    a: "Dvojnásobně klesající odpis zůstatku.",
    p: [
      {
        name: "pořizovací_cena",
        detail: "Počáteční cena aktiva.",
      },
      {
        name: "zůstatková_hodnota",
        detail: "Hodnota na konci odpisu.",
      },
      {
        name: "životnost",
        detail: "Počet období, během kterých je aktivum odepisováno.",
      },
      {
        name: "období",
        detail:
          "Období, za které chcete vypočítat odpisy, ve stejných jednotkách jako `životnost`.",
      },
      {
        name: "faktor",
        detail:
          "Rychlost, se kterou se zůstatek snižuje; výchozí hodnota je 2 (dvojitě klesající zůstatek).",
      },
    ],
  },
  {
    n: "DEC2BIN",
    d: "Převede desítkové číslo na binární.",
    a: "Převod z desítkové do dvojkové soustavy.",
    p: [
      {
        name: "číslo",
        detail: "Desetinné celé číslo, které se má převést, od -512 do 511.",
      },
      {
        name: "počet_míst",
        detail:
          "Počet znaků, které se mají použít; výsledek je doplněn úvodními nulami.",
      },
    ],
  },
  {
    n: "DEC2HEX",
    d: "Převede desetinné číslo na šestnáctkové.",
    a: "Převod z desítkové do šestnáctkové soustavy.",
    p: [
      {
        name: "číslo",
        detail: "Desetinné celé číslo, které se má převést.",
      },
      {
        name: "počet_míst",
        detail:
          "Počet znaků, které se mají použít; výsledek je doplněn úvodními nulami.",
      },
    ],
  },
  {
    n: "DEC2OCT",
    d: "Převede desetinné číslo na osmičkové.",
    a: "Převod z desítkové do osmičkové soustavy.",
    p: [
      {
        name: "číslo",
        detail: "Desetinné celé číslo, které se má převést.",
      },
      {
        name: "počet_míst",
        detail:
          "Počet znaků, které se mají použít; výsledek je doplněn úvodními nulami.",
      },
    ],
  },
  {
    n: "DECIMAL",
    d: "Převede textovou reprezentaci čísla v daném základu na desítkové číslo.",
    a: "Převede text v jiném základu na číslo.",
    p: [
      {
        name: "text",
        detail: "Text, který se má převést; maximálně 255 znaků.",
      },
      {
        name: "základ_soustavy",
        detail: "Základ `text`; celé číslo od 2 do 36.",
      },
    ],
  },
  {
    n: "DEGREES",
    d: "Převede radiány na stupně.",
    a: "Převede radiány na stupně.",
    p: [
      {
        name: "úhel",
        detail: "Úhel v radiánech, který chcete převést.",
      },
    ],
  },
  {
    n: "DELTA",
    d: "Testuje, zda jsou dvě hodnoty stejné. Vrátí 1, pokud číslo1 = číslo2; jinak vrátí 0.",
    a: "Testuje, zda se dvě čísla rovnají.",
    p: [
      {
        name: "číslo1",
        detail: "První číslo.",
      },
      {
        name: "číslo2",
        detail: "Druhé číslo; výchozí je 0.",
      },
    ],
  },
  {
    n: "DEVSQ",
    d: "Vrátí součet druhých mocnin odchylek datových bodů od jejich střední hodnoty vzorku.",
    a: "Součet čtverců odchylek.",
    p: [
      {
        name: "číslo1",
        detail: "První číslo nebo rozsah.",
      },
      {
        name: "číslo2",
        detail: "Další čísla nebo rozsahy, celkem až 255.",
      },
    ],
  },
  {
    n: "DGET",
    d: "Extrahuje jednu hodnotu ze sloupce seznamu nebo databáze, která odpovídá zadaným podmínkám.",
    a: "Jedna hodnota z odpovídajících záznamů.",
    p: [
      {
        name: "databáze",
        detail:
          "Rozsah buněk, které tvoří seznam nebo databázi; první řádek obsahuje popisky pro každý sloupec.",
      },
      {
        name: "pole",
        detail:
          "Označení sloupce ve dvojitých uvozovkách nebo číslo představující pozici sloupce.",
      },
      {
        name: "kritéria",
        detail:
          "Rozsah buněk, který obsahuje podmínky: alespoň jeden štítek sloupce a buňka pod ním.",
      },
    ],
  },
  {
    n: "DISC",
    d: "Vrátí diskontní sazbu pro cenný papír.",
    a: "Diskontní sazba cenného papíru.",
    p: [
      {
        name: "datum_vypořádání",
        detail: "Datum vypořádání cenného papíru.",
      },
      {
        name: "datum_splatnosti",
        detail: "Datum splatnosti cenného papíru.",
      },
      {
        name: "cena",
        detail: "Cena cenného papíru za nominální hodnotu 100 $.",
      },
      {
        name: "výkupní_hodnota",
        detail: "Výkupní hodnota cenného papíru za nominální hodnotu 100 $.",
      },
      {
        name: "základna",
        detail:
          "Základ počtu dnů: 0 nebo vynecháno US 30/360, 1 skutečný/skutečný, 2 aktuální/360, 3 aktuální/365, 4 evropské 30/360.",
      },
    ],
  },
  {
    n: "DMAX",
    d: "Vrátí největší číslo v poli (sloupci) záznamů v seznamu nebo databázi, které odpovídají zadaným podmínkám.",
    a: "Maximum odpovídajících záznamů databáze.",
    p: [
      {
        name: "databáze",
        detail:
          "Rozsah buněk, které tvoří seznam nebo databázi; první řádek obsahuje popisky pro každý sloupec.",
      },
      {
        name: "pole",
        detail:
          "Označení sloupce ve dvojitých uvozovkách nebo číslo představující pozici sloupce.",
      },
      {
        name: "kritéria",
        detail:
          "Rozsah buněk, který obsahuje podmínky: alespoň jeden štítek sloupce a buňka pod ním.",
      },
    ],
  },
  {
    n: "DMIN",
    d: "Vrátí nejmenší číslo v poli (sloupci) záznamů v seznamu nebo databázi, které odpovídají zadaným podmínkám.",
    a: "Minimum z odpovídajících databázových záznamů.",
    p: [
      {
        name: "databáze",
        detail:
          "Rozsah buněk, které tvoří seznam nebo databázi; první řádek obsahuje popisky pro každý sloupec.",
      },
      {
        name: "pole",
        detail:
          "Označení sloupce ve dvojitých uvozovkách nebo číslo představující pozici sloupce.",
      },
      {
        name: "kritéria",
        detail:
          "Rozsah buněk, který obsahuje podmínky: alespoň jeden štítek sloupce a buňka pod ním.",
      },
    ],
  },
  {
    n: "DOLLAR",
    d: "Převede číslo na text pomocí formátu měny se zaokrouhlením desetinných míst na zadané místo.",
    a: "Formátuje číslo jako text měny.",
    p: [
      {
        name: "číslo",
        detail:
          "Číslo, odkaz na buňku obsahující číslo nebo vzorec, který se vyhodnotí jako číslo.",
      },
      {
        name: "desetinná_místa",
        detail: "Počet číslic vpravo od desetinné čárky; výchozí je 2.",
      },
    ],
  },
  {
    n: "DOLLARDE",
    d: "Převede dolarovou cenu vyjádřenou jako celočíselnou část a zlomkovou část, například 1,02, na dolarovou cenu vyjádřenou jako desetinné číslo.",
    a: "Převede zlomkovou cenu na desítkovou.",
    p: [
      {
        name: "zlomkový_dolar",
        detail:
          "Číslo vyjádřené jako celá část a zlomková část, oddělené desetinným znakem.",
      },
      {
        name: "zlomek",
        detail: "Celé číslo, které se má použít ve jmenovateli zlomku.",
      },
    ],
  },
  {
    n: "DOLLARFR",
    d: "Převede dolarovou cenu vyjádřenou jako desetinné číslo na dolarovou cenu vyjádřenou zlomkem.",
    a: "Převede desetinnou cenu na zlomkovou.",
    p: [
      {
        name: "desetinný_dolar",
        detail: "Desetinné číslo.",
      },
      {
        name: "zlomek",
        detail: "Celé číslo, které se má použít ve jmenovateli zlomku.",
      },
    ],
  },
  {
    n: "DPRODUCT",
    d: "Vynásobí hodnoty v poli (sloupci) záznamů v seznamu nebo databázi, které odpovídají zadaným podmínkám.",
    a: "Součin hodnot odpovídajících databázových záznamů.",
    p: [
      {
        name: "databáze",
        detail:
          "Rozsah buněk, které tvoří seznam nebo databázi; první řádek obsahuje popisky pro každý sloupec.",
      },
      {
        name: "pole",
        detail:
          "Označení sloupce ve dvojitých uvozovkách nebo číslo představující pozici sloupce.",
      },
      {
        name: "kritéria",
        detail:
          "Rozsah buněk, který obsahuje podmínky: alespoň jeden štítek sloupce a buňka pod ním.",
      },
    ],
  },
  {
    n: "DROP",
    d: "Vyloučí zadaný počet řádků nebo sloupců ze začátku nebo konce pole.",
    a: "Pole bez prvního nebo posledního řádku/sloupce.",
    p: [
      {
        name: "pole",
        detail: "Pole, ze kterého se mají vypustit řádky nebo sloupce.",
      },
      {
        name: "řádky",
        detail: "Počet řádků k vypuštění; záporná hodnota klesá od konce.",
      },
      {
        name: "sloupce",
        detail: "Počet sloupců k vyloučení; záporná hodnota klesá od konce.",
      },
    ],
  },
  {
    n: "DSTDEV",
    d: "Odhaduje směrodatnou odchylku základního souboru na základě vzorku pomocí čísel v poli záznamů, které odpovídají zadaným podmínkám.",
    a: "Výběrová směrodatná odchylka odpovídajících záznamů.",
    p: [
      {
        name: "databáze",
        detail:
          "Rozsah buněk, které tvoří seznam nebo databázi; první řádek obsahuje popisky pro každý sloupec.",
      },
      {
        name: "pole",
        detail:
          "Označení sloupce ve dvojitých uvozovkách nebo číslo představující pozici sloupce.",
      },
      {
        name: "kritéria",
        detail:
          "Rozsah buněk, který obsahuje podmínky: alespoň jeden štítek sloupce a buňka pod ním.",
      },
    ],
  },
  {
    n: "DSTDEVP",
    d: "Vypočítá směrodatnou odchylku základního souboru na základě celého základního souboru pomocí čísel v poli záznamů, které odpovídají zadaným podmínkám.",
    a: "Směrodatná odchylka populace odpovídajících záznamů.",
    p: [
      {
        name: "databáze",
        detail:
          "Rozsah buněk, které tvoří seznam nebo databázi; první řádek obsahuje popisky pro každý sloupec.",
      },
      {
        name: "pole",
        detail:
          "Označení sloupce ve dvojitých uvozovkách nebo číslo představující pozici sloupce.",
      },
      {
        name: "kritéria",
        detail:
          "Rozsah buněk, který obsahuje podmínky: alespoň jeden štítek sloupce a buňka pod ním.",
      },
    ],
  },
  {
    n: "DSUM",
    d: "Přidá čísla do pole (sloupce) záznamů v seznamu nebo databázi, které odpovídají zadaným podmínkám.",
    a: "Součet odpovídajících databázových záznamů.",
    p: [
      {
        name: "databáze",
        detail:
          "Rozsah buněk, které tvoří seznam nebo databázi; první řádek obsahuje popisky pro každý sloupec.",
      },
      {
        name: "pole",
        detail:
          "Označení sloupce ve dvojitých uvozovkách nebo číslo představující pozici sloupce.",
      },
      {
        name: "kritéria",
        detail:
          "Rozsah buněk, který obsahuje podmínky: alespoň jeden štítek sloupce a buňka pod ním.",
      },
    ],
  },
  {
    n: "DURATION",
    d: "Vrátí trvání Macaulay pro předpokládanou nominální hodnotu 100 $.",
    a: "Macaulayova durace cenného papíru.",
    p: [
      {
        name: "datum_vypořádání",
        detail: "Datum vypořádání cenného papíru.",
      },
      {
        name: "datum_splatnosti",
        detail: "Datum splatnosti cenného papíru.",
      },
      {
        name: "kupon",
        detail: "Roční kupónová sazba cenného papíru.",
      },
      {
        name: "výnos",
        detail: "Roční výnos cenného papíru.",
      },
      {
        name: "frekvence",
        detail:
          "Počet výplat kuponů za rok: 1 roční, 2 pololetní, 4 čtvrtletní.",
      },
      {
        name: "základna",
        detail:
          "Základ počtu dnů: 0 nebo vynecháno US 30/360, 1 skutečný/skutečný, 2 aktuální/360, 3 aktuální/365, 4 evropské 30/360.",
      },
    ],
  },
  {
    n: "DVAR",
    d: "Odhadne rozptyl základního souboru na základě vzorku pomocí čísel v poli záznamů, které odpovídají zadaným podmínkám.",
    a: "Výběrový rozptyl odpovídajících záznamů.",
    p: [
      {
        name: "databáze",
        detail:
          "Rozsah buněk, které tvoří seznam nebo databázi; první řádek obsahuje popisky pro každý sloupec.",
      },
      {
        name: "pole",
        detail:
          "Označení sloupce ve dvojitých uvozovkách nebo číslo představující pozici sloupce.",
      },
      {
        name: "kritéria",
        detail:
          "Rozsah buněk, který obsahuje podmínky: alespoň jeden štítek sloupce a buňka pod ním.",
      },
    ],
  },
  {
    n: "DVARP",
    d: "Vypočítá rozptyl základního souboru na základě celého základního souboru pomocí čísel v poli záznamů, které odpovídají zadaným podmínkám.",
    a: "Rozptyl populace odpovídajících záznamů.",
    p: [
      {
        name: "databáze",
        detail:
          "Rozsah buněk, které tvoří seznam nebo databázi; první řádek obsahuje popisky pro každý sloupec.",
      },
      {
        name: "pole",
        detail:
          "Označení sloupce ve dvojitých uvozovkách nebo číslo představující pozici sloupce.",
      },
      {
        name: "kritéria",
        detail:
          "Rozsah buněk, který obsahuje podmínky: alespoň jeden štítek sloupce a buňka pod ním.",
      },
    ],
  },
  {
    n: "EDATE",
    d: "Vrátí pořadové číslo data, které je zadaným počtem měsíců před nebo po počátečním datu.",
    a: "Datum několik měsíců daleko.",
    p: [
      {
        name: "datum_zahájení",
        detail: "Datum zahájení.",
      },
      {
        name: "měsíce",
        detail:
          "Počet měsíců před (záporné) nebo po (kladné) `datum_zahájení`.",
      },
    ],
  },
  {
    n: "EFFECT",
    d: "Vrátí efektivní roční úrokovou sazbu danou nominální roční úrokovou sazbou a počtem složených období za rok.",
    a: "Efektivní roční úroková sazba.",
    p: [
      {
        name: "nominální_sazba",
        detail: "Nominální úroková sazba.",
      },
      {
        name: "období_za_rok",
        detail: "Počet složených období za rok.",
      },
    ],
  },
  {
    n: "ENCODEURL",
    d: "Vrátí řetězec zakódovaný v URL.",
    a: "Text zakódovaný v URL.",
    p: [
      {
        name: "text",
        detail: "Řetězec pro zakódování URL.",
      },
    ],
  },
  {
    n: "EOMONTH",
    d: "Vrátí sériové číslo pro poslední den v měsíci, což je uvedený počet měsíců před nebo po datum_zahájení.",
    a: "Poslední den v měsíci.",
    p: [
      {
        name: "datum_zahájení",
        detail: "Datum zahájení.",
      },
      {
        name: "měsíce",
        detail:
          "Počet měsíců před (záporné) nebo po (kladné) `datum_zahájení`.",
      },
    ],
  },
  {
    n: "ERF",
    d: "Vrátí chybovou funkci integrovanou mezi spodní_hranice a horní_hranice.",
    a: "Chybová funkce.",
    p: [
      {
        name: "spodní_hranice",
        detail: "Dolní mez pro integraci ERF.",
      },
      {
        name: "horní_hranice",
        detail:
          "Horní mez pro integraci ERF; pokud je vynechán, integruje se mezi 0 a `spodní_hranice`.",
      },
    ],
  },
  {
    n: "ERF.PRECISE",
    d: "Vrací chybovou funkci integrovanou mezi 0 a x.",
    a: "Chybová funkce.",
    p: [
      {
        name: "x",
        detail: "Horní mez pro integraci ERF.PRECISE.",
      },
    ],
  },
  {
    n: "ERFC",
    d: "Vrátí doplňkovou funkci ERF integrovanou mezi x a nekonečnem.",
    a: "Doplňková chybová funkce.",
    p: [
      {
        name: "x",
        detail: "Dolní mez pro integraci ERFC.",
      },
    ],
  },
  {
    n: "ERFC.PRECISE",
    d: "Vrátí doplňkovou chybovou funkci integrovanou mezi x a nekonečnem.",
    a: "Doplňková chybová funkce.",
    p: [
      {
        name: "x",
        detail: "Dolní mez pro integraci ERFC.PRECISE.",
      },
    ],
  },
  {
    n: "ERROR.TYPE",
    d: "Vrátí číslo odpovídající chybě: 1 #NULL!, 2 #DIV/0!, 3 #VALUE!, 4 #REF!, 5 #NAME?, 6 #NUM!, 7 #N/A; pokud hodnota není chybou, vrátí #N/A.",
    a: "Číslo identifikující typ chyby.",
    p: [
      {
        name: "chybová_hodnota",
        detail: "Chybová hodnota, jejíž identifikační číslo chcete najít.",
      },
    ],
  },
  {
    n: "EUROCONVERT",
    d: "Převádí číslo na eura, z eur na měnu člena euro nebo mezi členskými měnami euro pomocí eura jako prostředníka.",
    a: "Převod měny na euro.",
    p: [
      {
        name: "číslo",
        detail: "Hodnota měny, kterou chcete převést.",
      },
      {
        name: "zdroj",
        detail: 'ISO kód zdrojové měny, např. "DEM".',
      },
      {
        name: "cíl",
        detail: 'ISO kód cílové měny, např. "EUR".',
      },
      {
        name: "plná_přesnost",
        detail:
          "TRUE pro zachování všech platných číslic; FALSE (výchozí) zaokrouhlí na měnu.",
      },
      {
        name: "přesnost_triangulace",
        detail: "Desetinná čísla (3 nebo více) pro střední hodnotu v eurech.",
      },
    ],
  },
  {
    n: "EVEN",
    d: "Zaokrouhlí číslo nahoru od nuly na nejbližší sudé celé číslo.",
    a: "Zaokrouhlí nahoru na nejbližší sudé celé číslo.",
    p: [
      {
        name: "číslo",
        detail: "Hodnota, která se má zaokrouhlit.",
      },
    ],
  },
  {
    n: "EXACT",
    d: "Porovná dva textové řetězce a vrátí TRUE, pokud jsou úplně stejné, jinak FALSE. Rozlišují se malá a velká písmena.",
    a: "Zkontroluje, zda jsou dva texty totožné.",
    p: [
      {
        name: "text1",
        detail: "První textový řetězec.",
      },
      {
        name: "text2",
        detail: "Druhý textový řetězec.",
      },
    ],
  },
  {
    n: "EXP",
    d: "Vrátí e umocněné na dané číslo.",
    a: "Číslo e umocněné na zadaný exponent.",
    p: [
      {
        name: "číslo",
        detail: "Exponent aplikovaný na základ e (2,71828182845904).",
      },
    ],
  },
  {
    n: "EXPAND",
    d: "Rozbalí nebo doplní pole na zadané rozměry řádků a sloupců.",
    a: "Vyplní pole na danou velikost.",
    p: [
      {
        name: "pole",
        detail: "Pole k rozšíření.",
      },
      {
        name: "řádky",
        detail: "Počet řádků v rozšířeném poli.",
      },
      {
        name: "sloupce",
        detail: "Počet sloupců v rozšířeném poli; výchozí je šířka `pole`.",
      },
      {
        name: "doplnit_hodnotou",
        detail: "Hodnota, se kterou se má vyplnit; výchozí hodnota je #N/A.",
      },
    ],
  },
  {
    n: "EXPON.DIST",
    d: "Vrátí exponenciální rozdělení.",
    a: "Exponenciální rozdělení.",
    p: [
      {
        name: "x",
        detail: "Hodnota funkce.",
      },
      {
        name: "lambda",
        detail: "Hodnota parametru.",
      },
      {
        name: "kumulativní",
        detail:
          "TRUE vrací funkci kumulativního rozdělení, FALSE funkci hustoty pravděpodobnosti.",
      },
    ],
  },
  {
    n: "EXPONDIST",
    d: "Vrátí exponenciální rozdělení. Zachováno pro kompatibilitu; viz EXPON.DIST.",
    a: "Exponenciální distribuce (kompatibilita).",
    p: [
      {
        name: "x",
        detail: "Hodnota funkce.",
      },
      {
        name: "lambda",
        detail: "Hodnota parametru.",
      },
      {
        name: "kumulativní",
        detail:
          "TRUE vrací funkci kumulativního rozdělení, FALSE funkci hustoty pravděpodobnosti.",
      },
    ],
  },
  {
    n: "F.DIST",
    d: "Vrací (levostranné) rozdělení pravděpodobnosti F, stupeň diverzity mezi dvěma soubory dat.",
    a: "Levostranné F rozdělení.",
    p: [
      {
        name: "x",
        detail: "Hodnota, při které se má funkce vyhodnotit.",
      },
      {
        name: "stupně_volnosti1",
        detail: "Stupně volnosti v čitateli.",
      },
      {
        name: "stupně_volnosti2",
        detail: "Jmenovatel stupně volnosti.",
      },
      {
        name: "kumulativní",
        detail:
          "TRUE vrací funkci kumulativního rozdělení, FALSE funkci hustoty pravděpodobnosti.",
      },
    ],
  },
  {
    n: "F.DIST.RT",
    d: "Vrátí pravostranné F rozdělení pravděpodobnosti, stupeň diverzity mezi dvěma soubory dat.",
    a: "Pravostranné F rozdělení.",
    p: [
      {
        name: "x",
        detail: "Hodnota, při které se má funkce vyhodnotit.",
      },
      {
        name: "stupně_volnosti1",
        detail: "Stupně volnosti v čitateli.",
      },
      {
        name: "stupně_volnosti2",
        detail: "Jmenovatel stupně volnosti.",
      },
    ],
  },
  {
    n: "F.INV",
    d: "Vrátí inverzní hodnotu (levostranného) F rozdělení pravděpodobnosti.",
    a: "Inverzní levostranné F rozdělení.",
    p: [
      {
        name: "pravděpodobnost",
        detail: "Pravděpodobnost spojená s F kumulativním rozdělením.",
      },
      {
        name: "stupně_volnosti1",
        detail: "Stupně volnosti v čitateli.",
      },
      {
        name: "stupně_volnosti2",
        detail: "Jmenovatel stupně volnosti.",
      },
    ],
  },
  {
    n: "F.INV.RT",
    d: "Vrátí inverzní hodnotu pravostranného F rozdělení pravděpodobnosti.",
    a: "Inverzní pravostranné F rozdělení.",
    p: [
      {
        name: "pravděpodobnost",
        detail: "Pravděpodobnost spojená s F kumulativním rozdělením.",
      },
      {
        name: "stupně_volnosti1",
        detail: "Stupně volnosti v čitateli.",
      },
      {
        name: "stupně_volnosti2",
        detail: "Jmenovatel stupně volnosti.",
      },
    ],
  },
  {
    n: "F.TEST",
    d: "Vrátí výsledek F-testu, dvoustrannou pravděpodobnost, že se odchylky ve dvou polích významně neliší.",
    a: "Výsledek F-testu.",
    p: [
      {
        name: "pole1",
        detail: "První pole nebo rozsah dat.",
      },
      {
        name: "pole2",
        detail: "Druhé pole nebo rozsah dat.",
      },
    ],
  },
  {
    n: "FACT",
    d: "Vrátí faktoriál čísla, který se rovná 1*2*3*...*číslu.",
    a: "Faktoriál čísla.",
    p: [
      {
        name: "číslo",
        detail:
          "Nezáporné číslo, jehož faktoriál chcete; desetinná místa jsou zkrácena.",
      },
    ],
  },
  {
    n: "FACTDOUBLE",
    d: "Vrátí dvojitý faktoriál čísla.",
    a: "Dvojitý faktoriál čísla.",
    p: [
      {
        name: "číslo",
        detail:
          "Hodnota, pro kterou se má vrátit dvojitý faktoriál; desetinná místa jsou zkrácena.",
      },
    ],
  },
  {
    n: "FALSE",
    d: "Vrátí logickou hodnotu FALSE.",
    a: "Logická hodnota FALSE.",
    p: [],
  },
  {
    n: "FDIST",
    d: "Vrátí pravostranné F rozdělení pravděpodobnosti. Zachováno pro kompatibilitu; viz F.DIST.RT.",
    a: "Pravostranná distribuce F (starší).",
    p: [
      {
        name: "x",
        detail: "Hodnota, při které se má funkce vyhodnotit.",
      },
      {
        name: "stupně_volnosti1",
        detail: "Stupně volnosti v čitateli.",
      },
      {
        name: "stupně_volnosti2",
        detail: "Jmenovatel stupně volnosti.",
      },
    ],
  },
  {
    n: "FILTER",
    d: "Filtruje rozsah dat na základě kritérií, která definujete.",
    a: "Řádky nebo sloupce, které splňují kritéria.",
    p: [
      {
        name: "pole",
        detail: "Pole nebo rozsah, který se má filtrovat.",
      },
      {
        name: "zahrnují",
        detail:
          "Booleovské pole se stejnou výškou nebo šířkou jako `pole`, kde TRUE uchovává řádek nebo sloupec.",
      },
      {
        name: "pokud_je_prázdný",
        detail:
          "Hodnota, která se má vrátit, pokud jsou všechny hodnoty v zahrnutém poli prázdné (nic neodpovídá).",
      },
    ],
  },
  {
    n: "FIND",
    d: "Vyhledá jeden textový řetězec v druhém textovém řetězci a vrátí počáteční pozici prvního. Rozlišují se malá a velká písmena, žádné zástupné znaky.",
    a: "Pozice textu v textu (rozlišují se malá a velká písmena).",
    p: [
      {
        name: "hledaný_text",
        detail: "Text, který chcete najít.",
      },
      {
        name: "v_textu",
        detail: "Text obsahující text, který chcete najít.",
      },
      {
        name: "počáteční_pozice",
        detail: "Znak, u kterého má být zahájeno vyhledávání; výchozí je 1.",
      },
    ],
  },
  {
    n: "FINDB",
    d: "Najde jeden textový řetězec v druhém a vrátí jeho počáteční pozici, přičemž počítá bajty (jako FIND, pokud není výchozí jazyk DBCS).",
    a: "Pozice textu (bajty).",
    p: [
      {
        name: "hledaný_text",
        detail: "Text, který chcete najít.",
      },
      {
        name: "v_textu",
        detail: "Text obsahující text, který chcete najít.",
      },
      {
        name: "počáteční_pozice",
        detail: "Znak, u kterého má být zahájeno vyhledávání.",
      },
    ],
  },
  {
    n: "FINV",
    d: "Vrátí inverzní hodnotu pravostranného F rozdělení pravděpodobnosti. Zachováno pro kompatibilitu; viz F.INV.RT.",
    a: "Inverzní pravostranné rozdělení F (starší).",
    p: [
      {
        name: "pravděpodobnost",
        detail: "Pravděpodobnost spojená s F kumulativním rozdělením.",
      },
      {
        name: "stupně_volnosti1",
        detail: "Stupně volnosti v čitateli.",
      },
      {
        name: "stupně_volnosti2",
        detail: "Jmenovatel stupně volnosti.",
      },
    ],
  },
  {
    n: "FISHER",
    d: "Vrátí Fisherovu transformaci v x.",
    a: "Fisherova transformace.",
    p: [
      {
        name: "x",
        detail: "Číselná hodnota větší než -1 a menší než 1.",
      },
    ],
  },
  {
    n: "FISHERINV",
    d: "Vrátí inverzní hodnotu Fisherovy transformace.",
    a: "Inverzní Fisherova transformace.",
    p: [
      {
        name: "y",
        detail: "Hodnota, pro kterou chcete provést inverzní transformaci.",
      },
    ],
  },
  {
    n: "FIXED",
    d: "Zaokrouhlí číslo na zadaný počet desetinných míst, zformátuje je v desítkovém formátu s tečkami a čárkami a vrátí výsledek jako text.",
    a: "Formátuje číslo jako text s pevnými desetinnými místy.",
    p: [
      {
        name: "číslo",
        detail: "Číslo, které chcete zaokrouhlit a převést na text.",
      },
      {
        name: "desetinná_místa",
        detail: "Počet číslic vpravo od desetinné čárky; výchozí je 2.",
      },
      {
        name: "bez_čárek",
        detail: "TRUE zabrání FIXED zahrnout čárky do vráceného textu.",
      },
    ],
  },
  {
    n: "FLOOR",
    d: "Zaokrouhlí číslo dolů, směrem k nule, na nejbližší násobek významnosti.",
    a: "Zaokrouhlí dolů na nejbližší násobek.",
    p: [
      {
        name: "číslo",
        detail: "Číselná hodnota, kterou chcete zaokrouhlit.",
      },
      {
        name: "násobek",
        detail: "Násobek, na který chcete zaokrouhlit.",
      },
    ],
  },
  {
    n: "FLOOR.MATH",
    d: "Zaokrouhlí číslo dolů na nejbližší celé číslo nebo na nejbližší násobek významnosti s kontrolou nad směrem pro záporná čísla.",
    a: "Zaokrouhlí dolů na nejbližší celé číslo nebo násobek.",
    p: [
      {
        name: "číslo",
        detail: "Číslo, které se má zaokrouhlit dolů.",
      },
      {
        name: "násobek",
        detail: "Násobek, na který se má zaokrouhlit; výchozí je 1.\nrežim",
      },
      {
        name: "režim",
        detail:
          "Pro záporná čísla se nenulová hodnota zaokrouhluje směrem k nule; 0 nebo vynechaná zaokrouhlení od nuly.",
      },
    ],
  },
  {
    n: "FLOOR.PRECISE",
    d: "Zaokrouhlí číslo dolů na nejbližší celé číslo nebo na nejbližší násobek významnosti, bez ohledu na znaménko čísla.",
    a: "Zaokrouhluje dolů bez ohledu na znaménko.",
    p: [
      {
        name: "číslo",
        detail: "Hodnota, která se má zaokrouhlit.",
      },
      {
        name: "násobek",
        detail:
          "Násobek, na který je číslo zaokrouhleno; výchozí je 1. Jeho znaménko je ignorováno.",
      },
    ],
  },
  {
    n: "FORECAST",
    d: "Vypočítává nebo předpovídá budoucí hodnotu pomocí existujících hodnot a lineární regrese. Zachováno pro kompatibilitu; viz FORECAST.LINEAR.",
    a: "Předpovídá hodnotu lineární regresí.",
    p: [
      {
        name: "x",
        detail: "Datový bod, pro který chcete předpovědět hodnotu.",
      },
      {
        name: "známé_y",
        detail: "Závislé pole nebo rozsah dat.",
      },
      {
        name: "známé_x",
        detail: "Nezávislé pole nebo rozsah dat.",
      },
    ],
  },
  {
    n: "FORECAST.ETS",
    d: "Předpovídá budoucí hodnotu z historických hodnot pomocí aditivního exponenciálního vyhlazování (AAA verze ETS).",
    a: "Exponenciálně vyhlazující předpověď.",
    p: [
      {
        name: "cílové_datum",
        detail: "Datum nebo číslo, pro které se má předpovídat hodnota.",
      },
      {
        name: "hodnoty",
        detail: "Historické hodnoty, ze kterých se má předpovídat.",
      },
      {
        name: "časová_osa",
        detail: "Data nebo čísla historických hodnot s konstantním krokem.",
      },
      {
        name: "sezónnost",
        detail:
          "Délka sezónního vzoru: 1 nebo vynechaný jej detekuje, 0 znamená žádný.",
      },
      {
        name: "doplňování_dat",
        detail:
          "1 (výchozí) interpoluje chybějící body, 0 je považuje za nuly.",
      },
      {
        name: "agregace",
        detail:
          "Jak jsou kombinovány hodnoty se stejným časovým razítkem: 1 AVERAGE (výchozí) až 7 SUM.",
      },
    ],
  },
  {
    n: "FORECAST.ETS.CONFINT",
    d: "Vrátí poloviční šířku intervalu spolehlivosti pro předpověď FORECAST.ETS.",
    a: "Interval spolehlivosti předpovědi ETS.",
    p: [
      {
        name: "cílové_datum",
        detail: "Datum nebo číslo, pro které je předpověď určena.",
      },
      {
        name: "hodnoty",
        detail: "Historické hodnoty, ze kterých se má předpovídat.",
      },
      {
        name: "časová_osa",
        detail: "Data nebo čísla historických hodnot s konstantním krokem.",
      },
      {
        name: "úroveň_spolehlivosti",
        detail: "Úroveň spolehlivosti mezi 0 a 1; výchozí 0,95.",
      },
      {
        name: "sezónnost",
        detail:
          "Délka sezónního vzoru: 1 nebo vynechaný jej detekuje, 0 znamená žádný.",
      },
      {
        name: "doplňování_dat",
        detail:
          "1 (výchozí) interpoluje chybějící body, 0 je považuje za nuly.",
      },
      {
        name: "agregace",
        detail:
          "Jak jsou kombinovány hodnoty se stejným časovým razítkem: 1 AVERAGE (výchozí) až 7 SUM.",
      },
    ],
  },
  {
    n: "FORECAST.ETS.SEASONALITY",
    d: "Vrátí délku opakujícího se vzoru FORECAST.ETS detekovaného v časové řadě.",
    a: "Délka zjištěné sezónnosti.",
    p: [
      {
        name: "hodnoty",
        detail: "Historické hodnoty, ze kterých se má předpovídat.",
      },
      {
        name: "časová_osa",
        detail: "Data nebo čísla historických hodnot s konstantním krokem.",
      },
      {
        name: "doplňování_dat",
        detail:
          "1 (výchozí) interpoluje chybějící body, 0 je považuje za nuly.",
      },
      {
        name: "agregace",
        detail:
          "Jak jsou kombinovány hodnoty se stejným časovým razítkem: 1 AVERAGE (výchozí) až 7 SUM.",
      },
    ],
  },
  {
    n: "FORECAST.ETS.STAT",
    d: "Vrátí statistiku modelu FORECAST.ETS: 1 alfa, 2 beta, 3 gama, 4 MASE, 5 SMAPE, 6 MAE, 7 RMSE, velikost 8 kroků.",
    a: "Statistika předpovědi ETS.",
    p: [
      {
        name: "hodnoty",
        detail: "Historické hodnoty, ze kterých se má předpovídat.",
      },
      {
        name: "časová_osa",
        detail: "Data nebo čísla historických hodnot s konstantním krokem.",
      },
      {
        name: "statistický_typ",
        detail: "Jakou statistiku vrátit, 1 až 8.",
      },
      {
        name: "sezónnost",
        detail:
          "Délka sezónního vzoru: 1 nebo vynechaný jej detekuje, 0 znamená žádný.",
      },
      {
        name: "doplňování_dat",
        detail:
          "1 (výchozí) interpoluje chybějící body, 0 je považuje za nuly.",
      },
      {
        name: "agregace",
        detail:
          "Jak jsou kombinovány hodnoty se stejným časovým razítkem: 1 AVERAGE (výchozí) až 7 SUM.",
      },
    ],
  },
  {
    n: "FORECAST.LINEAR",
    d: "Vypočítává nebo předpovídá budoucí hodnotu pomocí existujících hodnot a lineární regrese.",
    a: "Předpovídá hodnotu lineární regresí.",
    p: [
      {
        name: "x",
        detail: "Datový bod, pro který chcete předpovědět hodnotu.",
      },
      {
        name: "známé_y",
        detail: "Závislé pole nebo rozsah dat.",
      },
      {
        name: "známé_x",
        detail: "Nezávislé pole nebo rozsah dat.",
      },
    ],
  },
  {
    n: "FORMULATEXT",
    d: "Vrátí vzorec jako řetězec.",
    a: "Vzorec buňky jako text.",
    p: [
      {
        name: "odkaz",
        detail: "Odkaz na buňku nebo rozsah buněk.",
      },
    ],
  },
  {
    n: "FREQUENCY",
    d: "Vypočítá, jak často se hodnoty vyskytují v rámci rozsahů hodnot, a vrátí vertikální pole s jedním prvkem více než hranice_intervalů.",
    a: "Frekvenční rozdělení hodnot.",
    p: [
      {
        name: "datové_pole",
        detail: "Pole nebo rozsah hodnot, pro které chcete počítat frekvence.",
      },
      {
        name: "hranice_intervalů",
        detail:
          "Pole nebo rozsah intervalů, do kterých chcete seskupit hodnoty.",
      },
    ],
  },
  {
    n: "FTEST",
    d: "Vrátí výsledek F-testu. Zachováno pro kompatibilitu; viz F.TEST.",
    a: "Výsledek F-testu (starší).",
    p: [
      {
        name: "pole1",
        detail: "První pole nebo rozsah dat.",
      },
      {
        name: "pole2",
        detail: "Druhé pole nebo rozsah dat.",
      },
    ],
  },
  {
    n: "FV",
    d: "Vypočítá budoucí hodnotu investice na základě konstantní úrokové sazby s pravidelnými konstantními platbami nebo jednou jednorázovou částkou.",
    a: "Budoucí hodnota investice.",
    p: [
      {
        name: "sazba",
        detail: "Úroková sazba za období.",
      },
      {
        name: "počet_období",
        detail: "Celkový počet platebních období.",
      },
      {
        name: "splátka",
        detail:
          "Platba provedena v každém období; nemůže se po dobu trvání anuity změnit.",
      },
      {
        name: "současná_hodnota",
        detail:
          "Současná hodnota nebo jednorázová částka, kterou právě teď stojí řada budoucích plateb; výchozí je 0.",
      },
      {
        name: "typ",
        detail:
          "Při splatnosti: 0 nebo vynechání na konci období, 1 na začátku.",
      },
    ],
  },
  {
    n: "FVSCHEDULE",
    d: "Vrátí budoucí hodnotu počáteční jistiny po použití řady složených úrokových sazeb.",
    a: "Budoucí hodnota s variabilními sazbami.",
    p: [
      {
        name: "jistina",
        detail: "Současná hodnota.",
      },
      {
        name: "sazby_období",
        detail: "Použitá řada úrokových sazeb.",
      },
    ],
  },
  {
    n: "GAMMA",
    d: "Vrátí hodnotu funkce gama.",
    a: "Hodnota funkce gama.",
    p: [
      {
        name: "x",
        detail: "Číslo, pro které se má vypočítat gama.",
      },
    ],
  },
  {
    n: "GAMMA.DIST",
    d: "Vrátí rozdělení gama.",
    a: "Rozložení gama.",
    p: [
      {
        name: "x",
        detail: "Hodnota, při které chcete rozdělení vyhodnotit.",
      },
      {
        name: "alfa",
        detail: "Parametr distribuce.",
      },
      {
        name: "beta",
        detail:
          "Parametr distribuce. Pokud je 1, vrátí standardní rozdělení gama.",
      },
      {
        name: "kumulativní",
        detail:
          "TRUE vrací funkci kumulativního rozdělení, FALSE funkci hustoty pravděpodobnosti.",
      },
    ],
  },
  {
    n: "GAMMA.INV",
    d: "Vrátí inverzní hodnotu gama kumulativního rozdělení.",
    a: "Inverzní gama rozdělení.",
    p: [
      {
        name: "pravděpodobnost",
        detail: "Pravděpodobnost spojená s rozdělením gama.",
      },
      {
        name: "alfa",
        detail: "Parametr distribuce.",
      },
      {
        name: "beta",
        detail: "Parametr distribuce.",
      },
    ],
  },
  {
    n: "GAMMADIST",
    d: "Vrátí rozdělení gama. Zachováno pro kompatibilitu; viz GAMMA.DIST.",
    a: "Gamma distribuce (starší).",
    p: [
      {
        name: "x",
        detail: "Hodnota, při které chcete rozdělení vyhodnotit.",
      },
      {
        name: "alfa",
        detail: "Parametr distribuce.",
      },
      {
        name: "beta",
        detail: "Parametr distribuce.",
      },
      {
        name: "kumulativní",
        detail:
          "TRUE vrací funkci kumulativního rozdělení, FALSE funkci hustoty pravděpodobnosti.",
      },
    ],
  },
  {
    n: "GAMMAINV",
    d: "Vrátí převrácenou hodnotu gama kumulativního rozdělení. Zachováno pro kompatibilitu; viz GAMMA.INV.",
    a: "Inverzní gama distribuce (starší).",
    p: [
      {
        name: "pravděpodobnost",
        detail: "Pravděpodobnost spojená s rozdělením gama.",
      },
      {
        name: "alfa",
        detail: "Parametr distribuce.",
      },
      {
        name: "beta",
        detail: "Parametr distribuce.",
      },
    ],
  },
  {
    n: "GAMMALN",
    d: "Vrátí přirozený logaritmus funkce gama.",
    a: "Přirozený logaritmus gama.",
    p: [
      {
        name: "x",
        detail: "Hodnota, pro kterou chcete vypočítat GAMMALN.",
      },
    ],
  },
  {
    n: "GAMMALN.PRECISE",
    d: "Vrátí přirozený logaritmus funkce gama.",
    a: "Přirozený logaritmus gama.",
    p: [
      {
        name: "x",
        detail: "Hodnota, pro kterou chcete vypočítat GAMMALN.PRECISE.",
      },
    ],
  },
  {
    n: "GAUSS",
    d: "Vypočítá pravděpodobnost, že člen standardní normální populace bude spadat mezi průměr a z standardní odchylky od průměru.",
    a: "Pravděpodobnost mezi průměrem a z u normovaného normálního rozdělení.",
    p: [
      {
        name: "z",
        detail: "Počet standardních odchylek od průměru.",
      },
    ],
  },
  {
    n: "GCD",
    d: "Vrátí největšího společného dělitele dvou nebo více celých čísel.",
    a: "Největší společný dělitel.",
    p: [
      {
        name: "číslo1",
        detail: "první hodnota nebo rozsah; desetinná místa jsou zkrácena.",
      },
      {
        name: "číslo2",
        detail: "Další hodnoty nebo rozsahy, celkem až 255.",
      },
    ],
  },
  {
    n: "GEOMEAN",
    d: "Vrátí geometrický průměr pole nebo rozsahu kladných dat.",
    a: "Geometrický průměr.",
    p: [
      {
        name: "číslo1",
        detail: "První číslo nebo rozsah.",
      },
      {
        name: "číslo2",
        detail: "Další čísla nebo rozsahy, celkem až 255.",
      },
    ],
  },
  {
    n: "GESTEP",
    d: "Vrátí 1, pokud je číslo větší nebo rovno kroku; jinak vrátí 0.",
    a: "Testuje, zda je číslo alespoň prahem.",
    p: [
      {
        name: "číslo",
        detail: "Hodnota k testování proti `krok`.",
      },
      {
        name: "krok",
        detail: "prahová hodnota; výchozí je 0.",
      },
    ],
  },
  {
    n: "GETPIVOTDATA",
    d: "Vrátí data uložená v sestavě kontingenční tabulky: hodnotu datového pole pro daný pár polí / položek.",
    a: "Hodnota z kontingenční tabulky.",
    p: [
      {
        name: "datové_pole",
        detail: 'Název pole hodnoty, např. `"Sales"` nebo `"Sum of Sales"`.',
      },
      {
        name: "kontingenční_tabulka",
        detail: "Odkaz na libovolnou buňku kontingenční tabulky.",
      },
      {
        name: "pole1",
        detail: "Pole řádků nebo sloupců kontingenční tabulky.",
      },
      {
        name: "položka_1",
        detail: "Položka `pole1` pro vrácení hodnoty.",
      },
    ],
  },
  {
    n: "GROUPBY",
    d: "Seskupuje řádky podle hodnot jednoho nebo více polí a agreguje hodnoty každé skupiny s volitelnými záhlavími, součty, tříděním a filtrováním.",
    a: "Seskupit a agregovat řádky.",
    p: [
      {
        name: "řádková_pole",
        detail:
          "Sloupcově orientované hodnoty seskupit podle; několik sloupců tvoří hierarchii.",
      },
      {
        name: "hodnoty",
        detail: "Sloupcově orientované hodnoty k agregaci.",
      },
      {
        name: "funkce",
        detail:
          "LAMBDA nebo název funkce (SUM, AVERAGE, COUNT, PERCENTOF, ...), který agreguje každou skupinu; několik jako HSTACK nebo pole.",
      },
      {
        name: "záhlaví_polí",
        detail:
          "Zda mají data záhlaví a zda je zobrazit: 0 ne, 1 ano, ale skrýt, 2 ne, ale vygenerovat, 3 ano a zobrazit.",
      },
      {
        name: "úroveň_součtů",
        detail:
          "Celkem: 0 žádný, 1 celkový součet (výchozí), 2 celkové součty a mezisoučty; negativní je staví na vrchol.",
      },
      {
        name: "pořadí_řazení",
        detail:
          "Číslo(a) sloupce, podle kterého se má seřadit, záporné pro sestupné.",
      },
      {
        name: "pole_filtrů",
        detail: "Booleovský výběr, které řádky se mají zahrnout.",
      },
      {
        name: "vztah_pole",
        detail:
          "0 hierarchie (výchozí) nebo 1 tabulka pro několik řádkových polí.",
      },
    ],
  },
  {
    n: "GROWTH",
    d: "Vypočítá předpokládaný exponenciální růst pomocí existujících dat a vrátí hodnoty y pro řadu nových hodnot x.",
    a: "Předpokládaný exponenciální růst.",
    p: [
      {
        name: "známé_y",
        detail: "Množina y-ových hodnot, které již znáte ve vztahu y = b*m^x.",
      },
      {
        name: "známé_x",
        detail: "Volitelná sada hodnot x, kterou již možná znáte.",
      },
      {
        name: "nové_x",
        detail:
          "Nové hodnoty x, pro které chcete, aby GROWTH vrátilo odpovídající hodnoty y.",
      },
      {
        name: "konst",
        detail:
          "TRUE nebo vynecháno vypočítá b normálně; FALSE vynutí b rovno 1.",
      },
    ],
  },
  {
    n: "HARMEAN",
    d: "Vrátí harmonický průměr souboru dat, převrácenou hodnotu aritmetického průměru převrácených hodnot.",
    a: "Harmonický průměr.",
    p: [
      {
        name: "číslo1",
        detail: "První číslo nebo rozsah.",
      },
      {
        name: "číslo2",
        detail: "Další čísla nebo rozsahy, celkem až 255.",
      },
    ],
  },
  {
    n: "HEX2BIN",
    d: "Převede hexadecimální číslo na binární.",
    a: "Převod ze šestnáctkové do dvojkové soustavy.",
    p: [
      {
        name: "číslo",
        detail: "Hexadecimální číslo, které se má převést; maximálně 10 znaků.",
      },
      {
        name: "počet_míst",
        detail:
          "Počet znaků, které se mají použít; výsledek je doplněn úvodními nulami.",
      },
    ],
  },
  {
    n: "HEX2DEC",
    d: "Převede šestnáctkové číslo na desítkové.",
    a: "Převod ze šestnáctkové do desítkové soustavy.",
    p: [
      {
        name: "číslo",
        detail:
          "Hexadecimální číslo, které se má převést; maximálně 10 znaků (40 bitů).",
      },
    ],
  },
  {
    n: "HEX2OCT",
    d: "Převede hexadecimální číslo na osmičkové.",
    a: "Převod ze šestnáctkové do osmičkové soustavy.",
    p: [
      {
        name: "číslo",
        detail: "Hexadecimální číslo, které se má převést; maximálně 10 znaků.",
      },
      {
        name: "počet_míst",
        detail:
          "Počet znaků, které se mají použít; výsledek je doplněn úvodními nulami.",
      },
    ],
  },
  {
    n: "HLOOKUP",
    d: "Vyhledá hodnotu v horním řádku tabulky nebo pole a vrátí hodnotu ve stejném sloupci ze zadaného řádku.",
    a: "Horizontální vyhledávání.",
    p: [
      {
        name: "hledaná_hodnota",
        detail: "Hodnota, která se nachází v prvním řádku tabulky.",
      },
      {
        name: "pole_tabulky",
        detail: "Tabulka informací, ve které se vyhledávají data.",
      },
      {
        name: "index_řádku",
        detail:
          "Číslo řádku v `pole_tabulky`, ze kterého bude vrácena odpovídající hodnota.",
      },
      {
        name: "přibližná_shoda",
        detail:
          "TRUE nebo vynechaný najde přibližnou shodu; FALSE najde přesnou shodu.",
      },
    ],
  },
  {
    n: "HOUR",
    d: "Vrátí hodinu časové hodnoty jako celé číslo od 0 (00:00 dop.) do 23 (23:00).",
    a: "Hodinová složka času.",
    p: [
      {
        name: "pořadové_číslo",
        detail: "Čas, který obsahuje hodinu, kterou chcete najít.",
      },
    ],
  },
  {
    n: "HSTACK",
    d: "Připojí pole vodorovně a postupně, aby se vrátilo větší pole.",
    a: "Skládá pole vedle sebe.",
    p: [
      {
        name: "pole1",
        detail: "První pole k připojení.",
      },
      {
        name: "pole2",
        detail: "Další pole k připojení.",
      },
    ],
  },
  {
    n: "HYPERLINK",
    d: "Vytvoří zástupce, který přeskočí na jiné místo v aktuálním sešitu nebo otevře dokument či webovou stránku.",
    a: "Vytvoří hypertextový odkaz.",
    p: [
      {
        name: "umístění_odkazu",
        detail:
          "Cesta a název souboru dokumentu nebo webové stránky, které se mají otevřít, nebo umístění v sešitu.",
      },
      {
        name: "zobrazovaný_název",
        detail:
          "Přeskakující text nebo číselná hodnota zobrazená v buňce; výchozí hodnota je `umístění_odkazu`.",
      },
    ],
  },
  {
    n: "HYPGEOM.DIST",
    d: "Vrátí hypergeometrické rozdělení, pravděpodobnost daného počtu úspěchů ve výběru.",
    a: "Hypergeometrické rozdělení.",
    p: [
      {
        name: "úspěchy_ve_výběru",
        detail: "Počet úspěchů ve vzorku.",
      },
      {
        name: "velikost_výběru",
        detail: "Velikost vzorku.",
      },
      {
        name: "úspěchy_v_populaci",
        detail: "Počet úspěchů v populaci.",
      },
      {
        name: "velikost_populace",
        detail: "Velikost populace.",
      },
      {
        name: "kumulativní",
        detail:
          "TRUE vrátí funkci kumulativního rozdělení, FALSE funkci hmotnosti pravděpodobnosti.",
      },
    ],
  },
  {
    n: "HYPGEOMDIST",
    d: "Vrátí hypergeometrické rozdělení. Zachováno pro kompatibilitu; viz HYPGEOM.DIST.",
    a: "Hypergeometrické rozložení (starší).",
    p: [
      {
        name: "úspěchy_ve_výběru",
        detail: "Počet úspěchů ve vzorku.",
      },
      {
        name: "velikost_výběru",
        detail: "Velikost vzorku.",
      },
      {
        name: "úspěchy_v_populaci",
        detail: "Počet úspěchů v populaci.",
      },
      {
        name: "velikost_populace",
        detail: "Velikost populace.",
      },
    ],
  },
  {
    n: "IF",
    d: "Vrátí jednu hodnotu, pokud je logický test vyhodnocen jako TRUE, a jinou hodnotu, pokud je vyhodnocen jako FALSE.",
    a: "Vybere hodnotu na základě podmínky.",
    p: [
      {
        name: "logický_test",
        detail: "Stav, který chcete testovat.",
      },
      {
        name: "hodnota,_pokud_je_pravdivá",
        detail: "Hodnota, která se má vrátit, pokud `logický_test` je TRUE.",
      },
      {
        name: "hodnota,_pokud_je_nepravda",
        detail:
          "Hodnota, která se má vrátit, pokud `logický_test` je FALSE; výchozí je FALSE.",
      },
    ],
  },
  {
    n: "IFERROR",
    d: "Vrátí vámi zadanou hodnotu, pokud je vzorec vyhodnocen jako chyba; jinak vrátí výsledek vzorce.",
    a: "Záložní hodnota při chybě.",
    p: [
      {
        name: "hodnota",
        detail: "Argument, který je zkontrolován na chybu.",
      },
      {
        name: "hodnota_v_případě_chyby",
        detail:
          "Hodnota vrácená, pokud je `hodnota` vyhodnocena jako chyba (#N/A, #VALUE!, #REF!, #DIV/0!, #NUM!, #NAME? nebo #NULL!).",
      },
    ],
  },
  {
    n: "IFNA",
    d: "Vrátí vámi zadanou hodnotu, pokud se výraz vyřeší jako #N/A; jinak vrátí výsledek výrazu.",
    a: "Záložní hodnota na #N/A.",
    p: [
      {
        name: "hodnota",
        detail: "Argument, který je zkontrolován na chybovou hodnotu #N/A.",
      },
      {
        name: "hodnota_při_NA",
        detail:
          "Hodnota, která se má vrátit, pokud se `hodnota` vyhodnotí jako #N/A.",
      },
    ],
  },
  {
    n: "IFS",
    d: "Zkontroluje, zda je splněna jedna nebo více podmínek, a vrátí hodnotu, která odpovídá první podmínce TRUE.",
    a: "Hodnota pro první podmínku TRUE.",
    p: [
      {
        name: "logický_test1",
        detail: "První podmínka, která se vyhodnotí jako TRUE nebo FALSE.",
      },
      {
        name: "hodnota_při_TRUE1",
        detail: "Výsledek, který se má vrátit, pokud `logický_test1` je TRUE.",
      },
      {
        name: "logický_test2",
        detail: "Další podmínky, až 127 párů podmínky/hodnota.",
      },
      {
        name: "hodnota_při_TRUE2",
        detail:
          "Výsledek, který se vrátí, pokud je odpovídající podmínka TRUE.",
      },
    ],
  },
  {
    n: "IMABS",
    d: "Vrátí absolutní hodnotu (modul) komplexního čísla v textovém formátu x + yi nebo x + yj.",
    a: "Absolutní hodnota komplexního čísla.",
    p: [
      {
        name: "komplexní_číslo",
        detail: "Komplexní číslo, pro které chcete mít absolutní hodnotu.",
      },
    ],
  },
  {
    n: "IMAGE",
    d: "Vloží do buňky obrázek ze zdrojového umístění (https nebo data:image URL) s alternativním textem.",
    a: "Obrázek z adresy URL.",
    p: [
      {
        name: "zdroj",
        detail: "URL obrázku (https:// nebo data:image URL).",
      },
      {
        name: "alternativní_text",
        detail: "Alternativní text popisující obrázek.",
      },
      {
        name: "dimenzování",
        detail: "Rozměry obrázku: 0 fit, 1 fill, 2 original, 3 custom.",
      },
      {
        name: "výška",
        detail: "Vlastní výška v pixelech (velikost 3).",
      },
      {
        name: "šířka",
        detail: "Vlastní šířka v pixelech (velikost 3).",
      },
    ],
  },
  {
    n: "IMAGINARY",
    d: "Vrátí imaginární koeficient komplexního čísla v textovém formátu x + yi nebo x + yj.",
    a: "Imaginární koeficient komplexního čísla.",
    p: [
      {
        name: "komplexní_číslo",
        detail: "Komplexní číslo, pro které chcete imaginární koeficient.",
      },
    ],
  },
  {
    n: "IMARGUMENT",
    d: "Vrátí argument theta, úhel vyjádřený v radiánech, komplexního čísla.",
    a: "Argument (úhel) komplexního čísla.",
    p: [
      {
        name: "komplexní_číslo",
        detail: "Komplexní číslo, pro které chcete argument.",
      },
    ],
  },
  {
    n: "IMCONJUGATE",
    d: "Vrátí komplexní konjugát komplexního čísla v textovém formátu x + yi nebo x + yj.",
    a: "Komplexní konjugát.",
    p: [
      {
        name: "komplexní_číslo",
        detail: "Komplexní číslo, pro které chcete konjugovat.",
      },
    ],
  },
  {
    n: "IMCOS",
    d: "Vrátí kosinus komplexního čísla v textovém formátu x + yi nebo x + yj.",
    a: "Kosinus komplexního čísla.",
    p: [
      {
        name: "komplexní_číslo",
        detail: "Komplexní číslo, pro které chcete kosinus.",
      },
    ],
  },
  {
    n: "IMCOSH",
    d: "Vrátí hyperbolický kosinus komplexního čísla v textovém formátu x + yi nebo x + yj.",
    a: "Hyperbolický kosinus komplexního čísla.",
    p: [
      {
        name: "komplexní_číslo",
        detail: "Komplexní číslo, pro které chcete hyperbolický kosinus.",
      },
    ],
  },
  {
    n: "IMCOT",
    d: "Vrátí kotangens komplexního čísla v textovém formátu x + yi nebo x + yj.",
    a: "Kotangens komplexního čísla.",
    p: [
      {
        name: "komplexní_číslo",
        detail: "Komplexní číslo, pro které chcete kotangens.",
      },
    ],
  },
  {
    n: "IMCSC",
    d: "Vrátí kosekans komplexního čísla v textovém formátu x + yi nebo x + yj.",
    a: "Kosekans komplexního čísla.",
    p: [
      {
        name: "komplexní_číslo",
        detail: "Komplexní číslo, pro které chcete kosekans.",
      },
    ],
  },
  {
    n: "IMCSCH",
    d: "Vrátí hyperbolický kosekans komplexního čísla v textovém formátu x + yi nebo x + yj.",
    a: "Hyperbolický kosekans komplexního čísla.",
    p: [
      {
        name: "komplexní_číslo",
        detail: "Komplexní číslo, pro které chcete hyperbolický kosekans.",
      },
    ],
  },
  {
    n: "IMDIV",
    d: "Vrátí podíl dvou komplexních čísel v textovém formátu x + yi nebo x + yj.",
    a: "Podíl dvou komplexních čísel.",
    p: [
      {
        name: "komplexní_číslo1",
        detail: "Komplexní čitatel nebo dividenda.",
      },
      {
        name: "komplexní_číslo2",
        detail: "Komplexní jmenovatel nebo dělitel.",
      },
    ],
  },
  {
    n: "IMEXP",
    d: "Vrátí exponenciálu komplexního čísla v textovém formátu x + yi nebo x + yj.",
    a: "Exponenciála komplexního čísla.",
    p: [
      {
        name: "komplexní_číslo",
        detail: "Komplexní číslo, pro které chcete exponenciálu.",
      },
    ],
  },
  {
    n: "IMLN",
    d: "Vrátí přirozený logaritmus komplexního čísla v textovém formátu x + yi nebo x + yj.",
    a: "Přirozený logaritmus komplexního čísla.",
    p: [
      {
        name: "komplexní_číslo",
        detail: "Komplexní číslo, pro které chcete přirozený logaritmus.",
      },
    ],
  },
  {
    n: "IMLOG10",
    d: "Vrátí společný logaritmus (základ 10) komplexního čísla v textovém formátu x + yi nebo x + yj.",
    a: "Základ-10 logaritmus komplexního čísla.",
    p: [
      {
        name: "komplexní_číslo",
        detail: "Komplexní číslo, pro které chcete mít společný logaritmus.",
      },
    ],
  },
  {
    n: "IMLOG2",
    d: "Vrátí logaritmus se základem 2 komplexního čísla v textovém formátu x + yi nebo x + yj.",
    a: "Základ-2 logaritmus komplexního čísla.",
    p: [
      {
        name: "komplexní_číslo",
        detail: "Komplexní číslo, pro které chcete logaritmus se základem 2.",
      },
    ],
  },
  {
    n: "IMPOWER",
    d: "Vrátí komplexní číslo v textovém formátu x + yi nebo x + yj umocněné na mocninu.",
    a: "Komplexní číslo umocněné.",
    p: [
      {
        name: "komplexní_číslo",
        detail: "Komplexní číslo, které chcete umocnit na mocninu.",
      },
      {
        name: "číslo",
        detail: "Mocnina, na kterou chcete zvýšit komplexní číslo.",
      },
    ],
  },
  {
    n: "IMPRODUCT",
    d: "Vrátí součin 1 až 255 komplexních čísel v textovém formátu x + yi nebo x + yj.",
    a: "Součin komplexních čísel.",
    p: [
      {
        name: "komplexní_číslo1",
        detail: "První komplexní číslo, které se má vynásobit.",
      },
      {
        name: "komplexní_číslo2",
        detail: "Další komplexní čísla k násobení, celkem až 255.",
      },
    ],
  },
  {
    n: "IMREAL",
    d: "Vrátí skutečný koeficient komplexního čísla v textovém formátu x + yi nebo x + yj.",
    a: "Reálný koeficient komplexního čísla.",
    p: [
      {
        name: "komplexní_číslo",
        detail: "Komplexní číslo, pro které chcete skutečný koeficient.",
      },
    ],
  },
  {
    n: "IMSEC",
    d: "Vrátí sekans komplexního čísla v textovém formátu x + yi nebo x + yj.",
    a: "Sekans komplexního čísla.",
    p: [
      {
        name: "komplexní_číslo",
        detail: "Komplexní číslo, pro které chcete sekant.",
      },
    ],
  },
  {
    n: "IMSECH",
    d: "Vrátí hyperbolický sekans komplexního čísla v textovém formátu x + yi nebo x + yj.",
    a: "Hyperbolický sekans komplexního čísla.",
    p: [
      {
        name: "komplexní_číslo",
        detail: "Komplexní číslo, pro které chcete hyperbolický sekans.",
      },
    ],
  },
  {
    n: "IMSIN",
    d: "Vrátí sinus komplexního čísla v textovém formátu x + yi nebo x + yj.",
    a: "Sinus komplexního čísla.",
    p: [
      {
        name: "komplexní_číslo",
        detail: "Komplexní číslo, pro které chcete sinus.",
      },
    ],
  },
  {
    n: "IMSINH",
    d: "Vrátí hyperbolický sinus komplexního čísla v textovém formátu x + yi nebo x + yj.",
    a: "Hyperbolický sinus komplexního čísla.",
    p: [
      {
        name: "komplexní_číslo",
        detail: "Komplexní číslo, pro které chcete hyperbolický sinus.",
      },
    ],
  },
  {
    n: "IMSQRT",
    d: "Vrátí druhou odmocninu komplexního čísla v textovém formátu x + yi nebo x + yj.",
    a: "Druhá odmocnina komplexního čísla.",
    p: [
      {
        name: "komplexní_číslo",
        detail: "Komplexní číslo, pro které chcete odmocninu.",
      },
    ],
  },
  {
    n: "IMSUB",
    d: "Vrátí rozdíl dvou komplexních čísel v textovém formátu x + yi nebo x + yj.",
    a: "Rozdíl dvou komplexních čísel.",
    p: [
      {
        name: "komplexní_číslo1",
        detail: "Komplexní číslo, od kterého se má odečíst `komplexní_číslo2`.",
      },
      {
        name: "komplexní_číslo2",
        detail: "Komplexní číslo, které se má odečíst od `komplexní_číslo1`.",
      },
    ],
  },
  {
    n: "IMSUM",
    d: "Vrátí součet dvou nebo více komplexních čísel v textovém formátu x + yi nebo x + yj.",
    a: "Součet komplexních čísel.",
    p: [
      {
        name: "komplexní_číslo1",
        detail: "První komplexní číslo, které se má přidat.",
      },
      {
        name: "komplexní_číslo2",
        detail: "Další komplexní čísla k sečtení, celkem až 255.",
      },
    ],
  },
  {
    n: "IMTAN",
    d: "Vrátí tangens komplexního čísla v textovém formátu x + yi nebo x + yj.",
    a: "Tangens komplexního čísla.",
    p: [
      {
        name: "komplexní_číslo",
        detail: "Komplexní číslo, pro které chcete tečnu.",
      },
    ],
  },
  {
    n: "INDEX",
    d: "Vrátí hodnotu prvku v tabulce nebo poli vybraného podle indexů čísel řádků a sloupců.",
    a: "Hodnota na řádku a sloupci rozsahu.",
    p: [
      {
        name: "pole",
        detail: "Rozsah buněk nebo konstanta pole.",
      },
      {
        name: "číslo_řádku",
        detail: "Řádek v `pole`, ze kterého se má vrátit hodnota.",
      },
      {
        name: "číslo_sloupce",
        detail: "Sloupec v `pole`, ze kterého se má vrátit hodnota.",
      },
    ],
  },
  {
    n: "INDIRECT",
    d: "Vrátí odkaz určený textovým řetězcem. Reference jsou okamžitě vyhodnoceny, aby se zobrazil jejich obsah.",
    a: "Odkaz z textového řetězce.",
    p: [
      {
        name: "text_odkazu",
        detail:
          "Odkaz na buňku, která obsahuje odkaz ve stylu A1 nebo R1C1, název definovaný jako odkaz nebo odkaz jako textový řetězec.",
      },
      {
        name: "a1",
        detail:
          "TRUE nebo vynechaný interpretuje `text_odkazu` jako odkaz ve stylu A1; FALSE jako styl R1C1.",
      },
    ],
  },
  {
    n: "INFO",
    d: "Vrátí informace o aktuálním provozním prostředí podle zadaného typu: directory, numfile, origin, osversion, recalc, release, system.",
    a: "Informace o provozním prostředí.",
    p: [
      {
        name: "typ_jako_text",
        detail: "Text určující, jaký typ informací chcete.",
      },
    ],
  },
  {
    n: "INT",
    d: "Zaokrouhlí číslo dolů na nejbližší celé číslo.",
    a: "Zaokrouhlí dolů na nejbližší celé číslo.",
    p: [
      {
        name: "číslo",
        detail: "Reálné číslo, které chcete zaokrouhlit dolů na celé číslo.",
      },
    ],
  },
  {
    n: "INTERCEPT",
    d: "Vypočítá bod, ve kterém přímka protne osu y pomocí existujících hodnot x a y.",
    a: "Průsečík Y regresní přímky.",
    p: [
      {
        name: "známé_y",
        detail: "Závislá sada pozorování nebo dat.",
      },
      {
        name: "známé_x",
        detail: "Nezávislý soubor pozorování nebo dat.",
      },
    ],
  },
  {
    n: "INTRATE",
    d: "Vrátí úrokovou sazbu pro plně investovaný cenný papír.",
    a: "Úroková sazba plně investovaného cenného papíru.",
    p: [
      {
        name: "datum_vypořádání",
        detail: "Datum vypořádání cenného papíru.",
      },
      {
        name: "datum_splatnosti",
        detail: "Datum splatnosti cenného papíru.",
      },
      {
        name: "investice",
        detail: "Částka investovaná do cenného papíru.",
      },
      {
        name: "výkupní_hodnota",
        detail: "Částka, která má být přijata při splatnosti.",
      },
      {
        name: "základna",
        detail:
          "Základ počtu dnů: 0 nebo vynecháno US 30/360, 1 skutečný/skutečný, 2 aktuální/360, 3 aktuální/365, 4 evropské 30/360.",
      },
    ],
  },
  {
    n: "IPMT",
    d: "Vrátí úrokovou platbu za dané období pro investici na základě pravidelných, konstantních plateb a konstantní úrokové sazby.",
    a: "Úroková část platby.",
    p: [
      {
        name: "sazba",
        detail: "Úroková sazba za období.",
      },
      {
        name: "období",
        detail:
          "Období, pro které chcete zjistit úrok, od 1 do `počet_období`.",
      },
      {
        name: "počet_období",
        detail: "Celkový počet platebních období.",
      },
      {
        name: "současná_hodnota",
        detail: "Současná hodnota.",
      },
      {
        name: "budoucí_hodnota",
        detail:
          "Budoucí hodnota nebo zůstatek v hotovosti, který chcete po poslední platbě; výchozí je 0.",
      },
      {
        name: "typ",
        detail:
          "Při splatnosti: 0 nebo vynechání na konci období, 1 na začátku.",
      },
    ],
  },
  {
    n: "IRR",
    d: "Vrací vnitřní míru návratnosti pro řadu peněžních toků reprezentovaných čísly v hodnotách.",
    a: "Vnitřní míra návratnosti.",
    p: [
      {
        name: "hodnoty",
        detail:
          "Pole nebo reference obsahující alespoň jeden kladný a jeden záporný peněžní tok.",
      },
      {
        name: "odhad",
        detail:
          "Číslo, které uhodnete, se blíží výsledku; výchozí hodnota je 0,1 (10 procent).",
      },
    ],
  },
  {
    n: "ISBLANK",
    d: "Vrátí TRUE, pokud hodnota odkazuje na prázdnou buňku.",
    a: "Zkontroluje, zda je buňka prázdná.",
    p: [
      {
        name: "hodnota",
        detail: "Hodnota, kterou chcete testovat.",
      },
    ],
  },
  {
    n: "ISERR",
    d: "Vrátí TRUE, pokud hodnota odkazuje na jakoukoli chybovou hodnotu kromě #N/A.",
    a: "Zkontroluje jinou chybu než #N/A.",
    p: [
      {
        name: "hodnota",
        detail: "Hodnota, kterou chcete testovat.",
      },
    ],
  },
  {
    n: "ISERROR",
    d: "Vrátí TRUE, pokud hodnota odkazuje na libovolnou chybu (#N/A, #VALUE!, #REF!, #DIV/0!, #NUM!, #NAME? nebo #NULL!).",
    a: "Zkontroluje případné chyby.",
    p: [
      {
        name: "hodnota",
        detail: "Hodnota, kterou chcete testovat.",
      },
    ],
  },
  {
    n: "ISEVEN",
    d: "Vrátí TRUE, pokud je číslo sudé, nebo FALSE, pokud je číslo liché.",
    a: "Zkontroluje, zda je číslo sudé.",
    p: [
      {
        name: "číslo",
        detail: "Hodnota k testování; desetinná místa jsou zkrácena.",
      },
    ],
  },
  {
    n: "ISFORMULA",
    d: "Zkontroluje, zda existuje odkaz na buňku, která obsahuje vzorec, a vrátí TRUE nebo FALSE.",
    a: "Zkontroluje, zda buňka obsahuje vzorec.",
    p: [
      {
        name: "odkaz",
        detail: "Odkaz na buňku, kterou chcete testovat.",
      },
    ],
  },
  {
    n: "ISLOGICAL",
    d: "Vrátí TRUE, pokud hodnota odkazuje na logickou hodnotu.",
    a: "Zkontroluje logickou hodnotu.",
    p: [
      {
        name: "hodnota",
        detail: "Hodnota, kterou chcete testovat.",
      },
    ],
  },
  {
    n: "ISNA",
    d: "Vrátí TRUE, pokud hodnota odkazuje na chybovou hodnotu #N/A (hodnota není k dispozici).",
    a: "Kontroly na #N/A.",
    p: [
      {
        name: "hodnota",
        detail: "Hodnota, kterou chcete testovat.",
      },
    ],
  },
  {
    n: "ISNONTEXT",
    d: "Vrátí TRUE, pokud hodnota odkazuje na jakoukoli položku, která není textem, včetně prázdné buňky.",
    a: "Zkontroluje netextovou hodnotu.",
    p: [
      {
        name: "hodnota",
        detail: "Hodnota, kterou chcete testovat.",
      },
    ],
  },
  {
    n: "ISNUMBER",
    d: "Vrátí TRUE, pokud hodnota odkazuje na číslo.",
    a: "Zkontroluje číslo.",
    p: [
      {
        name: "hodnota",
        detail: "Hodnota, kterou chcete testovat.",
      },
    ],
  },
  {
    n: "ISO.CEILING",
    d: "Zaokrouhlí číslo nahoru na nejbližší celé číslo nebo na nejbližší násobek významnosti, bez ohledu na znaménko čísla.",
    a: "Zaokrouhluje nahoru bez ohledu na znaménko (ISO).",
    p: [
      {
        name: "číslo",
        detail: "Hodnota, která se má zaokrouhlit.",
      },
      {
        name: "násobek",
        detail: "Násobek, na který je číslo zaokrouhleno; výchozí je 1.",
      },
    ],
  },
  {
    n: "ISODD",
    d: "Vrátí TRUE, pokud je číslo liché, nebo FALSE, pokud je číslo sudé.",
    a: "Zkontroluje, zda je číslo liché.",
    p: [
      {
        name: "číslo",
        detail: "Hodnota k testování; desetinná místa jsou zkrácena.",
      },
    ],
  },
  {
    n: "ISOMITTED",
    d: "Zkontroluje, zda chybí hodnota v LAMBDA a vrátí TRUE nebo FALSE.",
    a: "Zkontroluje chybějící argument LAMBDA.",
    p: [
      {
        name: "argument",
        detail: "Parametr LAMBDA, který chcete otestovat.",
      },
    ],
  },
  {
    n: "ISOWEEKNUM",
    d: "Vrátí ISO číslo týdne v roce pro dané datum.",
    a: "Číslo týdne ISO.",
    p: [
      {
        name: "datum",
        detail: "Kód datum-čas používaný pro výpočet data a času.",
      },
    ],
  },
  {
    n: "ISPMT",
    d: "Vypočítá zaplacený nebo přijatý úrok za zadané období půjčky nebo investice s rovnoměrnými splátkami jistiny.",
    a: "Úrok při rovnoměrných splátkách jistiny.",
    p: [
      {
        name: "sazba",
        detail: "Úroková sazba pro investici.",
      },
      {
        name: "období",
        detail:
          "Období, pro které chcete zjistit úrok, mezi 1 a `počet_období`.",
      },
      {
        name: "počet_období",
        detail: "Celkový počet platebních období pro investici.",
      },
      {
        name: "současná_hodnota",
        detail: "Současná hodnota investice; u úvěru výše úvěru.",
      },
    ],
  },
  {
    n: "ISREF",
    d: "Vrátí TRUE, pokud hodnota odkazuje na odkaz.",
    a: "Kontroluje odkaz.",
    p: [
      {
        name: "hodnota",
        detail: "Hodnota, kterou chcete testovat.",
      },
    ],
  },
  {
    n: "ISTEXT",
    d: "Vrátí TRUE, pokud hodnota odkazuje na text.",
    a: "Kontroluje text.",
    p: [
      {
        name: "hodnota",
        detail: "Hodnota, kterou chcete testovat.",
      },
    ],
  },
  {
    n: "JIS",
    d: "Změní znaky s poloviční šířkou (jednobajtové) na znaky s plnou šířkou (dvoubajtové).",
    a: "Převést na znaky s plnou šířkou.",
    p: [
      {
        name: "text",
        detail:
          "Text nebo odkaz na buňku, která obsahuje text, který se má změnit.",
      },
    ],
  },
  {
    n: "KURT",
    d: "Vrátí špičatost souboru dat, která charakterizuje relativní špičku nebo plochost rozdělení.",
    a: "Kurtóza souboru dat.",
    p: [
      {
        name: "číslo1",
        detail: "První číslo nebo rozsah.",
      },
      {
        name: "číslo2",
        detail: "Další čísla nebo rozsahy, celkem až 255.",
      },
    ],
  },
  {
    n: "LAMBDA",
    d: "Vytvoří vlastní, opakovaně použitelnou funkci, kterou lze volat s popisným názvem nebo ji vyvolat přímo s argumenty.",
    a: "Vytvoří uživatelskou funkci.",
    p: [
      {
        name: "parametr",
        detail:
          "Název hodnoty, která má být předána funkci, jako je odkaz na buňku, řetězec nebo číslo. Až 253 parametrů.",
      },
      {
        name: "výpočet",
        detail:
          "Vzorec, který se má provést a vrátit jako výsledek funkce; to musí být poslední argument.",
      },
    ],
  },
  {
    n: "LARGE",
    d: "Vrátí k-tou největší hodnotu v sadě dat.",
    a: "K-tá největší hodnota.",
    p: [
      {
        name: "pole",
        detail:
          "Pole nebo rozsah dat, pro které chcete určit k-tou největší hodnotu.",
      },
      {
        name: "k",
        detail:
          "Pozice (od největší) v poli nebo rozsahu buněk dat, která se mají vrátit.",
      },
    ],
  },
  {
    n: "LCM",
    d: "Vrátí nejmenší společný násobek celých čísel.",
    a: "Nejmenší společný násobek.",
    p: [
      {
        name: "číslo1",
        detail: "první hodnota nebo rozsah; desetinná místa jsou zkrácena.",
      },
      {
        name: "číslo2",
        detail: "Další hodnoty nebo rozsahy, celkem až 255.",
      },
    ],
  },
  {
    n: "LEFT",
    d: "Vrátí první znak nebo znaky v textovém řetězci na základě zadaného počtu znaků.",
    a: "Znaky textu zcela vlevo.",
    p: [
      {
        name: "text",
        detail: "Textový řetězec obsahující znaky, které chcete extrahovat.",
      },
      {
        name: "počet_znaků",
        detail: "Počet znaků, které má LEFT extrahovat; výchozí je 1.",
      },
    ],
  },
  {
    n: "LEFTB",
    d: "Vrátí první znaky textového řetězce na základě počtu bajtů.",
    a: "Znaky zcela vlevo (bajty).",
    p: [
      {
        name: "text",
        detail: "Textový řetězec obsahující znaky, které chcete extrahovat.",
      },
      {
        name: "počet_bajtů",
        detail: "Počet bajtů k extrahování; výchozí 1.",
      },
    ],
  },
  {
    n: "LEN",
    d: "Vrátí počet znaků v textovém řetězci.",
    a: "Délka textu.",
    p: [
      {
        name: "text",
        detail:
          "Text, jehož délku chcete najít. Mezery se počítají jako znaky.",
      },
    ],
  },
  {
    n: "LENB",
    d: "Vrátí počet bajtů použitých k reprezentaci znaků v textovém řetězci.",
    a: "Délka textu (bajty).",
    p: [
      {
        name: "text",
        detail: "Text, jehož délku chcete najít.",
      },
    ],
  },
  {
    n: "LET",
    d: "Přiřazuje názvy výsledkům výpočtů, což umožňuje mezivýpočty, hodnoty nebo názvy ukládat do vzorce.",
    a: "Pojmenuje hodnoty uvnitř vzorce.",
    p: [
      {
        name: "název1",
        detail: "První jméno k přiřazení; musí začínat písmenem.",
      },
      {
        name: "hodnota_názvu1",
        detail: "Hodnota přiřazená k `název1`.",
      },
      {
        name: "výpočet_nebo_název2",
        detail:
          "Buď výpočet, který používá všechna jména v rámci funkce LET (musí to být poslední argument), nebo druhé jméno k přiřazení.",
      },
      {
        name: "hodnota_názvu2",
        detail: "Hodnota, která je přiřazena k `výpočet_nebo_název2`.",
      },
      {
        name: "výpočet_nebo_název3",
        detail:
          "Buď výpočet, který používá všechna jména, nebo další název k přiřazení.",
      },
    ],
  },
  {
    n: "LINEST",
    d: "Vypočítá statistiku pro čáru pomocí metody nejmenších čtverců k výpočtu přímky, která nejlépe odpovídá vašim datům, a vrátí pole, které čáru popisuje.",
    a: "Statistika lineární regrese.",
    p: [
      {
        name: "známé_y",
        detail: "Množina y-ových hodnot, které již znáte ve vztahu y = mx + b.",
      },
      {
        name: "známé_x",
        detail: "Volitelná sada x-hodnot, které již možná znáte.",
      },
      {
        name: "konst",
        detail:
          "TRUE nebo vynecháno vypočítá b normálně; FALSE vynutí b rovno 0.",
      },
      {
        name: "statistiky",
        detail:
          "TRUE vrátí další regresní statistiky; FALSE nebo vynechaný vrátí pouze mab.",
      },
    ],
  },
  {
    n: "LN",
    d: "Vrátí přirozený logaritmus čísla.",
    a: "Přirozený logaritmus.",
    p: [
      {
        name: "číslo",
        detail: "Kladné reálné číslo, pro které chcete přirozený logaritmus.",
      },
    ],
  },
  {
    n: "LOG",
    d: "Vrátí logaritmus čísla na zadaný základ.",
    a: "Logaritmus k dané bázi.",
    p: [
      {
        name: "číslo",
        detail: "Kladné reálné číslo, pro které chcete logaritmus.",
      },
      {
        name: "základ",
        detail: "Základ logaritmu; výchozí hodnota je 10.",
      },
    ],
  },
  {
    n: "LOG10",
    d: "Vrátí logaritmus čísla se základem 10.",
    a: "Logaritmus základu-10.",
    p: [
      {
        name: "číslo",
        detail:
          "Kladné reálné číslo, pro které chcete logaritmus se základem 10.",
      },
    ],
  },
  {
    n: "LOGEST",
    d: "Vypočítá exponenciální křivku, která odpovídá vašim datům, a vrátí pole hodnot, které křivku popisují.",
    a: "Statistika exponenciální regrese.",
    p: [
      {
        name: "známé_y",
        detail: "Množina y-ových hodnot, které již znáte ve vztahu y = b*m^x.",
      },
      {
        name: "známé_x",
        detail: "Volitelná sada x-hodnot, které již možná znáte.",
      },
      {
        name: "konst",
        detail:
          "TRUE nebo vynecháno vypočítá b normálně; FALSE vynutí b rovno 1.",
      },
      {
        name: "statistiky",
        detail:
          "TRUE vrátí další regresní statistiky; FALSE nebo vynechaný vrátí pouze mab.",
      },
    ],
  },
  {
    n: "LOGINV",
    d: "Vrátí inverzní hodnotu funkce lognormálního kumulativního rozdělení. Zachováno pro kompatibilitu; viz LOGNORM.INV.",
    a: "Inverzní lognormální rozdělení (starší).",
    p: [
      {
        name: "pravděpodobnost",
        detail: "Pravděpodobnost spojená s lognormálním rozdělením.",
      },
      {
        name: "průměr",
        detail: "Průměr ln(x).",
      },
      {
        name: "směrodatná_odchylka",
        detail: "Směrodatná odchylka ln(x).",
      },
    ],
  },
  {
    n: "LOGNORM.DIST",
    d: "Vrátí lognormální rozdělení x, kde ln(x) je normálně rozděleno s parametry střední a směrodatná_odchylka.",
    a: "Lognormální rozdělení.",
    p: [
      {
        name: "x",
        detail: "Hodnota, při které se má funkce vyhodnotit.",
      },
      {
        name: "průměr",
        detail: "Průměr ln(x).",
      },
      {
        name: "směrodatná_odchylka",
        detail: "Směrodatná odchylka ln(x).",
      },
      {
        name: "kumulativní",
        detail:
          "TRUE vrací funkci kumulativního rozdělení, FALSE funkci hustoty pravděpodobnosti.",
      },
    ],
  },
  {
    n: "LOGNORM.INV",
    d: "Vrátí inverzní hodnotu funkce lognormálního kumulativního rozdělení x.",
    a: "Inverzní lognormální rozdělení.",
    p: [
      {
        name: "pravděpodobnost",
        detail: "Pravděpodobnost spojená s lognormálním rozdělením.",
      },
      {
        name: "průměr",
        detail: "Průměr ln(x).",
      },
      {
        name: "směrodatná_odchylka",
        detail: "Směrodatná odchylka ln(x).",
      },
    ],
  },
  {
    n: "LOGNORMDIST",
    d: "Vrátí kumulativní lognormální rozdělení. Zachováno pro kompatibilitu; viz LOGNORM.DIST.",
    a: "Kumulativní lognormální rozdělení (kompatibilita).",
    p: [
      {
        name: "x",
        detail: "Hodnota, při které se má funkce vyhodnotit.",
      },
      {
        name: "průměr",
        detail: "Průměr ln(x).",
      },
      {
        name: "směrodatná_odchylka",
        detail: "Směrodatná odchylka ln(x).",
      },
    ],
  },
  {
    n: "LOOKUP",
    d: "Vyhledá hodnotu v rozsahu jednoho řádku nebo jednoho sloupce (vektor) a vrátí hodnotu ze stejné pozice v druhém rozsahu.",
    a: "Vyhledá hodnotu ve vektoru.",
    p: [
      {
        name: "hledaná_hodnota",
        detail: "Hodnota, kterou LOOKUP hledá v `vyhledávací_vektor`.",
      },
      {
        name: "vyhledávací_vektor",
        detail:
          "Rozsah, který obsahuje pouze jeden řádek nebo jeden sloupec, seřazený vzestupně.",
      },
      {
        name: "vektor_výsledku",
        detail:
          "Rozsah, který obsahuje pouze jeden řádek nebo sloupec o stejné velikosti jako `vyhledávací_vektor`.",
      },
    ],
  },
  {
    n: "LOWER",
    d: "Převede všechna velká písmena v textovém řetězci na malá písmena.",
    a: "Převede text na malá písmena.",
    p: [
      {
        name: "text",
        detail: "Text, který chcete převést na malá písmena.",
      },
    ],
  },
  {
    n: "MAKEARRAY",
    d: "Vrátí vypočítané pole zadané velikosti řádku a sloupce použitím LAMBDA.",
    a: "Sestaví pole s LAMBDA.",
    p: [
      {
        name: "řádky",
        detail: "Počet řádků v poli; musí být větší než nula.",
      },
      {
        name: "sloupce",
        detail: "Počet sloupců v poli; musí být větší než nula.",
      },
      {
        name: "lambda",
        detail:
          "Volání LAMBDA s indexem řádků a sloupců pro vytvoření každé hodnoty pole.",
      },
    ],
  },
  {
    n: "MAP",
    d: "Vrátí pole vytvořené mapováním každé hodnoty v poli (polích) na novou hodnotu použitím LAMBDA.",
    a: "Transformuje každou hodnotu pomocí LAMBDA.",
    p: [
      {
        name: "pole1",
        detail: "První pole, které má být mapováno.",
      },
      {
        name: "pole2",
        detail: "Další pole k mapování.",
      },
      {
        name: "lambda",
        detail:
          "LAMBDA, což musí být poslední argument, s jedním parametrem pro každé předané pole.",
      },
    ],
  },
  {
    n: "MATCH",
    d: "Vyhledá zadanou položku v rozsahu buněk a vrátí relativní pozici této položky v rozsahu.",
    a: "Pozice hodnoty v rozsahu.",
    p: [
      {
        name: "hledaná_hodnota",
        detail: "Hodnota, kterou chcete porovnat v `vyhledávací_pole`.",
      },
      {
        name: "vyhledávací_pole",
        detail: "Rozsah prohledávaných buněk.",
      },
      {
        name: "typ_shody",
        detail:
          "1 nebo vynecháno najde největší hodnotu menší nebo rovnou `hledaná_hodnota`, 0 přesnou shodu, -1 nejmenší hodnotu větší nebo rovnou této.",
      },
    ],
  },
  {
    n: "MAX",
    d: "Vrátí největší hodnotu v sadě hodnot, ignoruje text a logické hodnoty v rozsazích.",
    a: "Největší hodnota.",
    p: [
      {
        name: "číslo1",
        detail: "První číslo nebo rozsah.",
      },
      {
        name: "číslo2",
        detail: "Další čísla nebo rozsahy, celkem až 255.",
      },
    ],
  },
  {
    n: "MAXA",
    d: "Vrátí největší hodnotu v seznamu argumentů, přičemž text vyhodnotí jako 0 a logické hodnoty jako 1 nebo 0.",
    a: "Největší hodnota včetně textu a logiky.",
    p: [
      {
        name: "hodnota1",
        detail: "První hodnota nebo rozsah.",
      },
      {
        name: "hodnota2",
        detail: "Další hodnoty nebo rozsahy, celkem až 255.",
      },
    ],
  },
  {
    n: "MAXIFS",
    d: "Vrátí maximální hodnotu mezi buňkami určenými danou sadou podmínek nebo kritérií.",
    a: "Největší hodnota, která splňuje kritéria.",
    p: [
      {
        name: "oblast_maxima",
        detail: "Rozsah buněk, ve kterých bude určeno maximum.",
      },
      {
        name: "rozsah_kritérií1",
        detail: "Sada buněk k vyhodnocení pomocí `kritéria1`.",
      },
      {
        name: "kritéria1",
        detail:
          "Kritéria, která definují, které buňky budou vyhodnoceny jako maximální.",
      },
      {
        name: "rozsah_kritérií2",
        detail: "Další rozsahy, až 126 párů rozsah/kritéria.",
      },
      {
        name: "kritéria2",
        detail: "Kritéria pro odpovídající doplňkový rozsah.",
      },
    ],
  },
  {
    n: "MDETERM",
    d: "Vrátí maticový determinant pole.",
    a: "Maticový determinant.",
    p: [
      {
        name: "pole",
        detail: "Číselné pole se stejným počtem řádků a sloupců.",
      },
    ],
  },
  {
    n: "MDURATION",
    d: "Vrátí upravenou Macaulayovu dobu trvání pro cenný papír s předpokládanou nominální hodnotou 100 $.",
    a: "Modifikovaná durace cenného papíru.",
    p: [
      {
        name: "datum_vypořádání",
        detail: "Datum vypořádání cenného papíru.",
      },
      {
        name: "datum_splatnosti",
        detail: "Datum splatnosti cenného papíru.",
      },
      {
        name: "kupon",
        detail: "Roční kupónová sazba cenného papíru.",
      },
      {
        name: "výnos",
        detail: "Roční výnos cenného papíru.",
      },
      {
        name: "frekvence",
        detail:
          "Počet výplat kuponů za rok: 1 roční, 2 pololetní, 4 čtvrtletní.",
      },
      {
        name: "základna",
        detail:
          "Základ počtu dnů: 0 nebo vynecháno US 30/360, 1 skutečný/skutečný, 2 aktuální/360, 3 aktuální/365, 4 evropské 30/360.",
      },
    ],
  },
  {
    n: "MEDIAN",
    d: "Vrátí medián daných čísel, číslo uprostřed množiny čísel.",
    a: "Medián čísel.",
    p: [
      {
        name: "číslo1",
        detail: "První číslo nebo rozsah.",
      },
      {
        name: "číslo2",
        detail: "Další čísla nebo rozsahy, celkem až 255.",
      },
    ],
  },
  {
    n: "MID",
    d: "Vrátí určitý počet znaků z textového řetězce, počínaje pozicí, kterou určíte.",
    a: "Znaky uprostřed textu.",
    p: [
      {
        name: "text",
        detail: "Textový řetězec obsahující znaky, které chcete extrahovat.",
      },
      {
        name: "počáteční_pozice",
        detail:
          "Pozice prvního znaku, který chcete extrahovat; první znak je 1.",
      },
      {
        name: "počet_znaků",
        detail: "Počet znaků, které má MID vrátit.",
      },
    ],
  },
  {
    n: "MIDB",
    d: "Vrátí znaky ze středu textového řetězce zadané počáteční pozicí a počtem bajtů.",
    a: "Střední znaky (bajty).",
    p: [
      {
        name: "text",
        detail: "Textový řetězec obsahující znaky, které chcete extrahovat.",
      },
      {
        name: "počáteční_pozice",
        detail: "Pozice prvního znaku, který se má extrahovat.",
      },
      {
        name: "počet_bajtů",
        detail: "Počet bajtů k extrahování.",
      },
    ],
  },
  {
    n: "MIN",
    d: "Vrátí nejmenší číslo v sadě hodnot, ignoruje text a logické hodnoty v rozsazích.",
    a: "Nejmenší hodnota.",
    p: [
      {
        name: "číslo1",
        detail: "První číslo nebo rozsah.",
      },
      {
        name: "číslo2",
        detail: "Další čísla nebo rozsahy, celkem až 255.",
      },
    ],
  },
  {
    n: "MINA",
    d: "Vrátí nejmenší hodnotu v seznamu argumentů, přičemž text vyhodnotí jako 0 a logické hodnoty jako 1 nebo 0.",
    a: "Nejmenší hodnota včetně textu a logiky.",
    p: [
      {
        name: "hodnota1",
        detail: "První hodnota nebo rozsah.",
      },
      {
        name: "hodnota2",
        detail: "Další hodnoty nebo rozsahy, celkem až 255.",
      },
    ],
  },
  {
    n: "MINIFS",
    d: "Vrátí minimální hodnotu mezi buňkami určenými danou sadou podmínek nebo kritérií.",
    a: "Nejmenší hodnota, která splňuje kritéria.",
    p: [
      {
        name: "oblast_minima",
        detail: "Rozsah buněk, ve kterých bude určeno minimum.",
      },
      {
        name: "rozsah_kritérií1",
        detail: "Sada buněk k vyhodnocení pomocí `kritéria1`.",
      },
      {
        name: "kritéria1",
        detail:
          "Kritéria, která definují, které buňky budou vyhodnoceny jako minimální.",
      },
      {
        name: "rozsah_kritérií2",
        detail: "Další rozsahy, až 126 párů rozsah/kritéria.",
      },
      {
        name: "kritéria2",
        detail: "Kritéria pro odpovídající doplňkový rozsah.",
      },
    ],
  },
  {
    n: "MINUTE",
    d: "Vrátí minuty časové hodnoty jako celé číslo od 0 do 59.",
    a: "Minutová složka času.",
    p: [
      {
        name: "pořadové_číslo",
        detail: "Čas, který obsahuje minutu, kterou chcete najít.",
      },
    ],
  },
  {
    n: "MINVERSE",
    d: "Vrátí inverzní matici pro matici uloženou v poli.",
    a: "Inverzní k matici.",
    p: [
      {
        name: "pole",
        detail: "Číselné pole se stejným počtem řádků a sloupců.",
      },
    ],
  },
  {
    n: "MIRR",
    d: "Vrací upravenou vnitřní míru návratnosti pro řadu periodických peněžních toků, přičemž bere v úvahu jak náklady na investici, tak úroky přijaté z reinvestice hotovosti.",
    a: "Upravená vnitřní míra návratnosti.",
    p: [
      {
        name: "hodnoty",
        detail:
          "Pole nebo reference obsahující alespoň jeden kladný a jeden záporný peněžní tok.",
      },
      {
        name: "sazba_financování",
        detail:
          "Úroková sazba, kterou platíte za peníze použité v peněžních tocích.",
      },
      {
        name: "reinvestiční_sazba",
        detail:
          "Úroková sazba, kterou dostáváte z peněžních toků, když je reinvestujete.",
      },
    ],
  },
  {
    n: "MMULT",
    d: "Vrátí maticový součin dvou polí. Výsledek má tolik řádků jako pole1 a tolik sloupců jako pole2.",
    a: "Maticový součin dvou polí.",
    p: [
      {
        name: "pole1",
        detail:
          "První pole; jeho počet sloupců se musí rovnat počtu řádků `pole2`.",
      },
      {
        name: "pole2",
        detail: "Druhé pole.",
      },
    ],
  },
  {
    n: "MOD",
    d: "Vrátí zbytek po dělení čísla dělitelem. Výsledek má stejné znaménko jako dělitel.",
    a: "Zbytek po dělení.",
    p: [
      {
        name: "číslo",
        detail: "Číslo, pro které chcete zbytek.",
      },
      {
        name: "dělitel",
        detail: "Číslo, kterým chcete vydělit `číslo`.",
      },
    ],
  },
  {
    n: "MODE.MULT",
    d: "Vrátí vertikální pole nejčastěji se vyskytujících nebo opakujících se hodnot v poli nebo rozsahu dat.",
    a: "Všechny nejčastější hodnoty.",
    p: [
      {
        name: "číslo1",
        detail: "První číslo nebo rozsah, pro který chcete vypočítat režim.",
      },
      {
        name: "číslo2",
        detail: "Další čísla nebo rozsahy, celkem až 254.",
      },
    ],
  },
  {
    n: "MODE.SNGL",
    d: "Vrátí nejčastěji se vyskytující nebo opakující se hodnotu v poli nebo rozsahu dat.",
    a: "Nejčastější hodnota.",
    p: [
      {
        name: "číslo1",
        detail: "První číslo nebo rozsah, pro který chcete vypočítat režim.",
      },
      {
        name: "číslo2",
        detail: "Další čísla nebo rozsahy, celkem až 254.",
      },
    ],
  },
  {
    n: "MONTH",
    d: "Vrátí měsíc data reprezentovaný pořadovým číslem jako celé číslo od 1 (leden) do 12 (prosinec).",
    a: "Měsíc data.",
    p: [
      {
        name: "pořadové_číslo",
        detail: "Datum v měsíci, který se snažíte najít.",
      },
    ],
  },
  {
    n: "MROUND",
    d: "Vrátí číslo zaokrouhlené na požadovaný násobek.",
    a: "Zaokrouhlí na nejbližší násobek.",
    p: [
      {
        name: "číslo",
        detail: "Hodnota, která se má zaokrouhlit.",
      },
      {
        name: "násobek",
        detail: "Násobek, na který chcete zaokrouhlit `číslo`.",
      },
    ],
  },
  {
    n: "MULTINOMIAL",
    d: "Vrátí poměr faktoriálu součtu hodnot k součinu jejich faktoriálů.",
    a: "Multinom množiny čísel.",
    p: [
      {
        name: "číslo1",
        detail: "První hodnota nebo rozsah.",
      },
      {
        name: "číslo2",
        detail: "Další hodnoty nebo rozsahy, celkem až 255.",
      },
    ],
  },
  {
    n: "MUNIT",
    d: "Vrátí jednotkovou matici pro zadaný rozměr.",
    a: "Jednotková matice.",
    p: [
      {
        name: "rozměr",
        detail: "Celé číslo větší než nula určující velikost matice.",
      },
    ],
  },
  {
    n: "N",
    d: "Vrátí hodnotu převedenou na číslo: čísla tak, jak jsou, data jako sériová čísla, TRUE jako 1 a cokoliv jiného jako 0.",
    a: "Převede hodnotu na číslo.",
    p: [
      {
        name: "hodnota",
        detail: "Hodnota, kterou chcete převést.",
      },
    ],
  },
  {
    n: "NA",
    d: 'Vrátí chybovou hodnotu #N/A, což znamená "no value is available".',
    a: "Chybová hodnota #N/A.",
    p: [],
  },
  {
    n: "NEGBINOM.DIST",
    d: "Vrátí záporné binomické rozdělení, pravděpodobnost, že před počet_úspěchů-tým úspěchem bude počet_neúspěchů selhání.",
    a: "Negativní binomické rozdělení.",
    p: [
      {
        name: "počet_neúspěchů",
        detail: "Počet selhání.",
      },
      {
        name: "počet_úspěchů",
        detail: "Prahový počet úspěchů.",
      },
      {
        name: "pravděpodobnost_úspěchu",
        detail: "Pravděpodobnost úspěchu.",
      },
      {
        name: "kumulativní",
        detail:
          "TRUE vrací funkci kumulativního rozdělení, FALSE funkci hustoty pravděpodobnosti.",
      },
    ],
  },
  {
    n: "NEGBINOMDIST",
    d: "Vrátí záporné binomické rozdělení. Zachováno pro kompatibilitu; viz NEGBINOM.DIST.",
    a: "Záporné binomické rozdělení (kompatibilita).",
    p: [
      {
        name: "počet_neúspěchů",
        detail: "Počet selhání.",
      },
      {
        name: "počet_úspěchů",
        detail: "Prahový počet úspěchů.",
      },
      {
        name: "pravděpodobnost_úspěchu",
        detail: "Pravděpodobnost úspěchu.",
      },
    ],
  },
  {
    n: "NETWORKDAYS",
    d: "Vrátí počet celých pracovních dnů mezi datum_zahájení a koncové_datum, kromě víkendů a jakýchkoli specifikovaných svátků.",
    a: "Pracovní dny mezi dvěma daty.",
    p: [
      {
        name: "datum_zahájení",
        detail: "Datum, které představuje počáteční datum.",
      },
      {
        name: "koncové_datum",
        detail: "Datum, které představuje datum ukončení.",
      },
      {
        name: "svátky",
        detail:
          "Volitelný rozsah jednoho nebo více dat k vyloučení z pracovního kalendáře.",
      },
    ],
  },
  {
    n: "NETWORKDAYS.INTL",
    d: "Vrátí počet celých pracovních dnů mezi dvěma daty pomocí parametrů k označení, které a kolik dní jsou víkendové dny.",
    a: "Pracovní dny s vlastními víkendy.",
    p: [
      {
        name: "datum_zahájení",
        detail: "Datum zahájení.",
      },
      {
        name: "koncové_datum",
        detail: "Datum ukončení.",
      },
      {
        name: "víkend",
        detail:
          'Víkendové číslo (1 sobota–neděle, 2 neděle–pondělí, ..., pouze neděle 11, ..., pouze 17 sobota) nebo sedmimístný řetězec, například "0000011".',
      },
      {
        name: "svátky",
        detail:
          "Volitelná sada jednoho nebo více dat k vyloučení z pracovního kalendáře.",
      },
    ],
  },
  {
    n: "NOMINAL",
    d: "Vrátí nominální roční úrokovou sazbu danou efektivní sazbou a počtem složených období za rok.",
    a: "Nominální roční úroková sazba.",
    p: [
      {
        name: "efektivní_sazba",
        detail: "Efektivní úroková míra.",
      },
      {
        name: "období_za_rok",
        detail: "Počet složených období za rok.",
      },
    ],
  },
  {
    n: "NORM.DIST",
    d: "Vrátí normální rozdělení pro zadaný průměr a standardní odchylku.",
    a: "Normální rozdělení.",
    p: [
      {
        name: "x",
        detail: "Hodnota, pro kterou chcete rozdělení.",
      },
      {
        name: "průměr",
        detail: "Aritmetický průměr rozdělení.",
      },
      {
        name: "směrodatná_odchylka",
        detail: "Směrodatná odchylka rozdělení.",
      },
      {
        name: "kumulativní",
        detail:
          "TRUE vrací funkci kumulativního rozdělení, FALSE funkci hustoty pravděpodobnosti.",
      },
    ],
  },
  {
    n: "NORM.INV",
    d: "Vrátí převrácenou hodnotu normálního kumulativního rozdělení pro specifikovaný průměr a směrodatnou odchylku.",
    a: "Inverzní normální rozdělení.",
    p: [
      {
        name: "pravděpodobnost",
        detail: "Pravděpodobnost odpovídající normálnímu rozdělení.",
      },
      {
        name: "průměr",
        detail: "Aritmetický průměr rozdělení.",
      },
      {
        name: "směrodatná_odchylka",
        detail: "Směrodatná odchylka rozdělení.",
      },
    ],
  },
  {
    n: "NORM.S.DIST",
    d: "Vrátí standardní normální rozdělení, které má střední hodnotu nula a směrodatnou odchylku jedna.",
    a: "Standardní normální rozdělení.",
    p: [
      {
        name: "z",
        detail: "Hodnota, pro kterou chcete rozdělení.",
      },
      {
        name: "kumulativní",
        detail:
          "TRUE vrací funkci kumulativního rozdělení, FALSE funkci hustoty pravděpodobnosti.",
      },
    ],
  },
  {
    n: "NORM.S.INV",
    d: "Vrátí převrácenou hodnotu standardního normálního kumulativního rozdělení, které má střední hodnotu nula a standardní odchylku jedna.",
    a: "Inverzní standardní normální rozdělení.",
    p: [
      {
        name: "pravděpodobnost",
        detail: "Pravděpodobnost odpovídající normálnímu rozdělení.",
      },
    ],
  },
  {
    n: "NORMDIST",
    d: "Vrátí normální rozdělení pro zadaný průměr a standardní odchylku. Zachováno pro kompatibilitu; viz NORM.DIST.",
    a: "Normální distribuce (starší).",
    p: [
      {
        name: "x",
        detail: "Hodnota, pro kterou chcete rozdělení.",
      },
      {
        name: "průměr",
        detail: "Aritmetický průměr rozdělení.",
      },
      {
        name: "směrodatná_odchylka",
        detail: "Směrodatná odchylka rozdělení.",
      },
      {
        name: "kumulativní",
        detail:
          "TRUE vrací funkci kumulativního rozdělení, FALSE funkci hustoty pravděpodobnosti.",
      },
    ],
  },
  {
    n: "NORMINV",
    d: "Vrátí převrácenou hodnotu normálního kumulativního rozdělení. Zachováno pro kompatibilitu; viz NORM.INV.",
    a: "Inverzní normální rozdělení (starší).",
    p: [
      {
        name: "pravděpodobnost",
        detail: "Pravděpodobnost odpovídající normálnímu rozdělení.",
      },
      {
        name: "průměr",
        detail: "Aritmetický průměr rozdělení.",
      },
      {
        name: "směrodatná_odchylka",
        detail: "Směrodatná odchylka rozdělení.",
      },
    ],
  },
  {
    n: "NORMSDIST",
    d: "Vrátí standardní normální kumulativní distribuční funkci. Zachováno pro kompatibilitu; viz NORM.S.DIST.",
    a: "Standardní normální rozdělení (starší).",
    p: [
      {
        name: "z",
        detail: "Hodnota, pro kterou chcete rozdělení.",
      },
    ],
  },
  {
    n: "NORMSINV",
    d: "Vrátí převrácenou hodnotu standardního normálního kumulativního rozdělení. Zachováno pro kompatibilitu; viz NORM.S.INV.",
    a: "Inverzní standardní normální (starší).",
    p: [
      {
        name: "pravděpodobnost",
        detail: "Pravděpodobnost odpovídající normálnímu rozdělení.",
      },
    ],
  },
  {
    n: "NOT",
    d: "Obrátí hodnotu svého argumentu: FALSE se změní na TRUE a TRUE se změní na FALSE.",
    a: "Obrátí logickou hodnotu.",
    p: [
      {
        name: "logické",
        detail:
          "Hodnota nebo výraz, který lze vyhodnotit jako TRUE nebo FALSE.",
      },
    ],
  },
  {
    n: "NOW",
    d: "Vrací sériové číslo aktuálního data a času. Aktualizuje se při každém výpočtu listu.",
    a: "Aktuální datum a čas.",
    p: [],
  },
  {
    n: "NPER",
    d: "Vrátí počet období pro investici na základě pravidelných, konstantních plateb a konstantní úrokové sazby.",
    a: "Počet platebních období.",
    p: [
      {
        name: "sazba",
        detail: "Úroková sazba za období.",
      },
      {
        name: "splátka",
        detail:
          "Platba provedena v každém období; nemůže se po dobu trvání anuity změnit.",
      },
      {
        name: "současná_hodnota",
        detail:
          "Současná hodnota nebo jednorázová částka, kterou nyní stojí řada budoucích plateb.",
      },
      {
        name: "budoucí_hodnota",
        detail:
          "Budoucí hodnota nebo zůstatek v hotovosti, který chcete po poslední platbě; výchozí je 0.",
      },
      {
        name: "typ",
        detail:
          "Při splatnosti: 0 nebo vynechání na konci období, 1 na začátku.",
      },
    ],
  },
  {
    n: "NPV",
    d: "Vypočítá čistou současnou hodnotu investice pomocí diskontní sazby a řady budoucích plateb (záporné hodnoty) a příjmu (kladné hodnoty).",
    a: "Čistá současná hodnota peněžních toků.",
    p: [
      {
        name: "sazba",
        detail: "Diskontní sazba za délku jednoho období.",
      },
      {
        name: "hodnota1",
        detail:
          "První platba nebo příjem, rovnoměrně rozložený v čase a vyskytující se na konci každého období.",
      },
      {
        name: "hodnota2",
        detail: "Dodatečné platby a příjmy, celkem až 254.",
      },
    ],
  },
  {
    n: "NUMBERVALUE",
    d: "Převede text na číslo způsobem nezávislým na národním prostředí.",
    a: "Převede text na číslo s vlastními oddělovači.",
    p: [
      {
        name: "text",
        detail: "Text, který se má převést na číslo.",
      },
      {
        name: "oddělovač_desetinných_míst",
        detail: "Znak použitý k oddělení celé a zlomkové části výsledku.",
      },
      {
        name: "oddělovač_skupin",
        detail: "Znak používaný k oddělení skupin čísel, jako jsou tisíce.",
      },
    ],
  },
  {
    n: "OCT2BIN",
    d: "Převede osmičkové číslo na binární.",
    a: "Osmičková na binární.",
    p: [
      {
        name: "číslo",
        detail: "Osmičkové číslo, které se má převést; maximálně 10 znaků.",
      },
      {
        name: "počet_míst",
        detail:
          "Počet znaků, které se mají použít; výsledek je doplněn úvodními nulami.",
      },
    ],
  },
  {
    n: "OCT2DEC",
    d: "Převede osmičkové číslo na desítkové.",
    a: "Převod z osmičkové do desítkové soustavy.",
    p: [
      {
        name: "číslo",
        detail:
          "Osmičkové číslo, které se má převést; maximálně 10 osmičkových znaků (30 bitů).",
      },
    ],
  },
  {
    n: "OCT2HEX",
    d: "Převede osmičkové číslo na šestnáctkové.",
    a: "Převod z osmičkové do šestnáctkové soustavy.",
    p: [
      {
        name: "číslo",
        detail:
          "Osmičkové číslo, které se má převést; maximálně 10 osmičkových znaků.",
      },
      {
        name: "počet_míst",
        detail:
          "Počet znaků, které se mají použít; výsledek je doplněn úvodními nulami.",
      },
    ],
  },
  {
    n: "ODD",
    d: "Zaokrouhlí číslo nahoru od nuly na nejbližší liché celé číslo.",
    a: "Zaokrouhlí nahoru na nejbližší liché celé číslo.",
    p: [
      {
        name: "číslo",
        detail: "Hodnota, která se má zaokrouhlit.",
      },
    ],
  },
  {
    n: "ODDFPRICE",
    d: "Vrátí cenu za 100 USD jmenovité hodnoty cenného papíru s nepravidelným prvním obdobím.",
    a: "Cena dluhopisu s nepravidelným prvním obdobím.",
    p: [
      {
        name: "datum_vypořádání",
        detail: "Datum vypořádání cenného papíru.",
      },
      {
        name: "datum_splatnosti",
        detail: "Datum splatnosti cenného papíru.",
      },
      {
        name: "datum_emise",
        detail: "Datum vydání cenného papíru.",
      },
      {
        name: "první_kupón",
        detail: "Datum prvního kuponu cenného papíru.",
      },
      {
        name: "sazba",
        detail: "Úroková sazba cenného papíru.",
      },
      {
        name: "výnos",
        detail: "Roční výnos cenného papíru.",
      },
      {
        name: "výkupní_hodnota",
        detail: "Výkupní hodnota cenného papíru za nominální hodnotu 100 $.",
      },
      {
        name: "frekvence",
        detail: "Kupónové platby za rok: 1 roční, 2 pololetní, 4 čtvrtletní.",
      },
      {
        name: "základna",
        detail:
          "Základ počtu dnů: 0 USA 30/360 (výchozí), 1 skutečný/aktuální, 2 skutečné/360, 3 skutečné/365, 4 evropské 30/360.",
      },
    ],
  },
  {
    n: "ODDFYIELD",
    d: "Vrátí výnos cenného papíru s nepravidelným prvním obdobím.",
    a: "Výnos dluhopisu s nepravidelným prvním obdobím.",
    p: [
      {
        name: "datum_vypořádání",
        detail: "Datum vypořádání cenného papíru.",
      },
      {
        name: "datum_splatnosti",
        detail: "Datum splatnosti cenného papíru.",
      },
      {
        name: "datum_emise",
        detail: "Datum vydání cenného papíru.",
      },
      {
        name: "první_kupón",
        detail: "Datum prvního kuponu cenného papíru.",
      },
      {
        name: "sazba",
        detail: "Úroková sazba cenného papíru.",
      },
      {
        name: "cena",
        detail: "Cena cenného papíru.",
      },
      {
        name: "výkupní_hodnota",
        detail: "Výkupní hodnota cenného papíru za nominální hodnotu 100 $.",
      },
      {
        name: "frekvence",
        detail: "Kupónové platby za rok: 1 roční, 2 pololetní, 4 čtvrtletní.",
      },
      {
        name: "základna",
        detail:
          "Základ počtu dnů: 0 USA 30/360 (výchozí), 1 skutečný/aktuální, 2 skutečné/360, 3 skutečné/365, 4 evropské 30/360.",
      },
    ],
  },
  {
    n: "ODDLPRICE",
    d: "Vrátí cenu za 100 USD jmenovité hodnoty cenného papíru s nepravidelným posledním obdobím.",
    a: "Cena dluhopisu s nepravidelným posledním obdobím.",
    p: [
      {
        name: "datum_vypořádání",
        detail: "Datum vypořádání cenného papíru.",
      },
      {
        name: "datum_splatnosti",
        detail: "Datum splatnosti cenného papíru.",
      },
      {
        name: "poslední_úrok",
        detail: "Datum posledního kupónu cenného papíru.",
      },
      {
        name: "sazba",
        detail: "Úroková sazba cenného papíru.",
      },
      {
        name: "výnos",
        detail: "Roční výnos cenného papíru.",
      },
      {
        name: "výkupní_hodnota",
        detail: "Výkupní hodnota cenného papíru za nominální hodnotu 100 $.",
      },
      {
        name: "frekvence",
        detail: "Kupónové platby za rok: 1 roční, 2 pololetní, 4 čtvrtletní.",
      },
      {
        name: "základna",
        detail:
          "Základ počtu dnů: 0 USA 30/360 (výchozí), 1 skutečný/aktuální, 2 skutečné/360, 3 skutečné/365, 4 evropské 30/360.",
      },
    ],
  },
  {
    n: "ODDLYIELD",
    d: "Vrátí výnos cenného papíru s nepravidelným posledním obdobím.",
    a: "Výnos dluhopisu s nepravidelným posledním obdobím.",
    p: [
      {
        name: "datum_vypořádání",
        detail: "Datum vypořádání cenného papíru.",
      },
      {
        name: "datum_splatnosti",
        detail: "Datum splatnosti cenného papíru.",
      },
      {
        name: "poslední_úrok",
        detail: "Datum posledního kupónu cenného papíru.",
      },
      {
        name: "sazba",
        detail: "Úroková sazba cenného papíru.",
      },
      {
        name: "cena",
        detail: "Cena cenného papíru.",
      },
      {
        name: "výkupní_hodnota",
        detail: "Výkupní hodnota cenného papíru za nominální hodnotu 100 $.",
      },
      {
        name: "frekvence",
        detail: "Kupónové platby za rok: 1 roční, 2 pololetní, 4 čtvrtletní.",
      },
      {
        name: "základna",
        detail:
          "Základ počtu dnů: 0 USA 30/360 (výchozí), 1 skutečný/aktuální, 2 skutečné/360, 3 skutečné/365, 4 evropské 30/360.",
      },
    ],
  },
  {
    n: "OFFSET",
    d: "Vrátí odkaz na rozsah, který je zadaným počtem řádků a sloupců z buňky nebo rozsahu buněk.",
    a: "Referenční offset od počátečního bodu.",
    p: [
      {
        name: "odkaz",
        detail: "Reference, ze které chcete založit offset.",
      },
      {
        name: "řádky",
        detail:
          "Počet řádků, nahoru nebo dolů, na které má odkazovat levá horní buňka.",
      },
      {
        name: "sloupce",
        detail:
          "Počet sloupců vlevo nebo vpravo, na které má odkazovat levá horní buňka.",
      },
      {
        name: "výška",
        detail:
          "Výška, v počtu řádků, vrácené reference; výchozí je výška `odkaz`.",
      },
      {
        name: "šířka",
        detail:
          "Šířka, v počtu sloupců, vrácené reference; výchozí je šířka `odkaz`.",
      },
    ],
  },
  {
    n: "OR",
    d: "Vrátí TRUE, pokud je některý argument TRUE, a FALSE, pokud jsou všechny argumenty FALSE.",
    a: "TRUE, pokud je nějaký argument TRUE.",
    p: [
      {
        name: "logický1",
        detail:
          "První podmínka k testování, která může být vyhodnocena jako TRUE nebo FALSE.",
      },
      {
        name: "logický2",
        detail: "Další podmínky k testování, celkem až 255.",
      },
    ],
  },
  {
    n: "PDURATION",
    d: "Vrátí počet období požadovaných investicí k dosažení zadané hodnoty.",
    a: "Období potřebná k dosažení hodnoty.",
    p: [
      {
        name: "sazba",
        detail: "Úroková sazba za období.",
      },
      {
        name: "současná_hodnota",
        detail: "Současná hodnota investice.",
      },
      {
        name: "budoucí_hodnota",
        detail: "Požadovaná budoucí hodnota investice.",
      },
    ],
  },
  {
    n: "PEARSON",
    d: "Vrátí Pearsonův součinový momentový korelační koeficient, r.",
    a: "Pearsonův korelační koeficient.",
    p: [
      {
        name: "pole1",
        detail: "Sada nezávislých hodnot.",
      },
      {
        name: "pole2",
        detail: "Sada závislých hodnot.",
      },
    ],
  },
  {
    n: "PERCENTILE.EXC",
    d: "Vrátí k-tý percentil hodnot v rozsahu, kde k je v rozsahu 0 až 1, s výjimkou.",
    a: "K-tý percentil, exkluzivní.",
    p: [
      {
        name: "pole",
        detail: "Pole nebo rozsah dat, které definují relativní postavení.",
      },
      {
        name: "k",
        detail: "Hodnota percentilu bez 0 a 1.",
      },
    ],
  },
  {
    n: "PERCENTILE.INC",
    d: "Vrátí k-tý percentil hodnot v rozsahu, kde k je v rozsahu 0 až 1 včetně.",
    a: "K-tý percentil včetně.",
    p: [
      {
        name: "pole",
        detail: "Pole nebo rozsah dat, které definují relativní postavení.",
      },
      {
        name: "k",
        detail: "Hodnota percentilu v rozsahu 0 až 1 včetně.",
      },
    ],
  },
  {
    n: "PERCENTOF",
    d: "Vrátí procento, které podmnožina dat tvoří všechna data, tj. SUM(datová_podmnožina)/SUM(všechna_data).",
    a: "Podmnožina jako procento z celku.",
    p: [
      {
        name: "datová_podmnožina",
        detail: "Hodnoty, které jsou součástí podmnožiny.",
      },
      {
        name: "všechna_data",
        detail: "Hodnoty, které tvoří celý soubor.",
      },
    ],
  },
  {
    n: "PERCENTRANK",
    d: "Vrátí pořadí hodnoty v datové sadě jako procento (0..1 včetně) datové sady.",
    a: "Procentní pořadí (kompatibilita).",
    p: [
      {
        name: "pole",
        detail: "Pole nebo rozsah číselných hodnot.",
      },
      {
        name: "x",
        detail: "Hodnota, jejíž hodnocení chcete.",
      },
      {
        name: "platné_číslice",
        detail: "Počet platných číslic; výchozí 3.",
      },
    ],
  },
  {
    n: "PERCENTRANK.EXC",
    d: "Vrátí pořadí hodnoty v datové sadě jako procento (0 až 1, bez) datové sady.",
    a: "Procentní pořadí, exkluzivní.",
    p: [
      {
        name: "pole",
        detail:
          "Pole nebo rozsah dat s číselnými hodnotami, které definují relativní postavení.",
      },
      {
        name: "x",
        detail: "Hodnota, pro kterou chcete znát pořadí.",
      },
      {
        name: "platné_číslice",
        detail:
          "Počet platných číslic pro vrácenou procentuální hodnotu; výchozí je 3.",
      },
    ],
  },
  {
    n: "PERCENTRANK.INC",
    d: "Vrátí pořadí hodnoty v sadě dat jako procento (0 až 1 včetně) sady dat.",
    a: "Procentuální pořadí včetně.",
    p: [
      {
        name: "pole",
        detail:
          "Pole nebo rozsah dat s číselnými hodnotami, které definují relativní postavení.",
      },
      {
        name: "x",
        detail: "Hodnota, pro kterou chcete znát pořadí.",
      },
      {
        name: "platné_číslice",
        detail:
          "Počet platných číslic pro vrácenou procentuální hodnotu; výchozí je 3.",
      },
    ],
  },
  {
    n: "PERMUT",
    d: "Vrátí počet permutací pro daný počet objektů, které lze vybrat z číselných objektů.",
    a: "Počet permutací.",
    p: [
      {
        name: "číslo",
        detail: "Celé číslo, které popisuje počet objektů.",
      },
      {
        name: "počet_vybraných",
        detail: "Celé číslo, které popisuje počet objektů v každé permutaci.",
      },
    ],
  },
  {
    n: "PERMUTATIONA",
    d: "Vrátí počet permutací pro daný počet objektů (s opakováním), které lze vybrat z celkového počtu objektů.",
    a: "Počet permutací s opakováním.",
    p: [
      {
        name: "číslo",
        detail: "Celé číslo, které popisuje celkový počet objektů.",
      },
      {
        name: "počet_vybraných",
        detail: "Celé číslo, které popisuje počet objektů v každé permutaci.",
      },
    ],
  },
  {
    n: "PHI",
    d: "Vrátí hodnotu funkce hustoty pro standardní normální rozdělení.",
    a: "Standardní normální hustota.",
    p: [
      {
        name: "x",
        detail:
          "Číslo, pro které chcete hustotu standardního normálního rozdělení.",
      },
    ],
  },
  {
    n: "PHONETIC",
    d: "Extrahuje fonetické (furigana) znaky z textového řetězce; vrátí samotný text, když žádný nemá.",
    a: "Fonetické znaky textu.",
    p: [
      {
        name: "odkaz",
        detail: "Textový řetězec nebo odkaz na buňku.",
      },
    ],
  },
  {
    n: "PI",
    d: "Vrátí číslo 3,14159265358979, matematickou konstantu pí, s přesností na 15 číslic.",
    a: "Hodnota pí.",
    p: [],
  },
  {
    n: "PIVOTBY",
    d: "Shrnuje data podle řádkových a sloupcových polí, agreguje hodnoty každého průsečíku, s volitelnými záhlavími, součty, řazením a filtrováním.",
    a: "Křížová tabulka a agregace.",
    p: [
      {
        name: "řádková_pole",
        detail:
          "Hodnoty orientované na sloupce, které se stanou záhlavími řádků.",
      },
      {
        name: "pole_sloupců",
        detail:
          "Hodnoty orientované na sloupce, které se stanou záhlavími sloupců.",
      },
      {
        name: "hodnoty",
        detail: "Sloupcově orientované hodnoty k agregaci.",
      },
      {
        name: "funkce",
        detail:
          "LAMBDA nebo název funkce (SUM, AVERAGE, COUNT, PERCENTOF, ...), který agreguje každou buňku.",
      },
      {
        name: "záhlaví_polí",
        detail:
          "Zda mají data záhlaví a zda je zobrazit: 0 ne, 1 ano, ale skrýt, 2 ne, ale vygenerovat, 3 ano a zobrazit.",
      },
      {
        name: "úroveň_součtů_řádků",
        detail:
          "Řádkové součty: 0 žádný, 1 celkový součet (výchozí), 2 s mezisoučty; negativní je staví na první místo.",
      },
      {
        name: "pořadí_řazení_řádků",
        detail: "Číslo(a) sloupce pro seřazení řádků, záporné pro sestupné.",
      },
      {
        name: "úroveň_součtů_sloupců",
        detail:
          "Sloupcové součty: 0 žádný, 1 celkový součet (výchozí), 2 s mezisoučty; negativní je staví na první místo.",
      },
      {
        name: "pořadí_řazení_sloupců",
        detail: "Číslo(a) sloupců pro seřazení sloupců, záporné pro sestupné.",
      },
      {
        name: "pole_filtrů",
        detail: "Booleovský výběr, které řádky se mají zahrnout.",
      },
      {
        name: "vzhledem_k",
        detail:
          "Pro funkce se dvěma argumenty, jako je PERCENTOF: 0 sloupcové součty, 1 řádek součty, 2 celkový součet, 3 nadřazený sloupec, 4 nadřazený řádek.",
      },
    ],
  },
  {
    n: "PMT",
    d: "Vypočítá platbu za půjčku na základě konstantních plateb a konstantní úrokové sazby.",
    a: "Pravidelná splátka půjčky.",
    p: [
      {
        name: "sazba",
        detail: "Úroková sazba za půjčku.",
      },
      {
        name: "počet_období",
        detail: "Celkový počet plateb za půjčku.",
      },
      {
        name: "současná_hodnota",
        detail:
          "Současná hodnota nebo celková částka, kterou nyní stojí řada budoucích plateb (jistina).",
      },
      {
        name: "budoucí_hodnota",
        detail:
          "Budoucí hodnota nebo zůstatek v hotovosti, který chcete po poslední platbě; výchozí je 0.",
      },
      {
        name: "typ",
        detail:
          "Při splatnosti: 0 nebo vynechání na konci období, 1 na začátku.",
      },
    ],
  },
  {
    n: "POISSON",
    d: "Vrátí Poissonovo rozdělení.",
    a: "Poissonovo rozdělení (kompatibilita).",
    p: [
      {
        name: "x",
        detail: "Počet událostí.",
      },
      {
        name: "průměr",
        detail: "Očekávaná číselná hodnota.",
      },
      {
        name: "kumulativní",
        detail:
          "TRUE pro kumulativní pravděpodobnost, FALSE pro hmotnost pravděpodobnosti.",
      },
    ],
  },
  {
    n: "POISSON.DIST",
    d: "Vrací Poissonovo rozdělení, které se běžně používá k předpovědi počtu událostí za určitý čas.",
    a: "Poissonovo rozdělení.",
    p: [
      {
        name: "x",
        detail: "Počet událostí.",
      },
      {
        name: "průměr",
        detail: "Očekávaná číselná hodnota.",
      },
      {
        name: "kumulativní",
        detail:
          "TRUE vrací kumulativní pravděpodobnost, FALSE funkci hmotnosti pravděpodobnosti.",
      },
    ],
  },
  {
    n: "POWER",
    d: "Vrátí výsledek čísla umocněného na mocninu.",
    a: "Číslo umocněné.",
    p: [
      {
        name: "číslo",
        detail: "Základní číslo; jakékoliv reálné číslo.",
      },
      {
        name: "exponent",
        detail: "Exponent, na který je základní číslo zvýšeno.",
      },
    ],
  },
  {
    n: "PPMT",
    d: "Vrátí platbu jistiny za dané období pro investici na základě pravidelných, konstantních plateb a konstantní úrokové sazby.",
    a: "Část splátky připadající na jistinu.",
    p: [
      {
        name: "sazba",
        detail: "Úroková sazba za období.",
      },
      {
        name: "období",
        detail: "Období od 1 do `počet_období`.",
      },
      {
        name: "počet_období",
        detail: "Celkový počet platebních období.",
      },
      {
        name: "současná_hodnota",
        detail:
          "Současná hodnota, celková částka, kterou nyní stojí řada budoucích plateb.",
      },
      {
        name: "budoucí_hodnota",
        detail:
          "Budoucí hodnota nebo zůstatek v hotovosti, který chcete po poslední platbě; výchozí je 0.",
      },
      {
        name: "typ",
        detail:
          "Při splatnosti: 0 nebo vynechání na konci období, 1 na začátku.",
      },
    ],
  },
  {
    n: "PRICE",
    d: "Vrátí cenu za 100 USD nominální hodnoty cenného papíru, který platí periodický úrok.",
    a: "Cena cenného papíru s periodickým úrokem.",
    p: [
      {
        name: "datum_vypořádání",
        detail: "Datum vypořádání cenného papíru.",
      },
      {
        name: "datum_splatnosti",
        detail: "Datum splatnosti cenného papíru.",
      },
      {
        name: "sazba",
        detail: "Roční kupónová sazba cenného papíru.",
      },
      {
        name: "výnos",
        detail: "Roční výnos cenného papíru.",
      },
      {
        name: "výkupní_hodnota",
        detail: "Výkupní hodnota cenného papíru za nominální hodnotu 100 $.",
      },
      {
        name: "frekvence",
        detail:
          "Počet výplat kuponů za rok: 1 roční, 2 pololetní, 4 čtvrtletní.",
      },
      {
        name: "základna",
        detail:
          "Základ počtu dnů: 0 nebo vynecháno US 30/360, 1 skutečný/skutečný, 2 aktuální/360, 3 aktuální/365, 4 evropské 30/360.",
      },
    ],
  },
  {
    n: "PRICEDISC",
    d: "Vrátí cenu za nominální hodnotu 100 $ diskontovaného cenného papíru.",
    a: "Cena zlevněného cenného papíru.",
    p: [
      {
        name: "datum_vypořádání",
        detail: "Datum vypořádání cenného papíru.",
      },
      {
        name: "datum_splatnosti",
        detail: "Datum splatnosti cenného papíru.",
      },
      {
        name: "diskontní_sazba",
        detail: "Diskontní sazba cenného papíru.",
      },
      {
        name: "výkupní_hodnota",
        detail: "Výkupní hodnota cenného papíru za nominální hodnotu 100 $.",
      },
      {
        name: "základna",
        detail:
          "Základ počtu dnů: 0 nebo vynecháno US 30/360, 1 skutečný/skutečný, 2 aktuální/360, 3 aktuální/365, 4 evropské 30/360.",
      },
    ],
  },
  {
    n: "PRICEMAT",
    d: "Vrátí cenu za 100 USD nominální hodnoty cenného papíru, který platí úrok při splatnosti.",
    a: "Cena cenného papíru vypláceného při splatnosti.",
    p: [
      {
        name: "datum_vypořádání",
        detail: "Datum vypořádání cenného papíru.",
      },
      {
        name: "datum_splatnosti",
        detail: "Datum splatnosti cenného papíru.",
      },
      {
        name: "datum_emise",
        detail: "Datum vydání cenného papíru.",
      },
      {
        name: "sazba",
        detail: "Úroková sazba cenného papíru k datu emise.",
      },
      {
        name: "výnos",
        detail: "Roční výnos cenného papíru.",
      },
      {
        name: "základna",
        detail:
          "Základ počtu dnů: 0 nebo vynecháno US 30/360, 1 skutečný/skutečný, 2 aktuální/360, 3 aktuální/365, 4 evropské 30/360.",
      },
    ],
  },
  {
    n: "PROB",
    d: "Vrátí pravděpodobnost, že hodnoty v rozsahu jsou mezi dvěma limity nebo se rovnají spodnímu limitu, když je horní limit vynechán.",
    a: "Pravděpodobnost, že hodnoty spadají mezi meze.",
    p: [
      {
        name: "x_rozsah",
        detail:
          "Rozsah číselných hodnot x, se kterými jsou spojeny pravděpodobnosti.",
      },
      {
        name: "oblast_pravděpodobností",
        detail:
          "Sada pravděpodobností spojených s hodnotami v `x_rozsah`; musí sečíst do 1.",
      },
      {
        name: "spodní_hranice",
        detail: "Dolní mez hodnoty, pro kterou chcete pravděpodobnost.",
      },
      {
        name: "horní_hranice",
        detail:
          "Volitelná horní mez hodnoty, pro kterou chcete pravděpodobnost.",
      },
    ],
  },
  {
    n: "PRODUCT",
    d: "Vynásobí všechna čísla zadaná jako argumenty a vrátí součin.",
    a: "Součin čísel.",
    p: [
      {
        name: "číslo1",
        detail: "První číslo nebo rozsah, který chcete vynásobit.",
      },
      {
        name: "číslo2",
        detail: "Další čísla nebo rozsahy, celkem až 255.",
      },
    ],
  },
  {
    n: "PROPER",
    d: "Převede první písmeno v textovém řetězci na velké písmeno a všechna další písmena, která následují za znakem jiným než písmenem; převede všechna ostatní písmena na malá písmena.",
    a: "Převede první písmeno každého slova na velké.",
    p: [
      {
        name: "text",
        detail:
          "Text uzavřený v uvozovkách, vzorec, který vrací text, nebo odkaz na buňku obsahující text.",
      },
    ],
  },
  {
    n: "PV",
    d: "Vypočítá současnou hodnotu půjčky nebo investice na základě konstantní úrokové sazby.",
    a: "Současná hodnota investice.",
    p: [
      {
        name: "sazba",
        detail: "Úroková sazba za období.",
      },
      {
        name: "počet_období",
        detail: "Celkový počet platebních období v anuitě.",
      },
      {
        name: "splátka",
        detail:
          "Platba provedena v každém období; nemůže se po dobu trvání anuity změnit.",
      },
      {
        name: "budoucí_hodnota",
        detail:
          "Budoucí hodnota nebo zůstatek v hotovosti, který chcete po poslední platbě; výchozí je 0.",
      },
      {
        name: "typ",
        detail:
          "Při splatnosti: 0 nebo vynechání na konci období, 1 na začátku.",
      },
    ],
  },
  {
    n: "QUARTILE.EXC",
    d: "Vrátí kvartil souboru dat, založený na percentilových hodnotách od 0 do 1, s výjimkou.",
    a: "Kvartil, exkluzivní.",
    p: [
      {
        name: "pole",
        detail:
          "Pole nebo rozsah buněk číselných hodnot, pro které chcete kvartil.",
      },
      {
        name: "kvartil",
        detail: "Který kvartil vrátit: 1, 2 nebo 3.",
      },
    ],
  },
  {
    n: "QUARTILE.INC",
    d: "Vrátí kvartil souboru dat na základě percentilových hodnot od 0 do 1 včetně.",
    a: "Kvartil včetně.",
    p: [
      {
        name: "pole",
        detail:
          "Pole nebo rozsah buněk číselných hodnot, pro které chcete kvartil.",
      },
      {
        name: "kvartil",
        detail:
          "Který kvartil vrátit: 0 minimum, 1 první kvartil, 2 medián, 3 třetí kvartil, 4 maximum.",
      },
    ],
  },
  {
    n: "QUOTIENT",
    d: "Vrátí celočíselnou část dělení a zahodí zbytek.",
    a: "Celočíselná část dělení.",
    p: [
      {
        name: "čitatel",
        detail: "Dividenda.",
      },
      {
        name: "jmenovatel",
        detail: "Dělitel.",
      },
    ],
  },
  {
    n: "RADIANS",
    d: "Převede stupně na radiány.",
    a: "Převede stupně na radiány.",
    p: [
      {
        name: "úhel",
        detail: "Úhel ve stupních, který chcete převést.",
      },
    ],
  },
  {
    n: "RAND",
    d: "Vrací rovnoměrně rozložené náhodné reálné číslo větší nebo rovné 0 a menší než 1. Při každém výpočtu listu je vráceno nové číslo.",
    a: "Náhodné číslo mezi 0 a 1.",
    p: [],
  },
  {
    n: "RANDARRAY",
    d: "Vrátí pole náhodných čísel. Můžete nastavit počet řádků a sloupců, minimální a maximální hodnoty a zda se mají vracet celá čísla nebo desetinná místa.",
    a: "Pole náhodných čísel.",
    p: [
      {
        name: "řádky",
        detail: "Počet řádků, které se mají vrátit; výchozí je 1.",
      },
      {
        name: "sloupce",
        detail: "Počet sloupců, které se mají vrátit; výchozí je 1.",
      },
      {
        name: "min",
        detail: "Minimální počet pro vrácení; výchozí je 0.",
      },
      {
        name: "max",
        detail: "Maximální počet, který se má vrátit; výchozí je 1.",
      },
      {
        name: "celé_číslo",
        detail:
          "TRUE vrátí celá čísla, FALSE nebo vynechaný vrátí desetinná čísla.",
      },
    ],
  },
  {
    n: "RANDBETWEEN",
    d: "Vrátí náhodné celé číslo mezi zadanými čísly. Při každém výpočtu listu se vrátí nové číslo.",
    a: "Náhodné celé číslo mezi dvěma hodnotami.",
    p: [
      {
        name: "dole",
        detail: "Vrátí se nejmenší celé číslo RANDBETWEEN.",
      },
      {
        name: "nahoře",
        detail: "Vrátí se největší celé číslo RANDBETWEEN.",
      },
    ],
  },
  {
    n: "RANK.AVG",
    d: "Vrátí pořadí čísla v seznamu čísel; pokud má více než jedna hodnota stejné pořadí, vrátí se průměrné pořadí.",
    a: "Pořadí čísla; shodné hodnoty mají průměrné pořadí.",
    p: [
      {
        name: "číslo",
        detail: "Číslo, jehož hodnost chcete najít.",
      },
      {
        name: "odkaz",
        detail:
          "Pole nebo odkaz na seznam čísel. Nečíselné hodnoty jsou ignorovány.",
      },
      {
        name: "pořadí",
        detail:
          "0 nebo vynechané pozice v sestupném pořadí; jakákoli nenulová hodnota se řadí vzestupně.",
      },
    ],
  },
  {
    n: "RANK.EQ",
    d: "Vrátí pořadí čísla v seznamu čísel; pokud má více než jedna hodnota stejnou hodnotu, vrátí se nejvyšší hodnocení této sady.",
    a: "Pořadí čísla; shodné hodnoty sdílejí nejvyšší pořadí.",
    p: [
      {
        name: "číslo",
        detail: "Číslo, jehož hodnost chcete najít.",
      },
      {
        name: "odkaz",
        detail:
          "Pole nebo odkaz na seznam čísel. Nečíselné hodnoty jsou ignorovány.",
      },
      {
        name: "pořadí",
        detail:
          "0 nebo vynechané pozice v sestupném pořadí; jakákoli nenulová hodnota se řadí vzestupně.",
      },
    ],
  },
  {
    n: "RATE",
    d: "Vrátí úrokovou sazbu za období anuity. RATE se vypočítává iterací a může mít nula nebo více řešení.",
    a: "Úroková sazba za období anuity.",
    p: [
      {
        name: "počet_období",
        detail: "Celkový počet platebních období v anuitě.",
      },
      {
        name: "splátka",
        detail:
          "Platba provedena v každém období; nemůže se po dobu trvání anuity změnit.",
      },
      {
        name: "současná_hodnota",
        detail:
          "Současná hodnota, celková částka, kterou nyní stojí řada budoucích plateb.",
      },
      {
        name: "budoucí_hodnota",
        detail:
          "Budoucí hodnota nebo zůstatek v hotovosti, který chcete po poslední platbě; výchozí je 0.",
      },
      {
        name: "typ",
        detail:
          "Při splatnosti: 0 nebo vynechání na konci období, 1 na začátku.",
      },
      {
        name: "odhad",
        detail: "Váš odhad, jaká bude sazba; výchozí hodnota je 10 procent.",
      },
    ],
  },
  {
    n: "RECEIVED",
    d: "Vrátí částku přijatou při splatnosti za plně investovaný cenný papír.",
    a: "Částka přijatá při splatnosti.",
    p: [
      {
        name: "datum_vypořádání",
        detail: "Datum vypořádání cenného papíru.",
      },
      {
        name: "datum_splatnosti",
        detail: "Datum splatnosti cenného papíru.",
      },
      {
        name: "investice",
        detail: "Částka investovaná do cenného papíru.",
      },
      {
        name: "diskontní_sazba",
        detail: "Diskontní sazba cenného papíru.",
      },
      {
        name: "základna",
        detail:
          "Základ počtu dnů: 0 nebo vynecháno US 30/360, 1 skutečný/skutečný, 2 aktuální/360, 3 aktuální/365, 4 evropské 30/360.",
      },
    ],
  },
  {
    n: "REDUCE",
    d: "Zmenší pole na akumulovanou hodnotu použitím LAMBDA na každou hodnotu a vrácením celkové hodnoty v akumulátoru.",
    a: "Zmenší pole na jednu hodnotu.",
    p: [
      {
        name: "počáteční_hodnota",
        detail: "Počáteční hodnota pro akumulátor.",
      },
      {
        name: "pole",
        detail: "Pole, které má být zmenšeno.",
      },
      {
        name: "lambda",
        detail: "Volání LAMBDA s akumulátorem a aktuální hodnotou.",
      },
    ],
  },
  {
    n: "REGEXEXTRACT",
    d: "Extrahuje řetězce ze zadaného textu, které odpovídají vzoru.",
    a: "Text, který odpovídá regulárnímu výrazu.",
    p: [
      {
        name: "text",
        detail:
          "Text nebo odkaz na buňku obsahující text, ze kterého chcete extrahovat řetězce.",
      },
      {
        name: "vzor",
        detail:
          "Regulární výraz, který popisuje vzor textu, který chcete extrahovat.",
      },
      {
        name: "návratový_režim",
        detail:
          "0 nebo vynecháno vrátí první shodu, 1 všechny shody jako pole, 2 zachycující skupiny první shody jako pole.",
      },
      {
        name: "rozlišování_malých_a_velkých_písmen",
        detail:
          "0 nebo vynecháno rozlišuje velká a malá písmena, 1 nerozlišuje malá a velká písmena.",
      },
    ],
  },
  {
    n: "REGEXREPLACE",
    d: "Nahradí řetězce v poskytnutém textu, které odpovídají vzoru s nahrazením.",
    a: "Nahradí text odpovídající regulárnímu výrazu.",
    p: [
      {
        name: "text",
        detail:
          "Text nebo odkaz na buňku obsahující text, ve kterém chcete nahradit řetězce.",
      },
      {
        name: "vzor",
        detail:
          "Regulární výraz, který popisuje vzor textu, který chcete nahradit.",
      },
      {
        name: "nahrazení",
        detail: "Text, který chcete nahradit výskyty `vzor`.",
      },
      {
        name: "výskyt",
        detail:
          "Který výskyt nahradit: 0 nebo vynechaný nahradí všechny, záporné číslo se počítá od konce.",
      },
      {
        name: "rozlišování_malých_a_velkých_písmen",
        detail:
          "0 nebo vynecháno rozlišuje velká a malá písmena, 1 nerozlišuje malá a velká písmena.",
      },
    ],
  },
  {
    n: "REGEXTEST",
    d: "Umožňuje zkontrolovat, zda některá část dodaného textu odpovídá regulárnímu výrazu.",
    a: "Kontroluje text proti regulárnímu výrazu.",
    p: [
      {
        name: "text",
        detail:
          "Text nebo odkaz na buňku obsahující text, se kterým chcete porovnat.",
      },
      {
        name: "vzor",
        detail:
          "Regulární výraz, který popisuje vzor textu, který chcete porovnat.",
      },
      {
        name: "rozlišování_malých_a_velkých_písmen",
        detail:
          "0 nebo vynecháno rozlišuje velká a malá písmena, 1 nerozlišuje malá a velká písmena.",
      },
    ],
  },
  {
    n: "REPLACE",
    d: "Nahradí část textového řetězce na základě počtu znaků, který zadáte, jiným textovým řetězcem.",
    a: "Nahradí znaky na pozici.",
    p: [
      {
        name: "starý_text",
        detail: "Text, ve kterém chcete nahradit některé znaky.",
      },
      {
        name: "počáteční_pozice",
        detail:
          "Pozice znaku v `starý_text`, kterou chcete nahradit `nový_text`.",
      },
      {
        name: "počet_znaků",
        detail: "Počet znaků v `starý_text`, které má REPLACE nahradit.",
      },
      {
        name: "nový_text",
        detail: "Text, který nahradí znaky v `starý_text`.",
      },
    ],
  },
  {
    n: "REPLACEB",
    d: "Nahradí část textového řetězce na základě počtu bajtů jiným textovým řetězcem.",
    a: "Nahradit část textu (bajty).",
    p: [
      {
        name: "starý_text",
        detail: "Text, ve kterém chcete nahradit některé znaky.",
      },
      {
        name: "počáteční_pozice",
        detail: "Pozice prvního znaku, který se má nahradit.",
      },
      {
        name: "počet_bajtů",
        detail: "Počet bajtů k nahrazení.",
      },
      {
        name: "nový_text",
        detail: "Text, který nahrazuje znaky.",
      },
    ],
  },
  {
    n: "REPT",
    d: "Opakuje text daný počet krát.",
    a: "Opakuje text.",
    p: [
      {
        name: "text",
        detail: "Text, který chcete opakovat.",
      },
      {
        name: "počet_opakování",
        detail: "Kladné číslo určující, kolikrát se má opakovat `text`.",
      },
    ],
  },
  {
    n: "RIGHT",
    d: "Vrátí poslední znak nebo znaky v textovém řetězci na základě zadaného počtu znaků.",
    a: "Znaky textu zcela vpravo.",
    p: [
      {
        name: "text",
        detail: "Textový řetězec obsahující znaky, které chcete extrahovat.",
      },
      {
        name: "počet_znaků",
        detail: "Počet znaků, které má RIGHT extrahovat; výchozí je 1.",
      },
    ],
  },
  {
    n: "RIGHTB",
    d: "Vrátí poslední znaky textového řetězce na základě počtu bajtů.",
    a: "Znaky zcela vpravo (bajty).",
    p: [
      {
        name: "text",
        detail: "Textový řetězec obsahující znaky, které chcete extrahovat.",
      },
      {
        name: "počet_bajtů",
        detail: "Počet bajtů k extrahování; výchozí 1.",
      },
    ],
  },
  {
    n: "ROMAN",
    d: "Převede arabskou číslici na římskou jako text.",
    a: "Převede číslo na římské číslo.",
    p: [
      {
        name: "číslo",
        detail: "Arabské číslo, které chcete převést, od 1 do 3999.",
      },
      {
        name: "forma",
        detail:
          "Typ římské číslice: 0 nebo TRUE klasická, 1 až 3 postupně stručnější, 4 nebo FALSE zjednodušená.",
      },
    ],
  },
  {
    n: "ROUND",
    d: "Zaokrouhlí číslo na zadaný počet číslic.",
    a: "Zaokrouhlí na počet číslic.",
    p: [
      {
        name: "číslo",
        detail: "Číslo, které chcete zaokrouhlit.",
      },
      {
        name: "počet_číslic",
        detail:
          "Počet číslic, na které se má zaokrouhlit. Záporné hodnoty zaokrouhleno nalevo od desetinné čárky.",
      },
    ],
  },
  {
    n: "ROUNDDOWN",
    d: "Zaokrouhlí číslo dolů, směrem k nule, na zadaný počet číslic.",
    a: "Zaokrouhlí směrem k nule.",
    p: [
      {
        name: "číslo",
        detail: "Jakékoli reálné číslo, které chcete zaokrouhlit dolů.",
      },
      {
        name: "počet_číslic",
        detail:
          "Počet číslic, na které se má zaokrouhlit. Záporné hodnoty zaokrouhleno nalevo od desetinné čárky.",
      },
    ],
  },
  {
    n: "ROUNDUP",
    d: "Zaokrouhlí číslo nahoru od nuly na zadaný počet číslic.",
    a: "Zaokrouhlí od nuly.",
    p: [
      {
        name: "číslo",
        detail: "Jakékoli reálné číslo, které chcete zaokrouhlit nahoru.",
      },
      {
        name: "počet_číslic",
        detail:
          "Počet číslic, na které se má zaokrouhlit. Záporné hodnoty zaokrouhleno nalevo od desetinné čárky.",
      },
    ],
  },
  {
    n: "ROW",
    d: "Vrátí číslo řádku odkazu nebo buňky obsahující vzorec, pokud je vynechán.",
    a: "Číslo řádku odkazu.",
    p: [
      {
        name: "odkaz",
        detail: "Buňka nebo rozsah buněk, pro které chcete číslo řádku.",
      },
    ],
  },
  {
    n: "ROWS",
    d: "Vrátí počet řádků v odkazu nebo poli.",
    a: "Počet řádků v rozsahu.",
    p: [
      {
        name: "pole",
        detail: "Pole, maticový vzorec nebo odkaz na rozsah buněk.",
      },
    ],
  },
  {
    n: "RRI",
    d: "Vrátí ekvivalentní úrokovou míru pro růst investice.",
    a: "Ekvivalentní úroková sazba pro růst.",
    p: [
      {
        name: "počet_období",
        detail: "Počet období pro investici.",
      },
      {
        name: "současná_hodnota",
        detail: "Současná hodnota investice.",
      },
      {
        name: "budoucí_hodnota",
        detail: "Budoucí hodnota investice.",
      },
    ],
  },
  {
    n: "RSQ",
    d: "Vrátí druhou mocninu koeficientu korelačního momentu Pearsonova součinu prostřednictvím datových bodů v known_y a known_x.",
    a: "R-kvadrát lineární regrese.",
    p: [
      {
        name: "známé_y",
        detail: "Pole nebo rozsah datových bodů.",
      },
      {
        name: "známé_x",
        detail: "Pole nebo rozsah datových bodů.",
      },
    ],
  },
  {
    n: "SCAN",
    d: "Prohledá pole použitím LAMBDA na každou hodnotu a vrátí pole, které má každou mezilehlou hodnotu.",
    a: "Běžící akumulace s LAMBDA.",
    p: [
      {
        name: "počáteční_hodnota",
        detail: "Počáteční hodnota pro akumulátor.",
      },
      {
        name: "pole",
        detail: "Pole, které se má skenovat.",
      },
      {
        name: "lambda",
        detail: "Volání LAMBDA s akumulátorem a aktuální hodnotou.",
      },
    ],
  },
  {
    n: "SEARCH",
    d: "Vyhledá jeden textový řetězec v druhém textovém řetězci a vrátí počáteční pozici prvního. Nerozlišují se malá a velká písmena; podporuje zástupné znaky? a *.",
    a: "Pozice textu v textu (nerozlišují se malá a velká písmena).",
    p: [
      {
        name: "hledaný_text",
        detail:
          "Text, který chcete najít; může obsahovat zástupné znaky ? a *.",
      },
      {
        name: "v_textu",
        detail: "Text, ve kterém chcete hledat `hledaný_text`.",
      },
      {
        name: "počáteční_pozice",
        detail:
          "Číslo znaku v `v_textu`, od kterého chcete začít hledat; výchozí je 1.",
      },
    ],
  },
  {
    n: "SEARCHB",
    d: "Najde jeden textový řetězec v jiném (nerozlišují se malá a velká písmena, jsou povoleny zástupné znaky) a vrátí jeho počáteční pozici, počítá bajty.",
    a: "Pozice textu (bajtů) bez ohledu na velikost písmen.",
    p: [
      {
        name: "hledaný_text",
        detail: "Text, který chcete najít.",
      },
      {
        name: "v_textu",
        detail: "Text, ve kterém chcete hledat.",
      },
      {
        name: "počáteční_pozice",
        detail: "Znak, u kterého má být zahájeno vyhledávání.",
      },
    ],
  },
  {
    n: "SEC",
    d: "Vrátí sečnu úhlu zadaného v radiánech.",
    a: "Sekanta úhlu v radiánech.",
    p: [
      {
        name: "číslo",
        detail:
          "Úhel v radiánech; jeho absolutní hodnota musí být menší než 2^27.",
      },
    ],
  },
  {
    n: "SECH",
    d: "Vrátí hyperbolický sekans úhlu.",
    a: "Hyperbolický sekant.",
    p: [
      {
        name: "číslo",
        detail: "Jakékoli reálné číslo.",
      },
    ],
  },
  {
    n: "SECOND",
    d: "Vrátí sekundy časové hodnoty jako celé číslo od 0 do 59.",
    a: "Sekundová složka času.",
    p: [
      {
        name: "pořadové_číslo",
        detail: "Čas, který obsahuje sekundy, které chcete najít.",
      },
    ],
  },
  {
    n: "SEQUENCE",
    d: "Vygeneruje pole sekvenčních čísel, jako je 1, 2, 3, 4.",
    a: "Pole sekvenčních čísel.",
    p: [
      {
        name: "řádky",
        detail: "Počet řádků, které se mají vrátit.",
      },
      {
        name: "sloupce",
        detail: "Počet sloupců, které se mají vrátit; výchozí je 1.",
      },
      {
        name: "začátek",
        detail: "První číslo v sekvenci; výchozí je 1.",
      },
      {
        name: "krok",
        detail: "Částka pro zvýšení každé následující hodnoty; výchozí je 1.",
      },
    ],
  },
  {
    n: "SERIESSUM",
    d: "Vrátí součet mocninné řady na základě vzorce a1*x^n + a2*x^(n+m) + a3*x^(n+2m) + ...",
    a: "Součet mocninné řady.",
    p: [
      {
        name: "x",
        detail: "Vstupní hodnota do mocninné řady.",
      },
      {
        name: "n",
        detail: "Počáteční výkon, na který chcete zvýšit `x`.",
      },
      {
        name: "m",
        detail: "Krok, o který se zvýší `n` pro každý výraz v řadě.",
      },
      {
        name: "koeficienty",
        detail:
          "Sada koeficientů, kterými se násobí každá následná mocnina `x`.",
      },
    ],
  },
  {
    n: "SHEET",
    d: "Vrátí číslo listu odkazovaného listu.",
    a: "Číslo listu reference.",
    p: [
      {
        name: "hodnota",
        detail: "Název listu nebo odkazu; výchozí list, který obsahuje vzorec.",
      },
    ],
  },
  {
    n: "SHEETS",
    d: "Vrátí počet listů v odkazu.",
    a: "Počet listů v referenci.",
    p: [
      {
        name: "odkaz",
        detail:
          "Reference, pro kterou chcete počet listů; výchozí pro všechny listy v sešitu.",
      },
    ],
  },
  {
    n: "SIGN",
    d: "Vrátí znaménko čísla: 1, pokud je číslo kladné, 0, pokud je nula, a -1, pokud je záporné.",
    a: "Znaménko čísla.",
    p: [
      {
        name: "číslo",
        detail: "Jakékoli reálné číslo.",
      },
    ],
  },
  {
    n: "SIN",
    d: "Vrátí sinus úhlu zadaného v radiánech.",
    a: "Sinus úhlu v radiánech.",
    p: [
      {
        name: "číslo",
        detail: "Úhel v radiánech.",
      },
    ],
  },
  {
    n: "SINH",
    d: "Vrátí hyperbolický sinus čísla.",
    a: "Hyperbolický sinus.",
    p: [
      {
        name: "číslo",
        detail: "Jakékoli reálné číslo.",
      },
    ],
  },
  {
    n: "SKEW",
    d: "Vrátí šikmost rozdělení, stupeň asymetrie rozdělení kolem jeho střední hodnoty.",
    a: "Šikmost vzorku.",
    p: [
      {
        name: "číslo1",
        detail: "První číslo nebo rozsah.",
      },
      {
        name: "číslo2",
        detail: "Další čísla nebo rozsahy, celkem až 255.",
      },
    ],
  },
  {
    n: "SKEW.P",
    d: "Vrátí šikmost rozdělení na základě populace.",
    a: "Šikmost základního souboru.",
    p: [
      {
        name: "číslo1",
        detail: "První číslo nebo rozsah.",
      },
      {
        name: "číslo2",
        detail: "Další čísla nebo rozsahy, celkem až 254.",
      },
    ],
  },
  {
    n: "SLN",
    d: "Vrátí rovnoměrné odpisy aktiva za jedno období.",
    a: "Rovnoměrné odpisy.",
    p: [
      {
        name: "pořizovací_cena",
        detail: "Počáteční cena aktiva.",
      },
      {
        name: "zůstatková_hodnota",
        detail: "Hodnota na konci odpisu.",
      },
      {
        name: "životnost",
        detail: "Počet období, během kterých je aktivum odepisováno.",
      },
    ],
  },
  {
    n: "SLOPE",
    d: "Vrátí sklon lineární regresní přímky přes datové body v known_y a known_x.",
    a: "Sklon regresní přímky.",
    p: [
      {
        name: "známé_y",
        detail: "Pole nebo rozsah buněk číselně závislých datových bodů.",
      },
      {
        name: "známé_x",
        detail: "Sada nezávislých datových bodů.",
      },
    ],
  },
  {
    n: "SMALL",
    d: "Vrátí k-tou nejmenší hodnotu v sadě dat.",
    a: "K-tá nejmenší hodnota.",
    p: [
      {
        name: "pole",
        detail:
          "Pole nebo rozsah číselných dat, pro které chcete určit k-tou nejmenší hodnotu.",
      },
      {
        name: "k",
        detail:
          "Pozice (od nejmenší) v poli nebo rozsahu dat, která se mají vrátit.",
      },
    ],
  },
  {
    n: "SORT",
    d: "Seřadí obsah rozsahu nebo pole.",
    a: "Seřadí rozsah nebo pole.",
    p: [
      {
        name: "pole",
        detail: "Rozsah nebo pole k řazení.",
      },
      {
        name: "index_řazení",
        detail:
          "Číslo udávající řádek nebo sloupec, podle kterého se má třídit; výchozí je 1.",
      },
      {
        name: "pořadí_řazení",
        detail: "1 nebo vynechané řazení vzestupně, -1 sestupně.",
      },
      {
        name: "podle_sloupců",
        detail:
          "FALSE nebo vynechané řazení podle řádku, TRUE řazení podle sloupce.",
      },
    ],
  },
  {
    n: "SORTBY",
    d: "Seřadí obsah rozsahu nebo pole na základě hodnot v odpovídajícím rozsahu nebo poli.",
    a: "Seřadí podle hodnot v jiných rozsazích.",
    p: [
      {
        name: "pole",
        detail: "Pole nebo rozsah k seřazení.",
      },
      {
        name: "podle_pole1",
        detail: "Pole nebo rozsah, podle kterého se má třídit.",
      },
      {
        name: "pořadí_řazení1",
        detail: "Pořadí pro řazení: 1 vzestupně (výchozí), -1 sestupně.",
      },
      {
        name: "podle_pole2",
        detail: "Další pole nebo rozsahy k řazení.",
      },
      {
        name: "pořadí_řazení2",
        detail: "Pořadí odpovídajícího přídavného pole.",
      },
    ],
  },
  {
    n: "SQRT",
    d: "Vrátí kladnou druhou odmocninu.",
    a: "Kladná druhá odmocnina.",
    p: [
      {
        name: "číslo",
        detail: "Číslo, pro které chcete odmocninu.",
      },
    ],
  },
  {
    n: "SQRTPI",
    d: "Vrátí druhou odmocninu z (číslo * pi).",
    a: "Druhá odmocnina z čísla krát pí.",
    p: [
      {
        name: "číslo",
        detail: "Číslo, kterým se násobí pí.",
      },
    ],
  },
  {
    n: "STANDARDIZE",
    d: "Vrátí normalizovanou hodnotu z rozdělení charakterizovaného střední hodnotou a směrodatná_odchylka.",
    a: "Normalizovaná hodnota (z-skóre).",
    p: [
      {
        name: "x",
        detail: "Hodnota, kterou chcete normalizovat.",
      },
      {
        name: "průměr",
        detail: "Aritmetický průměr rozdělení.",
      },
      {
        name: "směrodatná_odchylka",
        detail: "Směrodatná odchylka rozdělení.",
      },
    ],
  },
  {
    n: "STDEV.P",
    d: "Vypočítá směrodatnou odchylku na základě celé populace zadané jako argumenty, ignoruje logické hodnoty a text.",
    a: "Směrodatná odchylka populace.",
    p: [
      {
        name: "číslo1",
        detail: "První číslo nebo rozsah odpovídající populaci.",
      },
      {
        name: "číslo2",
        detail: "Další čísla nebo rozsahy, celkem až 254.",
      },
    ],
  },
  {
    n: "STDEV.S",
    d: "Odhaduje směrodatnou odchylku na základě vzorku, ignoruje logické hodnoty a text.",
    a: "Výběrová směrodatná odchylka.",
    p: [
      {
        name: "číslo1",
        detail: "První číslo nebo rozsah odpovídající vzorku populace.",
      },
      {
        name: "číslo2",
        detail: "Další čísla nebo rozsahy, celkem až 254.",
      },
    ],
  },
  {
    n: "STDEVA",
    d: "Odhaduje směrodatnou odchylku na základě vzorku, přičemž text vyhodnocuje jako 0 a logické hodnoty jako 1 nebo 0.",
    a: "Výběrová směrodatná odchylka včetně textu a logických hodnot.",
    p: [
      {
        name: "hodnota1",
        detail: "První hodnota nebo rozsah odpovídající vzorku populace.",
      },
      {
        name: "hodnota2",
        detail: "Další hodnoty nebo rozsahy, celkem až 255.",
      },
    ],
  },
  {
    n: "STDEVP",
    d: "Vypočítá směrodatnou odchylku na základě celého základního souboru. Zachováno pro kompatibilitu; viz STDEV.P.",
    a: "Směrodatná odchylka populace (kompatibilita).",
    p: [
      {
        name: "číslo1",
        detail: "První číslo nebo rozsah odpovídající populaci.",
      },
      {
        name: "číslo2",
        detail: "Další čísla nebo rozsahy, celkem až 255.",
      },
    ],
  },
  {
    n: "STDEVPA",
    d: "Vypočítá směrodatnou odchylku na základě celého základního souboru, přičemž text vyhodnotí jako 0 a logické hodnoty jako 1 nebo 0.",
    a: "Směrodatná odchylka populace včetně textu a logiky.",
    p: [
      {
        name: "hodnota1",
        detail: "První hodnota nebo rozsah odpovídající základnímu souboru.",
      },
      {
        name: "hodnota2",
        detail: "Další hodnoty nebo rozsahy, celkem až 255.",
      },
    ],
  },
  {
    n: "STEYX",
    d: "Vrátí standardní chybu předpokládané hodnoty y pro každé x v regresi.",
    a: "Standardní chyba regrese.",
    p: [
      {
        name: "známé_y",
        detail: "Pole nebo rozsah závislých datových bodů.",
      },
      {
        name: "známé_x",
        detail: "Pole nebo rozsah nezávislých datových bodů.",
      },
    ],
  },
  {
    n: "SUBSTITUTE",
    d: "Nahrazuje nový_text za starý_text v textovém řetězci.",
    a: "Nahrazuje výskyty textu.",
    p: [
      {
        name: "text",
        detail:
          "Text nebo odkaz na buňku obsahující text, pro který chcete nahradit znaky.",
      },
      {
        name: "starý_text",
        detail: "Text, který chcete nahradit.",
      },
      {
        name: "nový_text",
        detail: "Text, kterým chcete nahradit `starý_text`.",
      },
      {
        name: "číslo_instance",
        detail:
          "Který výskyt `starý_text` nahradit; pokud je vynechán, bude nahrazen každý výskyt.",
      },
    ],
  },
  {
    n: "SUBTOTAL",
    d: "Vrátí mezisoučet v seznamu nebo databázi pomocí dané funkce. Kódy 101 až 111 také ignorují ručně skryté řádky; odfiltrované řádky jsou vždy ignorovány.",
    a: "Mezisoučet pomocí zvolené funkce.",
    p: [
      {
        name: "číslo_funkce",
        detail:
          "1 až 11 nebo 101 až 111: AVERAGE, COUNT, COUNTA, MAX, MIN, PRODUCT, STDEV, STDEVP, SUM, VAR, VARP.",
      },
      {
        name: "odkaz_1",
        detail:
          "První pojmenovaný rozsah nebo odkaz, pro který chcete mezisoučet.",
      },
      {
        name: "odkaz_2",
        detail: "Další rozsahy až do 254, pro které chcete mezisoučet.",
      },
    ],
  },
  {
    n: "SUM",
    d: "Sečte všechna čísla v rozsahu buněk.",
    a: "Součet čísel.",
    p: [
      {
        name: "číslo1",
        detail: "První číslo nebo rozsah, který se má přidat.",
      },
      {
        name: "číslo2",
        detail: "Další čísla nebo rozsahy k přidání, celkem až 255.",
      },
    ],
  },
  {
    n: "SUMIF",
    d: "Přidá buňky v rozsahu, které splňují jedinou podmínku.",
    a: "Podmíněný součet rozsahu.",
    p: [
      {
        name: "oblast",
        detail: "Rozsah buněk, které chcete vyhodnotit pomocí `kritéria`.",
      },
      {
        name: "kritéria",
        detail:
          "Podmínka jako číslo, výraz, odkaz na buňku, text nebo funkce, která definuje, které buňky se přidají.",
      },
      {
        name: "rozsah_součtu",
        detail: "Buňky k přidání, pokud se liší od `oblast`.",
      },
    ],
  },
  {
    n: "SUMIFS",
    d: "Přidá všechny své argumenty, které splňují více kritérií.",
    a: "Součet buněk, které splňují více kritérií.",
    p: [
      {
        name: "rozsah_součtu",
        detail: "Rozsah buněk k součtu.",
      },
      {
        name: "rozsah_kritérií1",
        detail: "Rozsah, který je testován pomocí `kritéria1`.",
      },
      {
        name: "kritéria1",
        detail:
          "Kritéria, která definují, které buňky v `rozsah_kritérií1` budou přidány.",
      },
      {
        name: "rozsah_kritérií2",
        detail: "Další rozsahy k testování, až 127 párů rozsah/kritéria.",
      },
      {
        name: "kritéria2",
        detail: "Kritéria pro odpovídající doplňkový rozsah.",
      },
    ],
  },
  {
    n: "SUMPRODUCT",
    d: "Vrátí součet součinů odpovídajících rozsahů nebo polí.",
    a: "Součet součinů polí.",
    p: [
      {
        name: "pole1",
        detail: "První pole, jehož složky chcete vynásobit a poté sečíst.",
      },
      {
        name: "pole2",
        detail: "Další pole, až 255, se stejnými rozměry jako `pole1`.",
      },
    ],
  },
  {
    n: "SUMSQ",
    d: "Vrátí součet druhých mocnin argumentů.",
    a: "Součet čtverců.",
    p: [
      {
        name: "číslo1",
        detail: "První číslo nebo rozsah k druhé mocnině a sečtení.",
      },
      {
        name: "číslo2",
        detail: "Další čísla nebo rozsahy, celkem až 255.",
      },
    ],
  },
  {
    n: "SUMX2MY2",
    d: "Vrátí součet rozdílu druhých mocnin odpovídajících hodnot ve dvou polích.",
    a: "Součet rozdílů čtverců.",
    p: [
      {
        name: "pole_x",
        detail: "První pole nebo rozsah hodnot.",
      },
      {
        name: "pole_y",
        detail: "Druhé pole nebo rozsah hodnot.",
      },
    ],
  },
  {
    n: "SUMX2PY2",
    d: "Vrátí součet součtu druhých mocnin odpovídajících hodnot ve dvou polích.",
    a: "Součet součtů čtverců.",
    p: [
      {
        name: "pole_x",
        detail: "První pole nebo rozsah hodnot.",
      },
      {
        name: "pole_y",
        detail: "Druhé pole nebo rozsah hodnot.",
      },
    ],
  },
  {
    n: "SUMXMY2",
    d: "Vrátí součet druhých mocnin rozdílů odpovídajících hodnot ve dvou polích.",
    a: "Součet čtverců rozdílů.",
    p: [
      {
        name: "pole_x",
        detail: "První pole nebo rozsah hodnot.",
      },
      {
        name: "pole_y",
        detail: "Druhé pole nebo rozsah hodnot.",
      },
    ],
  },
  {
    n: "SWITCH",
    d: "Vyhodnotí jednu hodnotu (výraz) proti seznamu hodnot a vrátí výsledek odpovídající první odpovídající hodnotě. Pokud neexistuje žádná shoda, vrátí se volitelná výchozí hodnota.",
    a: "Výsledek pro první odpovídající hodnotu.",
    p: [
      {
        name: "výraz",
        detail: "Hodnota, která bude porovnána s každým argumentem hodnoty.",
      },
      {
        name: "hodnota1",
        detail: "Hodnota k porovnání s `výraz`.",
      },
      {
        name: "výsledek1",
        detail:
          "Hodnota, která se má vrátit, když `hodnota1` odpovídá `výraz`.",
      },
      {
        name: "výchozí_nebo_hodnota2",
        detail:
          "Další hodnota k porovnání nebo, jako poslední argument, výchozí hodnota vrácená, když nic neodpovídá.",
      },
      {
        name: "výsledek2",
        detail:
          "Hodnota, která se má vrátit, když se odpovídající hodnota shoduje.",
      },
    ],
  },
  {
    n: "SYD",
    d: "Vrátí součet ročních odpisů aktiva za zadané období.",
    a: "Odpisy metodou součtu pořadových čísel let.",
    p: [
      {
        name: "pořizovací_cena",
        detail: "Počáteční cena aktiva.",
      },
      {
        name: "zůstatková_hodnota",
        detail: "Hodnota na konci odpisu.",
      },
      {
        name: "životnost",
        detail: "Počet období, během kterých je aktivum odepisováno.",
      },
      {
        name: "období",
        detail: "Období ve stejných jednotkách jako `životnost`.",
      },
    ],
  },
  {
    n: "T",
    d: "Vrátí text, na který odkazuje hodnota, nebo prázdný řetězec, pokud hodnota není text.",
    a: 'Vrátí text nebo "" pro jiné hodnoty.',
    p: [
      {
        name: "hodnota",
        detail: "Hodnota, kterou chcete testovat.",
      },
    ],
  },
  {
    n: "T.DIST",
    d: "Vrátí levostranné Studentovo t-rozdělení.",
    a: "Levostranné t-rozdělení.",
    p: [
      {
        name: "x",
        detail: "Číselná hodnota, při které se má vyhodnotit rozdělení.",
      },
      {
        name: "stupně_volnosti",
        detail: "Celé číslo udávající počet stupňů volnosti.",
      },
      {
        name: "kumulativní",
        detail:
          "TRUE vrací funkci kumulativního rozdělení, FALSE funkci hustoty pravděpodobnosti.",
      },
    ],
  },
  {
    n: "T.DIST.2T",
    d: "Vrátí dvoustranné Studentovo t-rozdělení.",
    a: "Dvoustranné t-rozdělení.",
    p: [
      {
        name: "x",
        detail: "Číselná hodnota, při které se má vyhodnotit rozdělení.",
      },
      {
        name: "stupně_volnosti",
        detail: "Celé číslo udávající počet stupňů volnosti.",
      },
    ],
  },
  {
    n: "T.DIST.RT",
    d: "Vrátí pravostranné Studentovo t-rozdělení.",
    a: "Pravostranné t-rozdělení.",
    p: [
      {
        name: "x",
        detail: "Číselná hodnota, při které se má vyhodnotit rozdělení.",
      },
      {
        name: "stupně_volnosti",
        detail: "Celé číslo udávající počet stupňů volnosti.",
      },
    ],
  },
  {
    n: "T.INV",
    d: "Vrátí levostrannou inverzi Studentova t-rozdělení.",
    a: "Inverzní levostranné t-rozdělení.",
    p: [
      {
        name: "pravděpodobnost",
        detail: "Pravděpodobnost spojená se Studentovým t-rozdělením.",
      },
      {
        name: "stupně_volnosti",
        detail: "Počet stupňů volnosti.",
      },
    ],
  },
  {
    n: "T.INV.2T",
    d: "Vrátí dvoustrannou inverzi Studentova t-rozdělení.",
    a: "Inverzní dvoustranné t-rozdělení.",
    p: [
      {
        name: "pravděpodobnost",
        detail: "Pravděpodobnost spojená se Studentovým t-rozdělením.",
      },
      {
        name: "stupně_volnosti",
        detail: "Počet stupňů volnosti.",
      },
    ],
  },
  {
    n: "T.TEST",
    d: "Vrátí pravděpodobnost spojenou se Studentovým t-testem.",
    a: "Pravděpodobnost z t-testu.",
    p: [
      {
        name: "pole1",
        detail: "První soubor dat.",
      },
      {
        name: "pole2",
        detail: "Druhý soubor dat.",
      },
      {
        name: "počet_chvostů",
        detail: "Počet distribučních koncovek: 1 jednostranný, 2 dvoustranný.",
      },
      {
        name: "typ",
        detail:
          "Druh testu: 1 párový, 2 dvouvýběrový stejný rozptyl, 3 dvouvýběrový nestejný rozptyl.",
      },
    ],
  },
  {
    n: "TAKE",
    d: "Vrátí zadaný počet souvislých řádků nebo sloupců od začátku nebo konce pole.",
    a: "První nebo poslední řádky/sloupce pole.",
    p: [
      {
        name: "pole",
        detail: "Pole, ze kterého se mají vzít řádky nebo sloupce.",
      },
      {
        name: "řádky",
        detail:
          "Počet řádků, které je třeba vzít; záporná hodnota nabývá od konce.",
      },
      {
        name: "sloupce",
        detail:
          "Počet sloupců, které je třeba vzít; záporná hodnota nabývá od konce.",
      },
    ],
  },
  {
    n: "TAN",
    d: "Vrátí tangens úhlu zadaného v radiánech.",
    a: "Tangens úhlu v radiánech.",
    p: [
      {
        name: "číslo",
        detail: "Úhel v radiánech.",
      },
    ],
  },
  {
    n: "TANH",
    d: "Vrátí hyperbolický tangens čísla.",
    a: "Hyperbolický tangens.",
    p: [
      {
        name: "číslo",
        detail: "Jakékoli reálné číslo.",
      },
    ],
  },
  {
    n: "TBILLEQ",
    d: "Vrátí dluhopisový ekvivalent výnosu státní pokladniční poukázky.",
    a: "Dluhopisový ekvivalent výnosu státní pokladniční poukázky.",
    p: [
      {
        name: "datum_vypořádání",
        detail: "Datum vypořádání státní pokladniční poukázky.",
      },
      {
        name: "datum_splatnosti",
        detail: "Datum splatnosti státní pokladniční poukázky.",
      },
      {
        name: "diskontní_sazba",
        detail: "Diskontní sazba státní pokladniční poukázky.",
      },
    ],
  },
  {
    n: "TBILLPRICE",
    d: "Vrátí cenu za 100 USD jmenovité hodnoty státní pokladniční poukázky.",
    a: "Cena státní pokladniční poukázky.",
    p: [
      {
        name: "datum_vypořádání",
        detail: "Datum vypořádání státní pokladniční poukázky.",
      },
      {
        name: "datum_splatnosti",
        detail: "Datum splatnosti státní pokladniční poukázky.",
      },
      {
        name: "diskontní_sazba",
        detail: "Diskontní sazba státní pokladniční poukázky.",
      },
    ],
  },
  {
    n: "TBILLYIELD",
    d: "Vrátí výnos státní pokladniční poukázky.",
    a: "Výnos státní pokladniční poukázky.",
    p: [
      {
        name: "datum_vypořádání",
        detail: "Datum vypořádání státní pokladniční poukázky.",
      },
      {
        name: "datum_splatnosti",
        detail: "Datum splatnosti státní pokladniční poukázky.",
      },
      {
        name: "cena",
        detail: "Cena pokladniční poukázky za nominální hodnotu 100 USD.",
      },
    ],
  },
  {
    n: "TDIST",
    d: "Vrátí procentní body (pravděpodobnost) pro Studentovo t-rozdělení. Zachováno pro kompatibilitu; viz T.DIST.RT a T.DIST.2T.",
    a: "Studentovo t-rozdělení (kompatibilita).",
    p: [
      {
        name: "x",
        detail: "Číselná hodnota, při které se má vyhodnotit rozdělení.",
      },
      {
        name: "stupně_volnosti",
        detail: "Celé číslo udávající počet stupňů volnosti.",
      },
      {
        name: "počet_chvostů",
        detail:
          "Počet distribučních koncových bodů, které se mají vrátit: 1 nebo 2.",
      },
    ],
  },
  {
    n: "TEXT",
    d: "Převede číselnou hodnotu na text a umožní vám určit formátování zobrazení pomocí speciálních formátovacích řetězců.",
    a: "Formátuje číslo jako text.",
    p: [
      {
        name: "hodnota",
        detail: "Číselná hodnota, kterou chcete převést na text.",
      },
      {
        name: "formátovací_text",
        detail:
          "Textový řetězec, který definuje formátování, které chcete použít na `hodnota`.",
      },
    ],
  },
  {
    n: "TEXTAFTER",
    d: "Vrátí text, který se vyskytuje po daném znaku nebo řetězci.",
    a: "Text za oddělovačem.",
    p: [
      {
        name: "text",
        detail: "Text, ve kterém hledáte. Zástupné znaky nejsou povoleny.",
      },
      {
        name: "oddělovač",
        detail: "Text, který označuje bod, za kterým chcete extrahovat.",
      },
      {
        name: "číslo_instance",
        detail:
          "Instance oddělovače, za kterou chcete extrahovat text; záporné číslo hledá od konce. Výchozí hodnota je 1.",
      },
      {
        name: "režim_shody",
        detail:
          "0 (výchozí) rozlišuje malá a velká písmena v oddělovači, 1 nerozlišuje malá a velká písmena.",
      },
      {
        name: "shoda_konce",
        detail:
          "1 zachází s koncem textu jako s oddělovačem; výchozí hodnota je 0 (přesná shoda).",
      },
      {
        name: "pokud_nebyl_nalezen",
        detail:
          "Hodnota vrácená, pokud není nalezena žádná shoda; výchozí hodnota je #N/A.",
      },
    ],
  },
  {
    n: "TEXTBEFORE",
    d: "Vrátí text, který se vyskytuje před daným znakem nebo řetězcem.",
    a: "Text před oddělovačem.",
    p: [
      {
        name: "text",
        detail: "Text, ve kterém hledáte. Zástupné znaky nejsou povoleny.",
      },
      {
        name: "oddělovač",
        detail: "Text, který označuje bod, před kterým chcete extrahovat.",
      },
      {
        name: "číslo_instance",
        detail:
          "Instance oddělovače, před kterou chcete extrahovat text; záporné číslo hledá od konce. Výchozí hodnota je 1.",
      },
      {
        name: "režim_shody",
        detail:
          "0 (výchozí) rozlišuje malá a velká písmena v oddělovači, 1 nerozlišuje malá a velká písmena.",
      },
      {
        name: "shoda_konce",
        detail:
          "1 zachází s koncem textu jako s oddělovačem; výchozí hodnota je 0 (přesná shoda).",
      },
      {
        name: "pokud_nebyl_nalezen",
        detail:
          "Hodnota vrácená, pokud není nalezena žádná shoda; výchozí hodnota je #N/A.",
      },
    ],
  },
  {
    n: "TEXTJOIN",
    d: "Kombinuje text z více rozsahů a/nebo řetězců a zahrnuje oddělovač, který určíte mezi každou textovou hodnotou.",
    a: "Spojí text pomocí oddělovače.",
    p: [
      {
        name: "oddělovač",
        detail:
          "Textový řetězec, buď prázdný, nebo jeden nebo více znaků, vložený mezi každou textovou hodnotu.",
      },
      {
        name: "ignorovat_prázdné",
        detail: "Pokud TRUE, ignoruje prázdné buňky.",
      },
      {
        name: "text1",
        detail: "První textová položka nebo rozsah, který má být spojen.",
      },
      {
        name: "text2",
        detail: "Další textové položky nebo rozsahy ke spojení, celkem až 252.",
      },
    ],
  },
  {
    n: "TEXTSPLIT",
    d: "Rozdělí textové řetězce pomocí oddělovačů sloupců a řádků.",
    a: "Rozdělí text do pole.",
    p: [
      {
        name: "text",
        detail: "Text, který chcete rozdělit.",
      },
      {
        name: "oddělovač_sloupců",
        detail:
          "Text, který označuje místo, kde má být text rozlit přes sloupce.",
      },
      {
        name: "oddělovač_řádků",
        detail:
          "Text, který označuje místo, kde se má text rozsypat po řádcích.",
      },
      {
        name: "ignorovat_prázdné",
        detail:
          "TRUE ignoruje po sobě jdoucí oddělovače; FALSE nebo vynechané vytvoří prázdnou buňku.",
      },
      {
        name: "režim_shody",
        detail:
          "0 (výchozí) provádí shodu bez ohledu na malá a velká písmena, 1 shodu bez rozlišování malých a velkých písmen.",
      },
      {
        name: "doplnit_hodnotou",
        detail: "Hodnota, kterou se doplní výsledek; výchozí hodnota je #N/A.",
      },
    ],
  },
  {
    n: "TIME",
    d: "Vrátí desetinné číslo pro konkrétní čas, od 0 (00:00:00) do 0,99988426 (23:59:59).",
    a: "Čas z hodiny, minuty a sekundy.",
    p: [
      {
        name: "hodina",
        detail:
          "Číslo od 0 do 32767 představující hodinu; hodnoty nad 23 se dělí 24.",
      },
      {
        name: "minuta",
        detail:
          "Číslo od 0 do 32767 představující minutu; hodnoty nad 59 převést do hodin.",
      },
      {
        name: "sekunda",
        detail:
          "Číslo od 0 do 32767 představující druhý; hodnoty nad 59 převést do minut.",
      },
    ],
  },
  {
    n: "TIMEVALUE",
    d: "Vrátí desetinné číslo času reprezentovaného textovým řetězcem.",
    a: "Převede text času na číslo.",
    p: [
      {
        name: "čas_jako_text",
        detail:
          "Textový řetězec, který představuje čas v rozpoznaném časovém formátu.",
      },
    ],
  },
  {
    n: "TINV",
    d: "Vrátí dvoustrannou inverzi Studentova t-rozdělení. Zachováno pro kompatibilitu; viz T.INV.2T.",
    a: "Inverzní dvoustranné t-rozdělení (starší).",
    p: [
      {
        name: "pravděpodobnost",
        detail:
          "Pravděpodobnost spojená s dvoustranným Studentovým t-rozdělením.",
      },
      {
        name: "stupně_volnosti",
        detail: "Počet stupňů volnosti.",
      },
    ],
  },
  {
    n: "TOCOL",
    d: "Vrátí pole v jednom sloupci.",
    a: "Sloučí pole do jednoho sloupce.",
    p: [
      {
        name: "pole",
        detail: "Pole nebo odkaz, který se má vrátit jako sloupec.",
      },
      {
        name: "ignorovat",
        detail:
          "Zda se mají ignorovat určité hodnoty: 0 zachovat vše (výchozí), 1 ignorovat mezery, 2 ignorovat chyby, 3 ignorovat mezery a chyby.",
      },
      {
        name: "skenování_po_sloupcích",
        detail:
          "FALSE nebo vynecháno prohledá pole po řádku; TRUE skenuje podle sloupce.",
      },
    ],
  },
  {
    n: "TODAY",
    d: "Vrátí pořadové číslo aktuálního data. Aktualizuje se při každém výpočtu listu.",
    a: "Aktuální datum.",
    p: [],
  },
  {
    n: "TOROW",
    d: "Vrátí pole v jednom řádku.",
    a: "Sloučí pole do jednoho řádku.",
    p: [
      {
        name: "pole",
        detail: "Pole nebo odkaz, který se má vrátit jako řádek.",
      },
      {
        name: "ignorovat",
        detail:
          "Zda se mají ignorovat určité hodnoty: 0 zachovat vše (výchozí), 1 ignorovat mezery, 2 ignorovat chyby, 3 ignorovat mezery a chyby.",
      },
      {
        name: "skenování_po_sloupcích",
        detail:
          "FALSE nebo vynecháno prohledá pole po řádku; TRUE skenuje podle sloupce.",
      },
    ],
  },
  {
    n: "TRANSPOSE",
    d: "Vrátí vertikální rozsah buněk jako horizontální rozsah nebo naopak.",
    a: "Zamění řádky a sloupce.",
    p: [
      {
        name: "pole",
        detail: "Pole nebo rozsah buněk na listu, který chcete transponovat.",
      },
    ],
  },
  {
    n: "TREND",
    d: "Vrátí hodnoty podél lineárního trendu a přizpůsobí přímku known_y a known_x pomocí metody nejmenších čtverců.",
    a: "Hodnoty podél lineárního trendu.",
    p: [
      {
        name: "známé_y",
        detail: "Množina y-hodnot, kterou již znáte ve vztahu y = mx + b.",
      },
      {
        name: "známé_x",
        detail: "Volitelná sada x-hodnot, které již možná znáte.",
      },
      {
        name: "nové_x",
        detail:
          "Nové hodnoty x, pro které chcete, aby TREND vrátilo odpovídající hodnoty y.",
      },
      {
        name: "konst",
        detail:
          "TRUE nebo vynecháno vypočítá b normálně; FALSE vynutí b rovno 0.",
      },
    ],
  },
  {
    n: "TRIM",
    d: "Odebere z textu všechny mezery kromě jednotlivých mezer mezi slovy.",
    a: "Odebere nadbytečné mezery.",
    p: [
      {
        name: "text",
        detail: "Text, ze kterého chcete odstranit mezery.",
      },
    ],
  },
  {
    n: "TRIMMEAN",
    d: "Vrátí průměr vnitřku souboru dat s vyloučením procenta datových bodů z horního a dolního konce.",
    a: "Průměr bez odlehlých hodnot.",
    p: [
      {
        name: "pole",
        detail: "Pole nebo rozsah hodnot k oříznutí a zprůměrování.",
      },
      {
        name: "procento",
        detail:
          "Zlomkový počet datových bodů, které mají být vyloučeny z výpočtu.",
      },
    ],
  },
  {
    n: "TRIMRANGE",
    d: "Vyloučí všechny prázdné řádky a/nebo sloupce z vnějších okrajů rozsahu nebo pole.",
    a: "Ořízne prázdné okraje z rozsahu.",
    p: [
      {
        name: "oblast",
        detail: "Rozsah nebo pole, které se má oříznout.",
      },
      {
        name: "ořez_řádků",
        detail:
          "Které řádky oříznout: 0 žádné, 1 prázdný řádek na začátku, 2 prázdné řádky na konci, 3 oba (výchozí).",
      },
      {
        name: "ořez_sloupců",
        detail:
          "Které sloupce oříznout: 0 žádný, 1 prázdný sloupec na začátku, 2 prázdné sloupce na konci, 3 oba (výchozí).",
      },
    ],
  },
  {
    n: "TRUE",
    d: "Vrátí logickou hodnotu TRUE.",
    a: "Logická hodnota TRUE.",
    p: [],
  },
  {
    n: "TRUNC",
    d: "Zkrátí číslo na celé číslo (nebo na danou přesnost) odstraněním zlomkové části.",
    a: "Zkrátí číslo.",
    p: [
      {
        name: "číslo",
        detail: "Číslo, které chcete zkrátit.",
      },
      {
        name: "počet_číslic",
        detail: "Přesnost zkrácení; výchozí je 0.",
      },
    ],
  },
  {
    n: "TTEST",
    d: "Vrátí pravděpodobnost spojenou se Studentovým t-testem. Zachováno pro kompatibilitu; viz T.TEST.",
    a: "Pravděpodobnost z t-testu (kompatibilita).",
    p: [
      {
        name: "pole1",
        detail: "První soubor dat.",
      },
      {
        name: "pole2",
        detail: "Druhý soubor dat.",
      },
      {
        name: "počet_chvostů",
        detail: "Počet distribučních koncovek: 1 jednostranný, 2 dvoustranný.",
      },
      {
        name: "typ",
        detail:
          "Druh testu: 1 párový, 2 dvouvýběrový stejný rozptyl, 3 dvouvýběrový nestejný rozptyl.",
      },
    ],
  },
  {
    n: "TYPE",
    d: "Vrací typ hodnoty: 1 číslo, 2 text, 4 logická hodnota, 16 chybová hodnota, 64 pole.",
    a: "Typ hodnoty.",
    p: [
      {
        name: "hodnota",
        detail: "Jakákoli hodnota, jako je číslo, text nebo logická hodnota.",
      },
    ],
  },
  {
    n: "UNICHAR",
    d: "Vrátí znak Unicode, na který odkazuje daná číselná hodnota.",
    a: "Znak Unicode z bodu kódu.",
    p: [
      {
        name: "číslo",
        detail: "Číslo Unicode, které představuje znak.",
      },
    ],
  },
  {
    n: "UNICODE",
    d: "Vrací číslo (bod kódu) odpovídající prvnímu znaku textu.",
    a: "Kódový bod prvního znaku.",
    p: [
      {
        name: "text",
        detail: "Znak, pro který chcete hodnotu Unicode.",
      },
    ],
  },
  {
    n: "UNIQUE",
    d: "Vrátí seznam jedinečných hodnot v seznamu nebo rozsahu.",
    a: "Jedinečné hodnoty rozsahu.",
    p: [
      {
        name: "pole",
        detail:
          "Rozsah nebo pole, ze kterého se mají vrátit jedinečné řádky nebo sloupce.",
      },
      {
        name: "podle_sloupců",
        detail:
          "FALSE nebo vynecháno porovnává řádky proti sobě; TRUE porovnává sloupce.",
      },
      {
        name: "přesně_jednou",
        detail:
          "TRUE vrátí pouze řádky nebo sloupce, které se vyskytují právě jednou; FALSE nebo vynechaný vrátí všechny odlišné.",
      },
    ],
  },
  {
    n: "UPPER",
    d: "Převede text na velká písmena.",
    a: "Převede text na velká písmena.",
    p: [
      {
        name: "text",
        detail: "Text, který chcete převést na velká písmena.",
      },
    ],
  },
  {
    n: "VALUE",
    d: "Převede textový řetězec, který představuje číslo, na číslo.",
    a: "Převede text na číslo.",
    p: [
      {
        name: "text",
        detail:
          "Text uzavřený v uvozovkách nebo odkaz na buňku obsahující text, který chcete převést.",
      },
    ],
  },
  {
    n: "VALUETOTEXT",
    d: "Vrátí text z libovolné zadané hodnoty. Předává textové hodnoty beze změny a převádí netextové hodnoty na text.",
    a: "Převede hodnotu na text.",
    p: [
      {
        name: "hodnota",
        detail: "Hodnota, která se má vrátit jako text.",
      },
      {
        name: "formát",
        detail:
          "0 nebo vynecháno vrátí stručný, snadno čitelný formát; 1 vrátí přísný formát se znaky escape, které lze analyzovat jako vzorec.",
      },
    ],
  },
  {
    n: "VAR.P",
    d: "Vypočítá rozptyl na základě celého základního souboru, ignoruje logické hodnoty a text.",
    a: "Rozptyl populace.",
    p: [
      {
        name: "číslo1",
        detail: "První číslo nebo rozsah odpovídající populaci.",
      },
      {
        name: "číslo2",
        detail: "Další čísla nebo rozsahy, celkem až 254.",
      },
    ],
  },
  {
    n: "VAR.S",
    d: "Odhaduje rozptyl na základě vzorku, ignoruje logické hodnoty a text.",
    a: "Rozptyl vzorku.",
    p: [
      {
        name: "číslo1",
        detail: "První číslo nebo rozsah odpovídající vzorku populace.",
      },
      {
        name: "číslo2",
        detail: "Další čísla nebo rozsahy, celkem až 254.",
      },
    ],
  },
  {
    n: "VARA",
    d: "Odhaduje rozptyl na základě vzorku, vyhodnocuje text jako 0 a logické hodnoty jako 1 nebo 0.",
    a: "Výběrový rozptyl včetně textu a logických hodnot.",
    p: [
      {
        name: "hodnota1",
        detail: "První hodnota nebo rozsah odpovídající vzorku populace.",
      },
      {
        name: "hodnota2",
        detail: "Další hodnoty nebo rozsahy, celkem až 255.",
      },
    ],
  },
  {
    n: "VARP",
    d: "Vypočítá rozptyl na základě celé populace. Zachováno pro kompatibilitu; viz VAR.P.",
    a: "Rozptyl populace (kompatibilita).",
    p: [
      {
        name: "číslo1",
        detail: "První číslo nebo rozsah odpovídající populaci.",
      },
      {
        name: "číslo2",
        detail: "Další čísla nebo rozsahy, celkem až 255.",
      },
    ],
  },
  {
    n: "VARPA",
    d: "Vypočítá rozptyl na základě celého základního souboru, přičemž text vyhodnotí jako 0 a logické hodnoty jako 1 nebo 0.",
    a: "Rozptyl populace včetně textu a logiky.",
    p: [
      {
        name: "hodnota1",
        detail: "První hodnota nebo rozsah odpovídající základnímu souboru.",
      },
      {
        name: "hodnota2",
        detail: "Další hodnoty nebo rozsahy, celkem až 255.",
      },
    ],
  },
  {
    n: "VDB",
    d: "Vrátí odpis aktiva za jakékoli období, včetně dílčích období, pomocí metody dvojitého klesajícího zůstatku nebo jiné metody, kterou určíte.",
    a: "Variabilní degresivní odpisy.",
    p: [
      {
        name: "pořizovací_cena",
        detail: "Počáteční cena aktiva.",
      },
      {
        name: "zůstatková_hodnota",
        detail: "Hodnota na konci odpisu.",
      },
      {
        name: "životnost",
        detail: "Počet období, během kterých je aktivum odepisováno.",
      },
      {
        name: "počáteční_období",
        detail: "Počáteční období pro odepisování.",
      },
      {
        name: "konec_období",
        detail: "Konečné období pro odpisování.",
      },
      {
        name: "faktor",
        detail:
          "Rychlost, se kterou se zůstatek snižuje; výchozí 2 (dvojité klesající).",
      },
      {
        name: "bez_změny_metody",
        detail: "TRUE nikdy nepřepnout na rovnoměrné odpisování.",
      },
    ],
  },
  {
    n: "VLOOKUP",
    d: "Vyhledá hodnotu v levém sloupci tabulky a vrátí hodnotu ve stejném řádku ze sloupce, který určíte.",
    a: "Vertikální vyhledávání.",
    p: [
      {
        name: "hledaná_hodnota",
        detail:
          "Hodnota, kterou chcete vyhledat; musí být v prvním sloupci `pole_tabulky`.",
      },
      {
        name: "pole_tabulky",
        detail:
          "Rozsah buněk, ve kterých bude VLOOKUP hledat `hledaná_hodnota`, a vrácená hodnota.",
      },
      {
        name: "index_sloupce",
        detail:
          "Číslo sloupce (počínaje 1 pro sloupec zcela vlevo `pole_tabulky`), který obsahuje vrácenou hodnotu.",
      },
      {
        name: "přibližná_shoda",
        detail:
          "TRUE nebo vynechaný najde přibližnou shodu; FALSE najde přesnou shodu.",
      },
    ],
  },
  {
    n: "VSTACK",
    d: "Připojuje pole vertikálně a postupně, aby se vrátilo větší pole.",
    a: "Skládá pole na sebe.",
    p: [
      {
        name: "pole1",
        detail: "První pole k připojení.",
      },
      {
        name: "pole2",
        detail: "Další pole k připojení.",
      },
    ],
  },
  {
    n: "WEEKDAY",
    d: "Ve výchozím nastavení vrátí den v týdnu odpovídající datu jako celé číslo od 1 (neděle) do 7 (sobota).",
    a: "Den v týdnu.",
    p: [
      {
        name: "pořadové_číslo",
        detail:
          "Pořadové číslo, které představuje datum dne, který se snažíte najít.",
      },
      {
        name: "návratový_typ",
        detail:
          "Číslo, které určuje číslování: 1 nebo vynechané neděle=1, 2 pondělí=1, 3 pondělí=0, 11 až 17 týden od pondělí do neděle.",
      },
    ],
  },
  {
    n: "WEEKNUM",
    d: "Vrátí číslo týdne konkrétního data.",
    a: "Číslo týdne v roce.",
    p: [
      {
        name: "pořadové_číslo",
        detail: "Datum v týdnu.",
      },
      {
        name: "návratový_typ",
        detail:
          "Den, kdy týden začíná: 1 nebo vynechaná neděle, 2 pondělí, 11 až 17 pondělí až neděle, 21 ISO 8601.",
      },
    ],
  },
  {
    n: "WEIBULL",
    d: "Vrátí Weibullovo rozdělení.",
    a: "Weibullova distribuce (kompatibilita).",
    p: [
      {
        name: "x",
        detail: "Hodnota, při které se má funkce vyhodnotit.",
      },
      {
        name: "alfa",
        detail: "Parametr rozdělení.",
      },
      {
        name: "beta",
        detail: "Parametr rozdělení.",
      },
      {
        name: "kumulativní",
        detail: "TRUE pro kumulativní rozdělení, FALSE pro hustotu.",
      },
    ],
  },
  {
    n: "WEIBULL.DIST",
    d: "Vrátí Weibullovo rozdělení, běžně používané v analýze spolehlivosti.",
    a: "Weibullova distribuce.",
    p: [
      {
        name: "x",
        detail: "Hodnota, při které se má funkce vyhodnotit.",
      },
      {
        name: "alfa",
        detail: "Parametr distribuce.",
      },
      {
        name: "beta",
        detail: "Parametr distribuce.",
      },
      {
        name: "kumulativní",
        detail:
          "TRUE vrací funkci kumulativního rozdělení, FALSE funkci hustoty pravděpodobnosti.",
      },
    ],
  },
  {
    n: "WORKDAY",
    d: "Vrátí pořadové číslo data před nebo po zadaném počtu pracovních dnů, kromě víkendů a svátků.",
    a: "Datum za několik pracovních dnů.",
    p: [
      {
        name: "datum_zahájení",
        detail: "Datum, které představuje počáteční datum.",
      },
      {
        name: "dny",
        detail:
          "Počet dní mimo víkend a nesvátků před nebo po `datum_zahájení`.",
      },
      {
        name: "svátky",
        detail:
          "Volitelný rozsah jednoho nebo více dat k vyloučení z pracovního kalendáře.",
      },
    ],
  },
  {
    n: "WORKDAY.INTL",
    d: "Vrátí pořadové číslo data před nebo po zadaném počtu pracovních dnů s vlastními parametry víkendu.",
    a: "Datum posunuté o počet pracovních dnů s volitelným nastavením víkendu.",
    p: [
      {
        name: "datum_zahájení",
        detail: "Datum zahájení.",
      },
      {
        name: "dny",
        detail: "Počet pracovních dnů před nebo po `datum_zahájení`.",
      },
      {
        name: "víkend",
        detail:
          'Víkendové číslo (1 sobota–neděle, 2 neděle–pondělí, ..., pouze neděle 11, ..., pouze 17 sobota) nebo sedmimístný řetězec, například "0000011".',
      },
      {
        name: "svátky",
        detail:
          "Volitelná sada jednoho nebo více dat k vyloučení z pracovního kalendáře.",
      },
    ],
  },
  {
    n: "WRAPCOLS",
    d: "Zabalí poskytnutý řádek nebo sloupec hodnot do sloupců po zadaném počtu prvků za účelem vytvoření nového pole.",
    a: "Zabalí vektor do sloupců.",
    p: [
      {
        name: "vektor",
        detail: "Vektor nebo odkaz na obal.",
      },
      {
        name: "počet_před_zalomením",
        detail: "Maximální počet hodnot pro každý sloupec.",
      },
      {
        name: "doplnit_hodnotou",
        detail: "Hodnota, se kterou se má vyplnit; výchozí hodnota je #N/A.",
      },
    ],
  },
  {
    n: "WRAPROWS",
    d: "Zabalí poskytnutý řádek nebo sloupec hodnot do řádků po zadaném počtu prvků za účelem vytvoření nového pole.",
    a: "Zabalí vektor do řádků.",
    p: [
      {
        name: "vektor",
        detail: "Vektor nebo odkaz na obal.",
      },
      {
        name: "počet_před_zalomením",
        detail: "Maximální počet hodnot pro každý řádek.",
      },
      {
        name: "doplnit_hodnotou",
        detail: "Hodnota, se kterou se má vyplnit; výchozí hodnota je #N/A.",
      },
    ],
  },
  {
    n: "XIRR",
    d: "Vrací vnitřní míru návratnosti pro rozvrh peněžních toků, které nejsou nutně periodické.",
    a: "IRR nepravidelných peněžních toků.",
    p: [
      {
        name: "hodnoty",
        detail:
          "Řada peněžních toků, která odpovídá rozvrhu plateb v `kalendářní_data`.",
      },
      {
        name: "kalendářní_data",
        detail:
          "Harmonogram platebních dat, který odpovídá platbám peněžních toků.",
      },
      {
        name: "odhad",
        detail:
          "Číslo, které uhodnete, se blíží výsledku; výchozí hodnota je 0,1 (10 procent).",
      },
    ],
  },
  {
    n: "XLOOKUP",
    d: "Prohledá rozsah nebo pole a vrátí položku odpovídající první nalezené shodě. Pokud žádná shoda neexistuje, XLOOKUP může vrátit nejbližší (přibližnou) shodu.",
    a: "Vyhledá hodnotu a vrátí shodu.",
    p: [
      {
        name: "hledaná_hodnota",
        detail: "Hodnota, kterou chcete vyhledat.",
      },
      {
        name: "vyhledávací_pole",
        detail: "Pole nebo rozsah, který se má hledat.",
      },
      {
        name: "návratové_pole",
        detail: "Pole nebo rozsah, který se má vrátit.",
      },
      {
        name: "pokud_nebyl_nalezen",
        detail:
          "Hodnota, která se má vrátit, pokud není nalezena žádná platná shoda; výchozí hodnota je #N/A.",
      },
      {
        name: "režim_shody",
        detail:
          "0 přesná shoda (výchozí), -1 přesná shoda nebo další menší položka, 1 přesná shoda nebo další větší položka, 2 shoda zástupných znaků, 3 shoda regulárního výrazu.",
      },
      {
        name: "režim_vyhledávání",
        detail:
          "1 vyhledávání od prvního k poslednímu (výchozí), -1 od posledního k prvnímu, 2 binární vyhledávání vzestupně, -2 binární vyhledávání sestupně.",
      },
    ],
  },
  {
    n: "XMATCH",
    d: "Vyhledá zadanou položku v poli nebo rozsahu buněk a vrátí relativní pozici položky.",
    a: "Pozice hodnoty v rozsahu.",
    p: [
      {
        name: "hledaná_hodnota",
        detail: "Hodnota, kterou chcete vyhledat.",
      },
      {
        name: "vyhledávací_pole",
        detail: "Pole nebo rozsah, který se má hledat.",
      },
      {
        name: "režim_shody",
        detail:
          "0 přesná shoda (výchozí), -1 přesná shoda nebo další menší položka, 1 přesná shoda nebo další větší položka, 2 shoda zástupných znaků, 3 shoda regulárního výrazu.",
      },
      {
        name: "režim_vyhledávání",
        detail:
          "1 vyhledávání od prvního k poslednímu (výchozí), -1 od posledního k prvnímu, 2 binární vyhledávání vzestupně, -2 binární vyhledávání sestupně.",
      },
    ],
  },
  {
    n: "XNPV",
    d: "Vrátí čistou současnou hodnotu pro rozvrh peněžních toků, které nejsou nutně periodické.",
    a: "NPV nepravidelných peněžních toků.",
    p: [
      {
        name: "sazba",
        detail: "Diskontní sazba, která se má použít na peněžní toky.",
      },
      {
        name: "hodnoty",
        detail:
          "Řada peněžních toků, která odpovídá rozvrhu plateb v `kalendářní_data`.",
      },
      {
        name: "kalendářní_data",
        detail:
          "Harmonogram platebních dat, který odpovídá platbám peněžních toků.",
      },
    ],
  },
  {
    n: "XOR",
    d: "Vrátí logický exkluzivní OR všech argumentů: TRUE, když je lichý počet argumentů TRUE.",
    a: "Exkluzivní OR argumentů.",
    p: [
      {
        name: "logický1",
        detail:
          "První podmínka k testování, která může být vyhodnocena jako TRUE nebo FALSE.",
      },
      {
        name: "logický2",
        detail: "Další podmínky k testování, celkem až 254.",
      },
    ],
  },
  {
    n: "YEAR",
    d: "Vrátí rok odpovídající datu jako celé číslo v rozsahu 1900 až 9999.",
    a: "Rok data.",
    p: [
      {
        name: "pořadové_číslo",
        detail: "Datum roku, který chcete najít.",
      },
    ],
  },
  {
    n: "YEARFRAC",
    d: "Vypočítá zlomek roku reprezentovaný počtem celých dnů mezi dvěma daty.",
    a: "Zlomek roku mezi daty.",
    p: [
      {
        name: "datum_zahájení",
        detail: "Datum, které představuje počáteční datum.",
      },
      {
        name: "koncové_datum",
        detail: "Datum, které představuje datum ukončení.",
      },
      {
        name: "základna",
        detail:
          "Základ počtu dnů: 0 nebo vynecháno US 30/360, 1 skutečný/skutečný, 2 aktuální/360, 3 aktuální/365, 4 evropské 30/360.",
      },
    ],
  },
  {
    n: "YIELD",
    d: "Vrátí výnos z cenného papíru, který platí periodický úrok.",
    a: "Výnos cenného papíru s periodickým úrokem.",
    p: [
      {
        name: "datum_vypořádání",
        detail: "Datum vypořádání cenného papíru.",
      },
      {
        name: "datum_splatnosti",
        detail: "Datum splatnosti cenného papíru.",
      },
      {
        name: "sazba",
        detail: "Roční kupónová sazba cenného papíru.",
      },
      {
        name: "cena",
        detail: "Cena cenného papíru za nominální hodnotu 100 $.",
      },
      {
        name: "výkupní_hodnota",
        detail: "Výkupní hodnota cenného papíru za nominální hodnotu 100 $.",
      },
      {
        name: "frekvence",
        detail:
          "Počet výplat kuponů za rok: 1 roční, 2 pololetní, 4 čtvrtletní.",
      },
      {
        name: "základna",
        detail:
          "Základ počtu dnů: 0 nebo vynecháno US 30/360, 1 skutečný/skutečný, 2 aktuální/360, 3 aktuální/365, 4 evropské 30/360.",
      },
    ],
  },
  {
    n: "YIELDDISC",
    d: "Vrátí roční výnos diskontovaného cenného papíru.",
    a: "Výnos zlevněného cenného papíru.",
    p: [
      {
        name: "datum_vypořádání",
        detail: "Datum vypořádání cenného papíru.",
      },
      {
        name: "datum_splatnosti",
        detail: "Datum splatnosti cenného papíru.",
      },
      {
        name: "cena",
        detail: "Cena cenného papíru za nominální hodnotu 100 $.",
      },
      {
        name: "výkupní_hodnota",
        detail: "Výkupní hodnota cenného papíru za nominální hodnotu 100 $.",
      },
      {
        name: "základna",
        detail:
          "Základ počtu dnů: 0 nebo vynecháno US 30/360, 1 skutečný/skutečný, 2 aktuální/360, 3 aktuální/365, 4 evropské 30/360.",
      },
    ],
  },
  {
    n: "YIELDMAT",
    d: "Vrátí roční výnos cenného papíru, který platí úrok při splatnosti.",
    a: "Výnos cenného papíru vypláceného při splatnosti.",
    p: [
      {
        name: "datum_vypořádání",
        detail: "Datum vypořádání cenného papíru.",
      },
      {
        name: "datum_splatnosti",
        detail: "Datum splatnosti cenného papíru.",
      },
      {
        name: "datum_emise",
        detail: "Datum vydání cenného papíru.",
      },
      {
        name: "sazba",
        detail: "Úroková sazba cenného papíru k datu emise.",
      },
      {
        name: "cena",
        detail: "Cena cenného papíru za nominální hodnotu 100 $.",
      },
      {
        name: "základna",
        detail:
          "Základ počtu dnů: 0 nebo vynecháno US 30/360, 1 skutečný/skutečný, 2 aktuální/360, 3 aktuální/365, 4 evropské 30/360.",
      },
    ],
  },
  {
    n: "Z.TEST",
    d: "Vrátí jednostrannou P-hodnotu z-testu.",
    a: "Jednostranná P-hodnota z-testu.",
    p: [
      {
        name: "pole",
        detail: "Pole nebo rozsah dat, proti kterým se má testovat `x`.",
      },
      {
        name: "x",
        detail: "Hodnota k testování.",
      },
      {
        name: "sigma",
        detail:
          "Populační (známá) standardní odchylka; je-li vynechána, použije se směrodatná odchylka vzorku.",
      },
    ],
  },
  {
    n: "ZTEST",
    d: "Vrátí jednostrannou P-hodnotu z-testu. Zachováno pro kompatibilitu; viz Z.TEST.",
    a: "Jednostranný z-test P-hodnota (starší).",
    p: [
      {
        name: "pole",
        detail: "Pole nebo rozsah dat, proti kterým se má testovat `x`.",
      },
      {
        name: "x",
        detail: "Hodnota k testování.",
      },
      {
        name: "sigma",
        detail:
          "Populační (známá) standardní odchylka; je-li vynechána, použije se směrodatná odchylka vzorku.",
      },
    ],
  },
  {
    n: "MODE",
    d: "Vrátí nejčastěji se vyskytující hodnotu v sadě dat. Zachováno pro kompatibilitu; viz MODE.SNGL.",
    a: "Nejběžnější hodnota (kompatibilita).",
    p: [
      {
        name: "číslo1",
        detail: "První číslo nebo rozsah k vyhodnocení.",
      },
      {
        name: "číslo2",
        detail: "Další čísla nebo rozsahy, celkem až 254.",
      },
    ],
  },
  {
    n: "STDEV",
    d: "Odhaduje směrodatnou odchylku na základě vzorku. Zachováno pro kompatibilitu; viz STDEV.S.",
    a: "Výběrová směrodatná odchylka (kompatibilita).",
    p: [
      {
        name: "číslo1",
        detail: "První číslo nebo rozsah odpovídající vzorku populace.",
      },
      {
        name: "číslo2",
        detail: "Další čísla nebo rozsahy, celkem až 254.",
      },
    ],
  },
  {
    n: "VAR",
    d: "Odhaduje rozptyl na základě vzorku. Zachováno pro kompatibilitu; viz VAR.S.",
    a: "Výběrový rozptyl (kompatibilita).",
    p: [
      {
        name: "číslo1",
        detail: "První číslo nebo rozsah odpovídající vzorku populace.",
      },
      {
        name: "číslo2",
        detail: "Další čísla nebo rozsahy, celkem až 254.",
      },
    ],
  },
  {
    n: "RANK",
    d: "Vrátí pořadí čísla v seznamu čísel. Zachováno pro kompatibilitu; viz RANK.EQ.",
    a: "Hodnost čísla (kompatibilita).",
    p: [
      {
        name: "číslo",
        detail: "Číslo, jehož hodnost chcete najít.",
      },
      {
        name: "odkaz",
        detail: "Seznam čísel; nečíselné hodnoty jsou ignorovány.",
      },
      {
        name: "pořadí",
        detail:
          "0 nebo vynechané pozice v sestupném pořadí; jakákoli jiná hodnota se řadí vzestupně.",
      },
    ],
  },
  {
    n: "PERCENTILE",
    d: "Vrátí k-tý percentil hodnot v rozsahu. Zachováno pro kompatibilitu; viz PERCENTILE.INC.",
    a: "k-tý percentil (kompatibilita).",
    p: [
      {
        name: "pole",
        detail: "Pole nebo rozsah dat, které definují relativní postavení.",
      },
      {
        name: "k",
        detail: "Hodnota percentilu v rozsahu 0 až 1 včetně.",
      },
    ],
  },
  {
    n: "QUARTILE",
    d: "Vrátí kvartil souboru dat. Zachováno pro kompatibilitu; viz QUARTILE.INC.",
    a: "Kvartil souboru dat (starší).",
    p: [
      {
        name: "pole",
        detail: "Pole nebo rozsah číselných hodnot.",
      },
      {
        name: "kvartil",
        detail:
          "Jakou hodnotu vrátit: 0 minimum, 1 první kvartil, 2 medián, 3 třetí kvartil, 4 maximum.",
      },
    ],
  },
];

export default translations;
