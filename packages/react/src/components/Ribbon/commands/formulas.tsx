/**
 * Formulas tab: Function Library (Insert Function, AutoSum, Recently Used,
 * the category drop-downs), Defined Names (Name Manager, Define Name, Use
 * in Formula, Create from Selection), Formula Auditing and Calculation.
 * The logic lives in core and in the FormulaAuditing / NameManager
 * features; these are the ribbon's buttons for it.
 */
import React, { useContext, useMemo } from "react";
import {
  autoSelectionFormula,
  calculateNow,
  calculateSheet,
  cellAddress,
  FunctionListEntry,
  formulaAuditLocale,
  getCalcSettings,
  getCellError,
  getCircularReferences,
  getDefinedNames,
  getFlowdata,
  isAllowEdit,
  isShowFormulas,
  locale,
  selectRangesOnSheet,
  setCalcSettings,
  sheetNameById,
  activeCell,
} from "@lofcz/tinysheet-core";
import type { CalcMode } from "@lofcz/tinysheet-core";
import {
  ArrowRightFromLine,
  ArrowRightToLine,
  CalendarClock,
  Calculator,
  Code,
  Eraser,
  GitBranch,
  History,
  Landmark,
  LibraryBig,
  Pi,
  RefreshCw,
  ScanEye,
  SearchCode,
  Sheet,
  Sigma,
  SquareFunction,
  TableProperties,
  Tag,
  Tags,
  TextSearch,
  TriangleAlert,
  Type,
  Variable,
} from "lucide-react";
import WorkbookContext from "../../../context";
import { MenuItem } from "../../ui";
import type { RibbonCommandProps } from "../registry";
import { shortcutText, useRibbonCommandHelpers } from "./helpers";
import type { RibbonCommandHelpers } from "./helpers";
import { RibbonButton, useFdrText, useNotify } from "./kit";
import {
  FunctionCategory,
  FunctionMenu,
  functionsOf,
  insertIntoFormula,
  rememberEditorCaret,
  useInsertFunctionDialog,
  useRecentFunctions,
} from "./functions";
import {
  runEvaluateFormula,
  runRemoveArrows,
  runToggleShowFormulas,
  runToggleWatchWindow,
  runTraceDependents,
  runTracePrecedents,
  runCalcOptions,
} from "../../FormulaAuditing/actions";
import type { AuditHelpers } from "../../FormulaAuditing/actions";
import { ErrorCheckingOptionsDialog } from "../../FormulaAuditing/Dialogs";
import { NameManager } from "../../NameManager";

/** Keeps the cell editor's caret when a Function Library button is pressed. */
const KeepCaret: React.FC<{
  h: RibbonCommandHelpers;
  children: React.ReactNode;
}> = ({ h, children }) => (
  // eslint-disable-next-line jsx-a11y/no-static-element-interactions
  <div
    className="fortune-ribbon-contents"
    onPointerDownCapture={() => rememberEditorCaret(h.refs.cellInput.current)}
  >
    {children}
  </div>
);

function useAudit(h: RibbonCommandHelpers): AuditHelpers {
  const notify = useNotify();
  return useMemo(
    () => ({
      context: h.context,
      setContext: h.setContext,
      showDialog: h.showDialog,
      showMessage: notify,
    }),
    [h.context, h.setContext, h.showDialog, notify]
  );
}

/* ------------------------------------------------------------------ */
/*  Function Library                                                   */
/* ------------------------------------------------------------------ */

export const InsertFunctionCommand: React.FC<RibbonCommandProps> = ({
  size,
}) => {
  const h = useRibbonCommandHelpers();
  const t = useFdrText();
  const open = useInsertFunctionDialog(h, t);
  return (
    <KeepCaret h={h}>
      <RibbonButton
        size={size}
        icon={SquareFunction}
        label={t.formulas.insertFunction}
        shortcut={shortcutText(t.formulas.insertFunctionShortcut)}
        description={t.formulas.insertFunctionTip}
        disabled={h.context.allowEdit === false}
        onClick={() => open()}
      />
    </KeepCaret>
  );
};

