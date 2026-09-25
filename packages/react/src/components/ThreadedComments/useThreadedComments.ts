import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  addThreadedComment,
  commentMentions,
  CommentUser,
  Context,
  createThreadedCommentId,
  deleteThreadedComment,
  deleteThreadedCommentPost,
  editThreadedComment,
  getThreadedCommentAt,
  replyToThreadedComment,
  setThreadedCommentResolved,
  threadedCommentsLocale,
  ThreadedComment,
  ThreadedCommentChange,
  ThreadedCommentPost,
} from "@lofcz/tinysheet-core";
import WorkbookContext from "../../context";

/**
 * Runs `op` on a throw-away copy of one sheet's threads to learn what the
 * thread looks like afterwards (the real change runs in `setContext`, with
 * the same ids and times, so both agree). Used for the change events.
 */
function simulate(
  context: Context,
  sheetId: string,
  op: (ctx: Context) => void
): ThreadedComment[] {
  const sheet = context.luckysheetfile.find((s) => s.id === sheetId);
  const copy = {
    id: sheetId,
    name: "",
    threadedComments: sheet?.threadedComments,
  };
  const fake = {
    luckysheetfile: [copy],
    currentSheetId: sheetId,
    allowEdit: context.allowEdit,
  } as unknown as Context;
  op(fake);
  return copy.threadedComments ?? [];
}

/** Every user a text mentions, completed from `settings.users`. */
function mentionedUsers(text: string, users: CommentUser[]) {
  return commentMentions(text).map(
    (m) => users.find((u) => u.id === m.id) ?? m
  );
}

/**
 * The comment actions of the UI: they apply the change (undoable), then
 * report it through `hooks.onCommentChange` and `hooks.onMention`.
 */
