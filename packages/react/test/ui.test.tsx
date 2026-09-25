import { act, fireEvent, render } from "@testing-library/react";
import React, { useState } from "react";
import {
  Workbook,
  registerRibbonCommand,
  SidePane,
  useSidePane,
  DropdownMenu,
  MenuItem,
  Tabs,
  NumberInput,
  Checkbox,
  DialogShell,
} from "../src";
import { showRibbonItem } from "./ribbonHelpers";

describe("side panes", () => {
  it("dock right of the grid: imperative and declarative, closable", () => {
    const Toggle: React.FC = () => {
      const { toggleSidePane, isSidePaneOpen } = useSidePane();
      return (
        <button
          type="button"
          aria-label="toggle watch"
          aria-pressed={isSidePaneOpen("watch")}
          onClick={() =>
            toggleSidePane("watch", <p>watch body</p>, { title: "Watch" })
          }
        />
      );
    };
    const Declared: React.FC = () => {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button
            type="button"
            aria-label="open notes"
            onClick={() => setOpen(true)}
          />
          <SidePane
            id="notes"
            title="Notes"
            open={open}
            onClose={() => setOpen(false)}
          >
            <p>notes body</p>
          </SidePane>
        </>
      );
    };
    const offs = [
      registerRibbonCommand("test-watch", Toggle),
      registerRibbonCommand("test-notes", Declared),
    ];
    try {
      const { container, getByLabelText, getByText, queryByText } = render(
        <Workbook
          lang="en"
          data={[{ name: "Sheet1" }]}
          ribbon={[
            {
              id: "t",
              groups: [{ id: "g", items: ["test-watch", "test-notes"] }],
            },
          ]}
        />
      );
      showRibbonItem(container, "test-watch");
      expect(container.querySelector(".fortune-side-slot")).toBeNull();
      fireEvent.click(getByLabelText("toggle watch"));
      const slot = container.querySelector(".fortune-side-slot")!;
      expect(slot).toBeTruthy();
      // next to the grid pane, inside the body row
      expect(slot.parentElement?.className).toBe("fortune-body");
      expect(getByText("watch body")).toBeTruthy();
      expect(slot.querySelector(".fortune-side-pane-title")?.textContent).toBe(
        "Watch"
      );
      // a second pane shows on top; the header switches between them
      fireEvent.click(getByLabelText("open notes"));
      expect(getByText("notes body")).toBeTruthy();
      expect(queryByText("watch body")).toBeNull();
      const tabs = slot.querySelectorAll("[role=tab]");
      expect(Array.from(tabs).map((t) => t.textContent)).toEqual([
        "Watch",
        "Notes",
      ]);
      fireEvent.click(tabs[0]);
      expect(getByText("watch body")).toBeTruthy();
      // close buttons close the shown pane (a declarative one via onClose)
      fireEvent.click(getByLabelText("Close pane"));
      expect(getByText("notes body")).toBeTruthy();
      fireEvent.click(getByLabelText("Close pane"));
      expect(container.querySelector(".fortune-side-slot")).toBeNull();
      // the separator resizes within 260-360px from the keyboard
      fireEvent.click(getByLabelText("toggle watch"));
      const sep = container.querySelector<HTMLElement>(
        ".fortune-side-separator"
      )!;
      for (let i = 0; i < 10; i += 1)
        fireEvent.keyDown(sep, { key: "ArrowLeft" });
      expect(sep.getAttribute("aria-valuenow")).toBe("360");
    } finally {
      offs.forEach((off) => off());
    }
  });
});

describe("ui primitives", () => {
  const Menu: React.FC<{ items: MenuItem[] }> = ({ items }) => {
    const ref = React.useRef<HTMLButtonElement>(null);
    const [open, setOpen] = useState(true);
    return (
      <div className="fortune-container">
        <button type="button" ref={ref}>
          anchor
        </button>
        <DropdownMenu
          open={open}
          onOpenChange={setOpen}
          anchorRef={ref}
          items={items}
          aria-label="Test menu"
        />
      </div>
    );
  };

  it("menus: keyboard, submenus, selection closes", () => {
    const picked = jest.fn();
    const { getByRole, queryByRole, getAllByRole } = render(
      <Menu
        items={[
          { id: "a", label: "Alpha", onSelect: () => picked("a") },
          { type: "separator" },
          { id: "b", label: "Beta", disabled: true },
          {
            id: "c",
            label: "Gamma",
            children: [
              { id: "c1", label: "Gamma one", onSelect: () => picked("c1") },
            ],
          },
        ]}
      />
    );
    const items = getAllByRole("menuitem");
    expect(items.map((i) => i.textContent)).toEqual(["Alpha", "Beta", "Gamma"]);
    // the first enabled item has the focus; disabled ones are skipped
    expect(document.activeElement).toBe(items[0]);
    fireEvent.keyDown(items[0], { key: "ArrowDown" });
    expect(document.activeElement).toBe(items[2]);
    // ArrowRight opens the submenu with its first item focused
    fireEvent.keyDown(items[2], { key: "ArrowRight" });
    const sub = getByRole("menuitem", { name: "Gamma one" });
    expect(document.activeElement).toBe(sub);
    fireEvent.keyDown(sub, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(items[2]);
    fireEvent.keyDown(items[2], { key: "ArrowRight" });
    fireEvent.click(getByRole("menuitem", { name: "Gamma one" }));
    expect(picked).toHaveBeenCalledWith("c1");
    expect(queryByRole("menu", { name: "Test menu" })).toBeNull();
  });

  it("tabs: roving focus with the arrow keys", () => {
    const onChange = jest.fn();
    const { getAllByRole } = render(
      <Tabs
        tabs={[
          { id: "a", label: "A" },
          { id: "b", label: "B" },
        ]}
        value="a"
        onChange={onChange}
      />
    );
    const [a, b] = getAllByRole("tab");
    expect(a.getAttribute("aria-selected")).toBe("true");
    expect(a.tabIndex).toBe(0);
    expect(b.tabIndex).toBe(-1);
    fireEvent.keyDown(a, { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith("b");
  });

  it("number input: steps, clamps, commits on Enter", () => {
    const Harness = () => {
      const [v, setV] = useState<number | null>(5);
      return (
        <NumberInput
          value={v}
          onChange={setV}
          min={0}
          max={10}
          aria-label="n"
        />
      );
    };
    const { getByRole } = render(<Harness />);
    const input = getByRole("spinbutton") as HTMLInputElement;
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(input.value).toBe("6");
    fireEvent.change(input, { target: { value: "42" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(input.value).toBe("10");
  });

  it("checkbox and dialog shell carry their roles", () => {
    const onChange = jest.fn();
    const onConfirm = jest.fn();
    const { getByRole } = render(
      <DialogShell title="Go To" onClose={() => {}} onConfirm={onConfirm}>
        <Checkbox checked={false} onChange={onChange} label="Only visible" />
      </DialogShell>
    );
    const dialog = getByRole("dialog", { name: "Go To" });
    fireEvent.click(getByRole("checkbox", { name: "Only visible" }));
    expect(onChange).toHaveBeenCalledWith(true);
    act(() => {
      fireEvent.keyDown(dialog, { key: "Enter" });
    });
    expect(onConfirm).toHaveBeenCalled();
  });
});
