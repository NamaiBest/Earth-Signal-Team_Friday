# Demo video source

The 28-second demo video is a [HyperFrames](https://github.com/heygen-com/hyperframes) project: HTML and GSAP timelines rendered to MP4 at 1080p, 60 fps.

- `index.html`: root timeline (scenes, face-cam windows, voice, music, sound effects)
- `compositions/`: one file per scene (preface, title, satellite globe, assembly, variables, case file, policy, learn, end card, step cards, captions)
- `assets/app/`: screenshots of the live app used in the film
- `assets/fonts/`: DM Mono

Not committed (large, personal or third-party), add them under `assets/` to re-render:

| Path | What | Source |
|---|---|---|
| `assets/clips/` | Warming map, smoke and dust globe, South-East Asia fires, spinning Earth | NASA Scientific Visualization Studio, items 5603, 5572, 5226, 5570 (public domain) |
| `assets/music/` | "Dans le Noir" by SkySonik | Jamendo, CC BY 3.0 |
| `assets/vo/` | Voice-over and face cam | Team recording |
| `assets/img/` | Team photos | Team |
| `.media/audio/sfx/` | Sound effects | HyperFrames bundled library |

Render: `npx hyperframes render -o EarthSignal.mp4 --fps 60 --quality delivery`