export const AutoSumCommand: React.FC<RibbonCommandProps> = ({ size }) => {
  const h = useRibbonCommandHelpers();
  const t = useFdrText();
  const open = useInsertFunctionDialog(h, t);
  const run = (fn: string) => {
    const input = h.refs.cellInput.current;
    if (!input) return;
    h.setContext((ctx) => {
      autoSelectionFormula(
        ctx,
        input,
        h.refs.fxInput.current,
        fn,
        h.refs.globalCache
      );
    });
  };
  const f = t.formulas;
  const menu: MenuItem[] = [
    {
      id: "SUM",
      label: f.sum,
      icon: Sigma,
      hint: "SUM",
      onSelect: () => run("SUM"),
    },
    {
      id: "AVERAGE",
      label: f.average,
      hint: "AVERAGE",
      onSelect: () => run("AVERAGE"),
    },
    {
      id: "COUNT",
      label: f.countNumbers,
      hint: "COUNT",
      onSelect: () => run("COUNT"),
    },
    { id: "MAX", label: f.max, hint: "MAX", onSelect: () => run("MAX") },
    { id: "MIN", label: f.min, hint: "MIN", onSelect: () => run("MIN") },
    { type: "separator" },
    {
      id: "more",
      label: f.moreFunctions,
      icon: SquareFunction,
      onSelect: () => open("all"),
    },
  ];
  return (
    <RibbonButton
      size={size}
      small="labeled"
      icon={Sigma}
      label={f.autoSum}
      shortcut={shortcutText(f.autoSumShortcut)}
      description={f.autoSumTip}
      disabled={h.context.allowEdit === false}
      onClick={() => run("SUM")}
      menu={menu}
    />
  );
};

const CATEGORY_ICONS: Record<
  string,
  React.ComponentProps<typeof RibbonButton>["icon"]
> = {
  financial: Landmark,
  logical: GitBranch,
  text: Type,
  dateTime: CalendarClock,
  lookup: TextSearch,
  math: Pi,
};

/** A category drop-down (Financial, Logical, …, Recently Used, More). */
const FunctionCategoryButton: React.FC<{
  size: RibbonCommandProps["size"];
  small: "labeled" | "icon";
  icon: React.ComponentProps<typeof RibbonButton>["icon"];
  label: string;
  description: string;
  functions: FunctionListEntry[];
  submenus?: { id: string; label: string; functions: FunctionListEntry[] }[];
  dialogCategory: Parameters<ReturnType<typeof useInsertFunctionDialog>>[0];
}> = ({
  size,
  small,
  icon,
  label,
  description,
  functions,
  submenus,
  dialogCategory,
}) => {
  const h = useRibbonCommandHelpers();
  const t = useFdrText();
  const open = useInsertFunctionDialog(h, t);
  return (
    <KeepCaret h={h}>
      <RibbonButton
        size={size}
        small={small}
        icon={icon}
        label={label}
        description={description}
        disabled={h.context.allowEdit === false}
        popover={(close) => (
          <FunctionMenu
            functions={functions}
            submenus={submenus}
            label={t.formulas.functionsLabel.replace("{category}", label)}
            hint={t.formulas.functionHint}
            moreLabel={t.formulas.insertFunctionMenu}
            close={close}
            autoFocus
            onPick={(name) => {
              close();
              insertIntoFormula(h, name);
            }}
            onMore={() => {
              close();
              open(dialogCategory);
            }}
          />
        )}
      />
    </KeepCaret>
  );
};

/** One category button per id: functions-financial, functions-logical, … */
export function functionCategoryCommand(
  category: Extract<
    FunctionCategory,
    "financial" | "logical" | "text" | "dateTime" | "lookup" | "math"
  >,
  largeByDefault: boolean
): React.FC<RibbonCommandProps> {
  const Command: React.FC<RibbonCommandProps> = ({ size }) => {
    const { context } = useContext(WorkbookContext);
    const t = useFdrText();
    const { functionlist } = locale(context);
    const functions = useMemo(
      () => functionsOf(functionlist, category),
      [functionlist]
    );
    return (
      <FunctionCategoryButton
        size={size}
        small={largeByDefault ? "icon" : "labeled"}
        icon={CATEGORY_ICONS[category]}
        label={t.formulas[category]}
        description={(t.formulas as Record<string, string>)[`${category}Tip`]}
        functions={functions}
        dialogCategory={category}
      />
    );
  };
  Command.displayName = `FunctionCategory(${category})`;
  return Command;
}

export const RecentlyUsedCommand: React.FC<RibbonCommandProps> = ({ size }) => {
  const { context } = useContext(WorkbookContext);
  const t = useFdrText();
  const { functionlist } = locale(context);
  const functions = useRecentFunctions(functionlist);
  return (
    <FunctionCategoryButton
      size={size}
      small="icon"
      icon={History}
      label={t.formulas.recentlyUsed}
      description={t.formulas.recentlyUsedTip}
      functions={functions}
      dialogCategory="recent"
    />
  );
};

