import {
  headerFooterFromXlsx,
  headerFooterPlainText,
  headerFooterToXlsx,
  parseHeaderFooterSection,
} from "../../src";

const fields = {
  page: 3,
  pages: 7,
  sheetName: "Sales",
  fileName: "Book.xlsx",
  filePath: "/tmp/",
  date: new Date(2026, 0, 2, 13, 5),
  locale: "en-US",
};

describe("header and footer codes", () => {
  test("fields", () => {
    expect(headerFooterPlainText("Page &P of &N", fields)).toBe("Page 3 of 7");
    expect(headerFooterPlainText("&A - &F (&Z&F)", fields)).toBe(
      "Sales - Book.xlsx (/tmp/Book.xlsx)"
    );
    expect(headerFooterPlainText("&P+1 &P-1", fields)).toBe("4 2");
    expect(headerFooterPlainText("&D", fields)).toBe("1/2/2026");
    expect(headerFooterPlainText("&T", fields)).toMatch(/1:05/);
    expect(headerFooterPlainText("R&&D&G", fields)).toBe("R&D");
  });

  test("formatting runs", () => {
    const runs = parseHeaderFooterSection(
      '&"Arial,Bold Italic"&14Title&B plain &U&KFF0000red',
      fields
    );
    expect(runs).toEqual([
      { text: "Title", font: "Arial", bold: true, italic: true, size: 14 },
      { text: " plain ", font: "Arial", bold: false, italic: true, size: 14 },
      {
        text: "red",
        font: "Arial",
        bold: false,
        italic: true,
        size: 14,
        underline: true,
        color: "#ff0000",
      },
    ]);
  });

  test("xlsx sections", () => {
    const hf = { left: "&BLeft", center: "Page &P", right: "&D" };
    const xml = headerFooterToXlsx(hf);
    expect(xml).toBe("&L&BLeft&CPage &P&R&D");
    expect(headerFooterFromXlsx(xml)).toEqual(hf);
    // text before any section code is centred; && stays escaped
    expect(headerFooterFromXlsx("R&&D&R&P")).toEqual({
      center: "R&&D",
      right: "&P",
    });
    expect(headerFooterFromXlsx('&L&"Arial,Bold"x')).toEqual({
      left: '&"Arial,Bold"x',
    });
  });
});
