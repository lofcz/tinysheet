import React, { useContext, useEffect, useId, useRef, useState } from "react";
import {
  editSparklineData,
  editSparklineGroup,
  insertSparklines,
  locale,
  parseSparklineRange,
  planSparklines,
  sparklineLocale,
} from "@lofcz/tinysheet-core";
import type {
  SparklineLocale,
  SparklineRangeError,
  SparklineType,
} from "@lofcz/tinysheet-core";
import WorkbookContext from "../../context";
import { useDialog } from "../../hooks/useDialog";
import { activateOnKey } from "../Toolbar/Button";
import { startRangePick } from "./rangePicker";
import { SparklineTypeIcon, SPARKLINE_TYPES } from "./icons";
import { SquareDashedMousePointer } from "lucide-react";
import { Button, DialogShell, ICON_STROKE } from "../ui";

export type SparklineDataDialogProps = {
  /** insert: Insert Sparklines; group: edit a group; single: one sparkline. */
  mode: "insert" | "group" | "single";
  sheetId: string;
  type?: SparklineType;
  data?: string;
  location?: string;
  /** mode "group": the group edited. */
  groupId?: string;
  /** mode "single": the sparkline's cell. */
  cell?: { r: number; c: number };
};

const ERRORS: Record<SparklineRangeError, keyof SparklineLocale> = {
  data: "errorData",
  location: "errorLocation",
  locationShape: "errorLocationShape",
  locationSheet: "errorLocationSheet",
  mismatch: "errorMismatch",
  dataShape: "errorDataShape",
};

/** A range field with a "select on the sheet" button. */
export const RangeField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  onPick: () => void;
  pickLabel: string;
  inputRef?: React.Ref<HTMLInputElement>;
  onEnter?: () => void;
}> = ({ label, value, onChange, onPick, pickLabel, inputRef, onEnter }) => {
  const id = useId();
  return (
    <div className="fortune-sparkline-field">
      <label htmlFor={id}>{label}</label>
      <div className="fortune-sparkline-range">
        <input
          id={id}
          ref={inputRef}
          className="fortune-sparkline-input"
          type="text"
          spellCheck={false}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && onEnter) {
              e.preventDefault();
              onEnter();
            }
          }}
        />
        <div
          className="fortune-sparkline-pick"
          role="button"
          tabIndex={0}
          aria-label={`${pickLabel}: ${label}`}
          title={pickLabel}
          onClick={onPick}
          onKeyDown={activateOnKey}
        >
          <SquareDashedMousePointer
            size={16}
            strokeWidth={ICON_STROKE}
            aria-hidden
          />
        </div>
      </div>
    </div>
  );
};

/** Insert Sparklines / Edit Group Location & Data / Edit Single Sparkline. */
const SparklineDataDialog: React.FC<SparklineDataDialogProps> = (props) => {
  const {
    mode,
    sheetId,
    groupId,
    cell,
    type: initialType,
    data: initialData,
    location: initialLocation,
  } = props;
  const { context, setContext } = useContext(WorkbookContext);
  const { showDialog, hideDialog } = useDialog();
  const t = sparklineLocale(context);
  const { button } = locale(context);
  const [type, setType] = useState<SparklineType>(initialType ?? "line");
  const [data, setData] = useState(initialData ?? "");
  const [location, setLocation] = useState(initialLocation ?? "");
  const [error, setError] = useState<string | null>(null);
  const dataRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    dataRef.current?.focus();
    dataRef.current?.select();
  }, []);

  const reopen = (patch: Partial<SparklineDataDialogProps>) =>
    showDialog(
      <SparklineDataDialog
        {...props}
        type={type}
        data={data}
        location={location}
        {...patch}
      />
    );

  const pick = (field: "data" | "location") => {
    hideDialog();
    startRangePick({
      title: field === "data" ? t.dataRange : t.locationRange,
      sheetId,
      onDone: (text) => reopen({ [field]: text }),
      onCancel: () => reopen({}),
    });
  };

  const ok = () => {
    if (context.allowEdit === false) return;
    let err: SparklineRangeError | null = null;
    if (mode === "single") {
      const range = parseSparklineRange(context, data, sheetId);
      if (!range) err = "data";
      else if (
        range.row[1] > range.row[0] &&
        range.column[1] > range.column[0]
      ) {
        err = "dataShape";
      }
    } else {
      const plan = planSparklines(context, data, location, sheetId);
      if ("error" in plan) err = plan.error;
    }
    if (err) {
      setError(t[ERRORS[err]]);
      return;
    }
    setContext((ctx) => {
      if (mode === "insert") {
        insertSparklines(ctx, { type, data, location, sheetId });
      } else if (mode === "group" && groupId) {
        editSparklineGroup(ctx, sheetId, groupId, data, location);
      } else if (mode === "single" && cell) {
        editSparklineData(ctx, sheetId, cell.r, cell.c, data);
      }
    });
    hideDialog();
  };

  let title = t.editSingleDataTitle;
  if (mode === "insert") title = t.createSparklines;
  else if (mode === "group") title = t.editGroupDataTitle;

  return (
    <DialogShell
      title={title}
      className="fortune-sparkline-dialog"
      onClose={hideDialog}
      onConfirm={ok}
      aria-label={title}
      footer={
        <>
          <Button variant="secondary" onClick={hideDialog}>
            {button.cancel}
          </Button>
          <Button variant="primary" onClick={ok}>
            {button.confirm}
          </Button>
        </>
      }
    >
      {mode === "insert" && (
        <div
          className="fortune-sparkline-types"
          role="radiogroup"
          aria-label={t.type}
        >
          {SPARKLINE_TYPES.map(({ type: key, label }) => (
            <div
              key={key}
              role="radio"
              tabIndex={0}
              aria-checked={type === key}
              className={`fortune-sparkline-type${
                type === key ? " fortune-sparkline-type-selected" : ""
              }`}
              onClick={() => setType(key)}
              onKeyDown={activateOnKey}
            >
              <SparklineTypeIcon type={key} />
              <span>{t[label]}</span>
            </div>
          ))}
        </div>
      )}
      {mode !== "single" && (
        <div className="fortune-sparkline-hint">{t.chooseData}</div>
      )}
      <RangeField
        label={t.dataRange}
        value={data}
        inputRef={dataRef}
        pickLabel={t.selectRange}
        onChange={(v) => {
          setData(v);
          setError(null);
        }}
        onPick={() => pick("data")}
        onEnter={ok}
      />
      {mode !== "single" && (
        <>
          <div className="fortune-sparkline-hint">{t.chooseLocation}</div>
          <RangeField
            label={t.locationRange}
            value={location}
            pickLabel={t.selectRange}
            onChange={(v) => {
              setLocation(v);
              setError(null);
            }}
            onPick={() => pick("location")}
            onEnter={ok}
          />
        </>
      )}
      {error && (
        <div className="fortune-sparkline-error" role="alert">
          {error}
        </div>
      )}
    </DialogShell>
  );
};

export default SparklineDataDialog;
