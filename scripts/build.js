import { spawnSync } from "node:child_process";

const generated = spawnSync("bun", ["run", "i18n:build"], { stdio: "inherit" });
if (generated.status !== 0) process.exit(generated.status ?? 1);

const result = spawnSync("bunx", ["tsdown"], {
  stdio: "inherit",
  shell: true,
});

if (result.error) {
  console.error("Error running tsdown:", result.error);
  process.exit(1);
}

if (result.status !== 0) {
  console.error(`tsdown failed with exit code ${result.status}`);
  process.exit(result.status);
}
