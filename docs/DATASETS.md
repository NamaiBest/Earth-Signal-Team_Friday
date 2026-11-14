# EarthSignal: Dataset catalog

Every NASA product below was **checked against NASA's Common Metadata Repository (CMR)** by `scripts/catalog.py` (raw results: `data/catalog.json`), first on 27 Oct 2026 and again on 13 Nov 2026 (34/34 found). Live layers were checked against the NASA GIBS capabilities file on 27 Oct. Re-run the script any time.

## 1. Gases: what exists as a map vs. only as a global number

Most greenhouse gases beyond CO₂ and CH₄ are **not mapped from space** at the surface; they are measured at ground stations and published as global means. The app uses two kinds of gas data:

**A. Gridded from space (go on the map, per-cell trend test)**

| Gas | Why it matters | Best long record (NASA) | Newer / higher-res | Note |
|---|---|---|---|---|
| CH₄ methane | 2nd-largest warming gas | AIRS L3 `AIRS3STM` v7, 2002– (mid-troposphere, ~400 hPa) | TROPOMI `S5P_L2__CH4____HiR`, 2018– | AIRS sees mid-troposphere, not surface emissions; say so |
| CO₂ | Main warming gas | OCO-2 `OCO2_L2_Lite_FP`, 2014– (sparse) | `OCO2_GEOS_L3CO2_MONTH` gap-filled, **ends Feb 2022** | Short; global trend better from NOAA (B) |
| CO carbon monoxide | Fires, combustion | MOPITT `MOP03JM`, 2000– **(ends Feb 2025)**; AIRS L3 2002– | — | Use AIRS for continuity |
| NO₂ | Traffic, power plants; short-lived → regional | OMI `OMNO2d`, 2004– | TROPOMI 2018– (~5 km); TEMPO hourly (N. America) | India ↑ vs China/EU/US ↓ |
| SO₂ | Coal, smelters, volcanoes | OMI `OMSO2e`, 2004– | TROPOMI 2018– | |
| HCHO formaldehyde | Proxy for VOC emissions | OMI `OMHCHOd`, 2004– | TEMPO | |
| O₃ ozone (total column) | Ozone layer recovery | OMI `OMTO3e`, 2004– | OMPS, TEMPO | |
| N₂O (stratosphere) | 3rd GHG + ozone depleter | MLS `ML3MBN2O`, 2004– | — | Stratospheric only |
| HCl, HNO₃ (stratosphere) | Ozone-depletion chemistry | MLS `ML3MBHCL`, `ML3MBHNO3`, 2004– | — | Shows Montreal Protocol working |
| NH₃ ammonia | Fertiliser, livestock; PM2.5 precursor | CrIS `TRPSYL2NH3CRSRS`, 2015– (**L2 points, grid ourselves**) | — | Stretch; Indo-Gangetic Plain is a global hotspot |
| BrO | Polar / ozone chemistry | OMI `OMBRO`, 2004– | — | Low priority |
| Aerosols (AOD) | Air quality | MODIS `MOD08_M3` 2000–; MERRA-2 `M2TMNXAER` 1980– | VIIRS | Not a gas, same "air" tab |

**B. Global means from ground networks** (side panel, one trend per gas), in `data/noaa/`, fetched by `scripts/fetch_open_data.sh`, no login:

| Gas | File | Source |
|---|---|---|
| CO₂, CH₄, N₂O, SF₆ (monthly, global) | `data/noaa/*_mm_gl.txt` | NOAA Global Monitoring Laboratory |
| CO₂ daily, Mauna Loa | `data/noaa/co2_daily_mlo.txt` | NOAA GML |
| CFC-11, CFC-12 (monthly, global) | `data/noaa/HATS_global_F11.txt`, `HATS_global_F12.txt` | NOAA GML HATS |

## 2. All verified NASA collections

