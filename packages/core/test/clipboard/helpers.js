import { parseA1 } from "../formula/helpers";
import { handleCopy } from "../../src/events/copy";
import { pasteClipboardContent } from "../../src/events/paste";
import clipboard from "../../src/modules/clipboard";
import { groupValuesRefresh } from "../../src/modules/formula";

/** Captures what copy writes to the system clipboard. */
export const written = { html: "", text: "" };

export function mockClipboard() {
  document.execCommand = jest.fn();
  clipboard.writeHtml = jest.fn((html, text) => {
    written.html = html;
    written.text = text;
  });
}

export function sheetOf(ctx, sheetId) {
  return ctx.luckysheetfile.find((s) => s.id === sheetId);
}

/** Make `sheetId` the current sheet (like clicking its tab). */
export function activate(ctx, sheetId) {
  if (ctx.currentSheetId !== sheetId) {
    const prev = sheetOf(ctx, ctx.currentSheetId);
    if (prev) prev.config = ctx.config;
  }
  ctx.currentSheetId = sheetId;
  const file = sheetOf(ctx, sheetId);
  if (!file.config) file.config = {};
  ctx.config = file.config;
}

export function select(ctx, from, to = from) {
  const a = parseA1(from);
  const b = parseA1(to);
  ctx.luckysheet_select_save = [
    {
      row: [a.r, b.r],
      column: [a.c, b.c],
      row_focus: a.r,
      column_focus: a.c,
    },
  ];
}

export function copy(ctx, from, to = from, sheetId = "id_1") {
  activate(ctx, sheetId);
  select(ctx, from, to);
  handleCopy(ctx);
}

/** Ctrl+X (the keyboard handler copies, then flags the cut). */
export function cut(ctx, from, to = from, sheetId = "id_1") {
  copy(ctx, from, to, sheetId);
  ctx.luckysheet_paste_iscut = true;
}

/** Ctrl+V of what copy wrote, at `at` (a cell or "A1:B2"). */
export function paste(ctx, at, sheetId = "id_1", clip = written) {
  activate(ctx, sheetId);
  const [from, to] = at.split(":");
  select(ctx, from, to || from);
  pasteClipboardContent(ctx, clip.html, clip.text);
  groupValuesRefresh(ctx);
}
