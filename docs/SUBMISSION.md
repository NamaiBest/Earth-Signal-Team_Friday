# Space Apps 2026 submission text

## Summary

EarthSignal is a free website that shows how the environment is changing in every district of India. It uses 25 years of NASA satellite data on air pollution, fires, greenery and temperature. It checks each change carefully, so you only see the ones that are real, not random ups and downs. Anyone can look up their own district and see what is getting worse, by how much, and what might be causing it.

Behind the map, every trend is tested before it is shown. A change counts only if it passes a Mann-Kendall test and survives a false-discovery-rate correction, and each one comes with its rate per decade and a 95% confidence interval. Of 134,399 tests, 12,741 looked significant but failed the correction, so they never appear as real.

Each district has a case file showing what is rising, how fast, how certain the result is, and which factories and power plants sit nearby. The Policy tab ranks the confirmed problems in any state or district and drafts an AI brief that cites its sources, so officials know where to act first. The Learn view helps students investigate their own area.

## Links

- Live app: https://earthsignal.vercel.app/
- Source code: https://github.com/NamaiBest/Earth-Signal-Team_Friday

## Credits

NASA OMI (OMNO2d, OMSO2e), MODIS (MOD11C3, MOD13C2), FIRMS, POWER (MERRA-2, CERES), Giovanni, GPM IMERG, GIBS, Scientific Visualization Studio. Climate TRACE (CC BY 4.0), geoBoundaries (ODbL), OpenFreeMap and OpenStreetMap (ODbL). Music in the demo video: "Dans le Noir" by SkySonik (CC BY 3.0).

## Use of AI

Claude (Anthropic) helped write code, the data pipeline, documentation, the submission text and the demo video. Google Gemini writes the optional policy brief inside the app, using only facts computed by the pipeline. The team chose the methods and checked results against NASA Giovanni. The demo uses no AI-generated images, video or voice.
