// T117: the excel package's UI strings come from core's excelIo locale.
import test from "node:test";
import assert from "node:assert/strict";
import { excelIoLocale } from "@lofcz/tinysheet-core";
import {
  ExcelImportError,
  exportToolBarItem,
  importErrorMessage,
  importToolBarItem,
} from "../dist/index.js";

const LANGS = ["en", "zh", "zh-TW", "es", "ru", "hi"];

test("every language has every string, with its placeholders", () => {
  const en = excelIoLocale("en");
  for (const lang of LANGS) {
    const t = excelIoLocale(lang);
    for (const key of Object.keys(en)) {
      assert.equal(typeof t[key], "string", `${lang}.${key}`);
      assert.ok(t[key].length > 0, `${lang}.${key}`);
      const placeholders = (s) => (s.match(/\{\w+\}/g) || []).sort();
      assert.deepEqual(
        placeholders(t[key]),
        placeholders(en[key]),
        `${lang}.${key}`
      );
    }
    if (lang !== "en") assert.notEqual(t.importTooltip, en.importTooltip, lang);
  }
});

test("language lookup: regions, contexts and English fallback", () => {
  assert.equal(excelIoLocale("es-MX").importTooltip, "Importar archivo");
  assert.equal(excelIoLocale({ lang: "ru" }).exportTooltip, "Экспорт...");
  assert.equal(excelIoLocale("zh-TW").importTooltip, "匯入檔案");
  assert.equal(excelIoLocale("zh-CN").importTooltip, "导入文件");
  assert.equal(excelIoLocale("xx").importTooltip, "Import file");
  assert.equal(excelIoLocale(null).importTooltip, "Import file");
  assert.equal(excelIoLocale("constructor").importTooltip, "Import file");
});

test("toolbar items and import messages are localized", () => {
  assert.equal(importToolBarItem().tooltip, "Import file");
  assert.equal(importToolBarItem({ lang: "hi" }).tooltip, "फ़ाइल आयात करें");
  assert.equal(exportToolBarItem({ lang: "zh" }).tooltip, "导出...");
  assert.equal(
    importErrorMessage(new ExcelImportError("not-a-zip", "x"), "a.xlsx", "es"),
    "a.xlsx no es un archivo .xlsx."
  );
  assert.match(
    importErrorMessage(
      new ExcelImportError("unsupported-format", "x"),
      "old.xls"
    ),
    /^old\.xls is a legacy \.xls file/
  );
  assert.equal(
    importErrorMessage(new Error("boom"), "b.xlsx", "ru"),
    "Не удалось импортировать b.xlsx."
  );
});