export const MoreFunctionsCommand: React.FC<RibbonCommandProps> = ({
  size,
}) => {
  const { context } = useContext(WorkbookContext);
  const t = useFdrText();
  const { functionlist } = locale(context);
  const submenus = useMemo(
    () =>
      (
        [
          "statistical",
          "engineering",
          "information",
          "compatibility",
          "web",
        ] as const
      )
        .map((id) => ({
          id,
          label: t.formulas[id],
          functions: functionsOf(functionlist, id),
        }))
        .filter((s) => s.functions.length > 0),
    [functionlist, t]
  );
  return (
    <FunctionCategoryButton
      size={size}
      small="labeled"
      icon={LibraryBig}
      label={t.formulas.more}
      description={t.formulas.moreTip}
      functions={[]}
      submenus={submenus}
      dialogCategory="all"
    />
  );
};

/* ------------------------------------------------------------------ */
/*  Defined Names                                                      */
/* ------------------------------------------------------------------ */

export const NameManagerCommand: React.FC<RibbonCommandProps> = ({ size }) => {
  const h = useRibbonCommandHelpers();
  const t = useFdrText();
  const { definedNames } = locale(h.context);
  return (
    <RibbonButton
      size={size}
      icon={Tags}
      label={definedNames.nameManager}
      shortcut={shortcutText(t.formulas.nameManagerShortcut)}
      description={t.formulas.nameManagerTip}
      onClick={() => h.showDialog(<NameManager />)}
    />
  );
};

export const DefineNameCommand: React.FC<RibbonCommandProps> = ({ size }) => {
  const h = useRibbonCommandHelpers();
  const t = useFdrText();
  const editable = h.context.allowEdit !== false;
  return (
    <RibbonButton
      size={size}
      small="labeled"
      icon={Tag}
      label={t.formulas.defineName}
      description={t.formulas.defineNameTip}
      disabled={!editable}
      onClick={() => h.showDialog(<NameManager initialMode="newName" />)}
    />
  );
};

export const UseInFormulaCommand: React.FC<RibbonCommandProps> = ({ size }) => {
  const h = useRibbonCommandHelpers();
  const t = useFdrText();
  const sheetId = h.context.currentSheetId;
  const names = getDefinedNames(h.context)
    .filter((n) => !n.hidden && (n.scope == null || n.scope === sheetId))
    .sort((a, b) => a.name.localeCompare(b.name));
  const menu: MenuItem[] = names.length
    ? names.map((n) => ({
        id: `name:${n.scope ?? ""}:${n.name}`,
        label: n.name,
        hint:
          n.scope != null
            ? (sheetNameById(h.context, n.scope) ?? undefined)
            : undefined,
        onSelect: () => insertIntoFormula(h, n.name, ""),
      }))
    : [{ id: "none", label: t.formulas.noNames, disabled: true }];
  return (
    <KeepCaret h={h}>
      <RibbonButton
        size={size}
        small="labeled"
        icon={Variable}
        label={t.formulas.useInFormula}
        description={t.formulas.useInFormulaTip}
        disabled={h.context.allowEdit === false}
        menu={menu}
      />
    </KeepCaret>
  );
};

export const CreateFromSelectionCommand: React.FC<RibbonCommandProps> = ({
  size,
}) => {
  const h = useRibbonCommandHelpers();
  const t = useFdrText();
  return (
    <RibbonButton
      size={size}
      small="labeled"
      icon={TableProperties}
      label={t.formulas.createFromSelection}
      shortcut={shortcutText(t.formulas.createFromSelectionShortcut)}
      description={t.formulas.createFromSelectionTip}
      disabled={h.context.allowEdit === false}
      onClick={() => h.showDialog(<NameManager initialMode="fromSelection" />)}
    />
  );
};

/* ------------------------------------------------------------------ */
/*  Formula Auditing                                                   */
/* ------------------------------------------------------------------ */

export const TracePrecedentsCommand: React.FC<RibbonCommandProps> = ({
  size,
}) => {
  const h = useRibbonCommandHelpers();
  const a = useAudit(h);
  const t = formulaAuditLocale(h.context).auditing;
  const tips = useFdrText().formulas;
  return (
    <RibbonButton
      size={size}
      small="labeled"
      icon={ArrowRightToLine}
      label={t.tracePrecedents}
      description={tips.tracePrecedentsTip}
      onClick={() => runTracePrecedents(a)}
    />
  );
};

