import React, { useContext, useEffect, useId, useRef, useState } from "react";
import {
  HEADER_FOOTER_PRESETS,
  HeaderFooterText,
  MARGIN_PRESETS,
  PAPER_SIZES,
  PageMargins,
  PageSetup,
  getPageSetup,
  headerFooterPlainText,
  locale,
  parsePrintRanges,
  parseTitleColumns,
  parseTitleRows,
  printRangesToText,
  resolvePageSetup,
  setPageSetup,
  titleColumnsToText,
  titleRowsToText,
} from "@lofcz/tinysheet-core";
import WorkbookContext from "../../context";
import SVGIcon from "../SVGIcon";
import { formatText, usePageLayoutText } from "./shared";

export type PageSetupTab = "page" | "margins" | "headerFooter" | "sheet";

const TABS: PageSetupTab[] = ["page", "margins", "headerFooter", "sheet"];

type HFKey =
  | "header"
  | "footer"
  | "firstHeader"
  | "firstFooter"
  | "evenHeader"
  | "evenFooter";

const CODES: { key: string; code: string; label?: string }[] = [
  { key: "page", code: "&P" },
  { key: "pages", code: "&N" },
  { key: "date", code: "&D" },
  { key: "time", code: "&T" },
  { key: "path", code: "&Z&F" },
  { key: "file", code: "&F" },
  { key: "sheet", code: "&A" },
  { key: "bold", code: "&B", label: "B" },
  { key: "italic", code: "&I", label: "I" },
  { key: "underline", code: "&U", label: "U" },
];

const SECTIONS = ["left", "center", "right"] as const;

function sameHF(a: HeaderFooterText = {}, b: HeaderFooterText = {}) {
  return (
    (a.left ?? "") === (b.left ?? "") &&
    (a.center ?? "") === (b.center ?? "") &&
    (a.right ?? "") === (b.right ?? "")
  );
}

type Props = {
  onClose: () => void;
  /** Shows a "Print Preview" button that applies the setup and opens it. */
  onPrintPreview?: () => void;
  initialTab?: PageSetupTab;
};

