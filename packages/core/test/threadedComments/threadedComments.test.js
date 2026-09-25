import { enablePatches, produceWithPatches, applyPatches } from "immer";
import { makeContext, input, value } from "../formula/helpers";
import { insertRowCol, deleteRowCol } from "../../src/modules/rowcol";
import { sortRange } from "../../src/modules/sort";
import { pasteSpecial } from "../../src/modules/pasteSpecial";
import {
  mockClipboard,
  copy,
  cut,
  paste,
  activate,
  select,
} from "../clipboard/helpers";
import {
  addThreadedComment,
  replyToThreadedComment,
  editThreadedComment,
  deleteThreadedCommentPost,
  deleteThreadedComment,
  deleteThreadedCommentsInRanges,
  setThreadedCommentResolved,
  getThreadedCommentAt,
  getThreadedComments,
  adjacentThreadedComment,
  goToAdjacentThreadedComment,
  startThreadedComment,
  parseCommentText,
  commentPlainText,
  commentMentions,
  commentTextWithMentions,
  commentTextFromMentions,
  commentTextFromInput,
  mentionToken,
  formatCommentTime,
  threadedCommentsLocale,
  threadedCommentCellName,
} from "../../src/modules/threadedComments";
import { drawCellForegroundDecorators } from "../../src/modules/extensions";

enablePatches();
beforeEach(mockClipboard);

const ann = { id: "u1", name: "Ann Lee" };
const bob = { id: "u2", name: "Bob" };

function withThread(ctx, r, c, text, sheetId) {
  return addThreadedComment(ctx, {
    r,
    c,
    text: text ?? "Hello",
    author: ann,
    sheetId,
    date: "2026-09-25T10:00:00.000Z",
  });
}

const cellOf = (t) => (t ? [t.r, t.c] : null);

describe("model", () => {
  test("threads, replies, edits, resolve and delete", () => {
    const ctx = makeContext();
    const t = withThread(ctx, 1, 2);
    expect(t).toMatchObject({ r: 1, c: 2, text: "Hello", replies: [] });
    expect(t.author).toEqual(ann);
    expect(getThreadedCommentAt(ctx, 1, 2).id).toBe(t.id);

    const reply = replyToThreadedComment(ctx, t.id, "Hi", bob);
    expect(getThreadedCommentAt(ctx, 1, 2).replies).toEqual([reply]);
    // New Comment on a commented cell adds a reply
    withThread(ctx, 1, 2, "Again");
    expect(getThreadedCommentAt(ctx, 1, 2).replies).toHaveLength(2);
    expect(getThreadedComments(ctx)).toHaveLength(1);

    // only the author edits / deletes their post
    expect(editThreadedComment(ctx, t.id, reply.id, "x", { user: ann })).toBe(
      false
    );
    expect(editThreadedComment(ctx, t.id, reply.id, "Hi!", { user: bob })).toBe(
      true
    );
    const edited = getThreadedCommentAt(ctx, 1, 2).replies[0];
    expect(edited.text).toBe("Hi!");
    expect(edited.edited).toBeTruthy();
    expect(deleteThreadedCommentPost(ctx, t.id, reply.id, { user: ann })).toBe(
      false
    );
    expect(deleteThreadedCommentPost(ctx, t.id, reply.id, { user: bob })).toBe(
      true
    );
    expect(getThreadedCommentAt(ctx, 1, 2).replies).toHaveLength(1);

    setThreadedCommentResolved(ctx, t.id, true);
    expect(getThreadedCommentAt(ctx, 1, 2).resolved).toBe(true);
    setThreadedCommentResolved(ctx, t.id, false);
    expect(getThreadedCommentAt(ctx, 1, 2).resolved).toBeUndefined();

    // deleting the first post deletes the thread
    deleteThreadedCommentPost(ctx, t.id, t.id);
    expect(getThreadedCommentAt(ctx, 1, 2)).toBeUndefined();
    expect(ctx.luckysheetfile[0].threadedComments).toBeUndefined();
  });

  test("empty texts and read-only workbooks change nothing", () => {
    const ctx = makeContext();
    expect(withThread(ctx, 0, 0, "   ")).toBeNull();
    ctx.allowEdit = false;
    expect(withThread(ctx, 0, 0)).toBeNull();
    expect(getThreadedComments(ctx)).toEqual([]);
  });

  test("deleteThreadedComment and deleting in ranges", () => {
    const ctx = makeContext();
    const a = withThread(ctx, 0, 0);
    withThread(ctx, 2, 2);
    withThread(ctx, 5, 5);
    expect(deleteThreadedComment(ctx, a.id)).toBe(true);
    expect(
      deleteThreadedCommentsInRanges(ctx, [{ row: [1, 3], column: [0, 3] }])
    ).toBe(1);
    expect(getThreadedComments(ctx).map(cellOf)).toEqual([[5, 5]]);
  });

  test("changes are undoable immer patches", () => {
    const ctx = makeContext();
    const [next, , inverse] = produceWithPatches(ctx, (draft) => {
      withThread(draft, 3, 1);
    });
    expect(getThreadedCommentAt(next, 3, 1).text).toBe("Hello");
    const undone = applyPatches(next, inverse);
    expect(getThreadedCommentAt(undone, 3, 1)).toBeUndefined();
  });
});

