/* ============================================
   WalPanel Inc. — analytics Worker
   Routes (set in wrangler.jsonc):
     POST /api/track   public  — record an event (+ approx ZIP from IP)
     GET  /api/stats   gated   — funnel JSON for the dashboard
     GET  /admin       gated   — the dashboard page
   "gated" = behind Cloudflare Access (see TRACKING-SETUP.md).
   ============================================ */

import { computeStats } from './stats.js';
import { DASHBOARD_HTML } from './dashboard.js';

const BOT = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|headless|lighthouse|gtmetrix|pingdom|uptimerobot|monitor|preview/i;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    try {
      if (path === '/api/track' && request.method === 'POST') {
        return await handleTrack(request, env, ctx);
      }
      if (path === '/api/stats' && request.method === 'GET') {
        return await handleStats(request, env, url);
      }
      if (path === '/admin') {
        const gate = checkAccess(request, env, url);
        if (gate) return gate;
        const headers = { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' };
        // If they arrived with ?key=, remember it in a cookie so the dashboard's
        // /api/stats calls authenticate automatically (key no longer needed in URLs).
        if (env.DASH_KEY && url.searchParams.get('key') === env.DASH_KEY) {
          headers['Set-Cookie'] = 'wp_dash=' + encodeURIComponent(env.DASH_KEY) +
            '; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000';
        }
        return new Response(DASHBOARD_HTML, { headers });
      }
      return new Response('Not found', { status: 404 });
    } catch (err) {
      return new Response('Error: ' + (err && err.message ? err.message : 'unknown'), { status: 500 });
    }
  }
};

// ---- POST /api/track ---------------------------------------------------
async function handleTrack(request, env, ctx) {
  // ignore obvious bots so the numbers reflect real people
  const ua = request.headers.get('user-agent') || '';
  if (BOT.test(ua)) return noContent();

  let body;
  try {
    const text = await request.text();
    if (text.length > 4096) return noContent();
    body = JSON.parse(text);
  } catch (e) {
    return noContent();
  }
  if (!body || !body.t) return noContent();

  const cf = request.cf || {};
  const row = {
    ts: new Date().toISOString(),
    visitor_id: str(body.vid, 64),
    session_id: str(body.sid, 64),
    event_type: str(body.t, 32),
    page: str(body.page, 300),
    referrer: str(body.ref, 300),
    source: str(body.src, 60),
    device: str(body.dev, 16),
    zip: str(cf.postalCode, 16),
    city: str(cf.city, 80),
    region: str(cf.region, 80),
    country: str(cf.country, 8),
    meta: body.meta ? JSON.stringify(body.meta).slice(0, 1000) : null
  };

  const stmt = env.DB.prepare(
    `INSERT INTO events
       (ts, visitor_id, session_id, event_type, page, referrer, source, device, zip, city, region, country, meta)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(
    row.ts, row.visitor_id, row.session_id, row.event_type, row.page, row.referrer,
    row.source, row.device, row.zip, row.city, row.region, row.country, row.meta
  );

  // write in the background; respond instantly to the beacon
  ctx.waitUntil(stmt.run().catch(() => {}));
  return noContent();
}

// ---- GET /api/stats ----------------------------------------------------
async function handleStats(request, env, url) {
  const gate = checkAccess(request, env, url);
  if (gate) return gate;

  let days = parseInt(url.searchParams.get('days') || '30', 10);
  if (!Number.isFinite(days)) days = 30;
  days = Math.min(Math.max(days, 1), 365);
  const since = new Date(Date.now() - days * 864e5).toISOString();

  const res = await env.DB.prepare(
    `SELECT ts, visitor_id, event_type, page, source, device, zip, city, region, meta
       FROM events
      WHERE ts >= ?
      ORDER BY ts ASC
      LIMIT 300000`
  ).bind(since).all();

  const stats = computeStats(res.results || []);
  stats.range = { days, since };
  stats.generatedAt = new Date().toISOString();
  stats.viewer = request.headers.get('Cf-Access-Authenticated-User-Email') || '';

  return new Response(JSON.stringify(stats), {
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}

// ---- access gate -------------------------------------------------------
// Returns a Response if the request should be blocked, otherwise null.
function checkAccess(request, env, url) {
  // 1) Cloudflare Access (recommended): the email header is injected by Access.
  const email = request.headers.get('Cf-Access-Authenticated-User-Email');
  if (email) return null;
  // 2) Fallback shared key: via ?key= on first visit, or the cookie /admin then sets.
  if (env.DASH_KEY) {
    if (url.searchParams.get('key') === env.DASH_KEY) return null;
    const cookie = request.headers.get('Cookie') || '';
    const m = cookie.match(/(?:^|;\s*)wp_dash=([^;]+)/);
    if (m && decodeURIComponent(m[1]) === env.DASH_KEY) return null;
  }

  return new Response(
    'Dashboard locked. Protect /admin and /api/stats with Cloudflare Access ' +
    '(see TRACKING-SETUP.md), then sign in. ' +
    'Temporary access: set a DASH_KEY secret and open /admin?key=YOURKEY.',
    { status: 403, headers: { 'content-type': 'text/plain; charset=utf-8' } }
  );
}

// ---- helpers -----------------------------------------------------------
function str(v, max) {
  if (v === null || v === undefined) return null;
  return String(v).slice(0, max);
}
function noContent() {
  return new Response(null, { status: 204 });
}
