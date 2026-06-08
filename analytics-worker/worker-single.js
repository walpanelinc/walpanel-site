/* WalPanel analytics Worker — single file (dashboard paste). DB binding=DB; routes /api/*,/admin; secret DASH_KEY. */

/* ============================================
   WalPanel analytics — pure aggregation.
   Takes raw event rows, returns the dashboard funnel.
   Kept dependency-free and side-effect-free so it can
   be unit-tested in plain Node.
   ============================================ */

function parseMeta(m) {
  if (!m) return {};
  if (typeof m === 'object') return m;
  try { return JSON.parse(m); } catch (e) { return {}; }
}

function add(map, key, vid) {
  if (!map.has(key)) map.set(key, new Set());
  map.get(key).add(vid);
}

function topN(map, n, mapper) {
  return [...map.entries()]
    .map(mapper)
    .sort((a, b) => b.visitors - a.visitors)
    .slice(0, n);
}

/**
 * @param {Array} rows  event rows (any order). Each: {ts, visitor_id,
 *   event_type, zip, city, region, device, source, page, meta}
 * @returns aggregated funnel + breakdowns
 */
function computeStats(rows) {
  rows = Array.isArray(rows) ? rows.slice() : [];
  // chronological so "first seen" profile fields are stable
  rows.sort((a, b) => String(a.ts).localeCompare(String(b.ts)));

  const visitors = new Set();      // distinct vid with a pageview
  const chatOpen = new Set();
  const chatted = new Set();        // sent >=1 message
  const leadForm = new Set();       // submitted callback form
  const textClick = new Set();      // clicked the text-us link
  const textShow = new Set();
  const handoff = new Set();
  const contactSales = new Set();   // handoff because they asked for sales
  const clickers = new Set();       // clicked any tracked CTA

  const msgCount = new Map();        // vid -> # chat messages
  let pageviews = 0;
  let ctaClicks = 0;
  const ctaByKind = new Map();       // kind -> count

  // per-visitor "first seen" profile
  const profile = new Map();         // vid -> {zip, city, region, source, device}

  // breakdown accumulators (vid sets, so we count unique people)
  const byZip = new Map();           // zip -> Set(vid)
  const zipMeta = new Map();         // zip -> {city, region}
  const byPageViews = new Map();     // page -> count
  const byPageVisitors = new Map();  // page -> Set(vid)
  const bySource = new Map();        // source -> Set(vid)
  const byDevice = new Map();        // device -> Set(vid)
  const byDay = new Map();           // date -> {pv, vis:Set, chat:Set, lead:Set}

  for (const r of rows) {
    const vid = r.visitor_id || 'anon';
    const type = r.event_type;
    const meta = parseMeta(r.meta);
    const date = String(r.ts || '').slice(0, 10);

    if (!profile.has(vid)) {
      profile.set(vid, {
        zip: r.zip || '', city: r.city || '', region: r.region || '',
        source: r.source || 'direct', device: r.device || 'unknown'
      });
    }
    // backfill geo if the first event lacked it but a later one has it
    const p = profile.get(vid);
    if (!p.zip && r.zip) { p.zip = r.zip; p.city = r.city || p.city; p.region = r.region || p.region; }

    if (!byDay.has(date)) byDay.set(date, { pv: 0, vis: new Set(), chat: new Set(), lead: new Set() });
    const day = byDay.get(date);

    switch (type) {
      case 'pageview':
        visitors.add(vid);
        pageviews++;
        day.pv++; day.vis.add(vid);
        byPageViews.set(r.page, (byPageViews.get(r.page) || 0) + 1);
        add(byPageVisitors, r.page, vid);
        break;
      case 'cta_click':
        ctaClicks++;
        clickers.add(vid);
        ctaByKind.set(meta.kind || 'link', (ctaByKind.get(meta.kind || 'link') || 0) + 1);
        break;
      case 'chat_open':
        chatOpen.add(vid);
        break;
      case 'chat_message':
        chatted.add(vid);
        msgCount.set(vid, (msgCount.get(vid) || 0) + 1);
        day.chat.add(vid);
        break;
      case 'chat_handoff':
        handoff.add(vid);
        if (meta.reason === 'contact_sales') contactSales.add(vid);
        break;
      case 'lead_submitted':
        leadForm.add(vid);
        day.lead.add(vid);
        break;
      case 'text_link_show':
        textShow.add(vid);
        break;
      case 'text_link_click':
        textClick.add(vid);
        day.lead.add(vid);
        break;
    }
  }

  // attribute each visitor to their first-seen zip/source/device
  for (const [vid, p] of profile) {
    if (!visitors.has(vid)) continue; // only count real visitors in breakdowns
    if (p.zip) {
      add(byZip, p.zip, vid);
      if (!zipMeta.has(p.zip)) zipMeta.set(p.zip, { city: p.city, region: p.region });
    }
    add(bySource, p.source, vid);
    add(byDevice, p.device, vid);
  }

  // reached 3+ rounds
  const reached3 = new Set();
  for (const [vid, c] of msgCount) if (c >= 3) reached3.add(vid);

  // left contact = submitted form OR clicked the text link
  const leftContact = new Set([...leadForm, ...textClick]);
  // chatted but never left contact
  const noContact = new Set([...chatted].filter((v) => !leftContact.has(v)));

  const V = visitors.size || 0;
  const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0); // 1-decimal %

  return {
    totals: {
      uniqueVisitors: V,
      pageviews,
      pagesPerVisit: V ? Math.round((pageviews / V) * 10) / 10 : 0
    },
    clickThrough: {
      clicks: ctaClicks,
      clickers: clickers.size,
      rate: pct(clickers.size, V),
      byKind: [...ctaByKind.entries()].map(([kind, count]) => ({ kind, count }))
        .sort((a, b) => b.count - a.count)
    },
    chatFunnel: {
      clickedChat: chatOpen.size,
      chatted: chatted.size,
      leftContact: leftContact.size,
      noContact: noContact.size,
      viaForm: leadForm.size,
      viaTextLink: textClick.size,
      reached3Rounds: reached3.size,
      askedForSales: contactSales.size,
      textLinkShown: textShow.size,
      // helpful rates
      openRate: pct(chatOpen.size, V),
      chatToContactRate: pct(leftContact.size, chatted.size)
    },
    zips: topN(byZip, 30, ([zip, set]) => ({
      zip,
      city: (zipMeta.get(zip) || {}).city || '',
      region: (zipMeta.get(zip) || {}).region || '',
      visitors: set.size,
      chats: [...set].filter((v) => chatted.has(v)).length,
      leads: [...set].filter((v) => leftContact.has(v)).length
    })),
    pages: topN(byPageVisitors, 20, ([page, set]) => ({
      page,
      views: byPageViews.get(page) || 0,
      visitors: set.size
    })),
    sources: topN(bySource, 12, ([source, set]) => ({ source, visitors: set.size })),
    devices: topN(byDevice, 5, ([device, set]) => ({ device, visitors: set.size })),
    daily: [...byDay.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, d]) => ({
        date,
        visitors: d.vis.size,
        pageviews: d.pv,
        chats: d.chat.size,
        leads: d.lead.size
      }))
  };
}

