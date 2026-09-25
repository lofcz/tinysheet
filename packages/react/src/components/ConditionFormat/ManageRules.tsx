import React, { useCallback, useContext, useMemo, useState } from "react";
import {
  locale,
  cfRangesIntersect,
  cleanCFRanges,
  formatSqref,
  parseSqref,
  setCFRules,
} from "@lofcz/tinysheet-core";
import type { CFRule } from "@lofcz/tinysheet-core";
import _ from "lodash";
import WorkbookContext from "../../context";
import { useDialog } from "../../hooks/useDialog";
import RuleEditor from "./RuleEditor";
import { CFText, RuleFormatPreview, describeRule } from "./previews";

type Editing = { sheetId: string; index: number; rule: CFRule } | null;

function activate(fn: () => void) {
  return (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fn();
    }
  };
}

const ToolButton: React.FC<{
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children?: React.ReactNode;
}> = ({ label, onClick, disabled, children }) => (
  <div
    className="button-basic button-default fortune-cf-toolbutton"
    role="button"
    tabIndex={disabled ? -1 : 0}
    aria-disabled={disabled || undefined}
    aria-label={label}
    title={label}
    onClick={disabled ? undefined : onClick}
    onKeyDown={disabled ? undefined : activate(onClick)}
  >
    {children ?? label}
  </div>
);

/**
 * Conditional Formatting Rules Manager: list, create, edit, delete,
 * duplicate and reorder rules, edit applies-to and "stop if true". Edits
 * stay local until OK / Apply, which store them in one undo step.
 */
