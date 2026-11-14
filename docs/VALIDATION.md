# Validation against NASA Giovanni

Giovanni is the time-series tool NASA lists first in this challenge's resources. Its time-series API
(`https://api.giovanni.earthdata.nasa.gov/timeseries`, Earthdata token) returns the series for **one grid cell**,
so we compare cell against cell: same location, monthly values, then the **same trend test** on both series
(seasonal Mann-Kendall + Sen's slope from `scripts/district_trends.py`). Reproduce: `python3 scripts/validate_giovanni.py`
(raw Giovanni output cached in `data/validation/giovanni_series/`, summary in `data/validation/giovanni_summary.csv`).

**Two kinds of check**
- *Same product*: Giovanni serves the same NASA dataset we downloaded. Agreement proves our extraction
  (download, cropping, quality filters, monthly averaging, units, statistics) is right. It does not prove the dataset is right.
- *Independent*: a different measurement of the same quantity. Agreement is evidence the trend is real.

## NO₂: OMI OMNO2d (same product): identical
| Site | Months | r | Bias | Giovanni Sen /decade (p) | EarthSignal Sen /decade (p) | Same verdict |
|---|---|---|---|---|---|---|
| Singrauli (coal power) | 252 | 1.000 | -0.0% | +1.551 (4.36e-13) | +1.551 (4.36e-13) | ✓ |
| Korba (coal power) | 243 | 1.000 | +0.0% | +0.957 (1.89e-11) | +0.957 (1.89e-11) | ✓ |
| Angul (coal, smelter) | 244 | 1.000 | -0.0% | +0.683 (3.73e-09) | +0.683 (3.73e-09) | ✓ |
| Jharsuguda (smelter, coal) | 244 | 1.000 | +0.0% | +2.630 (3.31e-49) | +2.630 (3.31e-49) | ✓ |
| Dhanbad (coal mining) | 251 | 1.000 | -0.0% | +0.792 (5.12e-16) | +0.792 (5.12e-16) | ✓ |
| New Delhi | 252 | 1.000 | -0.0% | -0.497 (3.38e-06) | -0.497 (3.38e-06) | ✓ |
| Mumbai | 243 | 1.000 | -0.0% | -0.119 (0.0355) | -0.119 (0.0355) | ✓ |
| Bengaluru | 240 | 0.999 | +0.1% | +0.016 (0.703) | +0.021 (0.609) | ✓ |
| Jaisalmer (background) | 252 | 1.000 | +0.0% | +0.051 (0.0405) | +0.051 (0.0405) | ✓ |

## SO₂: OMI OMSO2e (same product): matches; Delhi differs because our quality filters are stricter
We keep only pixels with quality flag 0, cloud fraction < 0.2 and solar zenith < 70° (NASA's guidance for boundary-layer SO₂);
Giovanni averages without those filters. Trend verdicts still agree everywhere.
| Site | Months | r | Bias | Giovanni Sen /decade (p) | EarthSignal Sen /decade (p) | Same verdict |
|---|---|---|---|---|---|---|
| Singrauli (coal power) | 191 | 0.999 | +0.0% | +0.215 (6.52e-10) | +0.220 (2.17e-10) | ✓ |
| Korba (coal power) | 187 | 0.998 | +0.2% | +0.153 (6.35e-10) | +0.151 (5.55e-10) | ✓ |
| Angul (coal, smelter) | 177 | 0.998 | -0.2% | +0.214 (6.68e-12) | +0.214 (6.99e-12) | ✓ |
| Jharsuguda (smelter, coal) | 183 | 0.998 | -0.4% | +0.244 (4.48e-23) | +0.241 (1.31e-22) | ✓ |
| Dhanbad (coal mining) | 181 | 0.998 | -0.3% | +0.021 (0.249) | +0.018 (0.264) | ✓ |
| New Delhi | 218 | 0.725 | -16.7% | -0.020 (0.172) | -0.020 (0.198) | ✓ |
| Mumbai | 198 | 0.999 | +0.6% | -0.039 (0.0565) | -0.037 (0.0621) | ✓ |
| Bengaluru | 145 | 0.997 | +0.9% | +0.025 (0.125) | +0.025 (0.134) | ✓ |
| Jaisalmer (background) | 251 | 1.000 | +1.3% | -0.008 (0.339) | -0.008 (0.344) | ✓ |

## Air temperature: MERRA-2 hourly (same model as NASA POWER): extraction confirmed, model not validated
| Site | Months | r | Bias | Giovanni Sen /decade (p) | EarthSignal Sen /decade (p) | Same verdict |
|---|---|---|---|---|---|---|
| Singrauli (coal power) | 300 | 1.000 | -0.0% | -0.080 (0.243) | -0.086 (0.23) | ✓ |
| New Delhi | 300 | 1.000 | -0.0% | -0.365 (0.000932) | -0.364 (0.0011) | ✓ |
| Bengaluru | 300 | 1.000 | +0.0% | +0.186 (0.00582) | +0.186 (0.00657) | ✓ |
| Ludhiana (NW 'cooling') | 300 | 1.000 | -0.0% | -0.748 (2.05e-10) | -0.746 (2.22e-10) | ✓ |

The NW-India cooling (Ludhiana −0.75 °C/decade) is genuinely in MERRA-2; we extracted it correctly. An independent dataset
(station records, CRU, ERA5) is still needed before quoting air-temperature trends.

## Rainfall: MERRA-2 (ours) vs GPM IMERG satellite rainfall (independent)
| Site | Months | r | Bias | Giovanni Sen /decade (p) | EarthSignal Sen /decade (p) | Same verdict |
|---|---|---|---|---|---|---|
| Singrauli (coal power) | 297 | 0.975 | -5.0% | +0.017 (0.241) | +0.012 (0.401) | ✓ |
| New Delhi | 297 | 0.959 | +2.5% | +0.000 (0.604) | +0.012 (0.393) | ✓ |
| Mumbai | 297 | 0.982 | +7.8% | +0.014 (5.58e-05) | +0.033 (1.74e-07) | ✓ |
| Bengaluru | 297 | 0.948 | -4.2% | +0.020 (0.199) | +0.020 (0.319) | ✓ |
| Ludhiana (NW 'cooling') | 297 | 0.917 | -4.1% | +0.055 (0.317) | +0.225 (6.72e-06) | ✗ |
| Lawngtlai (NE rain jump) | 297 | 0.743 | -16.6% | +0.052 (0.177) | +0.925 (1.51e-21) | ✗ |

**Finding:** where MERRA-2 shows the largest rainfall rises (Lawngtlai +0.93 mm/day/decade, p ≈ 10⁻²¹; Ludhiana +0.23, p ≈ 10⁻⁵),
independent satellite rainfall shows **no significant trend**. These are model artefacts, which is why rainfall stays in the
"climate model · not yet validated" group and is excluded from the Policy tab. (IMERG is a 0.1° point; MERRA-2 a ~50 km cell,
so lower r is expected.)

## What this means for the app
| Variable | Status |
|---|---|
| NO₂, SO₂ | Extraction verified against NASA's own tool; trends usable (co-location caveats still apply) |
| Haze, sunlight, greenness, land temperature, fires | Not in this Giovanni check (land temperature is cut at 2022 for Terra drift) |
| Air temperature, peak heat, soil moisture | Model; extraction verified for air temperature; physical trend unvalidated |
| Rainfall | Model; independent satellite rainfall contradicts its biggest trends: do not quote |
