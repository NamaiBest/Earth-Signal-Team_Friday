"""Policy workspace data: ranked issues, recent anomalies and source hotspot tags.

Rules-based, fully traceable (no AI). Reads what the trend pipeline already produced:
  web/data/trends.json, web/data/series/<id>.json, web/data/grid/<VAR>.json,
  web/data/suspects.geojson, web/data/fires_live.geojson, data/raw/firms/FIRE_monthly.npz,
  data/raw/{so2,no2}/omi_*_monthly.npz
Writes web/data/policy.json.

1. Issues. For each district x variable, every significant (q < 0.05) whole-year or seasonal
   trend in the HARMFUL direction is a candidate; the strongest period is kept.
     severity   = percentile rank of |slope| among all significant harmful trends of that variable (0-1)
     confidence = clip(-log10(q) / 3, 0, 1)      (q = 0.001 -> 1)
     score      = 100 * severity * (0.5 + 0.5 * confidence) * weight
   weight: 1 for ~25 km satellite pollution signals (NO2, SO2, fires); 0.7 for haze (~100 km cells,
   so neighbouring districts share values); 0.6 greenness loss, 0.5 sunlight loss (indirect);
   0.4 for model / unvalidated variables (hidden by default in the app).
2. Anomalies ("now vs normal").
   - Fires: live FIRMS VIIRS detections in the district over the snapshot window vs the
     MODIS 2003-2025 average for the same calendar month scaled to the window length.
     VIIRS (375 m) sees many more small fires than MODIS (1 km), so the raw ratio is inflated.
     We report it relative to India's ratio: "relative" = 1 means as unusual as the country
     as a whole; 3 means three times more unusual than the national picture.
   - SO2 and NO2: mean of the last 3 months in the record vs the same months in all earlier
     years (z-score). Labelled with the months used.
3. Source tags. For every Climate TRACE source: SO2 mean 2019-2025 at its 0.25 deg cell
   (with national percentile) and the NO2 trend of its cell. "In an SO2 hotspot" = top 5 %
   of Indian land cells. Co-location, not attribution.
"""
import json
import math
from datetime import date
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web" / "data"
RAW = ROOT / "data" / "raw"

# +1: rising is harmful, -1: falling is harmful. weight as in the docstring.
HARM = {
    "NO2": (+1, 1.0, "validated"), "SO2": (+1, 1.0, "validated"), "AOD_55": (+1, 0.7, "validated"),
    "FIRE": (+1, 1.0, "validated"), "NDVI": (-1, 0.6, "validated"), "ALLSKY_SFC_SW_DWN": (-1, 0.5, "validated"),
    "LST": (+1, 0.4, "unvalidated"), "T2M": (+1, 0.4, "unvalidated"), "T2M_MAX": (+1, 0.4, "unvalidated"),
    "GWETROOT": (-1, 0.4, "unvalidated"),
}
PERIODS = ["year", "winter", "premonsoon", "monsoon", "postmonsoon"]

T = json.loads((WEB / "trends.json").read_text())
ids = list(T["d"])
pidx = {p: T["periods"].index(p) for p in PERIODS}

# ---------- 1. issues ----------
cands = []
for v, (sign, w, status) in HARM.items():
    if v not in T["vars"]:
        continue
    for d in ids:
        rows = T["d"][d].get(v)
        if not rows:
            continue
        for p in PERIODS:
            b, pv, q, mean, lo, hi = rows[pidx[p]]
            if b is None or q is None or q >= T["alpha"] or b * sign <= 0:
                continue
            cands.append((d, v, p, b, q, mean, w, status, lo, hi))

scale = {}  # sorted |slope| per variable, for percentile ranks
for v in HARM:
    mags = sorted(abs(c[3]) for c in cands if c[1] == v)  # c = (d, v, p, slope, ...)
    if mags:
        scale[v] = np.array(mags)

