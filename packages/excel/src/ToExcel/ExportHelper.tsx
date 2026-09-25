import React from "react";
import { excelIoLocale } from "@lofcz/tinysheet-core";
import { transformFortuneToExcel } from "../common/Transform";
import { IFileType } from "../common/ICommon";
import type { SheetExportOptions } from "./ExcelFile";

const exportHelperStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  visibility: "hidden",
  backgroundColor: "#fff",
  color: "#000",
  textAlign: "start",
  borderRadius: "4px",
  fontSize: "12px",
  position: "absolute",
  zIndex: 26,
  top: "40px",
  whiteSpace: "nowrap",
  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.35)",
  left: "50px",
};

const unstyledButtonStyle: React.CSSProperties = {
  width: "100%",
  background: "none",
  border: "none",
  margin: 0,
  font: "inherit",
  color: "inherit",
  cursor: "pointer",
  padding: "6px 12px",
  outline: "none",
  fontFamily: "Arial, Helvetica, sans-serif",
  textAlign: "left",
};

type ExportEntry = {
  key: string;
  label: string;
  fileType: IFileType;
  options?: SheetExportOptions;
};

const getExportButton = (
  entry: ExportEntry,
  onClick: (clicked: ExportEntry) => void
) => {
  return (
    <button
      key={entry.key}
      type="button"
      style={unstyledButtonStyle}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = "#ededed";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = "#fff";
      }}
      onClick={() => onClick(entry)}
    >
      {entry.label}
    </button>
  );
};

interface ExportHelperProps {
  sheetRef: React.RefObject<any>;
  config: { xlsx?: boolean; csv?: boolean; tsv?: boolean };
  /** UI language (English fallback). */
  lang?: string | null;
  /** Called when an export fails (default: console and window.alert). */
  onError?: (error: unknown, message: string) => void;
}

export const ExportHelper: React.FC<ExportHelperProps> = (props) => {
  const { sheetRef, config, lang, onError } = props;
  const t = excelIoLocale(lang);
  const onMouseLeave = () => {
    const exportHelper = document.querySelector(
      ".export-helper"
    ) as HTMLElement;
    if (exportHelper) exportHelper.style.visibility = "hidden";
  };
  const onClick = (entry: ExportEntry) => {
    onMouseLeave();
    transformFortuneToExcel(
      sheetRef,
      entry.fileType,
      true,
      entry.options
    ).catch((error) => {
      if (onError) {
        onError(error, t.exportFailed);
        return;
      }
      // eslint-disable-next-line no-console
      console.error(error);
      if (typeof window !== "undefined" && typeof window.alert === "function")
        window.alert(t.exportFailed);
    });
  };

  const entries: ExportEntry[] = [];
  if (config.xlsx) {
    entries.push({
      key: "xlsx",
      label: t.exportXlsx,
      fileType: IFileType.XLSX,
    });
  }
  if (config.csv) {
    entries.push({
      key: "csv",
      label: t.exportCsv,
      fileType: IFileType.CSV,
    });
    entries.push({
      key: "csv-raw",
      label: t.exportCsvRaw,
      fileType: IFileType.CSV,
      options: { csv: { values: "raw" } },
    });
  }
  if (config.tsv) {
    entries.push({
      key: "tsv",
      label: t.exportTsv,
      fileType: IFileType.TSV,
    });
  }

  return (
    <div
      className="export-helper"
      style={exportHelperStyle}
      onMouseLeave={onMouseLeave}
    >
      {entries.map((entry) => getExportButton(entry, onClick))}
    </div>
  );
};
