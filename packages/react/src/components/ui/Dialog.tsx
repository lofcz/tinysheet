import React, { useContext, useId, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import WorkbookContext from "../../context";
import { useDialogBehavior } from "../../hooks/useDialogBehavior";
import { ICON_STROKE } from "./icons";
import { themeAt } from "./floating";
import "./ui.css";
import "./form.css";

/**
 * Set by the workbook's generic dialog frame (`showDialog(<X />)`, see
 * components/Dialog): a DialogShell rendered inside claims the frame, which
 * then draws nothing of its own, and closes through the frame's cancel
 * handler when the shell has no `onClose`.
 */
export const DialogFrameContext = React.createContext<{
  claim: () => void;
  onCancel?: () => void;
} | null>(null);

export type DialogShellProps = {
  title: React.ReactNode;
  /** Close button / Escape (through the close button). */
  onClose?: () => void;
  /** Enter (outside buttons and multi-line fields) confirms. */
  onConfirm?: () => void;
  /** Buttons, right-aligned (secondary first, primary last). */
  footer?: React.ReactNode;
  /** Content left of the footer buttons (Excel's "Options >>", links). */
  footerStart?: React.ReactNode;
  /** Content width (px); the dialog never exceeds the viewport. */
  width?: number;
  className?: string;
  /** Class of the body (e.g. a tabbed dialog with a fixed height). */
  bodyClassName?: string;
  /** Extra content in the title row (a help link). */
  headerExtra?: React.ReactNode;
  id?: string;
  style?: React.CSSProperties;
  /** Id of the title element (defaults to a generated one). */
  titleId?: string;
  /** Accessible name when `title` is not plain text. */
  "aria-label"?: string;
  "data-testid"?: string;
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
  footerStart,
  width,
  className,
  bodyClassName,
  headerExtra,
  children,
  ...rest
}) => {
  const autoTitleId = useId();
  const titleId = rest.titleId ?? autoTitleId;
  const frame = useContext(DialogFrameContext);
  useLayoutEffect(() => {
    frame?.claim();
  }, [frame]);
  const close = onClose ?? frame?.onCancel;
  const footerRef = useRef<HTMLDivElement>(null);
  // Enter without an onConfirm presses the footer's primary button
  const confirm =
    onConfirm ??
    (() =>
      footerRef.current
        ?.querySelector<HTMLButtonElement>(".ts-btn--primary:not(:disabled)")
        ?.click());
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Enter" || e.defaultPrevented) return;
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
    if (!onConfirm && !footerRef.current?.querySelector(".ts-btn--primary"))
      return;
    e.preventDefault();
    e.stopPropagation();
    confirm();
  };
  return (
    <div
      id={rest.id}
      className={`ts-dialog${className ? ` ${className}` : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={rest["aria-label"] ? undefined : titleId}
      aria-label={rest["aria-label"]}
      data-testid={rest["data-testid"]}
      style={width ? { width, ...rest.style } : rest.style}
      onKeyDown={onKeyDown}
    >
      <div className="ts-dialog-header" data-dialog-drag-handle>
        <h2 className="ts-dialog-title" id={titleId}>
          {title}
        </h2>
        {headerExtra}
        {close && (
          <button
            type="button"
            className="ts-dialog-close"
            data-dialog-close
            aria-label="Close"
            title="Close"
            onClick={close}
          >
            <X size={16} strokeWidth={ICON_STROKE} aria-hidden />
          </button>
        )}
      </div>
      <div
        className={`ts-dialog-body${bodyClassName ? ` ${bodyClassName}` : ""}`}
      >
        {children}
      </div>
      {(footer != null || footerStart != null) && (
        <div className="ts-dialog-footer" ref={footerRef}>
          {footerStart != null && (
            <div className="ts-dialog-footer-start">{footerStart}</div>
          )}
          {footer}
        </div>
      )}
    </div>
  );
};

export type DialogProps = DialogShellProps & {
  open: boolean;
  /** Modeless dialogs (Find and Replace) let the sheet take focus. */
  modal?: boolean;
  /** Clicks on the backdrop close the dialog (modeless: never). */
  closeOnBackdrop?: boolean;
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

const DialogFrame: React.FC<
  DialogShellProps & { modal: boolean; closeOnBackdrop?: boolean }
> = ({ modal, closeOnBackdrop, ...shell }) => {
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
      className={`ts-dialog-backdrop ts-theme-root fortune-modal-container${
        modal ? "" : " ts-dialog-backdrop--modeless"
      }`}
      data-theme={themeAt(container)}
      onMouseDown={(e) => {
        e.stopPropagation();
        if (closeOnBackdrop && e.target === e.currentTarget) shell.onClose?.();
      }}
      onMouseUp={(e) => e.stopPropagation()}
      onMouseMove={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.stopPropagation()}
      // the portal bubbles React events to the workbook: keys typed in the
      // dialog must not reach the grid's handlers
      // (stopping the event also keeps it from the document listener of
      // useDialogBehavior, so Escape is handled here)
      onKeyDown={(e) => {
        e.stopPropagation();
        if (
          e.key === "Escape" &&
          !e.defaultPrevented &&
          !e.nativeEvent.isComposing &&
          shell.onClose
        ) {
          e.preventDefault();
          shell.onClose();
        }
      }}
      onKeyUp={(e) => e.stopPropagation()}
      onPaste={(e) => e.stopPropagation()}
      onCopy={(e) => e.stopPropagation()}
    >
      <DialogShell {...shell} />
    </div>,
    document.body
  );
};

export default Dialog;
