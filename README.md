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
bun run lint && bun run tsc
```

## License

MIT. Fork of [FortuneSheet](https://github.com/ruilisi/fortune-sheet).
