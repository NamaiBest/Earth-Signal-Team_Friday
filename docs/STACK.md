# EarthSignal: UI & tooling stack

Picked from GitHub (stars, last push and licence pulled live via the GitHub API on 27 Oct 2026). **Rule: fit for a 48-hour, data-honest Earth tool**, not raw popularity.

> **Changed 13 Nov:** map engine switched from globe.gl to **MapLibre GL JS v5**. The plan now needs Google-Earth-style zoom from planet to district boundaries and thousands of factory pins; globe.gl can't zoom to that level.

## Chosen

| Role | Repo | Licence | Why |
|---|---|---|---|
| Map + globe | [maplibre/maplibre-gl-js](https://github.com/maplibre/maplibre-gl-js) (v5+, globe projection) | BSD-3 | Planet → street zoom; vector basemap; clustered pins; district polygons; raster layers for trend images and NASA GIBS tiles |
| Basemap tiles | OpenFreeMap / OSM-based vector tiles [L] | Open | Free, no key |
| GIBS patterns | [nasa-gibs/gibs-web-examples](https://github.com/nasa-gibs/gibs-web-examples) | NASA | Official tile recipes |
| Time-series chart | [leeoniya/uPlot](https://github.com/leeoniya/uPlot) | MIT | ~50 KB, fastest line chart |
| Colour scales | [d3/d3](https://github.com/d3/d3) (`d3-scale`, `d3-scale-chromatic` only) | ISC | Colourblind-safe diverging ramps |
| Intro page | [nateherkai/scroll-craft](https://github.com/nateherkai/scroll-craft) | MIT | Live-surface scroll story (`UI.md`) |
| Data cubes (Python) | [pydata/xarray](https://github.com/pydata/xarray) | Apache-2.0 | Re-grid, deseasonalise, mask |
| Trend tests (Python) | [mmhs013/pyMannKendall](https://github.com/mmhs013/pyMannKendall) | MIT | `seasonal_test`, `hamed_rao_modification_test`, `sens_slope` |
| FDR | `statsmodels.stats.multitest.multipletests(method="fdr_bh")` | BSD | Benjamini-Hochberg |
| District zonal stats | `rasterstats` / `geopandas` [L] | BSD | Aggregate grid → district |

## Reference only

| Repo | What to take |
|---|---|
| [nasa-gibs/worldview](https://github.com/nasa-gibs/worldview) | NASA's imagery browser; judges know it. Borrow layer/date UX, be clearly different in Trends |
| [cambecc/earth](https://github.com/cambecc/earth) | Visual north star for beautiful Earth data |
| [nasa/openmct](https://github.com/nasa/openmct) | Mission-control "instrument" chrome |
| [NASA-IMPACT/veda-ui](https://github.com/NASA-IMPACT/veda-ui) | NASA Earth dashboards with stories: closest prior art |
| [entitySource/trend_detective](https://github.com/entitySource/trend_detective) | **Competing team, same challenge**: 15 variables, FDR, validation. Know it, don't copy it |

## Considered and rejected

| Repo | Why not |
|---|---|
| globe.gl | Can't zoom to factory level (was first choice on 27 Oct) |
| CesiumJS | Best 3D globe, but heavy; ion token for terrain |
| deck.gl | Plan B for very large point layers |
| cobe | Markers only, no data layers |
| shadcn/ui, Radix | Add React + Tailwind for ~6 controls |
| GSAP, Lenis, Scrollama | Don't stack a second scroll engine on scroll-craft; GSAP licence not OSI |
| ECharts, visx, Observable Plot | uPlot does our one chart type smaller and faster |
| Google Maps Places for factories | Terms forbid bulk scraping/storing; paid API; "factory" unreliable → use Climate TRACE + OSM |

## Architecture

```
scripts/        Python: fetch → preprocess → trends + FDR → district roll-up → export
data/           reference data + exports (per variable: trend raster PNG/COG + JSON summary)
web/
  index.html    MapLibre app: Detect · Locate · Suspects · What's next
  intro.html    scroll-craft story page (optional)
  app.js        layers, case-file panel, uPlot charts
  data/         exported JSON / GeoJSON / images
```
