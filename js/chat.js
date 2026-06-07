/* ============================================
   WalPanel Inc. — Instant Chat
   Concise rule-based concierge. "Talk to sales" (or any
   contact request, or a question we can't answer) instantly
   shows a Google Voice text + call card. No lead form, no
   round-count gating. Emits funnel events via window.wpTrack.
   ============================================ */

// === ANALYTICS + SMS HELPERS ============================
function track(t, m){ try { (window.wpTrack || function(){})(t, m); } catch (e) {} }
function smsHref(num, body){
  var ua = navigator.userAgent || '';
  var sep = /iPhone|iPad|iPod|Macintosh|Mac OS X/i.test(ua) ? '&' : '?';  // Apple devices expect &body=
  return 'sms:' + num + sep + 'body=' + encodeURIComponent(body);
}

// === INTENT MATCHER ============================
function classify(text){
  const t = text.toLowerCase();
  if (/(call|speak|talk|sales|human|person|agent|contact|reach|text|phone|number)/.test(t)) return 'handoff';
  if (/^(hi|hello|hey|yo|sup|good (morning|afternoon|evening))\b/.test(t)) return 'greet';
  if (/(contractor|trade|bulk|wholesale|installer)/.test(t)) return 'contractor';
  if (/(\d+)\s*(piece|pc|pcs|board|panel|sq|square feet|sqft|sq\.? ?ft|set|foot|feet|ft)/.test(t)) return 'qty';
  if (/(price|cost|how much|quote|pricing)/.test(t)) return 'price';
  if (/(color|colour|swatch|finish)/.test(t)) return 'color';
  if (/(deliver|shipping|ship)/.test(t)) return 'delivery';
  if (/(pickup|pick up|warehouse|showroom|address|location|where)/.test(t)) return 'location';
  if (/(indoor|inside|interior|accent wall|living room|bedroom)/.test(t)) return 'indoor';
  if (/(ground|bury|buried|in[\s-]?ground|soil|dig|concrete footing|post hole)/.test(t)) return 'ground';
  if (/(install|tools|fastener|screw|how do i|mount)/.test(t)) return 'install';
  if (/(fence|panel kit|gate|post)/.test(t)) return 'fence';
  if (/(board|cladding|wall panel|wpc)/.test(t)) return 'boards';
  if (/(trim|corner|l[\s-]?corner)/.test(t)) return 'trim';
  if (/(sample)/.test(t)) return 'sample';
  if (/(return|refund|damage|defect)/.test(t)) return 'returns';
  if (/(warranty|guarantee)/.test(t)) return 'warranty';
  if (/(pay|payment|zelle|cash|card|credit)/.test(t)) return 'payment';
  if (/(custom|special order|specific color)/.test(t)) return 'custom';
  return 'unknown';
}

