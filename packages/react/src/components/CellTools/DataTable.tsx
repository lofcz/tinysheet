import {
  cellToolsLocale,
  createDataTable,
  DataTableOptions,
  parseRefText,
  refText,
  validateDataTable,
} from "@lofcz/tinysheet-core";
import React, { useContext, useState } from "react";
import WorkbookContext from "../../context";
import { useDialog } from "../../hooks/useDialog";
import { RefField, startRefPick } from "./refPick";
import { Button, DialogShell } from "../ui";

type Fields = { rowInput: string; colInput: string };

/**
 * What-If Analysis › Data Table: the selection is the whole table; enter a
 * row input cell, a column input cell, or both.
 */
const DataTable: React.FC<{
  initial?: Fields;
  range?: { row: number[]; column: number[] };
}> = ({ initial, range: initialRange }) => {
  const { context, setContext } = useContext(WorkbookContext);
  const { showDialog, hideDialog } = useDialog();
  const t = cellToolsLocale(context).dataTable;
  const [range] = useState(() => {
    if (initialRange) return initialRange;
    const sel =
      context.luckysheet_select_save?.[
        (context.luckysheet_select_save?.length ?? 1) - 1
      ];
    return sel
      ? { row: [...sel.row], column: [...sel.column] }
      : { row: [0, 0], column: [0, 0] };
  });
  const [fields, setFields] = useState<Fields>(
    initial ?? { rowInput: "", colInput: "" }
  );
  const [error, setError] = useState("");
  const set = (patch: Partial<Fields>) => {
    setError("");
    setFields((f) => ({ ...f, ...patch }));
  };

  const pick = (field: keyof Fields, label: string) => {
    hideDialog();
    startRefPick({
      label,
      onDone: (ref) =>
        showDialog(
          <DataTable
            range={range}
            initial={{ ...fields, ...(ref != null ? { [field]: ref } : {}) }}
          />
        ),
    });
  };

  const cellOf = (text: string) => {
    if (!text.trim()) return { ok: true as const, pos: null };
    const ref = parseRefText(context, text);
    if (
      !ref ||
      ref.sheetId !== context.currentSheetId ||
      ref.row[0] !== ref.row[1] ||
      ref.column[0] !== ref.column[1]
    ) {
      return { ok: false as const, pos: null };
    }
    return { ok: true as const, pos: { r: ref.row[0], c: ref.column[0] } };
  };

  const onOk = () => {
    const rowInput = cellOf(fields.rowInput);
    const colInput = cellOf(fields.colInput);
    if (!rowInput.ok || !colInput.ok) {
      setError(t.errInput);
      return;
    }
    const options: DataTableOptions = {
      range,
      rowInput: rowInput.pos,
      colInput: colInput.pos,
    };
    const err = validateDataTable(context, options);
    if (err) {
      setError(
        {
          tooSmall: t.errTooSmall,
          noInput: t.errInput,
          inputInTable: t.errInputInTable,
          overlapsTable: t.errOverlap,
        }[err]
      );
      return;
    }
    hideDialog();
    setContext((ctx) => {
      createDataTable(ctx, options);
    });
  };

  return (
    <DialogShell
      title={t.title}
      className="fortune-dt-dialog fortune-data-table"
      onClose={hideDialog}
      onConfirm={onOk}
      footer={
        <>
          <Button variant="secondary" onClick={hideDialog}>
            {t.cancel}
          </Button>
          <Button variant="primary" onClick={onOk}>
            {t.ok}
          </Button>
        </>
      }
    >
      <div className="fortune-dt-subtitle">
        {refText(context, range)} — {t.hint}
      </div>
      <RefField
        id="fortune-data-table-row"
        label={t.rowInput}
        value={fields.rowInput}
        onChange={(v) => set({ rowInput: v })}
        onPick={() => pick("rowInput", t.rowInput)}
      />
      <RefField
        id="fortune-data-table-col"
        label={t.colInput}
        value={fields.colInput}
        onChange={(v) => set({ colInput: v })}
        onPick={() => pick("colInput", t.colInput)}
      />
      {error && <div className="fortune-dt-error">{error}</div>}
    </DialogShell>
  );
};

export default DataTable;