export function useThreadedCommentActions() {
  const { context, setContext, settings } = useContext(WorkbookContext);
  const t = threadedCommentsLocale(context);
  const user: CommentUser = useMemo(
    () => settings.currentUser ?? { id: "guest", name: t.guest },
    [settings.currentUser, t.guest]
  );
  const users = useMemo(() => settings.users ?? [], [settings.users]);

  const report = useCallback(
    (
      change: ThreadedCommentChange,
      mentionText?: string,
      previousText?: string
    ) => {
      const hooks = settings.hooks ?? {};
      hooks.onCommentChange?.(change);
      if (mentionText != null && hooks.onMention) {
        const before = new Set(
          previousText ? commentMentions(previousText).map((m) => m.id) : []
        );
        const mentioned = mentionedUsers(mentionText, users).filter(
          (u) => !before.has(u.id)
        );
        if (mentioned.length > 0) hooks.onMention(change, mentioned);
      }
    },
    [settings.hooks, users]
  );

  const findPost = (thread: ThreadedComment | undefined, postId: string) =>
    thread?.id === postId
      ? thread
      : thread?.replies.find((p) => p.id === postId);

  const threadById = (threads: ThreadedComment[], id: string) =>
    threads.find((x) => x.id === id) ?? null;

  const sheetOfThread = (threadId: string) =>
    context.luckysheetfile.find((s) =>
      s.threadedComments?.some((x) => x.id === threadId)
    );

  /** Start a thread on (r, c), or reply to the one there. */
  const post = useCallback(
    (sheetId: string, r: number, c: number, text: string) => {
      const id = createThreadedCommentId();
      const date = new Date().toISOString();
      const existing = getThreadedCommentAt(context, r, c, sheetId);
      const op = (ctx: Context) =>
        addThreadedComment(ctx, {
          sheetId,
          r,
          c,
          text,
          author: user,
          id,
          date,
        });
      const after = simulate(context, sheetId, op);
      setContext((ctx) => {
        op(ctx);
      });
      const thread = after.find((x) => x.r === r && x.c === c) ?? null;
      if (!thread) return;
      const newPost = findPost(thread, id);
      report(
        {
          type: existing ? "reply" : "add",
          sheetId,
          threadId: thread.id,
          thread,
          post: newPost,
        },
        text
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [context, report, setContext, user]
  );

  const reply = useCallback(
    (threadId: string, text: string) => {
      const sheet = sheetOfThread(threadId);
      if (!sheet?.id) return;
      const id = createThreadedCommentId();
      const date = new Date().toISOString();
      const op = (ctx: Context) =>
        replyToThreadedComment(ctx, threadId, text, user, { id, date });
      const thread = threadById(simulate(context, sheet.id, op), threadId);
      setContext((ctx) => {
        op(ctx);
      });
      report(
        {
          type: "reply",
          sheetId: sheet.id,
          threadId,
          thread,
          post: findPost(thread ?? undefined, id),
        },
        text
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [context, report, setContext, user]
  );

  const edit = useCallback(
    (threadId: string, postId: string, text: string) => {
      const sheet = sheetOfThread(threadId);
      if (!sheet?.id) return;
      const before = findPost(
        threadById(sheet.threadedComments ?? [], threadId) ?? undefined,
        postId
      );
      const date = new Date().toISOString();
      const op = (ctx: Context) =>
        editThreadedComment(ctx, threadId, postId, text, { user, date });
      const thread = threadById(simulate(context, sheet.id, op), threadId);
      setContext((ctx) => {
        op(ctx);
      });
      report(
        {
          type: "edit",
          sheetId: sheet.id,
          threadId,
          thread,
          post: findPost(thread ?? undefined, postId),
        },
        text,
        before?.text
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [context, report, setContext, user]
  );

  const remove = useCallback(
    (threadId: string, postId: string) => {
      const sheet = sheetOfThread(threadId);
      if (!sheet?.id) return;
      const old = threadById(sheet.threadedComments ?? [], threadId);
      const removed = findPost(old ?? undefined, postId);
      const op = (ctx: Context) =>
        deleteThreadedCommentPost(ctx, threadId, postId, { user });
      const thread = threadById(simulate(context, sheet.id, op), threadId);
      setContext((ctx) => {
        op(ctx);
      });
      report({
        type: thread ? "delete" : "deleteThread",
        sheetId: sheet.id,
        threadId,
        thread,
        post: removed as ThreadedCommentPost | undefined,
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [context, report, setContext, user]
  );

  const deleteThread = useCallback(
    (threadId: string) => {
      const sheet = sheetOfThread(threadId);
      if (!sheet?.id) return;
      const old = threadById(sheet.threadedComments ?? [], threadId);
      setContext((ctx) => {
        deleteThreadedComment(ctx, threadId);
        if (ctx.threadedCommentCard) ctx.threadedCommentCard = null;
      });
      report({
        type: "deleteThread",
        sheetId: sheet.id,
        threadId,
        thread: null,
        post: old ?? undefined,
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [context, report, setContext]
  );

  const resolve = useCallback(
    (threadId: string, resolved: boolean) => {
      const sheet = sheetOfThread(threadId);
      if (!sheet?.id) return;
      const op = (ctx: Context) =>
        setThreadedCommentResolved(ctx, threadId, resolved);
      const thread = threadById(simulate(context, sheet.id, op), threadId);
      setContext((ctx) => {
        op(ctx);
      });
      report({
        type: resolved ? "resolve" : "reopen",
        sheetId: sheet.id,
        threadId,
        thread,
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [context, report, setContext]
  );

  return { user, post, reply, edit, remove, deleteThread, resolve };
}

/** A timestamp that re-renders every 30 seconds (relative times). */
export function useNow(interval = 30000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), interval);
    return () => window.clearInterval(id);
  }, [interval]);
  return now;
}

const AVATAR_COLORS = [
  "#1a73e8",
  "#d93025",
  "#188038",
  "#e37400",
  "#8e3fd6",
  "#007b83",
  "#c5221f",
  "#3c4043",
];

/** A stable colour for a user's initials avatar. */
export function avatarColor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? "" : "";
  return (first + last).toUpperCase();
}
