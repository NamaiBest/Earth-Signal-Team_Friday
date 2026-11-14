# EarthSignal: team brief (5-minute read)

**NASA Space Apps 2026 · Challenge: _Be an Earth System Trend Detective!_ (Advanced)**
Hackathon **Sat 14 – Sun 15 Nov** · Deadline **Sun 15 Nov, 23:59 local** · Full detail: `docs/PLAN.md` · Live: https://earthsignal.vercel.app

---

## The idea in one line
**Pick an Indian district, and EarthSignal tells you what is really changing there, in which season, which nearby sources are the likely suspects, and where today's pollution is heading.**

Pitch: *"Every government has opinions about pollution. EarthSignal gives them evidence: NASA data, tested for significance, down to the district."*

## What the challenge asks (official summary)
Build a tool that (1) selects Earth variables from missions or models, (2) shows how they change over time, (3) says what is changing, where and by how much, and (4) says whether the change is "significant". Bonus point: the same variable can rise in one region and fall in another.

## How we got here (decisions so far)

| # | Decision | Why |
|---|---|---|
| 1 | Picked **Trend Detective** over the Mars "Google Maps" idea | Mars Trek already exists; this challenge fits our data + ML skills |
| 2 | **"Significant" is the core**, not the map | It's what the challenge literally asks; most viewers skip it |
| 3 | Variables chosen by a **standard**: GCOS Essential Climate Variables (55) → **13 core** | "We didn't pick variables, the scientific community did" |
| 4 | Methane/NLC idea → **one layer**, not the base | Global methane maps exist; NLC link is indirect |
| 5 | **Policy lens for India**: state / district / sub-district | Real users, strong local-impact story |
| 6 | **Start from the place, not the variable** | 10+ other teams build "pick a variable, see a map"; place-first case files set us apart |
| 7 | **Suspects** (emission sources) shown *near* hotspots, never "responsible" | Satellites can't do one-to-one factory attribution |
| 8 | Forecast = **NASA's own GEOS-CF 5-day forecast**, not ours | Building a chemistry model in 48 h isn't possible; NASA data scores better |
| 9 | Map = **MapLibre GL globe**, zooms from planet to factory pins | Google Earth feel; Google Maps scraping isn't allowed |

## The product: four layers on one map
1. **Detect** (core): trend + significance for each grid cell, month and season, 2003–2025.
2. **Locate**: roll up to state / district; a **case file** per district: *Clues* (significant changes) · *Pattern* (worst season) · *Alibis* (looks like change, isn't) · *Suspects* (nearby sources) · *Associations* (variables moving together).
3. **Suspects**: pins for power plants, steel, cement, oil & gas, landfills (Climate TRACE, OpenStreetMap industrial, Global Energy Monitor) + CPCB air stations.
4. **What's next** (stretch): NASA GEOS-CF 5-day air-quality forecast + wind; live NASA GIBS satellite tiles.

## What satellites can and can't do (don't overclaim to judges)
- ✅ District trends for NO₂, aerosols, land temperature, vegetation, fires
- ⚠️ Sub-district only for 1 km products; coarse ones (GRACE, MERRA-2) only state/region
- ❌ "This factory caused this pollution": show *nearby suspects*, labelled association
- ❌ CFC footprint per factory: not measurable from space
- ⚠️ Diwali residential vs commercial: use **CPCB ground stations**, not satellites
- ❌ Our own 7–8-day forecast: use NASA GEOS-CF (5 days)

## Demo story
**Delhi NCR & Indo-Gangetic Plain, Oct–Nov**: winter haze/NO₂ trends → worst season → crop fires + industry as suspects → Diwali check from ground stations → NASA forecast of where the smoke goes → one "alibi" that looks scary but isn't significant.

## Built so far (as of Fri 13 Nov, late night IST)

**Live site: https://earthsignal.vercel.app** (auto-redeploys on every push to `main`). Repo: `NamaiBest/SpaceApps-Team-Friday` (private).

### On `main` (live now)
| Piece | What it does |
|---|---|
| **Map** | MapLibre globe; India's 735 districts + 36 states (geoBoundaries, Govt of India LGD source, India's official boundary); search any district/state |
| **Detect** | 6 NASA variables, 2001–2025: haze (AOD), sunlight (CERES satellite), air temp, peak heat, rainfall, soil moisture (MERRA-2 model). Whole year + 4 IMD seasons + 12 months. Colour = direction, opacity = significance |
| **Statistics** | Seasonal Mann-Kendall (whole year), Hamed-Rao autocorrelation-corrected MK (seasons, months), Sen's slope per decade, Benjamini-Hochberg FDR across 735 districts (q < 0.05) |
| **Case file** | Clues · Pattern (fastest season + month calendar) · Alibis (p < 0.05 alone but fails FDR) · Suspects (sources in district + within 50 km) · Associations (year-to-year changes, not shared trend) · evidence chart with Sen's line |
| **Suspects** | 4,388 industrial sources from Climate TRACE (2024 estimates): power, steel, cement, oil & gas, mining, landfills, other industry; clustered pins sized by CO₂e |
| **Live from NASA** | GIBS imagery for any date: true colour, NO₂, aerosol, SO₂, land surface temperature |
| **Experimental UI** (top-right toggle) | Instrument bars (live lat/lon, zoom, district, UTC; method + tally); signal board per variable; suspects board; flat at country view, **tilts into 3D district columns when zoomed in**, Shift + scroll tilts by hand; top movers |

