import React, {
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  absoluteRangeText,
  createNamesFromSelection,
  deleteDefinedName,
  evaluateDefinedName,
  getDefinedNames,
  locale,
  refersToForActiveCell,
  saveDefinedName,
  selectionAsNameRange,
  sheetNameById,
  validateDefinedName,
} from "@lofcz/tinysheet-core";
import type { DefinedNameEntry } from "@lofcz/tinysheet-core";
import WorkbookContext from "../../context";
import { useDialog } from "../../hooks/useDialog";
import { activateOnKey } from "../Toolbar/Button";
import "./index.css";

type Mode =
  | { kind: "list" }
  | { kind: "edit"; entry: DefinedNameEntry | null }
  | { kind: "fromSelection" };

type Filter = "all" | "workbook" | "sheet" | "errors";

const ERROR_KEYS: Record<string, string> = {
  empty: "errorEmpty",
  tooLong: "errorTooLong",
  invalidChars: "errorInvalidChars",
  cellReference: "errorCellReference",
  reserved: "errorReserved",
  duplicate: "errorDuplicate",
  emptyDefinition: "errorEmptyDefinition",
};

const TextButton: React.FC<{
  onClick: () => void;
  primary?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}> = ({ onClick, primary, disabled, children }) => (
  <div
    className={`button-basic ${primary ? "button-primary" : "button-default"}`}
    role="button"
    tabIndex={0}
    aria-disabled={disabled || undefined}
    onClick={() => {
      if (!disabled) onClick();
    }}
    onKeyDown={activateOnKey}
  >
    {children}
  </div>
);

