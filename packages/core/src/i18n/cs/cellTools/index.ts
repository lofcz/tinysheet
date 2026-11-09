import type { NamespaceCellToolsTranslation } from "../../i18n-types";

const cs = {
  toolbar: {
    checkbox: "Zaškrtávací políčko",
    dataTools: "Datové nástroje",
    flashFill: "Dynamické vyplňování",
    flashFillShortcut: "Ctrl+E",
    advancedFilter: "Rozšířený filtr…",
    clearAdvancedFilter: "Vymazat rozšířený filtr",
    whatIf: "Citlivostní analýza",
    goalSeek: "Hledání řešení…",
    dataTable: "Tabulka dat…",
    recalcDataTables: "Přepočítat tabulky dat",
  },
  checkbox: {
    insert: "Vložit zaškrtávací políčka",
    remove: "Odstranit zaškrtávací políčka",
  },
  flashFill: {
    filled: "Dynamické doplňování: počet změněných buněk: {count}",
    filledOne: "Dynamické doplňování: změněna 1 buňka",
    noPattern:
      "Dynamické doplňování nenašlo vzor. Zadejte vedle dat několik dalších příkladů a zkuste to znovu.",
    noData:
      "Po zadání příkladu vyberte buňku ve sloupci vedle dat, který chcete vyplnit.",
    undo: "Zpět",
  },
  goalSeek: {
    title: "Hledání řešení",
    setCell: "Nastavená buňka",
    toValue: "Cílová hodnota",
    changingCell: "Měněná buňka",
    ok: "OK",
    cancel: "Zrušit",
    statusTitle: "Stav hledání řešení",
    found: "Hledání řešení pro buňku {cell} nalezlo řešení.",
    notFound: "Hledání řešení pro buňku {cell} možná nenalezlo řešení.",
    targetValue: "Cílová hodnota",
    currentValue: "Aktuální hodnota",
    iterations: "Iterace",
    errSetCell: "Nastavovaná buňka musí obsahovat vzorec.",
    errSetCellRef: "Nastavovaná buňka musí být odkazem na jednu buňku.",
    errChangingCell:
      "Měněná buňka musí být jedna buňka s hodnotou, nikoli se vzorcem.",
    errValue: "Jako cílovou hodnotu zadejte číslo.",
  },
  dataTable: {
    title: "Tabulka dat",
    rowInput: "Vstupní buňka řádku",
    colInput: "Vstupní buňka sloupce",
    hint: "Nejprve vyberte celou tabulku: vstupní hodnoty v prvním řádku nebo sloupci a vzorce vedle nich.",
    ok: "OK",
    cancel: "Zrušit",
    errInput: "Zadejte platnou vstupní buňku řádku nebo sloupce.",
    errTooSmall: "Vyberte oblast s alespoň dvěma řádky a dvěma sloupci.",
    errInputInTable: "Vstupní buňka nesmí být uvnitř tabulky.",
    errOverlap: "Výběr se překrývá s jinou tabulkou dat.",
    partError: "Nelze změnit část tabulky dat.",
  },
  advancedFilter: {
    title: "Rozšířený filtr",
    action: "Akce",
    inPlace: "Filtrovat seznam přímo na místě",
    copy: "Kopírovat jinam",
    listRange: "Oblast seznamu",
    criteriaRange: "Oblast kritérií",
    copyTo: "Kopírovat do",
    unique: "Pouze jedinečné záznamy",
    ok: "OK",
    cancel: "Zrušit",
    clear: "Vymazat",
    errList:
      "Oblast seznamu musí obsahovat řádek záhlaví a alespoň jeden záznam.",
    errCriteria:
      "Oblast kritérií musí obsahovat řádek popisků a alespoň jeden řádek podmínek.",
    errCopyTo:
      "Cílový odkaz je neplatný, odkazuje na sloupec, který v seznamu není, nebo přesahuje rozměry listu.",
    errOverlap: "Cílová oblast se nesmí překrývat s oblastí seznamu.",
    result: "Nalezeno {matched} z {total} záznamů.",
  },
} as const satisfies NamespaceCellToolsTranslation;

export default cs;
