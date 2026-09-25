import {
  BUILTIN_CUSTOM_LISTS,
  cellText,
  dataToolsLocale,
  detectHeaderRow,
  getCellDisplayColors,
  getComputeMap,
  getSortRegion,
  getFilterColumnKind,
  getFlowdata,
  indexToColumnChar,
  locale,
  sortRange,
  SortLevel,
} from "@lofcz/tinysheet-core";
import _ from "lodash";
import React, { useCallback, useContext, useMemo, useState } from "react";
import WorkbookContext from "../../context";
import { useDialog } from "../../hooks/useDialog";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Plus,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { Button, DialogShell, IconButton } from "../ui";
import "../DataVerification/dataTools.css";
import "./index.css";
import DtCheck from "../DataVerification/DtCheck";

type LevelState = {
  id: number;
  index: number;
  sortOn: "value" | "cellColor" | "fontColor";
  /** "asc", "desc", "list:<n>" (built-in list) or "custom" (user list) */
  order: string;
  customText: string;
  color: string;
  position: "top" | "bottom";
};

let nextId = 1;
const newId = () => {
  nextId += 1;
  return nextId;
};

/**
 * Excel's Sort dialog: several levels (add, delete, copy, move), header
 * detection, sort on values or colours, custom lists, left to right.
 */
