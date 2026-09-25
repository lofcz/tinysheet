import React, {
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import _ from "lodash";
import {
  absoluteRangeText,
  checkHeaderRow,
  checkTableRange,
  checkTotalRow,
  convertTableToRange,
  createTable,
  findTable,
  getFlowdata,
  locale,
  parseRangeText,
  resizeTable,
  setTableFilterButton,
  setTableOptions,
  setTableTotalFunction,
  suggestTableRange,
  TABLE_STYLE_GROUPS,
  TABLE_STYLES,
  tableAt,
  tableToolsLocale,
  validateDefinedName,
} from "@lofcz/tinysheet-core";
import type {
  Context,
  SheetTable,
  TableError,
  TableTotalFunction,
} from "@lofcz/tinysheet-core";
import WorkbookContext from "../../context";
import { useDialog } from "../../hooks/useDialog";
import Combo from "../Toolbar/Combo";
import { activateOnKey } from "../Toolbar/Button";
import { registerSheetOverlay, registerToolbarItem } from "../../extensions";
import TableOverlay from "./TableOverlay";
import {
  InsertSlicerDialog,
  SlicerLayer,
  SlicerToolbarButton,
  useInsertSlicer,
} from "./Slicers";
import "./index.css";

let installed = false;

/**
 * Table chrome over the grid (header filter buttons, total-row dropdown,
 * resize handle, AutoCorrect), slicer panels and the Slicer toolbar item.
 */
export function installTablesUI() {
  if (installed) return;
  installed = true;
  registerSheetOverlay("tables", TableOverlay);
  registerSheetOverlay("slicers", SlicerLayer);
  registerToolbarItem("slicer", () => <SlicerToolbarButton />);
}

export { InsertSlicerDialog, SlicerLayer, TableOverlay };

const STYLE_LABELS: Record<string, string> = {
  TableStyleMedium2: "styleBlue",
  TableStyleMedium3: "styleOrange",
  TableStyleMedium4: "styleGray",
  TableStyleMedium5: "styleGold",
  TableStyleMedium6: "styleLightBlue",
  TableStyleMedium7: "styleGreen",
  TableStyleMedium1: "styleBlack",
  TableStyleMedium8: "stylePurple",
};

const ERROR_KEYS: Record<TableError, string> = {
  overlap: "errorOverlap",
  merged: "errorMerged",
  invalidRange: "errorInvalidRange",
  notFound: "errorNotFound",
  invalidName: "errorInvalidName",
  duplicateName: "errorDuplicateName",
  noRoom: "errorNoRoom",
  noRoomAbove: "errorNoRoomAbove",
};

const TOTAL_FUNCTIONS: [TableTotalFunction, string][] = [
  ["none", "fnNone"],
  ["sum", "fnSum"],
  ["average", "fnAverage"],
  ["count", "fnCount"],
  ["countNums", "fnCountNums"],
  ["max", "fnMax"],
  ["min", "fnMin"],
  ["stdDev", "fnStdDev"],
  ["var", "fnVar"],
];

type TablesLocale = ReturnType<typeof locale>["tables"];

function tr(t: TablesLocale, key: string): string {
  return (t as Record<string, string>)[key] ?? key;
}

/** Gallery label of a style: its colour (medium) or "Light 3". */
function styleLabel(ctx: Context, key: string) {
  const t = locale(ctx).tables;
  if (STYLE_LABELS[key]) return tr(t, STYLE_LABELS[key]);
  const tt = tableToolsLocale(ctx);
  const m = /(Light|Medium|Dark)(\d+)$/.exec(key);
  if (!m) return key;
  return tt.styleLabel
    .replace("{group}", tt.styleGroups[m[1].toLowerCase()] ?? m[1])
    .replace("{n}", m[2]);
}

/** Error text of a table error code. */
function errorText(ctx: Context, err: TableError) {
  const tt = tableToolsLocale(ctx) as unknown as Record<string, string>;
  const key = ERROR_KEYS[err];
  return tt[key] ?? tr(locale(ctx).tables, key);
}

/** The table containing the active cell, if any. */
function activeTable(ctx: Context) {
  const last = _.last(ctx.luckysheet_select_save);
  if (!last) return null;
  const r = last.row_focus ?? last.row[0];
  const c = last.column_focus ?? last.column[0];
  return tableAt(ctx, ctx.currentSheetId, r, c);
}

const TextButton: React.FC<{
  onClick: () => void;
  primary?: boolean;
  children: React.ReactNode;
}> = ({ onClick, primary, children }) => (
  <div
    className={`button-basic ${primary ? "button-primary" : "button-default"}`}
    role="button"
    tabIndex={0}
    onClick={onClick}
    onKeyDown={activateOnKey}
  >
    {children}
  </div>
);

/** A small picture of a table style (header row + banded rows). */
export const TableStylePreview: React.FC<{
  styleKey: string;
  selected?: boolean;
  label: string;
  onClick: () => void;
}> = ({ styleKey, selected, label, onClick }) => {
  const style = TABLE_STYLES[styleKey];
  // actual cell colours of the style (data, not theme colours)
  const rowColor = (row: number) => {
    if (row === 0) return style.header || "#FFFFFF";
    return row % 2 === 1 ? style.band : style.fill ?? "#FFFFFF";
  };
  return (
    <div
      className={`fortune-table-style${
        selected ? " fortune-table-style-selected" : ""
      }`}
      role="button"
      tabIndex={0}
      aria-label={label}
      aria-pressed={selected}
      title={label}
      onClick={onClick}
      onKeyDown={activateOnKey}
    >
      {[0, 1, 2, 3].map((row) => (
        <div
          key={row}
          className="fortune-table-style-row"
          style={{ backgroundColor: rowColor(row) }}
        />
      ))}
    </div>
  );
};

/** The style gallery: light, medium and dark sections. */
const StyleGallery: React.FC<{
  selected?: string;
  onPick: (key: string) => void;
}> = ({ selected, onPick }) => {
  const { context } = useContext(WorkbookContext);
  const tt = tableToolsLocale(context);
  return (
    <>
      {(["light", "medium", "dark"] as const).map((group) => (
        <div key={group} className="fortune-table-style-section">
          <div className="fortune-table-menu-title">
            {tt.styleGroups[group]}
          </div>
          <div className="fortune-table-style-grid">
            {TABLE_STYLE_GROUPS[group].map((key) => (
              <TableStylePreview
                key={key}
                styleKey={key}
                label={styleLabel(context, key)}
                selected={selected === key}
                onClick={() => onPick(key)}
              />
            ))}
          </div>
        </div>
      ))}
    </>
  );
};

/** "Create Table" dialog: range + "My table has headers". */
export const CreateTableDialog: React.FC<{ styleKey: string }> = ({
  styleKey,
}) => {
  const { context, setContext } = useContext(WorkbookContext);
  const { hideDialog } = useDialog();
  const { tables: t, button } = locale(context);
  const initial = useMemo(() => {
    const range = suggestTableRange(context);
    if (!range) return { text: "", headers: true };
    const data = getFlowdata(context);
    const headers = _.range(range.column[0], range.column[1] + 1).every((c) => {
      const v = data?.[range.row[0]]?.[c]?.v;
      return typeof v === "string" && v !== "";
    });
    return {
      text: absoluteRangeText(
        null,
        range.row[0],
        range.column[0],
        range.row[1],
        range.column[1]
      ),
      headers,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [text, setText] = useState(initial.text);
  const [hasHeaders, setHasHeaders] = useState(initial.headers);
  const [error, setError] = useState<string | null>(null);
  const uid = useId();
  const rangeRef = useRef<HTMLInputElement>(null);
  useEffect(() => rangeRef.current?.select(), []);

  const ok = () => {
    const range = parseRangeText(
      context,
      text.replace(/^=/, ""),
      context.currentSheetId
    );
    if (!range) {
      setError(t.errorInvalidRange);
      return;
    }
    const checked = checkTableRange(context, range.sheetId, range, {
      hasHeaders,
    });
    if ("error" in checked) {
      setError(errorText(context, checked.error));
      return;
    }
    setContext((ctx) => {
      createTable(ctx, range.sheetId, range, { hasHeaders, style: styleKey });
    });
    hideDialog();
  };

  return (
    <div className="fortune-table-dialog">
      <div className="fortune-table-dialog-title">{t.createTable}</div>
      <div className="fortune-table-dialog-field">
        <label htmlFor={`${uid}-range`}>{t.tableRange}</label>
        <input
          id={`${uid}-range`}
          ref={rangeRef}
          type="text"
          value={text}
          spellCheck={false}
          onChange={(e) => {
            setText(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") ok();
          }}
        />
      </div>
      <div className="fortune-table-dialog-check">
        <input
          id={`${uid}-headers`}
          type="checkbox"
          checked={hasHeaders}
          onChange={(e) => setHasHeaders(e.target.checked)}
        />
        <label htmlFor={`${uid}-headers`}>{t.hasHeaders}</label>
      </div>
      {error && (
        <div className="fortune-table-dialog-error" role="alert">
          {error}
        </div>
      )}
      <div className="fortune-table-dialog-footer">
        <TextButton primary onClick={ok}>
          {button.confirm}
        </TextButton>
        <TextButton onClick={hideDialog}>{button.cancel}</TextButton>
      </div>
    </div>
  );
};

type BoolOption =
  | "headerRow"
  | "totalRow"
  | "bandedRows"
  | "bandedColumns"
  | "firstColumn"
  | "lastColumn"
  | "filterButton";

const OPTION_KEYS: BoolOption[] = [
  "headerRow",
  "totalRow",
  "bandedRows",
  "firstColumn",
  "lastColumn",
  "bandedColumns",
  "filterButton",
];

/** Table Design: name, style options, styles, totals, resize, convert. */
export const TableDesignDialog: React.FC<{ tableName: string }> = ({
  tableName,
}) => {
  const { context, setContext } = useContext(WorkbookContext);
  const { hideDialog, showDialog } = useDialog();
  const { tables: t, button } = locale(context);
  const tt = tableToolsLocale(context);
  const [name, setName] = useState(tableName);
  // follow renames made in this dialog
  const [current, setCurrent] = useState(tableName);
  const ref = findTable(context, current);
  const table: SheetTable | undefined = ref?.table;
  const [rangeText, setRangeText] = useState(() =>
    table
      ? absoluteRangeText(
          null,
          table.range.row[0],
          table.range.column[0],
          table.range.row[1],
          table.range.column[1]
        )
      : ""
  );
  const [error, setError] = useState<string | null>(null);
  const uid = useId();

  if (!ref || !table) {
    return (
      <div className="fortune-table-dialog">
        <div className="fortune-table-dialog-error">{t.errorNotFound}</div>
      </div>
    );
  }

  const showError = (err: TableError | null) => {
    setError(err ? errorText(context, err) : null);
    return !err;
  };

  const rename = () => {
    const next = name.trim();
    if (!next || next === table.name) {
      setName(table.name);
      return;
    }
    const err = validateDefinedName(context, next, null, {
      name: table.name,
      scope: null,
    });
    if (err) {
      showError(err === "duplicate" ? "duplicateName" : "invalidName");
      return;
    }
    setContext((ctx) => {
      setTableOptions(ctx, table.name, { name: next });
    });
    setCurrent(next);
    setError(null);
  };

  const toggle = (key: BoolOption, value: boolean) => {
    if (
      key === "totalRow" &&
      value &&
      !showError(checkTotalRow(context, table.name))
    ) {
      return;
    }
    if (
      key === "headerRow" &&
      value &&
      !showError(checkHeaderRow(context, table.name))
    ) {
      return;
    }
    if (key === "headerRow" && !value) {
      const minRows = table.totalRow ? 3 : 2;
      if (table.range.row[1] - table.range.row[0] + 1 < minRows) {
        setError(tt.errorHeaderOnly);
        return;
      }
    }
    setError(null);
    setContext((ctx) => {
      if (key === "filterButton") setTableFilterButton(ctx, table.name, value);
      else setTableOptions(ctx, table.name, { [key]: value });
    });
  };
  const optionValue = (key: BoolOption) =>
    key === "filterButton"
      ? table.headerRow && table.filterButton !== false
      : !!table[key];

  const resize = () => {
    const range = parseRangeText(
      context,
      rangeText.replace(/^=/, ""),
      ref.sheetId
    );
    if (!range || range.sheetId !== ref.sheetId) {
      showError("invalidRange");
      return;
    }
    if (range.row[0] !== table.range.row[0]) {
      showError("invalidRange");
      return;
    }
    setError(null);
    setContext((ctx) => {
      resizeTable(ctx, table.name, range);
    });
  };

  return (
    <div className="fortune-table-dialog fortune-table-design">
      <div className="fortune-table-dialog-title">{t.tableDesignTitle}</div>
      <div className="fortune-table-design-grid">
        <div className="fortune-table-dialog-field">
          <label htmlFor={`${uid}-name`}>{t.tableName}</label>
          <input
            id={`${uid}-name`}
            type="text"
            value={name}
            spellCheck={false}
            onChange={(e) => setName(e.target.value)}
            onBlur={rename}
            onKeyDown={(e) => {
              if (e.key === "Enter") rename();
            }}
          />
        </div>
        <div className="fortune-table-dialog-field">
          <label htmlFor={`${uid}-range`}>{t.tableRangeLabel}</label>
          <div className="fortune-table-dialog-inline">
            <input
              id={`${uid}-range`}
              type="text"
              value={rangeText}
              spellCheck={false}
              onChange={(e) => setRangeText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") resize();
              }}
            />
            <TextButton onClick={resize}>{t.resize}</TextButton>
          </div>
        </div>
      </div>
      <fieldset className="fortune-table-dialog-group">
        <legend>{t.options}</legend>
        {OPTION_KEYS.map((key) => (
          <div key={key} className="fortune-table-dialog-check">
            <input
              id={`${uid}-${key}`}
              type="checkbox"
              checked={optionValue(key)}
              disabled={key === "filterButton" && !table.headerRow}
              onChange={(e) => toggle(key, e.target.checked)}
            />
            <label htmlFor={`${uid}-${key}`}>
              {key === "filterButton" ? tt.filterButton : tr(t, key)}
            </label>
          </div>
        ))}
      </fieldset>
      <fieldset className="fortune-table-dialog-group">
        <legend>{t.tableStyles}</legend>
        <StyleGallery
          selected={table.style}
          onPick={(key) =>
            setContext((ctx) => {
              setTableOptions(ctx, table.name, { style: key });
            })
          }
        />
      </fieldset>
      {table.totalRow && (
        <fieldset className="fortune-table-dialog-group">
          <legend>{t.totals}</legend>
          <div className="fortune-table-totals">
            {table.columns.map((col, i) => (
              <div key={col.name} className="fortune-table-dialog-field">
                <label htmlFor={`${uid}-total-${i}`} title={col.name}>
                  {col.name}
                </label>
                <select
                  id={`${uid}-total-${i}`}
                  value={col.totalFunction ?? "none"}
                  onChange={(e) =>
                    setContext((ctx) => {
                      setTableTotalFunction(
                        ctx,
                        table.name,
                        i,
                        e.target.value as TableTotalFunction,
                        col.totalLabel
                      );
                    })
                  }
                >
                  {TOTAL_FUNCTIONS.map(([fn, key]) => (
                    <option key={fn} value={fn}>
                      {tr(t, key)}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </fieldset>
      )}
      {error && (
        <div className="fortune-table-dialog-error" role="alert">
          {error}
        </div>
      )}
      <div className="fortune-table-dialog-footer">
        <TextButton
          onClick={() =>
            showDialog(t.convertConfirm, "yesno", () => {
              setContext((ctx) => {
                convertTableToRange(ctx, table.name);
              });
              hideDialog();
            })
          }
        >
          {t.convertToRange}
        </TextButton>
        <TextButton
          onClick={() =>
            showDialog(<InsertSlicerDialog tableName={table.name} />)
          }
        >
          {tt.insertSlicer}
        </TextButton>
        <div className="fortune-table-dialog-spacer" />
        <TextButton primary onClick={hideDialog}>
          {button.close}
        </TextButton>
      </div>
    </div>
  );
};

/** Sprite symbol for the toolbar icon (kept out of the shared sprite). */
const TableIconSymbol: React.FC = () => (
  <svg style={{ display: "none" }} aria-hidden="true">
    <symbol id="tinysheet-format-as-table" viewBox="0 0 24 24">
      <path
        fill="currentColor"
        d="M4 4h16v16H4V4zm2 2v3h12V6H6zm0 5v3h5v-3H6zm7 0v3h5v-3h-5zm-7 5v2h5v-2H6zm7 0v2h5v-2h-5z"
      />
    </symbol>
  </svg>
);

/**
 * Toolbar "Format as Table": a gallery of styles. Outside a table it asks
 * for the range; inside a table it restyles it and offers Table Design.
 */
export const FormatAsTableButton: React.FC = () => {
  const { context, setContext } = useContext(WorkbookContext);
  const { showDialog } = useDialog();
  const { tables: t } = locale(context);
  const tt = tableToolsLocale(context);
  const inTable = activeTable(context);
  const insertSlicer = useInsertSlicer();
  return (
    <>
      <TableIconSymbol />
      <Combo iconId="tinysheet-format-as-table" tooltip={t.formatAsTable}>
        {(setOpen) => (
          <div className="fortune-table-menu">
            <StyleGallery
              selected={inTable?.table.style}
              onPick={(key) => {
                setOpen(false);
                if (context.allowEdit === false) return;
                if (inTable) {
                  setContext((ctx) => {
                    setTableOptions(ctx, inTable.table.name, {
                      style: key,
                    });
                  });
                } else {
                  showDialog(<CreateTableDialog styleKey={key} />);
                }
              }}
            />
            {inTable && (
              <div
                className="fortune-table-menu-item"
                role="menuitem"
                tabIndex={0}
                onClick={() => {
                  setOpen(false);
                  showDialog(
                    <TableDesignDialog tableName={inTable.table.name} />
                  );
                }}
                onKeyDown={activateOnKey}
              >
                {t.tableDesign}
              </div>
            )}
            {inTable && inTable.table.headerRow && (
              <div
                className="fortune-table-menu-item"
                role="menuitem"
                tabIndex={0}
                onClick={() => {
                  setOpen(false);
                  insertSlicer();
                }}
                onKeyDown={activateOnKey}
              >
                {`${tt.insertSlicer}…`}
              </div>
            )}
          </div>
        )}
      </Combo>
    </>
  );
};

export default FormatAsTableButton;
