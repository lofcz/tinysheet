// T57: CSV / TSV import and export.
import test from "node:test";
import assert from "node:assert/strict";
import {
  parseCsvText,
  sniffDelimiter,
  decodeCsvBytes,
  csvToSheet,
  parseCsv,
  parseExcel,
  sheetToCsv,
  sheetToCsvBytes,
  normalizeLocaleInput,
} from "../dist/index.js";
import { cellMap } from "./helpers.mjs";

test("RFC 4180 parsing: quotes, doubled quotes, embedded newlines", () => {
  const text = 'a,"b,c","say ""hi"""\r\n1,"line1\nline2",\r\n"",x,"y"\n';
  assert.deepEqual(parseCsvText(text, ","), [
    ["a", "b,c", 'say "hi"'],
    ["1", "line1\nline2", ""],
    ["", "x", "y"],
  ]);
  assert.deepEqual(parseCsvText("a;b\rc;d", ";"), [
    ["a", "b"],
    ["c", "d"],
  ]);
  assert.deepEqual(parseCsvText("﻿a,b", ","), [["a", "b"]]);
});

test("delimiter sniffing", () => {
  assert.equal(sniffDelimiter("a,b,c\n1,2,3\n"), ",");
  assert.equal(sniffDelimiter("a;b;c\n1,5;2,5;3\n"), ";");
  assert.equal(sniffDelimiter("a\tb\tc\n1\t2\t3\n"), "\t");
  assert.equal(sniffDelimiter("a|b|c\n1|2|3\n"), "|");
  // Delimiters inside quotes don't count.
  assert.equal(sniffDelimiter('"a,b";c\n"1,2";3\n"x,y";z\n'), ";");
  assert.equal(sniffDelimiter("single column\nvalues\n"), ",");
});

test("encoding detection: BOMs, UTF-16 without BOM, Windows-1252 fallback", () => {
  const utf8 = Buffer.concat([
    Buffer.from([0xef, 0xbb, 0xbf]),
    Buffer.from("café,€"),
  ]);
  assert.deepEqual(decodeCsvBytes(utf8), { text: "café,€", encoding: "utf-8" });

  const le = Buffer.concat([
    Buffer.from([0xff, 0xfe]),
    Buffer.from("héllo,1", "utf16le"),
  ]);
  assert.deepEqual(decodeCsvBytes(le), {
    text: "héllo,1",
    encoding: "utf-16le",
  });

  const be = Buffer.from("﻿ab,1", "utf16le").swap16();
  assert.deepEqual(decodeCsvBytes(be), { text: "ab,1", encoding: "utf-16be" });

  const noBom = Buffer.from("name,value\nx,1", "utf16le");
  assert.equal(decodeCsvBytes(noBom).encoding, "utf-16le");
  assert.equal(decodeCsvBytes(noBom).text, "name,value\nx,1");

  // "café €" in Windows-1252 is not valid UTF-8.
  const cp1252 = Buffer.from([0x63, 0x61, 0x66, 0xe9, 0x20, 0x80]);
  assert.deepEqual(decodeCsvBytes(cp1252), {
    text: "café €",
    encoding: "windows-1252",
  });

  assert.equal(decodeCsvBytes(Buffer.from("plain,ascii")).encoding, "utf-8");
});

test("typed values go through the core input parser", () => {
  const sheet = csvToSheet(
    "text,12,-3.5,$1,234.50,45%,2024-03-15,TRUE,#N/A,1.5E3,007\n",
    { delimiter: "," }
  );
  const cells = cellMap(sheet);
  assert.equal(cells.get("0_0").v, "text");
  assert.equal(cells.get("0_1").v, 12);
  assert.equal(cells.get("0_2").v, -3.5);
  // "$1" and "234.50" are separate fields when unquoted.
  assert.equal(cells.get("0_4").v, 234.5);
  assert.equal(cells.get("0_5").v, 0.45);
  assert.equal(cells.get("0_5").ct.fa, "0%");
  assert.equal(cells.get("0_6").v, 45366);
  assert.equal(cells.get("0_6").ct.t, "d");
  assert.equal(cells.get("0_7").v, true);
  assert.equal(cells.get("0_8").ct.t, "e");
  assert.equal(cells.get("0_9").v, 1500);
  assert.equal(cells.get("0_10").v, 7);

  const quoted = cellMap(csvToSheet('"$1,234.50"\n'));
  assert.equal(quoted.get("0_0").v, 1234.5);
});

