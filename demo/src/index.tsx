import React, { useCallback, useLayoutEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Sheet } from "@lofcz/tinysheet-core";
import { Workbook, WorkbookInstance } from "@lofcz/tinysheet-react";
import type { ExcelImportResult, applyExcelImport } from "demo-excel";
import { sample } from "./sample";
import "./index.css";

/** Save bytes as a download. */
function download(data: BlobPart, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const XLSX_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const App: React.FC = () => {
  const ref = useRef<WorkbookInstance>(null);
  // a new key mounts a fresh workbook (File > New / Open)
  const [book, setBook] = useState<{
    key: number;
    data: Sheet[];
    imported?: ExcelImportResult;
    hydrate?: typeof applyExcelImport;
  }>({
    key: 0,
    data: sample,
  });
  const [title, setTitle] = useState("Sales");
  useLayoutEffect(() => {
    if (ref.current && book.imported)
      book.hydrate?.(ref.current, book.imported);
  }, [book]);

  const onNewWorkbook = useCallback(() => {
    setTitle("Book1");
    setBook((b) => ({ key: b.key + 1, data: [{ name: "Sheet1" }] }));
  }, []);

  // File > Open: .xlsx through the excel package (loaded on demand), .csv
  // as one sheet
  const onOpenFile = useCallback(async (file: File) => {
    const excel = await import("demo-excel");
    const name = file.name.replace(/\.[^.]+$/, "");
    if (/\.(csv|tsv|txt)$/i.test(file.name)) {
      const { sheet } = await excel.parseCsv(file);
      setTitle(name);
      setBook((b) => ({
        key: b.key + 1,
        data: [{ ...sheet, name } as unknown as Sheet],
      }));
      return;
    }
    const worker = new Worker(new URL("./excel.worker.ts", import.meta.url), {
      type: "module",
    });
    let result: ExcelImportResult;
    try {
      result = await excel.parseExcelInWorker(worker, file, file.name);
    } finally {
      worker.terminate();
    }
    setTitle(name);
    setBook((b) => ({
      key: b.key + 1,
      data: result.sheets,
      imported: result,
      hydrate: excel.applyExcelImport,
    }));
  }, []);

  // File > Save As
  const onSaveAs = useCallback(
    async (format: "xlsx" | "csv") => {
      const wb = ref.current;
      if (!wb) return;
      const excel = await import("demo-excel");
      if (format === "xlsx") {
        const bytes = await excel.exportToXlsx(wb.getAllSheets(), {
          preservation: wb.getWorkbookMetadata()?.xlsxPreservation,
        });
        download(bytes as BlobPart, `${title}.xlsx`, XLSX_TYPE);
      } else {
        const sheet = wb.getSheet();
        download(
          excel.exportCsv(sheet),
          `${sheet.name ?? title}.csv`,
          "text/csv"
        );
      }
    },
    [title]
  );

  return (
    // Uncontrolled theme: starts from the OS preference; View > Theme
    // (Light / Dark / System) changes it.
    <Workbook
      key={book.key}
      ref={ref}
      data={book.data}
      defaultTheme="auto"
      onNewWorkbook={onNewWorkbook}
      onOpenFile={onOpenFile}
      onSaveAs={onSaveAs}
    />
  );
};

createRoot(document.getElementById("root")!).render(<App />);
