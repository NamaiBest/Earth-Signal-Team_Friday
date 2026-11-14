# EarthSignal: Plan

**NASA Space Apps Challenge 2026 · _Be an Earth System Trend Detective!_ (Advanced · Earth Science, Software)**
Hackathon: Sat 14 – Sun 15 Nov 2026 · Submission deadline: Sun 15 Nov, 23:59 local

Confidence tags: **[C]** certain / checked · **[L]** likely · **[G]** guess, verify before relying on it

---

## 1. One line

**EarthSignal is a detective for Indian policymakers: pick a district, and it tells you what is really changing there, in which season, which nearby sources are the likely suspects, and where today's pollution is heading next.**

Pitch line (30-second video): *"Every government has opinions about pollution. EarthSignal gives them evidence: NASA data, tested for significance, down to the district."*

## 2. Problem statement

India makes environmental policy at three levels: Centre, state and district. Each needs to know:

1. **What is actually changing** in my area, and is it real or noise?
2. **When** in the year is it worst, and is that season getting worse?
3. **What is likely driving it** (power plants, industry, crop burning, cities)?
4. **What is coming next**: where will this week's smoke or haze travel?

Today that evidence is scattered across NASA archives, CPCB stations and emission inventories, and nobody tests it for statistical significance before policy is built on it. A district collector cannot tell a real 15-year rise in NO₂ from one bad winter.

**EarthSignal joins those sources on one map and answers all four questions with tested evidence.**

## 3. Fit with the official challenge [C]

| Challenge asks | EarthSignal answer |
|---|---|
| Select variables from missions / models | The tool **selects them for you**: it ranks every variable for a chosen place by significant change |
| Visualize change over time | Time series per place and per season, trend line, monthly heat-calendar |
| What, where, how much | Sen's slope per grid cell, summed to district / state |
| Is it "significant" | Seasonal Mann-Kendall (autocorrelation-corrected) + false-discovery-rate correction |
| Opposite trends in different regions | NO₂ rising over India, falling over China / Europe; groundwater falling in Punjab while vegetation greens |

**Rule we hold ourselves to:** trend detection is the core and must be excellent. Policy, sources and forecast are layers that make it *useful*; they never replace it. Judges score against the challenge text.

## 4. What is different from other teams [C]

At least 10 public repos target this challenge; one (entitySource/trend_detective) already has 15 variables, FDR and validation. A significance map alone will not stand out. Our differentiators:

1. **Start from the place, not the variable.** Others: "pick a variable, see a map". Us: "pick a district, get a case file".
2. **Policy unit = Indian district and state**, not 1° grid cells.
3. **Suspects layer**: real emission sources (power plants, steel, cement, oil & gas, landfills) pinned on the map next to the trends.
4. **What's next**: NASA's own 5-day air-quality forecast plus wind, shown on the same map.

## 5. What satellites can and cannot do (read before the pitch)

Getting this wrong in front of expert judges loses the "validity" score.

| Idea | Verdict | Why / what we do instead |
|---|---|---|
| Trends per **district** | ✅ for most variables | NO₂ (TROPOMI ~5 km), LST / NDVI (MODIS 1 km), AOD (1–10 km) resolve districts. Coarse products (MERRA-2 ~50 km, GRACE ~300 km) only at state / region level; label the resolution on screen |
| Trends per **sub-district** | ⚠️ only a few variables | Only 1 km products (LST, NDVI, fires). Grey out sub-district for the rest |
| **One-to-one link** between a factory and its pollution | ❌ not possible | A satellite pixel mixes many sources and wind moves plumes. **We show "suspects near the hotspot"**, ranked by reported emissions and distance, worded as *association, not proof*. Exception [L]: very large NO₂ sources (e.g. Singrauli coal cluster) show clearly in TROPOMI |
| **CFC footprint** of a factory | ❌ | CFCs aren't measured from space at ground level; only global station averages exist (we have NOAA's). Drop from the map |
| **Methane** from a site | ⚠️ big sources only | TROPOMI / Carbon Mapper see large point sources (coal mines, landfills, gas). Use Climate TRACE estimates for the rest |
| **Diwali: residential vs commercial areas** | ⚠️ ground stations, not satellites | Neighbourhood-scale differences are far below satellite resolution, and Diwali overlaps with crop-burning smoke. Use **CPCB station PM2.5 (via OpenAQ)**, classify each station's surroundings with OpenStreetMap land use, compare the Diwali week against the weeks either side |
| **Forecast where pollution goes on day 7–8** | ❌ building our own | That needs a chemical transport model. **NASA already runs one: GEOS-CF, a free global 5-day air-quality forecast [L].** We display it and add wind arrows. Honest and NASA-native |
| "Forecasting for all elements on Earth" | ❌ for a hackathon | Out of scope. Optional: "if this trend continued to 2035" with an uncertainty band, labelled as extrapolation |

