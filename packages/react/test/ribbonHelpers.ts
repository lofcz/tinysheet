import { fireEvent } from "@testing-library/react";

/**
 * Switch the ribbon to the tab that holds toolbar item / ribbon command
 * `name` (only the active tab's groups are rendered). Returns the item's
 * wrapper, or null when no tab has it.
 */
export function showRibbonItem(
  container: HTMLElement,
  name: string
): HTMLElement | null {
  const find = () =>
    container.querySelector<HTMLElement>(
      `.fortune-ribbon-item[data-item="${name}"]`
    );
  const found = find();
  if (found) return found;
  const tabs = Array.from(
    container.querySelectorAll<HTMLElement>(".fortune-ribbon [role=tab]")
  );
  for (let i = 0; i < tabs.length; i += 1) {
    fireEvent.click(tabs[i]);
    const item = find();
    if (item) return item;
  }
  return null;
}

/** Switch the ribbon to a tab by id ("home", "insert", "formulas", ...). */
export function showRibbonTab(container: HTMLElement, id: string) {
  const tab = container.querySelector<HTMLElement>(
    `.fortune-ribbon [role=tab][data-tab="${id}"]`
  );
  if (tab) fireEvent.click(tab);
  return tab;
}
