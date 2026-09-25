import type { RibbonTabConfig } from "@lofcz/tinysheet-core";

/**
 * Formulas (Excel's layout): Function Library · Defined Names · Formula
 * Auditing · Calculation (docs/DESIGN.md). Three-row columns hold Excel's
 * small labelled commands.
 */
export const formulasTab: RibbonTabConfig = {
  id: "formulas",
  groups: [
    {
      id: "functionLibrary",
      icon: "insert-function",
      items: [
        { id: "insert-function", size: "large" },
        { id: "formulas-autosum", size: "large" },
        { id: "functions-recent", size: "large" },
        { id: "functions-financial", size: "large" },
        {
          rows: [
            ["functions-logical"],
            ["functions-text"],
            ["functions-datetime"],
          ],
        },
        {
          rows: [["functions-lookup"], ["functions-math"], ["functions-more"]],
        },
      ],
    },
    {
      id: "definedNames",
      icon: "tag",
      items: [
        { id: "nameManager", size: "large" },
        {
          rows: [
            ["define-name"],
            ["use-in-formula"],
            ["create-from-selection"],
          ],
        },
      ],
    },
    {
      id: "formulaAuditing",
      icon: "search",
      items: [
        {
          rows: [["trace-precedents"], ["trace-dependents"], ["remove-arrows"]],
        },
        {
          rows: [["show-formulas"], ["error-checking"], ["evaluate-formula"]],
        },
        { id: "watch-window", size: "large" },
      ],
    },
    {
      id: "calculation",
      icon: "calculator",
      items: [
        { id: "calculation-options", size: "large" },
        { rows: [["calculate-now"], ["calculate-sheet"]] },
      ],
    },
  ],
};
