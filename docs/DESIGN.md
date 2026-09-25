# TinySheet UI design spec

TinySheet is the spreadsheet of an office suite with **Fika** (slides,
github.com/lofcz/fika, local clone at /home/user/lofcz/fika) and a Plate fork
(documents). The three must look like one product: Fika's ink/nordic chrome,
Excel's structure and behaviour.

Source of truth for style: Fika `src/assets/styles/variable.scss`,
`src/views/Editor/index.module.scss` (pane layout), `src/views/Editor/CanvasTool`
(tool clusters), `src/components/{Tabs,Popover,Modal,Select,Contextmenu,...}`.
Icons: **lucide-react** (Fika uses it), 16px, stroke 1.75. No other icon sets,
no emoji, no colored icons except color swatches/indicators.

## Tokens (CSS variables on the workbook root, `--ts-*`)

| Token | Light | Dark |
| --- | --- | --- |
| `--ts-ink` (primary, active pill bg) | `#18181b` | `#fafafa` |
| `--ts-on-ink` (text on ink) | `#ffffff` | `#18181b` |
| `--ts-text` | `#3f3f46` | `#e4e4e7` |
| `--ts-text-strong` | `#18181b` | `#fafafa` |
| `--ts-muted` | `#71717a` | `#a1a1aa` |
| `--ts-surface` (app bg, cluster bg) | `#f4f4f5` | `#09090b` |
| `--ts-pane` (panes, menus, dialogs) | `#ffffff` | `#18181b` |
| `--ts-hover` | `#ececee` | `#27272a` |
| `--ts-active` | `#e4e4e7` | `#3f3f46` |
| `--ts-border` | `#e4e4e7` | `#27272a` |
| `--ts-ring` (focus) | `#c4c4cc` | `#52525b` |
| `--ts-accent` (selection, links) | `#2563eb` | `#60a5fa` |
| `--ts-danger` | `#dc2626` | `#f87171` |
| `--ts-shadow` | `0 8px 24px rgba(24,24,27,.08), 0 2px 6px rgba(24,24,27,.04)` | `0 8px 24px rgba(0,0,0,.5)` |
| `--ts-pane-shadow` | `0 1px 2px rgba(24,24,27,.04)` | `none` |

Radii: controls 8px, panes/popovers 12px, dialogs 16px. Pane gap 8px.
Motion: 150ms ease for hover/color, `cubic-bezier(0.16,1,0.3,1)` 420ms for pills.
UI font: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`, 13px UI, 12px secondary, 11px group labels.
Grid (canvas): Excel-like — white/`#1c1c1f` cells, gridlines `#e4e4e7`/`#2e2e33`,
headers on `--ts-surface` (dark `#141417`) with `--ts-muted` 12px UI-font labels
and `--ts-header-line` separators. Headers of the selection: accent-soft tint
(accent 10%, dark 16%), `--ts-text-strong` label and a 2px accent edge on the
side facing the cells; a fully selected row/column is stronger (accent 20%,
accent label); Select All shows a triangle, accent when all is selected.
Selection: 2px `--ts-accent` border on the range's grid lines, fill
`rgba(accent, .08)` with the active cell left clear, fill handle a 6px accent
square with a 1px `--ts-cell` ring; several ranges (Ctrl) show fills only and
an outlined active cell. Copy marquee: marching ants (2px accent dashes).
Formula references: Excel's order and colours (blue `#5b97ff`, red `#ff616b`,
purple, green, pink, brown, orange, teal), a 2px line, a 10% fill and corner
squares; the same colour in the formula text. Frozen panes: a 1px darker line
(`#a1a1aa`/`#71717a`). Corner marks (note, error, validation) fill the cell's
corner up to the grid lines on whole pixels. Default cell font
`settings.defaultFontFamily` (`Calibri, Carlito, "Segoe UI", Arial,
sans-serif`) at `settings.defaultFontSize` 11pt; numeric `ff` still indexes the
locale font list. Default currency follows the language (`$` for English).

Dark sheet (like Excel's dark cells / Word's dark mode): Automatic and
near-black text and borders turn light; very light fills (HSL lightness ≥ .85:
white, light greys, pastels) become dark tints of the same hue, lighter ones
staying lighter; strong fills (yellow, gold, accents, mid greys) are kept with
their text; dark saturated text colours are lightened on dark fills
(`resolveCellFill` / `resolveCellTextColor` / `resolveBorderColor`).

