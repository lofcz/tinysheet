// Threaded comments: xlsx threadedComments / persons parts with the legacy
// note fallback, and import of Excel's threaded comments.
import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "@protobi/exceljs";
import {
  roundTrip,
  zipText,
  readWithExcelJS,
  cellMap,
  excelJsBytes,
  patchZip,
  importXlsx,
} from "./helpers.mjs";

const ann = { id: "ann@example.com", name: "Ann Lee" };
const bob = { id: "bob", name: "Bob" };

const sheet = () => ({
  name: "Budget",
  id: "s1",
  order: 0,
  celldata: [
    { r: 0, c: 0, v: { v: "Rent", m: "Rent" } },
    { r: 0, c: 1, v: { v: 1200, m: "1200", ct: { fa: "General", t: "n" } } },
    {
      r: 2,
      c: 0,
      v: {
        v: "Note",
        m: "Note",
        ps: { value: "just a note", isShow: false },
      },
    },
  ],
  threadedComments: [
    {
      id: "4f6c1e2a-3b1d-4c9e-8a7b-0123456789ab",
      r: 0,
      c: 1,
      author: ann,
      created: "2026-09-20T08:30:00.000Z",
      text: "Ask @[Bob](bob) & check <totals>",
      replies: [
        {
          id: "reply-1",
          author: bob,
          created: "2026-09-21T09:00:00.000Z",
          text: "Done.",
        },
      ],
      resolved: true,
    },
    {
      id: "t2",
      r: 4,
      c: 2,
      author: bob,
      created: "2026-09-22T10:15:00.000Z",
      text: "Second\nline",
      replies: [],
    },
  ],
});

