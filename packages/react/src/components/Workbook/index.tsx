import {
  defaultContext,
  defaultSettings,
  Settings,
  Context,
  initSheetIndex,
  CellWithRowAndCol,
  GlobalCache,
  Sheet as SheetType,
  handleGlobalKeyDown,
  getRowColShortcutOp,
  applyRowColShortcutOp,
  getSheetIndex,
  handlePaste,
  patchToOp,
  Op,
  ensureSheetIndex,
  CellMatrix,
  insertRowCol,
  locale,
  groupValuesRefresh,
  setFormulaCellInfoMap,
  expandCellData,
  mirrorGroupedSheetEdits,
  produceWithHistory,
  popHistoryGroup,
  applyUndoSteps,
  applyRedoSteps,
  beginUndoGroup,
} from "@lofcz/tinysheet-core";
import React, {
  useMemo,
  useState,
  useCallback,
  useEffect,
  useRef,
  useImperativeHandle,
  useLayoutEffect,
} from "react";
import "./index.css";
import { enablePatches, Patch } from "immer";
import _ from "lodash";
import Sheet from "../Sheet";
import { RefValues, SetContextOptions } from "../../context";
import {
  TrackedScope,
  WorkbookApi,
  WorkbookProvider,
  WorkbookStore,
} from "../../context/store";
import Toolbar from "../Toolbar";
import FxEditor from "../FxEditor";
import SheetTab from "../SheetTab";
import ContextMenu from "../ContextMenu";
import SVGDefines from "../SVGDefines";
import SheetTabContextMenu from "../ContextMenu/SheetTab";
import DataToolsLayer from "../DataVerification/DataToolsLayer";
import MoreItemsContaier from "../Toolbar/MoreItemsContainer";
import { generateAPIs } from "./api";
import { ModalProvider } from "../../context/modal";
import FilterMenu from "../ContextMenu/FilterMenu";
import FormatCells from "../FormatCells";
import SheetList from "../SheetList";
import StatusBar from "../StatusBar";
import { useResolvedTheme } from "../../hooks/useResolvedTheme";

enablePatches();

// Prop-less children as constant elements: React skips them when the
// Workbook re-renders, and the TrackedScope around each re-renders them only
// for the context fields they read.
const FX_EDITOR = <FxEditor />;
const SHEET_TAB = <SheetTab />;
const SHEET_LIST = <SheetList />;
const CONTEXT_MENU = <ContextMenu />;
const FILTER_MENU = <FilterMenu />;
const SHEET_TAB_CONTEXT_MENU = <SheetTabContextMenu />;
const DATA_TOOLS_LAYER = <DataToolsLayer />;
const FORMAT_CELLS = <FormatCells />;
const STATUS_BAR = <StatusBar />;

export type WorkbookInstance = ReturnType<typeof generateAPIs>;

type AdditionalProps = {
  onChange?: (data: SheetType[]) => void;
  onOp?: (op: Op[]) => void;
};

/** Run `cb` when the browser is idle (after paint); returns a canceller. */
function scheduleIdle(cb: () => void) {
  const w: any = typeof window !== "undefined" ? window : undefined;
  if (w?.requestIdleCallback) {
    const id = w.requestIdleCallback(cb, { timeout: 500 });
    return () => w.cancelIdleCallback(id);
  }
  const id = setTimeout(cb, 1);
  return () => clearTimeout(id);
}

const triggerGroupValuesRefresh = (ctx: Context) => {
  if (ctx.groupValuesRefreshData.length > 0) {
    groupValuesRefresh(ctx);
  }
};

const concatProducer = (...producers: ((ctx: Context) => void)[]) => {
  return (ctx: Context) => {
    producers.forEach((producer) => {
      producer(ctx);
    });
  };
};

function shallowEqualProps(
  a: Record<string, unknown> | null,
  b: Record<string, unknown>
) {
  if (!a) return false;
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every(
    (k) => Object.prototype.hasOwnProperty.call(b, k) && Object.is(a[k], b[k])
  );
}

