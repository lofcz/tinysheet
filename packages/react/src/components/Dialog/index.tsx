import { locale } from "@lofcz/tinysheet-core";
import React, { useContext } from "react";
import WorkbookContext from "../../context";
import SVGIcon from "../SVGIcon";
import "./index.css";
import { activateOnKey } from "../Toolbar/Button";

type Props = {
  type?: "ok" | "yesno";
  onOk?: () => void;
  onCancel?: () => void;
  containerStyle?: React.CSSProperties;
  contentStyle?: React.CSSProperties;
  children?: React.ReactNode;
};

const Dialog: React.FC<Props> = ({
  type,
  onOk,
  onCancel,
  children,
  containerStyle,
  contentStyle,
}) => {
  const { context } = useContext(WorkbookContext);
  const { button } = locale(context);
  // Enter confirms, as a dialog's default button does (controls that use
  // Enter themselves, e.g. buttons and multi-line inputs, keep it)
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (type == null || e.key !== "Enter" || e.defaultPrevented) return;
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
    onOk?.();
  };
  return (
    <div
      className="fortune-dialog"
      style={containerStyle}
      role="dialog"
      aria-modal="true"
      onKeyDown={onKeyDown}
    >
      <div className="fortune-modal-dialog-header">
        <div
          className="fortune-modal-dialog-icon-close"
          onClick={onCancel}
          onKeyDown={activateOnKey}
          tabIndex={0}
          role="button"
          aria-label={button.close}
          title={button.close}
        >
          <SVGIcon name="close" />
        </div>
      </div>
      <div className="fortune-dialog-box-content" style={contentStyle}>
        {children}
      </div>
      {type != null && (
        <div className="fortune-dialog-box-button-container">
          {type === "ok" ? (
            <div
              className="fortune-message-box-button button-basic button-default"
              onClick={onOk}
              onKeyDown={activateOnKey}
              role="button"
              tabIndex={0}
            >
              {button.confirm}
            </div>
          ) : (
            <>
              <div
                className="fortune-message-box-button button-basic button-primary"
                onClick={onOk}
                onKeyDown={activateOnKey}
                role="button"
                tabIndex={0}
              >
                {button.confirm}
              </div>
              <div
                className="fortune-message-box-button button-basic button-default"
                onClick={onCancel}
                onKeyDown={activateOnKey}
                role="button"
                tabIndex={0}
              >
                {button.cancel}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default Dialog;
