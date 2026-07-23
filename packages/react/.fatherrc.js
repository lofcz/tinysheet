export default {
  target: "browser",
  cjs: { type: "rollup", lazy: false },
  esm: { type: "rollup" },
  umd: { globals: { react: "React", "react-dom": "ReactDOM" }, minFile: true },
  extractCSS: true,
  disableTypeCheck: false,
};
