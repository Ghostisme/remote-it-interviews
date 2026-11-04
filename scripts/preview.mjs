/** Serve the exported dashboard for local review, including direct navigation to SPA routes. */
import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const exportDirectory = fileURLToPath(new URL("../apps/dashboard/dist/", import.meta.url));
const mimeTypes = {
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
await stat(resolve(exportDirectory, "index.html")).catch(() => {
  throw new Error("Build the dashboard first with pnpm build.");
});

const server = createServer(async (request, response) => {
  try {
    if (!["GET", "HEAD"].includes(request.method)) {
      response.writeHead(405, { Allow: "GET, HEAD" }).end();
      return;
    }
    const requestPath = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    let filePath = resolve(exportDirectory, `.${requestPath}`);
    // Resolve and check the path before reading anything outside the export directory.
    if (
      filePath !== resolve(exportDirectory) &&
      !filePath.startsWith(`${resolve(exportDirectory)}${sep}`)
    ) {
      response.writeHead(403).end();
      return;
    }
    const fileInfo = await stat(filePath).catch(() => null);
    if (!fileInfo?.isFile()) {
      // Missing assets must stay 404; only extensionless page routes fall back to the SPA.
      if (extname(requestPath)) {
        response.writeHead(404).end();
        return;
      }
      filePath = resolve(exportDirectory, "index.html");
    }
    const content = await readFile(filePath);
    response.writeHead(200, {
      "Content-Type": mimeTypes[extname(filePath)] ?? "application/octet-stream",
      "Content-Length": content.length,
      "Cache-Control": "no-cache",
    });
    // HEAD returns the same metadata as GET without sending a response body.
    response.end(request.method === "HEAD" ? undefined : content);
  } catch {
    response.writeHead(400).end();
  }
});
server.listen(8081, "127.0.0.1", () =>
  console.log("Production web preview: http://127.0.0.1:8081 (keep the backend running on 8787)"),
);
