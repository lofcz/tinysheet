# TinySheet roadmap: closing the Excel gap

Where we stand, what "Excel-grade" means for TinySheet, and how the work is
split. Each workstream has one owner (a specialist agent or contributor) and a
fixed set of files, so the streams can run in parallel and merge cleanly.

## Baseline (v1.0.3)

| Area | State |
| --- | --- |
| Formula engine | Chevrotain grammar + formulajs 4.6 (≈460 function names). No `LET`/`LAMBDA`, no `{…}` array constants, no whole-row/column refs, and none of the modern dynamic-array or text functions (`XLOOKUP`, `FILTER`, `SEQUENCE`, `TEXTSPLIT`, `REGEX*`, …). |
| Context functions | `INDIRECT`/`OFFSET` are special-cased for dependency tracking but not implemented. `ADDRESS`, `ISFORMULA`, `FORMULATEXT`, `CELL`, `SHEET` are missing. |
| Function catalog | The autocomplete/hint list (`locale/*.ts → functionlist`) has 372 entries, about 120 of which don't match the engine (e.g. `RANK_EQ` vs `RANK.EQ`, Luckysheet-only `DM_TEXT_*`, `DATA_CN_STOCK_*`), and it omits about 200 functions the engine does support. |
| Formula editing | Basic prefix search of function names, a static hint card with hard-coded Chinese tooltips, and no F4 reference cycling. |
| Performance | Recalculation walks formula groups without a proper dependency graph. Canvas redraws are coarse, and a single React context re-renders the whole overlay on every change. |
| Keyboard | Partial coverage of Excel shortcuts. Autofill covers numbers and simple series only. |
| UI | Light theme only, ad-hoc colours across about 20 CSS files, and a few untranslated strings. |
| Tests | Formula-parser vitest suite (503 tests). The core/react jest suite was broken and is fixed in this roadmap's first commit (25 suites / 125 tests), and now runs in CI. |

## Workstreams (phase 1: in progress)

