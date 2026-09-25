import { act, fireEvent, render } from "@testing-library/react";
import React from "react";
import Workbook from "../src/components/Workbook";
import { registerInsertFunction } from "../src/components/FxEditor/insertFunction";

const sheet = () => ({
  name: "Sheet1",
  id: "s1",
  order: 0,
  celldata: [
    { r: 0, c: 0, v: { v: 1, m: "1", ct: { fa: "General", t: "n" } } },
  ],
});

describe("formula bar", () => {
  it("lays out the Name Box, cancel / enter / fx, the formula and expand", () => {
    const { container } = render(<Workbook lang="en" data={[sheet()]} />);
    const bar = container.querySelector(".fortune-fx-editor")!;
    const labels = Array.from(bar.querySelectorAll("button, input")).map((el) =>
      el.getAttribute("aria-label")
    );
    expect(labels).toEqual([
      "Name Box",
      "Defined names",
      "Discard Edit",
      "Confirm Edit",
      "Insert Function",
      "Expand Formula Bar (Ctrl+Shift+U)",
    ]);
    // cancel and enter wait for an edit
    const button = (name: string) =>
      bar.querySelector(`button[aria-label="${name}"]`) as HTMLButtonElement;
    expect(button("Discard Edit").disabled).toBe(true);
    expect(button("Confirm Edit").disabled).toBe(true);
    expect(button("Insert Function").disabled).toBe(false);
  });

  it("fx opens a registered Insert Function dialog", () => {
    const handler = jest.fn();
    const unregister = registerInsertFunction(handler);
    try {
      const { container } = render(<Workbook lang="en" data={[sheet()]} />);
      const fx = container.querySelector(
        'button[aria-label="Insert Function"]'
      )!;
      act(() => {
        fireEvent.click(fx);
      });
      expect(handler).toHaveBeenCalledTimes(1);
      const helpers = handler.mock.calls[0][0];
      // not editing: no editor to insert into
      expect(helpers.editor).toBeNull();
      expect(typeof helpers.showModal).toBe("function");
      expect(typeof helpers.setContext).toBe("function");
    } finally {
      unregister();
    }
  });
});
