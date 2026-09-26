import React, {
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  colLocation,
  Context,
  getCellTopRightPostion,
  getFlowdata,
  getThreadedCommentAt,
  rowLocation,
  threadedCommentsLocale,
} from "@lofcz/tinysheet-core";
import WorkbookContext from "../../context";
import CommentCard from "./CommentCard";
import CommentsPane from "./CommentsPane";
import { SidePane } from "../SidePane";

const CARD_WIDTH = 300;
const GAP = 10;
const HOVER_DELAY = 250;

type Cell = { r: number; c: number };

/** Where a card for cell (r, c) goes, in cell-area (sheet) pixels. */
function cardPosition(ctx: Context, r: number, c: number, height: number) {
  const flowdata = getFlowdata(ctx);
  let right = ctx.visibledatacolumn[c] ?? 0;
  let top = r === 0 ? 0 : (ctx.visibledatarow[r - 1] ?? 0);
  if (flowdata) {
    const pos = getCellTopRightPostion(ctx, flowdata, r, c);
    right = pos.toX;
    top = pos.toY;
  }
  const colStart = c === 0 ? 0 : (ctx.visibledatacolumn[c - 1] ?? 0);
  const viewLeft = ctx.scrollLeft;
  const viewRight = ctx.scrollLeft + ctx.cellmainWidth;
  const viewBottom = ctx.scrollTop + ctx.cellmainHeight;
  let left = right + GAP;
  if (left + CARD_WIDTH > viewRight - 4) {
    left = Math.max(viewLeft + 4, colStart - GAP - CARD_WIDTH);
  }
  if (top + height > viewBottom - 4) top = viewBottom - 4 - height;
  top = Math.max(ctx.scrollTop + 4, top);
  return { left, top, width: CARD_WIDTH };
}

function useCardStyle(ctx: Context, cell: Cell | null) {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  // measured after every render (the content changes the height)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const h = ref.current?.offsetHeight ?? 0;
    if (h !== height) setHeight(h);
  });
  const style = cell ? cardPosition(ctx, cell.r, cell.c, height) : undefined;
  return { ref, style };
}

/**
 * Threaded comments in the cell area: the open comment card, the hover
 * preview of commented cells and the Comments pane (portalled next to the
 * grid). Registered as a sheet overlay.
 */
