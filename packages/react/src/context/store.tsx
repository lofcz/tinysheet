import React, {
  useCallback,
  useContext,
  useRef,
  useSyncExternalStore,
} from "react";
import type { Context } from "@lofcz/tinysheet-core";
import _ from "lodash";
import WorkbookContext, { WorkbookContextValue } from ".";

/** Everything in the workbook context value except the sheet context. */
export type WorkbookApi = Omit<WorkbookContextValue, "context">;

/**
 * Holds the latest workbook context outside React state so components can
 * subscribe to the part they use instead of re-rendering on every change.
 *
 * Workbook calls `update` while rendering (so everything rendered in the same
 * pass reads the new state) and `emit` once committed, which re-renders only
 * the subscribers whose selection changed.
 */
export class WorkbookStore {
  private state: Context;

  private api: WorkbookApi;

  private dirty = false;

  private listeners = new Set<() => void>();

  constructor(state: Context, api: WorkbookApi) {
    this.state = state;
    this.api = api;
  }

  getState = () => this.state;

  getApi = () => this.api;

  update(state: Context, api: WorkbookApi) {
    if (state === this.state && api === this.api) return;
    this.state = state;
    this.api = api;
    this.dirty = true;
  }

  emit() {
    if (!this.dirty) return;
    this.dirty = false;
    this.listeners.forEach((l) => l());
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
}

export const WorkbookStoreContext = React.createContext<WorkbookStore | null>(
  null
);

/**
 * Subscribes to one slice of the workbook context: the component re-renders
 * only when `selector(context)` changes (per `isEqual`, default Object.is).
 * Outside a Workbook it falls back to the plain WorkbookContext.
 */
export function useWorkbookSelector<T>(
  selector: (ctx: Context) => T,
  isEqual: (a: T, b: T) => boolean = Object.is
): T {
  const store = useContext(WorkbookStoreContext);
  const fallback = useContext(WorkbookContext);
  const last = useRef<{ state: Context; value: T } | null>(null);
  const getSnapshot = () => {
    const state = store ? store.getState() : fallback.context;
    const prev = last.current;
    if (prev && prev.state === state) return prev.value;
    const value = selector(state);
    if (prev && isEqual(prev.value, value)) {
      prev.state = state;
      return prev.value;
    }
    last.current = { state, value };
    return value;
  };
  const subscribe = useCallback(
    (cb: () => void) => (store ? store.subscribe(cb) : () => {}),
    [store]
  );
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * A WorkbookContext value whose `context` records which fields are read.
 * Reads always see the latest state (so handlers and effects never act on
 * a stale snapshot); `keys`/`all` say what the subtree depends on.
 */
type Tracker = {
  state: Context;
  api: WorkbookApi;
  keys: Set<PropertyKey>;
  all: boolean;
  value: WorkbookContextValue;
};

function createTracker(
  store: WorkbookStore,
  state: Context,
  api: WorkbookApi
): Tracker {
  const tracker: Tracker = {
    state,
    api,
    keys: new Set(),
    all: false,
    value: null as unknown as WorkbookContextValue,
  };
  const latest = store.getState as () => any;
  // The target is a blank object: the state itself is frozen by immer, and
  // a proxy over a frozen target could not return newer values.
  const context = new Proxy({} as Context, {
    get(target, key) {
      tracker.keys.add(key);
      return latest()[key];
    },
    has(target, key) {
      tracker.keys.add(key);
      return key in latest();
    },
    ownKeys() {
      tracker.all = true;
      return Reflect.ownKeys(latest());
    },
    getOwnPropertyDescriptor(target, key) {
      tracker.keys.add(key);
      const d = Reflect.getOwnPropertyDescriptor(latest(), key);
      return d && { ...d, configurable: true };
    },
    // the context is immutable outside setContext, as the frozen state was
    set: () => false,
    defineProperty: () => false,
    deleteProperty: () => false,
  });
  tracker.value = { ...api, context };
  return tracker;
}

/**
 * Small UI-state fields that handlers often reassign with equal content
 * (e.g. the selection on mouseup): compared structurally, so an unchanged
 * selection does not re-render the toolbar.
 */
const STRUCTURAL_KEYS = new Set<PropertyKey>([
  "luckysheet_select_save",
  "luckysheet_selection_range",
  "luckysheetTableContentHW",
  "formulaRangeHighlight",
  "contextMenu",
]);

function sliceChanged(tracker: Tracker, next: Context) {
  if (tracker.all) return true;
  const prev = tracker.state as any;
  const cur = next as any;
  let changed = false;
  tracker.keys.forEach((k) => {
    if (
      !changed &&
      prev[k] !== cur[k] &&
      !(STRUCTURAL_KEYS.has(k) && _.isEqual(prev[k], cur[k]))
    ) {
      changed = true;
    }
  });
  return changed;
}

const noSubscribe = () => () => {};

/**
 * Re-renders the WorkbookContext consumers below it only when a context
 * field that they read (during render, in effects or in handlers) changes.
 * Consumers keep calling useContext(WorkbookContext) unchanged.
 *
 * Give it a stable `children` element (a module constant or a memoized
 * element), otherwise the subtree re-renders with its parent anyway. The
 * scope itself should be rendered with its parent (not memoized): it then
 * applies a changed slice in the parent's render pass instead of a second
 * one after the store notifies it.
 */
export const TrackedScope: React.FC<{ children?: React.ReactNode }> = ({
  children,
}) => {
  const store = useContext(WorkbookStoreContext);
  const parent = useContext(WorkbookContext);
  const tracker = useRef<Tracker | null>(null);
  const getSnapshot = () => {
    // outside a Workbook (tests, custom providers): pass the parent through
    if (!store) return parent;
    const state = store.getState();
    const api = store.getApi();
    const t = tracker.current;
    if (t && t.api === api) {
      if (t.state === state) return t.value;
      if (!sliceChanged(t, state)) {
        t.state = state;
        return t.value;
      }
    }
    tracker.current = createTracker(store, state, api);
    return tracker.current.value;
  };
  const value = useSyncExternalStore(
    store ? store.subscribe : noSubscribe,
    getSnapshot,
    getSnapshot
  );
  return (
    <WorkbookContext.Provider value={value}>
      {children}
    </WorkbookContext.Provider>
  );
};

/** The Workbook's providers: its store and the (unscoped) context value. */
export const WorkbookProvider: React.FC<{
  store: WorkbookStore;
  value: WorkbookContextValue;
  children?: React.ReactNode;
}> = ({ store, value, children }) => (
  <WorkbookStoreContext.Provider value={store}>
    <WorkbookContext.Provider value={value}>
      {children}
    </WorkbookContext.Provider>
  </WorkbookStoreContext.Provider>
);