export const TraceDependentsCommand: React.FC<RibbonCommandProps> = ({
  size,
}) => {
  const h = useRibbonCommandHelpers();
  const a = useAudit(h);
  const t = formulaAuditLocale(h.context).auditing;
  const tips = useFdrText().formulas;
  return (
    <RibbonButton
      size={size}
      small="labeled"
      icon={ArrowRightFromLine}
      label={t.traceDependents}
      description={tips.traceDependentsTip}
      onClick={() => runTraceDependents(a)}
    />
  );
};

export const RemoveArrowsCommand: React.FC<RibbonCommandProps> = ({ size }) => {
  const h = useRibbonCommandHelpers();
  const a = useAudit(h);
  const t = formulaAuditLocale(h.context).auditing;
  const tips = useFdrText().formulas;
  const has = !!h.context.traceArrows;
  return (
    <RibbonButton
      size={size}
      small="labeled"
      icon={Eraser}
      label={t.removeArrows}
      description={tips.removeArrowsTip}
      disabled={!has}
      onClick={() => runRemoveArrows(a)}
      menu={[
        {
          id: "all",
          label: t.removeArrows,
          icon: Eraser,
          onSelect: () => runRemoveArrows(a),
        },
        {
          id: "precedent",
          label: t.removePrecedentArrows,
          icon: ArrowRightToLine,
          onSelect: () => runRemoveArrows(a, "precedent"),
        },
        {
          id: "dependent",
          label: t.removeDependentArrows,
          icon: ArrowRightFromLine,
          onSelect: () => runRemoveArrows(a, "dependent"),
        },
      ]}
    />
  );
};

export const ShowFormulasCommand: React.FC<RibbonCommandProps> = ({ size }) => {
  const h = useRibbonCommandHelpers();
  const a = useAudit(h);
  const t = formulaAuditLocale(h.context).auditing;
  const f = useFdrText().formulas;
  return (
    <RibbonButton
      size={size}
      small="labeled"
      icon={Code}
      label={t.showFormulas}
      shortcut={shortcutText(f.showFormulasShortcut)}
      description={f.showFormulasTip}
      pressed={isShowFormulas(h.context)}
      onClick={() => runToggleShowFormulas(a)}
    />
  );
};

/** The next cell with a formula error after the active one (row by row). */
function nextErrorCell(h: RibbonCommandHelpers) {
  const data = getFlowdata(h.context);
  if (!data) return null;
  const at = activeCell(h.context) ?? { r: 0, c: -1 };
  const rows = data.length;
  const cols = data[0]?.length ?? 0;
  const total = rows * cols;
  const start = at.r * cols + at.c + 1;
  for (let i = 0; i < total; i += 1) {
    const k = (start + i) % total;
    const r = Math.floor(k / cols);
    const c = k % cols;
    if (data[r]?.[c] && getCellError(h.context, r, c)) return { r, c };
  }
  return null;
}

export const ErrorCheckingCommand: React.FC<RibbonCommandProps> = ({
  size,
}) => {
  const h = useRibbonCommandHelpers();
  const a = useAudit(h);
  const notify = useNotify();
  const all = formulaAuditLocale(h.context);
  const f = useFdrText().formulas;
  const goToNext = () => {
    const next = nextErrorCell(h);
    if (!next) {
      notify(f.noErrors);
      return;
    }
    h.setContext(
      (ctx) => {
        selectRangesOnSheet(
          ctx,
          ctx.currentSheetId,
          [{ row: [next.r, next.r], column: [next.c, next.c] }],
          [next.r, next.c]
        );
      },
      { noHistory: true }
    );
    h.focusSheet();
  };
  const circular = getCircularReferences(h.context);
  const menu: MenuItem[] = [
    {
      id: "check",
      label: f.errorCheckingMenu,
      icon: TriangleAlert,
      onSelect: goToNext,
    },
    {
      id: "trace",
      label: all.errors.traceError,
      icon: ArrowRightToLine,
      onSelect: () => runTracePrecedents(a),
    },
    {
      id: "circular",
      label: f.circularReferences,
      disabled: circular.length === 0,
      children: circular.map((cr) => ({
        id: `circular:${cr.id}:${cr.r}:${cr.c}`,
        label: `${sheetNameById(h.context, cr.id) ?? ""}!${cellAddress(cr.r, cr.c, true)}`,
        onSelect: () =>
          h.setContext(
            (ctx) => {
              selectRangesOnSheet(
                ctx,
                cr.id,
                [{ row: [cr.r, cr.r], column: [cr.c, cr.c] }],
                [cr.r, cr.c]
              );
            },
            { noHistory: true }
          ),
      })),
    },
    { type: "separator" },
    {
      id: "options",
      label: all.errors.options,
      onSelect: () => h.showDialog(<ErrorCheckingOptionsDialog />),
    },
  ];
  return (
    <RibbonButton
      size={size}
      small="labeled"
      icon={TriangleAlert}
      label={all.errors.checking}
      description={f.errorCheckingTip}
      onClick={goToNext}
      menu={menu}
    />
  );
};

