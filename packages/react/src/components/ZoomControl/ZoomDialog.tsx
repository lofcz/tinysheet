import React, { useContext, useState } from "react";
import {
  dialogsLocale,
  getSheetIndex,
  locale,
  MAX_ZOOM_RATIO,
  MIN_ZOOM_RATIO,
  zoomToSelection,
} from "@lofcz/tinysheet-core";
import WorkbookContext from "../../context";
import { useDialog } from "../../hooks/useDialog";
import { Button, DialogShell, NumberInput, Radio } from "../ui";
import "./ZoomDialog.css";

const PRESETS = [2, 1, 0.75, 0.5, 0.25];

type Choice = number | "fit" | "custom";

/**
 * Excel's View › Zoom dialog: 200 / 100 / 75 / 50 / 25 %, Fit selection or
 * a custom percentage. Show it with `showDialog(<ZoomDialog />)`.
 */
export const ZoomDialog: React.FC = () => {
  const { context, setContext, refs } = useContext(WorkbookContext);
  const { hideDialog } = useDialog();
  const t = dialogsLocale(context);
  const { button } = locale(context);
  const current = context.zoomRatio || 1;
  const [choice, setChoice] = useState<Choice>(() =>
    PRESETS.includes(current) ? current : "custom"
  );
  const [custom, setCustom] = useState(Math.round(current * 100));

  const close = () => {
    hideDialog();
    setTimeout(() => refs.cellInput.current?.focus({ preventScroll: true }));
  };

  const ok = () => {
    close();
    setContext(
      (ctx) => {
        if (choice === "fit") {
          zoomToSelection(ctx);
          return;
        }
        const ratio = choice === "custom" ? custom / 100 : choice;
        const val = Math.min(
          MAX_ZOOM_RATIO,
          Math.max(MIN_ZOOM_RATIO, Math.round(ratio * 100) / 100)
        );
        const index = getSheetIndex(ctx, ctx.currentSheetId);
        if (index == null) return;
        ctx.luckysheetfile[index].zoomRatio = val;
        ctx.zoomRatio = val;
      },
      { noHistory: true }
    );
  };

  return (
    <DialogShell
      title={t.titles.zoom}
      className="fortune-zoom-dialog"
      onClose={close}
      onConfirm={ok}
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            {button.cancel}
          </Button>
          <Button variant="primary" onClick={ok}>
            {button.confirm}
          </Button>
        </>
      }
    >
      <fieldset className="fortune-zoom-dialog-group">
        <legend>{t.zoom.magnification}</legend>
        {PRESETS.map((p) => (
          <Radio
            key={p}
            name="fortune-zoom-dialog"
            checked={choice === p}
            onChange={() => setChoice(p)}
            label={`${Math.round(p * 100)}%`}
          />
        ))}
        <Radio
          name="fortune-zoom-dialog"
          checked={choice === "fit"}
          onChange={() => setChoice("fit")}
          label={t.zoom.fitSelection}
        />
        <div className="fortune-zoom-dialog-custom">
          <Radio
            name="fortune-zoom-dialog"
            checked={choice === "custom"}
            onChange={() => setChoice("custom")}
            label={t.zoom.custom}
          />
          <NumberInput
            aria-label={t.zoom.custom}
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
