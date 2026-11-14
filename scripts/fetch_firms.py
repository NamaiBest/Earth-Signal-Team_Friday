"""Active fires over India, 2003-2025: monthly fire density on a 0.25 deg grid.

Source: NASA FIRMS, MODIS standard-processing archive (MODIS_SP, Terra + Aqua, 1 km).
Starts in 2003 because Aqua joined Terra in mid-2002; earlier years would show a false jump.
Only type 0 (presumed vegetation fire) is counted; type 2 (static industrial sources such as
gas flares and kilns) is saved separately for the Suspects layer.
Needs FIRMS_MAP_KEY (https://firms.modaps.eosdis.nasa.gov/api/map_key/). The API allows
5 days per request and 5000 transactions per 10 minutes; one day = one transaction.

Writes data/raw/firms/FIRE_monthly.npz: months, FIRE (fires per 1000 km2 per month),
FIRE__lats, FIRE__lons; and data/raw/firms/static_sources.csv.
"""
import csv
import io
import os
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "raw" / "firms"
OUT.mkdir(parents=True, exist_ok=True)
KEY = os.environ.get("FIRMS_MAP_KEY") or sys.exit("Set FIRMS_MAP_KEY")
URL = "https://firms.modaps.eosdis.nasa.gov/api/area/csv/{key}/MODIS_SP/68,6,98,38/5/{day}"
YEARS = range(2003, 2026)
LATS = 6.125 + 0.25 * np.arange(128)
LONS = 68.125 + 0.25 * np.arange(120)
CELL_KM2 = (0.25 * 111.32) ** 2 * np.cos(np.radians(LATS))[:, None] * np.ones((1, 120))


def get(day):
    time.sleep(1.5)  # pace: ~2 requests/s x 5 transactions stays near the 5000 / 10 min quota
    url = URL.format(key=KEY, day=day.isoformat())
    err = None
    for attempt in range(40):
        try:
            with urllib.request.urlopen(url, timeout=180) as r:
                text = r.read().decode()
        except urllib.error.HTTPError as e:
            text = e.read().decode(errors="ignore")
        except Exception as e:  # noqa: BLE001
            err = e
            time.sleep(5 * min(attempt + 1, 6))
            continue
        if text.startswith("latitude"):
            return list(csv.DictReader(io.StringIO(text)))
        if any(k in text.lower() for k in ("limit", "exceed", "invalid map_key")):  # quota also shows as "Invalid MAP_KEY"
            time.sleep(90)  # quota: 5000 transactions per 10 minutes; wait for it to roll over
            continue
        err = text[:200]
        time.sleep(5)
    raise RuntimeError(f"{day}: {err}")


static = []
for year in YEARS:
    part = OUT / f"part_{year}.npz"
    if part.exists():
        continue
    t = time.time()
    starts, d = [], date(year, 1, 1)
    while d.year == year:
        starts.append(d)
        d += timedelta(days=5)
    counts = np.zeros((12, 128, 120))
    with ThreadPoolExecutor(2) as ex:
        for rows in ex.map(get, starts):
            for r in rows:
                if not r["acq_date"].startswith(str(year)):
                    continue  # a 5-day window can spill into the next year
                i = int((float(r["latitude"]) - 6) / 0.25)
                j = int((float(r["longitude"]) - 68) / 0.25)
                if not (0 <= i < 128 and 0 <= j < 120):
                    continue
                if r["type"] == "0":
                    counts[int(r["acq_date"][5:7]) - 1, i, j] += 1
                elif r["type"] == "2":
                    static.append((r["latitude"], r["longitude"], r["acq_date"], r["frp"]))
    np.savez_compressed(part, c=counts)
    print(f"{year}: {int(counts.sum())} vegetation fires, {time.time() - t:.0f} s", flush=True)

if static:
    with open(OUT / "static_sources.csv", "a", newline="") as f:
        csv.writer(f).writerows(static)

months, arrs = [], []
for year in YEARS:
    c = np.load(OUT / f"part_{year}.npz")["c"]
    for m in range(12):
        arrs.append(c[m] / CELL_KM2 * 1000)
        months.append(year * 100 + m + 1)
grid = np.stack(arrs, axis=2).astype(np.float32)
np.savez_compressed(OUT / "FIRE_monthly.npz", months=np.array(months), FIRE=grid, FIRE__lats=LATS, FIRE__lons=LONS)
print("FIRE grid", grid.shape)
