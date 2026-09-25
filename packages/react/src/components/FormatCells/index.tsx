import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  locale,
  applyFormatCells,
  closeFormatCells,
  describeFormat,
  getFormatCellsState,
  isValidFormatCode,
} from "@lofcz/tinysheet-core";
import type {
  BorderChanges,
  FormatCellsChanges,
  FormatCellsState,
  FormatCellsTab,
} from "@lofcz/tinysheet-core";
import _ from "lodash";
import WorkbookContext from "../../context";
import SVGIcon from "../SVGIcon";
import NumberTab, { NumberState, numberStateCode } from "./NumberTab";
import AlignmentTab, { AlignmentState } from "./AlignmentTab";
import FontTab, { FontState } from "./FontTab";
import BorderTab, { BorderDraft } from "./BorderTab";
import ColorPalette from "./ColorPalette";
import "./index.css";

const TABS: FormatCellsTab[] = [
  "number",
  "alignment",
  "font",
  "border",
  "fill",
  "protection",
];

type Draft = Omit<FormatCellsState, "borders" | "usedFormats" | "value">;

const DRAFT_KEYS: (keyof Draft)[] = [
  "ht",
  "vt",
  "wrap",
  "shrink",
  "indent",
  "rotation",
  "merge",
  "ff",
  "fs",
  "bl",
  "it",
  "un",
  "cl",
  "fc",
  "bg",
  "locked",
  "hidden",
];

/**
 * The changes to apply: only what differs from the active cell, so fields
 * the user did not touch keep their per-cell values.
 */
export function collectChanges(
  initial: FormatCellsState,
  draft: Draft,
  numberCode: string,
  borders: BorderDraft
): FormatCellsChanges {
  const changes: FormatCellsChanges = {};
  if (numberCode !== initial.fa) changes.fa = numberCode;
  DRAFT_KEYS.forEach((key) => {
    if (draft[key] !== initial[key]) {
      (changes as any)[key] = draft[key];
    }
  });
  if (borders.none || Object.keys(borders.edges).length > 0) {
    changes.borders = {
      none: borders.none,
      ...borders.edges,
    } as BorderChanges;
  }
  return changes;
}

/**
 * Excel's Format Cells dialog (Ctrl+1). Opened by setting
 * `ctx.formatCellsDialog` (see openFormatCells in core); OK applies every
 * change to the selection as one undo step.
 */
