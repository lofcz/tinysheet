import type { FunctionListTranslation } from "./types";

const translations: FunctionListTranslation[] = [
  {
    n: "ABS",
    d: "Vráti absolútnu hodnotu čísla, teda číslo bez znamienka.",
    a: "Absolútna hodnota čísla.",
    p: [
      {
        name: "číslo",
        detail: "Reálne číslo, ktorého absolútnu hodnotu chcete.",
      },
    ],
  },
  {
    n: "ACCRINT",
    d: "Vráti naakumulovaný úrok pre cenný papier, ktorý platí periodický úrok.",
    a: "Naakumulovaný úrok z cenného papiera s periodickým úrokom.",
    p: [
      {
        name: "dátum_emisie",
        detail: "Dátum vydania cenného papiera.",
      },
      {
        name: "prvý_úrok",
        detail: "Dátum prvého úročenia cenného papiera.",
      },
      {
        name: "dátum_vyrovnania",
        detail:
          "Dátum vyrovnania cenného papiera po dátume emisie, keď sa cenný papier obchoduje s kupujúcim.",
      },
      {
        name: "sadzba",
        detail: "Ročná kupónová sadzba cenného papiera.",
      },
      {
        name: "menovitá_hodnota",
        detail:
          "Nominálna hodnota cenného papiera; predvolená hodnota je 1 000 USD.",
      },
      {
        name: "frekvencia",
        detail:
          "Počet výplat kupónov za rok: 1 ročná, 2 polročné, 4 štvrťročné.",
      },
      {
        name: "základňa",
        detail:
          "Základ počtu dní: 0 alebo vynechané US 30/360, 1 skutočný/aktuálny, 2 skutočné/360, 3 skutočné/365, 4 európske 30/360.",
      },
      {
        name: "metóda_výpočtu",
        detail:
          "TRUE alebo vynechané vráti celkový naakumulovaný úrok od emisie po vyrovnanie; FALSE od prvý_úrok do vyrovnania.",
      },
    ],
  },
  {
    n: "ACCRINTM",
    d: "Vráti naakumulovaný úrok pre cenný papier, ktorý platí úrok pri splatnosti.",
    a: "Naakumulovaný úrok cenného papiera vyplácaného pri splatnosti.",
    p: [
      {
        name: "dátum_emisie",
        detail: "Dátum vydania cenného papiera.",
      },
      {
        name: "dátum_vyrovnania",
        detail: "Dátum splatnosti cenného papiera.",
      },
      {
        name: "sadzba",
        detail: "Ročná kupónová sadzba cenného papiera.",
      },
      {
        name: "menovitá_hodnota",
        detail:
          "Nominálna hodnota cenného papiera; predvolená hodnota je 1 000 USD.",
      },
      {
        name: "základňa",
        detail:
          "Základ počtu dní: 0 alebo vynechané US 30/360, 1 skutočný/aktuálny, 2 skutočné/360, 3 skutočné/365, 4 európske 30/360.",
      },
    ],
  },
  {
    n: "ACOS",
    d: "Vráti arkkozín (inverzný kosínus) čísla v radiánoch v rozsahu 0 až pi.",
    a: "Inverzný kosínus, v radiánoch.",
    p: [
      {
        name: "číslo",
        detail: "Kosínus požadovaného uhla; musí byť medzi -1 a 1.",
      },
    ],
  },
  {
    n: "ACOSH",
    d: "Vráti inverzný hyperbolický kosínus čísla.",
    a: "Inverzný hyperbolický kosínus.",
    p: [
      {
        name: "číslo",
        detail: "Akékoľvek reálne číslo väčšie alebo rovné 1.",
      },
    ],
  },
  {
    n: "ACOT",
    d: "Vráti hlavnú hodnotu arkotangensu (inverzného kotangensu) čísla v radiánoch v rozsahu od 0 do pi.",
    a: "Inverzný kotangens, v radiánoch.",
    p: [
      {
        name: "číslo",
        detail: "Kotangens požadovaného uhla.",
      },
    ],
  },
  {
    n: "ACOTH",
    d: "Vráti inverzný hyperbolický kotangens čísla.",
    a: "Inverzný hyperbolický kotangens.",
    p: [
      {
        name: "číslo",
        detail: "Číslo, ktorého absolútna hodnota musí byť väčšia ako 1.",
      },
    ],
  },
  {
    n: "ADDRESS",
    d: "Vráti adresu bunky v pracovnom hárku ako text so zadanými číslami riadkov a stĺpcov.",
    a: "Adresa bunky ako text.",
    p: [
      {
        name: "číslo_riadka",
        detail: "Číslo riadka, ktoré sa má použiť v odkaze na bunku.",
      },
      {
        name: "stĺpec_č",
        detail: "Číslo stĺpca, ktoré sa má použiť v odkaze na bunku.",
      },
      {
        name: "typ_odkazu",
        detail:
          "Typ odkazu: 1 alebo vynechaný absolútny, 2 absolútne riadky, 3 absolútne stĺpce, 4 relatívne.",
      },
      {
        name: "a1",
        detail:
          "TRUE alebo vynechané vráti odkaz v štýle A1; FALSE vráti referenciu v štýle R1C1.",
      },
      {
        name: "text_listu",
        detail: "Názov pracovného hárka, ktorý sa má použiť ako externý odkaz.",
      },
    ],
  },
  {
    n: "AGGREGATE",
    d: "Vráti súhrn (napríklad SUM, AVERAGE, COUNT alebo LARGE) zoznamu alebo databázy s možnosťami ignorovania skrytých riadkov a chybových hodnôt.",
    a: "Agregát, ktorý môže ignorovať skryté riadky a chyby.",
    p: [
      {
        name: "funkcia_č",
        detail:
          "Číslo od 1 do 19 určujúce funkciu: 1 AVERAGE, 2 COUNT, 3 COUNTA, 4 MAX, 5 MIN, 6 PRODUCT, 7 STDEV.S, 8 STDEV.P, 9 SUM, 10 VAR.S, 11 VAR.P, 12 MEDIAN, 13 MODE.SNGL, 14 LARGE, 15 SMALL, 16 PERCENTILE.INC, 17 QUARTILE.INC, 18 PERCENTILE.EXC, 19 QUARTILE.EXC.",
      },
      {
        name: "možnosti",
        detail:
          "Ktoré hodnoty ignorovať: 0 alebo vynechané vnorené SUBTOTAL/AGGREGATE, 1 tiež skryté riadky, 2 aj chybové hodnoty, 3 všetky tieto, 4 nič, iba 5 skrytých riadkov, 6 iba chybových hodnôt, 7 skrytých riadkov a chybové hodnoty.",
      },
      {
        name: "odkaz_1",
        detail:
          "Prvý číselný argument alebo rozsah. Pre funkcie 14 až 19 je to pole na vyhodnotenie.",
      },
      {
        name: "odkaz_2",
        detail:
          "Ďalšie rozsahy na agregáciu alebo pre funkcie 14 až 19 požadovaný druhý argument k (pozícia alebo kvartil).",
      },
    ],
  },
  {
    n: "AMORDEGRC",
    d: "Vráti odpisy za každé účtovné obdobie pomocou odpisového koeficientu (francúzsky účtovný systém).",
    a: "Degresívne odpisy za účtovné obdobie.",
    p: [
      {
        name: "obstarávacia_cena",
        detail: "Obstarávacia cena aktíva.",
      },
      {
        name: "dátum_zakúpenia",
        detail: "Dátum nákupu aktíva.",
      },
      {
        name: "prvé_obdobie",
        detail: "Dátum konca prvého obdobia.",
      },
      {
        name: "zostatková_hodnota",
        detail: "Zostatková hodnota na konci životnosti majetku.",
      },
      {
        name: "obdobie",
        detail: "Obdobie.",
      },
      {
        name: "sadzba",
        detail: "Miera odpisov.",
      },
      {
        name: "základňa",
        detail:
          "Ročný základ: 0 360 dní, 1 skutočný, 3 365 dní, 4 európske 360.",
      },
    ],
  },
  {
    n: "AMORLINC",
    d: "Vráti odpisy za každé účtovné obdobie (francúzsky účtovný systém, lineárny).",
    a: "Lineárne odpisy za účtovné obdobie.",
    p: [
      {
        name: "obstarávacia_cena",
        detail: "Obstarávacia cena aktíva.",
      },
      {
        name: "dátum_zakúpenia",
        detail: "Dátum nákupu aktíva.",
      },
      {
        name: "prvé_obdobie",
        detail: "Dátum konca prvého obdobia.",
      },
      {
        name: "zostatková_hodnota",
        detail: "Zostatková hodnota na konci životnosti majetku.",
      },
      {
        name: "obdobie",
        detail: "Obdobie.",
      },
      {
        name: "sadzba",
        detail: "Miera odpisov.",
      },
      {
        name: "základňa",
        detail:
          "Ročný základ: 0 360 dní, 1 skutočný, 3 365 dní, 4 európske 360.",
      },
    ],
  },
  {
    n: "AND",
    d: "Vráti TRUE, ak sa všetky jeho argumenty vyhodnotia ako TRUE, a FALSE, ak sa jeden alebo viacero argumentov vyhodnotí ako FALSE.",
    a: "TRUE, ak sú všetky argumenty TRUE.",
    p: [
      {
        name: "logický1",
        detail:
          "Prvá podmienka na testovanie, ktorá môže byť vyhodnotená ako TRUE alebo FALSE.",
      },
      {
        name: "logický2",
        detail: "Ďalšie podmienky na testovanie, celkovo až 255.",
      },
    ],
  },
  {
    n: "ARABIC",
    d: "Prevedie rímsku číslicu na arabské číslo.",
    a: "Skonvertuje rímsku číslicu na číslo.",
    p: [
      {
        name: "text",
        detail:
          "Reťazec v úvodzovkách, prázdny reťazec alebo odkaz na bunku obsahujúcu text.",
      },
    ],
  },
  {
    n: "AREAS",
    d: "Vráti počet oblastí v referencii.",
    a: "Počet oblastí v referencii.",
    p: [
      {
        name: "odkaz",
        detail: "Odkaz na bunku alebo rozsah buniek.",
      },
    ],
  },
  {
    n: "ARRAYTOTEXT",
    d: "Vráti pole textových hodnôt z ľubovoľného zadaného rozsahu.",
    a: "Konvertuje pole na text.",
    p: [
      {
        name: "pole",
        detail: "Pole, ktoré sa má vrátiť ako text.",
      },
      {
        name: "formát",
        detail:
          "0 alebo vynechané vráti stručný, ľahko čitateľný formát; 1 vráti striktný formát s únikovými znakmi a oddeľovačmi riadkov, ktoré možno analyzovať ako vzorec.",
      },
    ],
  },
  {
    n: "ASC",
    d: "Zmení znaky s plnou šírkou (dvojbajtové) znaky na znaky s polovičnou šírkou (jednobajtové).",
    a: "Konvertovať na znaky polovičnej šírky.",
    p: [
      {
        name: "text",
        detail:
          "Text alebo odkaz na bunku, ktorá obsahuje text, ktorý sa má zmeniť.",
      },
    ],
  },
  {
    n: "ASIN",
    d: "Vráti arkussínus (inverzný sínus) čísla v radiánoch v rozsahu -pi/2 až pi/2.",
    a: "Inverzný sínus, v radiánoch.",
    p: [
      {
        name: "číslo",
        detail: "Sínus požadovaného uhla; musí byť medzi -1 a 1.",
      },
    ],
  },
  {
    n: "ASINH",
    d: "Vráti inverzný hyperbolický sínus čísla.",
    a: "Inverzný hyperbolický sínus.",
    p: [
      {
        name: "číslo",
        detail: "Akékoľvek reálne číslo.",
      },
    ],
  },
  {
    n: "ATAN",
    d: "Vráti arkustangens (inverzný tangens) čísla v radiánoch v rozsahu -pi/2 až pi/2.",
    a: "Inverzná tangens, v radiánoch.",
    p: [
      {
        name: "číslo",
        detail: "Tangent požadovaného uhla.",
      },
    ],
  },
  {
    n: "ATAN2",
    d: "Vráti arkustangens zadaných súradníc x a y v radiánoch medzi -pi a pi bez -pi.",
    a: "Arktangens zo súradníc x a y.",
    p: [
      {
        name: "číslo_x",
        detail: "X-ová súradnica bodu.",
      },
      {
        name: "číslo_y",
        detail: "Y-ová súradnica bodu.",
      },
    ],
  },
  {
    n: "ATANH",
    d: "Vráti inverzný hyperbolický tangens čísla.",
    a: "Inverzný hyperbolický tangens.",
    p: [
      {
        name: "číslo",
        detail: "Akékoľvek reálne číslo medzi -1 a 1, s výnimkou.",
      },
    ],
  },
  {
    n: "AVEDEV",
    d: "Vráti priemer absolútnych odchýlok dátových bodov od ich priemeru.",
    a: "Priemerná absolútna odchýlka od priemeru.",
    p: [
      {
        name: "číslo1",
        detail: "Prvé číslo alebo rozsah.",
      },
      {
        name: "číslo2",
        detail: "Ďalšie čísla alebo rozsahy, celkovo až 255.",
      },
    ],
  },
  {
    n: "AVERAGE",
    d: "Vráti priemer (aritmetický priemer) argumentov, ignoruje text a logické hodnoty v rozsahoch.",
    a: "Aritmetický priemer čísel.",
    p: [
      {
        name: "číslo1",
        detail:
          "Prvé číslo, odkaz na bunku alebo rozsah, pre ktorý chcete priemer.",
      },
      {
        name: "číslo2",
        detail: "Ďalšie čísla alebo rozsahy, celkovo až 255.",
      },
    ],
  },
  {
    n: "AVERAGEA",
    d: "Vráti priemer svojich argumentov, pričom text vyhodnotí ako 0 a logické hodnoty ako 1 alebo 0.",
    a: "Priemer vrátane textu a logických hodnôt.",
    p: [
      {
        name: "hodnota1",
        detail: "Prvá hodnota, odkaz na bunku alebo rozsah.",
      },
      {
        name: "hodnota2",
        detail: "Ďalšie hodnoty alebo rozsahy, celkovo až 255.",
      },
    ],
  },
  {
    n: "AVERAGEIF",
    d: "Vráti priemer (aritmetický priemer) všetkých buniek v rozsahu, ktoré spĺňajú dané kritérium.",
    a: "Priemer buniek, ktoré spĺňajú podmienku.",
    p: [
      {
        name: "rozsah",
        detail: "Bunky na testovanie proti `kritériá`.",
      },
      {
        name: "kritériá",
        detail:
          "Podmienka ako číslo, výraz, odkaz na bunku alebo text, ktorý definuje, ktoré bunky sú spriemerované.",
      },
      {
        name: "priemerovaný_rozsah",
        detail: "Bunky, ktoré sa majú spriemerovať, ak sa líšia od `rozsah`.",
      },
    ],
  },
  {
    n: "AVERAGEIFS",
    d: "Vráti priemer (aritmetický priemer) všetkých buniek, ktoré spĺňajú viaceré kritériá.",
    a: "Priemer buniek, ktoré spĺňajú viaceré kritériá.",
    p: [
      {
        name: "priemerovaný_rozsah",
        detail: "Bunky na priemer.",
      },
      {
        name: "rozsah_kritérií1",
        detail: "Rozsah, ktorý je testovaný pomocou `kritériá_1`.",
      },
      {
        name: "kritériá_1",
        detail:
          "Kritériá, ktoré definujú, ktoré bunky v `rozsah_kritérií1` sú zahrnuté.",
      },
      {
        name: "rozsah_kritérií2",
        detail: "Ďalšie rozsahy na testovanie, až 127 párov rozsah/kritérium.",
      },
      {
        name: "kritériá2",
        detail: "Kritériá pre zodpovedajúci dodatočný rozsah.",
      },
    ],
  },
  {
    n: "BAHTTEXT",
    d: 'Skonvertuje číslo na thajský text a pridá príponu "Baht".',
    a: "Číslo ako text thajských bahtov.",
    p: [
      {
        name: "číslo",
        detail: "Číslo, ktoré sa má previesť na text.",
      },
    ],
  },
  {
    n: "BASE",
    d: "Konvertuje číslo na textovú reprezentáciu v danom radixe (základe).",
    a: "Konvertuje číslo na text v inom základe.",
    p: [
      {
        name: "číslo",
        detail:
          "Číslo, ktoré sa má previesť; celé číslo väčšie alebo rovné 0 a menšie ako 2^53.",
      },
      {
        name: "základ_sústavy",
        detail: "Základ na konverziu; celé číslo od 2 do 36.",
      },
      {
        name: "dĺžka_min",
        detail: "Minimálna dĺžka vráteného reťazca, doplnená úvodnými nulami.",
      },
    ],
  },
  {
    n: "BESSELI",
    d: "Vráti upravenú Besselovu funkciu In(x), ktorá je ekvivalentom Besselovej funkcie vyhodnotenej pre čisto imaginárne argumenty.",
    a: "Modifikovaná Besselova funkcia In(x).",
    p: [
      {
        name: "x",
        detail: "Hodnota, pri ktorej sa má funkcia vyhodnotiť.",
      },
      {
        name: "n",
        detail: "Poradie Besselovej funkcie; skrátené na celé číslo.",
      },
    ],
  },
  {
    n: "BESSELJ",
    d: "Vráti Besselovu funkciu Jn(x).",
    a: "Besselova funkcia Jn(x).",
    p: [
      {
        name: "x",
        detail: "Hodnota, pri ktorej sa má funkcia vyhodnotiť.",
      },
      {
        name: "n",
        detail: "Poradie Besselovej funkcie; skrátené na celé číslo.",
      },
    ],
  },
  {
    n: "BESSELK",
    d: "Vráti upravenú Besselovu funkciu Kn(x), ktorá je ekvivalentná Besselovým funkciám vyhodnoteným pre čisto imaginárne argumenty.",
    a: "Modifikovaná Besselova funkcia Kn(x).",
    p: [
      {
        name: "x",
        detail: "Hodnota, pri ktorej sa má funkcia vyhodnotiť.",
      },
      {
        name: "n",
        detail: "Poradie funkcie; skrátené na celé číslo.",
      },
    ],
  },
  {
    n: "BESSELY",
    d: "Vráti Besselovu funkciu Yn(x), nazývanú aj Weberova funkcia alebo Neumannova funkcia.",
    a: "Besselova funkcia Yn(x).",
    p: [
      {
        name: "x",
        detail: "Hodnota, pri ktorej sa má funkcia vyhodnotiť.",
      },
      {
        name: "n",
        detail: "Poradie funkcie; skrátené na celé číslo.",
      },
    ],
  },
  {
    n: "BETA.DIST",
    d: "Vráti distribúciu beta, ktorá sa bežne používa na štúdium variácií percenta niečoho vo vzorkách.",
    a: "Distribúcia beta.",
    p: [
      {
        name: "x",
        detail: "Hodnota medzi `A` a `B`, pri ktorej sa má funkcia vyhodnotiť.",
      },
      {
        name: "alfa",
        detail: "Parameter distribúcie.",
      },
      {
        name: "beta",
        detail: "Parameter distribúcie.",
      },
      {
        name: "kumulatívne",
        detail:
          "TRUE vráti funkciu kumulatívneho rozdelenia, FALSE funkciu hustoty pravdepodobnosti.",
      },
      {
        name: "A",
        detail: "Dolná hranica intervalu x; predvolene je 0.",
      },
      {
        name: "B",
        detail: "Horná hranica intervalu x; predvolene je 1.",
      },
    ],
  },
  {
    n: "BETA.INV",
    d: "Vráti inverznú hodnotu funkcie hustoty kumulatívnej pravdepodobnosti beta.",
    a: "Inverzná distribúcia beta.",
    p: [
      {
        name: "pravdepodobnosť",
        detail: "Pravdepodobnosť spojená s beta distribúciou.",
      },
      {
        name: "alfa",
        detail: "Parameter distribúcie.",
      },
      {
        name: "beta",
        detail: "Parameter distribúcie.",
      },
      {
        name: "A",
        detail: "Dolná hranica intervalu x; predvolene je 0.",
      },
      {
        name: "B",
        detail: "Horná hranica intervalu x; predvolene je 1.",
      },
    ],
  },
  {
    n: "BETADIST",
    d: "Vráti kumulatívnu funkciu hustoty pravdepodobnosti beta. Zachované z dôvodu kompatibility; pozri BETA.DIST.",
    a: "Kumulatívna beta distribúcia (staršie).",
    p: [
      {
        name: "x",
        detail: "Hodnota medzi `A` a `B`, pri ktorej sa má funkcia vyhodnotiť.",
      },
      {
        name: "alfa",
        detail: "Parameter distribúcie.",
      },
      {
        name: "beta",
        detail: "Parameter distribúcie.",
      },
      {
        name: "A",
        detail: "Dolná hranica intervalu x; predvolene je 0.",
      },
      {
        name: "B",
        detail: "Horná hranica intervalu x; predvolene je 1.",
      },
    ],
  },
  {
    n: "BETAINV",
    d: "Vráti inverznú hodnotu funkcie hustoty pravdepodobnosti kumulatívnej beta. Zachované z dôvodu kompatibility; pozri BETA.INV.",
    a: "Inverzná beta distribúcia (staršie).",
    p: [
      {
        name: "pravdepodobnosť",
        detail: "Pravdepodobnosť spojená s beta distribúciou.",
      },
      {
        name: "alfa",
        detail: "Parameter distribúcie.",
      },
      {
        name: "beta",
        detail: "Parameter distribúcie.",
      },
      {
        name: "A",
        detail: "Dolná hranica intervalu x; predvolene je 0.",
      },
      {
        name: "B",
        detail: "Horná hranica intervalu x; predvolene je 1.",
      },
    ],
  },
  {
    n: "BIN2DEC",
    d: "Konvertuje binárne číslo na desiatkové.",
    a: "Z binárneho k desiatkovému.",
    p: [
      {
        name: "číslo",
        detail:
          "Binárne číslo na konverziu; maximálne 10 znakov (bitov). Najvýznamnejším bitom je znamienkový bit.",
      },
    ],
  },
  {
    n: "BIN2HEX",
    d: "Konvertuje binárne číslo na hexadecimálne.",
    a: "Prevod z dvojkovej do šestnástkovej sústavy.",
    p: [
      {
        name: "číslo",
        detail: "Binárne číslo na konverziu; maximálne 10 znakov (bitov).",
      },
      {
        name: "počet_miest",
        detail:
          "Počet znakov, ktoré sa majú použiť; výsledok je doplnený vodiacimi nulami.",
      },
    ],
  },
  {
    n: "BIN2OCT",
    d: "Konvertuje binárne číslo na osmičkové.",
    a: "Prevod z dvojkovej do osmičkovej sústavy.",
    p: [
      {
        name: "číslo",
        detail: "Binárne číslo na konverziu; maximálne 10 znakov (bitov).",
      },
      {
        name: "počet_miest",
        detail:
          "Počet znakov, ktoré sa majú použiť; výsledok je doplnený vodiacimi nulami.",
      },
    ],
  },
  {
    n: "BINOM.DIST",
    d: "Vráti pravdepodobnosť binomického rozdelenia jednotlivých členov.",
    a: "Pravdepodobnosť binomického rozdelenia.",
    p: [
      {
        name: "počet_úspechov",
        detail: "Počet úspechov v pokusoch.",
      },
      {
        name: "pokusov",
        detail: "Počet nezávislých pokusov.",
      },
      {
        name: "pravdepodobnosť_úspechu",
        detail: "Pravdepodobnosť úspechu každého pokusu.",
      },
      {
        name: "kumulatívne",
        detail:
          "TRUE vráti funkciu kumulatívneho rozdelenia, FALSE funkciu hmotnosti pravdepodobnosti.",
      },
    ],
  },
  {
    n: "BINOM.DIST.RANGE",
    d: "Vráti pravdepodobnosť výsledku pokusu pomocou binomického rozdelenia.",
    a: "Pravdepodobnosť radu binomických výsledkov.",
    p: [
      {
        name: "pokusov",
        detail: "Počet nezávislých pokusov.",
      },
      {
        name: "pravdepodobnosť_úspechu",
        detail: "Pravdepodobnosť úspechu v každom pokuse.",
      },
      {
        name: "počet_úspechov",
        detail: "Počet úspechov v pokusoch.",
      },
      {
        name: "počet_úspechov2",
        detail:
          "Ak je zadaný, vráti pravdepodobnosť, že počet úspechov bude medzi `počet_úspechov` a `počet_úspechov2`.",
      },
    ],
  },
  {
    n: "BINOM.INV",
    d: "Vráti najmenšiu hodnotu, pre ktorú je kumulatívne binomické rozdelenie väčšie alebo rovné hodnote kritéria.",
    a: "Inverzné kumulatívne binomické rozdelenie.",
    p: [
      {
        name: "pokusov",
        detail: "Počet Bernoulliho pokusov.",
      },
      {
        name: "pravdepodobnosť_úspechu",
        detail: "Pravdepodobnosť úspechu každého pokusu.",
      },
      {
        name: "alfa",
        detail: "Hodnota kritéria.",
      },
    ],
  },
  {
    n: "BINOMDIST",
    d: "Vráti pravdepodobnosť binomického rozdelenia jednotlivých členov. Zachované z dôvodu kompatibility; pozri BINOM.DIST.",
    a: "Binomické rozdelenie (kompatibilita).",
    p: [
      {
        name: "počet_úspechov",
        detail: "Počet úspechov v pokusoch.",
      },
      {
        name: "pokusov",
        detail: "Počet nezávislých pokusov.",
      },
      {
        name: "pravdepodobnosť_úspechu",
        detail: "Pravdepodobnosť úspechu každého pokusu.",
      },
      {
        name: "kumulatívne",
        detail:
          "TRUE vráti funkciu kumulatívneho rozdelenia, FALSE funkciu hmotnosti pravdepodobnosti.",
      },
    ],
  },
  {
    n: "BITAND",
    d: "Vráti bitovú hodnotu 'AND' dvoch čísel.",
    a: "Bitovo AND.",
    p: [
      {
        name: "číslo1",
        detail: "Desatinné číslo väčšie alebo rovné 0.",
      },
      {
        name: "číslo2",
        detail: "Desatinné číslo väčšie alebo rovné 0.",
      },
    ],
  },
  {
    n: "BITLSHIFT",
    d: "Vráti číslo posunuté doľava o zadaný počet bitov.",
    a: "Bitový posun doľava.",
    p: [
      {
        name: "číslo",
        detail: "Celé číslo väčšie alebo rovné 0.",
      },
      {
        name: "počet_bitov_posunu",
        detail: "Počet bitov na posun; záporná hodnota sa posunie doprava.",
      },
    ],
  },
  {
    n: "BITOR",
    d: "Vráti bitovú hodnotu 'OR' dvoch čísel.",
    a: "Bitové OR.",
    p: [
      {
        name: "číslo1",
        detail: "Desatinné číslo väčšie alebo rovné 0.",
      },
      {
        name: "číslo2",
        detail: "Desatinné číslo väčšie alebo rovné 0.",
      },
    ],
  },
  {
    n: "BITRSHIFT",
    d: "Vráti číslo posunuté doprava o zadaný počet bitov.",
    a: "Bitový posun doprava.",
    p: [
      {
        name: "číslo",
        detail: "Celé číslo väčšie alebo rovné 0.",
      },
      {
        name: "počet_bitov_posunu",
        detail: "Počet bitov na posun; záporná hodnota sa posunie doľava.",
      },
    ],
  },
  {
    n: "BITXOR",
    d: "Vráti bitovú hodnotu 'XOR' (bez alebo) dvoch čísel.",
    a: "Bitovo XOR.",
    p: [
      {
        name: "číslo1",
        detail: "Číslo väčšie alebo rovné 0.",
      },
      {
        name: "číslo2",
        detail: "Číslo väčšie alebo rovné 0.",
      },
    ],
  },
  {
    n: "BYCOL",
    d: "Použije LAMBDA na každý stĺpec a vráti pole výsledkov.",
    a: "Na každý stĺpec sa použije LAMBDA.",
    p: [
      {
        name: "pole",
        detail: "Pole na oddelenie podľa stĺpcov.",
      },
      {
        name: "lambda",
        detail:
          "LAMBDA, ktorý berie stĺpec ako jeden parameter a počíta jeden výsledok.",
      },
    ],
  },
  {
    n: "BYROW",
    d: "Použije LAMBDA na každý riadok a vráti pole výsledkov.",
    a: "Na každý riadok sa použije LAMBDA.",
    p: [
      {
        name: "pole",
        detail: "Pole na oddelenie riadkom.",
      },
      {
        name: "lambda",
        detail:
          "LAMBDA, ktorý berie riadok ako jeden parameter a počíta jeden výsledok.",
      },
    ],
  },
  {
    n: "CEILING",
    d: "Zaokrúhli číslo nahor smerom od nuly na najbližší násobok významnosti.",
    a: "Zaokrúhli nahor na najbližší násobok.",
    p: [
      {
        name: "číslo",
        detail: "Hodnota, ktorú chcete zaokrúhliť.",
      },
      {
        name: "násobok",
        detail: "Násobok, na ktorý chcete zaokrúhliť.",
      },
    ],
  },
  {
    n: "CEILING.MATH",
    d: "Zaokrúhli číslo nahor na najbližšie celé číslo alebo na najbližší násobok významnosti s kontrolou nad smerom záporných čísel.",
    a: "Zaokrúhli nahor na najbližšie celé číslo alebo násobok.",
    p: [
      {
        name: "číslo",
        detail: "Hodnota, ktorú chcete zaokrúhliť.",
      },
      {
        name: "násobok",
        detail: "Násobok, na ktorý sa má zaokrúhliť; predvolene je 1.",
      },
      {
        name: "režim",
        detail:
          "Pre záporné čísla sa nenulová hodnota zaokrúhľuje od nuly; 0 alebo vynechané zaokrúhlenia smerom k nule.",
      },
    ],
  },
  {
    n: "CEILING.PRECISE",
    d: "Zaokrúhli číslo nahor na najbližšie celé číslo alebo na najbližší násobok významnosti bez ohľadu na znamienko čísla.",
    a: "Zaokrúhľuje sa nahor bez ohľadu na znamienko.",
    p: [
      {
        name: "číslo",
        detail: "Hodnota, ktorá sa má zaokrúhliť.",
      },
      {
        name: "násobok",
        detail:
          "Násobok, na ktorý je číslo zaokrúhlené; predvolená hodnota je 1. Jeho znamienko sa ignoruje.",
      },
    ],
  },
  {
    n: "CELL",
    d: "Vráti informácie o formátovaní, umiestnení alebo obsahu bunky.",
    a: "Informácie o bunke.",
    p: [
      {
        name: "typ_informácie",
        detail:
          'Typ požadovaných informácií, napríklad "address", "col", "row", "contents", "type", "format", "width" alebo "filename".',
      },
      {
        name: "odkaz",
        detail:
          "Bunka, o ktorej chcete informácie; predvolene sa použije posledná zmenená bunka.",
      },
    ],
  },
  {
    n: "CHAR",
    d: "Vráti znak určený číselným kódom.",
    a: "Znak z číselného kódu.",
    p: [
      {
        name: "číslo",
        detail: "Číslo medzi 1 a 255 určujúce, ktorý znak chcete.",
      },
    ],
  },
  {
    n: "CHIDIST",
    d: "Vráti pravostrannú pravdepodobnosť rozdelenia chí-kvadrát. Zachované z dôvodu kompatibility; pozri CHISQ.DIST.RT.",
    a: "Pravostranná distribúcia chí-kvadrát (staršie).",
    p: [
      {
        name: "x",
        detail: "Hodnota, pri ktorej chcete vyhodnotiť rozdelenie.",
      },
      {
        name: "stupne_voľnosti",
        detail: "Počet stupňov voľnosti.",
      },
    ],
  },
  {
    n: "CHIINV",
    d: "Vráti inverznú hodnotu pravdepodobnosti pravdepodobnosti chí-kvadrát rozdelenia. Zachované z dôvodu kompatibility; pozri CHISQ.INV.RT.",
    a: "Inverzná pravostranná chí-kvadrát (kompatibilita).",
    p: [
      {
        name: "pravdepodobnosť",
        detail: "Pravdepodobnosť spojená s distribúciou chí-kvadrát.",
      },
      {
        name: "stupne_voľnosti",
        detail: "Počet stupňov voľnosti.",
      },
    ],
  },
  {
    n: "CHISQ.DIST",
    d: "Vráti ľavostrannú pravdepodobnosť rozdelenia chí-kvadrát.",
    a: "Ľavostranné rozdelenie chí-kvadrát.",
    p: [
      {
        name: "x",
        detail: "Hodnota, pri ktorej chcete vyhodnotiť rozdelenie.",
      },
      {
        name: "stupne_voľnosti",
        detail: "Počet stupňov voľnosti.",
      },
      {
        name: "kumulatívne",
        detail:
          "TRUE vráti funkciu kumulatívneho rozdelenia, FALSE funkciu hustoty pravdepodobnosti.",
      },
    ],
  },
  {
    n: "CHISQ.DIST.RT",
    d: "Vráti pravostrannú pravdepodobnosť rozdelenia chí-kvadrát.",
    a: "Pravostranné rozdelenie chí-kvadrát.",
    p: [
      {
        name: "x",
        detail: "Hodnota, pri ktorej chcete vyhodnotiť rozdelenie.",
      },
      {
        name: "stupne_voľnosti",
        detail: "Počet stupňov voľnosti.",
      },
    ],
  },
  {
    n: "CHISQ.INV",
    d: "Vráti inverznú hodnotu k ľavostrannej pravdepodobnosti rozdelenia chí-kvadrát.",
    a: "Inverzné ľavostranné rozdelenie chí-kvadrát.",
    p: [
      {
        name: "pravdepodobnosť",
        detail: "Pravdepodobnosť spojená s distribúciou chí-kvadrát.",
      },
      {
        name: "stupne_voľnosti",
        detail: "Počet stupňov voľnosti.",
      },
    ],
  },
  {
    n: "CHISQ.INV.RT",
    d: "Vráti prevrátenú hodnotu pravdepodobnosti pravdepodobnosti chí-kvadrát rozdelenia.",
    a: "Inverzná pravostranná distribúcia chí-kvadrát.",
    p: [
      {
        name: "pravdepodobnosť",
        detail: "Pravdepodobnosť spojená s distribúciou chí-kvadrát.",
      },
      {
        name: "stupne_voľnosti",
        detail: "Počet stupňov voľnosti.",
      },
    ],
  },
  {
    n: "CHISQ.TEST",
    d: "Vráti test nezávislosti: hodnotu z rozdelenia chí-kvadrát pre štatistiku a príslušné stupne voľnosti.",
    a: "Chí-kvadrát test nezávislosti.",
    p: [
      {
        name: "skutočné_hodnoty",
        detail:
          "Rozsah údajov, ktoré obsahujú pozorovania na testovanie oproti očakávaným hodnotám.",
      },
      {
        name: "očakávané_hodnoty",
        detail:
          "Rozsah údajov, ktorý obsahuje pomer súčinu súčtov riadkov a súčtov stĺpcov k celkovému súčtu.",
      },
    ],
  },
  {
    n: "CHITEST",
    d: "Vráti test nezávislosti. Zachované z dôvodu kompatibility; pozri CHISQ.TEST.",
    a: "Chí-kvadrát test (starý).",
    p: [
      {
        name: "skutočné_hodnoty",
        detail:
          "Rozsah údajov, ktoré obsahujú pozorovania na testovanie oproti očakávaným hodnotám.",
      },
      {
        name: "očakávané_hodnoty",
        detail: "Rozsah údajov, ktorý obsahuje očakávané hodnoty.",
      },
    ],
  },
  {
    n: "CHOOSE",
    d: "Používa číslo_indexu na vrátenie hodnoty zo zoznamu argumentov hodnôt.",
    a: "Vyberie hodnotu zo zoznamu podľa indexu.",
    p: [
      {
        name: "číslo_indexu",
        detail: "Akú hodnotu vrátiť; číslo medzi 1 a 254.",
      },
      {
        name: "hodnota1",
        detail: "Prvá hodnota na výber.",
      },
      {
        name: "hodnota2",
        detail: "Ďalšie hodnoty na výber, celkovo až 254.",
      },
    ],
  },
  {
    n: "CHOOSECOLS",
    d: "Vráti zadané stĺpce z poľa.",
    a: "Vybrané stĺpce poľa.",
    p: [
      {
        name: "pole",
        detail: "Pole obsahujúce stĺpce, ktoré sa majú vrátiť.",
      },
      {
        name: "číslo_stĺpca1",
        detail:
          "Prvý stĺpec, ktorý sa má vrátiť; záporné čísla sa počítajú od konca.",
      },
      {
        name: "číslo_stĺpca2",
        detail: "Dodatočné stĺpce, ktoré sa majú vrátiť.",
      },
    ],
  },
  {
    n: "CHOOSEROWS",
    d: "Vráti zadané riadky z poľa.",
    a: "Vybrané riadky poľa.",
    p: [
      {
        name: "pole",
        detail: "Pole obsahujúce riadky, ktoré sa majú vrátiť.",
      },
      {
        name: "číslo_riadka1",
        detail:
          "Číslo prvého riadku, ktoré sa má vrátiť; záporné čísla sa počítajú od konca.",
      },
      {
        name: "číslo_riadka2",
        detail: "Dodatočné čísla riadkov, ktoré sa majú vrátiť.",
      },
    ],
  },
  {
    n: "CLEAN",
    d: "Odstráni z textu všetky netlačiteľné znaky.",
    a: "Odstráni netlačiteľné znaky.",
    p: [
      {
        name: "text",
        detail:
          "Akékoľvek informácie pracovného hárka, z ktorých chcete odstrániť netlačiteľné znaky.",
      },
    ],
  },
  {
    n: "CODE",
    d: "Vráti číselný kód pre prvý znak v textovom reťazci.",
    a: "Kód prvého znaku.",
    p: [
      {
        name: "text",
        detail: "Text, pre ktorý chcete kód prvého znaku.",
      },
    ],
  },
  {
    n: "COLUMN",
    d: "Vráti číslo stĺpca odkazu na danú bunku alebo bunky obsahujúcej vzorec, ak je vynechaný.",
    a: "Číslo stĺpca odkazu.",
    p: [
      {
        name: "odkaz",
        detail:
          "Bunka alebo rozsah buniek, pre ktoré chcete vrátiť číslo stĺpca.",
      },
    ],
  },
  {
    n: "COLUMNS",
    d: "Vráti počet stĺpcov v poli alebo odkaze.",
    a: "Počet stĺpcov v rozsahu.",
    p: [
      {
        name: "pole",
        detail: "Pole, vzorec poľa alebo odkaz na rozsah buniek.",
      },
    ],
  },
  {
    n: "COMBIN",
    d: "Vráti počet kombinácií (bez opakovania) pre daný počet položiek.",
    a: "Počet kombinácií.",
    p: [
      {
        name: "číslo",
        detail: "Počet položiek.",
      },
      {
        name: "počet_vybraných",
        detail: "Počet položiek v každej kombinácii.",
      },
    ],
  },
  {
    n: "COMBINA",
    d: "Vráti počet kombinácií s opakovaniami pre daný počet položiek.",
    a: "Počet kombinácií s opakovaním.",
    p: [
      {
        name: "číslo",
        detail:
          "Počet položiek; musí byť väčšie alebo rovné 0 a `počet_vybraných`.",
      },
      {
        name: "počet_vybraných",
        detail: "Počet položiek v každej kombinácii.",
      },
    ],
  },
  {
    n: "COMPLEX",
    d: "Konvertuje reálne a imaginárne koeficienty na komplexné číslo v tvare x + yi alebo x + yj.",
    a: "Zostaví komplexné číslo.",
    p: [
      {
        name: "reálna_časť",
        detail: "Reálny koeficient komplexného čísla.",
      },
      {
        name: "imaginárna_časť",
        detail: "Imaginárny koeficient komplexného čísla.",
      },
      {
        name: "prípona",
        detail:
          'Prípona imaginárneho komponentu, "i" alebo "j"; predvolená hodnota je "i".',
      },
    ],
  },
  {
    n: "CONCAT",
    d: "Kombinuje text z viacerých rozsahov a/alebo reťazcov bez oddeľovača.",
    a: "Spája text z rozsahov a reťazcov.",
    p: [
      {
        name: "text_1",
        detail: "Prvá textová položka alebo rozsah, ktorý sa má spojiť.",
      },
      {
        name: "text2",
        detail:
          "Ďalšie textové položky alebo rozsahy, ktoré sa majú spojiť, celkovo až 253.",
      },
    ],
  },
  {
    n: "CONCATENATE",
    d: "Spája dva alebo viac textových reťazcov do jedného reťazca.",
    a: "Spája textové reťazce.",
    p: [
      {
        name: "text_1",
        detail:
          "Prvá položka na pripojenie; textovú hodnotu, číslo alebo odkaz na bunku.",
      },
      {
        name: "text2",
        detail: "Ďalšie textové položky na pripojenie, celkovo až 255.",
      },
    ],
  },
  {
    n: "CONFIDENCE",
    d: "Vráti interval spoľahlivosti pre priemer populácie s použitím normálneho rozdelenia.",
    a: "Normálny interval spoľahlivosti (kompatibilita).",
    p: [
      {
        name: "alfa",
        detail: "Hladina významnosti použitá na výpočet hladiny spoľahlivosti.",
      },
      {
        name: "smerodajná_odchýlka",
        detail: "Štandardná odchýlka populácie.",
      },
      {
        name: "veľkosť",
        detail: "Veľkosť vzorky.",
      },
    ],
  },
  {
    n: "CONFIDENCE.NORM",
    d: "Vráti interval spoľahlivosti pre priemer populácie s použitím normálneho rozdelenia.",
    a: "Interval spoľahlivosti s použitím normálneho rozdelenia.",
    p: [
      {
        name: "alfa",
        detail: "Hladina významnosti použitá na výpočet hladiny spoľahlivosti.",
      },
      {
        name: "smerodajná_odchýlka",
        detail:
          "štandardná odchýlka populácie pre rozsah údajov; predpokladá sa, že je známy.",
      },
      {
        name: "veľkosť",
        detail: "Veľkosť vzorky.",
      },
    ],
  },
  {
    n: "CONFIDENCE.T",
    d: "Vráti interval spoľahlivosti pre priemer populácie pomocou Studentovho t rozdelenia.",
    a: "Interval spoľahlivosti s použitím t distribúcie.",
    p: [
      {
        name: "alfa",
        detail: "Hladina významnosti použitá na výpočet hladiny spoľahlivosti.",
      },
      {
        name: "smerodajná_odchýlka",
        detail:
          "štandardná odchýlka populácie pre rozsah údajov; predpokladá sa, že je známy.",
      },
      {
        name: "veľkosť",
        detail: "Veľkosť vzorky.",
      },
    ],
  },
  {
    n: "CONVERT",
    d: "Prevádza číslo z jedného meracieho systému do druhého, napríklad tabuľku vzdialeností v míľach na kilometre.",
    a: "Konvertuje medzi jednotkami merania.",
    p: [
      {
        name: "číslo",
        detail: "Hodnota v `zdrojová_jednotka` na konverziu.",
      },
      {
        name: "zdrojová_jednotka",
        detail: "Jednotky pre `číslo`.",
      },
      {
        name: "cieľová_jednotka",
        detail: "Jednotky pre výsledok.",
      },
    ],
  },
  {
    n: "CORREL",
    d: "Vráti korelačný koeficient dvoch rozsahov buniek.",
    a: "Korelačný koeficient dvoch súborov údajov.",
    p: [
      {
        name: "pole1",
        detail: "Rozsah hodnôt buniek.",
      },
      {
        name: "pole2",
        detail: "Druhý rozsah hodnôt buniek.",
      },
    ],
  },
  {
    n: "COS",
    d: "Vráti kosínus uhla zadaného v radiánoch.",
    a: "Kosínus uhla v radiánoch.",
    p: [
      {
        name: "číslo",
        detail:
          "Uhol v radiánoch. Vynásobte stupne PI()/180 alebo použite RADIANS na prevod.",
      },
    ],
  },
  {
    n: "COSH",
    d: "Vráti hyperbolický kosínus čísla.",
    a: "Hyperbolický kosínus.",
    p: [
      {
        name: "číslo",
        detail: "Akékoľvek reálne číslo.",
      },
    ],
  },
  {
    n: "COT",
    d: "Vráti kotangens uhla zadaného v radiánoch.",
    a: "Kotangens uhla v radiánoch.",
    p: [
      {
        name: "číslo",
        detail:
          "Uhol v radiánoch; jeho absolútna hodnota musí byť menšia ako 2^27.",
      },
    ],
  },
  {
    n: "COTH",
    d: "Vráti hyperbolický kotangens hyperbolického uhla.",
    a: "Hyperbolický kotangens.",
    p: [
      {
        name: "číslo",
        detail: "Akékoľvek reálne číslo iné ako 0.",
      },
    ],
  },
  {
    n: "COUNT",
    d: "Spočíta počet buniek, ktoré obsahujú čísla, a spočíta čísla v zozname argumentov.",
    a: "Počet číselných hodnôt.",
    p: [
      {
        name: "hodnota1",
        detail:
          "Prvá položka, odkaz na bunku alebo rozsah, v rámci ktorého chcete počítať čísla.",
      },
      {
        name: "hodnota2",
        detail: "Ďalšie položky alebo rozsahy, celkovo až 255.",
      },
    ],
  },
  {
    n: "COUNTA",
    d: "Spočíta počet buniek, ktoré nie sú prázdne v rozsahu.",
    a: "Počet neprázdnych hodnôt.",
    p: [
      {
        name: "hodnota1",
        detail: "Prvý argument predstavujúci hodnoty, ktoré chcete počítať.",
      },
      {
        name: "hodnota2",
        detail: "Ďalšie hodnoty alebo rozsahy, celkovo až 255.",
      },
    ],
  },
  {
    n: "COUNTBLANK",
    d: 'Spočíta počet prázdnych buniek v rámci rozsahu. Počítajú sa aj bunky so vzorcami, ktoré vracajú "".',
    a: "Počet prázdnych buniek.",
    p: [
      {
        name: "rozsah",
        detail: "Rozsah, od ktorého chcete počítať prázdne bunky.",
      },
    ],
  },
  {
    n: "COUNTIF",
    d: "Spočíta počet buniek v rámci rozsahu, ktoré spĺňajú jediné kritérium.",
    a: "Počet buniek, ktoré spĺňajú podmienku.",
    p: [
      {
        name: "rozsah",
        detail: "Skupina buniek, ktoré chcete spočítať.",
      },
      {
        name: "kritériá",
        detail:
          "Číslo, výraz, odkaz na bunku alebo textový reťazec, ktorý určuje, ktoré bunky sa budú počítať.",
      },
    ],
  },
  {
    n: "COUNTIFS",
    d: "Spočíta počet buniek, ktoré spĺňajú viaceré kritériá v jednom alebo viacerých rozsahoch.",
    a: "Počet buniek, ktoré spĺňajú viaceré kritériá.",
    p: [
      {
        name: "rozsah_kritérií1",
        detail: "Prvý rozsah, v ktorom sa vyhodnocujú súvisiace kritériá.",
      },
      {
        name: "kritériá_1",
        detail: "Kritériá, ktoré definujú, ktoré bunky sa budú počítať.",
      },
      {
        name: "rozsah_kritérií2",
        detail:
          "Ďalšie rozsahy, až 127 párov rozsah/kritérium, každý s rovnakým tvarom ako `rozsah_kritérií1`.",
      },
      {
        name: "kritériá2",
        detail: "Kritériá pre zodpovedajúci dodatočný rozsah.",
      },
    ],
  },
  {
    n: "COUPDAYBS",
    d: "Vráti počet dní od začiatku obdobia kupónu do dátumu zúčtovania.",
    a: "Dni od začiatku obdobia kupónu po zúčtovanie.",
    p: [
      {
        name: "dátum_vyrovnania",
        detail: "Dátum vyrovnania cenného papiera.",
      },
      {
        name: "dátum_splatnosti",
        detail:
          "Dátum splatnosti cenného papiera, kedy sa skončí platnosť cenného papiera.",
      },
      {
        name: "frekvencia",
        detail:
          "Počet výplat kupónov za rok: 1 ročná, 2 polročné, 4 štvrťročné.",
      },
      {
        name: "základňa",
        detail:
          "Základ počtu dní: 0 alebo vynechané US 30/360, 1 skutočný/aktuálny, 2 skutočné/360, 3 skutočné/365, 4 európske 30/360.",
      },
    ],
  },
  {
    n: "COUPDAYS",
    d: "Vráti počet dní v období kupónu, ktoré obsahuje dátum zúčtovania.",
    a: "Dni v období zúčtovania kupónu.",
    p: [
      {
        name: "dátum_vyrovnania",
        detail: "Dátum vyrovnania cenného papiera.",
      },
      {
        name: "dátum_splatnosti",
        detail:
          "Dátum splatnosti cenného papiera, kedy sa skončí platnosť cenného papiera.",
      },
      {
        name: "frekvencia",
        detail:
          "Počet výplat kupónov za rok: 1 ročná, 2 polročné, 4 štvrťročné.",
      },
      {
        name: "základňa",
        detail:
          "Základ počtu dní: 0 alebo vynechané US 30/360, 1 skutočný/aktuálny, 2 skutočné/360, 3 skutočné/365, 4 európske 30/360.",
      },
    ],
  },
  {
    n: "COUPDAYSNC",
    d: "Vráti počet dní od dátumu zúčtovania do dátumu nasledujúceho kupónu.",
    a: "Dni od vyrovnania po ďalší kupón.",
    p: [
      {
        name: "dátum_vyrovnania",
        detail: "Dátum vyrovnania cenného papiera.",
      },
      {
        name: "dátum_splatnosti",
        detail:
          "Dátum splatnosti cenného papiera, kedy sa skončí platnosť cenného papiera.",
      },
      {
        name: "frekvencia",
        detail:
          "Počet výplat kupónov za rok: 1 ročná, 2 polročné, 4 štvrťročné.",
      },
      {
        name: "základňa",
        detail:
          "Základ počtu dní: 0 alebo vynechané US 30/360, 1 skutočný/aktuálny, 2 skutočné/360, 3 skutočné/365, 4 európske 30/360.",
      },
    ],
  },
  {
    n: "COUPNCD",
    d: "Vráti číslo, ktoré predstavuje nasledujúci dátum kupónu po dátume vyrovnania.",
    a: "Ďalší dátum kupónu po zúčtovaní.",
    p: [
      {
        name: "dátum_vyrovnania",
        detail: "Dátum vyrovnania cenného papiera.",
      },
      {
        name: "dátum_splatnosti",
        detail:
          "Dátum splatnosti cenného papiera, kedy sa skončí platnosť cenného papiera.",
      },
      {
        name: "frekvencia",
        detail:
          "Počet výplat kupónov za rok: 1 ročná, 2 polročné, 4 štvrťročné.",
      },
      {
        name: "základňa",
        detail:
          "Základ počtu dní: 0 alebo vynechané US 30/360, 1 skutočný/aktuálny, 2 skutočné/360, 3 skutočné/365, 4 európske 30/360.",
      },
    ],
  },
  {
    n: "COUPNUM",
    d: "Vráti počet kupónov splatných medzi dátumom vyrovnania a dátumom splatnosti, zaokrúhlený nahor na najbližší celý kupón.",
    a: "Počet kupónov do splatnosti.",
    p: [
      {
        name: "dátum_vyrovnania",
        detail: "Dátum vyrovnania cenného papiera.",
      },
      {
        name: "dátum_splatnosti",
        detail:
          "Dátum splatnosti cenného papiera, kedy sa skončí platnosť cenného papiera.",
      },
      {
        name: "frekvencia",
        detail:
          "Počet výplat kupónov za rok: 1 ročná, 2 polročné, 4 štvrťročné.",
      },
      {
        name: "základňa",
        detail:
          "Základ počtu dní: 0 alebo vynechané US 30/360, 1 skutočný/aktuálny, 2 skutočné/360, 3 skutočné/365, 4 európske 30/360.",
      },
    ],
  },
  {
    n: "COUPPCD",
    d: "Vráti číslo, ktoré predstavuje dátum predchádzajúceho kupónu pred dátumom vyrovnania.",
    a: "Predchádzajúci dátum kupónu pred vyrovnaním.",
    p: [
      {
        name: "dátum_vyrovnania",
        detail: "Dátum vyrovnania cenného papiera.",
      },
      {
        name: "dátum_splatnosti",
        detail:
          "Dátum splatnosti cenného papiera, kedy sa skončí platnosť cenného papiera.",
      },
      {
        name: "frekvencia",
        detail:
          "Počet výplat kupónov za rok: 1 ročná, 2 polročné, 4 štvrťročné.",
      },
      {
        name: "základňa",
        detail:
          "Základ počtu dní: 0 alebo vynechané US 30/360, 1 skutočný/aktuálny, 2 skutočné/360, 3 skutočné/365, 4 európske 30/360.",
      },
    ],
  },
  {
    n: "COVAR",
    d: "Vráti kovarianciu, priemer súčinov párových odchýlok. Zachované z dôvodu kompatibility; pozri COVARIANCE.P.",
    a: "Populačná kovariancia (kompatibilita).",
    p: [
      {
        name: "pole1",
        detail: "Prvý bunkový rozsah celých čísel.",
      },
      {
        name: "pole2",
        detail: "Druhý bunkový rozsah celých čísel.",
      },
    ],
  },
  {
    n: "COVARIANCE.P",
    d: "Vráti populačnú kovarianciu, priemer súčinov odchýlok pre každý pár údajových bodov.",
    a: "Populačná kovariancia.",
    p: [
      {
        name: "pole1",
        detail: "Prvý bunkový rozsah celých čísel.",
      },
      {
        name: "pole2",
        detail: "Druhý bunkový rozsah celých čísel.",
      },
    ],
  },
  {
    n: "COVARIANCE.S",
    d: "Vráti kovarianciu vzorky, priemer produktov odchýlok pre každý pár údajových bodov.",
    a: "Výberová kovariancia.",
    p: [
      {
        name: "pole1",
        detail: "Prvý bunkový rozsah celých čísel.",
      },
      {
        name: "pole2",
        detail: "Druhý bunkový rozsah celých čísel.",
      },
    ],
  },
  {
    n: "CRITBINOM",
    d: "Vráti najmenšiu hodnotu, pre ktorú je kumulatívne binomické rozdelenie väčšie alebo rovné hodnote kritéria. Zachované z dôvodu kompatibility; pozri BINOM.INV.",
    a: "Inverzný kumulatívny binomický znak (kompatibilita).",
    p: [
      {
        name: "pokusov",
        detail: "Počet Bernoulliho pokusov.",
      },
      {
        name: "pravdepodobnosť_úspechu",
        detail: "Pravdepodobnosť úspechu každého pokusu.",
      },
      {
        name: "alfa",
        detail: "Hodnota kritéria.",
      },
    ],
  },
  {
    n: "CSC",
    d: "Vráti kosekans uhla zadaného v radiánoch.",
    a: "Kosekans uhla v radiánoch.",
    p: [
      {
        name: "číslo",
        detail:
          "Uhol v radiánoch; jeho absolútna hodnota musí byť menšia ako 2^27.",
      },
    ],
  },
  {
    n: "CSCH",
    d: "Vráti hyperbolický kosekans uhla zadaného v radiánoch.",
    a: "Hyperbolický kosekant.",
    p: [
      {
        name: "číslo",
        detail: "Akékoľvek reálne číslo iné ako 0.",
      },
    ],
  },
  {
    n: "CUMIPMT",
    d: "Vráti kumulatívny úrok zaplatený z pôžičky medzi počiatočné_obdobie a koniec_obdobia.",
    a: "Kumulatívne úroky zaplatené medzi dvoma obdobiami.",
    p: [
      {
        name: "sadzba",
        detail: "Úroková sadzba za obdobie.",
      },
      {
        name: "počet_období",
        detail: "Celkový počet platobných období.",
      },
      {
        name: "súčasná_hodnota",
        detail: "Súčasná hodnota.",
      },
      {
        name: "počiatočné_obdobie",
        detail: "Prvé obdobie vo výpočte; obdobia sa číslujú od 1.",
      },
      {
        name: "koniec_obdobia",
        detail: "Posledné obdobie vo výpočte.",
      },
      {
        name: "typ",
        detail: "Načasovanie platby: 0 na konci obdobia, 1 na začiatku.",
      },
    ],
  },
  {
    n: "CUMPRINC",
    d: "Vráti kumulatívnu istinu zaplatenú za pôžičku medzi počiatočné_obdobie a koniec_obdobia.",
    a: "Kumulatívna istina zaplatená medzi dvoma obdobiami.",
    p: [
      {
        name: "sadzba",
        detail: "Úroková sadzba za obdobie.",
      },
      {
        name: "počet_období",
        detail: "Celkový počet platobných období.",
      },
      {
        name: "súčasná_hodnota",
        detail: "Súčasná hodnota.",
      },
      {
        name: "počiatočné_obdobie",
        detail: "Prvé obdobie vo výpočte; obdobia sa číslujú od 1.",
      },
      {
        name: "koniec_obdobia",
        detail: "Posledné obdobie vo výpočte.",
      },
      {
        name: "typ",
        detail: "Načasovanie platby: 0 na konci obdobia, 1 na začiatku.",
      },
    ],
  },
  {
    n: "DATE",
    d: "Vráti poradové sériové číslo, ktoré predstavuje konkrétny dátum.",
    a: "Dátum z roku, mesiaca a dňa.",
    p: [
      {
        name: "rok",
        detail:
          "Rok; 0 až 1899 sa pridá k 1900, 1900 až 9999 sa použije tak, ako je.",
      },
      {
        name: "mesiac",
        detail:
          "Mesiac v roku od 1 do 12; hodnoty mimo tohto rozsahu sa prenesú do susedných rokov.",
      },
      {
        name: "deň",
        detail:
          "Deň v mesiaci od 1 do 31; hodnoty mimo tohto rozsahu sa prenesú do susedných mesiacov.",
      },
    ],
  },
  {
    n: "DATEDIF",
    d: "Vypočíta počet dní, mesiacov alebo rokov medzi dvoma dátumami.",
    a: "Rozdiel medzi dvoma dátumami.",
    p: [
      {
        name: "dátum_začiatku",
        detail: "Prvý alebo počiatočný dátum obdobia.",
      },
      {
        name: "dátum_ukončenia",
        detail: "Posledný alebo končiaci dátum obdobia.",
      },
      {
        name: "jednotka",
        detail:
          'Typ informácií, ktoré sa majú vrátiť: "Y" rokov, "M" mesiacov, "D" dní, "MD", "YM" alebo "YD" pre zvyšok.',
      },
    ],
  },
  {
    n: "DATEVALUE",
    d: "Skonvertuje dátum uložený ako text na sériové číslo, ktoré Excel rozpozná ako dátum.",
    a: "Konvertuje text dátumu na sériové číslo.",
    p: [
      {
        name: "dátum_ako_text",
        detail: "Text, ktorý predstavuje dátum v rozpoznanom formáte dátumu.",
      },
    ],
  },
  {
    n: "DAVERAGE",
    d: "Spriemeruje hodnoty v poli (stĺpci) záznamov v zozname alebo databáze, ktoré zodpovedajú zadaným podmienkam.",
    a: "Priemer zhodných záznamov databázy.",
    p: [
      {
        name: "databázy",
        detail:
          "Rozsah buniek, ktoré tvoria zoznam alebo databázu; prvý riadok obsahuje menovky pre každý stĺpec.",
      },
      {
        name: "pole",
        detail:
          "Označenie stĺpca v úvodzovkách alebo číslo predstavujúce polohu stĺpca.",
      },
      {
        name: "kritériá",
        detail:
          "Rozsah buniek, ktorý obsahuje podmienky: aspoň jedno označenie stĺpca a bunka pod ním.",
      },
    ],
  },
  {
    n: "DAY",
    d: "Vráti deň dátumu reprezentovaný poradovým číslom ako celé číslo od 1 do 31.",
    a: "Deň v mesiaci.",
    p: [
      {
        name: "poradové_číslo",
        detail: "Dátum dňa, ktorý sa snažíte nájsť.",
      },
    ],
  },
  {
    n: "DAYS",
    d: "Vráti počet dní medzi dvoma dátumami.",
    a: "Dni medzi dvoma dátumami.",
    p: [
      {
        name: "dátum_ukončenia",
        detail: "Neskorší z dvoch dátumov.",
      },
      {
        name: "dátum_začiatku",
        detail: "Starší z týchto dvoch dátumov.",
      },
    ],
  },
  {
    n: "DAYS360",
    d: "Vráti počet dní medzi dvoma dátumami na základe 360-dňového roku (dvanásť 30-dňových mesiacov).",
    a: "Dni medzi dátumami v 360-dňovom roku.",
    p: [
      {
        name: "dátum_začiatku",
        detail: "Dátum začiatku.",
      },
      {
        name: "dátum_ukončenia",
        detail: "Dátum ukončenia.",
      },
      {
        name: "metóda",
        detail:
          "FALSE alebo vynechané používa metódu U.S. (NASD); TRUE používa európsku metódu.",
      },
    ],
  },
  {
    n: "DB",
    d: "Vracia odpisy majetku za zadané obdobie pomocou metódy fixného-klesajúceho zostatku.",
    a: "Pevne klesajúci odpis zostatku.",
    p: [
      {
        name: "obstarávacia_cena",
        detail: "Počiatočná obstarávacia cena majetku.",
      },
      {
        name: "zostatková_hodnota",
        detail: "Hodnota na konci odpisovania (zostatková hodnota majetku).",
      },
      {
        name: "životnosť",
        detail: "Počet období, počas ktorých sa majetok odpisuje.",
      },
      {
        name: "obdobie",
        detail:
          "Obdobie, za ktoré chcete vypočítať odpisy, v rovnakých jednotkách ako `životnosť`.",
      },
      {
        name: "mesiac",
        detail: "Počet mesiacov v prvom roku; predvolene je 12.",
      },
    ],
  },
  {
    n: "DBCS",
    d: "Zmení znaky s polovičnou šírkou (jednobajtové) na znaky s plnou šírkou (dvojbajtové).",
    a: "Konvertovať na znaky s plnou šírkou.",
    p: [
      {
        name: "text",
        detail:
          "Text alebo odkaz na bunku, ktorá obsahuje text, ktorý sa má zmeniť.",
      },
    ],
  },
  {
    n: "DCOUNT",
    d: "Spočíta bunky, ktoré obsahujú čísla v poli (stĺpci) záznamov v zozname alebo databáze, ktoré zodpovedajú zadaným podmienkam.",
    a: "Počet čísel v zodpovedajúcich záznamoch.",
    p: [
      {
        name: "databázy",
        detail:
          "Rozsah buniek, ktoré tvoria zoznam alebo databázu; prvý riadok obsahuje menovky pre každý stĺpec.",
      },
      {
        name: "pole",
        detail:
          "Označenie stĺpca v úvodzovkách alebo číslo predstavujúce polohu stĺpca.",
      },
      {
        name: "kritériá",
        detail:
          "Rozsah buniek, ktorý obsahuje podmienky: aspoň jedno označenie stĺpca a bunka pod ním.",
      },
    ],
  },
  {
    n: "DCOUNTA",
    d: "Spočíta neprázdne bunky v poli (stĺpci) záznamov v zozname alebo databáze, ktoré zodpovedajú zadaným podmienkam.",
    a: "Počet neprázdnych hodnôt v zodpovedajúcich záznamoch.",
    p: [
      {
        name: "databázy",
        detail:
          "Rozsah buniek, ktoré tvoria zoznam alebo databázu; prvý riadok obsahuje menovky pre každý stĺpec.",
      },
      {
        name: "pole",
        detail:
          "Označenie stĺpca v úvodzovkách alebo číslo predstavujúce polohu stĺpca.",
      },
      {
        name: "kritériá",
        detail:
          "Rozsah buniek, ktorý obsahuje podmienky: aspoň jedno označenie stĺpca a bunka pod ním.",
      },
    ],
  },
  {
    n: "DDB",
    d: "Vráti odpis majetku za zadané obdobie pomocou metódy dvojitého klesajúceho zostatku alebo inej metódy, ktorú určíte.",
    a: "Dvojnásobne klesajúci odpis zostatku.",
    p: [
      {
        name: "obstarávacia_cena",
        detail: "Počiatočná obstarávacia cena majetku.",
      },
      {
        name: "zostatková_hodnota",
        detail: "Hodnota na konci odpisovania.",
      },
      {
        name: "životnosť",
        detail: "Počet období, počas ktorých sa majetok odpisuje.",
      },
      {
        name: "obdobie",
        detail:
          "Obdobie, za ktoré chcete vypočítať odpisy, v rovnakých jednotkách ako `životnosť`.",
      },
      {
        name: "faktor",
        detail:
          "Rýchlosť, ktorou zostatok klesá; predvolená hodnota je 2 (zostatok s dvojitým klesaním).",
      },
    ],
  },
  {
    n: "DEC2BIN",
    d: "Konvertuje desiatkové číslo na binárne.",
    a: "Prevod z desiatkovej do dvojkovej sústavy.",
    p: [
      {
        name: "číslo",
        detail: "Desatinné celé číslo, ktoré sa má previesť, od -512 do 511.",
      },
      {
        name: "počet_miest",
        detail:
          "Počet znakov, ktoré sa majú použiť; výsledok je doplnený vodiacimi nulami.",
      },
    ],
  },
  {
    n: "DEC2HEX",
    d: "Konvertuje desiatkové číslo na hexadecimálne.",
    a: "Prevod z desiatkovej do šestnástkovej sústavy.",
    p: [
      {
        name: "číslo",
        detail: "Desatinné celé číslo na konverziu.",
      },
      {
        name: "počet_miest",
        detail:
          "Počet znakov, ktoré sa majú použiť; výsledok je doplnený vodiacimi nulami.",
      },
    ],
  },
  {
    n: "DEC2OCT",
    d: "Konvertuje desiatkové číslo na osmičkové.",
    a: "Prevod z desiatkovej do osmičkovej sústavy.",
    p: [
      {
        name: "číslo",
        detail: "Desatinné celé číslo na konverziu.",
      },
      {
        name: "počet_miest",
        detail:
          "Počet znakov, ktoré sa majú použiť; výsledok je doplnený vodiacimi nulami.",
      },
    ],
  },
  {
    n: "DECIMAL",
    d: "Konvertuje textovú reprezentáciu čísla v danom základe na desiatkové číslo.",
    a: "Skonvertuje text v inom základe na číslo.",
    p: [
      {
        name: "text",
        detail: "Text na konverziu; najviac 255 znakov.",
      },
      {
        name: "základ_sústavy",
        detail: "Základ `text`; celé číslo od 2 do 36.",
      },
    ],
  },
  {
    n: "DEGREES",
    d: "Konvertuje radiány na stupne.",
    a: "Konvertuje radiány na stupne.",
    p: [
      {
        name: "uhol",
        detail: "Uhol v radiánoch, ktorý chcete previesť.",
      },
    ],
  },
  {
    n: "DELTA",
    d: "Testuje, či sú dve hodnoty rovnaké. Vráti 1, ak číslo1 = číslo2; inak vráti 0.",
    a: "Testuje, či sú dve čísla rovnaké.",
    p: [
      {
        name: "číslo1",
        detail: "Prvé číslo.",
      },
      {
        name: "číslo2",
        detail: "Druhé číslo; predvolene je 0.",
      },
    ],
  },
  {
    n: "DEVSQ",
    d: "Vráti súčet druhých mocnín odchýlok dátových bodov od ich priemeru vzorky.",
    a: "Súčet štvorcových odchýlok.",
    p: [
      {
        name: "číslo1",
        detail: "Prvé číslo alebo rozsah.",
      },
      {
        name: "číslo2",
        detail: "Ďalšie čísla alebo rozsahy, celkovo až 255.",
      },
    ],
  },
  {
    n: "DGET",
    d: "Extrahuje jednu hodnotu zo stĺpca zoznamu alebo databázy, ktorá zodpovedá zadaným podmienkam.",
    a: "Jedna hodnota zo zodpovedajúcich záznamov.",
    p: [
      {
        name: "databázy",
        detail:
          "Rozsah buniek, ktoré tvoria zoznam alebo databázu; prvý riadok obsahuje menovky pre každý stĺpec.",
      },
      {
        name: "pole",
        detail:
          "Označenie stĺpca v úvodzovkách alebo číslo predstavujúce polohu stĺpca.",
      },
      {
        name: "kritériá",
        detail:
          "Rozsah buniek, ktorý obsahuje podmienky: aspoň jedno označenie stĺpca a bunka pod ním.",
      },
    ],
  },
  {
    n: "DISC",
    d: "Vráti diskontnú sadzbu pre cenný papier.",
    a: "Diskontná sadzba cenného papiera.",
    p: [
      {
        name: "dátum_vyrovnania",
        detail: "Dátum vyrovnania cenného papiera.",
      },
      {
        name: "dátum_splatnosti",
        detail: "Dátum splatnosti cenného papiera.",
      },
      {
        name: "cena",
        detail: "Cena cenného papiera za nominálnu hodnotu 100 $.",
      },
      {
        name: "výkupná_hodnota",
        detail: "Výkupná hodnota cenného papiera na 100 $ nominálnej hodnoty.",
      },
      {
        name: "základňa",
        detail:
          "Základ počtu dní: 0 alebo vynechané US 30/360, 1 skutočný/aktuálny, 2 skutočné/360, 3 skutočné/365, 4 európske 30/360.",
      },
    ],
  },
  {
    n: "DMAX",
    d: "Vráti najväčšie číslo v poli (stĺpci) záznamov v zozname alebo databáze, ktoré zodpovedajú zadaným podmienkam.",
    a: "Maximum zhodných záznamov databázy.",
    p: [
      {
        name: "databázy",
        detail:
          "Rozsah buniek, ktoré tvoria zoznam alebo databázu; prvý riadok obsahuje menovky pre každý stĺpec.",
      },
      {
        name: "pole",
        detail:
          "Označenie stĺpca v úvodzovkách alebo číslo predstavujúce polohu stĺpca.",
      },
      {
        name: "kritériá",
        detail:
          "Rozsah buniek, ktorý obsahuje podmienky: aspoň jedno označenie stĺpca a bunka pod ním.",
      },
    ],
  },
  {
    n: "DMIN",
    d: "Vráti najmenšie číslo v poli (stĺpci) záznamov v zozname alebo databáze, ktoré zodpovedajú zadaným podmienkam.",
    a: "Minimum zo zodpovedajúcich databázových záznamov.",
    p: [
      {
        name: "databázy",
        detail:
          "Rozsah buniek, ktoré tvoria zoznam alebo databázu; prvý riadok obsahuje menovky pre každý stĺpec.",
      },
      {
        name: "pole",
        detail:
          "Označenie stĺpca v úvodzovkách alebo číslo predstavujúce polohu stĺpca.",
      },
      {
        name: "kritériá",
        detail:
          "Rozsah buniek, ktorý obsahuje podmienky: aspoň jedno označenie stĺpca a bunka pod ním.",
      },
    ],
  },
  {
    n: "DOLLAR",
    d: "Konvertuje číslo na text pomocou formátu meny, pričom desatinné miesta sú zaokrúhlené na určené miesto.",
    a: "Formátuje číslo ako text meny.",
    p: [
      {
        name: "číslo",
        detail:
          "Číslo, odkaz na bunku obsahujúcu číslo alebo vzorec, ktorý sa vyhodnotí ako číslo.",
      },
      {
        name: "desatinné_miesta",
        detail: "Počet číslic napravo od desatinnej čiarky; predvolene na 2.",
      },
    ],
  },
  {
    n: "DOLLARDE",
    d: "Konvertuje dolárovú cenu vyjadrenú ako celočíselnú časť a zlomkovú časť, napríklad 1,02, na dolárovú cenu vyjadrenú ako desatinné číslo.",
    a: "Prevedie zlomkovú cenu na desatinnú.",
    p: [
      {
        name: "zlomkový_dolár",
        detail:
          "Číslo vyjadrené ako celá časť a zlomková časť, oddelené desatinným znakom.",
      },
      {
        name: "zlomok",
        detail: "Celé číslo, ktoré sa má použiť v menovateli zlomku.",
      },
    ],
  },
  {
    n: "DOLLARFR",
    d: "Konvertuje dolárovú cenu vyjadrenú ako desatinné číslo na dolárovú cenu vyjadrenú ako zlomok.",
    a: "Konvertuje desiatkovú cenu na zlomkovú.",
    p: [
      {
        name: "desatinný_dolár",
        detail: "Desatinné číslo.",
      },
      {
        name: "zlomok",
        detail: "Celé číslo, ktoré sa má použiť v menovateli zlomku.",
      },
    ],
  },
  {
    n: "DPRODUCT",
    d: "Vynásobí hodnoty v poli (stĺpci) záznamov v zozname alebo databáze, ktoré zodpovedajú zadaným podmienkam.",
    a: "Súčin hodnôt zodpovedajúcich databázových záznamov.",
    p: [
      {
        name: "databázy",
        detail:
          "Rozsah buniek, ktoré tvoria zoznam alebo databázu; prvý riadok obsahuje menovky pre každý stĺpec.",
      },
      {
        name: "pole",
        detail:
          "Označenie stĺpca v úvodzovkách alebo číslo predstavujúce polohu stĺpca.",
      },
      {
        name: "kritériá",
        detail:
          "Rozsah buniek, ktorý obsahuje podmienky: aspoň jedno označenie stĺpca a bunka pod ním.",
      },
    ],
  },
  {
    n: "DROP",
    d: "Vylúči zadaný počet riadkov alebo stĺpcov zo začiatku alebo konca poľa.",
    a: "Pole bez prvého alebo posledného riadku/stĺpca.",
    p: [
      {
        name: "pole",
        detail: "Pole, z ktorého sa vypustia riadky alebo stĺpce.",
      },
      {
        name: "riadky",
        detail: "Počet riadkov na vypustenie; záporná hodnota klesá od konca.",
      },
      {
        name: "stĺpce",
        detail:
          "Počet stĺpcov, ktoré sa majú vylúčiť; záporná hodnota klesá od konca.",
      },
    ],
  },
  {
    n: "DSTDEV",
    d: "Odhaduje štandardnú odchýlku populácie na základe vzorky pomocou čísel v poli záznamov, ktoré zodpovedajú zadaným podmienkam.",
    a: "Výberová smerodajná odchýlka zodpovedajúcich záznamov.",
    p: [
      {
        name: "databázy",
        detail:
          "Rozsah buniek, ktoré tvoria zoznam alebo databázu; prvý riadok obsahuje menovky pre každý stĺpec.",
      },
      {
        name: "pole",
        detail:
          "Označenie stĺpca v úvodzovkách alebo číslo predstavujúce polohu stĺpca.",
      },
      {
        name: "kritériá",
        detail:
          "Rozsah buniek, ktorý obsahuje podmienky: aspoň jedno označenie stĺpca a bunka pod ním.",
      },
    ],
  },
  {
    n: "DSTDEVP",
    d: "Vypočíta štandardnú odchýlku populácie na základe celej populácie, pričom použije čísla v poli záznamov, ktoré zodpovedajú zadaným podmienkam.",
    a: "Smerodajná odchýlka populácie zodpovedajúcich záznamov.",
    p: [
      {
        name: "databázy",
        detail:
          "Rozsah buniek, ktoré tvoria zoznam alebo databázu; prvý riadok obsahuje menovky pre každý stĺpec.",
      },
      {
        name: "pole",
        detail:
          "Označenie stĺpca v úvodzovkách alebo číslo predstavujúce polohu stĺpca.",
      },
      {
        name: "kritériá",
        detail:
          "Rozsah buniek, ktorý obsahuje podmienky: aspoň jedno označenie stĺpca a bunka pod ním.",
      },
    ],
  },
  {
    n: "DSUM",
    d: "Pridá čísla do poľa (stĺpca) záznamov v zozname alebo databáze, ktoré zodpovedajú zadaným podmienkam.",
    a: "Súčet zodpovedajúcich databázových záznamov.",
    p: [
      {
        name: "databázy",
        detail:
          "Rozsah buniek, ktoré tvoria zoznam alebo databázu; prvý riadok obsahuje menovky pre každý stĺpec.",
      },
      {
        name: "pole",
        detail:
          "Označenie stĺpca v úvodzovkách alebo číslo predstavujúce polohu stĺpca.",
      },
      {
        name: "kritériá",
        detail:
          "Rozsah buniek, ktorý obsahuje podmienky: aspoň jedno označenie stĺpca a bunka pod ním.",
      },
    ],
  },
  {
    n: "DURATION",
    d: "Vráti trvanie Macaulay pre predpokladanú nominálnu hodnotu 100 $.",
    a: "Macaulayova durácia cenného papiera.",
    p: [
      {
        name: "dátum_vyrovnania",
        detail: "Dátum vyrovnania cenného papiera.",
      },
      {
        name: "dátum_splatnosti",
        detail: "Dátum splatnosti cenného papiera.",
      },
      {
        name: "kupón",
        detail: "Ročná kupónová sadzba cenného papiera.",
      },
      {
        name: "výnos",
        detail: "Ročný výnos cenného papiera.",
      },
      {
        name: "frekvencia",
        detail:
          "Počet výplat kupónov za rok: 1 ročná, 2 polročné, 4 štvrťročné.",
      },
      {
        name: "základňa",
        detail:
          "Základ počtu dní: 0 alebo vynechané US 30/360, 1 skutočný/aktuálny, 2 skutočné/360, 3 skutočné/365, 4 európske 30/360.",
      },
    ],
  },
  {
    n: "DVAR",
    d: "Odhaduje rozptyl populácie na základe vzorky pomocou čísel v poli záznamov, ktoré zodpovedajú zadaným podmienkam.",
    a: "Výberový rozptyl zodpovedajúcich záznamov.",
    p: [
      {
        name: "databázy",
        detail:
          "Rozsah buniek, ktoré tvoria zoznam alebo databázu; prvý riadok obsahuje menovky pre každý stĺpec.",
      },
      {
        name: "pole",
        detail:
          "Označenie stĺpca v úvodzovkách alebo číslo predstavujúce polohu stĺpca.",
      },
      {
        name: "kritériá",
        detail:
          "Rozsah buniek, ktorý obsahuje podmienky: aspoň jedno označenie stĺpca a bunka pod ním.",
      },
    ],
  },
  {
    n: "DVARP",
    d: "Vypočíta rozptyl populácie na základe celej populácie pomocou čísel v poli záznamov, ktoré zodpovedajú podmienkam, ktoré určíte.",
    a: "Populačný rozptyl zodpovedajúcich záznamov.",
    p: [
      {
        name: "databázy",
        detail:
          "Rozsah buniek, ktoré tvoria zoznam alebo databázu; prvý riadok obsahuje menovky pre každý stĺpec.",
      },
      {
        name: "pole",
        detail:
          "Označenie stĺpca v úvodzovkách alebo číslo predstavujúce polohu stĺpca.",
      },
      {
        name: "kritériá",
        detail:
          "Rozsah buniek, ktorý obsahuje podmienky: aspoň jedno označenie stĺpca a bunka pod ním.",
      },
    ],
  },
  {
    n: "EDATE",
    d: "Vráti poradové číslo dátumu, ktoré predstavuje uvedený počet mesiacov pred alebo po dátume začiatku.",
    a: "Dátum niekoľko mesiacov.",
    p: [
      {
        name: "dátum_začiatku",
        detail: "Dátum začiatku.",
      },
      {
        name: "mesiace",
        detail:
          "Počet mesiacov pred (záporné) alebo po (kladné) `dátum_začiatku`.",
      },
    ],
  },
  {
    n: "EFFECT",
    d: "Vráti efektívnu ročnú úrokovú sadzbu pri danej nominálnej ročnej úrokovej miere a počte zložených období za rok.",
    a: "Efektívna ročná úroková sadzba.",
    p: [
      {
        name: "nominálna_sadzba",
        detail: "Nominálna úroková sadzba.",
      },
      {
        name: "obdobia_za_rok",
        detail: "Počet zložených období za rok.",
      },
    ],
  },
  {
    n: "ENCODEURL",
    d: "Vráti reťazec zakódovaný v URL.",
    a: "Text zakódovaný do adresy URL.",
    p: [
      {
        name: "text",
        detail: "Reťazec na zakódovanie URL.",
      },
    ],
  },
  {
    n: "EOMONTH",
    d: "Vráti poradové číslo posledného dňa v mesiaci, čo je uvedený počet mesiacov pred alebo po dátum_začiatku.",
    a: "Posledný deň v mesiaci.",
    p: [
      {
        name: "dátum_začiatku",
        detail: "Dátum začiatku.",
      },
      {
        name: "mesiace",
        detail:
          "Počet mesiacov pred (záporné) alebo po (kladné) `dátum_začiatku`.",
      },
    ],
  },
  {
    n: "ERF",
    d: "Vráti chybovú funkciu integrovanú medzi spodná_hranica a horná_hranica.",
    a: "Chybová funkcia.",
    p: [
      {
        name: "spodná_hranica",
        detail: "Dolná hranica pre integráciu ERF.",
      },
      {
        name: "horná_hranica",
        detail:
          "Horná hranica pre integráciu ERF; ak sa vynechá, integruje sa medzi 0 a `spodná_hranica`.",
      },
    ],
  },
  {
    n: "ERF.PRECISE",
    d: "Vráti chybovú funkciu integrovanú medzi 0 a x.",
    a: "Chybová funkcia.",
    p: [
      {
        name: "x",
        detail: "Horná hranica pre integráciu ERF.PRECISE.",
      },
    ],
  },
  {
    n: "ERFC",
    d: "Vráti komplementárnu funkciu ERF integrovanú medzi x a nekonečno.",
    a: "Doplnková chybová funkcia.",
    p: [
      {
        name: "x",
        detail: "Dolná hranica pre integráciu ERFC.",
      },
    ],
  },
  {
    n: "ERFC.PRECISE",
    d: "Vráti komplementárnu chybovú funkciu integrovanú medzi x a nekonečno.",
    a: "Doplnková chybová funkcia.",
    p: [
      {
        name: "x",
        detail: "Dolná hranica pre integráciu ERFC.PRECISE.",
      },
    ],
  },
  {
    n: "ERROR.TYPE",
    d: "Vráti číslo zodpovedajúce chybe: 1 #NULL!, 2 #DIV/0!, 3 #VALUE!, 4 #REF!, 5 #NAME?, 6 #NUM!, 7 #N/A; ak hodnota nie je chybou, vráti #N/A.",
    a: "Číslo identifikujúce typ chyby.",
    p: [
      {
        name: "chybová_hodnota",
        detail: "Chybová hodnota, ktorej identifikačné číslo chcete nájsť.",
      },
    ],
  },
  {
    n: "EUROCONVERT",
    d: "Konvertuje číslo na eurá, z eur na menu člena euro alebo medzi členskými menami euro pomocou eura ako sprostredkovateľa.",
    a: "Konverzia meny euro.",
    p: [
      {
        name: "číslo",
        detail: "Hodnota meny, ktorú chcete previesť.",
      },
      {
        name: "zdroj",
        detail: 'ISO kód zdrojovej meny, napr. "DEM".',
      },
      {
        name: "cieľ",
        detail: 'ISO kód cieľovej meny, napr. "EUR".',
      },
      {
        name: "úplná_presnosť",
        detail:
          "TRUE zachovať všetky platné číslice; FALSE (predvolené) zaokrúhli na menu.",
      },
      {
        name: "presnosť_triangulácie",
        detail: "Desatinné čísla (3 alebo viac) pre medzihodnotu v eurách.",
      },
    ],
  },
  {
    n: "EVEN",
    d: "Zaokrúhli číslo nahor smerom od nuly na najbližšie párne celé číslo.",
    a: "Zaokrúhli nahor na najbližšie párne celé číslo.",
    p: [
      {
        name: "číslo",
        detail: "Hodnota, ktorá sa má zaokrúhliť.",
      },
    ],
  },
  {
    n: "EXACT",
    d: "Porovná dva textové reťazce a vráti TRUE, ak sú úplne rovnaké, inak FALSE. Rozlišujú sa malé a veľké písmená.",
    a: "Skontroluje, či sú dva texty identické.",
    p: [
      {
        name: "text_1",
        detail: "Prvý textový reťazec.",
      },
      {
        name: "text2",
        detail: "Druhý textový reťazec.",
      },
    ],
  },
  {
    n: "EXP",
    d: "Vráti e umocnené na dané číslo.",
    a: "Číslo e umocnené na zadaný exponent.",
    p: [
      {
        name: "číslo",
        detail: "Exponent aplikovaný na základ e (2,71828182845904).",
      },
    ],
  },
  {
    n: "EXPAND",
    d: "Rozšíri alebo doplní pole na určené rozmery riadkov a stĺpcov.",
    a: "Vyplní pole na danú veľkosť.",
    p: [
      {
        name: "pole",
        detail: "Pole na rozšírenie.",
      },
      {
        name: "riadky",
        detail: "Počet riadkov v rozšírenom poli.",
      },
      {
        name: "stĺpce",
        detail: "Počet stĺpcov v rozšírenom poli; predvolená šírka je `pole`.",
      },
      {
        name: "doplniť_hodnotou",
        detail: "Hodnota, ktorou sa má vyplniť; predvolená hodnota je #N/A.",
      },
    ],
  },
  {
    n: "EXPON.DIST",
    d: "Vráti exponenciálne rozdelenie.",
    a: "Exponenciálne rozdelenie.",
    p: [
      {
        name: "x",
        detail: "Hodnota funkcie.",
      },
      {
        name: "lambda",
        detail: "Hodnota parametra.",
      },
      {
        name: "kumulatívne",
        detail:
          "TRUE vráti funkciu kumulatívneho rozdelenia, FALSE funkciu hustoty pravdepodobnosti.",
      },
    ],
  },
  {
    n: "EXPONDIST",
    d: "Vráti exponenciálne rozdelenie. Zachované z dôvodu kompatibility; pozri EXPON.DIST.",
    a: "Exponenciálna distribúcia (kompatibilita).",
    p: [
      {
        name: "x",
        detail: "Hodnota funkcie.",
      },
      {
        name: "lambda",
        detail: "Hodnota parametra.",
      },
      {
        name: "kumulatívne",
        detail:
          "TRUE vráti funkciu kumulatívneho rozdelenia, FALSE funkciu hustoty pravdepodobnosti.",
      },
    ],
  },
  {
    n: "F.DIST",
    d: "Vráti (ľavostranné) F rozdelenie pravdepodobnosti, stupeň diverzity medzi dvoma súbormi údajov.",
    a: "Ľavostranná F distribúcia.",
    p: [
      {
        name: "x",
        detail: "Hodnota, pri ktorej sa má funkcia vyhodnotiť.",
      },
      {
        name: "stupne_voľnosti1",
        detail: "Čitateľ stupňov voľnosti.",
      },
      {
        name: "stupne_voľnosti2",
        detail: "Menovateľ stupne voľnosti.",
      },
      {
        name: "kumulatívne",
        detail:
          "TRUE vráti funkciu kumulatívneho rozdelenia, FALSE funkciu hustoty pravdepodobnosti.",
      },
    ],
  },
  {
    n: "F.DIST.RT",
    d: "Vráti pravostrannú F distribúciu pravdepodobnosti, stupeň diverzity medzi dvoma súbormi dát.",
    a: "Pravostranná F distribúcia.",
    p: [
      {
        name: "x",
        detail: "Hodnota, pri ktorej sa má funkcia vyhodnotiť.",
      },
      {
        name: "stupne_voľnosti1",
        detail: "Čitateľ stupňov voľnosti.",
      },
      {
        name: "stupne_voľnosti2",
        detail: "Menovateľ stupne voľnosti.",
      },
    ],
  },
  {
    n: "F.INV",
    d: "Vráti inverznú hodnotu (ľavostranného) F rozdelenia pravdepodobnosti.",
    a: "Inverzné ľavostranné F rozdelenie.",
    p: [
      {
        name: "pravdepodobnosť",
        detail: "Pravdepodobnosť spojená s F kumulatívnym rozdelením.",
      },
      {
        name: "stupne_voľnosti1",
        detail: "Čitateľ stupňov voľnosti.",
      },
      {
        name: "stupne_voľnosti2",
        detail: "Menovateľ stupne voľnosti.",
      },
    ],
  },
  {
    n: "F.INV.RT",
    d: "Vráti inverznú hodnotu pravostranného F rozdelenia pravdepodobnosti.",
    a: "Inverzná pravostranná F distribúcia.",
    p: [
      {
        name: "pravdepodobnosť",
        detail: "Pravdepodobnosť spojená s F kumulatívnym rozdelením.",
      },
      {
        name: "stupne_voľnosti1",
        detail: "Čitateľ stupňov voľnosti.",
      },
      {
        name: "stupne_voľnosti2",
        detail: "Menovateľ stupne voľnosti.",
      },
    ],
  },
  {
    n: "F.TEST",
    d: "Vráti výsledok F-testu, obojstrannú pravdepodobnosť, že odchýlky v dvoch poliach sa významne nelíšia.",
    a: "Výsledok F-testu.",
    p: [
      {
        name: "pole1",
        detail: "Prvé pole alebo rozsah údajov.",
      },
      {
        name: "pole2",
        detail: "Druhé pole alebo rozsah údajov.",
      },
    ],
  },
  {
    n: "FACT",
    d: "Vráti faktoriál čísla, ktorý sa rovná 1*2*3*...*číslu.",
    a: "Faktor čísla.",
    p: [
      {
        name: "číslo",
        detail:
          "Nezáporné číslo, ktorého faktoriál chcete; desatinné miesta sú skrátené.",
      },
    ],
  },
  {
    n: "FACTDOUBLE",
    d: "Vráti dvojitý faktoriál čísla.",
    a: "Dvojitý faktoriál čísla.",
    p: [
      {
        name: "číslo",
        detail:
          "Hodnota, pre ktorú sa má vrátiť dvojitý faktoriál; desatinné miesta sú skrátené.",
      },
    ],
  },
  {
    n: "FALSE",
    d: "Vráti logickú hodnotu FALSE.",
    a: "Logická hodnota FALSE.",
    p: [],
  },
  {
    n: "FDIST",
    d: "Vráti pravostranné F rozdelenie pravdepodobnosti. Zachované z dôvodu kompatibility; pozri F.DIST.RT.",
    a: "Pravostranná distribúcia F (staršie).",
    p: [
      {
        name: "x",
        detail: "Hodnota, pri ktorej sa má funkcia vyhodnotiť.",
      },
      {
        name: "stupne_voľnosti1",
        detail: "Čitateľ stupňov voľnosti.",
      },
      {
        name: "stupne_voľnosti2",
        detail: "Menovateľ stupne voľnosti.",
      },
    ],
  },
  {
    n: "FILTER",
    d: "Filtruje rozsah údajov na základe kritérií, ktoré definujete.",
    a: "Riadky alebo stĺpce, ktoré spĺňajú kritériá.",
    p: [
      {
        name: "pole",
        detail: "Pole alebo rozsah na filtrovanie.",
      },
      {
        name: "zahŕňajú",
        detail:
          "Booleovské pole s rovnakou výškou alebo šírkou ako `pole`, kde TRUE uchováva riadok alebo stĺpec.",
      },
      {
        name: "ak_je_prázdny",
        detail:
          "Hodnota, ktorá sa má vrátiť, ak sú všetky hodnoty v zahrnutom poli prázdne (nič sa nezhoduje).",
      },
    ],
  },
  {
    n: "FIND",
    d: "Nájde jeden textový reťazec v druhom textovom reťazci a vráti počiatočnú pozíciu prvého. Rozlišujú sa malé a veľké písmená, žiadne zástupné znaky.",
    a: "Pozícia textu v texte (rozlišujú sa malé a veľké písmená).",
    p: [
      {
        name: "hľadaný_text",
        detail: "Text, ktorý chcete nájsť.",
      },
      {
        name: "v_texte",
        detail: "Text obsahujúci text, ktorý chcete nájsť.",
      },
      {
        name: "počiatočná_pozícia",
        detail: "Znak, ktorým sa má začať vyhľadávanie; predvolene je 1.",
      },
    ],
  },
  {
    n: "FINDB",
    d: "Nájde jeden textový reťazec v druhom a vráti jeho začiatočnú pozíciu, počíta bajty (ako FIND, pokiaľ nie je predvolený jazyk DBCS).",
    a: "Pozícia textu (bajty).",
    p: [
      {
        name: "hľadaný_text",
        detail: "Text, ktorý chcete nájsť.",
      },
      {
        name: "v_texte",
        detail: "Text obsahujúci text, ktorý chcete nájsť.",
      },
      {
        name: "počiatočná_pozícia",
        detail: "Znak, ktorým sa má začať vyhľadávanie.",
      },
    ],
  },
  {
    n: "FINV",
    d: "Vráti inverznú hodnotu pravostranného F rozdelenia pravdepodobnosti. Zachované z dôvodu kompatibility; pozri F.INV.RT.",
    a: "Inverzná pravostranná distribúcia F (staršie).",
    p: [
      {
        name: "pravdepodobnosť",
        detail: "Pravdepodobnosť spojená s F kumulatívnym rozdelením.",
      },
      {
        name: "stupne_voľnosti1",
        detail: "Čitateľ stupňov voľnosti.",
      },
      {
        name: "stupne_voľnosti2",
        detail: "Menovateľ stupne voľnosti.",
      },
    ],
  },
  {
    n: "FISHER",
    d: "Vráti Fisherovu transformáciu v x.",
    a: "Fisherova transformácia.",
    p: [
      {
        name: "x",
        detail: "Číselná hodnota väčšia ako -1 a menšia ako 1.",
      },
    ],
  },
  {
    n: "FISHERINV",
    d: "Vráti inverznú hodnotu Fisherovej transformácie.",
    a: "Inverzná Fisherova transformácia.",
    p: [
      {
        name: "y",
        detail: "Hodnota, pre ktorú chcete vykonať inverznú transformáciu.",
      },
    ],
  },
  {
    n: "FIXED",
    d: "Zaokrúhli číslo na zadaný počet desatinných miest, naformátuje ho v desatinnom formáte s bodkami a čiarkami a vráti výsledok ako text.",
    a: "Formátuje číslo ako text s pevnými desatinnými miestami.",
    p: [
      {
        name: "číslo",
        detail: "Číslo, ktoré chcete zaokrúhliť a previesť na text.",
      },
      {
        name: "desatinné_miesta",
        detail: "Počet číslic napravo od desatinnej čiarky; predvolene na 2.",
      },
      {
        name: "žiadne_čiarky",
        detail: "TRUE bráni FIXED zahrnúť čiarky do vráteného textu.",
      },
    ],
  },
  {
    n: "FLOOR",
    d: "Zaokrúhli číslo nadol, smerom k nule, na najbližší násobok významnosti.",
    a: "Zaokrúhli nadol na najbližší násobok.",
    p: [
      {
        name: "číslo",
        detail: "Číselná hodnota, ktorú chcete zaokrúhliť.",
      },
      {
        name: "násobok",
        detail: "Násobok, na ktorý chcete zaokrúhliť.",
      },
    ],
  },
  {
    n: "FLOOR.MATH",
    d: "Zaokrúhli číslo nadol na najbližšie celé číslo alebo na najbližší násobok významnosti s kontrolou nad smerom záporných čísel.",
    a: "Zaokrúhli nadol na najbližšie celé číslo alebo násobok.",
    p: [
      {
        name: "číslo",
        detail: "Číslo, ktoré sa má zaokrúhliť nadol.",
      },
      {
        name: "násobok",
        detail: "Násobok, na ktorý sa má zaokrúhliť; predvolene je 1.",
      },
      {
        name: "režim",
        detail:
          "Pre záporné čísla sa nenulová hodnota zaokrúhľuje smerom k nule; 0 alebo vynechané zaokrúhlenia od nuly.",
      },
    ],
  },
  {
    n: "FLOOR.PRECISE",
    d: "Zaokrúhli číslo nadol na najbližšie celé číslo alebo na najbližší násobok významnosti bez ohľadu na znamienko čísla.",
    a: "Zaokrúhľuje sa nadol bez ohľadu na znamienko.",
    p: [
      {
        name: "číslo",
        detail: "Hodnota, ktorá sa má zaokrúhliť.",
      },
      {
        name: "násobok",
        detail:
          "Násobok, na ktorý je číslo zaokrúhlené; predvolená hodnota je 1. Jeho znamienko sa ignoruje.",
      },
    ],
  },
  {
    n: "FORECAST",
    d: "Vypočíta alebo predpovedá budúcu hodnotu pomocou existujúcich hodnôt a lineárnej regresie. Zachované z dôvodu kompatibility; pozri FORECAST.LINEAR.",
    a: "Predpovedá hodnotu lineárnou regresiou.",
    p: [
      {
        name: "x",
        detail: "Údajový bod, pre ktorý chcete predpovedať hodnotu.",
      },
      {
        name: "známe_y",
        detail: "Závislé pole alebo rozsah dát.",
      },
      {
        name: "známe_x",
        detail: "Nezávislé pole alebo rozsah dát.",
      },
    ],
  },
  {
    n: "FORECAST.ETS",
    d: "Predpovedá budúcu hodnotu z historických hodnôt pomocou aditívneho exponenciálneho vyhladzovania (AAA verzia ETS).",
    a: "Predpoveď s exponenciálnym vyhladzovaním.",
    p: [
      {
        name: "cieľový_dátum",
        detail: "Dátum alebo číslo, pre ktoré sa má predpovedať hodnota.",
      },
      {
        name: "hodnoty",
        detail: "Historické hodnoty, z ktorých sa má predpovedať.",
      },
      {
        name: "časová_os",
        detail: "Dátumy alebo čísla historických hodnôt s konštantným krokom.",
      },
      {
        name: "sezónnosť",
        detail:
          "Dĺžka sezónneho vzoru: 1 alebo vynechaný ho deteguje, 0 znamená žiadny.",
      },
      {
        name: "doplnenie_údajov",
        detail:
          "1 (predvolené) interpoluje chýbajúce body, 0 ich považuje za nuly.",
      },
      {
        name: "súhrn",
        detail:
          "Ako sa kombinujú hodnoty s rovnakou časovou pečiatkou: 1 AVERAGE (predvolené) až 7 SUM.",
      },
    ],
  },
  {
    n: "FORECAST.ETS.CONFINT",
    d: "Vráti polovičnú šírku intervalu spoľahlivosti pre predpoveď FORECAST.ETS.",
    a: "Interval spoľahlivosti predpovede ETS.",
    p: [
      {
        name: "cieľový_dátum",
        detail: "Dátum alebo číslo, na ktoré sa vzťahuje predpoveď.",
      },
      {
        name: "hodnoty",
        detail: "Historické hodnoty, z ktorých sa má predpovedať.",
      },
      {
        name: "časová_os",
        detail: "Dátumy alebo čísla historických hodnôt s konštantným krokom.",
      },
      {
        name: "úroveň_spoľahlivosti",
        detail: "Úroveň spoľahlivosti medzi 0 a 1; predvolená hodnota 0,95.",
      },
      {
        name: "sezónnosť",
        detail:
          "Dĺžka sezónneho vzoru: 1 alebo vynechaný ho deteguje, 0 znamená žiadny.",
      },
      {
        name: "doplnenie_údajov",
        detail:
          "1 (predvolené) interpoluje chýbajúce body, 0 ich považuje za nuly.",
      },
      {
        name: "súhrn",
        detail:
          "Ako sa kombinujú hodnoty s rovnakou časovou pečiatkou: 1 AVERAGE (predvolené) až 7 SUM.",
      },
    ],
  },
  {
    n: "FORECAST.ETS.SEASONALITY",
    d: "Vráti dĺžku opakujúceho sa vzoru FORECAST.ETS detegovaného v časovom rade.",
    a: "Dĺžka zistenej sezónnosti.",
    p: [
      {
        name: "hodnoty",
        detail: "Historické hodnoty, z ktorých sa má predpovedať.",
      },
      {
        name: "časová_os",
        detail: "Dátumy alebo čísla historických hodnôt s konštantným krokom.",
      },
      {
        name: "doplnenie_údajov",
        detail:
          "1 (predvolené) interpoluje chýbajúce body, 0 ich považuje za nuly.",
      },
      {
        name: "súhrn",
        detail:
          "Ako sa kombinujú hodnoty s rovnakou časovou pečiatkou: 1 AVERAGE (predvolené) až 7 SUM.",
      },
    ],
  },
  {
    n: "FORECAST.ETS.STAT",
    d: "Vráti štatistiku modelu FORECAST.ETS: 1 alfa, 2 beta, 3 gama, 4 MASE, 5 SMAPE, 6 MAE, 7 RMSE, veľkosť 8 krokov.",
    a: "Štatistika predpovede ETS.",
    p: [
      {
        name: "hodnoty",
        detail: "Historické hodnoty, z ktorých sa má predpovedať.",
      },
      {
        name: "časová_os",
        detail: "Dátumy alebo čísla historických hodnôt s konštantným krokom.",
      },
      {
        name: "štatistický_typ",
        detail: "Ktorú štatistiku vrátiť, 1 až 8.",
      },
      {
        name: "sezónnosť",
        detail:
          "Dĺžka sezónneho vzoru: 1 alebo vynechaný ho deteguje, 0 znamená žiadny.",
      },
      {
        name: "doplnenie_údajov",
        detail:
          "1 (predvolené) interpoluje chýbajúce body, 0 ich považuje za nuly.",
      },
      {
        name: "súhrn",
        detail:
          "Ako sa kombinujú hodnoty s rovnakou časovou pečiatkou: 1 AVERAGE (predvolené) až 7 SUM.",
      },
    ],
  },
  {
    n: "FORECAST.LINEAR",
    d: "Vypočíta alebo predpovedá budúcu hodnotu pomocou existujúcich hodnôt a lineárnej regresie.",
    a: "Predpovedá hodnotu lineárnou regresiou.",
    p: [
      {
        name: "x",
        detail: "Údajový bod, pre ktorý chcete predpovedať hodnotu.",
      },
      {
        name: "známe_y",
        detail: "Závislé pole alebo rozsah dát.",
      },
      {
        name: "známe_x",
        detail: "Nezávislé pole alebo rozsah dát.",
      },
    ],
  },
  {
    n: "FORMULATEXT",
    d: "Vráti vzorec ako reťazec.",
    a: "Vzorec bunky ako text.",
    p: [
      {
        name: "odkaz",
        detail: "Odkaz na bunku alebo rozsah buniek.",
      },
    ],
  },
  {
    n: "FREQUENCY",
    d: "Vypočíta, ako často sa hodnoty vyskytujú v rámci rozsahov hodnôt, a vráti vertikálne pole s jedným prvkom viac ako hranice_intervalov.",
    a: "Rozdelenie hodnôt podľa frekvencie.",
    p: [
      {
        name: "dátové_pole",
        detail:
          "Pole alebo rozsah hodnôt, pre ktoré chcete počítať frekvencie.",
      },
      {
        name: "hranice_intervalov",
        detail:
          "Pole alebo rozsah intervalov, do ktorých chcete zoskupiť hodnoty.",
      },
    ],
  },
  {
    n: "FTEST",
    d: "Vráti výsledok F-testu. Zachované z dôvodu kompatibility; pozri F.TEST.",
    a: "Výsledok F-testu (kompatibilita).",
    p: [
      {
        name: "pole1",
        detail: "Prvé pole alebo rozsah údajov.",
      },
      {
        name: "pole2",
        detail: "Druhé pole alebo rozsah údajov.",
      },
    ],
  },
  {
    n: "FV",
    d: "Vypočíta budúcu hodnotu investície na základe konštantnej úrokovej sadzby s pravidelnými stálymi platbami alebo jednorazovou sumou.",
    a: "Budúca hodnota investície.",
    p: [
      {
        name: "sadzba",
        detail: "Úroková sadzba za obdobie.",
      },
      {
        name: "počet_období",
        detail: "Celkový počet platobných období.",
      },
      {
        name: "splátka",
        detail:
          "Platba uskutočnená v každom období; nemôže sa počas životnosti anuity meniť.",
      },
      {
        name: "súčasná_hodnota",
        detail:
          "Súčasná hodnota alebo paušálna suma, ktorú má práve teraz séria budúcich platieb; predvolene je 0.",
      },
      {
        name: "typ",
        detail:
          "Keď sú platby splatné: 0 alebo vynechané na konci obdobia, 1 na začiatku.",
      },
    ],
  },
  {
    n: "FVSCHEDULE",
    d: "Vráti budúcu hodnotu počiatočnej istiny po použití série zložených úrokových sadzieb.",
    a: "Budúca hodnota s variabilnými sadzbami.",
    p: [
      {
        name: "istina",
        detail: "Súčasná hodnota.",
      },
      {
        name: "sadzby_období",
        detail: "Súbor úrokových sadzieb, ktoré sa majú použiť.",
      },
    ],
  },
  {
    n: "GAMMA",
    d: "Vráti hodnotu funkcie gama.",
    a: "Hodnota funkcie gama.",
    p: [
      {
        name: "x",
        detail: "Číslo, pre ktoré sa má vypočítať gama.",
      },
    ],
  },
  {
    n: "GAMMA.DIST",
    d: "Vráti gama rozdelenie.",
    a: "Rozdelenie gama.",
    p: [
      {
        name: "x",
        detail: "Hodnota, pri ktorej chcete vyhodnotiť rozdelenie.",
      },
      {
        name: "alfa",
        detail: "Parameter distribúcie.",
      },
      {
        name: "beta",
        detail:
          "Parameter distribúcie. Ak je 1, vráti štandardné gama rozdelenie.",
      },
      {
        name: "kumulatívne",
        detail:
          "TRUE vráti funkciu kumulatívneho rozdelenia, FALSE funkciu hustoty pravdepodobnosti.",
      },
    ],
  },
  {
    n: "GAMMA.INV",
    d: "Vráti inverznú hodnotu gama kumulatívneho rozdelenia.",
    a: "Inverzná gama distribúcia.",
    p: [
      {
        name: "pravdepodobnosť",
        detail: "Pravdepodobnosť spojená s gama distribúciou.",
      },
      {
        name: "alfa",
        detail: "Parameter distribúcie.",
      },
      {
        name: "beta",
        detail: "Parameter distribúcie.",
      },
    ],
  },
  {
    n: "GAMMADIST",
    d: "Vráti gama rozdelenie. Zachované z dôvodu kompatibility; pozri GAMMA.DIST.",
    a: "Distribúcia gama (starosť).",
    p: [
      {
        name: "x",
        detail: "Hodnota, pri ktorej chcete vyhodnotiť rozdelenie.",
      },
      {
        name: "alfa",
        detail: "Parameter distribúcie.",
      },
      {
        name: "beta",
        detail: "Parameter distribúcie.",
      },
      {
        name: "kumulatívne",
        detail:
          "TRUE vráti funkciu kumulatívneho rozdelenia, FALSE funkciu hustoty pravdepodobnosti.",
      },
    ],
  },
  {
    n: "GAMMAINV",
    d: "Vráti inverznú hodnotu gama kumulatívneho rozdelenia. Zachované z dôvodu kompatibility; pozri GAMMA.INV.",
    a: "Inverzná gama distribúcia (starosť).",
    p: [
      {
        name: "pravdepodobnosť",
        detail: "Pravdepodobnosť spojená s gama distribúciou.",
      },
      {
        name: "alfa",
        detail: "Parameter distribúcie.",
      },
      {
        name: "beta",
        detail: "Parameter distribúcie.",
      },
    ],
  },
  {
    n: "GAMMALN",
    d: "Vráti prirodzený logaritmus funkcie gama.",
    a: "Prirodzený logaritmus gama.",
    p: [
      {
        name: "x",
        detail: "Hodnota, pre ktorú chcete vypočítať GAMMALN.",
      },
    ],
  },
  {
    n: "GAMMALN.PRECISE",
    d: "Vráti prirodzený logaritmus funkcie gama.",
    a: "Prirodzený logaritmus gama.",
    p: [
      {
        name: "x",
        detail: "Hodnota, pre ktorú chcete vypočítať GAMMALN.PRECISE.",
      },
    ],
  },
  {
    n: "GAUSS",
    d: "Vypočíta pravdepodobnosť, že člen štandardnej normálnej populácie bude spadať medzi priemer a z štandardných odchýlok od priemeru.",
    a: "Pravdepodobnosť medzi priemerom a z pri normovanom normálnom rozdelení.",
    p: [
      {
        name: "z",
        detail: "Počet štandardných odchýlok od priemeru.",
      },
    ],
  },
  {
    n: "GCD",
    d: "Vráti najväčšieho spoločného deliteľa dvoch alebo viacerých celých čísel.",
    a: "Najväčší spoločný deliteľ.",
    p: [
      {
        name: "číslo1",
        detail: "Prvá hodnota alebo rozsah; desatinné miesta sú skrátené.",
      },
      {
        name: "číslo2",
        detail: "Ďalšie hodnoty alebo rozsahy, celkovo až 255.",
      },
    ],
  },
  {
    n: "GEOMEAN",
    d: "Vráti geometrický priemer poľa alebo rozsahu kladných údajov.",
    a: "Geometrický priemer.",
    p: [
      {
        name: "číslo1",
        detail: "Prvé číslo alebo rozsah.",
      },
      {
        name: "číslo2",
        detail: "Ďalšie čísla alebo rozsahy, celkovo až 255.",
      },
    ],
  },
  {
    n: "GESTEP",
    d: "Vráti 1, ak je číslo väčšie alebo rovné kroku; inak vráti 0.",
    a: "Testuje, či je číslo aspoň prahom.",
    p: [
      {
        name: "číslo",
        detail: "Hodnota na testovanie oproti `krok`.",
      },
      {
        name: "krok",
        detail: "Prahová hodnota; predvolene je 0.",
      },
    ],
  },
  {
    n: "GETPIVOTDATA",
    d: "Vráti údaje uložené v zostave kontingenčnej tabuľky: hodnotu údajového poľa pre daný pár polí / položiek.",
    a: "Hodnota z kontingenčnej tabuľky.",
    p: [
      {
        name: "dátové_pole",
        detail: 'Názov poľa hodnôt, napr. `"Sales"` alebo `"Sum of Sales"`.',
      },
      {
        name: "kontingenčná_tabuľka",
        detail: "Odkaz na ľubovoľnú bunku kontingenčnej tabuľky.",
      },
      {
        name: "pole_1",
        detail: "Pole riadkov alebo stĺpcov kontingenčnej tabuľky.",
      },
      {
        name: "položka_1",
        detail: "Položka `pole_1` na vrátenie hodnoty.",
      },
    ],
  },
  {
    n: "GROUPBY",
    d: "Zoskupuje riadky podľa hodnôt jedného alebo viacerých polí a agreguje hodnoty každej skupiny s voliteľnými hlavičkami, súčtom, triedením a filtrovaním.",
    a: "Skupinové a agregované riadky.",
    p: [
      {
        name: "riadkové_polia",
        detail:
          "Stĺpcovo orientované hodnoty na zoskupenie; niekoľko stĺpcov tvorí hierarchiu.",
      },
      {
        name: "hodnoty",
        detail: "Stĺpcovo orientované hodnoty na agregáciu.",
      },
      {
        name: "funkciu",
        detail:
          "LAMBDA alebo názov funkcie (SUM, AVERAGE, COUNT, PERCENTOF, ...), ktorý agreguje každú skupinu; niekoľko ako HSTACK alebo pole.",
      },
      {
        name: "hlavičky_polí",
        detail:
          "Či majú údaje hlavičky a či sa majú zobraziť: 0 nie, 1 áno, ale skryť, 2 nie, ale vygenerovať, 3 áno a zobraziť.",
      },
      {
        name: "úroveň_súčtov",
        detail:
          "Súčty: 0 žiadne, 1 celkový súčet (predvolené), 2 súčty a medzisúčty; negatívne ich stavia na vrchol.",
      },
      {
        name: "poradie_triedenia",
        detail: "Číslo(a) stĺpca na zoradenie, záporné na zostupné.",
      },
      {
        name: "pole_filtrov",
        detail: "Booleovský výber, ktoré riadky sa majú zahrnúť.",
      },
      {
        name: "vzťah_poľa",
        detail:
          "0 hierarchia (predvolené) alebo 1 tabuľka pre niekoľko riadkových polí.",
      },
    ],
  },
  {
    n: "GROWTH",
    d: "Vypočíta predpovedaný exponenciálny rast pomocou existujúcich údajov, pričom vráti y-hodnoty pre sériu nových x-hodnôt.",
    a: "Predpokladaný exponenciálny rast.",
    p: [
      {
        name: "známe_y",
        detail: "Množina y-hodnôt, ktoré už poznáte vo vzťahu y = b*m^x.",
      },
      {
        name: "známe_x",
        detail: "Voliteľný súbor x-hodnôt, ktoré už možno poznáte.",
      },
      {
        name: "nové_x",
        detail:
          "Nové hodnoty x, pre ktoré chcete, aby GROWTH vrátilo zodpovedajúce hodnoty y.",
      },
      {
        name: "konšt",
        detail:
          "TRUE alebo vynechané vypočíta b normálne; FALSE prinúti b, aby sa rovnalo 1.",
      },
    ],
  },
  {
    n: "HARMEAN",
    d: "Vráti harmonický priemer súboru údajov, prevrátenú hodnotu aritmetického priemeru prevrátených hodnôt.",
    a: "Harmonický priemer.",
    p: [
      {
        name: "číslo1",
        detail: "Prvé číslo alebo rozsah.",
      },
      {
        name: "číslo2",
        detail: "Ďalšie čísla alebo rozsahy, celkovo až 255.",
      },
    ],
  },
  {
    n: "HEX2BIN",
    d: "Konvertuje hexadecimálne číslo na binárne.",
    a: "Prevod zo šestnástkovej do dvojkovej sústavy.",
    p: [
      {
        name: "číslo",
        detail: "Šestnástkové číslo, ktoré sa má previesť; najviac 10 znakov.",
      },
      {
        name: "počet_miest",
        detail:
          "Počet znakov, ktoré sa majú použiť; výsledok je doplnený vodiacimi nulami.",
      },
    ],
  },
  {
    n: "HEX2DEC",
    d: "Konvertuje hexadecimálne číslo na desiatkové.",
    a: "Prevod zo šestnástkovej do desiatkovej sústavy.",
    p: [
      {
        name: "číslo",
        detail:
          "Šestnástkové číslo na konverziu; maximálne 10 znakov (40 bitov).",
      },
    ],
  },
  {
    n: "HEX2OCT",
    d: "Skonvertuje hexadecimálne číslo na osmičkové.",
    a: "Prevod zo šestnástkovej do osmičkovej sústavy.",
    p: [
      {
        name: "číslo",
        detail: "Šestnástkové číslo, ktoré sa má previesť; najviac 10 znakov.",
      },
      {
        name: "počet_miest",
        detail:
          "Počet znakov, ktoré sa majú použiť; výsledok je doplnený vodiacimi nulami.",
      },
    ],
  },
  {
    n: "HLOOKUP",
    d: "Vyhľadá hodnotu v hornom riadku tabuľky alebo poľa a vráti hodnotu v rovnakom stĺpci z riadku, ktorý určíte.",
    a: "Horizontálne vyhľadávanie.",
    p: [
      {
        name: "hľadaná_hodnota",
        detail: "Hodnota, ktorá sa má nájsť v prvom riadku tabuľky.",
      },
      {
        name: "pole_tabuľky",
        detail: "Tabuľka informácií, v ktorej sa vyhľadávajú dáta.",
      },
      {
        name: "index_riadka",
        detail:
          "Číslo riadku v `pole_tabuľky`, z ktorého sa vráti zodpovedajúca hodnota.",
      },
      {
        name: "približná_zhoda",
        detail:
          "TRUE alebo vynechané nájde približnú zhodu; FALSE nájde presnú zhodu.",
      },
    ],
  },
  {
    n: "HOUR",
    d: "Vráti hodinu časovej hodnoty ako celé číslo od 0 (00:00) do 23 (23:00).",
    a: "Hodinová zložka času.",
    p: [
      {
        name: "poradové_číslo",
        detail: "Čas, ktorý obsahuje hodinu, ktorú chcete nájsť.",
      },
    ],
  },
  {
    n: "HSTACK",
    d: "Pripája polia horizontálne a postupne, aby vrátilo väčšie pole.",
    a: "Ukladá polia vedľa seba.",
    p: [
      {
        name: "pole1",
        detail: "Prvé pole na pripojenie.",
      },
      {
        name: "pole2",
        detail: "Ďalšie polia na pripojenie.",
      },
    ],
  },
  {
    n: "HYPERLINK",
    d: "Vytvorí odkaz, ktorý preskočí na iné miesto v aktuálnom zošite alebo otvorí dokument alebo webovú stránku.",
    a: "Vytvorí hypertextový odkaz.",
    p: [
      {
        name: "umiestnenie_odkazu",
        detail:
          "Cesta a názov súboru dokumentu alebo webovej stránky, ktoré sa majú otvoriť, alebo umiestnenie v zošite.",
      },
      {
        name: "zobrazovaný_názov",
        detail:
          "Preskočený text alebo číselná hodnota zobrazená v bunke; predvolená hodnota je `umiestnenie_odkazu`.",
      },
    ],
  },
  {
    n: "HYPGEOM.DIST",
    d: "Vráti hypergeometrické rozdelenie, pravdepodobnosť daného počtu úspechov vo výbere.",
    a: "Hypergeometrické rozdelenie.",
    p: [
      {
        name: "úspechy_vo_výbere",
        detail: "Počet úspechov vo vzorke.",
      },
      {
        name: "veľkosť_výberu",
        detail: "Veľkosť vzorky.",
      },
      {
        name: "úspechy_v_populácii",
        detail: "Počet úspechov v populácii.",
      },
      {
        name: "veľkosť_populácie",
        detail: "Veľkosť populácie.",
      },
      {
        name: "kumulatívne",
        detail:
          "TRUE vráti funkciu kumulatívneho rozdelenia, FALSE funkciu hmotnosti pravdepodobnosti.",
      },
    ],
  },
  {
    n: "HYPGEOMDIST",
    d: "Vráti hypergeometrické rozdelenie. Zachované z dôvodu kompatibility; pozri HYPGEOM.DIST.",
    a: "Hypergeometrické rozdelenie (staršie).",
    p: [
      {
        name: "úspechy_vo_výbere",
        detail: "Počet úspechov vo vzorke.",
      },
      {
        name: "veľkosť_výberu",
        detail: "Veľkosť vzorky.",
      },
      {
        name: "úspechy_v_populácii",
        detail: "Počet úspechov v populácii.",
      },
      {
        name: "veľkosť_populácie",
        detail: "Veľkosť populácie.",
      },
    ],
  },
  {
    n: "IF",
    d: "Vráti jednu hodnotu, ak sa logický test vyhodnotí ako TRUE a inú hodnotu, ak sa vyhodnotí ako FALSE.",
    a: "Vyberie hodnotu na základe podmienky.",
    p: [
      {
        name: "logický_test",
        detail: "Stav, ktorý chcete testovať.\nHodnota",
      },
      {
        name: ",_ak_je_pravdivá",
        detail: "Hodnota, ktorá sa má vrátiť, ak `logický_test` je TRUE.",
      },
      {
        name: "hodnota,_ak_je_nepravda",
        detail:
          "Hodnota, ktorá sa má vrátiť, ak `logický_test` je FALSE; predvolená hodnota je FALSE.",
      },
    ],
  },
  {
    n: "IFERROR",
    d: "Vráti zadanú hodnotu, ak sa vzorec vyhodnotí ako chyba; v opačnom prípade vráti výsledok vzorca.",
    a: "Záložná hodnota pri chybe.",
    p: [
      {
        name: "hodnota",
        detail: "Argument, pri ktorom sa kontroluje chyba.",
      },
      {
        name: "hodnota_v_prípade_chyby",
        detail:
          "Hodnota vrátená, ak sa `hodnota` vyhodnotí ako chyba (#N/A, #VALUE!, #REF!, #DIV/0!, #NUM!, #NAME? alebo #NULL!).",
      },
    ],
  },
  {
    n: "IFNA",
    d: "Vráti zadanú hodnotu, ak sa výraz vyhodnotí ako #N/A; v opačnom prípade vráti výsledok výrazu.",
    a: "Záložná hodnota na #N/A.",
    p: [
      {
        name: "hodnota",
        detail: "Argument, ktorý sa kontroluje na chybovú hodnotu #N/A.",
      },
      {
        name: "hodnota_pri_NA",
        detail:
          "Hodnota, ktorá sa má vrátiť, ak sa `hodnota` vyhodnotí ako #N/A.",
      },
    ],
  },
  {
    n: "IFS",
    d: "Skontroluje, či je splnená jedna alebo viac podmienok a vráti hodnotu, ktorá zodpovedá prvej TRUE podmienke.",
    a: "Hodnota pre prvú podmienku TRUE.",
    p: [
      {
        name: "logický_test1",
        detail: "Prvá podmienka, ktorá sa vyhodnotí ako TRUE alebo FALSE.",
      },
      {
        name: "hodnota_pri_TRUE1",
        detail: "Výsledok, ktorý sa vráti, ak `logický_test1` je TRUE.",
      },
      {
        name: "logický_test2",
        detail: "Ďalšie podmienky, až 127 párov stav/hodnota.",
      },
      {
        name: "hodnota_pri_TRUE2",
        detail: "Výsledok, ktorý sa vráti, ak zodpovedajúca podmienka je TRUE.",
      },
    ],
  },
  {
    n: "IMABS",
    d: "Vráti absolútnu hodnotu (modul) komplexného čísla v textovom formáte x + yi alebo x + yj.",
    a: "Absolútna hodnota komplexného čísla.",
    p: [
      {
        name: "komplexné_číslo",
        detail: "Komplexné číslo, pre ktoré chcete získať absolútnu hodnotu.",
      },
    ],
  },
  {
    n: "IMAGE",
    d: "Vloží obrázok do bunky zo zdrojového umiestnenia (https alebo data:image URL) s alternatívnym textom.",
    a: "Obrázok z adresy URL.",
    p: [
      {
        name: "zdroj",
        detail: "URL obrázku (https:// alebo data:image URL).",
      },
      {
        name: "alternatívny_text",
        detail: "Alternatívny text popisujúci obrázok.",
      },
      {
        name: "dimenzovanie",
        detail:
          "Rozmery obrázka: 0 prispôsobené, 1 výplň, 2 pôvodné, 3 vlastné.",
      },
      {
        name: "výška",
        detail: "Vlastná výška v pixeloch (veľkosť 3).",
      },
      {
        name: "šírka",
        detail: "Vlastná šírka v pixeloch (veľkosť 3).",
      },
    ],
  },
  {
    n: "IMAGINARY",
    d: "Vráti imaginárny koeficient komplexného čísla v textovom formáte x + yi alebo x + yj.",
    a: "Imaginárny koeficient komplexného čísla.",
    p: [
      {
        name: "komplexné_číslo",
        detail: "Komplexné číslo, pre ktoré chcete imaginárny koeficient.",
      },
    ],
  },
  {
    n: "IMARGUMENT",
    d: "Vráti argument theta, uhol vyjadrený v radiánoch komplexného čísla.",
    a: "Argument (uhol) komplexného čísla.",
    p: [
      {
        name: "komplexné_číslo",
        detail: "Komplexné číslo, pre ktoré chcete argument.",
      },
    ],
  },
  {
    n: "IMCONJUGATE",
    d: "Vráti komplexný konjugát komplexného čísla v textovom formáte x + yi alebo x + yj.",
    a: "Komplexný konjugát.",
    p: [
      {
        name: "komplexné_číslo",
        detail: "Komplexné číslo, pre ktoré chcete konjugovať.",
      },
    ],
  },
  {
    n: "IMCOS",
    d: "Vráti kosínus komplexného čísla v textovom formáte x + yi alebo x + yj.",
    a: "Kosínus komplexného čísla.",
    p: [
      {
        name: "komplexné_číslo",
        detail: "Komplexné číslo, pre ktoré chcete mať kosínus.",
      },
    ],
  },
  {
    n: "IMCOSH",
    d: "Vráti hyperbolický kosínus komplexného čísla v textovom formáte x + yi alebo x + yj.",
    a: "Hyperbolický kosínus komplexného čísla.",
    p: [
      {
        name: "komplexné_číslo",
        detail: "Komplexné číslo, pre ktoré chcete hyperbolický kosínus.",
      },
    ],
  },
  {
    n: "IMCOT",
    d: "Vráti kotangens komplexného čísla v textovom formáte x + yi alebo x + yj.",
    a: "Kotangens komplexného čísla.",
    p: [
      {
        name: "komplexné_číslo",
        detail: "Komplexné číslo, pre ktoré chcete kotangens.",
      },
    ],
  },
  {
    n: "IMCSC",
    d: "Vráti kosekans komplexného čísla v textovom formáte x + yi alebo x + yj.",
    a: "Kosekans komplexného čísla.",
    p: [
      {
        name: "komplexné_číslo",
        detail: "Komplexné číslo, pre ktoré chcete kosekans.",
      },
    ],
  },
  {
    n: "IMCSCH",
    d: "Vráti hyperbolický kosekans komplexného čísla v textovom formáte x + yi alebo x + yj.",
    a: "Hyperbolický kosekans komplexného čísla.",
    p: [
      {
        name: "komplexné_číslo",
        detail: "Komplexné číslo, pre ktoré chcete hyperbolický kosekans.",
      },
    ],
  },
  {
    n: "IMDIV",
    d: "Vráti podiel dvoch komplexných čísel v textovom formáte x + yi alebo x + yj.",
    a: "Podiel dvoch komplexných čísel.",
    p: [
      {
        name: "komplexné_číslo1",
        detail: "Komplexný čitateľ alebo dividenda.",
      },
      {
        name: "komplexné_číslo2",
        detail: "Komplexný menovateľ alebo deliteľ.",
      },
    ],
  },
  {
    n: "IMEXP",
    d: "Vráti exponenciálu komplexného čísla v textovom formáte x + yi alebo x + yj.",
    a: "Exponenciála komplexného čísla.",
    p: [
      {
        name: "komplexné_číslo",
        detail: "Komplexné číslo, pre ktoré chcete exponenciálu.",
      },
    ],
  },
  {
    n: "IMLN",
    d: "Vráti prirodzený logaritmus komplexného čísla v textovom formáte x + yi alebo x + yj.",
    a: "Prirodzený logaritmus komplexného čísla.",
    p: [
      {
        name: "komplexné_číslo",
        detail: "Komplexné číslo, pre ktoré chcete prirodzený logaritmus.",
      },
    ],
  },
  {
    n: "IMLOG10",
    d: "Vráti spoločný logaritmus (základ 10) komplexného čísla v textovom formáte x + yi alebo x + yj.",
    a: "Základ-10 logaritmus komplexného čísla.",
    p: [
      {
        name: "komplexné_číslo",
        detail: "Komplexné číslo, pre ktoré chcete mať spoločný logaritmus.",
      },
    ],
  },
  {
    n: "IMLOG2",
    d: "Vráti logaritmus so základom 2 komplexného čísla v textovom formáte x + yi alebo x + yj.",
    a: "Základ-2 logaritmus komplexného čísla.",
    p: [
      {
        name: "komplexné_číslo",
        detail: "Komplexné číslo, pre ktoré chcete logaritmus so základom 2.",
      },
    ],
  },
  {
    n: "IMPOWER",
    d: "Vráti komplexné číslo v textovom formáte x + yi alebo x + yj umocnené na mocninu.",
    a: "Komplexné číslo umocnené.",
    p: [
      {
        name: "komplexné_číslo",
        detail: "Komplexné číslo, ktoré chcete umocniť.",
      },
      {
        name: "číslo",
        detail: "Mocnina, na ktorú chcete zvýšiť komplexné číslo.",
      },
    ],
  },
  {
    n: "IMPRODUCT",
    d: "Vráti súčin 1 až 255 komplexných čísel v textovom formáte x + yi alebo x + yj.",
    a: "Súčin komplexných čísel.",
    p: [
      {
        name: "komplexné_číslo1",
        detail: "Prvé komplexné číslo, ktoré sa má vynásobiť.",
      },
      {
        name: "komplexné_číslo2",
        detail: "Ďalšie komplexné čísla na násobenie, celkovo až 255.",
      },
    ],
  },
  {
    n: "IMREAL",
    d: "Vráti reálny koeficient komplexného čísla v textovom formáte x + yi alebo x + yj.",
    a: "Reálny koeficient komplexného čísla.",
    p: [
      {
        name: "komplexné_číslo",
        detail: "Komplexné číslo, pre ktoré chcete skutočný koeficient.",
      },
    ],
  },
  {
    n: "IMSEC",
    d: "Vráti sekans komplexného čísla v textovom formáte x + yi alebo x + yj.",
    a: "Sekans komplexného čísla.",
    p: [
      {
        name: "komplexné_číslo",
        detail: "Komplexné číslo, pre ktoré chcete sekans.",
      },
    ],
  },
  {
    n: "IMSECH",
    d: "Vráti hyperbolický sekans komplexného čísla v textovom formáte x + yi alebo x + yj.",
    a: "Hyperbolický sekans komplexného čísla.",
    p: [
      {
        name: "komplexné_číslo",
        detail: "Komplexné číslo, pre ktoré chcete hyperbolický sekans.",
      },
    ],
  },
  {
    n: "IMSIN",
    d: "Vráti sínus komplexného čísla v textovom formáte x + yi alebo x + yj.",
    a: "Sínus komplexného čísla.",
    p: [
      {
        name: "komplexné_číslo",
        detail: "Komplexné číslo, pre ktoré chcete sínus.",
      },
    ],
  },
  {
    n: "IMSINH",
    d: "Vráti hyperbolický sínus komplexného čísla v textovom formáte x + yi alebo x + yj.",
    a: "Hyperbolický sínus komplexného čísla.",
    p: [
      {
        name: "komplexné_číslo",
        detail: "Komplexné číslo, pre ktoré chcete hyperbolický sínus.",
      },
    ],
  },
  {
    n: "IMSQRT",
    d: "Vráti druhú odmocninu komplexného čísla v textovom formáte x + yi alebo x + yj.",
    a: "Druhá odmocnina komplexného čísla.",
    p: [
      {
        name: "komplexné_číslo",
        detail: "Komplexné číslo, pre ktoré chcete druhú odmocninu.",
      },
    ],
  },
  {
    n: "IMSUB",
    d: "Vráti rozdiel dvoch komplexných čísel v textovom formáte x + yi alebo x + yj.",
    a: "Rozdiel dvoch komplexných čísel.",
    p: [
      {
        name: "komplexné_číslo1",
        detail:
          "Komplexné číslo, od ktorého sa má odpočítať `komplexné_číslo2`.",
      },
      {
        name: "komplexné_číslo2",
        detail: "Komplexné číslo, ktoré sa má odpočítať od `komplexné_číslo1`.",
      },
    ],
  },
  {
    n: "IMSUM",
    d: "Vráti súčet dvoch alebo viacerých komplexných čísel v textovom formáte x + yi alebo x + yj.",
    a: "Súčet komplexných čísel.",
    p: [
      {
        name: "komplexné_číslo1",
        detail: "Prvé komplexné číslo, ktoré sa má pridať.",
      },
      {
        name: "komplexné_číslo2",
        detail: "Ďalšie komplexné čísla na sčítanie, celkovo až 255.",
      },
    ],
  },
  {
    n: "IMTAN",
    d: "Vráti tangens komplexného čísla v textovom formáte x + yi alebo x + yj.",
    a: "Tangens komplexného čísla.",
    p: [
      {
        name: "komplexné_číslo",
        detail: "Komplexné číslo, pre ktoré chcete tangens.",
      },
    ],
  },
  {
    n: "INDEX",
    d: "Vráti hodnotu prvku v tabuľke alebo poli vybranú podľa indexov čísel riadkov a stĺpcov.",
    a: "Hodnota v riadku a stĺpci rozsahu.",
    p: [
      {
        name: "pole",
        detail: "Rozsah buniek alebo konštanta poľa.",
      },
      {
        name: "číslo_riadka",
        detail: "Riadok v `pole`, z ktorého sa má vrátiť hodnota.",
      },
      {
        name: "stĺpec_č",
        detail: "Stĺpec v `pole`, z ktorého sa má vrátiť hodnota.",
      },
    ],
  },
  {
    n: "INDIRECT",
    d: "Vráti odkaz zadaný textovým reťazcom. Referencie sa okamžite vyhodnocujú, aby sa zobrazil ich obsah.",
    a: "Odkaz z textového reťazca.",
    p: [
      {
        name: "text_odkazu",
        detail:
          "Odkaz na bunku, ktorá obsahuje odkaz v štýle A1 alebo R1C1, názov definovaný ako odkaz alebo odkaz ako textový reťazec.",
      },
      {
        name: "a1",
        detail:
          "TRUE alebo vynechané interpretuje `text_odkazu` ako odkaz v štýle A1; FALSE ako štýl R1C1.",
      },
    ],
  },
  {
    n: "INFO",
    d: "Vráti informácie o aktuálnom prevádzkovom prostredí podľa zadaného typu: directory, numfile, origin, osversion, recalc, release, system.",
    a: "Informácie o prevádzkovom prostredí.",
    p: [
      {
        name: "typ_ako_text",
        detail: "Text špecifikujúci, aký typ informácií chcete.",
      },
    ],
  },
  {
    n: "INT",
    d: "Zaokrúhli číslo nadol na najbližšie celé číslo.",
    a: "Zaokrúhli nadol na najbližšie celé číslo.",
    p: [
      {
        name: "číslo",
        detail: "Reálne číslo, ktoré chcete zaokrúhliť nadol na celé číslo.",
      },
    ],
  },
  {
    n: "INTERCEPT",
    d: "Vypočíta bod, v ktorom bude priamka pretínať os y pomocou existujúcich hodnôt x a y.",
    a: "Priesečník Y regresnej priamky.",
    p: [
      {
        name: "známe_y",
        detail: "Závislý súbor pozorovaní alebo údajov.",
      },
      {
        name: "známe_x",
        detail: "Nezávislý súbor pozorovaní alebo údajov.",
      },
    ],
  },
  {
    n: "INTRATE",
    d: "Vráti úrokovú sadzbu pre plne investovaný cenný papier.",
    a: "Úroková sadzba plne investovaného cenného papiera.",
    p: [
      {
        name: "dátum_vyrovnania",
        detail: "Dátum vyrovnania cenného papiera.",
      },
      {
        name: "dátum_splatnosti",
        detail: "Dátum splatnosti cenného papiera.",
      },
      {
        name: "investície",
        detail: "Suma investovaná do cenného papiera.",
      },
      {
        name: "výkupná_hodnota",
        detail: "Suma, ktorá sa má prijať pri splatnosti.",
      },
      {
        name: "základňa",
        detail:
          "Základ počtu dní: 0 alebo vynechané US 30/360, 1 skutočný/aktuálny, 2 skutočné/360, 3 skutočné/365, 4 európske 30/360.",
      },
    ],
  },
  {
    n: "IPMT",
    d: "Vráti úrokovú platbu za dané obdobie pre investíciu na základe pravidelných, konštantných platieb a konštantnej úrokovej sadzby.",
    a: "Úroková časť platby.",
    p: [
      {
        name: "sadzba",
        detail: "Úroková sadzba za obdobie.",
      },
      {
        name: "obdobie",
        detail: "Obdobie, za ktoré chcete zistiť úrok, od 1 do `počet_období`.",
      },
      {
        name: "počet_období",
        detail: "Celkový počet platobných období.",
      },
      {
        name: "súčasná_hodnota",
        detail: "Súčasná hodnota.",
      },
      {
        name: "budúca_hodnota",
        detail:
          "Budúca hodnota alebo hotovostný zostatok, ktorý chcete po poslednej platbe; predvolene je 0.",
      },
      {
        name: "typ",
        detail:
          "Keď sú platby splatné: 0 alebo vynechané na konci obdobia, 1 na začiatku.",
      },
    ],
  },
  {
    n: "IRR",
    d: "Vráti vnútornú mieru návratnosti pre sériu peňažných tokov reprezentovaných číslami v hodnotách.",
    a: "Vnútorná miera návratnosti.",
    p: [
      {
        name: "hodnoty",
        detail:
          "Pole alebo referencia obsahujúca aspoň jeden pozitívny a jeden negatívny peňažný tok.",
      },
      {
        name: "odhad",
        detail:
          "Číslo, ktoré uhádnete, je blízko výsledku; predvolená hodnota je 0,1 (10 percent).",
      },
    ],
  },
  {
    n: "ISBLANK",
    d: "Vráti TRUE, ak hodnota odkazuje na prázdnu bunku.",
    a: "Skontroluje, či je bunka prázdna.",
    p: [
      {
        name: "hodnota",
        detail: "Hodnota, ktorú chcete otestovať.",
      },
    ],
  },
  {
    n: "ISERR",
    d: "Vráti TRUE, ak sa hodnota vzťahuje na akúkoľvek chybovú hodnotu okrem #N/A.",
    a: "Skontroluje inú chybu ako #N/A.",
    p: [
      {
        name: "hodnota",
        detail: "Hodnota, ktorú chcete otestovať.",
      },
    ],
  },
  {
    n: "ISERROR",
    d: "Vráti TRUE, ak hodnota odkazuje na ľubovoľnú chybu (#N/A, #VALUE!, #REF!, #DIV/0!, #NUM!, #NAME? alebo #NULL!).",
    a: "Skontroluje akúkoľvek chybu.",
    p: [
      {
        name: "hodnota",
        detail: "Hodnota, ktorú chcete otestovať.",
      },
    ],
  },
  {
    n: "ISEVEN",
    d: "Vráti TRUE, ak je číslo párne, alebo FALSE, ak je číslo nepárne.",
    a: "Skontroluje, či je číslo párne.",
    p: [
      {
        name: "číslo",
        detail: "Hodnota na testovanie; desatinné miesta sú skrátené.",
      },
    ],
  },
  {
    n: "ISFORMULA",
    d: "Skontroluje, či existuje odkaz na bunku, ktorá obsahuje vzorec, a vráti TRUE alebo FALSE.",
    a: "Skontroluje, či bunka obsahuje vzorec.",
    p: [
      {
        name: "odkaz",
        detail: "Odkaz na bunku, ktorú chcete testovať.",
      },
    ],
  },
  {
    n: "ISLOGICAL",
    d: "Vráti TRUE, ak hodnota odkazuje na logickú hodnotu.",
    a: "Kontroluje logickú hodnotu.",
    p: [
      {
        name: "hodnota",
        detail: "Hodnota, ktorú chcete otestovať.",
      },
    ],
  },
  {
    n: "ISNA",
    d: "Vráti TRUE, ak sa hodnota vzťahuje na chybovú hodnotu #N/A (hodnota nie je k dispozícii).",
    a: "Kontroly na #N/A.",
    p: [
      {
        name: "hodnota",
        detail: "Hodnota, ktorú chcete otestovať.",
      },
    ],
  },
  {
    n: "ISNONTEXT",
    d: "Vráti TRUE, ak hodnota odkazuje na ľubovoľnú položku, ktorá nie je textom, vrátane prázdnej bunky.",
    a: "Kontroluje netextovú hodnotu.",
    p: [
      {
        name: "hodnota",
        detail: "Hodnota, ktorú chcete otestovať.",
      },
    ],
  },
  {
    n: "ISNUMBER",
    d: "Vráti TRUE, ak hodnota odkazuje na číslo.",
    a: "Kontroluje číslo.",
    p: [
      {
        name: "hodnota",
        detail: "Hodnota, ktorú chcete otestovať.",
      },
    ],
  },
  {
    n: "ISO.CEILING",
    d: "Zaokrúhli číslo nahor na najbližšie celé číslo alebo na najbližší násobok významnosti bez ohľadu na znamienko čísla.",
    a: "Zaokrúhľuje nahor bez ohľadu na znamienko (ISO).",
    p: [
      {
        name: "číslo",
        detail: "Hodnota, ktorá sa má zaokrúhliť.",
      },
      {
        name: "násobok",
        detail: "Násobok, na ktorý je číslo zaokrúhlené; predvolene je 1.",
      },
    ],
  },
  {
    n: "ISODD",
    d: "Vráti TRUE, ak je číslo nepárne, alebo FALSE, ak je číslo párne.",
    a: "Skontroluje, či je číslo nepárne.",
    p: [
      {
        name: "číslo",
        detail: "Hodnota na testovanie; desatinné miesta sú skrátené.",
      },
    ],
  },
  {
    n: "ISOMITTED",
    d: "Skontroluje, či chýba hodnota v LAMBDA a vráti TRUE alebo FALSE.",
    a: "Skontroluje chýbajúci argument LAMBDA.",
    p: [
      {
        name: "argument",
        detail: "Parameter LAMBDA, ktorý chcete otestovať.",
      },
    ],
  },
  {
    n: "ISOWEEKNUM",
    d: "Vráti ISO číslo týždňa v roku pre daný dátum.",
    a: "Číslo týždňa podľa normy ISO.",
    p: [
      {
        name: "dátum",
        detail: "Kód dátumu a času používaný na výpočet dátumu a času.",
      },
    ],
  },
  {
    n: "ISPMT",
    d: "Vypočíta zaplatený alebo prijatý úrok za zadané obdobie pôžičky alebo investície s rovnomernými splátkami istiny.",
    a: "Úrok pri rovnomerných splátkach istiny.",
    p: [
      {
        name: "sadzba",
        detail: "Úroková sadzba pre investíciu.",
      },
      {
        name: "obdobie",
        detail:
          "Obdobie, za ktoré chcete zistiť úrok, medzi 1 a `počet_období`.",
      },
      {
        name: "počet_období",
        detail: "Celkový počet platobných období pre investíciu.",
      },
      {
        name: "súčasná_hodnota",
        detail: "Súčasná hodnota investície; pri pôžičke výška pôžičky.",
      },
    ],
  },
  {
    n: "ISREF",
    d: "Vráti TRUE, ak hodnota odkazuje na referenciu.",
    a: "Kontroluje referenciu.",
    p: [
      {
        name: "hodnota",
        detail: "Hodnota, ktorú chcete otestovať.",
      },
    ],
  },
  {
    n: "ISTEXT",
    d: "Vráti TRUE, ak hodnota odkazuje na text.",
    a: "Kontroluje text.",
    p: [
      {
        name: "hodnota",
        detail: "Hodnota, ktorú chcete otestovať.",
      },
    ],
  },
  {
    n: "JIS",
    d: "Zmení znaky s polovičnou šírkou (jednobajtové) na znaky s plnou šírkou (dvojbajtové).",
    a: "Konvertovať na znaky s plnou šírkou.",
    p: [
      {
        name: "text",
        detail:
          "Text alebo odkaz na bunku, ktorá obsahuje text, ktorý sa má zmeniť.",
      },
    ],
  },
  {
    n: "KURT",
    d: "Vráti špičatosť množiny údajov, ktorá charakterizuje relatívnu vrcholovosť alebo plochosť rozdelenia.",
    a: "Kurtóza súboru údajov.",
    p: [
      {
        name: "číslo1",
        detail: "Prvé číslo alebo rozsah.",
      },
      {
        name: "číslo2",
        detail: "Ďalšie čísla alebo rozsahy, celkovo až 255.",
      },
    ],
  },
  {
    n: "LAMBDA",
    d: "Vytvorí vlastnú, opakovane použiteľnú funkciu, ktorú možno volať pomocou priateľského názvu alebo vyvolať priamo s argumentmi.",
    a: "Vytvorí vlastnú funkciu.",
    p: [
      {
        name: "parameter",
        detail:
          "Názov hodnoty, ktorá sa má odovzdať funkcii, ako napríklad odkaz na bunku, reťazec alebo číslo. Až 253 parametrov.",
      },
      {
        name: "výpočet",
        detail:
          "Vzorec, ktorý sa má vykonať a vrátiť ako výsledok funkcie; to musi byt posledny argument.",
      },
    ],
  },
  {
    n: "LARGE",
    d: "Vráti k-tu najväčšiu hodnotu v súbore údajov.",
    a: "K-tá najväčšia hodnota.",
    p: [
      {
        name: "pole",
        detail:
          "Pole alebo rozsah údajov, pre ktoré chcete určiť k-tú najväčšiu hodnotu.",
      },
      {
        name: "k",
        detail:
          "Pozícia (od najväčšej) v poli alebo rozsahu buniek údajov, ktoré sa majú vrátiť.",
      },
    ],
  },
  {
    n: "LCM",
    d: "Vráti najmenší spoločný násobok celých čísel.",
    a: "Najmenší spoločný násobok.",
    p: [
      {
        name: "číslo1",
        detail: "Prvá hodnota alebo rozsah; desatinné miesta sú skrátené.",
      },
      {
        name: "číslo2",
        detail: "Ďalšie hodnoty alebo rozsahy, celkovo až 255.",
      },
    ],
  },
  {
    n: "LEFT",
    d: "Vráti prvý znak alebo znaky v textovom reťazci na základe zadaného počtu znakov.",
    a: "Znaky textu úplne vľavo.",
    p: [
      {
        name: "text",
        detail:
          "Textový reťazec, ktorý obsahuje znaky, ktoré chcete extrahovať.",
      },
      {
        name: "počet_znakov",
        detail: "Počet znakov, ktoré má LEFT extrahovať; predvolene je 1.",
      },
    ],
  },
  {
    n: "LEFTB",
    d: "Vráti prvé znaky textového reťazca na základe počtu bajtov.",
    a: "Znaky úplne vľavo (bajty).",
    p: [
      {
        name: "text",
        detail: "Textový reťazec obsahujúci znaky, ktoré chcete extrahovať.",
      },
      {
        name: "počet_bajtov",
        detail: "Počet bajtov na extrakciu; predvolene 1.",
      },
    ],
  },
  {
    n: "LEN",
    d: "Vráti počet znakov v textovom reťazci.",
    a: "Dĺžka textu.",
    p: [
      {
        name: "text",
        detail:
          "Text, ktorého dĺžku chcete nájsť. Medzery sa počítajú ako znaky.",
      },
    ],
  },
  {
    n: "LENB",
    d: "Vráti počet bajtov použitých na reprezentáciu znakov v textovom reťazci.",
    a: "Dĺžka textu (bajty).",
    p: [
      {
        name: "text",
        detail: "Text, ktorého dĺžku chcete nájsť.",
      },
    ],
  },
  {
    n: "LET",
    d: "Priraďuje názvy výsledkom výpočtov, čo umožňuje uloženie medzivýpočtov, hodnôt alebo názvov vo vzorci.",
    a: "Pomenúva hodnoty vo vzorci.",
    p: [
      {
        name: "názov1",
        detail: "Prvé meno, ktoré sa má priradiť; musí začínať písmenom.",
      },
      {
        name: "hodnota_názvu1",
        detail: "Hodnota, ktorá je priradená k `názov1`.",
      },
      {
        name: "výpočet_alebo_názov2",
        detail:
          "Buď výpočet, ktorý používa všetky mená v rámci funkcie LET (musí to byť posledný argument), alebo druhé meno na priradenie.",
      },
      {
        name: "hodnota_názvu2",
        detail: "Hodnota, ktorá je priradená `výpočet_alebo_názov2`.",
      },
      {
        name: "výpočet_alebo_názov3",
        detail:
          "Buď výpočet, ktorý používa všetky mená, alebo ďalšie meno na priradenie.",
      },
    ],
  },
  {
    n: "LINEST",
    d: "Vypočíta štatistiku pre čiaru pomocou metódy najmenších štvorcov na výpočet rovnej čiary, ktorá najlepšie vyhovuje vašim údajom, a vráti pole, ktoré popisuje čiaru.",
    a: "Štatistika lineárnej regresie.",
    p: [
      {
        name: "známe_y",
        detail: "Množina y-hodnôt, ktoré už poznáte vo vzťahu y = mx + b.",
      },
      {
        name: "známe_x",
        detail: "Voliteľný súbor x-hodnôt, ktoré už možno poznáte.",
      },
      {
        name: "konšt",
        detail:
          "TRUE alebo vynechané vypočíta b normálne; FALSE prinúti b, aby sa rovnalo 0.",
      },
      {
        name: "štatistiky",
        detail:
          "TRUE vráti ďalšie regresné štatistiky; FALSE alebo vynechaný vráti iba ma b.",
      },
    ],
  },
  {
    n: "LN",
    d: "Vráti prirodzený logaritmus čísla.",
    a: "Prirodzený logaritmus.",
    p: [
      {
        name: "číslo",
        detail: "Kladné reálne číslo, pre ktoré chcete prirodzený logaritmus.",
      },
    ],
  },
  {
    n: "LOG",
    d: "Vráti logaritmus čísla so základom, ktorý určíte.",
    a: "Logaritmus k danej základni.",
    p: [
      {
        name: "číslo",
        detail: "Kladné reálne číslo, pre ktoré chcete logaritmus.",
      },
      {
        name: "základ",
        detail: "Základ logaritmu; predvolene je 10.",
      },
    ],
  },
  {
    n: "LOG10",
    d: "Vráti logaritmus čísla so základom 10.",
    a: "Základ-10 logaritmus.",
    p: [
      {
        name: "číslo",
        detail:
          "Kladné reálne číslo, pre ktoré chcete logaritmus so základom 10.",
      },
    ],
  },
  {
    n: "LOGEST",
    d: "Vypočíta exponenciálnu krivku, ktorá vyhovuje vašim údajom, a vráti pole hodnôt, ktoré krivku opisujú.",
    a: "Štatistika exponenciálnej regresie.",
    p: [
      {
        name: "známe_y",
        detail: "Množina y-hodnôt, ktoré už poznáte vo vzťahu y = b*m^x.",
      },
      {
        name: "známe_x",
        detail: "Voliteľný súbor x-hodnôt, ktoré už možno poznáte.",
      },
      {
        name: "konšt",
        detail:
          "TRUE alebo vynechané vypočíta b normálne; FALSE prinúti b, aby sa rovnalo 1.",
      },
      {
        name: "štatistiky",
        detail:
          "TRUE vráti ďalšie regresné štatistiky; FALSE alebo vynechaný vráti iba ma b.",
      },
    ],
  },
  {
    n: "LOGINV",
    d: "Vráti inverznú hodnotu funkcie lognormálneho kumulatívneho rozdelenia. Zachované z dôvodu kompatibility; pozri LOGNORM.INV.",
    a: "Inverzné lognormálne rozdelenie (kompatibilita).",
    p: [
      {
        name: "pravdepodobnosť",
        detail: "Pravdepodobnosť spojená s lognormálnym rozdelením.",
      },
      {
        name: "priemer",
        detail: "Priemer ln(x).",
      },
      {
        name: "smerodajná_odchýlka",
        detail: "Štandardná odchýlka ln(x).",
      },
    ],
  },
  {
    n: "LOGNORM.DIST",
    d: "Vráti lognormálne rozdelenie x, kde ln(x) je normálne rozdelené s parametrami stred a smerodajná_odchýlka.",
    a: "Lognormálne rozdelenie.",
    p: [
      {
        name: "x",
        detail: "Hodnota, pri ktorej sa má funkcia vyhodnotiť.",
      },
      {
        name: "priemer",
        detail: "Priemer ln(x).",
      },
      {
        name: "smerodajná_odchýlka",
        detail: "Štandardná odchýlka ln(x).",
      },
      {
        name: "kumulatívne",
        detail:
          "TRUE vráti funkciu kumulatívneho rozdelenia, FALSE funkciu hustoty pravdepodobnosti.",
      },
    ],
  },
  {
    n: "LOGNORM.INV",
    d: "Vráti inverznú hodnotu funkcie lognormálneho kumulatívneho rozdelenia x.",
    a: "Inverzné lognormálne rozdelenie.",
    p: [
      {
        name: "pravdepodobnosť",
        detail: "Pravdepodobnosť spojená s lognormálnym rozdelením.",
      },
      {
        name: "priemer",
        detail: "Priemer ln(x).",
      },
      {
        name: "smerodajná_odchýlka",
        detail: "Štandardná odchýlka ln(x).",
      },
    ],
  },
  {
    n: "LOGNORMDIST",
    d: "Vráti kumulatívne lognormálne rozdelenie. Zachované z dôvodu kompatibility; pozri LOGNORM.DIST.",
    a: "Kumulatívna lognormálna distribúcia (kompatibilita).",
    p: [
      {
        name: "x",
        detail: "Hodnota, pri ktorej sa má funkcia vyhodnotiť.",
      },
      {
        name: "priemer",
        detail: "Priemer ln(x).",
      },
      {
        name: "smerodajná_odchýlka",
        detail: "Štandardná odchýlka ln(x).",
      },
    ],
  },
  {
    n: "LOOKUP",
    d: "Vyhľadá hodnotu v rozsahu jedného riadka alebo jedného stĺpca (vektor) a vráti hodnotu z rovnakej pozície v druhom rozsahu.",
    a: "Vyhľadá hodnotu vo vektore.",
    p: [
      {
        name: "hľadaná_hodnota",
        detail: "Hodnota, ktorú LOOKUP hľadá v `vektor_vyhľadávania`.",
      },
      {
        name: "vektor_vyhľadávania",
        detail:
          "Rozsah, ktorý obsahuje iba jeden riadok alebo jeden stĺpec, zoradený vo vzostupnom poradí.",
      },
      {
        name: "vektor_výsledku",
        detail:
          "Rozsah, ktorý obsahuje iba jeden riadok alebo stĺpec rovnakej veľkosti ako `vektor_vyhľadávania`.",
      },
    ],
  },
  {
    n: "LOWER",
    d: "Skonvertuje všetky veľké písmená v textovom reťazci na malé.",
    a: "Konvertuje text na malé písmená.",
    p: [
      {
        name: "text",
        detail: "Text, ktorý chcete previesť na malé písmená.",
      },
    ],
  },
  {
    n: "MAKEARRAY",
    d: "Vráti vypočítané pole zadanej veľkosti riadka a stĺpca použitím LAMBDA.",
    a: "Vytvorí pole s LAMBDA.",
    p: [
      {
        name: "riadky",
        detail: "Počet riadkov v poli; musí byť väčšia ako nula.",
      },
      {
        name: "stĺpce",
        detail: "Počet stĺpcov v poli; musí byť väčšia ako nula.",
      },
      {
        name: "lambda",
        detail:
          "Volaný LAMBDA s indexom riadka a stĺpca na vytvorenie každej hodnoty poľa.",
      },
    ],
  },
  {
    n: "MAP",
    d: "Vráti pole vytvorené mapovaním každej hodnoty v poli (poliach) na novú hodnotu použitím LAMBDA.",
    a: "Transformuje každú hodnotu pomocou LAMBDA.",
    p: [
      {
        name: "pole1",
        detail: "Prvé pole na mapovanie.",
      },
      {
        name: "pole2",
        detail: "Ďalšie polia na mapovanie.",
      },
      {
        name: "lambda",
        detail:
          "LAMBDA, čo musí byť posledný argument, s jedným parametrom pre každé odovzdané pole.",
      },
    ],
  },
  {
    n: "MATCH",
    d: "Vyhľadá zadanú položku v rozsahu buniek a vráti relatívnu pozíciu tejto položky v rozsahu.",
    a: "Pozícia hodnoty v rozsahu.",
    p: [
      {
        name: "hľadaná_hodnota",
        detail: "Hodnota, ktorú chcete nájsť v `vyhľadávacie_pole`.",
      },
      {
        name: "vyhľadávacie_pole",
        detail: "Rozsah prehľadávaných buniek.",
      },
      {
        name: "typ_zhody",
        detail:
          "1 alebo vynechané nájde najväčšiu hodnotu menšiu alebo rovnú `hľadaná_hodnota`, 0 presnú zhodu, -1 najmenšiu hodnotu väčšiu alebo rovnú jej.",
      },
    ],
  },
  {
    n: "MAX",
    d: "Vráti najväčšiu hodnotu v množine hodnôt, ignoruje text a logické hodnoty v rozsahoch.",
    a: "Najvyššia hodnota.",
    p: [
      {
        name: "číslo1",
        detail: "Prvé číslo alebo rozsah.",
      },
      {
        name: "číslo2",
        detail: "Ďalšie čísla alebo rozsahy, celkovo až 255.",
      },
    ],
  },
  {
    n: "MAXA",
    d: "Vráti najväčšiu hodnotu v zozname argumentov, pričom text vyhodnotí ako 0 a logické hodnoty ako 1 alebo 0.",
    a: "Najväčšia hodnota vrátane textu a logiky.",
    p: [
      {
        name: "hodnota1",
        detail: "Prvá hodnota alebo rozsah.",
      },
      {
        name: "hodnota2",
        detail: "Ďalšie hodnoty alebo rozsahy, celkovo až 255.",
      },
    ],
  },
  {
    n: "MAXIFS",
    d: "Vráti maximálnu hodnotu medzi bunkami určenými danou sadou podmienok alebo kritérií.",
    a: "Najvyššia hodnota, ktorá spĺňa kritériá.",
    p: [
      {
        name: "rozsah_maxima",
        detail: "Rozsah buniek, v ktorých sa určí maximum.",
      },
      {
        name: "rozsah_kritérií1",
        detail: "Sada buniek na vyhodnotenie pomocou `kritériá_1`.",
      },
      {
        name: "kritériá_1",
        detail:
          "Kritériá, ktoré definujú, ktoré bunky budú vyhodnotené ako maximálne.",
      },
      {
        name: "rozsah_kritérií2",
        detail: "Ďalšie rozsahy, až 126 párov rozsah/kritérium.",
      },
      {
        name: "kritériá2",
        detail: "Kritériá pre zodpovedajúci dodatočný rozsah.",
      },
    ],
  },
  {
    n: "MDETERM",
    d: "Vráti maticový determinant poľa.",
    a: "Maticový determinant.",
    p: [
      {
        name: "pole",
        detail: "Číselné pole s rovnakým počtom riadkov a stĺpcov.",
      },
    ],
  },
  {
    n: "MDURATION",
    d: "Vráti upravenú Macaulayovu dobu trvania pre cenný papier s predpokladanou nominálnou hodnotou 100 $.",
    a: "Modifikovaná durácia cenného papiera.",
    p: [
      {
        name: "dátum_vyrovnania",
        detail: "Dátum vyrovnania cenného papiera.",
      },
      {
        name: "dátum_splatnosti",
        detail: "Dátum splatnosti cenného papiera.",
      },
      {
        name: "kupón",
        detail: "Ročná kupónová sadzba cenného papiera.",
      },
      {
        name: "výnos",
        detail: "Ročný výnos cenného papiera.",
      },
      {
        name: "frekvencia",
        detail:
          "Počet výplat kupónov za rok: 1 ročná, 2 polročné, 4 štvrťročné.",
      },
      {
        name: "základňa",
        detail:
          "Základ počtu dní: 0 alebo vynechané US 30/360, 1 skutočný/aktuálny, 2 skutočné/360, 3 skutočné/365, 4 európske 30/360.",
      },
    ],
  },
  {
    n: "MEDIAN",
    d: "Vráti medián daných čísel, číslo v strede množiny čísel.",
    a: "Medián čísel.",
    p: [
      {
        name: "číslo1",
        detail: "Prvé číslo alebo rozsah.",
      },
      {
        name: "číslo2",
        detail: "Ďalšie čísla alebo rozsahy, celkovo až 255.",
      },
    ],
  },
  {
    n: "MID",
    d: "Vráti konkrétny počet znakov z textového reťazca, počnúc od pozície, ktorú určíte.",
    a: "Postavy zo stredu textu.",
    p: [
      {
        name: "text",
        detail: "Textový reťazec obsahujúci znaky, ktoré chcete extrahovať.",
      },
      {
        name: "počiatočná_pozícia",
        detail:
          "Pozícia prvého znaku, ktorý chcete extrahovať; prvý znak je 1.",
      },
      {
        name: "počet_znakov",
        detail: "Počet znakov, ktoré má MID vrátiť.",
      },
    ],
  },
  {
    n: "MIDB",
    d: "Vráti znaky zo stredu textového reťazca zadanú počiatočnú pozíciu a počet bajtov.",
    a: "Stredné znaky (bajty).",
    p: [
      {
        name: "text",
        detail: "Textový reťazec obsahujúci znaky, ktoré chcete extrahovať.",
      },
      {
        name: "počiatočná_pozícia",
        detail: "Pozícia prvého znaku, ktorý sa má extrahovať.",
      },
      {
        name: "počet_bajtov",
        detail: "Počet bajtov na extrakciu.",
      },
    ],
  },
  {
    n: "MIN",
    d: "Vráti najmenšie číslo v množine hodnôt, ignoruje text a logické hodnoty v rozsahoch.",
    a: "Najmenšia hodnota.",
    p: [
      {
        name: "číslo1",
        detail: "Prvé číslo alebo rozsah.",
      },
      {
        name: "číslo2",
        detail: "Ďalšie čísla alebo rozsahy, celkovo až 255.",
      },
    ],
  },
  {
    n: "MINA",
    d: "Vráti najmenšiu hodnotu v zozname argumentov, pričom text vyhodnotí ako 0 a logické hodnoty ako 1 alebo 0.",
    a: "Najmenšia hodnota vrátane textu a logiky.",
    p: [
      {
        name: "hodnota1",
        detail: "Prvá hodnota alebo rozsah.",
      },
      {
        name: "hodnota2",
        detail: "Ďalšie hodnoty alebo rozsahy, celkovo až 255.",
      },
    ],
  },
  {
    n: "MINIFS",
    d: "Vráti minimálnu hodnotu medzi bunkami určenými danou sadou podmienok alebo kritérií.",
    a: "Najmenšia hodnota, ktorá spĺňa kritériá.",
    p: [
      {
        name: "rozsah_minima",
        detail: "Rozsah buniek, v ktorých bude určené minimum.",
      },
      {
        name: "rozsah_kritérií1",
        detail: "Sada buniek na vyhodnotenie pomocou `kritériá_1`.",
      },
      {
        name: "kritériá_1",
        detail:
          "Kritériá, ktoré definujú, ktoré bunky budú hodnotené ako minimálne.",
      },
      {
        name: "rozsah_kritérií2",
        detail: "Ďalšie rozsahy, až 126 párov rozsah/kritérium.",
      },
      {
        name: "kritériá2",
        detail: "Kritériá pre zodpovedajúci dodatočný rozsah.",
      },
    ],
  },
  {
    n: "MINUTE",
    d: "Vráti minúty časovej hodnoty ako celé číslo od 0 do 59.",
    a: "Minútová zložka času.",
    p: [
      {
        name: "poradové_číslo",
        detail: "Čas, ktorý obsahuje minútu, ktorú chcete nájsť.",
      },
    ],
  },
  {
    n: "MINVERSE",
    d: "Vráti inverznú maticu pre maticu uloženú v poli.",
    a: "Inverzná k matici.",
    p: [
      {
        name: "pole",
        detail: "Číselné pole s rovnakým počtom riadkov a stĺpcov.",
      },
    ],
  },
  {
    n: "MIRR",
    d: "Vracia modifikovanú vnútornú mieru návratnosti pre sériu periodických peňažných tokov, berúc do úvahy ako náklady na investíciu, tak aj úrok získaný z reinvestície hotovosti.",
    a: "Upravená vnútorná miera návratnosti.",
    p: [
      {
        name: "hodnoty",
        detail:
          "Pole alebo referencia obsahujúca aspoň jeden pozitívny a jeden negatívny peňažný tok.",
      },
      {
        name: "sadzba_financovania",
        detail:
          "Úroková sadzba, ktorú platíte za peniaze použité v peňažných tokoch.",
      },
      {
        name: "reinvestičná_sadzba",
        detail:
          "Úroková sadzba, ktorú dostávate z peňažných tokov, keď ich reinvestujete.",
      },
    ],
  },
  {
    n: "MMULT",
    d: "Vráti maticový súčin dvoch polí. Výsledok má toľko riadkov ako pole1 a toľko stĺpcov ako pole2.",
    a: "Maticový súčin dvoch polí.",
    p: [
      {
        name: "pole1",
        detail:
          "Prvé pole; jeho počet stĺpcov sa musí rovnať počtu riadkov `pole2`.",
      },
      {
        name: "pole2",
        detail: "Druhé pole.",
      },
    ],
  },
  {
    n: "MOD",
    d: "Vráti zvyšok po delení čísla deliteľom. Výsledok má rovnaké znamienko ako deliteľ.",
    a: "Zvyšok po delení.",
    p: [
      {
        name: "číslo",
        detail: "Číslo, pre ktoré chcete zvyšok.",
      },
      {
        name: "deliteľ",
        detail: "Číslo, ktorým chcete deliť `číslo`.",
      },
    ],
  },
  {
    n: "MODE.MULT",
    d: "Vráti vertikálne pole najčastejšie sa vyskytujúcich alebo opakujúcich sa hodnôt v poli alebo rozsahu údajov.",
    a: "Všetky najčastejšie hodnoty.",
    p: [
      {
        name: "číslo1",
        detail: "Prvé číslo alebo rozsah, pre ktorý chcete vypočítať režim.",
      },
      {
        name: "číslo2",
        detail: "Ďalšie čísla alebo rozsahy, celkovo až 254.",
      },
    ],
  },
  {
    n: "MODE.SNGL",
    d: "Vráti najčastejšie sa vyskytujúcu alebo opakujúcu sa hodnotu v poli alebo rozsahu údajov.",
    a: "Najčastejšia hodnota.",
    p: [
      {
        name: "číslo1",
        detail: "Prvé číslo alebo rozsah, pre ktorý chcete vypočítať režim.",
      },
      {
        name: "číslo2",
        detail: "Ďalšie čísla alebo rozsahy, celkovo až 254.",
      },
    ],
  },
  {
    n: "MONTH",
    d: "Vráti mesiac dátumu reprezentovaný poradovým číslom ako celé číslo od 1 (január) do 12 (december).",
    a: "Mesiac dátumu.",
    p: [
      {
        name: "poradové_číslo",
        detail: "Dátum v mesiaci, ktorý sa snažíte nájsť.",
      },
    ],
  },
  {
    n: "MROUND",
    d: "Vráti číslo zaokrúhlené na požadovaný násobok.",
    a: "Zaokrúhli na najbližší násobok.",
    p: [
      {
        name: "číslo",
        detail: "Hodnota, ktorá sa má zaokrúhliť.",
      },
      {
        name: "viacnásobné",
        detail: "Násobok, na ktorý chcete zaokrúhliť `číslo`.",
      },
    ],
  },
  {
    n: "MULTINOMIAL",
    d: "Vráti pomer faktoriálu súčtu hodnôt k súčinu ich faktoriálov.",
    a: "Multinóm množiny čísel.",
    p: [
      {
        name: "číslo1",
        detail: "Prvá hodnota alebo rozsah.",
      },
      {
        name: "číslo2",
        detail: "Ďalšie hodnoty alebo rozsahy, celkovo až 255.",
      },
    ],
  },
  {
    n: "MUNIT",
    d: "Vráti maticu jednotiek pre zadaný rozmer.",
    a: "Jednotková matica.",
    p: [
      {
        name: "rozmer",
        detail: "Celé číslo väčšie ako nula špecifikujúce veľkosť matice.",
      },
    ],
  },
  {
    n: "N",
    d: "Vráti hodnotu prevedenú na číslo: čísla tak, ako sú, dátumy ako sériové čísla, TRUE ako 1 a čokoľvek iné ako 0.",
    a: "Skonvertuje hodnotu na číslo.",
    p: [
      {
        name: "hodnota",
        detail: "Hodnota, ktorú chcete previesť.",
      },
    ],
  },
  {
    n: "NA",
    d: 'Vráti chybovú hodnotu #N/A, čo znamená "no value is available".',
    a: "Chybová hodnota #N/A.",
    p: [],
  },
  {
    n: "NEGBINOM.DIST",
    d: "Vráti záporné binomické rozdelenie, pravdepodobnosť, že pred počet_úspechov-tým úspechom dôjde k počet_neúspechov zlyhaniam.",
    a: "Záporné binomické rozdelenie.",
    p: [
      {
        name: "počet_neúspechov",
        detail: "Počet zlyhaní.",
      },
      {
        name: "počet_úspechov",
        detail: "Prahový počet úspechov.",
      },
      {
        name: "pravdepodobnosť_úspechu",
        detail: "Pravdepodobnosť úspechu.",
      },
      {
        name: "kumulatívne",
        detail:
          "TRUE vráti funkciu kumulatívneho rozdelenia, FALSE funkciu hustoty pravdepodobnosti.",
      },
    ],
  },
  {
    n: "NEGBINOMDIST",
    d: "Vráti záporné binomické rozdelenie. Zachované z dôvodu kompatibility; pozri NEGBINOM.DIST.",
    a: "Negatívne binomické rozdelenie (kompatibilita).",
    p: [
      {
        name: "počet_neúspechov",
        detail: "Počet zlyhaní.",
      },
      {
        name: "počet_úspechov",
        detail: "Prahový počet úspechov.",
      },
      {
        name: "pravdepodobnosť_úspechu",
        detail: "Pravdepodobnosť úspechu.",
      },
    ],
  },
  {
    n: "NETWORKDAYS",
    d: "Vráti počet celých pracovných dní medzi dátum_začiatku a dátum_ukončenia, okrem víkendov a akýchkoľvek špecifikovaných sviatkov.",
    a: "Pracovné dni medzi dvoma dátumami.",
    p: [
      {
        name: "dátum_začiatku",
        detail: "Dátum, ktorý predstavuje počiatočný dátum.",
      },
      {
        name: "dátum_ukončenia",
        detail: "Dátum, ktorý predstavuje dátum ukončenia.",
      },
      {
        name: "sviatky",
        detail:
          "Voliteľný rozsah jedného alebo viacerých dátumov na vylúčenie z pracovného kalendára.",
      },
    ],
  },
  {
    n: "NETWORKDAYS.INTL",
    d: "Vráti počet celých pracovných dní medzi dvoma dátumami pomocou parametrov na označenie, ktoré a koľko dní sú víkendové dni.",
    a: "Pracovné dni s prispôsobenými víkendmi.",
    p: [
      {
        name: "dátum_začiatku",
        detail: "Dátum začiatku.",
      },
      {
        name: "dátum_ukončenia",
        detail: "Dátum ukončenia.",
      },
      {
        name: "víkend",
        detail:
          'Víkendové číslo (1 sobota – nedeľa, 2 nedeľa – pondelok, ..., iba nedeľa 11, ..., iba 17 sobota) alebo reťazec so siedmimi znakmi, napríklad "0000011".',
      },
      {
        name: "sviatky",
        detail:
          "Voliteľný súbor jedného alebo viacerých dátumov na vylúčenie z pracovného kalendára.",
      },
    ],
  },
  {
    n: "NOMINAL",
    d: "Vráti nominálnu ročnú úrokovú sadzbu zadanú efektívnu sadzbu a počet zložených období za rok.",
    a: "Nominálna ročná úroková sadzba.",
    p: [
      {
        name: "efektívna_sadzba",
        detail: "Efektívna úroková miera.",
      },
      {
        name: "obdobia_za_rok",
        detail: "Počet zložených období za rok.",
      },
    ],
  },
  {
    n: "NORM.DIST",
    d: "Vráti normálne rozdelenie pre špecifikovaný priemer a štandardnú odchýlku.",
    a: "Normálne rozdelenie.",
    p: [
      {
        name: "x",
        detail: "Hodnota, pre ktorú chcete rozdelenie.",
      },
      {
        name: "priemer",
        detail: "Aritmetický priemer rozdelenia.",
      },
      {
        name: "smerodajná_odchýlka",
        detail: "Štandardná odchýlka rozdelenia.",
      },
      {
        name: "kumulatívne",
        detail:
          "TRUE vráti funkciu kumulatívneho rozdelenia, FALSE funkciu hustoty pravdepodobnosti.",
      },
    ],
  },
  {
    n: "NORM.INV",
    d: "Vráti prevrátenú hodnotu normálneho kumulatívneho rozdelenia pre špecifikovaný priemer a štandardnú odchýlku.",
    a: "Inverzné normálne rozdelenie.",
    p: [
      {
        name: "pravdepodobnosť",
        detail: "Pravdepodobnosť zodpovedajúca normálnemu rozdeleniu.",
      },
      {
        name: "priemer",
        detail: "Aritmetický priemer rozdelenia.",
      },
      {
        name: "smerodajná_odchýlka",
        detail: "Štandardná odchýlka rozdelenia.",
      },
    ],
  },
  {
    n: "NORM.S.DIST",
    d: "Vráti štandardné normálne rozdelenie, ktoré má priemer nula a štandardnú odchýlku jedna.",
    a: "Štandardné normálne rozdelenie.",
    p: [
      {
        name: "z",
        detail: "Hodnota, pre ktorú chcete rozdelenie.",
      },
      {
        name: "kumulatívne",
        detail:
          "TRUE vráti funkciu kumulatívneho rozdelenia, FALSE funkciu hustoty pravdepodobnosti.",
      },
    ],
  },
  {
    n: "NORM.S.INV",
    d: "Vráti prevrátenú hodnotu štandardného normálneho kumulatívneho rozdelenia, ktoré má strednú hodnotu nula a štandardnú odchýlku jedna.",
    a: "Inverzné štandardné normálne rozdelenie.",
    p: [
      {
        name: "pravdepodobnosť",
        detail: "Pravdepodobnosť zodpovedajúca normálnemu rozdeleniu.",
      },
    ],
  },
  {
    n: "NORMDIST",
    d: "Vráti normálne rozdelenie pre špecifikovaný priemer a štandardnú odchýlku. Zachované z dôvodu kompatibility; pozri NORM.DIST.",
    a: "Normálna distribúcia (starosť).",
    p: [
      {
        name: "x",
        detail: "Hodnota, pre ktorú chcete rozdelenie.",
      },
      {
        name: "priemer",
        detail: "Aritmetický priemer rozdelenia.",
      },
      {
        name: "smerodajná_odchýlka",
        detail: "Štandardná odchýlka rozdelenia.",
      },
      {
        name: "kumulatívne",
        detail:
          "TRUE vráti funkciu kumulatívneho rozdelenia, FALSE funkciu hustoty pravdepodobnosti.",
      },
    ],
  },
  {
    n: "NORMINV",
    d: "Vráti inverznú hodnotu normálneho kumulatívneho rozdelenia. Zachované z dôvodu kompatibility; pozri NORM.INV.",
    a: "Inverzné normálne rozdelenie (kompatibilita).",
    p: [
      {
        name: "pravdepodobnosť",
        detail: "Pravdepodobnosť zodpovedajúca normálnemu rozdeleniu.",
      },
      {
        name: "priemer",
        detail: "Aritmetický priemer rozdelenia.",
      },
      {
        name: "smerodajná_odchýlka",
        detail: "Štandardná odchýlka rozdelenia.",
      },
    ],
  },
  {
    n: "NORMSDIST",
    d: "Vráti funkciu štandardného normálneho kumulatívneho rozdelenia. Zachované z dôvodu kompatibility; pozri NORM.S.DIST.",
    a: "Štandardné normálne rozdelenie (staršie).",
    p: [
      {
        name: "z",
        detail: "Hodnota, pre ktorú chcete rozdelenie.",
      },
    ],
  },
  {
    n: "NORMSINV",
    d: "Vráti inverznú hodnotu k štandardnému normálnemu kumulatívnemu rozdeleniu. Zachované z dôvodu kompatibility; pozri NORM.S.INV.",
    a: "Inverzná štandardná normálna (staršia).",
    p: [
      {
        name: "pravdepodobnosť",
        detail: "Pravdepodobnosť zodpovedajúca normálnemu rozdeleniu.",
      },
    ],
  },
  {
    n: "NOT",
    d: "Obráti hodnotu svojho argumentu: FALSE sa zmení na TRUE a TRUE sa zmení na FALSE.",
    a: "Obráti logickú hodnotu.",
    p: [
      {
        name: "logické",
        detail:
          "Hodnota alebo výraz, ktorý možno vyhodnotiť ako TRUE alebo FALSE.",
      },
    ],
  },
  {
    n: "NOW",
    d: "Vráti poradové číslo aktuálneho dátumu a času. Aktualizuje sa pri každom výpočte hárku.",
    a: "Aktuálny dátum a čas.",
    p: [],
  },
  {
    n: "NPER",
    d: "Vráti počet období pre investíciu na základe pravidelných, konštantných platieb a konštantnej úrokovej sadzby.",
    a: "Počet platobných období.",
    p: [
      {
        name: "sadzba",
        detail: "Úroková sadzba za obdobie.",
      },
      {
        name: "splátka",
        detail:
          "Platba uskutočnená v každom období; nemôže sa počas životnosti anuity meniť.",
      },
      {
        name: "súčasná_hodnota",
        detail:
          "Súčasná hodnota alebo paušálna suma, ktorú má teraz séria budúcich platieb.",
      },
      {
        name: "budúca_hodnota",
        detail:
          "Budúca hodnota alebo hotovostný zostatok, ktorý chcete po poslednej platbe; predvolene je 0.",
      },
      {
        name: "typ",
        detail:
          "Keď sú platby splatné: 0 alebo vynechané na konci obdobia, 1 na začiatku.",
      },
    ],
  },
  {
    n: "NPV",
    d: "Vypočíta čistú súčasnú hodnotu investície pomocou diskontnej sadzby a série budúcich platieb (záporné hodnoty) a príjmu (kladné hodnoty).",
    a: "Čistá súčasná hodnota peňažných tokov.",
    p: [
      {
        name: "sadzba",
        detail: "Diskontná sadzba za dĺžku jedného obdobia.",
      },
      {
        name: "hodnota1",
        detail:
          "Prvá platba alebo príjem, rovnomerne rozmiestnený v čase a vyskytujúci sa na konci každého obdobia.",
      },
      {
        name: "hodnota2",
        detail: "Dodatočné platby a príjmy, spolu až 254.",
      },
    ],
  },
  {
    n: "NUMBERVALUE",
    d: "Konvertuje text na číslo spôsobom nezávislým od miestneho nastavenia.",
    a: "Konvertuje text na číslo s vlastnými oddeľovačmi.",
    p: [
      {
        name: "text",
        detail: "Text, ktorý sa má previesť na číslo.",
      },
      {
        name: "oddeľovač_desatinných_miest",
        detail:
          "Znak použitý na oddelenie celočíselnej a zlomkovej časti výsledku.",
      },
      {
        name: "oddeľovač_skupín",
        detail: "Znak používaný na oddelenie skupín čísel, ako sú tisíce.",
      },
    ],
  },
  {
    n: "OCT2BIN",
    d: "Konvertuje osmičkové číslo na binárne.",
    a: "Osmičková až binárna.",
    p: [
      {
        name: "číslo",
        detail: "Osmičkové číslo, ktoré sa má previesť; najviac 10 znakov.",
      },
      {
        name: "počet_miest",
        detail:
          "Počet znakov, ktoré sa majú použiť; výsledok je doplnený vodiacimi nulami.",
      },
    ],
  },
  {
    n: "OCT2DEC",
    d: "Konvertuje osmičkové číslo na desiatkové.",
    a: "Prevod z osmičkovej do desiatkovej sústavy.",
    p: [
      {
        name: "číslo",
        detail:
          "Osmičkové číslo, ktoré sa má previesť; najviac 10 osmičkových znakov (30 bitov).",
      },
    ],
  },
  {
    n: "OCT2HEX",
    d: "Konvertuje osmičkové číslo na šestnástkové.",
    a: "Prevod z osmičkovej do šestnástkovej sústavy.",
    p: [
      {
        name: "číslo",
        detail:
          "Osmičkové číslo, ktoré sa má previesť; najviac 10 osmičkových znakov.",
      },
      {
        name: "počet_miest",
        detail:
          "Počet znakov, ktoré sa majú použiť; výsledok je doplnený vodiacimi nulami.",
      },
    ],
  },
  {
    n: "ODD",
    d: "Zaokrúhli číslo nahor smerom od nuly na najbližšie nepárne celé číslo.",
    a: "Zaokrúhli nahor na najbližšie nepárne celé číslo.",
    p: [
      {
        name: "číslo",
        detail: "Hodnota, ktorá sa má zaokrúhliť.",
      },
    ],
  },
  {
    n: "ODDFPRICE",
    d: "Vráti cenu za 100 USD menovitej hodnoty cenného papiera s nepravidelným prvým obdobím.",
    a: "Cena dlhopisu s nepravidelným prvým obdobím.",
    p: [
      {
        name: "dátum_vyrovnania",
        detail: "Dátum vyrovnania cenného papiera.",
      },
      {
        name: "dátum_splatnosti",
        detail: "Dátum splatnosti cenného papiera.",
      },
      {
        name: "dátum_emisie",
        detail: "Dátum vydania cenného papiera.",
      },
      {
        name: "prvý_kupón",
        detail: "Dátum prvého kupónu cenného papiera.",
      },
      {
        name: "sadzba",
        detail: "Úroková sadzba cenného papiera.",
      },
      {
        name: "výnos",
        detail: "Ročný výnos cenného papiera.",
      },
      {
        name: "výkupná_hodnota",
        detail: "Výkupná hodnota cenného papiera na 100 $ nominálnej hodnoty.",
      },
      {
        name: "frekvencia",
        detail: "Kupónové platby za rok: 1 ročná, 2 polročné, 4 štvrťročné.",
      },
      {
        name: "základňa",
        detail:
          "Základ počtu dní: 0 USA 30/360 (predvolené), 1 skutočný/aktuálny, 2 skutočné/360, 3 skutočné/365, 4 európske 30/360.",
      },
    ],
  },
  {
    n: "ODDFYIELD",
    d: "Vráti výnos cenného papiera s nepravidelným prvým obdobím.",
    a: "Výnos dlhopisu s nepravidelným prvým obdobím.",
    p: [
      {
        name: "dátum_vyrovnania",
        detail: "Dátum vyrovnania cenného papiera.",
      },
      {
        name: "dátum_splatnosti",
        detail: "Dátum splatnosti cenného papiera.",
      },
      {
        name: "dátum_emisie",
        detail: "Dátum vydania cenného papiera.",
      },
      {
        name: "prvý_kupón",
        detail: "Dátum prvého kupónu cenného papiera.",
      },
      {
        name: "sadzba",
        detail: "Úroková sadzba cenného papiera.",
      },
      {
        name: "cena",
        detail: "Cena cenného papiera.",
      },
      {
        name: "výkupná_hodnota",
        detail: "Výkupná hodnota cenného papiera na 100 $ nominálnej hodnoty.",
      },
      {
        name: "frekvencia",
        detail: "Kupónové platby za rok: 1 ročná, 2 polročné, 4 štvrťročné.",
      },
      {
        name: "základňa",
        detail:
          "Základ počtu dní: 0 USA 30/360 (predvolené), 1 skutočný/aktuálny, 2 skutočné/360, 3 skutočné/365, 4 európske 30/360.",
      },
    ],
  },
  {
    n: "ODDLPRICE",
    d: "Vráti cenu za 100 USD menovitej hodnoty cenného papiera s nepravidelným posledným obdobím.",
    a: "Cena dlhopisu s nepravidelným posledným obdobím.",
    p: [
      {
        name: "dátum_vyrovnania",
        detail: "Dátum vyrovnania cenného papiera.",
      },
      {
        name: "dátum_splatnosti",
        detail: "Dátum splatnosti cenného papiera.",
      },
      {
        name: "posledný_úrok",
        detail: "Dátum posledného kupónu cenného papiera.",
      },
      {
        name: "sadzba",
        detail: "Úroková sadzba cenného papiera.",
      },
      {
        name: "výnos",
        detail: "Ročný výnos cenného papiera.",
      },
      {
        name: "výkupná_hodnota",
        detail: "Výkupná hodnota cenného papiera na 100 $ nominálnej hodnoty.",
      },
      {
        name: "frekvencia",
        detail: "Kupónové platby za rok: 1 ročná, 2 polročné, 4 štvrťročné.",
      },
      {
        name: "základňa",
        detail:
          "Základ počtu dní: 0 USA 30/360 (predvolené), 1 skutočný/aktuálny, 2 skutočné/360, 3 skutočné/365, 4 európske 30/360.",
      },
    ],
  },
  {
    n: "ODDLYIELD",
    d: "Vráti výnos cenného papiera s nepravidelným posledným obdobím.",
    a: "Výnos dlhopisu s nepravidelným posledným obdobím.",
    p: [
      {
        name: "dátum_vyrovnania",
        detail: "Dátum vyrovnania cenného papiera.",
      },
      {
        name: "dátum_splatnosti",
        detail: "Dátum splatnosti cenného papiera.",
      },
      {
        name: "posledný_úrok",
        detail: "Dátum posledného kupónu cenného papiera.",
      },
      {
        name: "sadzba",
        detail: "Úroková sadzba cenného papiera.",
      },
      {
        name: "cena",
        detail: "Cena cenného papiera.",
      },
      {
        name: "výkupná_hodnota",
        detail: "Výkupná hodnota cenného papiera na 100 $ nominálnej hodnoty.",
      },
      {
        name: "frekvencia",
        detail: "Kupónové platby za rok: 1 ročná, 2 polročné, 4 štvrťročné.",
      },
      {
        name: "základňa",
        detail:
          "Základ počtu dní: 0 USA 30/360 (predvolené), 1 skutočný/aktuálny, 2 skutočné/360, 3 skutočné/365, 4 európske 30/360.",
      },
    ],
  },
  {
    n: "OFFSET",
    d: "Vráti odkaz na rozsah, ktorý predstavuje zadaný počet riadkov a stĺpcov z bunky alebo rozsahu buniek.",
    a: "Referenčný posun od počiatočného bodu.",
    p: [
      {
        name: "odkaz",
        detail: "Referencia, z ktorej chcete založiť posun.",
      },
      {
        name: "riadky",
        detail:
          "Počet riadkov, hore alebo dole, na ktoré má odkazovať ľavá horná bunka.",
      },
      {
        name: "stĺpce",
        detail:
          "Počet stĺpcov vľavo alebo vpravo, na ktoré má odkazovať ľavá horná bunka.",
      },
      {
        name: "výška",
        detail:
          "Výška vrátenej referencie v počte riadkov; predvolená výška je `odkaz`.",
      },
      {
        name: "šírka",
        detail:
          "Šírka v počte stĺpcov vrátenej referencie; predvolená šírka je `odkaz`.",
      },
    ],
  },
  {
    n: "OR",
    d: "Vráti TRUE, ak je niektorý argument TRUE, a FALSE, ak sú všetky argumenty FALSE.",
    a: "TRUE, ak je nejaký argument TRUE.",
    p: [
      {
        name: "logický1",
        detail:
          "Prvá podmienka na testovanie, ktorá môže byť vyhodnotená ako TRUE alebo FALSE.",
      },
      {
        name: "logický2",
        detail: "Ďalšie podmienky na testovanie, celkovo až 255.",
      },
    ],
  },
  {
    n: "PDURATION",
    d: "Vráti počet období, ktoré investícia vyžaduje na dosiahnutie špecifikovanej hodnoty.",
    a: "Obdobia potrebné na dosiahnutie hodnoty.",
    p: [
      {
        name: "sadzba",
        detail: "Úroková sadzba za obdobie.",
      },
      {
        name: "súčasná_hodnota",
        detail: "Súčasná hodnota investície.",
      },
      {
        name: "budúca_hodnota",
        detail: "Požadovaná budúca hodnota investície.",
      },
    ],
  },
  {
    n: "PEARSON",
    d: "Vráti Pearsonov súčinový momentový korelačný koeficient, r.",
    a: "Pearsonov korelačný koeficient.",
    p: [
      {
        name: "pole1",
        detail: "Súbor nezávislých hodnôt.",
      },
      {
        name: "pole2",
        detail: "Súbor závislých hodnôt.",
      },
    ],
  },
  {
    n: "PERCENTILE.EXC",
    d: "Vráti k-tý percentil hodnôt v rozsahu, kde k je v rozsahu 0 až 1, s výnimkou.",
    a: "K-tý percentil, exkluzívny.",
    p: [
      {
        name: "pole",
        detail:
          "Pole alebo rozsah údajov, ktoré definujú relatívne postavenie.",
      },
      {
        name: "k",
        detail: "Hodnota percentilu bez 0 a 1.",
      },
    ],
  },
  {
    n: "PERCENTILE.INC",
    d: "Vráti k-tý percentil hodnôt v rozsahu, kde k je v rozsahu 0 až 1 vrátane.",
    a: "K-tý percentil vrátane.",
    p: [
      {
        name: "pole",
        detail:
          "Pole alebo rozsah údajov, ktoré definujú relatívne postavenie.",
      },
      {
        name: "k",
        detail: "Hodnota percentilu v rozsahu 0 až 1 vrátane.",
      },
    ],
  },
  {
    n: "PERCENTOF",
    d: "Vráti percento, ktoré podmnožina údajov tvorí všetky údaje, teda SUM(podmnožina_údajov)/SUM(všetky_údaje).",
    a: "Podskupina ako percento z celku.",
    p: [
      {
        name: "podmnožina_údajov",
        detail: "Hodnoty, ktoré sú súčasťou podmnožiny.",
      },
      {
        name: "všetky_údaje",
        detail: "Hodnoty, ktoré tvoria celý súbor.",
      },
    ],
  },
  {
    n: "PERCENTRANK",
    d: "Vráti poradie hodnoty v množine údajov ako percento (0..1 vrátane) množiny údajov.",
    a: "Percentuálne poradie (kompatibilita).",
    p: [
      {
        name: "pole",
        detail: "Pole alebo rozsah číselných hodnôt.",
      },
      {
        name: "x",
        detail: "Hodnota, ktorej hodnotenie chcete.",
      },
      {
        name: "platné_číslice",
        detail: "Počet platných číslic; predvolene 3.",
      },
    ],
  },
  {
    n: "PERCENTRANK.EXC",
    d: "Vráti poradie hodnoty v súbore údajov ako percento (0 až 1, bez) súboru údajov.",
    a: "Percentuálne poradie, exkluzívne.",
    p: [
      {
        name: "pole",
        detail:
          "Pole alebo rozsah údajov s číselnými hodnotami, ktoré definujú relatívne postavenie.",
      },
      {
        name: "x",
        detail: "Hodnota, pre ktorú chcete poznať poradie.",
      },
      {
        name: "platné_číslice",
        detail:
          "Počet platných číslic pre vrátenú percentuálnu hodnotu; predvolene je 3.",
      },
    ],
  },
  {
    n: "PERCENTRANK.INC",
    d: "Vráti poradie hodnoty v súbore údajov ako percento (0 až 1 vrátane) súboru údajov.",
    a: "Percento vrátane.",
    p: [
      {
        name: "pole",
        detail:
          "Pole alebo rozsah údajov s číselnými hodnotami, ktoré definujú relatívne postavenie.",
      },
      {
        name: "x",
        detail: "Hodnota, pre ktorú chcete poznať poradie.",
      },
      {
        name: "platné_číslice",
        detail:
          "Počet platných číslic pre vrátenú percentuálnu hodnotu; predvolene je 3.",
      },
    ],
  },
  {
    n: "PERMUT",
    d: "Vráti počet permutácií pre daný počet objektov, ktoré je možné vybrať z číselných objektov.",
    a: "Počet permutácií.",
    p: [
      {
        name: "číslo",
        detail: "Celé číslo, ktoré popisuje počet objektov.",
      },
      {
        name: "počet_vybraných",
        detail:
          "Celé číslo, ktoré popisuje počet objektov v každej permutácii.",
      },
    ],
  },
  {
    n: "PERMUTATIONA",
    d: "Vráti počet permutácií pre daný počet objektov (s opakovaniami), ktoré možno vybrať z celkového počtu objektov.",
    a: "Počet permutácií s opakovaním.",
    p: [
      {
        name: "číslo",
        detail: "Celé číslo, ktoré popisuje celkový počet objektov.",
      },
      {
        name: "počet_vybraných",
        detail:
          "Celé číslo, ktoré popisuje počet objektov v každej permutácii.",
      },
    ],
  },
  {
    n: "PHI",
    d: "Vráti hodnotu funkcie hustoty pre štandardné normálne rozdelenie.",
    a: "Štandardná normálna hustota.",
    p: [
      {
        name: "x",
        detail:
          "Číslo, pre ktoré chcete získať hustotu štandardného normálneho rozdelenia.",
      },
    ],
  },
  {
    n: "PHONETIC",
    d: "Extrahuje fonetické (furigana) znaky z textového reťazca; vráti samotný text, keď žiadny nemá.",
    a: "Fonetické znaky textu.",
    p: [
      {
        name: "odkaz",
        detail: "Textový reťazec alebo odkaz na bunku.",
      },
    ],
  },
  {
    n: "PI",
    d: "Vráti číslo 3,14159265358979, matematickú konštantu pi, s presnosťou na 15 číslic.",
    a: "Hodnota pi.",
    p: [],
  },
  {
    n: "PIVOTBY",
    d: "Sumarizuje údaje podľa riadkových a stĺpcových polí, agreguje hodnoty každého priesečníka s voliteľnými hlavičkami, súčtom, triedením a filtrovaním.",
    a: "Vykonajte krížovú tabuľku a agregujte.",
    p: [
      {
        name: "riadkové_polia",
        detail:
          "Hodnoty orientované na stĺpce, ktoré sa stanú hlavičkami riadkov.",
      },
      {
        name: "polia_stĺpcov",
        detail:
          "Hodnoty orientované na stĺpce, ktoré sa stanú hlavičkami stĺpcov.",
      },
      {
        name: "hodnoty",
        detail: "Stĺpcovo orientované hodnoty na agregáciu.",
      },
      {
        name: "funkciu",
        detail:
          "LAMBDA alebo názov funkcie (SUM, AVERAGE, COUNT, PERCENTOF, ...), ktorý agreguje každú bunku.",
      },
      {
        name: "hlavičky_polí",
        detail:
          "Či majú údaje hlavičky a či sa majú zobraziť: 0 nie, 1 áno, ale skryť, 2 nie, ale vygenerovať, 3 áno a zobraziť.",
      },
      {
        name: "úroveň_súčtov_riadkov",
        detail:
          "Súčet riadkov: 0 žiadny, 1 celkový súčet (predvolené), 2 s medzisúčtami; negatívny ich kladie na prvé miesto.",
      },
      {
        name: "poradie_zoradenia_riadkov",
        detail:
          "Číslo(a) stĺpca, podľa ktorého sa majú zoradiť riadky, záporné pre zostupné.",
      },
      {
        name: "úroveň_súčtov_stĺpcov",
        detail:
          "Stĺpcové súčty: 0 žiadne, 1 celkový súčet (predvolené), 2 s medzisúčtami; negatívny ich kladie na prvé miesto.",
      },
      {
        name: "poradie_triedenia_stĺpcov",
        detail: "Číslo(a) stĺpca na zoradenie stĺpcov, záporné pre zostupné.",
      },
      {
        name: "pole_filtrov",
        detail: "Booleovský výber, ktoré riadky sa majú zahrnúť.",
      },
      {
        name: "vzhľadom_na",
        detail:
          "Pre funkcie s dvoma argumentmi, ako napríklad PERCENTOF: 0 stĺpcových súčtov, 1 riadkové súčty, 2 celkový súčet, 3 nadradený stĺpec, 4 nadradený riadok.",
      },
    ],
  },
  {
    n: "PMT",
    d: "Vypočíta platbu za pôžičku na základe konštantných platieb a konštantnej úrokovej sadzby.",
    a: "Pravidelná splátka úveru.",
    p: [
      {
        name: "sadzba",
        detail: "Úroková sadzba za pôžičku.",
      },
      {
        name: "počet_období",
        detail: "Celkový počet platieb za úver.",
      },
      {
        name: "súčasná_hodnota",
        detail:
          "Súčasná hodnota alebo celková suma, ktorú má teraz séria budúcich platieb (istina).",
      },
      {
        name: "budúca_hodnota",
        detail:
          "Budúca hodnota alebo hotovostný zostatok, ktorý chcete po poslednej platbe; predvolene je 0.",
      },
      {
        name: "typ",
        detail:
          "Keď sú platby splatné: 0 alebo vynechané na konci obdobia, 1 na začiatku.",
      },
    ],
  },
  {
    n: "POISSON",
    d: "Vráti Poissonovo rozdelenie.",
    a: "Poissonovo rozdelenie (kompatibilita).",
    p: [
      {
        name: "x",
        detail: "Počet udalostí.",
      },
      {
        name: "priemer",
        detail: "Očakávaná číselná hodnota.",
      },
      {
        name: "kumulatívne",
        detail:
          "TRUE pre kumulatívnu pravdepodobnosť, FALSE pre hmotnosť pravdepodobnosti.",
      },
    ],
  },
  {
    n: "POISSON.DIST",
    d: "Vráti Poissonovo rozdelenie, bežne používané na predpovedanie počtu udalostí v určitom čase.",
    a: "Poissonovo rozdelenie.",
    p: [
      {
        name: "x",
        detail: "Počet udalostí.",
      },
      {
        name: "priemer",
        detail: "Očakávaná číselná hodnota.",
      },
      {
        name: "kumulatívne",
        detail:
          "TRUE vráti kumulatívnu pravdepodobnosť, FALSE funkciu hmotnosti pravdepodobnosti.",
      },
    ],
  },
  {
    n: "POWER",
    d: "Vráti výsledok čísla umocneného na mocninu.",
    a: "Číslo umocnené.",
    p: [
      {
        name: "číslo",
        detail: "základné číslo; akékoľvek reálne číslo.",
      },
      {
        name: "exponent",
        detail: "Exponent, na ktorý sa zvýši základné číslo.",
      },
    ],
  },
  {
    n: "PPMT",
    d: "Vráti platbu istiny za dané obdobie pre investíciu na základe pravidelných, konštantných platieb a konštantnej úrokovej sadzby.",
    a: "Časť splátky pripadajúca na istinu.",
    p: [
      {
        name: "sadzba",
        detail: "Úroková sadzba za obdobie.",
      },
      {
        name: "obdobie",
        detail: "Obdobie od 1 do `počet_období`.",
      },
      {
        name: "počet_období",
        detail: "Celkový počet platobných období.",
      },
      {
        name: "súčasná_hodnota",
        detail:
          "Súčasná hodnota, celková suma, ktorú má teraz séria budúcich platieb.",
      },
      {
        name: "budúca_hodnota",
        detail:
          "Budúca hodnota alebo hotovostný zostatok, ktorý chcete po poslednej platbe; predvolene je 0.",
      },
      {
        name: "typ",
        detail:
          "Keď sú platby splatné: 0 alebo vynechané na konci obdobia, 1 na začiatku.",
      },
    ],
  },
  {
    n: "PRICE",
    d: "Vráti cenu za nominálnu hodnotu 100 $ cenného papiera, z ktorého sa pravidelne úročí.",
    a: "Cena cenného papiera s periodickým úrokom.",
    p: [
      {
        name: "dátum_vyrovnania",
        detail: "Dátum vyrovnania cenného papiera.",
      },
      {
        name: "dátum_splatnosti",
        detail: "Dátum splatnosti cenného papiera.",
      },
      {
        name: "sadzba",
        detail: "Ročná kupónová sadzba cenného papiera.",
      },
      {
        name: "výnos",
        detail: "Ročný výnos cenného papiera.",
      },
      {
        name: "výkupná_hodnota",
        detail: "Výkupná hodnota cenného papiera na 100 $ nominálnej hodnoty.",
      },
      {
        name: "frekvencia",
        detail:
          "Počet výplat kupónov za rok: 1 ročná, 2 polročné, 4 štvrťročné.",
      },
      {
        name: "základňa",
        detail:
          "Základ počtu dní: 0 alebo vynechané US 30/360, 1 skutočný/aktuálny, 2 skutočné/360, 3 skutočné/365, 4 európske 30/360.",
      },
    ],
  },
  {
    n: "PRICEDISC",
    d: "Vráti cenu za nominálnu hodnotu 100 $ diskontovaného cenného papiera.",
    a: "Cena zľavneného cenného papiera.",
    p: [
      {
        name: "dátum_vyrovnania",
        detail: "Dátum vyrovnania cenného papiera.",
      },
      {
        name: "dátum_splatnosti",
        detail: "Dátum splatnosti cenného papiera.",
      },
      {
        name: "diskontná_sadzba",
        detail: "Diskontná sadzba cenného papiera.",
      },
      {
        name: "výkupná_hodnota",
        detail: "Výkupná hodnota cenného papiera na 100 $ nominálnej hodnoty.",
      },
      {
        name: "základňa",
        detail:
          "Základ počtu dní: 0 alebo vynechané US 30/360, 1 skutočný/aktuálny, 2 skutočné/360, 3 skutočné/365, 4 európske 30/360.",
      },
    ],
  },
  {
    n: "PRICEMAT",
    d: "Vráti cenu za nominálnu hodnotu 100 USD cenného papiera, ktorý platí úrok pri splatnosti.",
    a: "Cena cenného papiera splatná pri splatnosti.",
    p: [
      {
        name: "dátum_vyrovnania",
        detail: "Dátum vyrovnania cenného papiera.",
      },
      {
        name: "dátum_splatnosti",
        detail: "Dátum splatnosti cenného papiera.",
      },
      {
        name: "dátum_emisie",
        detail: "Dátum vydania cenného papiera.",
      },
      {
        name: "sadzba",
        detail: "Úroková sadzba cenného papiera k dátumu emisie.",
      },
      {
        name: "výnos",
        detail: "Ročný výnos cenného papiera.",
      },
      {
        name: "základňa",
        detail:
          "Základ počtu dní: 0 alebo vynechané US 30/360, 1 skutočný/aktuálny, 2 skutočné/360, 3 skutočné/365, 4 európske 30/360.",
      },
    ],
  },
  {
    n: "PROB",
    d: "Vráti pravdepodobnosť, že hodnoty v rozsahu sú medzi dvoma limitmi alebo sa rovnajú spodnému limitu, keď je horný limit vynechaný.",
    a: "Pravdepodobnosť, že hodnoty spadajú medzi limity.",
    p: [
      {
        name: "x_rozsah",
        detail:
          "Rozsah číselných hodnôt x, s ktorými sú spojené pravdepodobnosti.",
      },
      {
        name: "rozsah_pravdepodobností",
        detail:
          "Sada pravdepodobností spojených s hodnotami v `x_rozsah`; musia dať dokopy 1.",
      },
      {
        name: "spodná_hranica",
        detail: "Dolná hranica hodnoty, pre ktorú chcete pravdepodobnosť.",
      },
      {
        name: "horná_hranica",
        detail:
          "Voliteľná horná hranica hodnoty, pre ktorú chcete určiť pravdepodobnosť.",
      },
    ],
  },
  {
    n: "PRODUCT",
    d: "Vynásobí všetky čísla zadané ako argumenty a vráti súčin.",
    a: "Súčin čísel.",
    p: [
      {
        name: "číslo1",
        detail: "Prvé číslo alebo rozsah, ktorý chcete vynásobiť.",
      },
      {
        name: "číslo2",
        detail: "Ďalšie čísla alebo rozsahy, celkovo až 255.",
      },
    ],
  },
  {
    n: "PROPER",
    d: "Veľké prvé písmeno v textovom reťazci a akékoľvek ďalšie písmená, ktoré nasledujú za znakom iným ako písmeno; prevedie všetky ostatné písmená na malé.",
    a: "Prevedie prvé písmeno každého slova na veľké.",
    p: [
      {
        name: "text",
        detail:
          "Text uzavretý v úvodzovkách, vzorec, ktorý vracia text, alebo odkaz na bunku obsahujúcu text.",
      },
    ],
  },
  {
    n: "PV",
    d: "Vypočíta súčasnú hodnotu pôžičky alebo investície na základe konštantnej úrokovej sadzby.",
    a: "Súčasná hodnota investície.",
    p: [
      {
        name: "sadzba",
        detail: "Úroková sadzba za obdobie.",
      },
      {
        name: "počet_období",
        detail: "Celkový počet období splatnosti v anuite.",
      },
      {
        name: "splátka",
        detail:
          "Platba uskutočnená v každom období; nemôže sa počas životnosti anuity meniť.",
      },
      {
        name: "budúca_hodnota",
        detail:
          "Budúca hodnota alebo hotovostný zostatok, ktorý chcete po poslednej platbe; predvolene je 0.",
      },
      {
        name: "typ",
        detail:
          "Keď sú platby splatné: 0 alebo vynechané na konci obdobia, 1 na začiatku.",
      },
    ],
  },
  {
    n: "QUARTILE.EXC",
    d: "Vráti kvartil súboru údajov na základe percentilových hodnôt od 0 do 1, s výnimkou.",
    a: "Kvartil, exkluzívny.",
    p: [
      {
        name: "pole",
        detail:
          "Pole alebo rozsah buniek číselných hodnôt, pre ktoré chcete použiť kvartil.",
      },
      {
        name: "kvartil",
        detail: "Ktorý kvartil sa má vrátiť: 1, 2 alebo 3.",
      },
    ],
  },
  {
    n: "QUARTILE.INC",
    d: "Vráti kvartil súboru údajov na základe percentilových hodnôt od 0 do 1 vrátane.",
    a: "Kvartil vrátane.",
    p: [
      {
        name: "pole",
        detail:
          "Pole alebo rozsah buniek číselných hodnôt, pre ktoré chcete použiť kvartil.",
      },
      {
        name: "kvartil",
        detail:
          "Ktorý kvartil sa má vrátiť: 0 minimum, 1 prvý kvartil, 2 medián, 3 tretí kvartil, 4 maximum.",
      },
    ],
  },
  {
    n: "QUOTIENT",
    d: "Vráti celočíselnú časť delenia a zvyšok zahodí.",
    a: "Celočíselná časť delenia.",
    p: [
      {
        name: "čitateľ",
        detail: "Dividenda.",
      },
      {
        name: "menovateľ",
        detail: "Deliteľ.",
      },
    ],
  },
  {
    n: "RADIANS",
    d: "Konvertuje stupne na radiány.",
    a: "Konvertuje stupne na radiány.",
    p: [
      {
        name: "uhol",
        detail: "Uhol v stupňoch, ktorý chcete previesť.",
      },
    ],
  },
  {
    n: "RAND",
    d: "Vráti rovnomerne rozložené náhodné reálne číslo väčšie alebo rovné 0 a menšie ako 1. Pri každom výpočte listu sa vráti nové číslo.",
    a: "Náhodné číslo medzi 0 a 1.",
    p: [],
  },
  {
    n: "RANDARRAY",
    d: "Vráti pole náhodných čísel. Môžete nastaviť počet riadkov a stĺpcov, minimálne a maximálne hodnoty a či sa majú vrátiť celé čísla alebo desatinné miesta.",
    a: "Pole náhodných čísel.",
    p: [
      {
        name: "riadky",
        detail: "Počet riadkov, ktoré sa majú vrátiť; predvolene je 1.",
      },
      {
        name: "stĺpce",
        detail: "Počet stĺpcov, ktoré sa majú vrátiť; predvolene je 1.",
      },
      {
        name: "min",
        detail: "Minimálny počet na vrátenie; predvolene je 0.",
      },
      {
        name: "max",
        detail: "Maximálny počet na vrátenie; predvolene je 1.",
      },
      {
        name: "celé_číslo",
        detail:
          "TRUE vráti celé čísla, FALSE alebo vynechané vráti desatinné čísla.",
      },
    ],
  },
  {
    n: "RANDBETWEEN",
    d: "Vráti náhodné celé číslo medzi zadanými číslami. Pri každom výpočte hárku sa vráti nové číslo.",
    a: "Náhodné celé číslo medzi dvoma hodnotami.",
    p: [
      {
        name: "dole",
        detail: "Vráti sa najmenšie celé číslo RANDBETWEEN.",
      },
      {
        name: "hore",
        detail: "Vráti sa najväčšie celé číslo RANDBETWEEN.",
      },
    ],
  },
  {
    n: "RANK.AVG",
    d: "Vráti poradie čísla v zozname čísel; ak má viacero hodnôt rovnaké poradie, vráti sa priemerné poradie.",
    a: "Poradie čísla; rovnaké hodnoty majú priemerné poradie.",
    p: [
      {
        name: "číslo",
        detail: "Číslo, ktorého hodnosť chcete nájsť.",
      },
      {
        name: "odkaz",
        detail:
          "Pole alebo odkaz na zoznam čísel. Nečíselné hodnoty sa ignorujú.",
      },
      {
        name: "poradie",
        detail:
          "0 alebo vynechané poradia v zostupnom poradí; akákoľvek nenulová hodnota sa radí vzostupne.",
      },
    ],
  },
  {
    n: "RANK.EQ",
    d: "Vráti poradie čísla v zozname čísel; ak má viac ako jedna hodnota rovnakú hodnotu, vráti sa horná hodnota danej sady.",
    a: "Poradie čísla; rovnaké hodnoty zdieľajú najvyššie poradie.",
    p: [
      {
        name: "číslo",
        detail: "Číslo, ktorého hodnosť chcete nájsť.",
      },
      {
        name: "odkaz",
        detail:
          "Pole alebo odkaz na zoznam čísel. Nečíselné hodnoty sa ignorujú.",
      },
      {
        name: "poradie",
        detail:
          "0 alebo vynechané poradia v zostupnom poradí; akákoľvek nenulová hodnota sa radí vzostupne.",
      },
    ],
  },
  {
    n: "RATE",
    d: "Vráti úrokovú sadzbu za obdobie anuity. RATE sa vypočítava iteráciou a môže mať nula alebo viac riešení.",
    a: "Úroková sadzba za obdobie anuity.",
    p: [
      {
        name: "počet_období",
        detail: "Celkový počet období splatnosti v anuite.",
      },
      {
        name: "splátka",
        detail:
          "Platba uskutočnená v každom období; nemôže sa počas životnosti anuity meniť.",
      },
      {
        name: "súčasná_hodnota",
        detail:
          "Súčasná hodnota, celková suma, ktorú má teraz séria budúcich platieb.",
      },
      {
        name: "budúca_hodnota",
        detail:
          "Budúca hodnota alebo hotovostný zostatok, ktorý chcete po poslednej platbe; predvolene je 0.",
      },
      {
        name: "typ",
        detail:
          "Keď sú platby splatné: 0 alebo vynechané na konci obdobia, 1 na začiatku.",
      },
      {
        name: "odhad",
        detail: "Váš odhad, aký bude kurz; predvolená hodnota je 10 percent.",
      },
    ],
  },
  {
    n: "RECEIVED",
    d: "Vráti sumu prijatú pri splatnosti za plne investovaný cenný papier.",
    a: "Suma prijatá pri splatnosti.",
    p: [
      {
        name: "dátum_vyrovnania",
        detail: "Dátum vyrovnania cenného papiera.",
      },
      {
        name: "dátum_splatnosti",
        detail: "Dátum splatnosti cenného papiera.",
      },
      {
        name: "investície",
        detail: "Suma investovaná do cenného papiera.",
      },
      {
        name: "diskontná_sadzba",
        detail: "Diskontná sadzba cenného papiera.",
      },
      {
        name: "základňa",
        detail:
          "Základ počtu dní: 0 alebo vynechané US 30/360, 1 skutočný/aktuálny, 2 skutočné/360, 3 skutočné/365, 4 európske 30/360.",
      },
    ],
  },
  {
    n: "REDUCE",
    d: "Zmenší pole na akumulovanú hodnotu použitím LAMBDA na každú hodnotu a vráti celkovú hodnotu v akumulátore.",
    a: "Zmenší pole na jednu hodnotu.",
    p: [
      {
        name: "počiatočná_hodnota",
        detail: "Počiatočná hodnota pre akumulátor.",
      },
      {
        name: "pole",
        detail: "Pole, ktoré sa má zmenšiť.",
      },
      {
        name: "lambda",
        detail: "Volaná LAMBDA s akumulátorom a aktuálnou hodnotou.",
      },
    ],
  },
  {
    n: "REGEXEXTRACT",
    d: "Extrahuje reťazce v rámci poskytnutého textu, ktoré zodpovedajú vzoru.",
    a: "Text, ktorý sa zhoduje s regulárnym výrazom.",
    p: [
      {
        name: "text",
        detail:
          "Text alebo odkaz na bunku obsahujúcu text, z ktorého chcete extrahovať reťazce.",
      },
      {
        name: "vzor",
        detail:
          "Regulárny výraz, ktorý popisuje vzor textu, ktorý chcete extrahovať.",
      },
      {
        name: "návratový_režim",
        detail:
          "0 alebo vynechané vráti prvú zhodu, 1 všetky zhody ako pole, 2 zachytávajúce skupiny prvej zhody ako pole.",
      },
      {
        name: "rozlišovanie_malých_a_veľkých_písmen",
        detail:
          "0 alebo vynechané rozlišujú malé a veľké písmená, 1 nerozlišujú malé a veľké písmená.",
      },
    ],
  },
  {
    n: "REGEXREPLACE",
    d: "Nahradí reťazce v rámci poskytnutého textu, ktoré zodpovedajú vzoru s náhradou.",
    a: "Nahrádza text zodpovedajúci regulárnemu výrazu.",
    p: [
      {
        name: "text",
        detail:
          "Text alebo odkaz na bunku obsahujúcu text, v ktorom chcete nahradiť reťazce.",
      },
      {
        name: "vzor",
        detail:
          "Regulárny výraz, ktorý popisuje vzor textu, ktorý chcete nahradiť.",
      },
      {
        name: "náhrada",
        detail: "Text, ktorý chcete nahradiť výskyty `vzor`.",
      },
      {
        name: "výskyt",
        detail:
          "Ktorý výskyt nahradiť: 0 alebo vynechaný nahradí všetky, záporné číslo sa počíta od konca.",
      },
      {
        name: "rozlišovanie_malých_a_veľkých_písmen",
        detail:
          "0 alebo vynechané rozlišujú malé a veľké písmená, 1 nerozlišujú malé a veľké písmená.",
      },
    ],
  },
  {
    n: "REGEXTEST",
    d: "Umožňuje vám skontrolovať, či sa niektorá časť dodaného textu zhoduje s regulárnym výrazom.",
    a: "Kontroluje text oproti regulárnemu výrazu.",
    p: [
      {
        name: "text",
        detail:
          "Text alebo odkaz na bunku obsahujúcu text, s ktorým chcete porovnať.",
      },
      {
        name: "vzor",
        detail:
          "Regulárny výraz, ktorý popisuje vzor textu, ktorý chcete nájsť.",
      },
      {
        name: "rozlišovanie_malých_a_veľkých_písmen",
        detail:
          "0 alebo vynechané rozlišujú malé a veľké písmená, 1 nerozlišujú malé a veľké písmená.",
      },
    ],
  },
  {
    n: "REPLACE",
    d: "Nahradí časť textového reťazca na základe počtu znakov, ktoré určíte, iným textovým reťazcom.",
    a: "Nahrádza znaky na pozícii.",
    p: [
      {
        name: "starý_text",
        detail: "Text, v ktorom chcete nahradiť niektoré znaky.",
      },
      {
        name: "počiatočná_pozícia",
        detail:
          "Pozícia znaku v `starý_text`, ktorý chcete nahradiť znakom `nový_text`.",
      },
      {
        name: "počet_znakov",
        detail: "Počet znakov v `starý_text`, ktoré chcete nahradiť REPLACE.",
      },
      {
        name: "nový_text",
        detail: "Text, ktorý nahradí znaky v `starý_text`.",
      },
    ],
  },
  {
    n: "REPLACEB",
    d: "Nahradí časť textového reťazca na základe počtu bajtov iným textovým reťazcom.",
    a: "Nahradiť časť textu (bajtov).",
    p: [
      {
        name: "starý_text",
        detail: "Text, v ktorom chcete nahradiť niektoré znaky.",
      },
      {
        name: "počiatočná_pozícia",
        detail: "Pozícia prvého znaku, ktorý sa má nahradiť.",
      },
      {
        name: "počet_bajtov",
        detail: "Počet bajtov, ktoré sa majú nahradiť.",
      },
      {
        name: "nový_text",
        detail: "Text, ktorý nahrádza znaky.",
      },
    ],
  },
  {
    n: "REPT",
    d: "Opakuje text stanovený počet krát.",
    a: "Opakuje text.",
    p: [
      {
        name: "text",
        detail: "Text, ktorý chcete zopakovať.",
      },
      {
        name: "počet_opakovaní",
        detail: "Kladné číslo určujúce počet opakovaní `text`.",
      },
    ],
  },
  {
    n: "RIGHT",
    d: "Vráti posledný znak alebo znaky v textovom reťazci na základe počtu znakov, ktoré určíte.",
    a: "Znaky textu úplne vpravo.",
    p: [
      {
        name: "text",
        detail: "Textový reťazec obsahujúci znaky, ktoré chcete extrahovať.",
      },
      {
        name: "počet_znakov",
        detail: "Počet znakov, ktoré má RIGHT extrahovať; predvolene je 1.",
      },
    ],
  },
  {
    n: "RIGHTB",
    d: "Vráti posledné znaky textového reťazca na základe počtu bajtov.",
    a: "Znaky úplne vpravo (bajty).",
    p: [
      {
        name: "text",
        detail: "Textový reťazec obsahujúci znaky, ktoré chcete extrahovať.",
      },
      {
        name: "počet_bajtov",
        detail: "Počet bajtov na extrakciu; predvolene 1.",
      },
    ],
  },
  {
    n: "ROMAN",
    d: "Skonvertuje arabskú číslicu na rímsku ako text.",
    a: "Prevedie číslo na rímske číslo.",
    p: [
      {
        name: "číslo",
        detail: "Arabské číslo, ktoré chcete previesť, od 1 do 3999.",
      },
      {
        name: "forma",
        detail:
          "Typ rímskej číslice: 0 alebo TRUE klasická, 1 až 3 postupne stručnejšia, 4 alebo FALSE zjednodušená.",
      },
    ],
  },
  {
    n: "ROUND",
    d: "Zaokrúhli číslo na zadaný počet číslic.",
    a: "Zaokrúhli na počet číslic.",
    p: [
      {
        name: "číslo",
        detail: "Číslo, ktoré chcete zaokrúhliť.",
      },
      {
        name: "počet_číslic",
        detail:
          "Počet číslic, na ktoré sa má zaokrúhliť. Záporné hodnoty sú zaokrúhlené naľavo od desatinnej čiarky.",
      },
    ],
  },
  {
    n: "ROUNDDOWN",
    d: "Zaokrúhli číslo nadol, smerom k nule, na zadaný počet číslic.",
    a: "Zaokrúhli smerom k nule.",
    p: [
      {
        name: "číslo",
        detail: "Akékoľvek reálne číslo, ktoré chcete zaokrúhliť nadol.",
      },
      {
        name: "počet_číslic",
        detail:
          "Počet číslic, na ktoré sa má zaokrúhliť. Záporné hodnoty sú zaokrúhlené naľavo od desatinnej čiarky.",
      },
    ],
  },
  {
    n: "ROUNDUP",
    d: "Zaokrúhli číslo smerom nahor od nuly na zadaný počet číslic.",
    a: "Zaokrúhľuje od nuly.",
    p: [
      {
        name: "číslo",
        detail: "Akékoľvek reálne číslo, ktoré chcete zaokrúhliť nahor.",
      },
      {
        name: "počet_číslic",
        detail:
          "Počet číslic, na ktoré sa má zaokrúhliť. Záporné hodnoty sú zaokrúhlené naľavo od desatinnej čiarky.",
      },
    ],
  },
  {
    n: "ROW",
    d: "Vráti číslo riadku odkazu alebo bunky obsahujúcej vzorec, ak je vynechaný.",
    a: "Číslo riadku odkazu.",
    p: [
      {
        name: "odkaz",
        detail: "Bunka alebo rozsah buniek, pre ktoré chcete číslo riadku.",
      },
    ],
  },
  {
    n: "ROWS",
    d: "Vráti počet riadkov v referencii alebo poli.",
    a: "Počet riadkov v rozsahu.",
    p: [
      {
        name: "pole",
        detail: "Pole, vzorec poľa alebo odkaz na rozsah buniek.",
      },
    ],
  },
  {
    n: "RRI",
    d: "Vráti ekvivalentnú úrokovú sadzbu pre rast investície.",
    a: "Ekvivalentná úroková sadzba pre rast.",
    p: [
      {
        name: "počet_období",
        detail: "Počet období pre investíciu.",
      },
      {
        name: "súčasná_hodnota",
        detail: "Súčasná hodnota investície.",
      },
      {
        name: "budúca_hodnota",
        detail: "Budúca hodnota investície.",
      },
    ],
  },
  {
    n: "RSQ",
    d: "Vráti druhú mocninu Pearsonovho súčinového momentového korelačného koeficientu cez dátové body v known_y a known_x.",
    a: "R-kvadratúra lineárnej regresie.",
    p: [
      {
        name: "známe_y",
        detail: "Pole alebo rozsah dátových bodov.",
      },
      {
        name: "známe_x",
        detail: "Pole alebo rozsah dátových bodov.",
      },
    ],
  },
  {
    n: "SCAN",
    d: "Skenuje pole použitím LAMBDA na každú hodnotu a vráti pole, ktoré má každú medzihodnotu.",
    a: "Beh akumulácie s LAMBDA.",
    p: [
      {
        name: "počiatočná_hodnota",
        detail: "Počiatočná hodnota pre akumulátor.",
      },
      {
        name: "pole",
        detail: "Pole, ktoré sa má skenovať.",
      },
      {
        name: "lambda",
        detail: "Volaná LAMBDA s akumulátorom a aktuálnou hodnotou.",
      },
    ],
  },
  {
    n: "SEARCH",
    d: "Vyhľadá jeden textový reťazec v druhom textovom reťazci a vráti počiatočnú pozíciu prvého. Nerozlišuje veľké a malé písmená; podporuje zástupné znaky? a *.",
    a: "Pozícia textu v texte (nerozlišujú sa malé a veľké písmená).",
    p: [
      {
        name: "hľadaný_text",
        detail:
          "Text, ktorý chcete nájsť; môže obsahovať zástupné znaky ? a *.",
      },
      {
        name: "v_texte",
        detail: "Text, v ktorom chcete vyhľadať `hľadaný_text`.",
      },
      {
        name: "počiatočná_pozícia",
        detail:
          "Číslo znaku v `v_texte`, od ktorého chcete začať hľadať; predvolene je 1.",
      },
    ],
  },
  {
    n: "SEARCHB",
    d: "Nájde jeden textový reťazec v inom (nerozlišujú sa malé a veľké písmená, sú povolené zástupné znaky) a vráti jeho počiatočnú pozíciu, počíta bajty.",
    a: "Pozícia textu (bajtov) bez ohľadu na malé a veľké písmená.",
    p: [
      {
        name: "hľadaný_text",
        detail: "Text, ktorý chcete nájsť.",
      },
      {
        name: "v_texte",
        detail: "Text, v ktorom chcete hľadať.",
      },
      {
        name: "počiatočná_pozícia",
        detail: "Znak, ktorým sa má začať vyhľadávanie.",
      },
    ],
  },
  {
    n: "SEC",
    d: "Vráti sečnan uhla zadaného v radiánoch.",
    a: "Sekansa uhla v radiánoch.",
    p: [
      {
        name: "číslo",
        detail:
          "Uhol v radiánoch; jeho absolútna hodnota musí byť menšia ako 2^27.",
      },
    ],
  },
  {
    n: "SECH",
    d: "Vráti hyperbolický sekans uhla.",
    a: "Hyperbolický sekant.",
    p: [
      {
        name: "číslo",
        detail: "Akékoľvek reálne číslo.",
      },
    ],
  },
  {
    n: "SECOND",
    d: "Vráti sekundy časovej hodnoty ako celé číslo od 0 do 59.",
    a: "Sekundová zložka času.",
    p: [
      {
        name: "poradové_číslo",
        detail: "Čas, ktorý obsahuje sekundy, ktoré chcete nájsť.",
      },
    ],
  },
  {
    n: "SEQUENCE",
    d: "Generuje pole sekvenčných čísel, ako napríklad 1, 2, 3, 4.",
    a: "Pole sekvenčných čísel.",
    p: [
      {
        name: "riadky",
        detail: "Počet riadkov, ktoré sa majú vrátiť.",
      },
      {
        name: "stĺpce",
        detail: "Počet stĺpcov, ktoré sa majú vrátiť; predvolene je 1.",
      },
      {
        name: "začiatok",
        detail: "prvé číslo v poradí; predvolene je 1.",
      },
      {
        name: "krok",
        detail:
          "Množstvo na zvýšenie každej nasledujúcej hodnoty; predvolene je 1.",
      },
    ],
  },
  {
    n: "SERIESSUM",
    d: "Vráti súčet mocninového radu na základe vzorca a1*x^n + a2*x^(n+m) + a3*x^(n+2m) + ...",
    a: "Súčet mocninového radu.",
    p: [
      {
        name: "x",
        detail: "Vstupná hodnota do mocninového radu.",
      },
      {
        name: "n",
        detail: "Počiatočný výkon, na ktorý chcete zvýšiť `x`.",
      },
      {
        name: "m",
        detail: "Krok, ktorým sa zvýši `n` pre každý výraz v rade.",
      },
      {
        name: "koeficienty",
        detail:
          "Súbor koeficientov, ktorými sa násobí každá následná mocnina `x`.",
      },
    ],
  },
  {
    n: "SHEET",
    d: "Vráti číslo listu odkazovaného listu.",
    a: "Číslo listu odkazu.",
    p: [
      {
        name: "hodnota",
        detail:
          "Názov listu alebo odkazu; predvolene sa použije hárok, ktorý obsahuje vzorec.",
      },
    ],
  },
  {
    n: "SHEETS",
    d: "Vráti počet listov v referencii.",
    a: "Počet listov v referencii.",
    p: [
      {
        name: "odkaz",
        detail:
          "Odkaz, pre ktorý chcete počet listov; predvolene pre všetky hárky v zošite.",
      },
    ],
  },
  {
    n: "SIGN",
    d: "Vráti znamienko čísla: 1, ak je číslo kladné, 0, ak je nula, a -1, ak je záporné.",
    a: "Znamienko čísla.",
    p: [
      {
        name: "číslo",
        detail: "Akékoľvek reálne číslo.",
      },
    ],
  },
  {
    n: "SIN",
    d: "Vráti sínus uhla zadaného v radiánoch.",
    a: "Sínus uhla v radiánoch.",
    p: [
      {
        name: "číslo",
        detail: "Uhol v radiánoch.",
      },
    ],
  },
  {
    n: "SINH",
    d: "Vráti hyperbolický sínus čísla.",
    a: "Hyperbolický sínus.",
    p: [
      {
        name: "číslo",
        detail: "Akékoľvek reálne číslo.",
      },
    ],
  },
  {
    n: "SKEW",
    d: "Vráti šikmosť rozdelenia, stupeň asymetrie rozdelenia okolo jeho strednej hodnoty.",
    a: "Šikmosť vzorky.",
    p: [
      {
        name: "číslo1",
        detail: "Prvé číslo alebo rozsah.",
      },
      {
        name: "číslo2",
        detail: "Ďalšie čísla alebo rozsahy, celkovo až 255.",
      },
    ],
  },
  {
    n: "SKEW.P",
    d: "Vráti šikmosť rozdelenia na základe populácie.",
    a: "Šikmosť základného súboru.",
    p: [
      {
        name: "číslo1",
        detail: "Prvé číslo alebo rozsah.",
      },
      {
        name: "číslo2",
        detail: "Ďalšie čísla alebo rozsahy, celkovo až 254.",
      },
    ],
  },
  {
    n: "SLN",
    d: "Vráti lineárne odpisy majetku za jedno obdobie.",
    a: "Priamy odpis.",
    p: [
      {
        name: "obstarávacia_cena",
        detail: "Počiatočná obstarávacia cena majetku.",
      },
      {
        name: "zostatková_hodnota",
        detail: "Hodnota na konci odpisovania.",
      },
      {
        name: "životnosť",
        detail: "Počet období, počas ktorých sa majetok odpisuje.",
      },
    ],
  },
  {
    n: "SLOPE",
    d: "Vráti sklon priamky lineárnej regresie cez dátové body v known_y a known_x.",
    a: "Sklon regresnej priamky.",
    p: [
      {
        name: "známe_y",
        detail: "Pole alebo rozsah buniek numericky závislých dátových bodov.",
      },
      {
        name: "známe_x",
        detail: "Súbor nezávislých dátových bodov.",
      },
    ],
  },
  {
    n: "SMALL",
    d: "Vráti k-tu najmenšiu hodnotu v súbore údajov.",
    a: "K-ta najmenšia hodnota.",
    p: [
      {
        name: "pole",
        detail:
          "Pole alebo rozsah číselných údajov, pre ktoré chcete určiť k-tu najmenšiu hodnotu.",
      },
      {
        name: "k",
        detail:
          "Pozícia (od najmenšej) v poli alebo rozsahu dát, ktoré sa majú vrátiť.",
      },
    ],
  },
  {
    n: "SORT",
    d: "Triedi obsah rozsahu alebo poľa.",
    a: "Zoradí rozsah alebo pole.",
    p: [
      {
        name: "pole",
        detail: "Rozsah alebo pole na triedenie.",
      },
      {
        name: "index_triedenia",
        detail:
          "Číslo označujúce riadok alebo stĺpec, podľa ktorého sa má triediť; predvolene je 1.",
      },
      {
        name: "poradie_triedenia",
        detail: "1 alebo vynechané zoradenia vzostupne, -1 zostupne.",
      },
      {
        name: "podľa_stĺpcov",
        detail:
          "FALSE alebo vynechané zoradenie podľa riadka, TRUE zoradenie podľa stĺpca.",
      },
    ],
  },
  {
    n: "SORTBY",
    d: "Triedi obsah rozsahu alebo poľa na základe hodnôt v zodpovedajúcom rozsahu alebo poli.",
    a: "Triedi podľa hodnôt v iných rozsahoch.",
    p: [
      {
        name: "pole",
        detail: "Pole alebo rozsah na triedenie.",
      },
      {
        name: "podľa_poľa1",
        detail: "Pole alebo rozsah, podľa ktorého sa má triediť.",
      },
      {
        name: "poradie_zoradenia1",
        detail:
          "Poradie, ktoré sa má použiť na triedenie: 1 vzostupne (predvolené), -1 zostupne.",
      },
      {
        name: "podľa_poľa2",
        detail: "Ďalšie polia alebo rozsahy na triedenie.",
      },
      {
        name: "poradie_zoradenia2",
        detail: "Poradie pre zodpovedajúce dodatočné pole.",
      },
    ],
  },
  {
    n: "SQRT",
    d: "Vráti kladnú druhú odmocninu.",
    a: "Kladná druhá odmocnina.",
    p: [
      {
        name: "číslo",
        detail: "Číslo, pre ktoré chcete druhú odmocninu.",
      },
    ],
  },
  {
    n: "SQRTPI",
    d: "Vráti druhú odmocninu z (číslo * pi).",
    a: "Druhá odmocnina čísla krát pi.",
    p: [
      {
        name: "číslo",
        detail: "Číslo, ktorým sa pí vynásobí.",
      },
    ],
  },
  {
    n: "STANDARDIZE",
    d: "Vráti normalizovanú hodnotu z distribúcie charakterizovanej strednou hodnotou a smerodajná_odchýlka.",
    a: "Normalizovaná hodnota (z-skóre).",
    p: [
      {
        name: "x",
        detail: "Hodnota, ktorú chcete normalizovať.",
      },
      {
        name: "priemer",
        detail: "Aritmetický priemer rozdelenia.",
      },
      {
        name: "smerodajná_odchýlka",
        detail: "Štandardná odchýlka rozdelenia.",
      },
    ],
  },
  {
    n: "STDEV.P",
    d: "Vypočíta štandardnú odchýlku na základe celej populácie uvedenej ako argumenty, pričom sa ignorujú logické hodnoty a text.",
    a: "Smerodajná odchýlka populácie.",
    p: [
      {
        name: "číslo1",
        detail: "Prvé číslo alebo rozsah zodpovedajúci populácii.",
      },
      {
        name: "číslo2",
        detail: "Ďalšie čísla alebo rozsahy, celkovo až 254.",
      },
    ],
  },
  {
    n: "STDEV.S",
    d: "Odhaduje štandardnú odchýlku na základe vzorky, ignoruje logické hodnoty a text.",
    a: "Výberová smerodajná odchýlka.",
    p: [
      {
        name: "číslo1",
        detail: "Prvé číslo alebo rozsah zodpovedajúci vzorke populácie.",
      },
      {
        name: "číslo2",
        detail: "Ďalšie čísla alebo rozsahy, celkovo až 254.",
      },
    ],
  },
  {
    n: "STDEVA",
    d: "Odhaduje štandardnú odchýlku na základe vzorky, pričom text hodnotí ako 0 a logické hodnoty ako 1 alebo 0.",
    a: "Výberová smerodajná odchýlka vrátane textu a logických hodnôt.",
    p: [
      {
        name: "hodnota1",
        detail: "Prvá hodnota alebo rozsah zodpovedajúci vzorke populácie.",
      },
      {
        name: "hodnota2",
        detail: "Ďalšie hodnoty alebo rozsahy, celkovo až 255.",
      },
    ],
  },
  {
    n: "STDEVP",
    d: "Vypočíta štandardnú odchýlku na základe celej populácie. Zachované z dôvodu kompatibility; pozri STDEV.P.",
    a: "Smerodajná odchýlka populácie (kompatibilita).",
    p: [
      {
        name: "číslo1",
        detail: "Prvé číslo alebo rozsah zodpovedajúci populácii.",
      },
      {
        name: "číslo2",
        detail: "Ďalšie čísla alebo rozsahy, celkovo až 255.",
      },
    ],
  },
  {
    n: "STDEVPA",
    d: "Vypočíta štandardnú odchýlku na základe celej populácie, pričom text vyhodnotí ako 0 a logické hodnoty ako 1 alebo 0.",
    a: "Štandardná odchýlka populácie vrátane textu a logiky.",
    p: [
      {
        name: "hodnota1",
        detail: "Prvá hodnota alebo rozsah zodpovedajúci populácii.",
      },
      {
        name: "hodnota2",
        detail: "Ďalšie hodnoty alebo rozsahy, celkovo až 255.",
      },
    ],
  },
  {
    n: "STEYX",
    d: "Vráti štandardnú chybu predpovedanej hodnoty y pre každé x v regresii.",
    a: "Štandardná chyba regresie.",
    p: [
      {
        name: "známe_y",
        detail: "Pole alebo rozsah závislých dátových bodov.",
      },
      {
        name: "známe_x",
        detail: "Pole alebo rozsah nezávislých dátových bodov.",
      },
    ],
  },
  {
    n: "SUBSTITUTE",
    d: "Nahrádza nový_text za starý_text v textovom reťazci.",
    a: "Nahrádza výskyty textu.",
    p: [
      {
        name: "text",
        detail:
          "Text alebo odkaz na bunku obsahujúcu text, pre ktorý chcete nahradiť znaky.",
      },
      {
        name: "starý_text",
        detail: "Text, ktorý chcete nahradiť.",
      },
      {
        name: "nový_text",
        detail: "Text, ktorým chcete nahradiť `starý_text`.",
      },
      {
        name: "inštancia_č",
        detail:
          "Ktorý výskyt `starý_text` nahradiť; ak sa vynechá, každý výskyt sa nahradí.",
      },
    ],
  },
  {
    n: "SUBTOTAL",
    d: "Vráti medzisúčet v zozname alebo databáze pomocou danej funkcie. Kódy 101 až 111 tiež ignorujú manuálne skryté riadky; odfiltrované riadky sú vždy ignorované.",
    a: "Medzisúčet pomocou zvolenej funkcie.",
    p: [
      {
        name: "funkcia_č",
        detail:
          "1 až 11 alebo 101 až 111: AVERAGE, COUNT, COUNTA, MAX, MIN, PRODUCT, STDEV, STDEVP, SUM, VAR, VARP.",
      },
      {
        name: "odkaz_1",
        detail:
          "Prvý menovaný rozsah alebo odkaz, pre ktorý chcete medzisúčet.",
      },
      {
        name: "odkaz_2",
        detail: "Ďalšie rozsahy, až do 254, pre ktoré chcete medzisúčet.",
      },
    ],
  },
  {
    n: "SUM",
    d: "Sčíta všetky čísla v rozsahu buniek.",
    a: "Súčet čísel.",
    p: [
      {
        name: "číslo1",
        detail: "Prvé číslo alebo rozsah, ktorý sa má pridať.",
      },
      {
        name: "číslo2",
        detail: "Ďalšie čísla alebo rozsahy na pridanie, celkovo až 255.",
      },
    ],
  },
  {
    n: "SUMIF",
    d: "Pridá bunky v rozsahu, ktoré spĺňajú jednu podmienku.",
    a: "Podmienený súčet rozsahu.",
    p: [
      {
        name: "rozsah",
        detail: "Rozsah buniek, ktoré chcete vyhodnotiť pomocou `kritériá`.",
      },
      {
        name: "kritériá",
        detail:
          "Podmienka ako číslo, výraz, odkaz na bunku, text alebo funkcia, ktorá definuje, ktoré bunky sa pridajú.",
      },
      {
        name: "rozsah_súčtu",
        detail: "Bunky na pridanie, ak sa líšia od `rozsah`.",
      },
    ],
  },
  {
    n: "SUMIFS",
    d: "Pridá všetky svoje argumenty, ktoré spĺňajú viaceré kritériá.",
    a: "Súčet buniek, ktoré spĺňajú viaceré kritériá.",
    p: [
      {
        name: "rozsah_súčtu",
        detail: "Rozsah buniek na súčet.",
      },
      {
        name: "rozsah_kritérií1",
        detail: "Rozsah, ktorý je testovaný pomocou `kritériá_1`.",
      },
      {
        name: "kritériá_1",
        detail:
          "Kritériá, ktoré definujú, ktoré bunky v `rozsah_kritérií1` budú pridané.",
      },
      {
        name: "rozsah_kritérií2",
        detail: "Ďalšie rozsahy na testovanie, až 127 párov rozsah/kritérium.",
      },
      {
        name: "kritériá2",
        detail: "Kritériá pre zodpovedajúci dodatočný rozsah.",
      },
    ],
  },
  {
    n: "SUMPRODUCT",
    d: "Vráti súčet súčinov zodpovedajúcich rozsahov alebo polí.",
    a: "Súčet súčinov polí.",
    p: [
      {
        name: "pole1",
        detail:
          "Prvé pole, ktorého komponenty chcete vynásobiť a potom sčítať.",
      },
      {
        name: "pole2",
        detail: "Ďalšie polia, až do 255, s rovnakými rozmermi ako `pole1`.",
      },
    ],
  },
  {
    n: "SUMSQ",
    d: "Vráti súčet druhých mocnín argumentov.",
    a: "Súčet štvorcov.",
    p: [
      {
        name: "číslo1",
        detail: "Prvé číslo alebo rozsah na druhú a sčítanie.",
      },
      {
        name: "číslo2",
        detail: "Ďalšie čísla alebo rozsahy, celkovo až 255.",
      },
    ],
  },
  {
    n: "SUMX2MY2",
    d: "Vráti súčet rozdielu druhých mocnín zodpovedajúcich hodnôt v dvoch poliach.",
    a: "Súčet rozdielov štvorcov.",
    p: [
      {
        name: "pole_x",
        detail: "Prvé pole alebo rozsah hodnôt.",
      },
      {
        name: "pole_y",
        detail: "Druhé pole alebo rozsah hodnôt.",
      },
    ],
  },
  {
    n: "SUMX2PY2",
    d: "Vráti súčet súčtu druhých mocnín zodpovedajúcich hodnôt v dvoch poliach.",
    a: "Súčet súčtov štvorcov.",
    p: [
      {
        name: "pole_x",
        detail: "Prvé pole alebo rozsah hodnôt.",
      },
      {
        name: "pole_y",
        detail: "Druhé pole alebo rozsah hodnôt.",
      },
    ],
  },
  {
    n: "SUMXMY2",
    d: "Vráti súčet druhých mocnín rozdielov zodpovedajúcich hodnôt v dvoch poliach.",
    a: "Súčet druhých mocnín rozdielov.",
    p: [
      {
        name: "pole_x",
        detail: "Prvé pole alebo rozsah hodnôt.",
      },
      {
        name: "pole_y",
        detail: "Druhé pole alebo rozsah hodnôt.",
      },
    ],
  },
  {
    n: "SWITCH",
    d: "Vyhodnotí jednu hodnotu (výraz) oproti zoznamu hodnôt a vráti výsledok zodpovedajúci prvej zodpovedajúcej hodnote. Ak neexistuje žiadna zhoda, vráti sa voliteľná predvolená hodnota.",
    a: "Výsledok pre prvú zodpovedajúcu hodnotu.",
    p: [
      {
        name: "výraz",
        detail:
          "Hodnota, ktorá sa bude porovnávať s každým argumentom hodnoty.",
      },
      {
        name: "hodnota1",
        detail: "Hodnota na porovnanie s `výraz`.",
      },
      {
        name: "výsledok1",
        detail:
          "Hodnota, ktorá sa má vrátiť, keď sa `hodnota1` zhoduje s `výraz`.",
      },
      {
        name: "predvolená_hodnota_alebo_hodnota2",
        detail:
          "Ďalšia hodnota na porovnanie, alebo ako posledný argument sa vrátila predvolená hodnota, keď sa nič nezhoduje.",
      },
      {
        name: "výsledok2",
        detail:
          "Hodnota, ktorá sa má vrátiť, keď sa zodpovedajúca hodnota zhoduje.",
      },
    ],
  },
  {
    n: "SYD",
    d: "Vráti súčet ročných číslic odpisov majetku za určené obdobie.",
    a: "Odpisy metódou súčtu poradových čísel rokov.",
    p: [
      {
        name: "obstarávacia_cena",
        detail: "Počiatočná obstarávacia cena majetku.",
      },
      {
        name: "zostatková_hodnota",
        detail: "Hodnota na konci odpisovania.",
      },
      {
        name: "životnosť",
        detail: "Počet období, počas ktorých sa majetok odpisuje.",
      },
      {
        name: "obdobie",
        detail: "Obdobie v rovnakých jednotkách ako `životnosť`.",
      },
    ],
  },
  {
    n: "T",
    d: "Vráti text, na ktorý odkazuje hodnota, alebo prázdny reťazec, ak hodnota nie je text.",
    a: 'Vráti text alebo "" pre iné hodnoty.',
    p: [
      {
        name: "hodnota",
        detail: "Hodnota, ktorú chcete otestovať.",
      },
    ],
  },
  {
    n: "T.DIST",
    d: "Vráti ľavostranné Studentovo t-rozdelenie.",
    a: "Ľavostranná t-distribúcia.",
    p: [
      {
        name: "x",
        detail: "Číselná hodnota, pri ktorej sa má vyhodnotiť rozdelenie.",
      },
      {
        name: "stupne_voľnosti",
        detail: "Celé číslo označujúce počet stupňov voľnosti.",
      },
      {
        name: "kumulatívne",
        detail:
          "TRUE vráti funkciu kumulatívneho rozdelenia, FALSE funkciu hustoty pravdepodobnosti.",
      },
    ],
  },
  {
    n: "T.DIST.2T",
    d: "Vráti dvojstranné Studentovo t-rozdelenie.",
    a: "Dvojstranná t-distribúcia.",
    p: [
      {
        name: "x",
        detail: "Číselná hodnota, pri ktorej sa má vyhodnotiť rozdelenie.",
      },
      {
        name: "stupne_voľnosti",
        detail: "Celé číslo označujúce počet stupňov voľnosti.",
      },
    ],
  },
  {
    n: "T.DIST.RT",
    d: "Vráti pravostranné Studentovo t-rozdelenie.",
    a: "Pravostranná t-distribúcia.",
    p: [
      {
        name: "x",
        detail: "Číselná hodnota, pri ktorej sa má vyhodnotiť rozdelenie.",
      },
      {
        name: "stupne_voľnosti",
        detail: "Celé číslo označujúce počet stupňov voľnosti.",
      },
    ],
  },
  {
    n: "T.INV",
    d: "Vráti ľavostrannú inverziu Studentovho t-rozdelenia.",
    a: "Inverzná ľavostranná t-distribúcia.",
    p: [
      {
        name: "pravdepodobnosť",
        detail: "Pravdepodobnosť spojená so Studentovým t-rozdelením.",
      },
      {
        name: "stupne_voľnosti",
        detail: "Počet stupňov voľnosti.",
      },
    ],
  },
  {
    n: "T.INV.2T",
    d: "Vráti dvojstrannú inverziu Studentovho t-rozdelenia.",
    a: "Inverzná dvojstranná t-distribúcia.",
    p: [
      {
        name: "pravdepodobnosť",
        detail: "Pravdepodobnosť spojená so Studentovým t-rozdelením.",
      },
      {
        name: "stupne_voľnosti",
        detail: "Počet stupňov voľnosti.",
      },
    ],
  },
  {
    n: "T.TEST",
    d: "Vráti pravdepodobnosť spojenú so Studentovým t-testom.",
    a: "Pravdepodobnosť z t-testu.",
    p: [
      {
        name: "pole1",
        detail: "Prvý súbor údajov.",
      },
      {
        name: "pole2",
        detail: "Druhý súbor údajov.",
      },
      {
        name: "počet_chvostov",
        detail: "Počet distribučných chvostov: 1 jednostranný, 2 dvojstranný.",
      },
      {
        name: "typ",
        detail:
          "Druh testu: 1 párový, 2 dvojvýberový rovnaký rozptyl, 3 dvojvýberový nerovnaký rozptyl.",
      },
    ],
  },
  {
    n: "TAKE",
    d: "Vráti zadaný počet súvislých riadkov alebo stĺpcov od začiatku alebo konca poľa.",
    a: "Prvý alebo posledný riadok/stĺpce poľa.",
    p: [
      {
        name: "pole",
        detail: "Pole, z ktorého sa zoberú riadky alebo stĺpce.",
      },
      {
        name: "riadky",
        detail:
          "Počet riadkov, ktoré treba prijať; záporná hodnota nadobúda od konca.",
      },
      {
        name: "stĺpce",
        detail:
          "Počet stĺpcov, ktoré treba prijať; záporná hodnota nadobúda od konca.",
      },
    ],
  },
  {
    n: "TAN",
    d: "Vráti tangens uhla zadaného v radiánoch.",
    a: "Tangens uhla v radiánoch.",
    p: [
      {
        name: "číslo",
        detail: "Uhol v radiánoch.",
      },
    ],
  },
  {
    n: "TANH",
    d: "Vráti hyperbolický tangens čísla.",
    a: "Hyperbolický tangens.",
    p: [
      {
        name: "číslo",
        detail: "Akékoľvek reálne číslo.",
      },
    ],
  },
  {
    n: "TBILLEQ",
    d: "Vráti dlhopisový ekvivalent výnosu štátnej pokladničnej poukážky.",
    a: "Dlhopisový ekvivalent výnosu štátnej pokladničnej poukážky.",
    p: [
      {
        name: "dátum_vyrovnania",
        detail: "Dátum vyrovnania pokladničnej poukážky.",
      },
      {
        name: "dátum_splatnosti",
        detail: "Dátum splatnosti pokladničnej poukážky.",
      },
      {
        name: "diskontná_sadzba",
        detail: "Diskontná sadzba štátnej pokladničnej poukážky.",
      },
    ],
  },
  {
    n: "TBILLPRICE",
    d: "Vráti cenu za 100 USD menovitej hodnoty štátnej pokladničnej poukážky.",
    a: "Cena štátnej pokladničnej poukážky.",
    p: [
      {
        name: "dátum_vyrovnania",
        detail: "Dátum vyrovnania pokladničnej poukážky.",
      },
      {
        name: "dátum_splatnosti",
        detail: "Dátum splatnosti pokladničnej poukážky.",
      },
      {
        name: "diskontná_sadzba",
        detail: "Diskontná sadzba štátnej pokladničnej poukážky.",
      },
    ],
  },
  {
    n: "TBILLYIELD",
    d: "Vráti výnos štátnej pokladničnej poukážky.",
    a: "Výnos štátnej pokladničnej poukážky.",
    p: [
      {
        name: "dátum_vyrovnania",
        detail: "Dátum vyrovnania pokladničnej poukážky.",
      },
      {
        name: "dátum_splatnosti",
        detail: "Dátum splatnosti pokladničnej poukážky.",
      },
      {
        name: "cena",
        detail: "Cena pokladničnej poukážky za nominálnu hodnotu 100 USD.",
      },
    ],
  },
  {
    n: "TDIST",
    d: "Vráti percentuálne body (pravdepodobnosť) pre Studentovo t-rozdelenie. Zachované z dôvodu kompatibility; pozri T.DIST.RT a T.DIST.2T.",
    a: "Študentova t-distribúcia (kompatibilita).",
    p: [
      {
        name: "x",
        detail: "Číselná hodnota, pri ktorej sa má vyhodnotiť rozdelenie.",
      },
      {
        name: "stupne_voľnosti",
        detail: "Celé číslo označujúce počet stupňov voľnosti.",
      },
      {
        name: "počet_chvostov",
        detail: "Počet distribučných koncov, ktoré sa majú vrátiť: 1 alebo 2.",
      },
    ],
  },
  {
    n: "TEXT",
    d: "Konvertuje číselnú hodnotu na text a umožňuje vám určiť formátovanie zobrazenia pomocou špeciálnych formátovacích reťazcov.",
    a: "Formátuje číslo ako text.",
    p: [
      {
        name: "hodnota",
        detail: "Číselná hodnota, ktorú chcete previesť na text.",
      },
      {
        name: "formátovací_text",
        detail:
          "Textový reťazec, ktorý definuje formátovanie, ktoré chcete použiť na `hodnota`.",
      },
    ],
  },
  {
    n: "TEXTAFTER",
    d: "Vráti text, ktorý sa vyskytuje po danom znaku alebo reťazci.",
    a: "Text za oddeľovačom.",
    p: [
      {
        name: "text",
        detail: "Text, v ktorom hľadáte. Zástupné znaky nie sú povolené.",
      },
      {
        name: "oddeľovač",
        detail: "Text, ktorý označuje bod, za ktorým chcete extrahovať.",
      },
      {
        name: "inštancia_č",
        detail:
          "Inštancia oddeľovača, po ktorej chcete extrahovať text; záporné číslo hľadá od konca. Predvolená hodnota je 1.",
      },
      {
        name: "režim_zhody",
        detail:
          "0 (predvolené) rozlíši oddeľovač, 1 nerozlišuje malé a veľké písmená.",
      },
      {
        name: "zhoda_konca",
        detail:
          "1 považuje koniec textu za oddeľovač; predvolená hodnota je 0 (presná zhoda).",
      },
      {
        name: "ak_sa_nenájde",
        detail:
          "Hodnota vrátená, ak sa nenájde žiadna zhoda; predvolená hodnota je #N/A.",
      },
    ],
  },
  {
    n: "TEXTBEFORE",
    d: "Vráti text, ktorý sa vyskytuje pred daným znakom alebo reťazcom.",
    a: "Text pred oddeľovačom.",
    p: [
      {
        name: "text",
        detail: "Text, v ktorom hľadáte. Zástupné znaky nie sú povolené.",
      },
      {
        name: "oddeľovač",
        detail: "Text, ktorý označuje bod, pred ktorým chcete extrahovať.",
      },
      {
        name: "inštancia_č",
        detail:
          "Inštancia oddeľovača, pred ktorou chcete extrahovať text; záporné číslo hľadá od konca. Predvolená hodnota je 1.",
      },
      {
        name: "režim_zhody",
        detail:
          "0 (predvolené) rozlíši oddeľovač, 1 nerozlišuje malé a veľké písmená.",
      },
      {
        name: "zhoda_konca",
        detail:
          "1 považuje koniec textu za oddeľovač; predvolená hodnota je 0 (presná zhoda).",
      },
      {
        name: "ak_sa_nenájde",
        detail:
          "Hodnota vrátená, ak sa nenájde žiadna zhoda; predvolená hodnota je #N/A.",
      },
    ],
  },
  {
    n: "TEXTJOIN",
    d: "Kombinuje text z viacerých rozsahov a/alebo reťazcov a obsahuje oddeľovač, ktorý určíte medzi každou textovou hodnotou.",
    a: "Spája text pomocou oddeľovača.",
    p: [
      {
        name: "oddeľovač",
        detail:
          "Textový reťazec, buď prázdny, alebo jeden alebo viac znakov, vložený medzi každú textovú hodnotu.",
      },
      {
        name: "ignorovať_prázdne",
        detail: "Ak TRUE, ignoruje prázdne bunky.",
      },
      {
        name: "text_1",
        detail: "Prvá textová položka alebo rozsah, ktorý sa má spojiť.",
      },
      {
        name: "text2",
        detail:
          "Ďalšie textové položky alebo rozsahy, ktoré sa majú spojiť, celkovo až 252.",
      },
    ],
  },
  {
    n: "TEXTSPLIT",
    d: "Rozdeľuje textové reťazce pomocou oddeľovačov stĺpcov a riadkov.",
    a: "Rozdelí text do poľa.",
    p: [
      {
        name: "text",
        detail: "Text, ktorý chcete rozdeliť.",
      },
      {
        name: "oddeľovač_stĺpca",
        detail: "Text, ktorý označuje bod, kde sa má text rozliať cez stĺpce.",
      },
      {
        name: "oddeľovač_riadkov",
        detail:
          "Text, ktorý označuje miesto, kde sa má text rozsypať po riadkoch.",
      },
      {
        name: "ignorovať_prázdne",
        detail:
          "TRUE ignoruje po sebe idúce oddeľovače; FALSE alebo vynechané vytvorí prázdnu bunku.",
      },
      {
        name: "režim_zhody",
        detail:
          "0 (predvolené) vykoná zhodu s rozlišovaním malých a veľkých písmen, 1 nerozlišuje veľkosť písmen.",
      },
      {
        name: "doplniť_hodnotou",
        detail:
          "Hodnota, ktorou sa má doplniť výsledok; predvolená hodnota je #N/A.",
      },
    ],
  },
  {
    n: "TIME",
    d: "Vráti desatinné číslo pre konkrétny čas, od 0 (00:00:00) do 0,99988426 (23:59:59).",
    a: "Čas od hodiny, minúty a sekundy.",
    p: [
      {
        name: "hodina",
        detail:
          "Číslo od 0 do 32767 predstavujúce hodinu; hodnoty nad 23 sa delia 24.",
      },
      {
        name: "minúta",
        detail:
          "Číslo od 0 do 32767 predstavujúce minútu; hodnoty nad 59 prevrátiť do hodín.",
      },
      {
        name: "druhý",
        detail:
          "Číslo od 0 do 32767 predstavujúce druhú; hodnoty nad 59 sa preklopia do minút.",
      },
    ],
  },
  {
    n: "TIMEVALUE",
    d: "Vráti desatinné číslo času reprezentovaného textovým reťazcom.",
    a: "Konvertuje text času na číslo.",
    p: [
      {
        name: "čas_ako_text",
        detail:
          "Textový reťazec, ktorý predstavuje čas v rozpoznanom časovom formáte.",
      },
    ],
  },
  {
    n: "TINV",
    d: "Vráti obojstrannú inverziu Studentovho t-rozdelenia. Zachované z dôvodu kompatibility; pozri T.INV.2T.",
    a: "Inverzná dvojstranná t-distribúcia (kompatibilita).",
    p: [
      {
        name: "pravdepodobnosť",
        detail:
          "Pravdepodobnosť spojená s dvojstranným Studentovým t-rozdelením.",
      },
      {
        name: "stupne_voľnosti",
        detail: "Počet stupňov voľnosti.",
      },
    ],
  },
  {
    n: "TOCOL",
    d: "Vráti pole v jednom stĺpci.",
    a: "Zlúči pole do jedného stĺpca.",
    p: [
      {
        name: "pole",
        detail: "Pole alebo odkaz, ktorý sa má vrátiť ako stĺpec.",
      },
      {
        name: "ignorovať",
        detail:
          "Či sa majú ignorovať určité hodnoty: 0 ponechať všetky (predvolené), 1 ignorovať prázdne miesta, 2 ignorovať chyby, 3 ignorovať prázdne miesta a chyby.",
      },
      {
        name: "skenovanie_podľa_stĺpca",
        detail:
          "FALSE alebo vynechané prehľadá pole po riadkoch; TRUE skenuje podľa stĺpca.",
      },
    ],
  },
  {
    n: "TODAY",
    d: "Vráti poradové číslo aktuálneho dátumu. Aktualizuje sa pri každom výpočte hárku.",
    a: "Aktuálny dátum.",
    p: [],
  },
  {
    n: "TOROW",
    d: "Vráti pole v jednom riadku.",
    a: "Vyrovná pole do jedného riadku.",
    p: [
      {
        name: "pole",
        detail: "Pole alebo odkaz, ktorý sa má vrátiť ako riadok.",
      },
      {
        name: "ignorovať",
        detail:
          "Či sa majú ignorovať určité hodnoty: 0 ponechať všetky (predvolené), 1 ignorovať prázdne miesta, 2 ignorovať chyby, 3 ignorovať prázdne miesta a chyby.",
      },
      {
        name: "skenovanie_podľa_stĺpca",
        detail:
          "FALSE alebo vynechané prehľadá pole po riadkoch; TRUE skenuje podľa stĺpca.",
      },
    ],
  },
  {
    n: "TRANSPOSE",
    d: "Vráti vertikálny rozsah buniek ako horizontálny rozsah alebo naopak.",
    a: "Vymení riadky a stĺpce.",
    p: [
      {
        name: "pole",
        detail:
          "Pole alebo rozsah buniek na pracovnom hárku, ktorý chcete transponovať.",
      },
    ],
  },
  {
    n: "TREND",
    d: "Vráti hodnoty pozdĺž lineárneho trendu a prispôsobí priamku known_y a known_x pomocou metódy najmenších štvorcov.",
    a: "Hodnoty pozdĺž lineárneho trendu.",
    p: [
      {
        name: "známe_y",
        detail:
          "Množina y-ových hodnôt, ktoré už poznáte vo vzťahu y = mx + b.",
      },
      {
        name: "známe_x",
        detail: "Voliteľný súbor x-hodnôt, ktoré už možno poznáte.",
      },
      {
        name: "nové_x",
        detail:
          "Nové hodnoty x, pre ktoré chcete, aby TREND vrátilo zodpovedajúce hodnoty y.",
      },
      {
        name: "konšt",
        detail:
          "TRUE alebo vynechané vypočíta b normálne; FALSE prinúti b, aby sa rovnalo 0.",
      },
    ],
  },
  {
    n: "TRIM",
    d: "Odstráni z textu všetky medzery okrem jednotlivých medzier medzi slovami.",
    a: "Odstráni nadbytočné medzery.",
    p: [
      {
        name: "text",
        detail: "Text, z ktorého chcete odstrániť medzery.",
      },
    ],
  },
  {
    n: "TRIMMEAN",
    d: "Vráti strednú hodnotu vnútra množiny údajov s vylúčením percenta údajových bodov z hornej a dolnej časti.",
    a: "Priemer bez odľahlých hodnôt.",
    p: [
      {
        name: "pole",
        detail: "Pole alebo rozsah hodnôt na orezanie a priemer.",
      },
      {
        name: "percento",
        detail:
          "Zlomkový počet dátových bodov, ktoré sa majú vylúčiť z výpočtu.",
      },
    ],
  },
  {
    n: "TRIMRANGE",
    d: "Vylúči všetky prázdne riadky a/alebo stĺpce z vonkajších okrajov rozsahu alebo poľa.",
    a: "Orezáva prázdne okraje z rozsahu.",
    p: [
      {
        name: "rozsah",
        detail: "Rozsah alebo pole, ktoré sa má orezať.",
      },
      {
        name: "orezanie_riadkov",
        detail:
          "Ktoré riadky orezať: 0 žiadny, 1 prázdny riadok na začiatku, 2 prázdne riadky na konci, 3 oba (predvolené).",
      },
      {
        name: "orezanie_stĺpcov",
        detail:
          "Ktoré stĺpce orezať: 0 žiadny, 1 prázdny stĺpec na začiatku, 2 prázdne stĺpce na konci, 3 oba (predvolené).",
      },
    ],
  },
  {
    n: "TRUE",
    d: "Vráti logickú hodnotu TRUE.",
    a: "Logická hodnota TRUE.",
    p: [],
  },
  {
    n: "TRUNC",
    d: "Skráti číslo na celé číslo (alebo na danú presnosť) odstránením zlomkovej časti.",
    a: "Skráti číslo.",
    p: [
      {
        name: "číslo",
        detail: "Číslo, ktoré chcete skrátiť.",
      },
      {
        name: "počet_číslic",
        detail: "Presnosť skrátenia; predvolene je 0.",
      },
    ],
  },
  {
    n: "TTEST",
    d: "Vráti pravdepodobnosť spojenú so Studentovým t-testom. Zachované z dôvodu kompatibility; pozri T.TEST.",
    a: "Pravdepodobnosť z t-testu (starosť).",
    p: [
      {
        name: "pole1",
        detail: "Prvý súbor údajov.",
      },
      {
        name: "pole2",
        detail: "Druhý súbor údajov.",
      },
      {
        name: "počet_chvostov",
        detail: "Počet distribučných chvostov: 1 jednostranný, 2 dvojstranný.",
      },
      {
        name: "typ",
        detail:
          "Druh testu: 1 párový, 2 dvojvýberový rovnaký rozptyl, 3 dvojvýberový nerovnaký rozptyl.",
      },
    ],
  },
  {
    n: "TYPE",
    d: "Vráti typ hodnoty: 1 číslo, 2 text, 4 logická hodnota, 16 chybová hodnota, 64 pole.",
    a: "Typ hodnoty.",
    p: [
      {
        name: "hodnota",
        detail: "Akákoľvek hodnota, ako je číslo, text alebo logická hodnota.",
      },
    ],
  },
  {
    n: "UNICHAR",
    d: "Vráti znak Unicode, na ktorý odkazuje daná číselná hodnota.",
    a: "Znak Unicode z bodu kódu.",
    p: [
      {
        name: "číslo",
        detail: "Číslo Unicode, ktoré predstavuje znak.",
      },
    ],
  },
  {
    n: "UNICODE",
    d: "Vráti číslo (bod kódu) zodpovedajúce prvému znaku textu.",
    a: "Kódový bod prvého znaku.",
    p: [
      {
        name: "text",
        detail: "Znak, pre ktorý chcete hodnotu Unicode.",
      },
    ],
  },
  {
    n: "UNIQUE",
    d: "Vráti zoznam jedinečných hodnôt v zozname alebo rozsahu.",
    a: "Jedinečné hodnoty rozsahu.",
    p: [
      {
        name: "pole",
        detail:
          "Rozsah alebo pole, z ktorého sa majú vrátiť jedinečné riadky alebo stĺpce.",
      },
      {
        name: "podľa_stĺpcov",
        detail:
          "FALSE alebo vynechané porovnáva riadky navzájom; TRUE porovnáva stĺpce.",
      },
      {
        name: "presne_raz",
        detail:
          "TRUE vráti iba riadky alebo stĺpce, ktoré sa vyskytujú práve raz; FALSE alebo vynechané vráti všetky odlišné.",
      },
    ],
  },
  {
    n: "UPPER",
    d: "Konvertuje text na veľké písmená.",
    a: "Konvertuje text na veľké písmená.",
    p: [
      {
        name: "text",
        detail: "Text, ktorý chcete previesť na veľké písmená.",
      },
    ],
  },
  {
    n: "VALUE",
    d: "Konvertuje textový reťazec, ktorý predstavuje číslo, na číslo.",
    a: "Konvertuje text na číslo.",
    p: [
      {
        name: "text",
        detail:
          "Text uzavretý v úvodzovkách alebo odkaz na bunku obsahujúcu text, ktorý chcete previesť.",
      },
    ],
  },
  {
    n: "VALUETOTEXT",
    d: "Vráti text z ľubovoľnej zadanej hodnoty. Textové hodnoty odovzdáva nezmenené a konvertuje netextové hodnoty na text.",
    a: "Skonvertuje hodnotu na text.",
    p: [
      {
        name: "hodnota",
        detail: "Hodnota, ktorá sa má vrátiť ako text.",
      },
      {
        name: "formát",
        detail:
          "0 alebo vynechaný vráti stručný, ľahko čitateľný formát; 1 vráti striktný formát s únikovými znakmi, ktoré možno analyzovať ako vzorec.",
      },
    ],
  },
  {
    n: "VAR.P",
    d: "Vypočíta rozptyl na základe celej populácie, ignoruje logické hodnoty a text.",
    a: "Populačný rozptyl.",
    p: [
      {
        name: "číslo1",
        detail: "Prvé číslo alebo rozsah zodpovedajúci populácii.",
      },
      {
        name: "číslo2",
        detail: "Ďalšie čísla alebo rozsahy, celkovo až 254.",
      },
    ],
  },
  {
    n: "VAR.S",
    d: "Odhaduje rozptyl na základe vzorky, ignoruje logické hodnoty a text.",
    a: "Výberový rozptyl.",
    p: [
      {
        name: "číslo1",
        detail: "Prvé číslo alebo rozsah zodpovedajúci vzorke populácie.",
      },
      {
        name: "číslo2",
        detail: "Ďalšie čísla alebo rozsahy, celkovo až 254.",
      },
    ],
  },
  {
    n: "VARA",
    d: "Odhaduje rozptyl na základe vzorky, pričom text hodnotí ako 0 a logické hodnoty ako 1 alebo 0.",
    a: "Výberový rozptyl vrátane textu a logických hodnôt.",
    p: [
      {
        name: "hodnota1",
        detail: "Prvá hodnota alebo rozsah zodpovedajúci vzorke populácie.",
      },
      {
        name: "hodnota2",
        detail: "Ďalšie hodnoty alebo rozsahy, celkovo až 255.",
      },
    ],
  },
  {
    n: "VARP",
    d: "Vypočíta rozptyl na základe celej populácie. Zachované z dôvodu kompatibility; pozri VAR.P.",
    a: "Rozptyl populácie (starosť).",
    p: [
      {
        name: "číslo1",
        detail: "Prvé číslo alebo rozsah zodpovedajúci populácii.",
      },
      {
        name: "číslo2",
        detail: "Ďalšie čísla alebo rozsahy, celkovo až 255.",
      },
    ],
  },
  {
    n: "VARPA",
    d: "Vypočíta rozptyl na základe celej populácie, pričom text vyhodnotí ako 0 a logické hodnoty ako 1 alebo 0.",
    a: "Rozptyl populácie vrátane textu a logiky.",
    p: [
      {
        name: "hodnota1",
        detail: "Prvá hodnota alebo rozsah zodpovedajúci populácii.",
      },
      {
        name: "hodnota2",
        detail: "Ďalšie hodnoty alebo rozsahy, celkovo až 255.",
      },
    ],
  },
  {
    n: "VDB",
    d: "Vráti odpis majetku za ľubovoľné obdobie vrátane čiastkových období pomocou metódy dvojitého klesajúceho zostatku alebo inej metódy, ktorú určíte.",
    a: "Variabilné klesajúce odpisy.",
    p: [
      {
        name: "obstarávacia_cena",
        detail: "Počiatočná obstarávacia cena majetku.",
      },
      {
        name: "zostatková_hodnota",
        detail: "Hodnota na konci odpisovania.",
      },
      {
        name: "životnosť",
        detail: "Počet období, počas ktorých sa majetok odpisuje.",
      },
      {
        name: "počiatočné_obdobie",
        detail: "Začiatočné obdobie odpisovania.",
      },
      {
        name: "koniec_obdobia",
        detail: "Konečné obdobie odpisovania.",
      },
      {
        name: "faktor",
        detail:
          "Rýchlosť, ktorou zostatok klesá; predvolená hodnota 2 (dvojité klesajúce).",
      },
      {
        name: "bez_zmeny_metódy",
        detail: "TRUE nikdy neprepnúť na rovnomerné odpisovanie.",
      },
    ],
  },
  {
    n: "VLOOKUP",
    d: "Vyhľadá hodnotu v ľavom stĺpci tabuľky a vráti hodnotu v rovnakom riadku zo stĺpca, ktorý určíte.",
    a: "Vertikálne vyhľadávanie.",
    p: [
      {
        name: "hľadaná_hodnota",
        detail:
          "Hodnota, ktorú chcete vyhľadať; musí byť v prvom stĺpci `pole_tabuľky`.",
      },
      {
        name: "pole_tabuľky",
        detail:
          "Rozsah buniek, v ktorých bude VLOOKUP hľadať `hľadaná_hodnota`, a vrátená hodnota.",
      },
      {
        name: "index_stĺpca",
        detail:
          "Číslo stĺpca (začínajúc 1 pre stĺpec úplne vľavo `pole_tabuľky`), ktorý obsahuje vrátenú hodnotu.",
      },
      {
        name: "približná_zhoda",
        detail:
          "TRUE alebo vynechané nájde približnú zhodu; FALSE nájde presnú zhodu.",
      },
    ],
  },
  {
    n: "VSTACK",
    d: "Pridáva polia vertikálne a postupne, aby sa vrátilo väčšie pole.",
    a: "Ukladá polia na seba.",
    p: [
      {
        name: "pole1",
        detail: "Prvé pole na pripojenie.",
      },
      {
        name: "pole2",
        detail: "Ďalšie polia na pripojenie.",
      },
    ],
  },
  {
    n: "WEEKDAY",
    d: "Predvolene vráti deň v týždni zodpovedajúci dátumu ako celé číslo od 1 (nedeľa) do 7 (sobota).",
    a: "Deň v týždni.",
    p: [
      {
        name: "poradové_číslo",
        detail:
          "Poradové číslo, ktoré predstavuje dátum dňa, ktorý sa snažíte nájsť.",
      },
      {
        name: "návratový_typ",
        detail:
          "Číslo, ktoré určuje číslovanie: 1 alebo vynechané nedeľa=1, 2 pondelok=1, 3 pondelok=0, 11 až 17 týždňov počnúc od pondelka do nedele.",
      },
    ],
  },
  {
    n: "WEEKNUM",
    d: "Vráti číslo týždňa konkrétneho dátumu.",
    a: "Číslo týždňa v roku.",
    p: [
      {
        name: "poradové_číslo",
        detail: "Dátum v týždni.",
      },
      {
        name: "návratový_typ",
        detail:
          "Deň, ktorým sa týždeň začína: 1 alebo vynechaná nedeľa, 2 pondelok, 11 až 17 pondelok až nedeľa, 21 ISO 8601.",
      },
    ],
  },
  {
    n: "WEIBULL",
    d: "Vráti Weibullovu distribúciu.",
    a: "Weibullova distribúcia (kompatibilita).",
    p: [
      {
        name: "x",
        detail: "Hodnota, pri ktorej sa má funkcia vyhodnotiť.",
      },
      {
        name: "alfa",
        detail: "Parameter distribúcie.",
      },
      {
        name: "beta",
        detail: "Parameter distribúcie.",
      },
      {
        name: "kumulatívne",
        detail: "TRUE pre kumulatívne rozdelenie, FALSE pre hustotu.",
      },
    ],
  },
  {
    n: "WEIBULL.DIST",
    d: "Vráti Weibullovo rozdelenie, bežne používané v analýze spoľahlivosti.",
    a: "Weibullova distribúcia.",
    p: [
      {
        name: "x",
        detail: "Hodnota, pri ktorej sa má funkcia vyhodnotiť.",
      },
      {
        name: "alfa",
        detail: "Parameter distribúcie.",
      },
      {
        name: "beta",
        detail: "Parameter distribúcie.",
      },
      {
        name: "kumulatívne",
        detail:
          "TRUE vráti funkciu kumulatívneho rozdelenia, FALSE funkciu hustoty pravdepodobnosti.",
      },
    ],
  },
  {
    n: "WORKDAY",
    d: "Vráti poradové číslo dátumu pred alebo po zadanom počte pracovných dní, okrem víkendov a sviatkov.",
    a: "Dátum o niekoľko pracovných dní.",
    p: [
      {
        name: "dátum_začiatku",
        detail: "Dátum, ktorý predstavuje počiatočný dátum.",
      },
      {
        name: "dni",
        detail:
          "Počet dní mimo víkendu a sviatkov pred alebo po `dátum_začiatku`.",
      },
      {
        name: "sviatky",
        detail:
          "Voliteľný rozsah jedného alebo viacerých dátumov na vylúčenie z pracovného kalendára.",
      },
    ],
  },
  {
    n: "WORKDAY.INTL",
    d: "Vráti poradové číslo dátumu pred alebo po zadanom počte pracovných dní s vlastnými parametrami víkendu.",
    a: "Dátum posunutý o počet pracovných dní s voliteľným nastavením víkendu.",
    p: [
      {
        name: "dátum_začiatku",
        detail: "Dátum začiatku.",
      },
      {
        name: "dni",
        detail: "Počet pracovných dní pred alebo po `dátum_začiatku`.",
      },
      {
        name: "víkend",
        detail:
          'Víkendové číslo (1 sobota – nedeľa, 2 nedeľa – pondelok, ..., iba nedeľa 11, ..., iba 17 sobota) alebo reťazec so siedmimi znakmi, napríklad "0000011".',
      },
      {
        name: "sviatky",
        detail:
          "Voliteľný súbor jedného alebo viacerých dátumov na vylúčenie z pracovného kalendára.",
      },
    ],
  },
  {
    n: "WRAPCOLS",
    d: "Zabalí poskytnutý riadok alebo stĺpec hodnôt do stĺpcov po zadanom počte prvkov, čím vytvorí nové pole.",
    a: "Zabalí vektor do stĺpcov.",
    p: [
      {
        name: "vektor",
        detail: "Vektor alebo odkaz na obal.",
      },
      {
        name: "počet_pred_zalomením",
        detail: "Maximálny počet hodnôt pre každý stĺpec.",
      },
      {
        name: "doplniť_hodnotou",
        detail: "Hodnota, ktorou sa má vyplniť; predvolená hodnota je #N/A.",
      },
    ],
  },
  {
    n: "WRAPROWS",
    d: "Zabalí poskytnutý riadok alebo stĺpec hodnôt do riadkov po zadanom počte prvkov, čím vytvorí nové pole.",
    a: "Zabalí vektor do riadkov.",
    p: [
      {
        name: "vektor",
        detail: "Vektor alebo odkaz na obal.",
      },
      {
        name: "počet_pred_zalomením",
        detail: "Maximálny počet hodnôt pre každý riadok.",
      },
      {
        name: "doplniť_hodnotou",
        detail: "Hodnota, ktorou sa má vyplniť; predvolená hodnota je #N/A.",
      },
    ],
  },
  {
    n: "XIRR",
    d: "Vráti vnútornú mieru návratnosti pre plán peňažných tokov, ktorý nemusí byť nutne periodický.",
    a: "IRR nepravidelných peňažných tokov.",
    p: [
      {
        name: "hodnoty",
        detail:
          "Séria peňažných tokov, ktorá zodpovedá rozvrhu platieb v `dátumy`.",
      },
      {
        name: "dátumy",
        detail:
          "Rozpis dátumov platieb, ktorý zodpovedá platbám v peňažnom toku.",
      },
      {
        name: "odhad",
        detail:
          "Číslo, ktoré uhádnete, je blízko výsledku; predvolená hodnota je 0,1 (10 percent).",
      },
    ],
  },
  {
    n: "XLOOKUP",
    d: "Vyhľadá rozsah alebo pole a vráti položku zodpovedajúcu prvej nájdenej zhode. Ak neexistuje žiadna zhoda, XLOOKUP môže vrátiť najbližšiu (približnú) zhodu.",
    a: "Vyhľadá hodnotu a vráti zhodu.",
    p: [
      {
        name: "hľadaná_hodnota",
        detail: "Hodnota, ktorú treba vyhľadať.",
      },
      {
        name: "vyhľadávacie_pole",
        detail: "Pole alebo rozsah na vyhľadávanie.",
      },
      {
        name: "návratové_pole",
        detail: "Pole alebo rozsah, ktorý sa má vrátiť.",
      },
      {
        name: "ak_sa_nenájde",
        detail:
          "Hodnota, ktorá sa má vrátiť, ak sa nenájde žiadna platná zhoda; predvolená hodnota je #N/A.",
      },
      {
        name: "režim_zhody",
        detail:
          "0 presná zhoda (predvolené), -1 presná zhoda alebo nasledujúca menšia položka, 1 presná zhoda alebo nasledujúca väčšia položka, 2 zhoda zástupných znakov, 3 zhoda regulárneho výrazu.",
      },
      {
        name: "režim_vyhľadávania",
        detail:
          "1 vyhľadávanie od prvého do posledného (predvolené), -1 od posledného po prvé, 2 binárne vyhľadávanie vzostupne, -2 binárne vyhľadávanie zostupne.",
      },
    ],
  },
  {
    n: "XMATCH",
    d: "Vyhľadá špecifikovanú položku v poli alebo rozsahu buniek a vráti relatívnu pozíciu položky.",
    a: "Pozícia hodnoty v rozsahu.",
    p: [
      {
        name: "hľadaná_hodnota",
        detail: "Hodnota, ktorú treba vyhľadať.",
      },
      {
        name: "vyhľadávacie_pole",
        detail: "Pole alebo rozsah na vyhľadávanie.",
      },
      {
        name: "režim_zhody",
        detail:
          "0 presná zhoda (predvolené), -1 presná zhoda alebo nasledujúca menšia položka, 1 presná zhoda alebo nasledujúca väčšia položka, 2 zhoda zástupných znakov, 3 zhoda regulárneho výrazu.",
      },
      {
        name: "režim_vyhľadávania",
        detail:
          "1 vyhľadávanie od prvého do posledného (predvolené), -1 od posledného po prvé, 2 binárne vyhľadávanie vzostupne, -2 binárne vyhľadávanie zostupne.",
      },
    ],
  },
  {
    n: "XNPV",
    d: "Vráti čistú súčasnú hodnotu pre rozvrh peňažných tokov, ktorý nemusí byť nutne periodický.",
    a: "NPV nepravidelných peňažných tokov.",
    p: [
      {
        name: "sadzba",
        detail: "Diskontná sadzba, ktorá sa má použiť na peňažné toky.",
      },
      {
        name: "hodnoty",
        detail:
          "Séria peňažných tokov, ktorá zodpovedá rozvrhu platieb v `dátumy`.",
      },
      {
        name: "dátumy",
        detail:
          "Rozpis dátumov platieb, ktorý zodpovedá platbám v peňažnom toku.",
      },
    ],
  },
  {
    n: "XOR",
    d: "Vráti logický exkluzívny OR všetkých argumentov: TRUE, keď je nepárny počet argumentov TRUE.",
    a: "Exkluzívne OR argumentov.",
    p: [
      {
        name: "logický1",
        detail:
          "Prvá podmienka na testovanie, ktorá môže byť vyhodnotená ako TRUE alebo FALSE.",
      },
      {
        name: "logický2",
        detail: "Ďalšie podmienky na testovanie, celkovo až 254.",
      },
    ],
  },
  {
    n: "YEAR",
    d: "Vráti rok zodpovedajúci dátumu ako celé číslo v rozsahu 1900 až 9999.",
    a: "Rok dátumu.",
    p: [
      {
        name: "poradové_číslo",
        detail: "Dátum v roku, ktorý chcete nájsť.",
      },
    ],
  },
  {
    n: "YEARFRAC",
    d: "Vypočíta časť roka reprezentovanú počtom celých dní medzi dvoma dátumami.",
    a: "Zlomok roka medzi dátumami.",
    p: [
      {
        name: "dátum_začiatku",
        detail: "Dátum, ktorý predstavuje počiatočný dátum.",
      },
      {
        name: "dátum_ukončenia",
        detail: "Dátum, ktorý predstavuje dátum ukončenia.",
      },
      {
        name: "základňa",
        detail:
          "Základ počtu dní: 0 alebo vynechané US 30/360, 1 skutočný/aktuálny, 2 skutočné/360, 3 skutočné/365, 4 európske 30/360.",
      },
    ],
  },
  {
    n: "YIELD",
    d: "Vráti výnos z cenného papiera, z ktorého sa pravidelne úročí.",
    a: "Výnos cenného papiera s periodickým úrokom.",
    p: [
      {
        name: "dátum_vyrovnania",
        detail: "Dátum vyrovnania cenného papiera.",
      },
      {
        name: "dátum_splatnosti",
        detail: "Dátum splatnosti cenného papiera.",
      },
      {
        name: "sadzba",
        detail: "Ročná kupónová sadzba cenného papiera.",
      },
      {
        name: "cena",
        detail: "Cena cenného papiera za nominálnu hodnotu 100 $.",
      },
      {
        name: "výkupná_hodnota",
        detail: "Výkupná hodnota cenného papiera na 100 $ nominálnej hodnoty.",
      },
      {
        name: "frekvencia",
        detail:
          "Počet výplat kupónov za rok: 1 ročná, 2 polročné, 4 štvrťročné.",
      },
      {
        name: "základňa",
        detail:
          "Základ počtu dní: 0 alebo vynechané US 30/360, 1 skutočný/aktuálny, 2 skutočné/360, 3 skutočné/365, 4 európske 30/360.",
      },
    ],
  },
  {
    n: "YIELDDISC",
    d: "Vráti ročný výnos pre diskontovaný cenný papier.",
    a: "Výnos diskontovaného cenného papiera.",
    p: [
      {
        name: "dátum_vyrovnania",
        detail: "Dátum vyrovnania cenného papiera.",
      },
      {
        name: "dátum_splatnosti",
        detail: "Dátum splatnosti cenného papiera.",
      },
      {
        name: "cena",
        detail: "Cena cenného papiera za nominálnu hodnotu 100 $.",
      },
      {
        name: "výkupná_hodnota",
        detail: "Výkupná hodnota cenného papiera na 100 $ nominálnej hodnoty.",
      },
      {
        name: "základňa",
        detail:
          "Základ počtu dní: 0 alebo vynechané US 30/360, 1 skutočný/aktuálny, 2 skutočné/360, 3 skutočné/365, 4 európske 30/360.",
      },
    ],
  },
  {
    n: "YIELDMAT",
    d: "Vráti ročný výnos cenného papiera, ktorý platí úrok pri splatnosti.",
    a: "Výnos cenného papiera vyplácaného pri splatnosti.",
    p: [
      {
        name: "dátum_vyrovnania",
        detail: "Dátum vyrovnania cenného papiera.",
      },
      {
        name: "dátum_splatnosti",
        detail: "Dátum splatnosti cenného papiera.",
      },
      {
        name: "dátum_emisie",
        detail: "Dátum vydania cenného papiera.",
      },
      {
        name: "sadzba",
        detail: "Úroková sadzba cenného papiera k dátumu emisie.",
      },
      {
        name: "cena",
        detail: "Cena cenného papiera za nominálnu hodnotu 100 $.",
      },
      {
        name: "základňa",
        detail:
          "Základ počtu dní: 0 alebo vynechané US 30/360, 1 skutočný/aktuálny, 2 skutočné/360, 3 skutočné/365, 4 európske 30/360.",
      },
    ],
  },
  {
    n: "Z.TEST",
    d: "Vráti jednostrannú P-hodnotu z-testu.",
    a: "Jednostranná P-hodnota z-testu.",
    p: [
      {
        name: "pole",
        detail: "Pole alebo rozsah údajov, voči ktorým sa má testovať `x`.",
      },
      {
        name: "x",
        detail: "Hodnota na testovanie.",
      },
      {
        name: "sigma",
        detail:
          "Populačná (známa) štandardná odchýlka; ak sa vynechá, použije sa štandardná odchýlka vzorky.",
      },
    ],
  },
  {
    n: "ZTEST",
    d: "Vráti jednostrannú P-hodnotu z-testu. Zachované z dôvodu kompatibility; pozri Z.TEST.",
    a: "Jednostranný z-test P-hodnota (starosť).",
    p: [
      {
        name: "pole",
        detail: "Pole alebo rozsah údajov, voči ktorým sa má testovať `x`.",
      },
      {
        name: "x",
        detail: "Hodnota na testovanie.",
      },
      {
        name: "sigma",
        detail:
          "Populačná (známa) štandardná odchýlka; ak sa vynechá, použije sa štandardná odchýlka vzorky.",
      },
    ],
  },
  {
    n: "MODE",
    d: "Vráti najčastejšie sa vyskytujúcu hodnotu v množine údajov. Zachované z dôvodu kompatibility; pozri MODE.SNGL.",
    a: "Najbežnejšia hodnota (kompatibilita).",
    p: [
      {
        name: "číslo1",
        detail: "Prvé číslo alebo rozsah na vyhodnotenie.",
      },
      {
        name: "číslo2",
        detail: "Ďalšie čísla alebo rozsahy, celkovo až 254.",
      },
    ],
  },
  {
    n: "STDEV",
    d: "Odhaduje štandardnú odchýlku na základe vzorky. Zachované z dôvodu kompatibility; pozri STDEV.S.",
    a: "Výberová smerodajná odchýlka (kompatibilita).",
    p: [
      {
        name: "číslo1",
        detail: "Prvé číslo alebo rozsah zodpovedajúci vzorke populácie.",
      },
      {
        name: "číslo2",
        detail: "Ďalšie čísla alebo rozsahy, celkovo až 254.",
      },
    ],
  },
  {
    n: "VAR",
    d: "Odhaduje rozptyl na základe vzorky. Zachované z dôvodu kompatibility; pozri VAR.S.",
    a: "Výberový rozptyl (kompatibilita).",
    p: [
      {
        name: "číslo1",
        detail: "Prvé číslo alebo rozsah zodpovedajúci vzorke populácie.",
      },
      {
        name: "číslo2",
        detail: "Ďalšie čísla alebo rozsahy, celkovo až 254.",
      },
    ],
  },
  {
    n: "RANK",
    d: "Vráti poradie čísla v zozname čísel. Zachované z dôvodu kompatibility; pozri RANK.EQ.",
    a: "Poradie čísla (kompatibilita).",
    p: [
      {
        name: "číslo",
        detail: "Číslo, ktorého hodnosť chcete nájsť.",
      },
      {
        name: "odkaz",
        detail: "Zoznam čísel; nečíselné hodnoty sa ignorujú.",
      },
      {
        name: "poradie",
        detail:
          "0 alebo vynechané poradia v zostupnom poradí; akákoľvek iná hodnota sa radí vzostupne.",
      },
    ],
  },
  {
    n: "PERCENTILE",
    d: "Vráti k-tý percentil hodnôt v rozsahu. Zachované z dôvodu kompatibility; pozri PERCENTILE.INC.",
    a: "k-tý percentil (kompatibilita).",
    p: [
      {
        name: "pole",
        detail:
          "Pole alebo rozsah údajov, ktoré definujú relatívne postavenie.",
      },
      {
        name: "k",
        detail: "Hodnota percentilu v rozsahu 0 až 1 vrátane.",
      },
    ],
  },
  {
    n: "QUARTILE",
    d: "Vráti kvartil súboru údajov. Zachované z dôvodu kompatibility; pozri QUARTILE.INC.",
    a: "Kvartil súboru údajov (starosť).",
    p: [
      {
        name: "pole",
        detail: "Pole alebo rozsah číselných hodnôt.",
      },
      {
        name: "kvartil",
        detail:
          "Akú hodnotu vrátiť: 0 minimum, 1 prvý kvartil, 2 medián, 3 tretí kvartil, 4 maximum.",
      },
    ],
  },
];

export default translations;
