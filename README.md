# EarthSignal

**Is it really changing in your district? NASA data, tested for significance, turned into action.**

Team Friday · NASA Space Apps Challenge 2026 · *Be an Earth System Trend Detective!*

**Live app: https://earthsignal.vercel.app**

**Demo video:** 28 seconds, source in [`video/`](video/). Submission text: [`docs/SUBMISSION.md`](docs/SUBMISSION.md).

EarthSignal is a map of India's 735 districts that gives a verdict, not just a picture. It tests up to 25 years of NASA satellite and model records for real trends, throws out the false leads, and then shows officials which confirmed problems to act on first.

## What it does

### Detect

Pick a variable and a season. Each district is coloured by its trend: coral for rising, blue for falling, solid if the change is confirmed, faded if it is not.

Click or search a district to open its **case file**:

- **Verdict**: change confirmed, false lead dismissed, or not proven.
- **Evidence**: change per decade with a 95% range, a chart (yearly, monthly, or with seasons removed), a second-opinion t-test, a month-by-month calendar, and a CSV download.
- **Clues**: every variable that changed significantly in this district.
- **Alibis**: apparent changes that failed the test.
- **Suspects**: nearby emission sources. Shown as association, never as proof.

### Policy

Pick a state or district and, optionally, the airshed around it.

- **Confirmed problems** ranked by severity, each with its change per decade, season and 95% range.
- **Alerts**: where fires, NO₂ or SO₂ are far above normal right now.
- **Watchlist**: the largest emission sources in the area.
- **AI brief and questions**: ask anything in plain language. The AI is given only the facts on the page, must cite them, and the page checks every number it writes against the data.

### Learn

Guided cases and an Investigate flow for people new to trend data.

## The numbers

| | |
|---|---|
| Districts | 735 |
| Variables | 11 |
| Tests run | 134,399 |
| Look significant on their own (p < 0.05) | 52,344 |
| Survive false-discovery-rate correction | 39,603 |
| False leads dismissed | 12,741 |

## Method

- **Direction**: seasonal Mann-Kendall test for whole-year trends; Hamed-Rao corrected Mann-Kendall for seasons and months. Fires are tested on yearly totals.
- **Size**: Sen's slope per decade with a 95% confidence interval.
- **Many tests**: Benjamini-Hochberg false-discovery-rate correction across districts for each variable and period. A trend counts only if q < 0.05.
- **Data rules**: at least 70% of months must be present. Gaps are never filled.
- **Validation**: 28 series re-derived through NASA Giovanni. 26 reach the same verdict. The two that disagree are model rainfall against independent satellite rainfall. See [`docs/VALIDATION.md`](docs/VALIDATION.md).

## Data

| Variable | Source | Record |
|---|---|---|
| Nitrogen dioxide (NO₂) | NASA Aura OMI, OMNO2d v003 | 2005–2025 |
| Sulphur dioxide (SO₂) | NASA Aura OMI, OMSO2e v003 | 2005–2025 |
| Haze (aerosol optical depth) | NASA CERES via NASA POWER | 2001–2025 |
| Surface sunlight | NASA CERES via NASA POWER | 2001–2025 |
| Fires | NASA FIRMS, MODIS Terra + Aqua | 2003–2025 |
| Greenness (NDVI) | NASA Terra MODIS, MOD13C2 | 2001–2025 |
| Land surface temperature | NASA Terra MODIS, MOD11C3 | 2001–2022 |
| Air temperature, peak heat, rainfall, soil moisture | NASA MERRA-2 via NASA POWER | 2001–2025 |

Also used: NASA GIBS imagery, NASA FIRMS VIIRS live fires, NASA Giovanni (validation, including GPM IMERG rainfall), Climate TRACE emission sources (CC BY 4.0), geoBoundaries (ODbL), OpenFreeMap / OpenStreetMap basemap.

## Limits

- The four MERRA-2 variables are model output and are **not validated**. The app labels them and keeps them out of Policy.
- Satellite cells are 25 to 100 km wide. Neighbouring districts can share a cell.
- A trend is not a cause. A source near a trend is an association.
- Climate TRACE emissions are estimates, not measurements.
- MODIS land temperature stops at 2022 because Terra's orbit drifted afterwards.
- Falling fire counts in Punjab may partly reflect burning that moved to later in the day, after the satellite passes.

## Run it locally

The app is a static site with no build step.

```bash
cd web && python3 -m http.server 8000   # then open http://localhost:8000
```

The AI brief needs the serverless function in `api/brief.js` and a `GEMINI_API_KEY` environment variable, so it works on Vercel but not on the plain local server. Everything else works locally.

Useful links: `?tab=policy` opens the Policy workspace, `?ui=exp` opens the experimental interface, `?clean=1` hides the Learn and Experimental buttons for recording.

## Rebuild the data

Python 3.11+, with `numpy`, `pandas`, `xarray`, `geopandas`, `pymannkendall`, `statsmodels`. The OMI and MODIS downloads need a NASA Earthdata login; FIRMS needs a free map key. Keep both in a local `.secrets/` folder, which is git-ignored.

```bash
python scripts/build_boundaries.py      # districts and states
python scripts/build_suspects.py        # Climate TRACE sources
python scripts/fetch_power.py           # CERES and MERRA-2 variables
python scripts/fetch_omi_no2.py
python scripts/fetch_omi_so2.py
python scripts/fetch_modis_cmg.py LST
python scripts/fetch_modis_cmg.py NDVI
python scripts/fetch_firms.py
python scripts/district_trends.py       # the tests: writes web/data/trends.json
python scripts/build_policy.py          # writes web/data/policy.json
python scripts/validate_giovanni.py     # writes web/data/validation.json
```

## Repository layout

| Path | Contents |
|---|---|
| `web/` | The app: plain JavaScript and MapLibre GL |
| `web/data/` | Precomputed trends, series, boundaries and sources |
| `api/brief.js` | Serverless function for the AI brief |
| `scripts/` | Data pipeline and statistics |
| `docs/` | Plan, datasets, parameters, validation, submission text |
| `video/` | HyperFrames source for the demo video |

## Development timeline

- **13 Nov 2026 (before the event):** planning documents, boundary and source data, the first district trend pipeline, the first map, and the first satellite download scripts. This work is the first commit in this repository; its full history is in the earlier repository `NamaiBest/SpaceApps-Team-Friday`.
- **14–15 Nov 2026 (during the event):** confidence intervals, SO₂, the Policy workspace and AI brief, NASA Giovanni validation, the theme, the Learn view, evidence charts, the verdict stamp, and the 3D and readout controls.

## Use of AI

AI tools were used to build this project. Claude (Anthropic) assisted with writing code, the data pipeline and documentation. Google Gemini writes the optional policy brief inside the app, from the page's facts only. The team chose the methods and checked the results against NASA Giovanni. No AI-generated images, video or audio are used.

## Demo video credits

Climate footage: NASA Scientific Visualization Studio (public domain). Music: "Dans le Noir" by SkySonik, CC BY 3.0, via Jamendo.

## Licence

MIT. See [`LICENSE`](LICENSE). Data sources keep their own licences, listed above.
