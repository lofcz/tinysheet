import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { defineConfig } from "@rsbuild/core";
import { pluginReact } from "@rsbuild/plugin-react";

const root = path.resolve(import.meta.dirname, "..");
const pkg = (name: string, entry = "src") =>
  path.join(root, "packages", name, entry);
const fromCore = createRequire(path.join(root, "packages/core/package.json"));
const real = (name: string) =>
  fs.realpathSync(path.join(root, "node_modules", name));

// The online demo: one full-page workbook, built from the package sources.
export default defineConfig({
  root: import.meta.dirname,
  plugins: [pluginReact()],
  source: { entry: { index: "./src/index.tsx" } },
  html: { template: "./index.html" },
  resolve: {
    alias: {
      "@lofcz/tinysheet-core$": pkg("core"),
      "@lofcz/tinysheet-react$": pkg("react"),
      "@lofcz/tinysheet-excel$": pkg("excel"),
      // File > Open / Save As (typed in src/excel.d.ts)
      "demo-excel$": pkg("excel"),
      "@lofcz/tinysheet-formula-parser$": pkg("formula-parser", "src/index.js"),
      uuid$: fromCore.resolve("uuid"),
      react: real("react"),
      "react-dom": real("react-dom"),
    },
  },
  // GitHub Pages serves the repo under /<repo>/ (DEMO_BASE=/tinysheet/)
  output: {
    assetPrefix: process.env.DEMO_BASE ?? "/",
    distPath: { root: "dist" },
  },
});
