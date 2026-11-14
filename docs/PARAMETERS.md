# EarthSignal: Parameter screening

**Standard used:** GCOS *Essential Climate Variables* (ECVs), the WMO / UNEP / UNESCO-IOC / ISC list of variables that "critically contribute to the characterization of Earth's climate". Space agencies (NASA, ESA CCI, ISRO) organise their climate records around it, so using it means **we didn't pick variables, the scientific community did**.

Confidence tags: **[C]** confirmed, **[L]** likely (verify product IDs on Earthdata), **[G]** guess.

- GCOS currently counts **55 ECVs [C]** (NASA Earthdata's page still says 54). A rationalised list is under review and only takes effect with the 2028 GCOS Implementation Plan **[C]**, so the 2022 list is the one to cite.
- The list below is reconstructed from the 2022 Implementation Plan **[L]**; check names against the GCOS ECV factsheets before the pitch.

## Screening rules

An ECV makes the demo set only if **all** hold:

1. **Global & gridded**: satellite or model product on a regular grid (not station/in-situ only)
2. **Long record**: ≥ ~20 years continuous, so a trend test has power
3. **NASA-hosted**: monthly Level-3 (or reanalysis) on Earthdata
4. **Continuous quantity**: Mann-Kendall needs numbers, not categories
5. **48-hour feasible**: one download, no heavy retrieval work

Tiers: **T1** = demo set · **T2** = stretch / validation · **✗** = excluded (reason given)

## Atmosphere

| ECV | Tier | NASA product [L] | Record | Note |
|---|---|---|---|---|
| Surface air temperature | T1 | MERRA-2 `T2M` (M2TMNXSLV) | 1980– | Model output, allowed ("produced by Earth science models") |
| Surface wind speed & direction | T2 | MERRA-2 `U10M/V10M` | 1980– | |
| Surface water vapour | T2 | MERRA-2 `QV2M` / AIRS L3 | 1980– / 2002– | |
| Surface pressure | ✗ | MERRA-2 `SLP` | 1980– | Low story value |
| Precipitation | T1 | GPM IMERG monthly (GPM_3IMERGM) | 1998– | |
| Surface radiation budget | T2 | CERES EBAF | 2000– | |
| Upper-air temperature | T2 | AIRS L3 profiles | 2002– | 3D, pick one pressure level |
| Upper-air wind | ✗ | MERRA-2 | 1980– | Low story value |
| Upper-air water vapour | T2 | AIRS L3 | 2002– | |
| Cloud properties | T2 | MODIS MOD08_M3 cloud fraction | 2000– | |
| Earth radiation budget | T2 | CERES EBAF-TOA | 2000– | Strong science, abstract for public |
| Lightning | ✗ | LIS/OTD | — | Record ended / sparse |
| Carbon dioxide | T2 | OCO-2 L3 | 2014– | Short + gappy record |
| Methane | **T1** | AIRS L3 CH₄ | 2002– | Validate with ESA Sentinel-5P (2018–) |
| Other long-lived GHGs | ✗ | — | — | In-situ networks (NOAA global means in `data/noaa/`) |
| Ozone | T2 | OMI total column (OMTO3e) | 2004– | Ozone-hole recovery = known trend to validate against |
| Aerosol properties | T1 | MODIS AOD (MOD08_M3 / MERRA-2) | 2000– | Indo-Gangetic Plain hotspot = local hook |
| Precursors (NO₂, SO₂, CO, HCHO) | T1 (NO₂) / T2 | OMI NO₂ (OMNO2d), MOPITT CO | 2004– / 2000– | NO₂ rising over India, falling over China/US/EU: the "opposite directions" case |

## Land

| ECV | Tier | NASA product [L] | Record | Note |
|---|---|---|---|---|
| River discharge | ✗ | (SWOT 2022–) | short | Gauges in-situ; SWOT too new |
| Lakes | ✗ | — | — | Needs per-lake processing |
| Groundwater | T2 | via GRACE | 2002– | Derived from TWS |
| Soil moisture | T2 | GLDAS (model) / SMAP L3 | 2000– / 2015– | Validate with ESA CCI Soil Moisture (1978–) |
| Terrestrial water storage | **T1** | GRACE / GRACE-FO mascons | 2002– | 2017–18 gap: handle explicitly. NW India depletion = strong local hook |
| Snow | T1 | MODIS MOD10CM | 2000– | |
| Glaciers | ✗ | — | — | Point / regional inventories |
| Ice sheets & ice shelves | T2 | GRACE mass | 2002– | Coarse but dramatic |
| Permafrost | ✗ | — | — | Not directly observable from space |
| Albedo | T2 | MODIS MCD43C3 | 2000– | |
| Land cover | ✗ (T2 as % change) | MODIS MCD12C1 | 2001– | Categorical, not MK-testable |
| FAPAR / LAI | T1 (or NDVI) | MODIS MCD15 / NDVI MOD13C2 | 2000– | NDVI is a proxy, not the ECV itself; say so |
| Above-ground biomass | ✗ | GEDI | 2019– | Too short |
| Soil carbon | ✗ | — | — | No satellite record |
| Fire | T1 | MODIS burned area MCD64A1 | 2000– | |
| Land surface temperature | T1 | MODIS MOD11C3 | 2000– | |
| Evaporation from land | T2 | GLDAS / MODIS MOD16 | 2000– | |
| Anthropogenic GHG fluxes | ✗ | — | — | Inventories, not observations (see Climate TRACE in PLAN) |
| Anthropogenic water use | ✗ | — | — | Indirect via GRACE |

## Ocean

| ECV | Tier | NASA product [L] | Record | Note |
|---|---|---|---|---|
| Sea surface temperature | T1 | MUR SST | 2002– | |
| Subsurface temperature / salinity / currents | ✗ | (Argo) | — | In-situ floats |
| Sea surface salinity | T2 | SMAP / Aquarius | 2011– | Short |
| Surface currents | T2 | OSCAR | 1993– | |
| Sea level | T1 | NASA SSH gridded altimetry | 1992– | Longest record in our set |
| Sea state | T2 | Altimeter wave height | 1992– | |
| Sea ice | T1 | NSIDC passive microwave (NASA DAAC) | 1978– | **Pipeline sanity check**: Arctic decline must come out significant (it does) |
| Ocean surface stress / heat flux | ✗ | — | — | Specialist |
| Ocean colour | T1 | MODIS-Aqua chlorophyll-a | 2002– | Sensor drift in later years, note it |
| Inorganic carbon, oxygen, nutrients, N₂O, transient tracers | ✗ | — | — | Ship / float measurements |
| Plankton / marine habitats | ✗ | (via ocean colour) | — | Covered by chlorophyll |

## Result

**Demo set (T1, 13 variables):** surface air temperature · land surface temperature · precipitation · methane · aerosols · NO₂ · terrestrial water storage · snow · FAPAR/NDVI · fire · sea surface temperature · sea level · sea ice

**For the India / district focus (PLAN.md):** NO₂, aerosols, land surface temperature, NDVI and fires resolve at district level; GRACE and MERRA-2 only at state / region level.

## Sources

- GCOS, ECV Rationalization: https://gcos.wmo.int/node/24967
- NASA Earthdata, Essential Variables: https://www.earthdata.nasa.gov/learn/backgrounders/essential-variables
- ESA Climate Office, What are ECVs: https://climate.esa.int/en/evidence/what-are-ecvs/