/** New / Edit Name form. */
const NameEditor: React.FC<{
  entry: DefinedNameEntry | null;
  onDone: () => void;
}> = ({ entry, onDone }) => {
  const { context, setContext } = useContext(WorkbookContext);
  const { definedNames: t, button } = locale(context);
  const defaultRefersTo = useMemo(() => {
    // relative references show as seen from the active cell (Excel), so
    // saving the text unchanged keeps the definition
    if (entry) return refersToForActiveCell(context, entry.refersTo);
    const range = selectionAsNameRange(context);
    if (!range) return "=";
    return `=${absoluteRangeText(
      sheetNameById(context, range.sheetId),
      range.row[0],
      range.column[0],
      range.row[1],
      range.column[1]
    )}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry]);
  const [name, setName] = useState(entry?.name ?? "");
  const [scope, setScope] = useState<string>(entry?.scope ?? "");
  const [comment, setComment] = useState(entry?.comment ?? "");
  const [refersTo, setRefersTo] = useState(defaultRefersTo);
  const [error, setError] = useState<string | null>(null);
  const uid = useId();
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => nameRef.current?.focus(), []);

  const save = () => {
    const sc = scope || null;
    const previous = entry
      ? { name: entry.name, scope: entry.scope }
      : undefined;
    const err =
      validateDefinedName(context, name, sc, previous) ??
      (refersTo.trim() && refersTo.trim() !== "=" ? null : "emptyDefinition");
    if (err) {
      // @ts-ignore
      setError(t[ERROR_KEYS[err]] ?? err);
      return;
    }
    setContext((ctx) => {
      saveDefinedName(
        ctx,
        {
          name: name.trim(),
          refersTo,
          scope: sc,
          comment: comment || undefined,
        },
        previous
      );
    });
    onDone();
  };

  return (
    <div className="fortune-name-editor">
      <div className="fortune-name-manager-title">
        {entry ? t.editNameTitle : t.newNameTitle}
      </div>
      <div className="fortune-name-editor-row">
        <label htmlFor={`${uid}-name`}>{t.name}</label>
        <input
          id={`${uid}-name`}
          ref={nameRef}
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
        />
      </div>
      <div className="fortune-name-editor-row">
        <label htmlFor={`${uid}-scope`}>{t.scope}</label>
        <select
          id={`${uid}-scope`}
          value={scope}
          onChange={(e) => setScope(e.target.value)}
        >
          <option value="">{t.scopeWorkbook}</option>
          {context.luckysheetfile.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <div className="fortune-name-editor-row">
        <label htmlFor={`${uid}-comment`}>{t.comment}</label>
        <textarea
          id={`${uid}-comment`}
          rows={3}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      </div>
      <div className="fortune-name-editor-row">
        <label htmlFor={`${uid}-refers`}>{t.refersTo}</label>
        <input
          id={`${uid}-refers`}
          type="text"
          value={refersTo}
          spellCheck={false}
          onChange={(e) => {
            setRefersTo(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
          }}
        />
      </div>
      {error && (
        <div className="fortune-name-manager-error" role="alert">
          {error}
        </div>
      )}
      <div className="fortune-name-manager-footer">
        <TextButton primary onClick={save}>
          {button.confirm}
        </TextButton>
        <TextButton onClick={onDone}>{button.cancel}</TextButton>
      </div>
    </div>
  );
};

/** "Create Names from Selection" form. */
const CreateFromSelection: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const { context, setContext } = useContext(WorkbookContext);
  const { definedNames: t, button } = locale(context);
  const [opts, setOpts] = useState({
    top: true,
    left: false,
    bottom: false,
    right: false,
  });
  const range = selectionAsNameRange(context);
  const uid = useId();
  const keys: [keyof typeof opts, string][] = [
    ["top", t.topRow],
    ["left", t.leftColumn],
    ["bottom", t.bottomRow],
    ["right", t.rightColumn],
  ];
  return (
    <div className="fortune-name-editor">
      <div className="fortune-name-manager-title">
        {t.createFromSelectionTitle}
      </div>
      {keys.map(([key, label]) => (
        <div key={key} className="fortune-name-editor-check">
          <input
            id={`${uid}-${key}`}
            type="checkbox"
            checked={opts[key]}
            onChange={(e) => setOpts({ ...opts, [key]: e.target.checked })}
          />
          <label htmlFor={`${uid}-${key}`}>{label}</label>
        </div>
      ))}
      <div className="fortune-name-manager-footer">
        <TextButton
          primary
          disabled={!range}
          onClick={() => {
            if (!range) return;
            setContext((ctx) => {
              createNamesFromSelection(ctx, range, opts);
            });
            onDone();
          }}
        >
          {button.confirm}
        </TextButton>
        <TextButton onClick={onDone}>{button.cancel}</TextButton>
      </div>
    </div>
  );
};

/** Excel's Name Manager: list, filter, new, edit, delete. */
export const NameManager: React.FC<{ initialMode?: "fromSelection" }> = ({
  initialMode,
}) => {
  const { context, setContext } = useContext(WorkbookContext);
  const { hideDialog } = useDialog();
  const { definedNames: t, button } = locale(context);
  const [mode, setMode] = useState<Mode>(
    initialMode === "fromSelection"
      ? { kind: "fromSelection" }
      : { kind: "list" }
  );
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const rows = useMemo(() => {
    const sheetName = (id: string | null) =>
      id == null ? t.scopeWorkbook : sheetNameById(context, id) ?? "";
    return getDefinedNames(context)
      .filter((e) => !e.hidden)
      .map((e) => ({
        entry: e,
        key: `${e.scope ?? ""}|${e.name}`,
        value: evaluateDefinedName(context, e),
        scopeName: sheetName(e.scope),
      }))
      .sort((a, b) => a.entry.name.localeCompare(b.entry.name));
  }, [context, t.scopeWorkbook]);

  const visible = rows.filter((row) => {
    if (filter === "workbook" && row.entry.scope != null) return false;
    if (filter === "sheet" && row.entry.scope == null) return false;
    if (filter === "errors" && !/^#[A-Z/0-9]+[!?]?$/.test(row.value)) {
      return false;
    }
    if (query && !row.entry.name.toLowerCase().includes(query.toLowerCase())) {
      return false;
    }
    return true;
  });
  const current = rows.find((row) => row.key === selected) ?? null;

  if (mode.kind === "edit") {
    return (
      <div className="fortune-name-manager">
        <NameEditor
          entry={mode.entry}
          onDone={() => setMode({ kind: "list" })}
        />
      </div>
    );
  }
  if (mode.kind === "fromSelection") {
    return (
      <div className="fortune-name-manager">
        <CreateFromSelection
          onDone={() => {
            setMode({ kind: "list" });
          }}
        />
      </div>
    );
  }

  return (
    <div className="fortune-name-manager">
      <div className="fortune-name-manager-title">{t.nameManager}</div>
      <div className="fortune-name-manager-toolbar">
        <TextButton onClick={() => setMode({ kind: "edit", entry: null })}>
          {t.newName}
        </TextButton>
        <TextButton
          disabled={!current}
          onClick={() =>
            current && setMode({ kind: "edit", entry: current.entry })
          }
        >
          {t.editName}
        </TextButton>
        <TextButton
          disabled={!current}
          onClick={() => {
            if (!current) return;
            const { name, scope } = current.entry;
            setContext((ctx) => {
              deleteDefinedName(ctx, name, scope);
            });
            setSelected(null);
          }}
        >
          {t.deleteName}
        </TextButton>
        <div className="fortune-name-manager-spacer" />
        <select
          aria-label={t.filterAll}
          value={filter}
          onChange={(e) => setFilter(e.target.value as Filter)}
        >
          <option value="all">{t.filterAll}</option>
          <option value="workbook">{t.filterWorkbook}</option>
          <option value="sheet">{t.filterSheet}</option>
          <option value="errors">{t.filterErrors}</option>
        </select>
        <input
          type="text"
          placeholder={t.filterPlaceholder}
          aria-label={t.filterPlaceholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="fortune-name-manager-table-wrap">
        <table className="fortune-name-manager-table">
          <thead>
            <tr>
              <th>{t.columnName}</th>
              <th>{t.columnValue}</th>
              <th>{t.columnRefersTo}</th>
              <th>{t.columnScope}</th>
              <th>{t.columnComment}</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr
                key={row.key}
                aria-selected={row.key === selected}
                tabIndex={0}
                onClick={() => setSelected(row.key)}
                onDoubleClick={() =>
                  setMode({ kind: "edit", entry: row.entry })
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setMode({ kind: "edit", entry: row.entry });
                  } else if (e.key === " ") {
                    e.preventDefault();
                    setSelected(row.key);
                  }
                }}
              >
                <td>{row.entry.name}</td>
                <td>{row.value}</td>
                <td>{refersToForActiveCell(context, row.entry.refersTo)}</td>
                <td>{row.scopeName}</td>
                <td>{row.entry.comment ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length === 0 && (
          <div className="fortune-name-manager-empty">
            {rows.length === 0 ? t.empty : t.noMatch}
          </div>
        )}
      </div>
      <div className="fortune-name-manager-refers">
        <span>{t.refersTo}</span>
        <input
          type="text"
          readOnly
          value={
            current
              ? refersToForActiveCell(context, current.entry.refersTo)
              : ""
          }
        />
      </div>
      <div className="fortune-name-manager-footer">
        <TextButton onClick={() => setMode({ kind: "fromSelection" })}>
          {t.createFromSelection}
        </TextButton>
        <div className="fortune-name-manager-spacer" />
        <TextButton onClick={hideDialog}>{button.close}</TextButton>
      </div>
    </div>
  );
};

/** Inline icon (not part of the shared SVG sprite). */
export const NameManagerIcon: React.FC = () => (
  <svg width={24} height={24} viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="currentColor"
      d="M4 5h16v2H4zm0 4h10v2H4zm0 4h16v2H4zm0 4h10v2H4zm12.5-8.5L20 12l-3.5 3.5-1.4-1.4 2.1-2.1-2.1-2.1z"
    />
  </svg>
);

/** Toolbar button opening the Name Manager. */
export const NameManagerButton: React.FC = () => {
  const { context } = useContext(WorkbookContext);
  const { showDialog } = useDialog();
  const { definedNames: t } = locale(context);
  return (
    <div
      className="fortune-toolbar-button fortune-toolbar-item"
      role="button"
      tabIndex={0}
      aria-label={t.nameManager}
      data-tips={t.nameManager}
      onClick={() => showDialog(<NameManager />)}
      onKeyDown={activateOnKey}
    >
      <NameManagerIcon />
      <div className="fortune-tooltip" aria-hidden="true">
        {t.nameManager}
      </div>
    </div>
  );
};

export default NameManager;
