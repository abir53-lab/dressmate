import { dominantColor, suggest, outfitScore, SWATCHES } from './colorlogic.js';

const video = document.getElementById('video');
const photo = document.getElementById('photo');
const canvas = document.getElementById('canvas');
const err = document.getElementById('err');
const result = document.getElementById('result');
const placeholder = document.getElementById('placeholder');
const statusEl = document.getElementById('status');
const statusText = document.getElementById('statusText');
const scanLabel = document.getElementById('scanLabel');

let garment = 'shirt';
let usingPhoto = false;
let locked = false;
let committedName = null;   // color currently shown in the panel
let recentNames = [];       // stability window for auto-detection
const STABLE_N = 3;         // consecutive identical readings required
const TICK_MS = 400;

// --- UI helpers ---------------------------------------------------------

function showError(msg) {
  err.textContent = msg;
  err.style.display = msg ? 'block' : 'none';
}

function setStatus(mode) {
  statusEl.className = `status ${mode}`;
  statusText.textContent = mode === 'live' ? 'Live' : mode === 'locked' ? 'Locked' : 'Photo';
  scanLabel.textContent = usingPhoto ? 'Scan photo' : locked ? 'Resume live' : 'Lock color';
}

document.getElementById('garments').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-g]');
  if (!btn) return;
  garment = btn.dataset.g;
  document.querySelectorAll('#garments button').forEach((b) => b.classList.toggle('active', b === btn));
  document.getElementById('detGarment').textContent = garment;
  if (committedName) renderSuggestions(committedName); // re-pair for the new garment
  if (locked && !usingPhoto) { // moving to a new garment: resume live scanning
    locked = false;
    recentNames = [];
    setStatus('live');
  }
});

// --- Outfit builder -----------------------------------------------------

const outfit = { shirt: null, pants: null, jacket: null, tie: null };
const LOOKS_KEY = 'dressmate-looks';

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(showToast._tid);
  showToast._tid = setTimeout(() => t.classList.remove('show'), 2600);
}

function renderOutfit() {
  for (const [g, c] of Object.entries(outfit)) {
    const slot = document.querySelector(`.slot[data-slot="${g}"]`);
    const well = slot.querySelector('.well');
    slot.classList.toggle('filled', !!c);
    well.style.background = c ? c.css : 'transparent';
    slot.setAttribute('aria-label', c ? `${g} slot: ${c.name}. Tap to clear.` : `${g} slot, empty`);
    slot.querySelector('.cname').textContent = c ? c.name : g;
  }
  const names = Object.fromEntries(Object.entries(outfit).map(([g, c]) => [g, c?.name]));
  const rating = outfitScore(names);
  const badge = document.getElementById('scoreBadge');
  if (rating) {
    badge.hidden = false;
    document.getElementById('scoreNum').textContent = rating.score;
    document.getElementById('scoreVerdict').textContent = rating.verdict;
  } else {
    badge.hidden = true;
  }
  const filled = Object.values(outfit).filter(Boolean).length;
  document.getElementById('saveBtn').disabled = filled < 2;
  document.getElementById('shareBtn').disabled = filled < 2;
  document.getElementById('outfitHint').hidden = filled > 0;
}

function assignToOutfit(color) {
  outfit[garment] = { name: color.name, css: `rgb(${color.r},${color.g},${color.b})` };
  renderOutfit();
}

document.getElementById('slots').addEventListener('click', (e) => {
  const slot = e.target.closest('.slot');
  if (!slot || !outfit[slot.dataset.slot]) return;
  outfit[slot.dataset.slot] = null;
  renderOutfit();
});

function outfitText() {
  const parts = Object.entries(outfit).filter(([, c]) => c).map(([g, c]) => `${c.name} ${g}`);
  const names = Object.fromEntries(Object.entries(outfit).map(([g, c]) => [g, c?.name]));
  const rating = outfitScore(names);
  return `My DressMate look: ${parts.join(' + ')}${rating ? ` — ${rating.score}/100, ${rating.verdict.toLowerCase()}` : ''}`;
}

function loadLooks() {
  try { return JSON.parse(localStorage.getItem(LOOKS_KEY)) || []; } catch { return []; }
}

