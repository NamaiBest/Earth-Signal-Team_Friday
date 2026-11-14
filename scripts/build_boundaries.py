"""India state + district boundaries for the web app.

Source: geoBoundaries gbOpen IND ADM1 / ADM2 (simplified), built from the
Government of India's Local Government Directory (lgdirectory.gov.in), 2021.
Licence: ODbL 1.0. Depicts India's official external boundary.

Download (no login):
  https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/9469f09/releaseData/gbOpen/IND/ADM1/geoBoundaries-IND-ADM1_simplified.geojson
  https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/9469f09/releaseData/gbOpen/IND/ADM2/geoBoundaries-IND-ADM2_simplified.geojson
into data/raw/boundaries/IND_ADM1.geojson and IND_ADM2.geojson.

Writes:
  web/data/states.geojson      36 states / UTs
  web/data/districts.geojson   735 districts, each with its state
  data/districts.csv           id, name, state, centroid lon/lat, area km2
"""
import json
import unicodedata
from pathlib import Path

import geopandas as gpd

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw" / "boundaries"
WEB = ROOT / "web" / "data"
WEB.mkdir(parents=True, exist_ok=True)


def plain(s: str) -> str:
    """'Mahārāshtra' -> 'Maharashtra' (search and display)."""
    return "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))


def write(gdf, path, tolerance, digits=4):
    gdf = gdf.copy()
    gdf["geometry"] = gdf.geometry.simplify(tolerance, preserve_topology=True)
    data = json.loads(gdf.to_json(drop_id=True))

    def rnd(c):
        return [round(c[0], digits), round(c[1], digits)] if isinstance(c[0], (int, float)) else [rnd(x) for x in c]

    for f in data["features"]:
        f["geometry"]["coordinates"] = rnd(f["geometry"]["coordinates"])
    path.write_text(json.dumps(data, separators=(",", ":")))
    print(f"{path.relative_to(ROOT)}: {len(gdf)} features, {path.stat().st_size / 1e6:.1f} MB")


states = gpd.read_file(RAW / "IND_ADM1.geojson")
dists = gpd.read_file(RAW / "IND_ADM2.geojson")

states["name"] = states.shapeName.map(plain)
states["id"] = states.shapeID
dists["name"] = dists.shapeName.map(plain)
dists["id"] = dists.shapeID

# Assign each district to the state containing its representative point
pts = dists.copy()
pts["geometry"] = dists.representative_point()
st = states[["name", "geometry"]].rename(columns={"name": "state"})
joined = gpd.sjoin(pts[["id", "geometry"]], st, predicate="within", how="left").drop_duplicates("id")
dists["state"] = dists.id.map(joined.set_index("id")["state"])
missing = dists.state.isna().sum()
if missing:  # coastal slivers: nearest state
    near = gpd.sjoin_nearest(pts.loc[dists.state.isna(), ["id", "geometry"]].to_crs(6933), st.to_crs(6933)).drop_duplicates("id")
    dists.loc[dists.state.isna(), "state"] = dists.loc[dists.state.isna(), "id"].map(near.set_index("id")["state"])
print("districts without state:", dists.state.isna().sum())

# Delhi's districts are just called "North", "South", ...: make them searchable
dists["name"] = dists.name.str.strip()
bare = (dists.state == "Delhi") & ~dists.name.str.contains("Delhi")
dists.loc[bare, "name"] = dists.loc[bare, "name"] + " Delhi"

eq = dists.to_crs(6933)  # equal-area for km2
dists["area_km2"] = (eq.area / 1e6).round(0).astype(int)
cent = dists.representative_point()
dists["lon"] = cent.x.round(4)
dists["lat"] = cent.y.round(4)

# Same district name in two states (e.g. Aurangabad, Bilaspur): label "Name, State"
dup = dists.name.duplicated(keep=False)
dists["label"] = dists.name
dists.loc[dup, "label"] = dists.loc[dup, "name"] + ", " + dists.loc[dup, "state"]

# State outlines are dissolved from the districts so the two layers share exactly the same edges.
simple = dists.copy()
simple["geometry"] = simple.geometry.simplify(0.002, preserve_topology=True)
st_out = simple[["state", "geometry"]].dissolve("state").reset_index().rename(columns={"state": "name"})
st_out["id"] = st_out.name
write(st_out[["id", "name", "geometry"]], WEB / "states.geojson", 0)
write(simple[["id", "name", "label", "state", "area_km2", "lon", "lat", "geometry"]], WEB / "districts.geojson", 0)
dists[["id", "name", "label", "state", "lon", "lat", "area_km2"]].to_csv(ROOT / "data" / "districts.csv", index=False)
print("data/districts.csv:", len(dists), "rows;", dup.sum(), "duplicate names disambiguated")
