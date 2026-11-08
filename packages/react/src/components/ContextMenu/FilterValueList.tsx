import React, { useEffect, useMemo, useRef, useState } from "react";
import type { FilterDate, FilterValue } from "@lofcz/tinysheet-core";

const ROW_HEIGHT = 24;
const OVERSCAN = 5;
type Row = { item: FilterDate | FilterValue; depth: number; date: boolean };

/** Window both values and the expanded date tree; never mount the whole column. */
const FilterValueList: React.FC<{
  dates: FilterDate[];
  values: FilterValue[];
  datesUncheck: Set<string>;
  valuesUncheck: Set<string>;
  search: string;
  maxHeight?: number;
  onChange: (
    item: FilterDate | FilterValue,
    checked: boolean,
    date: boolean
  ) => void;
}> = ({
  dates,
  values,
  datesUncheck,
  valuesUncheck,
  search,
  maxHeight = 400,
  onChange,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [scrollTop, setScrollTop] = useState(0);
  const uncheckedDates = useMemo(() => {
    const keys = new Set<string>();
    datesUncheck.forEach((key) => {
      keys.add(key);
      keys.add(key.slice(0, 4));
      keys.add(key.slice(0, 7));
    });
    return keys;
  }, [datesUncheck]);
  const rows = useMemo(() => {
    const query = search.toLowerCase();
    const list: Row[] = [];
    const visit = (item: FilterDate, depth: number) => {
      if (query && !item.dateValues.some((value) => value.includes(query)))
        return;
      list.push({ item, depth, date: true });
      if (!collapsed.has(item.key))
        item.children.forEach((child) => visit(child, depth + 1));
    };
    dates.forEach((item) => visit(item, 0));
    values.forEach((item) => {
      if (!query || item.text.toLowerCase().includes(query))
        list.push({ item, depth: 0, date: false });
    });
    return list;
  }, [dates, values, search, collapsed]);
  useEffect(() => {
    setCollapsed(new Set());
  }, [dates, values]);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = 0;
    setScrollTop(0);
  }, [dates, values, search]);
  const height = Math.max(100, Math.min(400, maxHeight));
  const first = Math.max(
    0,
    Math.min(rows.length - 1, Math.floor(scrollTop / ROW_HEIGHT)) - OVERSCAN
  );
  const end = Math.min(
    rows.length,
    first + Math.ceil(height / ROW_HEIGHT) + OVERSCAN * 2
  );
  return (
    <div
      ref={ref}
      id="luckysheet-filter-byvalue-select"
      style={{
        height: Math.min(height, Math.max(100, rows.length * ROW_HEIGHT + 8)),
      }}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      onKeyDown={(e) => {
        const input = e.target as HTMLInputElement;
        const index = Number(input.dataset.index);
        if (
          input.dataset.index == null ||
          !["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)
        )
          return;
        e.preventDefault();
        e.stopPropagation();
        const next = Math.max(
          0,
          Math.min(
            rows.length - 1,
            e.key === "Home"
              ? 0
              : e.key === "End"
                ? rows.length - 1
                : index + (e.key === "ArrowDown" ? 1 : -1)
          )
        );
        const node = ref.current!;
        if (next * ROW_HEIGHT < node.scrollTop)
          node.scrollTop = next * ROW_HEIGHT;
        else if (
          (next + 1) * ROW_HEIGHT >
          node.scrollTop + node.clientHeight - 8
        )
          node.scrollTop = (next + 1) * ROW_HEIGHT - node.clientHeight + 8;
        setScrollTop(node.scrollTop);
        requestAnimationFrame(() =>
          node
            .querySelector<HTMLInputElement>(`input[data-index="${next}"]`)
            ?.focus({ preventScroll: true })
        );
      }}
    >
      <div style={{ height: rows.length * ROW_HEIGHT, position: "relative" }}>
        {rows.slice(first, end).map(({ item, depth, date }, offset) => {
          const checked = !(date ? uncheckedDates : valuesUncheck).has(
            item.key
          );
          const branch = date && (item as FilterDate).children.length > 0;
          return (
            <div
              key={`${date ? "date" : "value"}:${item.key}`}
              className="select-item"
              style={{
                position: "absolute",
                top: (first + offset) * ROW_HEIGHT,
                height: ROW_HEIGHT,
                left: depth * 20,
                right: 0,
                whiteSpace: "nowrap",
              }}
            >
              {date &&
                (branch ? (
                  <button
                    type="button"
                    className="fortune-filter-tree-toggle"
                    aria-label={item.text}
                    aria-expanded={!collapsed.has(item.key)}
                    onClick={() =>
                      setCollapsed((prev) => {
                        const next = new Set(prev);
                        if (next.has(item.key)) next.delete(item.key);
                        else next.add(item.key);
                        return next;
                      })
                    }
                  >
                    <span
                      className={`filter-caret ${collapsed.has(item.key) ? "right" : "down"}`}
                    />
                  </button>
                ) : (
                  <span style={{ width: 15, flexShrink: 0 }} />
                ))}
              <input
                className="filter-checkbox"
                type="checkbox"
                aria-label={item.text}
                data-index={first + offset}
                checked={checked}
                onChange={() => onChange(item, !checked, date)}
              />
              <div
                style={{ overflow: "hidden", textOverflow: "ellipsis" }}
                title={item.text}
              >
                {item.text}
              </div>
              <span className="count">{`( ${item.rows.length} )`}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FilterValueList;
