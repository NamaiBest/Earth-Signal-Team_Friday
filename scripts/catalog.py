#!/usr/bin/env python3
"""Verify every candidate dataset against NASA's Common Metadata Repository (CMR).

No login needed (CMR search is public). Writes data/catalog.json.
Usage: python3 scripts/catalog.py
"""
import json, sys, urllib.parse, urllib.request
from pathlib import Path

CMR = "https://cmr.earthdata.nasa.gov/search/collections.json"

# (group, variable, short_name candidates, keyword fallback)
CANDIDATES = [
    # ---- Gases: gridded, from space ----
    ("gas", "CH4 (mid-troposphere) + CO, O3, H2O", ["AIRS3STM", "AIRSIL3STM"], "AIRS level 3 monthly standard"),
    ("gas", "CH4 column (TROPOMI)", ["S5P_L2__CH4____HiR"], "TROPOMI methane"),
    ("gas", "NO2 tropospheric column (OMI)", ["OMNO2d"], "OMI NO2 daily L3"),
    ("gas", "NO2 (TROPOMI)", ["S5P_L2__NO2____HiR"], "TROPOMI NO2"),
    ("gas", "NO2 hourly N. America (TEMPO)", ["TEMPO_NO2_L3"], "TEMPO NO2 L3"),
    ("gas", "SO2 (OMI)", ["OMSO2e"], "OMI SO2 L3"),
    ("gas", "HCHO formaldehyde (OMI)", ["OMHCHOd"], "OMI formaldehyde L3"),
    ("gas", "O3 total column (OMI)", ["OMTO3e"], "OMI total ozone L3"),
    ("gas", "CO (MOPITT monthly)", ["MOP03JM"], "MOPITT CO monthly L3"),
    ("gas", "CO2 (OCO-2, gap-filled monthly)", ["OCO2_GEOS_L3CO2_MONTH"], "OCO-2 GEOS L3 CO2 monthly"),
    ("gas", "CO2 (OCO-2 lite)", ["OCO2_L2_Lite_FP"], "OCO-2 lite"),
    ("gas", "N2O stratosphere (MLS)", ["ML3MBN2O", "ML2N2O"], "MLS nitrous oxide"),
    ("gas", "HCl stratosphere (MLS)", ["ML3MBHCL", "ML2HCL"], "MLS hydrogen chloride"),
    ("gas", "HNO3 (MLS)", ["ML3MBHNO3", "ML2HNO3"], "MLS nitric acid"),
    ("gas", "NH3 ammonia (CrIS, L2 points)", ["TRPSYL2NH3CRSRS"], "CrIS ammonia"),
    ("gas", "BrO (OMI)", ["OMBRO"], "OMI BrO"),
    # ---- Aerosols / atmosphere ----
    ("atmos", "Aerosol, cloud (MODIS Terra monthly)", ["MOD08_M3"], "MODIS atmosphere monthly"),
    ("atmos", "Aerosols, reanalysis (MERRA-2)", ["M2TMNXAER"], "MERRA-2 aerosol monthly"),
    ("atmos", "Surface air temp, wind (MERRA-2)", ["M2TMNXSLV"], "MERRA-2 single level monthly"),
    ("atmos", "Precipitation (GPM IMERG monthly)", ["GPM_3IMERGM"], "IMERG monthly"),
    ("atmos", "Radiation budget (CERES EBAF)", ["CERES_EBAF"], "CERES EBAF"),
    # ---- Land ----
    ("land", "Land surface temperature", ["MOD11C3"], "MODIS LST monthly CMG"),
    ("land", "Snow cover", ["MOD10CM"], "MODIS snow monthly CMG"),
    ("land", "Burned area / fire (500 m, aggregate to 1 deg)", ["MCD64A1"], "MODIS burned area monthly"),
    ("land", "NDVI vegetation", ["MOD13C2"], "MODIS vegetation index monthly CMG"),
    ("land", "Albedo", ["MCD43C3"], "MODIS albedo CMG"),
    ("land", "Soil moisture, ET (GLDAS model)", ["GLDAS_NOAH025_M"], "GLDAS Noah monthly"),
    ("land", "Soil moisture (SMAP L3)", ["SPL3SMP"], "SMAP L3 soil moisture"),
    ("land", "Water storage (GRACE/GRACE-FO)", ["TELLUS_GRAC-GRFO_MASCON_CRI_GRID_RL06.3_V4", "TELLUS_GRAC-GRFO_MASCON_CRI_GRID_RL06.1_V3"], "GRACE mascon"),
    # ---- Ocean / cryosphere ----
    ("ocean", "Sea surface temperature (MUR)", ["MUR-JPL-L4-GLOB-v4.1"], "MUR SST"),
    ("ocean", "Chlorophyll-a (MODIS Aqua)", ["MODISA_L3m_CHL"], "MODIS Aqua chlorophyll L3 mapped"),
    ("ocean", "Sea level (altimetry grids)", ["NASA_SSH_REF_SIMPLE_GRID_V1", "SEA_SURFACE_HEIGHT_ALT_GRIDS_L4_2SATS_5DAY_6THDEG_V_JPL2205"], "sea surface height gridded altimetry"),
    ("ocean", "Sea ice concentration", ["NSIDC-0051"], "sea ice concentrations passive microwave"),
    # ---- Fire, live ----
    ("live", "Active fires NRT (VIIRS)", ["VJ114IMGTDL_NRT"], "VIIRS active fire NRT"),
]


def cmr(params):
    url = CMR + "?" + urllib.parse.urlencode(params)
    with urllib.request.urlopen(url, timeout=30) as r:
        return json.load(r)["feed"]["entry"]


def best(entries):
    # prefer the most recent version / latest end date
    return sorted(entries, key=lambda e: (e.get("time_end") or "9999", e.get("version_id", "")), reverse=True)[0]


def main():
    out = []
    for group, var, names, kw in CANDIDATES:
        hit, how = None, None
        for sn in names:
            e = cmr({"short_name": sn, "page_size": 20})
            if e:
                hit, how = best(e), f"short_name={sn}"
                break
        alts = []
        if not hit:
            e = cmr({"keyword": kw, "page_size": 5, "sort_key": "-usage_score"})
            alts = [{"short_name": x.get("short_name"), "title": x.get("title")} for x in e]
        rec = {"group": group, "variable": var, "found": bool(hit), "matched": how}
        if hit:
            rec.update({
                "short_name": hit.get("short_name"), "version": hit.get("version_id"),
                "title": hit.get("title"), "provider": hit.get("data_center"),
                "time_start": (hit.get("time_start") or "")[:10],
                "time_end": (hit.get("time_end") or "ongoing")[:10],
                "concept_id": hit.get("id"),
                "doi": (hit.get("doi") or ""),
            })
        else:
            rec["alternatives"] = alts
        out.append(rec)
        flag = "OK " if hit else "-- "
        print(flag, var, "|", rec.get("short_name", ""), rec.get("version", ""), rec.get("time_start", ""), "->", rec.get("time_end", ""), "|", rec.get("provider", ""))
        for a in alts:
            print("      alt:", a["short_name"], "|", (a["title"] or "")[:90])
    Path("data").mkdir(exist_ok=True)
    Path("data/catalog.json").write_text(json.dumps(out, indent=2))


if __name__ == "__main__":
    sys.exit(main())