| Group | Variable | Short name | Version | Coverage | Archive |
|---|---|---|---|---|---|
| gas | CH4 (mid-troposphere) + CO, O3, H2O | `AIRS3STM` | 7.0 | 2002-09-01 → ongoing | GES_DISC |
| gas | CH4 column (TROPOMI) | `S5P_L2__CH4____HiR` | 3 | 2018-04-30 → ongoing | GES_DISC |
| gas | NO2 tropospheric column (OMI) | `OMNO2d` | 004 | 2004-10-01 → ongoing | GES_DISC |
| gas | NO2 (TROPOMI) | `S5P_L2__NO2____HiR` | 3 | 2018-04-30 → ongoing | GES_DISC |
| gas | NO2 hourly N. America (TEMPO) | `TEMPO_NO2_L3` | V04 | 2023-08-02 → ongoing | LARC_CLOUD |
| gas | SO2 (OMI) | `OMSO2e` | 004 | 2004-10-01 → ongoing | GES_DISC |
| gas | HCHO formaldehyde (OMI) | `OMHCHOd` | 004 | 2004-10-01 → ongoing | GES_DISC |
| gas | O3 total column (OMI) | `OMTO3e` | 004 | 2004-10-01 → ongoing | GES_DISC |
| gas | CO (MOPITT monthly) | `MOP03JM` | 10 | 2000-03-03 → 2025-02-01 | LARC_CLOUD |
| gas | CO2 (OCO-2, gap-filled monthly) | `OCO2_GEOS_L3CO2_MONTH` | 10r | 2014-06-01 → 2022-02-01 | GES_DISC |
| gas | CO2 (OCO-2 lite) | `OCO2_L2_Lite_FP` | 11.3r | 2014-06-01 → ongoing | GES_DISC |
| gas | N2O stratosphere (MLS) | `ML3MBN2O` | 005 | 2004-08-02 → ongoing | GES_DISC |
| gas | HCl stratosphere (MLS) | `ML3MBHCL` | 005 | 2004-08-02 → ongoing | GES_DISC |
| gas | HNO3 (MLS) | `ML3MBHNO3` | 005 | 2004-08-02 → ongoing | GES_DISC |
| gas | NH3 ammonia (CrIS, L2 points) | `TRPSYL2NH3CRSRS` | 1 | 2015-12-01 → ongoing | GES_DISC |
| gas | BrO (OMI) | `OMBRO` | 004 | 2004-10-01 → ongoing | GES_DISC |
| atmos | Aerosol, cloud (MODIS Terra monthly) | `MOD08_M3` | 6.1 | 2000-02-01 → ongoing | LAADS |
| atmos | Aerosols, reanalysis (MERRA-2) | `M2TMNXAER` | 5.12.4 | 1980-01-01 → ongoing | GES_DISC |
| atmos | Surface air temp, wind (MERRA-2) | `M2TMNXSLV` | 5.12.4 | 1980-01-01 → ongoing | GES_DISC |
| atmos | Precipitation (GPM IMERG monthly) | `GPM_3IMERGM` | 07 | 1998-01-01 → 2025-09-30 | GES_DISC |
| atmos | Radiation budget (CERES EBAF) | `CERES_EBAF` | Edition4.2.1 | 2000-03-01 → ongoing | LARC_CLOUD |
| land | Land surface temperature | `MOD11C3` | 061 | 2000-02-01 → ongoing | LPCLOUD |
| land | Snow cover | `MOD10CM` | 61 | 2000-03-01 → ongoing | NSIDC_CPRD |
| land | Burned area / fire (500 m, aggregate to 1 deg) | `MCD64A1` | 061 | 2000-11-01 → ongoing | LPCLOUD |
| land | NDVI vegetation | `MOD13C2` | 061 | 2000-02-01 → ongoing | LPCLOUD |
| land | Albedo | `MCD43C3` | 061 | 2000-02-16 → ongoing | LPCLOUD |
| land | Soil moisture, ET (GLDAS model) | `GLDAS_NOAH025_M` | 2.1 | 2000-01-01 → ongoing | GES_DISC |
| land | Soil moisture (SMAP L3) | `SPL3SMP` | 009 | 2015-03-31 → ongoing | NSIDC_CPRD |
| land | Water storage (GRACE/GRACE-FO) | `TELLUS_GRAC-GRFO_MASCON_CRI_GRID_RL06.3_V4` | RL06.3Mv04 | 2002-04-04 → ongoing | POCLOUD |
| ocean | Sea surface temperature (MUR) | `MUR-JPL-L4-GLOB-v4.1` | 4.1 | 2002-05-31 → ongoing | POCLOUD |
| ocean | Chlorophyll-a (MODIS Aqua) | `MODISA_L3m_CHL` | 2022.0 | 2002-07-04 → ongoing | OB_CLOUD |
| ocean | Sea level (altimetry grids) | `NASA_SSH_REF_SIMPLE_GRID_V1` | 1 | 1992-10-25 → ongoing | POCLOUD |
| ocean | Sea ice concentration | `NSIDC-0051` | 2 | 1978-10-26 → 2025-12-31 | NSIDC_CPRD |
| live | Active fires NRT (VIIRS) | `VJ114IMGTDL_NRT` | 2 | 2024-10-01 → ongoing | LANCEMODIS |

*"ongoing" = no end date in CMR. Products with an end date have stopped; plan continuity (e.g. MOPITT → AIRS for CO).*

