import React, {
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  MARGIN_PRESETS,
  PAPER_SIZES,
  PageSetup,
  PrintScope,
  buildPrintJob,
  getPageSetup,
  locale,
  printJob,
  renderPrintPage,
  resolvePageSetup,
  setShowPageBreaks,
  updatePageSetup,
} from "@lofcz/tinysheet-core";
import _ from "lodash";
import WorkbookContext from "../../context";
import SVGIcon from "../SVGIcon";
import {
  PrintIcon,
  formatText,
  usePageLayoutText,
  useRawContext,
} from "./shared";

type Scaling = "none" | "fitSheet" | "fitColumns" | "fitRows" | "custom";

function scalingOf(setup: PageSetup): Scaling {
  const r = resolvePageSetup(setup);
  if (!r.fitToPage) return r.scale === 100 ? "none" : "custom";
  if (r.fitToWidth === 1 && r.fitToHeight === 1) return "fitSheet";
  if (r.fitToWidth === 1 && r.fitToHeight === 0) return "fitColumns";
  if (r.fitToWidth === 0 && r.fitToHeight === 1) return "fitRows";
  return "custom";
}

const SCALING_SETUP: Record<Exclude<Scaling, "custom">, Partial<PageSetup>> = {
  none: { fitToPage: false, scale: undefined },
  fitSheet: { fitToPage: true, fitToWidth: 1, fitToHeight: 1 },
  fitColumns: { fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  fitRows: { fitToPage: true, fitToWidth: 0, fitToHeight: 1 },
};

function marginsKey(setup: PageSetup) {
  const m = resolvePageSetup(setup).margins;
  const hit = (
    Object.keys(MARGIN_PRESETS) as (keyof typeof MARGIN_PRESETS)[]
  ).find((k) => _.isEqual(MARGIN_PRESETS[k], m));
  return hit ?? "custom";
}

type Props = {
  onClose: () => void;
  onPageSetup: () => void;
  /** File name for &F in headers and footers. */
  fileName?: string;
};

/**
 * File > Print: the print settings next to a preview of the printed pages,
 * then the browser's print dialog (which can also save a PDF).
 */
const PrintPreview: React.FC<Props> = ({ onClose, onPageSetup, fileName }) => {
  const { context, setContext, settings } = useContext(WorkbookContext);
  const raw = useRawContext();
  const t = usePageLayoutText();
  const { button } = locale(context);
  const uid = useId();
  const [scope, setScope] = useState<PrintScope>("sheet");
  const [ignoreArea, setIgnoreArea] = useState(false);
  const [index, setIndex] = useState(0);
  const [fit, setFit] = useState(true);
  const [stage, setStage] = useState({ width: 0, height: 0 });
  const stageRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const sheets = context.luckysheetfile;
  const sheetId = context.currentSheetId;
  const selection = context.luckysheet_select_save;
  const job = useMemo(
    () =>
      buildPrintJob(raw(), {
        scope,
        ignorePrintArea: ignoreArea,
        fileName,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sheets, sheetId, selection, scope, ignoreArea, fileName]
  );
  const count = job.pages.length;
  const current = Math.min(index, Math.max(0, count - 1));
  const page = job.pages[current];
  const paper = page?.layout.paper ?? { width: 816, height: 1056 };
  const setup = getPageSetup(context);
  const r = resolvePageSetup(setup);

  useEffect(() => {
    dialogRef.current?.querySelector<HTMLElement>(".fortune-pp-print")?.focus();
  }, []);

  // Excel shows the automatic page breaks once a sheet was previewed.
  useEffect(() => {
    if (settings.showPageBreaksAfterPrint === false) return;
    setContext((ctx) => setShowPageBreaks(ctx, true), { noHistory: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetId]);

  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return undefined;
    const measure = () =>
      setStage({ width: el.clientWidth, height: el.clientHeight });
    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const zoom = fit
    ? Math.max(
        0.1,
        Math.min(
          (stage.width - 32) / paper.width,
          (stage.height - 32) / paper.height,
          2
        )
      ) || 1
    : 1;

  useEffect(() => {
    const holder = pageRef.current;
    if (!holder) return;
    holder.replaceChildren();
    if (!page) return;
    const ratio =
      (typeof window !== "undefined" ? window.devicePixelRatio : 1) || 1;
    const el = renderPrintPage(raw(), job, current, {
      pixelRatio: Math.min(3, Math.max(1, ratio * zoom)),
    });
    holder.appendChild(el);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job, current, Math.round(zoom * 4)]);

  const update = (patch: Partial<PageSetup>) =>
    setContext((ctx) => updatePageSetup(ctx, patch));

  const print = () => {
    const ctx = raw();
    const quality = resolvePageSetup(getPageSetup(ctx)).printQuality;
    printJob(ctx, job, {
      pixelRatio: quality ? Math.min(4, Math.max(1, quality / 96)) : 2,
    });
  };

  const go = (i: number) => setIndex(_.clamp(i, 0, Math.max(0, count - 1)));
  const scaling = scalingOf(setup);

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      ref={dialogRef}
      className="fortune-dialog fortune-print-preview"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${uid}-title`}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onClose();
        } else if (e.key === "PageDown") {
          e.preventDefault();
          go(current + 1);
        } else if (e.key === "PageUp") {
          e.preventDefault();
          go(current - 1);
        }
      }}
    >
      <div className="fortune-fc-header">
        <div id={`${uid}-title`} className="dialog-title">
          {t.printTitle}
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
      <div className="fortune-pp-body">
        <div className="fortune-pp-settings">
          <button
            type="button"
            className="button-basic button-primary fortune-pp-print"
            onClick={print}
            disabled={count === 0}
          >
            <PrintIcon />
            <span>{t.printButton}</span>
          </button>
          <div className="fortune-pp-label">{t.settings}</div>
          <select
            aria-label={t.settings}
            value={scope}
            onChange={(e) => {
              setScope(e.target.value as PrintScope);
              setIndex(0);
            }}
          >
            <option value="sheet">{t.printActiveSheet}</option>
            <option value="workbook">{t.printEntireWorkbook}</option>
            <option value="selection">{t.printSelection}</option>
          </select>
          <label className="fortune-ps-check" htmlFor={`${uid}-ignore`}>
            <input
              id={`${uid}-ignore`}
              type="checkbox"
              checked={ignoreArea}
              disabled={scope === "selection"}
              onChange={(e) => setIgnoreArea(e.target.checked)}
            />
            <span>{t.ignorePrintArea}</span>
          </label>
          <select
            aria-label={t.orientation}
            value={r.orientation}
            onChange={(e) =>
              update({ orientation: e.target.value as "portrait" })
            }
          >
            <option value="portrait">{t.portrait}</option>
            <option value="landscape">{t.landscape}</option>
          </select>
          <select
            aria-label={t.size}
            value={r.paperSize}
            onChange={(e) => update({ paperSize: e.target.value as any })}
          >
            {PAPER_SIZES.map((p) => (
              <option key={p.id} value={p.id}>
                {`${p.id.charAt(0).toUpperCase()}${p.id.slice(1)} (${p.label})`}
              </option>
            ))}
          </select>
          <select
            aria-label={t.margins}
            value={marginsKey(setup)}
            onChange={(e) => {
              const key = e.target.value as keyof typeof MARGIN_PRESETS;
              if (MARGIN_PRESETS[key]) {
                update({ margins: { ...MARGIN_PRESETS[key] } });
              }
            }}
          >
            {Object.keys(MARGIN_PRESETS).map((k) => (
              <option key={k} value={k}>
                {`${t.margins}: ${t.marginPresets[k]}`}
              </option>
            ))}
            {marginsKey(setup) === "custom" && (
              <option value="custom">{`${t.margins}: …`}</option>
            )}
          </select>
          <select
            aria-label={t.scaling}
            value={scaling}
            onChange={(e) => {
              const key = e.target.value as Scaling;
              if (key === "custom") onPageSetup();
              else update(SCALING_SETUP[key]);
            }}
          >
            <option value="none">{t.noScaling}</option>
            <option value="fitSheet">{t.fitSheet}</option>
            <option value="fitColumns">{t.fitColumns}</option>
            <option value="fitRows">{t.fitRows}</option>
            <option value="custom">
              {scaling === "custom" && !r.fitToPage
                ? `${t.customScaling} (${r.scale}%)`
                : t.customScaling}
            </option>
          </select>
          <button
            type="button"
            className="fortune-pp-link"
            onClick={onPageSetup}
          >
            {t.pageSetup}
          </button>
          <div className="fortune-ps-muted fortune-pp-hint">{t.pdfHint}</div>
        </div>
        <div className="fortune-pp-preview">
          <div className="fortune-pp-stage" ref={stageRef}>
            {count === 0 ? (
              <div className="fortune-pp-empty">{t.noPages}</div>
            ) : (
              <div
                className="fortune-pp-sheet"
                style={{
                  width: paper.width * zoom,
                  height: paper.height * zoom,
                }}
              >
                <div
                  ref={pageRef}
                  className="fortune-pp-page"
                  style={{
                    width: paper.width,
                    height: paper.height,
                    transform: `scale(${zoom})`,
                  }}
                />
              </div>
            )}
          </div>
          <div className="fortune-pp-nav">
            <button
              type="button"
              className="fortune-pp-nav-button"
              aria-label={t.previousPage}
              title={t.previousPage}
              disabled={current <= 0}
              onClick={() => go(current - 1)}
            >
              ‹
            </button>
            <label className="fortune-pp-page-of" htmlFor={`${uid}-page`}>
              <input
                id={`${uid}-page`}
                type="number"
                min={1}
                max={Math.max(1, count)}
                value={count === 0 ? 0 : current + 1}
                onChange={(e) => go(Number(e.target.value) - 1)}
              />
              <span>
                {formatText(t.pageOf, { page: "", pages: count }).trim()}
              </span>
            </label>
            <button
              type="button"
              className="fortune-pp-nav-button"
              aria-label={t.nextPage}
              title={t.nextPage}
              disabled={current >= count - 1}
              onClick={() => go(current + 1)}
            >
              ›
            </button>
            <span className="fortune-name-manager-spacer" />
            <label className="fortune-ps-check" htmlFor={`${uid}-fit`}>
              <input
                id={`${uid}-fit`}
                type="checkbox"
                checked={fit}
                onChange={(e) => setFit(e.target.checked)}
              />
              <span>{t.zoomToPage}</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrintPreview;
