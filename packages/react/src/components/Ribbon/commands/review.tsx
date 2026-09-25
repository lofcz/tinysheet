/**
 * Review tab: Comments (New Comment, Delete, Previous, Next, Show
 * Comments), Notes (Excel's Notes menu) and Protect (Protect Sheet,
 * Protect Workbook, Allow Edit Ranges). Threaded comments, notes and
 * protection live in core and their own features.
 */
import React from "react";
import {
  addThreadedComment,
  deleteComment,
  deleteThreadedCommentsInRanges,
  editComment,
  getFlowdata,
  getThreadedComments,
  goToAdjacentThreadedComment,
  isSheetProtected,
  isWorkbookStructureProtected,
  listThreadedComments,
  newComment,
  selectRangesOnSheet,
  showHideAllComments,
  showHideComment,
  startThreadedComment,
  threadedCommentsLocale,
  activeCell,
} from "@lofcz/tinysheet-core";
import type { Context } from "@lofcz/tinysheet-core";
import {
  ArrowLeft,
  ArrowRight,
  BookLock,
  Eye,
  Layers,
  Lock,
  LockKeyholeOpen,
  LockOpen,
  MessageSquarePlus,
  MessageSquareShare,
  MessageSquareX,
  MessagesSquare,
  Pencil,
  StickyNote,
  Trash2,
} from "lucide-react";
import type { MenuItem } from "../../ui";
import type { RibbonCommandProps } from "../registry";
import { shortcutText, useRibbonCommandHelpers } from "./helpers";
import type { RibbonCommandHelpers } from "./helpers";
import { RibbonButton, useFdrText } from "./kit";
import { useAlert } from "../../../hooks/useAlert";
import {
  AllowEditRangesDialog,
  ProtectSheetDialog,
  ProtectWorkbookDialog,
  useUnprotect,
} from "../../Protection";

const UI_ONLY = { noHistory: true };

/* ------------------------------------------------------------------ */
/*  Comments                                                           */
/* ------------------------------------------------------------------ */

/** The selection's ranges (the active cell when nothing is selected). */
function selectionRanges(context: Context) {
  const sel = context.luckysheet_select_save ?? [];
  if (sel.length) return sel.map((s) => ({ row: s.row, column: s.column }));
  return [
    { row: [0, 0] as [number, number], column: [0, 0] as [number, number] },
  ];
}

function threadsInSelection(context: Context) {
  const ranges = selectionRanges(context);
  return getThreadedComments(context).filter((x) =>
    ranges.some(
      (rg) =>
        x.r >= rg.row[0] &&
        x.r <= rg.row[rg.row.length - 1] &&
        x.c >= rg.column[0] &&
        x.c <= rg.column[rg.column.length - 1]
    )
  );
}

export const NewCommentCommand: React.FC<RibbonCommandProps> = ({ size }) => {
  const h = useRibbonCommandHelpers();
  const t = useFdrText().review;
  return (
    <RibbonButton
      size={size}
      small="labeled"
      icon={MessageSquarePlus}
      label={t.newComment}
      shortcut={shortcutText(t.newCommentShortcut)}
      description={t.newCommentTip}
      onClick={() => h.setContext((ctx) => startThreadedComment(ctx), UI_ONLY)}
    />
  );
};

export const DeleteCommentCommand: React.FC<RibbonCommandProps> = ({
  size,
}) => {
  const h = useRibbonCommandHelpers();
  const t = useFdrText().review;
  const threads = threadsInSelection(h.context);
  return (
    <RibbonButton
      size={size}
      small="labeled"
      icon={MessageSquareX}
      label={t.delete}
      description={t.deleteTip}
      disabled={threads.length === 0 || h.context.allowEdit === false}
      onClick={() => {
        const ranges = selectionRanges(h.context);
        h.setContext((ctx) => {
          deleteThreadedCommentsInRanges(ctx, ranges);
          ctx.threadedCommentCard = null;
        });
        threads.forEach((old) =>
          h.settings.hooks?.onCommentChange?.({
            type: "deleteThread",
            sheetId: h.context.currentSheetId,
            threadId: old.id,
            thread: null,
            post: old,
          })
        );
      }}
    />
  );
};

