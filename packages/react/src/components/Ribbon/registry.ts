/**
 * Ribbon extension points.
 *
 * - `registerRibbonCommand(id, Component)`: a ribbon-native command (built
 *   from the ui primitives). An item id in the layout renders the command
 *   registered under that id; ids without one fall back to the legacy
 *   toolbar item of that name (`registerToolbarItem` / built-ins), so a
 *   command registered under a legacy name replaces the old control.
 * - `placeRibbonItem(id, { tab, group })`: put an item (e.g. a feature's
 *   toolbar item) into a group of the default ribbon.
 * - `registerRibbonGroup(tab, group, { after })`: add a whole group.
 * - `registerFileMenuItem(item)`: an entry of the File menu.
 *
 * Built-in commands register in ./commands (loaded with the other built-in
 * features on the first lookup).
 */
import type React from "react";
import type { Context, RibbonGroupConfig } from "@lofcz/tinysheet-core";
// eslint-disable-next-line import/no-cycle
import { loadBuiltinFeatures } from "../../features";
import type { ContextMenuActionHelpers } from "../ContextMenu/actions";
import type { RibbonItemSize } from "./types";

/** Props every ribbon command receives. */
export type RibbonCommandProps = {
  /** The item id it was placed under (one component may serve several). */
  id: string;
  /** "large" (icon over label) or "small" (32px), per layout and scaling. */
  size: RibbonItemSize;
};

export type RibbonCommandOptions = {
  /**
   * Legacy toolbar item names this command stands for: a custom
   * `settings.toolbarItems` list that names one of them shows the command.
   */
  aliases?: string[];
};

type CommandEntry = {
  Component: React.ComponentType<RibbonCommandProps>;
  options: RibbonCommandOptions;
};

const commands = new Map<string, CommandEntry[]>();

/**
 * Register a ribbon command. The latest registration of an id wins until
 * the returned function removes it.
 */
export function registerRibbonCommand(
  id: string,
  Component: React.ComponentType<RibbonCommandProps>,
  options: RibbonCommandOptions = {}
) {
  const entry = { Component, options };
  commands.set(id, [...(commands.get(id) ?? []), entry]);
  return () => {
    const list = commands.get(id) ?? [];
    const next = list.filter((e) => e !== entry);
    if (next.length) commands.set(id, next);
    else commands.delete(id);
  };
}

export function getRibbonCommand(id: string): CommandEntry | undefined {
  loadBuiltinFeatures();
  const list = commands.get(id);
  return list?.[list.length - 1];
}

export type RibbonPlacement = {
  /** Tab id: "home", "insert", "pageLayout", "formulas", "data", ... */
  tab: string;
  /** Group id in that tab (a new group with this id is added if missing). */
  group: string;
  size?: RibbonItemSize;
  /** Position in the group's entries (default: the end). */
  index?: number;
};

const placements: { id: string; placement: RibbonPlacement }[] = [];

/** Add an item to a group of the default ribbon. */
export function placeRibbonItem(id: string, placement: RibbonPlacement) {
  const entry = { id, placement };
  placements.push(entry);
  bump();
  return () => {
    const i = placements.indexOf(entry);
    if (i >= 0) placements.splice(i, 1);
    bump();
  };
}

export function getRibbonPlacements(): readonly {
  id: string;
  placement: RibbonPlacement;
}[] {
  loadBuiltinFeatures();
  return placements;
}

const groups: {
  tab: string;
  group: RibbonGroupConfig;
  after?: string;
}[] = [];

/** Add a group to a tab of the default ribbon (after `after`, or last). */
export function registerRibbonGroup(
  tab: string,
  group: RibbonGroupConfig,
  options: { after?: string } = {}
) {
  const entry = { tab, group, after: options.after };
  groups.push(entry);
  bump();
  return () => {
    const i = groups.indexOf(entry);
    if (i >= 0) groups.splice(i, 1);
    bump();
  };
}

export function getRegisteredRibbonGroups() {
  loadBuiltinFeatures();
  return groups;
}

export type FileMenuHelpers = ContextMenuActionHelpers;

export type FileMenuItem = {
  id: string;
  label: string | ((ctx: Context) => string);
  /** Icon name (ui/icons) of the entry. */
  icon?: string;
  shortcut?: string;
  /** Sort key: New 10, Open 20, Save As 30, Print 50. */
  order?: number;
  /** Hidden when this returns false. */
  visible?: (helpers: FileMenuHelpers) => boolean;
  onSelect: (helpers: FileMenuHelpers) => void;
};

const fileItems: FileMenuItem[] = [];

/** Add an entry to the File menu. */
export function registerFileMenuItem(item: FileMenuItem) {
  fileItems.push(item);
  bump();
  return () => {
    const i = fileItems.indexOf(item);
    if (i >= 0) fileItems.splice(i, 1);
    bump();
  };
}

export function getFileMenuItems(): readonly FileMenuItem[] {
  loadBuiltinFeatures();
  return fileItems;
}

/**
 * Registry version: changes on every placement / group / file item change,
 * so a mounted ribbon can rebuild its layout.
 */
let version = 0;
const listeners = new Set<() => void>();
function bump() {
  version += 1;
  listeners.forEach((l) => l());
}
export function subscribeRibbonRegistry(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function getRibbonRegistryVersion() {
  return version;
}
