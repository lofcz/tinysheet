/**
 * Built-in features that plug into the extension registries
 * (extensions.tsx). They are installed the first time a registry is read,
 * from code every workbook runs, so bundlers cannot drop the registration
 * as an unused side effect (the package is marked side-effect free).
 *
 * Feature owners add one line here.
 */
import { registerShapesFeature } from "./components/Shapes";

export function installBuiltinExtensions() {
  registerShapesFeature();
}
