/**
 * Builds the ribbon to render from its config: the default layout (with
 * the groups and items features registered) or `settings.ribbon`, filtered
 * by `settings.toolbarItems`, labels translated, entries normalised into
 * columns.
 */
import {
  defaultSettings,
  RibbonEntryConfig,
  RibbonGroupConfig,
  RibbonItemConfig,
  RibbonLocale,
  RibbonTabConfig,
} from "@lofcz/tinysheet-core";
import _ from "lodash";
import { getToolbarItemRenderer } from "../../extensions";
import { defaultRibbon, quickAccessItems } from "./tabs";
import {
  getRegisteredRibbonGroups,
  getRibbonCommand,
  getRibbonPlacements,
} from "./registry";
import type { RibbonColumn, RibbonGroup, RibbonItem, RibbonTab } from "./types";

/** Toolbar item names the legacy renderer knows (built-in). */
const LEGACY_ITEMS = new Set(
  defaultSettings.toolbarItems.filter((name) => name !== "|")
);

const normalizeItem = (item: RibbonItemConfig): RibbonItem =>
  typeof item === "string"
    ? { id: item, size: "small" }
    : { id: item.id, size: item.size ?? "small" };

const isRows = (
  entry: RibbonEntryConfig
): entry is { rows: RibbonItemConfig[][] } =>
  typeof entry === "object" && "rows" in entry;

/** The default layout plus the features' groups and placements. */
function withRegistrations(tabs: RibbonTabConfig[]): RibbonTabConfig[] {
  const out: RibbonTabConfig[] = tabs.map((t) => ({
    ...t,
    groups: t.groups.map((g) => ({ ...g, items: [...g.items] })),
  }));
  const tabOf = (id: string) => {
    let tab = out.find((t) => t.id === id);
    if (!tab) {
      tab = { id, groups: [] };
      out.push(tab);
    }
    return tab;
  };
  getRegisteredRibbonGroups().forEach(({ tab, group, after }) => {
    const t = tabOf(tab);
    const copy = { ...group, items: [...group.items] };
    const at = after ? t.groups.findIndex((g) => g.id === after) : -1;
    if (at >= 0) t.groups.splice(at + 1, 0, copy);
    else t.groups.push(copy);
  });
  getRibbonPlacements().forEach(({ id, placement }) => {
    const t = tabOf(placement.tab);
    let group = t.groups.find((g) => g.id === placement.group);
    if (!group) {
      group = { id: placement.group, items: [] };
      t.groups.push(group);
    }
    const item: RibbonItemConfig = placement.size
      ? { id, size: placement.size }
      : id;
    if (placement.index != null) group.items.splice(placement.index, 0, item);
    else group.items.push(item);
  });
  return out;
}

/** Item ids of a layout, in order. */
function layoutIds(tabs: RibbonTabConfig[]): string[] {
  const ids: string[] = [];
  tabs.forEach((t) =>
    t.groups.forEach((g) =>
      g.items.forEach((entry) => {
        if (isRows(entry))
          entry.rows.forEach((row) =>
            row.forEach((i) => ids.push(normalizeItem(i).id))
          );
        else ids.push(normalizeItem(entry).id);
      })
    )
  );
  return ids;
}

/**
 * A custom `settings.ribbon` may name a legacy toolbar item ("chart",
 * "comment"): it stands for the ribbon commands that took its place (the
 * commands whose `aliases` list it), in the default ribbon's order. Other
 * ids are kept (commands, items registered by features, unknown names).
 */
function expandLegacyItems(
  tabs: RibbonTabConfig[],
  defaultIds: () => string[]
): RibbonTabConfig[] {
  const expand = (item: RibbonItemConfig): RibbonItemConfig[] => {
    const { id } = normalizeItem(item);
    if (id === "|" || getRibbonCommand(id) || getToolbarItemRenderer(id))
      return [item];
    const ids = defaultIds().filter((cid) =>
      getRibbonCommand(cid)?.options.aliases?.includes(id)
    );
    if (ids.length === 0) return [item];
    const size = typeof item === "string" ? undefined : item.size;
    return ids.map((cid, i) => (i === 0 && size ? { id: cid, size } : cid));
  };
  return tabs.map((t) => ({
    ...t,
    groups: t.groups.map((g) => ({
      ...g,
      items: g.items.flatMap((entry): RibbonEntryConfig[] =>
        isRows(entry)
          ? [{ rows: entry.rows.map((row) => row.flatMap(expand)) }]
          : expand(entry)
      ),
    })),
  }));
}

