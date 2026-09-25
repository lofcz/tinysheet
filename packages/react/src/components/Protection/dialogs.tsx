import {
  AllowEditRange,
  Context,
  ProtectionPasswordHash,
  SHEET_PROTECTION_ACTIONS,
  SheetProtectionAction,
  defaultProtectionActions,
  getSheetProtectionSettings,
  hashProtectionPassword,
  hasProtectionPassword,
  isProtectionActionAllowed,
  isSheetProtected,
  parseSqref,
  protectSheet,
  protectWorkbook,
  protectionLocale,
  protectionRangesToSqref,
  setAllowEditRanges,
} from "@lofcz/tinysheet-core";
import React, { useContext, useEffect, useRef, useState } from "react";
import WorkbookContext from "../../context";
import { useDialog } from "../../hooks/useDialog";
import "../DataVerification/dataTools.css";
import DtCheck from "../DataVerification/DtCheck";
import "./index.css";

/** Protect / unprotect cannot be undone (Excel clears the undo list). */
export function useClearUndo() {
  const { refs } = useContext(WorkbookContext);
  return () => {
    // after the pending setContext has been applied
    setTimeout(() => {
      refs.globalCache.undoList = [];
      refs.globalCache.redoList = [];
    });
  };
}

/** A labelled input row. */
const Field: React.FC<{
  label: string;
  children: (id: string) => React.ReactNode;
}> = ({ label, children }) => {
  const id = React.useId();
  return (
    <div className="fortune-dt-field">
      <label className="fortune-dt-label" htmlFor={id}>
        {label}
      </label>
      {children(id)}
    </div>
  );
};

const Buttons: React.FC<{
  onOk: () => void;
  onCancel: () => void;
  okText: string;
  cancelText: string;
  busy?: boolean;
  children?: React.ReactNode;
}> = ({ onOk, onCancel, okText, cancelText, busy, children }) => (
  <div className="fortune-dt-buttons">
    {children}
    <div className="fortune-dt-spacer" />
    <div
      className="button-basic button-primary"
      role="button"
      tabIndex={0}
      aria-disabled={busy}
      data-testid="protection-ok"
      onClick={() => {
        if (!busy) onOk();
      }}
    >
      {okText}
    </div>
    <div
      className="button-basic button-default"
      role="button"
      tabIndex={0}
      onClick={onCancel}
    >
      {cancelText}
    </div>
  </div>
);

function onEnter(fn: () => void) {
  return (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      fn();
    }
    e.stopPropagation();
  };
}

/**
 * A password prompt (Unprotect Sheet / Workbook, Unlock Range):
 * `check` resolves true when the password is right, the dialog then closes.
 */
export const PasswordPrompt: React.FC<{
  title: string;
  prompt: string;
  check: (password: string) => Promise<boolean>;
  onCancel?: () => void;
}> = ({ title, prompt, check, onCancel }) => {
  const { context } = useContext(WorkbookContext);
  const { hideDialog } = useDialog();
  const t = protectionLocale(context);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => inputRef.current?.focus(), []);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    const ok = await check(password);
    setBusy(false);
    if (ok) hideDialog();
    else {
      setError(t.wrongPassword);
      inputRef.current?.select();
    }
  };
  const cancel = () => {
    onCancel?.();
    hideDialog();
  };

  return (
    <div className="fortune-dt-dialog fortune-protection-dialog">
      <div className="fortune-dt-title">{title}</div>
      <Field label={prompt}>
        {(id) => (
          <input
            id={id}
            ref={inputRef}
            className="fortune-dt-input"
            type="password"
            autoComplete="off"
            value={password}
            data-testid="protection-password"
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={onEnter(submit)}
          />
        )}
      </Field>
      {busy && <div className="fortune-dt-hint">{t.verifying}</div>}
      {error && (
        <div className="fortune-dt-error" role="alert">
          {error}
        </div>
      )}
      <Buttons
        onOk={submit}
        onCancel={cancel}
        okText={t.ok}
        cancelText={t.cancel}
        busy={busy}
      />
    </div>
  );
};

