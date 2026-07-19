// End-to-end test: drives the app in headless Chrome over the DevTools Protocol.
// Starts its own static server if one isn't already on :8642. Usage: node test-e2e.js
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = path.dirname(fileURLToPath(import.meta.url));
let server = null;
try {
  await fetch('http://localhost:8642/index.html');
} catch {
  server = spawn('python3', ['-m', 'http.server', '8642'], { cwd: appDir, stdio: 'ignore' });
  for (let i = 0; i < 20; i++) {
    try { await fetch('http://localhost:8642/index.html'); break; }
    catch { await new Promise((r) => setTimeout(r, 300)); }
  }
}
process.on('exit', () => server?.kill());

const CANDIDATES = [
  `${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-mac-arm64/chrome-headless-shell`,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];
const CHROME = CANDIDATES.find((p) => fs.existsSync(p));
const PORT = 9223, APP = 'http://localhost:8642/';
const profile = fs.mkdtempSync('/tmp/dressmate-chrome-');

// Generate a solid-khaki YUV4MPEG2 clip to act as the fake camera feed,
// so the live-camera path can be asserted against a known color.
function makeY4m(path, y, u, v) {
  const W = 64, H = 64, frames = 90;
  const parts = [Buffer.from(`YUV4MPEG2 W${W} H${H} F30:1 Ip A1:1 C420\n`)];
  const yP = Buffer.alloc(W * H, y), uP = Buffer.alloc((W * H) / 4, u), vP = Buffer.alloc((W * H) / 4, v);
  for (let i = 0; i < frames; i++) parts.push(Buffer.from('FRAME\n'), yP, uP, vP);
  fs.writeFileSync(path, Buffer.concat(parts));
}
const y4m = `${profile}/khaki.y4m`;
makeY4m(y4m, 153, 95, 144); // khaki rgb(176,153,95) in YUV

const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
  `--use-file-for-fake-video-capture=${y4m}`,
  '--no-first-run', 'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getTarget() {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://localhost:${PORT}/json/list`);
      const targets = await res.json();
      const page = targets.find((t) => t.type === 'page');
      if (page) return page;
    } catch {}
    await sleep(300);
  }
  throw new Error('Chrome debug port never came up');
}

let msgId = 0;
const pending = new Map();
let ws;

