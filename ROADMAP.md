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

## Phase 1 status: delivered

All 12 workstreams below are merged. Test counts went from 503 (formula-parser)
plus a broken jest suite to 975 formula-parser tests and 1132 core/react tests.

| Measure | Before | After |
| --- | --- | --- |
| Edit a cell nothing depends on (50k formulas) | 150 ms | 0.1 ms |
| Edit the head of a 50k-formula chain | 7.5 s | 1.1 s |
| Vertical scroll, script time per frame (131k cells) | 19 ms | 4.3 ms |
| Click to select a cell | 102 ms | 16 ms |

Carried over from phase 1:

* Spill: re-spill after inserting/deleting rows, sorting and autofill; a spill-range border; greyed formula in spilled cells.
* Typed text arguments (`SUM("abc")`) return 0 instead of `#VALUE!`; the engine can't yet tell a typed value from a single-cell reference.
* Whole-column ranges stop at the last used row, so `COUNTBLANK(A:A)` differs from Excel.
* Array lifting for formulajs scalar functions (`ABS({-1,2})`); union operator; dynamic ranges such as `A1:INDEX(…)`.
* Date results inherit a date format only from a leading date function, not from referenced date cells (`=A1+7`).
* Frozen panes still redraw fully on scroll; the single React context still re-renders the toolbar on every change.
* `tsc --noEmit` fails because React types aren't resolved (pre-existing).

## Workstreams (phase 1)

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

## Phase 2 status: delivered

All 15 streams (T1–T64) and three integration passes are merged. Every
check passes: `tsc`, `lint` (0 errors), jest (2150), formula-parser vitest
(2119), excel (60), and the Playwright e2e suite (33).
`packages/formula-parser/FUNCTIONS.md` rates 473 of 524 Excel functions as
supported, and 1011 documented Excel examples pass.

| Measure (P11, merged tree) | Before | After |
| --- | --- | --- |
| First render, 1M cells | 5.3 s | 266 ms |
| Load 1M rows × 100 cols | 7.6 s | 2.0 s |
| Scroll step, 1M rows (script / worst frame) | 20.8 ms / 620 ms | 4.6 ms / 21 ms |
| Click, 1M rows | 147 ms | 9 ms |
| Scroll step with frozen panes | 18.1 ms | 6.6 ms |
| Components re-rendered per formula keystroke | 126 | 24 |

Integration passes after the streams:

* **I1:** names, tables, charts and notes follow every structural edit through one reference-adjuster registry. Structured references survive table renames, and `INDIRECT` resolves names.
* **I2:** context-menu actions (Paste Special, Format Cells, Insert Chart, Define Name, Data Validation), Insert/Delete cells shortcuts, locale coverage with key-by-key English fallback, and an Excel-ordered toolbar.
* **I3:** core reference functions run on the parser's reference values (OFFSET, INDIRECT incl. R1C1, CELL…). xlsx round-trips for tables, validation details and cell attributes. Faster spill reconciliation.

Carried over from phase 2:

* Row/column insert and delete still scan the whole sheet for spills; each edit copies the whole row array (about 50 ms at 1M rows).
* Blit scrolling falls back to a full redraw when a merged cell crosses the freeze line or conditional-format bars/icons are on screen.
* Cut/paste doesn't move autofilter ranges; charts don't move their on-sheet position for cell shifts.
* GETPIVOTDATA, RTD, CALL, REGISTER.ID, PY and FIELDVALUE are missing; IMAGE returns its alt text.
* Point mode can't pick references on other sheets; Freeze Panes freezes from A1, not from the scrolled position.
* exceljs can't write some validation and conditional-format details (e.g. list "Show dropdown"), and tables without data rows aren't exported.
* The excel package's toolbar labels are English only.

## Phase 2 plan (15 streams, 64 tasks)

Same rules as phase 1: each stream owns its files, lands with tests, and must
pass `bun run test:formula-parser`, `bun run test:jest` and `bun run build`.

