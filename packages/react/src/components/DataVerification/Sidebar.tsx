import {
  api,
  dataToolsLocale,
  deleteDataVerificationRule,
  describeDataVerificationRule,
  formatLocaleText,
  getDataVerificationRules,
  initDataVerificationDialog,
  rangesToText,
} from "@lofcz/tinysheet-core";
import React, { useCallback, useContext, useMemo } from "react";
import WorkbookContext from "../../context";
import { useDialog } from "../../hooks/useDialog";
import SVGIcon from "../SVGIcon";
import DataVerification from ".";
import "./dataTools.css";
import "./sidebar.css";

/**
 * Data validation rules of the current sheet (FortuneSheet#746): each rule
 * with the ranges it applies to, plus edit and delete.
 */
const DataVerificationSidebar: React.FC = () => {
  const { context, setContext } = useContext(WorkbookContext);
  const { showDialog } = useDialog();
  const t = dataToolsLocale(context).dataValidation;
  const sheetIndex = context.luckysheetfile.findIndex(
    (s) => s.id === context.currentSheetId
  );
  const dv = context.luckysheetfile[sheetIndex]?.dataVerification;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const rules = useMemo(() => getDataVerificationRules(context), [dv]);

  const close = useCallback(() => {
    setContext((ctx) => {
      ctx.dataVerificationSidebar = false;
    });
  }, [setContext]);

  const openDialog = useCallback(
    (ruleId?: string) => {
      setContext((ctx) => {
        initDataVerificationDialog(ctx, ruleId);
      });
      showDialog(<DataVerification keepState />);
    },
    [setContext, showDialog]
  );

  const select = useCallback(
    (ranges: { row: number[]; column: number[] }[]) => {
      setContext((ctx) => {
        api.setSelection(
          ctx,
          ranges.map((r) => ({ row: r.row, column: r.column })),
          {}
        );
      });
    },
    [setContext]
  );

  return (
    <div
      className="fortune-dv-sidebar"
      aria-label={t.rules}
      style={{
        top: (context.toolbarHeight || 0) + (context.calculatebarHeight || 0),
        bottom:
          (context.sheetBarHeight || 0) + (context.statisticBarHeight || 0),
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div className="fortune-dv-sidebar-header">
        <div className="fortune-dv-sidebar-title">{t.rules}</div>
        <div
          className="fortune-dv-sidebar-close"
          role="button"
          tabIndex={0}
          aria-label={t.close}
          title={t.close}
          onClick={close}
        >
          <SVGIcon name="close" width={16} height={16} />
        </div>
      </div>
      <div className="fortune-dv-sidebar-actions">
        <div
          className="button-basic button-primary"
          role="button"
          tabIndex={0}
          onClick={() => openDialog()}
        >
          {t.addRule}
        </div>
        <span className="fortune-dt-hint">
          {formatLocaleText(t.ruleCount, { count: rules.length })}
        </span>
      </div>
      <div className="fortune-dv-sidebar-list">
        {rules.length === 0 && (
          <div className="fortune-dt-hint fortune-dv-sidebar-empty">
            {t.noRules}
          </div>
        )}
        {rules.map((rule) => (
          <div
            key={rule.id}
            className="fortune-dv-rule"
            role="button"
            tabIndex={0}
            onClick={() => select(rule.ranges)}
            onKeyDown={(e) => {
              if (e.key === "Enter") select(rule.ranges);
            }}
          >
            <div className="fortune-dv-rule-range">
              {rangesToText(context, rule.ranges)}
            </div>
            <div className="fortune-dv-rule-desc">
              {describeDataVerificationRule(context, rule.item)}
            </div>
            {rule.item.placeholder && (
              <div className="fortune-dv-rule-meta">
                {`${t.placeholder.split("(")[0].trim()}: ${
                  rule.item.placeholder
                }`}
              </div>
            )}
            <div className="fortune-dv-rule-buttons">
              <div
                className="fortune-dt-icon-button"
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  openDialog(rule.id);
                }}
              >
                {t.edit}
              </div>
              <div
                className="fortune-dt-icon-button"
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  setContext((ctx) => {
                    deleteDataVerificationRule(ctx, rule.id);
                  });
                }}
              >
                {t.delete}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DataVerificationSidebar;
