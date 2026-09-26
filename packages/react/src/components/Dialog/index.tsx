import { dialogsLocale, locale } from "@lofcz/tinysheet-core";
import React, {
  useCallback,
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import { X } from "lucide-react";
import WorkbookContext from "../../context";
import { Button, DialogFrameContext, ICON_STROKE } from "../ui";
import "../ui/form.css";
import "./index.css";

type Props = {
  type?: "ok" | "yesno";
  onOk?: () => void;
  onCancel?: () => void;
  /** Title of the frame (messages: the application name, as in Excel). */
  title?: React.ReactNode;
  containerStyle?: React.CSSProperties;
  contentStyle?: React.CSSProperties;
  children?: React.ReactNode;
};

/**
 * The generic dialog frame of `showDialog` / `showAlert`, drawn as a
 * DialogShell (docs/DESIGN.md): title, close button, the content, and OK
 * (or Cancel / OK) in the footer.
 *
 * Content that renders its own DialogShell (every built-in dialog) claims
 * the frame: the frame then draws nothing but the wrapper the modal moves
 * when the title is dragged, and the shell's close button runs `onCancel`
 * unless the shell has its own `onClose`. The content keeps its place in
 * the tree either way, so claiming never remounts it.
 */
const Dialog: React.FC<Props> = ({
  type: typeProp,
  onOk,
  onCancel,
  title,
  children,
  containerStyle,
  contentStyle,
}) => {
  const { context } = useContext(WorkbookContext);
  const { button } = locale(context);
  const titleId = useId();
  const [claimed, setClaimed] = useState(false);
  const claim = useCallback(() => setClaimed(true), []);
  const frame = useMemo(() => ({ claim, onCancel }), [claim, onCancel]);
  // a frame inside another one (showDialog of a component that brings its
  // own <Dialog>) takes over the outer frame, like a DialogShell does
  const parent = useContext(DialogFrameContext);
  useLayoutEffect(() => {
    parent?.claim();
  }, [parent]);
  const message = typeof children === "string";
  // a plain message always gets an OK button
  const type = typeProp ?? (message ? "ok" : undefined);

  // Enter confirms, as a dialog's default button does (controls that use
  // Enter themselves, e.g. buttons and multi-line inputs, keep it)
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (claimed || type == null || e.key !== "Enter" || e.defaultPrevented)
      return;
    if (e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return;
    if (e.nativeEvent.isComposing) return;
    const target = e.target as HTMLElement;
    if (
      target.closest(
        "textarea, select, button, a, [role=button], [role=menuitem], [contenteditable=true]"
      )
    ) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    (onOk ?? onCancel)?.();
  };

  return (
    <DialogFrameContext.Provider value={frame}>
      <div
        className={
          claimed
            ? "fortune-dialog-frame"
            : `ts-dialog fortune-dialog${message ? " fortune-message-box" : ""}`
        }
        role={claimed ? undefined : "dialog"}
        aria-modal={claimed ? undefined : true}
        aria-labelledby={claimed ? undefined : titleId}
        style={claimed ? undefined : containerStyle}
        onKeyDown={onKeyDown}
      >
        {!claimed && (
          <div className="ts-dialog-header" data-dialog-drag-handle>
            <h2 className="ts-dialog-title" id={titleId}>
              {title ?? dialogsLocale(context).appName}
            </h2>
            <button
              type="button"
              className="ts-dialog-close"
              data-dialog-close
              aria-label={button.close}
              title={button.close}
              onClick={onCancel}
            >
              <X size={16} strokeWidth={ICON_STROKE} aria-hidden />
            </button>
          </div>
        )}
        <div
          className={
            claimed ? "fortune-dialog-frame-content" : "ts-dialog-body"
          }
          style={claimed ? undefined : contentStyle}
        >
          {message && !claimed ? (
            <p className="fortune-message-box-text">{children}</p>
          ) : (
            children
          )}
        </div>
        {!claimed && type != null && (
          <div className="ts-dialog-footer">
            {type === "ok" ? (
              <Button variant="primary" onClick={onOk ?? onCancel} autoFocus>
                {button.confirm}
              </Button>
            ) : (
              <>
                <Button variant="secondary" onClick={onCancel}>
                  {button.cancel}
                </Button>
                <Button variant="primary" onClick={onOk ?? onCancel} autoFocus>
                  {button.confirm}
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </DialogFrameContext.Provider>
  );
};

export default Dialog;