## 6. The product: four layers on one map

### Layer 1: Detect (core, must be excellent)
- 13 core variables, 2003–2025, monthly (list: `PARAMETERS.md`).
- Per grid cell, per month and per season: Sen's slope, Mann-Kendall p, FDR q, coverage %.
- **Season finder**: for each place, which month/season changes fastest (your "changes most at different times of year").

### Layer 2: Locate (policy lens, India)
- Aggregate cell trends to **state, district, sub-district** boundaries (area-weighted, with the resolution caveat).
- Choropleth: "districts where winter NO₂ rose significantly since 2005".
- **Case file** for any district, auto-written:
  - **Clues**: variables with significant trends, ranked
  - **Pattern**: the season when each changes fastest
  - **Alibis**: things that look like change but fail the test
  - **Suspects**: emission sources within N km, by reported emissions
  - **Associations**: variables moving together (e.g. groundwater ↓, NDVI ↑), never claimed as cause
  - **What can be done**: generic levers per driver (e.g. stubble burning → crop-residue management schemes), clearly marked as context, not a recommendation engine

### Layer 3: Suspects (sources)
Pins for India, clustered when zoomed out, individual when zoomed in:

| Source type | Dataset | Notes |
|---|---|---|
| Power plants, steel, cement, oil & gas, coal mines, landfills, with emission estimates | **Climate TRACE** asset database [C exists; L India coverage] | Open, asset-level, includes methane |
| Coal plants, steel, cement trackers | Global Energy Monitor [L] | Open licence; check terms |
| Power plants | WRI Global Power Plant Database [L] | Static, last update older |
| All mapped industrial land | **OpenStreetMap** (`landuse=industrial`, `man_made=works`) via Overpass | Free; coverage uneven |
| Air-quality stations | CPCB via OpenAQ API | Free key |

**Not Google Maps** [L]: its terms forbid bulk scraping and storing places, the Places API is paid, and "factory" isn't a reliable category. OSM + Climate TRACE is open and citable.

### Layer 4: What's next (forecast, stretch)
- NASA GEOS-CF 5-day forecast for NO₂, O₃, PM2.5 [L], as a time slider.
- Wind arrows from the same forecast.
- Live "today" tiles from NASA GIBS (verified, `DATASETS.md`).
- Wording: "NASA's forecast", never "our prediction".

## 7. Demo case (the one story for judges)

**"Delhi NCR & the Indo-Gangetic Plain, October–November"** [L strongest local story]
1. **Detect**: winter AOD / NO₂ trends over 2005–2025; which survive the test.
2. **Pattern**: Oct–Nov is the fastest-worsening season (verify with our own analysis before claiming).
3. **Suspects**: fire counts in Punjab / Haryana (MODIS / VIIRS) + power plants and industry around NCR (Climate TRACE).
4. **Diwali check**: CPCB stations, residential vs industrial surroundings, Diwali week vs neighbouring weeks.
5. **What's next**: GEOS-CF forecast + wind: where this week's smoke goes.
6. **Alibi moment**: one variable that looks alarming but isn't significant. That's the detective twist.

## 8. Data (verified unless marked)

Core gridded datasets, IDs checked in NASA CMR (`DATASETS.md`, `data/catalog.json`). Additions for this plan:

| Need | Source | Access |
|---|---|---|
| India boundaries: state / district / sub-district | geoBoundaries ADM1/2/3 [L] or DataMeet [L] | Open GeoJSON |
| Emission sources | Climate TRACE, OSM, GEM, WRI GPPD | Open downloads / API |
| Ground PM2.5 / NO₂ | CPCB via OpenAQ v3 | Free API key |
| Fires | NASA FIRMS (VIIRS 375 m) | Free MAP_KEY |
| Forecast | NASA GEOS-CF [L] | Open (also in Google Earth Engine) |
| Wind | GEOS-CF / MERRA-2 | Open |
| Live tiles | NASA GIBS | No login |

