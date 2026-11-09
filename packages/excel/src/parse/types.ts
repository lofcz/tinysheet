import type { Sheet } from "@lofcz/tinysheet-core";
import type { XlsxPreservation } from "../preservation";
import type { ExcelSource } from "./source";

export type ExcelImportSizing = {
  id: string;
  columnlen?: Record<string, number>;
  rowlen?: Record<string, number>;
};

export type ExcelImportResult = {
  sheets: Sheet[];
  sizing: ExcelImportSizing[];
  preservation?: XlsxPreservation;
  source?: ExcelSource;
};
