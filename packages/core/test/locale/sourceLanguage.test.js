import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseSync } from "@babel/core";

const han = /\p{Script=Han}/u;

function comments(text, css = false) {
  if (css) {
    // Quoted CSS content can contain comment delimiters as ordinary text.
    const tokens =
      text.match(
        /"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|\/\*[\s\S]*?\*\//g
      ) ?? [];
    return tokens.filter((token) => token.startsWith("/*"));
  }
  return parseSync(text, {
    babelrc: false,
    configFile: false,
    parserOpts: {
      sourceType: "unambiguous",
      plugins: ["typescript", "jsx"],
      allowReturnOutsideFunction: true,
    },
  }).comments.map((comment) => comment.value);
}

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory()
      ? sourceFiles(file)
      : /\.(?:[cm]?js|jsx|tsx?|css)$/.test(entry.name)
        ? [file]
        : [];
  });
}

test("source comments use English while CJK cell data and format codes remain valid", () => {
  const roots = [
    "packages/core/src",
    "packages/react/src",
    "packages/excel/src",
    "packages/formula-parser/src",
    "stories",
    "demo/src",
    "scripts",
  ];
  const failures = [];
  for (const file of roots.flatMap(sourceFiles)) {
    const text = readFileSync(file, "utf8");
    if (!han.test(text)) continue;
    for (const comment of comments(text, file.endsWith(".css"))) {
      if (han.test(comment)) failures.push({ file, comment });
    }
  }
  expect(failures).toEqual([]);
});

test("the comment check distinguishes comments from strings, regexes, templates and CSS content", () => {
  const characters = "\u4e2d\u6587";
  const source = `const text = "${characters}"; const pattern = /${characters}/; const template = \`${characters}\`; // English`;
  expect(comments(source).some((comment) => han.test(comment))).toBe(false);
  expect(
    comments(`${source}\n/* ${characters} */`).some((comment) =>
      han.test(comment)
    )
  ).toBe(true);
  expect(
    comments(`.cell::after { content: "/* ${characters} */"; }`, true)
  ).toEqual([]);
  expect(comments(`/* ${characters} */`, true)).toHaveLength(1);
});