## Layout (Fika pane layout)

```
┌ surface bg, 8px padding & gaps ──────────────────────────────────────────┐
│ [ribbon pane: tabs row (pill segmented) + command row]                    │
│ [grid pane: name box | fx | formula bar ─────────────────────────────── ] │
│ [           column headers / grid / scrollbars                ] [side pane]│
│ [bottom pane: ≡ ‹ › | sheet tabs … + | Ready  stats | views | − ━●━ + %]  │
└──────────────────────────────────────────────────────────────────────────┘
```
Panes: `--ts-pane` bg, 1px `--ts-border`, 12px radius, `--ts-pane-shadow`.
Side panes (Comments, Format Shape, PivotTable Fields, Watch Window) dock on the
right as a Fika right pane (resizable separator, 260–360px), never floating.
An embed without chrome space can opt out (`chrome="compact"`: no outer padding).

## Ribbon (Excel structure, Fika look)

Tabs: **File** (menu: New, Open .xlsx, Save as .xlsx/.csv, Print), **Home**,
**Insert**, **Page Layout**, **Formulas**, **Data**, **Review**, **View**.
Tab row = Fika segmented tabs (ink pill slides to the active tab). Command row =
groups laid out like Excel, each group a Fika tool cluster (surface bg, 10px
radius, 3px padding, 2px gap) with an 11px muted label under it. Buttons:
large (icon 20px over label, split arrow below) for primary commands (Paste,
Conditional Formatting, PivotTable, AutoSum…), small 32px icon buttons with
tooltips (name + shortcut) otherwise. Active/toggled = ink bg + on-ink icon.
Responsive: groups collapse right-to-left into a single group dropdown button
(Excel "scaling"), never a random "More" dump. Ribbon can be collapsed to tabs
only (Ctrl+F1, double-click a tab).

- Home: Clipboard (Paste▾, Cut, Copy, Format Painter) · Font (family, size,
  grow/shrink, B I U S, borders▾, fill▾, font color▾) · Alignment (top/middle/
  bottom, left/center/right, wrap, merge▾, rotate▾, indent −/+) · Number (format
  combo, currency, %, comma, .0→ .00) · Styles (Conditional Formatting▾, Format
  as Table▾, Cell Styles▾) · Cells (Insert▾, Delete▾, Format▾) · Editing (AutoSum▾,
  Fill▾, Clear▾, Sort & Filter▾, Find & Select▾)
- Insert: Tables (PivotTable, Table) · Illustrations (Pictures▾ incl. Place in
  Cell, Shapes▾) · Charts (Recommended, column/line/pie/bar/area/scatter/other▾)
  · Sparklines (Line, Column, Win/Loss) · Filters (Slicer) · Links (Link) ·
  Comments (Comment, Note) · Text (Text Box, Header & Footer) · Controls (Checkbox)
- Page Layout: Page Setup (Margins▾, Orientation▾, Size▾, Print Area▾, Breaks▾,
  Print Titles) · Scale to Fit · Sheet Options (Gridlines/Headings view & print)
- Formulas: Function Library (Insert Function, AutoSum▾, category menus) ·
  Defined Names (Name Manager, Define Name, Use in Formula▾) · Formula Auditing
  (Trace Precedents/Dependents, Remove Arrows, Show Formulas, Error Checking,
  Evaluate, Watch Window) · Calculation (Options▾, Calculate Now)
- Data: Sort & Filter (A→Z, Z→A, Sort, Filter, Clear, Advanced) · Data Tools
  (Text to Columns, Flash Fill, Remove Duplicates, Data Validation▾) · Forecast
  (What-If▾) · Outline (Group▾, Ungroup▾, Subtotal)
- Review: Comments (New, Delete, Previous, Next, Show Comments) · Notes▾ ·
  Protect (Protect Sheet, Protect Workbook, Allow Edit Ranges)
- View: Workbook Views (Normal, Page Break Preview, Page Layout) · Show
  (Gridlines, Formula Bar, Headings) · Zoom (Zoom, 100%, Zoom to Selection) ·
  Window (Freeze Panes▾, Split) · Appearance (Theme: Light / Dark / System)

Existing feature toolbar items (`registerToolbarItem`) plug into a named group;
`settings.toolbarItems` keeps working by mapping legacy names to ribbon commands.

## Menus, popovers, dialogs

