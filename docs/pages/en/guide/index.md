# Get started

TinySheet is an Excel-like spreadsheet component for React (a fork of
FortuneSheet). [Live demo](https://lofcz.github.io/tinysheet/)

## Install

```sh
npm install @lofcz/tinysheet-react
```

Requires React 19.3+.

## Use

```tsx
import { Workbook } from "@lofcz/tinysheet-react";
import "@lofcz/tinysheet-react/dist/index.css";

export default function App() {
  return (
    <div style={{ width: "100%", height: "100vh" }}>
      <Workbook data={[{ name: "Sheet1" }]} />
    </div>
  );
}
```

The container needs a size; the workbook fills it.

## Excel files

```sh
npm install @lofcz/tinysheet-excel
```

Import and export `.xlsx`, including charts, tables, pivot tables, comments
and images.

## Next

- [Configuration](./config.md): `Workbook` props
- [Sheet](./sheet.md) and [Cell](./cell.md): the data model
- [Operations](./op.md): `onOp` / `applyOp` for storage and collaboration
- [API](./api.md): the workbook ref methods
- [Functions](./functions.md) and [Keyboard shortcuts](./shortcuts.md)
