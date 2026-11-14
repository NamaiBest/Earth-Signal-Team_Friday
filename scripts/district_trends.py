"""Detect: is each variable really changing in each Indian district, and in which season?
Also writes per-pixel trend maps.

Inputs (each optional; a variable is skipped if its file is missing):
  data/raw/power/india_monthly.npz     NASA POWER: T2M, T2M_MAX, PRECTOTCORR, AOD_55, ALLSKY_SFC_SW_DWN, GWETROOT
  data/raw/no2/omi_no2_monthly.npz     NASA OMI tropospheric NO2 (scripts/fetch_omi_no2.py)
  data/raw/so2/omi_so2_monthly.npz     NASA OMI boundary-layer SO2 (scripts/fetch_omi_so2.py)
  data/raw/modis/LST_monthly.npz       NASA MODIS land surface temperature (scripts/fetch_modis_cmg.py LST)
  data/raw/modis/NDVI_monthly.npz      NASA MODIS NDVI (scripts/fetch_modis_cmg.py NDVI)
  data/raw/firms/FIRE_monthly.npz      NASA FIRMS MODIS vegetation fires (scripts/fetch_firms.py)
  web/data/districts.geojson           (scripts/build_boundaries.py)

Method (docs/PLAN.md section 9), per variable on its own record length:
  1. District series = area-weighted mean of the grid cells it overlaps.
     Coverage rule: a series is tested only if >= 70 % of its months have data. No gap filling.
  2. Whole year: seasonal Mann-Kendall (one MK per calendar month, summed; removes the
     seasonal cycle and tolerates missing months), seasonal Sen's slope.
  3. IMD seasons (Winter Jan-Feb, Pre-monsoon Mar-May, Monsoon Jun-Sep, Post-monsoon Oct-Dec)
     and each calendar month: one value per year, Mann-Kendall with the Hamed-Rao
     autocorrelation correction, Sen's slope on the real year index.
  4. 95 % confidence interval for every Sen's slope (Gilbert 1987), using the variance of the
     matching test (Hamed-Rao corrected for seasons and months).
  5. Benjamini-Hochberg false discovery rate across all districts (or all pixels),
     separately for each variable x period. Significant only if q < 0.05.
Writes:
  web/data/trends.json             district results, compact
  web/data/series/<district>.json  monthly series for charts
  web/data/grid/<VAR>.json         per-pixel whole-year trend (slope/decade, q)
"""
import json
import math
import warnings
from multiprocessing import Pool
from pathlib import Path

import geopandas as gpd
import numpy as np
import pymannkendall as mk
from scipy.stats import norm
from shapely.geometry import box
from statsmodels.stats.multitest import multipletests

warnings.filterwarnings("ignore")
ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
WEB = ROOT / "web" / "data"
ALPHA = 0.05
COVERAGE = 0.7

