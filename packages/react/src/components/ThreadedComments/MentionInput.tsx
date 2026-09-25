import React, {
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  commentMentions,
  commentPlainText,
  commentTextFromInput,
  CommentUser,
  threadedCommentsLocale,
} from "@lofcz/tinysheet-core";
import WorkbookContext from "../../context";
import Avatar from "./Avatar";

export type MentionInputHandle = {
  focus: () => void;
  /** The stored text (mentions as tokens). */
  value: () => string;
  clear: () => void;
};

type Props = {
  /** Stored text to start from (editing a post). */
  initialText?: string;
  placeholder: string;
  autoFocus?: boolean;
  ariaLabel: string;
  /** Ctrl/Cmd+Enter */
  onSubmit: (text: string) => void;
  /** Escape (with the people picker closed) */
  onCancel?: () => void;
  onEmptyChange?: (empty: boolean) => void;
};

type Trigger = { at: number; query: string };

const MAX_RESULTS = 6;

/** Where an @mention being typed starts, if the caret is in one. */
function findTrigger(text: string, caret: number): Trigger | null {
  const before = text.slice(0, caret);
  const at = before.lastIndexOf("@");
  if (at < 0) return null;
  if (at > 0 && !/\s/.test(before[at - 1])) return null;
  const query = before.slice(at + 1);
  if (query.length > 40 || /[\n@]/.test(query)) return null;
  // at most two words ("Ann Lee"), and no leading space
  if (/^\s/.test(query) || query.split(" ").length > 3) return null;
  return { at, query };
}

function matches(user: CommentUser, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    user.name.toLowerCase().includes(q) ||
    !!user.email?.toLowerCase().includes(q)
  );
}

/**
 * A comment text box with an @mention people picker: typing "@" lists
 * `settings.users` (or what `settings.searchUsers` finds); picking someone
 * inserts "@Name", stored as a mention token on submit.
 */
const MentionInput = React.forwardRef<MentionInputHandle, Props>(
  (
    {
      initialText = "",
      placeholder,
      autoFocus,
      ariaLabel,
      onSubmit,
      onCancel,
      onEmptyChange,
    },
    ref
  ) => {
    const { context, settings } = useContext(WorkbookContext);
    const { searchUsers, users } = settings;
    const t = threadedCommentsLocale(context);
    const [text, setText] = useState(() => commentPlainText(initialText));
    const mentions = useRef<CommentUser[]>(commentMentions(initialText));
    const [trigger, setTrigger] = useState<Trigger | null>(null);
    const [results, setResults] = useState<CommentUser[]>([]);
    const [active, setActive] = useState(0);
    const areaRef = useRef<HTMLTextAreaElement>(null);
    const listId = useRef(
      `fortune-mention-list-${Math.random().toString(36).slice(2)}`
    );

    const stored = useCallback(
      () => commentTextFromInput(text, mentions.current),
      [text]
    );

    useImperativeHandle(
      ref,
      () => ({
        focus: () => areaRef.current?.focus(),
        value: stored,
        clear: () => {
          setText("");
          mentions.current = [];
          setTrigger(null);
        },
      }),
      [stored]
    );

    useEffect(() => {
      onEmptyChange?.(text.trim() === "");
    }, [text, onEmptyChange]);

    useEffect(() => {
      if (!autoFocus) return;
      const el = areaRef.current;
      if (!el) return;
      el.focus({ preventScroll: true });
      el.setSelectionRange(el.value.length, el.value.length);
    }, [autoFocus]);

    // after picking someone the caret goes after the inserted name
    const pendingCaret = useRef<number | null>(null);

    // grow with the text (up to the CSS max-height)
    useLayoutEffect(() => {
      const el = areaRef.current;
      if (!el) return;
      if (pendingCaret.current != null) {
        el.focus();
        el.setSelectionRange(pendingCaret.current, pendingCaret.current);
        pendingCaret.current = null;
      }
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight + 2}px`;
    }, [text]);

    // people for the picker
    useEffect(() => {
      if (!trigger) {
        setResults([]);
        return undefined;
      }
      let cancelled = false;
      const { query } = trigger;
      const done = (list: CommentUser[]) => {
        if (cancelled) return;
        setResults(list.slice(0, MAX_RESULTS));
        setActive(0);
      };
      if (searchUsers) {
        Promise.resolve(searchUsers(query))
          .then((list) => done(list ?? []))
          .catch(() => done([]));
      } else {
        done((users ?? []).filter((u) => matches(u, query)));
      }
      return () => {
        cancelled = true;
      };
    }, [trigger, searchUsers, users]);

    const updateTrigger = (value: string, caret: number) => {
      setTrigger(findTrigger(value, caret));
    };

    const pick = (user: CommentUser) => {
      const el = areaRef.current;
      if (!el || !trigger) return;
      const caret = el.selectionStart ?? text.length;
      const inserted = `@${user.name} `;
      const next = text.slice(0, trigger.at) + inserted + text.slice(caret);
      if (!mentions.current.some((m) => m.id === user.id)) {
        mentions.current = [...mentions.current, user];
      }
      pendingCaret.current = trigger.at + inserted.length;
      setText(next);
      setTrigger(null);
    };

    const open = !!trigger && (results.length > 0 || trigger.query !== "");

    const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      e.stopPropagation();
      if (open && results.length > 0) {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          const step = e.key === "ArrowDown" ? 1 : -1;
          setActive((a) => (a + step + results.length) % results.length);
          return;
        }
        if (
          (e.key === "Enter" || e.key === "Tab") &&
          !e.ctrlKey &&
          !e.metaKey
        ) {
          e.preventDefault();
          pick(results[active]);
          return;
        }
      }
      if (e.key === "Escape") {
        e.preventDefault();
        if (trigger) setTrigger(null);
        else onCancel?.();
        return;
      }
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        const value = stored();
        if (value.trim()) onSubmit(value);
      }
    };

    return (
      <div className="fortune-mention-input">
        <textarea
          ref={areaRef}
          className="fortune-mention-textarea"
          value={text}
          rows={2}
          placeholder={placeholder}
          aria-label={ariaLabel}
          aria-autocomplete="list"
          aria-controls={open ? listId.current : undefined}
          aria-activedescendant={
            open && results.length > 0
              ? `${listId.current}-${active}`
              : undefined
          }
          onChange={(e) => {
            setText(e.target.value);
            updateTrigger(e.target.value, e.target.selectionStart ?? 0);
          }}
          onClick={(e) =>
            updateTrigger(
              e.currentTarget.value,
              e.currentTarget.selectionStart ?? 0
            )
          }
          onKeyDown={onKeyDown}
          onBlur={() => setTimeout(() => setTrigger(null), 150)}
        />
        {open && (
          <ul
            className="fortune-mention-list"
            id={listId.current}
            role="listbox"
            aria-label={ariaLabel}
          >
            {results.length === 0 ? (
              <li className="fortune-mention-empty">{t.noPeople}</li>
            ) : (
              results.map((user, i) => (
                <li
                  key={user.id}
                  id={`${listId.current}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  className={`fortune-mention-option${
                    i === active ? " fortune-mention-option-active" : ""
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(user);
                  }}
                  onMouseEnter={() => setActive(i)}
                >
                  <Avatar user={user} size={22} />
                  <span className="fortune-mention-option-text">
                    <span className="fortune-mention-option-name">
                      {user.name}
                    </span>
                    {user.email && (
                      <span className="fortune-mention-option-email">
                        {user.email}
                      </span>
                    )}
                  </span>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    );
  }
);

export default MentionInput;