Accounts to create **today**: NASA Earthdata Login (all members), FIRMS MAP_KEY, OpenAQ key.

## 9. Methods

- **Pre-processing**: monthly L3 grids → common grid → coverage mask (≥70 % months) → no gap-filling.
- **Trend**: Sen's slope; Mann-Kendall, Hamed-Rao autocorrelation-corrected (`pyMannKendall`); seasonal MK for all-year.
- **Multiple testing**: Benjamini-Hochberg FDR across cells, and across variables when ranking.
- **District aggregation**: area-weighted mean of cell series, then test the district series (not an average of p-values).
- **Suspects**: sources within radius r of a significant hotspot, ranked by reported emissions ÷ distance. Displayed as "nearby", never "responsible".
- **Validation (must show)**: Arctic Sept sea ice (done: −0.74 M km²/decade, matches NSIDC); one India check against published work (e.g. NW India groundwater decline from GRACE).

## 10. Interface

- **Map engine: MapLibre GL JS v5 (globe projection) [C globe exists]**: zoom from whole planet to street level, like Google Earth; thousands of pins with clustering; free vector basemap. (Replaces globe.gl from `STACK.md`, which cannot zoom to factory level.)
- **Layers panel**: Detect · Locate · Suspects · What's next.
- **Search**: any Indian state / district / city.
- **Case file panel**: Clues · Pattern · Alibis · Suspects · Associations, each with source and p/q value.
- **Season heat-calendar**: 12 months × variables, colour = trend, opacity = significance.
- **Visual rules**: significance = opacity; direction = blue ↔ orange (colourblind-safe); every number shows source, period and resolution.
- **Intro / pitch page** (optional): scroll-craft "live surface" story (`UI.md`).
- Charts: uPlot. Colour ramps: d3-scale-chromatic.

## 11. 48-hour schedule

| Block | Data + stats | Map / UI | Pitch |
|---|---|---|---|
| Sat 0–4 h | Download 4 variables for India (NO₂, AOD, LST, fires) + boundaries | MapLibre globe, India districts, search | Lock story & roles |
| 4–12 h | Trends + FDR per cell & per district; season finder | Detect + Locate layers live | Storyboard 30-s video |
| 12–20 h | Climate TRACE + OSM sources; CPCB stations | Suspects pins, clustering, case-file panel | Draft slides |
| 20–28 h | Diwali station comparison; validation check | Season heat-calendar | Record rough video |
| 28–36 h | GEOS-CF forecast (stretch) | What's next slider + wind | Fill project page |
| 36–44 h | Add variables up to 13 if time | Polish, phone layout, deploy | Final video |
| 44–48 h | **Freeze** | Buffer | **Submit early** |

**Cut order if behind**: forecast → Diwali stations → sub-district → extra variables. **Never cut**: significance testing, the district case file, the demo story.

## 12. Team roles (fill in)

| Role | Owner |
|---|---|
| Data pipeline + statistics | |
| Map / front end | |
| Sources, boundaries, validation | |
| Pitch, video, project page (in person) | |

## 13. Risks

| Risk | Mitigation |
|---|---|
| Claims that overstate causation | Wording rules in §5; "association, not proof" on every suspect panel |
| Scope too big for 48 h | Layers 1–2 are the product; 3–4 are bonuses; cut order in §11 |
| Large downloads | India bounding box only, monthly L3, subset via OPeNDAP / Harmony |
| Many similar teams | Lead with place-first case files + India policy lens, not the map |
| Pre-built work not allowed | Ask Local Lead tonight whether existing scripts/docs may be used |

## 14. Submission checklist [L, from local-event kits; confirm in the official 2026 Project Submission Guide]

- [ ] Project submitted on team page → Project tab, before Sun 15 Nov 23:59 local
- [ ] Demo: video ≤ 30 s **or** ≤ 7 slides, English, public link
- [ ] Repo **public**, OSI licence (MIT)
- [ ] AI-use section filled in (tools used and for what)
- [ ] No NASA logo; NASA data credited
- [ ] Every number in the video traceable to a dataset

## 15. Open questions for the team

1. Demo region: Delhi NCR / Indo-Gangetic Plain, or another state?
2. Who presents in person, and is that person the team owner?
3. Local Lead: are pre-event scripts and docs allowed?
