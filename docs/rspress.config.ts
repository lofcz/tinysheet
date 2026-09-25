import path from "node:path";
import { defineConfig } from "@rspress/core";

// Deployed with the demo on GitHub Pages under /<repo>/docs/ (DOCS_BASE).
export default defineConfig({
  root: path.join(import.meta.dirname, "pages"),
  base: process.env.DOCS_BASE ?? "/",
  outDir: path.join(import.meta.dirname, "dist"),
  title: "TinySheet",
  description: "Excel-like spreadsheet component for React.",
  lang: "en",
  locales: [
    { lang: "en", label: "English", title: "TinySheet" },
    { lang: "zh", label: "简体中文", title: "TinySheet" },
  ],
  themeConfig: {
    socialLinks: [
      {
        icon: "github",
        mode: "link",
        content: "https://github.com/lofcz/tinysheet",
      },
    ],
    locales: [
      {
        lang: "en",
        label: "English",
        nav: [
          { text: "Guide", link: "/guide/" },
          { text: "Demo", link: "https://lofcz.github.io/tinysheet/" },
        ],
        sidebar: {
          "/guide/": [
            { text: "Get started", link: "/guide/" },
            { text: "Configuration", link: "/guide/config" },
            { text: "Sheet", link: "/guide/sheet" },
            { text: "Cell", link: "/guide/cell" },
            { text: "Operations", link: "/guide/op" },
            { text: "API", link: "/guide/api" },
            { text: "Keyboard shortcuts", link: "/guide/shortcuts" },
            { text: "Functions", link: "/guide/functions" },
            { text: "FAQ", link: "/guide/FAQ" },
            { text: "Contributing", link: "/guide/contribute" },
          ],
        },
      },
      {
        lang: "zh",
        label: "简体中文",
        nav: [
          { text: "指南", link: "/zh/guide/" },
          { text: "演示", link: "https://lofcz.github.io/tinysheet/" },
        ],
        sidebar: {
          "/zh/guide/": [
            { text: "快速上手", link: "/zh/guide/" },
            { text: "整体配置", link: "/zh/guide/config" },
            { text: "工作表", link: "/zh/guide/sheet" },
            { text: "单元格", link: "/zh/guide/cell" },
            { text: "操作", link: "/zh/guide/op" },
            { text: "API", link: "/zh/guide/api" },
            { text: "常见问题", link: "/zh/guide/FAQ" },
            { text: "贡献指南", link: "/zh/guide/contribute" },
          ],
        },
      },
    ],
  },
});
