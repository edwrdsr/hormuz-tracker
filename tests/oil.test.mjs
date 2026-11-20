import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { createContext, runInContext } from 'node:vm';
import worker from '../worker.js';

const request = new Request('https://example.test/api/oil');
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const oilScript = html.slice(
  html.indexOf('// Oil price simulation'),
  html.indexOf('// Initial fetch'),
);

test('Worker serves a cached Brent quote without fetching upstream', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => Response.error());
  const quote = { brent: { price: 90 } };
  const response = await worker.fetch(request, { CACHE: { get: async () => quote } });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), quote);
  assert.equal(fetch.mock.callCount(), 0);
});

test('Worker rejects an unusable cached quote and does not cache a failed refresh', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ chart: { result: [] } }));
  const response = await worker.fetch(request, {
    CACHE: {
      get: async () => ({ context: {} }),
      put: async () => assert.fail('Failed refresh must never write to KV'),
    },
  });
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(await response.json(), { error: 'Brent quote unavailable' });
});

test('Worker caches a valid upstream Brent quote', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({
    chart: { result: [{ meta: { regularMarketPrice: 90, chartPreviousClose: 88 } }] },
  }));
  const writes = [];
  const response = await worker.fetch(request, {
    CACHE: { get: async () => null, put: async (...args) => writes.push(args) },
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).brent.price, 90);
  assert.equal(writes.length, 1);
  assert.equal(writes[0][0], 'oil');
  assert.equal(JSON.parse(writes[0][1]).brent.price, 90);
  assert.deepEqual(writes[0][2], { expirationTtl: 300 });
});

test('Dashboard labels startup failure, displays a quote, retains it on failure, and recovers', async () => {
  const elements = new Map();
  const document = {
    getElementById(id) {
      if (!elements.has(id)) {
        elements.set(id, { style: {}, classList: { add() {}, remove() {} } });
      }
      return elements.get(id);
    },
  };
  const responses = [
    new Response(null, { status: 503 }),
    Response.json({ brent: { price: 90 }, updated: '2026-03-30T12:00:00Z' }),
    Response.json({ brent: { price: 'invalid' } }),
    Response.json({ brent: { price: 91 } }),
  ];
  const context = createContext({
    document,
    AbortSignal,
    fetch: async () => responses.shift(),
    setTimeout() {},
    console: { log() {}, warn() {} },
  });
  runInContext(oilScript, context);
  const status = document.getElementById('data-status');
  const price = document.getElementById('oil-price-num');

  await context.fetchLiveOil();
  assert.equal(status.textContent, '◉ OIL: SIMULATED');
  await context.fetchLiveOil();
  assert.equal(status.textContent, '◉ OIL: API QUOTE');
  assert.equal(price.textContent, '$90.00');
  await context.fetchLiveOil();
  assert.equal(status.textContent, '◉ OIL: STALE');
  assert.match(status.title, /2026-03-30T12:00:00Z/);
  assert.equal(price.textContent, '$90.00');
  await context.fetchLiveOil();
  assert.equal(status.textContent, '◉ OIL: API QUOTE');
  assert.equal(price.textContent, '$91.00');
});
