import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { ChevronDown, ChevronUp, Pin } from "lucide-react";
import { ribbonLocale } from "@lofcz/tinysheet-core";
import WorkbookContext from "../../context";
import {
  Icon,
  ICON_LARGE_SIZE,
  ICON_STROKE,
  Popover,
  Tabs,
  Tooltip,
} from "../ui";
import { useToolbarItemRenderer } from "../Toolbar/items";
import { closeOpenToolbarPopup } from "../Toolbar/usePopup";
import CustomButton from "../Toolbar/CustomButton";
import Divider from "../Toolbar/Divider";
import FileMenu from "./FileMenu";
import { resolveRibbon } from "./layout";
import {
  getRibbonCommand,
  getRibbonRegistryVersion,
  subscribeRibbonRegistry,
} from "./registry";
import type { RibbonColumn, RibbonGroup, RibbonItem } from "./types";
import { GroupState, useRibbonScaling } from "./useRibbonScaling";
import { shortcutText } from "./commands/helpers";
import "./index.css";

type RenderLegacy = (name: string, key: string | number) => React.ReactNode;

/** One item: its ribbon command, else the legacy toolbar item. */
const RibbonItemView: React.FC<{
  item: RibbonItem;
  compact: boolean;
  renderLegacy: RenderLegacy;
}> = ({ item, compact, renderLegacy }) => {
  const command = getRibbonCommand(item.id);
  const size = compact ? "small" : item.size;
  if (command) {
    const { Component } = command;
    return (
      <div className="fortune-ribbon-item" data-item={item.id} data-size={size}>
        <Component id={item.id} size={size} />
      </div>
    );
  }
  if (item.id === "|") return <Divider />;
  return (
    <div
      className="fortune-ribbon-item fortune-ribbon-item--legacy"
      data-item={item.id}
    >
      {renderLegacy(item.id, item.id)}
    </div>
  );
};

/**
 * A compact group stacks its (now small) large buttons two rows high
 * instead of one small button per column.
 */
function stackLargeColumns(columns: RibbonColumn[]): RibbonColumn[] {
  const out: RibbonColumn[] = [];
  let run: RibbonItem[] = [];
  const flush = () => {
    if (run.length === 1) out.push({ kind: "large", item: run[0] });
    else if (run.length > 1) {
      const half = Math.ceil(run.length / 2);
      out.push({ kind: "rows", rows: [run.slice(0, half), run.slice(half)] });
    }
    run = [];
  };
  columns.forEach((col) => {
    if (col.kind === "large") run.push(col.item);
    else {
      flush();
      out.push(col);
    }
  });
  flush();
  return out;
}

const Columns: React.FC<{
  group: RibbonGroup;
  compact: boolean;
  renderLegacy: RenderLegacy;
}> = ({ group, compact, renderLegacy }) => {
  const { settings } = useContext(WorkbookContext);
  const column = (col: RibbonColumn, i: number) => {
    if (col.kind === "large") {
      return (
        <div
          className="fortune-ribbon-column fortune-ribbon-column--large"
          key={i}
        >
          <RibbonItemView
            item={col.item}
            compact={compact}
            renderLegacy={renderLegacy}
          />
        </div>
      );
    }
    return (
      <div
        className={`fortune-ribbon-column fortune-ribbon-column--rows${
          col.rows.length === 1 ? " fortune-ribbon-column--single" : ""
        }`}
        key={i}
      >
        {col.rows.map((row, ri) => (
          <div className="fortune-ribbon-row" key={ri}>
            {row.map((item) => (
              <RibbonItemView
                key={item.id}
                item={item}
                compact={compact}
                renderLegacy={renderLegacy}
              />
            ))}
          </div>
        ))}
      </div>
    );
  };
  return (
    <>
      {group.id === "custom" && settings.customToolbarItems.length > 0 && (
        <div className="fortune-ribbon-column fortune-ribbon-column--rows fortune-ribbon-column--single">
          <div className="fortune-ribbon-row">
            {settings.customToolbarItems.map((n) => (
              <CustomButton
                tooltip={n.tooltip}
                onClick={n.onClick}
                key={n.key}
                icon={n.icon}
                iconName={n.iconName}
              >
                {n.children}
              </CustomButton>
            ))}
          </div>
        </div>
      )}
      {(compact ? stackLargeColumns(group.columns) : group.columns).map(column)}
    </>
  );
};

