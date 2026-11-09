<p align="center"><img src="logo.png" width="120" height="120" /></p>
<h1 align="center">TinySheet</h1>
<p align="center">Excel-like spreadsheet component for React.</p>
<p align="center">
  <a href="https://lofcz.github.io/tinysheet/">Demo</a> ·
  <a href="https://lofcz.github.io/tinysheet/docs/">Docs</a> ·
  <a href="https://npmjs.com/package/@lofcz/tinysheet-react"><img src="https://img.shields.io/npm/v/@lofcz/tinysheet-react" alt="npm" /></a>
</p>

## Features

- 470+ Excel functions, dynamic arrays, `LET`, `LAMBDA`
- Excel keyboard model, fill handle, copy/paste with Excel and Google Sheets
- Tables, pivot tables, charts, sparklines, conditional formatting
- Pictures in cells, shapes, threaded comments, outlines, protection
- xlsx import/export (`@lofcz/tinysheet-excel`)
- Light/dark themes, 1M+ rows
- Collaboration through `onOp` / `applyOp`

The Excel adapter, regression tests, and benchmarks use [`@lofcz/ts-xlsx`](https://github.com/lofcz/ts-xlsx) for workbook reading, writing, and native chart packaging. `parseExcel`, `exportToXlsx`, and the download helpers retain their signatures. `buildExcelWorkbook` and feature contexts expose the ts-xlsx workbook model; use `writeXlsx(workbook)` to serialize it.

## Preserving imported workbooks

`parseExcel` retains a JSON-safe `preservation` object by default. Use
`captureExcelWorkbook(workbookRef.current)` to capture
live sheets together with their import metadata. `applyExcelImport` and
`applyExcelImportHydration` restore that metadata; mounted download helpers carry
it automatically. For headless export, pass it explicitly:

```ts
const imported = await parseExcel(bytes);
// Edit imported.sheets, and persist the whole result when saving.
const output = await exportToXlsx(imported.sheets, {
  preservation: imported.preservation,
  onDiagnostic: diagnostic => console.warn(diagnostic.message),
});
```

The original package lets the fork retain features outside the editor model
while applying actual edits. Macro-enabled originals download as `.xlsm`.
Set `{preserve: false}` to omit it from saved documents. Original bytes are
workbook content and can include features the editor does not display.

For large browser imports, use `parseExcelInWorker` with a module worker that
calls `exposeParseExcelWorker` (the demo shows this integration). The worker
indexes the original XML and transfers compact row/cell offsets with metadata.
Mount `result.sheets`, then call `applyExcelImport` after the workbook mounts.
Cells, table formatting and borders are decoded as requested; edits use the
core's copy-on-write rows and undo history. Import does not create a second
workbook or serialize a full cell snapshot.

`sheet.data[r][c]` reads the source-backed matrix. Reading `sheet.celldata`
explicitly materializes the legacy sparse representation and gives its mutable
cells to the caller. Full export or JSON serialization also requests all cells.
The preservation baseline is reconstructed from the original package on save;
previously saved version 1 and 2 preservation metadata remains supported.

Version 3 uses native fork APIs for charts/chart sheets, shapes, cell images,
checkboxes, sparklines, dynamic arrays, threaded comments and advanced conditional
formatting. These no longer run as ZIP post-processors. Plugins that ordered
processors relative to the removed steps should register a workbook/sheet export
feature or anchor to one of the remaining `xlsxPostProcessors`.

## Install

```sh
npm install @lofcz/tinysheet-react
```

Requires React 19.3+.

## Use

```tsx
import { Workbook } from "@lofcz/tinysheet-react";
import "@lofcz/tinysheet-react/dist/index.css";

<div style={{ height: "100vh" }}>
  <Workbook data={[{ name: "Sheet1" }]} />
</div>;
```

## Localization

`<Workbook lang={userLocale} />` follows the host language, including changes after mount.
Supported UI languages are Czech (`cs`), Slovak (`sk`), Polish (`pl`), and English (`en`).
Regional tags such as `cs-CZ` and `sk_SK` are accepted; unsupported languages use English.
Excel function names and formula syntax remain standard Excel identifiers.

Catalogs live in `packages/core/src/i18n/{locale}/{namespace}/index.ts`, using
`typesafe-i18n` aliased to the same `@lofcz/typesafe-i18n@5.27.4` fork as ScioBot and Fika.
Run `bun run i18n:build` after editing the English catalog; package builds also run codegen.
Use `getLL(locale)` from core for typed interpolation. Existing string-based locale
accessors share the generated catalogs through a cached compatibility view.

## Packages

| Package | |
| --- | --- |
| `@lofcz/tinysheet-react` | React component |
| `@lofcz/tinysheet-core` | Model, formulas, rendering |
| `@lofcz/tinysheet-excel` | xlsx import/export |
| `@lofcz/tinysheet-formula-parser` | Formula engine |

## Develop

```sh
bun install
bun run demo        # demo app
bun run storybook   # stories
bun run docs        # docs site
bun run test        # unit tests (also: test:excel, test:e2e)
bun run test:perf   # production Chromium: ts-xlsx-generated 50k-row workbook
bun run lint && bun run tsc
```

## License

MIT. Fork of [FortuneSheet](https://github.com/ruilisi/fortune-sheet).