POWER = RAW / "power" / "india_monthly.npz"
VARS = {
    "NO2": dict(file=RAW / "no2" / "omi_no2_monthly.npz", label="Tropospheric nitrogen dioxide (NO₂)", short="NO₂",
                unit="×10¹⁵ molec/cm²", rel=True, source="NASA Aura OMI (OMNO2d v003, cloud-screened)", res="~25 km", kind="satellite"),
    "SO2": dict(file=RAW / "so2" / "omi_so2_monthly.npz", label="Boundary-layer sulphur dioxide (SO₂)", short="SO₂",
                unit="DU", rel=True, source="NASA Aura OMI (OMSO2e v003, PBL, quality-filtered)", res="~25 km", kind="satellite",
                note="OMI SO₂ is noisy outside large sources; trust strong hotspots (coal power, smelters, refineries) more than small changes."),
    "AOD_55": dict(file=POWER, label="Aerosol optical depth (haze, 550 nm)", short="Haze (AOD)", unit="", rel=True,
                   source="NASA CERES SYN1deg (MODIS-constrained aerosol) via NASA POWER", res="~100 km", kind="satellite"),
    "FIRE": dict(file=RAW / "firms" / "FIRE_monthly.npz", label="Vegetation fires (count density)", short="Fires",
                 unit="fires/1000 km²/month", rel=True, source="NASA FIRMS, MODIS Terra + Aqua (MODIS_SP, type 0)", res="~25 km", kind="satellite", annual=True,
                 note="Whole-year trend uses yearly totals (counts are mostly zero month to month). Counts fires seen at the MODIS overpasses (~10:30 and ~13:30 local). Recent falls in Punjab may partly reflect burning shifted to later in the day, not only less burning."),
    "LST": dict(file=RAW / "modis" / "LST_monthly.npz", label="Daytime land surface temperature", short="Land temp",
                unit="°C", rel=False, source="NASA Terra MODIS (MOD11C3 v061)", res="~25 km", kind="satellite",
                end=2022, note="Ends 2022: from 2023 Terra passes over earlier in the day, which reads as false cooling. Daytime cooling before 2023 may be partly real (greening, haze dimming) and partly instrument drift: validate before quoting."),
    "NDVI": dict(file=RAW / "modis" / "NDVI_monthly.npz", label="Vegetation greenness (NDVI)", short="Greenness",
                 unit="NDVI", rel=True, source="NASA Terra MODIS (MOD13C2 v061)", res="~25 km", kind="satellite"),
    "ALLSKY_SFC_SW_DWN": dict(file=POWER, label="Sunlight reaching the ground", short="Sunlight", unit="kWh/m²/day", rel=True,
                              source="NASA CERES SYN1deg satellite via NASA POWER", res="~100 km", kind="satellite"),
    "T2M": dict(file=POWER, label="Air temperature", short="Air temp", unit="°C", rel=False,
                source="NASA MERRA-2 reanalysis via NASA POWER", res="~50 km", kind="model"),
    "T2M_MAX": dict(file=POWER, label="Hottest daily temperature (monthly max)", short="Peak heat", unit="°C", rel=False,
                    source="NASA MERRA-2 reanalysis via NASA POWER", res="~50 km", kind="model"),
    "PRECTOTCORR": dict(file=POWER, label="Rainfall", short="Rainfall", unit="mm/day", rel=True,
                        source="NASA MERRA-2, bias-corrected, via NASA POWER", res="~50 km", kind="model"),
    "GWETROOT": dict(file=POWER, label="Root-zone soil wetness", short="Soil moisture", unit="0-1", rel=True,
                     source="NASA MERRA-2 reanalysis via NASA POWER", res="~50 km", kind="model"),
}
SEASONS = {"winter": [1, 2], "premonsoon": [3, 4, 5], "monsoon": [6, 7, 8, 9], "postmonsoon": [10, 11, 12]}
SEASON_LABEL = {"year": "Whole year", "winter": "Winter (Jan-Feb)", "premonsoon": "Pre-monsoon (Mar-May)",
                "monsoon": "Monsoon (Jun-Sep)", "postmonsoon": "Post-monsoon (Oct-Dec)"}
PERIODS = ["year", *SEASONS, *[f"m{m:02d}" for m in range(1, 13)]]
GROUPS = [SEASONS[k] for k in SEASONS] + [[m] for m in range(1, 13)]


# ---------- statistics ----------
def mk_s_var(y):
    """Mann-Kendall S and variance (with tie correction) for one series, NaNs dropped."""
    t = np.arange(len(y))
    ok = np.isfinite(y)
    y, t = y[ok], t[ok]
    n = len(y)
    if n < 3:
        return 0.0, 0.0, np.array([])
    i, j = np.triu_indices(n, 1)
    d = y[j] - y[i]
    s = np.sign(d).sum()
    _, c = np.unique(y, return_counts=True)
    var = (n * (n - 1) * (2 * n + 5) - (c * (c - 1) * (2 * c + 5)).sum()) / 18
    return s, var, d / (t[j] - t[i])


def sen_ci(slopes, var_s, alpha=0.05):
    """95 % confidence interval for Sen's slope (Gilbert 1987): ranks of the sorted pairwise
    slopes at (N -/+ z * sqrt(Var S)) / 2, using the variance of the matching MK test."""
    n = len(slopes)
    if n < 3 or not np.isfinite(var_s) or var_s <= 0:
        return np.nan, np.nan
    c = norm.ppf(1 - alpha / 2) * math.sqrt(var_s)
    srt = np.sort(slopes)
    lo = int(np.floor((n - c) / 2))
    hi = int(np.ceil((n + c) / 2))
    return float(srt[max(lo, 0)]), float(srt[min(hi, n - 1)])


def seasonal_mk(series, nyears):
    """Seasonal Mann-Kendall + seasonal Sen's slope (per year) and its 95 % CI on a monthly series."""
    m = series.reshape(nyears, 12)
    S = V = 0.0
    slopes = []
    for k in range(12):
        s, v, sl = mk_s_var(m[:, k])
        S += s
        V += v
        slopes.append(sl)
    if V <= 0:
        return np.nan, np.nan, np.nan, np.nan
    z = (S - np.sign(S)) / math.sqrt(V)
    allsl = np.concatenate(slopes)
    lo, hi = sen_ci(allsl, V)
    return float(np.median(allsl)), float(2 * norm.sf(abs(z))), lo, hi


