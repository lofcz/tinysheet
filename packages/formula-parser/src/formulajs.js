import * as formulajsNs from "@formulajs/formulajs";

function functionKeyCount(obj) {
  if (!obj || typeof obj !== "object") {
    return 0;
  }

  return Object.keys(obj).filter((key) => typeof obj[key] === "function")
    .length;
}

/**
 * Vitest/Vite CJS interop puts formulas on `.default` (enumerable).
 * Bun flattens them onto the namespace; `.default` is a smaller legacy map.
 * Prefer whichever object exposes more formula functions.
 */
// read `default` dynamically: the ESM build has no such export, and a static
// `formulajsNs.default` fails strict export checks (Rspack)
const cjsDefault = Reflect.get(formulajsNs, "default");
const formulajs =
  functionKeyCount(cjsDefault) > functionKeyCount(formulajsNs)
    ? cjsDefault
    : formulajsNs;

export default formulajs;
