import {
  getFunctionListMap,
  locale,
  resolveParamIndex,
} from "@lofcz/tinysheet-core";
import React, { useContext, useEffect, useState } from "react";
import WorkbookContext from "../../../context";
import "./index.css";

type Param = {
  name: string;
  detail?: string;
  example?: string;
  require?: string;
  repeat?: string;
};

/**
 * Argument hint shown while the caret is inside a function call:
 * `NAME(arg1, [arg2], ...)` with the argument under the caret in bold,
 * followed by (collapsible) details about the function and that argument.
 * Clicking an argument name selects that argument in the formula.
 */
type Props = React.HTMLAttributes<HTMLDivElement> & {
  /** called with an argument's index when its name is clicked */
  onSelectArgument?: (index: number) => void;
};

const FormulaHint: React.FC<Props> = ({ onSelectArgument, ...props }) => {
  const { context } = useContext(WorkbookContext);
  const { formulaMore } = locale(context);
  const [collapsed, setCollapsed] = useState(false);
  const [closedFor, setClosedFor] = useState<string | null>(null);
  const hint = context.functionHint;

  useEffect(() => {
    // closing hides the hint for the current function only
    if (closedFor && hint !== closedFor) setClosedFor(null);
  }, [hint, closedFor]);

  if (!hint || hint === closedFor) return null;
  const fn = getFunctionListMap(context)[hint];
  if (!fn) return null;

  const params: Param[] = fn.p || [];
  const current = resolveParamIndex(params, context.functionHintArgIndex ?? 0);
  const currentParam = current >= 0 ? params[current] : null;

  const paramLabel = (param: Param) => {
    let { name } = param;
    if (param.require === "o") name = `[${name}]`;
    return name;
  };
  const hasRepeat = params.some((p) => p.repeat === "y");

  return (
    <div
      {...props}
      id="luckysheet-formula-help-c"
      className="luckysheet-formula-help-c"
      onMouseDown={(e) => e.preventDefault()}
    >
      <div
        className="luckysheet-formula-help-close"
        title={formulaMore.helpClose}
        role="button"
        aria-label={formulaMore.helpClose}
        onClick={() => setClosedFor(hint)}
      >
        ×
      </div>
      <div
        className="luckysheet-formula-help-collapse"
        title={formulaMore.helpCollapse}
        role="button"
        aria-label={formulaMore.helpCollapse}
        aria-expanded={!collapsed}
        onClick={() => setCollapsed((c) => !c)}
      >
        {collapsed ? "▾" : "▴"}
      </div>
      <div className="luckysheet-formula-help-title">
        <div className="luckysheet-formula-help-title-formula">
          <span className="luckysheet-arguments-help-function-name">
            {fn.n}
          </span>
          <span className="luckysheet-arguments-paren">(</span>
          <span className="luckysheet-arguments-parameter-holder">
            {params.map((param, i) => (
              <React.Fragment key={`${param.name}-${i}`}>
                <span
                  className={`luckysheet-arguments-help-parameter${
                    i === current
                      ? " luckysheet-arguments-help-parameter-current"
                      : ""
                  }${
                    onSelectArgument
                      ? " luckysheet-arguments-help-parameter-link"
                      : ""
                  }`}
                  dir="auto"
                  role={onSelectArgument ? "button" : undefined}
                  title={
                    onSelectArgument
                      ? formulaMore.helpSelectArgument
                      : undefined
                  }
                  onClick={
                    onSelectArgument ? () => onSelectArgument(i) : undefined
                  }
                >
                  {paramLabel(param)}
                </span>
                {i !== params.length - 1 && ", "}
              </React.Fragment>
            ))}
            {hasRepeat && ", ..."}
          </span>
          <span className="luckysheet-arguments-paren">)</span>
        </div>
      </div>
      {!collapsed && (
        <div className="luckysheet-formula-help-content">
          <div className="luckysheet-formula-help-content-detail">
            <div className="luckysheet-arguments-help-section">
              <span className="luckysheet-arguments-help-parameter-content">
                {fn.d}
              </span>
            </div>
          </div>
          {currentParam && (
            <div className="luckysheet-formula-help-content-param">
              <div className="luckysheet-arguments-help-section luckysheet-arguments-help-section-current">
                <div className="luckysheet-arguments-help-section-title">
                  {currentParam.name}
                  {currentParam.repeat === "y" && (
                    <span className="luckysheet-arguments-help-argument-info">
                      {" "}
                      - {formulaMore.allowRepeatText}
                    </span>
                  )}
                  {currentParam.require === "o" && (
                    <span className="luckysheet-arguments-help-argument-info">
                      {" "}
                      - {formulaMore.allowOptionText}
                    </span>
                  )}
                </div>
                <span className="luckysheet-arguments-help-parameter-content">
                  {currentParam.detail}
                </span>
              </div>
            </div>
          )}
          <div className="luckysheet-formula-help-content-example">
            <div className="luckysheet-arguments-help-section-title">
              {formulaMore.helpExample}
            </div>
            <div className="luckysheet-arguments-help-formula">
              <span className="luckysheet-arguments-help-function-name">
                {fn.n}
              </span>
              <span className="luckysheet-arguments-paren">(</span>
              <span className="luckysheet-arguments-parameter-holder">
                {params.map((param, i) => (
                  <React.Fragment key={`${param.name}-${i}`}>
                    <span
                      className="luckysheet-arguments-help-parameter"
                      dir="auto"
                    >
                      {param.example}
                    </span>
                    {i !== params.length - 1 && ", "}
                  </React.Fragment>
                ))}
              </span>
              <span className="luckysheet-arguments-paren">)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FormulaHint;
