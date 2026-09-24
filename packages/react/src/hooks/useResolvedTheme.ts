import { useEffect, useState } from "react";
import {
  prefersDarkColorScheme,
  resolveTheme,
  ThemeName,
  ThemeSetting,
} from "@lofcz/tinysheet-core";

const QUERY = "(prefers-color-scheme: dark)";

/**
 * Resolve `settings.theme` to a concrete palette. With `auto`, subscribes to
 * the `prefers-color-scheme` media query so the workbook follows OS changes.
 */
export function useResolvedTheme(
  setting: ThemeSetting | null | undefined
): ThemeName {
  const [prefersDark, setPrefersDark] = useState(() =>
    setting === "auto" ? prefersDarkColorScheme() : false
  );

  useEffect(() => {
    if (setting !== "auto" || typeof window === "undefined") return undefined;
    if (!window.matchMedia) return undefined;
    const mql = window.matchMedia(QUERY);
    const onChange = () => setPrefersDark(mql.matches);
    onChange();
    // Safari < 14 only supports addListener/removeListener
    if (mql.addEventListener) {
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    }
    mql.addListener(onChange);
    return () => mql.removeListener(onChange);
  }, [setting]);

  return resolveTheme(setting, prefersDark);
}