/** A group: a Fika tool cluster with its label under it. */
const GroupView: React.FC<{
  group: RibbonGroup;
  state: GroupState;
  renderLegacy: RenderLegacy;
  optionsLabel: string;
}> = ({ group, state, renderLegacy, optionsLabel }) => {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  if (state === "collapsed") {
    return (
      <div
        className="fortune-ribbon-group fortune-ribbon-group--collapsed"
        role="group"
        aria-label={group.label}
        data-ribbon-group={group.id}
      >
        <div className="fortune-ribbon-cluster">
          <Tooltip label={group.label} disabled={open}>
            <button
              ref={anchorRef}
              type="button"
              className={`fortune-ribbon-group-button${open ? " ts-open" : ""}`}
              aria-label={optionsLabel.replace("{group}", group.label)}
              aria-haspopup="dialog"
              aria-expanded={open}
              data-group-button={group.id}
              onClick={() => setOpen((o) => !o)}
            >
              <Icon name={group.icon ?? "more"} size={ICON_LARGE_SIZE} />
              <ChevronDown size={12} strokeWidth={ICON_STROKE} aria-hidden />
            </button>
          </Tooltip>
        </div>
        <div className="fortune-ribbon-group-label">{group.label}</div>
        <Popover
          open={open}
          onOpenChange={setOpen}
          anchorRef={anchorRef}
          exclusive={false}
          variant="panel"
          className="fortune-ribbon-group-popover"
          role="dialog"
          aria-label={group.label}
        >
          <div
            className="fortune-ribbon-group fortune-ribbon-group--popup"
            role="toolbar"
            aria-label={group.label}
            data-ribbon-popup={group.id}
          >
            <div className="fortune-ribbon-cluster">
              <Columns
                group={group}
                compact={false}
                renderLegacy={renderLegacy}
              />
            </div>
            <div className="fortune-ribbon-group-label">{group.label}</div>
          </div>
        </Popover>
      </div>
    );
  }
  return (
    <div
      className="fortune-ribbon-group"
      role="group"
      aria-label={group.label}
      data-ribbon-group={group.id}
      data-state={state}
    >
      <div className="fortune-ribbon-cluster">
        <Columns
          group={group}
          compact={state === "compact"}
          renderLegacy={renderLegacy}
        />
      </div>
      <div className="fortune-ribbon-group-label">{group.label}</div>
    </div>
  );
};

const POPUP_SELECTOR =
  ".fortune-toolbar-combo-popup, .ts-popover, [role=menu], [role=dialog]";

/**
 * Left / Right / Home / End move between the buttons of the command row
 * (a toolbar); keys inside menus and inputs stay theirs.
 */
function onCommandsKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
  if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
  const target = e.target as HTMLElement;
  const isButton =
    target.tagName === "BUTTON" || target.getAttribute("role") === "button";
  if (!isButton || target.closest(POPUP_SELECTOR)) return;
  const buttons = Array.from(
    e.currentTarget.querySelectorAll<HTMLElement>('button, [role="button"]')
  ).filter(
    (el) =>
      el.tabIndex >= 0 &&
      !(el as HTMLButtonElement).disabled &&
      !el.closest(POPUP_SELECTOR) &&
      el.getClientRects().length > 0
  );
  const index = buttons.indexOf(target);
  if (index < 0) return;
  let next = index;
  if (e.key === "ArrowRight") next = (index + 1) % buttons.length;
  else if (e.key === "ArrowLeft")
    next = (index - 1 + buttons.length) % buttons.length;
  else if (e.key === "Home") next = 0;
  else next = buttons.length - 1;
  e.preventDefault();
  e.stopPropagation();
  buttons[next].focus();
}

/**
 * The ribbon (Excel's structure, Fika's look): File menu, segmented tabs
 * and quick access (Undo / Redo) on the tab row; the active tab's groups
 * on the command row, scaled to fit (useRibbonScaling). Ctrl+F1 or a
 * double-click on a tab collapses it to the tab row; a tab click then
 * shows its commands over the grid until the next click outside.
 */
