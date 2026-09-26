import React, { useContext, useEffect, useRef } from "react";
import {
  CellMatrix,
  forEachChangedRow,
  getFlowdata,
  onCommentBoxMoveStart,
  onCommentBoxResizeStart,
  setEditingComment,
  showComments,
} from "@lofcz/tinysheet-core";
import _ from "lodash";
import ContentEditable from "../SheetOverlay/ContentEditable";
import WorkbookContext from "../../context";
import "./index.css";

const NO_COLS: number[] = [];

const NotationBoxes: React.FC = () => {
  const { context, setContext, refs } = useContext(WorkbookContext);
  const flowdata = getFlowdata(context);

  // Columns of shown comments per row (rows without any are left out). Rows
  // are immutable (immer), so after an edit only rows whose identity changed
  // are rescanned, not every cell; for chunked (large) sheets only the rows
  // of changed chunks are even looked at.
  const shownByRow = useRef(new WeakMap<object, number[]>());
  const lastScan = useRef<{
    data: CellMatrix;
    shown: Map<number, number[]>;
  } | null>(null);
  const hasCommentBoxes = (context.commentBoxes?.length ?? 0) > 0;
  const hasCommentBoxesRef = useRef(hasCommentBoxes);
  hasCommentBoxesRef.current = hasCommentBoxes;
  useEffect(() => {
    if (flowdata) {
      const cache = shownByRow.current;
      const colsOf = (i: number) => {
        const row = flowdata[i];
        if (!row) return NO_COLS;
        let cols = cache.get(row);
        if (cols === undefined) {
          cols = NO_COLS;
          for (let j = 0; j < row.length; j += 1) {
            if (row[j]?.ps?.isShow) {
              if (cols === NO_COLS) cols = [];
              cols.push(j);
            }
          }
          cache.set(row, cols);
        }
        return cols;
      };
      const last = lastScan.current;
      let shown: Map<number, number[]> | null = null;
      if (last) {
        let next: Map<number, number[]> | null = null;
        const compared = forEachChangedRow(last.data, flowdata, (i) => {
          if (!next) next = new Map(last.shown);
          const cols = colsOf(i);
          if (cols.length > 0) next.set(i, cols);
          else next.delete(i);
        });
        if (compared) shown = next ?? last.shown;
      }
      if (!shown) {
        shown = new Map();
        for (let i = 0; i < flowdata.length; i += 1) {
          const cols = colsOf(i);
          if (cols.length > 0) shown.set(i, cols);
        }
      }
      lastScan.current = { data: flowdata, shown };
      const psShownCells: { r: number; c: number }[] = [];
      Array.from(shown.keys())
        .sort((a, b) => a - b)
        .forEach((r) => {
          shown!.get(r)!.forEach((c) => psShownCells.push({ r, c }));
        });
      // nothing shown and nothing to clear: skip the extra context update
      if (psShownCells.length === 0 && !hasCommentBoxesRef.current) return;
      setContext((ctx) => showComments(ctx, psShownCells));
    }
  }, [flowdata, setContext]);
  return (
    <div id="luckysheet-postil-showBoxs">
      {_.concat(
        context.commentBoxes?.filter(
          (v) => v?.rc !== context.editingCommentBox?.rc
        ),
        [context.editingCommentBox, context.hoveredCommentBox]
      ).map((commentBox) => {
        if (!commentBox) return null;
        const { r, c, rc, left, top, width, height, value, autoFocus, size } =
          commentBox;
        const isEditing = context.editingCommentBox?.rc === rc;
        const commentId = `comment-box-${rc}`;
        return (
          <div key={rc}>
            <canvas
              id={`arrowCanvas-${rc}`}
              className="arrowCanvas"
              width={size.width}
              height={size.height}
              style={{
                position: "absolute",
                left: size.left,
                top: size.top,
                zIndex: 100,
                pointerEvents: "none",
              }}
            />
            <div
              id={commentId}
              className={`luckysheet-postil-show-main fortune-note-box${
                isEditing ? " fortune-note-box-editing" : ""
              }`}
              style={{
                width,
                height,
                left,
                top,
                zIndex: isEditing ? 200 : 100,
              }}
              onMouseDown={(e) => {
                const { nativeEvent } = e;
                // a move from the border: no text selection, no native
                // drag of a selection (which would swallow the moves and
                // Esc); a press in the text places the caret as usual
                if (
                  !(e.target as HTMLElement).closest?.(".fortune-note-editor")
                ) {
                  e.preventDefault();
                }
                // @ts-ignore
                setContext((draftContext) => {
                  if (flowdata) {
                    setEditingComment(draftContext, flowdata, r, c);
                  }
                });
                onCommentBoxMoveStart(
                  context,
                  refs.globalCache,
                  nativeEvent,
                  { r, c, rc },
                  commentId
                );
                e.stopPropagation();
              }}
            >
              <div className="luckysheet-postil-dialog-move">
                {["t", "r", "b", "l"].map((v) => (
                  <div
                    key={v}
                    className={`luckysheet-postil-dialog-move-item luckysheet-postil-dialog-move-item-${v}`}
                    data-type={v}
                  />
                ))}
              </div>
              {isEditing && (
                <div className="luckysheet-postil-dialog-resize">
                  {["lt", "mt", "lm", "rm", "rt", "lb", "mb", "rb"].map((v) => (
                    <div
                      key={v}
                      className={`luckysheet-postil-dialog-resize-item luckysheet-postil-dialog-resize-item-${v}`}
                      data-type={v}
                      onMouseDown={(e) => {
                        const { nativeEvent } = e;
                        e.preventDefault();
                        onCommentBoxResizeStart(
                          context,
                          refs.globalCache,
                          nativeEvent,
                          { r, c, rc },
                          commentId,
                          v
                        );
                        e.stopPropagation();
                      }}
                    />
                  ))}
                </div>
              )}
              <div className="fortune-note-body">
                <ContentEditable
                  id={`comment-editor-${rc}`}
                  className="fortune-note-editor"
                  autoFocus={autoFocus}
                  allowEdit={context.allowEdit}
                  spellCheck={false}
                  data-r={r}
                  data-c={c}
                  onKeyDown={(e) => e.stopPropagation()}
                  onFocus={(e) => {
                    if (context.allowEdit === false) return;
                    refs.globalCache.editingCommentBoxEle =
                      e.target as HTMLDivElement;
                  }}
                  onMouseDown={(e) => {
                    setContext((draftContext) => {
                      if (flowdata) {
                        setEditingComment(draftContext, flowdata, r, c);
                      }
                    });
                    e.stopPropagation();
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                  }}
                  initialContent={value}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default NotationBoxes;
