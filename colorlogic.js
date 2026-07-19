// Pure color logic for DressMate — no DOM dependencies, unit-testable in Node.

export function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4;
    }
    h *= 60;
  }
  return { h, s, l };
}

// Map HSL to a menswear color family name.
export function nameColor({ h, s, l }) {
  if (l < 0.12) return 'black';
  if (l > 0.92 && s < 0.15) return 'white';
  if (s < 0.12) {
    if (l < 0.35) return 'charcoal';
    if (l < 0.65) return 'gray';
    return 'light gray';
  }
  // Low-saturation warm tones: beige / khaki / brown
  if (h >= 20 && h < 50 && s < 0.45) {
    if (l < 0.35) return 'brown';
    if (l < 0.55) return 'khaki';
    return 'beige';
  }
  if (h < 15 || h >= 345) return l < 0.3 ? 'burgundy' : 'red';
  if (h < 40) return l < 0.3 ? 'brown' : 'orange';
  if (h < 65) return 'yellow';
  if (h < 90) return 'olive';
  if (h < 160) return l < 0.25 ? 'forest green' : 'green';
  if (h < 200) return 'teal';
  if (h < 250) {
    if (l < 0.3) return 'navy';
    if (l > 0.65) return 'light blue';
    return 'blue';
  }
  if (h < 290) return 'purple';
  if (h < 345) return l > 0.6 ? 'pink' : 'magenta';
  return 'red';
}

// Menswear pairing rules: for a garment of a given color, what colors work
// for each of the other garment types.
export const RULES = {
  'black':        { shirt: ['white', 'light gray', 'light blue'], pants: ['charcoal', 'gray', 'black'], jacket: ['black', 'charcoal'], tie: ['silver', 'burgundy', 'black'] },
  'white':        { shirt: ['light blue', 'navy', 'black'], pants: ['navy', 'khaki', 'gray'], jacket: ['navy', 'gray', 'camel'], tie: ['navy', 'burgundy', 'red'] },
  'charcoal':     { shirt: ['white', 'light blue', 'pink'], pants: ['charcoal', 'gray'], jacket: ['charcoal', 'navy'], tie: ['burgundy', 'silver', 'blue'] },
  'gray':         { shirt: ['white', 'light blue', 'pink'], pants: ['navy', 'charcoal', 'black'], jacket: ['navy', 'charcoal'], tie: ['burgundy', 'navy', 'green'] },
  'light gray':   { shirt: ['white', 'navy', 'blue'], pants: ['navy', 'charcoal'], jacket: ['navy', 'blue'], tie: ['navy', 'burgundy', 'pink'] },
  'navy':         { shirt: ['white', 'light blue', 'pink'], pants: ['khaki', 'gray', 'white'], jacket: ['gray', 'camel'], tie: ['burgundy', 'red', 'silver'] },
  'blue':         { shirt: ['white', 'light blue'], pants: ['khaki', 'gray', 'navy'], jacket: ['navy', 'gray'], tie: ['navy', 'burgundy', 'orange'] },
  'light blue':   { shirt: ['white'], pants: ['navy', 'khaki', 'gray'], jacket: ['navy', 'gray'], tie: ['navy', 'burgundy', 'brown'] },
  'khaki':        { shirt: ['white', 'light blue', 'navy'], pants: ['navy', 'olive', 'brown'], jacket: ['navy', 'brown'], tie: ['navy', 'green', 'burgundy'] },
  'beige':        { shirt: ['white', 'light blue', 'navy'], pants: ['navy', 'brown', 'olive'], jacket: ['navy', 'brown'], tie: ['navy', 'brown', 'green'] },
  'brown':        { shirt: ['white', 'light blue', 'beige'], pants: ['khaki', 'navy', 'olive'], jacket: ['navy', 'olive'], tie: ['navy', 'green', 'burgundy'] },
  'olive':        { shirt: ['white', 'beige', 'light blue'], pants: ['khaki', 'brown', 'navy'], jacket: ['brown', 'navy'], tie: ['brown', 'burgundy', 'navy'] },
  'green':        { shirt: ['white', 'beige'], pants: ['khaki', 'navy', 'gray'], jacket: ['navy', 'gray'], tie: ['navy', 'brown', 'gold'] },
  'forest green': { shirt: ['white', 'light blue'], pants: ['khaki', 'gray', 'navy'], jacket: ['navy', 'gray'], tie: ['gold', 'burgundy', 'navy'] },
  'teal':         { shirt: ['white', 'light gray'], pants: ['navy', 'gray', 'khaki'], jacket: ['navy', 'gray'], tie: ['navy', 'orange', 'gray'] },
  'burgundy':     { shirt: ['white', 'light blue', 'gray'], pants: ['navy', 'gray', 'khaki'], jacket: ['navy', 'gray'], tie: ['navy', 'gold', 'gray'] },
  'red':          { shirt: ['white', 'light blue'], pants: ['navy', 'gray', 'khaki'], jacket: ['navy', 'gray'], tie: ['navy', 'silver'] },
  'orange':       { shirt: ['white', 'light blue'], pants: ['navy', 'olive', 'gray'], jacket: ['navy', 'brown'], tie: ['navy', 'brown'] },
  'yellow':       { shirt: ['white', 'light blue'], pants: ['navy', 'gray', 'olive'], jacket: ['navy', 'gray'], tie: ['navy', 'purple'] },
  'purple':       { shirt: ['white', 'light gray'], pants: ['gray', 'charcoal', 'navy'], jacket: ['charcoal', 'navy'], tie: ['silver', 'gold', 'navy'] },
  'pink':         { shirt: ['white'], pants: ['navy', 'gray', 'khaki'], jacket: ['navy', 'gray'], tie: ['navy', 'burgundy', 'gray'] },
  'magenta':      { shirt: ['white', 'light gray'], pants: ['gray', 'charcoal', 'navy'], jacket: ['charcoal', 'navy'], tie: ['navy', 'silver'] },
};

