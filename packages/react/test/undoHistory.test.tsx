import { act, render } from "@testing-library/react";
import React, { startTransition } from "react";
import Workbook from "../src/components/Workbook";
import type { WorkbookInstance } from "../src/components/Workbook";

function setup(strict: boolean) {
  const ref = React.createRef<WorkbookInstance>();
  const onOp = jest.fn();
  const wb = <Workbook ref={ref} data={[{ name: "Sheet1" }]} onOp={onOp} />;
  render(strict ? <React.StrictMode>{wb}</React.StrictMode> : wb);
  return { ref, onOp };
}

describe("Workbook undo history", () => {
  it("records one step per edit under StrictMode", () => {
    const { ref, onOp } = setup(true);
    act(() => ref.current!.setCellValue(0, 0, "a"));
    act(() => ref.current!.setCellValue(0, 0, "b"));
    expect(onOp).toHaveBeenCalledTimes(2);

    act(() => ref.current!.handleUndo());
    expect(ref.current!.getCellValue(0, 0)).toBe("a");
    act(() => ref.current!.handleUndo());
    expect(ref.current!.getCellValue(0, 0) ?? null).toBe(null);
  });

  it("records one step when React re-runs an edit over a pending update", () => {
    const { ref, onOp } = setup(false);
    act(() => {
      // the low-priority edit is still pending when the urgent one runs, so
      // React processes the urgent updater again on top of it
      startTransition(() => ref.current!.setCellValue(1, 1, "x"));
      ref.current!.setCellValue(0, 0, "a");
    });
    expect(ref.current!.getCellValue(0, 0)).toBe("a");
    expect(ref.current!.getCellValue(1, 1)).toBe("x");
    expect(onOp).toHaveBeenCalledTimes(2);

    act(() => ref.current!.handleUndo());
    act(() => ref.current!.handleUndo());
    expect(ref.current!.getCellValue(0, 0) ?? null).toBe(null);
    expect(ref.current!.getCellValue(1, 1) ?? null).toBe(null);
  });
});
