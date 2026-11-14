> **Archived (27 Oct 2026).** Superseded by [`../PLAN.md`](../PLAN.md). Kept for the reasoning behind the original pipeline.

# EarthSignal — Project Plan

Confidence tags: **[C]** certain / confirmed, **[L]** likely, **[G]** guess to verify.

---

## 1. Key dates

| Date | Milestone |
|---|---|
| Oct 28, 2026 | Full challenge statement + official datasets released → **re-validate this plan** |
| Nov 2, 2026 | Space Apps Connect opens (ask NASA SMEs questions here) |
| Nov 13, 2026 | Local event kick-offs |
| **Nov 14–15, 2026** | **Hackathon.** Submission closes 23:59 local time Nov 15 |
| Nov 16, 2026 → | Local judging → Global Nominees → Global judging |

## 2. Open questions (answer before building)

- [ ] **[G] Can we build before Nov 14?** Check the Participant FAQ / Terms. If not, everything before the event is research + data-access setup only, and all code is written during the 48 h.
- [ ] Which datasets does the Oct 28 statement list in its Resources tab? Prioritize those.
- [ ] Is Giovanni listed as a resource? If yes, judges will compare us to it — sharpen the "significance + variable ranking" difference.
- [ ] Local event: is it hybrid? Can a remote member be on the team while one presents in person? (Ask the Local Lead.)
- [ ] Team owner = the person attending in person.

## 3. Architecture — 3-stage pipeline

```
[1] INGEST & PREPROCESS  →  [2] ANALYZE  →  [3] EXPLORE (UI)
```

### Stage 1 — Ingest & preprocess (offline, Python)

