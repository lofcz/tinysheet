/**
 * Contextual tabs: tabs that show only while an object of their kind is
 * selected (Excel's Chart Design / Format for a chart; later Table Design,
 * PivotTable Analyze, Shape Format, Picture Format). They come after the
 * other tabs, grouped under an accented header ("Chart Tools").
 *
 *   registerContextualTabs({
 *     id: "chartTools",
 *     label: (ctx) => "Chart Tools",
 *     isActive: (ctx) => !!ctx.activeChart,
 *     tabs: (ctx) => [chartDesignTab(ctx), chartFormatTab(ctx)],
 *   });
 *
 * `activateRibbonTab(id)` shows a tab as soon as it exists (Excel shows
 * Chart Design when a chart is inserted); when the selection goes, the
 * ribbon returns to the tab that was showing before.
 */
import type { Context, RibbonTabConfig } from "@lofcz/tinysheet-core";
// eslint-disable-next-line import/no-cycle
import { loadBuiltinFeatures } from "../../features";

export type ContextualTabSet = {
  id: string;
  /** Header of the group ("Chart Tools"). */
  label: (ctx: Context) => string;
  /** Whether the object the tabs act on is selected. */
  isActive: (ctx: Context) => boolean;
  /** The tabs (their labels and group labels given). */
  tabs: (ctx: Context) => RibbonTabConfig[];
};

let sets: ContextualTabSet[] = [];
let version = 0;
const listeners = new Set<() => void>();

function bump() {
  version += 1;
  listeners.forEach((l) => l());
}

/** Add a set of contextual tabs; returns the function that removes it. */
export function registerContextualTabs(set: ContextualTabSet) {
  sets = [...sets.filter((s) => s.id !== set.id), set];
  bump();
  return () => {
    sets = sets.filter((s) => s !== set);
    bump();
  };
}

export function getContextualTabSets(): readonly ContextualTabSet[] {
  loadBuiltinFeatures();
  return sets;
}

export function subscribeContextualTabs(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getContextualTabsVersion() {
  return version;
}

let pendingTab: string | null = null;
let pendingSince = 0;
const tabListeners = new Set<(id: string) => void>();

/** A request not honoured within this time lapses (the object never came). */
const PENDING_MS = 1500;

/**
 * Show the ribbon tab `id` (a contextual tab may appear on the next
 * render: the request waits for it, briefly).
 */
export function activateRibbonTab(id: string) {
  pendingTab = id;
  pendingSince = Date.now();
  tabListeners.forEach((l) => l(id));
}

/** The requested tab not yet shown (taken by the ribbon). */
export function takePendingRibbonTab(available: (id: string) => boolean) {
  if (pendingTab && Date.now() - pendingSince > PENDING_MS) pendingTab = null;
  if (pendingTab && available(pendingTab)) {
    const id = pendingTab;
    pendingTab = null;
    return id;
  }
  return null;
}

export function subscribeRibbonTabRequests(listener: (id: string) => void) {
  tabListeners.add(listener);
  return () => {
    tabListeners.delete(listener);
  };
}
