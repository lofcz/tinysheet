import {
  acceptDataVerificationAlert,
  dataToolsLocale,
  dismissDataVerificationAlert,
} from "@lofcz/tinysheet-core";
import React, { useCallback, useContext, useEffect, useRef } from "react";
import WorkbookContext from "../../context";
import { useDialog } from "../../hooks/useDialog";
import "./dataTools.css";

const ICONS: Record<string, string> = {
  stop: "×",
  warning: "!",
  information: "i",
};

/**
 * The error alert of a data validation rule (Stop, Warning or
 * Information), shown after invalid input.
 */
const DataVerificationAlert: React.FC = () => {
  const { context, setContext } = useContext(WorkbookContext);
  const { hideDialog } = useDialog();
  const t = dataToolsLocale(context).dataValidation;
  const alert = context.dataVerificationAlert;
  const primaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    primaryRef.current?.focus();
  }, []);

  const accept = useCallback(() => {
    setContext((ctx) => {
      acceptDataVerificationAlert(ctx);
    });
    hideDialog();
  }, [hideDialog, setContext]);

  const dismiss = useCallback(() => {
    setContext((ctx) => {
      dismissDataVerificationAlert(ctx);
    });
    hideDialog();
  }, [hideDialog, setContext]);

  if (!alert) return null;
  const { style } = alert;

  const button = (
    label: string,
    onClick: () => void,
    ref?: React.Ref<HTMLDivElement>
  ) => (
    <div
      ref={ref}
      className={`button-basic ${ref ? "button-primary" : "button-default"}`}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {label}
    </div>
  );

  return (
    <div
      className="fortune-dt-dialog"
      style={{ minWidth: 340 }}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") dismiss();
      }}
    >
      <div className="fortune-dt-title" role="alert">
        {alert.title}
      </div>
      <div className="fortune-dt-alert">
        <div className={`fortune-dt-alert-icon ${style}`} aria-hidden="true">
          {ICONS[style]}
        </div>
        <div className="fortune-dt-alert-message">
          {alert.message}
          {style === "warning" && (
            <div style={{ marginTop: 8 }}>{t.continueQuestion}</div>
          )}
        </div>
      </div>
      <div
        className="fortune-dt-buttons"
        style={{ justifyContent: "flex-end" }}
      >
        {style === "stop" && (
          <>
            {button(t.retry, dismiss, primaryRef)}
            {button(t.cancel, dismiss)}
          </>
        )}
        {style === "warning" && (
          <>
            {button(t.yes, accept, primaryRef)}
            {button(t.no, dismiss)}
            {button(t.cancel, dismiss)}
          </>
        )}
        {style === "information" && (
          <>
            {button(t.ok, accept, primaryRef)}
            {button(t.cancel, dismiss)}
          </>
        )}
      </div>
    </div>
  );
};

export default DataVerificationAlert;