const ManageRules: React.FC = () => {
  const { context, setContext } = useContext(WorkbookContext);
  const { hideDialog } = useDialog();
  const loc = locale(context);
  const text = loc.conditionformat as unknown as CFText;
  const { button } = loc;
  const currentId = context.currentSheetId;
  const [scope, setScope] = useState<string>("selection");
  const [working, setWorking] = useState<Record<string, CFRule[]>>({});
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<{
    sheetId: string;
    index: number;
  } | null>(null);
  const [rangeText, setRangeText] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<Editing>(null);

  const selection = useMemo(
    () => cleanCFRanges(context.luckysheet_select_save),
    [context.luckysheet_select_save]
  );
  const sheetId = scope === "selection" ? currentId : scope;

  const rulesOf = useCallback(
    (id: string): CFRule[] => {
      if (working[id]) return working[id];
      const sheet = context.luckysheetfile.find((s) => s.id === id);
      return (sheet?.luckysheet_conditionformat_save ?? []) as CFRule[];
    },
    [context.luckysheetfile, working]
  );

  const rules = rulesOf(sheetId);
  // rows in Excel order: highest priority first
  const rows = useMemo(() => {
    const out: { index: number; rule: CFRule }[] = [];
    for (let i = rules.length - 1; i >= 0; i -= 1) {
      const rule = rules[i];
      if (
        scope !== "selection" ||
        (rule.cellrange ?? []).some((a) =>
          selection.some((b) => cfRangesIntersect(a, b))
        )
      ) {
        out.push({ index: i, rule });
      }
    }
    return out;
  }, [rules, scope, selection]);

  const update = (id: string, fn: (list: CFRule[]) => CFRule[]) => {
    setWorking((w) => ({ ...w, [id]: fn(_.cloneDeep(w[id] ?? rulesOf(id))) }));
    setDirty((d) => ({ ...d, [id]: true }));
  };

  const sel =
    selected && selected.sheetId === sheetId && rules[selected.index]
      ? selected.index
      : null;
  const rowPos = rows.findIndex((r) => r.index === sel);

  const move = (delta: number) => {
    if (sel === null) return;
    // "up" in the list is higher priority, i.e. a larger array index
    const target = rows[rowPos - delta];
    if (!target) return;
    update(sheetId, (list) => {
      const [rule] = list.splice(sel, 1);
      list.splice(target.index, 0, rule);
      return list;
    });
    setSelected({ sheetId, index: target.index });
    setRangeText({});
  };

  const apply = () => {
    const ids = Object.keys(dirty).filter((id) => dirty[id]);
    if (ids.length === 0) return;
    setContext((ctx) => {
      ids.forEach((id) => setCFRules(ctx, working[id] ?? [], id));
    });
    setDirty({});
  };

  if (editing) {
    return (
      <div className="fortune-cf-dialog">
        <RuleEditor
          rule={editing.rule}
          isNew={editing.index < 0}
          text={text}
          buttons={{ confirm: button.confirm, cancel: button.cancel }}
          onCancel={() => setEditing(null)}
          onOk={(rule) => {
            const { sheetId: id, index } = editing;
            const newIndex = index < 0 ? rulesOf(id).length : index;
            update(id, (list) => {
              if (index < 0) list.push(rule);
              else list[index] = rule;
              return list;
            });
            setSelected({ sheetId: id, index: newIndex });
            setRangeText({});
            setEditing(null);
          }}
        />
      </div>
    );
  }

  const sheets = context.luckysheetfile;

  return (
    <div className="fortune-cf-dialog fortune-cf-manager">
      <div className="fortune-cf-title">{text.manageRulesTitle}</div>
      <div className="fortune-cf-inline">
        <label htmlFor="fortune-cf-scope">{text.showRulesFor}</label>
        <select
          id="fortune-cf-scope"
          className="fortune-cf-select"
          value={scope}
          onChange={(e) => {
            setScope(e.target.value);
            setSelected(null);
            setRangeText({});
          }}
        >
          <option value="selection">{text.currentSelection}</option>
          {sheets.map((s) => (
            <option key={s.id} value={s.id!}>
              {s.id === currentId ? `${text.thisSheet} (${s.name})` : s.name}
            </option>
          ))}
        </select>
      </div>
      <div className="fortune-cf-toolbar">
        <ToolButton
          label={text.newRule}
          onClick={() =>
            setEditing({
              sheetId,
              index: -1,
              rule: {
                type: "default",
                cellrange: sheetId === currentId ? selection : [],
                conditionName: "between",
                conditionValue: ["", ""],
                format: { cellColor: "#FFC7CE", textColor: "#9C0006" },
              },
            })
          }
        />
        <ToolButton
          label={text.editRule}
          disabled={sel === null}
          onClick={() =>
            sel !== null &&
            setEditing({ sheetId, index: sel, rule: _.cloneDeep(rules[sel]) })
          }
        />
        <ToolButton
          label={text.deleteRule}
          disabled={sel === null}
          onClick={() => {
            if (sel === null) return;
            update(sheetId, (list) => {
              list.splice(sel, 1);
              return list;
            });
            setSelected(null);
            setRangeText({});
          }}
        />
        <ToolButton
          label={text.duplicateRule}
          disabled={sel === null}
          onClick={() => {
            if (sel === null) return;
            update(sheetId, (list) => {
              list.splice(sel, 0, _.cloneDeep(list[sel]));
              return list;
            });
            setRangeText({});
          }}
        />
        <ToolButton
          label={text.moveUp}
          disabled={sel === null || rowPos <= 0}
          onClick={() => move(1)}
        >
          ▲
        </ToolButton>
        <ToolButton
          label={text.moveDown}
          disabled={sel === null || rowPos < 0 || rowPos >= rows.length - 1}
          onClick={() => move(-1)}
        >
          ▼
        </ToolButton>
      </div>
      <div className="fortune-cf-table-wrap">
        <table className="fortune-cf-table" role="grid">
          <thead>
            <tr>
              <th>{text.rule}</th>
              <th>{text.format}</th>
              <th>{text.appliesTo}</th>
              <th>{text.stopIfTrue}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="fortune-cf-muted">
                  {text.noRules}
                </td>
              </tr>
            )}
            {rows.map(({ index, rule }) => {
              const key = `${sheetId}:${index}`;
              const txt = rangeText[key] ?? formatSqref(rule.cellrange);
              const valid = !!parseSqref(txt);
              return (
                <tr
                  key={key}
                  className={sel === index ? "selected" : undefined}
                  aria-selected={sel === index}
                  onClick={() => setSelected({ sheetId, index })}
                  onDoubleClick={() =>
                    setEditing({ sheetId, index, rule: _.cloneDeep(rule) })
                  }
                >
                  <td className="fortune-cf-desc">
                    {describeRule(rule, text)}
                  </td>
                  <td>
                    <RuleFormatPreview rule={rule} text={text} />
                  </td>
                  <td>
                    <input
                      className={`fortune-cf-input${valid ? "" : " invalid"}`}
                      type="text"
                      aria-label={text.appliesTo}
                      aria-invalid={!valid}
                      title={valid ? undefined : text.invalidRange}
                      value={txt}
                      onFocus={() => setSelected({ sheetId, index })}
                      onChange={(e) => {
                        const v = e.target.value;
                        setRangeText((t) => ({ ...t, [key]: v }));
                        const parsed = parseSqref(v);
                        if (parsed) {
                          update(sheetId, (list) => {
                            list[index] = { ...list[index], cellrange: parsed };
                            return list;
                          });
                        }
                      }}
                    />
                  </td>
                  <td className="fortune-cf-center">
                    <input
                      type="checkbox"
                      aria-label={text.stopIfTrue}
                      disabled={rule.type !== "default"}
                      checked={!!rule.stopIfTrue}
                      onChange={(e) => {
                        const { checked } = e.target;
                        update(sheetId, (list) => {
                          list[index] = {
                            ...list[index],
                            stopIfTrue: checked || undefined,
                          };
                          return list;
                        });
                      }}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="fortune-cf-buttons">
        <div
          className="button-basic button-primary"
          role="button"
          tabIndex={0}
          onClick={() => {
            apply();
            hideDialog();
          }}
          onKeyDown={activate(() => {
            apply();
            hideDialog();
          })}
        >
          {button.confirm}
        </div>
        <div
          className="button-basic button-default"
          role="button"
          tabIndex={0}
          onClick={hideDialog}
          onKeyDown={activate(hideDialog)}
        >
          {button.cancel}
        </div>
        <div
          className="button-basic button-default"
          role="button"
          tabIndex={0}
          aria-disabled={!Object.values(dirty).some(Boolean) || undefined}
          onClick={apply}
          onKeyDown={activate(apply)}
        >
          {text.applyLabel}
        </div>
      </div>
    </div>
  );
};

export default ManageRules;