describe("mentions", () => {
  const text = `Ping ${mentionToken(ann)} and ${mentionToken(bob)}!`;

  test("tokens parse into segments and plain text", () => {
    expect(parseCommentText(text)).toEqual([
      { type: "text", text: "Ping " },
      { type: "mention", name: "Ann Lee", id: "u1" },
      { type: "text", text: " and " },
      { type: "mention", name: "Bob", id: "u2" },
      { type: "text", text: "!" },
    ]);
    expect(commentPlainText(text)).toBe("Ping @Ann Lee and @Bob!");
    expect(commentMentions(`${text} ${mentionToken(bob)}`)).toEqual([ann, bob]);
  });

  test("plain text with offsets round-trips (xlsx)", () => {
    const plain = commentTextWithMentions(text);
    expect(plain.text).toBe("Ping @Ann Lee and @Bob!");
    expect(plain.mentions).toEqual([
      { id: "u1", name: "Ann Lee", start: 5, length: 8 },
      { id: "u2", name: "Bob", start: 18, length: 4 },
    ]);
    expect(commentTextFromMentions(plain.text, plain.mentions)).toBe(text);
  });

  test("typed @names of picked people become tokens", () => {
    const annie = { id: "u3", name: "Ann" };
    expect(
      commentTextFromInput("Ping @Ann Lee and @Ann, not @Carl", [annie, ann])
    ).toBe(`Ping ${mentionToken(ann)} and ${mentionToken(annie)}, not @Carl`);
  });
});

describe("following the cells", () => {
  function setup() {
    const ctx = makeContext({ rows: 12, cols: 6 });
    withThread(ctx, 2, 1, "B3");
    withThread(ctx, 5, 1, "B6");
    return ctx;
  }
  const cells = (ctx, id = "id_1") =>
    getThreadedComments(ctx, id)
      .map((t) => `${t.text}@${threadedCommentCellName(t.r, t.c)}`)
      .sort();

  test("row insert and delete", () => {
    const ctx = setup();
    insertRowCol(ctx, {
      type: "row",
      index: 3,
      count: 2,
      direction: "lefttop",
      id: "id_1",
    });
    expect(cells(ctx)).toEqual(["B3@B3", "B6@B8"]);
    deleteRowCol(ctx, { type: "row", start: 1, end: 2, id: "id_1" });
    expect(cells(ctx)).toEqual(["B6@B6"]);
  });

  test("column insert", () => {
    const ctx = setup();
    insertRowCol(ctx, {
      type: "column",
      index: 0,
      count: 1,
      direction: "lefttop",
      id: "id_1",
    });
    expect(cells(ctx)).toEqual(["B3@C3", "B6@C6"]);
  });

  test("sorting moves threads with their rows", () => {
    const ctx = setup();
    ["A1", "A2", "A3", "A4", "A5", "A6"].forEach((a1, i) =>
      input(ctx, a1, String(6 - i))
    );
    sortRange(ctx, {
      range: { row: [0, 5], column: [0, 1] },
      levels: [{ index: 0 }],
    });
    // A3 (4) moves to row 4, A6 (1) to row 1
    expect(value(ctx, "A4")).toBe(4);
    expect(cells(ctx)).toEqual(["B3@B4", "B6@B1"]);
  });

  test("copy/paste copies the thread; Paste Special › Comments too", () => {
    const ctx = setup();
    copy(ctx, "B3");
    paste(ctx, "D1");
    const copied = getThreadedCommentAt(ctx, 0, 3);
    expect(copied.text).toBe("B3");
    expect(copied.id).not.toBe(getThreadedCommentAt(ctx, 2, 1).id);

    copy(ctx, "B6");
    activate(ctx, "id_2");
    select(ctx, "A1");
    pasteSpecial(ctx, { paste: "comments" });
    expect(cells(ctx, "id_2")).toEqual(["B6@A1"]);

    // pasting values keeps the target's thread; pasting a cell without a
    // thread (all) replaces it
    copy(ctx, "A1", "A1", "id_1");
    activate(ctx, "id_2");
    select(ctx, "A1");
    pasteSpecial(ctx, { paste: "values" });
    expect(cells(ctx, "id_2")).toEqual(["B6@A1"]);
    pasteSpecial(ctx, { paste: "all" });
    expect(cells(ctx, "id_2")).toEqual([]);
  });

  test("cut/paste moves the thread, also to another sheet", () => {
    const ctx = setup();
    cut(ctx, "B3");
    paste(ctx, "B6");
    // B6's own thread is overwritten
    expect(cells(ctx)).toEqual(["B3@B6"]);
    cut(ctx, "B6");
    paste(ctx, "C2", "id_2");
    expect(cells(ctx)).toEqual([]);
    expect(cells(ctx, "id_2")).toEqual(["B3@C2"]);
  });
});

