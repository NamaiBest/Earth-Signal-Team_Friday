"""Download NASA POWER monthly grids over India, 2001-2025 (no login needed).

NASA POWER (https://power.larc.nasa.gov) serves NASA MERRA-2 reanalysis and
CERES satellite products: MERRA-2 on 0.5 x 0.625 deg, CERES SYN1deg on 1 deg.

Writes data/raw/power/india_monthly.npz:
  months (n_month,) as YYYYMM ints; per parameter P: P (n_lat, n_lon, n_month) float32,
  P__lats, P__lons (cell centres). NaN = missing (e.g. soil wetness over sea).
"""
import json
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "raw" / "power"
OUT.mkdir(parents=True, exist_ok=True)

PARAMS = ["T2M", "T2M_MAX", "PRECTOTCORR", "AOD_55", "ALLSKY_SFC_SW_DWN", "GWETROOT"]
START, END = 2001, 2025
LAT_TILES = [(6, 16), (16, 26), (26, 36), (36, 38)]  # API allows <= 10 x 10 deg per request
LON_TILES = [(68, 78), (78, 88), (88, 98)]
URL = ("https://power.larc.nasa.gov/api/temporal/monthly/regional?parameters={p}&community=AG"
       "&latitude-min={a}&latitude-max={b}&longitude-min={c}&longitude-max={d}&start={s}&end={e}&format=JSON")


def get(job):
    p, (a, b), (c, d) = job
    url = URL.format(p=p, a=a, b=b, c=c, d=d, s=START, e=END)
    for attempt in range(4):
        try:
            with urllib.request.urlopen(url, timeout=300) as r:
                return p, json.load(r)
        except Exception as e:  # noqa: BLE001
            print("retry", p, a, c, e)
            time.sleep(5 * (attempt + 1))
    raise RuntimeError(f"POWER failed: {job}")


jobs = [(p, la, lo) for p in PARAMS for la in LAT_TILES for lo in LON_TILES]
t = time.time()
with ThreadPoolExecutor(4) as ex:
    results = list(ex.map(get, jobs))
print(f"{len(jobs)} requests in {time.time() - t:.0f} s")

months = sorted({int(k) for _, d in results for f in d["features"][:1]
                 for k in f["properties"]["parameter"][next(iter(f["properties"]["parameter"]))]
                 if not k.endswith("13")})
out = {"months": np.array(months)}
for p in PARAMS:  # each parameter has its own grid (MERRA-2 0.5 x 0.625 deg, CERES SYN1deg 1 deg)
    feats = [f for q, d in results if q == p for f in d["features"]]
    lats = sorted({f["geometry"]["coordinates"][1] for f in feats})
    lons = sorted({f["geometry"]["coordinates"][0] for f in feats})
    li = {v: i for i, v in enumerate(lats)}
    lo = {v: i for i, v in enumerate(lons)}
    mi = {m: i for i, m in enumerate(months)}
    arr = np.full((len(lats), len(lons), len(months)), np.nan, np.float32)
    for f in feats:
        x, y = f["geometry"]["coordinates"][:2]
        for k, v in f["properties"]["parameter"][p].items():
            if k.endswith("13") or v is None or v <= -998:  # month 13 = annual; -999 = fill
                continue
            arr[li[y], lo[x], mi[int(k)]] = v
    out[p] = arr
    out[p + "__lats"] = np.array(lats)
    out[p + "__lons"] = np.array(lons)
    print(f"  {p}: grid {len(lats)} x {len(lons)}, {np.isfinite(arr).mean() * 100:.0f}% of cells x months filled")

np.savez_compressed(OUT / "india_monthly.npz", **out)
print(f"{len(months)} months ({months[0]}-{months[-1]})")
