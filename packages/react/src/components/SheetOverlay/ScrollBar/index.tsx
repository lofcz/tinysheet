import React, { useContext, useEffect } from "react";
import { clampFrozenScroll, frozenScrollMin } from "@lofcz/tinysheet-core";
import WorkbookContext from "../../../context";
import "./index.css";

type Props = {
  axis: "x" | "y";
};

const ScrollBar: React.FC<Props> = ({ axis }) => {
  const { context, refs, setContext } = useContext(WorkbookContext);

  useEffect(() => {
    const bar = (axis === "x" ? refs.scrollbarX : refs.scrollbarY).current!;
    const wanted = axis === "x" ? context.scrollLeft : context.scrollTop;
    if (axis === "x") {
      bar.scrollLeft = wanted;
    } else {
      bar.scrollTop = wanted;
    }
    // Past the end of the sheet (PageDown, scrolling a cell into view near
    // the last row...) the scrollbar stops at its end: the sheet must stop
    // there too, or it is drawn and hit-tested further than it shows.
    const size = axis === "x" ? bar.clientWidth : bar.clientHeight;
    const actual = axis === "x" ? bar.scrollLeft : bar.scrollTop;
    if (size > 0 && Math.abs(actual - wanted) >= 1) {
      setContext((draftCtx) => {
        if (axis === "x") draftCtx.scrollLeft = actual;
        else draftCtx.scrollTop = actual;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [axis === "x" ? context.scrollLeft : context.scrollTop]);

  // Panes frozen from a scrolled position: the scrolling pane starts right
  // after them and can't scroll back over them (also after a zoom changed
  // the row/column sizes).
  const min = frozenScrollMin(context);
  const minScroll = axis === "x" ? min.left : min.top;
  const scroll = axis === "x" ? context.scrollLeft : context.scrollTop;
  useEffect(() => {
    if (scroll < minScroll) {
      setContext((draftCtx) => {
        clampFrozenScroll(draftCtx);
      });
    }
  }, [minScroll, scroll, setContext]);

  return (
    <div
      ref={axis === "x" ? refs.scrollbarX : refs.scrollbarY}
      style={
        axis === "x"
          ? {
              left: context.rowHeaderWidth,
              width: `calc(100% - ${context.rowHeaderWidth}px)`,
            }
          : { height: "100%" }
      }
      className={`luckysheet-scrollbars luckysheet-scrollbar-ltr luckysheet-scrollbar-${axis}`}
      onScroll={() => {
        const bar = (axis === "x" ? refs.scrollbarX : refs.scrollbarY).current!;
        const pos = axis === "x" ? bar.scrollLeft : bar.scrollTop;
        const next = Math.max(pos, minScroll);
        if (next !== pos) {
          if (axis === "x") bar.scrollLeft = next;
          else bar.scrollTop = next;
        }
        setContext((draftCtx) => {
          if (axis === "x") {
            draftCtx.scrollLeft = next;
          } else {
            draftCtx.scrollTop = next;
          }
        });
      }}
    >
      <div
        style={
          axis === "x"
            ? { width: context.ch_width, height: 10 }
            : { width: 10, height: context.rh_height }
        }
      />
    </div>
  );
};

export default ScrollBar;
