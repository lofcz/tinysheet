import { updateCell } from "@lofcz/tinysheet-core";
import React, { useContext, useEffect, useRef, useState } from "react";
import WorkbookContext from "../../context";
import { useOutsideClick } from "../../hooks/useOutsideClick";

export type PickListState = {
  r: number;
  c: number;
  left: number;
  top: number;
  minWidth: number;
  values: string[];
};

/** "Pick From Drop-down List…": a listbox under the active cell. */
const PickList: React.FC<{ state: PickListState; onClose: () => void }> = ({
  state,
  onClose,
}) => {
  const { setContext, refs } = useContext(WorkbookContext);
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  useOutsideClick(listRef, onClose, [onClose]);
  useEffect(() => {
    listRef.current?.focus();
  }, []);
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView?.({ block: "nearest" });
  }, [active]);

  const choose = (value: string) => {
    onClose();
    setContext((draftCtx) => {
      updateCell(
        draftCtx,
        state.r,
        state.c,
        null,
        value,
        refs.canvas.current?.getContext("2d") ?? undefined
      );
    });
    refs.cellInput.current?.focus();
  };

  return (
    <div
      ref={listRef}
      className="fortune-pick-list"
      role="listbox"
      tabIndex={-1}
      aria-activedescendant={`fortune-pick-list-${active}`}
      style={{ left: state.left, top: state.top, minWidth: state.minWidth }}
      onMouseDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setActive((i) => Math.min(state.values.length - 1, i + 1));
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setActive((i) => Math.max(0, i - 1));
        } else if (e.key === "Home") {
          e.preventDefault();
          setActive(0);
        } else if (e.key === "End") {
          e.preventDefault();
          setActive(state.values.length - 1);
        } else if (e.key === "Enter" || e.key === "Tab") {
          e.preventDefault();
          choose(state.values[active]);
        } else if (e.key === "Escape") {
          e.preventDefault();
          onClose();
          refs.cellInput.current?.focus();
        }
      }}
    >
      {state.values.map((v, i) => (
        <div
          key={v}
          id={`fortune-pick-list-${i}`}
          data-index={i}
          role="option"
          aria-selected={i === active}
          className={`fortune-pick-list-item${
            i === active ? " fortune-pick-list-item-active" : ""
          }`}
          onMouseEnter={() => setActive(i)}
          onClick={() => choose(v)}
        >
          {v}
        </div>
      ))}
    </div>
  );
};

export default PickList;