const CustomSort: React.FC = () => {
  const { context, setContext } = useContext(WorkbookContext);
  const { hideDialog } = useDialog();
  const t = dataToolsLocale(context).sort;
  const { sort: sortLocale } = locale(context);
  const data = getFlowdata(context);

  const range = useMemo(() => {
    const sel = context.luckysheet_select_save?.[0];
    if (!sel || !data) return null;
    if (sel.row[0] === sel.row[1] && sel.column[0] === sel.column[1]) {
      return getSortRegion(data, sel.row[0], sel.column[0]);
    }
    return { row: sel.row.slice(), column: sel.column.slice() };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [hasHeaders, setHasHeaders] = useState(() =>
    range && data ? detectHeaderRow(data, range) : false
  );
  const [leftToRight, setLeftToRight] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [selected, setSelected] = useState(0);
  const [error, setError] = useState("");

  const keys = useMemo(() => {
    if (!range || !data) return [];
    const [k1, k2] = leftToRight ? range.row : range.column;
    const out: { index: number; label: string }[] = [];
    for (let k = k1; k <= k2; k += 1) {
      const name = leftToRight
        ? `${t.row} ${k + 1}`
        : `${t.column} ${indexToColumnChar(k)}`;
      let label = name;
      if (hasHeaders) {
        const cell = leftToRight
          ? data[k]?.[range.column[0]]
          : data[range.row[0]]?.[k];
        const text = cellText(cell);
        if (text) label = text;
      }
      out.push({ index: k, label });
    }
    return out;
  }, [data, hasHeaders, leftToRight, range, t.column, t.row]);

  const newLevel = useCallback(
    (index?: number): LevelState => ({
      id: newId(),
      index: index ?? keys[0]?.index ?? 0,
      sortOn: "value",
      order: "asc",
      customText: "",
      color: "",
      position: "top",
    }),
    [keys]
  );

  const [levels, setLevels] = useState<LevelState[]>(() => {
    const sel = context.luckysheet_select_save?.[0];
    const focus = sel?.column_focus ?? range?.column[0] ?? 0;
    return [
      {
        id: newId(),
        index: range ? _.clamp(focus, range.column[0], range.column[1]) : 0,
        sortOn: "value",
        order: "asc",
        customText: "",
        color: "",
        position: "top",
      },
    ];
  });

  const cfCompute = useMemo(() => getComputeMap(context), [context]);

  const colorsOf = useCallback(
    (index: number, sortOn: "cellColor" | "fontColor") => {
      if (!range || !data) return [];
      const set: string[] = [];
      const [l1, l2] = leftToRight ? range.column : range.row;
      for (let l = l1 + (hasHeaders ? 1 : 0); l <= l2; l += 1) {
        const [r, c] = leftToRight ? [index, l] : [l, index];
        const colors = getCellDisplayColors(data, r, c, cfCompute);
        const color = sortOn === "cellColor" ? colors.bg : colors.fc;
        if (!set.includes(color)) set.push(color);
      }
      return set;
    },
    [cfCompute, data, hasHeaders, leftToRight, range]
  );

  const kindOf = useCallback(
    (index: number) => {
      if (!range || leftToRight) return "text";
      return getFilterColumnKind(
        context,
        index,
        hasHeaders ? range.row[0] : range.row[0] - 1,
        range.row[1]
      );
    },
    [context, hasHeaders, leftToRight, range]
  );

  const updateLevel = (i: number, patch: Partial<LevelState>) => {
    setError("");
    setLevels((prev) =>
      prev.map((l, j) => {
        if (j !== i) return l;
        const next = { ...l, ...patch };
        if ((patch.sortOn || patch.index != null) && next.sortOn !== "value") {
          const colors = colorsOf(next.index, next.sortOn);
          if (!colors.includes(next.color)) next.color = colors[0] ?? "";
        }
        return next;
      })
    );
  };

  const onOk = () => {
    if (!range) return;
    const sortLevels: SortLevel[] = levels.map((l) => {
      const level: SortLevel = { index: l.index, sortOn: l.sortOn };
      if (l.sortOn === "value") {
        if (l.order.startsWith("list:")) {
          level.customList = BUILTIN_CUSTOM_LISTS[Number(l.order.slice(5))];
        } else if (l.order === "custom") {
          level.customList = l.customText
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s !== "");
        } else {
          level.order = l.order as "asc" | "desc";
        }
      } else {
        level.color = l.color;
        level.position = l.position;
      }
      return level;
    });
    // merged cells can't be sorted: report it here, keeping the dialog open
    for (let r = range.row[0]; r <= range.row[1]; r += 1) {
      for (let c = range.column[0]; c <= range.column[1]; c += 1) {
        if (data?.[r]?.[c]?.mc != null) {
          setError(sortLocale.mergeError);
          return;
        }
      }
    }
    setContext((ctx) => {
      sortRange(ctx, {
        range,
        levels: sortLevels,
        hasHeader: hasHeaders,
        orientation: leftToRight ? "columns" : "rows",
        caseSensitive,
      });
    });
    hideDialog();
  };

  const orderOptions = (level: LevelState) => {
    const kind = kindOf(level.index);
    let [asc, desc] = [t.aToZ, t.zToA];
    if (kind === "number")
      [asc, desc] = [t.smallestToLargest, t.largestToSmallest];
    if (kind === "date") [asc, desc] = [t.oldestToNewest, t.newestToOldest];
    return [
      { value: "asc", label: asc },
      { value: "desc", label: desc },
      ...BUILTIN_CUSTOM_LISTS.map((list, i) => ({
        value: `list:${i}`,
        label: `${list.slice(0, 3).join(", ")}, ...`,
      })),
      { value: "custom", label: t.customList },
    ];
  };

  if (!range) return null;

  const move = (from: number, to: number) => {
    if (to < 0 || to >= levels.length) return;
    setLevels((prev) => {
      const next = prev.slice();
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
    setSelected(to);
  };

  const toolButton = (
    label: string,
    onClick: () => void,
    disabled = false,
    icon?: LucideIcon
  ) => (
    <Button
      size="sm"
      className="fortune-dt-icon-button"
      icon={icon}
      disabled={disabled}
      onClick={onClick}
    >
      {label}
    </Button>
  );

  return (
    <DialogShell
      title={t.title}
      className="fortune-dt-dialog fortune-sort-dialog"
      onClose={hideDialog}
      onConfirm={onOk}
      footer={
        <>
          <Button variant="secondary" onClick={hideDialog}>
            {t.cancel}
          </Button>
          <Button variant="primary" onClick={onOk}>
            {t.ok}
          </Button>
        </>
      }
    >
      <div className="fortune-dt-row fortune-sort-toolbar">
        {toolButton(
          t.addLevel,
          () => {
            setLevels((prev) => [...prev, newLevel()]);
            setSelected(levels.length);
          },
          false,
          Plus
        )}
        {toolButton(
          t.deleteLevel,
          () => {
            setLevels((prev) => prev.filter((_l, i) => i !== selected));
            setSelected(Math.max(0, selected - 1));
          },
          levels.length <= 1,
          Trash2
        )}
        {toolButton(
          t.copyLevel,
          () => {
            setLevels((prev) => {
              const next = prev.slice();
              next.splice(selected + 1, 0, {
                ...prev[selected],
                id: newId(),
              });
              return next;
            });
            setSelected(selected + 1);
          },
          false,
          Copy
        )}
        <IconButton
          size="sm"
          icon={ChevronUp}
          label={t.moveUp ?? "Move Up"}
          disabled={selected === 0}
          onClick={() => move(selected, selected - 1)}
        />
        <IconButton
          size="sm"
          icon={ChevronDown}
          label={t.moveDown ?? "Move Down"}
          disabled={selected >= levels.length - 1}
          onClick={() => move(selected, selected + 1)}
        />
        <div style={{ flex: 1 }} />
        <DtCheck
          style={{ margin: 0 }}
          checked={hasHeaders}
          onChange={(v) => setHasHeaders(v)}
        >
          {t.hasHeaders}
        </DtCheck>
      </div>
      <div className="fortune-dt-scroll" style={{ marginTop: 10 }}>
        <table className="fortune-dt-table">
          <thead>
            <tr>
              <th aria-label={t.order} />
              <th>{leftToRight ? t.row : t.column}</th>
              <th>{t.sortOn}</th>
              <th>{t.order}</th>
            </tr>
          </thead>
          <tbody>
            {levels.map((level, i) => (
              <tr
                key={level.id}
                className={i === selected ? "selected" : undefined}
                onMouseDown={() => setSelected(i)}
                onFocus={() => setSelected(i)}
              >
                <td style={{ whiteSpace: "nowrap" }}>
                  {i === 0 ? t.sortBy : t.thenBy}
                </td>
                <td>
                  <select
                    className="fortune-dt-select"
                    aria-label={leftToRight ? t.row : t.column}
                    value={level.index}
                    onChange={(e) =>
                      updateLevel(i, { index: Number(e.target.value) })
                    }
                  >
                    {keys.map((k) => (
                      <option key={k.index} value={k.index}>
                        {k.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <select
                    className="fortune-dt-select"
                    aria-label={t.sortOn}
                    value={level.sortOn}
                    onChange={(e) =>
                      updateLevel(i, {
                        sortOn: e.target.value as LevelState["sortOn"],
                      })
                    }
                  >
                    <option value="value">{t.cellValues}</option>
                    <option value="cellColor">{t.cellColor}</option>
                    <option value="fontColor">{t.fontColor}</option>
                  </select>
                </td>
                <td>
                  {level.sortOn === "value" ? (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                      }}
                    >
                      <select
                        className="fortune-dt-select"
                        aria-label={t.order}
                        value={level.order}
                        onChange={(e) =>
                          updateLevel(i, { order: e.target.value })
                        }
                      >
                        {orderOptions(level).map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      {level.order === "custom" && (
                        <input
                          className="fortune-dt-input"
                          placeholder={t.customListPrompt}
                          aria-label={t.customListPrompt}
                          value={level.customText}
                          onChange={(e) =>
                            updateLevel(i, { customText: e.target.value })
                          }
                        />
                      )}
                    </div>
                  ) : (
                    <div className="fortune-dt-row" style={{ gap: 4 }}>
                      <select
                        className="fortune-dt-select fortune-sort-color-select"
                        aria-label={t.order}
                        value={level.color}
                        style={{
                          background: level.color || undefined,
                          color:
                            level.sortOn === "fontColor"
                              ? level.color
                              : undefined,
                        }}
                        onChange={(e) =>
                          updateLevel(i, { color: e.target.value })
                        }
                      >
                        {colorsOf(level.index, level.sortOn).map((color) => (
                          <option
                            key={color}
                            value={color}
                            style={{ background: color }}
                          >
                            {color}
                          </option>
                        ))}
                      </select>
                      <select
                        className="fortune-dt-select"
                        aria-label={t.order}
                        value={level.position}
                        onChange={(e) =>
                          updateLevel(i, {
                            position: e.target.value as "top" | "bottom",
                          })
                        }
                      >
                        <option value="top">{t.onTop}</option>
                        <option value="bottom">{t.onBottom}</option>
                      </select>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="fortune-dt-row" style={{ marginTop: 10, gap: 16 }}>
        <DtCheck
          style={{ margin: 0 }}
          checked={caseSensitive}
          onChange={(v) => setCaseSensitive(v)}
        >
          {t.caseSensitive}
        </DtCheck>
        <DtCheck
          style={{ margin: 0 }}
          checked={leftToRight}
          onChange={(v) => {
            const ltr = v;
            setLeftToRight(ltr);
            const first = ltr ? range.row[0] : range.column[0];
            setLevels([newLevel(first)]);
            setSelected(0);
            if (ltr) setHasHeaders(false);
          }}
        >
          {t.leftToRight}
        </DtCheck>
      </div>
      {error && (
        <div className="fortune-dt-error" style={{ marginTop: 8 }}>
          {error}
        </div>
      )}
    </DialogShell>
  );
};

export default CustomSort;
