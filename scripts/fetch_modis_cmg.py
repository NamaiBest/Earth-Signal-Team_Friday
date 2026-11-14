"""MODIS monthly climate-modelling-grid (0.05 deg) products over India, 2001-2025.

  python3 scripts/fetch_modis_cmg.py LST    # MOD11C3 v061: daytime land surface temperature (deg C)
  python3 scripts/fetch_modis_cmg.py NDVI   # MOD13C2 v061: vegetation greenness (NDVI, unitless)

Source: NASA LP DAAC (Terra MODIS), found through NASA CMR. Needs EARTHDATA_TOKEN.
Each global monthly file (70-90 MB) is downloaded, cut to the India box, averaged from
0.05 deg to 0.25 deg (25 sub-cells, at least 13 valid) and deleted. Per-year parts let
an interrupted run resume.

Writes data/raw/modis/<VAR>_monthly.npz: months, <VAR>, <VAR>__lats, <VAR>__lons
"""
import json
import os
import sys
import tempfile
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np
from pyhdf.SD import SD, SDC

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "raw" / "modis"
OUT.mkdir(parents=True, exist_ok=True)
TOKEN = os.environ.get("EARTHDATA_TOKEN") or sys.exit("Set EARTHDATA_TOKEN")
PRODUCTS = {
    "LST": dict(short="MOD11C3", sds="LST_Day_CMG", scale=0.02, offset=-273.15, fill=0, vmin=7500),
    "NDVI": dict(short="MOD13C2", sds="CMG 0.05 Deg Monthly NDVI", scale=1e-4, offset=0.0, fill=-3000, vmin=-2000),
}
VAR = sys.argv[1] if len(sys.argv) > 1 else "LST"
P = PRODUCTS[VAR]
YEARS = range(2001, 2026)
# 0.05 deg grid, row 0 = 90 N (top), col 0 = 180 W. India box 6-38 N, 68-98 E.
R0, R1 = int((90 - 38) / 0.05), int((90 - 6) / 0.05)
C0, C1 = int((68 + 180) / 0.05), int((98 + 180) / 0.05)
NB = 5  # 5 x 5 sub-cells -> 0.25 deg
LATS = (38 - 0.125 - 0.25 * np.arange((R1 - R0) // NB))[::-1]
LONS = 68 + 0.125 + 0.25 * np.arange((C1 - C0) // NB)


def http(url, dest=None, auth=True):
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {TOKEN}"} if auth else {})
    err = None
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, timeout=600) as r:
                data = r.read()
            if dest:
                Path(dest).write_bytes(data)
                return dest
            return data
        except Exception as e:  # noqa: BLE001
            err = e
            time.sleep(4 * (attempt + 1))
    raise RuntimeError(f"{url}: {err}")


def granules(year):
    q = (f"https://cmr.earthdata.nasa.gov/search/granules.json?short_name={P['short']}&version=061"
         f"&temporal={year}-01-01T00:00:00Z,{year}-12-31T23:59:59Z&page_size=50&sort_key=start_date")
    out = {}
    for g in json.loads(http(q, auth=False))["feed"]["entry"]:
        url = next(l["href"] for l in g["links"] if l["href"].startswith("https") and l["href"].endswith(".hdf"))
        out[int(g["time_start"][5:7])] = url
    return out


def one(item):
    month, url = item
    with tempfile.NamedTemporaryFile(suffix=".hdf", dir=OUT, delete=False) as t:
        path = t.name
    try:
        http(url, path)
        raw = SD(path, SDC.READ).select(P["sds"])[R0:R1, C0:C1].astype(np.float64)
    finally:
        os.remove(path)
    raw[(raw == P["fill"]) | (raw < P["vmin"])] = np.nan
    v = raw * P["scale"] + P["offset"]
    h, w = v.shape[0] // NB, v.shape[1] // NB
    blocks = v[: h * NB, : w * NB].reshape(h, NB, w, NB)
    n = np.isfinite(blocks).sum(axis=(1, 3))
    m = np.where(n >= 13, np.nanmean(blocks, axis=(1, 3)), np.nan)
    return month, m[::-1]  # south-to-north, like the other grids


if __name__ == "__main__":
    for year in YEARS:
        part = OUT / f"{VAR}_part_{year}.npz"
        if part.exists():
            continue
        t = time.time()
        g = granules(year)
        arr = np.full((12, len(LATS), len(LONS)), np.nan)
        with ThreadPoolExecutor(4) as ex:
            for month, m in ex.map(one, sorted(g.items())):
                arr[month - 1] = m
        np.savez_compressed(part, a=arr)
        print(f"{VAR} {year}: {len(g)} months in {time.time() - t:.0f} s", flush=True)

    months, arrs = [], []
    for year in YEARS:
        a = np.load(OUT / f"{VAR}_part_{year}.npz")["a"]
        for m in range(12):
            arrs.append(a[m])
            months.append(year * 100 + m + 1)
    grid = np.stack(arrs, axis=2).astype(np.float32)
    np.savez_compressed(OUT / f"{VAR}_monthly.npz", months=np.array(months), **{VAR: grid, VAR + "__lats": LATS, VAR + "__lons": LONS})
    print(VAR, "grid", grid.shape, f"{np.isfinite(grid).mean() * 100:.0f}% valid")
