# Team Friday · EarthSignal

**NASA Space Apps Challenge 2026 · _Be an Earth System Trend Detective!_ (Advanced · Earth Science, Software)**

> Pick an Indian district, and EarthSignal tells you what is really changing there, in which season, which nearby sources are the likely suspects, and where today's pollution is heading.

**New here? Read [`TEAM_BRIEF.md`](TEAM_BRIEF.md) (5 minutes).**

## Docs

| File | What's in it |
|---|---|
| [`TEAM_BRIEF.md`](TEAM_BRIEF.md) | Quick read: idea, decisions so far, demo, to-dos |
| [`docs/PLAN.md`](docs/PLAN.md) | Full plan: problem, challenge fit, four layers, limits, data, methods, 48-h schedule, submission checklist |
| [`docs/CHALLENGE_EVALUATION.md`](docs/CHALLENGE_EVALUATION.md) | Challenge text, competing teams, how we differ, rules |
| [`docs/PARAMETERS.md`](docs/PARAMETERS.md) | Which variables, screened from the 55 GCOS Essential Climate Variables |
| [`docs/DATASETS.md`](docs/DATASETS.md) | 34 NASA datasets verified in NASA's catalog, live GIBS layers, India additions |
| [`docs/STACK.md`](docs/STACK.md) | Libraries chosen from GitHub and why |
| [`docs/UI.md`](docs/UI.md) | UI brief (scroll-craft intro, visual rules) |
| [`docs/archive/PLAN_v1.md`](docs/archive/PLAN_v1.md) | Original 27 Oct plan |
| [`design/mockups/`](design/mockups/) | UI mockups (Trends, Live) |

## The app (`web/`)

Static site, no build step. MapLibre globe of India's 735 districts:

- **Detect**: 6 NASA variables, 2001 to 2025, trend per decade for the whole year and each IMD season. Colour = direction, opacity = significance.
- **Case file** (click or search a district): Clues, Pattern (fastest-changing season + month calendar), Alibis, Suspects, Associations, evidence chart.
- **Suspects**: 4,388 industrial sources from Climate TRACE (power, steel, cement, oil & gas, mining, landfills, other industry).
- **Live from NASA**: GIBS imagery (true colour, NO₂, aerosol, SO₂, land temperature) for any date.

```bash
cd web && python3 -m http.server 8000   # then open http://localhost:8000
```

**Hosting:** Vercel, importing this repo (`vercel.json` serves `web/`). Works while the repo is private.

## Policy workspace (Policy tab)

- **v1 · Rules** (default): pick a state or district (+ optional airshed radius). Ranked list of significant trends in the harmful direction, "now vs normal" alerts (live fires, recent SO₂/NO₂), the largest Climate TRACE sources tagged when they sit in India's top-5 % SO₂ cells or where NO₂ is rising, and a downloadable Markdown brief. Built by `scripts/build_policy.py` → `web/data/policy.json`.
- **v2 · AI-assisted** (switch at the top of the panel; remembered per browser; `?policy=v2`): Claude drafts a brief and answers questions **only from the facts on the page**, citing fact IDs (I# issues, A# alerts, S# sources). Every number in the answer is checked against the data and mismatches are flagged.
  - Runs in the Vercel function `api/brief.js`. **Set `ANTHROPIC_API_KEY`** in Vercel → Project → Settings → Environment Variables (optional: `CLAUDE_MODEL`, `ACCESS_CODE`), then redeploy. Without the key, v2 says so and v1 still works.

## Rebuild the data

```bash
pip install geopandas pymannkendall statsmodels
python3 scripts/build_boundaries.py   # districts + states (geoBoundaries; download URLs in the script)
python3 scripts/build_suspects.py     # Climate TRACE sources -> web/data/suspects.geojson
python3 scripts/fetch_power.py        # NASA POWER grids over India (no login, ~15 s)
python3 scripts/district_trends.py    # Mann-Kendall + Sen (95% CI) + FDR -> web/data/trends.json (~2 min)
python3 scripts/build_policy.py       # issues, alerts, source tags -> web/data/policy.json
```

Earlier checks: `scripts/fetch_open_data.sh`, `scripts/catalog.py`, `scripts/quick_check.py` (Arctic September sea ice −0.74 M km²/decade, significant, matches NSIDC; Antarctic February not significant, p = 0.13).

## Known limits (say these in the pitch)

- Variables so far come from NASA POWER, which needs no login: haze and sunlight are satellite-based (CERES SYN1deg, ~100 km); temperature, rainfall and soil moisture are MERRA-2 model reanalysis (~50 km). **NO₂, land temperature and fires at district resolution still need a NASA Earthdata login.**
- MERRA-2 shows cooling over north-west India (for example Ludhiana −0.7 °C/decade). That is probably a reanalysis artefact, not real cooling. **Validate against IMD / GISTEMP before showing temperature to judges.**
- Small neighbouring districts share a grid cell, so their results are not independent.
- Suspects are Climate TRACE estimates and are shown as "nearby", never "responsible".

## Status

🟡 Hackathon **Sat 14 – Sun 15 Nov 2026**, deadline **Sun 15 Nov 23:59 local**.
Repo is **private** for now; it must be made **public** (MIT) before submission.
Confirm with the Local Lead that code written before the event may be used.

## Licence

MIT for our code. NASA, NOAA and NSIDC data remain under their own terms; Climate TRACE is CC BY 4.0; geoBoundaries (India) is ODbL 1.0. Credit all of them on the project page.
