import React, { useLayoutEffect, useRef, useState } from "react";
import type { FindMatch } from "@lofcz/tinysheet-core";
import { activateOnKey } from "../Toolbar/Button";

const ROW_HEIGHT = 30;
const WINDOW_ROWS = 14;
const matchKey = (m: FindMatch) => `${m.sheetId}:${m.r}:${m.c}`;

export const SearchResults: React.FC<{
  results: FindMatch[];
  selected?: string;
  onSelect: (match: FindMatch) => void;
}> = ({ results, selected, onSelect }) => {
  const list = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [focused, setFocused] = useState(0);
  const pendingFocus = useRef(false);
  const first = Math.min(
    Math.max(0, results.length - WINDOW_ROWS),
    Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - 3)
  );
  const visible = results.slice(first, first + WINDOW_ROWS);
  useLayoutEffect(() => {
    if (list.current) list.current.scrollTop = 0;
    setScrollTop(0);
    setFocused(0);
  }, [results]);
  useLayoutEffect(() => {
    if (pendingFocus.current) {
      list.current
        ?.querySelector<HTMLElement>(`[data-result-index="${focused}"]`)
        ?.focus({ preventScroll: true });
      pendingFocus.current = false;
    }
  }, [focused, first]);
  return (
    <div
      ref={list}
      className="boxMain"
      role="rowgroup"
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
    >
      <div
        style={{
          paddingTop: first * ROW_HEIGHT,
          paddingBottom: (results.length - first - visible.length) * ROW_HEIGHT,
        }}
      >
        {visible.map((value, offset) => {
          const index = first + offset;
          const key = matchKey(value);
          return (
            <div
              key={key}
              className={`boxItem ${selected === key ? "on" : ""}`}
              role="row"
              aria-rowindex={index + 2}
              aria-selected={selected === key}
              data-result-index={index}
              tabIndex={index === focused ? 0 : -1}
              onFocus={() => setFocused(index)}
              onClick={() => onSelect(value)}
              onKeyDown={(e) => {
                const target = {
                  ArrowDown: index + 1,
                  ArrowUp: index - 1,
                  Home: 0,
                  End: results.length - 1,
                  PageDown: index + 6,
                  PageUp: index - 6,
                }[e.key];
                if (target == null) {
                  activateOnKey(e);
                  return;
                }
                e.preventDefault();
                e.stopPropagation();
                const next = Math.max(0, Math.min(results.length - 1, target));
                setFocused(next);
                pendingFocus.current = true;
                if (list.current) {
                  const top = next * ROW_HEIGHT;
                  if (
                    top < list.current.scrollTop ||
                    top + ROW_HEIGHT >
                      list.current.scrollTop + list.current.clientHeight
                  ) {
                    list.current.scrollTop = top;
                    setScrollTop(top);
                  }
                }
              }}
            >
              <span role="cell" title={value.sheetName}>
                {value.sheetName}
              </span>
              <span role="cell">{`$${value.cellPosition.replace(/(\d)/, "$$$1")}`}</span>
              <span role="cell" title={value.value}>
                {value.value}
              </span>
              <span role="cell" title={value.formula ?? ""}>
                {value.formula ?? ""}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
