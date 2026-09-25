import React, { useContext, useRef, useState } from "react";
import {
  formatCommentDate,
  formatCommentTime,
  isOwnCommentPost,
  threadedCommentCellName,
  threadedCommentsLocale,
  ThreadedComment,
  ThreadedCommentPost,
} from "@lofcz/tinysheet-core";
import WorkbookContext from "../../context";
import Avatar, { CommentText } from "./Avatar";
import MentionInput, { MentionInputHandle } from "./MentionInput";
import { useNow, useThreadedCommentActions } from "./useThreadedComments";

const ICONS: Record<string, string> = {
  check: "M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z",
  reopen:
    "M17.65 6.35A7.958 7.958 0 0 0 12 4a8 8 0 1 0 7.73 10h-2.08A5.99 5.99 0 0 1 12 18a6 6 0 1 1 0-12c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z",
  trash:
    "M16 9v10H8V9h8m-1.5-6h-5l-1 1H5v2h14V4h-3.5l-1-1zM18 7H6v12c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7z",
  close:
    "M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z",
};

export const CardIcon: React.FC<{ name: string; size?: number }> = ({
  name,
  size = 16,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    focusable="false"
  >
    <path d={ICONS[name]} />
  </svg>
);

type PostProps = {
  threadId: string;
  post: ThreadedCommentPost;
  first: boolean;
  readOnly: boolean;
  now: number;
};

const Post: React.FC<PostProps> = ({
  threadId,
  post,
  first,
  readOnly,
  now,
}) => {
  const { context } = useContext(WorkbookContext);
  const t = threadedCommentsLocale(context);
  const { user, edit, remove } = useThreadedCommentActions();
  const [editing, setEditing] = useState(false);
  const editor = useRef<MentionInputHandle>(null);
  const own =
    !readOnly && context.allowEdit !== false && isOwnCommentPost(post, user);

  const save = (text: string) => {
    if (text.trim()) edit(threadId, post.id, text);
    setEditing(false);
  };

  return (
    <div
      className={`fortune-thread-post${
        first ? " fortune-thread-post-first" : ""
      }`}
      data-post-id={post.id}
    >
      <div className="fortune-thread-post-head">
        <Avatar user={post.author} />
        <div className="fortune-thread-post-meta">
          <span className="fortune-thread-author">{post.author.name}</span>
          <span
            className="fortune-thread-time"
            title={formatCommentDate(post.created, context.lang)}
          >
            {formatCommentTime(post.created, context.lang, now, t.justNow)}
            {post.edited && (
              <span
                className="fortune-thread-edited"
                title={formatCommentDate(post.edited, context.lang)}
              >
                {" · "}
                {t.edited}
              </span>
            )}
          </span>
        </div>
      </div>
      {editing ? (
        <div className="fortune-thread-edit">
          <MentionInput
            ref={editor}
            initialText={post.text}
            placeholder={t.placeholderReply}
            ariaLabel={t.edit}
            autoFocus
            onSubmit={save}
            onCancel={() => setEditing(false)}
          />
          <div className="fortune-thread-buttons">
            <button
              type="button"
              className="fortune-thread-button"
              onClick={() => setEditing(false)}
            >
              {t.cancel}
            </button>
            <button
              type="button"
              className="fortune-thread-button fortune-thread-button-primary"
              onClick={() => save(editor.current?.value() ?? "")}
            >
              {t.save}
            </button>
          </div>
        </div>
      ) : (
        <CommentText text={post.text} />
      )}
      {own && !editing && (
        <div className="fortune-thread-post-actions">
          <button
            type="button"
            className="fortune-thread-link"
            onClick={() => setEditing(true)}
          >
            {t.edit}
          </button>
          <button
            type="button"
            className="fortune-thread-link"
            onClick={() => remove(threadId, post.id)}
          >
            {first ? t.deleteThread : t.delete}
          </button>
        </div>
      )}
    </div>
  );
};

export type CommentCardProps = {
  sheetId: string;
  r: number;
  c: number;
  thread?: ThreadedComment;
  /** new: start a thread; view: read and reply; preview: hover, read-only */
  mode: "new" | "view" | "preview";
  style?: React.CSSProperties;
  onClose: () => void;
  /** preview only: open the full card */
  onOpen?: () => void;
};

/** The comment card of a cell: the thread's posts, replies and actions. */
const CommentCard = React.forwardRef<HTMLDivElement, CommentCardProps>(
  ({ sheetId, r, c, thread, mode, style, onClose, onOpen }, ref) => {
    const { context } = useContext(WorkbookContext);
    const t = threadedCommentsLocale(context);
    const now = useNow();
    const { user, post, reply, resolve, deleteThread } =
      useThreadedCommentActions();
    const input = useRef<MentionInputHandle>(null);
    const [empty, setEmpty] = useState(true);
    const editable = context.allowEdit !== false;
    const preview = mode === "preview";
    const cellName = threadedCommentCellName(r, c);

    const submit = (text: string) => {
      if (!text.trim()) return;
      if (thread) reply(thread.id, text);
      else post(sheetId, r, c, text);
      input.current?.clear();
    };

    const stop = (e: React.SyntheticEvent) => e.stopPropagation();

    return (
      <div
        ref={ref}
        className={`fortune-thread-card${
          preview ? " fortune-thread-card-preview" : ""
        }${thread?.resolved ? " fortune-thread-card-resolved" : ""}`}
        style={style}
        role={preview ? "tooltip" : "dialog"}
        aria-label={t.thread.replace("{cell}", cellName)}
        data-cell={`${r}_${c}`}
        onMouseDown={stop}
        onMouseUp={stop}
        onDoubleClick={stop}
        onContextMenu={stop}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Escape") onClose();
        }}
        onClick={preview ? onOpen : undefined}
      >
        {thread && !preview && (
          <div className="fortune-thread-header">
            <span className="fortune-thread-cell">
              {thread.resolved ? `${cellName} · ${t.resolved}` : cellName}
            </span>
            {editable && (
              <>
                <button
                  type="button"
                  className="fortune-thread-icon-button"
                  title={thread.resolved ? t.reopen : t.resolve}
                  aria-label={thread.resolved ? t.reopen : t.resolve}
                  onClick={() => resolve(thread.id, !thread.resolved)}
                >
                  <CardIcon name={thread.resolved ? "reopen" : "check"} />
                </button>
                <button
                  type="button"
                  className="fortune-thread-icon-button"
                  title={t.deleteThread}
                  aria-label={t.deleteThread}
                  onClick={() => deleteThread(thread.id)}
                >
                  <CardIcon name="trash" />
                </button>
              </>
            )}
            <button
              type="button"
              className="fortune-thread-icon-button"
              title={t.close}
              aria-label={t.close}
              onClick={onClose}
            >
              <CardIcon name="close" />
            </button>
          </div>
        )}
        {preview && thread?.resolved && (
          <div className="fortune-thread-resolved-badge">{t.resolved}</div>
        )}
        {thread && (
          <div className="fortune-thread-posts">
            {[thread, ...thread.replies].map((p, i) => (
              <Post
                key={p.id}
                threadId={thread.id}
                post={p}
                first={i === 0}
                readOnly={preview}
                now={now}
              />
            ))}
          </div>
        )}
        {!thread && mode === "new" && (
          <div className="fortune-thread-post-head fortune-thread-new-head">
            <Avatar user={user} />
            <span className="fortune-thread-author">{user.name}</span>
          </div>
        )}
        {!preview && editable && !thread?.resolved && (
          <div className="fortune-thread-reply">
            <MentionInput
              ref={input}
              placeholder={thread ? t.placeholderReply : t.placeholderNew}
              ariaLabel={thread ? t.newReply : t.newComment}
              autoFocus
              onSubmit={submit}
              onCancel={onClose}
              onEmptyChange={setEmpty}
            />
            {(!empty || !thread) && (
              <div className="fortune-thread-buttons">
                <span className="fortune-thread-hint">{t.postHint}</span>
                <button
                  type="button"
                  className="fortune-thread-button"
                  onClick={() => (thread ? input.current?.clear() : onClose())}
                >
                  {t.cancel}
                </button>
                <button
                  type="button"
                  className="fortune-thread-button fortune-thread-button-primary"
                  disabled={empty}
                  onClick={() => submit(input.current?.value() ?? "")}
                >
                  {t.post}
                </button>
              </div>
            )}
          </div>
        )}
        {!preview && thread?.resolved && editable && (
          <div className="fortune-thread-buttons">
            <button
              type="button"
              className="fortune-thread-button fortune-thread-button-primary"
              onClick={() => resolve(thread.id, false)}
            >
              {t.reopen}
            </button>
          </div>
        )}
      </div>
    );
  }
);

export default CommentCard;
