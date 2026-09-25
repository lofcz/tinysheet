import React, { useContext, useMemo, useRef, useState } from "react";
import {
  formulaAuditLocale,
  getCalcSettings,
  isShowFormulas,
  locale,
  setCalcSettings,
} from "@lofcz/tinysheet-core";
import type { CalcMode } from "@lofcz/tinysheet-core";
import WorkbookContext from "../../context";
import { useDialog } from "../../hooks/useDialog";
import { useAlert } from "../../hooks/useAlert";
import { activateOnKey } from "../Toolbar/Button";
import { useToolbarPopup } from "../Toolbar/usePopup";
import AuditIcon from "./icons";
import {
  AuditHelpers,
  runCalcOptions,
  runCalculate,
  runEvaluateFormula,
  runRemoveArrows,
  runToggleShowFormulas,
  runToggleWatchWindow,
  runTraceDependents,
  runTracePrecedents,
} from "./actions";
import { ErrorCheckingOptionsDialog } from "./Dialogs";

function useAuditHelpers(): AuditHelpers {
  const { context, setContext } = useContext(WorkbookContext);
  const { showDialog } = useDialog();
  const { showAlert } = useAlert();
  return useMemo(
    () => ({
      context,
      setContext,
      showDialog: (content: React.ReactNode) => showDialog(content),
      showMessage: (text: string) => showAlert(text, "ok"),
    }),
    [context, setContext, showDialog, showAlert]
  );
}

const ToolButton: React.FC<{
  tooltip: string;
  icon: string;
  name: string;
  selected?: boolean;
  onClick: () => void;
}> = ({ tooltip, icon, name, selected, onClick }) => (
  <div
    className={`fortune-toolbar-button fortune-toolbar-item${
      selected ? " fortune-toolbar-button-active" : ""
    }`}
    onClick={onClick}
    onKeyDown={activateOnKey}
    tabIndex={0}
    data-tips={tooltip}
    data-name={name}
    role="button"
    aria-label={tooltip}
    aria-pressed={selected === undefined ? undefined : selected}
  >
    <AuditIcon name={icon} />
    <div className="fortune-tooltip" aria-hidden="true">
      {tooltip}
    </div>
  </div>
);

type MenuItem =
  | { divider: true; key: string }
  | {
      divider?: false;
      key: string;
      label: string;
      checked?: boolean;
      shortcut?: string;
      onSelect: () => void;
    };

