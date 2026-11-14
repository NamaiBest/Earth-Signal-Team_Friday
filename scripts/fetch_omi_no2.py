"""NO2 over India, 2005-2025: monthly means from NASA OMI daily L3 (OMNO2d v003, 0.25 deg).

Variable: ColumnAmountNO2TropCloudScreened (tropospheric NO2 column, scenes with cloud
fraction < 30 %, row-anomaly pixels already removed by NASA). Units molec/cm2.
Source: NASA GES DISC, https://acdisc.gesdisc.eosdis.nasa.gov/data/Aura_OMI_Level3/OMNO2d.003/
Needs a NASA Earthdata token in EARTHDATA_TOKEN (urs.earthdata.nasa.gov -> Generate Token),
and the "NASA GESDISC DATA ARCHIVE" app approved on that account.

Each daily global file (~12 MB) is downloaded, cut to the India box, added to a monthly
sum, then deleted. Per-year results are saved so an interrupted run resumes.

Writes data/raw/no2/omi_no2_monthly.npz in the same layout as fetch_power.py:
  months, NO2, NO2__lats, NO2__lons   (NO2 in 1e15 molec/cm2; NaN = no valid day)
"""
import os
import re
import sys
import tempfile
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import h5py
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "raw" / "no2"
OUT.mkdir(parents=True, exist_ok=True)
BASE = "https://acdisc.gesdisc.eosdis.nasa.gov/data/Aura_OMI_Level3/OMNO2d.003"
TOKEN = os.environ.get("EARTHDATA_TOKEN") or sys.exit("Set EARTHDATA_TOKEN")
YEARS = range(2005, 2026)
FIELD = "HDFEOS/GRIDS/ColumnAmountNO2/Data Fields/ColumnAmountNO2TropCloudScreened"
# 0.25 deg grid, row 0 = 89.875 S, col 0 = 179.875 W. India box 6-38 N, 68-98 E.
R0, R1 = int((6 + 90) / 0.25), int((38 + 90) / 0.25)
C0, C1 = int((68 + 180) / 0.25), int((98 + 180) / 0.25)
LATS = -89.875 + 0.25 * np.arange(R0, R1)
LONS = -179.875 + 0.25 * np.arange(C0, C1)


def get(url, dest=None):
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {TOKEN}"})
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                data = r.read()
            if dest is None:
                return data
            Path(dest).write_bytes(data)
            return dest
        except Exception as e:  # noqa: BLE001
            time.sleep(3 * (attempt + 1))
            err = e
    raise RuntimeError(f"{url}: {err}")


def one_day(name):
    year = name.split("_")[2][:4]
    with tempfile.NamedTemporaryFile(suffix=".he5", dir=OUT, delete=False) as t:
        path = t.name
    try:
        get(f"{BASE}/{year}/{name}", path)
        with h5py.File(path, "r") as f:
            a = f[FIELD][R0:R1, C0:C1].astype(np.float64)
        a[(a < -1e29) | ~np.isfinite(a)] = np.nan
        return name, a / 1e15
    finally:
        os.remove(path)


for year in YEARS:
    part = OUT / f"part_{year}.npz"
    if part.exists():
        continue
    listing = get(f"{BASE}/{year}/").decode()
    names = sorted(set(re.findall(r"OMI-Aura_L3-OMNO2d_\d{4}m\d{4}_v003-[^\"<]+?\.he5", listing)))
    s = np.zeros((12, R1 - R0, C1 - C0))
    n = np.zeros_like(s)
    t = time.time()
    with ThreadPoolExecutor(6) as ex:
        for name, a in ex.map(one_day, names):
            m = int(name.split("_")[2][5:7]) - 1
            ok = np.isfinite(a)
            s[m][ok] += a[ok]
            n[m][ok] += 1
    np.savez_compressed(part, s=s, n=n)
    print(f"{year}: {len(names)} days in {time.time() - t:.0f} s", flush=True)

months, arrs = [], []
for year in YEARS:
    p = np.load(OUT / f"part_{year}.npz")
    for m in range(12):
        # a month counts only with >= 5 valid days in that cell
        arrs.append(np.where(p["n"][m] >= 5, p["s"][m] / np.maximum(p["n"][m], 1), np.nan))
        months.append(year * 100 + m + 1)
no2 = np.stack(arrs, axis=2).astype(np.float32)
np.savez_compressed(OUT / "omi_no2_monthly.npz", months=np.array(months), NO2=no2,
                    NO2__lats=LATS, NO2__lons=LONS)
print("grid", no2.shape, f"{np.isfinite(no2).mean() * 100:.0f}% of cell-months valid")
