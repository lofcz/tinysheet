import React, { useLayoutEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Workbook, WorkbookInstance } from "@lofcz/tinysheet-react";
import {
  getSourceMatrixStats,
  createMatcher,
  matchFilterOperator,
} from "@lofcz/tinysheet-core";
import {
  applyExcelImport,
  parseExcelInWorker,
  ExcelImportResult,
} from "@lofcz/tinysheet-excel";
import { Table50k, AutoFilter50k } from "../../stories/LargeTable.stories";

(window as any).__auditWildcards = () => {
  const pattern = "*a".repeat(16) + "b";
  const text = "a".repeat(48);
  return [
    createMatcher(pattern)!.test(text),
    matchFilterOperator({ v: text }, "contains", pattern),
    createMatcher(pattern)!.test(text + "b"),
  ];
};

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
    (window as any).__largeTable.sourceStats = () =>
      getSourceMatrixStats(result.sheets[0].data!);
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
          worker.addEventListener("message", (event) => {
            Object.assign(metrics, { worker: event.data.benchmark });
          });
          try {
            const bytes = await (
              await fetch(
                location.search.includes("shared")
                  ? "./large-table-shared.xlsx"
                  : "./large-table.xlsx"
              )
            ).arrayBuffer();
            const parsed = await parseExcelInWorker(
              worker,
              bytes,
              "large-table.xlsx"
            );
            metrics.parsed = performance.now();
            if (location.search.includes("slicer")) {
              parsed.sheets[0].tables![0].slicers = [
                {
                  name: "Slicer_ID",
                  column: "ID",
                  caption: "IDs",
                  r: 1,
                  c: 2,
                  offsetX: 0,
                  offsetY: 0,
                  width: 220,
                  height: 300,
                  columnCount: 2,
                  buttonHeight: 26,
                },
              ];
            }
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
