/* ============================================
   WalPanel Inc. — Instant Chat
   Rule-based concierge with smart hand-off to sales.
   Drop-in client-side bot. For production, the
   `botReply()` function can be wired to your AI provider.
   ============================================ */

// === FACT SHEET v1.0 ============================
const FACTS = {
  business: {
    name: 'WalPanel Inc.',
    brand: 'WalPanel',
    address: '21350 Lassen St, Chatsworth, CA 91311 (ReadySpaces)',
    appointmentOnly: true,
    payment: 'Zelle or cash only',
    taxRate: 0.0975,
    taxZip: '91311'
  },
  boards: {
    series: 'WPC Cladding HLC-49 (dual-layer)',
    sizes: [
      { id: 'HLC-4927', dim: '8-5/8" × 1" × 108"', coverage: '8" × 108" effective (after overlap)', sqft: 6.0, priceTaxIn: 38.80, pricePreTax: 35.36 },
      { id: 'HLC-4929', dim: '8-5/8" × 1" × 114"', coverage: '8" × 114" effective (after overlap)', sqft: 6.33, priceTaxIn: 40.80, pricePreTax: 37.18 }
    ],
    colors: ['Black', 'Dark Teak', 'Dark Teak w/ Black Base', 'SPG w/ Black Base', 'Teak', 'Teak w/ Black Base', 'Teak (Wood Grain)'],
    capCoverage: 'The UV-resistant protective shell (cap) is on the visible show face of the board.',
    use: 'Outdoor only — not rated for interior installation.',
    warranty: 'No express written warranty. Defective-on-arrival product is replaced — customers inspect at pickup/delivery. WPC composite is engineered for outdoor durability. (Internal: do not promise specific years; defer to T&Cs.)',
    minOrder: 15,
    discounts: [
      { min: 30, pct: 10 },
      { min: 50, pct: 15 },
      { min: 100, pct: 20 }
    ],
    customColorLeadTime: 'a few weeks (varies by color and quantity)',
    customColorNote: 'Non-stock colors available via drop ship or special order. No fixed public minimum — depends on color, quantity, and timeline.',
    installGuide: 'No cladding install guide currently published. Cladding is screw-fixed to a solid substrate or battens with expansion gaps. For specifics, contact sales or work with a WalPanel Pro installer.',
    fasteners: 'Fasteners not supplied — installers use their own preferred screws.'
  },
  trims: {
    note: 'Cladding finishing accessories — sold with cladding orders, not separately. Color-matched to HLC-49: Black, Dark Teak, SPG, Teak. Available in 108" and 114" lengths.',
    types: [
      { name: 'L-Corner', use: 'inside & outside corners', price108: 18.00, price114: 20.00 },
      { name: 'Outside Corner', use: 'wraps external corners', price108: 26.00, price114: 28.00 },
      { name: 'End Trim', use: 'finishes board ends & edges', price108: 26.00, price114: 28.00 }
    ],
    colors: ['Black', 'Dark Teak', 'SPG', 'Teak']
  },
  fence: {
    productName: 'WPC Fence Panel Kit',
    setSize: '6 ft W × 6 ft H',
    panelDim: '0.8" D × panel components',
    pricePreTax: 248.00,
    priceTaxIn: 272.18,
    extraPostPreTax: 90.00,
    extraPostTaxIn: 98.78,
    setContents: 'Each kit includes 9 panels, 1 aluminum post, 2 top/bottom covers, 1 base, 1 cap, 4 corner brackets, and the hardware needed for install.',
    mounting: 'Surface-mount only. Posts mount to a solid surface (concrete, footing, etc.) — they are not designed to be buried directly in the ground.',
    colors: ['Black', 'Brown'],
    minOrder: 5,
    customColorLeadTime: 'a few weeks (varies by color and quantity)',
    addBay: 'Each additional bay needs only one extra post ($90 each) — no extra full set required.'
  },
  logistics: {
    pickup: 'Same-day or next-day pickup when product is in stock, by appointment',
    delivery: 'Local delivery within ~60 miles, quoted per job by distance and order size: roughly $150–250 within 20 miles, $250–400 at 20–40 miles, $400–650 at 40–60 miles. Beyond 60 miles is a custom quote up to ~$1,000.',
    deliveryMatrix: {
      '0-20mi': { small: 150, medium: 200, large: 250 },
      '20-40mi': { small: 250, medium: 325, large: 400 },
      '40-60mi': { small: 400, medium: 525, large: 650 },
      '60+mi': 'Custom quote, up to ~$1,000'
    },
    install: 'We don\'t install directly, but we can connect you with a WalPanel Pro installer in Southern California. Visit the showroom first to evaluate the product hands-on.',
    samples: 'Local pickup samples: $15 refundable deposit. Mail/shipped samples: $20 non-refundable.',
    returns: 'Returns not accepted after acceptance. Customers inspect product at pickup or delivery before signing off. Defective-on-arrival items are replaced. Full language in terms.html.',
    damage: 'Customers inspect product at pickup/delivery. Defective-on-arrival is replaced; no later damage claims after acceptance.',
    contractor: 'WalPanel Pros trade program: trade pricing, same-day quotes, $50 referral bonus (new customer, $500+ order), and 2–3% quarterly cash back at Pro/Elite tiers. License or business card helps but isn\'t required to apply.',
    language: 'English'
  },
  forbidden: [
    'lifetime warranty',
    'fireproof',
    '100% waterproof',
    'guaranteed',
    'best price'
  ]
};