const FormatCells: React.FC = () => {
  const { context, setContext, refs } = useContext(WorkbookContext);
  const { formatCells, button } = locale(context);
  const initial = useMemo(
    () => getFormatCellsState(context),
    // snapshot once per opening
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const openTab = (context.formatCellsDialog?.tab ??
    "number") as FormatCellsTab;
  const [tab, setTab] = useState<FormatCellsTab>(
    TABS.includes(openTab) ? openTab : "number"
  );
  const [numberState, setNumberState] = useState<NumberState>(() =>
    describeFormat(initial?.fa)
  );
  const [draft, setDraft] = useState<Draft>(() => {
    return _.omit(initial ?? ({} as FormatCellsState), [
      "borders",
      "usedFormats",
      "value",
    ]) as Draft;
  });
  const [borderDraft, setBorderDraft] = useState<BorderDraft>({
    none: false,
    edges: {},
    line: { style: "1", color: "#000000" },
  });
  const [invalid, setInvalid] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const currency = context.currency || "$";

  useEffect(() => {
    dialogRef.current
      ?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')
      ?.focus();
  }, []);

  const close = useCallback(() => {
    setContext((ctx) => closeFormatCells(ctx), { noHistory: true });
    setTimeout(() => refs.cellInput.current?.focus());
  }, [refs.cellInput, setContext]);

  const onOk = useCallback(() => {
    if (!initial) {
      close();
      return;
    }
    const code = numberStateCode(numberState);
    if (numberState.category === "custom" && !isValidFormatCode(code)) {
      setInvalid(true);
      setTab("number");
      return;
    }
    const changes = collectChanges(initial, draft, code, borderDraft);
    const canvas = refs.canvas.current?.getContext("2d") || undefined;
    setContext((ctx) => {
      closeFormatCells(ctx);
      applyFormatCells(ctx, changes, canvas);
    });
    setTimeout(() => refs.cellInput.current?.focus());
  }, [
    borderDraft,
    close,
    draft,
    initial,
    numberState,
    refs.canvas,
    refs.cellInput,
    setContext,
  ]);

  if (!initial) return null;

  const patch = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));

  let body: React.ReactNode = null;
  if (tab === "number") {
    body = (
      <NumberTab
        value={initial.value}
        state={numberState}
        currency={currency}
        usedFormats={initial.usedFormats}
        invalid={invalid}
        onChange={(s) => {
          setInvalid(false);
          setNumberState(s);
        }}
      />
    );
  } else if (tab === "alignment") {
    body = (
      <AlignmentTab
        state={draft as AlignmentState}
        onChange={(p) => patch(p)}
      />
    );
  } else if (tab === "font") {
    body = <FontTab state={draft as FontState} onChange={(p) => patch(p)} />;
  } else if (tab === "border") {
    body = (
      <BorderTab
        initial={initial.borders}
        draft={borderDraft}
        multiRow={initial.multiRow}
        multiCol={initial.multiCol}
        onChange={setBorderDraft}
      />
    );
  } else if (tab === "fill") {
    body = (
      <div className="fortune-fc-fill">
        <div className="fortune-fc-column">
          <div className="fortune-fc-label">{formatCells.backgroundColor}:</div>
          <ColorPalette
            idPrefix="fortune-fc-fill-color"
            label={formatCells.backgroundColor}
            value={draft.bg}
            nullLabel={formatCells.noColor}
            onChange={(bg) => patch({ bg })}
          />
        </div>
        <fieldset className="fortune-fc-fieldset fortune-fc-grow">
          <legend>{formatCells.sample}</legend>
          <div
            className="fortune-fc-fill-sample"
            data-testid="format-cells-fill-sample"
            style={{ backgroundColor: draft.bg || undefined }}
          />
        </fieldset>
      </div>
    );
  } else {
    body = (
      <div className="fortune-fc-protection">
        <label className="fortune-fc-check" htmlFor="fortune-fc-protect-1">
          <input
            id="fortune-fc-protect-1"
            type="checkbox"
            checked={draft.locked}
            onChange={(e) => patch({ locked: e.target.checked })}
          />
          {formatCells.locked}
        </label>
        <label className="fortune-fc-check" htmlFor="fortune-fc-protect-2">
          <input
            id="fortune-fc-protect-2"
            type="checkbox"
            checked={draft.hidden}
            onChange={(e) => patch({ hidden: e.target.checked })}
          />
          {formatCells.hidden}
        </label>
        <p className="fortune-fc-description">{formatCells.protectionHint}</p>
      </div>
    );
  }

  return (
    <div
      className="fortune-popover-backdrop fortune-modal-container"
      data-theme={context.theme || "light"}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseMove={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        // the grid must not see keys typed in the dialog
        e.stopPropagation();
        if (e.key === "Escape") {
          e.preventDefault();
          close();
        } else if (
          e.key === "Enter" &&
          !(e.target instanceof HTMLTextAreaElement) &&
          !(e.target instanceof HTMLButtonElement) &&
          (e.target as HTMLElement).getAttribute?.("role") !== "button"
        ) {
          e.preventDefault();
          onOk();
        }
      }}
    >
      <div
        ref={dialogRef}
        className="fortune-dialog fortune-format-cells"
        role="dialog"
        aria-modal="true"
        aria-labelledby="fortune-format-cells-title"
      >
        <div className="fortune-fc-header">
          <div id="fortune-format-cells-title" className="dialog-title">
            {formatCells.title}
          </div>
          <button
            type="button"
            className="fortune-fc-close"
            aria-label={button.close}
            title={button.close}
            onClick={close}
          >
            <SVGIcon name="close" />
          </button>
        </div>
        <div
          className="fortune-fc-tabs"
          role="tablist"
          aria-label={formatCells.title}
          onKeyDown={(e) => {
            const i = TABS.indexOf(tab);
            let next = -1;
            if (e.key === "ArrowRight") next = (i + 1) % TABS.length;
            if (e.key === "ArrowLeft")
              next = (i + TABS.length - 1) % TABS.length;
            if (next >= 0) {
              e.preventDefault();
              setTab(TABS[next]);
              const el = e.currentTarget.children[next] as HTMLElement;
              el?.focus();
            }
          }}
        >
          {TABS.map((t) => (
            <button
              type="button"
              key={t}
              role="tab"
              id={`fortune-fc-tab-${t}`}
              aria-selected={t === tab}
              aria-controls="fortune-fc-panel"
              tabIndex={t === tab ? 0 : -1}
              className={`fortune-fc-tab${t === tab ? " active" : ""}`}
              onClick={() => setTab(t)}
            >
              {formatCells.tabs[t]}
            </button>
          ))}
        </div>
        <div
          id="fortune-fc-panel"
          className="fortune-fc-panel"
          role="tabpanel"
          aria-labelledby={`fortune-fc-tab-${tab}`}
        >
          {body}
        </div>
        <div className="fortune-dialog-box-button-container">
          <button
            type="button"
            className="fortune-message-box-button button-basic button-primary"
            onClick={onOk}
          >
            {button.confirm}
          </button>
          <button
            type="button"
            className="fortune-message-box-button button-basic button-default"
            onClick={close}
          >
            {button.cancel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FormatCells;
