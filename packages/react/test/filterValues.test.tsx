import React, { useState } from "react";
import { fireEvent, render } from "@testing-library/react";
import FilterValueList from "../src/components/ContextMenu/FilterValueList";
import type { FilterDate, FilterValue } from "@lofcz/tinysheet-core";

const dates: FilterDate[] = [];
const values: FilterValue[] = Array.from({ length: 50000 }, (_, i) => ({
  key: String(i),
  value: i,
  mask: String(i),
  text: `Item ${i}`,
  rows: [i + 1],
}));

test("a 50k checklist mounts a window; the last value remains selectable and searchable", () => {
  const changes = jest.fn();
  const Harness = ({ search = "" }) => {
    const [unchecked, setUnchecked] = useState<Set<string>>(() => new Set());
    return (
      <FilterValueList
        dates={dates}
        values={values}
        datesUncheck={new Set()}
        valuesUncheck={unchecked}
        search={search}
        maxHeight={240}
        onChange={(item, checked) => {
          changes(item.rows, checked);
          setUnchecked((prev) => {
            const next = new Set(prev);
            if (checked) next.delete(item.key);
            else next.add(item.key);
            return next;
          });
        }}
      />
    );
  };
  const view = render(<Harness />);
  expect(view.container.querySelectorAll(".select-item").length).toBeLessThan(
    40
  );
  expect(
    view.getByRole("checkbox", { name: "Item 0", exact: true })
  ).toBeTruthy();
  const list = view.container.querySelector(
    "#luckysheet-filter-byvalue-select"
  )!;
  fireEvent.scroll(list, { target: { scrollTop: 50000 * 24 - 240 } });
  fireEvent.click(
    view.getByRole("checkbox", { name: "Item 49999", exact: true })
  );
  expect(changes).toHaveBeenLastCalledWith([50000], false);
  view.rerender(<Harness search="49999" />);
  expect(view.container.querySelectorAll(".select-item")).toHaveLength(1);
  expect(
    (
      view.getByRole("checkbox", {
        name: "Item 49999",
        exact: true,
      }) as HTMLInputElement
    ).checked
  ).toBe(false);
  view.rerender(<Harness search="[" />);
  expect(view.container.querySelectorAll(".select-item")).toHaveLength(0);
  view.rerender(<Harness />);
  expect(
    view.getByRole("checkbox", { name: "Item 0", exact: true })
  ).toBeTruthy();
});

test("date search finds later days, and a collapsed parent retains its selection", () => {
  const day = (key: string, row: number): FilterDate => ({
    key,
    type: "day",
    value: key.slice(8),
    text: key.slice(8),
    rows: [row],
    dateValues: [key],
    children: [],
  });
  const days = [day("2024-01-01", 1), day("2024-01-02", 2)];
  const month: FilterDate = {
    key: "2024-01",
    type: "month",
    value: "01",
    text: "January",
    rows: [1, 2],
    dateValues: days.map((d) => d.key),
    children: days,
  };
  const year: FilterDate = {
    key: "2024",
    type: "year",
    value: "2024",
    text: "2024",
    rows: [1, 2],
    dateValues: month.dateValues,
    children: [month],
  };
  const props = {
    dates: [year],
    values: [],
    datesUncheck: new Set([days[1].key]),
    valuesUncheck: new Set<string>(),
    onChange: jest.fn(),
  };
  const view = render(<FilterValueList {...props} search="2024-01-02" />);
  expect(view.queryByRole("checkbox", { name: "01", exact: true })).toBeNull();
  expect(view.getByRole("checkbox", { name: "02", exact: true })).toBeTruthy();
  expect(
    (view.getByRole("checkbox", { name: "2024" }) as HTMLInputElement).checked
  ).toBe(false);
  fireEvent.click(view.getByRole("button", { name: "2024" }));
  expect(view.queryByRole("checkbox", { name: "02", exact: true })).toBeNull();
  fireEvent.click(view.getByRole("checkbox", { name: "2024" }));
  expect(props.onChange).toHaveBeenCalledWith(year, true, true);
});