/* WalPanel analytics dashboard — served at /admin (behind Cloudflare Access).
   Self-contained HTML. Pulls /api/stats and renders the funnel.
   NOTE: inner script avoids backticks/${} on purpose (this whole file is a
   template literal). */

const DASHBOARD_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>WalPanel — Visitor & Chat Analytics</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
<style>
  :root{ --ink:#1f2430; --muted:#6b7280; --line:#e6e8ec; --bg:#f5f6f8;
         --amber:#c07d28; --amber2:#e8a13a; --good:#2e7d52; --card:#fff; }
  *{box-sizing:border-box}
  body{margin:0;font:15px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:var(--ink);background:var(--bg)}
  header{background:#1f2430;color:#fff;padding:18px 22px;display:flex;flex-wrap:wrap;align-items:center;gap:14px}
  header h1{font-size:18px;margin:0;font-weight:650;letter-spacing:.2px}
  header .who{color:#aeb4c0;font-size:12.5px;margin-left:auto}
  .wrap{max-width:1120px;margin:0 auto;padding:22px}
  .controls{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:18px}
  .controls button{border:1px solid var(--line);background:#fff;color:var(--ink);padding:7px 13px;border-radius:8px;cursor:pointer;font-size:13.5px}
  .controls button.active{background:var(--amber);border-color:var(--amber);color:#fff}
  .controls .spacer{margin-left:auto;color:var(--muted);font-size:12.5px}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:8px}
  .card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:15px 16px}
  .card .k{color:var(--muted);font-size:12.5px;font-weight:600;text-transform:uppercase;letter-spacing:.4px}
  .card .v{font-size:30px;font-weight:700;margin-top:4px;line-height:1}
  .card .s{color:var(--muted);font-size:12.5px;margin-top:5px}
  .v.good{color:var(--good)}
  section{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:18px;margin-top:18px}
  section h2{font-size:14px;margin:0 0 14px;text-transform:uppercase;letter-spacing:.5px;color:var(--muted)}
  .funnel .step{display:flex;align-items:center;gap:12px;margin:8px 0}
  .funnel .lbl{width:160px;font-size:13.5px;color:var(--ink);flex:none}
  .funnel .bar{height:26px;background:linear-gradient(90deg,var(--amber),var(--amber2));border-radius:6px;min-width:2px;transition:width .4s}
  .funnel .num{font-size:13.5px;color:var(--muted)}
  table{width:100%;border-collapse:collapse;font-size:13.5px}
  th,td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--line)}
  th{color:var(--muted);font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.3px}
  td.n,th.n{text-align:right;font-variant-numeric:tabular-nums}
  .two{display:grid;grid-template-columns:1fr 1fr;gap:18px}
  @media(max-width:760px){.two{grid-template-columns:1fr}.funnel .lbl{width:120px}}
  .empty{color:var(--muted);padding:18px 0;text-align:center}
  .note{color:var(--muted);font-size:12px;margin-top:6px}
</style>
</head>
<body>
<header>
  <h1>WalPanel — Visitor &amp; Chat Analytics</h1>
  <span class="who" id="who"></span>
</header>
<div class="wrap">
  <div class="controls">
    <button data-d="7">7 days</button>
    <button data-d="30" class="active">30 days</button>
    <button data-d="90">90 days</button>
    <button data-d="365">1 year</button>
    <button id="reload">↻ Reload</button>
    <span class="spacer" id="updated"></span>
  </div>

  <div class="grid" id="cards"></div>

  <section>
    <h2>Visitor → Chat → Contact funnel</h2>
    <div class="funnel" id="funnel"></div>
    <div class="note">Counts are unique people. ZIP/city are approximate (based on internet connection), so treat them as directional.</div>
  </section>

  <section>
    <h2>Daily trend</h2>
    <div style="position:relative;height:240px"><canvas id="trend"></canvas></div>
  </section>

  <div class="two">
    <section>
      <h2>Top ZIP codes</h2>
      <div id="zips"></div>
    </section>
    <section>
      <h2>Chat detail</h2>
      <div id="chatdetail"></div>
    </section>
  </div>

  <div class="two">
    <section>
      <h2>Top pages</h2>
      <div id="pages"></div>
    </section>
    <section>
      <h2>Traffic sources &amp; devices</h2>
      <div id="srcdev"></div>
    </section>
  </div>
</div>

<script>
var state = { days: 30 };
var chart = null;

function n(x){ return (x==null?0:x).toLocaleString('en-US'); }
function pc(x){ return (x==null?0:x) + '%'; }
function el(id){ return document.getElementById(id); }

function card(k, v, s, good){
  return '<div class="card"><div class="k">'+k+'</div><div class="v'+(good?' good':'')+'">'+v+'</div>'+(s?'<div class="s">'+s+'</div>':'')+'</div>';
}

function step(lbl, val, max){
  var w = max>0 ? Math.max(2, Math.round(val/max*100)) : 2;
  return '<div class="step"><div class="lbl">'+lbl+'</div><div class="bar" style="width:'+w+'%"></div><div class="num">'+n(val)+'</div></div>';
}

function table(cols, rows){
  if(!rows.length) return '<div class="empty">No data yet for this range.</div>';
  var h = '<table><thead><tr>';
  cols.forEach(function(c){ h += '<th class="'+(c.n?'n':'')+'">'+c.label+'</th>'; });
  h += '</tr></thead><tbody>';
  rows.forEach(function(r){
    h += '<tr>';
    cols.forEach(function(c){ h += '<td class="'+(c.n?'n':'')+'">'+(c.fmt?c.fmt(r[c.key],r):(r[c.key]==null?'':r[c.key]))+'</td>'; });
    h += '</tr>';
  });
  return h + '</tbody></table>';
}

function render(s){
  var t = s.totals, ct = s.clickThrough, cf = s.chatFunnel;
  el('who').textContent = s.viewer ? ('Signed in as ' + s.viewer) : '';
  el('updated').textContent = 'Updated ' + new Date(s.generatedAt).toLocaleString();

  el('cards').innerHTML =
    card('Unique visitors', n(t.uniqueVisitors), n(t.pageviews)+' pageviews · '+t.pagesPerVisit+' pages/visit') +
    card('Click-through', pc(ct.rate), n(ct.clickers)+' of '+n(t.uniqueVisitors)+' clicked a CTA') +
    card('Clicked chat', n(cf.clickedChat), pc(cf.openRate)+' of visitors') +
    card('Chatted', n(cf.chatted), 'sent a message') +
    card('Left contact', n(cf.leftContact), pc(cf.chatToContactRate)+' of chatters', true) +
    card('Chatted, no contact', n(cf.noContact), 'no info left');

  var max = t.uniqueVisitors || 1;
  el('funnel').innerHTML =
    step('Visitors', t.uniqueVisitors, max) +
    step('Clicked chat', cf.clickedChat, max) +
    step('Chatted', cf.chatted, max) +
    step('Left contact', cf.leftContact, max);

  el('chatdetail').innerHTML = table(
    [{label:'Step',key:'k'},{label:'People',key:'v',n:true}],
    [
      {k:'Clicked chat', v:n(cf.clickedChat)},
      {k:'Chatted (≥1 msg)', v:n(cf.chatted)},
      {k:'Reached 3+ rounds', v:n(cf.reached3Rounds)},
      {k:'Asked for sales', v:n(cf.askedForSales)},
      {k:'Saw text-us link', v:n(cf.textLinkShown)},
      {k:'Left contact — via form', v:n(cf.viaForm)},
      {k:'Left contact — via text link', v:n(cf.viaTextLink)},
      {k:'Chatted, no contact', v:n(cf.noContact)}
    ]
  );

  el('zips').innerHTML = table(
    [{label:'ZIP',key:'zip'},{label:'City',key:'city',fmt:function(v,r){return (v||'')+(r.region?', '+r.region:'');}},
     {label:'Visitors',key:'visitors',n:true},{label:'Chats',key:'chats',n:true},{label:'Leads',key:'leads',n:true}],
    s.zips
  );

  el('pages').innerHTML = table(
    [{label:'Page',key:'page'},{label:'Views',key:'views',n:true},{label:'Visitors',key:'visitors',n:true}],
    s.pages
  );

  var sd = '<table><thead><tr><th>Source</th><th class="n">Visitors</th></tr></thead><tbody>';
  s.sources.forEach(function(r){ sd += '<tr><td>'+r.source+'</td><td class="n">'+n(r.visitors)+'</td></tr>'; });
  sd += '</tbody></table><div style="height:10px"></div>';
  sd += '<table><thead><tr><th>Device</th><th class="n">Visitors</th></tr></thead><tbody>';
  s.devices.forEach(function(r){ sd += '<tr><td>'+r.device+'</td><td class="n">'+n(r.visitors)+'</td></tr>'; });
  sd += '</tbody></table>';
  el('srcdev').innerHTML = sd;

  drawTrend(s.daily);
}

function drawTrend(daily){
  var ctx = el('trend').getContext('2d');
  var labels = daily.map(function(d){ return d.date.slice(5); });
  var mk = function(key,color){ return {label:key,data:daily.map(function(d){return d[key];}),borderColor:color,backgroundColor:color,tension:.3,pointRadius:0,borderWidth:2}; };
  if(chart) chart.destroy();
  chart = new Chart(ctx, {
    type:'line',
    data:{ labels:labels, datasets:[ mk('visitors','#c07d28'), mk('chats','#3b82f6'), mk('leads','#2e7d52') ] },
    options:{ responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ position:'bottom', labels:{ boxWidth:12 } } },
      scales:{ y:{ beginAtZero:true, ticks:{ precision:0 } }, x:{ grid:{ display:false } } } }
  });
}

