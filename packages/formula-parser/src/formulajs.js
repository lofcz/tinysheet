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
const formulajs =
  // oxlint-disable-next-line import/namespace -- CJS builds expose the functions under default
  functionKeyCount(formulajsNs.default) > functionKeyCount(formulajsNs)
    ? // oxlint-disable-next-line import/namespace -- CJS builds expose the functions under default
      formulajsNs.default
    : formulajsNs;

export default formulajs;
