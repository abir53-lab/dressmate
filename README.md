# DressMate — Outfit Color Matcher

Point your camera at a garment (shirt, pants, jacket, or tie), and DressMate
detects its color and suggests matching colors for the other three garments,
using classic menswear pairing rules. Everything runs on-device — no backend,
no accounts, works offline once installed.

One codebase covers **Mac (web app)** and **iOS (installable home-screen app)**
as a PWA.

## Run on your Mac

```sh
cd ~/dressmate
npm start          # serves at http://localhost:8642
```

Open http://localhost:8642 in Safari or Chrome and allow camera access.

## Install on your iPhone

iOS Safari requires HTTPS for camera access, so put the folder on any static
host (GitHub Pages, Netlify, Cloudflare Pages — all free):

1. Open the HTTPS URL in Safari on your iPhone.
2. Tap **Share → Add to Home Screen**.
3. Launch from the home screen — it runs full-screen like a native app, with
   camera access and offline support.

(Alternately, on the same Wi-Fi you can reach your Mac's local server, but
camera access there needs HTTPS — the **Use photo** button still works.)

## How to use

1. Tap the garment type you're scanning (Shirt / Pants / Jacket / Tie).
2. Center the fabric in the dashed box and tap **Scan color** — or tap
   **Use photo** to pick an existing picture.
3. Read the suggested colors for the other three garments.

## Testing

```sh
npm test
```

- `colorlogic.test.js` — 7 unit tests for color conversion, naming,
  pairing rules, and dominant-color extraction (pure Node, no browser).
- `test-e2e.js` — 9 end-to-end tests driving the real UI in headless Chrome
  via the DevTools Protocol: page load, photo upload → navy detection →
  correct suggestions, garment switching, and a live fake-camera feed
  (khaki `.y4m` clip) → khaki detection. Starts its own server; needs
  Google Chrome or a cached Playwright Chromium.

## Files

- `index.html` — UI (single page, no framework)
- `app.js` — camera capture, photo upload, scan + render logic
- `colorlogic.js` — pure color math: RGB→HSL, color naming, pairing rules,
  dominant-color extraction
- `manifest.json`, `sw.js`, `icon-*.png` — PWA install + offline support
