/**
 * Side panes (docs/DESIGN.md): Comments, Format Shape, PivotTable Fields,
 * Watch Window dock on the right of the grid as a Fika right pane
 * (resizable separator, 260–360px), never floating.
 *
 * Declarative — render it anywhere inside the workbook; the content is
 * portaled into the dock while `open`:
 *
 *   <SidePane id="comments" title="Comments" open={show} onClose={hide}>
 *     <CommentsList />
 *   </SidePane>
 *
 * Imperative — from a command handler:
 *
 *   const { openSidePane, closeSidePane, toggleSidePane } = useSidePane();
 *   openSidePane("watch", <WatchWindow />, { title: "Watch Window" });
 *
 * Several open panes share the dock: the last opened one shows, a
 * segmented switch in the header selects between them.
 */
import React, {
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { ribbonLocale } from "@lofcz/tinysheet-core";
import WorkbookContext from "../../context";
import { ICON_STROKE, Tabs, Tooltip } from "../ui";
import "../ui/form.css";
import { trackPointerDrag } from "../../hooks/pointerDrag";
import "./index.css";

export const SIDE_PANE_MIN = 260;
export const SIDE_PANE_MAX = 360;
const SIDE_PANE_DEFAULT = 300;

type Entry = {
  id: string;
  title: React.ReactNode;
  /** Imperatively opened content (declarative panes portal theirs). */
  content?: React.ReactNode;
  onClose?: () => void;
  /** Opened with openSidePane (closed by the dock, not by a prop). */
  imperative?: boolean;
  /** Open order: the highest shows. */
  seq: number;
};

type SidePaneApi = {
  /** Open (or bring to front) a pane with this content. */
  openSidePane: (
    id: string,
    content: React.ReactNode,
    options?: { title?: React.ReactNode; onClose?: () => void }
  ) => void;
  closeSidePane: (id: string) => void;
  toggleSidePane: (
    id: string,
    content: React.ReactNode,
    options?: { title?: React.ReactNode; onClose?: () => void }
  ) => void;
  /** The pane shown in the dock, if any. */
  activeSidePane: string | null;
  isSidePaneOpen: (id: string) => boolean;
};

type SidePaneContextValue = SidePaneApi & {
  entries: Entry[];
  register: (entry: Omit<Entry, "seq">) => void;
  unregister: (id: string) => void;
  activate: (id: string) => void;
  body: HTMLElement | null;
  setBody: (el: HTMLElement | null) => void;
  width: number;
  setWidth: (w: number) => void;
};

const noop = () => {};
const SidePaneContext = React.createContext<SidePaneContextValue>({
  openSidePane: noop,
  closeSidePane: noop,
  toggleSidePane: noop,
  activeSidePane: null,
  isSidePaneOpen: () => false,
  entries: [],
  register: noop,
  unregister: noop,
  activate: noop,
  body: null,
  setBody: noop,
  width: SIDE_PANE_DEFAULT,
  setWidth: noop,
});

let seqCounter = 0;

export const SidePaneProvider: React.FC<{ children?: React.ReactNode }> = ({
  children,
}) => {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [body, setBody] = useState<HTMLElement | null>(null);
  const [width, setWidthState] = useState(SIDE_PANE_DEFAULT);

  const register = useCallback((entry: Omit<Entry, "seq">) => {
    setEntries((list) => {
      const prev = list.find((e) => e.id === entry.id);
      if (prev && prev.title === entry.title && prev.onClose === entry.onClose)
        return list;
      if (prev) {
        return list.map((e) =>
          e.id === entry.id ? { ...entry, seq: prev.seq } : e
        );
      }
      seqCounter += 1;
      return [...list, { ...entry, seq: seqCounter }];
    });
  }, []);
  const unregister = useCallback((id: string) => {
    setEntries((list) => list.filter((e) => e.id !== id));
  }, []);
  const activate = useCallback((id: string) => {
    seqCounter += 1;
    const seq = seqCounter;
    setEntries((list) => list.map((e) => (e.id === id ? { ...e, seq } : e)));
  }, []);
  const openSidePane = useCallback<SidePaneApi["openSidePane"]>(
    (id, content, options) => {
      seqCounter += 1;
      const seq = seqCounter;
      setEntries((list) => [
        ...list.filter((e) => e.id !== id),
        {
          id,
          content,
          title: options?.title ?? "",
          onClose: options?.onClose,
          imperative: true,
          seq,
        },
      ]);
    },
    []
  );
  const entriesRef = useRef(entries);
  entriesRef.current = entries;
  const closeSidePane = useCallback((id: string) => {
    const entry = entriesRef.current.find((e) => e.id === id);
    if (!entry) return;
    entry.onClose?.();
    // declarative panes close through their own `open` prop
    if (entry.imperative) {
      setEntries((list) => list.filter((e) => e.id !== id));
    }
  }, []);
  const active = useMemo(
    () =>
      entries.reduce<Entry | null>(
        (best, e) => (!best || e.seq > best.seq ? e : best),
        null
      ),
    [entries]
  );
  const isSidePaneOpen = useCallback(
    (id: string) => entries.some((e) => e.id === id),
    [entries]
  );
  const toggleSidePane = useCallback<SidePaneApi["toggleSidePane"]>(
    (id, content, options) => {
      if (entries.some((e) => e.id === id)) closeSidePane(id);
      else openSidePane(id, content, options);
    },
    [entries, closeSidePane, openSidePane]
  );
  const setWidth = useCallback((w: number) => {
    setWidthState(
      Math.round(Math.min(SIDE_PANE_MAX, Math.max(SIDE_PANE_MIN, w)))
    );
  }, []);

  const value = useMemo<SidePaneContextValue>(
    () => ({
      openSidePane,
      closeSidePane,
      toggleSidePane,
      activeSidePane: active?.id ?? null,
      isSidePaneOpen,
      entries,
      register,
      unregister,
      activate,
      body,
      setBody,
      width,
      setWidth,
    }),
    [
      openSidePane,
      closeSidePane,
      toggleSidePane,
      active,
      isSidePaneOpen,
      entries,
      register,
      unregister,
      activate,
      body,
      width,
      setWidth,
    ]
  );
  return (
    <SidePaneContext.Provider value={value}>
      {children}
    </SidePaneContext.Provider>
  );
};

/** Open, close and query the side panes of the workbook. */
export function useSidePane(): SidePaneApi {
  const {
    openSidePane,
    closeSidePane,
    toggleSidePane,
    activeSidePane,
    isSidePaneOpen,
  } = useContext(SidePaneContext);
  return {
    openSidePane,
    closeSidePane,
    toggleSidePane,
    activeSidePane,
    isSidePaneOpen,
  };
}

export type SidePaneProps = {
  id: string;
  title: React.ReactNode;
  open: boolean;
  /** The close button (and closeSidePane(id)). */
  onClose?: () => void;
  children?: React.ReactNode;
};

/** A pane docked right of the grid while `open` (see the file comment). */
export const SidePane: React.FC<SidePaneProps> = ({
  id,
  title,
  open,
  onClose,
  children,
}) => {
  const { register, unregister, activeSidePane, body } =
    useContext(SidePaneContext);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const close = useCallback(() => onCloseRef.current?.(), []);
  // `title` should be a string (or a memoized element)
  useLayoutEffect(() => {
    if (!open) return undefined;
    register({ id, title, onClose: close });
    return undefined;
  }, [open, id, title, register, close]);
  useLayoutEffect(() => {
    if (!open) return undefined;
    return () => unregister(id);
  }, [open, id, unregister]);
  if (!open || activeSidePane !== id || !body) return null;
  // a pane is often declared inside the grid (a sheet overlay): its
  // pointer events must not bubble (through the React tree) into the
  // cell area's handlers, which would select cells and take the focus
  return createPortal(
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      className="fortune-side-pane-portal"
      onMouseDown={stopPropagation}
      onMouseUp={stopPropagation}
      onClick={stopPropagation}
      onDoubleClick={stopPropagation}
      onContextMenu={stopPropagation}
      onPointerDown={stopPropagation}
      onWheel={stopPropagation}
    >
      {children}
    </div>,
    body
  );
};

const stopPropagation = (e: React.SyntheticEvent) => e.stopPropagation();

/** The dock right of the grid pane: separator, header, body. */
export const SidePaneSlot: React.FC = () => {
  const {
    entries,
    activeSidePane,
    activate,
    closeSidePane,
    setBody,
    width,
    setWidth,
  } = useContext(SidePaneContext);
  const { context } = useContext(WorkbookContext);
  const t = ribbonLocale(context).sidePane;
  const active = entries.find((e) => e.id === activeSidePane);
  const drag = useRef<{ x: number; w: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  if (!active) return null;
  const ordered = [...entries].sort((a, b) => a.seq - b.seq);
  return (
    <div
      className="fortune-side-slot"
      style={{ width, flexBasis: width }}
      data-side-pane={active.id}
    >
      <div
        className={`fortune-side-separator${dragging ? " is-active" : ""}`}
        role="separator"
        aria-orientation="vertical"
        aria-label={t.resize}
        aria-valuemin={SIDE_PANE_MIN}
        aria-valuemax={SIDE_PANE_MAX}
        aria-valuenow={width}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") setWidth(width + 16);
          else if (e.key === "ArrowRight") setWidth(width - 16);
          else return;
          e.preventDefault();
          // the grid must not take the arrow keys
          e.stopPropagation();
        }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.preventDefault();
          const start = { x: e.clientX, w: width };
          drag.current = start;
          setDragging(true);
          const end = () => {
            drag.current = null;
            setDragging(false);
          };
          trackPointerDrag(e, {
            onMove: (ev) => setWidth(start.w + start.x - ev.clientX),
            onEnd: end,
            // Esc: the pane keeps its width
            onCancel: () => {
              setWidth(start.w);
              end();
            },
          });
        }}
      />
      {/* the pane keeps its keys and clicks from the grid's handlers */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <aside
        className="fortune-pane fortune-side-pane"
        aria-label={typeof active.title === "string" ? active.title : undefined}
        onKeyDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onMouseUp={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.stopPropagation()}
        onPaste={(e) => e.stopPropagation()}
        onCopy={(e) => e.stopPropagation()}
        onCut={(e) => e.stopPropagation()}
      >
        <header className="fortune-side-pane-header">
          {ordered.length > 1 ? (
            <Tabs
              size="sm"
              tabs={ordered.map((e) => ({
                id: e.id,
                label: (
                  <span
                    className="fortune-side-pane-tab-label"
                    title={typeof e.title === "string" ? e.title : undefined}
                  >
                    {e.title}
                  </span>
                ),
              }))}
              value={active.id}
              onChange={activate}
              className="fortune-side-pane-tabs"
              fill
            />
          ) : (
            <h2 className="fortune-side-pane-title">{active.title}</h2>
          )}
          <Tooltip label={t.close}>
            <button
              type="button"
              className="ts-icon-btn ts-icon-btn--sm"
              aria-label={t.close}
              onClick={() => closeSidePane(active.id)}
            >
              <X size={16} strokeWidth={ICON_STROKE} aria-hidden />
            </button>
          </Tooltip>
        </header>
        <div className="fortune-side-pane-body" ref={setBody}>
          {active.content}
        </div>
      </aside>
    </div>
  );
};

export default SidePane;
