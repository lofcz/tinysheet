import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import type { StorybookConfig } from "storybook-react-rsbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = (name: string, entry = "src") =>
  path.join(root, "packages", name, entry);
const fromCore = createRequire(path.join(root, "packages/core/package.json"));
const real = (name: string) =>
  fs.realpathSync(path.join(root, "node_modules", name));

const config: StorybookConfig = {
  stories: ["../stories/**/*.stories.@(js|jsx|ts|tsx)"],
  addons: ["@storybook/addon-links"],
  framework: { name: "storybook-react-rsbuild", options: {} },
  core: { disableTelemetry: true },
  // Bun installs dependencies in an isolated layout: a package is only
  // resolvable from the workspace that declares it. Stories live at the root,
  // so point workspace packages at their sources (no build needed), resolve
  // shared runtime deps from the package that owns them, and use one React.
  rsbuildFinal: (rsbuild) => {
    rsbuild.resolve ??= {};
    rsbuild.resolve.alias = {
      ...(rsbuild.resolve.alias as Record<string, string>),
      "@lofcz/tinysheet-core$": pkg("core"),
      "@lofcz/tinysheet-react$": pkg("react"),
      "@lofcz/tinysheet-excel$": pkg("excel"),
      "@lofcz/tinysheet-formula-parser$": pkg("formula-parser", "src/index.js"),
      uuid$: fromCore.resolve("uuid"),
      react: real("react"),
      "react-dom": real("react-dom"),
    };
    return rsbuild;
  },
};

export default config;