/** Excel's "Confirm Password" step, then `done` with the hash. */
const ConfirmPassword: React.FC<{
  password: string;
  onDone: (hash: ProtectionPasswordHash) => void;
  onBack: () => void;
}> = ({ password, onDone, onBack }) => {
  const { context } = useContext(WorkbookContext);
  const t = protectionLocale(context);
  const [again, setAgain] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => inputRef.current?.focus(), []);
  const submit = async () => {
    if (busy) return;
    if (again !== password) {
      setError(t.passwordMismatch);
      return;
    }
    setBusy(true);
    const hash = await hashProtectionPassword(password);
    setBusy(false);
    onDone(hash);
  };
  return (
    <div className="fortune-dt-dialog fortune-protection-dialog">
      <div className="fortune-dt-title">{t.confirmPasswordTitle}</div>
      <Field label={t.reenterPassword}>
        {(id) => (
          <input
            id={id}
            ref={inputRef}
            className="fortune-dt-input"
            type="password"
            autoComplete="off"
            value={again}
            data-testid="protection-password-confirm"
            onChange={(e) => {
              setAgain(e.target.value);
              setError("");
            }}
            onKeyDown={onEnter(submit)}
          />
        )}
      </Field>
      <div className="fortune-dt-hint fortune-protection-caution">
        {t.passwordCaution}
      </div>
      {busy && <div className="fortune-dt-hint">{t.verifying}</div>}
      {error && (
        <div className="fortune-dt-error" role="alert">
          {error}
        </div>
      )}
      <Buttons
        onOk={submit}
        onCancel={onBack}
        okText={t.ok}
        cancelText={t.cancel}
        busy={busy}
      />
    </div>
  );
};

/** Review › Protect Sheet. */
export const ProtectSheetDialog: React.FC = () => {
  const { context, setContext } = useContext(WorkbookContext);
  const { hideDialog } = useDialog();
  const clearUndo = useClearUndo();
  const t = protectionLocale(context);
  const sheetId = context.currentSheetId;
  const [protect, setProtect] = useState(true);
  const [password, setPassword] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [allow, setAllow] = useState<Record<SheetProtectionAction, boolean>>(
    () => {
      const prev = getSheetProtectionSettings(context, sheetId);
      const defaults = defaultProtectionActions();
      const out = {} as Record<SheetProtectionAction, boolean>;
      SHEET_PROTECTION_ACTIONS.forEach((a) => {
        out[a] = prev ? isProtectionActionAllowed(prev, a) : !!defaults[a];
      });
      return out;
    }
  );
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => inputRef.current?.focus(), []);

  const apply = (hash: ProtectionPasswordHash) => {
    setContext((ctx: Context) => {
      protectSheet(ctx, sheetId, { allow, password: hash });
    });
    clearUndo();
    hideDialog();
  };

  if (confirming) {
    return (
      <ConfirmPassword
        password={password}
        onDone={apply}
        onBack={() => setConfirming(false)}
      />
    );
  }

  const ok = () => {
    if (!protect) {
      hideDialog();
      return;
    }
    if (password) setConfirming(true);
    else apply({});
  };

  return (
    <div
      className="fortune-dt-dialog fortune-protection-dialog"
      data-testid="protect-sheet-dialog"
    >
      <div className="fortune-dt-title">{t.protectSheetTitle}</div>
      <DtCheck checked={protect} onChange={setProtect}>
        {t.protectSheetCheckbox}
      </DtCheck>
      <Field label={t.sheetPassword}>
        {(id) => (
          <input
            id={id}
            ref={inputRef}
            className="fortune-dt-input"
            type="password"
            autoComplete="off"
            value={password}
            disabled={!protect}
            data-testid="protection-password"
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={onEnter(ok)}
          />
        )}
      </Field>
      <div className="fortune-dt-label">{t.allowAllUsers}</div>
      <div className="fortune-dt-scroll fortune-protection-actions">
        {SHEET_PROTECTION_ACTIONS.map((a) => (
          <DtCheck
            key={a}
            checked={allow[a]}
            disabled={!protect}
            onChange={(v) => setAllow((prev) => ({ ...prev, [a]: v }))}
          >
            {t.actions[a]}
          </DtCheck>
        ))}
      </div>
      <Buttons
        onOk={ok}
        onCancel={hideDialog}
        okText={t.ok}
        cancelText={t.cancel}
      />
    </div>
  );
};