- Menus/context menus: `--ts-pane`, 1px border, 8px radius, `--ts-shadow`,
  4px padding, 30px rows with 8px radius hover (`--ts-hover`), 16px lucide icon
  column, shortcut right-aligned muted, separators 1px `--ts-border`, submenus
  on hover with 150ms intent delay. Stay inside the viewport. Esc / outside
  click / scroll close. Full keyboard navigation.
- Popovers (color, border, chart gallery…): 12px radius, 10px padding.
  Color picker: Fika swatch grid (ColorSwatches) + custom.
- Dialogs: 16px radius, 20px padding, title 15px semibold, footer right-aligned
  (secondary = surface button, primary = ink button). Focus trap, Esc, Enter.
  Backdrop `rgba(9,9,11,.4)`.
- Buttons: primary ink bg/on-ink text; secondary surface bg; ghost transparent
  with hover. Inputs/selects: surface bg, 8px radius, no border until focus ring.

## Interaction rules

Every drag (fill handle, selection move, range-reference handles, row/column
resize, image/shape/chart/slicer move & resize & rotate, sheet tab reorder,
pane separators, formula bar resize, dialog drag) uses pointer events with
pointer capture, has an e2e test, keeps editor focus where Excel does, and
shows the Excel cursor. Wheel over any popup scrolls that popup, never the grid.

## Implementation map (for contributors)

- **Tokens**: `--ts-*` on `.fortune-container`, `.fortune-modal-container` and
  `.ts-theme-root` (light, `data-theme="dark"`), in
  `packages/react/src/components/Workbook/index.css`. The old `--fortune-*`
  variables are aliases of them; new CSS uses `--ts-*` only. Canvas colours:
  `packages/core/src/theme.ts`.
- **Shell**: `Workbook` renders `.fortune-ribbon-pane`, `.fortune-body`
  (`.fortune-grid-pane` + side pane dock) and `.fortune-bottom-pane`;
  `settings.chrome` = `"suite"` (padded panes) | `"compact"` (embedding).
- **Side panes**: `packages/react/src/components/SidePane` —
  `<SidePane id title open onClose>` or `useSidePane().openSidePane(id, node,
  { title })` / `closeSidePane` / `toggleSidePane` / `isSidePaneOpen`.
- **Icons**: `packages/react/src/components/ui/icons.tsx` — `Icon`,
  `registerIcon(name, LucideIcon)`; `SVGIcon` draws the lucide icon for every
  mapped legacy sprite name.
- **Primitives**: `packages/react/src/components/ui` — Button, IconButton,
  SplitButton, LargeButton, MenuButton, DropdownMenu / MenuList (MenuItem
  model with submenus), Popover, Tooltip, Tabs, Select, Combo, Input,
  NumberInput, Checkbox, Switch, Separator, DialogShell, Dialog.
- **Context menus**: `ContextMenuPopup` (ui) — a `MenuList` at a point
  (`x`, `y` viewport coords, `within` = any workbook element for the theme),
  flips / clamps into the viewport, closes on Esc / outside click / wheel /
  scroll / resize with `onClose(reason)` (`"select"` means an item ran; give
  the focus back to the sheet unless `"outside"`). Every menu uses it: cell,
  row / column header and picture menu (`ContextMenu/index.tsx`, Paste
  Options row in `ContextMenu/PasteOptions.tsx`), sheet tab
  (`ContextMenu/SheetTab.tsx`), chart, shape, slicer; the pivot field chips
  use `DropdownMenu`. Menu entries keep `data-key` = item id; icons by name
  from `ContextMenu/icons.tsx` (`menuIcon(name)`, lucide). The registries
  (`registerContextMenuItem`, `registerContextMenuAction`, the
  `cellContextMenu` / `headerContextMenu` / `sheetTabContextMenu` settings)
  are unchanged. `MenuList` extras: `submenuClassName`; a `type: "custom"`
  row may hold `role="menuitem"` controls (one keyboard stop per row, the
  row handles Left / Right).