describe("navigation and UI state", () => {
  test("next / previous comment wraps across sheets", () => {
    const ctx = makeContext();
    withThread(ctx, 4, 0);
    withThread(ctx, 1, 3);
    withThread(ctx, 0, 0, "other", "id_2");
    const at = (sheetId, r, c) => ({ sheetId, r, c });
    const loc = (l) => [l.sheetId, l.r, l.c];
    expect(loc(adjacentThreadedComment(ctx, 1, at("id_1", 0, 0)))).toEqual([
      "id_1",
      1,
      3,
    ]);
    expect(loc(adjacentThreadedComment(ctx, 1, at("id_1", 4, 0)))).toEqual([
      "id_2",
      0,
      0,
    ]);
    expect(loc(adjacentThreadedComment(ctx, 1, at("id_2", 0, 0)))).toEqual([
      "id_1",
      1,
      3,
    ]);
    expect(loc(adjacentThreadedComment(ctx, -1, at("id_1", 1, 3)))).toEqual([
      "id_2",
      0,
      0,
    ]);
    expect(loc(adjacentThreadedComment(ctx, -1, at("id_1", 3, 0)))).toEqual([
      "id_1",
      1,
      3,
    ]);
  });

  test("go to next comment selects its cell and opens the card", () => {
    const ctx = makeContext();
    withThread(ctx, 2, 2);
    ctx.luckysheet_select_save = [
      { row: [0, 0], column: [0, 0], row_focus: 0, column_focus: 0 },
    ];
    expect(goToAdjacentThreadedComment(ctx, 1)).toBe(true);
    expect(ctx.luckysheet_select_save[0]).toMatchObject({
      row: [2, 2],
      column: [2, 2],
    });
    expect(ctx.threadedCommentCard).toEqual({
      sheetId: "id_1",
      r: 2,
      c: 2,
      mode: "view",
    });
  });

  test("New Comment opens a new card, or the cell's thread", () => {
    const ctx = makeContext();
    select(ctx, "B2");
    startThreadedComment(ctx);
    expect(ctx.threadedCommentCard.mode).toBe("new");
    withThread(ctx, 1, 1);
    startThreadedComment(ctx);
    expect(ctx.threadedCommentCard.mode).toBe("view");
  });

  test("relative times", () => {
    const now = Date.parse("2026-09-25T12:00:00Z");
    const ago = (s) => new Date(now - s * 1000).toISOString();
    expect(formatCommentTime(ago(10), "en", now)).toBe("Just now");
    expect(formatCommentTime(ago(120), "en", now)).toBe("2 minutes ago");
    expect(formatCommentTime(ago(3 * 3600), "en", now)).toBe("3 hours ago");
    expect(formatCommentTime(ago(26 * 3600), "en", now)).toBe("yesterday");
    expect(formatCommentTime(ago(120), "es", now)).toBe("hace 2 minutos");
    expect(formatCommentTime("nonsense", "en", now)).toBe("");
    expect(threadedCommentsLocale({ lang: "zh" }).post).toBe("发布");
    expect(threadedCommentsLocale({ lang: "xx" }).post).toBe("Post");
  });

  test("commented cells get a corner marker", () => {
    const ctx = makeContext();
    const t = withThread(ctx, 0, 0);
    const fills = [];
    const renderCtx = {
      save() {},
      restore() {},
      beginPath() {},
      moveTo() {},
      lineTo() {},
      closePath() {},
      fill() {
        fills.push(this.fillStyle);
      },
    };
    const draw = (r) =>
      drawCellForegroundDecorators({
        ctx,
        renderCtx,
        r,
        c: 0,
        cell: null,
        x: 0,
        y: 0,
        w: 74,
        h: 20,
        zoom: 1,
      });
    draw(0);
    draw(1);
    setThreadedCommentResolved(ctx, t.id, true);
    draw(0);
    expect(fills).toEqual(["#8e3fd6", "#9aa0a6"]);
  });
});
