"""Cross-check EarthSignal's grids against NASA Giovanni (the challenge's recommended tool).

Giovanni's time-series API returns the series for ONE grid cell (point query), so we compare
cell against cell: same product, same cell, our monthly value vs Giovanni's.
  https://api.giovanni.earthdata.nasa.gov/timeseries?data=<id>&location=[lat,lon]&time=<start>/<end>
  header  Authorization: Bearer <EARTHDATA_TOKEN>

For every location x variable:
  - monthly agreement: n months, Pearson r, mean bias (%), RMSE
  - trend agreement: seasonal Mann-Kendall + Sen's slope (with 95 % CI) on both series,
    using the same functions as the app (scripts/district_trends.py)

Writes data/validation/giovanni_series/*.csv (raw Giovanni output) and
data/validation/giovanni_summary.csv, and prints a table.
"""
import csv
import io
import json
import os
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from district_trends import seasonal_mk  # noqa: E402  (same statistics as the app)

TOKEN = os.environ.get("EARTHDATA_TOKEN") or sys.exit("Set EARTHDATA_TOKEN")
OUT = ROOT / "data" / "validation"
(OUT / "giovanni_series").mkdir(parents=True, exist_ok=True)
API = "https://api.giovanni.earthdata.nasa.gov/timeseries"

# Giovanni variable id, our grid file, our variable key, conversion of Giovanni units -> ours,
# how to aggregate Giovanni's native steps to months, and the year range.
VARS = {
    "NO2": dict(gid="OMNO2d_003_ColumnAmountNO2TropCloudScreened", npz="data/raw/no2/omi_no2_monthly.npz",
                scale=1e-15, min_days=5, years=(2005, 2025)),
    "SO2": dict(gid="OMSO2e_003_ColumnAmountSO2", npz="data/raw/so2/omi_so2_monthly.npz",
                scale=1.0, min_days=5, years=(2005, 2025)),
    # Same model (MERRA-2 hourly) -> checks our NASA POWER extraction only.
    "T2M": dict(gid="M2T1NXSLV_5_12_4_T2M", npz="data/raw/power/india_monthly.npz", check="same product",
                scale=1.0, offset=-273.15, min_days=24 * 20, years=(2001, 2025), chunk=5,
                sites=["New Delhi", "Ludhiana (NW 'cooling')", "Singrauli (coal power)", "Bengaluru"]),
    # INDEPENDENT: MERRA-2 rainfall (ours) vs GPM IMERG satellite rainfall (Giovanni), mm/hr -> mm/day.
    "PRECTOTCORR": dict(gid="GPM_3IMERGM_07_precipitation", npz="data/raw/power/india_monthly.npz", check="independent",
                        scale=24.0, min_days=1, years=(2001, 2025),
                        sites=["New Delhi", "Ludhiana (NW 'cooling')", "Lawngtlai (NE rain jump)", "Mumbai", "Bengaluru", "Singrauli (coal power)"]),
}
for k in ("NO2", "SO2"):
    VARS[k]["check"] = "same product"
# Test locations: rising hotspots, a non-significant megacity, and clean/background places.
SITES = {
    "Singrauli (coal power)": (24.13, 82.63), "Korba (coal power)": (22.35, 82.68),
    "Angul (coal, smelter)": (20.84, 85.10), "Jharsuguda (smelter, coal)": (21.86, 84.01),
    "Dhanbad (coal mining)": (23.80, 86.43), "New Delhi": (28.61, 77.21),
    "Mumbai": (19.08, 72.88), "Bengaluru": (12.97, 77.59), "Jaisalmer (background)": (26.91, 70.92),
    "Ludhiana (NW 'cooling')": (30.90, 75.85), "Lawngtlai (NE rain jump)": (22.53, 92.90),
}


def giovanni(gid, lat, lon, t0, t1):
    q = urllib.parse.urlencode({"data": gid, "location": f"[{lat},{lon}]", "time": f"{t0}/{t1}"})
    req = urllib.request.Request(f"{API}?{q}", headers={"Authorization": f"Bearer {TOKEN}"})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=300) as r:
                return r.read().decode()
        except Exception as e:  # noqa: BLE001
            err = e
            time.sleep(5 * (attempt + 1))
    raise RuntimeError(f"{gid} {lat},{lon}: {err}")


def parse(text):
    """Header block, blank line, then 'Timestamp (UTC),Data' rows."""
    meta, rows, body = {}, [], False
    for line in text.splitlines():
        if line.startswith("Timestamp"):
            body = True
            continue
        if not body:
            if "," in line:
                k, v = line.split(",", 1)
                meta[k] = v
            continue
        if line.strip():
            t, v = line.split(",")
            rows.append((t[:10], float(v)))
    return meta, rows


