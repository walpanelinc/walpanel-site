// Unit test for the funnel aggregation. Run: node test/stats.test.mjs
import { computeStats } from '../src/stats.js';

let ttl = 0, fail = 0;
function eq(label, got, want) {
  ttl++;
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { fail++; console.log('  FAIL  ' + label + '  got=' + JSON.stringify(got) + ' want=' + JSON.stringify(want)); }
  else { console.log('  ok    ' + label + ' = ' + JSON.stringify(got)); }
}

// ---- synthetic dataset (5 visitors), ts kept ordered ----
let k = 0;
const ts = () => '2026-06-01T00:00:' + String(k++).padStart(2, '0') + 'Z';
const ev = (vid, t, o = {}) => ({
  ts: ts(), visitor_id: vid, event_type: t,
  page: o.page || '/', source: o.source || 'direct', device: o.device || 'desktop',
  zip: o.zip || '', city: o.city || '', region: o.region || '', meta: o.meta || null
});

const rows = [
  // V1 — Chatsworth desktop: 2 views, quote CTA, opens chat, 3 msgs (3 rounds), handoff, submits form
  ev('v1','pageview',{zip:'91311',city:'Chatsworth',region:'California'}),
  ev('v1','pageview',{zip:'91311',city:'Chatsworth',region:'California',page:'/boards.html'}),
  ev('v1','cta_click',{meta:{kind:'quote'}}),
  ev('v1','chat_open'),
  ev('v1','chat_message',{meta:{turn:1}}),
  ev('v1','chat_message',{meta:{turn:2}}),
  ev('v1','chat_message',{meta:{turn:3}}),
  ev('v1','chat_handoff',{meta:{reason:'3rounds'}}),
  ev('v1','lead_submitted',{meta:{mode:'quote'}}),

  // V2 — LA mobile via google: opens chat, 1 msg, asks for sales, sees + clicks text link
  ev('v2','pageview',{zip:'90001',city:'Los Angeles',region:'California',device:'mobile',source:'google'}),
  ev('v2','chat_open',{device:'mobile'}),
  ev('v2','chat_message',{device:'mobile',meta:{turn:1}}),
  ev('v2','chat_handoff',{device:'mobile',meta:{reason:'contact_sales'}}),
  ev('v2','text_link_show',{device:'mobile'}),
  ev('v2','text_link_click',{device:'mobile',meta:{via:'sms'}}),

  // V3 — Chatsworth mobile: opens chat, 2 msgs, never leaves contact
  ev('v3','pageview',{zip:'91311',city:'Chatsworth',region:'California',device:'mobile'}),
  ev('v3','chat_open',{device:'mobile'}),
  ev('v3','chat_message',{device:'mobile'}),
  ev('v3','chat_message',{device:'mobile'}),

  // V4 — no zip, bing: just a pageview + a call CTA, no chat
  ev('v4','pageview',{source:'bing'}),
  ev('v4','cta_click',{source:'bing',meta:{kind:'call'}}),

  // V5 — Beverly Hills desktop: opens chat but never sends a message
  ev('v5','pageview',{zip:'90210',city:'Beverly Hills',region:'California'}),
  ev('v5','chat_open')
];

const s = computeStats(rows);

console.log('\nTOTALS');
eq('uniqueVisitors', s.totals.uniqueVisitors, 5);
eq('pageviews', s.totals.pageviews, 6);

console.log('\nCLICK-THROUGH');
eq('clicks', s.clickThrough.clicks, 2);
eq('clickers', s.clickThrough.clickers, 2);
eq('rate %', s.clickThrough.rate, 40);

console.log('\nCHAT FUNNEL (the metrics Annie asked for)');
eq('clickedChat', s.chatFunnel.clickedChat, 4);          // v1,v2,v3,v5
eq('chatted', s.chatFunnel.chatted, 3);                  // v1,v2,v3
eq('leftContact', s.chatFunnel.leftContact, 2);          // v1 form, v2 text
eq('noContact', s.chatFunnel.noContact, 1);              // v3
eq('viaForm', s.chatFunnel.viaForm, 1);                  // v1
eq('viaTextLink', s.chatFunnel.viaTextLink, 1);          // v2
eq('reached3Rounds', s.chatFunnel.reached3Rounds, 1);    // v1 (3 msgs)
eq('askedForSales', s.chatFunnel.askedForSales, 1);      // v2
eq('chatToContactRate %', s.chatFunnel.chatToContactRate, 66.7);

console.log('\nZIP BREAKDOWN');
eq('top zip', s.zips[0].zip, '91311');
eq('91311 visitors', s.zips[0].visitors, 2);             // v1,v3
eq('91311 chats', s.zips[0].chats, 2);                   // both chatted
eq('91311 leads', s.zips[0].leads, 1);                   // v1 only
eq('zip count (no-zip v4 excluded)', s.zips.length, 3);

console.log('\nSOURCES / DEVICES');
eq('source direct', s.sources.find(x => x.source === 'direct').visitors, 3); // v1,v3,v5
eq('device desktop', s.devices.find(x => x.device === 'desktop').visitors, 3); // v1,v4,v5
eq('device mobile', s.devices.find(x => x.device === 'mobile').visitors, 2);   // v2,v3

console.log('\nDAILY');
eq('one day', s.daily.length, 1);
eq('day visitors', s.daily[0].visitors, 5);
eq('day leads (form+text)', s.daily[0].leads, 2);        // v1,v2

console.log('\n' + (fail ? ('✗ ' + fail + '/' + ttl + ' failed') : ('✓ all ' + ttl + ' checks passed')));
process.exit(fail ? 1 : 0);