best = {}
for d, v, p, b, q, mean, w, status, lo, hi in cands:
    sev = float(np.searchsorted(scale[v], abs(b), side="right") / len(scale[v]))
    conf = min(1.0, max(0.0, -math.log10(max(q, 1e-12)) / 3))
    score = 100 * sev * (0.5 + 0.5 * conf) * w
    rel = (b / mean * 100) if T["vars"][v]["rel"] and mean else None
    key = (d, v)
    if key not in best or score > best[key][2]:
        best[key] = [v, p, round(score, 1), b, q, None if rel is None else round(rel, 1), lo, hi]

issues = {}
for (d, v), row in best.items():
    issues.setdefault(d, []).append(row)
for d in issues:
    issues[d].sort(key=lambda r: -r[2])
print("issues:", sum(len(x) for x in issues.values()), "across", len(issues), "districts")

# ---------- 2. anomalies ----------
districts = json.loads((WEB / "districts.geojson").read_text())["features"]
area = {f["properties"]["id"]: f["properties"]["area_km2"] for f in districts}
anom = {d: {} for d in ids}

# 2a. live fires vs normal for the same calendar month
live = json.loads((WEB / "fires_live.geojson").read_text())
sus_d = None
try:
    import geopandas as gpd
    pts = gpd.GeoDataFrame(geometry=gpd.points_from_xy([f["geometry"]["coordinates"][0] for f in live["features"]],
                                                       [f["geometry"]["coordinates"][1] for f in live["features"]]), crs=4326)
    dg = gpd.read_file(WEB / "districts.geojson")[["id", "geometry"]]
    j = gpd.sjoin(pts, dg, predicate="within", how="left")
    counts = j["id"].value_counts().to_dict()
except Exception as e:  # noqa: BLE001
    print("fire join failed:", e)
    counts = {}
d0, d1 = date.fromisoformat(live["from"]), date.fromisoformat(live["to"])
days = (d1 - d0).days + 1
month = d1.month
for d in ids:
    s = json.loads((WEB / "series" / f"{d}.json").read_text())["vars"].get("FIRE")
    if not s:
        continue
    vals = np.array([x if x is not None else np.nan for x in s["v"]], float)
    start = s["start"]
    mi = [i for i in range(len(vals)) if ((start % 100 - 1 + i) % 12) + 1 == month]
    normal_month = np.nanmean(vals[mi]) * area[d] / 1000  # fires per month in this district
    normal = normal_month * days / 30.4
    n = int(counts.get(d, 0))
    if n or normal > 0.5:
        anom[d]["FIRE"] = {"now": n, "normal": round(float(normal), 1),
                           "window": f"{live['from']} to {live['to']}", "basis": "VIIRS live vs MODIS 2003-2025 same-month average, relative to India"}
tot_now = sum(a["FIRE"]["now"] for a in anom.values() if "FIRE" in a)
tot_norm = sum(a["FIRE"]["normal"] for a in anom.values() if "FIRE" in a)
national = tot_now / tot_norm if tot_norm else None
for a in anom.values():
    if "FIRE" in a:
        f = a["FIRE"]
        f["relative"] = round(f["now"] / (f["normal"] * national), 2) if national and f["normal"] >= 1 else None
print(f"fires: {tot_now} live vs {tot_norm:.0f} MODIS-normal -> national ratio {national:.1f}")

# 2b. last 3 months vs the same months in earlier years
for v in ("SO2", "NO2"):
    if v not in T["vars"]:
        continue
    for d in ids:
        s = json.loads((WEB / "series" / f"{d}.json").read_text())["vars"].get(v)
        if not s:
            continue
        x = np.array([y if y is not None else np.nan for y in s["v"]], float).reshape(-1, 12)
        last = x[-1, 9:12]
        hist = x[:-1, 9:12]
        if np.isfinite(last).sum() < 2:
            continue
        clim = np.nanmean(hist, axis=0)
        sd = np.nanstd(np.nanmean(hist, axis=1))
        now = np.nanmean(last)
        z = (now - np.nanmean(clim)) / sd if sd > 0 else None
        yr = s["start"] // 100 + x.shape[0] - 1
        anom[d][v] = {"now": round(float(now), 3), "normal": round(float(np.nanmean(clim)), 3),
                      "z": None if z is None else round(float(z), 2), "window": f"Oct-Dec {yr} vs Oct-Dec {s['start'] // 100}-{yr - 1}"}
