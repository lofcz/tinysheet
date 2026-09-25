import React, { useContext, useMemo, useState } from "react";
import {
  formatCommentDate,
  formatCommentTime,
  goToThreadedComment,
  listThreadedComments,
  threadedCommentCellName,
  threadedCommentsLocale,
} from "@lofcz/tinysheet-core";
import WorkbookContext from "../../context";
import Avatar, { CommentText } from "./Avatar";
import { CardIcon } from "./CommentCard";
import { useNow } from "./useThreadedComments";

type Filter = "all" | "active" | "resolved";

/**
 * The Comments pane: every thread of the workbook, filtered by status;
 * clicking one goes to its cell and opens it.
 */
const CommentsPane: React.FC<{ style?: React.CSSProperties }> = ({ style }) => {
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
    // the pane keeps its clicks and keys from the grid below it
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <aside
      className="fortune-comments-pane"
      style={style}
      aria-label={t.paneTitle}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") close();
      }}
    >
      <div className="fortune-comments-pane-header">
        <h2 className="fortune-comments-pane-title">{t.paneTitle}</h2>
        <button
          type="button"
          className="fortune-thread-icon-button"
          title={t.close}
          aria-label={t.close}
          onClick={close}
        >
          <CardIcon name="close" />
        </button>
      </div>
      <div
        className="fortune-comments-pane-filter"
        role="group"
        aria-label={t.filterLabel}
      >
        {filters.map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={filter === key}
            className={`fortune-comments-filter${
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
          <p className="fortune-comments-pane-empty">
            {all.length === 0 ? t.noComments : t.noMatching}
          </p>
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
    </aside>
  );
};

export default CommentsPane;