// === RESPONSES (short + specific) ============================
function botReply(intent, raw){
  switch(intent){
    case 'greet':
      return `Hi! Ask me about cladding, fence kits, pricing, colors, or delivery — or tap <strong>Talk to sales</strong> to text us.`;
    case 'price':
      return `<strong>108" board</strong> $35.36 · <strong>114"</strong> $37.18 · <strong>Fence kit (6×6)</strong> $248 · <strong>Extra post</strong> $90. Min 15 boards / 5 kits; volume discounts at 30+. +9.75% CA tax. Your project size?`;
    case 'color':
      return `<strong>Boards</strong>: Black, Teak, Dark Teak, SPG, wood-grain. <strong>Fence</strong>: Black or Brown. Other colors by special order. Which one?`;
    case 'delivery':
      return `Delivery up to ~60 mi of Chatsworth: ~$150–250 (<20 mi), $250–400 (20–40), $400–650 (40–60). Pickup is free by appointment. What city?`;
    case 'location':
      return `Showroom: <strong>21350 Lassen St, Chatsworth, CA 91311</strong>, by appointment. Want to text us to book a visit?`;
    case 'indoor':
      return `Our WPC is rated <strong>outdoor only</strong>. Text sales before any indoor plan and they'll advise.`;
    case 'ground':
      return `Fence posts are <strong>surface-mount</strong> (bolt to concrete/footing), not buried. A <a href="find-a-pro.html" style="color:var(--amber-deep);text-decoration:underline">pro</a> can set footings.`;
    case 'install':
      return `Boards screw to a solid substrate with expansion gaps (you supply screws). Fence is surface-mount — step-by-step PDF on the Fence page.`;
    case 'fence':
      return `<strong>Fence kit</strong>: 6×6 ft, $248, Black or Brown — 9 panels + post + hardware. Extra bays need one $90 post each. Min 5 kits.`;
    case 'boards':
      return `<strong>HLC-49 cladding</strong>: 8-5/8"×1", 108" ($35.36) or 114" ($37.18), ~8" coverage each. Outdoor only. Want a board count for your wall?`;
    case 'trim':
      return `Color-matched trims: <strong>L-Corner</strong> $18/$20, <strong>Outside Corner</strong> $26/$28, <strong>End Trim</strong> $26/$28 (108"/114"). Sold with cladding. Your layout?`;
    case 'sample':
      return `Samples: <strong>$15 refundable</strong> (pickup) or <strong>$20 shipped</strong>. Want one?`;
    case 'returns':
      return `Inspect at pickup/delivery — final once accepted; defective items replaced. See <a href="terms.html" style="color:var(--amber-deep);text-decoration:underline">terms</a>.`;
    case 'warranty':
      return `No written warranty, but <strong>defective-on-arrival is replaced</strong> — inspect at pickup/delivery. Built for outdoor durability.`;
    case 'contractor':
      return `<strong>WalPanel Pros</strong>: trade pricing, same-day quotes, $50 referral bonus, 2–3% quarterly cashback. Text us to apply.`;
    case 'payment':
      return `<strong>Zelle or cash only</strong>, +9.75% CA tax. No cards or checks.`;
    case 'custom':
      return `Non-stock colors via special order (depends on color, qty, timeline). Text us what you need and we'll price it.`;
    case 'qty': {
      const qtyMatch = raw.match(/(\d+)\s*(piece|pc|pcs|board|panel|set|sq\.?\s*ft|square feet|sqft|ft|foot|feet)/i);
      if (qtyMatch){
        const n = parseInt(qtyMatch[1]);
        const unit = qtyMatch[2].toLowerCase();
        const money = (v) => '$' + v.toLocaleString('en-US', { maximumFractionDigits: 2 });
        if (/board|panel|piece|pc/.test(unit)){
          const list = n * 35.36;
          let pct = 0; if (n >= 100) pct = 20; else if (n >= 50) pct = 15; else if (n >= 30) pct = 10;
          let msg = `<strong>${n} board${n!==1?'s':''}</strong> ≈ ${money(list)} before tax`;
          if (pct > 0) msg += ` (−${pct}% volume → ${money(list * (1 - pct/100))})`;
          msg += n >= 15 ? `. Text us for an exact quote.` : `. Min order 15 boards.`;
          return msg;
        }
        if (/sq|square|ft|foot|feet/.test(unit) && !/linear|run|fence/.test(raw.toLowerCase())){
          const pcs = Math.ceil((n * 1.1) / 6);
          const list = pcs * 35.36;
          let pct = 0; if (pcs >= 100) pct = 20; else if (pcs >= 50) pct = 15; else if (pcs >= 30) pct = 10;
          let msg = `<strong>${n} sq ft</strong> ≈ ${pcs} boards (108"), ${money(list)} before tax`;
          if (pct > 0) msg += ` (−${pct}% → ${money(list * (1 - pct/100))})`;
          return msg + `. Text us for an exact quote.`;
        }
        if (/set/.test(unit) || /fence/.test(raw.toLowerCase())){
          let msg = `<strong>${n} fence set${n!==1?'s':''}</strong> ≈ ${money(n * 248)} before tax`;
          return msg + (n >= 5 ? `. Text us for a delivered quote.` : `. Min 5 sets.`);
        }
      }
      return `Tell me board count, square footage, or fence length and I'll ballpark it.`;
    }
    case 'handoff':
      return `Sure — text or call our sales line:`;
    default:
      return `I'm not sure on that — text our sales team and they'll help:`;
  }
}

