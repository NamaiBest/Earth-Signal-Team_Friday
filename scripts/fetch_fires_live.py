"""Snapshot of active fires over India for the last 5 days (NASA FIRMS, VIIRS 375 m, near real time).

Needs FIRMS_MAP_KEY. Writes web/data/fires_live.geojson. Re-run to refresh the snapshot
(the site is static, so this is not live by itself).
"""
import csv
import io
import json
import os
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
KEY = os.environ.get("FIRMS_MAP_KEY") or sys.exit("Set FIRMS_MAP_KEY")
feats = []
for src in ("VIIRS_NOAA20_NRT", "VIIRS_NOAA21_NRT", "VIIRS_SNPP_NRT"):
    url = f"https://firms.modaps.eosdis.nasa.gov/api/area/csv/{KEY}/{src}/68,6,98,38/5"
    text = urllib.request.urlopen(url, timeout=180).read().decode()
    if not text.startswith("latitude"):
        print(src, "skipped:", text[:80])
        continue
    rows = list(csv.DictReader(io.StringIO(text)))
    for r in rows:
        feats.append({"type": "Feature", "geometry": {"type": "Point", "coordinates": [round(float(r["longitude"]), 4), round(float(r["latitude"]), 4)]},
                      "properties": {"date": r["acq_date"], "time": f"{int(r['acq_time']):04d}"[:2] + ":" + f"{int(r['acq_time']):04d}"[2:],
                                     "sat": r.get("satellite", src), "frp": float(r["frp"]), "conf": r["confidence"]}})
    print(src, len(rows))
dates = sorted(f["properties"]["date"] for f in feats)
out = {"type": "FeatureCollection", "from": dates[0] if dates else "", "to": dates[-1] if dates else "",
       "made": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"), "source": "NASA FIRMS VIIRS NRT", "features": feats}
(ROOT / "web" / "data" / "fires_live.geojson").write_text(json.dumps(out, separators=(",", ":")))
print(len(feats), "fires", out["from"], "to", out["to"])
