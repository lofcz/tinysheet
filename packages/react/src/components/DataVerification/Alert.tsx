import {
  acceptDataVerificationAlert,
  dataToolsLocale,
  dismissDataVerificationAlert,
  retryDataVerificationAlert,
} from "@lofcz/tinysheet-core";
import React, { useCallback, useContext, useEffect, useRef } from "react";
import WorkbookContext from "../../context";
import { useDialog } from "../../hooks/useDialog";
import { CircleX, Info, TriangleAlert } from "lucide-react";
import { Button, DialogShell } from "../ui";
import "./dataTools.css";

const ICONS: Record<string, typeof Info> = {
  stop: CircleX,
  warning: TriangleAlert,
  information: Info,
};

/**
 * The error alert of a data validation rule (Stop, Warning or
 * Information), shown after invalid input.
 */
const DataVerificationAlert: React.FC = () => {
  const { context, setContext, refs } = useContext(WorkbookContext);
  const { hideDialog } = useDialog();
  const t = dataToolsLocale(context).dataValidation;
  const alert = context.dataVerificationAlert;
  const primaryRef = useRef<HTMLButtonElement>(null);

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

  // "Retry": edit the cell again, starting from the rejected text
  const retry = useCallback(() => {
    const current = context.dataVerificationAlert;
    const input = refs.cellInput?.current;
    const retrying =
      !!current && !!input && current.sheetId === context.currentSheetId;
    if (retrying) {
      // the editor keeps this text instead of loading the cell's value
      refs.globalCache.ignoreWriteCell = true;
      input.innerText = current.value;
    }
    setContext((ctx) => {
      retryDataVerificationAlert(ctx);
    });
    hideDialog();
    if (retrying) {
      // the formula bar shows the text too, once it has followed the
      // selection back to the cell
      window.setTimeout(() => {
        const fx = refs.fxInput?.current;
        if (fx) fx.innerText = current.value;
      });
    }
  }, [context, hideDialog, refs, setContext]);

  if (!alert) return null;
  const { style } = alert;

  const Icon = ICONS[style] ?? Info;
  const primary = (label: string, onClick: () => void) => (
    <Button ref={primaryRef} variant="primary" onClick={onClick}>
      {label}
    </Button>
  );
  const secondary = (label: string, onClick: () => void) => (
    <Button variant="secondary" onClick={onClick}>
      {label}
    </Button>
  );

  return (
    <DialogShell
      title={alert.title}
      className="fortune-dt-dialog fortune-dv-alert"
      onClose={dismiss}
      footer={
        <>
          {style === "stop" && (
            <>
              {secondary(t.cancel, dismiss)}
              {primary(t.retry, retry)}
            </>
          )}
          {style === "warning" && (
            <>
              {secondary(t.cancel, dismiss)}
              {secondary(t.no, dismiss)}
              {primary(t.yes, accept)}
            </>
          )}
          {style === "information" && (
            <>
              {secondary(t.cancel, dismiss)}
              {primary(t.ok, accept)}
            </>
          )}
        </>
      }
    >
      <div className="fortune-dt-alert" role="alert">
        <div className={`fortune-dt-alert-icon ${style}`} aria-hidden="true">
          <Icon size={20} strokeWidth={2} />
        </div>
        <div className="fortune-dt-alert-message">
          {alert.message}
          {style === "warning" && (
            <div style={{ marginTop: 8 }}>{t.continueQuestion}</div>
          )}
        </div>
      </div>
    </DialogShell>
  );
};

export default DataVerificationAlert;
