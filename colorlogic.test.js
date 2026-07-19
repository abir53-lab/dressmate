import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rgbToHsl, nameColor, suggest, dominantColor, pairScore, outfitScore, RULES, GARMENTS, SWATCHES } from './colorlogic.js';

test('rgbToHsl converts primaries correctly', () => {
  assert.equal(Math.round(rgbToHsl(255, 0, 0).h), 0);
  assert.equal(Math.round(rgbToHsl(0, 255, 0).h), 120);
  assert.equal(Math.round(rgbToHsl(0, 0, 255).h), 240);
  const white = rgbToHsl(255, 255, 255);
  assert.equal(white.l, 1);
});

test('nameColor identifies common garment colors', () => {
  assert.equal(nameColor(rgbToHsl(20, 20, 20)), 'black');
  assert.equal(nameColor(rgbToHsl(250, 250, 250)), 'white');
  assert.equal(nameColor(rgbToHsl(31, 45, 77)), 'navy');       // dark blue
  assert.equal(nameColor(rgbToHsl(168, 200, 232)), 'light blue');
  assert.equal(nameColor(rgbToHsl(176, 153, 95)), 'khaki');
  assert.equal(nameColor(rgbToHsl(110, 36, 52)), 'burgundy');
  assert.equal(nameColor(rgbToHsl(138, 138, 144)), 'gray');
  assert.equal(nameColor(rgbToHsl(107, 74, 47)), 'brown');
});

test('suggest returns recommendations for the other three garments', () => {
  const s = suggest('shirt', 'white');
  assert.deepEqual(Object.keys(s).sort(), ['jacket', 'pants', 'tie']);
  assert.ok(s.pants.includes('navy'));
  const p = suggest('pants', 'navy');
  assert.ok(p.shirt.includes('white'));
  assert.ok(!('pants' in p));
});

test('suggest falls back to neutrals for unknown colors', () => {
  const s = suggest('tie', 'nonexistent-color');
  assert.ok(s.shirt.includes('white'));
});

test('suggest rejects unknown garment', () => {
  assert.throws(() => suggest('hat', 'navy'));
});

test('every rule covers all four garments and uses known swatch colors', () => {
  for (const [color, rule] of Object.entries(RULES)) {
    for (const g of GARMENTS) {
      assert.ok(Array.isArray(rule[g]) && rule[g].length > 0, `${color}.${g} missing`);
      for (const c of rule[g]) {
        assert.ok(SWATCHES[c], `${color}.${g} suggests '${c}' with no swatch`);
      }
    }
  }
});

test('pairScore ranks classic combos above clashes', () => {
  const classic = pairScore('shirt', 'white', 'pants', 'navy');     // rule-listed
  const neutral = pairScore('shirt', 'gray', 'pants', 'black');     // two neutrals
  const clash = pairScore('shirt', 'red', 'pants', 'orange');       // near-hue clash
  assert.equal(classic, 95);
  assert.ok(neutral > clash, `${neutral} should beat ${clash}`);
  assert.ok(clash < 70);
  assert.ok(pairScore('shirt', 'red', 'pants', 'red') < 50, 'monochrome saturated look scores low');
  const comp = pairScore('jacket', 'blue', 'tie', 'orange');
  assert.ok(comp >= 70, 'complementary pair is acceptable');
});

test('outfitScore aggregates and gives verdicts', () => {
  assert.equal(outfitScore({ shirt: 'white' }), null, 'needs 2+ garments');
  const good = outfitScore({ shirt: 'white', pants: 'navy', jacket: 'gray' });
  assert.ok(good.score >= 88, `classic outfit scores high, got ${good.score}`);
  assert.equal(good.verdict, 'Excellent match');
  assert.equal(good.pairs, 3);
  const bad = outfitScore({ shirt: 'red', pants: 'orange' });
  assert.ok(bad.score < good.score);
  assert.ok(bad.verdict.length > 0);
});

test('dominantColor finds majority color and names it', () => {
  const navyPx = Array.from({ length: 80 }, () => [31, 45, 77]);
  const noisePx = Array.from({ length: 20 }, (_, i) => [200 + (i % 3), 10, 10]);
  const d = dominantColor([...navyPx, ...noisePx]);
  assert.equal(d.name, 'navy');
  assert.equal(dominantColor([]), null);
});