/** Review › Protect Workbook (structure). */
export const ProtectWorkbookDialog: React.FC = () => {
  const { context, setContext } = useContext(WorkbookContext);
  const { hideDialog } = useDialog();
  const clearUndo = useClearUndo();
  const t = protectionLocale(context);
  const [structure, setStructure] = useState(true);
  const [password, setPassword] = useState("");
  const [confirming, setConfirming] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => inputRef.current?.focus(), []);

  const apply = (hash: ProtectionPasswordHash) => {
    setContext((ctx: Context) => {
      protectWorkbook(ctx, hash);
    });
    clearUndo();
    hideDialog();
  };

  if (confirming) {
    return (
      <ConfirmPassword
        password={password}
        onDone={apply}
        onBack={() => setConfirming(false)}
      />
    );
  }

  const ok = () => {
    if (!structure) {
      hideDialog();
      return;
    }
    if (password) setConfirming(true);
    else apply({});
  };

  return (
    <div
      className="fortune-dt-dialog fortune-protection-dialog"
      data-testid="protect-workbook-dialog"
    >
      <div className="fortune-dt-title">{t.protectWorkbookTitle}</div>
      <Field label={t.passwordOptional}>
        {(id) => (
          <input
            id={id}
            ref={inputRef}
            className="fortune-dt-input"
            type="password"
            autoComplete="off"
            value={password}
            data-testid="protection-password"
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={onEnter(ok)}
          />
        )}
      </Field>
      <div className="fortune-dt-label">{t.protectWorkbookFor}</div>
      <div className="fortune-dt-section">
        <DtCheck checked={structure} onChange={setStructure}>
          {t.structure}
        </DtCheck>
      </div>
      <Buttons
        onOk={ok}
        onCancel={hideDialog}
        okText={t.ok}
        cancelText={t.cancel}
      />
    </div>
  );
};

type EditState = {
  index: number | null;
  name: string;
  sqref: string;
  password: string;
  error: string;
};

