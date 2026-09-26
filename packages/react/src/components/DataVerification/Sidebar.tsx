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
import { ListChecks, Pencil, Trash2 } from "lucide-react";
import { Button, IconButton, ICON_STROKE } from "../ui";
import { SidePane } from "../SidePane";
import DataVerification from ".";
import "./dataTools.css";
import "./sidebar.css";

/**
 * Data validation rules of the current sheet (FortuneSheet#746): each rule
 * with the ranges it applies to, plus edit and delete. Shown in the side
 * pane dock (DataVerificationPane).
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
    <div className="fortune-dv-sidebar ts-pane-content ts-pane-padded">
      <div className="fortune-dv-sidebar-actions">
        <Button
          variant="primary"
          size="sm"
          icon="plus"
          onClick={() => openDialog()}
        >
          {t.addRule}
        </Button>
        <span className="fortune-dt-hint">
          {formatLocaleText(t.ruleCount, { count: rules.length })}
        </span>
      </div>
      <div className="fortune-dv-sidebar-list">
        {rules.length === 0 && (
          <div className="ts-pane-empty fortune-dv-sidebar-empty">
            <ListChecks size={28} strokeWidth={ICON_STROKE} aria-hidden />
            <p>{t.noRules}</p>
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
              if (e.key === "Enter" && e.target === e.currentTarget)
                select(rule.ranges);
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
              <IconButton
                size="sm"
                icon={Pencil}
                label={t.edit}
                onClick={(e) => {
                  e.stopPropagation();
                  openDialog(rule.id);
                }}
              />
              <IconButton
                size="sm"
                icon={Trash2}
                label={t.delete}
                onClick={(e) => {
                  e.stopPropagation();
                  setContext((ctx) => {
                    deleteDataVerificationRule(ctx, rule.id);
                  });
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/** The validation rules pane, docked in the side pane. */
export const DataVerificationPane: React.FC = () => {
  const { context, setContext } = useContext(WorkbookContext);
  const t = dataToolsLocale(context).dataValidation;
  return (
    <SidePane
      id="data-validation"
      title={t.rules}
      open={!!context.dataVerificationSidebar}
      onClose={() =>
        setContext((ctx) => {
          ctx.dataVerificationSidebar = false;
        })
      }
    >
      <DataVerificationSidebar />
    </SidePane>
  );
};

export default DataVerificationSidebar;
