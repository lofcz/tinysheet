import React, { useContext } from "react";
import {
  calculateNow,
  cellAddress,
  formulaAuditLocale,
  normalizeSelection,
  sheetNameById,
} from "@lofcz/tinysheet-core";
import WorkbookContext from "../../context";
import { reportedCircularReferences } from "./Host";

/**
 * Status bar items: "Calculate" while manual calculation has pending
 * changes (click = F9), and "Circular References: A1" (click selects it).
 */
const CalcStatus: React.FC = () => {
  const { context, setContext } = useContext(WorkbookContext);
  const t = formulaAuditLocale(context).calc;
  const circular = reportedCircularReferences(context);
  const first = circular[0];
  let circularText = "";
  if (first) {
    const address = cellAddress(first.r, first.c);
    circularText =
      first.id === context.currentSheetId
        ? address
        : `${sheetNameById(context, first.id) ?? ""}!${address}`;
  }
  return (
    <>
      {context.calculationPending && (
        <button
          type="button"
          className="fortune-status-bar-calc"
          data-testid="status-calculate"
          title={t.calculateHint}
          onClick={() => setContext((ctx) => calculateNow(ctx))}
        >
          {t.calculate}
        </button>
      )}
      {first && (
        <button
          type="button"
          className="fortune-status-bar-circular"
          data-testid="status-circular"
          onClick={() => {
            if (first.id !== context.currentSheetId) return;
            setContext(
              (ctx) => {
                ctx.luckysheet_select_save = normalizeSelection(ctx, [
                  {
                    row: [first.r, first.r],
                    column: [first.c, first.c],
                    row_focus: first.r,
                    column_focus: first.c,
                  },
                ]);
              },
              { noHistory: true }
            );
          }}
        >
          {`${t.circularReferences}: ${circularText}`}
        </button>
      )}
    </>
  );
};

export default CalcStatus;
