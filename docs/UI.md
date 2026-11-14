# EarthSignal: UI brief

> **Updated 13 Nov.** The app is now a MapLibre globe that zooms from planet to district to factory pins (see `PLAN.md` §10 and `STACK.md`). The scroll-craft "live surface" approach below is kept for the **intro / pitch page** and for the signature "watch the noise disappear" moment.

Method from [nateherkai/scroll-craft](https://github.com/nateherkai/scroll-craft) (MIT): its engine (`scrollcraft.js` / `.css`) reads `data-sc-*` attributes off our own HTML and drives them from one scroll value; copy it in unedited and theme with tokens.

## Grammar: Live surface

scroll-craft offers eight page grammars. We use **Live surface**: *the page behaves like the product, and scroll drives its state.*

| Grammar | Why not |
|---|---|
| Filmic one-shot | Built for consumer launches; needs scrub video; turns our data into decoration |
| Chaptered editorial | Good for a written story, but bans the tool feel; fallback for a pitch microsite |
| Continuous world / Rhythmic cutlist / Typographic poster / Gallery / Split stage | Marketing structures; none lets the visitor operate the analysis |

Live surface **bans** scrub video, kinetic headlines and scrims, so no ffmpeg, no AI image generation, no photography. Its honesty rule matches ours: every panel computes from real data or clearly labelled sample data.

## Signature move: scroll applies the statistics

The visitor scrolls and watches the method happen to the map: raw trend → seasons removed → each cell tested → corrected for chance. At the correction step the scattered "change" fades and only the real signal stays lit.

## Journey and feeling curve

| # | Beat | Feeling | On screen |
|---|---|---|---|
| 1 | Recognition | "The planet is changing" | Raw trend map, everything coloured |
| 2 | Doubt | "Some of that is just summer" | Seasonal bands vanish |
| 3 | Tension | "Many cells pass… but ~32 would by luck" | Cells fade by p-value; status bar counts |
| 4 | **Peak** | "*That* is the signal" | FDR correction: false positives drop out |
| 5 | Proof | "It works on real data" | Arctic passes; Antarctic looks like a fall but doesn't |
| 6 | Commitment | "Let me try my district" | Real input: place + variable → "Investigate" |

## Visual rules

- Significance = **opacity**; direction = **blue ↔ orange** (colourblind-safe, never red/green).
- Every number shows source, period and resolution; every verdict shows its p/q value.
- Dark "instrument" look, IBM Plex Sans + Plex Mono; panels stack at phone width.
- No "scroll" cue, no `01 / 06` counters, no gradient text, no em dashes in visible copy.
- Only real numbers in counters; sample data labelled on screen.

## Mockups

`design/mockups/Trends.dc.html` and `Live.dc.html` (Claude design-canvas format; also on the "EarthSignal UI" canvas). The Trends mockup computes a real Benjamini-Hochberg correction on labelled sample data.

## Open questions

1. Vibe: "calm, exact, scientific instrument"?
2. Peak for judges: "watch fake trends disappear" or "district case file"?
3. Phone: real target, or desktop-first with stacked layout?