const adjacentCommand = (dir: 1 | -1): React.FC<RibbonCommandProps> => {
  const Command: React.FC<RibbonCommandProps> = ({ size }) => {
    const h = useRibbonCommandHelpers();
    const t = useFdrText().review;
    const any = listThreadedComments(h.context).length > 0;
    return (
      <RibbonButton
        size={size}
        small="labeled"
        icon={dir === 1 ? ArrowRight : ArrowLeft}
        label={dir === 1 ? t.next : t.previous}
        description={dir === 1 ? t.nextTip : t.previousTip}
        disabled={!any}
        onClick={() =>
          h.setContext((ctx) => {
            goToAdjacentThreadedComment(ctx, dir);
          }, UI_ONLY)
        }
      />
    );
  };
  Command.displayName =
    dir === 1 ? "NextCommentCommand" : "PreviousCommentCommand";
  return Command;
};

export const PreviousCommentCommand = adjacentCommand(-1);
export const NextCommentCommand = adjacentCommand(1);

export const ShowCommentsCommand: React.FC<RibbonCommandProps> = ({ size }) => {
  const h = useRibbonCommandHelpers();
  const t = useFdrText().review;
  return (
    <RibbonButton
      size={size}
      small="labeled"
      icon={MessagesSquare}
      label={t.showComments}
      description={t.showCommentsTip}
      pressed={!!h.context.threadedCommentsPane}
      onClick={() =>
        h.setContext((ctx) => {
          ctx.threadedCommentsPane = !ctx.threadedCommentsPane;
        }, UI_ONLY)
      }
    />
  );
};

/* ------------------------------------------------------------------ */
/*  Notes                                                              */
/* ------------------------------------------------------------------ */

/** Cells of the current sheet with a note, row by row. */
function noteCells(context: Context) {
  const data = getFlowdata(context);
  const out: { r: number; c: number; shown: boolean }[] = [];
  data?.forEach((row, r) =>
    row?.forEach((cell, c) => {
      if (cell?.ps) out.push({ r, c, shown: !!cell.ps.isShow });
    })
  );
  return out;
}

function goToNote(h: RibbonCommandHelpers, dir: 1 | -1) {
  const notes = noteCells(h.context);
  if (!notes.length) return;
  const at = activeCell(h.context) ?? { r: 0, c: -1 };
  const cmp = (n: { r: number; c: number }) => n.r - at.r || n.c - at.c;
  const next =
    dir === 1
      ? (notes.find((n) => cmp(n) > 0) ?? notes[0])
      : ([...notes].reverse().find((n) => cmp(n) < 0) ??
        notes[notes.length - 1]);
  h.setContext((ctx) => {
    selectRangesOnSheet(
      ctx,
      ctx.currentSheetId,
      [{ row: [next.r, next.r], column: [next.c, next.c] }],
      [next.r, next.c]
    );
  }, UI_ONLY);
  h.focusSheet();
}

/** Note text without the editor's markup. */
function plainNote(value: unknown) {
  const html = String(value ?? "");
  if (typeof document === "undefined") return html;
  const div = document.createElement("div");
  div.innerHTML = html.replace(/<br\s*\/?>/gi, "\n");
  return (div.textContent ?? "").trim();
}

