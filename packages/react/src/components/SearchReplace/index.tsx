import {
  locale,
  findAllMatches,
  findNextMatch,
  FindMatch,
  FindOptions,
  isAllowEdit,
  onSearchDialogMoveStart,
  replaceAllMatches,
  replaceHtml,
  replaceNextMatch,
  selectMatch,
} from "@lofcz/tinysheet-core";
import React, {
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import _ from "lodash";
import WorkbookContext from "../../context";
import SVGIcon from "../SVGIcon";
import { useAlert } from "../../hooks/useAlert";
import { activateOnKey } from "../Toolbar/Button";
import "./index.css";

type Options = Required<
  Pick<
    FindOptions,
    "matchCase" | "matchEntire" | "scope" | "searchBy" | "lookIn"
  >
>;

const DEFAULT_OPTIONS: Options = {
  matchCase: false,
  matchEntire: false,
  scope: "sheet",
  searchBy: "rows",
  lookIn: "formulas",
};

type Remembered = {
  searchText: string;
  replaceText: string;
  options: Options;
  showOptions: boolean;
};

const SearchReplace: React.FC<{
  getContainer: () => HTMLDivElement;
}> = ({ getContainer }) => {
  const { context, setContext, refs } = useContext(WorkbookContext);
  const { findAndReplace, button } = locale(context);
  // Excel keeps what was typed and the options between openings
  const remembered = _.get(
    refs.globalCache as unknown as Record<string, unknown>,
    "searchDialog.remembered"
  ) as Remembered | undefined;
  const [searchText, setSearchText] = useState(remembered?.searchText ?? "");
  const [replaceText, setReplaceText] = useState(remembered?.replaceText ?? "");
  const [options, setOptions] = useState<Options>(
    remembered?.options ?? DEFAULT_OPTIONS
  );
  const [showOptions, setShowOptions] = useState<boolean>(
    remembered?.showOptions ?? false
  );
  const [showReplace, setShowReplace] = useState(!!context.showReplace);
  const [results, setResults] = useState<FindMatch[]>([]);
  const [selected, setSelected] = useState<string>();
  const [status, setStatus] = useState("");
  const { showAlert } = useAlert();
  const findInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setShowReplace(!!context.showReplace);
    findInput.current?.focus();
    findInput.current?.select();
  }, [context.showReplace]);

  useEffect(() => {
    _.set(refs.globalCache, "searchDialog.remembered", {
      searchText,
      replaceText,
      options,
      showOptions,
    });
  }, [options, refs.globalCache, replaceText, searchText, showOptions]);

  // Replace only looks in formulas (as in Excel)
  const effective: Options = useMemo(
    () => (showReplace ? { ...options, lookIn: "formulas" } : options),
    [options, showReplace]
  );

  const closeDialog = useCallback(() => {
    _.set(refs.globalCache, "searchDialog.mouseEnter", false);
    setContext((draftCtx) => {
      draftCtx.showSearch = false;
      draftCtx.showReplace = false;
    });
    // give the keyboard back to the sheet
    setTimeout(() => refs.cellInput.current?.focus());
  }, [refs.cellInput, refs.globalCache, setContext]);

  const setOption = useCallback(
    <K extends keyof Options>(key: K, value: Options[K]) =>
      setOptions((o) => ({ ...o, [key]: value })),
    []
  );

  const matchKey = (m: { sheetId: string; r: number; c: number }) =>
    `${m.sheetId}:${m.r}:${m.c}`;

  const notFound = useCallback(() => {
    setStatus(findAndReplace.noFindTip);
  }, [findAndReplace.noFindTip]);

  const onFindNext = useCallback(
    (backwards = false) => {
      if (!searchText) {
        setStatus(findAndReplace.searchInputTip);
        return;
      }
      if (findAllMatches(context, searchText, effective).length === 0) {
        notFound();
        return;
      }
      setStatus("");
      setContext((ctx) => {
        findNextMatch(ctx, searchText, effective, backwards);
      });
    },
    [
      context,
      effective,
      findAndReplace.searchInputTip,
      notFound,
      searchText,
      setContext,
    ]
  );

  const onFindAll = useCallback(() => {
    if (!searchText) {
      setStatus(findAndReplace.searchInputTip);
      return;
    }
    const found = findAllMatches(context, searchText, effective);
    setResults(found);
    setSelected(undefined);
    if (found.length === 0) {
      notFound();
      return;
    }
    setStatus(replaceHtml(findAndReplace.foundCount, { count: found.length }));
    setSelected(matchKey(found[0]));
    setContext((ctx) => {
      selectMatch(ctx, found[0]);
    });
  }, [
    context,
    effective,
    findAndReplace.foundCount,
    findAndReplace.searchInputTip,
    notFound,
    searchText,
    setContext,
  ]);

  const onReplace = useCallback(() => {
    if (!isAllowEdit(context)) {
      setStatus(findAndReplace.modeTip);
      return;
    }
    if (!searchText) {
      setStatus(findAndReplace.searchInputTip);
      return;
    }
    if (findAllMatches(context, searchText, effective).length === 0) {
      notFound();
      return;
    }
    setStatus("");
    setResults([]);
    setContext((ctx) => {
      replaceNextMatch(ctx, searchText, replaceText, effective);
    });
  }, [
    context,
    effective,
    findAndReplace.modeTip,
    findAndReplace.searchInputTip,
    notFound,
    replaceText,
    searchText,
    setContext,
  ]);

  const onReplaceAll = useCallback(() => {
    if (!isAllowEdit(context)) {
      setStatus(findAndReplace.modeTip);
      return;
    }
    if (!searchText) {
      setStatus(findAndReplace.searchInputTip);
      return;
    }
    const count = findAllMatches(context, searchText, effective).length;
    setResults([]);
    if (count === 0) {
      notFound();
      return;
    }
    // one context update: Replace All is a single undo step
    setContext((ctx) => {
      replaceAllMatches(ctx, searchText, replaceText, effective);
    });
    const msg = replaceHtml(findAndReplace.replacedCount, { count });
    setStatus(msg);
    showAlert(msg);
  }, [
    context,
    effective,
    findAndReplace.modeTip,
    findAndReplace.replacedCount,
    findAndReplace.searchInputTip,
    notFound,
    replaceText,
    searchText,
    setContext,
    showAlert,
  ]);

  const onInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      e.stopPropagation();
      if (e.key === "Enter") {
        e.preventDefault();
        onFindNext(e.shiftKey);
      } else if (e.key === "Escape") {
        e.preventDefault();
        closeDialog();
      }
    },
    [closeDialog, onFindNext]
  );

  const getInitialPosition = useCallback((container: HTMLDivElement) => {
    const rect = container.getBoundingClientRect();
    return {
      left: Math.max(0, (rect.width - 660) / 2),
      top: Math.max(0, (rect.height - 260) / 3),
    };
  }, []);

  const [initialPosition] = useState(() => getInitialPosition(getContainer()));

  const actionButton = (
    id: string,
    label: string,
    onClick: () => void,
    primary = false
  ) => (
    <div
      id={id}
      className={`button-basic ${
        primary ? "button-primary" : "button-default"
      }`}
      onClick={onClick}
      onKeyDown={activateOnKey}
      role="button"
      tabIndex={0}
    >
      {label}
    </div>
  );

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      id="fortune-search-replace"
      className="fortune-search-replace fortune-dialog"
      role="dialog"
      aria-label={showReplace ? findAndReplace.replace : findAndReplace.find}
      style={initialPosition}
      onMouseEnter={() => {
        _.set(refs.globalCache, "searchDialog.mouseEnter", true);
      }}
      onMouseLeave={() => {
        _.set(refs.globalCache, "searchDialog.mouseEnter", false);
      }}
      onMouseDown={(e) => {
        const { nativeEvent } = e;
        onSearchDialogMoveStart(refs.globalCache, nativeEvent, getContainer());
        e.stopPropagation();
      }}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") closeDialog();
      }}
    >
      <div className="container" onMouseDown={(e) => e.stopPropagation()}>
        <div
          className="icon-close fortune-modal-dialog-icon-close"
          onClick={closeDialog}
          onKeyDown={activateOnKey}
          role="button"
          aria-label={button.close}
          tabIndex={0}
        >
          <SVGIcon name="close" />
        </div>
        <div className="tabBox" role="tablist">
          <span
            id="searchTab"
            role="tab"
            aria-selected={!showReplace}
            className={showReplace ? "" : "on"}
            onClick={() => setShowReplace(false)}
            onKeyDown={activateOnKey}
            tabIndex={0}
          >
            {findAndReplace.find}
          </span>
          <span
            id="replaceTab"
            role="tab"
            aria-selected={showReplace}
            className={showReplace ? "on" : ""}
            onClick={() => setShowReplace(true)}
            onKeyDown={activateOnKey}
            tabIndex={0}
          >
            {findAndReplace.replace}
          </span>
        </div>
        <div className="ctBox">
          <label className="field" htmlFor="fortune-find-what">
            <span>{findAndReplace.findTextbox}</span>
            <input
              id="fortune-find-what"
              ref={findInput}
              className="formulaInputFocus"
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              spellCheck="false"
              title={findAndReplace.wildcardHint}
              onKeyDown={onInputKeyDown}
              value={searchText}
              onChange={(e) => {
                setSearchText(e.target.value);
                setStatus("");
              }}
            />
          </label>
          {showReplace && (
            <label className="field" htmlFor="fortune-replace-with">
              <span>{findAndReplace.replaceTextbox}</span>
              <input
                id="fortune-replace-with"
                className="formulaInputFocus"
                spellCheck="false"
                onKeyDown={onInputKeyDown}
                value={replaceText}
                onChange={(e) => setReplaceText(e.target.value)}
              />
            </label>
          )}
          {showOptions && (
            <div className="options">
              <div className="option-selects">
                <label className="field" htmlFor="fortune-find-within">
                  <span>{findAndReplace.within}</span>
                  <select
                    id="fortune-find-within"
                    value={options.scope}
                    onChange={(e) =>
                      setOption("scope", e.target.value as Options["scope"])
                    }
                  >
                    <option value="sheet">{findAndReplace.withinSheet}</option>
                    <option value="workbook">
                      {findAndReplace.withinWorkbook}
                    </option>
                  </select>
                </label>
                <label className="field" htmlFor="fortune-find-search">
                  <span>{findAndReplace.searchBy}</span>
                  <select
                    id="fortune-find-search"
                    value={options.searchBy}
                    onChange={(e) =>
                      setOption(
                        "searchBy",
                        e.target.value as Options["searchBy"]
                      )
                    }
                  >
                    <option value="rows">{findAndReplace.byRows}</option>
                    <option value="columns">{findAndReplace.byColumns}</option>
                  </select>
                </label>
                <label className="field" htmlFor="fortune-find-lookin">
                  <span>{findAndReplace.lookIn}</span>
                  <select
                    id="fortune-find-lookin"
                    value={effective.lookIn}
                    disabled={showReplace}
                    onChange={(e) =>
                      setOption("lookIn", e.target.value as Options["lookIn"])
                    }
                  >
                    <option value="formulas">
                      {findAndReplace.lookInFormulas}
                    </option>
                    <option value="values">
                      {findAndReplace.lookInValues}
                    </option>
                    <option value="notes">{findAndReplace.lookInNotes}</option>
                  </select>
                </label>
              </div>
              <div className="option-checks">
                <label htmlFor="fortune-find-case">
                  <input
                    id="fortune-find-case"
                    type="checkbox"
                    checked={options.matchCase}
                    onChange={(e) => setOption("matchCase", e.target.checked)}
                  />
                  {findAndReplace.matchCase}
                </label>
                <label htmlFor="fortune-find-entire">
                  <input
                    id="fortune-find-entire"
                    type="checkbox"
                    checked={options.matchEntire}
                    onChange={(e) => setOption("matchEntire", e.target.checked)}
                  />
                  {findAndReplace.matchEntire}
                </label>
                <div className="hint">{findAndReplace.wildcardHint}</div>
              </div>
            </div>
          )}
        </div>
        <div className="btnBox">
          <div
            className="button-basic button-default options-toggle"
            onClick={() => setShowOptions((v) => !v)}
            onKeyDown={activateOnKey}
            role="button"
            aria-expanded={showOptions}
            tabIndex={0}
          >
            {findAndReplace.optionsBtn} {showOptions ? "«" : "»"}
          </div>
          <div className="spacer" />
          {showReplace && (
            <>
              {actionButton("replaceAllBtn", findAndReplace.allReplaceBtn, () =>
                onReplaceAll()
              )}
              {actionButton("replaceBtn", findAndReplace.replaceBtn, () =>
                onReplace()
              )}
            </>
          )}
          {actionButton("searchAllBtn", findAndReplace.allFindBtn, () =>
            onFindAll()
          )}
          {actionButton("searchPrevBtn", findAndReplace.findPrevBtn, () =>
            onFindNext(true)
          )}
          {actionButton(
            "searchNextBtn",
            findAndReplace.findBtn,
            () => onFindNext(false),
            true
          )}
          {actionButton("searchCloseBtn", button.close, closeDialog)}
        </div>
        <div className="status" role="status" aria-live="polite">
          {status}
        </div>
        {results.length > 0 && (
          <div id="searchAllbox" role="table">
            <div className="boxTitle" role="row">
              <span role="columnheader">
                {findAndReplace.searchTargetSheet}
              </span>
              <span role="columnheader">{findAndReplace.searchTargetCell}</span>
              <span role="columnheader">
                {findAndReplace.searchTargetValue}
              </span>
              <span role="columnheader">
                {findAndReplace.searchTargetFormula}
              </span>
            </div>
            <div className="boxMain">
              {results.map((v) => {
                const key = matchKey(v);
                return (
                  <div
                    className={`boxItem ${selected === key ? "on" : ""}`}
                    key={key}
                    role="row"
                    aria-selected={selected === key}
                    onClick={() => {
                      setContext((draftCtx) => {
                        selectMatch(draftCtx, v);
                      });
                      setSelected(key);
                    }}
                    onKeyDown={activateOnKey}
                    tabIndex={0}
                  >
                    <span title={v.sheetName}>{v.sheetName}</span>
                    <span>{`$${v.cellPosition.replace(/(\d)/, "$$$1")}`}</span>
                    <span title={v.value}>{v.value}</span>
                    <span title={v.formula ?? ""}>{v.formula ?? ""}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchReplace;
