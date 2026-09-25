/**
 * Threaded comments (Excel's "Comments", as opposed to notes, which live in
 * `cell.ps`, see comment.ts).
 *
 * A sheet keeps its threads in `sheet.threadedComments`: each thread is
 * anchored to a cell (r, c), is its own first post (author, time, text) and
 * has replies and a resolved flag. Mentions are stored in the text as
 * `@[Display Name](userId)` tokens.
 *
 * Everything here mutates the workbook in place, so used inside
 * `setContext` it is recorded for undo/redo and sent to collaborators like
 * any other edit. The model follows the cells:
 *
 * - structural edits (rows/columns/cells inserted or deleted, cut/paste and
 *   drag moves) through a reference adjuster (refAdjust.ts); a thread whose
 *   cell is deleted or overwritten is deleted;
 * - sorting through a sort listener (sort.ts);
 * - copy/paste (and Paste Special › Comments) copies the thread
 *   ({@link pasteThreadedComments}, called by pasteSpecial.ts).
 *
 * A purple corner marks commented cells (grey once resolved), drawn by a
 * cell decorator.
 */
import { v4 as uuidv4 } from "uuid";
import type { Context } from "../context";
import type {
  CommentUser,
  Sheet,
  ThreadedComment,
  ThreadedCommentPost,
} from "../types";
import { registerCellDecorator } from "./extensions";
import {
  indexToColumn,
  locateRangeForChange,
  ReferenceChange,
  registerReferenceAdjuster,
} from "./refAdjust";
import { registerSortListener, SortMove } from "./sort";
import { selectRangesOnSheet } from "./goTo";

export { threadedCommentsLocale } from "../locale/threadedComments";
export type { ThreadedCommentsLocale } from "../locale/threadedComments";

/* -------------------------------------------------------------------------- */
/*                                  Mentions                                  */
/* -------------------------------------------------------------------------- */

const MENTION_RE = /@\[([^\]\n]*)\]\(([^)\n]*)\)/g;

export type CommentTextSegment =
  | { type: "text"; text: string }
  | { type: "mention"; name: string; id: string };

/** The stored token of a mention of `user`. */
export function mentionToken(user: Pick<CommentUser, "id" | "name">) {
  const name = String(user.name).replace(/[[\]\n]/g, "");
  const id = String(user.id).replace(/[()\n]/g, "");
  return `@[${name}](${id})`;
}

/** Split a comment's text into plain text and mention segments. */
export function parseCommentText(text: string): CommentTextSegment[] {
  const out: CommentTextSegment[] = [];
  let last = 0;
  MENTION_RE.lastIndex = 0;
  let m = MENTION_RE.exec(text);
  while (m) {
    if (m.index > last) {
      out.push({ type: "text", text: text.slice(last, m.index) });
    }
    out.push({ type: "mention", name: m[1], id: m[2] });
    last = m.index + m[0].length;
    m = MENTION_RE.exec(text);
  }
  if (last < text.length) out.push({ type: "text", text: text.slice(last) });
  return out;
}

/** The text as shown: mentions become `@Display Name`. */
export function commentPlainText(text: string) {
  return parseCommentText(text)
    .map((s) => (s.type === "text" ? s.text : `@${s.name}`))
    .join("");
}

/** The people mentioned in a text (once each, in order). */
export function commentMentions(text: string): CommentUser[] {
  const seen = new Set<string>();
  const out: CommentUser[] = [];
  parseCommentText(text).forEach((s) => {
    if (s.type !== "mention" || seen.has(s.id)) return;
    seen.add(s.id);
    out.push({ id: s.id, name: s.name });
  });
  return out;
}

export type PlainMention = {
  id: string;
  name: string;
  /** offset of the "@" in the plain text */
  start: number;
  /** length of "@Display Name" */
  length: number;
};

