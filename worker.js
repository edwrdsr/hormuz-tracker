// HormuzTracker.org — Cloudflare Worker API
// Fetches live oil prices, news headlines, and crisis data
// Deploy as a Cloudflare Worker, bind KV namespace "CACHE"

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET',
  'Content-Type': 'application/json',
  'Cache-Control': 'public, max-age=60'
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    try {
      if (path === '/api/oil') return await getOilPrices(env);
      if (path === '/api/news') return await getNews(env);
      if (path === '/api/all') return await getAll(env);
      if (path === '/api/health') return json({ status: 'ok', ts: new Date().toISOString() });

      return json({ error: 'Not found. Use /api/oil, /api/news, or /api/all' }, 404);
    } catch (e) {
      return json({ error: e.message }, 500);
    }
  },

  // Scheduled cron — runs every 5 minutes to keep cache warm
  async scheduled(event, env) {
    await fetchAndCacheOil(env);
    await fetchAndCacheNews(env);
  }
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS_HEADERS });
}

// ===== OIL PRICES =====
// Uses Yahoo Finance (no auth needed) for Brent (BZ=F) and WTI (CL=F)
async function getOilPrices(env) {
  // Try cache first
  if (env.CACHE) {
    const cached = await env.CACHE.get('oil', 'json');
    if (cached) return json(cached);
  }
  return json(await fetchAndCacheOil(env));
}

async function fetchAndCacheOil(env) {
  const symbols = { brent: 'BZ=F', wti: 'CL=F', heating_oil: 'HO=F', gasoline: 'RB=F' };
  const results = {};

  for (const [name, symbol] of Object.entries(symbols)) {
    try {
      const res = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1mo`,
        { headers: { 'User-Agent': 'HormuzTracker/1.0' } }
      );
      if (res.ok) {
        const data = await res.json();
        const meta = data.chart?.result?.[0]?.meta;
        const closes = data.chart?.result?.[0]?.indicators?.quote?.[0]?.close;
        if (meta) {
          results[name] = {
            price: meta.regularMarketPrice,
            previous_close: meta.chartPreviousClose,
            change: +(meta.regularMarketPrice - meta.chartPreviousClose).toFixed(2),
            change_pct: +(((meta.regularMarketPrice - meta.chartPreviousClose) / meta.chartPreviousClose) * 100).toFixed(2),
            currency: meta.currency,
            symbol: symbol,
            // Last 30 days for sparkline
            history: closes ? closes.filter(c => c !== null).slice(-30) : []
          };
        }
      }
    } catch (e) {
      results[name] = { error: e.message };
    }
  }

  // Pre-war baseline for context
  results.context = {
    pre_war_brent: 87.20,
    peak_brent: 126.40,
    peak_date: '2026-03-08',
    closure_start: '2026-02-28'
  };

  results.updated = new Date().toISOString();

  // Cache for 5 minutes
  if (env.CACHE) {
    await env.CACHE.put('oil', JSON.stringify(results), { expirationTtl: 300 });
  }
  return results;
}

// ===== NEWS / ALERTS =====
// Uses GDELT API (free, no auth) + ReliefWeb API (free, appname only)
async function getNews(env) {
  if (env.CACHE) {
    const cached = await env.CACHE.get('news', 'json');
    if (cached) return json(cached);
  }
  return json(await fetchAndCacheNews(env));
}

async function fetchAndCacheNews(env) {
  const alerts = [];

  // GDELT — latest articles mentioning Hormuz
  try {
    const gdeltRes = await fetch(
      'https://api.gdeltproject.org/api/v2/doc/doc?query=hormuz%20OR%20%22strait%20of%20hormuz%22&mode=ArtList&maxrecords=10&format=json&sort=DateDesc'
    );
    if (gdeltRes.ok) {
      const gdelt = await gdeltRes.json();
      if (gdelt.articles) {
        for (const art of gdelt.articles.slice(0, 5)) {
          alerts.push({
            tag: 'update',
            text: art.title,
            source: art.domain,
            url: art.url,
            time: art.seendate,
            origin: 'gdelt'
          });
        }
      }
    }
  } catch (e) { /* GDELT failed, continue */ }

  // ReliefWeb — humanitarian reports
  try {
    const rwRes = await fetch(
      'https://api.reliefweb.int/v2/reports?appname=hormuztracker.org&query[value]=hormuz%20OR%20iran%20war&sort[]=date:desc&limit=5&fields[include][]=title&fields[include][]=source.name&fields[include][]=date.created&fields[include][]=url'
    );
    if (rwRes.ok) {
      const rw = await rwRes.json();
      if (rw.data) {
        for (const report of rw.data) {
          alerts.push({
            tag: report.fields.title.toLowerCase().includes('emergency') || report.fields.title.toLowerCase().includes('crisis') ? 'breaking' : 'update',
            text: report.fields.title,
            source: report.fields.source?.[0]?.name || 'ReliefWeb',
            url: report.fields.url,
            time: report.fields.date?.created,
            origin: 'reliefweb'
          });
        }
      }
    }
  } catch (e) { /* ReliefWeb failed, continue */ }

  const result = {
    alerts: alerts.slice(0, 8),
    updated: new Date().toISOString()
  };

  // Cache for 15 minutes
  if (env.CACHE) {
    await env.CACHE.put('news', JSON.stringify(result), { expirationTtl: 900 });
  }
  return result;
}

// ===== COMBINED ENDPOINT =====
async function getAll(env) {
  const [oil, news] = await Promise.all([
    getOilPrices(env).then(r => r.json ? r.json() : r),
    getNews(env).then(r => r.json ? r.json() : r)
  ]);

  // For combined, re-fetch if we got Response objects
  let oilData, newsData;
  if (oil instanceof Response) {
    oilData = await oil.json();
  } else {
    oilData = oil;
  }
  if (news instanceof Response) {
    newsData = await news.json();
  } else {
    newsData = news;
  }

  return json({
    oil: oilData,
    news: newsData,
    meta: {
      source: 'HormuzTracker.org Worker API',
      updated: new Date().toISOString()
    }
  });
}
