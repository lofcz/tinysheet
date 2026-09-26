import React, { useContext, useMemo, useState } from "react";
import {
  formatCommentDate,
  formatCommentTime,
  goToThreadedComment,
  listThreadedComments,
  threadedCommentCellName,
  threadedCommentsLocale,
} from "@lofcz/tinysheet-core";
import { MessageSquare } from "lucide-react";
import WorkbookContext from "../../context";
import { ICON_STROKE } from "../ui";
import Avatar, { CommentText } from "./Avatar";
import { useNow } from "./useThreadedComments";

type Filter = "all" | "active" | "resolved";

/**
 * The Comments pane (Excel's Review > Show Comments), docked in the side
 * pane: every thread of the workbook, filtered by status; clicking one goes
 * to its cell and opens it. The dock draws the title and close button.
 */
const CommentsPane: React.FC = () => {
  const { context, setContext, refs } = useContext(WorkbookContext);
  const t = threadedCommentsLocale(context);
  const now = useNow();
  const [filter, setFilter] = useState<Filter>("all");
  const all = useMemo(
    () => listThreadedComments(context),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [context.luckysheetfile]
  );
  const shown = all.filter(({ thread }) => {
    if (filter === "active") return !thread.resolved;
    if (filter === "resolved") return !!thread.resolved;
    return true;
  });
  const multiSheet =
    new Set(all.map((l) => l.sheetId)).size > 1 ||
    all.some((l) => l.sheetId !== context.currentSheetId);
  const sheetName = (id: string) =>
    context.luckysheetfile.find((s) => s.id === id)?.name ?? "";
  const card = context.threadedCommentCard;

  const close = () => {
    setContext(
      (ctx) => {
        ctx.threadedCommentsPane = false;
      },
      { noHistory: true }
    );
    refs.cellInput.current?.focus({ preventScroll: true });
  };

  const filters: [Filter, string][] = [
    ["all", t.filterAll],
    ["active", t.filterActive],
    ["resolved", t.filterResolved],
  ];

  return (
    // the pane keeps its clicks and keys from the grid
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      className="fortune-comments-pane ts-pane-content"
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") close();
      }}
    >
      <div
        className="fortune-comments-pane-filter ts-segmented"
        role="group"
        aria-label={t.filterLabel}
      >
        {filters.map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={filter === key}
            className={`ts-segmented-item fortune-comments-filter${
              filter === key ? " fortune-comments-filter-active" : ""
            }`}
            onClick={() => setFilter(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="fortune-comments-pane-list">
        {shown.length === 0 && (
          <div className="ts-pane-empty fortune-comments-pane-empty">
            <MessageSquare size={28} strokeWidth={ICON_STROKE} aria-hidden />
            <p>{all.length === 0 ? t.noComments : t.noMatching}</p>
          </div>
        )}
        {shown.map(({ sheetId, r, c, thread }) => {
          const where = multiSheet
            ? `${sheetName(sheetId)}!${threadedCommentCellName(r, c)}`
            : threadedCommentCellName(r, c);
          const n = thread.replies.length;
          const selected =
            card?.sheetId === sheetId && card.r === r && card.c === c;
          return (
            <button
              key={thread.id}
              type="button"
              className={`fortune-comments-item${
                thread.resolved ? " fortune-comments-item-resolved" : ""
              }${selected ? " fortune-comments-item-selected" : ""}`}
              data-thread-id={thread.id}
              aria-current={selected || undefined}
              onClick={() =>
                setContext(
                  (ctx) => {
                    goToThreadedComment(ctx, sheetId, r, c);
                  },
                  { noHistory: true }
                )
              }
            >
              <span className="fortune-comments-item-top">
                <span className="fortune-comments-item-cell">{where}</span>
                {thread.resolved && (
                  <span className="fortune-comments-item-badge">
                    {t.resolved}
                  </span>
                )}
              </span>
              <span className="fortune-comments-item-author">
                <Avatar user={thread.author} size={20} />
                <span className="fortune-thread-author">
                  {thread.author.name}
                </span>
                <span
                  className="fortune-thread-time"
                  title={formatCommentDate(thread.created, context.lang)}
                >
                  {formatCommentTime(
                    thread.created,
                    context.lang,
                    now,
                    t.justNow
                  )}
                </span>
              </span>
              <CommentText
                text={thread.text}
                className="fortune-comments-item-text"
              />
              {n > 0 && (
                <span className="fortune-comments-item-replies">
                  {n === 1 ? t.oneReply : t.replies.replace("{count}", `${n}`)}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default CommentsPane;