const Ribbon: React.FC = () => {
  const { context, settings, refs } = useContext(WorkbookContext);
  const renderLegacy = useToolbarItemRenderer();
  const t = ribbonLocale(context);
  const registryVersion = useSyncExternalStore(
    subscribeRibbonRegistry,
    getRibbonRegistryVersion,
    getRibbonRegistryVersion
  );
  const { tabs, quickAccess } = useMemo(
    () =>
      resolveRibbon({
        ribbon: settings.ribbon,
        toolbarItems: settings.toolbarItems,
        customToolbarItems: settings.customToolbarItems.length,
        t,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      settings.ribbon,
      settings.toolbarItems,
      settings.customToolbarItems.length,
      t,
      registryVersion,
    ]
  );

  const [activeId, setActiveId] = useState<string>(() => tabs[0]?.id ?? "home");
  const active = tabs.find((tab) => tab.id === activeId) ?? tabs[0];
  const [collapsed, setCollapsed] = useState(false);
  const [peek, setPeek] = useState(false);
  const paneRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const showCommands = !collapsed || peek;

  const states = useRibbonScaling(
    showCommands ? (active?.id ?? null) : null,
    showCommands && active ? active.groups : [],
    rowRef,
    innerRef
  );

  const toggleCollapsed = useCallback(() => {
    closeOpenToolbarPopup();
    setPeek(false);
    setCollapsed((c) => !c);
  }, []);

  // Ctrl+F1 anywhere in the workbook
  useEffect(() => {
    const container = refs.workbookContainer.current;
    if (!container) return undefined;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F1" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        toggleCollapsed();
      }
    };
    container.addEventListener("keydown", onKeyDown);
    return () => container.removeEventListener("keydown", onKeyDown);
  }, [refs.workbookContainer, toggleCollapsed]);

  // a peeking command row closes on a click outside the ribbon and its
  // drop-downs, or Escape
  useEffect(() => {
    if (!peek) return undefined;
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (paneRef.current?.contains(target)) return;
      if (target.closest(".ts-popover, .fortune-toolbar-combo-popup")) return;
      if (target.closest(".fortune-modal-container, [role=dialog]")) return;
      setPeek(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) setPeek(false);
    };
    document.addEventListener("mousedown", onMouseDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [peek]);

  const selectTab = (id: string) => {
    closeOpenToolbarPopup();
    setActiveId(id);
    if (collapsed) setPeek(true);
  };

  if (!active) return null;
  return (
    <div
      ref={paneRef}
      className={[
        "fortune-ribbon",
        collapsed ? "fortune-ribbon--collapsed" : "",
        peek ? "fortune-ribbon--peek" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-active-tab={active.id}
    >
      <div className="fortune-ribbon-tabrow">
        <FileMenu />
        <Tabs
          tabs={tabs.map((tab) => ({ id: tab.id, label: tab.label }))}
          value={showCommands ? active.id : null}
          onChange={selectTab}
          onActiveTabClick={() => {
            if (collapsed) setPeek((p) => !p);
          }}
          onTabDoubleClick={toggleCollapsed}
          idPrefix="fortune-ribbon"
          aria-label={t.ribbon}
          className="fortune-ribbon-tabs"
        />
        <div className="fortune-ribbon-tabrow-end">
          {quickAccess.length > 0 && (
            <div
              className="fortune-ribbon-quick"
              role="toolbar"
              aria-label={t.quickAccess}
              onKeyDown={onCommandsKeyDown}
            >
              {quickAccess.map((id) => (
                <RibbonItemView
                  key={id}
                  item={{ id, size: "small" }}
                  compact
                  renderLegacy={renderLegacy}
                />
              ))}
            </div>
          )}
          <Tooltip
            label={collapsed ? t.expandRibbon : t.collapseRibbon}
            shortcut={shortcutText(t.collapseRibbonShortcut)}
          >
            <button
              type="button"
              className="ts-icon-btn fortune-ribbon-toggle"
              aria-label={collapsed ? t.expandRibbon : t.collapseRibbon}
              aria-expanded={!collapsed}
              onClick={toggleCollapsed}
            >
              {collapsed ? (
                <Pin size={16} strokeWidth={ICON_STROKE} aria-hidden />
              ) : (
                <ChevronUp size={16} strokeWidth={ICON_STROKE} aria-hidden />
              )}
            </button>
          </Tooltip>
        </div>
      </div>
      {showCommands && (
        <div
          ref={rowRef}
          className="fortune-ribbon-commands"
          role="tabpanel"
          id={`fortune-ribbon-panel-${active.id}`}
          aria-labelledby={`fortune-ribbon-tab-${active.id}`}
        >
          <div
            ref={innerRef}
            className="fortune-toolbar fortune-ribbon-groups"
            role="toolbar"
            aria-label={active.label}
            onKeyDown={onCommandsKeyDown}
          >
            {active.groups.map((group) => (
              <GroupView
                key={`${active.id}/${group.id}`}
                group={group}
                state={states[group.id] ?? "full"}
                renderLegacy={renderLegacy}
                optionsLabel={t.groupOptions}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Ribbon;
