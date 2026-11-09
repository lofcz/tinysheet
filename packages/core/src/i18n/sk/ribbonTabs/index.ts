import type { NamespaceRibbonTabsTranslation } from "../../i18n-types";

const sk = {
  insert: {
    pivotTable: "Kontingenčná tabuľka",
    pivotTableTip:
      "Usporiadajte a sumarizujte komplexné údaje v kontingenčnej tabuľke.",
    table: "Tabuľka",
    tableTip:
      "Vytvorte tabuľku na usporiadanie a analýzu súvisiacich dát. Tabuľky ľahko triedia, filtrujú a formátujú údaje.",
    pictures: "Obrázky",
    picturesTip: "Vložte obrázky do bunky alebo cez bunky listu.",
    placeInCell: "Umiestniť do bunky",
    placeOverCells: "Umiestniť nad bunky",
    thisDevice: "Toto zariadenie…",
    fromWeb: "Z webovej adresy...",
    shapes: "Tvary",
    shapesTip:
      "Vložte hotové tvary, ako sú kruhy, štvorce a šípky. Vyberte jeden a potom ho potiahnutím na hárku nakreslite.",
    screenshot: "Snímka obrazovky",
    screenshotTip: "Odfoťte vybrané bunky.",
    recommendedCharts: "Odporúčané grafy",
    recommendedChartsTip:
      "Chcete, aby sme vám odporučili dobrý graf na prezentáciu vašich údajov? Vyberte údaje v pracovnom hárku a kliknite na toto tlačidlo.",
    chartColumn: "Vložiť stĺpcový alebo stĺpcový graf",
    chartColumnTip:
      "Použite tento typ grafu na vizuálne porovnanie hodnôt v niekoľkých kategóriách.",
    chartLine: "Vložiť čiarový alebo plošný graf",
    chartLineTip:
      "Tento typ grafu použite na zobrazenie trendov v čase (roky, mesiace a dni) alebo kategórií.",
    chartPie: "Vložte koláčový alebo donutový graf",
    chartPieTip:
      "Použite tento typ grafu na zobrazenie proporcií celku. Použite ho, keď súčet vašich čísel je 100 %.",
    chartScatter: "Vložte bodový (X, Y) alebo bublinový graf",
    chartScatterTip:
      "Použite tento typ grafu na zobrazenie vzťahu medzi súbormi hodnôt.",
    chartOther:
      "Vložiť vodopádový, štatistický, burzový, lúčový alebo kombinovaný graf",
    chartOtherTip:
      "Použite tieto typy grafov na zobrazenie priebežných súčtov, distribúcií, údajov o akciách, niekoľkých meraní alebo zmiešaných sérií.",
    moreCharts: "Ďalšie grafy…",
    galleryGroups: {
      column2d: "Dvojrozmerný stĺpcový",
      bar2d: "Dvojrozmerný pruhový",
      line2d: "Dvojrozmerný čiarový",
      area2d: "Dvojrozmerný plošný",
      pie2d: "Dvojrozmerný koláčový",
      doughnut: "Prstencový",
      scatter: "Bodový",
      bubble: "Bublinový",
      statistic: "Štatistika",
      waterfall: "Vodopád a lievik",
      stock: "Burzový",
      radar: "Lúčový",
      combo: "Kombinovaný",
    },
    sparkLine: "Čiara",
    sparkLineTip: "Vložte čiarový graf do jednej bunky.",
    sparkColumn: "Stĺpec",
    sparkColumnTip: "Vložiť stĺpcový graf do jednej bunky.",
    sparkWinLoss: "Zisk/strata",
    sparkWinLossTip: "Vložte graf výhry/prehry do jednej bunky.",
    slicer: "Rýchly filter",
    slicerTip:
      "Pomocou rýchleho filtra môžete údaje filtrovať vizuálne. Rýchle filtre uľahčujú a zrýchľujú filtrovanie tabuliek.",
    link: "Odkaz",
    linkTip:
      "Vytvorte odkaz vo svojom dokumente na rýchly prístup k webovým stránkam a iným miestam v zošite.",
    comment: "Komentár",
    commentTip: "Začať konverzáciu o vybranej bunke.",
    note: "Poznámka",
    noteTip: "Pridajte poznámku k vybranej bunke.",
    editNote: "Upraviť poznámku",
    textBox: "Textové pole",
    textBoxTip: "Nakreslite textové pole kdekoľvek na hárku.",
    headerFooter: "Hlavička a päta",
    headerFooterTip:
      "Upravte hlavičku alebo pätu stránky. Hlavička a päta sa zobrazia v hornej a dolnej časti každej vytlačenej strany.",
    checkbox: "Začiarkavacie políčko",
    checkboxTip:
      "Vložiť začiarkavacie políčka do vybratých buniek. Začiarknuté je TRUE, nezačiarknuté je FALSE.",
    removeCheckbox: "Odstráňte začiarkavacie políčka vybratých buniek.",
  },
  chartDialog: {
    title: "Vložiť graf",
    recommended: "Odporúčané grafy",
    all: "Všetky grafy",
    ok: "OK",
    cancel: "Zrušiť",
    preview: "Ukážka",
    noData: "Vyberte údaje pre graf a skúste to znova.",
    families: {
      column: "Stĺpec",
      line: "Čiara",
      pie: "Koláčový",
      bar: "Pruhový",
      area: "Plošný",
      scatter: "XY (bodový)",
      stock: "Burzový",
      radar: "Lúčový",
      histogram: "Histogram",
      waterfall: "Vodopádový",
      funnel: "Lievikový",
      combo: "Kombinovaný",
    },
    descriptions: {
      columnClustered:
        "Zhlukovaný stĺpcový graf sa používa na porovnanie hodnôt v niekoľkých kategóriách. Použite ho, keď poradie kategórií nie je dôležité.",
      columnStacked:
        "Skladaný stĺpcový graf sa používa na porovnanie častí celku. Použite ho na zobrazenie toho, ako sa mení súčet medzi kategóriami.",
      columnPercent:
        "100% skladaný stĺpcový graf porovnáva percentuálny podiel, ktorým každá hodnota prispieva k súčtu v rámci kategórií.",
      barClustered:
        "Skupinový pruhový graf porovnáva hodnoty niekoľkých kategórií. Je vhodný pre dlhé názvy kategórií.",
      barStacked:
        "Skladaný stĺpcový graf sa používa na porovnanie častí celku v kategóriách s dlhými názvami.",
      barPercent:
        "100 % skladaný pruhový graf porovnáva percentuálny podiel jednotlivých hodnôt na celku.",
      line: "Čiarový graf sa používa na zobrazenie trendov v čase (roky, mesiace a dni) alebo kategórií, keď je poradie dôležité.",
      lineMarkers:
        "Čiarový graf so značkami sa používa na zobrazenie trendov, keď existuje len niekoľko údajových bodov.",
      lineStacked:
        "Skladaný čiarový graf ukazuje, ako každá časť v priebehu času prispieva k súčtu.",
      area: "Plošný graf sa používa na zobrazenie trendov v priebehu času alebo kategórií a na upriamenie pozornosti na celkovú hodnotu.",
      areaStacked:
        "Skladaný plošný graf ukazuje trend príspevku každej hodnoty v čase.",
      areaPercent:
        "100% skladaný plošný graf ukazuje trend percentuálneho podielu každej hodnoty v priebehu času.",
      pie: "Koláčový graf sa používa na zobrazenie proporcií celku. Použite ho pre jednu sériu, ktorej hodnoty tvoria súčet.",
      doughnut:
        "Prstencový graf zobrazuje podiely na celku podobne ako koláčový graf a v strede má miesto na označenie.",
      scatter:
        "Bodový graf sa používa na porovnanie párov hodnôt a zobrazenie vzťahu medzi dvoma premennými.",
      scatterLines: "Bodový graf s čiarami spája body v poradí X hodnôt.",
      bubble:
        "Bublinový graf pridáva do bodového grafu tretí rozmer: veľkosť každej bubliny.",
      histogram:
        "Histogram zobrazuje rozdelenie údajov: počet hodnôt v jednotlivých intervaloch.",
      pareto:
        "Paretov graf radí intervaly histogramu zostupne a pridáva krivku kumulatívneho súčtu.",
      waterfall:
        "Vodopádový graf zobrazuje priebežný súčet, keď sa hodnoty pripočítavajú alebo odčítavajú.",
      funnel:
        "Diagram lievika ukazuje hodnoty naprieč fázami procesu, ako je napríklad predajný kanál.",
      stockHLC:
        "Burzový graf maximum–minimum–záver zobrazuje vývoj cien akcií. Vyžaduje tri rady údajov: najvyššiu, najnižšiu a záverečnú cenu.",
      stockOHLC:
        "Burzový graf otvorenie–maximum–minimum–záver vyžaduje štyri rady: otváraciu, najvyššiu, najnižšiu a záverečnú cenu.",
      radar:
        "Lúčový graf porovnáva hodnoty niekoľkých radov údajov v rôznych ukazovateľoch.",
      radarMarkers:
        "Lúčový graf so značkami porovnáva niekoľko radov údajov v rôznych ukazovateľoch.",
      radarFilled:
        "Lúčový graf s výplňou porovnáva plochu, ktorú jednotlivé rady pokrývajú v rôznych ukazovateľoch.",
      comboColumnLine:
        "Kombinovaný graf zvýrazňuje rôzne druhy informácií: prvý rad zobrazí ako stĺpce, ostatné ako čiary.",
      comboColumnLineSecondary:
        "Kombinovaný graf so sekundárnou osou porovnáva série, ktorých hodnoty sa veľmi líšia veľkosťou.",
      comboAreaColumn:
        "Kombinovaný plošný a stĺpcový graf zobrazuje celok a jeho časti spoločne.",
    },
  },
  pageLayout: {
    margins: "Okraje",
    marginsTip:
      "Nastavte veľkosti okrajov pre hárok. Ak chcete použiť konkrétne veľkosti okrajov, vyberte položku Vlastné okraje.",
    customMargins: "Vlastné okraje…",
    marginDetails: "Hore: {top} Dolu: {bottom} Vľavo: {left} Vpravo: {right}",
    lastCustom: "Posledné vlastné nastavenie",
    orientation: "Orientácia",
    orientationTip: "Prepínajte stránky medzi rozložením na výšku a na šírku.",
    size: "Veľkosť",
    sizeTip: "Vyberte veľkosť papiera pre hárok.",
    moreSizes: "Viac veľkostí papiera…",
    printArea: "Oblasť tlače",
    printAreaTip: "Označte špecifickú oblasť listu na tlač.",
    breaks: "Zlomy strán",
    breaksTip:
      "Pridajte koniec strany na miesto, kde má začať ďalšia strana. Prestávka sa vloží nad a naľavo od výberu.",
    printTitles: "Tlačiť nadpisy",
    printTitlesTip:
      "Zadajte riadky a stĺpce, ktoré sa majú opakovať na každej vytlačenej strane, ako sú štítky a hlavičky.",
    pageSetup: "Nastavenie stránky…",
    pageSetupTip:
      "Zobraziť dialógové okno Nastavenie strany: strana, okraje, hlavička a päta a možnosti hárka.",
    printPreview: "Ukážka pred tlačou",
    printPreviewTip: "Ukážte vytlačené stránky a vytlačte ich.",
    width: "Šírka",
    widthTip: "Zmenšite šírku výtlačku, aby sa zmestil maximálny počet strán.",
    height: "Výška",
    heightTip: "Zmenšite výšku výtlačku, aby sa zmestil maximálny počet strán.",
    scale: "Prispôsobiť",
    scaleTip:
      "Roztiahnuť alebo zmenšiť výtlačok na percento jeho skutočnej veľkosti. Šírka a výška musia byť nastavené na Automaticky.",
    automatic: "Automaticky",
    pages: "Počet strán: {n}",
    onePage: "1 strana",
    gridlines: "Mriežka",
    headings: "Hlavičky",
    view: "Zobrazenie",
    print: "Tlač",
    gridlinesViewTip:
      "Zobrazte čiary medzi riadkami a stĺpcami, aby ste uľahčili úpravu a čítanie.",
    gridlinesPrintTip: "Vytlačte riadky medzi riadkami a stĺpcami.",
    headingsViewTip:
      "Zobrazte nadpisy riadkov a stĺpcov: čísla riadkov vľavo, písmená stĺpcov navrchu.",
    headingsPrintTip: "Vytlačte hlavičky riadkov a stĺpcov.",
  },
  view: {
    normal: "Normálne",
    normalTip: "Zobraziť hárok v normálnom zobrazení.",
    pageBreakPreview: "Ukážka zlomov strán",
    pageBreakPreviewTip:
      "Zobrazte umiestnenie zlomov strán pri tlači hárka. Zlom strany môžete presunúť potiahnutím.",
    pageLayout: "Rozloženie strany",
    pageLayoutTip:
      "Pozrite sa, ako bude vytlačený list vyzerať: strany a kde začínajú a končia.",
    gridlines: "Mriežka",
    gridlinesTip:
      "Zobrazte čiary medzi riadkami a stĺpcami, aby ste uľahčili úpravu a čítanie.",
    formulaBar: "Riadok vzorcov",
    formulaBarTip:
      "Zobrazte riadok vzorcov, kde zadávate text a vzorce do buniek.",
    headings: "Hlavičky",
    headingsTip:
      "Zobrazte nadpisy riadkov a stĺpcov: čísla riadkov vľavo, písmená stĺpcov navrchu.",
    zoom: "Lupa",
    zoomTip:
      "Otvorte dialógové okno Lupa, aby ste určili úroveň priblíženia listu.",
    zoom100: "100%",
    zoom100Tip: "Priblížte hárok na 100 % normálnej veľkosti.",
    zoomToSelection: "Priblížiť výber",
    zoomToSelectionTip:
      "Priblížte hárok tak, aby vybrané bunky vyplnili celé okno.",
    zoomTitle: "Lupa",
    magnification: "Zväčšenie",
    fitSelection: "Prispôsobiť výberu",
    custom: "Vlastné:",
    ok: "OK",
    cancel: "Zrušiť",
    freezePanes: "Ukotviť priečky",
    freezePanesTip:
      "Udržujte časť listu viditeľnú, zatiaľ čo zvyšok listu sa posúva.",
    freezePanesItem:
      "Udržujte riadky a stĺpce viditeľné, kým sa zvyšok pracovného hárka posúva (na základe aktuálneho výberu).",
    unfreezePanes: "Uvoľniť priečky",
    unfreezePanesItem:
      "Odomknite všetky riadky a stĺpce, aby ste mohli prechádzať celým pracovným hárkom.",
    freezeTopRow: "Ukotviť horný riadok",
    freezeTopRowItem:
      "Ponechajte horný riadok viditeľný pri rolovaní cez zvyšok pracovného hárka.",
    freezeFirstColumn: "Ukotviť prvý stĺpec",
    freezeFirstColumnItem:
      "Ponechajte prvý stĺpec viditeľný pri rolovaní cez zvyšok pracovného hárka.",
    split: "Rozdelenie",
    splitTip:
      "Rozdeľte okno na panely, z ktorých každá roluje samostatne. Opätovným kliknutím odstránite rozdelenie.",
    theme: "Motív",
    themeTip:
      "Vyberte, ako bude zošit vyzerať: svetlý, tmavý alebo ako systém.",
    light: "Svetlý",
    dark: "Tmavý",
    system: "Podľa systému",
    themeCurrent: "Motív: {theme}",
  },
} as const satisfies NamespaceRibbonTabsTranslation;

export default sk;
