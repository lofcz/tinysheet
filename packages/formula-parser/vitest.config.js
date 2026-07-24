import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.js"],
    exclude: ["test/setup.js", "**/node_modules/**"],
    setupFiles: ["./test/setup.js"],
    globals: true,
    // Keep formulajs Date edge cases stable across local/CI hosts.
    env: {
      TZ: "UTC",
    },
  },
});