const ThreadedCommentsLayer: React.FC = () => {
  const { context, setContext, refs } = useContext(WorkbookContext);
  const card = context.threadedCommentCard;
  const onSheet = card?.sheetId === context.currentSheetId ? card : null;
  const thread = onSheet
    ? getThreadedCommentAt(context, onSheet.r, onSheet.c)
    : undefined;
  const openCell =
    onSheet && (thread || onSheet.mode === "new") ? onSheet : null;
  const [hover, setHover] = useState<Cell | null>(null);
  const hoverThread =
    hover && !(openCell && openCell.r === hover.r && openCell.c === hover.c)
      ? getThreadedCommentAt(context, hover.r, hover.c)
      : undefined;

  const cardPos = useCardStyle(context, openCell);
  const previewPos = useCardStyle(context, hoverThread ? hover : null);

  const close = useCallback(() => {
    setContext(
      (ctx) => {
        ctx.threadedCommentCard = null;
      },
      { noHistory: true }
    );
    refs.cellInput.current?.focus({ preventScroll: true });
  }, [refs.cellInput, setContext]);

  const closePane = useCallback(() => {
    setContext(
      (ctx) => {
        ctx.threadedCommentsPane = false;
      },
      { noHistory: true }
    );
    refs.cellInput.current?.focus({ preventScroll: true });
  }, [refs.cellInput, setContext]);

  // a card whose thread was deleted (or undone) closes
  useEffect(() => {
    if (card && onSheet && !openCell) {
      setContext(
        (ctx) => {
          ctx.threadedCommentCard = null;
        },
        { noHistory: true }
      );
    }
  }, [card, onSheet, openCell, setContext]);

  // clicking elsewhere closes the card
  const cardRef = cardPos.ref;
  useEffect(() => {
    if (!openCell) return undefined;
    const onDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target || cardRef.current?.contains(target)) return;
      if (
        target.closest(
          ".fortune-comments-pane, .fortune-thread-card, .fortune-cell-menu, .ts-popover"
        )
      ) {
        return;
      }
      setContext(
        (ctx) => {
          ctx.threadedCommentCard = null;
        },
        { noHistory: true }
      );
    };
    document.addEventListener("mousedown", onDown, true);
    return () => document.removeEventListener("mousedown", onDown, true);
  }, [openCell, cardRef, setContext]);

  // moving the active cell away (keyboard) closes the card
  const sel = context.luckysheet_select_save?.[0];
  const activeR = sel ? (sel.row_focus ?? sel.row[0]) : -1;
  const activeC = sel ? (sel.column_focus ?? sel.column[0]) : -1;
  const cardKey = openCell ? `${openCell.r}_${openCell.c}` : "";
  const lastActive = useRef(`${activeR}_${activeC}`);
  useEffect(() => {
    const now = `${activeR}_${activeC}`;
    if (now === lastActive.current) return;
    lastActive.current = now;
    if (cardKey && now !== cardKey) {
      setContext(
        (ctx) => {
          ctx.threadedCommentCard = null;
        },
        { noHistory: true }
      );
    }
  }, [activeR, activeC, cardKey, setContext]);

  // hover preview of commented cells
  const latest = useRef(context);
  latest.current = context;
  const hoverRef = useRef<Cell | null>(null);
  useEffect(() => {
    const area = refs.cellArea.current;
    if (!area) return undefined;
    let timer: number | undefined;
    const set = (cell: Cell | null) => {
      const cur = hoverRef.current;
      if (cur?.r === cell?.r && cur?.c === cell?.c) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(
        () => {
          hoverRef.current = cell;
          setHover(cell);
        },
        cell ? HOVER_DELAY : HOVER_DELAY / 2
      );
    };
    const onMove = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest(".fortune-thread-card")) {
        window.clearTimeout(timer);
        return;
      }
      const ctx = latest.current;
      if (e.buttons !== 0 || ctx.luckysheetCellUpdate.length > 0) {
        set(null);
        return;
      }
      const rect = area.getBoundingClientRect();
      const x = e.clientX - rect.left + area.scrollLeft;
      const y = e.clientY - rect.top + area.scrollTop;
      const r = rowLocation(y, ctx.visibledatarow)[2];
      const c = colLocation(x, ctx.visibledatacolumn)[2];
      set(getThreadedCommentAt(ctx, r, c) ? { r, c } : null);
    };
    const onLeave = (e: MouseEvent) => {
      const to = e.relatedTarget as HTMLElement | null;
      if (to?.closest?.(".fortune-thread-card")) return;
      set(null);
    };
    area.addEventListener("mousemove", onMove);
    area.addEventListener("mouseleave", onLeave);
    return () => {
      window.clearTimeout(timer);
      area.removeEventListener("mousemove", onMove);
      area.removeEventListener("mouseleave", onLeave);
    };
  }, [refs.cellArea]);

  return (
    <>
      {openCell && (
        <CommentCard
          ref={cardPos.ref}
          key={`${openCell.sheetId}:${openCell.r}_${openCell.c}`}
          sheetId={openCell.sheetId}
          r={openCell.r}
          c={openCell.c}
          thread={thread}
          mode={thread ? "view" : "new"}
          style={cardPos.style}
          onClose={close}
        />
      )}
      {hover && hoverThread && (
        <CommentCard
          ref={previewPos.ref}
          sheetId={context.currentSheetId}
          r={hover.r}
          c={hover.c}
          thread={hoverThread}
          mode="preview"
          style={previewPos.style}
          onClose={() => setHover(null)}
          onOpen={() => {
            const { r, c } = hover;
            setHover(null);
            hoverRef.current = null;
            setContext(
              (ctx) => {
                ctx.threadedCommentCard = {
                  sheetId: ctx.currentSheetId,
                  r,
                  c,
                  mode: "view",
                };
              },
              { noHistory: true }
            );
          }}
        />
      )}
      <SidePane
        id="comments"
        title={threadedCommentsLocale(context).paneTitle}
        open={!!context.threadedCommentsPane}
        onClose={closePane}
      >
        <CommentsPane />
      </SidePane>
    </>
  );
};

export default ThreadedCommentsLayer;
