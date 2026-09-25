import type { SetContextOptions } from "../../context";

/*
 * The workbook records an undo step inside its React state updater. When a
 * lower-priority update (a passive effect, a mouse move) is still pending as
 * a command is dispatched, React processes the command's updater again on
 * top of it ("rebasing"), and the step lands in the undo list twice. Outline
 * commands tag their setContext options, so the duplicate (the same options
 * object recorded twice in a row) can be dropped again.
 */
const steps = new WeakSet<object>();

/** setContext options for one outline command. */
export function outlineStep(): SetContextOptions {
  const options: SetContextOptions = {};
  steps.add(options);
  return options;
}

/** Drop repeated records of the same outline command (keeps the latest). */
export function dedupeOutlineSteps(list: { options?: unknown }[]) {
  for (let i = list.length - 1; i > 0; i -= 1) {
    const { options } = list[i];
    if (
      options != null &&
      typeof options === "object" &&
      steps.has(options) &&
      list[i - 1].options === options
    ) {
      list.splice(i - 1, 1);
    }
  }
}