/** Toolbar button with a drop-down menu (the Toolbar's combo look). */
const ToolCombo: React.FC<{
  tooltip: string;
  icon: string;
  name: string;
  onClick?: () => void;
  items: MenuItem[];
}> = ({ tooltip, icon, name, onClick, items }) => {
  const { context, refs } = useContext(WorkbookContext);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const arrowRef = useRef<HTMLDivElement>(null);
  const { onPopupKeyDown, onTriggerClick, onTriggerKeyDown } = useToolbarPopup(
    open,
    setOpen,
    {
      containerRef: ref,
      popupRef,
      triggerRef: onClick ? arrowRef : mainRef,
      restoreFocus: () =>
        refs?.cellInput?.current?.focus({ preventScroll: true }),
    }
  );
  const toggle = () => setOpen((o) => !o);
  const { info } = locale(context);
  return (
    <div
      ref={ref}
      className="fortune-toobar-combo-container fortune-toolbar-item"
      data-name={name}
    >
      <div className="fortune-toolbar-combo">
        <div
          ref={mainRef}
          className="fortune-toolbar-combo-button"
          onClick={(e) => (onClick ? onClick() : onTriggerClick(e, toggle))}
          onKeyDown={(e) => {
            if (!onClick) onTriggerKeyDown(e);
            if (!e.defaultPrevented) activateOnKey(e);
          }}
          tabIndex={0}
          data-tips={tooltip}
          role="button"
          aria-label={tooltip}
          aria-haspopup={onClick ? undefined : true}
          aria-expanded={onClick ? undefined : open}
        >
          <AuditIcon name={icon} />
        </div>
        <div
          ref={arrowRef}
          className="fortune-toolbar-combo-arrow"
          onClick={(e) => onTriggerClick(e, toggle)}
          onKeyDown={(e) => {
            onTriggerKeyDown(e);
            if (!e.defaultPrevented) activateOnKey(e);
          }}
          tabIndex={0}
          role="button"
          aria-haspopup
          aria-expanded={open}
          aria-label={`${tooltip}: ${info.Dropdown}`}
        >
          <svg width="10" height="24" viewBox="0 0 10 24" aria-hidden="true">
            <path d="M2 10.5l3 3 3-3" fill="none" stroke="currentColor" />
          </svg>
        </div>
        <div className="fortune-tooltip" aria-hidden="true">
          {tooltip}
        </div>
      </div>
      {open && (
        <div
          ref={popupRef}
          className="fortune-toolbar-combo-popup fortune-audit-menu"
          onKeyDown={onPopupKeyDown}
        >
          <div className="fortune-toolbar-select" role="menu">
            {items.map((item) =>
              item.divider ? (
                <div key={item.key} className="fortune-toolbar-menu-divider" />
              ) : (
                <div
                  key={item.key}
                  className="fortune-toolbar-select-option"
                  role={
                    item.checked === undefined ? "menuitem" : "menuitemradio"
                  }
                  aria-checked={item.checked}
                  tabIndex={0}
                  data-key={item.key}
                  onKeyDown={activateOnKey}
                  onClick={() => {
                    setOpen(false);
                    item.onSelect();
                  }}
                >
                  <span className="fortune-audit-menu-check" aria-hidden>
                    {item.checked ? "✓" : ""}
                  </span>
                  <span className="fortune-audit-menu-label">{item.label}</span>
                  {item.shortcut && (
                    <span className="fortune-audit-menu-shortcut">
                      {item.shortcut}
                    </span>
                  )}
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const TracePrecedentsItem: React.FC = () => {
  const h = useAuditHelpers();
  const t = formulaAuditLocale(h.context).auditing;
  return (
    <ToolButton
      name="trace-precedents"
      tooltip={t.tracePrecedents}
      icon="tracePrecedents"
      onClick={() => runTracePrecedents(h)}
    />
  );
};

export const TraceDependentsItem: React.FC = () => {
  const h = useAuditHelpers();
  const t = formulaAuditLocale(h.context).auditing;
  return (
    <ToolButton
      name="trace-dependents"
      tooltip={t.traceDependents}
      icon="traceDependents"
      onClick={() => runTraceDependents(h)}
    />
  );
};

export const RemoveArrowsItem: React.FC = () => {
  const h = useAuditHelpers();
  const t = formulaAuditLocale(h.context).auditing;
  return (
    <ToolCombo
      name="remove-arrows"
      tooltip={t.removeArrows}
      icon="removeArrows"
      onClick={() => runRemoveArrows(h)}
      items={[
        {
          key: "all",
          label: t.removeArrows,
          onSelect: () => runRemoveArrows(h),
        },
        {
          key: "precedent",
          label: t.removePrecedentArrows,
          onSelect: () => runRemoveArrows(h, "precedent"),
        },
        {
          key: "dependent",
          label: t.removeDependentArrows,
          onSelect: () => runRemoveArrows(h, "dependent"),
        },
      ]}
    />
  );
};

export const ShowFormulasItem: React.FC = () => {
  const h = useAuditHelpers();
  const t = formulaAuditLocale(h.context).auditing;
  return (
    <ToolButton
      name="show-formulas"
      tooltip={`${t.showFormulas} (Ctrl+\`)`}
      icon="showFormulas"
      selected={isShowFormulas(h.context)}
      onClick={() => runToggleShowFormulas(h)}
    />
  );
};

export const ErrorCheckingItem: React.FC = () => {
  const h = useAuditHelpers();
  const all = formulaAuditLocale(h.context);
  return (
    <ToolCombo
      name="error-checking"
      tooltip={all.errors.checking}
      icon="errorChecking"
      items={[
        {
          key: "options",
          label: all.errors.options,
          onSelect: () => h.showDialog(<ErrorCheckingOptionsDialog />),
        },
        {
          key: "trace",
          label: all.errors.traceError,
          onSelect: () => runTracePrecedents(h),
        },
      ]}
    />
  );
};

export const EvaluateFormulaItem: React.FC = () => {
  const h = useAuditHelpers();
  const t = formulaAuditLocale(h.context).auditing;
  return (
    <ToolButton
      name="evaluate-formula"
      tooltip={t.evaluateFormula}
      icon="evaluateFormula"
      onClick={() => runEvaluateFormula(h)}
    />
  );
};

export const WatchWindowItem: React.FC = () => {
  const h = useAuditHelpers();
  const t = formulaAuditLocale(h.context).auditing;
  return (
    <ToolButton
      name="watch-window"
      tooltip={t.watchWindow}
      icon="watchWindow"
      selected={!!h.context.watchWindow?.open}
      onClick={() => runToggleWatchWindow(h)}
    />
  );
};

export const CalculationOptionsItem: React.FC = () => {
  const h = useAuditHelpers();
  const t = formulaAuditLocale(h.context).calc;
  const { mode } = getCalcSettings(h.context);
  const setMode = (m: CalcMode) =>
    h.setContext((ctx) => {
      setCalcSettings(ctx, { mode: m });
    });
  return (
    <ToolCombo
      name="calculation-options"
      tooltip={t.options}
      icon="calculation"
      items={[
        {
          key: "auto",
          label: t.automatic,
          checked: mode === "auto",
          onSelect: () => setMode("auto"),
        },
        {
          key: "autoNoTable",
          label: t.automaticExceptTables,
          checked: mode === "autoNoTable",
          onSelect: () => setMode("autoNoTable"),
        },
        {
          key: "manual",
          label: t.manual,
          checked: mode === "manual",
          onSelect: () => setMode("manual"),
        },
        { divider: true, key: "d1" },
        {
          key: "now",
          label: t.calculateNow,
          shortcut: "F9",
          onSelect: () => runCalculate(h, "now"),
        },
        {
          key: "sheet",
          label: t.calculateSheet,
          shortcut: "Shift+F9",
          onSelect: () => runCalculate(h, "sheet"),
        },
        {
          key: "full",
          label: t.calculateFull,
          shortcut: "Ctrl+Alt+F9",
          onSelect: () => runCalculate(h, "full"),
        },
        { divider: true, key: "d2" },
        {
          key: "iterative",
          label: t.iterativeSettings,
          onSelect: () => runCalcOptions(h),
        },
      ]}
    />
  );
};
