import _ from "lodash";
import React, { useContext, useEffect, useRef } from "react";
import WorkbookContext from "../../../context";
import "./index.css";

type Props = React.HTMLAttributes<HTMLDivElement> & {
  /** called with the function name when an item is clicked */
  onSelectCandidate?: (name: string) => void;
};

/** Renders `name` with the matched character ranges in bold. */
function highlight(name: string, matches: [number, number][] | undefined) {
  if (!matches || matches.length === 0) return name;
  const parts: React.ReactNode[] = [];
  let pos = 0;
  matches.forEach(([s, e]) => {
    if (s > pos) parts.push(name.slice(pos, s));
    parts.push(
      <span key={s} className="luckysheet-formula-search-match">
        {name.slice(s, e)}
      </span>
    );
    pos = e;
  });
  if (pos < name.length) parts.push(name.slice(pos));
  return parts;
}

const FormulaSearch: React.FC<Props> = ({ onSelectCandidate, ...props }) => {
  const { context, setContext } = useContext(WorkbookContext);
  const listRef = useRef<HTMLDivElement>(null);
  const activeIndex = Math.min(
    context.functionCandidateIndex ?? 0,
    context.functionCandidates.length - 1
  );

  // keep the highlighted item visible without scrolling the sheet
  useEffect(() => {
    const list = listRef.current;
    const el = list?.children[activeIndex] as HTMLElement | undefined;
    if (!list || !el) return;
    if (el.offsetTop < list.scrollTop) list.scrollTop = el.offsetTop;
    else if (
      el.offsetTop + el.offsetHeight >
      list.scrollTop + list.clientHeight
    )
      list.scrollTop = el.offsetTop + el.offsetHeight - list.clientHeight;
  }, [activeIndex, context.functionCandidates]);

  if (_.isEmpty(context.functionCandidates)) return null;

  return (
    <div
      {...props}
      ref={listRef}
      id="luckysheet-formula-search-c"
      className="luckysheet-formula-search-c"
      role="listbox"
      // the wheel scrolls the list, not the sheet
      data-fortune-popup=""
    >
      {context.functionCandidates.map((v, index) => (
        <div
          key={v.n}
          data-func={v.n}
          role="option"
          aria-selected={index === activeIndex}
          className={`luckysheet-formula-search-item ${
            index === activeIndex ? "luckysheet-formula-search-item-active" : ""
          }`}
          // keep the caret in the editor
          onMouseDown={(e) => e.preventDefault()}
          onMouseEnter={() => {
            if (index !== activeIndex) {
              setContext((ctx) => {
                ctx.functionCandidateIndex = index;
              });
            }
          }}
          onClick={(e) => {
            e.stopPropagation();
            onSelectCandidate?.(v.n);
          }}
        >
          <div className="luckysheet-formula-search-func">
            {highlight(v.n, v.matches)}
          </div>
          <div className="luckysheet-formula-search-detail">{v.a || v.d}</div>
        </div>
      ))}
    </div>
  );
};

export default FormulaSearch;
