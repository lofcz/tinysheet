import React, { useLayoutEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Workbook, WorkbookInstance } from "@lofcz/tinysheet-react";
import {
  applyExcelImport,
  parseExcelInWorker,
  ExcelImportResult,
} from "@lofcz/tinysheet-excel";
import { Table50k, AutoFilter50k } from "../../stories/LargeTable.stories";

function Imported() {
  const ref = useRef<WorkbookInstance>(null);
  const [result, setResult] = useState<ExcelImportResult>();
  const [error, setError] = useState("");
  useLayoutEffect(() => {
    if (!result || !ref.current) return;
    applyExcelImport(ref.current, result);
    Object.defineProperty((window as any).__largeTable, "workbook", {
      get: () => ref.current,
    });
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        (window as any).__largeTable.ready = performance.now();
      })
    );
  }, [result]);
  return result ? (
    <div style={{ height: "100vh" }}>
      <Workbook ref={ref} data={result.sheets} />
    </div>
  ) : (
    <>
      <button
        type="button"
        onClick={async () => {
          const worker = new Worker(
            new URL("./import.worker.js", location.href),
            { type: "module" }
          );
          const metrics = { started: performance.now(), parsed: 0 };
          (window as any).__largeTable = metrics;
          try {
            const bytes = await (
              await fetch("./large-table.xlsx")
            ).arrayBuffer();
            const parsed = await parseExcelInWorker(
              worker,
              bytes,
              "large-table.xlsx"
            );
            metrics.parsed = performance.now();
            setResult(parsed);
          } catch (e) {
            setError(String(e));
          } finally {
            worker.terminate();
          }
        }}
      >
        Import workbook
      </button>
      <div role="alert">{error}</div>
    </>
  );
}

const Root = location.search.includes("import")
  ? Imported
  : location.search.includes("autofilter")
    ? AutoFilter50k
    : Table50k;
createRoot(document.getElementById("root")!).render(<Root />);
