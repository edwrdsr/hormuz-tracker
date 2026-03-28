# HormuzTracker.org

Open-source crisis intelligence tool tracking the global impact of the 2026 Strait of Hormuz closure.

**Live at [HormuzTracker.org](https://hormuztracker.org)**

## What It Tracks

- **26 countries** with crisis severity classifications (Critical → Elevated)
- **Live oil prices** — Brent, WTI, diesel, jet fuel, US gas (auto-updating)
- **Scenario modeler** — project impacts at 30/60/90/180/365 days of closure
- **Personal cost calculator** — estimate your household's monthly cost increase
- **Cascading effects** — 1st, 2nd, 3rd order consumer impacts
- **Regional impact view** — US, Europe, Asia-Pacific, Middle East & Africa
- **Historical comparison** — 1973, 1979, 1990 vs 2026
- **Data export** — CSV, JSON, executive briefing generator
- **Live news** — auto-populated from GDELT + ReliefWeb

## Data Sources

IEA, FAO, CNBC, Reuters, Atlantic Council, Dallas Federal Reserve, UN ESCAP, Al Jazeera, Council on Foreign Relations, WFP, Columbia CGEP, IFPRI, The Fertilizer Institute, Farmdoc/UIUC, and government press releases.

Full methodology available on the site.

## Architecture

- `index.html` — Complete single-file site (HTML/CSS/JS + Three.js globe)
- `worker.js` — Cloudflare Worker fetching live oil prices + news every 5 min
- Hosted on Cloudflare Pages, auto-updated via Cloudflare Workers + KV

## Auto-Updating Data

| Data | Source | Frequency |
|------|--------|-----------|
| Oil prices (Brent, WTI) | Yahoo Finance via Worker | Every 5 min |
| Derived prices (diesel, jet, gas) | Calculated from live Brent | Every 5 min |
| News headlines | GDELT + ReliefWeb via Worker | Every 5 min |
| Days counter | Calculated from Feb 28 | Automatic |
| Country crisis data | Manual updates | As needed |

## Contributing

If you spot an error, have a correction, or want to add a country:

1. Fork the repo
2. Edit `index.html` — country data is in the `countries` array in the `<script>` section
3. Submit a pull request with your source

## License

MIT — free to use, embed, and modify with attribution.