export type ResolveOptions = {
  /** `settings.ribbon` (null: the default layout). */
  ribbon: RibbonTabConfig[] | null | undefined;
  /** `settings.toolbarItems`. */
  toolbarItems: string[];
  /** Show the Custom group (custom toolbar items, unplaced names). */
  customToolbarItems: number;
  t: RibbonLocale;
};

export type ResolvedRibbon = {
  tabs: RibbonTab[];
  quickAccess: string[];
  /** Names of `toolbarItems` the layout does not place (Custom group). */
  unplaced: string[];
};

export function resolveRibbon({
  ribbon,
  toolbarItems,
  customToolbarItems,
  t,
}: ResolveOptions): ResolvedRibbon {
  let defaults: string[] | null = null;
  const defaultIds = () => {
    if (!defaults) defaults = layoutIds(withRegistrations(defaultRibbon));
    return defaults;
  };
  const config = ribbon
    ? expandLegacyItems(ribbon, defaultIds)
    : withRegistrations(defaultRibbon);
  // the default list shows the whole ribbon; a custom list only its items
  const showAll =
    ribbon != null || _.isEqual(toolbarItems, defaultSettings.toolbarItems);
  const listed = new Set(toolbarItems);
  const known = (id: string) =>
    !!getRibbonCommand(id) ||
    LEGACY_ITEMS.has(id) ||
    !!getToolbarItemRenderer(id);
  const allowed = (id: string) => {
    if (showAll) return known(id);
    if (listed.has(id)) return true;
    return !!getRibbonCommand(id)?.options.aliases?.some((a) => listed.has(a));
  };

  // placed ids, and the legacy names their commands stand for (aliases):
  // a listed legacy name shown as its commands is not repeated in Custom
  const placed = new Set<string>();
  const place = (id: string) => {
    placed.add(id);
    getRibbonCommand(id)?.options.aliases?.forEach((a) => placed.add(a));
  };
  const tabs: RibbonTab[] = [];
  config.forEach((tabConfig) => {
    const groups: RibbonGroup[] = [];
    tabConfig.groups.forEach((g: RibbonGroupConfig, gi) => {
      const columns: RibbonColumn[] = [];
      let pending: RibbonItem[] = [];
      const flush = () => {
        if (pending.length === 0) return;
        // loose small items: two rows, the first one fuller
        const half = Math.ceil(pending.length / 2);
        const rows =
          pending.length === 1
            ? [pending]
            : [pending.slice(0, half), pending.slice(half)];
        columns.push({ kind: "rows", rows });
        pending = [];
      };
      g.items.forEach((entry) => {
        if (isRows(entry)) {
          flush();
          const rows = entry.rows
            .map((row) => row.map(normalizeItem).filter((i) => allowed(i.id)))
            .filter((row) => row.length > 0);
          rows.flat().forEach((i) => place(i.id));
          if (rows.length) columns.push({ kind: "rows", rows });
          return;
        }
        const item = normalizeItem(entry);
        if (!allowed(item.id)) return;
        place(item.id);
        if (item.size === "large") {
          flush();
          columns.push({ kind: "large", item });
        } else {
          pending.push(item);
        }
      });
      flush();
      if (columns.length === 0) return;
      groups.push({
        id: g.id,
        label: g.label ?? t.groups[g.id] ?? g.id,
        icon: g.icon,
        columns,
        priority: g.priority ?? tabConfig.groups.length - 1 - gi,
      });
    });
    tabs.push({
      id: tabConfig.id,
      label: tabConfig.label ?? t.tabs[tabConfig.id] ?? tabConfig.id,
      groups,
    });
  });

  const quickAccess = quickAccessItems.filter((id) => allowed(id));
  quickAccess.forEach(place);

  // names listed but not placed, and hosts' custom buttons: a Custom group
  // at the end of the first tab
  const unplaced = showAll
    ? []
    : toolbarItems.filter((n) => n !== "|" && !placed.has(n));
  if (unplaced.length || customToolbarItems > 0) {
    let first = tabs[0];
    if (!first) {
      first = { id: "home", label: t.tabs.home, groups: [] };
      tabs.push(first);
    }
    const items: RibbonItem[] = unplaced.map((id) => ({ id, size: "small" }));
    const half = Math.ceil(items.length / 2);
    first.groups.push({
      id: "custom",
      label: t.groups.custom,
      columns:
        items.length > 0
          ? [
              {
                kind: "rows",
                rows: [items.slice(0, half), items.slice(half)].filter(
                  (r) => r.length
                ),
              },
            ]
          : [],
      priority: -1,
    });
  }

  return {
    tabs: tabs.filter((tab) => tab.groups.length > 0),
    quickAccess,
    unplaced,
  };
}
