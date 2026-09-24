import _ from "lodash";
import React, { useContext } from "react";
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
  if (_.isEmpty(context.functionCandidates)) return null;
  const activeIndex = Math.min(
    context.functionCandidateIndex ?? 0,
    context.functionCandidates.length - 1
  );

  return (
    <div
      {...props}
      id="luckysheet-formula-search-c"
      className="luckysheet-formula-search-c"
      role="listbox"
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
