import { defineConfig } from "@rsbuild/core";
import { pluginReact } from "@rsbuild/plugin-react";

// Used by Storybook (storybook-react-rsbuild) for the stories and packages.
export default defineConfig({
  plugins: [pluginReact()],
});