def monthly(rows, undef, scale, offset, min_days, y0, y1):
    acc = {}
    for d, v in rows:
        if abs(v) >= abs(undef) / 10 or not np.isfinite(v):  # fill value can be -1.27e30 (OMI) or +1e15 (MERRA-2)
            continue
        acc.setdefault(d[:7], []).append(v * scale + offset)
    out = np.full((y1 - y0 + 1) * 12, np.nan)
    for ym, vals in acc.items():
        y, m = int(ym[:4]), int(ym[5:7])
        if y0 <= y <= y1 and len(vals) >= min_days:
            out[(y - y0) * 12 + m - 1] = np.mean(vals)
    return out


def ours(npz, key, lat, lon, y0, y1):
    z = np.load(ROOT / npz)
    lats, lons, months = z[key + "__lats"], z[key + "__lons"], z["months"]
    i, j = int(np.argmin(abs(lats - lat))), int(np.argmin(abs(lons - lon)))
    s = z[key][i, j, :]
    keep = (months >= y0 * 100 + 1) & (months <= y1 * 100 + 12)
    return s[keep].astype(float), float(lats[i]), float(lons[j])


rows_out = []
for v, cfg in VARS.items():
    if not (ROOT / cfg["npz"]).exists():
        print(v, "skipped: no local grid")
        continue
    y0, y1 = cfg["years"]
    for site, (lat, lon) in SITES.items():
        if "sites" in cfg and site not in cfg["sites"]:
            continue
        if "sites" not in cfg and site in ("Ludhiana (NW 'cooling')", "Lawngtlai (NE rain jump)"):
            continue
        mine, clat, clon = ours(cfg["npz"], v, lat, lon, y0, y1)
        cache = OUT / "giovanni_series" / f"{v}_{site.split(' (')[0].replace(' ', '_')}.csv"
        try:
            if cache.exists():
                text = cache.read_text()
            elif cfg.get("chunk"):  # long hourly records: ask in pieces, keep one header
                parts = []
                for a in range(y0, y1 + 1, cfg["chunk"]):
                    b = min(a + cfg["chunk"], y1 + 1)
                    t = giovanni(cfg["gid"], clat, clon, f"{a}-01-01T00:00:00", f"{b}-01-01T00:00:00")
                    parts.append(t if not parts else t.split("Timestamp (UTC),Data", 1)[1].lstrip("\n"))
                text = "\n".join(parts)
                cache.write_text(text)
            else:
                text = giovanni(cfg["gid"], clat, clon, f"{y0}-01-01T00:00:00", f"{y1 + 1}-01-01T00:00:00")
                cache.write_text(text)
        except Exception as e:  # noqa: BLE001
            print(f"{v} {site}: Giovanni request failed ({e})", flush=True)
            continue
        meta, raw = parse(text)
        g = monthly(raw, float(meta.get("undef", -1e30)), cfg["scale"], cfg.get("offset", 0.0), cfg["min_days"], y0, y1)
        both = np.isfinite(g) & np.isfinite(mine)
        n = int(both.sum())
        if n < 24:
            print(f"{v} {site}: only {n} common months")
            continue
        r = float(np.corrcoef(g[both], mine[both])[0, 1])
        bias = float(np.mean(mine[both] - g[both]))
        rel = bias / abs(np.mean(g[both])) * 100 if np.mean(g[both]) else np.nan
        rmse = float(np.sqrt(np.mean((mine[both] - g[both]) ** 2)))
        ny = y1 - y0 + 1
        bg, pg, log_, hig = seasonal_mk(g, ny)
        bo, po, loo, hio = seasonal_mk(mine, ny)
        same_verdict = (pg < 0.05) == (po < 0.05) and (np.sign(bg) == np.sign(bo) or (pg >= 0.05 and po >= 0.05))
        rows_out.append(dict(variable=v, check=cfg.get("check", ""), site=site, cell_lat=clat, cell_lon=clon, giovanni_id=cfg["gid"], months=n,
                             pearson_r=round(r, 4), mean_bias=round(bias, 4), bias_pct=round(rel, 2), rmse=round(rmse, 4),
                             giovanni_slope_decade=round(bg * 10, 4), giovanni_ci=f"{log_*10:.4f} to {hig*10:.4f}" if np.isfinite(log_) else "",
                             giovanni_p=float(f"{pg:.3g}"), ours_slope_decade=round(bo * 10, 4),
                             ours_ci=f"{loo*10:.4f} to {hio*10:.4f}" if np.isfinite(loo) else "", ours_p=float(f"{po:.3g}"),
                             same_verdict=bool(same_verdict)))
        x = rows_out[-1]
        print(f"{v:11s} {site:28s} n={n:3d} r={r:.3f} bias={rel:+6.1f}%  Sen G {bg*10:+.3f} (p {pg:.2g})  ours {bo*10:+.3f} (p {po:.2g})  {'✓' if same_verdict else '✗'}", flush=True)

with open(OUT / "giovanni_summary.csv", "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=list(rows_out[0]))
    w.writeheader()
    w.writerows(rows_out)
json.dump(rows_out, open(ROOT / "web" / "data" / "validation.json", "w"), separators=(",", ":"))
print("wrote data/validation/giovanni_summary.csv and web/data/validation.json")