// === SIMPLE INTENT MATCHER ============================
function classify(text){
  const t = text.toLowerCase();
  if (/^(hi|hello|hey|yo|sup|good (morning|afternoon|evening))\b/.test(t)) return 'greet';
  if (/(contractor|trade|bulk|wholesale|installer)/.test(t)) return 'contractor';
  // If the message contains a quantity, prioritize the quantity quote (with volume discount) over the generic price list
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
  if (/(call|speak|talk|sales|human|person|agent)/.test(t)) return 'handoff';
  return 'unknown';
}

// === RESPONSES ============================
function botReply(intent, raw){
  switch(intent){
    case 'greet':
      return `Hi! Happy to help with questions about our <strong>WPC cladding boards</strong>, <strong>fence kits</strong>, <strong>trims</strong>, pickup, delivery, or quantity-based pricing. I can also queue a sales callback if you'd like. What can I help you with?`;
    case 'price':
      return `Our standard prices (9.75% CA tax added at checkout):<br><br>
        • <strong>108" board</strong>: $35.36 each (covers ~6.0 sq ft after overlap)<br>
        • <strong>114" board</strong>: $37.18 each (covers ~6.33 sq ft)<br>
        • <strong>L-Corner 108"</strong>: $18.00 &nbsp;|&nbsp; <strong>L-Corner 114"</strong>: $20.00<br>
        • <strong>Fence kit (6×6 ft set)</strong>: $248.00<br>
        • <strong>Extra fence post</strong>: $90.00<br><br>
        Minimum orders: 15 boards or 5 fence kits. <strong>Buying in quantity?</strong> Tell me your project size or how many pieces you need and I'll see what we can do.`;
    case 'color':
      return `<strong>Boards (HLC-49) in stock</strong>: Black · Dark Teak · Dark Teak w/ Black Base · SPG w/ Black Base · Teak · Teak w/ Black Base · Teak (Wood Grain). <strong>Fence kits</strong>: Black or Brown. Need something different? We can source additional colors via drop ship or special order — happy to walk through what's possible for your project. What color are you looking for?`;
    case 'delivery':
      return `Most orders are local pickup at our Chatsworth showroom, but we deliver within about 60 miles. Cost depends on distance and order size — roughly <strong>$150–250 within 20 miles</strong>, <strong>$250–400 at 20–40 miles</strong>, and <strong>$400–650 at 40–60 miles</strong>. Beyond that we'll do a custom quote. If you tell me your city and rough order size I can ballpark it, or set up a sales callback for an exact number.`;
    case 'location':
      return `Our showroom is at <strong>21350 Lassen St, Chatsworth, CA 91311</strong> (inside ReadySpaces). We're by appointment only — no fixed hours. I can grab your number and have sales schedule a visit. Want me to do that?`;
    case 'indoor':
      return `Our WPC cladding is rated for <strong>outdoor use</strong> — it's built for exterior walls, facades, and fences. We don't market it for interior installation, so if you're planning an indoor accent wall I'd suggest checking with sales first about whether it fits your specific situation. Want me to connect you?`;
    case 'ground':
      return `Our fence system is <strong>surface-mount</strong> — the posts attach to a solid surface like a concrete footing or slab, and aren't designed to be buried directly in the ground. This actually helps the product last longer, since direct soil contact is hard on any composite. A <a href="find-a-pro.html" style="color:var(--amber-deep);text-decoration:underline">WalPanel Pro</a> can help with proper footings if you need it. Anything else?`;
    case 'install':
      return `Boards mount to a solid substrate (plywood, furring strips, or studs) with expansion gaps — installers use their own preferred screws, since we don't supply fasteners. Fence posts are <strong>surface-mount</strong> (they aren't buried in the ground). We have a step-by-step PDF for fence on the Fence page; there isn't a published cladding guide yet, so for cladding specifics reach out to sales. For install, we work with a trusted partner, or you can use your own contractor or a <a href="find-a-pro.html" style="color:var(--amber-deep);text-decoration:underline">WalPanel Pro</a>. Want an intro?`;
    case 'fence':
      return `Our fence kits are <strong>6 ft × 6 ft sets at $248</strong>, in Black or Brown. Each set includes 9 panels, 1 post, top/bottom covers, base, cap, corner brackets, and the hardware to install. For longer runs, you only need one extra post per additional bay — $90 each — not another full set. Minimum order: 5 sets.`;
    case 'boards':
      return `Our WPC cladding (HLC-49 series) is 8-5/8" wide × 1" deep, in 108" or 114" lengths, with a tough UV-resistant outer shell bonded to a structural core. After installation overlap, each board covers about 8 inches wide. <strong>$35.36 for 108"</strong>, $37.18 for 114". Outdoor use only. Want me to calculate boards for a specific wall?`;
    case 'trim':
      return `We carry three cladding finishing accessories, color-matched to the boards (Black, Dark Teak, SPG, Teak), each in 108" or 114" lengths: <strong>L-Corner</strong> for inside/outside corners ($18 / $20), <strong>Outside Corner</strong> trim ($26 / $28), and <strong>End Trim</strong> for board ends and edges ($26 / $28). They're sold with cladding orders, not separately — you'll find them on the <a href="boards.html#trims" style="color:var(--amber-deep);text-decoration:underline">cladding page</a>. Tell me your layout and I can help estimate how many you'd need.`;
    case 'sample':
      return `Samples are available two ways: <strong>$15 refundable deposit</strong> for local pickup at the showroom, or <strong>$20 non-refundable</strong> if we ship to you. Want me to set up a sample order?`;
    case 'returns':
      return `We ask customers to inspect product at the time of pickup or delivery to confirm everything looks right before accepting. Once accepted, the order is final. Full details are in our <a href="terms.html" style="color:var(--amber-deep);text-decoration:underline">terms &amp; conditions</a>.`;
    case 'warranty':
      return `WPC composite is engineered for outdoor durability — a UV-resistant outer shell over a rot- and insect-proof core. We don't offer a specific written warranty, but if anything arrives <strong>defective, we'll replace it</strong> — that's why we ask customers to inspect at pickup or delivery. Full details are in our <a href="terms.html" style="color:var(--amber-deep);text-decoration:underline">terms &amp; conditions</a>. You're also welcome to visit the showroom and inspect the product hands-on before buying.`;
    case 'contractor':
      return `Yes — our <strong>WalPanel Pros</strong> trade program gives you tiered pricing, same-day quotes, a $50 referral bonus (new customer placing a $500+ order), and 2–3% quarterly cash back once you reach Pro or Elite tier. A license or business card helps but isn't required to apply — you can submit without it and we'll follow up. Want me to start the application?`;
    case 'payment':
      return `We accept <strong>Zelle or cash only</strong>. No cards, no checks. CA sales tax (9.75%) is added at checkout.`;
    case 'custom':
      return `For colors we don't stock, we can source through drop ship or special order. There's no special minimum beyond our standard order minimum (15 boards / 5 fence kits) for pickup or delivery — direct factory drop ship starts at 100 boards or 50 fence sets. Terms depend on the color, quantity, and timeline. Tell me what color you're after and roughly how much you need, and I'll get sales to put together specifics for you.`;
    case 'qty':
      // Pull a quantity hint from the user message
      const qtyMatch = raw.match(/(\d+)\s*(piece|pc|pcs|board|panel|set|sq\.?\s*ft|square feet|sqft|ft|foot|feet)/i);
      if (qtyMatch){
        const n = parseInt(qtyMatch[1]);
        const unit = qtyMatch[2].toLowerCase();
        // Boards-style estimate
        if (/board|panel|piece|pc/.test(unit)){
          const list = n * 35.36;
          let pct = 0;
          if (n >= 100) pct = 20; else if (n >= 50) pct = 15; else if (n >= 30) pct = 10;
          let msg = `For about <strong>${n} board${n!==1?'s':''}</strong>, list price is roughly $${list.toLocaleString('en-US',{maximumFractionDigits:2})} before tax. `;
          if (pct > 0){
            const discounted = list * (1 - pct/100);
            msg += `At ${n} pieces you'd qualify for our <strong>${pct}% volume discount</strong> — about $${discounted.toLocaleString('en-US',{maximumFractionDigits:2})} before tax. Want a sales callback to lock in your exact quote?`;
          } else if (n >= 15){
            msg += `That meets our 15-piece minimum. At 30+ pieces you'd start earning volume discounts — let me know if you're scaling up.`;
          } else {
            msg += `Our minimum order is 15 boards. Want to see if we can adjust the order size?`;
          }
          return msg;
        }
        if (/sq|square|ft|foot|feet/.test(unit) && !/linear|run|fence/.test(raw.toLowerCase())){
          const pcs = Math.ceil((n * 1.1) / 6);
          const list = pcs * 35.36;
          let pct = 0;
          if (pcs >= 100) pct = 20; else if (pcs >= 50) pct = 15; else if (pcs >= 30) pct = 10;
          let msg = `For about <strong>${n} sq ft</strong> with a 10% waste factor, you'd need around ${pcs} of our 108" boards (~$${list.toLocaleString('en-US',{maximumFractionDigits:2})} before tax). `;
          if (pct > 0){
            const discounted = list * (1 - pct/100);
            msg += `At ${pcs} pieces that's a <strong>${pct}% volume discount</strong> — about $${discounted.toLocaleString('en-US',{maximumFractionDigits:2})}. Mind if I grab your contact for an exact quote?`;
          } else {
            msg += `Want me to set up a callback to confirm the details and pricing?`;
          }
          return msg;
        }
        if (/set/.test(unit) || /fence/.test(raw.toLowerCase())){
          let msg = `For about <strong>${n} fence set${n!==1?'s':''}</strong>, that's $${(n * 248).toLocaleString('en-US')} list before tax. `;
          if (n >= 5) msg += `That meets our 5-set minimum. Want a project quote with delivery included?`;
          else msg += `Our minimum is 5 sets — let me know if we can talk options.`;
          return msg;
        }
      }
      return `Tell me more about your project size — square footage, board count, or fence run length — and I can sketch out pricing or get a sales callback queued.`;
    case 'handoff':
      return `Of course — let me grab your contact info and we'll get back to you soon.`;
    default:
      return `Good question — let me have someone from sales follow up on that. Mind sharing your contact so we can call you back?`;
  }
}

