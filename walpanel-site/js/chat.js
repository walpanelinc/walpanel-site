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
    use: 'Outdoor only',
    warranty: 'No express written warranty. WPC composite is engineered for outdoor durability. (Internal: do not promise specific years; defer to T&Cs for legal language.)',
    origin: 'Imported',
    minOrder: 15,
    discounts: [
      { min: 1, max: 30, pct: 10 },
      { min: 31, max: 50, pct: 15 },
      { min: 51, max: 100, pct: 20 }
    ],
    customColorMin: 100,
    customColorLeadTime: '~6 weeks',
    fasteners: 'Customer-supplied (installers use their own preferred fasteners)'
  },
  trims: {
    name: 'L-Corner CPJ-06',
    sizes: [
      { dim: '2" × 2" × 108"', pricePreTax: 18.00, priceTaxIn: 19.76 },
      { dim: '2" × 2" × 114"', pricePreTax: 20.00, priceTaxIn: 21.95 }
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
    setContents: 'Each kit includes 9 panels, 1 aluminum post, 2 top/bottom covers, 1 base, 1 cap, 4 corner brackets, and the hardware needed for install. Drill-tail screws are available on request — most installers prefer to use their own.',
    colors: ['Black', 'Brown'],
    minOrder: 5,
    customColorMin: 50,
    customColorLeadTime: '~6 weeks',
    addBay: 'Each additional bay needs only one extra post ($90 each) — no extra full set required.'
  },
  logistics: {
    pickup: 'Same-day or next-day pickup when product is in stock, by appointment',
    delivery: 'Local delivery available — $150–$500 within ~60 miles, quote per job (address, product, quantity, time frame required)',
    install: 'Installation available by quote. We recommend visiting the showroom first so you can evaluate the product hands-on.',
    samples: 'Local pickup samples: $15 refundable deposit. Mail/shipped samples: $20 non-refundable.',
    returns: 'Returns not accepted after acceptance. Customers inspect product at pickup or delivery before signing off. Defer customers to terms.html for full language.',
    damage: 'Customers must inspect product at pickup. No later damage claims accepted after pickup.',
    contractor: 'Contractor discount available. Apply with a copy of your contractor license or business card; tier set per industry standard plus our volume program. Referral bonuses available.'
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
  if (/(price|cost|how much|quote|pricing)/.test(t)) return 'price';
  if (/(color|colour|swatch|finish)/.test(t)) return 'color';
  if (/(deliver|shipping|ship)/.test(t)) return 'delivery';
  if (/(pickup|pick up|warehouse|showroom|address|location|where)/.test(t)) return 'location';
  if (/(install|tools|fastener|screw|how do i)/.test(t)) return 'install';
  if (/(fence|panel kit|gate|post)/.test(t)) return 'fence';
  if (/(board|cladding|wall panel|wpc)/.test(t)) return 'boards';
  if (/(trim|corner|l[\s-]?corner)/.test(t)) return 'trim';
  if (/(sample)/.test(t)) return 'sample';
  if (/(return|refund|damage|defect)/.test(t)) return 'returns';
  if (/(warranty|guarantee)/.test(t)) return 'warranty';
  if (/(contractor|trade|bulk|wholesale)/.test(t)) return 'contractor';
  if (/(pay|payment|zelle|cash|card|credit)/.test(t)) return 'payment';
  if (/(custom|special order|specific color)/.test(t)) return 'custom';
  if (/(call|speak|talk|sales|human|person|agent)/.test(t)) return 'handoff';
  if (/(\d+)\s*(piece|pc|pcs|board|panel|sq|square feet|sqft|sq\.? ?ft|set)/.test(t)) return 'qty';
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
      return `Most orders are local pickup at our Chatsworth showroom. We do offer delivery for an additional $150–$500 within roughly 60 miles, quoted per job. To get a delivery quote we'd need your address, the product and quantity, and your preferred timeframe. Want me to set you up with a sales callback?`;
    case 'location':
      return `Our showroom is at <strong>21350 Lassen St, Chatsworth, CA 91311</strong> (inside ReadySpaces). We're by appointment only — no fixed hours. I can grab your number and have sales schedule a visit. Want me to do that?`;
    case 'install':
      return `Boards mount to plywood, furring strips, or studs — most installers use their own preferred screws or fasteners (we don't sell hardware). For fence kits we have a step-by-step PDF guide on the Fence page. We also offer installation service by quote, though we recommend visiting the showroom first so you can see the product. Want install pricing?`;
    case 'fence':
      return `Our fence kits are <strong>6 ft × 6 ft sets at $248</strong>, in Black or Brown. Each set includes 9 panels, 1 post, top/bottom covers, base, cap, corner brackets, and the hardware to install. For longer runs, you only need one extra post per additional bay — $90 each — not another full set. Minimum order: 5 sets.`;
    case 'boards':
      return `Our WPC cladding (HLC-49 series) is 8-5/8" wide × 1" deep, in 108" or 114" lengths, with a tough UV-resistant outer shell bonded to a structural core. After installation overlap, each board covers about 8 inches wide. <strong>$35.36 for 108"</strong>, $37.18 for 114". Outdoor use only. Want me to calculate boards for a specific wall?`;
    case 'trim':
      return `We carry matching L-Corner trims (CPJ-06) at 2" × 2" × 108" ($18.00) or 114" ($20.00) — all four main board colors: Black, Dark Teak, SPG, Teak. Great for clean inside/outside corner finishes.`;
    case 'sample':
      return `Samples are available two ways: <strong>$15 refundable deposit</strong> for local pickup at the showroom, or <strong>$20 non-refundable</strong> if we ship to you. Want me to set up a sample order?`;
    case 'returns':
      return `We ask customers to inspect product at the time of pickup or delivery to confirm everything looks right before accepting. Once accepted, the order is final. Full details are in our <a href="terms.html" style="color:var(--amber-deep);text-decoration:underline">terms &amp; conditions</a>.`;
    case 'warranty':
      return `WPC composite is engineered for outdoor durability — UV-resistant outer shell, rot- and insect-proof core. We don't publish a specific written warranty; details on what we cover and what we don't are in our <a href="terms.html" style="color:var(--amber-deep);text-decoration:underline">terms &amp; conditions</a>. Many of our contractors have years of installs holding up well — you can also visit the showroom to see and feel the product yourself.`;
    case 'contractor':
      return `Yes — we have a <strong>contractor discount program</strong>. Apply with a copy of your contractor license or business card and we'll set you up with tiered pricing based on industry standards and our volume program. We also offer referral bonuses. Want me to start the application?`;
    case 'payment':
      return `We accept <strong>Zelle or cash only</strong>. No cards, no checks. CA sales tax (9.75%) is added at checkout.`;
    case 'custom':
      return `For colors we don't stock, we can usually source through drop ship or special order — terms depend on the color, quantity, and timeline. Tell me what color you're after and roughly how much you need, and I'll get sales to put together specifics for you.`;
    case 'qty':
      // Pull a quantity hint from the user message
      const qtyMatch = raw.match(/(\d+)\s*(piece|pc|pcs|board|panel|set|sq\.?\s*ft|square feet|sqft|ft|foot|feet)/i);
      if (qtyMatch){
        const n = parseInt(qtyMatch[1]);
        const unit = qtyMatch[2].toLowerCase();
        // Boards-style estimate
        if (/board|panel|piece|pc/.test(unit)){
          let msg = `For about <strong>${n} board${n!==1?'s':''}</strong>, our list price would be roughly $${(n * 35.36).toLocaleString('en-US',{maximumFractionDigits:2})} before tax. `;
          if (n >= 30) msg += `That's well into project-quote territory — let me get a sales callback so we can put together your best price.`;
          else if (n >= 15) msg += `That meets our 15-piece minimum. If you might need more later, let me know and we can talk options.`;
          else msg += `Our minimum order is 15 boards. Want to see if we can adjust the order size?`;
          return msg;
        }
        if (/sq|square|ft|foot|feet/.test(unit) && !/linear|run|fence/.test(raw.toLowerCase())){
          const pcs = Math.ceil((n * 1.1) / 6);
          let msg = `For about <strong>${n} sq ft</strong> with a 10% waste factor, you'd need around ${pcs} of our 108" boards (~$${(pcs * 35.36).toLocaleString('en-US',{maximumFractionDigits:2})} before tax). `;
          if (pcs >= 30) msg += `For that size, our sales team can put together a project-specific quote. Mind if I grab your contact?`;
          else msg += `Want me to set up a callback to confirm the details and pricing?`;
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

// === UI WIRING ============================
let chatState = {
  open: false,
  turns: 0,
  leadShown: false
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

  function appendLeadForm(){
    const wrap = document.createElement('div');
    wrap.className = 'lead-form';
    wrap.innerHTML = `
      <div class="lead-form-title">Talk to our sales team</div>
      <div class="lead-form-sub">Leave your number and we'll call you back at your preferred time.</div>
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
      <button id="lf-submit">Request callback</button>
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
      // === In production: POST this to your CRM / email endpoint ===
      const lead = {
        name,
        phone,
        email: document.getElementById('lf-email').value.trim(),
        time: document.getElementById('lf-time').value,
        project: document.getElementById('lf-project').value,
        qty: document.getElementById('lf-qty').value.trim(),
        timestamp: new Date().toISOString(),
        source: 'Instant chat'
      };
      console.log('LEAD CAPTURED:', lead);
      wrap.innerHTML = `<div class="lead-form-title">Thanks, ${name}!</div>
        <div class="lead-form-sub">Our sales team will call you ${lead.time ? 'in the ' + lead.time.toLowerCase() : 'soon'} at ${phone}. In the meantime, feel free to ask me anything else.</div>`;
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

      if (shouldOfferLead(chatState.turns, intent) && !chatState.leadShown){
        chatState.leadShown = true;
        setTimeout(() => appendLeadForm(), 500);
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
