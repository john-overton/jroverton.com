/*
 * Open Glades — pixel-art skiing scene.
 * Ported verbatim from the concept (DCLogic Component.runScene) to a framework-free module.
 * Exposes window.OG.scene.start(opts) -> { applyScene(hour01, mood) }.
 */
(function () {
  'use strict';

  // ---- colour helpers (were DCLogic methods) -------------------------------
  function hexToRgb(h) { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  function rgbToHex(r, g, b) { const c = v => ('0' + Math.max(0, Math.min(255, Math.round(v))).toString(16)).slice(-2); return '#' + c(r) + c(g) + c(b); }
  function lerpHex(a, b, t) { const A = hexToRgb(a), B = hexToRgb(b); return rgbToHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t); }
  function hexA(h, a) { const c = hexToRgb(h); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
  function adjustCol(hex, sat, litMul, litAdd, hueDeg) {
    let [r, g, b] = hexToRgb(hex); r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0, l = (mx + mn) / 2;
    if (mx !== mn) {
      const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      if (mx === r) h = (g - b) / d + (g < b ? 6 : 0); else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h /= 6;
    }
    h = (h + (hueDeg || 0) / 360 + 1) % 1; s = Math.max(0, Math.min(1, s * sat)); l = Math.max(0, Math.min(1, l * litMul + (litAdd || 0)));
    if (s === 0) { const v = Math.round(l * 255); return rgbToHex(v, v, v); }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    const hue = (t) => { t = (t + 1) % 1; if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < 1 / 2) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p; };
    return rgbToHex(hue(h + 1 / 3) * 255, hue(h) * 255, hue(h - 1 / 3) * 255);
  }
  function layerPal(snow, rock) {
    const A = (h, s, lm, la) => adjustCol(h, s, lm, la, 0);
    const grn = lerpHex('#2c5742', rock, 0.2);
    return {
      crest: A(snow, 1.05, 1.16, 0.03), crestSh: A(snow, 1, 0.84, 0),
      snowLit: snow, snowHi: A(snow, 1, 1.12, 0.03), snowSh: A(snow, 1, 0.86, 0), snowSh2: A(snow, 1, 0.75, 0),
      snowTop: A(snow, 1, 1.06, 0.02), snowBot: A(snow, 1, 0.64, 0), treeMark: A(snow, 0.88, 0.33, 0),
      tree: grn, treeHi: A(grn, 1.05, 1.28, 0), treeDk: A(grn, 1, 0.66, 0),
      rockLit: rock, rockHi: A(rock, 1, 1.16, 0), rockSh: A(rock, 1, 0.8, 0), rockDk: A(rock, 1, 0.5, 0)
    };
  }
  function presets() {
    return [
      { h: 3.0, c: { skyTop: '#0a1228', skyMid: '#16213f', skyHor: '#2a2f55', sun: '#cfd8ee', farSnow: '#5b6b86', farRock: '#3c4763', midSnow: '#6d80a0', midRock: '#2e3852', nearSnow: '#7d92b4', nearRock: '#222a3e', slopeHi: '#45506e', slopeBase: '#2f3852', slopeShade: '#232b41', particle: '#cdd8ef' }, n: { sunShow: 0.85, sunR: 4, sunX: 0.78, sunY: 0.12, vigTop: 0.5, vigBot: 0.58 } },
      { h: 5.5, c: { skyTop: '#2a2a52', skyMid: '#6b4f7a', skyHor: '#e6927e', sun: '#ffd9b0', farSnow: '#b9a7c0', farRock: '#7c6f86', midSnow: '#cdbcd0', midRock: '#6a6076', nearSnow: '#ddccd8', nearRock: '#4e4760', slopeHi: '#d8c6cf', slopeBase: '#b9a6b6', slopeShade: '#9a8aa0', particle: '#f3e6ea' }, n: { sunShow: 1, sunR: 12, sunX: 0.2, sunY: 0.2, vigTop: 0.34, vigBot: 0.42 } },
      { h: 9.0, c: { skyTop: '#2f5f9e', skyMid: '#5c92cf', skyHor: '#bcdcf2', sun: '#fff4d6', farSnow: '#c2d4e6', farRock: '#8fa0b8', midSnow: '#dbe8f4', midRock: '#6f8098', nearSnow: '#eef5fc', nearRock: '#4f5f78', slopeHi: '#eef5fc', slopeBase: '#d3e0ee', slopeShade: '#b3c4d8', particle: '#ffffff' }, n: { sunShow: 1, sunR: 6, sunX: 0.3, sunY: 0.14, vigTop: 0.24, vigBot: 0.34 } },
      { h: 12.5, c: { skyTop: '#1d6fc4', skyMid: '#3f93dd', skyHor: '#a9d6f5', sun: '#ffffff', farSnow: '#cbdcec', farRock: '#93a6bd', midSnow: '#e2eef8', midRock: '#71849c', nearSnow: '#f6fbff', nearRock: '#52627c', slopeHi: '#ffffff', slopeBase: '#dce8f4', slopeShade: '#bccfe2', particle: '#ffffff' }, n: { sunShow: 1, sunR: 5, sunX: 0.82, sunY: 0.1, vigTop: 0.2, vigBot: 0.3 } },
      { h: 18.5, c: { skyTop: '#2a3b66', skyMid: '#d98a4e', skyHor: '#f6c66a', sun: '#fff0c0', farSnow: '#d9c3a8', farRock: '#8f7e76', midSnow: '#ead3b4', midRock: '#6e5f63', nearSnow: '#f6e3c2', nearRock: '#4d4350', slopeHi: '#f7e6c4', slopeBase: '#e6cda6', slopeShade: '#c4a883', particle: '#fff1d8' }, n: { sunShow: 1, sunR: 13, sunX: 0.8, sunY: 0.16, vigTop: 0.3, vigBot: 0.45 } },
      { h: 20.5, c: { skyTop: '#1a2a45', skyMid: '#3d5a80', skyHor: '#ee8866', sun: '#ffd9a0', farSnow: '#b7c8db', farRock: '#93a4bb', midSnow: '#cfdcec', midRock: '#5f6e8a', nearSnow: '#ecf3fb', nearRock: '#3a4661', slopeHi: '#f2e8d6', slopeBase: '#ece1cd', slopeShade: '#c6b9a4', particle: '#ffffff' }, n: { sunShow: 1, sunR: 12, sunX: 0.8, sunY: 0.13, vigTop: 0.4, vigBot: 0.5 } },
      { h: 23.0, c: { skyTop: '#0a1228', skyMid: '#16213f', skyHor: '#2a2f55', sun: '#cfd8ee', farSnow: '#5b6b86', farRock: '#3c4763', midSnow: '#6d80a0', midRock: '#2e3852', nearSnow: '#7d92b4', nearRock: '#222a3e', slopeHi: '#45506e', slopeBase: '#2f3852', slopeShade: '#232b41', particle: '#cdd8ef' }, n: { sunShow: 0.85, sunR: 4, sunX: 0.78, sunY: 0.12, vigTop: 0.5, vigBot: 0.58 } }
    ];
  }
  function moodParams(m) {
    if (m === 'Vivid') return { sat: 1.3, lm: 1.03, la: 0, hue: 0 };
    if (m === 'Moody') return { sat: 0.78, lm: 0.82, la: -0.015, hue: -4 };
    if (m === 'Dreamy') return { sat: 0.84, lm: 1.07, la: 0.045, hue: 7 };
    return { sat: 1, lm: 1, la: 0, hue: 0 };
  }
  function computePalette(h01, mood) {
    const ps = presets(); let hour = Math.max(3, Math.min(23, h01 * 24));
    let i = 0; while (i < ps.length - 2 && hour > ps[i + 1].h) i++;
    const a = ps[i], b = ps[i + 1], t = Math.max(0, Math.min(1, (hour - a.h) / (b.h - a.h)));
    const mp = moodParams(mood); const PAL = {};
    for (const k in a.c) PAL[k] = adjustCol(lerpHex(a.c[k], b.c[k], t), mp.sat, mp.lm, mp.la, mp.hue);
    for (const k in a.n) PAL[k] = a.n[k] + (b.n[k] - a.n[k]) * t;
    return PAL;
  }

  // ---- the scene -----------------------------------------------------------
  function start(opts) {
    const cv = opts.canvas;
    const refs = { bubbleA: opts.bubbleA, bubbleB: opts.bubbleB, _pA: null, _pB: null, applyScene: null };
    let initHour = typeof opts.initialHour === 'number' ? opts.initialHour : 0.39583;
    let initMood = opts.initialMood || 'Serene';
    const DAY_LEN = typeof opts.dayLengthSec === 'number' ? opts.dayLengthSec : 120; // seconds per 24h
    const onHourChange = typeof opts.onHourChange === 'function' ? opts.onHourChange : null;
    if (!cv) return refs;
    const ctx = cv.getContext('2d');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const PIXEL = 2; const INTRO_END = 9.0;
    let W = 0, H = 0, E0 = 0, E1 = 0, HOR = 0, MU = 0, camX = 0, camSpeed = 0, START = 0, lastT = 0;
    let rg0, rg1, rg2, rg3, t0, t1, t2, t3;
    let layers = [];                  // baked mountain layers: immutable index map + recolorable buffer
    let trees = [], moguls = [], snow = [], streaks = [];
    let dayHour = ((initHour % 1) + 1) % 1;   // 0..1 across a 24h day; auto-advances
    let curMood = initMood;
    let bakedHour = -1, bakedMood = null, hourReportT = 0; // throttle mountain re-bake + UI sync
    let paused = false; // day/night cycle paused via the scene panel
    let PAL = computePalette(dayHour, curMood);

    const px = (x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x | 0, y | 0, w | 0, h | 0); };
    const dot = (x, y, col) => { ctx.fillStyle = col; ctx.fillRect(x | 0, y | 0, 1, 1); };
    const disc = (cx, cy, rad, col) => { rad = Math.round(rad); ctx.fillStyle = col; for (let yy = -rad; yy <= rad; yy++) { const sp = Math.round(Math.sqrt(Math.max(0, rad * rad - yy * yy))); ctx.fillRect(cx - sp, cy + yy, sp * 2 + 1, 1); } };
    const line = (x0, y0, x1, y1, col) => { x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0; let dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx - dy; ctx.fillStyle = col; while (true) { ctx.fillRect(x0, y0, 1, 1); if (x0 === x1 && y0 === y1) break; let e2 = 2 * err; if (e2 > -dy) { err -= dy; x0 += sx; } if (e2 < dx) { err += dx; y0 += sy; } } };
    const prand = (s) => { let v = (s >>> 0) || 1; return () => { v = (v * 1664525 + 1013904223) >>> 0; return v / 4294967296; }; };
    const lerp = (a, b, t) => lerpHex(a, b, t);
    const edge = (x) => E0 + (E1 - E0) * (x / W) + Math.sin(x / 30 + 0.6) * 2.0 + Math.sin(x / 13 + 2.0) * 1.0;
    const makeRidge = (base, amp, harm) => { const a = new Float32Array(W); for (let x = 0; x < W; x++) { let y = base; for (const h of harm) y += Math.sin((x / W) * Math.PI * 2 * h.f + h.p) * amp * h.a; a[x] = y; } return a; };

    // --- celestial bodies: sun + moon ride the same arc 12h apart, so one rises on
    // one side as the other sets on the opposite side. h is the body's local hour (0..24).
    const MOON_COL = '#e3e9f6', MOON_GLOW = '#aab6d8';
    const bodyAlt = (h) => Math.sin((h - 6) / 12 * Math.PI);          // >0 means above horizon (6h..18h)
    const bodyPos = (h) => {
      const alt = bodyAlt(h);
      const tx = Math.max(0, Math.min(1, (h - 6) / 12));             // 0 at the rising horizon, 1 at the setting one
      return { x: 0.12 + 0.76 * tx, y: 0.5 - alt * 0.42, alt: alt }; // arc: high at zenith, at horizon when alt~0
    };
    const lightPos = () => {
      const h = dayHour * 24;
      const s = bodyPos(h), m = bodyPos((h + 12) % 24);
      const ws = Math.max(0, s.alt) + 1e-4, wm = Math.max(0, m.alt) + 1e-4; // blend toward whichever is higher
      return { x: (s.x * ws + m.x * wm) / (ws + wm), y: (s.y * ws + m.y * wm) / (ws + wm) };
    };

    const KITA = { jacket: '#1f8a9c', jacketSh: '#156575', accent: '#2b3550', accentHi: '#3c4a6e', pants: '#2b3550', pantsHi: '#3c4a6e', boot: '#141a2c', glove: '#1b2236', helmet: '#e7eef4', helmetHi: '#ffffff', helmetSh: '#b7c5d3', skin: '#f0c9a0', skinSh: '#d8a87f', strap: '#161b29', lens: '#7fd0e0', lensHi: '#d8f4fb', trim: '#eef3f5', ski: '#ffce5c', skiEdge: '#c9972f', pole: '#cbb48a', basket: '#9c8a63' };
    const KITB = { jacket: '#ee6c4d', jacketSh: '#c2542a', accent: '#ffce5c', accentHi: '#ffe49a', pants: '#27314c', pantsHi: '#38456a', boot: '#141a2c', glove: '#2a1d18', helmet: '#2a3550', helmetHi: '#46557a', helmetSh: '#1c2438', skin: '#e8bd92', skinSh: '#cf9a6f', strap: '#161b29', lens: '#ffcf5c', lensHi: '#fff3c4', trim: '#fff1d8', ski: '#7fd0e0', skiEdge: '#3f8ea0', pole: '#cbb48a', basket: '#9c8a63' };

    const CHATS = ['Oh wow, tight squeeze!', 'We got this!', 'Woo hoo!', 'This is so much fun!', 'Watch that tree!', 'Drop in!', 'Powder day!', 'Stay with me!', 'Nice line!', 'Send it!', 'Easy does it...', 'Yeah! Shred it!', 'Almost there!', 'Follow my tracks!', 'Whoa—rock!', 'Keep your edges!', 'Let’s gooo!', 'Pizza! Pizza!', 'French fries!', 'That was sick!', 'Tree well—go left!', 'Catch me!', 'Smooth turns!', 'Knees bent!', 'Loser buys lunch!', 'Bluebird up here!', 'No fall zone!', 'Trust your skis!', 'Glade life!', 'Right behind you!'];
    const INTRO_A = 'Wow, this is an intimidating looking glade.';
    const INTRO_B = 'It’s ok, we will shred it together!';
    const D = { a: { msg: null, until: 0 }, b: { msg: null, until: 0 }, next: 11.5, last: '' };

    function resize() {
      const vw = window.innerWidth, vh = window.innerHeight;
      W = Math.ceil(vw / PIXEL); H = Math.ceil(vh / PIXEL);
      cv.width = W; cv.height = H; cv.style.width = (W * PIXEL) + 'px'; cv.style.height = (H * PIXEL) + 'px';
      ctx.imageSmoothingEnabled = false;
      MU = Math.max(64, Math.min(Math.round(W * 0.22), Math.round(H * 0.2)));
      HOR = Math.round(H * 0.58);
      E0 = HOR - Math.round(MU * 0.15); E1 = HOR + Math.round(MU * 0.6);
      buildGeometry(); rebakeRanges();
      bakedHour = dayHour; bakedMood = curMood;
      render(0, 0.016, reduceMotion ? 999 : 0.0);
    }
    function render(time, dt, T) {
      ctx.clearRect(0, 0, W, H);
      drawSky(); drawCelestial(time);
      drawTile(t0, camX * 0.06); drawTile(t1, camX * 0.12); drawTile(t2, camX * 0.22); drawTile(t3, camX * 0.40);
      drawSlope(); drawMoguls();
      const moving = T > INTRO_END;
      const A = steer(time, 'A', moving), B = steer(time, 'B', moving);
      refs._pA = { x: A.sx * PIXEL, y: (A.sy - 14) * PIXEL };
      refs._pB = { x: B.sx * PIXEL, y: (B.sy - 14) * PIXEL };
      stepSpray(dt); emitSpray(A); emitSpray(B);
      // Painter's ordering: sort trees + both skiers by their ground-contact Y so
      // each tree independently appears in front of or behind each skier — whichever
      // sprite's base sits lower on screen draws later (in front). FOOT is where the
      // skis meet the snow, matching a tree's trunk-base contact point.
      const FOOT = 16;
      const aFoot = A.sy + FOOT, bFoot = B.sy + FOOT;
      const SPAN = W + 60;
      const ents = [];
      for (const tr of trees) {
        const sx = ((((tr.wx - camX) % SPAN) + SPAN) % SPAN); if (sx > W + 34) continue;
        const baseY = edge(sx) + tr.below;
        ents.push({ footY: baseY, draw: function () { drawPine(sx, baseY, tr.scale, tr.seed); } });
      }
      ents.push({ footY: aFoot, draw: function () { drawSkier(time, A.sx, A.sy, A.dir, A.lean, KITA, moving); } });
      ents.push({ footY: bFoot, draw: function () { drawSkier(time, B.sx, B.sy, B.dir, B.lean, KITB, moving); } });
      // spray belongs to the front-most skier's depth (in front of skiers, behind nearer trees)
      ents.push({ footY: Math.max(aFoot, bFoot) + 0.1, draw: drawSpray });
      ents.sort(function (p, q) { return p.footY - q.footY; });
      for (const e of ents) e.draw();
      drawSnow(dt);
    }
    function frame(t) {
      if (!START) START = t;
      const T = (t - START) / 1000;
      const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016); lastT = t;
      if (T > INTRO_END) { camSpeed = Math.min(78, camSpeed + dt * 26); camX += dt * camSpeed; stepStreaks(dt); }
      // dynamic time of day: advance the clock, recolour the (cheap) sky + bodies every
      // frame, and only re-bake the (cheap, ImageData-based) mountain layers when the hour
      // drifts enough. Frozen while paused.
      if (!paused) {
        dayHour = (dayHour + dt / DAY_LEN) % 1;
        PAL = computePalette(dayHour, curMood);
        if (Math.abs(dayHour - bakedHour) > 0.0015 || curMood !== bakedMood) { rebakeRanges(); bakedHour = dayHour; bakedMood = curMood; }
        if (onHourChange && T - hourReportT > 0.2) { hourReportT = T; onHourChange(dayHour); }
      }
      render(t / 1000, dt, T);
      updateDialog(T);
      requestAnimationFrame(frame);
    }

    function buildGeometry() {
      rg0 = makeRidge(HOR - MU * 1.85, MU * 0.2, [{ f: 1, a: 1, p: 0.3 }, { f: 2, a: 0.4, p: 1.1 }, { f: 3, a: 0.16, p: 2.0 }]);
      rg1 = makeRidge(HOR - MU * 1.45, MU * 0.27, [{ f: 1, a: 1, p: 1.0 }, { f: 2, a: 0.5, p: 0.4 }, { f: 3, a: 0.18, p: 2.3 }]);
      rg2 = makeRidge(HOR - MU * 1.08, MU * 0.34, [{ f: 1, a: 1, p: 2.0 }, { f: 2, a: 0.52, p: 0.7 }, { f: 3, a: 0.22, p: 1.4 }, { f: 5, a: 0.1, p: 2.6 }]);
      rg3 = makeRidge(HOR - MU * 0.78, MU * 0.4, [{ f: 1, a: 1, p: 0.6 }, { f: 2, a: 0.55, p: 1.7 }, { f: 3, a: 0.24, p: 1.0 }, { f: 5, a: 0.12, p: 2.4 }]);
      buildLayers();
      const SPAN = W + 60; const sd = { s: 7 }; const R = () => { sd.s = (sd.s * 1103515245 + 12345) & 0x7fffffff; return sd.s / 0x7fffffff; };
      trees = []; const tc = Math.max(20, Math.round(W / 24));
      for (let i = 0; i < tc; i++) trees.push({ wx: R() * SPAN, below: 6 + R() * Math.max(MU * 1.5, (H - E0) * 0.72), scale: 2.2 + R() * 2.6, seed: (R() * 1e9) | 0 });
      moguls = []; const mc = Math.max(22, Math.round(W / 18));
      for (let i = 0; i < mc; i++) moguls.push({ wx: R() * SPAN, below: 5 + R() * Math.max(MU * 1.6, (H - E0) * 0.82), w: 2 + Math.round(R() * 4) });
      snow = []; const n = Math.round((W * H) / 2400);
      for (let i = 0; i < n; i++) { const sz = Math.random(); const r = sz < 0.62 ? 1 : (sz < 0.9 ? 2 : 3); snow.push({ x: Math.random() * W, y: Math.random() * H, s: 0.35 + r * 0.33 + Math.random() * 0.4, r }); }
      streaks = []; const ns = Math.round((W * H) / 6000);
      for (let i = 0; i < ns; i++) streaks.push({ x: Math.random() * W, y: H * 0.4 + Math.random() * H * 0.6, len: 3 + Math.round(Math.random() * 4) });
    }
    // --- Mountain layers: indexed-palette baking ----------------------------
    // The geometry (which material each pixel is, and its shade/gradient level) is
    // time-invariant, so we bake it ONCE into a Uint16 index map. Recolouring then
    // only builds a small per-recipe colour LUT and blits it with a packed-Uint32
    // copy — no per-pixel sin/lerp/strings — so colours can transition every frame
    // with no hiccup. Q = quantisation levels for the continuous shade/rock/snow ramps.
    const Q = 32;
    const _le = (() => { const b = new ArrayBuffer(4); new Uint32Array(b)[0] = 1; return new Uint8Array(b)[0] === 1; })();
    const pack = _le
      ? ((r, g, b) => ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0)
      : ((r, g, b) => ((r << 24) | (g << 16) | (b << 8) | 255) >>> 0);

    function bakeRangeIdx(ridge, opt) {
      const idx = new Uint16Array(W * H), map = new Map(), recipes = [null]; // slot 0 = transparent
      const slot = (key, rec) => { let s = map.get(key); if (s === undefined) { s = recipes.length; recipes.push(rec); map.set(key, s); } return s; };
      for (let x = 0; x < W; x++) {
        const top = Math.round(ridge[x]);
        const slope = ridge[(x + 4) % W] - ridge[(x - 4 + W) % W];
        const shaded = slope < -0.25;
        const qs = Math.round(Math.max(0, Math.min(1, slope * 0.5 + 0.5)) * Q);
        const vis = Math.max(10, HOR - top);
        const gully = 0.5 + 0.3 * Math.sin(x * 0.05 + opt.seed) + 0.2 * Math.sin(x * 0.13 + opt.seed * 1.7);
        const snowEnd = vis * opt.snowFrac * (0.82 + gully * 0.42);
        const treeEnd = snowEnd + vis * opt.treeFrac * (0.7 + gully * 0.6);
        const crestKey = shaded ? 'c:crestSh' : 'c:crest', crestRec = ['c', shaded ? 'crestSh' : 'crest'];
        for (let y = top; y < H; y++) {
          const d = y - top;
          const hs = Math.sin(x * 127.1 + y * 311.7 + opt.seed * 13.3) * 43758.5453; const hash = hs - Math.floor(hs);
          let key, rec;
          if (d < 1) { key = crestKey; rec = crestRec; }
          else if (d < snowEnd) {
            if (d > snowEnd - 2.5 && hash < 0.4) { key = 'c:treeDk'; rec = ['c', 'treeDk']; }
            else if (hash > 0.93) { key = 'c:snowHi'; rec = ['c', 'snowHi']; }
            else if (hash < 0.05) { key = 'c:snowSh2'; rec = ['c', 'snowSh2']; }
            else { key = 'm:' + qs; rec = ['m', qs]; }
          } else if (d < treeEnd) {
            if (d < snowEnd + 2 && hash > 0.82) { key = 'c:snowSh'; rec = ['c', 'snowSh']; }
            else if (hash > 0.7) { key = 'c:treeHi'; rec = ['c', 'treeHi']; }
            else if (hash < 0.26) { key = 'c:treeDk'; rec = ['c', 'treeDk']; }
            else { key = 'c:tree'; rec = ['c', 'tree']; }
          } else {
            const qr = Math.round(Math.min(1, (d - treeEnd) / Math.max(10, vis * 0.55)) * Q);
            if (hash > 0.9) { key = 'c:rockHi'; rec = ['c', 'rockHi']; }
            else if (hash < 0.12) { key = 'c:rockDk'; rec = ['c', 'rockDk']; }
            else { key = 'r:' + qs + ':' + qr; rec = ['r', qs, qr]; }
          }
          idx[y * W + x] = slot(key, rec);
        }
      }
      return { idx: idx, recipes: recipes };
    }
    function bakeSnowIdx(ridge, opt) {
      const idx = new Uint16Array(W * H), map = new Map(), recipes = [null];
      const slot = (key, rec) => { let s = map.get(key); if (s === undefined) { s = recipes.length; recipes.push(rec); map.set(key, s); } return s; };
      for (let x = 0; x < W; x++) {
        const top = Math.round(ridge[x]);
        const vis = Math.max(10, HOR - top);
        for (let y = top; y < H; y++) {
          const d = y - top;
          const hs = Math.sin(x * 127.1 + y * 311.7 + opt.seed * 13.3) * 43758.5453; const hash = hs - Math.floor(hs);
          let key, rec;
          if (d < 1) { key = 'c:crest'; rec = ['c', 'crest']; }
          else if (hash > 0.94) { key = 'c:snowHi'; rec = ['c', 'snowHi']; }
          else { const qg = Math.round(Math.min(1, d / vis) * Q); key = 'g:' + qg; rec = ['g', qg]; }
          idx[y * W + x] = slot(key, rec);
        }
      }
      return { idx: idx, recipes: recipes };
    }
    function buildLayers() {
      const defs = [
        { ridge: rg0, kind: 'range', opt: { seed: 7, snowFrac: 0.6, treeFrac: 0.1, haze: 0.45 }, src: (P) => ({ snow: lerp(P.farSnow, P.skyHor, 0.45), rock: lerp(P.farRock, P.skyHor, 0.4) }) },
        { ridge: rg1, kind: 'snow', opt: { seed: 13, haze: 0.26 }, src: (P) => ({ snow: P.farSnow, rock: P.farRock }) },
        { ridge: rg2, kind: 'snow', opt: { seed: 23, haze: 0.1 }, src: (P) => ({ snow: P.midSnow, rock: P.midRock }) },
        { ridge: rg3, kind: 'snow', opt: { seed: 37, haze: 0 }, src: (P) => ({ snow: P.nearSnow, rock: P.nearRock }) }
      ];
      layers = defs.map(function (def) {
        const baked = def.kind === 'range' ? bakeRangeIdx(def.ridge, def.opt) : bakeSnowIdx(def.ridge, def.opt);
        const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
        const c2 = canvas.getContext('2d');
        const img = c2.createImageData(W, H);
        return { canvas: canvas, ctx: c2, img: img, data32: new Uint32Array(img.data.buffer), lut: new Uint32Array(baked.recipes.length), idx: baked.idx, recipes: baked.recipes, opt: def.opt, src: def.src };
      });
      t0 = layers[0].canvas; t1 = layers[1].canvas; t2 = layers[2].canvas; t3 = layers[3].canvas;
    }
    function evalRecipe(rec, pal) {
      switch (rec[0]) {
        case 'c': return pal[rec[1]];
        case 'm': return lerp(pal.snowSh, pal.snowLit, rec[1] / Q);
        case 'r': return lerp(lerp(pal.rockSh, pal.rockLit, rec[1] / Q), pal.rockDk, rec[2] / Q);
        case 'g': return lerp(pal.snowTop, pal.snowBot, rec[1] / Q);
      }
      return '#000000';
    }
    function recolorLayer(L) {
      const sr = L.src(PAL), pal = layerPal(sr.snow, sr.rock);
      const hz = L.opt.haze, hzT = PAL.skyHor, recs = L.recipes, lut = L.lut;
      lut[0] = 0; // transparent
      for (let s = 1; s < recs.length; s++) {
        let hex = evalRecipe(recs[s], pal);
        if (hz > 0) hex = lerp(hex, hzT, hz);
        lut[s] = pack(parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16));
      }
      const idx = L.idx, data = L.data32, N = data.length;
      for (let i = 0; i < N; i++) data[i] = lut[idx[i]];
      L.ctx.putImageData(L.img, 0, 0);
    }
    function rebakeRanges() { if (!layers.length) return; for (let i = 0; i < layers.length; i++) recolorLayer(layers[i]); }
    // Setters used by the UI. setHour/setMood update one axis and keep the other; each
    // re-bakes immediately and (under reduced motion, where there's no loop) renders once.
    function applyScene(h01, mood) { dayHour = ((h01 % 1) + 1) % 1; curMood = mood; PAL = computePalette(dayHour, curMood); rebakeRanges(); bakedHour = dayHour; bakedMood = curMood; if (reduceMotion) render(0, 0.016, 999); }
    function setHour(h01) { applyScene(h01, curMood); }
    function setMood(mood) { applyScene(dayHour, mood); }
    function setPaused(p) { paused = !!p; return paused; }
    function drawTile(c, off) { if (!c) return; const o = ((Math.round(off) % W) + W) % W; ctx.drawImage(c, -o, 0); ctx.drawImage(c, W - o, 0); }

    // Sky: a large oval gradient radiating from the active light source (sun by day,
    // moon by night, blended through twilight). Drawn over the whole canvas; the
    // mountains/slope paint on top, so only the sky above the ridgelines shows.
    function drawSky() {
      const L = lightPos();
      const lx = L.x * W, ly = L.y * H;
      const inner = lerp(PAL.sun, PAL.skyHor, 0.45);     // bright halo right at the source
      const R = Math.max(W, H) * 1.25;
      ctx.save();
      ctx.translate(lx, ly);
      ctx.scale(1, 0.66);                                // squash vertically -> wide oval
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
      g.addColorStop(0.0, inner);
      g.addColorStop(0.16, PAL.skyHor);
      g.addColorStop(0.46, PAL.skyMid);
      g.addColorStop(1.0, PAL.skyTop);
      ctx.fillStyle = g;
      ctx.fillRect(-3 * W, -3 * H, 6 * W, 6 * H);
      ctx.restore();
    }
    function drawCelestial(time) {
      const wob = reduceMotion ? 0 : Math.sin(time * 0.7) * 0.4;
      const h = dayHour * 24;
      const s = bodyPos(h), m = bodyPos((h + 12) % 24);
      // moon first (so an overlapping sun glow sits on top at the crossover)
      if (m.alt > -0.12) {
        const cx = Math.round(W * m.x), cy = Math.round(H * m.y), r = 10 + wob, glowR = r * 2.6;
        for (let k = 6; k >= 1; k--) disc(cx, cy, r + (glowR - r) * (k / 6), hexA(MOON_GLOW, 0.05));
        disc(cx, cy, r, MOON_COL);
        // faint shaded limb (lower-right) for a touch of sphere volume
        disc(cx + Math.round(r * 0.24), cy + Math.round(r * 0.24), Math.round(r * 0.82), hexA('#c2cbe2', 0.30));
        // craters: darker basin + a catch-light on the sunlit (upper-left) rim
        const crater = (dx, dy, cr) => {
          const ox = cx + Math.round(dx * r), oy = cy + Math.round(dy * r), rr = Math.max(1, Math.round(cr * r));
          disc(ox, oy, rr, hexA('#aab4ce', 0.85));
          disc(ox - Math.max(1, Math.round(rr * 0.4)), oy - Math.max(1, Math.round(rr * 0.4)), Math.max(1, rr - 1), hexA('#f3f6fd', 0.45));
        };
        crater(-0.34, -0.22, 0.30);
        crater(0.30, 0.26, 0.22);
        crater(0.12, -0.40, 0.14);
        crater(-0.10, 0.42, 0.13);
        crater(0.42, -0.16, 0.10);
      }
      if (s.alt > -0.12) {
        const cx = Math.round(W * s.x), cy = Math.round(H * s.y), r = (PAL.sunR || 6) * 2 + wob, glowR = r * 3.0;
        for (let k = 6; k >= 1; k--) disc(cx, cy, r + (glowR - r) * (k / 6), hexA(PAL.sun, 0.06));
        disc(cx, cy, r, PAL.sun);
      }
    }
    function drawSlope() {
      for (let sx = 0; sx < W; sx++) { const e = Math.round(edge(sx)); px(sx, e, 1, 2, PAL.slopeHi); px(sx, e + 2, 1, H - (e + 2), PAL.slopeBase); }
      const phase = ((camX * 0.6) % 18 + 18) % 18;
      for (let band = 0; band < 7; band++) { for (let sx = 0; sx < W; sx++) { const e = edge(sx); const yy = Math.round(e + 16 + band * Math.max(12, H * 0.09) - phase); if (yy > e + 5 && yy < H) dot(sx, yy, (sx % 6 < 3) ? hexA(PAL.slopeShade, 0.5) : hexA(PAL.slopeShade, 0.3)); } }
    }
    function drawMoguls() {
      const SPAN = W + 60;
      for (const m of moguls) { const sx = ((((m.wx - camX) % SPAN) + SPAN) % SPAN); if (sx > W + 6) continue; const y = edge(sx) + m.below; px(sx - m.w, y, m.w * 2, 1, hexA(PAL.slopeShade, 0.5)); px(sx - m.w + 1, y - 1, m.w * 2 - 2, 1, PAL.slopeHi); }
    }
    function drawSnow(dt) { for (const f of snow) { if (!reduceMotion) { f.y += f.s * dt * 30; f.x -= f.s * dt * 10; if (f.y > H) { f.y = -f.r; f.x = Math.random() * W; } if (f.x < 0) f.x += W; } const a = f.r >= 3 ? 0.95 : (f.r >= 2 ? 0.82 : 0.66); px(f.x, f.y, f.r, f.r, hexA(PAL.particle, a)); } }
    function stepStreaks(dt) { if (reduceMotion) return; for (const s of streaks) { s.x -= dt * 160; s.y -= dt * 64; if (s.x < -6 || s.y < H * 0.3) { s.x = W + Math.random() * 20; s.y = H * 0.45 + Math.random() * H * 0.55; } } }

    const PINE = { dark: '#1d3b30', mid: '#2c5742', lite: '#3a6e53', snow: '#eef4f8', snowSh: '#cdd9e2', trunk: '#3a2c22' };
    function drawPine(x, baseY, scale, seed) {
      const R = prand(seed); x = Math.round(x); baseY = Math.round(baseY);
      const lean = (R() * 2 - 1) * 0.45;
      const totalH = Math.round(11 * scale), baseHalf = Math.max(2, Math.round(3.6 * scale));
      const layers = 6, step = totalH / (layers + 0.5);
      px(x, baseY - 1, Math.max(1, Math.round(scale * 0.5)), 3, PINE.trunk);
      px(x - Math.round(scale) - 1, baseY, (Math.round(scale) + 1) * 2 + 1, 1, hexA('#ffffff', 0.82));
      px(x - Math.round(scale), baseY - 1, Math.round(scale) * 2 + 1, 1, hexA('#dfeaf2', 0.66));
      for (let j = 0; j < layers; j++) {
        const f = j / (layers - 1); const cx = x + Math.round(lean * f * totalH * 0.12);
        const half = Math.max(1, Math.round(baseHalf * (1 - f * 0.7)));
        const topY = Math.round(baseY - step * (j + 1)); const skirtH = Math.max(2, Math.round(step) + 1);
        for (let row = 0; row < skirtH; row++) {
          const rr = row / skirtH, sp = Math.max(0, Math.round(half * (0.25 + 0.95 * rr)));
          px(cx - sp, topY + row, sp * 2 + 1, 1, PINE.dark);
          if (sp > 0) px(cx + 1, topY + row, sp, 1, PINE.mid);
          if (sp > 1 && rr > 0.4) px(cx + Math.max(1, sp - 1), topY + row, 1, 1, PINE.lite);
          const spr = 0.55 - rr * 0.85;
          if (spr > 0) { for (let k = -sp; k <= sp; k++) { if (R() < spr) px(cx + k, topY + row, 1, 1, (k >= 0 ? PINE.snow : PINE.snowSh)); } }
        }
        const by = topY + skirtH;
        for (let k = -half; k <= half; k++) { if (R() < 0.4) px(cx + k, by, 1, 1, (k >= 0 ? PINE.mid : PINE.dark)); }
        for (let k = -half; k <= half; k++) { if (R() < 0.32) px(cx + k, by - 1, 1, 1, (k >= 0 ? PINE.snow : PINE.snowSh)); }
      }
      const tx = x + Math.round(lean * totalH * 0.12), ty = Math.round(baseY - step * layers - 1);
      px(tx, ty, 1, 2, PINE.dark); px(tx, ty, 1, 1, PINE.snow);
    }

    const SKI = { A: { y: null, x: null }, B: { y: null, x: null } };
    let spray = [];
    function screenXOf(tr) { const SPAN = W + 60; return ((((tr.wx - camX) % SPAN) + SPAN) % SPAN); }
    function steer(time, which, moving) {
      const S = SKI[which];
      const baseX0 = (which === 'A' ? 0.40 : 0.60) * W;
      const driftAmp = moving ? W * 0.06 : W * 0.02;
      let targetX = baseX0 + Math.sin(time * 0.33 + (which === 'A' ? 0 : 2.1)) * driftAmp;
      const other = SKI[which === 'A' ? 'B' : 'A'];
      if (other.x !== null) {
        const cur = (S.x === null ? targetX : S.x); const dx = cur - other.x; const minGap = Math.max(22, W * 0.075);
        if (Math.abs(dx) < minGap) { targetX += (dx >= 0 ? 1 : -1) * (minGap - Math.abs(dx)) * 0.6; }
      }
      if (S.x === null) S.x = targetX;
      S.x += (targetX - S.x) * 0.07;
      const baseX = Math.round(S.x);
      const baseY = edge(baseX) + (which === 'A' ? 12 : 15);
      const amp = moving ? Math.max(7, MU * 0.22) : Math.max(2, MU * 0.05);
      const phase = which === 'A' ? 0 : 1.15;
      const carve = Math.sin(time * 1.0 + phase);
      let targetY = baseY + carve * amp;
      if (S.y === null) S.y = targetY;
      if (moving) {
        const rx = Math.max(13, W * 0.038); let nd = rx, ny = 0, found = false;
        for (const tr of trees) {
          const tx = screenXOf(tr); const dxs = Math.abs(tx - baseX);
          if (dxs < nd) { const ty = edge(tx) + tr.below; if (ty > baseY - amp - 12 && ty < baseY + amp + 14) { nd = dxs; ny = ty; found = true; } }
        }
        if (found) { const k = 1 - nd / rx; targetY += (S.y <= ny ? -1 : 1) * k * 8; }
      }
      targetY = Math.max(baseY - amp - 6, Math.min(baseY + amp + 12, targetY));
      const prev = S.y; S.y += (targetY - S.y) * 0.12; const vy = S.y - prev;
      const sy = Math.round(S.y);
      const lean = Math.max(-2.2, Math.min(2.2, carve * 2.0));
      const turn = moving ? Math.min(1, Math.abs(carve)) : 0;
      return { sx: baseX, sy, dir: carve, carve, lean, turn, vy, moving };
    }
    function emitSpray(p) {
      if (reduceMotion || !p || !p.moving) return;
      const n = Math.round(p.turn * p.turn * 8);
      for (let i = 0; i < n; i++) {
        spray.push({
          x: p.sx - 3 + (Math.random() * 5 - 2.5), y: p.sy + 8 + Math.random() * 3,
          vx: -(0.3 + Math.random() * 1.0), vy: -(1.0 + Math.random() * 2.0),
          life: 0.7 + Math.random() * 0.6, sz: (Math.random() < 0.45 ? 1 : (Math.random() < 0.85 ? 2 : 3))
        });
      }
    }
    function stepSpray(dt) {
      for (let i = spray.length - 1; i >= 0; i--) {
        const s = spray[i];
        s.x += s.vx * dt * 60; s.y += s.vy * dt * 60; s.vy += 0.16 * dt * 60; s.vx *= 0.97; s.life -= dt * 1.6;
        if (s.life <= 0 || s.y > H) spray.splice(i, 1);
      }
      if (spray.length > 260) spray.splice(0, spray.length - 260);
    }
    function drawSpray() {
      for (const s of spray) {
        const a = Math.max(0, Math.min(0.92, s.life));
        if (s.sz >= 2) px(s.x + 1, s.y + 1, s.sz, s.sz, hexA('#8fb0cf', a * 0.5));
        px(s.x, s.y, s.sz, s.sz, hexA('#f4f9ff', a));
      }
    }
    function drawSkier(time, sx, sy, dir, lean, K, moving) {
      const t = Math.round(lean);
      px(sx - 6, sy + 18, 17, 1, hexA('#9fb2c8', 0.38));
      line(sx - 7, sy + 10, sx + 7, sy + 13, K.skiEdge); line(sx - 7, sy + 9, sx + 7, sy + 12, K.ski); px(sx + 7, sy + 11, 2, 1, K.ski); px(sx + 8, sy + 10, 1, 1, K.ski);
      line(sx - 4, sy + 14, sx + 9, sy + 17, K.skiEdge); line(sx - 4, sy + 13, sx + 9, sy + 16, K.ski); px(sx + 9, sy + 15, 2, 1, K.ski); px(sx + 10, sy + 14, 1, 1, K.ski);
      px(sx - 3, sy + 8, 3, 2, K.boot); px(sx + 1, sy + 10, 3, 2, K.boot);
      px(sx - 3, sy + 4, 3, 4, K.pants); px(sx, sy + 5, 4, 4, K.pants); px(sx - 3, sy + 4, 3, 1, K.pantsHi);
      px(sx - 2 + t, sy - 3, 6, 7, K.jacket); px(sx + 2 + t, sy - 3, 2, 6, K.accent); px(sx + 2 + t, sy - 3, 2, 1, K.accentHi);
      px(sx + t, sy - 3, 1, 7, K.trim); px(sx - 2 + t, sy + 3, 6, 1, K.jacketSh);
      px(sx - 3 + t, sy - 1, 2, 2, K.jacket); px(sx - 4 + t, sy + 1, 1, 1, K.glove); line(sx - 4 + t, sy + 1, sx - 9, sy + 6, K.pole); px(sx - 9, sy + 6, 1, 1, K.basket);
      px(sx + 4 + t, sy - 1, 2, 2, K.accent); px(sx + 6 + t, sy + 1, 1, 1, K.glove); line(sx + 6 + t, sy + 1, sx + 11, sy + 7, K.pole); px(sx + 11, sy + 7, 1, 1, K.basket);
      const hx = sx + 2 + t, hy = sy - 10;
      px(hx, hy + 1, 5, 4, K.helmet); px(hx, hy, 5, 1, K.helmet); px(hx + 1, hy - 1, 3, 1, K.helmet);
      px(hx + 1, hy - 1, 2, 1, K.helmetHi); px(hx, hy + 1, 1, 4, K.helmetSh);
      px(hx + 1, hy + 5, 3, 2, K.skin); px(hx + 1, hy + 6, 1, 1, K.skinSh);
      px(hx + 1, hy + 4, 5, 1, K.strap); px(hx + 2, hy + 4, 4, 2, K.strap); px(hx + 2, hy + 5, 4, 1, K.lens);
      px(hx + 2, hy + 5, 1, 1, K.lensHi); px(hx + 3 + (dir > 0 ? 1 : 0), hy + 5, 1, 1, '#ffffff');
    }

    function setBubble(el, msg, show, pos) {
      if (!el) return;
      if (pos) { el.style.left = pos.x + 'px'; el.style.top = pos.y + 'px'; }
      if (show && msg) { const tn = el.querySelector('[data-bt]'); if (tn && tn.textContent !== msg) tn.textContent = msg; el.style.opacity = '1'; el.style.transform = 'translate(-50%,-118%) scale(1)'; }
      else { el.style.opacity = '0'; el.style.transform = 'translate(-50%,-118%) scale(.7)'; }
    }
    function updateDialog(T) {
      if (reduceMotion) { setBubble(refs.bubbleA, null, false, refs._pA); setBubble(refs.bubbleB, null, false, refs._pB); return; }
      if (T < 1.2) { D.a.msg = null; D.b.msg = null; }
      else if (T < 5.4) { D.a.msg = INTRO_A; D.b.msg = null; }
      else if (T < INTRO_END + 0.6) { D.a.msg = null; D.b.msg = INTRO_B; }
      else {
        if (T >= D.next) {
          const who = Math.random() < 0.5 ? 'a' : 'b'; let m;
          do { m = CHATS[(Math.random() * CHATS.length) | 0]; } while (m === D.last && CHATS.length > 1);
          D.last = m; D[who].msg = m; D[who].until = T + 2.7; D.next = T + 2.7 + Math.random() * 2.4;
        }
        if (T > D.a.until) D.a.msg = null;
        if (T > D.b.until) D.b.msg = null;
      }
      setBubble(refs.bubbleA, D.a.msg, !!(D.a.msg && refs._pA), refs._pA);
      setBubble(refs.bubbleB, D.b.msg, !!(D.b.msg && refs._pB), refs._pB);
    }

    resize();
    window.addEventListener('resize', resize, { passive: true });
    refs.applyScene = applyScene;
    refs.setHour = setHour;
    refs.setMood = setMood;
    refs.setPaused = setPaused;
    if (reduceMotion) { render(0, 0.016, 999); } else { requestAnimationFrame(frame); }
    return refs;
  }

  window.OG = window.OG || {};
  window.OG.scene = { start: start, computePalette: computePalette };
})();
