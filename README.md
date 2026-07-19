# DressMate — Outfit Color Matcher

Point your camera at a garment and DressMate detects its color live, suggests
matching colors for the rest of your outfit, and — with **auto-snap** — builds
your whole outfit hands-free: hold steady ~3s on each garment and it captures
the color, advances to the next garment, and finishes with a **match score
out of 100**. Everything runs on-device: no backend, no accounts, works
offline once installed.

**Live app:** https://abir53-lab.github.io/dressmate/

One codebase covers **Mac (web)** and **iPhone (Add to Home Screen in Safari)**
as a PWA. On iPhone it runs full-screen with camera access and offline support.

## Features

- **Live auto-detection** — samples the reticle every 400ms; panel updates
  after 3 stable readings, auto-snap captures after 7 (~2.8s)
- **Auto-snap hands-free flow** (⚡ toggle) — captures each garment and
  advances shirt → pants → jacket → tie, ending locked with a score
- **Match score** — pairwise color-harmony rating with verdict, from menswear
  pairing rules + hue-distance analysis
- **Outfit builder** — lock colors into 4 slots; tap a slot to clear
- **Saved looks** — up to 8 in localStorage, with date and score
- **Share** — iOS share sheet / clipboard fallback
- **Camera flip** (front/back; shown only when 2+ cameras) with mirrored selfie preview
- **Photo mode** — scan any picture instead of the live camera

## Design

Editorial ink/bone/vermilion theme. Type: **Fraunces** (italic display serif)
+ **Space Grotesk** (labels/body), self-hosted in `fonts/` under the SIL Open
Font License (see `fonts/OFL-*.txt`).

## Run locally

```sh
npm start        # http://localhost:8642
npm test         # 9 unit tests + 24 e2e tests
```

E2E tests drive the real UI in headless Chrome over the DevTools Protocol,
feeding a khaki `.y4m` file as a fake camera — including a zero-click test at
iPhone 13 Pro Max viewport that verifies the full hands-free flow. Note:
`--disable-gpu` breaks fake-camera frame delivery; the test runner omits it.

## Deploying updates

Push to `main` — GitHub Pages redeploys automatically. The service worker is
network-first, so installed apps pick up new files on next launch (bump the
cache version in `sw.js` per release).

## Roadmap (agreed, not yet built)

1. Lighting compensation + "too dark" hint (biggest real-world accuracy gap)
2. Undo button on the auto-snap toast
3. First-run coach marks explaining auto-snap
4. Score explanation ("weakest pair: tie × pants")
5. Landscape phone layout