def annual_test(y):
    """Hamed-Rao corrected MK p-value; Sen's slope on the true year index; 95 % CI from the
    autocorrelation-corrected variance (wider when years are correlated)."""
    ok = np.isfinite(y)
    if ok.sum() < 8:
        return np.nan, np.nan, np.nan, np.nan
    _, var0, sl = mk_s_var(y)
    try:
        t = mk.hamed_rao_modification_test(y[ok])
        p, var_s = t.p, t.var_s
    except Exception:  # noqa: BLE001
        p, var_s = np.nan, var0
    lo, hi = sen_ci(sl, var_s)
    return (float(np.median(sl)) if len(sl) else np.nan), float(p), lo, hi


def test_one(args):
    """All periods for one series. Returns [[slope/decade, p, mean, lo/decade, hi/decade], ...] (17 periods).
    annual=True: whole-year test on yearly means (for zero-heavy counts such as fires)."""
    s, nyears, annual = args
    by_year = s.reshape(nyears, 12)
    if annual:
        y = np.where(np.isfinite(by_year).sum(1) >= 9, np.nanmean(by_year, axis=1), np.nan)
        b, p, lo, hi = annual_test(y)
    else:
        b, p, lo, hi = seasonal_mk(s, nyears)
    res = [[b * 10, p, float(np.nanmean(s)), lo * 10, hi * 10]]
    for g in GROUPS:
        cols = by_year[:, [m - 1 for m in g]]
        ok = np.isfinite(cols).sum(1) == len(g)  # a season counts only if all its months exist
        y = np.where(ok, np.nanmean(cols, axis=1), np.nan)
        b, p, lo, hi = annual_test(y)
        res.append([b * 10, p, float(np.nanmean(y)), lo * 10, hi * 10])
    return res


def whole_year(args):
    s, nyears, annual = args
    if annual:
        by_year = s.reshape(nyears, 12)
        b, p, _, _ = annual_test(np.where(np.isfinite(by_year).sum(1) >= 9, np.nanmean(by_year, axis=1), np.nan))
    else:
        b, p, _, _ = seasonal_mk(s, nyears)
    return b * 10, p


def bh(p):
    q = np.full(p.shape, np.nan)
    ok = np.isfinite(p)
    if ok.any():
        q[ok] = multipletests(p[ok], method="fdr_bh")[1]
    return q


# ---------- geometry ----------
dists = gpd.read_file(WEB / "districts.geojson")
india = dists.union_all()


def weights(lats, lons):
    """Sparse area weights per district, and the cells that touch India."""
    dlat, dlon = np.diff(lats).min() / 2, np.diff(lons).min() / 2
    cells = gpd.GeoDataFrame({"ci": np.arange(len(lats) * len(lons))},
                             geometry=[box(x - dlon, y - dlat, x + dlon, y + dlat) for y in lats for x in lons], crs=4326)
    ov = gpd.overlay(dists[["id", "geometry"]], cells, how="intersection", keep_geom_type=True).to_crs(6933)
    ov["a"] = ov.area
    return {d: list(zip(g.ci, g.a)) for d, g in ov.groupby("id")}, sorted(set(ov.ci))


def district_series(arr, w):
    flat = arr.reshape(-1, arr.shape[2])
    out = {}
    for d, cw in w.items():
        idx = np.array([c for c, _ in cw])
        a = np.array([x for _, x in cw])
        v = flat[idx]
        ok = np.isfinite(v)
        s = (np.where(ok, v, 0) * a[:, None]).sum(0) / np.maximum((ok * a[:, None]).sum(0), 1e-9)
        s[ok.sum(0) == 0] = np.nan
        if np.isfinite(s).mean() >= COVERAGE:
            out[d] = s
    return out


def r(x, n):
    return None if x is None or not np.isfinite(x) else float(f"{x:.{n}g}")