- **Pickers & galleries** (ui, for ribbon commands; each is a plain panel,
  put it in a `Popover` / `SplitButton popover` / menu submenu):
  - `<ColorPicker value onChange automaticLabel automaticColor moreColors />`
    — Automatic / No Fill row (`onChange(null)`), Theme Colors 10 × 6 (Office
    theme + Excel's tints / shades, screen tips "Blue, Accent 1, Lighter
    40%"), Standard Colors, Recent Colors (shared, from More Colors…), More
    Colors… = inline Fika custom picker (`CustomColorPanel`: saturation /
    hue / hex). Emits lower-case `#rrggbb`. Arrow keys move in the grid.
    Helpers in `ui/color.ts` (`themeGrid`, `tintShade`, `STANDARD_COLORS`).
  - `<BorderPicker onApply? onClose onMoreBorders? />` — Excel's Borders
    menu (Bottom/Top/Left/Right, No/All/Outside/Thick Outside, double / thick
    bottom, top and bottom variants, Line Color ▸, Line Style ▸, More
    Borders…). Without `onApply` it applies to the selection itself
    (`applyBorderPreset(ctx, preset, line)`); the line setting and the last
    preset are shared (`useBorderLine()`, `useLastBorderPreset()`) so a split
    button's main part can repeat them. `BorderGlyph` draws preset icons.
  - `<Gallery items={[{ id, label, preview, group }]} onPick onPreview?
    selectedId columns itemWidth itemHeight footer?={MenuItem[]} onClose />`
    — grouped tiles with screen tips, hover / focus preview callback, arrow
    keys, footer commands. Used by `TableStyleGallery` / `FormatAsTableGallery`
    (Tables, `useTableStyleItems`), `CellStyles` (`bare` for a popover,
    `useCellStyleItems`) and the conditional formatting presets:
    `useConditionalFormatMenu(close)` returns Excel's whole Conditional
    Formatting menu as `MenuItem[]` (for a `LargeButton menu`).
  - Styles: `ui/pickers.css` (tokens only, light / dark).
- **Ribbon**: `packages/react/src/components/Ribbon` — layout per tab in
  `tabs/*.ts` (`RibbonTab → groups → items`, `{ rows: [[…], […]] }` stacks
  small items, `{ id, size: "large" }` for large buttons); commands with
  `registerRibbonCommand(id, Component)` (an id without a command renders the
  legacy toolbar item of that name); `placeRibbonItem`, `registerRibbonGroup`,
  `registerFileMenuItem`; `settings.ribbon` for a custom layout. Scaling:
  `useRibbonScaling.ts`. Tests: `packages/react/test/ribbonHelpers.ts`
  (`showRibbonItem`), e2e `toolbarButton` / `ribbonItem` / `ribbonTab`.
- **Formula bar**: `packages/react/src/components/FxEditor` — Name Box
  (`NameBox.tsx`, width drag `useNameBoxWidth.ts`), ✕ / ✓ / fx, the formula
  field, expand (Ctrl+Shift+U) and height drag (`useFormulaBarSize.ts`).
  An Insert Function dialog plugs into fx / Shift+F3 with
  `registerInsertFunction(({ context, setContext, refs, showModal, hideModal,
  editor }) => …)` (return false to fall back to the function list);
  `editor` is the element being edited (insert at its caret) or null.
  Reference colours: `referenceColors` in core `color.ts` (also
  `REFERENCE_COLORS`).
- **Bottom bar**: `.fortune-bottom-pane > .fortune-bottom-bar` (layout in
  `StatusBar/index.css`): `SheetTab` (≡ list, ‹ › scroll — Ctrl+click to the
  end, right-click lists sheets — the tab track, +), `StatusBar` (mode,
  aggregates; they drop out first-to-last when narrow) and
  `StatusBar/ViewControls` (Normal / Page Layout / Page Break Preview and
  `ZoomControl`: slider with Excel's scale in `ZoomControl/slider.ts`). One
  row; below 1200px of pane width two rows (tabs above the status bar).
- **Grid look**: canvas palette and cell-colour adaptation in
  `packages/core/src/theme.ts`; headers (selected states) in
  `Canvas.drawRowHeader` / `drawColumnHeader`, repainted alone when only the
  selection changes (`drawHeaders` in `react/src/components/Sheet`); corner
  marks `core/src/modules/cellMarks.ts`; overlays (selection, fill handle,
  marquee, reference boxes, editor, filter buttons, Select All) in
  `react/src/components/SheetOverlay/index.css`. The overlay's origin sits on
  the canvas pixel grid (cell area at `rowHeaderWidth - 1`,
  `columnHeaderHeight - 1`), so DOM borders line up with grid lines at any
  DPR. Reference colours: `referenceColors` (`core/src/modules/color.ts`).
  Fonts: `core/src/modules/fonts.ts` (`defaultFontFamily(ctx)`,
  `cellFontName(ctx, cell)` for font boxes). Tests: e2e `gridVisuals.spec.js`.