export const NotesCommand: React.FC<RibbonCommandProps> = ({ size }) => {
  const h = useRibbonCommandHelpers();
  const t = useFdrText().review;
  const { showAlert, hideAlert } = useAlert();
  const at = activeCell(h.context);
  const cell = at ? getFlowdata(h.context)?.[at.r]?.[at.c] : null;
  const note = cell?.ps;
  const notes = noteCells(h.context);
  const allShown = notes.length > 0 && notes.every((n) => n.shown);
  const editable = h.context.allowEdit !== false;
  const run =
    (fn: typeof newComment, history = true) =>
    () => {
      if (!at) return;
      h.setContext(
        (ctx) => fn(ctx, h.refs.globalCache, at.r, at.c),
        history ? undefined : UI_ONLY
      );
    };
  const convert = () => {
    const user = h.settings.currentUser ?? {
      id: "guest",
      name: threadedCommentsLocale(h.context).guest,
    };
    showAlert(
      t.convertConfirm,
      "yesno",
      () => {
        hideAlert();
        h.setContext((ctx) => {
          const data = getFlowdata(ctx);
          noteCells(ctx).forEach(({ r, c }) => {
            const target = data?.[r]?.[c];
            if (!target?.ps) return;
            const text = plainNote(target.ps.value);
            if (text) addThreadedComment(ctx, { r, c, text, author: user });
            target.ps = undefined;
          });
          ctx.commentBoxes = [];
          ctx.editingCommentBox = undefined;
        });
      },
      hideAlert
    );
  };
  const menu: MenuItem[] = [
    note
      ? {
          id: "edit-note",
          label: t.editNote,
          icon: Pencil,
          shortcut: shortcutText(t.newNoteShortcut),
          disabled: !editable,
          onSelect: run(editComment),
        }
      : {
          id: "new-note",
          label: t.newNote,
          icon: StickyNote,
          shortcut: shortcutText(t.newNoteShortcut),
          disabled: !editable || !at,
          onSelect: run(newComment),
        },
    {
      id: "delete-note",
      label: t.deleteNote,
      icon: Trash2,
      disabled: !note || !editable,
      onSelect: run(deleteComment),
    },
    { type: "separator" },
    {
      id: "previous-note",
      label: t.previousNote,
      icon: ArrowLeft,
      disabled: notes.length === 0,
      onSelect: () => goToNote(h, -1),
    },
    {
      id: "next-note",
      label: t.nextNote,
      icon: ArrowRight,
      disabled: notes.length === 0,
      onSelect: () => goToNote(h, 1),
    },
    { type: "separator" },
    {
      id: "show-note",
      label: t.showHideNote,
      icon: Eye,
      checked: !!note?.isShow,
      disabled: !note,
      onSelect: run(showHideComment),
    },
    {
      id: "show-all-notes",
      label: t.showAllNotes,
      icon: Layers,
      checked: allShown,
      disabled: notes.length === 0,
      onSelect: () => h.setContext((ctx) => showHideAllComments(ctx)),
    },
    { type: "separator" },
    {
      id: "convert-notes",
      label: t.convertToComments,
      icon: MessageSquareShare,
      disabled: notes.length === 0 || !editable,
      onSelect: convert,
    },
  ];
  return (
    <RibbonButton
      size={size}
      small="labeled"
      icon={StickyNote}
      label={t.notes}
      description={t.notesTip}
      menu={menu}
    />
  );
};

/* ------------------------------------------------------------------ */
/*  Protect                                                            */
/* ------------------------------------------------------------------ */

export const ProtectSheetCommand: React.FC<RibbonCommandProps> = ({ size }) => {
  const h = useRibbonCommandHelpers();
  const t = useFdrText().review;
  const unprotect = useUnprotect();
  const on = isSheetProtected(h.context);
  return (
    <RibbonButton
      size={size}
      small="labeled"
      icon={on ? LockOpen : Lock}
      label={on ? t.unprotectSheet : t.protectSheet}
      description={on ? t.unprotectSheetTip : t.protectSheetTip}
      pressed={on}
      disabled={h.context.allowEdit === false}
      onClick={() => {
        if (on) unprotect("sheet");
        else h.showDialog(<ProtectSheetDialog />);
      }}
    />
  );
};

export const ProtectWorkbookCommand: React.FC<RibbonCommandProps> = ({
  size,
}) => {
  const h = useRibbonCommandHelpers();
  const t = useFdrText().review;
  const unprotect = useUnprotect();
  const on = isWorkbookStructureProtected(h.context);
  return (
    <RibbonButton
      size={size}
      small="labeled"
      icon={BookLock}
      label={on ? t.unprotectWorkbook : t.protectWorkbook}
      description={t.protectWorkbookTip}
      pressed={on}
      disabled={h.context.allowEdit === false}
      onClick={() => {
        if (on) unprotect("workbook");
        else h.showDialog(<ProtectWorkbookDialog />);
      }}
    />
  );
};

export const AllowEditRangesCommand: React.FC<RibbonCommandProps> = ({
  size,
}) => {
  const h = useRibbonCommandHelpers();
  const t = useFdrText().review;
  return (
    <RibbonButton
      size={size}
      small="labeled"
      icon={LockKeyholeOpen}
      label={t.allowEditRanges}
      description={t.allowEditRangesTip}
      disabled={h.context.allowEdit === false || isSheetProtected(h.context)}
      onClick={() =>
        h.showDialog(
          <AllowEditRangesDialog
            onProtectSheet={() => h.showDialog(<ProtectSheetDialog />)}
          />
        )
      }
    />
  );
};
