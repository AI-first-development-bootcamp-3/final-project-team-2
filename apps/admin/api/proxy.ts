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

function upstreamBody(req: ProxyRequest): string | ArrayBuffer | undefined {
  // Vercel's Node helpers consume the stream and expose the parsed body:
  // string passes through untouched, parsed JSON is re-serialized, and a
  // Buffer is copied into a plain ArrayBuffer — the DOM's BodyInit type
  // doesn't accept Node's Buffer.
  if (req.method === 'GET' || req.method === 'HEAD' || req.body === undefined) return undefined;
  if (typeof req.body === 'string') return req.body;
  if (Buffer.isBuffer(req.body)) return new Uint8Array(req.body).buffer;
  return JSON.stringify(req.body);
}

export default async function handler(req: ProxyRequest, res: ServerResponse): Promise<void> {
  const apiOrigin = process.env.API_ORIGIN;
  if (!apiOrigin) {
    res.statusCode = 500;
    res.end('API_ORIGIN is not configured for this environment');
    return;
  }

  // new URL(path, base) IGNORES the base when path is an absolute URL, and
  // "//host" / backslash variants re-root the authority — any of those would
  // turn this proxy into an SSRF gadget. Build the URL, then require that it
  // still points at API_ORIGIN.
  const url = new URL(req.url ?? '/', apiOrigin);
  if (url.origin !== new URL(apiOrigin).origin) {
    res.statusCode = 400;
    res.end('Invalid request path');
    return;
  }

  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries(req.headers)) {
    if (value === undefined || HOP_BY_HOP.has(name)) continue;
    headers[name] = Array.isArray(value) ? value.join(', ') : value;
  }

  const upstream = await fetch(url, {
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
