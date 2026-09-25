import React, { useContext, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import WorkbookContext from "../../context";
import { useDialogBehavior } from "../../hooks/useDialogBehavior";
import { ICON_STROKE } from "./icons";
import { themeAt } from "./floating";
import "./ui.css";

export type DialogShellProps = {
  title: React.ReactNode;
  /** Close button / Escape (through the close button). */
  onClose?: () => void;
  /** Enter (outside buttons and multi-line fields) confirms. */
  onConfirm?: () => void;
  /** Buttons, right-aligned (secondary first, primary last). */
  footer?: React.ReactNode;
  /** Content width (px); the dialog never exceeds the viewport. */
  width?: number;
  className?: string;
  /** Extra content in the title row (a help link). */
  headerExtra?: React.ReactNode;
  children?: React.ReactNode;
};

/**
 * The dialog frame (docs/DESIGN.md): 16px radius, 20px padding, a 15px
 * semibold title that drags the dialog, a close button, the body and a
 * right-aligned footer. role="dialog", labelled by its title.
 *
 * Show it with the workbook's modal (focus trap, Escape, backdrop):
 *
 *   const { showModal, hideModal } = useContext(ModalContext) // or useDialog
 *   showModal(<DialogShell title="Go To" onClose={hideModal}>…</DialogShell>)
 *
 * or render `<Dialog open …>` anywhere (it brings its own backdrop).
 */
export const DialogShell: React.FC<DialogShellProps> = ({
  title,
  onClose,
  onConfirm,
  footer,
  width,
  className,
  headerExtra,
  children,
}) => {
  const titleId = useId();
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!onConfirm || e.key !== "Enter" || e.defaultPrevented) return;
    if (e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return;
    if (e.nativeEvent.isComposing) return;
    const target = e.target as HTMLElement;
    if (
      target.closest(
        "textarea, select, button, a, [role=button], [role=menuitem], [role=combobox], [contenteditable=true]"
      )
    ) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    onConfirm();
  };
  return (
    <div
      className={`ts-dialog${className ? ` ${className}` : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      style={width ? { width } : undefined}
      onKeyDown={onKeyDown}
    >
      <div className="ts-dialog-header" data-dialog-drag-handle>
        <h2 className="ts-dialog-title" id={titleId}>
          {title}
        </h2>
        {headerExtra}
        {onClose && (
          <button
            type="button"
            className="ts-dialog-close"
            data-dialog-close
            aria-label="Close"
            onClick={onClose}
          >
            <X size={16} strokeWidth={ICON_STROKE} aria-hidden />
          </button>
        )}
      </div>
      <div className="ts-dialog-body">{children}</div>
      {footer != null && <div className="ts-dialog-footer">{footer}</div>}
    </div>
  );
};

export type DialogProps = DialogShellProps & {
  open: boolean;
  /** Modeless dialogs (Find and Replace) let the sheet take focus. */
  modal?: boolean;
};

/**
 * A self-contained dialog: backdrop (`--ts-backdrop`), focus trap, Escape,
 * focus back on close, draggable title. Portaled next to the workbook so
 * it carries the theme.
 */
export const Dialog: React.FC<DialogProps> = ({
  open,
  modal = true,
  ...shell
}) => {
  if (!open) return null;
  return <DialogFrame modal={modal} {...shell} />;
};

const DialogFrame: React.FC<DialogShellProps & { modal: boolean }> = ({
  modal,
  ...shell
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const { refs } = useContext(WorkbookContext);
  const container = refs?.workbookContainer?.current ?? null;
  useDialogBehavior(ref, {
    modal,
    onEscape: shell.onClose,
    fallbackFocus: () =>
      refs?.cellInput?.current?.focus({ preventScroll: true }),
    getDragTarget: () =>
      (ref.current?.querySelector(".ts-dialog") as HTMLElement | null) ?? null,
  });
  return createPortal(
    <div
      ref={ref}
      className="ts-dialog-backdrop ts-theme-root"
      data-theme={themeAt(container)}
      onMouseDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.stopPropagation()}
    >
      <DialogShell {...shell} />
    </div>,
    document.body
  );
};

export default Dialog;
