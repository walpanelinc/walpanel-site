/* WalPanel analytics dashboard — served at /admin (behind Cloudflare Access).
   Self-contained HTML. Pulls /api/stats and renders the funnel.
   NOTE: inner script avoids backticks/${} on purpose (this whole file is a
   template literal). */

export const DASHBOARD_HTML = `<!doctype html>
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
