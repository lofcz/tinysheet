import { act, fireEvent, render } from "@testing-library/react";
import React from "react";
import type { Shape } from "@lofcz/tinysheet-core";
import Workbook from "../src/components/Workbook";
import {
  getSheetOverlays,
  getToolbarItemRenderer,
  registerSheetOverlay,
} from "../src/extensions";
import {
  adjustFromHandle,
  lineEnds,
  lineFromEnds,
  localToSheet,
  resizeBox,
  rotationTowards,
  scaleBoxes,
  sheetToLocal,
  snapLine,
} from "../src/components/Shapes/interaction";
import { registerShapesFeature } from "../src/components/Shapes";
import {
  htmlToShapeText,
  shapeTextToHtml,
} from "../src/components/Shapes/richText";

const at = (r: number, c: number, dx = 0, dy = 0) => ({ r, c, dx, dy });

const rect: Shape = {
  id: "s1",
  name: "Rectangle 1",
  prst: "rect",
  from: at(1, 1),
  to: at(4, 3),
  fill: { color: "#4472C4" },
  line: { color: "#2F528F", width: 1 },
  text: { paragraphs: [{ runs: [{ text: "Hello", b: true }] }] },
};

const line: Shape = {
  id: "s2",
  name: "Arrow 2",
  prst: "line",
  from: at(6, 1),
  to: at(8, 3),
  line: { color: "#000000", width: 1, tail: "triangle" },
};

function renderBook(shapes: Shape[] = [rect, line], extra = {}) {
  let onChange: any[] = [];
  const utils = render(
    <Workbook
      data={[{ name: "Sheet1", id: "sheet1", shapes } as any]}
      onChange={(d: any) => {
        onChange = d;
      }}
      {...extra}
    />
  );
  return { ...utils, sheets: () => onChange };
}

describe("registration", () => {
  it("the shape layer and toolbar item are built in", () => {
    expect(getSheetOverlays().some((o) => o.key === "shapes")).toBe(true);
    expect(getToolbarItemRenderer("shapes")).toBeTruthy();
  });

  it("a host registration under the same key replaces the built-in", () => {
    const Custom = () => null;
    const off = registerSheetOverlay("shapes", Custom);
    expect(getSheetOverlays().find((o) => o.key === "shapes")?.Component).toBe(
      Custom
    );
    off();
    // removing a registration does not bring the built-in back by itself
    registerShapesFeature();
    expect(
      getSheetOverlays().find((o) => o.key === "shapes")?.Component
    ).not.toBe(Custom);
  });
});

describe("shape layer", () => {
  it("renders focusable, labelled shapes with their text", () => {
    const { container } = renderBook();
    const shapes = container.querySelectorAll<HTMLElement>("[data-shape-id]");
    expect(shapes).toHaveLength(2);
    expect(shapes[0].getAttribute("aria-label")).toBe("Rectangle 1: Hello");
    expect(shapes[0].getAttribute("tabindex")).toBe("0");
    expect(shapes[0].querySelector("path")?.getAttribute("fill")).toBe(
      "#4472C4"
    );
    expect(shapes[0].textContent).toBe("Hello");
    // the arrow line gets an arrow head
    expect(shapes[1].querySelectorAll("path").length).toBeGreaterThanOrEqual(3);
  });

  it("the toolbar offers the Shapes gallery", () => {
    const { container } = renderBook();
    const button = container.querySelector<HTMLElement>(
      '.fortune-toolbar [aria-label="Shapes: Dropdown"]'
    );
    expect(button).toBeTruthy();
    act(() => {
      fireEvent.click(button!);
    });
    const items = container.querySelectorAll("[data-shape-key]");
    expect(items.length).toBeGreaterThanOrEqual(21);
    // arming the draw mode shows the drawing surface
    act(() => {
      fireEvent.click(
        container.querySelector<HTMLElement>('[data-shape-key="ellipse"]')!,
        { detail: 1 }
      );
    });
    expect(container.querySelector(".fortune-shape-draw")).toBeTruthy();
  });

  it("click selects, Delete deletes, Ctrl+Z restores", () => {
    const { container, sheets } = renderBook();
    const el = () =>
      container.querySelector<HTMLElement>('[data-shape-id="s1"]');
    act(() => {
      fireEvent.mouseDown(el()!.querySelector("path")!, { button: 0 });
      fireEvent.mouseUp(window);
    });
    expect(el()!.getAttribute("aria-pressed")).toBe("true");
    expect(el()!.querySelectorAll(".fortune-shape-handle").length).toBe(8);
    expect(el()!.querySelector(".fortune-shape-rotate")).toBeTruthy();
    act(() => {
      fireEvent.keyDown(el()!, { key: "Delete" });
    });
    expect(el()).toBeNull();
    expect(sheets()[0].shapes.map((s: Shape) => s.id)).toEqual(["s2"]);
    act(() => {
      fireEvent.keyDown(container.querySelector(".fortune-container")!, {
        key: "z",
        code: "KeyZ",
        ctrlKey: true,
      });
    });
    expect(el()).toBeTruthy();
  });

  it("arrow keys nudge, Ctrl+D duplicates, context menu formats", () => {
    const { container, sheets } = renderBook();
    const el = () =>
      container.querySelector<HTMLElement>('[data-shape-id="s1"]')!;
    act(() => {
      fireEvent.mouseDown(el().querySelector("path")!, { button: 0 });
      fireEvent.mouseUp(window);
    });
    act(() => {
      fireEvent.keyDown(el(), { key: "ArrowRight" });
    });
    expect(sheets()[0].shapes[0].from).toEqual(at(1, 1, 1, 0));
    act(() => {
      fireEvent.keyDown(el(), { key: "d", code: "KeyD", ctrlKey: true });
    });
    expect(sheets()[0].shapes).toHaveLength(3);
    act(() => {
      fireEvent.contextMenu(el().querySelector("path")!);
    });
    const format = Array.from(
      document.querySelectorAll<HTMLElement>(".fortune-shape-menu-item")
    ).find((b) => b.textContent?.startsWith("Format shape"));
    act(() => {
      fireEvent.click(format!);
    });
    expect(
      container.querySelector('aside[aria-label="Format shape"]')
    ).toBeTruthy();
  });

  it("Enter edits the text in place", () => {
    const { container } = renderBook();
    const el = () =>
      container.querySelector<HTMLElement>('[data-shape-id="s1"]')!;
    act(() => {
      fireEvent.mouseDown(el().querySelector("path")!, { button: 0 });
      fireEvent.mouseUp(window);
    });
    act(() => {
      fireEvent.keyDown(el(), { key: "Enter" });
    });
    const editor = container.querySelector<HTMLElement>(
      ".fortune-shape-editor"
    );
    expect(editor).toBeTruthy();
    expect(editor!.getAttribute("role")).toBe("textbox");
    expect(editor!.textContent).toBe("Hello");
  });
});