/** The plain text and the position of every mention in it (xlsx export). */
export function commentTextWithMentions(text: string): {
  text: string;
  mentions: PlainMention[];
} {
  let plain = "";
  const mentions: PlainMention[] = [];
  parseCommentText(text).forEach((s) => {
    if (s.type === "text") {
      plain += s.text;
      return;
    }
    const shown = `@${s.name}`;
    mentions.push({
      id: s.id,
      name: s.name,
      start: plain.length,
      length: shown.length,
    });
    plain += shown;
  });
  return { text: plain, mentions };
}

/**
 * Stored text from plain text and mention positions (xlsx import). A mention
 * whose range does not fit the text is left as plain text.
 */
export function commentTextFromMentions(
  plain: string,
  mentions: PlainMention[]
) {
  const sorted = mentions
    .filter(
      (m) => m.start >= 0 && m.length > 0 && m.start + m.length <= plain.length
    )
    .sort((a, b) => a.start - b.start);
  let out = "";
  let pos = 0;
  sorted.forEach((m) => {
    if (m.start < pos) return;
    out += plain.slice(pos, m.start);
    const shown = plain.slice(m.start, m.start + m.length);
    const name = m.name || shown.replace(/^@/, "");
    out += mentionToken({ id: m.id, name });
    pos = m.start + m.length;
  });
  return out + plain.slice(pos);
}

/**
 * Stored text from what was typed in the editor: every `@Name` of one of
 * the picked `mentions` becomes a mention token (longest names first).
 */