### P1 · Engine semantics (`formula-parser` grammar, evaluator, operators, helpers)
- **T1** Distinguish typed arguments from references: `SUM("abc")` → `#VALUE!`, `SUM("3")` → 3, text in ranges ignored.
- **T2** Array lifting for scalar functions (`ABS({-1,2})`, `ROUND(A1:A3,0)`, `LEN(A1:A3)`), including formulajs ones.
- **T3** Reference union (`SUM((A1:A2,C1:C2))`) and the intersection operator (space).
- **T4** Reference-returning functions inside ranges: `A1:INDEX(B:B,5)`, `OFFSET(...):C5`, `INDEX(...)` returning a reference to `ROW`, `CELL`, and so on.
- **T5** Excel's numeric model: 15-significant-digit comparison (`0.1+0.2=0.3` is TRUE), `-0`, very large and small numbers, and `#NUM!` on overflow.

### P2 · Functions, batch 2 (`formula-parser/src/functions/*`, new files)
- **T6** `GROUPBY` and `PIVOTBY` (field headers, totals, sort order, filter array; `SUM`/`AVERAGE`/`COUNT`/`PERCENTOF` as LAMBDA or eta-reduced functions).
- **T7** Database functions: `DSUM`, `DAVERAGE`, `DCOUNT`, `DCOUNTA`, `DGET`, `DMAX`, `DMIN`, `DPRODUCT`, `DSTDEV(P)`, `DVAR(P)`.
- **T8** Regression arrays: `LINEST`, `LOGEST`, `TREND`, `GROWTH`, `FREQUENCY`, `FORECAST.ETS` (basic).
- **T9** Excel function-list audit: implement every remaining non-web, non-cube function (e.g. `CONVERT`, `BAHTTEXT`, `ENCODEURL`, `IMAGE` as a placeholder, `TEXT` parity checks) and publish a coverage table.
- **T10** Excel-parity corpus: a data-driven test table of at least 500 formulas and their documented Excel results, covering every function category.

### P3 · Named ranges and tables (new `core/src/modules/names.ts`, Name Manager UI, Name Box)
- **T11** Defined names (workbook and sheet scope; ranges, constants, formulas, LAMBDA) resolved in formulas, with dependency tracking and recalculation.
- **T12** Name Manager dialog (create, edit, delete, filter) plus "Create from selection".
- **T13** Name Box: type `A1`, `B2:D9`, `Sheet2!C3` or a name to jump or select; type a new name to define one.
- **T14** Tables: a Format as Table object (header row, banded rows, total row, auto-expand) with structured references (`Table1[Col]`, `[@Col]`, `Table1[#Totals]`).
- **T15** Names and tables in formula autocomplete, and names in xlsx import/export.

### P4 · Spill completion (`core/src/modules/formulaFunctions.ts` and spill hooks)
- **T16** Re-spill after inserting or deleting rows or columns, sorting, autofill, cut/paste and undo/redo.
- **T17** Spill UI: a dashed border around the spill range and a greyed formula in the formula bar for spilled cells.
- **T18** Spills beyond the sheet edge grow the sheet (up to a limit) instead of showing `#SPILL!`.
- **T19** `A1#` references: dependency tracking, copy and fill adjustment, and copied spill cells don't carry the `spillFrom` tag.

### P5 · Conditional formatting (`ConditionFormat.ts`, `conditionalFormat.ts`, React `ConditionFormat`)
- **T20** Data bars (gradient or solid, negative axis, min/max types).
- **T21** Two- and three-colour scales (number, percent, percentile and formula stops).
- **T22** Icon sets (arrows, traffic lights, ratings; reverse; icon only).
- **T23** Rule types: formula-based, top/bottom N or %, above/below average, duplicate/unique, date occurring, blanks/errors.
- **T24** Manage Rules dialog (list, edit, reorder priority, stop if true, applies-to range) plus CF round-trip in xlsx.

