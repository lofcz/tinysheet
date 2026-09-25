const webpackConfig = require("./webpack.config");

module.exports = {
  stories: ["../stories/**/*.stories.@(js|jsx|ts|tsx)"],

  addons: [
    "@storybook/addon-webpack5-compiler-babel",
    "@storybook/addon-links",
    "@storybook/addon-essentials",
    "@storybook/addon-interactions",
  ],

  framework: {
    name: "@storybook/react-webpack5",
    options: {},
  },

  core: { disableTelemetry: true },

  webpackFinal: (config) => webpackConfig({ config }),
};
