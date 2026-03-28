# HormuzTracker.org — Complete Deployment Guide
## Auto-Updating · Cloudflare Pages + Workers

---

## FILES IN THIS PACKAGE

| File | What it is |
|------|-----------|
| `index.html` | The complete tracker site (rename from hormuz-crisis-tracker.html) |
| `worker.js` | Cloudflare Worker that fetches live oil prices + news every 5 min |
| `wrangler.toml` | Worker config file (only needed if deploying via CLI) |

---

## STEP 1: Fill in your info (5 placeholders)

Open `hormuz-crisis-tracker.html` in a text editor. Find and replace:

| Line | Find | Replace with |
|------|------|-------------|
| ~776 | `[Your Name]` | Your real name |
| ~912 | `[Your Name]` | Same name |
| ~797 | `@[your_handle]` | Your X handle |
| ~801 | `github.com/[you]/hormuz-tracker` | Your GitHub URL |
| ~805 | `linkedin.com/in/[you]` | Your LinkedIn URL |

Then rename the file to `index.html`.

---

## STEP 2: Deploy the Worker (auto-update API)

This gives you live oil prices and news. Takes 5 minutes.

### 2a. Create KV namespace (cache)

1. Cloudflare Dashboard → **Workers & Pages** → **KV** (left sidebar)
2. Click **Create a namespace**
3. Name it: `HORMUZ_CACHE`
4. Copy the **Namespace ID** — you'll need it in 2c

### 2b. Create the Worker

1. Cloudflare Dashboard → **Workers & Pages** → **Create**
2. Click **Create Worker**
3. Name it: `hormuz-api`
4. Click **Deploy** (deploys the hello-world default)
5. Click **Edit Code** (opens the editor)
6. Delete everything in the editor
7. Paste the entire contents of `worker.js`
8. Click **Deploy**

### 2c. Bind the KV cache

1. Go to your `hormuz-api` worker → **Settings** → **Bindings**
2. Click **Add binding** → **KV Namespace**
3. Variable name: `CACHE`
4. KV namespace: select `HORMUZ_CACHE`
5. Click **Save**

### 2d. Enable the cron trigger

1. Same worker → **Settings** → **Triggers**
2. Under **Cron Triggers**, click **Add Cron Trigger**
3. Enter: `*/5 * * * *` (every 5 minutes)
4. Click **Save**

### 2e. Test it

Open in browser: `https://hormuz-api.YOUR_SUBDOMAIN.workers.dev/api/oil`

You should see JSON with live Brent and WTI prices. If you see prices, the Worker is live.

### 2f. Copy your Worker URL

Your Worker URL looks like: `https://hormuz-api.SOMETHING.workers.dev`

You need this for Step 3.

---

## STEP 3: Connect the site to your Worker

Open `index.html` and find this line (search for `API_BASE`):

```
const API_BASE = 'https://hormuz-api.YOUR_SUBDOMAIN.workers.dev';
```

Replace `YOUR_SUBDOMAIN` with your actual Cloudflare Workers subdomain.

For example: `https://hormuz-api.johndoe.workers.dev`

Save the file.

---

## STEP 4: Deploy the site

1. Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages**
2. Click **Upload assets**
3. Project name: `hormuz-tracker`
4. Drag in your `index.html`
5. Click **Deploy**
6. Test at the `.pages.dev` URL

---

## STEP 5: Connect your domain

1. In your Pages project → **Custom domains**
2. Click **Set up a custom domain**
3. Type: `hormuztracker.org`
4. Cloudflare auto-configures DNS (since domain is on Cloudflare)
5. Also add: `www.hormuztracker.org`
6. HTTPS is automatic
7. Wait 2-5 minutes

---

## STEP 6: (Optional) Custom API domain

Instead of `hormuz-api.xxx.workers.dev`, you can use `api.hormuztracker.org`:

1. In your Worker → **Settings** → **Triggers** → **Custom Domains**
2. Add: `api.hormuztracker.org`
3. Then update `API_BASE` in your HTML to `https://api.hormuztracker.org`
4. Re-upload `index.html` to Pages

---

## STEP 7: Analytics

1. Cloudflare Dashboard → **Web Analytics** → **Add a site**
2. Enter `hormuztracker.org`
3. Copy the script tag
4. Add it to the `<head>` of `index.html`
5. Re-upload to Pages

---

## STEP 8: Verify auto-update is working

Open `https://hormuztracker.org` and check:

- **Header** should show `◉ LIVE` in green (not `◉ STATIC` in amber)
- **Oil price** should match current Brent price
- **Alert banner** should show recent real headlines from GDELT/ReliefWeb
- **Console** (F12 → Console tab) should show: `[HormuzTracker] Oil prices updated: Brent $XX.XX`

If header shows `◉ STATIC`:
- Check that the `API_BASE` URL in the HTML is correct
- Test the Worker URL directly in browser
- Check Worker logs in Cloudflare dashboard

---

## STEP 9: Launch

Post the X thread, LinkedIn post, Reddit submissions from original handoff doc.

---

## HOW AUTO-UPDATE WORKS

```
Every 5 minutes:
  Cloudflare Worker cron fires
  → Fetches Brent + WTI from Yahoo Finance (no auth needed)
  → Fetches latest Hormuz news from GDELT + ReliefWeb (no auth needed)
  → Caches results in KV (oil: 5 min, news: 15 min)

When user loads the page:
  → Frontend fetches /api/oil from your Worker
  → Updates oil banner, sparkline, price displays
  → Fetches /api/news from your Worker
  → Updates alert banner with real headlines
  → Shows "◉ LIVE" indicator

If Worker is down:
  → Falls back to price simulation (visual only)
  → Shows "◉ STATIC" indicator
  → Static alert headlines remain
  → Everything else works normally
```

**Free tier limits:** 100,000 Worker requests/day + 100,000 KV reads. The cron runs 288 times/day (every 5 min). Each page load makes 2 API calls. You'd need 50,000 daily visitors to hit limits. Not a concern.

---

## WHAT UPDATES AUTOMATICALLY vs MANUALLY

| Data | Auto? | How |
|------|-------|-----|
| Oil prices (Brent, WTI) | ✅ Auto | Worker fetches from Yahoo Finance every 5 min |
| News headlines | ✅ Auto | Worker fetches from GDELT + ReliefWeb every 5 min |
| Alert banner | ✅ Auto | Populated from live news feed |
| Oil sparkline chart | ✅ Auto | Uses 30-day price history from API |
| Country crisis levels | ❌ Manual | Edit `countries` array in HTML, re-upload |
| Country measures text | ❌ Manual | Edit `countries` array in HTML, re-upload |
| Scenario modeler data | ❌ Manual | Based on published models, update if new research |
| Calculator baselines | ❌ Manual | Update if gas prices shift significantly |
| Days counter | ✅ Auto | Calculated from Feb 28, 2026 in JS |
| Timestamp | ✅ Auto | Shows current time |

**To update manual items:** Edit `index.html`, re-upload to Cloudflare Pages. Takes 30 seconds.

---

## COSTS

| Service | Cost |
|---------|------|
| Cloudflare Pages | Free |
| Cloudflare Workers (100K req/day) | Free |
| Cloudflare KV (100K reads/day) | Free |
| Cloudflare Web Analytics | Free |
| hormuztracker.org domain | ~$12/year |
| **Total** | **$12/year** |
