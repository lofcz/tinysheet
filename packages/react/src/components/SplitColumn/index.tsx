import {
  applyTextToColumns,
  dataToolsLocale,
  getcellrange,
  getFlowdata,
  getRangetxt,
  getTextToColumnsSource,
  parseTextToColumns,
  suggestFixedWidthBreaks,
  TextToColumnsFormat,
  TextToColumnsOptions,
} from "@lofcz/tinysheet-core";
import _ from "lodash";
import React, {
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import WorkbookContext from "../../context";
import { useDialog } from "../../hooks/useDialog";
import DtCheck from "../DataVerification/DtCheck";
import "../DataVerification/dataTools.css";
import "./index.css";

const PREVIEW_ROWS = 12;

const FORMAT_OPTIONS: TextToColumnsFormat[] = [
  "general",
  "text",
  "MDY",
  "DMY",
  "YMD",
  "MYD",
  "DYM",
  "YDM",
  "skip",
];

/**
 * Excel's Convert Text to Columns wizard in one dialog: delimited or fixed
 * width, per-column data format, destination and a live preview.
 */
export const SplitColumn: React.FC<{}> = () => {
  const { context, setContext } = useContext(WorkbookContext);
  const { showDialog, hideDialog } = useDialog();
  const t = dataToolsLocale(context).textToColumns;

  const range = useMemo(() => {
    const sel = context.luckysheet_select_save?.[0];
    if (!sel) return null;
    return { row: sel.row.slice(), column: [sel.column[0], sel.column[0]] };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const lines = useMemo(
    () => (range ? getTextToColumnsSource(context, range) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [range]
  );

  const [mode, setMode] = useState<"delimited" | "fixed">(() =>
    lines.some((l) => /[\t;,]/.test(l)) ? "delimited" : "fixed"
  );
  const [delimiters, setDelimiters] = useState({
    tab: true,
    semicolon: false,
    comma: false,
    space: false,
    other: "",
  });
  const [useOther, setUseOther] = useState(false);
  const [consecutive, setConsecutive] = useState(false);
  const [qualifier, setQualifier] = useState('"');
  const [breaks, setBreaks] = useState<number[]>(() =>
    suggestFixedWidthBreaks(lines)
  );
  const [formats, setFormats] = useState<TextToColumnsFormat[]>([]);
  const [destination, setDestination] = useState(() =>
    range
      ? getRangetxt(
          context,
          context.currentSheetId,
          { row: [range.row[0], range.row[0]], column: range.column },
          context.currentSheetId
        )
      : ""
  );
  const [error, setError] = useState("");

  const options: TextToColumnsOptions = useMemo(
    () => ({
      mode,
      delimiters: { ...delimiters, other: useOther ? delimiters.other : "" },
      treatConsecutiveAsOne: consecutive,
      textQualifier: qualifier,
      breaks,
      columnFormats: formats,
    }),
    [breaks, consecutive, delimiters, formats, mode, qualifier, useOther]
  );

  const preview = useMemo(
    () => parseTextToColumns(lines.slice(0, PREVIEW_ROWS), options),
    [lines, options]
  );
  const allRows = useMemo(
    () => parseTextToColumns(lines, options),
    [lines, options]
  );
  const width = _.max(allRows.map((r) => r.length)) ?? 1;

  // fixed width ruler: one character's width in the monospace preview
  const measureRef = useRef<HTMLSpanElement>(null);
  const [charWidth, setCharWidth] = useState(7);
  useLayoutEffect(() => {
    const w = measureRef.current?.getBoundingClientRect().width;
    if (w) setCharWidth(w / 10);
  }, [mode]);
  const maxLen = _.max(lines.map((l) => l.length)) ?? 0;

  const onFinish = useCallback(() => {
    if (!range) return;
    const dest = getcellrange(context, destination.trim());
    if (!dest) {
      setError(t.destination);
      return;
    }
    const target = { r: dest.row[0], c: dest.column[0] };
    const data = getFlowdata(context);
    // the columns written, apart from the source column itself
    const kept = _.range(width).filter(
      (j) => (formats[j] ?? "general") !== "skip"
    ).length;
    let covered = false;
    for (let i = 0; i < allRows.length && !covered; i += 1) {
      for (let j = 0; j < kept; j += 1) {
        const r = target.r + i;
        const c = target.c + j;
        const isSource =
          c === range.column[0] && r >= range.row[0] && r <= range.row[1];
        const cell = data?.[r]?.[c];
        if (!isSource && cell != null && cell.v != null && cell.v !== "") {
          covered = true;
          break;
        }
      }
    }
    const run = () => {
      setContext((ctx) => {
        applyTextToColumns(ctx, range, { ...options, destination: target });
      });
      hideDialog();
    };
    if (covered) {
      showDialog(t.replaceConfirm, "yesno", run);
    } else {
      run();
    }
  }, [
    allRows,
    context,
    destination,
    formats,
    hideDialog,
    options,
    range,
    setContext,
    showDialog,
    t,
    width,
  ]);

  if (!range) return null;

  const formatLabel = (f: TextToColumnsFormat) => {
    if (f === "general" || f === "text" || f === "skip") return t.formats[f];
    return `${t.formats.date} (${f})`;
  };

  return (
    <div id="fortune-split-column" className="fortune-dt-dialog">
      <div className="fortune-dt-title">{t.title}</div>
      <div className="fortune-dt-section">
        <div className="fortune-dt-section-title">{t.dataType}</div>
        {(
          [
            ["delimited", t.delimited, t.delimitedDesc],
            ["fixed", t.fixedWidth, t.fixedWidthDesc],
          ] as const
        ).map(([value, label, desc]) => (
          // oxlint-disable-next-line jsx-a11y/label-has-associated-control -- text is rendered by children
          <label
            key={value}
            className="fortune-dt-check"
            htmlFor={`fortune-ttc-${value}`}
          >
            <input
              id={`fortune-ttc-${value}`}
              type="radio"
              name="fortune-ttc-mode"
              checked={mode === value}
              onChange={() => {
                setMode(value);
                setFormats([]);
              }}
            />
            <span>
              <b>{label}</b>
              <span className="fortune-dt-hint">{` — ${desc}`}</span>
            </span>
          </label>
        ))}
      </div>

      {mode === "delimited" ? (
        <div className="fortune-dt-section">
          <div className="fortune-dt-section-title">{t.delimiters}</div>
          <div className="fortune-dt-row" style={{ flexWrap: "wrap" }}>
            {(["tab", "semicolon", "comma", "space"] as const).map((key) => (
              <DtCheck
                key={key}
                checked={delimiters[key]}
                onChange={(v) => setDelimiters((d) => ({ ...d, [key]: v }))}
              >
                {t[key]}
              </DtCheck>
            ))}
            <DtCheck checked={useOther} onChange={setUseOther}>
              {t.other}
            </DtCheck>
            <input
              className="fortune-dt-input"
              style={{ width: 40, marginBottom: 8 }}
              maxLength={1}
              aria-label={t.other}
              value={delimiters.other}
              onChange={(e) => {
                const other = e.target.value;
                setDelimiters((d) => ({ ...d, other }));
                if (other) setUseOther(true);
              }}
            />
          </div>
          <div className="fortune-dt-row">
            <DtCheck checked={consecutive} onChange={setConsecutive}>
              {t.consecutive}
            </DtCheck>
            <div style={{ flex: 1 }} />
            <label
              className="fortune-dt-label"
              htmlFor="fortune-ttc-qualifier"
              style={{ marginBottom: 8 }}
            >
              {t.qualifier}
            </label>
            <select
              id="fortune-ttc-qualifier"
              className="fortune-dt-select"
              style={{ width: 90, marginBottom: 8 }}
              value={qualifier}
              onChange={(e) => setQualifier(e.target.value)}
            >
              <option value='"'>&quot;</option>
              <option value="'">&apos;</option>
              <option value="">{t.qualifierNone}</option>
            </select>
          </div>
        </div>
      ) : (
        <div className="fortune-dt-section">
          <div className="fortune-dt-hint" style={{ marginBottom: 6 }}>
            {t.breakHint}
          </div>
          <div className="fortune-ttc-fixed">
            <span ref={measureRef} className="fortune-ttc-measure">
              0000000000
            </span>
            <div
              className="fortune-ttc-ruler"
              role="button"
              tabIndex={0}
              aria-label={t.breakHint}
              style={{ width: (maxLen + 2) * charWidth }}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const pos = Math.round((e.clientX - rect.left) / charWidth);
                if (pos <= 0 || pos >= maxLen) return;
                setBreaks((b) =>
                  b.includes(pos)
                    ? b.filter((x) => x !== pos)
                    : [...b, pos].sort((x, y) => x - y)
                );
                setFormats([]);
              }}
            >
              {_.range(0, maxLen + 1, 10).map((p) => (
                <span
                  key={p}
                  className="fortune-ttc-tick"
                  style={{ left: p * charWidth }}
                >
                  {p}
                </span>
              ))}
            </div>
            <div
              className="fortune-ttc-lines"
              style={{ width: (maxLen + 2) * charWidth }}
            >
              {lines.slice(0, PREVIEW_ROWS).map((l, i) => (
                <div key={i} className="fortune-ttc-line">
                  {l || " "}
                </div>
              ))}
              {breaks.map((b) => (
                <div
                  key={b}
                  className="fortune-ttc-break"
                  role="button"
                  tabIndex={0}
                  aria-label={`${b}`}
                  style={{ left: b * charWidth }}
                  onClick={() => {
                    setBreaks((prev) => prev.filter((x) => x !== b));
                    setFormats([]);
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="fortune-dt-section">
        <div className="fortune-dt-section-title">{t.preview}</div>
        <div className="fortune-dt-scroll">
          <table className="fortune-dt-table fortune-ttc-preview">
            <thead>
              <tr>
                {_.range(width).map((j) => (
                  <th key={j}>
                    <select
                      className="fortune-dt-select"
                      aria-label={t.columnFormat}
                      value={formats[j] ?? "general"}
                      onChange={(e) => {
                        const f = e.target.value as TextToColumnsFormat;
                        setFormats((prev) => {
                          const next = prev.slice();
                          for (let k = 0; k <= j; k += 1) {
                            next[k] = next[k] ?? "general";
                          }
                          next[j] = f;
                          return next;
                        });
                      }}
                    >
                      {FORMAT_OPTIONS.map((f) => (
                        <option key={f} value={f}>
                          {formatLabel(f)}
                        </option>
                      ))}
                    </select>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.map((row, i) => (
                <tr key={i}>
                  {_.range(width).map((j) => (
                    <td
                      key={j}
                      className={
                        (formats[j] ?? "general") === "skip"
                          ? "fortune-ttc-skip"
                          : undefined
                      }
                    >
                      {row[j] ?? ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="fortune-dt-field">
        <label className="fortune-dt-label" htmlFor="fortune-ttc-destination">
          {t.destination}
        </label>
        <input
          id="fortune-ttc-destination"
          className="fortune-dt-input"
          spellCheck={false}
          value={destination}
          onChange={(e) => {
            setDestination(e.target.value);
            setError("");
          }}
        />
      </div>
      {error && <div className="fortune-dt-error">{error}</div>}
      <div
        className="fortune-dt-buttons"
        style={{ justifyContent: "flex-end" }}
      >
        <div
          className="button-basic button-primary"
          role="button"
          tabIndex={0}
          onClick={onFinish}
        >
          {t.ok}
        </div>
        <div
          className="button-basic button-default"
          role="button"
          tabIndex={0}
          onClick={hideDialog}
        >
          {t.cancel}
        </div>
      </div>
    </div>
  );
};
