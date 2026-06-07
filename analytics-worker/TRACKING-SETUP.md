# WalPanel visitor & chat tracking — setup guide

This adds a private analytics system to walpanelinc.com that shows you: unique
visitors, their approximate ZIP code, click‑through, and the full chat funnel
(who opened chat, who chatted, who left contact info, who didn't). It also adds
a one‑tap **"Text us"** link to your Google Voice number inside the chat.

It runs on the **Cloudflare free tier — $0/month** — using the hosting your site
already has.

There are two independent pieces:

- **Site files** (already edited for you): `js/track.js` plus the script tag on
  every page and the updated `js/chat.js`. These deploy the same way you already
  publish the site (push to GitHub → Cloudflare).
- **Analytics Worker** (this folder, `analytics-worker/`): the small backend that
  records events and serves your private dashboard. You deploy it once with the
  steps below.

---

## Part A — Deploy the analytics Worker (one time, ~15 min)

You'll need a computer with **Node.js** installed (nodejs.org) and your Cloudflare
login. Everything is typed into the **Terminal** (Mac) or **Command Prompt**
(Windows).

**1. Install Cloudflare's tool and sign in**

```
npm install -g wrangler
wrangler login
```

A browser window opens — approve access for your Cloudflare account.

**2. Go into the worker folder**

```
cd path/to/WPC/web3/walpanel-site/analytics-worker
```

**3. Create the database**

```
wrangler d1 create walpanel_analytics
```

It prints a block that includes a `database_id = "..."`. **Copy that id.**
Open `wrangler.jsonc` in this folder and replace `PASTE_DATABASE_ID_HERE`
with it, then save.

**4. Create the tables**

```
wrangler d1 execute walpanel_analytics --remote --file=./schema.sql
```

**5. Publish the Worker**

```
wrangler deploy
```

That puts it live on `walpanelinc.com/api/track`, `/api/stats`, and `/admin`.

---

## Part B — Lock the dashboard to your login (one time, ~5 min)

This makes sure only you can see `/admin`. It uses **Cloudflare Access**, also free.

1. In the Cloudflare dashboard go to **Zero Trust → Access → Applications →
   Add an application → Self‑hosted**.
2. Name it `WalPanel Analytics`. Under **Application domains**, add two rows:
   - `walpanelinc.com` path `admin`
   - `walpanelinc.com` path `api/stats`
3. Add a policy: **Action = Allow**, **Include = Emails =
   `walpanelsales@gmail.com`** (add any other people you want to allow).
4. For the login method, **One‑time PIN** works with no extra setup (Cloudflare
   emails you a code). Save.

> Leave `/api/track` **public** — do NOT put it behind Access, or the site can't
> record visits.

Until Access is set up, the dashboard stays locked and shows a reminder instead of
your data — that's intentional.

*(Optional fallback if you want in before configuring Access:* run
`wrangler secret put DASH_KEY`, type a password, then open
`walpanelinc.com/admin?key=YOURPASSWORD`. Set up Access when you can.)*

---

## Part C — Publish the site changes

Publish the edited site the way you normally do (commit and push the repo to
GitHub; Cloudflare redeploys). The new/changed files are:

- `js/track.js` (new)
- `js/chat.js` (updated — events + Google Voice text link)
- every `*.html` page (one new `<script>` line)

---

## Using it

Open **https://walpanelinc.com/admin**, sign in, and you'll see:

| You asked for | Where it shows |
|---|---|
| Unique visitors | top card |
| Profiles / ZIP | "Top ZIP codes" table (+ city, state) |
| Click‑through | "Click‑through" card and rate |
| Clicked chat | "Clicked chat" card |
| Chatted (unique) | "Chatted" card |
| Chatted, no contact left | "Chatted, no contact" card |
| Left contact | "Left contact" card (split: form vs. text) |
| 3+ rounds / asked for sales | "Chat detail" table |

Use the **7 / 30 / 90 day / 1 year** buttons to change the range; **↻ Reload**
for fresh numbers.

### The chat text link
When a visitor reaches 3+ messages or asks for sales, the chat shows the callback
form first. If they skip it (keep chatting, or after ~25 seconds), the bot offers
a **"Text (858) 256‑6236"** button. On a phone it opens their texting app
pre‑addressed to your Google Voice number with their question pre‑filled; on a
computer it shows the number with a copy button and a call link.

---

## Good to know

- **ZIP is approximate.** It comes from the visitor's internet connection, not a
  verified address — great for "is my traffic local / which areas," not exact
  households. It's sometimes blank on cell networks.
- **"Unique visitors"** uses a cookieless first‑party id. If someone clears their
  browser or switches devices they may be counted again — same as every privacy‑
  friendly analytics tool.
- **Privacy.** No third‑party trackers, no cross‑site cookies, no personal data
  beyond approximate geo. Consider adding one line to your Terms/Privacy page:
  *"We collect anonymous, aggregate visit and chat statistics to improve our
  service."*
- **Numbers start at zero** and fill in as real visitors arrive.