export function commentTextFromInput(input: string, mentions: CommentUser[]) {
  const people = [...mentions]
    .filter((u) => u.name)
    .sort((a, b) => b.name.length - a.name.length);
  if (people.length === 0) return input;
  let out = "";
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    const at = i;
    const user =
      ch === "@"
        ? people.find((u) => input.startsWith(`@${u.name}`, at))
        : null;
    if (user) {
      out += mentionToken(user);
      i += user.name.length + 1;
    } else {
      out += ch;
      i += 1;
    }
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/*                                    Model                                   */
/* -------------------------------------------------------------------------- */

export function createThreadedCommentId() {
  return uuidv4();
}

function sheetById(ctx: Context, sheetId?: string): Sheet | undefined {
  const id = sheetId ?? ctx.currentSheetId;
  return ctx.luckysheetfile?.find((s) => s.id === id);
}

function canEdit(ctx: Context) {
  return ctx.allowEdit !== false;
}

/** The threads of a sheet (the current one by default). */
export function getThreadedComments(
  ctx: Context,
  sheetId?: string
): ThreadedComment[] {
  return sheetById(ctx, sheetId)?.threadedComments ?? [];
}

// cell -> thread, per threads array (arrays are replaced on every change)
const indexCache = new WeakMap<object, Map<string, ThreadedComment>>();

function threadIndex(threads: ThreadedComment[]) {
  let index = indexCache.get(threads);
  if (!index) {
    index = new Map();
    threads.forEach((t) => index!.set(`${t.r}_${t.c}`, t));
    indexCache.set(threads, index);
  }
  return index;
}

/** The thread on cell (r, c) of a sheet (the current one by default). */
export function getThreadedCommentAt(
  ctx: Context,
  r: number,
  c: number,
  sheetId?: string
): ThreadedComment | undefined {
  const threads = sheetById(ctx, sheetId)?.threadedComments;
  if (!threads?.length) return undefined;
  return threadIndex(threads).get(`${r}_${c}`);
}

/** Finds a thread by id on any sheet. */
export function findThreadedComment(
  ctx: Context,
  threadId: string
): { sheet: Sheet; thread: ThreadedComment; index: number } | null {
  const files = ctx.luckysheetfile || [];
  for (let i = 0; i < files.length; i += 1) {
    const threads = files[i].threadedComments;
    if (threads) {
      const index = threads.findIndex((t) => t.id === threadId);
      if (index >= 0) return { sheet: files[i], thread: threads[index], index };
    }
  }
  return null;
}

/** Whether `user` wrote `post` (and so may edit or delete it). */
export function isOwnCommentPost(
  post: Pick<ThreadedCommentPost, "author">,
  user: CommentUser | null | undefined
) {
  return !!user && post.author?.id === user.id;
}

export type NewCommentPostOptions = {
  id?: string;
  /** ISO time (default: now). */
  date?: string;
};

function newPost(
  text: string,
  author: CommentUser,
  opts: NewCommentPostOptions
): ThreadedCommentPost {
  return {
    id: opts.id ?? createThreadedCommentId(),
    author: { ...author },
    created: opts.date ?? new Date().toISOString(),
    text,
  };
}

function setThreads(sheet: Sheet, threads: ThreadedComment[]) {
  if (threads.length > 0) sheet.threadedComments = threads;
  else delete sheet.threadedComments;
}

function updateThread(
  ctx: Context,
  threadId: string,
  fn: (thread: ThreadedComment) => ThreadedComment | null
) {
  if (!canEdit(ctx)) return false;
  const found = findThreadedComment(ctx, threadId);
  if (!found) return false;
  const { sheet, index } = found;
  const threads = [...sheet.threadedComments!];
  const next = fn(threads[index]);
  if (next === threads[index]) return false;
  if (next) threads[index] = next;
  else threads.splice(index, 1);
  setThreads(sheet, threads);
  return true;
}

/** Reply to a thread; returns the new post. */
export function replyToThreadedComment(
  ctx: Context,
  threadId: string,
  text: string,
  author: CommentUser,
  opts: NewCommentPostOptions = {}
): ThreadedCommentPost | null {
  if (!text.trim()) return null;
  const post = newPost(text, author, opts);
  const ok = updateThread(ctx, threadId, (t) => ({
    ...t,
    replies: [...t.replies, post],
  }));
  return ok ? post : null;
}

/**
 * Start a thread on cell (r, c), or add a reply when the cell already has
 * one (a cell has at most one thread, as in Excel). Returns the thread.
 */
export function addThreadedComment(
  ctx: Context,
  args: {
    r: number;
    c: number;
    text: string;
    author: CommentUser;
    sheetId?: string;
  } & NewCommentPostOptions
): ThreadedComment | null {
  if (!canEdit(ctx) || !args.text.trim()) return null;
  const sheet = sheetById(ctx, args.sheetId);
  if (!sheet) return null;
  const existing = getThreadedCommentAt(ctx, args.r, args.c, sheet.id);
  if (existing) {
    replyToThreadedComment(ctx, existing.id, args.text, args.author, args);
    return getThreadedCommentAt(ctx, args.r, args.c, sheet.id) ?? null;
  }
  const thread: ThreadedComment = {
    ...newPost(args.text, args.author, args),
    r: args.r,
    c: args.c,
    replies: [],
  };
  setThreads(sheet, [...(sheet.threadedComments ?? []), thread]);
  return thread;
}

/**
 * Change the text of a post (the thread's first post or a reply). With
 * `user`, only that user's own posts can be edited.
 */
export function editThreadedComment(
  ctx: Context,
  threadId: string,
  postId: string,
  text: string,
  opts: { user?: CommentUser | null; date?: string } = {}
) {
  if (!text.trim()) return false;
  const edited = opts.date ?? new Date().toISOString();
  const allowed = (p: ThreadedCommentPost) =>
    opts.user === undefined || isOwnCommentPost(p, opts.user);
  return updateThread(ctx, threadId, (t) => {
    if (t.id === postId) {
      if (!allowed(t) || t.text === text) return t;
      return { ...t, text, edited };
    }
    const i = t.replies.findIndex((p) => p.id === postId);
    if (i < 0 || !allowed(t.replies[i]) || t.replies[i].text === text) {
      return t;
    }
    const replies = [...t.replies];
    replies[i] = { ...replies[i], text, edited };
    return { ...t, replies };
  });
}

/**
 * Delete a post. Deleting the first post deletes the whole thread (as in
 * Excel). With `user`, only that user's own posts can be deleted.
 */
export function deleteThreadedCommentPost(
  ctx: Context,
  threadId: string,
  postId: string,
  opts: { user?: CommentUser | null } = {}
) {
  const allowed = (p: ThreadedCommentPost) =>
    opts.user === undefined || isOwnCommentPost(p, opts.user);
  return updateThread(ctx, threadId, (t) => {
    if (t.id === postId) return allowed(t) ? null : t;
    const i = t.replies.findIndex((p) => p.id === postId);
    if (i < 0 || !allowed(t.replies[i])) return t;
    return { ...t, replies: t.replies.filter((p) => p.id !== postId) };
  });
}

/** Delete a whole thread. */
export function deleteThreadedComment(ctx: Context, threadId: string) {
  return updateThread(ctx, threadId, () => null);
}

/** Delete the threads of every cell in `ranges` of a sheet. */
export function deleteThreadedCommentsInRanges(
  ctx: Context,
  ranges: { row: number[]; column: number[] }[],
  sheetId?: string
) {
  if (!canEdit(ctx)) return 0;
  const sheet = sheetById(ctx, sheetId);
  const threads = sheet?.threadedComments;
  if (!sheet || !threads?.length) return 0;
  const keep = threads.filter(
    (t) =>
      !ranges.some(
        (rg) =>
          t.r >= rg.row[0] &&
          t.r <= rg.row[rg.row.length - 1] &&
          t.c >= rg.column[0] &&
          t.c <= rg.column[rg.column.length - 1]
      )
  );
  if (keep.length === threads.length) return 0;
  setThreads(sheet, keep);
  return threads.length - keep.length;
}

/** Resolve (true) or reopen (false) a thread. */
export function setThreadedCommentResolved(
  ctx: Context,
  threadId: string,
  resolved: boolean
) {
  return updateThread(ctx, threadId, (t) => {
    if (!!t.resolved === resolved) return t;
    const next = { ...t };
    if (resolved) next.resolved = true;
    else delete next.resolved;
    return next;
  });
}

/* -------------------------------------------------------------------------- */
/*                              Navigation and UI                             */
/* -------------------------------------------------------------------------- */

export type ThreadedCommentLocation = {
  sheetId: string;
  r: number;
  c: number;
  thread: ThreadedComment;
};

/** Every thread of the workbook in sheet order, row by row within a sheet. */
export function listThreadedComments(ctx: Context): ThreadedCommentLocation[] {
  const sheets = [...(ctx.luckysheetfile || [])]
    .map((s, i) => ({ s, i }))
    .sort((a, b) => (a.s.order ?? a.i) - (b.s.order ?? b.i) || a.i - b.i)
    .map(({ s }) => s);
  const out: ThreadedCommentLocation[] = [];
  sheets.forEach((sheet) => {
    if (sheet.hide === 1 || !sheet.id) return;
    [...(sheet.threadedComments ?? [])]
      .sort((a, b) => a.r - b.r || a.c - b.c)
      .forEach((thread) =>
        out.push({ sheetId: sheet.id!, r: thread.r, c: thread.c, thread })
      );
  });
  return out;
}

/**
 * The next (dir 1) or previous (dir -1) thread from the active cell,
 * continuing on the following sheets and wrapping around.
 */
export function adjacentThreadedComment(
  ctx: Context,
  dir: 1 | -1,
  from?: { sheetId: string; r: number; c: number }
): ThreadedCommentLocation | null {
  const all = listThreadedComments(ctx);
  if (all.length === 0) return null;
  let origin = from;
  if (!origin) {
    const sel =
      ctx.luckysheet_select_save?.[ctx.luckysheet_select_save.length - 1];
    origin = {
      sheetId: ctx.currentSheetId,
      r: sel ? sel.row_focus ?? sel.row[0] : 0,
      c: sel ? sel.column_focus ?? sel.column[0] : 0,
    };
  }
  const sheetOrder = new Map<string, number>();
  all.forEach((l) => {
    if (!sheetOrder.has(l.sheetId)) sheetOrder.set(l.sheetId, sheetOrder.size);
  });
  const files = ctx.luckysheetfile || [];
  const originSheet = files.find((s) => s.id === origin!.sheetId);
  // sheets without threads sort by their tab order among the others
  let originRank = sheetOrder.get(origin.sheetId);
  if (originRank == null) {
    const order = originSheet?.order ?? 0;
    originRank = -0.5;
    all.forEach((l) => {
      const s = files.find((f) => f.id === l.sheetId);
      if ((s?.order ?? 0) < order) originRank = sheetOrder.get(l.sheetId)!;
    });
    originRank += 0.5;
  }
  const cmp = (l: ThreadedCommentLocation) =>
    sheetOrder.get(l.sheetId)! - originRank! ||
    l.r - origin!.r ||
    l.c - origin!.c;
  if (dir === 1) return all.find((l) => cmp(l) > 0) ?? all[0];
  for (let i = all.length - 1; i >= 0; i -= 1) {
    if (cmp(all[i]) < 0) return all[i];
  }
  return all[all.length - 1];
}

/** Open the comment card of cell (r, c). */
export function openThreadedCommentCard(
  ctx: Context,
  r: number,
  c: number,
  mode: "new" | "view",
  sheetId?: string
) {
  ctx.threadedCommentCard = {
    sheetId: sheetId ?? ctx.currentSheetId,
    r,
    c,
    mode,
  };
}

export function closeThreadedCommentCard(ctx: Context) {
  ctx.threadedCommentCard = null;
}

/** New Comment on the active cell: its thread when it has one. */
export function startThreadedComment(ctx: Context) {
  const sel =
    ctx.luckysheet_select_save?.[ctx.luckysheet_select_save.length - 1];
  if (!sel) return false;
  const r = sel.row_focus ?? sel.row[0];
  const c = sel.column_focus ?? sel.column[0];
  const thread = getThreadedCommentAt(ctx, r, c);
  if (!thread && !canEdit(ctx)) return false;
  openThreadedCommentCard(ctx, r, c, thread ? "view" : "new");
  return true;
}

/** Select a thread's cell (switching sheet and scrolling) and open it. */
export function goToThreadedComment(
  ctx: Context,
  sheetId: string,
  r: number,
  c: number
) {
  const range = {
    row: [r, r] as [number, number],
    column: [c, c] as [number, number],
  };
  if (!selectRangesOnSheet(ctx, sheetId, [range], [r, c])) {
    // the sheet is not loaded yet: select the cell once it is
    const sheet = sheetById(ctx, sheetId);
    if (!sheet) return false;
    sheet.luckysheet_select_save = [
      { row: [r, r], column: [c, c], row_focus: r, column_focus: c },
    ];
    ctx.currentSheetId = sheetId;
  }
  openThreadedCommentCard(ctx, r, c, "view", sheetId);
  return true;
}

/** Go to the next / previous thread and open it. */
export function goToAdjacentThreadedComment(ctx: Context, dir: 1 | -1) {
  const next = adjacentThreadedComment(ctx, dir);
  if (!next) return false;
  return goToThreadedComment(ctx, next.sheetId, next.r, next.c);
}

/** "B3" */
export function threadedCommentCellName(r: number, c: number) {
  return `${indexToColumn(c)}${r + 1}`;
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];

/**
 * A post time relative to `now` in the given language ("2 minutes ago",
 * "yesterday"); under a minute ago gives `justNow`.
 */
export function formatCommentTime(
  iso: string,
  lang?: string | null,
  now: number = Date.now(),
  justNow = "Just now"
) {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return "";
  const seconds = (time - now) / 1000;
  const abs = Math.abs(seconds);
  if (abs < 60) return justNow;
  const [unit, size] =
    UNITS.find(([, s]) => abs >= s) ?? UNITS[UNITS.length - 1];
  const value = Math.round(seconds / size);
  const locales = lang ? [lang, "en"] : undefined;
  try {
    if (typeof Intl !== "undefined" && Intl.RelativeTimeFormat) {
      return new Intl.RelativeTimeFormat(locales, { numeric: "auto" }).format(
        value,
        unit
      );
    }
  } catch {
    // unknown locale: English below
  }
  const n = Math.abs(value);
  const text = `${n} ${unit}${n === 1 ? "" : "s"}`;
  return value < 0 ? `${text} ago` : `in ${text}`;
}

/** The time of a post as a full date and time, for tooltips. */
export function formatCommentDate(iso: string, lang?: string | null) {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return "";
  try {
    return new Date(time).toLocaleString(lang || undefined);
  } catch {
    return new Date(time).toLocaleString();
  }
}

/* -------------------------------------------------------------------------- */
/*                          Following the cells around                        */
/* -------------------------------------------------------------------------- */

/**
 * Keeps threads on their cells through a structural change (registered with
 * refAdjust): threads move with their cell (also to another sheet), and are
 * deleted with it or when a move overwrites it.
 */
export function adjustThreadedCommentsForChange(
  ctx: Context,
  change: ReferenceChange
) {
  if (change.type === "renameSheet" || change.type === "deleteSheet") return;
  const files = ctx.luckysheetfile || [];
  const ids = [change.sheetId];
  if (change.type === "move" && change.toSheetId !== change.sheetId) {
    ids.push(change.toSheetId);
  }
  const sheets = ids
    .map((id) => files.find((s) => s.id === id))
    .filter((s): s is Sheet => !!s?.threadedComments?.length);
  if (sheets.length === 0) return;

  const next = new Map<string, ThreadedComment[]>();
  const listOf = (id: string) => {
    if (!next.has(id)) next.set(id, []);
    return next.get(id)!;
  };
  let changed = false;
  sheets.forEach((sheet) => {
    listOf(sheet.id!);
    sheet.threadedComments!.forEach((t) => {
      const loc = locateRangeForChange(
        { row: [t.r, t.r], column: [t.c, t.c] },
        change,
        sheet.id!
      );
      if (!loc) {
        changed = true;
        return;
      }
      const r = loc.range.row[0];
      const c = loc.range.column[0];
      if (loc.sheetId === sheet.id && r === t.r && c === t.c) {
        listOf(sheet.id!).push(t);
        return;
      }
      changed = true;
      listOf(loc.sheetId).push({ ...t, r, c });
    });
  });
  if (!changed) return;
  next.forEach((threads, id) => {
    const sheet = files.find((s) => s.id === id);
    if (sheet) setThreads(sheet, threads);
  });
  const card = ctx.threadedCommentCard;
  if (card && ids.includes(card.sheetId)) ctx.threadedCommentCard = null;
}

/** Keeps threads on their cells when a range is sorted (sort listener). */
export function sortThreadedComments(ctx: Context, move: SortMove) {
  const sheet = sheetById(ctx, move.sheetId);
  const threads = sheet?.threadedComments;
  if (!sheet || !threads?.length) return;
  const to = new Map<number, number>();
  move.from.forEach((line, i) => to.set(line, move.to[i]));
  let changed = false;
  const next = threads.map((t) => {
    const [line, across] = move.byColumns ? [t.c, t.r] : [t.r, t.c];
    if (across < move.span[0] || across > move.span[1]) return t;
    const dest = to.get(line);
    if (dest == null || dest === line) return t;
    changed = true;
    return move.byColumns ? { ...t, c: dest } : { ...t, r: dest };
  });
  if (changed) setThreads(sheet, next);
}

/** A copy of a thread on cell (r, c) with new ids (pasted, duplicated). */
export function copyThreadedComment(
  t: ThreadedComment,
  r: number = t.r,
  c: number = t.c
): ThreadedComment {
  return {
    ...t,
    id: createThreadedCommentId(),
    author: { ...t.author },
    r,
    c,
    replies: t.replies.map((p) => ({
      ...p,
      id: createThreadedCommentId(),
      author: { ...p.author },
    })),
  };
}

/**
 * Paste the threads of copied cells: each target cell (r, c) gets a copy of
 * the thread of its source cell (sr, sc) on `fromSheetId`, or loses its own
 * thread when the source cell has none (Excel's paste of comments).
 */
export function pasteThreadedComments(
  ctx: Context,
  fromSheetId: string,
  toSheetId: string,
  cells: { sr: number; sc: number; r: number; c: number }[]
) {
  if (cells.length === 0) return;
  const src = sheetById(ctx, fromSheetId);
  const dst = sheetById(ctx, toSheetId);
  if (!src || !dst) return;
  const srcThreads = src.threadedComments ?? [];
  if (srcThreads.length === 0 && !dst.threadedComments?.length) return;
  // read the sources before the targets change (they may overlap)
  const srcIndex = new Map(threadIndex(srcThreads));
  const targets = new Set(cells.map(({ r, c }) => `${r}_${c}`));
  const kept = (dst.threadedComments ?? []).filter(
    (t) => !targets.has(`${t.r}_${t.c}`)
  );
  const added: ThreadedComment[] = [];
  cells.forEach(({ sr, sc, r, c }) => {
    const t = srcIndex.get(`${sr}_${sc}`);
    if (t) added.push(copyThreadedComment(t, r, c));
  });
  const before = dst.threadedComments?.length ?? 0;
  if (added.length === 0 && kept.length === before) return;
  setThreads(dst, [...kept, ...added]);
}

/* -------------------------------------------------------------------------- */
/*                                Cell indicator                              */
/* -------------------------------------------------------------------------- */

/** Corner marker colours: active threads purple, resolved ones grey. */
export const threadedCommentMarkerColors = {
  light: { active: "#8e3fd6", resolved: "#9aa0a6" },
  dark: { active: "#c58af9", resolved: "#80868b" },
};

let lastSheetLookup: {
  files: unknown;
  id: string;
  sheet: Sheet | undefined;
} | null = null;

function currentSheetOf(ctx: Context) {
  const files = ctx.luckysheetfile;
  if (
    lastSheetLookup &&
    lastSheetLookup.files === files &&
    lastSheetLookup.id === ctx.currentSheetId
  ) {
    return lastSheetLookup.sheet;
  }
  const sheet = files?.find((s) => s.id === ctx.currentSheetId);
  lastSheetLookup = { files, id: ctx.currentSheetId, sheet };
  return sheet;
}

let installed = false;

/**
 * Register the cell marker, the reference adjuster and the sort listener
 * (idempotent; also done when this module is loaded).
 */
export function installThreadedComments() {
  if (installed) return;
  installed = true;
  registerReferenceAdjuster("model.threadedComments", (ctx, change) =>
    adjustThreadedCommentsForChange(ctx, change)
  );
  registerSortListener("threadedComments", sortThreadedComments);
  registerCellDecorator("threadedComments", {
    drawForeground: ({ ctx, renderCtx, r, c, x, y, w, zoom }) => {
      const threads = currentSheetOf(ctx)?.threadedComments;
      if (!threads?.length) return;
      const thread = threadIndex(threads).get(`${r}_${c}`);
      if (!thread) return;
      const palette =
        threadedCommentMarkerColors[ctx.theme === "dark" ? "dark" : "light"];
      const size = 8 * zoom;
      const right = x + w - 1;
      renderCtx.beginPath();
      renderCtx.moveTo(right - size, y);
      renderCtx.lineTo(right, y);
      renderCtx.lineTo(right, y + size);
      renderCtx.closePath();
      renderCtx.fillStyle = thread.resolved ? palette.resolved : palette.active;
      renderCtx.fill();
    },
  });
}

installThreadedComments();