/** Review › Allow Edit Ranges. */
export const AllowEditRangesDialog: React.FC<{
  onProtectSheet?: () => void;
}> = ({ onProtectSheet }) => {
  const { context, setContext } = useContext(WorkbookContext);
  const { hideDialog } = useDialog();
  const t = protectionLocale(context);
  const sheetId = context.currentSheetId;
  const locked = isSheetProtected(context, sheetId);
  const [ranges, setRanges] = useState<AllowEditRange[]>(
    () => getSheetProtectionSettings(context, sheetId)?.allowRangeList ?? []
  );
  const [selected, setSelected] = useState(0);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [busy, setBusy] = useState(false);

  const save = (list: AllowEditRange[]) => {
    setContext((ctx: Context) => {
      setAllowEditRanges(ctx, sheetId, list);
    });
  };

  const openEditor = (index: number | null) => {
    if (locked) return;
    if (index == null) {
      const sel = context.luckysheet_select_save ?? [];
      let n = ranges.length + 1;
      const taken = new Set(ranges.map((r) => r.name.toLowerCase()));
      while (taken.has(t.defaultRangeName.replace("{n}", `${n}`).toLowerCase()))
        n += 1;
      setEdit({
        index: null,
        name: t.defaultRangeName.replace("{n}", `${n}`),
        sqref: sel.length
          ? `=${protectionRangesToSqref(
              sel.map((s) => ({ row: s.row, column: s.column }))
            ).replace(/ /g, ",")}`
          : "",
        password: "",
        error: "",
      });
    } else {
      const r = ranges[index];
      setEdit({
        index,
        name: r.name,
        sqref: `=${r.sqref.replace(/ /g, ",")}`,
        password: "",
        error: "",
      });
    }
  };

  const commitEdit = async () => {
    if (!edit || busy) return;
    const name = edit.name.trim();
    if (!name) {
      setEdit({ ...edit, error: t.emptyTitle });
      return;
    }
    if (
      ranges.some(
        (r, i) =>
          i !== edit.index && r.name.toLowerCase() === name.toLowerCase()
      )
    ) {
      setEdit({ ...edit, error: t.duplicateTitle });
      return;
    }
    const parsed = parseSqref(edit.sqref);
    if (!parsed) {
      setEdit({ ...edit, error: t.invalidReference });
      return;
    }
    const prev = edit.index == null ? null : ranges[edit.index];
    let hash: ProtectionPasswordHash = {};
    if (edit.password) {
      setBusy(true);
      hash = await hashProtectionPassword(edit.password);
      setBusy(false);
    } else if (prev) {
      // keep the old password unless a new one is typed
      const { algorithmName, hashValue, saltValue, spinCount, legacyHash } =
        prev;
      hash = { algorithmName, hashValue, saltValue, spinCount, legacyHash };
      Object.keys(hash).forEach((k) => {
        if ((hash as any)[k] == null) delete (hash as any)[k];
      });
    }
    const item: AllowEditRange = {
      name,
      sqref: protectionRangesToSqref(parsed),
      ...hash,
    };
    const next =
      edit.index == null
        ? [...ranges, item]
        : ranges.map((r, i) => (i === edit.index ? item : r));
    setRanges(next);
    setSelected(edit.index ?? next.length - 1);
    setEdit(null);
    save(next);
  };

  if (edit) {
    return (
      <div
        className="fortune-dt-dialog fortune-protection-dialog"
        data-testid="edit-range-dialog"
      >
        <div className="fortune-dt-title">
          {edit.index == null ? t.newRangeTitle : t.modifyRangeTitle}
        </div>
        <Field label={t.rangeTitle}>
          {(id) => (
            <input
              id={id}
              className="fortune-dt-input"
              value={edit.name}
              data-testid="range-title"
              onChange={(e) =>
                setEdit({ ...edit, name: e.target.value, error: "" })
              }
              onKeyDown={onEnter(commitEdit)}
            />
          )}
        </Field>
        <Field label={t.refersTo}>
          {(id) => (
            <input
              id={id}
              className="fortune-dt-input"
              value={edit.sqref}
              data-testid="range-refers-to"
              onChange={(e) =>
                setEdit({ ...edit, sqref: e.target.value, error: "" })
              }
              onKeyDown={onEnter(commitEdit)}
            />
          )}
        </Field>
        <Field label={t.rangePassword}>
          {(id) => (
            <input
              id={id}
              className="fortune-dt-input"
              type="password"
              autoComplete="off"
              value={edit.password}
              data-testid="range-password"
              onChange={(e) => setEdit({ ...edit, password: e.target.value })}
              onKeyDown={onEnter(commitEdit)}
            />
          )}
        </Field>
        {edit.error && (
          <div className="fortune-dt-error" role="alert">
            {edit.error}
          </div>
        )}
        <Buttons
          onOk={commitEdit}
          onCancel={() => setEdit(null)}
          okText={t.ok}
          cancelText={t.cancel}
          busy={busy}
        />
      </div>
    );
  }

  const remove = () => {
    if (locked || !ranges[selected]) return;
    const next = ranges.filter((_r, i) => i !== selected);
    setRanges(next);
    setSelected(Math.max(0, selected - 1));
    save(next);
  };

  return (
    <div
      className="fortune-dt-dialog fortune-protection-dialog"
      data-testid="allow-edit-ranges-dialog"
    >
      <div className="fortune-dt-title">{t.allowEditRangesTitle}</div>
      <div className="fortune-dt-label">{t.rangesUnlocked}</div>
      <div className="fortune-protection-ranges">
        <div className="fortune-dt-scroll">
          <table className="fortune-dt-table">
            <thead>
              <tr>
                <th>{t.rangeTitle}</th>
                <th>{t.refersTo}</th>
                <th>{t.passwordColumn}</th>
              </tr>
            </thead>
            <tbody>
              {ranges.map((r, i) => (
                <tr
                  key={r.name}
                  className={i === selected ? "selected" : undefined}
                  onClick={() => setSelected(i)}
                  onDoubleClick={() => openEditor(i)}
                >
                  <td>{r.name}</td>
                  <td>{r.sqref}</td>
                  <td>{hasProtectionPassword(r) ? t.hasPassword : ""}</td>
                </tr>
              ))}
              {ranges.length === 0 && (
                <tr>
                  <td colSpan={3} className="fortune-dt-hint">
                    {t.noRanges}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="fortune-protection-range-buttons">
          {[
            { text: t.newRange, run: () => openEditor(null), off: locked },
            {
              text: t.modifyRange,
              run: () => openEditor(selected),
              off: locked || !ranges[selected],
            },
            {
              text: t.deleteRange,
              run: remove,
              off: locked || !ranges[selected],
            },
          ].map((b) => (
            <div
              key={b.text}
              className="fortune-dt-icon-button"
              role="button"
              tabIndex={0}
              aria-disabled={b.off}
              onClick={() => {
                if (!b.off) b.run();
              }}
            >
              {b.text}
            </div>
          ))}
        </div>
      </div>
      {locked && <div className="fortune-dt-hint">{t.sheetIsProtected}</div>}
      <Buttons
        onOk={hideDialog}
        onCancel={hideDialog}
        okText={t.ok}
        cancelText={t.cancel}
      >
        {!locked && onProtectSheet && (
          <div
            className="button-basic button-default"
            role="button"
            tabIndex={0}
            onClick={onProtectSheet}
          >
            {t.protectSheet}
          </div>
        )}
      </Buttons>
    </div>
  );
};
