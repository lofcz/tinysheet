import formulajs from "./formulajs";

/**
 * Collect formula call names, including Excel-style dotted paths
 * (RANK.EQ, BINOM.DIST.RANGE, T.DIST.2T, …).
 *
 * Uses a path stack (not a global visited set) so the same formulajs
 * function object can contribute aliases under multiple Excel names
 * (e.g. CHIDIST.RT and CHISQ.DIST.RT).
 */
function collectSupportedFormulas(
  lib,
  prefix = "",
  names = new Set(),
  stack = new Set()
) {
  if (!lib || (typeof lib !== "object" && typeof lib !== "function")) {
    return names;
  }
  if (stack.has(lib)) {
    return names;
  }
  stack.add(lib);

  for (const key of Object.keys(lib)) {
    const value = lib[key];
    const name = prefix ? `${prefix}.${key}` : key;

    if (typeof value === "function") {
      names.add(name);
      collectSupportedFormulas(value, name, names, stack);
    } else if (value && typeof value === "object") {
      collectSupportedFormulas(value, name, names, stack);
    }
  }

  stack.delete(lib);
  return names;
}

const SUPPORTED_FORMULAS = [...collectSupportedFormulas(formulajs)];

export default SUPPORTED_FORMULAS;
