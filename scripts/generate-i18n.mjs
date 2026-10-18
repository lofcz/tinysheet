import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
// The fork transpiles TypeScript dictionaries under Bun, as in ScioBot/Fika.
const result = spawnSync(
  "bun",
  ["--bun", "node_modules/typesafe-i18n/cli/typesafe-i18n.mjs", "--no-watch"],
  { cwd: root, stdio: "inherit" }
);
if (result.status !== 0) process.exit(result.status ?? 1);
const generated = readFileSync(
  new URL("../packages/core/src/i18n/i18n-types.ts", import.meta.url),
  "utf8"
);
if (
  !generated.includes("NamespaceRibbonTranslation") ||
  !generated.includes("undo:")
) {
  throw new Error(
    "typesafe-i18n generated an empty catalog; run codegen under Bun."
  );
}