const Workbook = React.forwardRef<WorkbookInstance, Settings & AdditionalProps>(
  ({ onChange, onOp, data: originalData, ...props }, ref) => {
    const globalCache = useRef<GlobalCache>({ undoList: [], redoList: [] });
    const cellInput = useRef<HTMLDivElement>(null);
    const fxInput = useRef<HTMLDivElement>(null);
    const canvas = useRef<HTMLCanvasElement>(null);
    const scrollbarX = useRef<HTMLDivElement>(null);
    const scrollbarY = useRef<HTMLDivElement>(null);
    const cellArea = useRef<HTMLDivElement>(null);
    const workbookContainer = useRef<HTMLDivElement>(null);

    const refs: RefValues = useMemo(
      () => ({
        globalCache: globalCache.current,
        cellInput,
        fxInput,
        canvas,
        scrollbarX,
        scrollbarY,
        cellArea,
        workbookContainer,
      }),
      []
    );

    // Lazy initializer: defaultContext builds a FormulaCache (and with it a
    // Chevrotain parser), which is far too expensive to evaluate and throw
    // away on every Workbook render.
    const [context, setContext] = useState(() => defaultContext(refs));
    const { info } = locale(context);

    const [moreToolbarItems, setMoreToolbarItems] =
      useState<React.ReactNode>(null);

    // Recompute when any prop changes, including props added or removed after
    // mount (a values-array dependency list would change length and be
    // ignored by React).
    const settingsProps = useRef<typeof props | null>(null);
    const settingsVersion = useRef(0);
    if (!shallowEqualProps(settingsProps.current, props)) {
      settingsProps.current = props;
      settingsVersion.current += 1;
    }
    const mergedSettings = useMemo(
      () => _.assign(_.cloneDeep(defaultSettings), props) as Required<Settings>,
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [settingsVersion.current]
    );

    // Keep hooks on a ref so selection / settings effects do not re-subscribe
    // (or re-run the heavy sheet init) when the parent passes a new hooks
    // object identity with the same callbacks.
    const hooksRef = useRef(mergedSettings.hooks);
    hooksRef.current = mergedSettings.hooks;

    // Expands a sheet's celldata into its data matrix (see expandCellData:
    // frozen rows keep immer from walking every cell on the next produce).
    const initSheetData = useCallback(
      (
        draftCtx: Context,
        newData: SheetType,
        index: number
      ): CellMatrix | null => {
        const expandedData = expandCellData(
          newData,
          draftCtx.defaultrowNum,
          draftCtx.defaultcolumnNum
        );
        const target = draftCtx.luckysheetfile[index];
        target.data = expandedData;
        delete target.celldata;
        return expandedData;
      },
      []
    );

    const emitOp = useCallback(
      (
        ctx: Context,
        patches: Patch[],
        options?: SetContextOptions,
        undo: boolean = false
      ) => {
        if (onOp) {
          onOp(patchToOp(ctx, patches, options, undo));
        }
      },
      [onOp]
    );

    const setContextWithProduce = useCallback(
      (recipe: (ctx: Context) => void, options: SetContextOptions = {}) => {
        // the undo group is read now: React may run the updater later
        const group = globalCache.current.undoGroup?.id;
        setContext((ctx_) => {
          const { result, recorded } = produceWithHistory(
            ctx_,
            concatProducer(
              recipe,
              // grouped sheets: repeat the edit on every grouped sheet
              (draft) => mirrorGroupedSheetEdits(ctx_, draft),
              triggerGroupValuesRefresh
            ),
            options,
            globalCache.current,
            group
          );
          if (recorded) emitOp(result, recorded.patches, recorded.options);
          return result;
        });
      },
      [emitOp]
    );

    const handleUndo = useCallback(() => {
      // the lists are updated here, not in the updater (which React may call
      // more than once)
      const steps = popHistoryGroup(globalCache.current.undoList);
      if (steps.length === 0) return;
      globalCache.current.redoList.push(...steps);
      setContext((ctx_) => {
        const step = applyUndoSteps(ctx_, steps);
        step.applied.forEach(({ patches, options }) => {
          emitOp(step.context, patches, options, true);
        });
        return step.context;
      });
    }, [emitOp]);

    const handleRedo = useCallback(() => {
      const steps = popHistoryGroup(globalCache.current.redoList);
      if (steps.length === 0) return;
      globalCache.current.undoList.push(...steps);
      setContext((ctx_) => {
        const step = applyRedoSteps(ctx_, steps);
        step.applied.forEach(({ patches, options }) => {
          emitOp(step.context, patches, options);
        });
        return step.context;
      });
    }, [emitOp]);

    useEffect(() => {
      if (context.luckysheet_select_save != null) {
        hooksRef.current?.afterSelectionChange?.(
          context.currentSheetId,
          context.luckysheet_select_save[0]
        );
      }
    }, [context.currentSheetId, context.luckysheet_select_save]);

    // Sync hooks onto context without re-running the full sheet-init effect.
    useEffect(() => {
      setContextWithProduce(
        (draftCtx) => {
          if (draftCtx.hooks === hooksRef.current) return;
          draftCtx.hooks = hooksRef.current;
        },
        { noHistory: true }
      );
    }, [mergedSettings.hooks, setContextWithProduce]);

    const workbookApi: WorkbookApi = useMemo(
      () => ({
        setContext: setContextWithProduce,
        settings: mergedSettings,
        handleUndo,
        handleRedo,
        refs,
      }),
      [handleRedo, handleUndo, mergedSettings, refs, setContextWithProduce]
    );
    const providerValue = useMemo(
      () => ({ context, ...workbookApi }),
      [context, workbookApi]
    );

    // Components below a TrackedScope subscribe to this store and re-render
    // only for the context fields they read (the Workbook itself, the Sheet
    // canvas and unscoped consumers still see every update).
    const storeRef = useRef<WorkbookStore | null>(null);
    if (storeRef.current == null) {
      storeRef.current = new WorkbookStore(context, workbookApi);
    }
    const store = storeRef.current;
    store.update(context, workbookApi);
    useLayoutEffect(() => {
      store.emit();
    });

    useEffect(() => {
      if (!_.isEmpty(context.luckysheetfile)) {
        onChange?.(context.luckysheetfile);
      }
    }, [context.luckysheetfile, onChange]);

    useEffect(() => {
      setContextWithProduce(
        (draftCtx) => {
          draftCtx.defaultcolumnNum = mergedSettings.column;
          draftCtx.defaultrowNum = mergedSettings.row;
          draftCtx.defaultFontSize = mergedSettings.defaultFontSize;
          if (_.isEmpty(draftCtx.luckysheetfile)) {
            // Shallow copies: ensureSheetIndex fills in ids and status.
            // (Running it through produce would deep-freeze every cell of
            // every sheet, which dominated load time for big workbooks.)
            const newData = originalData.map((sheet) => ({ ...sheet }));
            ensureSheetIndex(newData, mergedSettings.generateSheetId);
            newData.forEach((sheet) => {
              // pending sheets keep their celldata until expanded; a frozen
              // copy spares immer from walking it
              if (sheet.celldata && _.isEmpty(sheet.data)) {
                sheet.celldata = Object.freeze(
                  sheet.celldata.slice()
                ) as CellWithRowAndCol[];
              }
            });
            draftCtx.luckysheetfile = newData;
            // Only the sheet shown first is expanded here, below; the others
            // are expanded after the first paint (see expandPendingSheets).
          }
          if (mergedSettings.devicePixelRatio > 0) {
            draftCtx.devicePixelRatio = mergedSettings.devicePixelRatio;
          }
          draftCtx.lang = mergedSettings.lang;
          draftCtx.allowEdit = mergedSettings.allowEdit;
          // hooks synced in a dedicated effect — avoid re-init on hooks identity churn
          draftCtx.hooks = hooksRef.current;
          // draftCtx.fontList = mergedSettings.fontList;
          if (_.isEmpty(draftCtx.currentSheetId)) {
            initSheetIndex(draftCtx);
          }
          let sheetIdx = getSheetIndex(draftCtx, draftCtx.currentSheetId);
          if (sheetIdx == null) {
            if ((draftCtx.luckysheetfile?.length ?? 0) > 0) {
              sheetIdx = 0;
              draftCtx.currentSheetId = draftCtx.luckysheetfile[0].id!;
            }
          }
          if (sheetIdx == null) return;

          const sheet = draftCtx.luckysheetfile?.[sheetIdx];
          if (!sheet) return;

          let { data } = sheet;
          // expand cell data
          if (_.isEmpty(data)) {
            const temp = initSheetData(draftCtx, sheet, sheetIdx);
            if (!_.isNull(temp)) {
              data = temp;
            }
            setFormulaCellInfoMap(draftCtx, sheet.calcChain, data);
          }

          if (
            _.isEmpty(draftCtx.luckysheet_select_save) &&
            !_.isEmpty(sheet.luckysheet_select_save)
          ) {
            draftCtx.luckysheet_select_save = sheet.luckysheet_select_save;
          }
          if (draftCtx.luckysheet_select_save?.length === 0) {
            if (
              data?.[0]?.[0]?.mc &&
              !_.isNil(data?.[0]?.[0]?.mc?.rs) &&
              !_.isNil(data?.[0]?.[0]?.mc?.cs)
            ) {
              draftCtx.luckysheet_select_save = [
                {
                  row: [0, data[0][0].mc.rs - 1],
                  column: [0, data[0][0].mc.cs - 1],
                },
              ];
            } else {
              draftCtx.luckysheet_select_save = [
                {
                  row: [0, 0],
                  column: [0, 0],
                },
              ];
            }
          }

          draftCtx.config = _.isNil(sheet.config) ? {} : sheet.config;
          draftCtx.insertedImgs = sheet.images;
          draftCtx.currency = mergedSettings.currency || "¥";

          draftCtx.zoomRatio = _.isNil(sheet.zoomRatio) ? 1 : sheet.zoomRatio;
          draftCtx.rowHeaderWidth =
            mergedSettings.rowHeaderWidth * draftCtx.zoomRatio;
          draftCtx.columnHeaderHeight =
            mergedSettings.columnHeaderHeight * draftCtx.zoomRatio;

          if (!_.isNil(sheet.defaultRowHeight)) {
            draftCtx.defaultrowlen = Number(sheet.defaultRowHeight);
          } else {
            draftCtx.defaultrowlen = mergedSettings.defaultRowHeight;
          }

          if (!_.isNil(sheet.addRows)) {
            draftCtx.addDefaultRows = Number(sheet.addRows);
          } else {
            draftCtx.addDefaultRows = mergedSettings.addRows;
          }

          if (!_.isNil(sheet.defaultColWidth)) {
            draftCtx.defaultcollen = Number(sheet.defaultColWidth);
          } else {
            draftCtx.defaultcollen = mergedSettings.defaultColWidth;
          }

          if (!_.isNil(sheet.showGridLines)) {
            const { showGridLines } = sheet;
            if (showGridLines === 0 || showGridLines === false) {
              draftCtx.showGridLines = false;
            } else {
              draftCtx.showGridLines = true;
            }
          } else {
            draftCtx.showGridLines = true;
          }
          if (_.isNil(mergedSettings.lang)) {
            const lang =
              (navigator.languages && navigator.languages[0]) || // 兼容chromium内核浏览器
              navigator.language || // 兼容剩余浏览器
              // @ts-ignore
              navigator.userLanguage; // 兼容IE浏览器
            draftCtx.lang = lang;
          }
        },
        { noHistory: true }
      );
    }, [
      context.currentSheetId,
      context.luckysheetfile.length,
      originalData,
      mergedSettings.defaultRowHeight,
      mergedSettings.defaultColWidth,
      mergedSettings.column,
      mergedSettings.row,
      mergedSettings.defaultFontSize,
      mergedSettings.devicePixelRatio,
      mergedSettings.lang,
      mergedSettings.allowEdit,
      mergedSettings.generateSheetId,
      setContextWithProduce,
      initSheetData,
      mergedSettings.rowHeaderWidth,
      mergedSettings.columnHeaderHeight,
      mergedSettings.addRows,
      mergedSettings.currency,
    ]);

    // Sheets other than the one shown are expanded from celldata after the
    // first paint, one per idle slot, so opening a big multi-sheet workbook
    // does not wait for sheets nobody is looking at yet.
    const pendingSheets = context.luckysheetfile.reduce(
      (n, s) =>
        s.id !== context.currentSheetId && _.isEmpty(s.data) ? n + 1 : n,
      0
    );
    useEffect(() => {
      if (pendingSheets === 0) return undefined;
      return scheduleIdle(() => {
        setContextWithProduce(
          (draftCtx) => {
            const files = draftCtx.luckysheetfile;
            const idx = files.findIndex(
              (s) => s.id !== draftCtx.currentSheetId && _.isEmpty(s.data)
            );
            if (idx < 0) return;
            const sheet = files[idx];
            const data = initSheetData(draftCtx, sheet, idx);
            setFormulaCellInfoMap(draftCtx, sheet.calcChain, data ?? undefined);
          },
          { noHistory: true }
        );
      });
    }, [pendingSheets, initSheetData, setContextWithProduce]);

    // Colour theme: resolved here so the canvas (ctx.theme) and the CSS
    // tokens (data-theme on the root) always agree. Layout effect so the
    // first painted frame already uses the right palette.
    const resolvedTheme = useResolvedTheme(mergedSettings.theme);
    useLayoutEffect(() => {
      setContextWithProduce(
        (draftCtx) => {
          draftCtx.theme = resolvedTheme;
        },
        { noHistory: true }
      );
    }, [resolvedTheme, setContextWithProduce]);

    const onKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLDivElement>) => {
        const { nativeEvent } = e;
        // handling undo and redo ahead because handleUndo and handleRedo
        // themselves are calling setContext, and should not be nested
        // in setContextWithProduce. While a cell is being edited the editor
        // undoes its own typing, like Excel.
        const editing = context.luckysheetCellUpdate.length > 0;
        if (!editing && (e.ctrlKey || e.metaKey) && e.code === "KeyZ") {
          if (e.shiftKey) {
            handleRedo();
          } else {
            handleUndo();
          }
          e.stopPropagation();
          return;
        }
        if (!editing && (e.ctrlKey || e.metaKey) && e.code === "KeyY") {
          handleRedo();
          e.stopPropagation();
          e.preventDefault();
          return;
        }
        // Ctrl+- / Ctrl++ on whole rows/columns: run as a row/column op so
        // undo and collaboration see it
        const rowColOp = getRowColShortcutOp(
          context,
          nativeEvent,
          cellInput.current,
          fxInput.current
        );
        if (rowColOp) {
          e.preventDefault();
          e.stopPropagation();
          setContextWithProduce((draftCtx) => {
            applyRowColShortcutOp(draftCtx, rowColOp);
          }, rowColOp);
          return;
        }
        setContextWithProduce((draftCtx) => {
          handleGlobalKeyDown(
            draftCtx,
            cellInput.current!,
            fxInput.current!,
            nativeEvent,
            globalCache.current!,
            handleUndo, // still passing handleUndo and handleRedo here to satisfy API
            handleRedo,
            canvas.current!.getContext("2d")!
          );
        });
      },
      [context, handleRedo, handleUndo, setContextWithProduce]
    );

    const onPaste = useCallback(
      (e: ClipboardEvent) => {
        // deal with multi instance case, only the focused sheet handles the paste
        if (
          cellInput.current === document.activeElement ||
          document.activeElement?.className === "fortune-sheet-overlay"
        ) {
          let { clipboardData } = e;
          if (!clipboardData) {
            // @ts-ignore
            // for IE
            clipboardData = window.clipboardData;
          }
          const txtdata =
            clipboardData!.getData("text/html") ||
            clipboardData!.getData("text/plain");
          const ele = document.createElement("div");
          ele.innerHTML = txtdata;

          const trList = ele.querySelectorAll("table tr");
          const maxRow =
            trList.length + context.luckysheet_select_save![0].row[0];
          const rowToBeAdded =
            maxRow -
            context.luckysheetfile[
              getSheetIndex(
                context,
                context!.currentSheetId! as string
              ) as number
            ].data!.length;
          const range = context.luckysheet_select_save;
          // growing the sheet and pasting are one undo step
          const endUndoGroup = beginUndoGroup(globalCache.current);
          if (rowToBeAdded > 0) {
            const insertRowColOp: SetContextOptions["insertRowColOp"] = {
              type: "row",
              index:
                context.luckysheetfile[
                  getSheetIndex(
                    context,
                    context!.currentSheetId! as string
                  ) as number
                ].data!.length - 1,
              count: rowToBeAdded,
              direction: "rightbottom",
              id: context.currentSheetId,
            };
            setContextWithProduce(
              (draftCtx) => {
                insertRowCol(draftCtx, insertRowColOp);
                draftCtx.luckysheet_select_save = range;
              },
              {
                insertRowColOp,
              }
            );
          }
          setContextWithProduce((draftCtx) => {
            try {
              handlePaste(draftCtx, e);
            } catch (err: any) {
              console.error(err);
            }
          });
          endUndoGroup();
        }
      },
      [context, setContextWithProduce]
    );

    const onMoreToolbarItemsClose = useCallback(() => {
      setMoreToolbarItems(null);
    }, []);

    useEffect(() => {
      document.addEventListener("paste", onPaste);
      return () => {
        document.removeEventListener("paste", onPaste);
      };
    }, [onPaste]);

    // expose APIs
    useImperativeHandle(
      ref,
      () =>
        generateAPIs(
          context,
          setContextWithProduce,
          handleUndo,
          handleRedo,
          mergedSettings,
          cellInput.current,
          scrollbarX.current,
          scrollbarY.current
        ),
      [context, setContextWithProduce, handleUndo, handleRedo, mergedSettings]
    );

    // ~1300 lines of static SVG symbols: keep the element identity stable so
    // React skips it on every context change.
    const svgDefines = useMemo(
      () => <SVGDefines currency={mergedSettings.currency} />,
      [mergedSettings.currency]
    );

    // Stable elements, each in its own TrackedScope: a Workbook render (on
    // every context change) skips them, and each re-renders only when the
    // context fields it reads change.
    const moreItemsOpen = moreToolbarItems !== null;
    const toolbar = useMemo(
      () => (
        <Toolbar
          moreItemsOpen={moreItemsOpen}
          setMoreItems={setMoreToolbarItems}
        />
      ),
      [moreItemsOpen]
    );
    const moreItems = useMemo(
      () =>
        moreToolbarItems && (
          <MoreItemsContaier onClose={onMoreToolbarItemsClose}>
            {moreToolbarItems}
          </MoreItemsContaier>
        ),
      [moreToolbarItems, onMoreToolbarItemsClose]
    );

    const i = getSheetIndex(context, context.currentSheetId);
    if (i == null) {
      return null;
    }
    const sheet = context.luckysheetfile?.[i];
    if (!sheet) {
      return null;
    }

    return (
      <WorkbookProvider store={store} value={providerValue}>
        <ModalProvider>
          <div
            className="fortune-container"
            data-theme={resolvedTheme}
            ref={workbookContainer}
            onKeyDown={onKeyDown}
          >
            <section
              aria-labelledby="shortcuts-heading"
              id="shortcut-list"
              className="sr-only"
              tabIndex={0}
              aria-live="polite"
            >
              <h2 id="shortcuts-heading">{info.shortcuts}</h2>
              <ul>
                <li>{info.toggleSheetFocusShortcut}</li>
                <li>{info.selectRangeShortcut}</li>
                <li>{info.autoFillDownShortcut}</li>
                <li>{info.autoFillRightShortcut}</li>
                <li>{info.boldTextShortcut}</li>
                <li>{info.copyShortcut}</li>
                <li>{info.pasteShortcut}</li>
                <li>{info.undoShortcut}</li>
                <li>{info.redoShortcut}</li>
                <li>{info.deleteCellContentShortcut}</li>
                <li>{info.confirmCellEditShortcut}</li>
                <li>{info.moveRightShortcut}</li>
                <li>{info.moveLeftShortcut}</li>
              </ul>
            </section>
            {svgDefines}
            <div className="fortune-workarea">
              {mergedSettings.showToolbar && (
                <TrackedScope>{toolbar}</TrackedScope>
              )}
              {mergedSettings.showFormulaBar && (
                <TrackedScope>{FX_EDITOR}</TrackedScope>
              )}
            </div>
            <Sheet sheet={sheet} />
            {mergedSettings.showSheetTabs && (
              <TrackedScope>{SHEET_TAB}</TrackedScope>
            )}
            <TrackedScope>{CONTEXT_MENU}</TrackedScope>
            <TrackedScope>{FILTER_MENU}</TrackedScope>
            <TrackedScope>{DATA_TOOLS_LAYER}</TrackedScope>
            <TrackedScope>{SHEET_TAB_CONTEXT_MENU}</TrackedScope>
            {context.formatCellsDialog && (
              <TrackedScope>{FORMAT_CELLS}</TrackedScope>
            )}
            {context.showSheetList && <TrackedScope>{SHEET_LIST}</TrackedScope>}
            {moreItems && <TrackedScope>{moreItems}</TrackedScope>}
            {!_.isEmpty(context.contextMenu) && (
              <div
                onMouseDown={() => {
                  setContextWithProduce((draftCtx) => {
                    draftCtx.contextMenu = {};
                    draftCtx.filterContextMenu = undefined;
                    draftCtx.showSheetList = undefined;
                  });
                }}
                onMouseMove={(e) => e.stopPropagation()}
                onMouseUp={(e) => e.stopPropagation()}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                className="fortune-popover-backdrop"
              />
            )}
            {mergedSettings.showStatsBar && (
              <TrackedScope>{STATUS_BAR}</TrackedScope>
            )}
          </div>
        </ModalProvider>
      </WorkbookProvider>
    );
  }
);

export default Workbook;
