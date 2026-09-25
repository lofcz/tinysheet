/**
 * The ribbon model: RibbonTab → RibbonGroup → RibbonItem (Excel's
 * structure). The config types live in the core package (they are also
 * `settings.ribbon`); this file adds the resolved forms the ribbon renders.
 */
import type {
  RibbonEntryConfig,
  RibbonGroupConfig,
  RibbonItemConfig,
  RibbonTabConfig,
} from "@lofcz/tinysheet-core";

export type {
  RibbonEntryConfig,
  RibbonGroupConfig,
  RibbonItemConfig,
  RibbonTabConfig,
};

export type RibbonItemSize = "large" | "small";

/** An item after normalisation. */
export type RibbonItem = { id: string; size: RibbonItemSize };

/**
 * A column of a group: one large item, or small items in rows (two rows
 * by default; flat small items flow into rows of their own).
 */
export type RibbonColumn =
  | { kind: "large"; item: RibbonItem }
  | { kind: "rows"; rows: RibbonItem[][] };

export type RibbonGroup = {
  id: string;
  label: string;
  icon?: string;
  columns: RibbonColumn[];
  /** Reduce order (lower first). */
  priority: number;
};

export type RibbonTab = {
  id: string;
  label: string;
  groups: RibbonGroup[];
};