### Satellite data (added Fri night, live)
| Variable | Source | Years | Significant districts (FDR q < 0.05) |
|---|---|---|---|
| **NO₂** (default view) | NASA Aura OMI, daily → monthly, ~25 km | 2005–2025 | 503 (445 rising, 58 falling). Coal belt +0.8 to +1.1 ×10¹⁵ molec/cm²/decade (Singrauli, Korba, Angul, Dhanbad); **Delhi and Mumbai falling** (New Delhi −0.50, 95% CI −0.73 to −0.26, q < 0.0001) |
| **Land surface temperature** | NASA Terra MODIS MOD11C3 | 2001–**2022** | 474 (mostly cooling: validate before quoting) |
| **Greenness (NDVI)** | NASA Terra MODIS MOD13C2 | 2001–2025 | 729 (728 rising) |
| **Fires** | NASA FIRMS MODIS archive, vegetation fires | 2003–2025 | 371 (286 rising, 85 falling; Punjab post-monsoon falling) |
| Live fires | NASA FIRMS VIIRS, last 5 days | 9–13 Nov snapshot | 20,409 detections |

Plus: **Districts / Pixels** switch (per-cell whole-year trends, FDR across cells). Each variable is tested on its own record; months with no data are skipped, never filled.

### Validation against NASA Giovanni (Sat 14 Nov) → `docs/VALIDATION.md`
- **NO₂**: identical to Giovanni at 9/9 sites (r = 1.000, same Sen's slope and p). **SO₂**: r ≥ 0.997 at 8/9, 9/9 same verdict.
- **Air temperature**: our extraction matches MERRA-2 exactly (r = 1.000), so the NW cooling is in the model itself: still unvalidated.
- **Rainfall vs independent GPM IMERG**: agrees at 4/6 sites, but the big MERRA-2 rises at **Lawngtlai and Ludhiana are not confirmed** → artefacts.

### Also new (Sat 14 Nov)
- **SO₂** (OMI, 2005–2025): 140 districts significant; Jharsuguda, Angul, Korba, Singrauli, Jamnagar rising.
- **95 % confidence intervals** on every Sen's slope (Gilbert 1987).
- **Clearer left panel**; **Policy tab** with v1 (rules) / v2 (AI brief + Q&A via Gemini, cited, number-checked; needs `GEMINI_API_KEY` in Vercel).

### Known issues (be honest with judges)
- **MODIS land temperature is cut at 2022**: from 2023 Terra passes over earlier in the day (India-mean −0.7, −1.4, −2.8 °C in 2023–25 = instrument, not climate). Cooling before 2023 may still be partly drift.
- **Fire declines in Punjab** may partly be burning moved to after the satellite passes, not only less burning.
- MERRA-2 **temperature shows cooling over NW India** and **extreme monsoon rainfall rises in the NE**: likely model artefacts. Use MODIS land temperature instead; check rainfall against IMD before quoting.
- Climate TRACE emissions are **estimates**; suspects are "nearby", never "responsible".
- **NASA GEOS-CF forecast**: the open archive's latest run is 2 Jan 2026, so the "What's next" layer needs another source. Not built.
- Live fires and Climate TRACE are **snapshots**; they don't refresh unless the scripts are re-run.

### Earlier groundwork
34 NASA datasets verified in CMR · NOAA gas records + sea-ice downloaded · method validated (Arctic Sept sea ice −0.74 M km²/decade, significant; Antarctic not significant, p = 0.13) · design mockups.

## Policy workspace (built)
Policy tab: pick a state/district (+ airshed). v1 ranks significant worsening trends, alerts and nearby sources; v2 adds an AI brief and Q&A grounded only in those facts. See README.

## Tools we'll use
Python: xarray, pyMannKendall, statsmodels (FDR) · Web: MapLibre GL v5, uPlot, d3-scale-chromatic · Data: NASA Earthdata, GIBS, FIRMS, GEOS-CF, Climate TRACE, OpenStreetMap, OpenAQ (CPCB), geoBoundaries

## 48 h at a glance
Sat AM: data + map + districts → Sat PM: trends + case file → Sat night: suspects + stations → Sun AM: forecast (stretch) + polish → **Sun PM: freeze, record, submit early.**
Cut order if late: forecast → Diwali → sub-district → extra variables. **Never cut** significance testing or the case file.

## Do before tomorrow
- [x] NASA Earthdata Login + token (Namai) · [ ] everyone else: urs.earthdata.nasa.gov
- [x] FIRMS MAP_KEY · [ ] OpenAQ API key (free)
- [ ] Ask Local Lead: may we use pre-event scripts/docs? Is remote + in-person team OK?
- [ ] Team owner = the person presenting in person

## Submission rules (confirm in the official 2026 guide)
Video ≤ 30 s **or** ≤ 7 slides, English · repo **public**, MIT licence · AI use **declared** · no NASA logo · submit on team page → Project tab.

## Discuss together
1. Demo region: Delhi NCR / Indo-Gangetic Plain, or our home state?
2. Who owns: data + stats · map · sources/validation · pitch?
3. Peak moment for judges: "watch fake trends disappear" or "district case file"?