function send(method, params = {}) {
  const id = ++msgId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evalJs(expression, awaitPromise = true) {
  const r = await send('Runtime.evaluate', { expression, awaitPromise, returnByValue: true });
  if (r.exceptionDetails) throw new Error('page error: ' + JSON.stringify(r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  return r.result.value;
}

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) failures++;
}

try {
  const target = await getTarget();
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    }
  };

  await send('Page.enable');
  await send('Browser.grantPermissions', { permissions: ['videoCapture'], origin: APP });
  await send('Page.navigate', { url: APP });
  for (let i = 0; i < 20; i++) {
    if (await evalJs('document.readyState', false) === 'complete') break;
    await sleep(250);
  }
  check('page loads', await evalJs('document.title', false) === 'DressMate — Outfit Color Matcher');

  // --- Photo path: inject a navy image as the uploaded file, scan, verify ---
  const photoResult = await evalJs(`(async () => {
    document.getElementById('autoBtn').click(); // auto-snap off for deterministic photo test
    const cv = document.createElement('canvas');
    cv.width = cv.height = 200;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = 'rgb(31,45,77)';
    ctx.fillRect(0, 0, 200, 200);
    const blob = await new Promise((r) => cv.toBlob(r, 'image/png'));
    const dt = new DataTransfer();
    dt.items.add(new File([blob], 'navy.png', { type: 'image/png' }));
    const input = document.getElementById('fileInput');
    input.files = dt.files;
    input.dispatchEvent(new Event('change'));
    const photo = document.getElementById('photo');
    for (let i = 0; i < 40 && photo.hidden; i++) await new Promise((r) => setTimeout(r, 100));
    document.querySelector('#garments button[data-g="pants"]').click();
    document.getElementById('scanBtn').click();
    return {
      name: document.getElementById('detName').textContent,
      garment: document.getElementById('detGarment').textContent,
      visible: document.getElementById('result').style.display === 'block',
      sections: [...document.querySelectorAll('.sug h3')].map((h) => h.textContent),
      shirtSwatches: [...document.querySelectorAll('.sug')].find((d) => d.querySelector('h3').textContent.startsWith('shirt'))
        ? [...[...document.querySelectorAll('.sug')].find((d) => d.querySelector('h3').textContent.startsWith('shirt')).querySelectorAll('.swatch div:last-child')].map((e) => e.textContent)
        : [],
    };
  })()`);
  check('photo upload detects navy', photoResult.name === 'navy', `got '${photoResult.name}'`);
  check('garment selector applied (pants)', photoResult.garment === 'pants');
  check('results panel shown', photoResult.visible);
  check('suggests the other 3 garments', photoResult.sections.length === 3 && !photoResult.sections.some((s) => s.startsWith('pants')), photoResult.sections.join(', '));
  check('navy pants suggest a white shirt', photoResult.shirtSwatches.includes('white'), photoResult.shirtSwatches.join(', '));

  // --- Camera path: fake device provides a synthetic video feed ---
  const camResult = await evalJs(`(async () => {
    const video = document.getElementById('video');
    for (let i = 0; i < 40 && !video.videoWidth; i++) await new Promise((r) => setTimeout(r, 100));
    if (!video.videoWidth) return { camera: false };
    // switch back from photo mode by reloading isn't needed; scan reads photo now,
    // so verify camera stream is live instead.
    return { camera: true, w: video.videoWidth, h: video.videoHeight };
  })()`);
  check('camera stream initializes (fake device)', camResult.camera === true, camResult.camera ? `${camResult.w}x${camResult.h}` : 'no stream');

  // --- Fresh page: scan directly from camera ---
  await send('Page.navigate', { url: APP });
  await sleep(1500);
  const camScan = await evalJs(`(async () => {
    const video = document.getElementById('video');
    for (let i = 0; i < 40 && !video.videoWidth; i++) await new Promise((r) => setTimeout(r, 100));
    if (!video.videoWidth) return { ok: false, why: 'no stream' };
    // Auto-detection: the panel should populate WITHOUT any click
    // (3 stable readings at 400ms intervals, so allow up to 6s).
    const det = document.getElementById('detName');
    for (let i = 0; i < 60 && det.textContent === '—'; i++) await new Promise((r) => setTimeout(r, 100));
    const autoName = det.textContent;
    const liveName = document.getElementById('liveName').textContent;
    // Lock: clicking the button freezes detection
    document.getElementById('scanBtn').click();
    const status = document.getElementById('statusText').textContent;
    return { ok: autoName !== '—' && autoName.length > 0, name: autoName, liveName, status };
  })()`);
  check('auto-detection fills panel without any click', camScan.ok, camScan.name || camScan.why);
  check('live camera detects khaki feed', ['khaki', 'beige', 'brown'].includes(camScan.name), `got '${camScan.name}'`);
  check('on-camera live chip shows reading', camScan.liveName === camScan.name, `chip: '${camScan.liveName}'`);
  check('lock button freezes detection', camScan.status === 'Locked', `status: '${camScan.status}'`);

  // --- Every remaining button: tabs, outfit slots, save/delete/share ---
  const buttons = await evalJs(`(async () => {
    const $ = (s) => document.querySelector(s);
    const out = {};
    // Deterministic setup: auto-snap off, shirt slot kept, other slots cleared
    out.autoWasOn = $('#autoBtn').classList.contains('active');
    $('#autoBtn').click();
    out.autoTogglesOff = !$('#autoBtn').classList.contains('active');
    for (const g of ['pants', 'jacket', 'tie']) {
      const s = $('.slot[data-slot="' + g + '"]');
      if (s.classList.contains('filled')) s.click();
    }
    if (!$('.slot[data-slot="shirt"]').classList.contains('filled')) {
      // ensure shirt is captured: select shirt and lock
      $('#garments button[data-g="shirt"]').click();
      $('#scanBtn').click();
    }
    // All four garment tabs activate
    out.tabs = [];
    for (const g of ['pants', 'jacket', 'tie', 'shirt']) {
      $('#garments button[data-g="' + g + '"]').click();
      out.tabs.push($('#garments button[data-g="' + g + '"]').classList.contains('active') &&
                    document.querySelectorAll('#garments button.active').length === 1);
    }
    // We're on shirt now; the earlier lock already filled the shirt slot
    out.shirtSlotFilled = $('.slot[data-slot="shirt"]').classList.contains('filled');
    // Lock a second garment: switching tabs auto-resumes live, then lock pants
    $('#garments button[data-g="pants"]').click();
    out.autoResumed = $('#statusText').textContent === 'Live';
    $('#scanBtn').click();
    out.pantsSlotFilled = $('.slot[data-slot="pants"]').classList.contains('filled');
    // Score badge appears once two slots are filled
    out.scoreShown = !$('#scoreBadge').hidden;
    out.scoreNum = parseInt($('#scoreNum').textContent, 10);
    out.verdict = $('#scoreVerdict').textContent;
    // Save the look
    $('#saveBtn').click();
    out.savedCount = JSON.parse(localStorage.getItem('dressmate-looks')).length;
    out.lookRowShown = document.querySelectorAll('.look').length === 1;
    // Share (clipboard fallback in headless)
    $('#shareBtn').click();
    await new Promise((r) => setTimeout(r, 300));
    // Delete the saved look
    $('.look .del').click();
    out.afterDelete = JSON.parse(localStorage.getItem('dressmate-looks')).length;
    // Tap a slot to clear it
    $('.slot[data-slot="pants"]').click();
    out.slotCleared = !$('.slot[data-slot="pants"]').classList.contains('filled');
    out.saveDisabledAgain = $('#saveBtn').disabled;
    return out;
  })()`);
  check('all 4 garment tabs activate exclusively', buttons.tabs.every(Boolean), buttons.tabs.join(','));
  check('lock filled the shirt outfit slot', buttons.shirtSlotFilled);
  check('switching garment auto-resumes live scan', buttons.autoResumed);
  check('locking second garment fills pants slot', buttons.pantsSlotFilled);
  check('match score badge appears with verdict', buttons.scoreShown && buttons.scoreNum > 0 && buttons.verdict.length > 0, `${buttons.scoreNum} — ${buttons.verdict}`);
  check('save look persists to localStorage + renders row', buttons.savedCount === 1 && buttons.lookRowShown);
  check('delete look removes it', buttons.afterDelete === 0);
  check('tapping a slot clears it and disables save', buttons.slotCleared && buttons.saveDisabledAgain);

  // --- Hands-free flow on iPhone-sized viewport: zero clicks, full outfit ---
  await send('Emulation.setDeviceMetricsOverride', { width: 428, height: 926, deviceScaleFactor: 2, mobile: true });
  await send('Page.navigate', { url: APP });
  await sleep(1500);
  const handsFree = await evalJs(`(async () => {
    const filled = () => document.querySelectorAll('.slot.filled').length;
    for (let i = 0; i < 300 && filled() < 4; i++) await new Promise((r) => setTimeout(r, 100));
    const chip = document.querySelector('.live-chip').getBoundingClientRect();
    return {
      slots: filled(),
      status: document.getElementById('statusText').textContent,
      scoreShown: !document.getElementById('scoreBadge').hidden,
      stripVisible: !document.getElementById('liveSugs').hidden,
      chipOnScreen: chip.bottom <= window.innerHeight && chip.top >= 0,
      flipExists: !!document.getElementById('flipBtn'),
      toolsExist: !!document.getElementById('autoBtn'),
    };
  })()`);
  check('hands-free auto-snap fills all 4 slots with zero clicks', handsFree.slots === 4, `${handsFree.slots}/4 slots`);
  check('outfit completes into Locked state with score', handsFree.status === 'Locked' && handsFree.scoreShown, `status: ${handsFree.status}`);
  check('on-camera suggestion strip visible without scrolling (iPhone size)', handsFree.stripVisible && handsFree.chipOnScreen);
  check('camera tools (auto-snap, flip) present', handsFree.toolsExist && handsFree.flipExists);

  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('/private/tmp/claude-501/-Users-abirtuli/c8bd506e-9116-40d8-b2d6-c6aa045a4bc2/scratchpad/dressmate-e2e.png', Buffer.from(shot.data, 'base64'));
  console.log(failures === 0 ? '\nALL E2E TESTS PASSED' : `\n${failures} E2E TEST(S) FAILED`);
} finally {
  chrome.kill();
  await new Promise((r) => { chrome.once('exit', r); setTimeout(r, 3000); });
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
}
process.exit(failures ? 1 : 0);
