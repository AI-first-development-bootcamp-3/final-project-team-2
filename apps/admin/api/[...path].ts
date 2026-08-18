import type { IncomingMessage, ServerResponse } from 'node:http';

// Same-origin proxy for the API. The admin console and the API deploy as
// separate Vercel projects on different *.vercel.app hosts, which browsers
// treat as different *sites* (vercel.app is on the Public Suffix List) — so
// the SameSite=Strict refresh cookie is never sent cross-site and the
// session dies on every reload. Serving /api/* from the admin origin keeps
// the cookie first-party without touching the API's cookie policy.
// API_ORIGIN (a Vercel env var on the admin project) selects the upstream
// deployment per environment (production vs staging).

// Connection-scoped headers must not be forwarded in either direction; the
// last four are recomputed by fetch/the platform for the proxied exchange.
const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length',
  'accept-encoding',
  'content-encoding',
]);

type ProxyRequest = IncomingMessage & { body?: unknown };

function upstreamBody(req: ProxyRequest): string | Buffer | undefined {
  // Vercel's Node helpers consume the stream and expose the parsed body:
  // Buffer/string pass through untouched, parsed JSON is re-serialized.
  if (req.method === 'GET' || req.method === 'HEAD' || req.body === undefined) return undefined;
  if (typeof req.body === 'string' || Buffer.isBuffer(req.body)) return req.body;
  return JSON.stringify(req.body);
}

export default async function handler(req: ProxyRequest, res: ServerResponse): Promise<void> {
  const apiOrigin = process.env.API_ORIGIN;
  if (!apiOrigin) {
    res.statusCode = 500;
    res.end('API_ORIGIN is not configured for this environment');
    return;
  }

  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries(req.headers)) {
    if (value === undefined || HOP_BY_HOP.has(name)) continue;
    headers[name] = Array.isArray(value) ? value.join(', ') : value;
  }

  const upstream = await fetch(new URL(req.url ?? '/', apiOrigin), {
    method: req.method,
    headers,
    body: upstreamBody(req),
    // 3xx responses pass through untouched — the browser follows them, not us.
    redirect: 'manual',
  });

  res.statusCode = upstream.status;
  upstream.headers.forEach((value, name) => {
    // set-cookie is re-added below: forEach folds multiple cookies into one
    // comma-joined value, which browsers can't parse.
    if (name === 'set-cookie' || HOP_BY_HOP.has(name)) return;
    res.setHeader(name, value);
  });
  const setCookies = upstream.headers.getSetCookie();
  if (setCookies.length > 0) res.setHeader('set-cookie', setCookies);

  res.end(Buffer.from(await upstream.arrayBuffer()));
}