export const EvaluateFormulaCommand: React.FC<RibbonCommandProps> = ({
  size,
}) => {
  const h = useRibbonCommandHelpers();
  const a = useAudit(h);
  const t = formulaAuditLocale(h.context).auditing;
  const tips = useFdrText().formulas;
  return (
    <RibbonButton
      size={size}
      small="labeled"
      icon={SearchCode}
      label={t.evaluateFormula}
      description={tips.evaluateFormulaTip}
      onClick={() => runEvaluateFormula(a)}
    />
  );
};

export const WatchWindowCommand: React.FC<RibbonCommandProps> = ({ size }) => {
  const h = useRibbonCommandHelpers();
  const a = useAudit(h);
  const t = formulaAuditLocale(h.context).auditing;
  const tips = useFdrText().formulas;
  return (
    <RibbonButton
      size={size}
      small="labeled"
      icon={ScanEye}
      label={t.watchWindow}
      description={tips.watchWindowTip}
      pressed={!!h.context.watchWindow?.open}
      onClick={() => runToggleWatchWindow(a)}
    />
  );
};

/* ------------------------------------------------------------------ */
/*  Calculation                                                        */
/* ------------------------------------------------------------------ */

export const CalculationOptionsCommand: React.FC<RibbonCommandProps> = ({
  size,
}) => {
  const h = useRibbonCommandHelpers();
  const a = useAudit(h);
  const t = formulaAuditLocale(h.context).calc;
  const f = useFdrText().formulas;
  const { mode } = getCalcSettings(h.context);
  const setMode = (m: CalcMode) =>
    h.setContext((ctx) => {
      setCalcSettings(ctx, { mode: m });
    });
  const option = (id: CalcMode, label: string): MenuItem => ({
    id,
    label,
    checked: mode === id,
    radio: true,
    onSelect: () => setMode(id),
  });
  return (
    <RibbonButton
      size={size}
      small="labeled"
      icon={Calculator}
      label={t.options}
      description={f.calculationOptionsTip}
      menu={[
        option("auto", t.automatic),
        option("autoNoTable", t.automaticExceptTables),
        option("manual", t.manual),
        { type: "separator" },
        {
          id: "iterative",
          label: t.iterativeSettings,
          onSelect: () => runCalcOptions(a),
        },
      ]}
    />
  );
};

export const CalculateNowCommand: React.FC<RibbonCommandProps> = ({ size }) => {
  const h = useRibbonCommandHelpers();
  const t = formulaAuditLocale(h.context).calc;
  const f = useFdrText().formulas;
  return (
    <RibbonButton
      size={size}
      small="labeled"
      icon={RefreshCw}
      label={t.calculateNow}
      shortcut={shortcutText(f.calculateNowShortcut)}
      description={f.calculateNowTip}
      disabled={!isAllowEdit(h.context)}
      onClick={() =>
        h.setContext((ctx) => {
          calculateNow(ctx);
        })
      }
    />
  );
};

export const CalculateSheetCommand: React.FC<RibbonCommandProps> = ({
  size,
}) => {
  const h = useRibbonCommandHelpers();
  const t = formulaAuditLocale(h.context).calc;
  const f = useFdrText().formulas;
  return (
    <RibbonButton
      size={size}
      small="labeled"
      icon={Sheet}
      label={t.calculateSheet}
      shortcut={shortcutText(f.calculateSheetShortcut)}
      description={f.calculateSheetTip}
      disabled={!isAllowEdit(h.context)}
      onClick={() =>
        h.setContext((ctx) => {
          calculateSheet(ctx);
        })
      }
    />
  );
};
