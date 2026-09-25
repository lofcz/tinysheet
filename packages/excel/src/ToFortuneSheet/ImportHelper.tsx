import React from "react";
import { excelIoLocale } from "@lofcz/tinysheet-core";
import { transformExcelToFortune } from "../common/Transform";
import { ExcelImportError } from "../parse/parseExcel";

const fill = (text: string, name: string) => text.replace(/\{name\}/g, name);

/** The localized message for a failed import. */
export function importErrorMessage(
  error: unknown,
  fileName: string,
  lang?: string | null
) {
  const t = excelIoLocale(lang);
  if (error instanceof ExcelImportError) {
    if (error.code === "unsupported-format")
      return fill(t.errorUnsupportedFormat, fileName);
    if (error.code === "not-a-zip") return fill(t.errorNotAZip, fileName);
    if (error.code === "no-workbook") return fill(t.errorNoWorkbook, fileName);
  }
  return fill(t.importFailed, fileName);
}

export type ImportErrorHandler = (error: unknown, message: string) => void;

const alertError: ImportErrorHandler = (error, message) => {
  // eslint-disable-next-line no-console
  console.error(error);
  if (typeof window !== "undefined" && typeof window.alert === "function") {
    window.alert(message);
  }
};

export const ImportHelper = (props: any) => {
  const { setSheets, setKey, sheetRef, config, lang, onError } = props;
  const acceptTypes = [
    config.xlsx ? ".xlsx" : "",
    config.csv ? ".csv" : "",
    config.tsv ? ".tsv,.tab,.txt" : "",
  ]
    .filter(Boolean)
    .join(",");
  return (
    <input
      type="file"
      id="ImportHelper"
      accept={acceptTypes}
      onChange={async (e) => {
        const input = e.currentTarget;
        const file = input?.files?.[0];
        try {
          await transformExcelToFortune(file, setSheets, setKey, sheetRef);
        } catch (error) {
          const handler: ImportErrorHandler = onError ?? alertError;
          handler(error, importErrorMessage(error, file?.name ?? "", lang));
        }
        // Allow importing the same file again.
        if (input) input.value = "";
      }}
      hidden
    />
  );
};