test("locale-aware numbers and dates", () => {
  const sheet = csvToSheet(
    "Name;Amount;Date\nA;1.234,56;31.12.2024\nB;-0,5;01/02/2024\n"
  );
  const cells = cellMap(sheet);
  assert.equal(sheet.delimiter, ";");
  assert.equal(cells.get("1_1").v, 1234.56);
  assert.equal(cells.get("2_1").v, -0.5);
  assert.equal(cells.get("1_2").v, 45657); // 31 Dec 2024
  assert.equal(cells.get("1_2").ct.t, "d");
  assert.equal(cells.get("2_2").v, 45323); // 1 Feb 2024 (day first)
  assert.match(cells.get("2_2").ct.fa, /^d+\/m+\//);

  const us = cellMap(csvToSheet('01/02/2024,"1,234.5"\n'));
  assert.equal(us.get("0_0").v, 45293); // 2 Jan 2024 (month first)
  assert.equal(us.get("0_1").v, 1234.5);

  const explicit = cellMap(
    csvToSheet("1 234,5\t2024/12/31\n", {
      delimiter: "\t",
      decimalSeparator: ",",
      dateOrder: "YMD",
    })
  );
  assert.equal(explicit.get("0_0").v, 1234.5);
  assert.equal(explicit.get("0_1").v, 45657);

  assert.equal(
    normalizeLocaleInput("1.234.567,89 €", ",", ".", "DMY"),
    "1234567.89 €"
  );
  assert.equal(normalizeLocaleInput("12,5", ".", ",", "MDY"), "12,5");
  assert.equal(normalizeLocaleInput("ABC-123", ",", ".", "DMY"), "ABC-123");
});

test("formulas are text unless parseFormulas is set; parseValues=false keeps text", () => {
  assert.equal(cellMap(csvToSheet("=1+1\n")).get("0_0").v, "=1+1");
  assert.equal(
    cellMap(csvToSheet("=1+1\n", { parseFormulas: true })).get("0_0").f,
    "=1+1"
  );
  const raw = cellMap(csvToSheet("007,1.5\n", { parseValues: false }));
  assert.equal(raw.get("0_0").v, "007");
  assert.equal(raw.get("0_1").v, "1.5");
});

test("parseExcel routes .csv / .tsv files through the CSV importer", async () => {
  const csv = await parseExcel(Buffer.from("﻿a,b\n1,2\n"), "data.csv");
  assert.equal(csv.sheets.length, 1);
  assert.equal(csv.sheets[0].name, "data");
  assert.equal(cellMap(csv.sheets[0]).get("1_1").v, 2);

  const tsv = await parseExcel(Buffer.from("a,b\tc\n"), "data.tsv");
  assert.equal(cellMap(tsv.sheets[0]).get("0_0").v, "a,b");
  assert.equal(cellMap(tsv.sheets[0]).get("0_1").v, "c");

  const { sheet, delimiter } = await parseCsv(Buffer.from("x|y\n1|2\n"));
  assert.equal(delimiter, "|");
  assert.equal(cellMap(sheet).get("1_0").v, 1);
});

const exportSheet = {
  name: "S",
  celldata: [
    {
      r: 0,
      c: 0,
      v: { v: 1234.5, m: "$1,234.50", ct: { fa: '"$"#,##0.00', t: "n" } },
    },
    { r: 0, c: 1, v: { v: "a,b", m: "a,b", ct: { fa: "General", t: "g" } } },
    { r: 0, c: 2, v: { v: 'say "hi"', ct: { fa: "General", t: "g" } } },
    { r: 1, c: 0, v: { v: 45000, ct: { fa: "yyyy-mm-dd", t: "d" } } },
    {
      r: 1,
      c: 1,
      v: { f: "=A1*2", v: 2469, m: "2469", ct: { fa: "General", t: "n" } },
    },
    { r: 1, c: 2, v: { v: true, m: "TRUE", ct: { fa: "General", t: "b" } } },
    {
      r: 2,
      c: 0,
      v: {
        ct: {
          fa: "General",
          t: "inlineStr",
          s: [{ v: "multi" }, { v: "\r\nline", bl: 1 }],
        },
      },
    },
    { r: 2, c: 1, v: { v: " padded ", ct: { fa: "General", t: "g" } } },
    { r: 3, c: 0, v: { v: "m", mc: { r: 3, c: 0, rs: 1, cs: 2 } } },
    { r: 3, c: 1, v: { v: "hidden", mc: { r: 3, c: 0 } } },
    { r: 5, c: 3, v: null },
  ],
};

test("CSV export: displayed values, quoting and trimming", () => {
  assert.equal(
    sheetToCsv(exportSheet),
    [
      '"$1,234.50","a,b","say ""hi"""',
      "2023-03-15,2469,TRUE",
      '"multi\r\nline"," padded "',
      "m",
      "",
    ].join("\r\n")
  );
});

test("CSV export: raw values, formulas, TSV and BOM", () => {
  const raw = sheetToCsv(exportSheet, { values: "raw", lineEnding: "\n" });
  assert.equal(raw.split("\n")[0], '1234.5,"a,b","say ""hi"""');
  assert.equal(raw.split("\n")[1], "45000,2469,TRUE");

  const formulas = sheetToCsv(exportSheet, {
    formulas: true,
    lineEnding: "\n",
  });
  assert.equal(formulas.split("\n")[1], "2023-03-15,=A1*2,TRUE");

  const tsv = sheetToCsv(exportSheet, { delimiter: "\t", lineEnding: "\n" });
  assert.equal(tsv.split("\n")[0], '$1,234.50\ta,b\t"say ""hi"""');

  const bytes = sheetToCsvBytes({ celldata: [{ r: 0, c: 0, v: { v: "é" } }] });
  assert.deepEqual([...bytes.slice(0, 3)], [0xef, 0xbb, 0xbf]);
  assert.equal(Buffer.from(bytes.slice(3)).toString("utf8"), "é\r\n");
  assert.equal(sheetToCsvBytes({ celldata: [] }, { bom: false }).length, 0);
});

test("CSV round trip keeps values", () => {
  const text = sheetToCsv(exportSheet, { values: "raw" });
  const back = cellMap(csvToSheet(text));
  assert.equal(back.get("0_0").v, 1234.5);
  assert.equal(back.get("0_1").v, "a,b");
  assert.equal(back.get("0_2").v, 'say "hi"');
  assert.equal(back.get("1_1").v, 2469);
  assert.equal(back.get("1_2").v, true);
  assert.equal(back.get("2_1").v, " padded ");
});
