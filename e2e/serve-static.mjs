// Statischer Server mit SPA-Fallback fuer den E2E-Lauf gegen den Produktions-Build.
// Aufruf: node e2e/serve-static.mjs <Ordner> <Port>   (Standard: www, 4310)
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const root = path.resolve(process.argv[2] ?? 'www');
const port = Number(process.argv[3] ?? 4310);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.wasm': 'application/wasm',
  '.traineddata': 'application/octet-stream',
  '.gz': 'application/gzip',
};

/** Datei unterhalb von root oder null (kein Ausbruch per ../, Verzeichnisse zaehlen nicht). */
function resolveFile(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const file = path.join(root, path.normalize(decoded));
  if (!file.startsWith(root)) return null;
  return fs.existsSync(file) && fs.statSync(file).isFile() ? file : null;
}

const server = http.createServer((req, res) => {
  const file = resolveFile(req.url ?? '/') ?? path.join(root, 'index.html');
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

server.listen(port, '127.0.0.1', () => console.log(`E2E-Server: ${root} auf http://127.0.0.1:${port}`));