const NEUTRAL_FALLBACK = { shirt: ['white', 'light blue'], pants: ['navy', 'gray', 'khaki'], jacket: ['navy', 'gray'], tie: ['navy', 'burgundy'] };

export const GARMENTS = ['shirt', 'pants', 'jacket', 'tie'];

// Given detected color of one garment, suggest colors for the other garments.
export function suggest(garment, colorName) {
  if (!GARMENTS.includes(garment)) throw new Error(`unknown garment: ${garment}`);
  const rule = RULES[colorName] || NEUTRAL_FALLBACK;
  const out = {};
  for (const g of GARMENTS) {
    if (g !== garment) out[g] = rule[g];
  }
  return out;
}

// Dominant color from an array of [r,g,b] pixels: quantize into coarse
// buckets, pick the most populous bucket, average its members.
export function dominantColor(pixels) {
  if (!pixels.length) return null;
  const buckets = new Map();
  for (const [r, g, b] of pixels) {
    const key = `${r >> 5},${g >> 5},${b >> 5}`;
    let bkt = buckets.get(key);
    if (!bkt) { bkt = { n: 0, r: 0, g: 0, b: 0 }; buckets.set(key, bkt); }
    bkt.n++; bkt.r += r; bkt.g += g; bkt.b += b;
  }
  let best = null;
  for (const bkt of buckets.values()) if (!best || bkt.n > best.n) best = bkt;
  const r = Math.round(best.r / best.n), g = Math.round(best.g / best.n), b = Math.round(best.b / best.n);
  return { r, g, b, name: nameColor(rgbToHsl(r, g, b)) };
}

// Colors that pair with nearly everything.
const NEUTRALS = new Set(['white', 'black', 'gray', 'light gray', 'charcoal', 'navy', 'khaki', 'beige']);

function hueOf(name) {
  const hex = SWATCHES[name];
  if (!hex) return null;
  const { h, s } = rgbToHsl(parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16));
  return s < 0.12 ? null : h; // achromatic colors have no meaningful hue
}

// Harmony score (0-100) for two garments' colors.
export function pairScore(gA, cA, gB, cB) {
  const listed = (RULES[cA]?.[gB] || []).includes(cB) || (RULES[cB]?.[gA] || []).includes(cA);
  if (listed) return 95;
  const nA = NEUTRALS.has(cA), nB = NEUTRALS.has(cB);
  if (nA && nB) return 85;
  if (nA || nB) return 75;
  if (cA === cB) return 45; // same saturated color head to toe
  const hA = hueOf(cA), hB = hueOf(cB);
  if (hA == null || hB == null) return 70;
  const d = Math.min(Math.abs(hA - hB), 360 - Math.abs(hA - hB));
  if (d < 25) return 60;              // analogous — workable
  if (d >= 150) return 72;            // complementary — bold but valid
  if (d < 70) return 55;              // near-clash
  return 48;                          // awkward middle distance
}

// Score a whole outfit: { shirt: 'white', pants: 'navy', ... } with >=2 entries.
export function outfitScore(outfit) {
  const entries = Object.entries(outfit).filter(([, c]) => c);
  if (entries.length < 2) return null;
  let total = 0, n = 0, worst = 100;
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const s = pairScore(entries[i][0], entries[i][1], entries[j][0], entries[j][1]);
      total += s; n++;
      if (s < worst) worst = s;
    }
  }
  const score = Math.round(total / n - (100 - worst) * 0.15); // one bad pair drags the look
  const verdict = score >= 88 ? 'Excellent match' : score >= 75 ? 'Works well' :
                  score >= 60 ? 'Playable — one swap would help' : 'Clashing — rethink a piece';
  return { score: Math.max(0, score), verdict, pairs: n };
}

// Display swatch hex for each named color (for rendering suggestions).
export const SWATCHES = {
  black: '#1a1a1a', white: '#f8f8f6', charcoal: '#3b3b40', gray: '#8a8a90', 'light gray': '#c9c9cf',
  navy: '#1f2d4d', blue: '#2f5da8', 'light blue': '#a8c8e8', teal: '#2a7f7f',
  khaki: '#b0995f', beige: '#d9c7a7', brown: '#6b4a2f', camel: '#b98d54', olive: '#6b6b3a',
  green: '#3e7a4d', 'forest green': '#24462e', burgundy: '#6e2434', red: '#c0392b', orange: '#d2691e',
  yellow: '#d4b13e', gold: '#c9a227', purple: '#5e3a87', pink: '#e8a8bb', magenta: '#b03080', silver: '#bfc4cc',
};