describe("handle geometry", () => {
  const box = { left: 100, top: 100, width: 100, height: 50 };

  it("resizes from any side, keeping the opposite side", () => {
    expect(resizeBox(box, 0, "rb", 20, 10)).toEqual({
      left: 100,
      top: 100,
      width: 120,
      height: 60,
    });
    expect(resizeBox(box, 0, "lt", 20, 10)).toEqual({
      left: 120,
      top: 110,
      width: 80,
      height: 40,
    });
    // Shift keeps the proportions
    const kept = resizeBox(box, 0, "rb", 100, 0, true);
    expect(kept.width / kept.height).toBeCloseTo(2);
  });

  it("resizes a rotated shape in its own frame", () => {
    // rotated 90°: dragging the right handle down widens the shape
    const out = resizeBox(box, 90, "rm", 0, 20);
    expect(out.width).toBeCloseTo(120);
    expect(out.height).toBeCloseTo(50);
  });

  it("scales a multi-selection proportionally", () => {
    const out = scaleBoxes(
      { a: { left: 0, top: 0, width: 50, height: 50 } },
      { left: 0, top: 0, width: 100, height: 100 },
      { left: 0, top: 0, width: 200, height: 100 }
    );
    expect(out.a).toEqual({ left: 0, top: 0, width: 100, height: 50 });
  });

  it("rotation, line ends and local coordinates", () => {
    expect(rotationTowards(box, { x: 250, y: 125 })).toBe(90);
    expect(rotationTowards(box, { x: 240, y: 110 }, true) % 15).toBe(0);
    const flipped = { flipH: true };
    const ends = lineEnds(box, flipped);
    expect(ends.start).toEqual({ x: 200, y: 100 });
    const back = lineFromEnds(ends.start, ends.end);
    expect(back).toEqual({ box, flipH: true, flipV: false });
    const p = localToSheet(box, { rot: 30 }, { x: 10, y: 5 });
    const q = sheetToLocal(box, { rot: 30 }, p);
    expect(q.x).toBeCloseTo(10);
    expect(q.y).toBeCloseTo(5);
    expect(snapLine({ x: 0, y: 0 }, { x: 10, y: 1 })).toEqual({
      x: 10.05,
      y: 0,
    });
  });

  it("the adjust handle sets the corner radius", () => {
    const adj = adjustFromHandle({ ...rect, prst: "roundRect" }, box, {
      x: 25,
      y: 0,
    });
    expect(adj).toEqual({ adj: 50000 });
  });
});

describe("rich text editor round trip", () => {
  it("reads formatting back from the editor DOM", () => {
    const div = document.createElement("div");
    div.innerHTML = shapeTextToHtml({
      paragraphs: [
        {
          align: "ctr",
          runs: [
            { text: "a", b: true, size: 14 },
            { text: "b", color: "#FF0000", u: true },
          ],
        },
        { runs: [] },
      ],
    });
    const back = htmlToShapeText(div, undefined);
    expect(back.paragraphs).toEqual([
      {
        align: "ctr",
        runs: [
          { text: "a", b: true, size: 14 },
          { text: "b", color: "#FF0000", u: true },
        ],
      },
      { runs: [] },
    ]);
  });

  it("understands the markup browsers produce while editing", () => {
    const div = document.createElement("div");
    div.innerHTML =
      'x<div><b>bold</b> <i>it</i></div><div><font color="#00ff00">g</font><br></div>';
    const back = htmlToShapeText(div, { paragraphs: [], anchor: "b" });
    expect(back.anchor).toBe("b");
    expect(back.paragraphs).toEqual([
      { runs: [{ text: "x" }] },
      {
        runs: [
          { text: "bold", b: true },
          { text: " " },
          { text: "it", i: true },
        ],
      },
      { runs: [{ text: "g", color: "#00FF00" }] },
    ]);
  });
});