function load(){
  el('cards').innerHTML = '<div class="empty">Loading…</div>';
  fetch('/api/stats?days=' + state.days, { credentials:'include' })
    .then(function(r){ if(!r.ok) throw new Error(r.status===403?'Locked — sign in via Cloudflare Access.':'HTTP '+r.status); return r.json(); })
    .then(render)
    .catch(function(e){ el('cards').innerHTML = '<div class="empty">'+e.message+'</div>'; });
}

document.querySelectorAll('.controls [data-d]').forEach(function(b){
  b.addEventListener('click', function(){
    document.querySelectorAll('.controls [data-d]').forEach(function(x){ x.classList.remove('active'); });
    b.classList.add('active');
    state.days = parseInt(b.getAttribute('data-d'),10);
    load();
  });
});
el('reload').addEventListener('click', load);
load();
</script>
</body>
</html>`;

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
function checkAccess(request, env, url) {
  const email = request.headers.get('Cf-Access-Authenticated-User-Email');
  if (email) return null;
  if (env.DASH_KEY) {
    if (url.searchParams.get('key') === env.DASH_KEY) return null;
    const cookie = request.headers.get('Cookie') || '';
    const m = cookie.match(/(?:^|;\s*)wp_dash=([^;]+)/);
    if (m && decodeURIComponent(m[1]) === env.DASH_KEY) return null;
  }
  return new Response(
    'Dashboard locked. Open /admin?key=YOURKEY (set DASH_KEY secret), or sign in via Cloudflare Access.',
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
