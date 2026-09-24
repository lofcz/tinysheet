const { readdirSync, realpathSync } = require("fs");
const { join } = require("path");

const pkgList = readdirSync(join(__dirname, "./packages")).filter(
  (pkg) => pkg.charAt(0) !== "."
);

const moduleNameMapper = {
  "\\.(css|less|sass|scss)$": require.resolve("identity-obj-proxy"),
  // Bun uses an isolated node_modules layout, so resolve from the package that depends on it.
  "^uuid$": require.resolve("uuid", {
    paths: [join(__dirname, "packages/core")],
  }),
};

// @chevrotain/* only expose an "import" export condition, which Jest's
// CommonJS resolver ignores; point it at the ESM entry and let Babel transform it.
const chevrotainDir = realpathSync(
  join(__dirname, "packages/formula-parser/node_modules/chevrotain")
);
moduleNameMapper["^@chevrotain/(.*)$"] = join(
  chevrotainDir,
  "../@chevrotain/$1/lib/src/api.js"
);

pkgList.forEach((shortName) => {
  // Point workspace packages at their sources so tests don't need a build.
  moduleNameMapper[`^@lofcz/tinysheet-${shortName}$`] = join(
    __dirname,
    `./packages/${shortName}/src`
  );
});

module.exports = {
  collectCoverageFrom: ["packages/**/src/**/*.{ts,tsx}"],
  testEnvironment: "jsdom",
  moduleNameMapper,
  moduleFileExtensions: ["js", "jsx", "ts", "tsx"],
  transform: {
    "\\.(t|j)sx?$": require.resolve("./tests/transformer.cjs"),
  },
  // chevrotain (and its lodash-es / @chevrotain deps) ship ESM only.
  transformIgnorePatterns: [
    "/node_modules/(?!.*(chevrotain|lodash-es|@formulajs|regexp-to-ast))",
  ],
  // Legacy preview test targets a removed dist/main.js bundle.
  testPathIgnorePatterns: [
    "/node_modules/",
    "packages/excel/test/transformExcelToFortune.xls_preview.test.js",
  ],
  unmockedModulePathPatterns: ["node_modules/react/", "node_modules/enzyme/"],
  verbose: true,
  setupFiles: ["./tests/setup.js"],
};
