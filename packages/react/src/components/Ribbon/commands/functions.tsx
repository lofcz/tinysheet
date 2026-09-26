/**
 * Formulas › Function Library pieces: the function catalog by Excel
 * category, the Recently Used list, the category drop-downs (a scrollable
 * list of names with the hovered / focused function's syntax and
 * description under it) and the Insert Function dialog (search, category
 * list, description). Choosing a function starts `=NAME(` in the active
 * cell, or inserts `NAME(` at the caret of the formula being edited.
 */
import React, {
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  activeCell,
  FunctionListEntry,
  functionHTMLGenerate,
  getCaretOffset,
  getFunctionListMap,
  insertFunctionName,
  locale,
  rankFunctions,
  ribbonFormulasDataReviewLocale,
  RibbonFormulasDataReviewLocale,
  setCaretOffset,
} from "@lofcz/tinysheet-core";
import { Search } from "lucide-react";
import WorkbookContext from "../../../context";
import { ModalContext } from "../../../context/modal";
import { Button, DialogShell, ICON_STROKE, MenuItem, MenuList } from "../../ui";
import type { RibbonCommandHelpers } from "./helpers";
import "./kit.css";

/* ------------------------------------------------------------------ */
/*  Catalog                                                            */
/* ------------------------------------------------------------------ */

export type FunctionCategory =
  | "financial"
  | "logical"
  | "text"
  | "dateTime"
  | "lookup"
  | "math"
  | "statistical"
  | "engineering"
  | "information"
  | "compatibility"
  | "web"
  | "database";

/** Catalog category ids (locale/functions/types.ts) of Excel's groups. */
const CATEGORY_IDS: Record<Exclude<FunctionCategory, "web">, number> = {
  math: 0,
  statistical: 1,
  lookup: 2,
  database: 5,
  dateTime: 6,
  financial: 8,
  engineering: 9,
  logical: 10,
  text: 12,
  information: 15,
  compatibility: 16,
};

/** Excel files these under Web (the catalog under Text). */
const WEB_FUNCTIONS = new Set(["ENCODEURL", "FILTERXML", "WEBSERVICE"]);

/** Insert Function's category list, in Excel's order. */
export const DIALOG_CATEGORIES: FunctionCategory[] = [
  "financial",
  "dateTime",
  "math",
  "statistical",
  "lookup",
  "database",
  "text",
  "logical",
  "information",
  "engineering",
  "compatibility",
  "web",
];

export function functionsOf(
  list: FunctionListEntry[],
  category: FunctionCategory
): FunctionListEntry[] {
  const out =
    category === "web"
      ? list.filter((f) => WEB_FUNCTIONS.has(f.n))
      : list.filter(
          (f) => f.t === CATEGORY_IDS[category] && !WEB_FUNCTIONS.has(f.n)
        );
  return out.sort((a, b) => a.n.localeCompare(b.n));
}

export function categoryLabel(
  t: RibbonFormulasDataReviewLocale,
  category: FunctionCategory
) {
  return t.formulas[category];
}

/** `SUM(number1, [number2], ...)` */
export function functionSignature(f: FunctionListEntry) {
  const parts: string[] = [];
  f.p.forEach((p) => {
    parts.push(p.require === "o" ? `[${p.name}]` : p.name);
    if (p.repeat === "y") parts.push("...");
  });
  return `${f.n}(${parts.join(", ")})`;
}

/* ------------------------------------------------------------------ */
/*  Recently used                                                      */
/* ------------------------------------------------------------------ */

/** Excel's Recently Used list of a new installation. */
let recent: string[] = [
  "SUM",
  "AVERAGE",
  "IF",
  "HYPERLINK",
  "COUNT",
  "MAX",
  "SIN",
  "SUMIF",
  "PMT",
  "STDEV",
];
const recentListeners = new Set<() => void>();

/** Put a function on top of the Recently Used list (ten at most). */
export function noteFunctionUsed(name: string) {
  const upper = name.toUpperCase();
  recent = [upper, ...recent.filter((n) => n !== upper)].slice(0, 10);
  recentListeners.forEach((l) => l());
}

function subscribeRecent(listener: () => void) {
  recentListeners.add(listener);
  return () => {
    recentListeners.delete(listener);
  };
}

/** The Recently Used functions (catalog entries, most recent first). */
export function useRecentFunctions(list: FunctionListEntry[]) {
  const names = useSyncExternalStore(
    subscribeRecent,
    () => recent,
    () => recent
  );
  return useMemo(() => {
    const byName = new Map(list.map((f) => [f.n, f]));
    return names
      .map((n) => byName.get(n))
      .filter((f): f is FunctionListEntry => !!f);
  }, [list, names]);
}

/* ------------------------------------------------------------------ */
/*  Inserting into the cell editor                                     */
/* ------------------------------------------------------------------ */

