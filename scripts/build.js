import { spawnSync } from "node:child_process";

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
