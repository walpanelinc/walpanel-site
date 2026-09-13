/* ============================================
   WalPanel — Calculators
   ============================================ */

const TAX = 0.0975;

const BOARD = {
  108: { price: 35.36, sqftPerPc: 6.00, label: '108"' },
  114: { price: 37.18, sqftPerPc: 6.33, label: '114"' }
};

const FENCE = {
  setPrice: 248.00,
  setWidth: 6,
  extraPostPrice: 90.00,
  gatePrice: 398.00,
  minOrder: 5
};

const DECK = {
  16: { price: 35.36, sqftPerPc: 8.00, label: '16 ft' }
};

// volume discount for boards
function boardDiscount(qty){
  if (qty >= 100) return 20;
  if (qty >= 50)  return 15;
  if (qty >= 30)  return 10;
  return 0;
}

function fmt(n){ return '$' + n.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2}); }

// =================== BOARD CALCULATOR ===================
function initBoardCalc(){
  const w  = document.getElementById('bc-width');
  const h  = document.getElementById('bc-height');
  const sz = document.getElementById('bc-size');
  const waste = document.getElementById('bc-waste');
  if (!w) return;

  function recalc(){
    const wallW = parseFloat(w.value) || 0;
    const wallH = parseFloat(h.value) || 0;
    const sizeKey = sz.value;
    const wastePct = parseFloat(waste.value) || 10;

    const sqft = wallW * wallH;
    const sqftWithWaste = sqft * (1 + wastePct/100);
    const pcs = Math.ceil(sqftWithWaste / BOARD[sizeKey].sqftPerPc);
    const unitPrice = BOARD[sizeKey].price;
    const subtotal = pcs * unitPrice;
    const tax = subtotal * TAX;
    const total = subtotal + tax;

    document.getElementById('bc-sqft').textContent  = sqft ? sqft.toFixed(0) + ' sq ft' : '— sq ft';
    document.getElementById('bc-pcs').textContent   = pcs ? pcs + ' pcs' : '— pcs';
    document.getElementById('bc-unit').textContent  = pcs ? fmt(unitPrice) : '—';
    document.getElementById('bc-subt').textContent  = pcs ? fmt(subtotal) : '—';
    document.getElementById('bc-tax').textContent   = pcs ? fmt(tax) : '—';
    document.getElementById('bc-total').textContent = pcs ? fmt(total) : '$0.00';

    const minWarn = document.getElementById('bc-min');
    if (minWarn) minWarn.style.display = pcs > 0 && pcs < 15 ? 'block' : 'none';
  }
  [w,h,sz,waste].forEach(el => el.addEventListener('input', recalc));
  recalc();
}

// =================== FENCE CALCULATOR ===================
function initFenceCalc(){
  const lf = document.getElementById('fc-length');
  if (!lf) return;
  const gt = document.getElementById('fc-gates');

  function recalc(){
    const linearFt = parseFloat(lf.value) || 0;
    const gates = gt ? Math.max(0, Math.floor(parseFloat(gt.value) || 0)) : 0;
    if (linearFt <= 0 && gates <= 0){
      ['fc-sets','fc-posts','fc-set-cost','fc-post-cost','fc-gate-cost','fc-tax','fc-total'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = '—';
      });
      document.getElementById('fc-total').textContent = '$0.00';
      const mw = document.getElementById('fc-min');
      if (mw) mw.style.display = 'none';
      return;
    }
    // bays — each bay is 6 ft wide
    const sets = Math.ceil(linearFt / FENCE.setWidth);
    // posts — N bays need N+1 posts total. Each set ships with 1 post,
    // so we need exactly 1 extra post regardless of number of sets.
    const extraPosts = sets > 0 ? 1 : 0;
    const setCost = sets * FENCE.setPrice;
    const postCost = extraPosts * FENCE.extraPostPrice;
    const gateCost = gates * FENCE.gatePrice;
    const subtotal = setCost + postCost + gateCost;
    const tax = subtotal * TAX;
    const total = subtotal + tax;

    document.getElementById('fc-sets').textContent = sets + ' set' + (sets!==1?'s':'');
    document.getElementById('fc-posts').textContent = extraPosts + ' post' + (extraPosts!==1?'s':'');
    document.getElementById('fc-set-cost').textContent = fmt(setCost);
    document.getElementById('fc-post-cost').textContent = fmt(postCost);
    const gateEl = document.getElementById('fc-gate-cost');
    if (gateEl) gateEl.textContent = gates > 0 ? gates + ' × ' + fmt(FENCE.gatePrice) + ' = ' + fmt(gateCost) : '—';
    document.getElementById('fc-tax').textContent = fmt(tax);
    document.getElementById('fc-total').textContent = fmt(total);

    const minWarn = document.getElementById('fc-min');
    if (minWarn) minWarn.style.display = sets > 0 && sets < 5 ? 'block' : 'none';
  }
  [lf, gt].forEach(el => { if (el) el.addEventListener('input', recalc); });
  recalc();
}

// =================== DECK CALCULATOR ===================
function initDeckCalc(){
  const L  = document.getElementById('dc-length');
  const W  = document.getElementById('dc-width');
  const sz = document.getElementById('dc-size');
  const waste = document.getElementById('dc-waste');
  if (!L) return;

  function recalc(){
    const deckL = parseFloat(L.value) || 0;
    const deckW = parseFloat(W.value) || 0;
    const sizeKey = sz ? sz.value : '16';
    const spec = DECK[sizeKey] || DECK[16];
    const wastePct = parseFloat(waste.value) || 10;

    const sqft = deckL * deckW;
    const sqftWithWaste = sqft * (1 + wastePct/100);
    const pcs = Math.ceil(sqftWithWaste / spec.sqftPerPc);
    const unitPrice = spec.price;
    const subtotal = pcs * unitPrice;
    const tax = subtotal * TAX;
    const total = subtotal + tax;

    document.getElementById('dc-sqft').textContent  = sqft ? sqft.toFixed(0) + ' sq ft' : '— sq ft';
    document.getElementById('dc-pcs').textContent   = pcs ? pcs + ' pcs' : '— pcs';
    document.getElementById('dc-unit').textContent  = pcs ? fmt(unitPrice) : '—';
    document.getElementById('dc-subt').textContent  = pcs ? fmt(subtotal) : '—';
    document.getElementById('dc-tax').textContent   = pcs ? fmt(tax) : '—';
    document.getElementById('dc-total').textContent = pcs ? fmt(total) : '$0.00';
  }
  [L,W,sz,waste].forEach(el => { if (el) el.addEventListener('input', recalc); });
  recalc();
}

document.addEventListener('DOMContentLoaded', () => {
  initBoardCalc();
  initFenceCalc();
  initDeckCalc();
});
