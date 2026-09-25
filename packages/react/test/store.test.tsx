import { act, render } from "@testing-library/react";
import React, { useContext } from "react";
import WorkbookContext from "../src/context";
import {
  TrackedScope,
  WorkbookStore,
  WorkbookStoreContext,
  useWorkbookSelector,
} from "../src/context/store";
import Workbook, { WorkbookInstance } from "../src/components/Workbook";

const api: any = {
  setContext: () => {},
  settings: {},
  refs: {},
  handleUndo: () => {},
  handleRedo: () => {},
};

function setup(initial: any) {
  const store = new WorkbookStore(initial, api);
  const set = (next: any) =>
    act(() => {
      store.update(next, api);
      store.emit();
    });
  return { store, set };
}

describe("TrackedScope", () => {
  it("re-renders consumers only for the fields they read", () => {
    const { store, set } = setup({ a: 1, b: 1 });
    const renders: number[] = [];
    let handlerRead: () => number = () => 0;
    const Consumer = () => {
      const { context } = useContext(WorkbookContext) as any;
      renders.push(context.a);
      handlerRead = () => context.b;
      return <span>{context.a}</span>;
    };
    const tree = <Consumer />;
    const { container } = render(
      <WorkbookStoreContext.Provider value={store}>
        <TrackedScope>{tree}</TrackedScope>
      </WorkbookStoreContext.Provider>
    );
    expect(renders).toEqual([1]);
    set({ a: 1, b: 2 });
    expect(renders).toEqual([1]);
    // handlers see the latest state even without a re-render
    expect(handlerRead()).toBe(2);
    // ...and reading a field subscribes to it
    set({ a: 1, b: 3 });
    expect(renders).toEqual([1, 1]);
    set({ a: 5, b: 3 });
    expect(renders).toEqual([1, 1, 5]);
    expect(container.textContent).toBe("5");
  });

  it("compares the selection structurally", () => {
    const sel = [{ row: [0, 0], column: [0, 0] }];
    const { store, set } = setup({ luckysheet_select_save: sel });
    let renders = 0;
    const Consumer = () => {
      const { context } = useContext(WorkbookContext) as any;
      renders += 1;
      return <span>{context.luckysheet_select_save.length}</span>;
    };
    const tree = <Consumer />;
    render(
      <WorkbookStoreContext.Provider value={store}>
        <TrackedScope>{tree}</TrackedScope>
      </WorkbookStoreContext.Provider>
    );
    set({ luckysheet_select_save: [{ row: [0, 0], column: [0, 0] }] });
    expect(renders).toBe(1);
    set({ luckysheet_select_save: [{ row: [1, 1], column: [0, 0] }] });
    expect(renders).toBe(2);
  });

  it("rejects writes like the frozen context did", () => {
    const { store } = setup({ a: 1 });
    let ctx: any;
    const Consumer = () => {
      ctx = (useContext(WorkbookContext) as any).context;
      return null;
    };
    render(
      <WorkbookStoreContext.Provider value={store}>
        <TrackedScope>
          <Consumer />
        </TrackedScope>
      </WorkbookStoreContext.Provider>
    );
    expect(() => {
      ctx.a = 2;
    }).toThrow(TypeError);
    expect({ ...ctx }).toEqual({ a: 1 });
    expect("a" in ctx).toBe(true);
  });

  it("passes the parent value through outside a Workbook", () => {
    const value: any = { ...api, context: { a: 7 } };
    const Consumer = () => {
      const { context } = useContext(WorkbookContext) as any;
      return <span>{context.a}</span>;
    };
    const { container } = render(
      <WorkbookContext.Provider value={value}>
        <TrackedScope>
          <Consumer />
        </TrackedScope>
      </WorkbookContext.Provider>
    );
    expect(container.textContent).toBe("7");
  });
});

describe("useWorkbookSelector", () => {
  it("re-renders only when the selected value changes", () => {
    const { store, set } = setup({ a: 1, b: 1 });
    const seen: number[] = [];
    const Consumer = () => {
      const a = useWorkbookSelector((ctx: any) => ctx.a);
      seen.push(a);
      return null;
    };
    render(
      <WorkbookStoreContext.Provider value={store}>
        <Consumer />
      </WorkbookStoreContext.Provider>
    );
    set({ a: 1, b: 2 });
    set({ a: 2, b: 2 });
    expect(seen).toEqual([1, 2]);
  });
});

describe("Workbook with scoped consumers", () => {
  it("still updates the formula bar and sheet tabs", async () => {
    const ref = React.createRef<WorkbookInstance>();
    const { container } = render(
      <Workbook
        ref={ref}
        data={[
          { name: "Sheet1", celldata: [{ r: 0, c: 0, v: { v: 1, m: "1" } }] },
          { name: "Sheet2", celldata: [{ r: 1, c: 1, v: { v: 2, m: "2" } }] },
        ]}
      />
    );
    act(() => {
      ref.current!.setCellValue(0, 0, "hello");
    });
    expect(ref.current!.getCellValue(0, 0)).toBe("hello");
    act(() => {
      ref.current!.addSheet();
    });
    expect(container.querySelectorAll(".luckysheet-sheets-item").length).toBe(
      3
    );
    act(() => {
      ref.current!.setSelection([{ row: [1, 1], column: [1, 1] }]);
    });
    // the scoped formula bar follows the selection
    const nameBox = container.querySelector(".fortune-name-box")!;
    expect(
      nameBox instanceof HTMLInputElement ? nameBox.value : nameBox.textContent
    ).toBe("B2");
    act(() => {
      ref.current!.activateSheet({ index: 1 });
    });
    expect(
      container.querySelector(".luckysheet-sheets-item-active")!.textContent
    ).toContain("Sheet2");
  });
});
