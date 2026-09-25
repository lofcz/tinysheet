// Minimal static file server for the Storybook build (no dependencies).
// Usage: node e2e/serve.mjs [dir] [port]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(
  process.argv[2] || path.join(here, "..", "storybook-static")
);
const port = Number(process.argv[3] || process.env.E2E_PORT || 6107);

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".map": "application/json",
};

if (!fs.existsSync(path.join(root, "iframe.html"))) {
  console.error(
    `No Storybook build found in ${root}; run "bun run test:e2e" (or "npx storybook build").`
  );
  process.exit(1);
}

http
  .createServer((req, res) => {
    const url = new URL(req.url || "/", "http://localhost");
    let file = path.normalize(
      path.join(root, decodeURIComponent(url.pathname))
    );
    if (!file.startsWith(root)) {
      res.writeHead(403).end();
      return;
    }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
      file = path.join(file, "index.html");
    }
    fs.readFile(file, (err, body) => {
      if (err) {
        res.writeHead(404).end("Not found");
        return;
      }
      res.writeHead(200, {
        "Content-Type": types[path.extname(file)] || "application/octet-stream",
      });
      res.end(body);
    });
  })
  .listen(port, "127.0.0.1", () => {
    console.warn(`Serving ${root} at http://127.0.0.1:${port}`);
  });