// === STATE ============================
let chatState = { open: false, turns: 0, textLinkShown: false, lastContext: '' };

// === UI ============================
function initChat(){
  const bubble = document.getElementById('chat-bubble');
  const win = document.getElementById('chat-window');
  const closeBtn = document.getElementById('chat-close');
  const input = document.getElementById('chat-input');
  const sendBtn = document.getElementById('chat-send');
  const messages = document.getElementById('chat-messages');
  const quickReplies = document.getElementById('quick-replies');

  if (!bubble || !win) return;

  bubble.addEventListener('click', () => {
    win.classList.add('open');
    bubble.style.display = 'none';
    chatState.open = true;
    input.focus();
    track('chat_open');
  });
  closeBtn.addEventListener('click', () => {
    win.classList.remove('open');
    bubble.style.display = 'flex';
    chatState.open = false;
  });

  function appendMsg(html, who){
    const div = document.createElement('div');
    div.className = 'msg msg-' + who;
    div.innerHTML = html;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  }

  // Google Voice text + call card — the primary way to reach sales.
  function showTextLink(reason){
    chatState.textLinkShown = true;
    const body = 'Hi WalPanel! I have a question about your WPC cladding / fence.';
    const href = smsHref('+18582566236', body);

    const wrap = document.createElement('div');
    wrap.className = 'lead-form';
    wrap.innerHTML =
      '<div class="lead-form-title">Text or call our sales line</div>' +
      '<div class="lead-form-sub">Fastest way to reach us — we usually reply quickly during business hours.</div>' +
      '<a id="wp-sms" href="' + href + '" style="display:block;text-align:center;background:var(--amber-deep,#c07d28);color:#fff;padding:12px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:2px">&#128172; Text (858) 256-6236</a>' +
      '<a href="tel:+18582566236" style="display:block;text-align:center;border:1px solid var(--amber-deep,#c07d28);color:var(--amber-deep,#c07d28);padding:11px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:8px">&#128222; Call (858) 256-6236</a>' +
      '<div style="font-size:12px;color:#6b7280;margin-top:8px;text-align:center"><button id="wp-copy" type="button" style="border:1px solid #ddd;background:#fff;border-radius:6px;padding:3px 8px;cursor:pointer">Copy number</button></div>';
    messages.appendChild(wrap);
    messages.scrollTop = messages.scrollHeight;
    track('text_link_show', { reason: reason });

    const smsA = wrap.querySelector('#wp-sms');
    if (smsA) smsA.addEventListener('click', function(){ track('text_link_click', { via: 'sms', reason: reason }); });
    const copyB = wrap.querySelector('#wp-copy');
    if (copyB) copyB.addEventListener('click', function(){
      try { navigator.clipboard.writeText('858-256-6236'); copyB.textContent = 'Copied!'; }
      catch (e) { copyB.textContent = '858-256-6236'; }
      track('text_link_click', { via: 'copy', reason: reason });
    });
  }

  function send(text){
    if (!text) return;
    appendMsg(text.replace(/</g, '&lt;'), 'user');
    input.value = '';
    chatState.turns++;
    if (quickReplies) quickReplies.style.display = 'none';

    setTimeout(() => {
      const intent = classify(text);
      const reply = botReply(intent, text);
      appendMsg(reply, 'bot');
      track('chat_message', { turn: chatState.turns, intent: intent });
      chatState.lastContext = text;

      // Talk-to-sales / contact request, or a question we can't answer →
      // show the Google Voice text + call card right away.
      if (intent === 'handoff' || intent === 'unknown'){
        track('chat_handoff', { reason: 'contact_sales', turn: chatState.turns });
        setTimeout(() => showTextLink('contact_sales'), 300);
      }
    }, 480);
  }

  sendBtn.addEventListener('click', () => send(input.value.trim()));
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') send(input.value.trim());
  });

  if (quickReplies){
    quickReplies.querySelectorAll('.quick-reply').forEach(btn => {
      btn.addEventListener('click', () => send(btn.textContent));
    });
  }
}

document.addEventListener('DOMContentLoaded', initChat);
/* analytics + Google Voice text/call card — v2 */