### P6 · Data tools (`dataVerification.ts`, `filter.ts`, `sort.ts`, related React components)
- **T25** Data validation: list from a range or a named range, custom formula, input message, error styles (stop/warning/info), and circling invalid data.
- **T26** Filters: by colour; text, number and date conditions (contains, between, top 10, above average, date periods); multi-column; clear all.
- **T27** Multi-level Sort dialog (header detection, sort by value, cell colour or font colour, custom list order, left to right).
- **T28** Remove Duplicates dialog and Text to Columns parity (fixed width, delimiters, column formats).
- **T29** Data validation sidebar (FortuneSheet#746) and cell placeholder text (FortuneSheet#716).

### P7 · Clipboard and references (`paste.ts`, `copy.ts`, `clipboard.ts`, `moveCells.ts`, new `refAdjust.ts`)
- **T30** Copy/paste fidelity with Excel and Google Sheets HTML (styles, merges, borders, number formats) and plain TSV. Within a workbook, formulas are pasted with adjusted references.
- **T31** Paste Special: values, formats, formulas, column widths, transpose, skip blanks, and add/subtract/multiply/divide.
- **T32** Cut/paste and drag-moving cells rewrite dependent references across sheets, as Excel does.
- **T33** Inserting or deleting rows, columns or sheets and renaming sheets rewrites every reference: formulas, names, conditional formatting, data validation and charts. `#REF!` appears on deletion.

### P8 · Navigation and sheets (`searchReplace.ts`, `sheet.ts`, SearchReplace, SheetTab, new GoTo dialog)
- **T34** Find & Replace: all sheets, match case, entire cell, look in formulas or values, find all with a result list.
- **T35** Go To (Ctrl+G / F5) and Go To Special (blanks, constants, formulas by type, visible cells, current region, differences).
- **T36** Sheet operations: duplicate or move a sheet (with reference rewrite), tab colour, hide/unhide dialog, grouped sheets for bulk formatting.
- **T37** Freeze panes parity (freeze at the selection, top row, first column, unfreeze) and split panes.

### P9 · Format Cells and number formats (`format.ts`, new FormatCells dialog, Toolbar format menu)
- **T38** Format Cells dialog (Ctrl+1) with Number, Alignment, Font, Border, Fill and Protection tabs, and a custom format editor with a live preview.
- **T39** Format inference: `=A1+7` over a date gives a date, `=B1*C1` with currency gives currency, and percent follows the same rule, as in Excel.
- **T40** General format fits the column width (fewer digits, then `####` for numbers and dates that don't fit).
- **T41** Toolbar number-format menu with Excel's list and previews; increase/decrease decimals works on every format.
- **T42** Cell styles gallery (Normal, Good/Bad/Neutral, Headings, Total, Currency, Percent) and a sticky format painter on double-click.

### P10 · Editing modes and undo (`keyboard.ts`, `InputBox`, history)
- **T43** Excel Enter, Edit and Point modes: arrows commit in Enter mode, move the caret in Edit mode, and pick references in Point mode; F2 toggles between modes; a status indicator.
- **T44** Tab and Enter inside the editor wrap within a multi-cell selection; value autocomplete also works in the formula bar.
- **T45** End mode (End then an arrow key) and Ctrl+Shift+Arrow in Point mode.
- **T46** Undo/redo audit for every phase 1 and phase 2 feature (spill, names, CF, fill, paste special) and grouping of multi-step operations into one undo step.

### P11 · Performance, round 2 (`canvas.ts`, render/context plumbing)
- **T47** Blit scrolling with frozen panes (redraw only the newly exposed strips in each pane).
- **T48** Stop full-tree re-renders: selector-based subscriptions (e.g. `useSyncExternalStore`) for Toolbar, SheetOverlay, headers and the status bar.
- **T49** Load time: lazy per-sheet initialisation, cheaper `setCellValue`/immer paths, and a 1M-cell load benchmark.
- **T50** Row/column geometry via prefix sums and binary search so that 1M-row sheets scroll smoothly; canvas state batching.

### P12 · Charts (new `core/src/modules/chart.ts`, React chart layer, reusing `excel/src/chart` renderers)
- **T51** Chart objects in the sheet: insert from the selection (column, bar, line, area, pie, doughnut, scatter), move, resize, delete, undo.
- **T52** Charts update live when their source data changes, and series references are rewritten on insert/delete.
- **T53** Chart editor panel (type, series, axis titles, legend, data labels, colours).
- **T54** Charts in xlsx import (as live charts, not images) and export.

### P13 · Excel and CSV I/O (`packages/excel`)
- **T55** Export fidelity: formulas (with `_xlfn.` / `_xlws.` prefixes for new functions), number formats, merges, sizes, freeze, hidden rows and columns, hyperlinks, comments, CF and DV.
- **T56** Import fidelity: shared formulas, array and dynamic-array formulas (`_xlfn._xlws`, `cm` metadata), theme and indexed colours, rich text, defined names (via P3's model).
- **T57** CSV/TSV import and export (delimiter and encoding detection, locale numbers and dates), with a toolbar menu.
- **T58** A round-trip test suite over fixture workbooks (import → export → import equality).

### P14 · UI and UX, round 2 (status bar, context menu, comments, headers)
- **T59** Status bar parity: Average, Count, Numerical Count, Min, Max and Sum, user-selectable via right-click, locale formatting.
- **T60** Context menu parity: insert/delete cells with a shift direction, row height and column width dialogs, hide/unhide, Format Cells entry, Excel ordering and icons.
- **T61** Autofit: double-clicking a column or row border fits the content; rows grow automatically for wrapped text; hidden cells and merges are respected.
- **T62** Notes and comments polish: hover indicators, edit/delete, show all, and dark-theme styling for the sticky-note colour.

### P15 · Quality infrastructure (CI, types, lint, e2e, docs)
- **T63** Make `tsc --noEmit` pass (React types resolution, strictness fixes) and add typecheck and lint for every package to CI; fix `formula-parser` lint (`babel-eslint`).
- **T64** Playwright e2e suite on the static Storybook build (formulas, spill, autocomplete, keyboard, theme, CF, paste) that runs in CI; docs updates for all new options and shortcuts.

## Phase 3: in progress (15 streams, T65–T119)

Close the fixable phase 2 gaps and add the Excel features that are still
missing entirely. Same rules as before. In addition, features plug into shared
code through the extension registries instead of editing it:

* `registerCellDecorator` (core): draw cell backgrounds, replacement content or foreground marks on the canvas.
* `registerShortcut` (core): keyboard shortcuts.
* `registerToolbarItem` / `registerSheetOverlay` (react): toolbar items and components in the cell area.
* `registerContextMenuAction` (react): context-menu entries.
* `sheetExportFeatures` / `sheetImportFeatures` (excel): xlsx writers and readers.

### R1 · Images in cells
- **T65** `IMAGE(source, [alt_text], [sizing], [height], [width])` renders the picture inside the cell (sizing 0–3, async load and cache, placeholder while loading, `#VALUE!` on bad input, spills for arrays).
- **T66** Place in Cell / Place over Cells: insert a picture into a cell from a file, URL or clipboard paste; convert between the two modes; alt text; picture cells copy, sort, filter and fill like values.
- **T67** xlsx: in-cell pictures (`xl/richData`, `vm` metadata) and `_xlfn.IMAGE` import/export.
- **T68** Image cells in the formula bar, tooltips, zoom, dark theme and printing.

### R2 · PivotTables
- **T69** PivotTable model and Create dialog (source range or table, new or existing sheet).
- **T70** Fields pane: rows, columns, values (Sum/Count/Average/Max/Min/Product/StdDev/Var, % of total/row/column), filters; drag and drop; compact/outline/tabular layouts; subtotals and grand totals; sorting; label and value filters.
- **T71** Refresh, drill-down (double-click a value → detail sheet), date grouping (years/quarters/months), number formats.
- **T72** `GETPIVOTDATA`; xlsx import/export of pivot tables (definitions where feasible, values otherwise).

### R3 · Outline and subtotals
- **T73** Group/Ungroup rows and columns (Shift+Alt+→/←), outline levels 1–8, +/− and level buttons in an outline gutter, collapse/expand.
- **T74** Data › Subtotal dialog (at each change in, function, add to columns, replace current, summary below) and Remove All.
- **T75** Auto Outline, Clear Outline, summary position settings; xlsx `outlineLevel`/`collapsed`/`summaryBelow` round-trip.

### R4 · Formula auditing and calculation
- **T76** Trace Precedents/Dependents arrows (including a cross-sheet marker), Remove Arrows.
- **T77** Show Formulas (Ctrl+`), Evaluate Formula dialog (step through evaluation), Watch Window.
- **T78** Error-checking indicators (number stored as text, inconsistent formula, formula omits adjacent cells, unlocked formula cells) with a smart-tag menu (convert to number, ignore error, help) and rule settings.
- **T79** Calculation options: Automatic / Manual with F9, Shift+F9 and Ctrl+Alt+F9; iterative calculation (max iterations / max change) for circular references; circular-reference status indicator.

### R5 · Sparklines
- **T80** Line, column and win/loss sparklines drawn in cells (markers for high/low/first/last/negative, axis, colours, empty-cell handling).
- **T81** Insert Sparklines dialog and sparkline editing (group, ungroup, clear, style).
- **T82** xlsx `x14:sparklineGroups` round-trip.

### R6 · Charts, round 2
- **T83** More chart types: combo charts with a secondary axis, radar, bubble, waterfall, histogram, funnel, stock.
- **T84** Trendlines (linear, exponential, logarithmic, polynomial, moving average, equation and R²), error bars, data-label formats.
- **T85** Charts follow their cells: cell shifts, moves, row/column resize and hide ("move and size with cells"); fixes the phase 2 gap.
- **T86** Chart style and colour galleries, copy chart as image, export PNG/SVG.

### R7 · Cell controls and data tools
- **T87** Excel cell checkboxes (Insert › Checkbox): boolean cells render as checkboxes, toggled by click or Space; xlsx round-trip.
- **T88** Flash Fill (Ctrl+E): infer split, combine and reformat patterns from examples.
- **T89** What-If: Goal Seek dialog and one- and two-variable Data Tables.
- **T90** Advanced Filter (criteria range, filter in place or copy to, unique records only).

### R8 · Page layout and printing
- **T91** Page Setup model and dialog: orientation, paper size, margins, fit-to-pages scaling, print area, print titles, centring, gridlines/headings, headers/footers with codes (`&P &N &D &T &F &A`).
- **T92** Page Break Preview: page break lines and manual page breaks (insert/remove/drag).
- **T93** Print and export to PDF: paginated, print-ready rendering and the browser print flow.
- **T94** xlsx `pageSetup`/`pageMargins`/`printOptions`/`headerFooter`/`rowBreaks`/`colBreaks` round-trip.

### R9 · Protection and view options
- **T95** Protect Sheet with password and allowed actions, enforced for every edit path (cells, formats, rows/columns, sort, filter, objects); locked cells; hidden formulas hidden in the formula bar; Allow Edit Ranges.
- **T96** Protect Workbook structure (no add/delete/rename/move/hide sheets).
- **T97** View options: gridlines, headings and formula bar toggles, zoom to selection, right-to-left sheets.
- **T98** xlsx `sheetProtection`/`workbookProtection` round-trip (SHA-512 password hashes).

### R10 · Performance, round 3
- **T99** Chunked row storage, so an edit no longer copies the whole row array (about 50 ms at 1M rows).
- **T100** Anchor index for spills, so row/column insert/delete don't scan the whole sheet.
- **T101** Blit scrolling with merged cells crossing the freeze line and with CF data bars/icons (clip-correct redraw).
- **T102** Time-sliced recalculation of long dependency chains (no frozen UI, progress indicator).

### R11 · Editing gaps
- **T103** Freeze Panes from the scrolled position (Excel semantics).
- **T104** Point mode across sheets: click another sheet's tab while editing a formula and pick references there.
- **T105** Cut/paste and moves carry autofilter ranges and filter state.
- **T106** Formula bar: expand/collapse and resize, Ctrl+Shift+U, multi-line editing with line breaks.
- **T107** Autocomplete for table names and columns, defined names and sheet names while typing formulas; clicking an argument in the hint selects it.

### R12 · Threaded comments
- **T108** Threaded comments (author, time, replies, resolve/reopen, edit/delete) separate from notes, a cell indicator and a Comments pane.
- **T109** @mentions through a host-provided user list and events.
- **T110** xlsx `threadedComments`/`persons` round-trip with a legacy note fallback.

### R13 · Shapes and text boxes
- **T111** Shapes (rectangle, rounded rectangle, ellipse, line, arrow, triangle, callout) and text boxes with rich text: move, resize, rotate, z-order, group; fill, outline and shadow.
- **T112** xlsx DrawingML shapes and text boxes round-trip.

### R14 · Tables and slicers
- **T113** Slicers for tables: button panels that filter table rows (multi-select, clear, styles, resize).
- **T114** Table polish: filter buttons in headers, total-row function dropdown, calculated columns (a formula typed in a column fills the whole column), resize handle, table styles gallery.
- **T115** xlsx round-trip of table filters, calculated columns and slicers where feasible.

### R15 · I/O robustness and localisation
- **T116** Fill the remaining exceljs gaps through zip post-processing (list validation "show dropdown", tables without data rows, any other dropped attributes).
- **T117** Localise the excel package's toolbar, import and export labels.
- **T118** xlsx import robustness corpus: generated fixtures for every feature, no crashes, fidelity checks.
- **T119** Import performance for large xlsx files (100k+ cells): measured, streamed, and off the main thread where possible.

## Phase 4: later

* A web-worker calculation engine and multi-threaded recalculation.
* Collaborative editing hardening (operational transforms for formulas, presence).
* Power Query-like data import.