/** Page Layout > Page Setup dialog (Page, Margins, Header/Footer, Sheet). */
const PageSetupDialog: React.FC<Props> = ({
  onClose,
  onPrintPreview,
  initialTab = "page",
}) => {
  const { context, setContext } = useContext(WorkbookContext);
  const t = usePageLayoutText();
  const { button } = locale(context);
  const uid = useId();
  const [tab, setTab] = useState<PageSetupTab>(initialTab);
  const [draft, setDraft] = useState<PageSetup>(() => ({
    ...getPageSetup(context),
  }));
  const [areaText, setAreaText] = useState(() =>
    printRangesToText(draft.printArea)
  );
  const [rowsText, setRowsText] = useState(() =>
    titleRowsToText(draft.printTitleRows)
  );
  const [colsText, setColsText] = useState(() =>
    titleColumnsToText(draft.printTitleColumns)
  );
  const [hfTarget, setHfTarget] = useState<HFKey>("header");
  const [focusSection, setFocusSection] =
    useState<(typeof SECTIONS)[number]>("center");
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const r = resolvePageSetup(draft);
  const set = (patch: Partial<PageSetup>) =>
    setDraft((d) => ({ ...d, ...patch }));
  const setMargin = (key: keyof PageMargins, value: number) =>
    set({ margins: { ...r.margins, [key]: value } });

  useEffect(() => {
    dialogRef.current
      ?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')
      ?.focus();
  }, []);

  const sheetName =
    context.luckysheetfile.find((s) => s.id === context.currentSheetId)?.name ??
    "";
  const sample = (text?: string) =>
    headerFooterPlainText(text, {
      page: 1,
      pages: 1,
      sheetName,
      fileName: "Book1",
    });

  const apply = () => {
    const area = parsePrintRanges(areaText);
    const rows = parseTitleRows(rowsText);
    const cols = parseTitleColumns(colsText);
    const bad =
      (area == null && areaText) ||
      (rows === null && rowsText) ||
      (cols === null && colsText);
    if (bad) {
      setTab("sheet");
      setError(formatText(t.invalidReference, { ref: bad }));
      return false;
    }
    setContext((ctx) => {
      setPageSetup(ctx, {
        ...draft,
        printArea: area?.length ? area : undefined,
        printTitleRows: rows ?? undefined,
        printTitleColumns: cols ?? undefined,
      });
    });
    return true;
  };

  const number = (
    id: string,
    label: string,
    value: number,
    onChange: (v: number) => void,
    opts: { min?: number; max?: number; step?: number } = {}
  ) => (
    <label className="fortune-ps-field" htmlFor={`${uid}-${id}`}>
      <span>{label}</span>
      <input
        id={`${uid}-${id}`}
        type="number"
        value={Number.isFinite(value) ? value : ""}
        min={opts.min}
        max={opts.max}
        step={opts.step ?? 1}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (Number.isFinite(v)) onChange(v);
        }}
      />
    </label>
  );

  const check = (
    id: string,
    label: string,
    checked: boolean,
    onChange: (v: boolean) => void
  ) => (
    <label className="fortune-ps-check" htmlFor={`${uid}-${id}`}>
      <input
        id={`${uid}-${id}`}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );

  const radio = (
    name: string,
    value: string,
    label: string,
    checked: boolean,
    onChange: () => void
  ) => (
    <label className="fortune-ps-check" htmlFor={`${uid}-${name}-${value}`}>
      <input
        id={`${uid}-${name}-${value}`}
        type="radio"
        name={`${uid}-${name}`}
        checked={checked}
        onChange={onChange}
      />
      <span>{label}</span>
    </label>
  );

  let body: React.ReactNode = null;
  if (tab === "page") {
    body = (
      <>
        <fieldset className="fortune-ps-group">
          <legend>{t.orientation}</legend>
          <div className="fortune-ps-row">
            {radio(
              "orientation",
              "portrait",
              t.portrait,
              r.orientation === "portrait",
              () => set({ orientation: "portrait" })
            )}
            {radio(
              "orientation",
              "landscape",
              t.landscape,
              r.orientation === "landscape",
              () => set({ orientation: "landscape" })
            )}
          </div>
        </fieldset>
        <fieldset className="fortune-ps-group">
          <legend>{t.scaling}</legend>
          <div className="fortune-ps-row">
            {radio("scaling", "adjust", t.adjustTo, !r.fitToPage, () =>
              set({ fitToPage: false })
            )}
            {number(
              "scale",
              "",
              r.scale,
              (v) => set({ scale: v, fitToPage: false }),
              { min: 10, max: 400 }
            )}
            <span>{t.normalSize}</span>
          </div>
          <div className="fortune-ps-row">
            {radio("scaling", "fit", t.fitTo, r.fitToPage, () =>
              set({ fitToPage: true })
            )}
            {number(
              "fitWidth",
              "",
              r.fitToWidth,
              (v) => set({ fitToWidth: Math.max(0, v), fitToPage: true }),
              { min: 0 }
            )}
            <span>{t.pagesWide}</span>
            {number(
              "fitHeight",
              "",
              r.fitToHeight,
              (v) => set({ fitToHeight: Math.max(0, v), fitToPage: true }),
              { min: 0 }
            )}
            <span>{t.tall}</span>
            <span className="fortune-ps-muted">{t.fitAuto}</span>
          </div>
        </fieldset>
        <label className="fortune-ps-field" htmlFor={`${uid}-paper`}>
          <span>{t.paperSize}</span>
          <select
            id={`${uid}-paper`}
            value={r.paperSize}
            onChange={(e) => set({ paperSize: e.target.value as any })}
          >
            {PAPER_SIZES.map((p) => (
              <option key={p.id} value={p.id}>
                {`${p.id.charAt(0).toUpperCase()}${p.id.slice(1)} (${p.label})`}
              </option>
            ))}
          </select>
        </label>
        <label className="fortune-ps-field" htmlFor={`${uid}-quality`}>
          <span>{t.printQuality}</span>
          <select
            id={`${uid}-quality`}
            value={r.printQuality ?? ""}
            onChange={(e) =>
              set({
                printQuality: e.target.value
                  ? Number(e.target.value)
                  : undefined,
              })
            }
          >
            <option value="">{t.auto}</option>
            {[150, 300, 600].map((dpi) => (
              <option key={dpi} value={dpi}>
                {`${dpi} dpi`}
              </option>
            ))}
          </select>
        </label>
        <label className="fortune-ps-field" htmlFor={`${uid}-first`}>
          <span>{t.firstPageNumber}</span>
          <input
            id={`${uid}-first`}
            type="text"
            value={draft.firstPageNumber ?? t.auto}
            onFocus={(e) => e.target.select()}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              set({ firstPageNumber: Number.isFinite(v) ? v : undefined });
            }}
          />
        </label>
      </>
    );
  } else if (tab === "margins") {
    body = (
      <>
        <div className="fortune-ps-row fortune-ps-presets">
          {(Object.keys(MARGIN_PRESETS) as (keyof typeof MARGIN_PRESETS)[]).map(
            (key) => (
              <button
                type="button"
                key={key}
                className="button-basic button-default"
                onClick={() => set({ margins: { ...MARGIN_PRESETS[key] } })}
              >
                {t.marginPresets[key]}
              </button>
            )
          )}
        </div>
        <div className="fortune-ps-margins">
          <div className="fortune-ps-margin-grid">
            {number("mtop", t.top, r.margins.top, (v) => setMargin("top", v), {
              min: 0,
              step: 0.05,
            })}
            {number(
              "mheader",
              t.header,
              r.margins.header,
              (v) => setMargin("header", v),
              { min: 0, step: 0.05 }
            )}
            {number(
              "mleft",
              t.left,
              r.margins.left,
              (v) => setMargin("left", v),
              { min: 0, step: 0.05 }
            )}
            {number(
              "mright",
              t.right,
              r.margins.right,
              (v) => setMargin("right", v),
              { min: 0, step: 0.05 }
            )}
            {number(
              "mbottom",
              t.bottom,
              r.margins.bottom,
              (v) => setMargin("bottom", v),
              { min: 0, step: 0.05 }
            )}
            {number(
              "mfooter",
              t.footer,
              r.margins.footer,
              (v) => setMargin("footer", v),
              { min: 0, step: 0.05 }
            )}
          </div>
          <div
            className={`fortune-ps-paper${
              r.orientation === "landscape" ? " landscape" : ""
            }`}
            aria-hidden="true"
          >
            <div
              className="fortune-ps-paper-content"
              style={{
                left: `${(r.margins.left / 8.5) * 100}%`,
                right: `${(r.margins.right / 8.5) * 100}%`,
                top: `${(r.margins.top / 11) * 100}%`,
                bottom: `${(r.margins.bottom / 11) * 100}%`,
                justifyContent: r.centerHorizontally ? "center" : "flex-start",
                alignItems: r.centerVertically ? "center" : "flex-start",
              }}
            >
              <div className="fortune-ps-paper-cells" />
            </div>
          </div>
        </div>
        <div className="fortune-ps-muted">{t.inches}</div>
        <fieldset className="fortune-ps-group">
          <legend>{t.centerOnPage}</legend>
          <div className="fortune-ps-row">
            {check("hcenter", t.horizontally, r.centerHorizontally, (v) =>
              set({ centerHorizontally: v })
            )}
            {check("vcenter", t.vertically, r.centerVertically, (v) =>
              set({ centerVertically: v })
            )}
          </div>
        </fieldset>
      </>
    );
  } else if (tab === "headerFooter") {
    const targets: HFKey[] = ["header", "footer"];
    if (r.differentOddEven) targets.push("evenHeader", "evenFooter");
    if (r.differentFirst) targets.push("firstHeader", "firstFooter");
    const target = targets.includes(hfTarget) ? hfTarget : "header";
    const value: HeaderFooterText = (draft[target] as HeaderFooterText) ?? {};
    const setValue = (next: HeaderFooterText) =>
      set({ [target]: next } as Partial<PageSetup>);
    const insert = (code: string) => {
      const el = sectionRefs.current[focusSection];
      const text = value[focusSection] ?? "";
      const start = el?.selectionStart ?? text.length;
      const end = el?.selectionEnd ?? text.length;
      setValue({
        ...value,
        [focusSection]: text.slice(0, start) + code + text.slice(end),
      });
      requestAnimationFrame(() => {
        el?.focus();
        el?.setSelectionRange(start + code.length, start + code.length);
      });
    };
    const targetLabel = (key: HFKey) => {
      const base = key.toLowerCase().endsWith("header")
        ? t.customHeader
        : t.customFooter;
      if (key.startsWith("even")) return `${base} (${t.evenPages})`;
      if (key.startsWith("first")) return `${base} (${t.firstPage})`;
      return base;
    };
    const preset = HEADER_FOOTER_PRESETS.findIndex((p) =>
      sameHF(p.value, value)
    );
    body = (
      <>
        {(["header", "footer"] as const).map((key) => (
          <div className="fortune-ps-hf-preview" key={key}>
            <div className="fortune-ps-label">
              {key === "header" ? t.header : t.footer}
            </div>
            <div className="fortune-ps-hf-box">
              {SECTIONS.map((s) => (
                <span key={s} className={`fortune-ps-hf-${s}`}>
                  {sample(r[key][s])}
                </span>
              ))}
            </div>
          </div>
        ))}
        <div className="fortune-ps-row">
          <label className="fortune-ps-field" htmlFor={`${uid}-hf-target`}>
            <span>{t.editing}</span>
            <select
              id={`${uid}-hf-target`}
              value={target}
              onChange={(e) => setHfTarget(e.target.value as HFKey)}
            >
              {targets.map((key) => (
                <option key={key} value={key}>
                  {targetLabel(key)}
                </option>
              ))}
            </select>
          </label>
          <select
            aria-label={targetLabel(target)}
            value={preset >= 0 ? preset : ""}
            onChange={(e) => {
              const p = HEADER_FOOTER_PRESETS[Number(e.target.value)];
              if (p) setValue({ ...p.value });
            }}
          >
            {preset < 0 && <option value="">…</option>}
            {HEADER_FOOTER_PRESETS.map((p, i) => (
              <option key={p.key} value={i}>
                {p.key === "none"
                  ? t.presetNone
                  : SECTIONS.map((s) => sample(p.value[s]))
                      .filter(Boolean)
                      .join(", ")}
              </option>
            ))}
          </select>
        </div>
        <div
          className="fortune-ps-codes"
          role="toolbar"
          aria-label={t.insertCode}
        >
          <span>{t.insertCode}</span>
          {CODES.map((c) => (
            <button
              type="button"
              key={c.key}
              className="fortune-ps-code"
              title={`${t.codes[c.key]} (${c.code})`}
              aria-label={t.codes[c.key]}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insert(c.code)}
            >
              {c.label ?? t.codes[c.key]}
            </button>
          ))}
        </div>
        <div className="fortune-ps-sections">
          {SECTIONS.map((s) => {
            const label = {
              left: t.leftSection,
              center: t.centerSection,
              right: t.rightSection,
            }[s];
            return (
              <label key={s} htmlFor={`${uid}-sec-${s}`}>
                <span>{label}</span>
                <textarea
                  id={`${uid}-sec-${s}`}
                  ref={(el) => {
                    sectionRefs.current[s] = el;
                  }}
                  value={value[s] ?? ""}
                  onFocus={() => setFocusSection(s)}
                  onChange={(e) => setValue({ ...value, [s]: e.target.value })}
                />
              </label>
            );
          })}
        </div>
        <div className="fortune-ps-row fortune-ps-wrap">
          {check("oddEven", t.differentOddEven, r.differentOddEven, (v) =>
            set({ differentOddEven: v })
          )}
          {check("first", t.differentFirst, r.differentFirst, (v) =>
            set({ differentFirst: v })
          )}
          {check("scaleDoc", t.scaleWithDoc, r.scaleWithDoc, (v) =>
            set({ scaleWithDoc: v })
          )}
          {check("alignMargins", t.alignWithMargins, r.alignWithMargins, (v) =>
            set({ alignWithMargins: v })
          )}
        </div>
      </>
    );
  } else {
    body = (
      <>
        <label className="fortune-ps-field" htmlFor={`${uid}-area`}>
          <span>{t.printAreaLabel}</span>
          <input
            id={`${uid}-area`}
            type="text"
            className="fortune-ps-ref"
            value={areaText}
            placeholder="$A$1:$H$40"
            onChange={(e) => {
              setAreaText(e.target.value);
              setError(null);
            }}
          />
        </label>
        <fieldset className="fortune-ps-group">
          <legend>{t.printTitlesLabel}</legend>
          <label className="fortune-ps-field" htmlFor={`${uid}-rows`}>
            <span>{t.rowsToRepeat}</span>
            <input
              id={`${uid}-rows`}
              type="text"
              className="fortune-ps-ref"
              value={rowsText}
              placeholder="$1:$1"
              onChange={(e) => {
                setRowsText(e.target.value);
                setError(null);
              }}
            />
          </label>
          <label className="fortune-ps-field" htmlFor={`${uid}-cols`}>
            <span>{t.columnsToRepeat}</span>
            <input
              id={`${uid}-cols`}
              type="text"
              className="fortune-ps-ref"
              value={colsText}
              placeholder="$A:$A"
              onChange={(e) => {
                setColsText(e.target.value);
                setError(null);
              }}
            />
          </label>
        </fieldset>
        {error && (
          <div className="fortune-ps-error" role="alert">
            {error}
          </div>
        )}
        <fieldset className="fortune-ps-group">
          <legend>{t.printLabel}</legend>
          <div className="fortune-ps-columns">
            <div>
              {check("grid", t.gridlines, r.gridLines, (v) =>
                set({ gridLines: v })
              )}
              {check("bw", t.blackAndWhite, r.blackAndWhite, (v) =>
                set({ blackAndWhite: v })
              )}
              {check("draft", t.draftQuality, r.draft, (v) =>
                set({ draft: v })
              )}
              {check("headings", t.headings, r.headings, (v) =>
                set({ headings: v })
              )}
            </div>
            <div>
              <label className="fortune-ps-field" htmlFor={`${uid}-comments`}>
                <span>{t.comments}</span>
                <select
                  id={`${uid}-comments`}
                  value={r.comments}
                  onChange={(e) => set({ comments: e.target.value as any })}
                >
                  {Object.entries(t.commentsOptions).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="fortune-ps-field" htmlFor={`${uid}-errors`}>
                <span>{t.cellErrors}</span>
                <select
                  id={`${uid}-errors`}
                  value={r.cellErrors}
                  onChange={(e) => set({ cellErrors: e.target.value as any })}
                >
                  {Object.entries(t.cellErrorsOptions).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </fieldset>
        <fieldset className="fortune-ps-group">
          <legend>{t.pageOrder}</legend>
          <div className="fortune-ps-row">
            {radio(
              "order",
              "down",
              t.downThenOver,
              r.pageOrder === "downThenOver",
              () => set({ pageOrder: "downThenOver" })
            )}
            {radio(
              "order",
              "over",
              t.overThenDown,
              r.pageOrder === "overThenDown",
              () => set({ pageOrder: "overThenDown" })
            )}
          </div>
        </fieldset>
      </>
    );
  }

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      ref={dialogRef}
      className="fortune-dialog fortune-page-setup"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${uid}-title`}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <div className="fortune-fc-header">
        <div id={`${uid}-title`} className="dialog-title">
          {t.pageSetupTitle}
        </div>
        <button
          type="button"
          className="fortune-fc-close"
          aria-label={button.close}
          title={button.close}
          onClick={onClose}
        >
          <SVGIcon name="close" />
        </button>
      </div>
      <div
        className="fortune-fc-tabs"
        role="tablist"
        aria-label={t.pageSetupTitle}
        onKeyDown={(e) => {
          const i = TABS.indexOf(tab);
          let next = -1;
          if (e.key === "ArrowRight") next = (i + 1) % TABS.length;
          if (e.key === "ArrowLeft") next = (i + TABS.length - 1) % TABS.length;
          if (next >= 0) {
            e.preventDefault();
            setTab(TABS[next]);
            (e.currentTarget.children[next] as HTMLElement)?.focus();
          }
        }}
      >
        {TABS.map((key) => (
          <button
            type="button"
            key={key}
            role="tab"
            id={`${uid}-tab-${key}`}
            aria-selected={key === tab}
            aria-controls={`${uid}-panel`}
            tabIndex={key === tab ? 0 : -1}
            className={`fortune-fc-tab${key === tab ? " active" : ""}`}
            onClick={() => setTab(key)}
          >
            {t.tabs[key]}
          </button>
        ))}
      </div>
      <div
        id={`${uid}-panel`}
        className="fortune-fc-panel fortune-ps-panel"
        role="tabpanel"
        aria-labelledby={`${uid}-tab-${tab}`}
      >
        {body}
      </div>
      <div className="fortune-dialog-box-button-container">
        {onPrintPreview && (
          <button
            type="button"
            className="fortune-message-box-button button-basic button-default fortune-ps-preview"
            onClick={() => {
              if (apply()) onPrintPreview();
            }}
          >
            {t.printPreview.replace(/…$/, "")}
          </button>
        )}
        <button
          type="button"
          className="fortune-message-box-button button-basic button-primary"
          onClick={() => {
            if (apply()) onClose();
          }}
        >
          {t.ok}
        </button>
        <button
          type="button"
          className="fortune-message-box-button button-basic button-default"
          onClick={onClose}
        >
          {t.cancel}
        </button>
      </div>
    </div>
  );
};

export default PageSetupDialog;
