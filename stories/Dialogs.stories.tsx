import React, {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Meta, StoryFn } from "@storybook/react";
import { openFormatCells, Sheet } from "@lofcz/tinysheet-core";
import {
  registerSheetOverlay,
  Workbook,
  WorkbookInstance,
  ZoomDialog,
  InsertFunctionDialog,
} from "@lofcz/tinysheet-react";
import WorkbookContext from "../packages/react/src/context";
import { useDialog } from "../packages/react/src/hooks/useDialog";
import { usePageLayoutDialogs } from "../packages/react/src/components/PageLayout/dialogs";
import CustomSort from "../packages/react/src/components/CustomSort";
import RemoveDuplicates from "../packages/react/src/components/RemoveDuplicates";
import { SplitColumn } from "../packages/react/src/components/SplitColumn";
import DataVerification from "../packages/react/src/components/DataVerification";
import ManageRules from "../packages/react/src/components/ConditionFormat/ManageRules";
import ConditionRules from "../packages/react/src/components/ConditionFormat/ConditionRules";
import { NameManager } from "../packages/react/src/components/NameManager";
import GoalSeek from "../packages/react/src/components/CellTools/GoalSeek";
import DataTable from "../packages/react/src/components/CellTools/DataTable";
import AdvancedFilter from "../packages/react/src/components/CellTools/AdvancedFilter";
import {
  AllowEditRangesDialog,
  ProtectSheetDialog,
  ProtectWorkbookDialog,
} from "../packages/react/src/components/Protection/dialogs";
import {
  GroupDialog,
  OutlineSettingsDialog,
  SubtotalDialog,
} from "../packages/react/src/components/Outline/dialogs";
import { LocationCondition } from "../packages/react/src/components/LocationCondition";
import {
  InsertDeleteDialog,
  SizeDialog,
} from "../packages/react/src/components/ContextMenu/dialogs";
import {
  MoveOrCopyDialog,
  UnhideDialog,
} from "../packages/react/src/components/SheetTab/SheetDialogs";
import SparklineDataDialog from "../packages/react/src/components/Sparkline/SparklineDataDialog";
import CreatePivotDialog from "../packages/react/src/components/PivotTable/CreatePivotDialog";
import { CreateTableDialog } from "../packages/react/src/components/Tables";
import {
  CalcOptionsDialog,
  ErrorCheckingOptionsDialog,
  EvaluateFormulaDialog,
} from "../packages/react/src/components/FormulaAuditing/Dialogs";
import {
  AltTextDialog,
  InsertPictureDialog,
} from "../packages/react/src/components/CellImages/dialogs";
import {
  CustomFilterDialog,
  Top10Dialog,
} from "../packages/react/src/components/FilterOption/ConditionDialogs";

/**
 * Harness of the dialogs and side panes for the Playwright suite
 * (e2e/tests/dialogsPanes.spec.js) and for screenshots: a small workbook
 * with data and `window.__tinysheetDialogs.open(name)` to show any dialog
 * the way its command does.
 */
export default {
  title: "E2E/Dialogs",
  component: Workbook,
} as Meta<typeof Workbook>;

declare global {
  interface Window {
    __tinysheet?: WorkbookInstance | null;
    __tinysheetDialogs?: { open: (name: string) => void; names: string[] };
  }
}

const cell = (v: string | number) =>
  typeof v === "number"
    ? { v, m: String(v), ct: { fa: "General", t: "n" } }
    : { v, m: v, ct: { fa: "General", t: "g" } };

const rows: (string | number)[][] = [
  ["Region", "Product", "Sales", "Qty"],
  ["East", "Pen", 10, 1],
  ["West", "Book", 40, 4],
  ["East", "Book", 20, 2],
  ["West", "Pen", 30, 3],
  ["East", "Pen", 10, 1],
];

const sheets = (): Sheet[] => [
  {
    name: "Sheet1",
    id: "sheet1",
    order: 0,
    status: 1,
    row: 60,
    column: 20,
    celldata: [
      ...rows.flatMap((r, i) => r.map((v, j) => ({ r: i, c: j, v: cell(v) }))),
      { r: 7, c: 2, v: { v: 110, f: "=SUM(C2:C6)", m: "110" } as any },
      { r: 0, c: 6, v: cell("a;b;c") },
      { r: 1, c: 6, v: cell("d;e;f") },
    ],
  },
  { name: "Sheet2", id: "sheet2", order: 1, status: 0, celldata: [] },
  { name: "Hidden", id: "sheet3", order: 2, status: 0, hide: 1, celldata: [] },
];

function select(ctx: any, r1: number, c1: number, r2 = r1, c2 = c1) {
  ctx.luckysheet_select_save = [
    { row: [r1, r2], column: [c1, c2], row_focus: r1, column_focus: c1 },
  ];
}