- **Source:** NASA **monthly, gridded, Level-3** products only. Re-grid everything to a common **1° × 1° grid** (~65k cells).
- **Period:** ≥ 20 years where possible (MODIS ≈ 2000–present). 5 years is too short for significance **[C]**.
- **Seasonal cycle:** remove it (subtract each calendar month's climatology) or use the Seasonal Mann-Kendall test. Without this, summer/winter swamps the trend **[C]**.
- **Missing data:** **do not interpolate/fill NaNs** — satellite gaps (clouds, polar night) aren't random, and filling them can fabricate trends **[L]**. Instead, require **≥ 70 % monthly coverage** per cell; cells below that are masked "insufficient data".
- **Output:** one compact Zarr/NetCDF cube per variable (time × lat × lon).

**Starter variable set (10–15, not 100)** — names to verify against the Oct 28 resource list:

| Domain | Variable | Candidate NASA product **[L]** |
|---|---|---|
| Temperature | Land surface temperature | MODIS MOD11C3 |
| Temperature | Near-surface air temp | MERRA-2 (T2M) |
| Vegetation | NDVI / greenness | MODIS MOD13C2 |
| Water | Precipitation | GPM IMERG monthly |
| Water | Soil moisture | GLDAS / SMAP L3 |
| Cryosphere | Snow cover | MODIS MOD10CM |
| Cryosphere | Sea-ice concentration | NSIDC (NASA DAAC) |
| Atmosphere | Aerosol optical depth | MODIS / MERRA-2 |
| Atmosphere | Methane (CH₄), CO | AIRS L3 |
| Atmosphere | NO₂ | OMI L3 |
| Fire | Fire counts / burned area | MODIS MCD64 / MCD14 |

**Partner data = validation layer, not a regional patchwork.** One consistent NASA dataset per variable globally; partner data (ESA Sentinel-5P CH₄/NO₂, ESA CCI soil moisture, ISRO MOSDAC regional products) appears as a toggle that cross-checks the NASA trend. Mixing sources by region would create artificial jumps at borders **[L]**.

### Stage 2 — Analyze (offline, Python)

For every variable × every grid cell:

1. **Trend magnitude:** Sen's slope (robust to outliers), reported per decade in native units.
2. **Trend significance:** Seasonal Mann-Kendall test → p-value. Account for autocorrelation (pre-whitening or a modified MK variant).
3. **Multiple-testing correction:** Benjamini–Hochberg **FDR** across all cells, and across variables. Without it ~5 % of the globe "lights up" by pure chance **[C]**.
4. **Variable ranking:** score = fraction of valid area with a significant trend (optionally area-weighted by cos(latitude)). This *is* the "select variables" part of the challenge — a live feature, not a one-off study.
5. **Regional opposites:** flag variables where significant positive and negative trends coexist (the challenge explicitly calls this out).

Output: per variable a small JSON/PNG tile set (slope, q-value, mask) + summary stats. Precompute everything — the UI never does heavy math live.

**Stretch:** a "citizen layer" — Namai's NLC (noctilucent cloud) image classifier run on geotagged citizen sky photos (Space Cloud Watch), shown as an optional overlay. Location from photo metadata/user-provided tags only, **not** IP addresses.

### Stage 3 — Explore (web UI)

```
┌──────────────────────┬─────────────────────────────────────┐
│ VARIABLES (ranked)   │                                     │
│ 1. Land surf. temp ▮▮│            3D GLOBE                 │
│ 2. Snow cover     ▮▮ │   significant cells = solid color   │
│ 3. NDVI           ▮  │   not significant   = faded / grey  │
│ ...                  │   insufficient data = hatched       │
│ [filter: domain]     │                                     │
├──────────────────────┴─────────────────────────────────────┤
│ Click a cell → time series + trend line + "+0.4 °C/decade, │
│ q = 0.003 — significant"   [toggle: ESA validation layer]  │
└────────────────────────────────────────────────────────────┘
```

- **Stack [L]:** React + Vite, globe via `react-globe.gl` / three.js or deck.gl; charts via a lightweight lib. Static precomputed data → deploy on Vercel.
- **Color:** diverging, colorblind-safe palette; significance shown by opacity, not hue.
- **Plain-language mode:** one sentence per cell a non-scientist can read.

## 4. Judging strategy

Five criteria **[L]**: Impact · Creativity · Validity · Relevance · **Presentation** (NASA warns teams to give it equal weight **[C]**).

| Criterion | How we win it |
|---|---|
| Relevance | Hits all four asks of the statement literally: select, visualize, what/where/how much, significant |
| Validity | Seasonal MK + FDR + coverage rule; show the "before correction vs after" map |
| Creativity | Variable ranking + significance-faded globe — viewers show data, we show *conclusions* |
| Impact | Anyone (journalist, student, policymaker) gets an honest answer in one click |
| Presentation | 30-s hook video; one killer slide: *"Tested 15 variables × 65k cells — only X survive correction"* |

**Target awards:** Best Use of Data (primary), Best Use of Science (secondary). All global awards cut across all 14 challenges — no per-challenge winners **[C]**.

**Differentiation vs. existing tools:** Giovanni / Worldview = viewers. EarthSignal = automated, statistically-corrected answers + a ranked "what's changing" list.

## 5. 48-hour build schedule (assuming no pre-building)

| Block | Data / backend | Frontend | Pitch |
|---|---|---|---|
| H0–4 | Pull 3 variables, re-grid, coverage mask | Scaffold app, globe renders a dummy layer | Lock name, hook, story |
| H4–12 | MK + Sen + FDR on 3 variables; export tiles | Variable list + globe with real layer | Draft slides |
| H12–20 | Scale to 10–15 variables; ranking | Significance fading, click → time series | Script 30-s video |
| H20–28 | Validation layer (1 ESA variable) | Plain-language text, polish | Record rough video |
| H28–40 | Bug-fix, sanity-check results vs. literature | Deploy (Vercel), mobile check | Final video + project page |
| H40–48 | **Freeze.** Buffer | Buffer | **Submit early** |

**Rule:** a working demo with 3 variables beats a broken one with 15. Ship the 3-variable version by H12.

## 6. Risks

| Risk | Mitigation |
|---|---|
| Data downloads too large/slow | Monthly L3 at coarse resolution only; pre-identify OPeNDAP/Earthdata subset endpoints; get Earthdata Login accounts **now** |
| Statistics wrong → experts catch it | Validate one variable against a published trend (e.g. known warming hotspots, Arctic sea-ice decline) |
| Too many variables | Hard cap 15; quality > quantity |
| Globe performance | Precomputed images/tiles, not per-cell geometry |
| Pre-building not allowed | Use pre-event time only for learning, accounts and data access tests |

## 7. Team roles (fill in)

| Role | Owner |
|---|---|
| Data pipeline + stats | |
| Frontend / globe | |
| Science validation + datasets | |
| Pitch, video, project page | |

## 8. Prep checklist (before Nov 14)

- [ ] Everyone registered + on the same team (owner = in-person member)
- [ ] NASA Earthdata Login accounts for all
- [ ] Read Oct 28 full statement; update §3 variable table
- [ ] Confirm pre-building rules
- [ ] Test-download one MODIS monthly file end-to-end
- [ ] Read up: Seasonal Mann-Kendall, Sen's slope, Benjamini–Hochberg FDR
- [ ] Pick globe library; render one PNG layer on it
