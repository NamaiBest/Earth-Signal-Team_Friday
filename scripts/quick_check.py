#!/usr/bin/env python3
"""First sanity check of the trend method on data already in data/ (stdlib only).

Mann-Kendall test (normal approximation, no tie correction) + Sen's slope on:
  - Arctic September & Antarctic February mean sea-ice extent (NSIDC Sea Ice Index v4)
  - NOAA global monthly means of CO2, CH4, N2O, SF6 (annual means)
Usage: python3 scripts/quick_check.py
"""
import csv, math, statistics
from collections import defaultdict


def mann_kendall(y):
    n = len(y)
    s = sum((y[j] > y[i]) - (y[j] < y[i]) for i in range(n) for j in range(i + 1, n))
    var = n * (n - 1) * (2 * n + 5) / 18
    z = 0 if s == 0 else (s - math.copysign(1, s)) / math.sqrt(var)
    p = math.erfc(abs(z) / math.sqrt(2))
    return z, p


def sen_slope(x, y):
    return statistics.median((y[j] - y[i]) / (x[j] - x[i]) for i in range(len(x)) for j in range(i + 1, len(x)) if x[j] != x[i])


def seaice(path, month, label):
    by = defaultdict(list)
    with open(path) as f:
        for row in csv.reader(f):
            try:
                yr, mo, ext = int(row[0]), int(row[1]), float(row[3])
            except (ValueError, IndexError):
                continue
            if mo == month and 1979 <= yr <= 2025 and ext > 0:
                by[yr].append(ext)
    yrs = sorted(by)
    vals = [statistics.mean(by[y]) for y in yrs]
    z, p = mann_kendall(vals)
    print(f"{label:34s} {yrs[0]}-{yrs[-1]}  Sen slope {sen_slope(yrs, vals)*10:+.3f} M km2/decade  z={z:+.2f}  p={p:.1e}")


def noaa(gas, unit):
    by = defaultdict(list)
    for line in open(f"data/noaa/{gas}_mm_gl.txt"):
        if line.startswith("#") or not line.strip():
            continue
        c = line.split()
        yr, val = int(c[0]), float(c[3])
        if val > 0:
            by[yr].append(val)
    yrs = [y for y in sorted(by) if len(by[y]) == 12]
    vals = [statistics.mean(by[y]) for y in yrs]
    z, p = mann_kendall(vals)
    print(f"{gas.upper()+' global mean':34s} {yrs[0]}-{yrs[-1]}  Sen slope {sen_slope(yrs, vals)*10:+.2f} {unit}/decade  z={z:+.2f}  p={p:.1e}")


if __name__ == "__main__":
    seaice("data/nsidc/N_seaice_extent_daily_v4.0.csv", 9, "Arctic sea ice, September")
    seaice("data/nsidc/S_seaice_extent_daily_v4.0.csv", 2, "Antarctic sea ice, February")
    for g, u in [("co2", "ppm"), ("ch4", "ppb"), ("n2o", "ppb"), ("sf6", "ppt")]:
        noaa(g, u)
