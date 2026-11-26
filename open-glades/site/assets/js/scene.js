/*
 * Open Glades — pixel-art skiing scene.
 * Everything is drawn in code on a low-resolution canvas: baked, recolourable mountain layers,
 * a chairlift, a cabin, weather, and two rigged skiers.
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
    // A soft radial halo of `col`, fixed to its body (sun/moon), fading to transparent.
    const haloGradient = (cx, cy, hr, col, a0) => {
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, hr);
      g.addColorStop(0, hexA(col, a0));
      g.addColorStop(0.4, hexA(col, a0 * 0.35));
      g.addColorStop(1, hexA(col, 0));
      ctx.fillStyle = g; ctx.fillRect(cx - hr, cy - hr, hr * 2, hr * 2);
    };
    const line = (x0, y0, x1, y1, col) => { x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0; let dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx - dy; ctx.fillStyle = col; while (true) { ctx.fillRect(x0, y0, 1, 1); if (x0 === x1 && y0 === y1) break; let e2 = 2 * err; if (e2 > -dy) { err -= dy; x0 += sx; } if (e2 < dx) { err += dx; y0 += sy; } } };
    const prand = (s) => { let v = (s >>> 0) || 1; return () => { v = (v * 1664525 + 1013904223) >>> 0; return v / 4294967296; }; };
    const lerp = (a, b, t) => lerpHex(a, b, t);
    const edge = (x) => E0 + (E1 - E0) * (x / W) + Math.sin(x / 30 + 0.6) * 2.0 + Math.sin(x / 13 + 2.0) * 1.0;
    const makeRidge = (base, amp, harm) => { const a = new Float32Array(W); for (let x = 0; x < W; x++) { let y = base; for (const h of harm) y += Math.sin((x / W) * Math.PI * 2 * h.f + h.p) * amp * h.a; a[x] = y; } return a; };

    // --- celestial bodies: sun + moon ride the same arc 12h apart, so one rises on
    // one side as the other sets on the opposite side. h is the body's local hour (0..24).
    const MOON_COL = '#e3e9f6', MOON_GLOW = '#aab6d8';
    // Continuous elliptical orbit over the full 24h (no clamping), so position never
    // jumps — even below the horizon. a = 0 at the eastern horizon (06:00), pi/2 at the
    // zenith (12:00), pi at the western horizon (18:00), -pi/2 at the nadir (00:00).
    const bodyPos = (h) => {
      const a = (h - 6) / 12 * Math.PI;
      const alt = Math.sin(a);                       // >0 = above horizon
      return { x: 0.5 - Math.cos(a) * 0.38, y: 0.5 - alt * 0.42, alt: alt };
    };
    // Shared light state: both bodies, the gradient centre (altitude-blended toward the
    // higher one) and sunFrac (1 = full sun .. 0 = full moon), which drives the sky-glow
    // size + the god rays so night gets dark as the moon takes over.
    const celestialState = () => {
      const h = dayHour * 24;
      const s = bodyPos(h), m = bodyPos((h + 12) % 24);
      const ws = Math.max(0, s.alt) + 1e-4, wm = Math.max(0, m.alt) + 1e-4;
      return { s: s, m: m, sunFrac: ws / (ws + wm), cx: (s.x * ws + m.x * wm) / (ws + wm), cy: (s.y * ws + m.y * wm) / (ws + wm) };
    };

    const KITA = { jacket: '#1f8a9c', jacketSh: '#156575', accent: '#2b3550', accentHi: '#3c4a6e', pants: '#465689', pantsHi: '#6274ad', pantsSh: '#35426c', boot: '#141a2c', bootHi: '#2c3554', scarf: '#ffce5c', scarfSh: '#d9a53a', glove: '#1b2236', helmet: '#e7eef4', helmetHi: '#ffffff', helmetSh: '#b7c5d3', skin: '#f0c9a0', skinSh: '#d8a87f', strap: '#161b29', lens: '#7fd0e0', lensHi: '#d8f4fb', trim: '#eef3f5', ski: '#ffce5c', skiEdge: '#c9972f', pole: '#cbb48a', basket: '#9c8a63' };
    const KITB = { jacket: '#ee6c4d', jacketSh: '#c2542a', accent: '#ffce5c', accentHi: '#ffe49a', pants: '#5a4a86', pantsHi: '#7a69ab', pantsSh: '#443867', boot: '#141a2c', bootHi: '#2c3554', scarf: '#7fd0e0', scarfSh: '#4fa3b5', pom: '#fff6e6', glove: '#2a1d18', helmet: '#3d7a5c', helmetHi: '#f4e9cf', helmetSh: '#2a5942', skin: '#e8bd92', skinSh: '#cf9a6f', strap: '#161b29', lens: '#ffcf5c', lensHi: '#fff3c4', trim: '#fff1d8', ski: '#7fd0e0', skiEdge: '#3f8ea0', pole: '#cbb48a', basket: '#9c8a63' };

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
    // ---- background life: stars, clouds, mist, spindrift, chairlift, cabin -------
    function drawStars(time) {
      if (nightAmt < 0.04) return;
      for (const s of stars) {
        const tw = reduceMotion ? 0.8 : 0.5 + 0.5 * Math.sin(time * s.tw + s.ph);
        const a = nightAmt * (0.35 + 0.65 * tw);
        dot(s.x, s.y, hexA('#eef2ff', a));
        if (s.big) { const b = hexA('#eef2ff', a * 0.45); dot(s.x - 1, s.y, b); dot(s.x + 1, s.y, b); dot(s.x, s.y - 1, b); dot(s.x, s.y + 1, b); }
      }
    }
    function drawClouds(time) {
      const body = lerp(lerp(PAL.skyHor, '#ffffff', 0.6), PAL.skyMid, 0.2 + 0.5 * nightAmt);
      const under = lerp(body, PAL.skyMid, 0.45);
      const span = W + 240, t = reduceMotion ? 0 : time;
      for (const c of clouds) {
        const x0 = Math.round((((c.x - t * c.sp - camX * 0.03) % span) + span) % span) - 120;
        if (x0 > W + 10 || x0 + c.w < -30) continue;
        // darker copy two pixels lower first, so every puff gets a shaded underside
        for (let pass = 0; pass < 2; pass++) {
          ctx.fillStyle = pass === 0 ? under : body;
          const oy = pass === 0 ? 2 : 0;
          for (const p of c.puffs) {
            for (let yy = -p.r; yy <= 0; yy++) { const sp = Math.round(Math.sqrt(p.r * p.r - yy * yy)); ctx.fillRect(x0 + p.dx - sp, c.y + yy + oy, sp * 2 + 1, 1); }
          }
          ctx.fillRect(x0 - 4, c.y + 1 + oy, Math.round(c.w) + 10, 2);
        }
      }
    }
    // A slow band of valley mist: two soft steps, with a rolling top edge.
    function drawMist(time, y0, thick, alpha, speed, ph) {
      const t = reduceMotion ? 0 : time, c1 = hexA(PAL.skyHor, alpha * 0.5), c2 = hexA(PAL.skyHor, alpha);
      for (let x = 0; x < W; x += 2) {
        const top = y0 + Math.sin((x + t * speed) / 37 + ph) * 3 + Math.sin((x - t * speed * 0.6) / 13 + ph * 2) * 1.5;
        ctx.fillStyle = c1; ctx.fillRect(x, top | 0, 2, thick);
        ctx.fillStyle = c2; ctx.fillRect(x, (top | 0) + 3, 2, thick - 5);
      }
    }
    // Spindrift: snow blowing off the highest summits.
    function drawPlumes(time, L, off) {
      const o = wrapX(Math.round(off)), t = reduceMotion ? 0 : time, a0 = 0.75 - 0.4 * nightAmt;
      for (const p of L.peaks) {
        const sx = wrapX(p.x - o);
        for (let k = 0; k < 2; k++) {
          const bx = sx + k * W; if (bx > W + 40) continue;
          for (let i = 0; i < 16; i++) {
            const xx = bx - 1 - i * 1.7, yy = p.y - 1 - i * 0.22 + Math.sin(t * 2.4 + i * 0.55 + p.x) * (0.4 + i * 0.09);
            px(xx, yy, 2, 1, hexA('#ffffff', a0 * (1 - i / 16)));
          }
        }
      }
    }
    function drawLift(time, off) {
      const o = wrapX(Math.round(off)), t = reduceMotion ? 0 : time;
      const steel = lerp('#2b3347', PAL.skyHor, 0.22), steelLt = lerp('#55607a', PAL.skyHor, 0.25);
      const dx = LIFT.xb - LIFT.xt, dy = LIFT.yb - LIFT.yt, CABLE = 11;
      const gy = (xu) => LIFT.yt + (xu - LIFT.xt) / dx * dy;                 // ground line under the cable
      const riders = ['#ee6c4d', '#1f8a9c', '#ffce5c', '#8e6fd0', '#e8eef4'];
      for (const sh of [-o - W, -o, W - o]) {
        if (LIFT.xb + sh < -12 || LIFT.xt + sh > W + 12) continue;
        line(LIFT.xt + sh, LIFT.yt - CABLE, LIFT.xb + sh, LIFT.yb - CABLE, steel);
        // chairs: uphill ones carry riders, downhill ones come back empty a pixel further back
        const n = Math.floor(dx / 26);
        for (let i = 0; i < n; i++) {
          const up = ((i * 26 + t * 7) % dx + dx) % dx, dn = ((i * 26 + 13 - t * 7) % dx + dx) % dx;
          const ux = LIFT.xb - up, uy = Math.round(gy(ux)) - CABLE, x1 = Math.round(ux + sh);
          const ddx = LIFT.xt + dn, ddy = Math.round(gy(ddx)) - CABLE, x2 = Math.round(ddx + sh);
          px(x2, ddy + 1, 1, 3, steelLt); px(x2 - 1, ddy + 4, 3, 1, steelLt);
          px(x1, uy + 1, 1, 4, steel); px(x1 - 1, uy + 3, 1, 2, steel); px(x1 - 1, uy + 5, 4, 1, steel);
          if (hash1(i, 5) > 0.3) { px(x1, uy + 3, 2, 2, riders[i % riders.length]); px(x1, uy + 2, 2, 1, '#f0c9a0'); }
        }
        for (let k = 0; k <= 6; k++) {
          const xu = LIFT.xt + (dx * k) / 6, x = Math.round(xu + sh), topY = Math.round(gy(xu)) - CABLE;
          const base = Math.max(Math.round(gy(xu)), Math.round(rg2[wrapX(Math.round(xu))]));
          px(x, topY, 1, base - topY + 1, steel); px(x - 3, topY, 7, 1, steel); px(x - 3, topY + 1, 1, 1, steel); px(x + 3, topY + 1, 1, 1, steel);
          if (nightAmt > 0.2) dot(x, topY - 1, hexA('#ffd27a', nightAmt));
        }
        // top station hut
        const hx = LIFT.xt + sh - 5, hy = LIFT.yt - 8;
        px(hx, hy + 2, 10, 6, steel); px(hx - 1, hy, 12, 2, lerp('#f4f8fc', PAL.skyHor, 0.2)); px(hx + 6, hy + 4, 2, 2, hexA('#ffd27a', 0.5 + 0.5 * nightAmt));
      }
    }
    function drawCabin(time, off) {
      const o = wrapX(Math.round(off)), t = reduceMotion ? 0.3 : time, dim = 0.5 * nightAmt, by = CABIN.y;
      const N = (hex) => lerp(hex, '#0e1630', dim);
      const wood = N('#8a5433'), woodDk = N('#633a23'), woodSh = N('#724428'), stone = N('#77686a');
      const snowC = lerp(PAL.slopeHi, '#ffffff', 0.35), snowSh = lerp(PAL.slopeShade, PAL.slopeBase, 0.3);
      const win = lerp('#f3c76c', '#ffe08a', nightAmt);
      for (const sh of [-o - W, -o, W - o]) {
        const cx = CABIN.x + sh;
        if (cx < -40 || cx > W + 40) continue;
        // window light spilling onto the snow, and a warm halo after dark
        if (nightAmt > 0.05) { haloGradient(cx - 7, by - 5, 22, '#ffbe5c', 0.5 * nightAmt); haloGradient(cx + 7, by - 5, 22, '#ffbe5c', 0.5 * nightAmt); }
        // snowman
        px(cx - 20, by - 4, 5, 5, snowC); px(cx - 19, by - 7, 3, 3, snowC); px(cx - 20, by, 5, 1, snowSh);
        dot(cx - 19, by - 6, '#1b2236'); dot(cx - 17, by - 6, '#1b2236'); dot(cx - 16, by - 5, '#f08a3c'); px(cx - 20, by - 4, 5, 1, '#d2483f');
        // walls of stacked logs
        px(cx - 11, by - 9, 22, 10, wood); px(cx + 7, by - 9, 4, 10, woodSh);
        for (const ly of [-7, -4, -1]) px(cx - 11, by + ly, 22, 1, woodDk);
        px(cx - 12, by - 9, 1, 10, woodDk); px(cx + 11, by - 9, 1, 10, woodDk);
        // chimney (behind the roof snow), then the snow-loaded gable
        px(cx + 6, by - 21, 4, 9, stone); px(cx + 5, by - 22, 6, 1, snowC);
        for (let r = 0; r < 9; r++) {
          const half = 2 + Math.round(r * 1.55), y = by - 18 + r;
          px(cx - half, y, half * 2 + 1, 1, snowC);
          if (r >= 4) px(cx - (half - 4), y, (half - 4) * 2 + 1, 1, r === 8 ? woodDk : wood);
        }
        px(cx - 15, by - 9, 5, 1, snowSh); px(cx + 11, by - 9, 5, 1, snowSh);     // eave shadow
        dot(cx - 15, by - 8, snowC); dot(cx + 15, by - 8, snowC);                // icicles
        dot(cx - 13, by - 8, snowC); dot(cx + 13, by - 8, snowC);
        // door and windows
        px(cx - 2, by - 6, 4, 7, woodDk); dot(cx + 1, by - 3, '#ffd27a');
        for (const wx of [-9, 5]) { px(cx + wx, by - 7, 5, 5, woodDk); px(cx + wx + 1, by - 6, 3, 3, win); px(cx + wx + 2, by - 6, 1, 3, woodDk); }
        px(cx - 1, by - 13, 2, 2, win);
        if (nightAmt > 0.05) { px(cx - 9, by + 1, 5, 2, hexA('#ffca6a', 0.4 * nightAmt)); px(cx + 5, by + 1, 5, 2, hexA('#ffca6a', 0.4 * nightAmt)); }
        // snow banked against the walls, and a woodpile
        px(cx - 14, by + 1, 28, 1, snowC); px(cx - 12, by, 5, 1, snowC); px(cx + 4, by, 3, 1, snowC);
        px(cx + 13, by - 3, 5, 4, woodDk); px(cx + 13, by - 4, 5, 1, snowC); dot(cx + 14, by - 2, wood); dot(cx + 16, by - 1, wood);
        // chimney smoke drifting downwind
        const smoke = lerp('#eef2f8', PAL.skyHor, 0.3 + 0.3 * nightAmt);
        for (let i = 0; i < 7; i++) {
          const age = ((t * 0.3 + i / 7) % 1 + 1) % 1, sz = 1 + Math.floor(age * 3.2);
          px(cx + 7 - age * 16 + Math.sin(age * 6 + i) * 1.5, by - 23 - age * 17, sz, sz, hexA(smoke, (1 - age) * 0.8));
        }
      }
    }

    let PINEC = null;   // the foreground pines' colours, dimmed toward night
    const TRACKS = { A: [], B: [] };
    function drawTracks() {
      const col = hexA(PAL.slopeShade, 0.6);
      for (const k of ['A', 'B']) {
        const arr = TRACKS[k];
        while (arr.length && (arr[0].wx - camX < -6 || arr.length > 520)) arr.shift();
        ctx.fillStyle = col;
        for (const p of arr) { const x = p.wx - camX, y = edge(x) + p.b; ctx.fillRect(x | 0, (y - 2) | 0, 2, 1); ctx.fillRect((x + 1) | 0, (y + 2) | 0, 2, 1); }
      }
    }
    function render(time, dt, T) {
      ctx.clearRect(0, 0, W, H);
      updateLight();
      const dimP = 0.5 * nightAmt;
      PINEC = { dark: lerp(PINE.dark, '#0b1226', dimP), mid: lerp(PINE.mid, '#0b1226', dimP), lite: lerp(PINE.lite, '#0b1226', dimP), snow: lerp(PINE.snow, PAL.slopeBase, dimP * 1.2), snowSh: lerp(PINE.snowSh, PAL.slopeShade, dimP * 1.2), trunk: lerp(PINE.trunk, '#0b1226', dimP) };
      drawSky(); drawStars(time); drawCelestial(time); drawClouds(time);
      drawTile(t0, camX * 0.06); drawPlumes(time, layers[0], camX * 0.06);
      drawMist(time, HOR - MU * 0.95, Math.round(MU * 0.3), 0.3, 5, 0.4);
      drawTile(t1, camX * 0.12); drawPlumes(time, layers[1], camX * 0.12);
      drawMist(time, HOR - MU * 0.55, Math.round(MU * 0.34), 0.36, -8, 2.1);
      drawTile(t2, camX * 0.22); drawLift(time, camX * 0.22);
      drawTile(t3, camX * 0.40); drawCabin(time, camX * 0.40);
      drawSlope(); drawMoguls();
      const moving = T > INTRO_END;
      const go = reduceMotion ? 1 : clamp01((T - INTRO_END) / 2.2);
      const A = steer(time, 'A', moving, dt, go), B = steer(time, 'B', moving, dt, go);
      refs._pA = { x: A.sx * PIXEL, y: (A.fy - 31) * PIXEL };
      refs._pB = { x: B.sx * PIXEL, y: (B.fy - 31) * PIXEL };
      if (!reduceMotion && go > 0.3) {
        for (const q of [['A', A], ['B', B]]) { const tx = q[1].sx - 9; TRACKS[q[0]].push({ wx: camX + tx, b: q[1].fy - edge(tx) }); }
      }
      drawTracks();
      stepSpray(dt); emitSpray(A); emitSpray(B);
      // Painter's ordering: sort trees + both skiers by their ground-contact Y so each tree
      // independently appears in front of or behind each skier.
      const SPAN = W + 60;
      const ents = [];
      for (const tr of trees) {
        const sx = ((((tr.wx - camX) % SPAN) + SPAN) % SPAN); if (sx > W + 34) continue;
        const baseY = edge(sx) + tr.below;
        ents.push({ footY: baseY, draw: function () { drawPine(sx, baseY, tr.scale, tr.seed); } });
      }
      ents.push({ footY: A.fy, draw: function () { drawSkier(time, 'A', A, KITA); } });
      ents.push({ footY: B.fy, draw: function () { drawSkier(time, 'B', B, KITB); } });
      // spray belongs to the front-most skier's depth (in front of skiers, behind nearer trees)
      ents.push({ footY: Math.max(A.fy, B.fy) + 0.1, draw: drawSpray });
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

    // ---- noise + dithering ---------------------------------------------------
    const hash1 = (i, s) => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };
    const hash2 = (x, y, s) => { const v = Math.sin(x * 127.1 + y * 311.7 + s * 13.3) * 43758.5453; return v - Math.floor(v); };
    // Value noise around a loop of `cells` lattice points, so anything built from it tiles at W.
    const pnoise = (u, cells, seed) => {
      const f = (((u % 1) + 1) % 1) * cells, i = Math.floor(f), t = f - i;
      const a = hash1(i % cells, seed), b = hash1((i + 1) % cells, seed), s = t * t * (3 - 2 * t);
      return a + (b - a) * s;
    };
    // Ordered (Bayer) dithering: turns a smooth 0..1 ramp into `levels` clean pixel-art steps.
    const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    const bayer = (x, y) => (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
    const dither = (v, levels, x, y, soft) => Math.max(0, Math.min(levels, Math.floor(v * levels + 0.5 + (bayer(x, y) - 0.5) * (soft || 1))));
    const wrapX = (x) => ((x % W) + W) % W;
    const clamp01 = (v) => Math.max(0, Math.min(1, v));

    // Jagged alpine skyline: ridged noise, so peaks come to a point instead of rolling over.
    function alpineRidge(base, amp, seed, cells) {
      const a = new Float32Array(W);
      for (let x = 0; x < W; x++) {
        const u = x / W; let n = 0, w = 1, tot = 0, c = cells;
        for (let o = 0; o < 5; o++) { const v = 1 - Math.abs(2 * pnoise(u, c, seed + o * 17) - 1); n += v * v * w; tot += w; w *= 0.5; c *= 2; }
        a[x] = base - (n / tot) * amp;
      }
      return a;
    }
    // Soft rolling skyline for the forested ridge and the near snow hills.
    function softRidge(base, amp, seed, cells) {
      const a = new Float32Array(W);
      for (let x = 0; x < W; x++) {
        const u = x / W; let n = 0, w = 1, tot = 0, c = cells;
        for (let o = 0; o < 3; o++) { n += pnoise(u, c, seed + o * 31) * w; tot += w; w *= 0.45; c *= 2; }
        a[x] = base - (n / tot - 0.5) * 2 * amp;
      }
      return a;
    }
    // Split a skyline at its valleys: each stretch between two valleys is one mountain, with
    // its summit. Coordinates are unwrapped (x1 may exceed W) so a mountain can straddle the seam.
    function ridgeSegments(ridge, rad) {
      const sm = new Float32Array(W);
      for (let x = 0; x < W; x++) { let s = 0; for (let k = -rad; k <= rad; k++) s += ridge[wrapX(x + k)]; sm[x] = s / (rad * 2 + 1); }
      const valleys = [];
      for (let x = 0; x < W; x++) if (sm[x] >= sm[wrapX(x - 1)] && sm[x] > sm[wrapX(x + 1)]) valleys.push(x);
      if (!valleys.length) valleys.push(0);
      const segOf = new Int16Array(W), segs = [];
      for (let i = 0; i < valleys.length; i++) {
        const x0 = valleys[i], x1 = (i === valleys.length - 1) ? valleys[0] + W : valleys[i + 1];
        let pk = x0, py = Infinity;
        for (let xu = x0; xu < x1; xu++) { const y = ridge[wrapX(xu)]; if (y < py) { py = y; pk = xu; } segOf[wrapX(xu)] = i; }
        segs.push({ x0: x0, x1: x1, pk: pk, py: Math.round(py) });
      }
      return { segOf: segOf, segs: segs };
    }

    let LIFT = null, CABIN = null, stars = [], clouds = [];
    function buildGeometry() {
      rg0 = alpineRidge(HOR - MU * 1.22, MU * 1.0, 7, 4);
      rg1 = alpineRidge(HOR - MU * 0.82, MU * 1.0, 13, 3);
      rg2 = softRidge(HOR - MU * 0.9, MU * 0.42, 23, 4);
      rg3 = softRidge(HOR - MU * 0.46, MU * 0.3, 37, 3);
      // chairlift: from a summit of the forested ridge down toward the valley on the right
      let xt = 0; for (let x = 1; x < W; x++) if (rg2[x] < rg2[xt]) xt = x;
      LIFT = { xt: xt, yt: Math.round(rg2[xt]) + 4, xb: xt + Math.round(W * 0.36), yb: Math.round(HOR + MU * 0.12) };
      // cabin: on the highest shoulder of the near hills
      let xc = 0; for (let x = 1; x < W; x++) if (rg3[x] < rg3[xc]) xc = x;
      CABIN = { x: xc, y: Math.round(rg3[xc]) + 6 };
      buildLayers();
      const SPAN = W + 60; const sd = { s: 7 }; const R = () => { sd.s = (sd.s * 1103515245 + 12345) & 0x7fffffff; return sd.s / 0x7fffffff; };
      trees = []; const tc = Math.max(20, Math.round(W / 24));
      for (let i = 0; i < tc; i++) {
        const tr = { wx: R() * SPAN, below: 6 + R() * Math.max(MU * 1.5, (H - E0) * 0.72), scale: 2.2 + R() * 2.6, seed: (R() * 1e9) | 0 };
        // keep the spots where the two skiers stand during the intro clear of trees
        const nearStart = [0.40, 0.60].some((f) => Math.abs(tr.wx - f * W) < 20) && tr.below > 14 && tr.below < 86;
        if (!nearStart) trees.push(tr);
      }
      moguls = []; const mc = Math.max(22, Math.round(W / 18));
      for (let i = 0; i < mc; i++) moguls.push({ wx: R() * SPAN, below: 5 + R() * Math.max(MU * 1.6, (H - E0) * 0.82), w: 2 + Math.round(R() * 4) });
      stars = []; const nst = Math.round((W * HOR) / 900);
      for (let i = 0; i < nst; i++) stars.push({ x: (R() * W) | 0, y: (R() * HOR * 0.92) | 0, tw: 0.6 + R() * 2.4, ph: R() * 6.28, big: R() > 0.93 });
      clouds = []; const ncl = Math.max(4, Math.round(W / 130));
      for (let i = 0; i < ncl; i++) {
        const w = 34 + R() * 70, puffs = []; let px0 = 0;
        while (px0 < w) { const r = 4 + R() * 7; puffs.push({ dx: px0, r: Math.round(r) }); px0 += r * (0.9 + R() * 0.6); }
        clouds.push({ x: R() * (W + 200), y: Math.round(H * (0.07 + R() * 0.3)), w: w, puffs: puffs, sp: 1.2 + R() * 2.6 });
      }
      snow = []; const n = Math.round((W * H) / 2400);
      for (let i = 0; i < n; i++) { const sz = Math.random(); const r = sz < 0.62 ? 1 : (sz < 0.9 ? 2 : 3); snow.push({ x: Math.random() * W, y: Math.random() * H, s: 0.35 + r * 0.33 + Math.random() * 0.4, r }); }
      streaks = []; const ns = Math.round((W * H) / 6000);
      for (let i = 0; i < ns; i++) streaks.push({ x: Math.random() * W, y: H * 0.4 + Math.random() * H * 0.6, len: 3 + Math.round(Math.random() * 4) });
    }
    // --- Mountain layers: indexed-palette baking ----------------------------
    // The geometry (which material each pixel is, which way its face points, how deep in the
    // haze it sits) never changes, so it is baked ONCE into a Uint16 index map. Recolouring
    // then only builds a small colour table and blits it with a packed-Uint32 copy, so the
    // light can swing across the peaks as the sun and moon move without re-drawing anything.
    const _le = (() => { const b = new ArrayBuffer(4); new Uint32Array(b)[0] = 1; return new Uint8Array(b)[0] === 1; })();
    const pack = _le
      ? ((r, g, b) => ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0)
      : ((r, g, b) => ((r << 24) | (g << 16) | (b << 8) | 255) >>> 0);
    function slotter() {
      const map = new Map(), recipes = [null]; // slot 0 = transparent
      return { recipes: recipes, slot: (key, rec) => { let s = map.get(key); if (s === undefined) { s = recipes.length; recipes.push(rec); map.set(key, s); } return s; } };
    }

    // Alpine range. Each mountain gets a zig-zag spine running down from its summit; pixels left
    // of it belong to the left face, pixels right of it to the right face, so one side can sit
    // in light and the other in shadow. Diagonal strata give each face ribs and gullies.
    // Recipe: ['A', material (0 snow, 1 rock, 2 forest), face (0 left, 1 right), shade (0 hi, 1 mid, 2 dark), haze step 0..3]
    function bakeAlpine(ridge, opt) {
      const idx = new Uint16Array(W * H), S = slotter(), R = prand(opt.seed * 7919 + 1);
      const sg = ridgeSegments(ridge, Math.max(3, Math.round(W / 70)));
      for (const s of sg.segs) {
        const spine = new Int16Array(H); let sx = s.pk, dir = R() < 0.5 ? -1 : 1, run = 0;
        for (let dp = 0; dp < H; dp++) {
          spine[dp] = sx;
          if (--run <= 0) { if (R() < 0.75) dir = -dir; run = 2 + Math.floor(R() * 6); }
          if (R() < 0.62) sx += dir;
          sx = Math.max(s.x0 + 1, Math.min(s.x1 - 1, sx));
        }
        s.spine = spine;
      }
      const ribCells = Math.max(8, Math.round(W / 7)), gulCells = Math.max(4, Math.round(W / 46));
      const ribA = new Float32Array(W), ribB = new Float32Array(W), gul = new Float32Array(W);
      for (let x = 0; x < W; x++) { ribA[x] = pnoise(x / W, ribCells, opt.seed + 3); ribB[x] = pnoise(x / W, ribCells, opt.seed + 5); gul[x] = pnoise(x / W, gulCells, opt.seed + 9); }
      // the creases between neighbouring mountains wander from row to row instead of dropping straight down
      const crease = new Int16Array(H);
      for (let y = 0; y < H; y++) crease[y] = Math.round((pnoise(y / 640, 64, opt.seed + 21) - 0.5) * 22 + (pnoise(y / 192, 64, opt.seed + 4) - 0.5) * 6);
      for (let x = 0; x < W; x++) {
        const top = Math.round(ridge[x]);
        for (let y = Math.max(0, top); y < H; y++) {
          const s = sg.segs[sg.segOf[wrapX(x + crease[y])]];
          let xu = x; if (xu < s.x0 - W / 2) xu += W; else if (xu > s.x1 + W / 2) xu -= W;
          const vis = Math.max(14, HOR - s.py);
          const d = y - top, dp = Math.min(H - 1, Math.max(0, y - s.py));
          const face = xu < s.spine[dp] ? 0 : 1;
          const rib = face === 0 ? ribA[wrapX(Math.round(x + y * 0.9))] : ribB[wrapX(Math.round(x - y * 0.9))];
          let shade = rib > 0.68 ? 2 : (rib < 0.2 ? 0 : 1);
          const hgt = (y - s.py) / vis;   // 0 at the summit, 1 down at the horizon
          const snowLine = opt.snowFrac * (0.7 + 0.6 * gul[x]) + (rib > 0.6 ? 0.14 : 0);
          let mat = hgt < snowLine - bayer(x, y) * 0.07 ? 0 : 1;
          if (mat === 1 && rib < 0.22 && hgt < snowLine + 0.3) mat = 0;                          // snow caught on ledges
          if (mat === 0 && rib > 0.74 && hgt > snowLine * 0.45) mat = 1;                         // rock ribs showing through
          if (opt.forest && hgt > opt.forest - 0.12 * gul[x] - bayer(x, y) * 0.03) mat = 2;
          if (d < 1) shade = 0;                                                                // catch-light on the crest
          const fade = dither((hgt - opt.fadeFrom) / (1 - opt.fadeFrom), 3, x, y);
          idx[y * W + x] = S.slot('A' + mat + face + shade + fade, ['A', mat, face, shade, fade]);
        }
      }
      const peaks = sg.segs.slice().sort((a, b) => a.py - b.py).slice(0, 3).map((s) => ({ x: wrapX(s.pk), y: s.py }));
      return { idx: idx, recipes: S.recipes, peaks: peaks };
    }

    // Forested ridge: a canopy of little pines with snow on their tips, cut by ski runs and
    // the chairlift line, with a bare snowy summit here and there.
    // Recipe: ['F', kind (0 gap, 1 pine left half, 2 pine right half, 3 snowy tip, 4 open snow, 5 snow edge), haze step 0..2]
    function bakeForest(ridge, opt) {
      const idx = new Uint16Array(W * H), S = slotter(), R = prand(opt.seed * 7919 + 1);
      const bald = new Float32Array(W), canopy = new Float32Array(W);
      for (let x = 0; x < W; x++) bald[x] = Math.max(0, (pnoise(x / W, 5, opt.seed + 2) - 0.62) * MU * 0.9);
      let tx = 0;
      while (tx < W) {
        const hgt = 3 + R() * 6, half = Math.ceil(hgt / 2);
        for (let k = -half; k <= half; k++) { const xx = wrapX(tx + k); if (bald[xx] <= 0) canopy[xx] = Math.max(canopy[xx], hgt - Math.abs(k) * 2); }
        tx += 2 + Math.floor(R() * 4);
      }
      let rmin = Infinity; for (let x = 0; x < W; x++) rmin = Math.min(rmin, ridge[x]);
      const pistes = [];
      for (let i = 0; i < 3; i++) { const x0 = Math.floor(R() * W); pistes.push({ x0: x0, y0: ridge[x0], slant: (R() - 0.35) * 0.7, ph: R() * 6.28 }); }
      const liftSlope = (LIFT.yb - LIFT.yt) / (LIFT.xb - LIFT.xt);
      const ncol = Math.max(4, Math.round(W / 6)), cw = W / ncol, ch = 7;
      for (let x = 0; x < W; x++) {
        const rtop = Math.round(ridge[x]), top = Math.round(ridge[x] - canopy[x]);
        for (let y = Math.max(0, top); y < H; y++) {
          const d = y - rtop; let kind;
          if (y < rtop) kind = (y === top) ? 3 : (hash2(x, y, opt.seed) > 0.5 ? 2 : 1);     // canopy silhouette
          else if (d < bald[x]) kind = (d > bald[x] - 1.5) ? 5 : 4;                           // bare summit
          else {
            kind = -1;
            for (const p of pistes) {
              const dy = y - p.y0; if (dy < 3) continue;
              const cx = p.x0 + dy * p.slant + Math.sin(dy * 0.07 + p.ph) * 9, hw = Math.min(8, 2 + dy * 0.06);
              let dx = Math.abs(wrapX(x - Math.round(cx))); if (dx > W / 2) dx = W - dx;
              if (dx < hw) { kind = dx > hw - 1.3 ? 5 : 4; break; }
            }
            if (kind < 0) {
              for (let k = 0; k < 2; k++) {                                                   // chairlift clearing
                const xu = x + k * W;
                if (xu >= LIFT.xt - 2 && xu <= LIFT.xb + 2) { const ly = LIFT.yt + (xu - LIFT.xt) * liftSlope; if (Math.abs(y - ly) <= 3) kind = Math.abs(y - ly) > 2 ? 5 : 4; }
              }
            }
            if (kind < 0) {
              const row = Math.floor(y / ch), gx = x / cw + ((row & 1) ? 0.5 : 0), col = Math.floor(gx) % ncol;
              const fx = (gx - Math.floor(gx)) * cw, j = hash2(col, row, opt.seed);
              const fy = y - row * ch - Math.floor(hash2(col, row, opt.seed + 9) * 3);     // stagger the pines so they don't line up in rows
              const apex = cw / 2 + (j - 0.5) * 2.6, off = fx - apex;
              const meadow = pnoise(x / W, 7, opt.seed + 70) * 0.6 + pnoise(y / 320, 20, opt.seed + 71) * 0.4;
              // between the pines: shaded snow in the open stands, dark understory in the thick ones
              const ground = meadow > 0.7 ? 4 : (meadow > 0.42 ? 5 : 0);
              if (meadow > 0.7 || fy < 0 || hash2(col, row, opt.seed + 50) < 0.16) kind = ground;          // no tree in this spot
              else if (Math.abs(off) <= (fy + 1) * (0.36 + j * 0.18)) kind = (fy === 0 || (fy === 1 && j > 0.45)) ? 3 : (off < 0 ? 1 : 2);
              else kind = ground;
            }
          }
          const fade = dither(((y - rmin) / Math.max(20, HOR - rmin) - 0.45) / 0.55, 2, x, y);
          idx[y * W + x] = S.slot('F' + kind + fade, ['F', kind, fade]);
        }
      }
      return { idx: idx, recipes: S.recipes };
    }

    // Near snow hills: soft slopes shaded by which way they face, wind-sculpted contour lines,
    // and scattered clumps of small pines.
    // Recipes: ['H', facing 0..4 (4 = faces left), depth 0..3], ['P', 0 trunk / 1 dark / 2 mid / 3 snow]
    function bakeHills(ridge, opt) {
      const idx = new Uint16Array(W * H), S = slotter(), R = prand(opt.seed * 7919 + 1);
      for (let x = 0; x < W; x++) {
        const top = Math.round(ridge[x]);
        const slope = ridge[wrapX(x + 5)] - ridge[wrapX(x - 5)];
        const face = clamp01(0.5 - slope * 0.09);
        const wob = Math.round(pnoise(x / W, 9, opt.seed) * 10);
        for (let y = Math.max(0, top); y < H; y++) {
          const d = y - top;
          const f = 0.5 + (face - 0.5) * Math.max(0.25, 1 - d / (MU * 0.9));
          const fl = dither(f, 4, x, y, 0.4);
          let dl = dither(Math.min(1, d / (MU * 1.1)), 3, x, y, 0.5);
          if (d > 4 && (d + wob) % 13 === 0 && ((x + y) & 1)) dl = Math.min(3, dl + 1);
          idx[y * W + x] = d < 1 ? S.slot('c:crest', ['c', 'crest']) : S.slot('H' + fl + dl, ['H', fl, dl]);
        }
      }
      const stamps = [], nCl = Math.max(4, Math.round(W / 44));
      for (let i = 0; i < nCl; i++) {
        const cx = R() * W, cnt = 2 + Math.floor(R() * 4);
        for (let j = 0; j < cnt; j++) {
          const x = Math.round(wrapX(cx + (R() - 0.5) * 30)), by = Math.round(ridge[x] + 2 + R() * MU * 0.45), hgt = 6 + Math.floor(R() * 7);
          let dxc = Math.abs(x - CABIN.x); if (dxc > W / 2) dxc = W - dxc;
          if (dxc < 20) continue;                       // keep the cabin's clearing open
          stamps.push({ x: x, by: by, h: hgt });
        }
      }
      for (const k of [-19, 17]) stamps.push({ x: wrapX(CABIN.x + k), by: CABIN.y + 2 + (k > 0 ? 1 : 0), h: 11 + (k > 0 ? 2 : 0) });   // two pines framing the cabin
      stamps.sort((a, b) => a.by - b.by);
      const put = (x, y, key, rec) => { if (y >= 0 && y < H) idx[y * W + wrapX(x)] = S.slot(key, rec); };
      for (const t of stamps) {
        put(t.x + 1, t.by + 1, 'H03', ['H', 0, 3]); put(t.x + 2, t.by + 1, 'H03', ['H', 0, 3]); put(t.x + 3, t.by + 1, 'H03', ['H', 0, 3]);   // ground shadow
        put(t.x, t.by, 'P0', ['P', 0]);
        for (let r = 0; r < t.h; r++) {
          const half = Math.floor(r * 0.42 + (r % 3 === 2 ? 1 : 0)), y = t.by - t.h + r;
          for (let k = -half; k <= half; k++) {
            const sn = r < 2 || (r % 3 === 0 && k <= 0), v = sn ? 3 : (k < 0 ? 1 : 2);
            put(t.x + k, y, 'P' + v, ['P', v]);
          }
        }
      }
      return { idx: idx, recipes: S.recipes };
    }

    function buildLayers() {
      const defs = [
        { ridge: rg0, bake: bakeAlpine, opt: { seed: 7, snowFrac: 0.52, fadeFrom: 0.3, fadeMax: 0.75, haze: 0.4, glow: 0.6 }, src: (P) => ({ snow: lerp(P.farSnow, P.skyHor, 0.25), rock: lerp(P.farRock, P.skyHor, 0.3) }) },
        { ridge: rg1, bake: bakeAlpine, opt: { seed: 13, snowFrac: 0.4, forest: 0.84, fadeFrom: 0.45, fadeMax: 0.6, haze: 0.16, glow: 0.42 }, src: (P) => ({ snow: lerp(P.farSnow, P.midSnow, 0.6), rock: lerp(P.farRock, P.midRock, 0.75) }) },
        { ridge: rg2, bake: bakeForest, opt: { seed: 23, fadeMax: 0.45, haze: 0.08 }, src: (P) => ({ snow: P.midSnow, rock: P.midRock }) },
        { ridge: rg3, bake: bakeHills, opt: { seed: 37, haze: 0 }, src: (P) => ({ snow: lerp(P.nearSnow, P.slopeHi, 0.6), rock: P.nearRock }) }
      ];
      layers = defs.map(function (def) {
        const baked = def.bake(def.ridge, def.opt);
        const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
        const c2 = canvas.getContext('2d');
        const img = c2.createImageData(W, H);
        return { canvas: canvas, ctx: c2, img: img, data32: new Uint32Array(img.data.buffer), lut: new Uint32Array(baked.recipes.length), idx: baked.idx, recipes: baked.recipes, peaks: baked.peaks || [], opt: def.opt, src: def.src };
      });
      t0 = layers[0].canvas; t1 = layers[1].canvas; t2 = layers[2].canvas; t3 = layers[3].canvas;
    }

    // Where the light is coming from. lightK: 1 = from the left, 0 = from the right (it follows
    // whichever of the sun and moon is higher). glowAmt: alpenglow near sunrise and sunset.
    let lightK = 0.5, glowAmt = 0, nightAmt = 0;
    function updateLight() {
      const st = celestialState();
      lightK = Math.max(0.06, Math.min(0.94, 0.5 + (0.5 - st.cx) * 2.4));
      glowAmt = st.s.alt > -0.12 ? clamp01(1 - Math.abs(st.s.alt - 0.1) / 0.3) : 0;
      nightAmt = clamp01((0.1 - st.s.alt) / 0.3);
    }
    function evalRecipe(rec, pal) {
      switch (rec[0]) {
        case 'c': return pal[rec[1]];
        case 'A': {
          const lit = rec[2] === 0 ? pal.k : 1 - pal.k; let col;
          if (rec[1] === 0) { col = lerp(pal.shSnow, pal.snowLit, lit); col = rec[3] === 0 ? lerp(col, pal.snowHi, 0.7) : (rec[3] === 2 ? lerp(col, pal.shSnow, 0.55) : col); }
          else if (rec[1] === 1) { col = lerp(pal.rockSh, pal.rockLit, lit); col = rec[3] === 0 ? lerp(col, pal.rockHi, 0.6) : (rec[3] === 2 ? lerp(col, pal.rockDk, 0.6) : col); }
          else { col = lerp(pal.treeDk, pal.tree, lit); col = rec[3] === 0 ? lerp(col, pal.treeHi, 0.5) : (rec[3] === 2 ? lerp(col, pal.treeDk, 0.6) : col); }
          return lerp(col, pal.haze, (rec[4] / 3) * pal.fadeMax);
        }
        case 'F': {
          let col;
          switch (rec[1]) {
            case 0: col = pal.treeDk; break;
            case 1: col = lerp(pal.treeDk, pal.tree, 0.25 + 0.75 * pal.k); break;
            case 2: col = lerp(pal.treeDk, pal.tree, 0.25 + 0.75 * (1 - pal.k)); break;
            case 3: col = lerp(pal.shSnow, pal.snowLit, 0.8); break;
            case 4: col = pal.snowLit; break;
            default: col = lerp(pal.shSnow, pal.snowLit, 0.35);
          }
          return lerp(col, pal.haze, (rec[2] / 2) * pal.fadeMax);
        }
        case 'H': {
          const face = rec[1] / 4, lit = face * pal.k + (1 - face) * (1 - pal.k);
          return lerp(lerp(pal.shSnow, pal.snowLit, clamp01(0.74 + (lit - 0.5) * 1.5)), pal.snowBot, (rec[2] / 3) * 0.2);
        }
        case 'P': return rec[1] === 0 ? pal.trunk : (rec[1] === 1 ? pal.treeDk : (rec[1] === 2 ? pal.tree : lerp(pal.shSnow, pal.snowLit, 0.85)));
      }
      return '#000000';
    }
    function recolorLayer(L) {
      const sr = L.src(PAL), pal = layerPal(sr.snow, sr.rock);
      pal.k = lightK; pal.haze = PAL.skyHor; pal.fadeMax = L.opt.fadeMax || 0;
      pal.shSnow = lerp(pal.snowSh2, PAL.skyTop, 0.3);                      // shadows on snow pick up the sky
      // evergreens darken toward the sky colour at night instead of staying daytime green
      const dim = 0.55 * nightAmt;
      pal.tree = lerp(pal.tree, PAL.skyTop, dim); pal.treeHi = lerp(pal.treeHi, PAL.skyTop, dim); pal.treeDk = lerp(pal.treeDk, PAL.skyTop, dim);
      pal.trunk = lerp('#3a2c22', PAL.skyTop, dim);
      if (L.opt.glow) { const g = glowAmt * L.opt.glow, warm = lerp(PAL.sun, '#ff9c7c', 0.55); pal.snowLit = lerp(pal.snowLit, warm, g * 0.6); pal.snowHi = lerp(pal.snowHi, warm, g * 0.45); }
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
    function rebakeRanges() { if (!layers.length) return; updateLight(); for (let i = 0; i < layers.length; i++) recolorLayer(layers[i]); }
    // Setters used by the UI. setHour/setMood update one axis and keep the other; each
    // re-bakes immediately and (under reduced motion, where there's no loop) renders once.
    function applyScene(h01, mood) { dayHour = ((h01 % 1) + 1) % 1; curMood = mood; PAL = computePalette(dayHour, curMood); rebakeRanges(); bakedHour = dayHour; bakedMood = curMood; if (reduceMotion) render(0, 0.016, 999); }
    function setHour(h01) { applyScene(h01, curMood); }
    function setMood(mood) { applyScene(dayHour, mood); }
    function setPaused(p) { paused = !!p; return paused; }
    function drawTile(c, off) { if (!c) return; const o = ((Math.round(off) % W) + W) % W; ctx.drawImage(c, -o, 0); ctx.drawImage(c, W - o, 0); }

    // Sky: a background gradient stretched along the sun -> moon axis. Lightest at the
    // sun, darkest at the moon; because both endpoints move continuously there is no
    // centre to "jump" — the whole gradient just rotates as the bodies arc across.
    // Each body's own glow is a fixed radial halo drawn in drawCelestial.
    function drawSky() {
      const st = celestialState();
      const light = lerp(PAL.skyHor, PAL.sun, 0.22); // bright, slightly sun-tinted
      const g = ctx.createLinearGradient(st.s.x * W, st.s.y * H, st.m.x * W, st.m.y * H);
      g.addColorStop(0.0, light);     // at the sun
      g.addColorStop(0.5, PAL.skyMid);
      g.addColorStop(1.0, PAL.skyTop); // darkest, at the moon
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    // Shimmering crepuscular rays fanning from the sun. Drawn before the mountains so
    // the lower rays are clipped by the ridgeline; additive blend so they read as light.
    function drawSunRays(cx, cy, r, time, sunFrac) {
      if (sunFrac <= 0.03) return;
      const rays = 14, maxLen = Math.max(W, H) * 0.24, col = lerp(PAL.sun, '#ffffff', 0.4);
      const rot = reduceMotion ? 0 : time * 0.04;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < rays; i++) {
        const ang = (i / rays) * Math.PI * 2 + rot;
        const sh = reduceMotion ? 0.6 : (0.5 + 0.5 * Math.sin(time * 2.2 + i * 1.7)); // shimmer
        const a = 0.08 * sh * sunFrac;
        if (a <= 0.004) continue;
        const len = maxLen * (0.45 + 0.55 * sh), halfW = r * (0.22 + 0.12 * sh);
        const dx = Math.cos(ang), dy = Math.sin(ang), pxp = -dy, pyp = dx;
        ctx.fillStyle = hexA(col, a);
        ctx.beginPath();
        ctx.moveTo(cx + pxp * halfW, cy + pyp * halfW);
        ctx.lineTo(cx - pxp * halfW, cy - pyp * halfW);
        ctx.lineTo(cx + dx * len, cy + dy * len);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
    function drawCelestial(time) {
      const wob = reduceMotion ? 0 : Math.sin(time * 0.7) * 0.4;
      const st = celestialState();
      const s = st.s, m = st.m;
      // moon first (so an overlapping sun glow sits on top at the crossover)
      if (m.alt > -0.12) {
        const cx = Math.round(W * m.x), cy = Math.round(H * m.y), r = 10 + wob;
        haloGradient(cx, cy, r * 3.2, MOON_GLOW, 0.30); // fixed, small, dim halo
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
        const cx = Math.round(W * s.x), cy = Math.round(H * s.y), r = (PAL.sunR || 6) * 2 + wob;
        drawSunRays(cx, cy, r, time, st.sunFrac);
        haloGradient(cx, cy, r * 4, PAL.sun, 0.55); // fixed bright halo
        disc(cx, cy, r, lerp(PAL.sun, '#ffffff', 0.5)); // ~50% whiter disc
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
      const sho = Math.round((lightK - 0.5) * baseHalf * 1.6), shc = hexA(PAL.slopeShade, 0.55);
      px(x - baseHalf + sho, baseY + 1, baseHalf * 2 + 1, 1, shc); px(x - baseHalf + 2 + sho, baseY + 2, Math.max(1, baseHalf * 2 - 3), 1, shc);
      px(x, baseY - 1, Math.max(1, Math.round(scale * 0.5)), 3, PINEC.trunk);
      px(x - Math.round(scale) - 1, baseY, (Math.round(scale) + 1) * 2 + 1, 1, hexA('#ffffff', 0.82));
      px(x - Math.round(scale), baseY - 1, Math.round(scale) * 2 + 1, 1, hexA('#dfeaf2', 0.66));
      for (let j = 0; j < layers; j++) {
        const f = j / (layers - 1); const cx = x + Math.round(lean * f * totalH * 0.12);
        const half = Math.max(1, Math.round(baseHalf * (1 - f * 0.7)));
        const topY = Math.round(baseY - step * (j + 1)); const skirtH = Math.max(2, Math.round(step) + 1);
        for (let row = 0; row < skirtH; row++) {
          const rr = row / skirtH, sp = Math.max(0, Math.round(half * (0.25 + 0.95 * rr)));
          px(cx - sp, topY + row, sp * 2 + 1, 1, PINEC.dark);
          if (sp > 0) px(cx + 1, topY + row, sp, 1, PINEC.mid);
          if (sp > 1 && rr > 0.4) px(cx + Math.max(1, sp - 1), topY + row, 1, 1, PINEC.lite);
          const spr = 0.55 - rr * 0.85;
          if (spr > 0) { for (let k = -sp; k <= sp; k++) { if (R() < spr) px(cx + k, topY + row, 1, 1, (k >= 0 ? PINEC.snow : PINEC.snowSh)); } }
        }
        const by = topY + skirtH;
        for (let k = -half; k <= half; k++) { if (R() < 0.4) px(cx + k, by, 1, 1, (k >= 0 ? PINEC.mid : PINEC.dark)); }
        for (let k = -half; k <= half; k++) { if (R() < 0.32) px(cx + k, by - 1, 1, 1, (k >= 0 ? PINEC.snow : PINEC.snowSh)); }
      }
      const tx = x + Math.round(lean * totalH * 0.12), ty = Math.round(baseY - step * layers - 1);
      px(tx, ty, 1, 2, PINEC.dark); px(tx, ty, 1, 1, PINEC.snow);
    }

    // ---- skiers -------------------------------------------------------------------
    // Each skier is posed from a small rig (skis, legs, torso, arms, head) into its own little
    // canvas every frame, then given a one-pixel dark outline, so the whole turn animates
    // smoothly: skis swing with the direction of travel, knees sink at the apex, the view of
    // the body changes as they turn toward or away from us.
    const SKI = { A: { y: null, x: null, h: 0 }, B: { y: null, x: null, h: 0 } };
    const TURN_RATE = 1.3;                      // radians per second through the S-turns
    let spray = [];
    function screenXOf(tr) { const SPAN = W + 60; return ((((tr.wx - camX) % SPAN) + SPAN) % SPAN); }
    // Returns where the skier's feet are (sx, fy) and the pose inputs. `go` eases 0 -> 1 as they set off.
    function steer(time, which, moving, dt, go) {
      const S = SKI[which];
      const baseX0 = (which === 'A' ? 0.40 : 0.60) * W;
      const driftAmp = moving ? W * 0.06 : W * 0.02;
      let targetX = baseX0 + Math.sin(time * 0.33 + (which === 'A' ? 0 : 2.1)) * driftAmp * go;
      const other = SKI[which === 'A' ? 'B' : 'A'];
      if (other.x !== null) {
        const cur = (S.x === null ? targetX : S.x); const dx = cur - other.x; const minGap = Math.max(30, W * 0.085);
        if (Math.abs(dx) < minGap) { targetX += (dx >= 0 ? 1 : -1) * (minGap - Math.abs(dx)) * 0.6; }
      }
      if (S.x === null) S.x = targetX;
      S.x += (targetX - S.x) * 0.07;
      const baseX = Math.round(S.x);
      const baseY = edge(baseX) + (which === 'A' ? 21 : 23);
      const amp = Math.max(9, MU * 0.22) * go;
      const carve = reduceMotion ? 0 : Math.sin(time * TURN_RATE + (which === 'A' ? 0 : 1.15));
      let targetY = baseY + carve * amp;
      if (S.y === null) S.y = targetY;
      if (moving) {
        const rx = Math.max(13, W * 0.038); let nd = rx, ny = 0, found = false;
        for (const tr of trees) {
          const tx = screenXOf(tr); const dxs = Math.abs(tx - baseX);
          if (dxs < nd) { const ty = edge(tx) + tr.below; if (ty > baseY - amp - 12 && ty < baseY + amp + 14) { nd = dxs; ny = ty; found = true; } }
        }
        if (found) { const k = 1 - nd / rx; targetY += (S.y <= ny ? -1 : 1) * k * 8 * go; }
      }
      targetY = Math.max(baseY - amp - 6, Math.min(baseY + amp + 12, targetY));
      const prev = S.y; S.y += (targetY - S.y) * 0.12;
      // heading: +1 = cutting down the screen toward us, -1 = heading up and away
      const vy = (S.y - prev) / Math.max(dt, 0.004);
      const hv = amp > 0.5 ? Math.max(-1, Math.min(1, vy / (amp * TURN_RATE))) : 0;
      S.h += (hv - S.h) * 0.18;
      return { sx: baseX, fy: Math.round(S.y), h: S.h, carve: carve * go, turn: Math.abs(carve) * go, moving: moving, go: go, which: which };
    }
    function emitSpray(p) {
      if (reduceMotion || !p || p.go < 0.5) return;
      const n = Math.round(Math.max(0, p.turn - 0.45) * 12);
      for (let i = 0; i < n; i++) {
        spray.push({
          x: p.sx - 9 + (Math.random() * 6 - 3), y: p.fy - 1 + Math.random() * 3,
          vx: -(0.3 + Math.random() * 1.1), vy: -(0.5 + Math.random() * 1.7) + p.carve * 0.5,
          life: 0.6 + Math.random() * 0.6, sz: (Math.random() < 0.45 ? 1 : (Math.random() < 0.85 ? 2 : 3))
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
        if (s.sz >= 2) px(s.x + 1, s.y + 1, s.sz, s.sz, hexA(PAL.slopeShade, a * 0.6));
        px(s.x, s.y, s.sz, s.sz, hexA(lerp('#f4f9ff', PAL.slopeHi, 0.75 * nightAmt), a));
      }
    }

    const SPR_W = 76, SPR_H = 64, SPR_OX = 36, SPR_OY = 48;   // sprite canvas; (OX, OY) is the point between the feet
    const mkSprite = () => { const c = document.createElement('canvas'); c.width = SPR_W; c.height = SPR_H; return { c: c, g: c.getContext('2d', { willReadFrequently: true }) }; };
    const SPRITES = { A: mkSprite(), B: mkSprite() };
    const OUTLINE = pack(0x14, 0x1a, 0x2c);
    // Head art, 7 x 7, in three views. H helmet, h highlight, s shade, G goggle lens, g lens glint,
    // S goggle strap, k skin, K skin shade.
    const HEADS = {
      front: ['..HHHH.', '.HhhHHH', '.HHHHHH', 'sHSGGGg', 'sHSGGGG', '.sHkkkk', '..kkkK.'],
      side: ['..HHHH.', '.HhhHHH', 'sHHHHHH', 'sHHSGGg', 'sHHSGGG', '.sHHkkk', '..skkK.'],
      back: ['..HHHH.', '.HhhHHH', 'sHHHHHH', 'sSSSSSH', 'sHHHHHG', '.sHHHHk', '..sHHk.']
    };
    function drawSkier(time, which, p, K) {
      const S = SPRITES[which], g = S.g, h = p.h, go = p.go;
      g.globalCompositeOperation = 'source-over';
      g.clearRect(0, 0, SPR_W, SPR_H);
      const P = (x, y, w, hh, col) => { g.fillStyle = col; g.fillRect(SPR_OX + Math.round(x), SPR_OY + Math.round(y), w, hh); };
      const Ln = (x0, y0, x1, y1, col, tw, th) => {
        x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
        let dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx - dy;
        g.fillStyle = col;
        for (;;) { g.fillRect(SPR_OX + x0 - ((tw || 1) >> 1), SPR_OY + y0, tw || 1, th || 1); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 > -dy) { err -= dy; x0 += sx; } if (e2 < dx) { err += dx; y0 += sy; } }
      };
      const t = reduceMotion ? 0 : time;
      const idle = 1 - go;
      const crouch = (1 + Math.abs(p.carve) * 2.4) * go + (reduceMotion ? 0 : Math.sin(t * 2.2 + (which === 'A' ? 0 : 1.7)) * 0.5 * idle);
      // skis point where the skier is heading; the far ski sits a little up the screen
      const ang = 0.10 + h * 0.44, cx = Math.cos(ang), sy = Math.sin(ang);
      const F = { x: 2.6 * sy, y: -2.6 * cx - 0.5 }, N = { x: -2.6 * sy, y: 2.6 * cx - 0.5 };
      const ski = (o, lead) => {
        const tx = o.x + cx * (13 + lead), ty = o.y + sy * (13 + lead), bx = o.x - cx * (10 - lead), by = o.y - sy * (10 - lead);
        Ln(bx, by + 1, tx, ty + 1, K.skiEdge); Ln(bx, by, tx, ty, K.ski);
        P(tx + 1, ty - 1, 1, 1, K.ski); P(tx + 2, ty - 2, 1, 1, K.ski);
      };
      ski(F, h > 0 ? 0 : 1.5); ski(N, h > 0 ? 1.5 : 0);
      // body joints
      const hip = { x: -3 + h * 0.6, y: -12 + crouch };
      const sh = { x: hip.x + 6 - crouch * 0.25, y: hip.y - 10 + crouch * 0.45 };
      const kF = { x: F.x + 3.5, y: F.y - 7 + crouch * 0.5 }, kN = { x: N.x + 3.5, y: N.y - 7 + crouch * 0.5 };
      const spread = 1 + h;
      const handF = { x: sh.x + 7, y: sh.y + 6 - spread }, handN = { x: sh.x + 6, y: sh.y + 8 + spread * 0.6 };
      // far arm and far leg first (they sit behind the body)
      Ln(sh.x + 2, sh.y + 1, sh.x + 4, sh.y + 5, K.jacketSh, 2, 2); Ln(sh.x + 4, sh.y + 5, handF.x, handF.y, K.jacketSh, 2, 2);
      P(handF.x, handF.y, 2, 2, K.glove);
      P(F.x - 1, F.y - 3, 4, 3, K.boot);
      Ln(F.x + 1, F.y - 4, kF.x, kF.y, K.pantsSh, 3, 2); Ln(kF.x, kF.y, hip.x + 1, hip.y, K.pantsSh, 3, 2);
      // near leg
      P(N.x - 1, N.y - 3, 4, 3, K.boot); P(N.x - 1, N.y - 3, 4, 1, K.bootHi);
      Ln(N.x + 1, N.y - 4, kN.x, kN.y, K.pants, 3, 2); Ln(kN.x, kN.y, hip.x, hip.y + 1, K.pants, 3, 2);
      Ln(kN.x + 1, kN.y, hip.x + 1, hip.y + 1, K.pantsHi, 1, 1);
      // torso, leaning forward into the fall line
      const view = h > 0.3 ? 'front' : (h < -0.3 ? 'back' : 'side');
      for (let i = 0; i <= 10; i++) {
        const k = i / 10, tx = hip.x + 1 + (sh.x - hip.x - 1) * k, ty = hip.y + (sh.y - hip.y) * k;
        P(tx - 3, ty, 7, 1, K.jacket); P(tx - 3, ty, 2, 1, K.jacketSh);
        if (i === 0) P(tx - 3, ty, 7, 1, K.jacketSh);
        if (view === 'front') { P(tx + 1, ty, 1, 1, K.trim); if (i === 6 || i === 7) { P(tx - 1, ty, 2, 1, K.accent); P(tx + 2, ty, 2, 1, K.accent); } }
        else if (view === 'back') { if (i >= 3 && i <= 8) { P(tx - 2, ty, 5, 1, i === 8 ? K.accentHi : K.accent); } }
        else { if (i >= 3 && i <= 8) P(tx - 4, ty, 2, 1, i === 8 ? K.accentHi : K.accent); if (i === 6) P(tx - 1, ty, 5, 1, K.accent); }
      }
      // scarf: hangs while standing, streams out behind at speed
      for (let i = 0; i < 5; i++) {
        const fl = reduceMotion ? 0 : Math.sin(t * 11 + i * 1.1 + (which === 'A' ? 0 : 2)) * (0.3 + i * 0.4);
        P(sh.x - 3 - i * 1.9 * go, sh.y - 1 + i * 1.5 * idle + fl * go, 2, 2, (i & 1) ? K.scarfSh : K.scarf);
      }
      // head
      const hx = sh.x - 2, hy = sh.y - 8, map = HEADS[view];
      const HC = { H: K.helmet, h: K.helmetHi, s: K.helmetSh, G: K.lens, g: K.lensHi, S: K.strap, k: K.skin, K: K.skinSh };
      for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) { const ch = map[r][c]; if (ch !== '.') P(hx + c, hy + r, 1, 1, HC[ch]); }
      if (K.pom) { P(hx + 1, hy + 2, 6, 1, K.helmetHi); P(hx + 2, hy - 2, 3, 2, K.pom); P(hx + 3, hy - 3, 1, 1, K.pom); }
      // near arm, over the torso
      Ln(sh.x - 1, sh.y + 2, sh.x + 2, sh.y + 6, K.jacket, 2, 2); Ln(sh.x + 2, sh.y + 6, handN.x, handN.y, K.jacket, 2, 2);
      P(sh.x + 3, sh.y + 6, 2, 1, K.accent); P(handN.x, handN.y, 2, 2, K.glove);

      // one-pixel outline around everything drawn so far
      const img = g.getImageData(0, 0, SPR_W, SPR_H), d32 = new Uint32Array(img.data.buffer), src = new Uint32Array(d32);
      for (let y = 1; y < SPR_H - 1; y++) for (let x = 1; x < SPR_W - 1; x++) {
        const i = y * SPR_W + x;
        if (src[i] === 0 && (src[i - 1] !== 0 || src[i + 1] !== 0 || src[i - SPR_W] !== 0 || src[i + SPR_W] !== 0)) d32[i] = OUTLINE;
      }
      g.putImageData(img, 0, 0);
      // poles: thin, no outline. They trail behind at speed; the downhill one reaches forward
      // to plant as one turn hands over to the next; planted upright while standing.
      const plant = go * Math.max(0, 1 - Math.abs(p.carve) * 2.4) * (h > 0 ? 1 : 0.4);
      const tipN = { x: handN.x + (-10 + 13 * plant) * go + 1 * idle, y: handN.y + (N.y + 3 - handN.y) * (go > 0 ? 1 : 1) };
      const tipF = { x: handF.x - 9 * go + 1 * idle, y: F.y + 2 };
      tipN.y = N.y + 3;
      Ln(handN.x + 1, handN.y + 1, tipN.x, tipN.y, K.pole); P(tipN.x - 1, tipN.y - 1, 3, 1, K.basket);
      g.globalCompositeOperation = 'destination-over';      // the far pole goes behind the body
      Ln(handF.x + 1, handF.y + 1, tipF.x, tipF.y, K.pole); P(tipF.x - 1, tipF.y - 1, 3, 1, K.basket);
      if (nightAmt > 0.02) { g.globalCompositeOperation = 'source-atop'; g.fillStyle = hexA('#0b1226', 0.42 * nightAmt); g.fillRect(0, 0, SPR_W, SPR_H); }
      g.globalCompositeOperation = 'source-over';
      // soft shadow on the snow, thrown away from the light
      const so = Math.round((lightK - 0.5) * 10), shc = hexA(PAL.slopeShade, 0.6);
      px(p.sx - 8 + so, p.fy + 3, 19, 1, shc); px(p.sx - 5 + so, p.fy + 4, 14, 1, shc);
      ctx.drawImage(S.c, p.sx - SPR_OX, p.fy - SPR_OY);
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
    let resizeTimer = 0;
    window.addEventListener('resize', function () { clearTimeout(resizeTimer); resizeTimer = setTimeout(resize, 140); }, { passive: true });
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
