import { Worker } from 'node:worker_threads';
import { executeApi } from '../../src/lib/api/response';
import { openapi } from '../../scripts/moment-api-schema';

type WebEvent = { http?: {method?: string; path?: string; queryString?: string; headers?: Record<string, string>}; [key: string]: unknown };
type Context = { functionName?: string; deadline?: number };
type Reply = {statusCode: number; headers: Record<string, string>; body?: unknown};
const clients = new Map<string, {start: number; count: number}>();
export const compute = executeApi;
const failure = (status: number, code: string, message: string) => ({status, body: {error: {code, message}}});

function calculate(url: string, now: number, deadline: number): Promise<{status: number; body: unknown}> {
  // The deployed bundle is self-contained, so workers require no external npm modules.
  const worker = new Worker(`const {parentPort,workerData}=require('node:worker_threads'); parentPort.postMessage(require(workerData.bundle).compute(workerData.url,workerData.now));`,
    {eval: true, workerData: {bundle: __filename, url, now}});
  return new Promise(resolve => {
    let done = false;
    const finish = (response: {status: number; body: unknown}) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      void worker.terminate();
      resolve(response);
    };
    const timer = setTimeout(() => finish(failure(503, 'calculation_timeout', 'Calculation exceeded the time limit.')), Math.max(1, Math.min(20000, deadline - now - 250)));
    worker.once('message', finish);
    worker.once('error', () => finish(failure(500, 'internal_error', 'Calculation worker failed.')));
    worker.once('exit', () => finish(failure(500, 'internal_error', 'Calculation worker stopped.')));
  });
}

/** Raw web events preserve duplicate query keys so validation matches the Node API. */
export async function main(event: WebEvent = {}, context: Context = {}): Promise<Reply> {
  const now = Date.now();
  const headers: Record<string, string> = {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', Vary: 'Origin', 'Access-Control-Allow-Methods': 'GET, OPTIONS'};
  const reply = ({status, body}: {status: number; body: unknown}): Reply => {
    if (status === 429 || status === 503) headers['Retry-After'] = status === 429 ? '60' : '1';
    return {statusCode: status, headers, body};
  };
  const http = event.http;
  if (!http || !http.method) return reply(failure(400, 'invalid_request', 'A raw HTTP web event is required.'));
  const origin = http.headers?.origin;
  const allowed = (process.env.API_CORS_ORIGINS ?? 'https://chrono-compass.app').split(',').map(s => s.trim());
  if (origin) {
    if (!allowed.includes(origin)) return reply(failure(403, 'origin_not_allowed', 'Origin is not allowed.'));
    headers['Access-Control-Allow-Origin'] = origin;
  }
  const raw = http.queryString ?? '';
  if (raw.length + (http.path?.length ?? 0) > 8192) return reply(failure(414, 'uri_too_long', 'Request URL is too long.'));
  // This is a per-warm-instance guard; it is not a team-wide billing cap.
  const client = (http.headers?.['x-forwarded-for'] ?? 'unknown').split(',').at(-1)!.trim();
  for (const [key, value] of clients) if (now - value.start >= 60000) clients.delete(key);
  if (!clients.has(client) && clients.size >= 10000) return reply(failure(503, 'busy', 'Client capacity reached.'));
  const bucket = clients.get(client) ?? {start: now, count: 0};
  clients.set(client, bucket);
  const configured = Number(process.env.API_RATE_LIMIT ?? 60);
  const limit = Number.isSafeInteger(configured) && configured > 0 ? configured : 60;
  if (++bucket.count > limit) return reply(failure(429, 'rate_limit_exceeded', 'Request limit exceeded.'));
  headers['RateLimit-Limit'] = String(limit);
  headers['RateLimit-Remaining'] = String(Math.max(0, limit - bucket.count));
  if (http.method.toUpperCase() === 'OPTIONS') {
    if (http.headers?.['access-control-request-headers']) return reply(failure(400, 'unsupported_headers', 'No custom request headers are supported.'));
    return {statusCode: 204, headers};
  }
  if (http.method.toUpperCase() !== 'GET') {headers.Allow = 'GET, OPTIONS'; return reply(failure(405, 'method_not_allowed', 'Use GET.'));}
  const endpoint = context.functionName?.split('/').at(-1);
  if (!endpoint || !['moment', 'range', 'year', 'cycles', 'openapi'].includes(endpoint) || (http.path && http.path !== '/')) return reply(failure(404, 'not_found', 'Unknown API endpoint.'));
  if (endpoint === 'openapi') {
    if (raw) return reply(failure(400, 'invalid_parameter', 'OpenAPI accepts no query parameters.'));
    return reply({status: 200, body: openapi});
  }
  return reply(await calculate(`https://chrono-compass.app/api/v1/${endpoint}${raw ? '?' + raw : ''}`, now, context.deadline ?? now + 25000));
}
