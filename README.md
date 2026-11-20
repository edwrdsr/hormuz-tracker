# Hormuz Crisis Tracker

An open-source dashboard built to explore the energy and food supply impacts of a Strait of Hormuz disruption. It combines an interactive country dashboard, a scenario modeler, a personal cost calculator, and oil and news feeds. The historical project site is [HormuzTracker.org](https://hormuztracker.org).

## Architecture

| File | Responsibility |
| --- | --- |
| [index.html](index.html) | Serves the dashboard, fetches oil and news, and runs scenario and consumer-cost calculations in the browser. |
| [worker.js](worker.js) | Cloudflare Worker that fetches Yahoo Finance oil futures data and news from GDELT and ReliefWeb. It exposes oil, news, combined, and health endpoints. |
| [wrangler.toml](wrangler.toml) | Configures a five-minute scheduled refresh and a Cloudflare KV cache binding. The checked-in namespace ID is a placeholder. |
| [tests/oil.test.mjs](tests/oil.test.mjs) | Exercises the Worker HTTP handler and the dashboard's oil refresh code using mocked upstream data and KV. |

Browser → Cloudflare Worker → KV cache or upstream provider. On an oil cache miss, the Worker fetches the futures series, validates the Brent quote, and caches a valid snapshot for five minutes. The dashboard polls for oil every five minutes and news every fifteen minutes.

## Portfolio case study · Oil feed reliability

A failed startup could show simulated prices, while a failed refresh after a successful request could leave the dashboard labeled live. The Worker could also cache responses missing the Brent quote. The reliability change gives a reviewer a repeatable success → failure → recovery sequence.

| Condition | Dashboard behavior |
| --- | --- |
| Valid Brent response | Displays **Oil: API quote**. The status tooltip shows the Worker snapshot timestamp when available. |
| Failed request before a successful quote | Displays an illustrative price labeled **Oil: simulated**. |
| Failed request after a successful quote | Keeps the last displayed Brent quote and labels it **Oil: stale**. |
| Successful refresh after a failure | Replaces the displayed quote and restores **Oil: API quote**. |

The Worker bounds each oil upstream request to two seconds. If it cannot obtain a numeric Brent quote on a cache miss, it emits an `oil_refresh_failed` event, returns HTTP 503 from `/api/oil`, and skips the KV write. The browser bounds each oil request to ten seconds. Its last successful quote lasts for the current page session.

## Run and verify

From the repository root, use Node.js 24 and run:

```sh
node --test tests/oil.test.mjs
```

The four tests cover a cache hit without upstream calls, an invalid response with no cache write, a valid upstream quote written to KV, and a dashboard sequence covering startup failure, success, stale data, and recovery. The tests run offline with no credentials or packages to install.

To view the dashboard locally, run `python3 -m http.server 8000` from the repository root and open `http://localhost:8000`. The page uses its configured hosted Worker and loads Three.js from a CDN. To deploy a separate Worker, configure your own KV namespace in `wrangler.toml` and point `API_BASE` in `index.html` to that Worker.

## Data and assumptions

- Brent and WTI come from futures quotes when available. The Worker snapshot timestamp records when it fetched the data. Quotes may reflect the latest available market session.
- The diesel, jet fuel, and retail gasoline figures are proxies or formula-based estimates. Country classifications, scenario outputs, and historical comparisons reflect embedded inputs and assumptions.
- Editorial references include IEA, FAO, Reuters, Atlantic Council, Dallas Fed, UN ESCAP, CFR, WFP, Columbia CGEP, IFPRI, TFI, and Farmdoc/UIUC.

## Corrections and license

Send corrections to contact@hormuztracker.org. Source code is released under the [MIT license](LICENSE).
