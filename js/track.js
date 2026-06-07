/* ============================================
   WalPanel Inc. — first-party analytics
   Cookieless, privacy-friendly. No third-party calls,
   no cross-site cookies. Sends events to /api/track,
   which is handled by the WalPanel analytics Worker.
   Captures: unique visitors, pageviews, click-through,
   and (via window.wpTrack) the full chat funnel.
   ============================================ */
(function () {
  'use strict';

  var ENDPOINT = '/api/track';

  // --- stable, anonymous first-party visitor id (random, NOT personal) ---
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      var v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function getStored(store, key, factory) {
    try {
      var v = store.getItem(key);
      if (!v) { v = factory(); store.setItem(key, v); }
      return v;
    } catch (e) {
      // private mode / storage blocked -> ephemeral id, page still works
      return factory();
    }
  }

  var VID = getStored(window.localStorage, 'wp_vid', uuid);          // visitor (persistent)
  var SID = getStored(window.sessionStorage, 'wp_sid', function () { // session
    return uuid().slice(0, 8);
  });

  // --- device class ---
  function device() {
    var ua = navigator.userAgent || '';
    if (/iPad|Tablet/i.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua))) return 'tablet';
    if (/Mobi|iPhone|iPod|Android/i.test(ua)) return 'mobile';
    return 'desktop';
  }

  // --- traffic source (utm_source, else referrer host, else direct) ---
  function source() {
    try {
      var utm = new URLSearchParams(location.search).get('utm_source');
      if (utm) return utm.toLowerCase().slice(0, 40);
      var ref = document.referrer;
      if (!ref) return 'direct';
      var h = new URL(ref).hostname.replace(/^www\./, '');
      if (h === location.hostname) return 'internal';
      return h.slice(0, 60);
    } catch (e) { return 'direct'; }
  }

  var DEV = device();
  var SRC = source();

  // --- send one event (never throws, never blocks the page) ---
  function send(type, meta) {
    try {
      var payload = {
        t: type,
        vid: VID,
        sid: SID,
        page: (location.pathname + location.search).slice(0, 300),
        ref: (document.referrer || '').slice(0, 300),
        src: SRC,
        dev: DEV,
        cts: Date.now(),
        meta: meta || null
      };
      var body = JSON.stringify(payload);
      if (navigator.sendBeacon) {
        navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }));
      } else {
        fetch(ENDPOINT, {
          method: 'POST',
          body: body,
          headers: { 'Content-Type': 'application/json' },
          keepalive: true
        });
      }
    } catch (e) { /* analytics must never break the site */ }
  }

  // public hook used by chat.js (and anything else)
  window.wpTrack = send;

  // --- pageview ---
  function pageview() { send('pageview'); }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', pageview);
  } else {
    pageview();
  }

  // --- click-through: auto-track key CTAs / links (no page edits needed) ---
  function label(el) {
    var t = (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ');
    return t.slice(0, 60);
  }
  document.addEventListener('click', function (e) {
    var el = e.target && e.target.closest ? e.target.closest('a, button') : null;
    if (!el) return;
    var href = el.getAttribute('href') || '';
    var cls = (typeof el.className === 'string' ? el.className : '') || '';
    var isCta =
      el.hasAttribute('data-cta') ||
      /\bbtn\b|button|cta/i.test(cls) ||
      /^tel:|^mailto:|^sms:/i.test(href) ||
      /quote|contact|find-a-pro|contractors|fence|boards/i.test(href);
    if (!isCta) return;
    var kind =
      /^tel:/i.test(href) ? 'call' :
      /^mailto:/i.test(href) ? 'email' :
      /^sms:/i.test(href) ? 'sms' :
      /quote/i.test(href) ? 'quote' : 'link';
    send('cta_click', { label: label(el), href: href.slice(0, 120), kind: kind });
  }, true);
})();
