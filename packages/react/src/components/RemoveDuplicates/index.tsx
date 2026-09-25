import {
  analyzeDuplicates,
  cellText,
  dataToolsLocale,
  detectHeaderRow,
  formatLocaleText,
  getSortRegion,
  getFlowdata,
  indexToColumnChar,
  locale,
  removeDuplicates,
} from "@lofcz/tinysheet-core";
import React, { useContext, useMemo, useState } from "react";
import WorkbookContext from "../../context";
import { useDialog } from "../../hooks/useDialog";
import "../DataVerification/dataTools.css";
import DtCheck from "../DataVerification/DtCheck";

/**
 * Excel's Remove Duplicates: choose the columns to compare, whether the
 * first row is a header, then report what was removed.
 */
const RemoveDuplicates: React.FC = () => {
  const { context, setContext } = useContext(WorkbookContext);
  const { showDialog, hideDialog } = useDialog();
  const t = dataToolsLocale(context).removeDuplicates;
  const { sort: sortLocale } = locale(context);
  const data = getFlowdata(context);

  const range = useMemo(() => {
    const sel = context.luckysheet_select_save?.[0];
    if (!sel || !data) return null;
    if (sel.row[0] === sel.row[1] && sel.column[0] === sel.column[1]) {
      return getSortRegion(data, sel.row[0], sel.column[0]);
    }
    return { row: sel.row.slice(), column: sel.column.slice() };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [hasHeaders, setHasHeaders] = useState(() =>
    range && data ? detectHeaderRow(data, range) : false
  );
  const allColumns = useMemo(() => {
    if (!range) return [];
    const out: number[] = [];
    for (let c = range.column[0]; c <= range.column[1]; c += 1) out.push(c);
    return out;
  }, [range]);
  const [checked, setChecked] = useState<number[]>(allColumns);
  const [error, setError] = useState("");

  if (!range || !data) return null;

  const label = (c: number) => {
    const name = `${dataToolsLocale(context).sort.column} ${indexToColumnChar(
      c
    )}`;
    if (!hasHeaders) return name;
    return cellText(data[range.row[0]]?.[c]) || name;
  };

  const onOk = () => {
    if (checked.length === 0) {
      setError(t.noColumns);
      return;
    }
    for (let r = range.row[0]; r <= range.row[1]; r += 1) {
      for (let c = range.column[0]; c <= range.column[1]; c += 1) {
        if (data[r]?.[c]?.mc != null) {
          setError(sortLocale.mergeError);
          return;
        }
      }
    }
    const options = {
      range,
      columns: checked,
      hasHeader: hasHeaders,
    };
    const { keep, removed } = analyzeDuplicates(data, options);
    if (removed > 0) {
      setContext((ctx) => {
        removeDuplicates(ctx, options);
        ctx.luckysheet_select_save = [
          {
            row: range.row,
            column: range.column,
            row_focus: range.row[0],
            column_focus: range.column[0],
          },
        ];
      });
    }
    showDialog(
      removed > 0
        ? formatLocaleText(t.result, { removed, unique: keep.length })
        : t.none,
      "ok"
    );
  };

  return (
    <div className="fortune-dt-dialog fortune-remove-duplicates">
      <div className="fortune-dt-title">{t.title}</div>
      <div className="fortune-dt-subtitle">{t.prompt}</div>
      <div className="fortune-dt-row" style={{ marginBottom: 8 }}>
        <div
          className="fortune-dt-icon-button"
          role="button"
          tabIndex={0}
          onClick={() => setChecked(allColumns)}
        >
          {t.selectAll}
        </div>
        <div
          className="fortune-dt-icon-button"
          role="button"
          tabIndex={0}
          onClick={() => setChecked([])}
        >
          {t.unselectAll}
        </div>
        <div style={{ flex: 1 }} />
        <DtCheck
          style={{ margin: 0 }}
          checked={hasHeaders}
          onChange={(v) => setHasHeaders(v)}
        >
          {t.hasHeaders}
        </DtCheck>
      </div>
      <div className="fortune-dt-scroll" style={{ padding: "6px 10px" }}>
        <div className="fortune-dt-label" style={{ marginBottom: 6 }}>
          {t.columns}
        </div>
        {allColumns.map((c) => (
          <DtCheck
            key={c}
            checked={checked.includes(c)}
            onChange={(v) => {
              setError("");
              setChecked((prev) =>
                v
                  ? [...prev, c].sort((a, b) => a - b)
                  : prev.filter((x) => x !== c)
              );
            }}
          >
            {label(c)}
          </DtCheck>
        ))}
      </div>
      {error && (
        <div className="fortune-dt-error" style={{ marginTop: 8 }}>
          {error}
        </div>
      )}
      <div
        className="fortune-dt-buttons"
        style={{ justifyContent: "flex-end" }}
      >
        <div
          className="button-basic button-primary"
          role="button"
          tabIndex={0}
          onClick={onOk}
        >
          {t.ok}
        </div>
        <div
          className="button-basic button-default"
          role="button"
          tabIndex={0}
          onClick={hideDialog}
        >
          {t.cancel}
        </div>
      </div>
    </div>
  );
};

export default RemoveDuplicates;
