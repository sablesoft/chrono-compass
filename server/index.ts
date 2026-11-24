import { createServer } from 'node:http';
import { Worker } from 'node:worker_threads';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../dist/', import.meta.url)));
const origins = new Set((process.env.API_CORS_ORIGINS ?? 'https://chrono-compass.app').split(',').map(s => s.trim()).filter(Boolean));
const trustProxy = process.env.API_TRUST_PROXY === 'true';
const numberSetting = (name: string, fallback: number, max: number) => {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < 1 || value > max) throw new Error(`Invalid ${name}`);
  return value;
};
const limit = numberSetting('API_RATE_LIMIT', 60, 10000);
const concurrency = numberSetting('API_WORKERS', 2, 8);
const timeout = numberSetting('API_COMPUTE_TIMEOUT_MS', 20000, 60000);
const clients = new Map<string, {start: number; used: number}>();
const pool: Array<{worker: Worker; busy: boolean}> = [];
const response = (status: number, code: string, message: string) => ({status, body: {error: {code, message}}});
function compute(url: string, now: number): Promise<{status: number; body: unknown}> {
  let slot = pool.find(s => !s.busy);
  if (!slot && pool.length < concurrency) {
    slot = {worker: new Worker(new URL('./compute.js', import.meta.url)), busy: false};
    pool.push(slot);
  }
  if (!slot) return Promise.resolve(response(503, 'busy', 'Calculation capacity is busy. Retry later.'));
  slot.busy = true;
  const active = slot;
  return new Promise(done => {
    let finished = false;
    const finish = (result: {status: number; body: unknown}, discard = false) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      active.worker.removeAllListeners('message');
      active.worker.removeAllListeners('error');
      active.worker.removeAllListeners('exit');
      if (discard) { pool.splice(pool.indexOf(active), 1); void active.worker.terminate(); }
      else active.busy = false;
      done(result);
    };
    const timer = setTimeout(() => finish(response(503, 'calculation_timeout', 'Calculation exceeded the time limit.'), true), timeout);
    active.worker.once('message', result => finish(result));
    active.worker.once('error', () => finish(response(500, 'internal_error', 'Calculation worker failed.'), true));
    active.worker.once('exit', () => finish(response(500, 'internal_error', 'Calculation worker stopped.'), true));
    active.worker.postMessage({url, now});
  });
}
const mime: Record<string, string> = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.xml': 'application/xml', '.txt': 'text/plain', '.webmanifest': 'application/manifest+json', '.md': 'text/markdown; charset=utf-8'};
const server = createServer(async (req, res) => {
  const now = Date.now();
  const send = ({status, body}: {status: number; body: unknown}) => {
    if (status === 429 || status === 503) res.setHeader('Retry-After', status === 429 ? '60' : '1');
    res.writeHead(status, {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'});
    res.end(JSON.stringify(body));
  };
  try {
    if ((req.url?.length ?? 0) > 8192) { send(response(414, 'uri_too_long', 'Request URL is too long.')); return; }
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname === '/healthz') {
      if (req.method !== 'GET' && req.method !== 'HEAD') {res.setHeader('Allow', 'GET, HEAD'); send(response(405, 'method_not_allowed', 'Use GET or HEAD.')); return;}
      res.writeHead(200, {'Content-Type': 'application/json', 'Cache-Control': 'no-store'}); res.end(req.method === 'HEAD' ? undefined : '{"status":"ok"}'); return;
    }
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      res.setHeader('Vary', 'Origin');
      if (req.headers.origin) {
        if (!origins.has(req.headers.origin)) {send(response(403, 'origin_not_allowed', 'Origin is not allowed.')); return;}
        res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
      }
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      // Trust exactly one configured ingress; direct deployments ignore forwarded addresses.
      const forwarded = String(req.headers['x-forwarded-for'] ?? '').split(',').at(-1)?.trim();
      const client = trustProxy && forwarded ? forwarded : req.socket.remoteAddress ?? 'unknown';
      for (const [key, value] of clients) if (now - value.start >= 60000) clients.delete(key);
      if (!clients.has(client) && clients.size >= 10000) {send(response(503, 'busy', 'Client capacity reached.')); return;}
      const bucket = clients.get(client) ?? {start: now, used: 0};
      clients.set(client, bucket);
      if (++bucket.used > limit) {send(response(429, 'rate_limit_exceeded', 'Request limit exceeded.')); return;}
      res.setHeader('RateLimit-Limit', limit);
      res.setHeader('RateLimit-Remaining', Math.max(0, limit - bucket.used));
      if (req.method === 'OPTIONS') {
        if (req.headers['access-control-request-headers']) {send(response(400, 'unsupported_headers', 'No custom request headers are supported.')); return;}
        res.writeHead(204, {'Cache-Control': 'no-store'}); res.end(); return;
      }
      if (req.method !== 'GET') {res.setHeader('Allow', 'GET, OPTIONS'); send(response(405, 'method_not_allowed', 'Use GET.')); return;}
      if (url.pathname === '/api/v1/openapi.json') {
        if (url.search) {send(response(400, 'invalid_parameter', 'OpenAPI accepts no query parameters.')); return;}
        send({status: 200, body: JSON.parse(await readFile(new URL('../docs/moment-api.openapi.json', import.meta.url), 'utf8'))}); return;
      }
      send(await compute(url.href, now)); return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {res.setHeader('Allow', 'GET, HEAD'); send(response(405, 'method_not_allowed', 'Use GET or HEAD.')); return;}
    const path = decodeURIComponent(url.pathname);
    if (path.includes('\0') || path.split('/').some(part => part.startsWith('.'))) {send(response(404, 'not_found', 'File not found.')); return;}
    let file = resolve(root, '.' + path);
    if (file !== root && !file.startsWith(root + sep)) {send(response(404, 'not_found', 'File not found.')); return;}
    try { if ((await stat(file)).isDirectory()) file = resolve(file, 'index.html'); await stat(file); }
    catch {
      if (extname(path)) {send(response(404, 'not_found', 'File not found.')); return;}
      file = resolve(root, 'index.html');
    }
    const body = await readFile(file);
    res.writeHead(200, {'Content-Type': mime[extname(file)] ?? 'application/octet-stream',
      'Cache-Control': file.includes(`${sep}assets${sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache', 'X-Content-Type-Options': 'nosniff'});
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch { send(response(500, 'internal_error', 'Unable to serve this request.')); }
});
server.requestTimeout = 30000;
server.headersTimeout = 10000;
server.listen(numberSetting('PORT', 8080, 65535), process.env.HOST ?? '0.0.0.0', () => console.log('ChronoCompass HTTP server ready'));
for (const signal of ['SIGTERM', 'SIGINT'] as const) process.on(signal, () => {
  server.close(() => process.exit(0));
  for (const {worker} of pool) void worker.terminate();
  setTimeout(() => process.exit(0), 5000).unref();
});
