import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../apps/dashboard/dist/", import.meta.url));
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".ttf": "font/ttf",
  ".woff2": "font/woff2",
};
await stat(resolve(root, "index.html")).catch(() => {
  throw new Error("Build the dashboard first with pnpm build.");
});

const server = createServer(async (req, res) => {
  try {
    if (!["GET", "HEAD"].includes(req.method)) {
      res.writeHead(405, { Allow: "GET, HEAD" }).end();
      return;
    }
    const path = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    let file = resolve(root, `.${path}`);
    if (file !== resolve(root) && !file.startsWith(`${resolve(root)}${sep}`)) {
      res.writeHead(403).end();
      return;
    }
    const info = await stat(file).catch(() => null);
    if (!info?.isFile()) {
      if (extname(path)) {
        res.writeHead(404).end();
        return;
      }
      file = resolve(root, "index.html");
    }
    const bytes = await readFile(file);
    res.writeHead(200, {
      "Content-Type": mime[extname(file)] ?? "application/octet-stream",
      "Content-Length": bytes.length,
      "Cache-Control": "no-cache",
    });
    res.end(req.method === "HEAD" ? undefined : bytes);
  } catch {
    res.writeHead(400).end();
  }
});
server.listen(8081, "127.0.0.1", () =>
  console.log("Production web preview: http://127.0.0.1:8081 (keep the backend running on 8787)"),
);
