/**
 * Excel's Zoom dialog (View › Zoom): 200%, 100%, 75%, 50%, 25%, Fit
 * selection or a custom magnification (10–400%).
 */
import React, { useContext, useId, useState } from "react";
import {
  getSheetIndex,
  MAX_ZOOM_RATIO,
  MIN_ZOOM_RATIO,
  scrollSelectionIntoCorner,
  zoomToSelection,
} from "@lofcz/tinysheet-core";
import type { Context } from "@lofcz/tinysheet-core";
import WorkbookContext from "../../../../context";
import type { SetContextOptions } from "../../../../context";
import { Button, DialogShell, NumberInput } from "../../../ui";
import { useTabsText } from "../tabsCommon";

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

const PRESETS = [200, 100, 75, 50, 25];

export const ZoomDialog: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { context, setContext } = useContext(WorkbookContext);
  const t = useTabsText().view;
  const name = useId();
  const current = Math.round((context.zoomRatio || 1) * 100);
  const [choice, setChoice] = useState<string>(
    PRESETS.includes(current) ? String(current) : "custom"
  );
  const [custom, setCustom] = useState<number>(current);

  const confirm = () => {
    onClose();
    if (choice === "fit") {
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
      return;
    }
    const percent = choice === "custom" ? custom : Number(choice);
    setZoom(setContext, percent / 100);
  };

  const radio = (value: string, label: React.ReactNode) => (
    <label className="ts-zoom-choice" key={value}>
      <input
        type="radio"
        name={name}
        value={value}
        checked={choice === value}
        onChange={() => setChoice(value)}
      />
      <span>{label}</span>
    </label>
  );

  return (
    <DialogShell
      title={t.zoomTitle}
      onClose={onClose}
      onConfirm={confirm}
      width={300}
      className="ts-zoom-dialog"
      footer={
        <>
          <Button onClick={onClose}>{t.cancel}</Button>
          <Button variant="primary" onClick={confirm}>
            {t.ok}
          </Button>
        </>
      }
    >
      <fieldset className="ts-zoom-choices">
        <legend>{t.magnification}</legend>
        {PRESETS.map((p) => radio(String(p), `${p}%`))}
        {radio("fit", t.fitSelection)}
        <div className="ts-zoom-custom">
          {radio("custom", t.custom)}
          <NumberInput
            aria-label={t.custom.replace(/:$/, "")}
            size="sm"
            width={110}
            min={10}
            max={400}
            step={5}
            suffix="%"
            value={custom}
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
