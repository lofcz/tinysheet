import { useCallback, useSyncExternalStore } from "react";
import {
  prefersDarkColorScheme,
  resolveTheme,
  ThemeName,
  ThemeSetting,
} from "@lofcz/tinysheet-core";

const QUERY = "(prefers-color-scheme: dark)";

const noSubscribe = () => () => {};

function subscribeToColorScheme(onChange: () => void) {
  if (typeof window === "undefined" || !window.matchMedia) {
    return () => {};
  }
  const mql = window.matchMedia(QUERY);
  // Safari < 14 only supports addListener/removeListener
  if (mql.addEventListener) {
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }
  mql.addListener(onChange);
  return () => mql.removeListener(onChange);
}

const serverSnapshot = () => false;

/**
 * Resolve a theme setting to a concrete palette. With `auto`, subscribes to
 * the `prefers-color-scheme` media query so the workbook follows OS changes.
 * The query is read while rendering, so switching to `auto` shows the OS
 * palette in the same frame (no flash of the other theme).
 */
export function useResolvedTheme(
  setting: ThemeSetting | null | undefined
): ThemeName {
  const auto = setting === "auto";
  const getSnapshot = useCallback(
    () => (auto ? prefersDarkColorScheme() : false),
    [auto]
  );
  const prefersDark = useSyncExternalStore(
    auto ? subscribeToColorScheme : noSubscribe,
    getSnapshot,
    serverSnapshot
  );
  return resolveTheme(setting, prefersDark);
}
