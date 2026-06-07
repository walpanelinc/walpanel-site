-- WalPanel Inc. analytics — Cloudflare D1 schema
-- One row per tracked event. No personal data; geo is approximate (IP-based).

CREATE TABLE IF NOT EXISTS events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ts          TEXT NOT NULL,        -- server timestamp, ISO 8601
  visitor_id  TEXT,                 -- anonymous first-party id (random)
  session_id  TEXT,
  event_type  TEXT NOT NULL,        -- pageview | cta_click | chat_open | chat_message
                                    -- | chat_handoff | lead_submitted
                                    -- | text_link_show | text_link_click
  page        TEXT,
  referrer    TEXT,
  source      TEXT,                 -- utm_source / referrer host / 'direct'
  device      TEXT,                 -- mobile | tablet | desktop
  zip         TEXT,                 -- approximate, from Cloudflare IP geo
  city        TEXT,
  region      TEXT,                 -- state/province
  country     TEXT,
  meta        TEXT                  -- JSON: intent, turn, cta label/kind, etc.
);

CREATE INDEX IF NOT EXISTS idx_events_ts      ON events (ts);
CREATE INDEX IF NOT EXISTS idx_events_visitor ON events (visitor_id);
CREATE INDEX IF NOT EXISTS idx_events_type    ON events (event_type);
