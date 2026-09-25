/**
 * Excel's Zoom dialog (View › Zoom): 200%, 100%, 75%, 50%, 25%, Fit
 * selection or a custom magnification (10–400%). The workbook's only zoom
 * dialog: the View tab opens it, hosts show it with
 * `showDialog(<ZoomDialog />)`.
 */
import React, { useContext, useId, useState } from "react";
import {
  getSheetIndex,
  MAX_ZOOM_RATIO,
  MIN_ZOOM_RATIO,
  ribbonTabsLocale,
  scrollSelectionIntoCorner,
  zoomToSelection,
} from "@lofcz/tinysheet-core";
import type { Context } from "@lofcz/tinysheet-core";
import WorkbookContext from "../../context";
import type { SetContextOptions } from "../../context";
import { useDialog } from "../../hooks/useDialog";
import { Button, DialogShell, NumberInput, Radio } from "../ui";
import "./ZoomDialog.css";

type SetContext = (
  recipe: (ctx: Context) => void,
  options?: SetContextOptions
) => void;

/** Set the current sheet's zoom (1 = 100%), clamped to 10–400%. */
export function setZoom(setContext: SetContext, ratio: number) {
  const value = Math.min(
    MAX_ZOOM_RATIO,
    Math.max(MIN_ZOOM_RATIO, Number(ratio.toFixed(2)))
  );
  setContext(
    (ctx) => {
      const i = getSheetIndex(ctx, ctx.currentSheetId);
      if (i == null) return;
      ctx.luckysheetfile[i].zoomRatio = value;
      ctx.zoomRatio = value;
    },
    { noHistory: true }
  );
}

/**
 * Zoom to Selection: zoom so the selection fills the window, then scroll it
 * to the window's corner once the grid is laid out at the new zoom.
 */
export function zoomToSelectionAndScroll(setContext: SetContext) {
  setContext((ctx) => {
    zoomToSelection(ctx);
  });
  setTimeout(
    () =>
      setContext(
        (ctx) => {
          scrollSelectionIntoCorner(ctx);
        },
        { noHistory: true }
      ),
    80
  );
}

const PRESETS = [200, 100, 75, 50, 25];

type Choice = string; // a preset ("200"), "fit" or "custom"

export const ZoomDialog: React.FC<{
  /** Cancel / close (default: hide the workbook's modal). */
  onClose?: () => void;
}> = ({ onClose }) => {
  const { context, setContext, refs } = useContext(WorkbookContext);
  const { hideDialog } = useDialog();
  const t = ribbonTabsLocale(context).view;
  const name = useId();
  const current = Math.round((context.zoomRatio || 1) * 100);
  const [choice, setChoice] = useState<Choice>(
    PRESETS.includes(current) ? String(current) : "custom"
  );
  const [custom, setCustom] = useState<number>(current);

  const close = () => {
    if (onClose) onClose();
    else hideDialog();
    // the keyboard goes back to the sheet
    setTimeout(() => refs.cellInput.current?.focus({ preventScroll: true }));
  };

  const confirm = () => {
    close();
    if (choice === "fit") {
      zoomToSelectionAndScroll(setContext);
      return;
    }
    const percent = choice === "custom" ? custom : Number(choice);
    setZoom(setContext, percent / 100);
  };

  return (
    <DialogShell
      title={t.zoomTitle}
      className="fortune-zoom-dialog"
      onClose={close}
      onConfirm={confirm}
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            {t.cancel}
          </Button>
          <Button variant="primary" onClick={confirm}>
            {t.ok}
          </Button>
        </>
      }
    >
      <fieldset className="fortune-zoom-dialog-group">
        <legend>{t.magnification}</legend>
        {PRESETS.map((p) => (
          <Radio
            key={p}
            name={name}
            value={String(p)}
            checked={choice === String(p)}
            onChange={() => setChoice(String(p))}
            label={`${p}%`}
          />
        ))}
        <Radio
          name={name}
          value="fit"
          checked={choice === "fit"}
          onChange={() => setChoice("fit")}
          label={t.fitSelection}
        />
        <div className="fortune-zoom-dialog-custom">
          <Radio
            name={name}
            value="custom"
            checked={choice === "custom"}
            onChange={() => setChoice("custom")}
            label={t.custom}
          />
          <NumberInput
            aria-label={t.custom.replace(/[:：]\s*$/, "")}
            value={custom}
            min={Math.round(MIN_ZOOM_RATIO * 100)}
            max={Math.round(MAX_ZOOM_RATIO * 100)}
            step={10}
            suffix="%"
            width={120}
            onChange={(v) => {
              setCustom(v);
              setChoice("custom");
            }}
          />
        </div>
      </fieldset>
    </DialogShell>
  );
};

export default ZoomDialog;