// === LEAD CAPTURE TRIGGERS ============================
function shouldOfferLead(turnCount, intent){
  if (['handoff','qty','contractor','custom','delivery'].includes(intent)) return true;
  if (turnCount >= 3 && intent !== 'unknown') return true;
  return false;
}

// === ANALYTICS + SMS HELPERS ============================
function track(t, m){ try { (window.wpTrack || function(){})(t, m); } catch (e) {} }
function smsHref(num, body){
  var ua = navigator.userAgent || '';
  var sep = /iPhone|iPad|iPod|Macintosh|Mac OS X/i.test(ua) ? '&' : '?';  // Apple devices expect &body=
  return 'sms:' + num + sep + 'body=' + encodeURIComponent(body);
}

// === UI WIRING ============================
let chatState = {
  open: false,
  turns: 0,
  leadShown: false,
  leadSubmitted: false,   // did they submit the callback form?
  textLinkShown: false,   // has the Google Voice text link been offered?
  skipTimer: null,        // timer that surfaces the text link if the form is ignored
  lastContext: '',   // running summary of what the customer asked about
  lastQuote: ''      // most recent quote the bot gave, for the capture form
};

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

  function appendLeadForm(mode){
    const wrap = document.createElement('div');
    wrap.className = 'lead-form';

    // Context-aware framing
    const isQuote = mode === 'quote' && chatState.lastQuote;
    const title = isQuote ? 'Lock in this quote' : 'Talk to our sales team';
    const sub = isQuote
      ? 'Drop your number and we\'ll confirm this pricing, check stock, and lock it in — usually same business day.'
      : 'Leave your number and we\'ll call you back at your preferred time.';
    const btnText = isQuote ? 'Send me this quote' : 'Request callback';

    // Pre-fill the quote summary into a read-only context block if we have one
    const quoteBlock = isQuote
      ? `<div class="lead-form-quote">📋 ${chatState.lastQuote.slice(0, 180)}${chatState.lastQuote.length > 180 ? '…' : ''}</div>`
      : '';

    wrap.innerHTML = `
      <div class="lead-form-title">${title}</div>
      <div class="lead-form-sub">${sub}</div>
      ${quoteBlock}
      <label class="req">Name</label>
      <input type="text" id="lf-name" required>
      <label class="req">Phone</label>
      <input type="tel" id="lf-phone" required placeholder="(555) 123-4567">
      <label>Email (optional)</label>
      <input type="email" id="lf-email">
      <label>Preferred call time</label>
      <select id="lf-time">
        <option value="">Any time</option>
        <option>Morning (9am–12pm)</option>
        <option>Afternoon (12pm–5pm)</option>
        <option>Evening (5pm–8pm)</option>
        <option>Weekend</option>
      </select>
      <label>Project type (optional)</label>
      <select id="lf-project">
        <option value="">Choose…</option>
        <option>Wall cladding — residential</option>
        <option>Wall cladding — commercial</option>
        <option>Fence — residential</option>
        <option>Fence — commercial</option>
        <option>Mixed / multiple</option>
        <option>Other</option>
      </select>
      <label>Estimated quantity (optional)</label>
      <input type="text" id="lf-qty" placeholder="e.g. 200 sq ft / 30 boards / 8 fence sets">
      <button id="lf-submit">${btnText}</button>
    `;
    messages.appendChild(wrap);
    messages.scrollTop = messages.scrollHeight;

    document.getElementById('lf-submit').addEventListener('click', (e) => {
      e.preventDefault();
      const name = document.getElementById('lf-name').value.trim();
      const phone = document.getElementById('lf-phone').value.trim();
      if (!name || !phone){
        alert('Please enter your name and phone number.');
        return;
      }
      const lead = {
        name,
        phone,
        email: document.getElementById('lf-email').value.trim(),
        preferred_call_time: document.getElementById('lf-time').value,
        project_type: document.getElementById('lf-project').value,
        quantity_estimate: document.getElementById('lf-qty').value.trim(),
        chat_context: chatState.lastContext || '(none captured)',
        quote_discussed: chatState.lastQuote || '(no quote given)',
        form_source: isQuote ? 'Instant chat — quote' : 'Instant chat',
        _subject: isQuote ? 'New lead — Chat quote' : 'New lead — Instant chat',
        timestamp: new Date().toISOString()
      };

      chatState.leadSubmitted = true;
      clearTimeout(chatState.skipTimer);
      track('lead_submitted', { mode: isQuote ? 'quote' : 'general' });

      // POST to Formspree
      fetch('https://formspree.io/f/xpqnoajd', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(lead)
      }).then(res => {
        if (!res.ok) console.error('Lead submission failed:', res.status);
      }).catch(err => {
        console.error('Lead submission error:', err);
      });

      wrap.innerHTML = `<div class="lead-form-title">Thanks, ${name}!</div>
        <div class="lead-form-sub">Our sales team will ${isQuote ? 'confirm your quote and ' : ''}call you ${lead.preferred_call_time ? 'in the ' + lead.preferred_call_time.toLowerCase() : 'soon'} at ${phone}. In the meantime, feel free to ask me anything else.</div>`;
    });
  }

  // === GOOGLE VOICE TEXT LINK (shown only if the callback form is skipped) ===
  function showTextLink(reason){
    if (chatState.textLinkShown) return;
    chatState.textLinkShown = true;
    clearTimeout(chatState.skipTimer);

    const topic = chatState.lastContext ? (' about: "' + chatState.lastContext.slice(0, 80) + '"') : '';
    const body = 'Hi WalPanel! I was just on your site and have a question' + topic + '.';
    const href = smsHref('+18582566236', body);

    const wrap = document.createElement('div');
    wrap.className = 'lead-form';
    wrap.innerHTML =
      '<div class="lead-form-title">Prefer to text us?</div>' +
      '<div class="lead-form-sub">One tap to text our sales line at (858)&nbsp;256-6236 — we usually reply quickly during business hours.</div>' +
      '<a id="wp-sms" href="' + href + '" style="display:block;text-align:center;background:var(--amber-deep,#c07d28);color:#fff;padding:12px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:2px">&#128172; Text (858) 256-6236</a>' +
      '<div style="font-size:12px;color:#6b7280;margin-top:8px;text-align:center">On a computer? <a href="tel:+18582566236" style="color:var(--amber-deep,#c07d28);text-decoration:underline">Call instead</a> &nbsp;&middot;&nbsp; <button id="wp-copy" type="button" style="border:1px solid #ddd;background:#fff;border-radius:6px;padding:3px 8px;cursor:pointer">Copy number</button></div>';
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
    appendMsg(text.replace(/</g,'&lt;'), 'user');
    input.value = '';
    chatState.turns++;
    if (quickReplies) quickReplies.style.display = 'none';

    // typing indicator delay
    setTimeout(() => {
      const intent = classify(text);
      const reply = botReply(intent, text);
      appendMsg(reply, 'bot');
      track('chat_message', { turn: chatState.turns, intent: intent });

      // Track context for the sales team: remember the customer's question
      chatState.lastContext = text;
      // If the bot just gave a price/quote, remember a plain-text version for the lead form
      if (/\$[\d,]/.test(reply) && ['qty','price','delivery','fence','boards','trim'].includes(intent)){
        chatState.lastQuote = reply.replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim();
      }

      // "Link only if form skipped": the callback form was already offered and
      // they kept chatting without submitting — surface the text link now.
      if (chatState.leadShown && !chatState.leadSubmitted && !chatState.textLinkShown){
        showTextLink('kept_chatting');
      }

      if (shouldOfferLead(chatState.turns, intent) && !chatState.leadShown){
        chatState.leadShown = true;
        // Why sales is being offered — drives the "3 rounds" / "contact sales" metric
        const reason = intent === 'handoff' ? 'contact_sales' : (chatState.turns >= 3 ? '3rounds' : intent);
        track('chat_handoff', { reason: reason, turn: chatState.turns });
        // Context-aware framing: quote vs general
        const captureMode = (intent === 'qty' || (chatState.lastQuote && ['price','delivery','fence','boards'].includes(intent))) ? 'quote' : 'general';
        setTimeout(() => appendLeadForm(captureMode), 500);
        // If they ignore the form for ~25s, offer the one-tap Google Voice text link.
        chatState.skipTimer = setTimeout(() => {
          if (!chatState.leadSubmitted && !chatState.textLinkShown) showTextLink('form_timeout');
        }, 25000);
      }
    }, 480);
  }

  sendBtn.addEventListener('click', () => send(input.value.trim()));
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') send(input.value.trim());
  });

  // Quick replies
  if (quickReplies){
    quickReplies.querySelectorAll('.quick-reply').forEach(btn => {
      btn.addEventListener('click', () => send(btn.textContent));
    });
  }
}

document.addEventListener('DOMContentLoaded', initChat);
/* analytics + Google Voice text link wired in — v1 */