const DialogHost: React.FC = () => {
  const { context, setContext } = useContext(WorkbookContext);
  const { showDialog, hideDialog } = useDialog();
  const pageLayout = usePageLayoutDialogs();
  const ctxRef = useRef(context);
  ctxRef.current = context;
  useEffect(() => {
    const sheet1 = () =>
      ctxRef.current.luckysheetfile.find((s) => s.id === "sheet1") as Sheet;
    const at = (r1: number, c1: number, r2?: number, c2?: number) =>
      setContext((ctx) => select(ctx, r1, c1, r2, c2), { noHistory: true });
    const table: Record<string, () => void> = {
      message: () => showDialog("A message from the workbook.", "ok"),
      confirm: () => showDialog("Replace the contents?", "yesno"),
      formatCells: () =>
        setContext((ctx) => openFormatCells(ctx), { noHistory: true }),
      pasteSpecial: () =>
        setContext(
          (ctx) => {
            ctx.luckysheet_copy_save = {
              dataSheetId: "sheet1",
              copyRange: [{ row: [0, 1], column: [0, 1] }],
              RowlChange: false,
              HasMC: false,
            } as any;
            ctx.showPasteSpecial = true;
          },
          { noHistory: true }
        ),
      findReplace: () =>
        setContext(
          (ctx) => {
            ctx.showSearch = true;
            ctx.showReplace = true;
          },
          { noHistory: true }
        ),
      goTo: () =>
        setContext(
          (ctx) => {
            ctx.showGoTo = true;
          },
          { noHistory: true }
        ),
      goToSpecial: () => showDialog(<LocationCondition />),
      sort: () => {
        at(1, 0);
        showDialog(<CustomSort />);
      },
      removeDuplicates: () => {
        at(1, 0);
        showDialog(<RemoveDuplicates />);
      },
      textToColumns: () => {
        at(0, 6, 1, 6);
        showDialog(<SplitColumn />);
      },
      dataValidation: () => {
        at(1, 3, 5, 3);
        showDialog(<DataVerification />);
      },
      cfManager: () => {
        at(1, 2, 5, 2);
        showDialog(<ManageRules />);
      },
      cfQuick: () => {
        at(1, 2, 5, 2);
        showDialog(<ConditionRules type="greaterThan" />);
      },
      nameManager: () => showDialog(<NameManager />),
      newName: () => {
        at(1, 2, 5, 2);
        showDialog(<NameManager initialMode="newName" />);
      },
      goalSeek: () => {
        at(7, 2);
        showDialog(<GoalSeek />);
      },
      dataTable: () => {
        at(0, 0, 3, 2);
        showDialog(<DataTable />);
      },
      advancedFilter: () => {
        at(1, 0);
        showDialog(<AdvancedFilter />);
      },
      pageSetup: () => pageLayout.openPageSetup("page"),
      printPreview: () => pageLayout.openPrintPreview(),
      protectSheet: () => showDialog(<ProtectSheetDialog />),
      protectWorkbook: () => showDialog(<ProtectWorkbookDialog />),
      allowEditRanges: () => showDialog(<AllowEditRangesDialog />),
      subtotal: () => {
        at(0, 0, 5, 3);
        showDialog(<SubtotalDialog />);
      },
      group: () => {
        at(1, 1, 2, 2);
        showDialog(<GroupDialog />);
      },
      outlineSettings: () => showDialog(<OutlineSettingsDialog />),
      insertFunction: () => {
        at(9, 0);
        showDialog(<InsertFunctionDialog onCancel={hideDialog} />);
      },
      insertCells: () =>
        showDialog(
          <InsertDeleteDialog
            mode="insert"
            range={{ row: [1, 2], column: [1, 1] }}
          />
        ),
      deleteCells: () =>
        showDialog(
          <InsertDeleteDialog
            mode="delete"
            range={{ row: [1, 2], column: [1, 1] }}
          />
        ),
      rowHeight: () =>
        showDialog(<SizeDialog type="row" initial={20} targets={[1]} />),
      moveCopy: () => showDialog(<MoveOrCopyDialog sheet={sheet1()} />),
      unhide: () => showDialog(<UnhideDialog />),
      sparklines: () =>
        showDialog(
          <SparklineDataDialog
            mode="insert"
            sheetId="sheet1"
            type="line"
            data="C2:C6"
            location=""
          />
        ),
      createPivot: () => {
        at(1, 0);
        showDialog(<CreatePivotDialog />);
      },
      createTable: () => {
        at(1, 0);
        showDialog(<CreateTableDialog styleKey="TableStyleMedium2" />);
      },
      calcOptions: () => showDialog(<CalcOptionsDialog />),
      errorChecking: () => showDialog(<ErrorCheckingOptionsDialog />),
      evaluate: () =>
        showDialog(<EvaluateFormulaDialog sheetId="sheet1" r={7} c={2} />),
      zoom: () => showDialog(<ZoomDialog />),
      picture: () => showDialog(<InsertPictureDialog r={10} c={1} />),
      altText: () =>
        showDialog(<AltTextDialog r={10} c={1} initial="A chart" />),
      customFilter: () =>
        showDialog(
          <CustomFilterDialog col={0} startRow={1} endRow={5} kind="text" />
        ),
      top10: () => showDialog(<Top10Dialog col={2} />),
    };
    window.__tinysheetDialogs = {
      open: (name) => table[name](),
      names: Object.keys(table),
    };
    return () => {
      delete window.__tinysheetDialogs;
    };
  }, [hideDialog, pageLayout, setContext, showDialog]);
  return null;
};

registerSheetOverlay("e2e-dialog-host", DialogHost);

const Template: StoryFn<typeof Workbook> = (args) => {
  const ref = useRef<WorkbookInstance>(null);
  const [data, setData] = useState<Sheet[]>(sheets);
  const onChange = useCallback((d: Sheet[]) => setData(d), []);
  useEffect(() => {
    Object.defineProperty(window, "__tinysheet", {
      configurable: true,
      get: () => ref.current,
    });
    return () => {
      delete window.__tinysheet;
    };
  }, []);
  return (
    <div style={{ width: "100%", height: "100vh" }}>
      <Workbook ref={ref} {...args} data={data} onChange={onChange} />
    </div>
  );
};

export const Light = Template.bind({});
Light.args = {};

export const Dark = Template.bind({});
Dark.args = { theme: "dark" };
