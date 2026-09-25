import { excelIoLocale } from "@lofcz/tinysheet-core";
import ExportIcon from "../icons/ExportIcon";
import ImportIcon from "../icons/ImportIcon";

export type ExcelToolbarItemOptions = {
  /** UI language ("en", "zh", "zh-TW", "es", "ru", "hi"; English fallback). */
  lang?: string | null;
};

export const exportToolBarItem = (options: ExcelToolbarItemOptions = {}) => {
  return {
    key: "export",
    tooltip: excelIoLocale(options.lang).exportTooltip,
    icon: ExportIcon(),
    onClick: async () => {
      const exportHelper = document.querySelector(
        ".export-helper"
      ) as HTMLElement;
      if (!exportHelper) return;
      const visibility = exportHelper.style.visibility;
      exportHelper.style.visibility =
        visibility === "visible" ? "hidden" : "visible";
    },
  };
};

export const importToolBarItem = (options: ExcelToolbarItemOptions = {}) => {
  return {
    key: "import",
    tooltip: excelIoLocale(options.lang).importTooltip,
    icon: ImportIcon(),
    onClick: () => {
      document.getElementById("ImportHelper")?.click();
    },
  };
};
