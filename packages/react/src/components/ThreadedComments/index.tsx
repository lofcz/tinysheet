/**
 * Threaded comments UI (Excel's "Comments"; notes stay in NotationBoxes):
 * the comment card and hover preview in the cell area, the Comments pane,
 * the "new-comment" cell menu entry and Ctrl+Shift+F2 (the ribbon commands,
 * Insert › Comment and Review › Comments, are in ../Ribbon). The model lives in core (modules/threadedComments.ts).
 */
import React from "react";
import {
  deleteThreadedCommentsInRanges,
  getThreadedCommentAt,
  getThreadedComments,
  installThreadedComments,
  openThreadedCommentCard,
  registerShortcut,
  startThreadedComment,
  threadedCommentsLocale,
} from "@lofcz/tinysheet-core";
import { registerSheetOverlay } from "../../extensions";
import { registerContextMenuItem } from "../ContextMenu/actions";
import ThreadedCommentsLayer from "./ThreadedCommentsLayer";
import "./index.css";

let installed = false;

/**
 * Register the threaded comments UI with the workbook's extension points
 * (idempotent). Called when the context menu module loads: the package is
 * marked side-effect free, so a bare import would be dropped.
 */
export function installThreadedCommentsUI() {
  if (installed) return;
  installed = true;
  installThreadedComments();
  registerSheetOverlay("threadedComments", ThreadedCommentsLayer);
  registerContextMenuItem(
    "new-comment",
    ({ context, setContext, settings, r, c, headerType, close }) => {
      if (headerType) return [];
      const t = threadedCommentsLocale(context);
      const thread = getThreadedCommentAt(context, r, c);
      const editable = context.allowEdit !== false;
      const open = (mode: "new" | "view") => () => {
        close();
        setContext(
          (ctx) => {
            openThreadedCommentCard(ctx, r, c, mode);
          },
          { noHistory: true }
        );
      };
      if (!thread) {
        return [
          {
            key: "new-comment",
            label: t.newComment,
            icon: "comment",
            disabled: !editable,
            onSelect: open("new"),
          },
        ];
      }
      return [
        {
          key: "reply-comment",
          label: t.newReply,
          icon: "comment",
          onSelect: open("view"),
        },
        {
          key: "delete-comment",
          label: t.deleteComment,
          disabled: !editable,
          onSelect: () => {
            close();
            const sel = context.luckysheet_select_save ?? [];
            const ranges =
              sel.length > 0 ? sel : [{ row: [r, r], column: [c, c] }];
            const inRanges = (x: { r: number; c: number }) =>
              ranges.some(
                (rg) =>
                  x.r >= rg.row[0] &&
                  x.r <= rg.row[rg.row.length - 1] &&
                  x.c >= rg.column[0] &&
                  x.c <= rg.column[rg.column.length - 1]
              );
            const deleted = getThreadedComments(context).filter(inRanges);
            setContext((ctx) => {
              deleteThreadedCommentsInRanges(ctx, ranges);
              ctx.threadedCommentCard = null;
            });
            deleted.forEach((old) =>
              settings.hooks?.onCommentChange?.({
                type: "deleteThread",
                sheetId: context.currentSheetId,
                threadId: old.id,
                thread: null,
                post: old,
              })
            );
          },
        },
      ];
    }
  );
  // Excel: Ctrl+Shift+F2 inserts a threaded comment
  registerShortcut("threadedComments.new", {
    key: "F2",
    mod: true,
    shift: true,
    handler: (ctx) => {
      startThreadedComment(ctx);
    },
  });
}

export { default as ThreadedCommentsLayer } from "./ThreadedCommentsLayer";
export { default as CommentsPane } from "./CommentsPane";