/**
 * The caret of the cell editor when a Function Library button was
 * pressed: the button takes the focus, the insertion goes where the user
 * was typing.
 */
let editorCaret: number | null = null;

/** Remember the editor caret (call on pointer down of a trigger). */
export function rememberEditorCaret(input: HTMLElement | null | undefined) {
  if (!input) return;
  const caret = getCaretOffset(input);
  if (caret != null) editorCaret = caret;
}

/**
 * Start `=NAME(` in the active cell, or insert `NAME(` (a function) /
 * `NAME` (a defined name, `suffix` "") at the caret of the formula being
 * edited, and put the keyboard in the editor.
 */
export function insertIntoFormula(
  h: Pick<RibbonCommandHelpers, "context" | "setContext" | "refs">,
  name: string,
  suffix = "("
) {
  const input = h.refs.cellInput.current;
  if (!input || h.context.allowEdit === false) return;
  const editing = h.context.luckysheetCellUpdate.length > 0;
  const text = input.textContent ?? "";
  let next: { text: string; caret: number };
  let cell: [number, number] | null = null;
  if (editing && text.startsWith("=")) {
    const caret = Math.min(editorCaret ?? text.length, text.length);
    next = insertFunctionName(text, caret, name, suffix);
    cell = [
      h.context.luckysheetCellUpdate[0],
      h.context.luckysheetCellUpdate[1],
    ];
  } else {
    next = {
      text: `=${name}${suffix}`,
      caret: name.length + 1 + suffix.length,
    };
    const at = editing
      ? {
          r: h.context.luckysheetCellUpdate[0],
          c: h.context.luckysheetCellUpdate[1],
        }
      : activeCell(h.context);
    if (at) cell = [at.r, at.c];
  }
  editorCaret = null;
  if (!cell) return;
  const [r, c] = cell;
  if (suffix === "(") noteFunctionUsed(name);
  h.setContext((ctx) => {
    ctx.luckysheetCellUpdate = [r, c];
    if (h.refs.globalCache) h.refs.globalCache.doNotUpdateCell = true;
    input.innerHTML = functionHTMLGenerate(next.text);
    const fx = h.refs.fxInput.current;
    if (fx) fx.innerHTML = input.innerHTML;
    input.focus({ preventScroll: true });
    setCaretOffset(input, next.caret);
    if (suffix === "(") {
      ctx.functionHint = name.toUpperCase();
      ctx.functionHintArgIndex = 0;
      ctx.functionCandidates = [];
      getFunctionListMap(ctx);
    }
  });
  // once the dialog / menu that asked for it has closed (and given the
  // focus back), the caret goes after the insertion
  setTimeout(() => {
    if (!input.isConnected) return;
    if (document.activeElement !== input) input.focus({ preventScroll: true });
    setCaretOffset(input, next.caret);
  });
}

/* ------------------------------------------------------------------ */
/*  Category drop-down                                                 */
/* ------------------------------------------------------------------ */

type FunctionMenuProps = {
  /** The functions (by catalog entry) listed, in order. */
  functions: FunctionListEntry[];
  /** Submenus shown above the list (More Functions: its categories). */
  submenus?: { id: string; label: string; functions: FunctionListEntry[] }[];
  onPick: (name: string) => void;
  /** "Insert Function…" under the list. */
  onMore?: () => void;
  moreLabel: string;
  close: () => void;
  label: string;
  /** Shown in the description area until a function is pointed at. */
  hint: string;
  autoFocus?: boolean;
};

/**
 * A category drop-down: the function names (a scrollable menu, type-ahead
 * by first letter) and, under them, the syntax and description of the
 * function under the pointer or keyboard focus (Excel's screen tip).
 */