| # | Workstream | Scope | Owned files |
| --- | --- | --- | --- |
| 1 | **Lookup & dynamic-array functions** | `XLOOKUP`, `XMATCH`, `FILTER`, `SORTBY`, `SEQUENCE`, `RANDARRAY`, `TAKE`, `DROP`, `EXPAND`, `TOCOL`, `TOROW`, `WRAPCOLS`, `WRAPROWS`, `CHOOSEROWS`, `CHOOSECOLS`, `HSTACK`, `VSTACK`, `TRIMRANGE`; Excel-exact `UNIQUE`/`SORT`/`VLOOKUP`/`HLOOKUP`/`MATCH`/`INDEX`/`LOOKUP` | `formula-parser/src/functions/lookup-array.js` + tests |
| 2 | **Text & regex functions** | `TEXTBEFORE`, `TEXTAFTER`, `TEXTSPLIT`, `REGEXTEST`, `REGEXEXTRACT`, `REGEXREPLACE`, `ARRAYTOTEXT`, `VALUETOTEXT`, `CONCAT`/`TEXTJOIN` over ranges, `NUMBERVALUE`, `UNICHAR`/`UNICODE`, Excel-exact `FIND`/`SEARCH` (wildcards)/`SUBSTITUTE`/`PROPER`/`CLEAN`/`TRIM` | `formula-parser/src/functions/text.js` + tests |
| 3 | **Math, statistics, date & financial** | `FORECAST.LINEAR`, `PERCENTOF`, `AGGREGATE`, `NETWORKDAYS.INTL`, `WORKDAY.INTL`, the bond family (`PRICE`, `YIELD`, `DURATION`, `MDURATION`, `COUP*`, `ACCRINTM`, `INTRATE`, `RECEIVED`, `DISC`), `MDETERM`, `MINVERSE`, `MMULT`, plus an Excel-compatibility audit of the formulajs functions people use most | `formula-parser/src/functions/math-stats.js`, `date-financial.js` + tests |
| 4 | **Grammar & functional programming** | `LET`, `LAMBDA`, `MAP`, `REDUCE`, `SCAN`, `BYROW`, `BYCOL`, `MAKEARRAY`, `ISOMITTED`; `{1,2;3,4}` array constants; whole-row/column refs (`A:A`, `1:3`, `Sheet2!B:D`); implicit intersection; operator precedence and coercion that match Excel | `formula-parser/src/grammar-parser/*`, `parser.js`, `helper/*`, `functions/lambda.js` + tests |
| 5 | **Workbook-aware functions & spill** | `INDIRECT`, `OFFSET`, `ADDRESS`, `ROW`/`COLUMN`/`ROWS`/`COLUMNS` over refs, `ISFORMULA`, `FORMULATEXT`, `ISREF`, `SHEET`, `SHEETS`, `CELL`, `HYPERLINK`, `SUBTOTAL`/`AGGREGATE` skipping hidden rows; dynamic-array spill into neighbouring cells with `#SPILL!` | `core/src/modules/formulaFunctions.ts` (new), spill paths in `core/src/modules/formula.ts` |
| 6 | **Recalculation performance** | Dependency graph with dirty-set topological recalculation, circular-reference detection, range-read caching, lazy formula-cache build on load, benchmarks | `core/src/modules/formula.ts` (calc/dependency paths), `formulaHelper.ts`, `refresh.ts` |
| 7 | **Function catalog** | A complete, accurate English catalog (name, category, description, typed params, example) for every supported function, including everything from streams 1–5; names that match the engine; other locales fall back to English | `core/src/locale/*` (functionlist) |
| 8 | **Formula editor & autocomplete** | Ranked fuzzy function suggestions, Tab/Enter/arrow keys, a live argument hint that bolds the current parameter, F4 `$` cycling, colour-coded references, bracket matching, better value autocomplete in plain cells, and no hard-coded Chinese strings | formula editor region of `core/src/modules/formula.ts`, `react/src/components/SheetOverlay/{FormulaHint,AutocompleteList,InputBox}.tsx`, `FxEditor`, `FormulaSearch` |
| 9 | **Rendering performance** | Viewport-only drawing, cached text measurement and layout, fewer full-canvas redraws, smooth scrolling on sheets with 100k+ cells, fewer React re-renders, deferred load work | `core/src/canvas.ts`, measurement code in `core/src/modules/text.ts`, render paths in `react/src/components/{Workbook,Sheet,SheetOverlay}` |
| 10 | **Keyboard & fill** | Excel shortcut parity (`Ctrl+Arrow`, `Ctrl+Shift+Arrow`, `Ctrl+D`/`R`, `Ctrl+;`, `Ctrl+Shift+;`, `Ctrl+Enter`, `Shift/Ctrl+Space`, `Ctrl+Home`/`End`, `PgUp`/`PgDn`, `Alt+Enter`, `F2`); smarter autofill (dates, weekdays, months, quarters, text+number, linear and growth trends) | `core/src/events/keyboard.ts`, `core/src/modules/dropCell.ts` |
| 11 | **UI polish & theming** | CSS-variable design tokens, dark theme, consistent toolbar, menus, tabs and dialogs, focus and hover states, a11y labels, remaining translation gaps | `react/src/**/*.css`, Toolbar/ContextMenu/SheetTab/dialog components, `core/src/theme.ts` (new) |
| 12 | **Number formats & typed input** | Typed input parsing like Excel (dates, times, `%`, currency, thousands separators, scientific, fractions, leading `'`), full custom format codes (sections, colours, conditions), `TEXT()` backed by the same formatter | `core/src/modules/format.ts`, `ssf.js`, input parsing in `core/src/modules/cell.ts` |

### Rules of engagement

* Stay inside your owned files. If a change elsewhere is unavoidable, keep it
  minimal and list it in your hand-off.
* Every function lands with tests that cite Excel's documented behaviour
  (argument defaults, errors, edge cases).
* `bun run test:formula-parser`, `bun run test:jest` and `bun run build` must
  pass before a stream merges.

## Phase 2: next up

* Named ranges and the Name Manager, and structured table references (`Table1[Col]`).
* Conditional formatting: data bars, colour scales, icon sets, formula-based rules.
* Data validation sidebar (FortuneSheet#746), cell placeholder text (FortuneSheet#716).
* Richer filters (by colour, top 10, custom), multi-level sort UI.
* Pivot tables (`GROUPBY`/`PIVOTBY` first, then a pivot UI).
* Charts: more types and in-sheet editing.
* Find & replace across sheets, go-to-special.
* Excel round-trip fidelity: formats, merged styles, data validation, conditional formats.

## Phase 3: later

* Web-worker calculation engine.
* Virtualised row/column storage for sheets with 1M+ rows.
* Collaborative editing hardening: operational transforms for formulas.
* Printing and page layout.
