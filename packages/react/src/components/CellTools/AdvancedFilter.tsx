import {
  AdvancedFilterOptions,
  cellToolsLocale,
  getAdvancedFilter,
  getFlowdata,
  getSortRegion,
  parseRefText,
  refText,
  runAdvancedFilterCommand,
} from "@lofcz/tinysheet-core";
import React, { useContext, useState } from "react";
import WorkbookContext from "../../context";
import { useDialog } from "../../hooks/useDialog";
import { activateOnKey } from "../Toolbar/Button";
import DtCheck from "../DataVerification/DtCheck";
import { RefField, startRefPick } from "./refPick";

type Fields = {
  action: "inPlace" | "copy";
  list: string;
  criteria: string;
  copyTo: string;
  unique: boolean;
};

/** The last criteria / copy-to typed per sheet, offered again next time. */
const remembered: Record<string, Partial<Fields>> = {};

/** Data › Advanced Filter. */
const AdvancedFilter: React.FC<{ initial?: Fields }> = ({ initial }) => {
  const { context, setContext } = useContext(WorkbookContext);
  const { showDialog, hideDialog } = useDialog();
  const t = cellToolsLocale(context).advancedFilter;
  const [fields, setFields] = useState<Fields>(() => {
    if (initial) return initial;
    const prev = remembered[context.currentSheetId] ?? {};
    const state = getAdvancedFilter(context);
    let list = "";
    if (state) {
      list = refText(context, state.list);
    } else {
      const data = getFlowdata(context);
      const sel = context.luckysheet_select_save?.[0];
      if (data && sel) {
        const single =
          sel.row[0] === sel.row[1] && sel.column[0] === sel.column[1];
        list = refText(
          context,
          single
            ? getSortRegion(
                data,
                sel.row_focus ?? sel.row[0],
                sel.column_focus ?? sel.column[0]
              )
            : sel
        );
      }
    }
    return {
      action: "inPlace",
      list,
      criteria: prev.criteria ?? "",
      copyTo: prev.copyTo ?? "",
      unique: false,
    };
  });
  const [error, setError] = useState("");
  const set = (patch: Partial<Fields>) => {
    setError("");
    setFields((f) => ({ ...f, ...patch }));
  };

  const pick = (field: "list" | "criteria" | "copyTo", label: string) => {
    hideDialog();
    startRefPick({
      label,
      onDone: (ref) =>
        showDialog(
          <AdvancedFilter
            initial={{ ...fields, ...(ref != null ? { [field]: ref } : {}) }}
          />
        ),
    });
  };

  const onOk = () => {
    const onSheet = (text: string) => {
      const ref = parseRefText(context, text);
      return ref && ref.sheetId === context.currentSheetId ? ref : null;
    };
    const list = onSheet(fields.list);
    if (!list || list.row[1] <= list.row[0]) {
      setError(t.errList);
      return;
    }
    let criteria = null;
    if (fields.criteria.trim()) {
      criteria = onSheet(fields.criteria);
      if (!criteria || criteria.row[1] <= criteria.row[0]) {
        setError(t.errCriteria);
        return;
      }
    }
    let copyTo = null;
    if (fields.action === "copy") {
      copyTo = onSheet(fields.copyTo);
      if (!copyTo) {
        setError(t.errCopyTo);
        return;
      }
    }
    remembered[context.currentSheetId] = {
      criteria: fields.criteria,
      copyTo: fields.copyTo,
    };
    const options: AdvancedFilterOptions = {
      list,
      criteria,
      action: fields.action,
      copyTo,
      unique: fields.unique,
    };
    hideDialog();
    setContext((ctx) => {
      runAdvancedFilterCommand(ctx, options);
    });
  };

  const radio = (value: Fields["action"], text: string) => (
    <label className="fortune-dt-check" htmlFor={`fortune-af-${value}`}>
      <input
        id={`fortune-af-${value}`}
        type="radio"
        name="fortune-af-action"
        checked={fields.action === value}
        onChange={() => set({ action: value })}
      />
      {text}
    </label>
  );

  return (
    <div
      className="fortune-dt-dialog fortune-advanced-filter"
      onKeyDown={(e) => {
        if (e.key === "Enter") onOk();
      }}
    >
      <div className="fortune-dt-title">{t.title}</div>
      <div className="fortune-dt-section">
        <div className="fortune-dt-section-title">{t.action}</div>
        {radio("inPlace", t.inPlace)}
        {radio("copy", t.copy)}
      </div>
      <RefField
        id="fortune-af-list"
        label={t.listRange}
        value={fields.list}
        onChange={(v) => set({ list: v })}
        onPick={() => pick("list", t.listRange)}
      />
      <RefField
        id="fortune-af-criteria"
        label={t.criteriaRange}
        value={fields.criteria}
        onChange={(v) => set({ criteria: v })}
        onPick={() => pick("criteria", t.criteriaRange)}
      />
      <RefField
        id="fortune-af-copy-to"
        label={t.copyTo}
        value={fields.copyTo}
        disabled={fields.action !== "copy"}
        onChange={(v) => set({ copyTo: v })}
        onPick={() => pick("copyTo", t.copyTo)}
      />
      <DtCheck checked={fields.unique} onChange={(v) => set({ unique: v })}>
        {t.unique}
      </DtCheck>
      {error && <div className="fortune-dt-error">{error}</div>}
      <div
        className="fortune-dt-buttons"
        style={{ justifyContent: "flex-end" }}
      >
        <div
          className="button-basic button-primary"
          role="button"
          tabIndex={0}
          onKeyDown={activateOnKey}
          onClick={onOk}
        >
          {t.ok}
        </div>
        <div
          className="button-basic button-default"
          role="button"
          tabIndex={0}
          onKeyDown={activateOnKey}
          onClick={hideDialog}
        >
          {t.cancel}
        </div>
      </div>
    </div>
  );
};

export default AdvancedFilter;
