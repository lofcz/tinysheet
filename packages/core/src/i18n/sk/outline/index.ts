import type { NamespaceOutlineTranslation } from "../../i18n-types";

const sk = {
  toolbar: {
    outline: "Zoskupenie a prehľad",
  },
  menu: {
    group: "Zoskupiť",
    ungroup: "Zrušiť zoskupenie",
    showDetail: "Zobraziť podrobnosti",
    hideDetail: "Skryť podrobnosti",
    autoOutline: "Automatický prehľad",
    clearOutline: "Vymazať prehľad",
    subtotal: "Medzisúčty…",
    settings: "Nastavenia prehľadu…",
  },
  groupDialog: {
    group: "Zoskupiť",
    ungroup: "Zrušiť zoskupenie",
    rows: "Riadky",
    columns: "Stĺpce",
  },
  errors: {
    maxLevel: "Nemožno zoskupiť: prehľad môže mať najviac 8 úrovní.",
    notGrouped: "Nemožno oddeliť: výber nie je zoskupený.",
    noAutoOutline:
      "Nemožno vytvoriť prehľad: žiadne súhrnné vzorce (napríklad SUM alebo SUBTOTAL) neodkazujú na susedné riadky či stĺpce.",
    noDetail: "Výber nie je súčasťou skupiny.",
  },
  subtotal: {
    title: "Medzisúčet",
    atEachChange: "Pri každej zmene v stĺpci:",
    useFunction: "Použiť funkciu:",
    addTo: "Pridať medzisúčet do stĺpcov:",
    replace: "Nahradiť aktuálne medzisúčty",
    pageBreaks: "Zlom strany medzi skupinami",
    summaryBelow: "Súhrn pod údajmi",
    removeAll: "Odstrániť všetko",
    ok: "OK",
    cancel: "Zrušiť",
    column: "Stĺpec {name}",
    noData:
      "Vyberte zoznam s riadkom hlavičky a aspoň jedným riadkom údajov a skúste to znova.",
    noColumns:
      "Vyberte aspoň jeden stĺpec, do ktorého sa má pridať medzisúčet.",
    tooManyLevels:
      "Nemožno pridať medzisúčty: prehľad môže mať najviac 8 úrovní.",
    tooManyRows:
      "Nemožno pridať medzisúčty: hárok by obsahoval príliš veľa riadkov.",
    functions: {
      sum: "Súčet",
      count: "Počet",
      average: "Priemer",
      max: "Maximum",
      min: "Minimum",
      product: "Produkt",
      countNums: "Počet čísel",
      stdDev: "Výberová smerodajná odchýlka",
      stdDevp: "Smerodajná odchýlka základného súboru",
      var: "Výberový rozptyl",
      varp: "Rozptyl základného súboru",
    },
    labels: {
      sum: "Celkom",
      count: "Počet",
      average: "Priemer",
      max: "Maximum",
      min: "Minimum",
      product: "Produkt",
      countNums: "Počet",
      stdDev: "Výberová smerodajná odchýlka",
      stdDevp: "Smerodajná odchýlka základného súboru",
      var: "Výberový rozptyl",
      varp: "Rozptyl základného súboru",
    },
    groupLabel: "{value} {label}",
    grandLabel: "{label} celkom",
  },
  settings: {
    title: "Nastavenia prehľadu",
    direction: "Smer",
    summaryBelow: "Súhrnné riadky pod podrobnosťami",
    summaryRight: "Súhrnné stĺpce napravo od podrobností",
    ok: "OK",
    cancel: "Zrušiť",
  },
  gutter: {
    level: "Zobraziť úroveň prehľadu {level}",
    expand: "Rozbaliť skupinu (riadky {from}–{to})",
    collapse: "Zbaliť skupinu (riadky {from}–{to})",
    expandColumns: "Rozbaliť skupinu (stĺpce {from}–{to})",
    collapseColumns: "Zbaliť skupinu (stĺpce {from}–{to})",
  },
} as const satisfies NamespaceOutlineTranslation;

export default sk;
