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
export function computeStats(rows) {
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
