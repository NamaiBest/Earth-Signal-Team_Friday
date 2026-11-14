"""Suspects layer: India's industrial emission sources, with estimated emissions.

Source: Climate TRACE asset inventory, API v6 (https://api.climatetrace.org/v6/assets),
no key needed. Licence CC BY 4.0, credit "Climate TRACE".
Emissions are Climate TRACE *estimates* (often modelled from satellite + activity data),
not measurements, and the map must say so.

Writes:
  web/data/suspects.geojson       point sources, grouped into 7 source types
  data/district_suspects.csv      per district: count, total CO2e, CH4, top source
"""
import json
import time
import urllib.request
from pathlib import Path

import geopandas as gpd
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
YEAR = 2024
API = "https://api.climatetrace.org/v6/assets?countries=IND&limit=1000&year={year}&gas={gas}&offset={off}"

# Climate TRACE sector -> our source type. Area-wide estimates (cattle, cropland,
# forest, road, residential fuel) are not point sources and are left out.
GROUP = {
    "electricity-generation": "Power plant",
    "iron-and-steel": "Steel & metals", "aluminum": "Steel & metals",
    "cement": "Cement",
    "oil-and-gas-refining": "Oil & gas", "petrochemical-steam-cracking": "Oil & gas",
    "oil-and-gas-production": "Oil & gas", "oil-and-gas-transport": "Oil & gas",
    "coal-mining": "Mining", "bauxite-mining": "Mining", "iron-mining": "Mining", "copper-mining": "Mining",
    "solid-waste-disposal": "Landfill & waste", "industrial-wastewater-treatment-and-discharge": "Landfill & waste",
    "chemicals": "Other industry", "pulp-and-paper": "Other industry", "glass": "Other industry",
    "textiles-leather-apparel": "Other industry", "food-beverage-tobacco": "Other industry",
}


def fetch(gas, cap=60000):
    """Assets come back sorted by emissions, largest first."""
    out, off = [], 0
    while off < cap:
        for attempt in range(3):
            try:
                with urllib.request.urlopen(API.format(year=YEAR, gas=gas, off=off), timeout=90) as r:
                    page = json.load(r).get("assets") or []
                break
            except Exception as e:  # noqa: BLE001
                print("retry", off, e)
                time.sleep(3)
        else:
            raise RuntimeError("Climate TRACE API failed")
        out += page
        off += 1000
        if len(page) < 1000:
            break
    print(f"{gas}: {len(out)} assets")
    return out


def emission(asset, gas):
    for e in asset.get("EmissionsSummary") or []:
        if e.get("Gas") == gas and e.get("EmissionsQuantity") is not None:
            return float(e["EmissionsQuantity"])
    return None


rows = {}
for gas in ("co2e_100yr", "ch4"):
    for a in fetch(gas):
        if a.get("Sector") not in GROUP or not (a.get("Centroid") or {}).get("Geometry"):
            continue
        if "_Other" in (a.get("Name") or ""):  # basin-wide aggregates, not a real site
            continue
        r = rows.setdefault(a["Id"], {
            "id": a["Id"], "name": a.get("Name") or "Unnamed", "sector": a["Sector"],
            "type": GROUP[a["Sector"]], "fuel": a.get("AssetType") or "",
            "lon": round(a["Centroid"]["Geometry"][0], 4), "lat": round(a["Centroid"]["Geometry"][1], 4),
            "co2e_t": None, "ch4_t": None,
        })
        v = emission(a, gas)
        if v is not None:
            r["co2e_t" if gas == "co2e_100yr" else "ch4_t"] = round(v)

df = pd.DataFrame(rows.values())
pts = gpd.GeoDataFrame(df, geometry=gpd.points_from_xy(df.lon, df.lat), crs=4326)

dists = gpd.read_file(ROOT / "web" / "data" / "districts.geojson")[["id", "label", "state", "geometry"]]
j = gpd.sjoin(pts, dists.rename(columns={"id": "district_id"}), predicate="within", how="left").drop_duplicates("id")
pts["district_id"] = pts.id.map(j.set_index("id")["district_id"])
pts["district"] = pts.id.map(j.set_index("id")["label"])
pts["state"] = pts.id.map(j.set_index("id")["state"])
pts = pts.sort_values("co2e_t", ascending=False, na_position="last")
pts["rank"] = range(1, len(pts) + 1)

feat = []
for r in pts.itertuples():
    p = {k: getattr(r, k) for k in ("id", "name", "type", "sector", "fuel", "co2e_t", "ch4_t", "district", "state", "rank")}
    p = {k: (None if pd.isna(v) else v) for k, v in p.items()}
    feat.append({"type": "Feature", "geometry": {"type": "Point", "coordinates": [r.lon, r.lat]}, "properties": p})
out = ROOT / "web" / "data" / "suspects.geojson"
out.write_text(json.dumps({"type": "FeatureCollection", "year": YEAR,
                           "source": "Climate TRACE v6 asset estimates (CC BY 4.0)", "features": feat},
                          separators=(",", ":"), default=int))
print(f"{out.relative_to(ROOT)}: {len(feat)} sources, {out.stat().st_size / 1e6:.1f} MB")
print(pts["type"].value_counts().to_string())

g = pts.dropna(subset=["district_id"]).groupby("district_id")
summary = pd.DataFrame({
    "n_sources": g.size(),
    "co2e_t": g.co2e_t.sum().round(0),
    "ch4_t": g.ch4_t.sum().round(0),
    "top_source": g.apply(lambda d: d.sort_values("co2e_t", ascending=False).name.iloc[0], include_groups=False),
}).reset_index()
summary.to_csv(ROOT / "data" / "district_suspects.csv", index=False)
print("districts with sources:", len(summary), "| outside any district:", pts.district_id.isna().sum())
