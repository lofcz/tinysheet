import React, {
  useContext,
  useState,
  useMemo,
  useCallback,
  useRef,
  useLayoutEffect,
} from "react";
import {
  dialogsLocale,
  locale,
  saveHyperlink,
  LinkCardProps,
  removeHyperlink,
  replaceHtml,
  getRangetxt,
  goToLink,
  isLinkValid,
  normalizeSelection,
  onRangeSelectionModalMoveStart,
} from "@lofcz/tinysheet-core";
import "./index.css";
import _ from "lodash";
import WorkbookContext from "../../context";
import {
  Copy,
  Pencil,
  SquareDashedMousePointer,
  Unlink,
  X,
} from "lucide-react";
import { Button, ICON_STROKE, IconButton } from "../ui";
import type { LucideIcon } from "../ui";
import "../ui/form.css";

export const LinkEditCard: React.FC<LinkCardProps> = ({
  r,
  c,
  rc,
  originText,
  originType,
  originAddress,
  isEditing,
  position,
  selectingCellRange,
}) => {
  const { context, setContext, refs } = useContext(WorkbookContext);
  const [linkText, setLinkText] = useState<string>(originText);
  const [linkAddress, setLinkAddress] = useState<string>(originAddress);
  const [linkType, setLinkType] = useState<string>(originType);
  const { insertLink, linkTypeList, button } = locale(context);
  const dt = dialogsLocale(context).titles;
  const lastCell = useRef(
    normalizeSelection(context, [{ row: [r, r], column: [c, c] }])
  );
  const skipCellRangeSet = useRef(true);
  const isLinkAddressValid = isLinkValid(context, linkType, linkAddress);

  const tooltip = (
    <div className="validation-input-tip">{isLinkAddressValid.tooltip}</div>
  );

  const hideLinkCard = useCallback(() => {
    _.set(refs.globalCache, "linkCard.mouseEnter", false);
    setContext((draftCtx) => {
      draftCtx.linkCard = undefined;
    });
  }, [refs.globalCache, setContext]);

  const setRangeModalVisible = useCallback(
    (visible: boolean) =>
      setContext((draftCtx) => {
        draftCtx.luckysheet_select_save! = lastCell.current!;
        if (draftCtx.linkCard != null)
          draftCtx.linkCard.selectingCellRange = visible;
      }),
    [setContext]
  );

  const containerEvent = useMemo(
    () => ({
      onMouseEnter: () => _.set(refs.globalCache, "linkCard.mouseEnter", true),
      onMouseLeave: () => _.set(refs.globalCache, "linkCard.mouseEnter", false),
      onMouseDown: (e: React.MouseEvent<HTMLDivElement, MouseEvent>) =>
        e.stopPropagation(),
      onMouseMove: (e: React.MouseEvent<HTMLDivElement, MouseEvent>) =>
        e.stopPropagation(),
      onMouseUp: (e: React.MouseEvent<HTMLDivElement, MouseEvent>) =>
        e.stopPropagation(),
      onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) =>
        e.stopPropagation(),
      onDoubleClick: (e: React.MouseEvent<HTMLDivElement, MouseEvent>) =>
        e.stopPropagation(),
    }),
    [refs.globalCache]
  );

  const renderBottomButton = useCallback(
    (onOk: () => void, onCancel: () => void) => (
      <div className="ts-dialog-footer">
        <Button variant="secondary" onClick={onCancel}>
          {button.cancel}
        </Button>
        <Button variant="primary" onClick={onOk}>
          {button.confirm}
        </Button>
      </div>
    ),
    [button]
  );

  const cardText = dialogsLocale(context).linkCard;
  const renderToolbarButton = useCallback(
    (icon: LucideIcon, label: string, onClick: () => void) => (
      <IconButton icon={icon} label={label} size="sm" onClick={onClick} />
    ),
    []
  );

  useLayoutEffect(() => {
    setLinkAddress(originAddress);
    setLinkText(originText);
    setLinkType(originType);
  }, [rc, originAddress, originText, originType]);

  useLayoutEffect(() => {
    if (selectingCellRange) {
      skipCellRangeSet.current = true;
    }
  }, [selectingCellRange]);

  useLayoutEffect(() => {
    if (skipCellRangeSet.current) {
      skipCellRangeSet.current = false;
      return;
    }
    if (selectingCellRange) {
      const len = _.size(context.luckysheet_select_save);
      if (len > 0) {
        setLinkAddress(
          getRangetxt(
            context,
            context.currentSheetId,
            context.luckysheet_select_save![len - 1],
            ""
          )
        );
      }
    }
  }, [context, selectingCellRange]);

  if (!isEditing) {
    return (
      <div
        {...containerEvent}
        onKeyDown={(e) => {
          e.stopPropagation();
        }}
        className="fortune-link-modify-modal link-toolbar"
        style={{ left: position.cellLeft + 20, top: position.cellBottom }}
      >
        <div
          className="link-content"
          onClick={() => {
            setContext((draftCtx) =>
              goToLink(
                draftCtx,
                r,
                c,
                linkType,
                linkAddress,
                refs.scrollbarX.current!,
                refs.scrollbarY.current!
              )
            );
          }}
          tabIndex={0}
        >
          {linkType === "webpage"
            ? insertLink.openLink
            : replaceHtml(insertLink.goTo, { linkAddress })}
        </div>
        {context.allowEdit === true && <div className="divider" />}
        {context.allowEdit === true &&
          linkType === "webpage" &&
          renderToolbarButton(Copy, cardText.copy, () => {
            navigator.clipboard.writeText(originAddress);
            hideLinkCard();
          })}
        {context.allowEdit === true &&
          renderToolbarButton(Pencil, cardText.edit, () =>
            setContext((draftCtx) => {
              if (draftCtx.linkCard != null && draftCtx.allowEdit) {
                draftCtx.linkCard.isEditing = true;
              }
            })
          )}
        {context.allowEdit === true && <div className="divider" />}
        {context.allowEdit === true &&
          renderToolbarButton(Unlink, cardText.remove, () =>
            setContext((draftCtx) => {
              _.set(refs.globalCache, "linkCard.mouseEnter", false);
              removeHyperlink(draftCtx, r, c);
            })
          )}
      </div>
    );
  }

  return selectingCellRange ? (
    <div
      className="ts-dialog fortune-link-modify-modal range-selection-modal"
      role="dialog"
      aria-label={insertLink.selectCellRange}
      style={{ left: position.cellLeft, top: position.cellBottom + 5 }}
      {..._.omit(containerEvent, ["onMouseDown", "onMouseMove", "onMouseUp"])}
      onMouseDown={(e) => {
        const { nativeEvent } = e;
        onRangeSelectionModalMoveStart(context, refs.globalCache, nativeEvent);
        e.stopPropagation();
      }}
    >
      <div className="ts-dialog-header">
        <h2 className="ts-dialog-title modal-title">
          {insertLink.selectCellRange}
        </h2>
        <button
          type="button"
          className="ts-dialog-close"
          aria-label={button.close}
          title={button.close}
          onClick={() => setRangeModalVisible(false)}
        >
          <X size={16} strokeWidth={ICON_STROKE} aria-hidden />
        </button>
      </div>
      <input
        {...containerEvent}
        className={`range-selection-input ${
          !linkAddress || isLinkAddressValid.isValid ? "" : "error-input"
        }`}
        placeholder={insertLink.cellRangePlaceholder}
        onChange={(e) => setLinkAddress(e.target.value)}
        value={linkAddress}
      />
      {tooltip}
      <div className="modal-footer">
        {renderBottomButton(
          () => {
            if (isLinkAddressValid.isValid) setRangeModalVisible(false);
          },
          () => {
            setLinkAddress(originAddress);
            setRangeModalVisible(false);
          }
        )}
      </div>
    </div>
  ) : (
    <div
      className="ts-dialog fortune-link-modify-modal fortune-link-dialog"
      role="dialog"
      aria-labelledby="fortune-link-dialog-title"
      style={{
        left: position.cellLeft + 20,
        top: position.cellBottom,
      }}
      {...containerEvent}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") {
          e.preventDefault();
          hideLinkCard();
        }
      }}
    >
      <div className="ts-dialog-header">
        <h2 className="ts-dialog-title" id="fortune-link-dialog-title">
          {originAddress ? dt.editHyperlink : dt.hyperlink}
        </h2>
        <button
          type="button"
          className="ts-dialog-close"
          aria-label={button.close}
          title={button.close}
          onClick={hideLinkCard}
        >
          <X size={16} strokeWidth={ICON_STROKE} aria-hidden />
        </button>
      </div>
      <div className="fortune-link-modify-line">
        <div className="fortune-link-modify-title">{insertLink.linkText}</div>
        <input
          className="fortune-link-modify-input"
          spellCheck="false"
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          value={linkText}
          onChange={(e) => setLinkText(e.target.value)}
        />
      </div>
      <div className="fortune-link-modify-line">
        <div className="fortune-link-modify-title">{insertLink.linkType}</div>
        <select
          className="fortune-link-modify-select"
          value={linkType}
          onChange={(e) => {
            if (e.target.value === "sheet") {
              if (!linkText) {
                setLinkText(context.luckysheetfile[0].name);
              }
              setLinkAddress(context.luckysheetfile[0].name);
            } else {
              setLinkAddress("");
            }
            if (e.target.value === "cellrange") setRangeModalVisible(true);
            setLinkType(e.target.value);
          }}
        >
          {linkTypeList.map((type) => (
            <option key={type.value} value={type.value}>
              {type.text}
            </option>
          ))}
        </select>
      </div>
      <div className="fortune-link-modify-line">
        {linkType === "webpage" && (
          <>
            <div className="fortune-link-modify-title">
              {insertLink.linkAddress}
            </div>
            <input
              className={`fortune-link-modify-input ${
                !linkAddress || isLinkAddressValid.isValid ? "" : "error-input"
              }`}
              spellCheck="false"
              value={linkAddress}
              onChange={(e) => setLinkAddress(e.target.value)}
            />
            {tooltip}
          </>
        )}
        {linkType === "cellrange" && (
          <>
            <div className="fortune-link-modify-title">
              {insertLink.linkCell}
            </div>
            <input
              className={`fortune-link-modify-input ${
                !linkAddress || isLinkAddressValid.isValid ? "" : "error-input"
              }`}
              spellCheck="false"
              value={linkAddress}
              onChange={(e) => setLinkAddress(e.target.value)}
            />
            <button
              type="button"
              className="fortune-link-modify-cell-selector"
              aria-label={insertLink.selectCellRange}
              title={insertLink.selectCellRange}
              onClick={() => setRangeModalVisible(true)}
            >
              <SquareDashedMousePointer
                size={16}
                strokeWidth={ICON_STROKE}
                aria-hidden
              />
            </button>
            {tooltip}
          </>
        )}
        {linkType === "sheet" && (
          <>
            <div className="fortune-link-modify-title">
              {insertLink.linkSheet}
            </div>
            <select
              className="fortune-link-modify-select"
              onChange={(e) => {
                if (!linkText) setLinkText(e.target.value);
                setLinkAddress(e.target.value);
              }}
              value={linkAddress}
            >
              {context.luckysheetfile.map((sheet) => (
                <option key={sheet.id} value={sheet.name}>
                  {sheet.name}
                </option>
              ))}
            </select>
            {tooltip}
          </>
        )}
      </div>
      <div className="modal-footer">
        {renderBottomButton(() => {
          if (!isLinkAddressValid.isValid) return;
          _.set(refs.globalCache, "linkCard.mouseEnter", false);
          setContext((draftCtx) =>
            saveHyperlink(draftCtx, r, c, linkText, linkType, linkAddress)
          );
        }, hideLinkCard)}
      </div>
    </div>
  );
};

export default LinkEditCard;
