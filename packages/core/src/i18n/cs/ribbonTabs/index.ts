import type { NamespaceRibbonTabsTranslation } from "../../i18n-types";

const cs = {
  insert: {
    pivotTable: "Kontingenční tabulka",
    pivotTableTip:
      "Uspořádejte a shrňte komplexní data v kontingenční tabulce.",
    table: "Tabulka",
    tableTip:
      "Vytvořte tabulku pro organizaci a analýzu souvisejících dat. Tabulky snadno třídí, filtrují a formátují data.",
    pictures: "Obrázky",
    picturesTip: "Vložte obrázky do buňky nebo přes buňky listu.",
    placeInCell: "Umístit do buňky",
    placeOverCells: "Umístit nad buňky",
    thisDevice: "Toto zařízení…",
    fromWeb: "Z webové adresy…",
    shapes: "Tvary",
    shapesTip:
      "Vložte hotové tvary, jako jsou kruhy, čtverce a šipky. Vyberte jeden a poté jej nakreslete přetažením na listu.",
    screenshot: "Snímek obrazovky",
    screenshotTip: "Vyfoťte vybrané buňky.",
    recommendedCharts: "Doporučené grafy",
    recommendedChartsTip:
      "Chcete, abychom vám doporučili dobrý graf pro prezentaci vašich dat? Vyberte data v listu a klikněte na toto tlačítko.",
    chartColumn: "Vložit sloupcový nebo pruhový graf",
    chartColumnTip:
      "Tento typ grafu použijte k vizuálnímu porovnání hodnot v několika kategoriích.",
    chartLine: "Vložit spojnicový nebo plošný graf",
    chartLineTip:
      "Tento typ grafu použijte k zobrazení trendů v čase (roky, měsíce a dny) nebo kategoriích.",
    chartPie: "Vložte koláčový nebo prstencový graf",
    chartPieTip:
      "Tento typ grafu použijte k zobrazení proporcí celku. Použijte jej, když je součet vašich čísel 100 %.",
    chartScatter: "Vložte bodový (X, Y) nebo bublinový graf",
    chartScatterTip:
      "Tento typ grafu použijte k zobrazení vztahu mezi sadami hodnot.",
    chartOther:
      "Vložit vodopádový, statistický, burzovní, paprskový nebo kombinovaný graf",
    chartOtherTip:
      "Tyto typy grafů použijte k zobrazení průběžných součtů, rozdělení, údajů o akciích, několika měření nebo smíšených řad.",
    moreCharts: "Další grafy…",
    galleryGroups: {
      column2d: "Dvourozměrný sloupcový",
      bar2d: "Dvourozměrný pruhový",
      line2d: "Dvourozměrný spojnicový",
      area2d: "Dvourozměrný plošný",
      pie2d: "Dvourozměrný výsečový",
      doughnut: "Prstencový",
      scatter: "Bodový",
      bubble: "Bublinový",
      statistic: "Statistika",
      waterfall: "Vodopád a trychtýř",
      stock: "Burzovní",
      radar: "Paprskový",
      combo: "Kombinovaný",
    },
    sparkLine: "Čára",
    sparkLineTip: "Vložení spojnicového grafu do jedné buňky.",
    sparkColumn: "Sloupec",
    sparkColumnTip: "Vložení sloupcového grafu do jedné buňky.",
    sparkWinLoss: "Zisk/ztráta",
    sparkWinLossTip: "Vložte graf výher/proher do jedné buňky.",
    slicer: "Průřez",
    slicerTip:
      "Pomocí průřezu můžete data filtrovat vizuálně. Průřezy usnadňují a zrychlují filtrování tabulek.",
    link: "Odkaz",
    linkTip:
      "Vytvořte v dokumentu odkaz pro rychlý přístup na webové stránky a další místa v sešitu.",
    comment: "Komentář",
    commentTip: "Zahájit konverzaci o vybrané buňce.",
    note: "Poznámka",
    noteTip: "Přidejte poznámku k vybrané buňce.",
    editNote: "Upravit poznámku",
    textBox: "Textové pole",
    textBoxTip: "Nakreslete textové pole kdekoli na listu.",
    headerFooter: "Záhlaví a zápatí",
    headerFooterTip:
      "Upravte záhlaví nebo zápatí stránky. Záhlaví a zápatí se zobrazí v horní a dolní části každé vytištěné stránky.",
    checkbox: "Zaškrtávací políčko",
    checkboxTip:
      "Vložit zaškrtávací políčka do vybraných buněk. Zaškrtnuto je TRUE, nezaškrtnuto je FALSE.",
    removeCheckbox: "Odstraňte zaškrtávací políčka vybraných buněk.",
  },
  chartDialog: {
    title: "Vložit graf",
    recommended: "Doporučené grafy",
    all: "Všechny grafy",
    ok: "OK",
    cancel: "Zrušit",
    preview: "Náhled",
    noData: "Vyberte data pro graf a zkuste to znovu.",
    families: {
      column: "Sloupec",
      line: "Čára",
      pie: "Výsečový",
      bar: "Pruhový",
      area: "Plošný",
      scatter: "XY (bodový)",
      stock: "Burzovní",
      radar: "Paprskový",
      histogram: "Histogram",
      waterfall: "Vodopádový",
      funnel: "Trychtýřový",
      combo: "Kombinovaný",
    },
    descriptions: {
      columnClustered:
        "K porovnání hodnot v několika kategoriích se používá seskupený sloupcový graf. Použijte jej, když pořadí kategorií není důležité.",
      columnStacked:
        "Skládaný sloupcový graf se používá k porovnání částí celku. Použijte jej k zobrazení, jak se součet mění napříč kategoriemi.",
      columnPercent:
        "100% skládaný sloupcový graf porovnává procento, které každá hodnota přispívá k součtu napříč kategoriemi.",
      barClustered:
        "Skupinový pruhový graf porovnává hodnoty několika kategorií. Hodí se pro dlouhé názvy kategorií.",
      barStacked:
        "Skládaný pruhový graf se používá k porovnání částí celku napříč kategoriemi s dlouhými názvy.",
      barPercent:
        "100% skládaný pruhový graf porovnává procentní podíl jednotlivých hodnot na celku.",
      line: "Spojnicový graf se používá k zobrazení trendů v čase (roky, měsíce a dny) nebo kategorií, když je pořadí důležité.",
      lineMarkers:
        "Spojnicový graf se značkami se používá k zobrazení trendů, když existuje pouze několik datových bodů.",
      lineStacked:
        "Skládaný spojnicový graf ukazuje, jak každá část přispívá k součtu v průběhu času.",
      area: "Plošný graf se používá k zobrazení trendů v čase nebo kategoriích ak upozorňování na celkovou hodnotu.",
      areaStacked:
        "Skládaný plošný graf ukazuje trend příspěvku každé hodnoty v průběhu času.",
      areaPercent:
        "100% skládaný plošný graf ukazuje trend procentuálního podílu každé hodnoty v průběhu času.",
      pie: "Výsečový graf se používá k zobrazení proporcí celku. Použijte jej pro jednu řadu, jejíž hodnoty tvoří součet.",
      doughnut:
        "Prstencový graf zobrazuje podíly na celku podobně jako výsečový graf a uprostřed má místo pro popisek.",
      scatter:
        "Bodový graf se používá k porovnání párů hodnot a zobrazení vztahu mezi dvěma proměnnými.",
      scatterLines: "Bodový graf s čarami spojuje body v pořadí hodnot X.",
      bubble:
        "Bublinový graf přidává do bodového grafu třetí rozměr: velikost každé bubliny.",
      histogram:
        "Histogram zobrazuje rozdělení dat: počet hodnot v jednotlivých intervalech.",
      pareto:
        "Paretův graf řadí intervaly histogramu sestupně a přidává křivku kumulativního součtu.",
      waterfall:
        "Vodopádový graf ukazuje průběžný součet, jak se hodnoty přičítají nebo odečítají.",
      funnel:
        "Trychtýřový graf ukazuje hodnoty napříč fázemi procesu, jako je prodejní kanál.",
      stockHLC:
        "Burzovní graf maximum–minimum–závěr zobrazuje vývoj cen akcií. Vyžaduje tři datové řady: nejvyšší, nejnižší a závěrečnou cenu.",
      stockOHLC:
        "Burzovní graf otevření–maximum–minimum–závěr vyžaduje čtyři řady: otevírací, nejvyšší, nejnižší a závěrečnou cenu.",
      radar:
        "Paprskový graf porovnává hodnoty několika datových řad v různých ukazatelích.",
      radarMarkers:
        "Paprskový graf se značkami porovnává několik datových řad v různých ukazatelích.",
      radarFilled:
        "Paprskový graf s výplní porovnává plochu, kterou jednotlivé řady pokrývají v různých ukazatelích.",
      comboColumnLine:
        "Kombinovaný graf zvýrazňuje různé druhy informací: první řadu zobrazí jako sloupce, ostatní jako spojnice.",
      comboColumnLineSecondary:
        "Kombinovaný graf se sekundární osou porovnává řady, jejichž hodnoty se velmi liší velikostí.",
      comboAreaColumn:
        "Kombinovaný plošný a sloupcový graf zobrazuje celek a jeho části společně.",
    },
  },
  pageLayout: {
    margins: "Okraje",
    marginsTip:
      "Nastavte velikosti okrajů pro list. Chcete-li použít konkrétní velikosti okrajů, zvolte Vlastní okraje.",
    customMargins: "Vlastní okraje…",
    marginDetails: "Nahoře: {top} Dole: {bottom} Vlevo: {left} Vpravo: {right}",
    lastCustom: "Poslední uživatelské nastavení",
    orientation: "Orientace",
    orientationTip: "Přepínání stránek mezi rozložením na výšku a na šířku.",
    size: "Velikost",
    sizeTip: "Vyberte velikost papíru pro list.",
    moreSizes: "Další velikosti papíru…",
    printArea: "Oblast tisku",
    printAreaTip: "Označte určitou oblast listu pro tisk.",
    breaks: "Konce stránek",
    breaksTip:
      "Přidejte konec stránky na místo, kde má začínat další stránka. Zalomení se vloží nad výběr a nalevo od něj.",
    printTitles: "Tisk názvů",
    printTitlesTip:
      "Určete řádky a sloupce, které se mají opakovat na každé vytištěné stránce, jako jsou štítky a záhlaví.",
    pageSetup: "Nastavení stránky…",
    pageSetupTip:
      "Zobrazit dialogové okno Vzhled stránky: stránka, okraje, záhlaví a zápatí a možnosti listu.",
    printPreview: "Náhled tisku",
    printPreviewTip: "Náhled vytištěných stránek a jejich tisk.",
    width: "Šířka",
    widthTip: "Zmenšete šířku výtisku, aby se vešel maximální počet stránek.",
    height: "Výška",
    heightTip: "Zmenšete výšku výtisku, aby se vešel maximální počet stránek.",
    scale: "Přizpůsobit",
    scaleTip:
      "Roztáhnout nebo zmenšit výtisk na procento jeho skutečné velikosti. Šířka a výška musí být nastaveny na Automaticky.",
    automatic: "Automaticky",
    pages: "Počet stránek: {n}",
    onePage: "1 stránka",
    gridlines: "Mřížka",
    headings: "Záhlaví",
    view: "Zobrazení",
    print: "Tisk",
    gridlinesViewTip:
      "Zobrazte čáry mezi řádky a sloupci, abyste usnadnili editaci a čtení.",
    gridlinesPrintTip: "Vytiskne čáry mezi řádky a sloupci.",
    headingsViewTip:
      "Zobrazit záhlaví řádků a sloupců: čísla řádků vlevo, písmena sloupců nahoře.",
    headingsPrintTip: "Vytiskne záhlaví řádků a sloupců.",
  },
  view: {
    normal: "Normální",
    normalTip: "Zobrazit list v normálním zobrazení.",
    pageBreakPreview: "Zobrazit konce stránek",
    pageBreakPreviewTip:
      "Zobrazte umístění konců stránek při tisku listu. Konec stránky můžete přesunout přetažením.",
    pageLayout: "Rozložení stránky",
    pageLayoutTip:
      "Podívejte se, jak bude vytištěný list vypadat: stránky a kde začínají a končí.",
    gridlines: "Mřížka",
    gridlinesTip:
      "Zobrazte čáry mezi řádky a sloupci, abyste usnadnili editaci a čtení.",
    formulaBar: "Řádek vzorců",
    formulaBarTip:
      "Zobrazit řádek vzorců, kde zadáváte text a vzorce do buněk.",
    headings: "Záhlaví",
    headingsTip:
      "Zobrazit záhlaví řádků a sloupců: čísla řádků vlevo, písmena sloupců nahoře.",
    zoom: "Lupa",
    zoomTip: "Otevřete dialogové okno Lupa a zadejte úroveň zvětšení listu.",
    zoom100: "100%",
    zoom100Tip: "Přiblížit list na 100 % normální velikosti.",
    zoomToSelection: "Přiblížit výběr",
    zoomToSelectionTip:
      "Přibližte list tak, aby vybrané buňky vyplnily celé okno.",
    zoomTitle: "Lupa",
    magnification: "Zvětšení",
    fitSelection: "Přizpůsobit výběru",
    custom: "Vlastní:",
    ok: "OK",
    cancel: "Zrušit",
    freezePanes: "Ukotvit příčky",
    freezePanesTip:
      "Udržujte část listu viditelnou, zatímco zbytek listu se posouvá.",
    freezePanesItem:
      "Udržujte řádky a sloupce viditelné, zatímco se zbytek listu posouvá (na základě aktuálního výběru).",
    unfreezePanes: "Uvolnit příčky",
    unfreezePanesItem:
      "Odemkněte všechny řádky a sloupce, abyste mohli procházet celým listem.",
    freezeTopRow: "Ukotvit horní řádek",
    freezeTopRowItem:
      "Při procházení zbytkem listu ponechejte viditelný horní řádek.",
    freezeFirstColumn: "Ukotvit první sloupec",
    freezeFirstColumnItem:
      "Udržujte první sloupec viditelný při procházení zbytkem listu.",
    split: "Rozdělit",
    splitTip:
      "Rozdělte okno na panely, z nichž každý roluje samostatně. Dalším kliknutím rozdělení odstraníte.",
    theme: "Motiv",
    themeTip:
      "Vyberte, jak bude sešit vypadat: světlý, tmavý nebo jako systém.",
    light: "Světlý",
    dark: "Tmavý",
    system: "Podle systému",
    themeCurrent: "Motiv: {theme}",
  },
} as const satisfies NamespaceRibbonTabsTranslation;

export default cs;
