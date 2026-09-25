import type { RibbonTabConfig } from "@lofcz/tinysheet-core";

/**
 * Formulas: Function Library · Defined Names · Formula Auditing ·
 * Calculation (docs/DESIGN.md).
 */
export const formulasTab: RibbonTabConfig = {
  id: "formulas",
  groups: [
    { id: "functionLibrary", icon: "formula-sum", items: ["quick-formula"] },
    { id: "definedNames", icon: "tag", items: ["nameManager"] },
    {
      id: "formulaAuditing",
      icon: "search",
      items: [
        {
          rows: [
            ["trace-precedents", "trace-dependents", "remove-arrows"],
            ["show-formulas", "error-checking", "evaluate-formula"],
          ],
        },
        "watch-window",
      ],
    },
    { id: "calculation", icon: "calculator", items: ["calculation-options"] },
  ],
};
