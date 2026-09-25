import { registerPageLayoutFeature } from "./components/PageLayout";

export * from "./components";
export * from "./extensions";
export {
  registerPageLayoutFeature,
  PageSetupDialog,
  PrintPreview,
  usePageLayoutDialogs,
} from "./components/PageLayout";
export type { PageSetupTab } from "./components/PageLayout";

// Built-in features plugged in through the extension registries.
registerPageLayoutFeature();