anom = {d: a for d, a in anom.items() if a}

# ---------- 3. source tags ----------
def grid(v):
    p = WEB / "grid" / f"{v}.json"
    return json.loads(p.read_text()) if p.exists() else None


def cell(g, lon, lat):
    i = int(round((lat - g["lat0"]) / g["dlat"]))
    j = int(round((lon - g["lon0"]) / g["dlon"]))
    if 0 <= i < g["nlat"] and 0 <= j < g["nlon"]:
        return i * g["nlon"] + j
    return None


tags = {}
so2_npz = RAW / "so2" / "omi_so2_monthly.npz"
so2_mean = so2_p95 = None
if so2_npz.exists():
    z = np.load(so2_npz)
    keep = z["months"] >= 201901
    so2_mean = np.nanmean(z["SO2"][:, :, keep], axis=2)
    g_so2 = grid("SO2")  # its non-null cells are the cells touching India
    valid = np.array([q is not None for q in g_so2["q"]]).reshape(g_so2["nlat"], g_so2["nlon"]) if g_so2 else np.isfinite(so2_mean)
    vals = so2_mean[valid & np.isfinite(so2_mean)]
    so2_p95 = float(np.percentile(vals, 95))
    ranks = np.sort(vals)
g_no2 = grid("NO2")
sus = json.loads((WEB / "suspects.geojson").read_text())
for f in sus["features"]:
    lon, lat = f["geometry"]["coordinates"]
    t = {}
    if so2_mean is not None:
        i, j = int((lat - 6) / 0.25), int((lon - 68) / 0.25)
        if 0 <= i < so2_mean.shape[0] and 0 <= j < so2_mean.shape[1] and np.isfinite(so2_mean[i, j]):
            m = float(so2_mean[i, j])
            t["so2"] = round(m, 3)
            t["so2_pct"] = round(float(np.searchsorted(ranks, m) / len(ranks) * 100), 1)
            t["so2_hot"] = m >= so2_p95
    if g_no2:
        k = cell(g_no2, lon, lat)
        if k is not None and g_no2["slope"][k] is not None:
            t["no2_slope"] = g_no2["slope"][k]
            t["no2_sig"] = g_no2["q"][k] is not None and g_no2["q"][k] < T["alpha"]
    if t:
        tags[f["properties"]["id"]] = t
print("source tags:", len(tags), "| in SO2 hotspot:", sum(1 for t in tags.values() if t.get("so2_hot")))

out = {
    "harm": {v: {"sign": s, "weight": w, "status": st} for v, (s, w, st) in HARM.items() if v in T["vars"]},
    "counts": {v: int(len(a)) for v, a in scale.items()},
    "issues": issues,
    "anomalies": anom,
    "source_tags": tags,
    "so2_hotspot_threshold": so2_p95,
    "fires_window": f"{live['from']} to {live['to']}",
    "notes": [
        "Issues are significant trends in the harmful direction; they show where problems are worsening, not who caused them.",
        "Sources are tagged by what the satellite sees at their location (co-location), not by measured emissions from that source.",
        "No population weighting yet: a sparsely populated district can rank as high as a city.",
    ],
}
(WEB / "policy.json").write_text(json.dumps(out, separators=(",", ":")))
print("web/data/policy.json", round((WEB / "policy.json").stat().st_size / 1e6, 2), "MB")