export const FunctionMenu: React.FC<FunctionMenuProps> = ({
  functions,
  submenus,
  onPick,
  onMore,
  moreLabel,
  close,
  label,
  hint,
  autoFocus,
}) => {
  const [hover, setHover] = useState<FunctionListEntry | null>(null);
  const byId = useMemo(() => {
    const m = new Map<string, FunctionListEntry>();
    functions.forEach((f) => m.set(`fn:${f.n}`, f));
    submenus?.forEach((s) =>
      s.functions.forEach((f) => m.set(`fn:${s.id}:${f.n}`, f))
    );
    return m;
  }, [functions, submenus]);
  const toItem = (f: FunctionListEntry, prefix = "fn:"): MenuItem => ({
    id: `${prefix}${f.n}`,
    label: f.n,
    onSelect: () => onPick(f.n),
  });
  const items: MenuItem[] = [];
  submenus?.forEach((s) =>
    items.push({
      id: `cat:${s.id}`,
      label: s.label,
      children: s.functions.map((f) => toItem(f, `fn:${s.id}:`)),
    })
  );
  functions.forEach((f) => items.push(toItem(f)));
  if (onMore) {
    items.push({ type: "separator" });
    items.push({
      id: "insert-function",
      label: moreLabel,
      icon: "insert-function",
      shortcut: "Shift+F3",
      onSelect: onMore,
    });
  }
  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      className="fortune-fn-menu"
      onFocus={(e) => {
        const id = (e.target as HTMLElement).dataset?.menuId;
        setHover(id ? (byId.get(id) ?? null) : null);
      }}
      onMouseOver={(e) => {
        // the pointer (submenu items are not focused on hover)
        const el = (e.target as HTMLElement).closest<HTMLElement>(
          "[data-menu-id]"
        );
        const f = el?.dataset.menuId ? byId.get(el.dataset.menuId) : null;
        if (f) setHover(f);
      }}
    >
      <MenuList
        items={items}
        onClose={close}
        autoFocus={autoFocus}
        minWidth={220}
        aria-label={label}
      />
      {byId.size > 0 && (
        <div className="fortune-fn-menu-tip" aria-live="polite">
          {hover ? (
            <>
              <div className="fortune-fn-menu-sig">
                {functionSignature(hover)}
              </div>
              <div className="fortune-fn-menu-desc">{hover.d}</div>
            </>
          ) : (
            <div className="fortune-fn-menu-desc fortune-fn-menu-hint">
              {hint}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Insert Function dialog                                             */
/* ------------------------------------------------------------------ */

export type InsertFunctionCategory = FunctionCategory | "recent" | "all";
type DialogCategory = InsertFunctionCategory;

export type InsertFunctionDialogProps = {
  /** Strings (default: the workbook's language). */
  t?: RibbonFormulasDataReviewLocale;
  initialCategory?: InsertFunctionCategory;
  /** Cancel / close (default: hide the workbook's modal). */
  onClose?: () => void;
  /** Alias of `onClose` (the `showDialog(<InsertFunctionDialog onCancel />)` form). */
  onCancel?: () => void;
  /**
   * A function was chosen (default: close, then start `=NAME(` in the
   * active cell or insert `NAME(` at the caret of the formula being edited).
   */
  onInsert?: (name: string) => void;
};

/**
 * Excel's Insert Function dialog (Formulas › Insert Function, fx, Shift+F3,
 * AutoSum › More Functions…): search, the category list (Most Recently
 * Used, All, Excel's categories), the functions with their syntax and
 * description. The only Insert Function dialog of the workbook; exported
 * for hosts as `InsertFunctionDialog`.
 */
export const InsertFunctionDialog: React.FC<InsertFunctionDialogProps> = ({
  t: tProp,
  initialCategory = "recent",
  onClose: onCloseProp,
  onCancel,
  onInsert: onInsertProp,
}) => {
  const { context, setContext, refs } = useContext(WorkbookContext);
  const { hideModal } = useContext(ModalContext);
  const t = tProp ?? ribbonFormulasDataReviewLocale(context);
  const onClose =
    onCloseProp ??
    onCancel ??
    (() => {
      hideModal();
      refs.cellInput.current?.focus({ preventScroll: true });
    });
  const onInsert =
    onInsertProp ??
    ((name: string) => {
      (onCancel ?? hideModal)();
      insertIntoFormula({ context, setContext, refs }, name);
    });
  const { functionlist } = locale(context);
  const recentList = useRecentFunctions(functionlist);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<DialogCategory>(initialCategory);
  const [selected, setSelected] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const idBase = useId();
  const it = t.insertFunction;

  const categories: { id: DialogCategory; label: string }[] = [
    { id: "recent", label: it.mostRecentlyUsed },
    { id: "all", label: t.formulas.allFunctions },
    ...DIALOG_CATEGORIES.map((c) => ({ id: c, label: t.formulas[c] })),
  ];

  const visible = useMemo(() => {
    const q = query.trim().toUpperCase();
    if (q) {
      if (/^[A-Z0-9._]+$/.test(q)) {
        const ranked = rankFunctions(functionlist, q, functionlist.length).map(
          (r) => r.item
        );
        if (ranked.length) return ranked;
      }
      return functionlist.filter(
        (f) =>
          (f.a || "").toUpperCase().includes(q) ||
          (f.d || "").toUpperCase().includes(q)
      );
    }
    if (category === "recent") return recentList;
    if (category === "all")
      return [...functionlist].sort((a, b) => a.n.localeCompare(b.n));
    return functionsOf(functionlist, category);
  }, [query, category, functionlist, recentList]);

  const current = visible[Math.min(selected, visible.length - 1)] ?? null;

  useEffect(() => {
    searchRef.current?.focus();
  }, []);
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>('[aria-selected="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [selected, visible]);

  const insert = (f: FunctionListEntry | null) => {
    if (!f) return;
    onInsert(f.n);
  };
  const move = (e: React.KeyboardEvent, delta: number | "home" | "end") => {
    if (visible.length === 0) return;
    e.preventDefault();
    e.stopPropagation();
    setSelected((s) => {
      if (delta === "home") return 0;
      if (delta === "end") return visible.length - 1;
      return Math.max(0, Math.min(visible.length - 1, s + delta));
    });
  };
  const listKeys = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") move(e, 1);
    else if (e.key === "ArrowUp") move(e, -1);
    else if (e.key === "PageDown") move(e, 8);
    else if (e.key === "PageUp") move(e, -8);
    else if (e.key === "Home" && e.currentTarget !== searchRef.current)
      move(e, "home");
    else if (e.key === "End" && e.currentTarget !== searchRef.current)
      move(e, "end");
    else if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      insert(current);
    }
  };
  const optionId = (n: string) => `${idBase}-fn-${n}`;

  return (
    <DialogShell
      title={it.title}
      onClose={onClose}
      width={640}
      className="fortune-insert-function"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {it.cancel}
          </Button>
          <Button
            variant="primary"
            disabled={!current}
            onClick={() => insert(current)}
            data-testid="insert-function-ok"
          >
            {it.ok}
          </Button>
        </>
      }
    >
      <label className="fortune-insert-function-search">
        <Search size={16} strokeWidth={ICON_STROKE} aria-hidden />
        <input
          ref={searchRef}
          type="search"
          value={query}
          placeholder={it.searchPlaceholder}
          aria-label={it.search}
          aria-controls={`${idBase}-list`}
          aria-activedescendant={current ? optionId(current.n) : undefined}
          spellCheck={false}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelected(0);
          }}
          onKeyDown={listKeys}
        />
      </label>
      <div className="fortune-insert-function-body">
        <div
          className="fortune-insert-function-categories"
          role="listbox"
          aria-label={it.category}
          tabIndex={0}
          aria-activedescendant={`${idBase}-cat-${category}`}
          onKeyDown={(e) => {
            const i = categories.findIndex((c) => c.id === category);
            let next = i;
            if (e.key === "ArrowDown")
              next = Math.min(i + 1, categories.length - 1);
            else if (e.key === "ArrowUp") next = Math.max(i - 1, 0);
            else if (e.key === "Home") next = 0;
            else if (e.key === "End") next = categories.length - 1;
            else return;
            e.preventDefault();
            e.stopPropagation();
            setCategory(categories[next].id);
            setQuery("");
            setSelected(0);
          }}
        >
          {categories.map((c) => (
            <div
              key={c.id}
              id={`${idBase}-cat-${c.id}`}
              role="option"
              aria-selected={!query && c.id === category}
              className="fortune-insert-function-category"
              data-category={c.id}
              onClick={() => {
                setCategory(c.id);
                setQuery("");
                setSelected(0);
              }}
            >
              {c.label}
            </div>
          ))}
        </div>
        <div
          ref={listRef}
          id={`${idBase}-list`}
          className="fortune-insert-function-list"
          role="listbox"
          aria-label={it.functions}
          tabIndex={0}
          aria-activedescendant={current ? optionId(current.n) : undefined}
          onKeyDown={listKeys}
        >
          {visible.map((f, i) => (
            <div
              key={f.n}
              id={optionId(f.n)}
              role="option"
              aria-selected={current === f}
              className="fortune-insert-function-item"
              data-function={f.n}
              onClick={() => setSelected(i)}
              onDoubleClick={() => insert(f)}
            >
              <span className="fortune-insert-function-name">{f.n}</span>
              <span className="fortune-insert-function-abstract">{f.a}</span>
            </div>
          ))}
          {visible.length === 0 && (
            <div className="fortune-insert-function-empty">{it.noMatch}</div>
          )}
        </div>
      </div>
      <div className="fortune-insert-function-detail" aria-live="polite">
        {current && (
          <>
            <div className="fortune-insert-function-sig">
              {functionSignature(current)}
            </div>
            <div className="fortune-insert-function-desc">{current.d}</div>
          </>
        )}
      </div>
    </DialogShell>
  );
};

/** Open the Insert Function dialog (Shift+F3). */
export function useInsertFunctionDialog(
  h: RibbonCommandHelpers,
  t: RibbonFormulasDataReviewLocale
) {
  const { showModal, hideModal } = useContext(ModalContext);
  return (initialCategory?: DialogCategory) => {
    rememberEditorCaret(h.refs.cellInput.current);
    showModal(
      <InsertFunctionDialog
        t={t}
        initialCategory={initialCategory}
        onClose={() => {
          hideModal();
          h.focusSheet();
        }}
        onInsert={(name) => {
          hideModal();
          insertIntoFormula(h, name);
        }}
      />
    );
  };
}
