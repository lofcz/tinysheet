const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const pkg = (name, entry = "src") => path.join(root, "packages", name, entry);

// Bun installs dependencies in an isolated layout: a package is only
// resolvable from the workspace that declares it. Stories live at the root,
// so point workspace packages at their sources (no build needed) and resolve
// shared runtime deps from the package that owns them.
module.exports = ({ config }) => {
  config.resolve = config.resolve || {};
  config.resolve.alias = {
    ...config.resolve.alias,
    "@lofcz/tinysheet-core$": pkg("core"),
    "@lofcz/tinysheet-react$": pkg("react"),
    "@lofcz/tinysheet-excel$": pkg("excel"),
    "@lofcz/tinysheet-formula-parser$": pkg("formula-parser", "src/index.js"),
    uuid$: require.resolve("uuid", { paths: [pkg("core", "")] }),
    // one React for the stories, the packages and Storybook's renderer (the
    // react-webpack5 preset resolves these to @types/* in bun's layout)
    react: fs.realpathSync(path.join(root, "node_modules/react")),
    "react-dom": fs.realpathSync(path.join(root, "node_modules/react-dom")),
  };
  return config;
};
