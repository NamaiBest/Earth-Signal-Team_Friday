# Challenge evaluation (13 Nov 2026)

## Official challenge: *Be an Earth System Trend Detective!*
Advanced · Earth Science, Software. Build a tool that:
1. selects variables measured by Earth science missions or produced by models
2. visualizes how they change over time
3. determines what is changing, where, and how much
4. determines whether the changes are what scientists call "significant"

The statement also notes a variable can trend one way in one region and the opposite way in another, even under the same process.

**Still to read:** the Details / Resources tabs on the official page (objectives, considerations, official datasets). Paste them into this file and re-check the plan.

## Fit of our plan
All four asks covered (ranked variables, map + time series, Sen's slope per cell / district, seasonal Mann-Kendall + FDR). Opposite-direction case covered (NO₂ India vs China/EU; groundwater ↓ while greening ↑ in NW India).

## Competition
10+ public GitHub repos target this challenge. The strongest, [entitySource/trend_detective](https://github.com/entitySource/trend_detective), already has 15 NASA variables (2003–2025, 5 seasons), variance-corrected Mann-Kendall + FDR, a Monte Carlo false-alarm check, validation against NSIDC/GISTEMP, and 13 written "case files" including Delhi and the Indo-Gangetic Plain. **A significance map alone will not stand out.**

## Our differentiation
1. **Place-first**: pick a district → case file (Clues, Pattern, Alibis, Suspects, Associations).
2. **India policy unit**: state / district / sub-district.
3. **Suspects layer**: real emission sources near hotspots (association, not attribution).
4. **What's next**: NASA GEOS-CF 5-day forecast + wind.

## Detective framing: what to avoid
- No own forecasting: use NASA GEOS-CF, label it.
- No "this factory caused this": satellites can't attribute one-to-one.
- No CFC per factory: not observable from space.

## Rules (from local-event kits; confirm in the official 2026 Project Submission Guide)
- Deadline Sun 15 Nov 23:59 local; submit on team page → Project tab
- Demo: video ≤ 30 s or ≤ 7 slides, English, public links
- AI use declared; no NASA logos
- Code open source → **repo must be public by submission**
- Some events require project code to start at the event: ask the Local Lead