test("threads round-trip through threadedComments and persons parts", async () => {
  const { bytes, result } = await roundTrip([sheet()]);

  const types = await zipText(bytes, "[Content_Types].xml");
  assert.match(types, /\/xl\/threadedComments\/threadedComment1\.xml/);
  assert.match(types, /application\/vnd\.ms-excel\.person\+xml/);
  const rels = await zipText(bytes, "xl/worksheets/_rels/sheet1.xml.rels");
  assert.match(rels, /relationships\/threadedComment"/);
  const wbRels = await zipText(bytes, "xl/_rels/workbook.xml.rels");
  assert.match(wbRels, /relationships\/person" Target="persons\/person.xml"/);

  const xml = await zipText(bytes, "xl/threadedComments/threadedComment1.xml");
  assert.match(
    xml,
    /id="\{4F6C1E2A-3B1D-4C9E-8A7B-0123456789AB\}" done="1"><text>Ask @Bob &amp; check &lt;totals&gt;<\/text><mentions><mention /
  );
  assert.match(xml, /startIndex="4" length="4"/);
  assert.match(xml, /parentId="\{4F6C1E2A-3B1D-4C9E-8A7B-0123456789AB\}"/);
  assert.match(xml, /dT="2026-09-20T08:30:00.00"/);
  const persons = await zipText(bytes, "xl/persons/person.xml");
  assert.match(persons, /displayName="Ann Lee"[^>]*userId="ann@example.com"/);
  assert.match(persons, /displayName="Bob"[^>]*userId="bob"/);

  // older Excel: the legacy note, authored by tc={thread id}
  const comments = await zipText(bytes, "xl/comments1.xml");
  assert.match(
    comments,
    /<author>tc=\{4F6C1E2A-3B1D-4C9E-8A7B-0123456789AB\}<\/author>/
  );
  const wb = await readWithExcelJS(bytes);
  const note = wb.worksheets[0].getCell("B1").note;
  const noteText =
    typeof note === "string" ? note : note.texts.map((t) => t.text).join("");
  assert.match(noteText, /^\[Threaded comment\]/);
  assert.match(
    noteText,
    /Comment:\n {4}Ask @Bob & check <totals>\nReply:\n {4}Done\./
  );

  // imported back as threads; the plain note stays a note
  const [back] = result.sheets;
  const cells = cellMap(back);
  assert.equal(cells.get("2_0").ps.value, "just a note");
  assert.equal(cells.get("0_1")?.ps, undefined);
  const threads = back.threadedComments;
  assert.equal(threads.length, 2);
  const [first, second] = threads;
  assert.deepEqual(
    { r: first.r, c: first.c, resolved: first.resolved },
    { r: 0, c: 1, resolved: true }
  );
  assert.equal(first.id, "4F6C1E2A-3B1D-4C9E-8A7B-0123456789AB");
  assert.equal(first.text, "Ask @[Bob](bob) & check <totals>");
  assert.deepEqual(first.author, ann);
  assert.equal(first.created, "2026-09-20T08:30:00.000Z");
  assert.equal(first.replies.length, 1);
  assert.equal(first.replies[0].text, "Done.");
  assert.deepEqual(first.replies[0].author, bob);
  assert.equal(second.text, "Second\nline");
  assert.equal(second.resolved, undefined);
});

test("a thread replaces a note on the same cell in the export", async () => {
  const s = sheet();
  s.celldata.push({
    r: 4,
    c: 2,
    v: { v: 1, m: "1", ps: { value: "old note", isShow: true } },
  });
  const { bytes, result } = await roundTrip([s]);
  const vml = await zipText(bytes, "xl/drawings/vmlDrawing1.vml");
  assert.doesNotMatch(vml ?? "", /<x:Visible\s*\/>/);
  const cells = cellMap(result.sheets[0]);
  assert.equal(cells.get("4_2").ps, undefined);
  assert.equal(result.sheets[0].threadedComments.length, 2);
});

test("Excel threaded comments with persons import with names and mentions", async () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("T");
  ws.getCell("C3").value = 5;
  ws.getCell("C3").note = "[Threaded comment]\n\nplaceholder";
  ws.getCell("A1").note = "real note";
  let bytes = await excelJsBytes(wb);
  bytes = await patchZip(bytes, {
    "xl/threadedComments/threadedComment1.xml": () =>
      '<?xml version="1.0" encoding="UTF-8"?><ThreadedComments xmlns="http://schemas.microsoft.com/office/spreadsheetml/2018/threadedcomments">' +
      '<threadedComment ref="C3" dT="2024-05-01T12:34:56.78" personId="{P1}" id="{T1}"><text>Hi @Zoe Park, see this</text>' +
      '<mentions><mention mentionpersonId="{P2}" mentionId="{M1}" startIndex="3" length="9"/></mentions></threadedComment>' +
      '<threadedComment ref="C3" dT="2024-05-02T08:00:00.00" personId="{P2}" id="{T2}" parentId="{T1}"><text>On it</text></threadedComment>' +
      "</ThreadedComments>",
    "xl/persons/person.xml": () =>
      '<?xml version="1.0" encoding="UTF-8"?><personList xmlns="http://schemas.microsoft.com/office/spreadsheetml/2018/threadedcomments">' +
      '<person displayName="Max Ray" id="{P1}" userId="max@contoso.com" providerId="AD"/>' +
      '<person displayName="Zoe Park" id="{P2}" userId="S::zoe@contoso.com::1" providerId="AD"/>' +
      "</personList>",
    "xl/worksheets/_rels/sheet1.xml.rels": (xml) =>
      xml.replace(
        "</Relationships>",
        '<Relationship Id="rIdT1" Type="http://schemas.microsoft.com/office/2017/10/relationships/threadedComment" Target="../threadedComments/threadedComment1.xml"/></Relationships>'
      ),
    "xl/_rels/workbook.xml.rels": (xml) =>
      xml.replace(
        "</Relationships>",
        '<Relationship Id="rIdP1" Type="http://schemas.microsoft.com/office/2017/10/relationships/person" Target="persons/person.xml"/></Relationships>'
      ),
  });
  const result = await importXlsx(bytes);
  const [sheetOut] = result.sheets;
  const cells = cellMap(sheetOut);
  assert.equal(cells.get("0_0").ps.value, "real note");
  assert.equal(cells.get("2_2").ps, undefined);
  assert.equal(cells.get("2_2").v, 5);
  const [thread] = sheetOut.threadedComments;
  assert.deepEqual(thread.author, { id: "max@contoso.com", name: "Max Ray" });
  assert.equal(thread.text, "Hi @[Zoe Park](S::zoe@contoso.com::1), see this");
  assert.equal(thread.created, "2024-05-01T12:34:56.780Z");
  assert.equal(thread.replies[0].author.name, "Zoe Park");
  assert.equal(thread.replies[0].text, "On it");
});
