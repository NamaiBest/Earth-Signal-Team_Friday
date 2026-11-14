#!/usr/bin/env bash
# Download the open (no-login) reference data into data/.
# NOAA GML global monthly gas means + Mauna Loa daily CO2, NOAA HATS CFCs,
# NSIDC Sea Ice Index v4 daily extent (Arctic + Antarctic).
# Usage: bash scripts/fetch_open_data.sh
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p data/noaa data/nsidc

for g in co2 ch4 n2o sf6; do
  curl -sSf -m 60 -o "data/noaa/${g}_mm_gl.txt" "https://gml.noaa.gov/webdata/ccgg/trends/${g}/${g}_mm_gl.txt"
  echo "ok  ${g}"
done
curl -sSf -m 60 -o data/noaa/co2_daily_mlo.txt https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_daily_mlo.txt && echo "ok  co2 daily MLO"
curl -sSf -m 60 -o data/noaa/HATS_global_F11.txt https://gml.noaa.gov/aftp/data/hats/cfcs/cfc11/combined/HATS_global_F11.txt && echo "ok  CFC-11"
curl -sSf -m 60 -o data/noaa/HATS_global_F12.txt https://gml.noaa.gov/aftp/data/hats/cfcs/cfc12/combined/HATS_global_F12.txt && echo "ok  CFC-12"

for h in north south; do
  H=$(echo "$h" | cut -c1 | tr a-z A-Z)
  curl -sSf -m 120 -o "data/nsidc/${H}_seaice_extent_daily_v4.0.csv" \
    "https://noaadata.apps.nsidc.org/NOAA/G02135/${h}/daily/data/${H}_seaice_extent_daily_v4.0.csv"
  echo "ok  sea ice ${h}"
done
