import { getRangetxt, locale } from "@lofcz/tinysheet-core";

import React, { useCallback, useContext, useEffect, useState } from "react";
import DataVerification from ".";
import WorkbookContext from "../../context";
import { useDialog } from "../../hooks/useDialog";
import ConditionRules from "../ConditionFormat/ConditionRules";
import { X } from "lucide-react";
import { Button, ICON_STROKE } from "../ui";
import "../ui/form.css";
import "./index.css";

const RangeDialog: React.FC = () => {
  const { context, setContext } = useContext(WorkbookContext);
  const { showDialog } = useDialog();
  const { dataVerification, button } = locale(context);
  const [rangeTxt2, setRangeTxt2] = useState<string>(
    context.rangeDialog?.rangeTxt ?? ""
  );

  const close = useCallback(() => {
    setContext((ctx) => {
      // 开启选区
      // globalCache.doNotUpdateCell = false;
      // ctx.formulaCache.rangestart = false;
      // ctx.formulaCache.rangedrag_column_start = false;
      // ctx.formulaCache.rangedrag_row_start = false;
      // ctx.luckysheetCellUpdate = [];
      // ctx.formulaRangeSelect = undefined;
      ctx.rangeDialog!.show = false;
      ctx.rangeDialog!.singleSelect = false;
    });
    if (!context.rangeDialog) return;
    const rangeDialogType = context.rangeDialog.type;
    if (rangeDialogType.indexOf("between") >= 0) {
      showDialog(<ConditionRules type="between" />);
      return;
    }
    if (rangeDialogType.indexOf("conditionRules") >= 0) {
      const rulesType = rangeDialogType.substring(
        "conditionRules".length,
        rangeDialogType.length
      );
      showDialog(<ConditionRules type={rulesType} />);
      return;
    }
    showDialog(<DataVerification />);
  }, [context.rangeDialog, setContext, showDialog]);

  // 得到选区坐标
  useEffect(() => {
    setRangeTxt2((r) => {
      if (context.luckysheet_select_save) {
        const range =
          context.luckysheet_select_save[
            context.luckysheet_select_save.length - 1
          ];
        r = getRangetxt(
          context,
          context.currentSheetId,
          range,
          context.currentSheetId
        );
        return r;
      }
      return "";
    });
  }, [context, context.luckysheet_select_save]);

  const confirm = () => {
    setContext((ctx) => {
      ctx.rangeDialog!.rangeTxt = rangeTxt2;
    });
    close();
  };

  // Excel's collapsed dialog: a small modeless bar while cells are picked
  return (
    <div
      id="range-dialog"
      className="ts-dialog fortune-range-dialog"
      role="dialog"
      aria-label={dataVerification.selectCellRange}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") {
          e.preventDefault();
          confirm();
        } else if (e.key === "Escape") {
          e.preventDefault();
          close();
        }
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
      tabIndex={-1}
    >
      <div className="ts-dialog-header">
        <h2 className="ts-dialog-title">{dataVerification.selectCellRange}</h2>
        <button
          type="button"
          className="ts-dialog-close"
          aria-label={button.close}
          title={button.close}
          onClick={close}
        >
          <X size={16} strokeWidth={ICON_STROKE} aria-hidden />
        </button>
      </div>
      <div className="fortune-range-dialog-row">
        <input
          readOnly
          aria-label={dataVerification.selectCellRange2}
          placeholder={dataVerification.selectCellRange2}
          value={rangeTxt2}
        />
        <Button variant="primary" onClick={confirm}>
          {button.confirm}
        </Button>
      </div>
    </div>
  );
};
export default RangeDialog;
