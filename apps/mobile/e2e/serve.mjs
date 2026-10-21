// Uygulamanın tarayıcı sürümünü (expo export --platform web) sunar; /api isteklerini yerel API'ye iletir.
// Yalnızca uçtan uca test içindir.
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer, request } from "node:http";
import { extname, join, normalize } from "node:path";

const ROOT = new URL("../dist-web/", import.meta.url).pathname;
const API = new URL(process.env.API_ORIGIN ?? "http://localhost:8080");
const PORT = Number(process.env.PORT ?? 8090);
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg", ".json": "application/json", ".ttf": "font/ttf", ".ico": "image/x-icon" };

createServer((req, res) => {
  if (req.url.startsWith("/api/")) {
    const up = request({ host: API.hostname, port: API.port, path: req.url, method: req.method, headers: { ...req.headers, host: API.host } }, (r) => { res.writeHead(r.statusCode ?? 502, r.headers); r.pipe(res); });
    up.on("error", () => { res.writeHead(502); res.end(); });
    req.pipe(up);
    return;
  }
  const path = normalize(join(ROOT, decodeURIComponent(req.url.split("?")[0])));
  const file = path.startsWith(ROOT) && existsSync(path) && statSync(path).isFile() ? path : join(ROOT, "index.html");
  res.writeHead(200, { "Content-Type": TYPES[extname(file)] ?? "application/octet-stream" });
  createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`uygulama: http://localhost:${PORT}`));