function renderLooks() {
  const wrap = document.getElementById('looks');
  wrap.innerHTML = '';
  for (const look of loadLooks()) {
    const row = document.createElement('div');
    row.className = 'look';
    for (const c of Object.values(look.outfit)) {
      if (!c) continue;
      const mini = document.createElement('span');
      mini.className = 'mini';
      mini.style.background = c.css;
      mini.title = c.name;
      row.appendChild(mini);
    }
    const date = document.createElement('span');
    date.textContent = new Date(look.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const score = document.createElement('span');
    score.className = 'lscore';
    score.textContent = look.score != null ? look.score : '';
    const del = document.createElement('button');
    del.className = 'del';
    del.setAttribute('aria-label', 'Delete this look');
    del.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6 L18 18 M18 6 L6 18"/></svg>';
    del.addEventListener('click', () => {
      const looks = loadLooks().filter((l) => l.at !== look.at);
      localStorage.setItem(LOOKS_KEY, JSON.stringify(looks));
      renderLooks();
    });
    row.append(date, score, del);
    wrap.appendChild(row);
  }
}

document.getElementById('saveBtn').addEventListener('click', () => {
  const names = Object.fromEntries(Object.entries(outfit).map(([g, c]) => [g, c?.name]));
  const rating = outfitScore(names);
  const looks = loadLooks();
  looks.unshift({ at: Date.now(), outfit: { ...outfit }, score: rating?.score ?? null });
  localStorage.setItem(LOOKS_KEY, JSON.stringify(looks.slice(0, 8)));
  renderLooks();
  showToast('Look saved');
});

document.getElementById('shareBtn').addEventListener('click', async () => {
  const text = outfitText();
  try {
    if (navigator.share) {
      await navigator.share({ text });
    } else {
      await navigator.clipboard.writeText(text);
      showToast('Copied to clipboard');
    }
  } catch (e) {
    if (e.name !== 'AbortError') {
      try { await navigator.clipboard.writeText(text); showToast('Copied to clipboard'); }
      catch { showToast(text); }
    }
  }
});

// --- Camera -------------------------------------------------------------

async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    showError('Camera not available here — use "Use photo" instead. (Camera needs HTTPS or localhost.)');
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 } }, audio: false,
    });
    video.srcObject = stream;
    video.play().catch(() => {});
    usingPhoto = false;
    photo.hidden = true; video.hidden = false;
    setStatus('live');
  } catch {
    showError('Camera blocked or unavailable — use "Use photo" instead.');
  }
}

// --- Sampling -----------------------------------------------------------

function samplePixels() {
  const src = usingPhoto ? photo : video;
  const w = usingPhoto ? photo.naturalWidth : video.videoWidth;
  const h = usingPhoto ? photo.naturalHeight : video.videoHeight;
  if (!w || !h) return null;
  const box = Math.round(Math.min(w, h) * 0.22);
  canvas.width = box; canvas.height = box;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(src, (w - box) / 2, (h - box) / 2, box, box, 0, 0, box, box);
  const data = ctx.getImageData(0, 0, box, box).data;
  const pixels = [];
  for (let i = 0; i < data.length; i += 16) {
    pixels.push([data[i], data[i + 1], data[i + 2]]);
  }
  return pixels;
}

function readColor() {
  const pixels = samplePixels();
  return pixels ? dominantColor(pixels) : null;
}

// --- Rendering ----------------------------------------------------------

function renderDetected(color) {
  committedName = color.name;
  const css = `rgb(${color.r},${color.g},${color.b})`;
  document.getElementById('chip').style.background = css;
  document.getElementById('detName').textContent = color.name;
  document.getElementById('detGarment').textContent = garment;
  renderSuggestions(color.name);
  result.style.display = 'block';
  placeholder.style.display = 'none';
}

function renderSuggestions(colorName) {
  const sugs = suggest(garment, colorName);
  const wrap = document.getElementById('suggestions');
  wrap.innerHTML = '';
  for (const [g, colors] of Object.entries(sugs)) {
    const div = document.createElement('div');
    div.className = 'sug';
    const h3 = document.createElement('h3');
    h3.textContent = `${g} to pair`;
    const row = document.createElement('div');
    row.className = 'swatches';
    for (const c of colors) {
      const sw = document.createElement('div');
      sw.className = 'swatch';
      const box = document.createElement('div');
      box.className = 'box';
      box.style.background = SWATCHES[c] || '#888';
      const lbl = document.createElement('div');
      lbl.textContent = c;
      sw.append(box, lbl);
      row.appendChild(sw);
    }
    div.append(h3, row);
    wrap.appendChild(div);
  }
}

// --- Auto-detection loop ------------------------------------------------

function tick() {
  if (usingPhoto || locked || document.hidden) return;
  const color = readColor();
  if (!color) return;
  // Always show the instantaneous reading in the on-camera chip
  document.getElementById('liveSwatch').style.background = `rgb(${color.r},${color.g},${color.b})`;
  document.getElementById('liveName').textContent = color.name;
  // Commit to the suggestions panel only when the reading is stable
  recentNames.push(color.name);
  if (recentNames.length > STABLE_N) recentNames.shift();
  const stable = recentNames.length === STABLE_N && recentNames.every((n) => n === recentNames[0]);
  if (stable && color.name !== committedName) renderDetected(color);
}
setInterval(tick, TICK_MS);

// --- Controls -----------------------------------------------------------

document.getElementById('scanBtn').addEventListener('click', () => {
  showError('');
  if (usingPhoto) {
    const color = readColor();
    if (color) { renderDetected(color); assignToOutfit(color); }
    else showError('Photo not ready yet — try again.');
    return;
  }
  if (locked) {
    locked = false;
    recentNames = [];
    setStatus('live');
  } else {
    const color = readColor();
    if (!color) { showError('No camera image yet — allow camera access or load a photo.'); return; }
    renderDetected(color);
    assignToOutfit(color);
    locked = true;
    setStatus('locked');
  }
});

document.getElementById('fileInput').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  photo.src = URL.createObjectURL(file);
  photo.onload = () => {
    usingPhoto = true;
    video.hidden = true; photo.hidden = false;
    showError('');
    setStatus('photo');
    const color = readColor(); // photos are static: sample immediately
    if (color) renderDetected(color);
  };
});

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
renderLooks();
startCamera();
