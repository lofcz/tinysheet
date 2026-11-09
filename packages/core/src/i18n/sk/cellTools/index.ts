import type { NamespaceCellToolsTranslation } from "../../i18n-types";

const sk = {
  toolbar: {
    checkbox: "Začiarkavacie políčko",
    dataTools: "Dátové nástroje",
    flashFill: "Dynamické dopĺňanie",
    flashFillShortcut: "Ctrl+E",
    advancedFilter: "Rozšírený filter…",
    clearAdvancedFilter: "Vymazať rozšírený filter",
    whatIf: "Analýza hypotéz",
    goalSeek: "Hľadanie riešenia…",
    dataTable: "Tabuľka údajov…",
    recalcDataTables: "Prepočítať tabuľky údajov",
  },
  checkbox: {
    insert: "Vložiť začiarkavacie políčka",
    remove: "Odstrániť začiarkavacie políčka",
  },
  flashFill: {
    filled: "Dynamické dopĺňanie: počet zmenených buniek: {count}",
    filledOne: "Dynamické dopĺňanie: zmenená 1 bunka",
    noPattern:
      "Dynamické dopĺňanie nenašlo vzor. Zadajte vedľa údajov niekoľko ďalších príkladov a skúste to znova.",
    noData:
      "Po zadaní príkladu vyberte bunku v stĺpci vedľa údajov, ktorý chcete vyplniť.",
    undo: "Späť",
  },
  goalSeek: {
    title: "Hľadanie riešenia",
    setCell: "Nastavená bunka",
    toValue: "Cieľová hodnota",
    changingCell: "Menená bunka",
    ok: "OK",
    cancel: "Zrušiť",
    statusTitle: "Stav hľadania riešenia",
    found: "Hľadanie riešenia pre bunku {cell} našlo riešenie.",
    notFound: "Hľadanie riešenia pre bunku {cell} možno nenašlo riešenie.",
    targetValue: "Cieľová hodnota",
    currentValue: "Aktuálna hodnota",
    iterations: "Iterácie",
    errSetCell: "Nastavovaná bunka musí obsahovať vzorec.",
    errSetCellRef: "Nastavovaná bunka musí byť odkazom na jednu bunku.",
    errChangingCell:
      "Menená bunka musí byť jedna bunka s hodnotou, nie so vzorcom.",
    errValue: "Ako cieľovú hodnotu zadajte číslo.",
  },
  dataTable: {
    title: "Tabuľka údajov",
    rowInput: "Vstupná bunka riadka",
    colInput: "Vstupná bunka stĺpca",
    hint: "Najprv vyberte celú tabuľku: vstupné hodnoty v prvom riadku alebo stĺpci a vzorce vedľa nich.",
    ok: "OK",
    cancel: "Zrušiť",
    errInput: "Zadajte platnú vstupnú bunku riadka alebo stĺpca.",
    errTooSmall: "Vyberte rozsah s aspoň dvoma riadkami a dvoma stĺpcami.",
    errInputInTable: "Vstupná bunka nesmie byť vnútri tabuľky.",
    errOverlap: "Výber sa prekrýva s inou tabuľkou údajov.",
    partError: "Nemožno zmeniť časť tabuľky údajov.",
  },
  advancedFilter: {
    title: "Rozšírený filter",
    action: "Akcia",
    inPlace: "Filtrovať zoznam priamo na mieste",
    copy: "Kopírovať inam",
    listRange: "Rozsah zoznamu",
    criteriaRange: "Rozsah kritérií",
    copyTo: "Kopírovať do",
    unique: "Iba jedinečné záznamy",
    ok: "OK",
    cancel: "Zrušiť",
    clear: "Vymazať",
    errList:
      "Rozsah zoznamu musí obsahovať riadok hlavičky a aspoň jeden záznam.",
    errCriteria:
      "Rozsah kritérií musí obsahovať riadok označení a aspoň jeden riadok podmienok.",
    errCopyTo:
      "Cieľový odkaz je neplatný, odkazuje na stĺpec, ktorý v zozname nie je, alebo presahuje rozmery hárka.",
    errOverlap: "Cieľový rozsah sa nesmie prekrývať s rozsahom zoznamu.",
    result: "Nájdených {matched} z {total} záznamov.",
  },
} as const satisfies NamespaceCellToolsTranslation;

export default sk;