## 3. Live / near-real-time sources

**NASA GIBS map tiles**: ready-made images, no login, no processing.

| Live layer | GIBS layer ID (verified 27 Oct) | Refresh |
|---|---|---|
| NO₂ (global) | `TROPOMI_L2_Nitrogen_Dioxide_Tropospheric_Column` | daily |
| NO₂ (N. America, hourly) | `TEMPO_L3_NO2_Vertical_Column_Troposphere` | hourly daytime |
| SO₂ | `TROPOMI_L2_Sulfur_Dioxide_Total_Vertical_Column`, `OMI_SO2_Planetary_Boundary_Layer` | daily |
| Methane (400 hPa) | `AIRS_L3_Methane_400hPa_Volume_Mixing_Ratio_Daily_Day` | daily, ~1 week lag |
| Carbon monoxide | `AIRS_L3_Carbon_Monoxide_500hPa_Volume_Mixing_Ratio_Daily_Day` | daily, ~1 week lag |
| Ozone total column | `OMPS_Ozone_Total_Column` | daily |
| Formaldehyde (N. America) | `TEMPO_L3_Formaldehyde_Vertical_Column` | hourly daytime |
| Aerosol | `OMI_Aerosol_Optical_Depth`, `VIIRS_SNPP_Aerosol_Type_Deep_Blue_Land_Ocean` | daily |
| Active fires | `VIIRS_NOAA20_Thermal_Anomalies_375m_All`, `MODIS_Combined_Thermal_Anomalies_All` | daily |
| Precipitation | `IMERG_Precipitation_Rate` | daily |
| Sea surface temperature | `GHRSST_L4_MUR_Sea_Surface_Temperature` | daily |
| Snow cover | `VIIRS_NOAA20_NDSI_Snow_Cover` | daily |
| Sea ice | `VIIRS_NOAA20_Sea_Ice` | daily |

Tile URL (EPSG:4326; TileMatrixSet per layer in the capabilities file; tested: TROPOMI NO₂ uses `2km`, returned a PNG):
`https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/{LAYER}/default/{YYYY-MM-DD}/{TileMatrixSet}/{z}/{y}/{x}.png`
Capabilities: `https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/1.0.0/WMTSCapabilities.xml`

Other feeds:

| Feed | Endpoint | Access |
|---|---|---|
| Active fire points | NASA FIRMS API `https://firms.modaps.eosdis.nasa.gov/api/` | Free MAP_KEY |
| Sea-ice extent, daily | NSIDC Sea Ice Index v4 (in `data/nsidc/`) | Open |
| Ground air quality (CPCB PM2.5, NO₂, O₃) | OpenAQ v3 API | Free API key |
| 5-day air-quality forecast | NASA GEOS-CF [L] | Open |
| Raw NRT satellite files (< 3 h) | NASA LANCE | Earthdata Login |

## 4. Additions for the India / policy plan

| Need | Source | Access |
|---|---|---|
| State / district / sub-district boundaries | geoBoundaries ADM1/2/3 [L] or DataMeet [L] | Open GeoJSON |
| Emission sources (power, steel, cement, oil & gas, landfills) | Climate TRACE asset database | Open |
| Industrial land | OpenStreetMap (`landuse=industrial`, `man_made=works`) via Overpass | Open |
| Coal, steel, cement trackers | Global Energy Monitor [L] | Open licence, check terms |

## 5. First result: the method works

`scripts/quick_check.py` output (`data/quick_check_output.txt`):

| Series | Period | Trend | Significant? |
|---|---|---|---|
| Arctic sea ice, September | 1979–2025 | −0.74 M km²/decade | **Yes** (p ≈ 5e-12) |
| Antarctic sea ice, February | 1979–2025 | −0.08 M km²/decade | **No** (p ≈ 0.13) |
| CO₂ global mean | 1979–2025 | +18.9 ppm/decade | Yes |
| CH₄ global mean | 1984–2025 | +58 ppb/decade | Yes |
| N₂O global mean | 2001–2025 | +9.5 ppb/decade | Yes |
| SF₆ global mean | 1998–2025 | +3.0 ppt/decade | Yes |

Arctic decline matches NSIDC's published trend. The Antarctic fell sharply after 2016 and *looks* like a decline, but over the full record it does not pass the test: our "alibi" example.

## 6. Accounts

- [ ] **NASA Earthdata Login** (everyone): https://urs.earthdata.nasa.gov; approve GES DISC, LP DAAC, PO.DAAC, NSIDC, LaRC applications
- [ ] **FIRMS MAP_KEY** (free)
- [ ] **OpenAQ API key** (free)
