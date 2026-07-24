import type { Sheet } from "@lofcz/tinysheet-core";

export type ExcelImportSizing = {
  id: string;
  columnlen?: Record<string, number>;
  rowlen?: Record<string, number>;
};

export type ExcelImportResult = {
  sheets: Sheet[];
  sizing: ExcelImportSizing[];
};
