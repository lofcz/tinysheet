import { defineConfig } from "tsdown";

const shared = {
  format: ["esm"] as const,
  dts: true,
  clean: true,
  // Browser consumers (Vite/sciobot). Avoid "neutral" so package "main" resolves.
  platform: "browser" as const,
  target: "es2020",
  // every bare import stays external: dependencies and the workspace
  // packages (@lofcz/tinysheet-*), which must not be path-bundled
  deps: { neverBundle: true },
};

export default defineConfig([
  {
    ...shared,
    entry: "packages/formula-parser/src/index.js",
    outDir: "packages/formula-parser/dist",
    tsconfig: "packages/formula-parser/tsconfig.build.json",
    // Keep a single ESM file (no hashed chunks) for a clean package surface.
    outputOptions: {
      codeSplitting: false,
    },
  },
  {
    ...shared,
    entry: "packages/core/src/index.ts",
    outDir: "packages/core/dist",
    // Build without workspace path aliases so packages stay external.
    tsconfig: "packages/core/tsconfig.build.json",
  },
  {
    ...shared,
    entry: "packages/react/src/index.ts",
    outDir: "packages/react/dist",
    tsconfig: "packages/react/tsconfig.build.json",
    css: {
      fileName: "index.css",
    },
  },
  {
    ...shared,
    entry: "packages/excel/src/index.ts",
    outDir: "packages/excel/dist",
    tsconfig: "packages/excel/tsconfig.build.json",
  },
]);
