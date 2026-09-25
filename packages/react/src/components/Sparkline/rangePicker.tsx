import React, { useContext, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  getSheetIndex,
  locale,
  sparklineRangeText,
} from "@lofcz/tinysheet-core";
import type { Context } from "@lofcz/tinysheet-core";
import WorkbookContext from "../../context";
import { X } from "lucide-react";
import { Button, IconButton } from "../ui";

/**
 * Range picking for the sparkline dialogs (Excel's collapsed "RefEdit"
 * dialog): the dialog closes, a small bar over the grid shows the range
 * being selected, and OK / Cancel reopen the dialog with the new range.
 */
export type RangePickRequest = {
  title: string;
  /** The dialog's sheet: ranges elsewhere are sheet-qualified. */
  sheetId: string;
  onDone: (text: string) => void;
  onCancel: () => void;
};

let current: RangePickRequest | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function startRangePick(request: RangePickRequest) {
  current = request;
  emit();
}

export function isPickingRange() {
  return current != null;
}

function finish(text: string | null) {
  const request = current;
  current = null;
  emit();
  if (!request) return;
  if (text == null) request.onCancel();
  else request.onDone(text);
}

/** The last selected range as text (qualified when on another sheet). */
export function selectionRangeText(context: Context, hostSheetId: string) {
  const sel = context.luckysheet_select_save;
  const last = sel?.[sel.length - 1];
  if (!last) return "";
  const idx = getSheetIndex(context, context.currentSheetId);
  const name =
    context.currentSheetId !== hostSheetId && idx != null
      ? context.luckysheetfile[idx].name
      : null;
  return sparklineRangeText(
    name,
    last.row[0],
    last.column[0],
    last.row[1],
    last.column[1]
  );
}

/** The picker bar (a registered sheet overlay). */
export const SparklineRangePicker: React.FC = () => {
  const [request, setRequest] = useState(current);
  const { context, refs } = useContext(WorkbookContext);
  const { button } = locale(context);

  useEffect(() => {
    const listener = () => setRequest(current);
    listeners.add(listener);
    listener();
    return () => {
      listeners.delete(listener);
    };
  }, []);

  useEffect(() => {
    if (!request) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        finish(null);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [request]);

  const host = refs.workbookContainer.current;
  if (!request || !host) return null;
  const text = selectionRangeText(context, request.sheetId);
  const area = refs.cellArea.current?.getBoundingClientRect();
  const box = host.getBoundingClientRect();
  const top = area ? Math.max(0, area.top - box.top + 8) : 48;

  return createPortal(
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      className="fortune-sparkline-picker"
      role="dialog"
      aria-label={request.title}
      style={{ top }}
      onMouseDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <span className="fortune-sparkline-picker-title">{request.title}</span>
      <input
        readOnly
        aria-label={request.title}
        className="fortune-sparkline-input"
        value={text}
      />
      <Button size="sm" variant="primary" onClick={() => finish(text)}>
        {button.confirm}
      </Button>
      <IconButton
        size="sm"
        icon={X}
        label={button.cancel}
        onClick={() => finish(null)}
      />
    </div>,
    host
  );
};