if __name__ == "__main__":
    ids = dists.id.tolist()
    data, meta, cache = {}, {}, {}
    (WEB / "grid").mkdir(exist_ok=True)
    with Pool() as pool:
        for v, m in VARS.items():
            if not m["file"].exists():
                print(f"{v:18s} skipped (no {m['file'].relative_to(ROOT)})")
                continue
            npz = np.load(m["file"])
            months = npz["months"]
            lats, lons, arr = npz[v + "__lats"], npz[v + "__lons"], npz[v]
            if m.get("end"):  # cut a record before a known instrument artefact
                keep = months <= m["end"] * 100 + 12
                months, arr = months[keep], arr[:, :, keep]
            nyears = len(months) // 12
            key = (tuple(lats), tuple(lons))
            if key not in cache:
                cache[key] = weights(lats, lons)
            w, cells = cache[key]
            series = district_series(arr, w)

            have = [d for d in ids if d in series]
            arr3 = np.array(pool.map(test_one, [(series[d], nyears, m.get("annual", False)) for d in have], chunksize=20))
            q = np.stack([bh(arr3[:, j, 1]) for j in range(arr3.shape[1])], axis=1)
            data[v] = {d: [[r(arr3[i, j, 0], 3), r(arr3[i, j, 1], 2), r(q[i, j], 2), r(arr3[i, j, 2], 4),
                            r(arr3[i, j, 3], 3), r(arr3[i, j, 4], 3)]
                           for j in range(arr3.shape[1])] for i, d in enumerate(have)}
            for i, d in enumerate(have):
                data.setdefault("_series", {}).setdefault(d, {})[v] = series[d]

            # per-pixel whole-year trend over cells touching India
            flat = arr.reshape(-1, arr.shape[2])
            good = [c for c in cells if np.isfinite(flat[c]).mean() >= COVERAGE]
            px = np.array(pool.map(whole_year, [(flat[c], nyears, m.get("annual", False)) for c in good], chunksize=50)) if good else np.zeros((0, 2))
            pq = bh(px[:, 1]) if len(px) else px
            slope = np.full(len(lats) * len(lons), np.nan)
            qq = np.full(len(lats) * len(lons), np.nan)
            slope[good], qq[good] = px[:, 0], pq
            grid = {"lat0": float(lats[0]), "lon0": float(lons[0]), "dlat": float(np.diff(lats).min()),
                    "dlon": float(np.diff(lons).min()), "nlat": len(lats), "nlon": len(lons),
                    "slope": [r(x, 3) for x in slope], "q": [r(x, 2) for x in qq]}
            (WEB / "grid" / f"{v}.json").write_text(json.dumps(grid, separators=(",", ":")))

            y0, y1 = int(months[0]) // 100, int(months[-1]) // 100
            meta[v] = {k: x for k, x in m.items() if k not in ("file", "end", "annual")} | {"years": [y0, y1], "start": int(months[0])}
            print(f"{v:18s} {y0}-{y1} | {len(have)} districts, whole-year significant after FDR: "
                  f"{int(np.nansum(q[:, 0] < ALPHA))} (raw p<0.05: {int(np.nansum(arr3[:, 0, 1] < ALPHA))}) | "
                  f"pixels {len(good)}, significant {int(np.nansum(pq < ALPHA))}", flush=True)

    trends = {
        "generated": "scripts/district_trends.py",
        "years": [min(m["years"][0] for m in meta.values()), max(m["years"][1] for m in meta.values())],
        "alpha": ALPHA,
        "method": "Seasonal Mann-Kendall (whole year) and Hamed-Rao corrected Mann-Kendall (seasons, months); "
                  "Sen's slope; Benjamini-Hochberg FDR across districts per variable and period",
        "periods": PERIODS,
        "period_labels": {**SEASON_LABEL, **{f"m{m:02d}": m for m in range(1, 13)}},
        "vars": meta,
        "fields": ["slope_per_decade", "p", "q", "mean", "ci95_low_per_decade", "ci95_high_per_decade"],
        "d": {d: {v: data[v][d] for v in meta if d in data[v]} for d in ids},
    }
    (WEB / "trends.json").write_text(json.dumps(trends, separators=(",", ":"), ensure_ascii=False))
    print("web/data/trends.json", round((WEB / "trends.json").stat().st_size / 1e6, 1), "MB")

    sdir = WEB / "series"
    sdir.mkdir(exist_ok=True)
    for d in ids:
        s = data.get("_series", {}).get(d, {})
        rec = {"vars": {v: {"start": meta[v]["start"], "v": [r(x, 4) for x in s[v]]} for v in meta if v in s}}
        (sdir / f"{d}.json").write_text(json.dumps(rec, separators=(",", ":")))
    print("web/data/series/:", len(ids), "files")
