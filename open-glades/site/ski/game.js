/*
 * Glade Run — the Open Glades downhill mini game.
 *
 * A top-down pixel-art ski run through procedurally generated glades: evergreens, golden
 * aspens, saplings, tree wells, fallen logs, rocks, kickers and cliff bands. Three falls
 * end the run. Points come from distance, air time, hops and time skied without falling.
 *
 * Everything is drawn in code onto a low-resolution canvas (no image assets).
 */
(function () {
  'use strict';

  const $ = function (id) { return document.getElementById(id); };
  const cv = $('ski-canvas');
  const ctx = cv.getContext('2d');
  const HALF = Math.PI / 2;
  const API = '/ski/api';

  // ---- small helpers ----------------------------------------------------------------
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function smooth(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function hash(ix, iy, s) {
    let h = Math.imul(ix | 0, 0x27d4eb2d) ^ Math.imul(iy | 0, 0x165667b1) ^ Math.imul(s | 0, 0x9e3779b1);
    h = Math.imul(h ^ (h >>> 15), 0x85ebca6b); h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function vnoise(x, y, s) {
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const a = hash(ix, iy, s), b = hash(ix + 1, iy, s), c = hash(ix, iy + 1, s), d = hash(ix + 1, iy + 1, s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function mulberry(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hexRgb(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
  function mix(a, b, t) {
    const A = hexRgb(a), B = hexRgb(b);
    return 'rgb(' + Math.round(A[0] + (B[0] - A[0]) * t) + ',' + Math.round(A[1] + (B[1] - A[1]) * t) + ',' + Math.round(A[2] + (B[2] - A[2]) * t) + ')';
  }
  function fmtTime(t) { const m = Math.floor(t / 60), s = Math.floor(t % 60); return m + ':' + (s < 10 ? '0' : '') + s; }

  // ---- palette ----------------------------------------------------------------------
  const C = {
    snow: '#f2f6fb', snowSh: '#d6e1f1', snowDk: '#bccbe4', hole: '#9db0d0', track: '#c6d4e8', white: '#ffffff',
    pineD: '#14403a', pineM: '#1f5c4b', pineL: '#30805f', trunk: '#4a3526',
    bark: '#5b3d2a', barkD: '#3f2a1d', barkHi: '#8a623f', wood: '#d0aa74', woodD: '#a37c4b',
    aspT: '#efe9da', aspSh: '#cfc6b2', aspN: '#4a4038', gold: '#f2b84b', goldD: '#d2892b', goldL: '#ffe391',
    rock: '#727b93', rockD: '#4b526b', rockL: '#9ba5bb', rockW: '#5d5562',
    flag: '#ee6c4d', glass: '#ffd27a', door: '#3a2618', carrot: '#f08a3c', red: '#d9534f'
  };
  const OUT = [20, 26, 44];        // sprite outline (dark navy)
  const SOFT = [142, 163, 196];    // soft outline for white-on-white shapes

  const KITS = {
    A: { jacket: '#1f8a9c', jacketSh: '#156575', accent: '#2b3550', pants: '#465689', pantsSh: '#35426c', boot: '#141a2c', scarf: '#ffce5c', scarfSh: '#d9a53a', glove: '#1b2236', helmet: '#e7eef4', helmetHi: '#ffffff', skin: '#f0c9a0', skinSh: '#d8a87f', strap: '#161b29', lens: '#7fd0e0', lensHi: '#d8f4fb', ski: '#ffce5c', skiEdge: '#c9972f', pole: '#8d7a55' },
    B: { jacket: '#ee6c4d', jacketSh: '#c2542a', accent: '#ffce5c', pants: '#5a4a86', pantsSh: '#443867', boot: '#141a2c', scarf: '#7fd0e0', scarfSh: '#4fa3b5', pom: '#fff6e6', glove: '#2a1d18', helmet: '#3d7a5c', helmetHi: '#5fa37f', skin: '#e8bd92', skinSh: '#cf9a6f', strap: '#161b29', lens: '#ffcf5c', lensHi: '#fff3c4', ski: '#7fd0e0', skiEdge: '#3f8ea0', pole: '#8d7a55' },
    santa: { style: 'santa', jacket: '#d43d3d', jacketSh: '#a62b2b', accent: '#d43d3d', pants: '#d43d3d', pantsSh: '#a62b2b', boot: '#141a2c', scarf: '#ffffff', scarfSh: '#d6e1f1', glove: '#2f7a5c', helmet: '#d43d3d', helmetHi: '#d43d3d', skin: '#f0c9a0', skinSh: '#d8a87f', strap: '#ffffff', lens: '#ffffff', lensHi: '#ffffff', ski: '#2f7a5c', skiEdge: '#ffce5c', pole: '#8d7a55' },
    snowman: { style: 'snowman', jacket: '#ffffff', jacketSh: '#d6e1f1', accent: '#ffffff', pants: '#ffffff', pantsSh: '#d6e1f1', boot: '#d6e1f1', scarf: '#d9534f', scarfSh: '#a83a37', glove: '#3f2a1d', helmet: '#141a2c', helmetHi: '#141a2c', skin: '#ffffff', skinSh: '#d6e1f1', strap: '#d9534f', lens: '#d9534f', lensHi: '#d9534f', ski: '#7fd0e0', skiEdge: '#3f8ea0', pole: '#5b3d2a' },
    sasquatch: { style: 'sasquatch', jacket: '#7a5539', jacketSh: '#573a26', accent: '#9a7350', pants: '#7a5539', pantsSh: '#573a26', boot: '#3f2a1d', scarf: '#ffce5c', scarfSh: '#d9a53a', glove: '#3f2a1d', helmet: '#7a5539', helmetHi: '#9a7350', skin: '#c79a74', skinSh: '#a5795a', strap: '#573a26', lens: '#c79a74', lensHi: '#c79a74', ski: '#ee6c4d', skiEdge: '#b94a30', pole: '#8d7a55' }
  };

  // ---- sprite construction ------------------------------------------------------------
  function mk(w, h, fn, outline) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d');
    fn(function (x, y, ww, hh, col) { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), ww, hh); });
    if (outline) {
      const im = g.getImageData(0, 0, w, h), d = im.data, src = new Uint8Array(w * h);
      for (let i = 0; i < w * h; i++) src[i] = d[i * 4 + 3] > 0 ? 1 : 0;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x; if (src[i]) continue;
        if ((x > 0 && src[i - 1]) || (x < w - 1 && src[i + 1]) || (y > 0 && src[i - w]) || (y < h - 1 && src[i + w])) {
          d[i * 4] = outline[0]; d[i * 4 + 1] = outline[1]; d[i * 4 + 2] = outline[2]; d[i * 4 + 3] = 255;
        }
      }
      g.putImageData(im, 0, 0);
    }
    return c;
  }
  function lineP(P, x0, y0, x1, y1, c) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let e = dx + dy;
    for (let n = 0; n < 80; n++) {
      P(x0, y0, 1, 1, c); if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; }
    }
  }
  function ellipse(rx, ry, col) {
    return mk(rx * 2 + 1, ry * 2 + 1, function (P) {
      for (let y = -ry; y <= ry; y++) {
        const hw = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry + 0.3))));
        P(rx - hw, y + ry, hw * 2 + 1, 1, col);
      }
    });
  }

  // A snow-laden conifer: stacked tiers that widen toward the base, lit from the right.
  function pineSprite(halfW, Ht, tierH, seed) {
    const w = halfW * 2 + 3, cx = halfW + 1;
    const c = mk(w, Ht + 4, function (P) {
      const R = mulberry(seed);
      P(cx - (halfW > 4 ? 1 : 0), Ht, halfW > 4 ? 2 : 1, 3, C.trunk);
      for (let r = 0; r < Ht; r++) {
        const t = (r + 1) / Ht, tp = (r % tierH) / Math.max(1, tierH - 1);
        const half = Math.max(0, Math.round((0.24 + 0.76 * t) * halfW * (0.55 + 0.45 * tp)));
        const y = r + 1;
        P(cx - half, y, half * 2 + 1, 1, C.pineD);
        if (half > 0) P(cx, y, half + 1, 1, C.pineM);
        if (half > 1 && R() < 0.6) P(cx + half - 1, y, 1, 1, C.pineL);
        if (tp < 0.34 || r < 2) {                       // snow resting on the top of each tier
          const sn = Math.max(0, half - (tp > 0.2 ? 1 : 0));
          for (let k = -sn; k <= sn; k++) if (R() < 0.86) P(cx + k, y, 1, 1, k >= -sn / 3 ? C.white : C.snowSh);
        } else if (R() < 0.35 && half > 1) {
          P(cx - half + Math.floor(R() * (half * 2)), y, 1, 1, C.snowSh);
        }
      }
      P(cx, 0, 1, 2, C.white);
    });
    c.ax = cx; c.ay = Ht + 3;
    return c;
  }

  // An aspen in late-autumn gold: pale trunk with dark notches under a dusted crown.
  function aspenSprite(Ht, rx, ry, seed) {
    const w = rx * 2 + 3, cx = rx + 1, ccy = ry + 1;
    const c = mk(w, Ht + 1, function (P) {
      const R = mulberry(seed);
      for (let y = ccy; y < Ht; y++) {                  // trunk
        P(cx, y, 2, 1, C.aspT); P(cx, y, 1, 1, C.aspSh);
        if (R() < 0.3) P(cx + (R() < 0.5 ? 0 : 1), y, 1, 1, C.aspN);
      }
      lineP(P, cx, ccy + ry - 1, cx - rx + 2, ccy + 1, C.aspN);   // a couple of bare limbs
      lineP(P, cx + 1, ccy + ry - 2, cx + rx - 1, ccy, C.aspN);
      for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) {
        const d = (x * x) / (rx * rx + 0.5) + (y * y) / (ry * ry + 0.5);
        if (d > 1 || R() > 0.9 - d * 0.42) continue;
        const lit = (x - y) / (rx + ry);                 // upper right catches the light
        let col = lit > 0.28 ? C.goldL : lit < -0.3 ? C.goldD : C.gold;
        if (y < -ry * 0.45 && R() < 0.5) col = C.white;  // snow dusting on top
        P(cx + x, ccy + y, 1, 1, col);
      }
    });
    c.ax = cx + 1; c.ay = Ht;
    return c;
  }

  function buildStatic() {
    const S = {};
    S.pineXL = [1, 2].map(function (s) { return pineSprite(10, 31, 6, 100 + s); });
    S.pineL = [1, 2, 3].map(function (s) { return pineSprite(8, 24, 5, 200 + s); });
    S.pineM = [1, 2, 3].map(function (s) { return pineSprite(6, 17, 4, 300 + s); });
    S.sap = [1, 2, 3].map(function (s) { return pineSprite(4, 10, 3, 400 + s); });
    S.tiny = [1, 2].map(function (s) { return pineSprite(3, 6, 3, 500 + s); });
    S.aspL = [1, 2, 3].map(function (s) { return aspenSprite(25, 6, 6, 600 + s); });
    S.aspS = [1, 2, 3].map(function (s) { return aspenSprite(14, 4, 4, 700 + s); });

    S.bush = mk(9, 6, function (P) {
      P(2, 1, 5, 1, C.white); P(1, 2, 7, 2, C.white); P(0, 4, 9, 1, C.snowSh); P(1, 3, 3, 1, C.snowSh);
      P(2, 0, 1, 2, C.barkD); P(6, 1, 1, 2, C.barkD); P(4, 0, 1, 1, C.bark); P(7, 3, 1, 1, C.barkD); P(0, 3, 1, 1, C.bark);
    }, SOFT); S.bush.ax = 5; S.bush.ay = 6;

    S.rock = [0, 1].map(function (v) {
      const c = mk(13, 10, function (P) {
        const rows = v ? [3, 7, 9, 11, 11, 11, 9] : [5, 7, 9, 11, 11, 9, 7];
        for (let r = 0; r < rows.length; r++) {
          const x0 = 6 - (rows[r] >> 1); P(x0, r + 2, rows[r], 1, C.rock);
          P(x0, r + 2, Math.max(1, rows[r] >> 2), 1, C.rockD); P(x0 + rows[r] - 2, r + 2, 2, 1, C.rockL);
        }
        P(1, 8, 11, 1, C.rockD); P(4, 5, 2, 1, C.rockD); P(7, 6, 1, 2, C.rockD);
        P(4, 1, 5, 1, C.white); P(3, 2, 7, 1, C.white); P(3, 3, 3, 1, C.snowSh); P(7, 3, 2, 1, C.white);
      }); c.ax = 6; c.ay = 9; return c;
    });

    S.stump = mk(8, 8, function (P) {
      P(1, 3, 6, 4, C.bark); P(1, 3, 1, 4, C.barkD); P(6, 3, 1, 4, C.barkHi); P(0, 6, 1, 1, C.barkD); P(7, 6, 1, 1, C.bark);
      P(1, 1, 6, 2, C.wood); P(3, 1, 2, 1, C.woodD); P(1, 0, 5, 1, C.white); P(1, 1, 3, 1, C.white);
    }); S.stump.ax = 4; S.stump.ay = 7;

    S.snowman = mk(13, 16, function (P) {
      P(4, 9, 5, 1, C.white); P(3, 10, 7, 4, C.white); P(4, 14, 5, 1, C.snowSh); P(3, 12, 2, 2, C.snowSh);
      P(4, 5, 5, 4, C.white); P(4, 7, 1, 2, C.snowSh);
      P(5, 1, 3, 1, C.white); P(4, 2, 5, 3, C.white); P(4, 3, 1, 2, C.snowSh);
      P(5, 2, 1, 1, OUTHEX); P(7, 2, 1, 1, OUTHEX); P(6, 3, 3, 1, C.carrot);
      P(4, 5, 5, 1, C.red); P(8, 6, 1, 2, C.red);
      P(6, 7, 1, 1, OUTHEX); P(6, 11, 1, 1, OUTHEX);
      lineP(P, 3, 7, 0, 5, C.barkD); lineP(P, 9, 7, 12, 5, C.barkD);
    }, SOFT); S.snowman.ax = 6; S.snowman.ay = 15;

    // kicker: a shaped snow ramp with a shaded lip and two little flags
    S.kick = mk(22, 12, function (P) {
      for (let r = 0; r < 6; r++) { const hw = 5 + r; P(11 - hw, r + 2, hw * 2, 1, r < 2 ? C.snowSh : C.white); }
      P(1, 8, 20, 1, C.snowDk); P(1, 9, 20, 2, C.hole); P(2, 11, 18, 1, C.snowDk);
      P(4, 4, 1, 3, C.snowSh); P(17, 4, 1, 3, C.snowSh);
      P(0, 1, 1, 8, OUTHEX); P(1, 1, 2, 2, C.flag); P(21, 1, 1, 8, OUTHEX); P(19, 1, 2, 2, C.flag);
    }); S.kick.ax = 11; S.kick.ay = 8;

    S.well = mk(25, 15, function (P) {
      for (let y = -7; y <= 7; y++) {
        const hw = Math.round(12 * Math.sqrt(Math.max(0, 1 - (y * y) / 49.3)));
        P(12 - hw, y + 7, hw * 2 + 1, 1, y < -3 ? C.snowDk : C.snowSh);
        const hi = Math.round(8 * Math.sqrt(Math.max(0, 1 - (y * y) / 20.3)));
        if (Math.abs(y) <= 4) P(12 - hi, y + 7, hi * 2 + 1, 1, y < 0 ? C.hole : C.snowDk);
      }
    }); S.well.ax = 12; S.well.ay = 8;

    S.cabin = mk(34, 30, function (P) {
      for (let r = 0; r < 12; r++) {                    // snow-loaded gable
        const hw = 3 + Math.round(r * 1.25); P(17 - hw, r + 3, hw * 2, 1, r > 9 ? C.snowSh : C.white);
      }
      P(4, 15, 26, 1, C.barkD);
      for (let r = 0; r < 12; r++) P(5, 16 + r, 24, 1, (r % 3 === 2) ? C.barkD : (r % 3 === 0 ? C.barkHi : C.bark));
      P(5, 16, 1, 12, C.barkD); P(28, 16, 1, 12, C.barkHi);
      P(15, 20, 5, 8, C.door); P(18, 24, 1, 1, C.gold); P(14, 19, 7, 1, C.barkD);
      P(7, 19, 6, 5, C.barkD); P(8, 20, 4, 3, C.glass); P(10, 20, 1, 3, C.barkD);
      P(22, 19, 6, 5, C.barkD); P(23, 20, 4, 3, C.glass); P(25, 20, 1, 3, C.barkD);
      P(23, 2, 4, 8, C.rock); P(23, 2, 1, 8, C.rockD); P(22, 1, 6, 2, C.white);
      P(3, 28, 28, 1, C.snowSh); P(13, 28, 9, 1, C.white);
    }); S.cabin.ax = 17; S.cabin.ay = 28;

    // lost property: worth points when skied over; the heart gives a life back
    S.items = {
      glove: mk(9, 10, function (P) {
        P(2, 1, 4, 5, C.red); P(1, 2, 1, 3, C.red); P(6, 3, 2, 2, C.red); P(2, 1, 1, 5, '#a83a37'); P(3, 2, 2, 1, '#f08a80');
        P(2, 6, 4, 2, C.white); P(2, 7, 4, 1, C.snowSh);
      }, OUT),
      phone: mk(8, 11, function (P) {
        P(1, 1, 5, 9, '#232b45'); P(2, 2, 3, 6, '#7fd0e0'); P(2, 2, 3, 1, '#d8f4fb'); P(2, 5, 2, 1, '#ffffff'); P(3, 9, 1, 1, '#8d99b5');
      }, OUT),
      pole: mk(13, 13, function (P) {
        lineP(P, 2, 10, 10, 2, '#c9d3e2'); P(10, 1, 2, 2, C.flag); P(9, 2, 1, 1, C.flag);
        P(1, 10, 3, 1, C.gold); P(2, 9, 1, 3, C.gold);
      }, OUT),
      heart: mk(9, 9, function (P) {
        P(2, 1, 2, 1, C.flag); P(5, 1, 2, 1, C.flag); P(1, 2, 7, 2, C.flag); P(2, 4, 5, 1, C.flag); P(3, 5, 3, 1, C.flag); P(4, 6, 1, 1, C.flag);
        P(2, 2, 1, 1, '#ffc2b3'); P(6, 3, 1, 1, '#b94a30'); P(5, 4, 2, 1, '#b94a30'); P(4, 5, 2, 1, '#b94a30');
      }, OUT)
    };
    S.station = mk(46, 30, function (P) {               // top station: a snowy roof over the bullwheel
      P(2, 3, 42, 2, C.white); P(0, 5, 46, 4, C.white); P(0, 9, 46, 2, C.snowSh); P(1, 11, 44, 1, C.rockD);
      P(3, 12, 3, 16, C.rockD); P(40, 12, 3, 16, C.rockD); P(4, 12, 1, 16, C.rock); P(41, 12, 1, 16, C.rock);
      P(12, 15, 22, 1, C.rockL); P(11, 16, 1, 5, C.rockL); P(34, 16, 1, 5, C.rockL); P(12, 21, 22, 1, C.rock); P(22, 16, 2, 5, C.flag);
      P(1, 28, 7, 1, C.snowSh); P(38, 28, 7, 1, C.snowSh);
    }); S.station.ax = 23; S.station.ay = 28;
    S.tower = mk(31, 24, function (P) {
      P(2, 2, 27, 2, C.rockD); P(2, 2, 27, 1, C.rock); P(0, 0, 31, 1, C.white); P(14, 4, 3, 18, C.rockD); P(15, 4, 1, 18, C.rockL); P(12, 22, 7, 1, C.snowSh);
    }); S.tower.ax = 15; S.tower.ay = 22;
    S.chairs = [['#8e5bd0', '#e8c53a'], ['#3fa56a', '#d9534f'], ['#3d7fd6', '#ff9a3c'], null].map(function (r) {
      return mk(11, 12, function (P) {
        P(5, 0, 1, 5, C.rockD); P(1, 5, 9, 1, C.rockD); P(1, 5, 1, 5, C.rockD); P(9, 5, 1, 5, C.rockD); P(1, 9, 9, 1, C.rock);
        if (r) { P(2, 4, 3, 2, '#e7eef4'); P(2, 6, 3, 3, r[0]); P(6, 4, 3, 2, '#2b3550'); P(6, 6, 3, 3, r[1]); P(3, 10, 1, 2, C.gold); P(7, 10, 1, 2, '#7fd0e0'); }
      });
    });
    S.pole = [C.flag, '#3d7fd6'].map(function (c) { return mk(3, 8, function (P) { P(1, 0, 1, 7, c); P(1, 2, 1, 2, C.white); P(0, 7, 3, 1, C.snowDk); }); });
    S.cord = (function () {                              // corduroy: the groomer's fall-line ridges
      const c = document.createElement('canvas'); c.width = 3; c.height = 2; const g = c.getContext('2d');
      g.fillStyle = '#fbfdff'; g.fillRect(0, 0, 3, 2); g.fillStyle = '#dfe8f4'; g.fillRect(2, 0, 1, 2); return ctx.createPattern(c, 'repeat');
    })();
    S.shL = ellipse(8, 3, C.snowSh); S.shM = ellipse(6, 2, C.snowSh); S.shS = ellipse(3, 1, C.snowSh);
    S.shSk = ellipse(5, 2, C.snowDk); S.shSkS = ellipse(3, 1, C.snowDk);

    S.glow = document.createElement('canvas'); S.glow.width = S.glow.height = 96;
    const gg = S.glow.getContext('2d'), gr = gg.createRadialGradient(48, 48, 2, 48, 48, 48);
    gr.addColorStop(0, 'rgba(255,196,110,.75)'); gr.addColorStop(0.45, 'rgba(255,170,90,.26)'); gr.addColorStop(1, 'rgba(255,160,80,0)');
    gg.fillStyle = gr; gg.fillRect(0, 0, 96, 96);
    return S;
  }
  const OUTHEX = '#141a2c';

  function logSprite(w, seed) {
    const c = mk(w + 2, 8, function (P) {
      const R = mulberry(seed);
      P(1, 1, w, 2, C.barkHi); P(1, 3, w, 2, C.bark); P(1, 5, w, 1, C.barkD);
      for (let x = 2; x < w; x++) {
        if (R() < 0.6) P(x, 1, 1, 1, C.white); else if (R() < 0.5) P(x, 1, 1, 1, C.snowSh);
        if (R() < 0.3) P(x, 0, 1, 1, C.white);
        if (R() < 0.16) P(x, 3 + Math.floor(R() * 2), 1, 1, C.barkD);
      }
      P(0, 1, 3, 5, C.wood); P(1, 2, 1, 3, C.woodD); P(0, 1, 1, 1, C.bark); P(0, 5, 1, 1, C.bark);
      P(w - 1, 2, 2, 3, C.barkD);
      const k = 5 + Math.floor(R() * (w - 10)); P(k, 0, 1, 1, C.barkD); P(k, -1, 1, 1, C.barkD);
      P(1, 6, w, 1, C.snowDk); P(2, 7, w - 2, 1, C.snowSh);
    });
    c.ax = (w + 2) >> 1; c.ay = 6;
    return c;
  }

  // A cliff band: a snow lip over a face of fractured rock, tapering out at both ends.
  function cliffSprite(w, h, seed) {
    const c = mk(w + 2, h + 10, function (P) {
      const R = mulberry(seed);
      for (let x = 0; x < w; x++) {
        const edge = Math.min(x, w - 1 - x);
        const fh = Math.round(h * smooth(edge / 9) * (0.82 + 0.18 * hash(Math.floor(x / 5), 3, seed)));
        const top = 3 - Math.round(2 * hash(Math.floor(x / 4), 1, seed));
        P(x + 1, top, 1, 2, C.white);                                   // lip
        if (fh < 2) { P(x + 1, top + 2, 1, 1, C.snowSh); continue; }
        const band = hash(Math.floor((x + 2 * hash(Math.floor(x / 7), 9, seed)) / 3), 5, seed);
        const base = band < 0.3 ? C.rockD : band < 0.72 ? C.rock : C.rockW;
        for (let y = 0; y < fh; y++) {
          let col = base;
          if (y < 2) col = C.rockD;                                      // shadow under the lip
          else if (R() < 0.13) col = C.rockL; else if (R() < 0.1) col = C.rockD;
          P(x + 1, top + 2 + y, 1, 1, col);
        }
        if (R() < 0.2) P(x + 1, top + 2 + Math.floor(fh * (0.35 + R() * 0.4)), 1 + Math.floor(R() * 3), 1, C.white);   // snowy ledges
        if (R() < 0.12) P(x + 1, top + 2, 1, 2 + Math.floor(R() * 3), C.snowSh);                                        // icicles
        const drift = 1 + Math.round(2 * hash(Math.floor(x / 6), 7, seed));
        P(x + 1, top + 2 + fh - drift, 1, drift, C.white);
        P(x + 1, top + 2 + fh, 1, 2 + Math.round(hash(Math.floor(x / 3), 8, seed)), C.snowDk);                          // cast shadow below
        P(x + 1, top + 4 + fh, 1, 2, C.snowSh);
      }
    });
    c.ax = (w + 2) >> 1; c.ay = 4;
    return c;
  }

  function skierPose(P, K, i, air) {
    const phi = i * HALF / 4, sx = Math.sin(phi), cs = Math.cos(phi);
    const ox = 15, oy = air ? 18 : 20, lean = Math.round(sx * 2);
    const tip = air ? 5 : 7, tail = air ? 4 : 5, feet = [];
    for (let s = -1; s <= 1; s += 2) {
      const fx = ox + s * 2 * cs, fy = oy - s * 1.3 * sx; feet.push([fx, fy]);
      const bx = fx + sx * tip, by = fy + cs * tip * 0.8;
      lineP(P, fx - sx * tail, fy - cs * tail * 0.8, bx, by, K.ski);
      P(bx, by, 1, 1, K.skiEdge);
    }
    const side = i >= 3 ? 1 : i <= -3 ? -1 : 0;
    if (K.style === 'snowman') {                       // three snowballs, twig arms, a top hat
      const bx = ox + Math.round(sx), mx = ox + lean, hx0 = mx - 2 + side;
      const lower = [6, 8, 8, 8, 8, 6], mid = [4, 6, 6, 6, 4];
      for (let r = 0; r < 6; r++) { P(bx - lower[r] / 2, oy - 7 + r, lower[r], 1, C.white); P(bx - lower[r] / 2, oy - 7 + r, 2, 1, C.snowSh); }
      P(bx - 2, oy - 2, 5, 1, C.snowSh);
      for (let r = 0; r < 5; r++) { P(mx - mid[r] / 2, oy - 12 + r, mid[r], 1, C.white); P(mx - mid[r] / 2, oy - 12 + r, 1, 1, C.snowSh); }
      P(mx + side, oy - 10, 1, 1, OUTHEX); P(mx + side, oy - 8, 1, 1, OUTHEX); P(bx + side, oy - 5, 1, 1, OUTHEX);
      if (air) { lineP(P, mx - 3, oy - 10, mx - 7, oy - 14, K.glove); lineP(P, mx + 3, oy - 10, mx + 7, oy - 14, K.glove); lineP(P, mx - 7, oy - 15, mx - 10, oy - 10, K.pole); lineP(P, mx + 7, oy - 15, mx + 10, oy - 10, K.pole); }
      else { lineP(P, mx - 3, oy - 10, mx - 6, oy - 7, K.glove); lineP(P, mx + 2, oy - 10, mx + 5, oy - 7, K.glove); lineP(P, mx - 6, oy - 6, mx - 7, oy + 1, K.pole); lineP(P, mx + 5, oy - 6, mx + 6, oy + 1, K.pole); }
      P(hx0, oy - 17, 5, 4, C.white); P(hx0, oy - 17, 1, 4, C.snowSh);
      P(hx0 + 1 + side, oy - 16, 1, 1, OUTHEX); P(hx0 + 3 + side, oy - 16, 1, 1, OUTHEX);
      if (i === 0) P(hx0 + 2, oy - 15, 1, 1, C.carrot); else P(hx0 + (i > 0 ? 3 : 0), oy - 15, 2 + (side ? 1 : 0), 1, C.carrot);
      P(mx - 3, oy - 13, 6, 1, K.scarf); P(mx - 3, oy - 13, 1, 1, K.scarfSh);
      P(hx0 - 1, oy - 18, 7, 1, OUTHEX); P(hx0 + 1, oy - 21, 3, 3, OUTHEX); P(hx0 + 1, oy - 19, 3, 1, C.red);
      return;
    }
    if (K.style === 'sasquatch') {                       // tall, shaggy and long in the arm
      for (let n = 0; n < 2; n++) {
        const fx = feet[n][0], fy = feet[n][1], s = n ? 1 : -1;
        P(Math.round((fx + ox + lean + s) / 2) - 1, oy - 6, 3, 3, n ? K.pants : K.pantsSh);
        P(Math.round(fx) - 1, oy - 3, 3, 2, n ? K.pants : K.pantsSh);
        P(Math.round(fx) - 2 + (n ? 1 : 0), Math.round(fy) - 1, 3, 2, K.boot);
      }
      const bx = ox + lean - 4, hx0 = ox + lean - 2 + side, hy0 = oy - 19;
      P(bx, oy - 14, 8, 8, K.jacket); P(bx, oy - 14, 2, 8, K.jacketSh); P(bx + 1, oy - 7, 6, 1, K.jacketSh);
      P(bx + 3, oy - 11, 3, 3, K.accent); P(bx + 2, oy - 13, 1, 1, K.accent); P(bx + 6, oy - 9, 1, 1, K.accent);
      if (air) { P(bx - 2, oy - 17, 2, 6, K.jacketSh); P(bx + 8, oy - 17, 2, 6, K.jacket); P(bx - 2, oy - 19, 2, 2, K.glove); P(bx + 8, oy - 19, 2, 2, K.glove); lineP(P, bx - 2, oy - 19, bx - 6, oy - 13, K.pole); lineP(P, bx + 9, oy - 19, bx + 13, oy - 13, K.pole); }
      else { P(bx - 2, oy - 13, 2, 7, K.jacketSh); P(bx + 8, oy - 13, 2, 7, K.jacket); P(bx - 2, oy - 6, 2, 2, K.glove); P(bx + 8, oy - 6, 2, 2, K.glove); lineP(P, bx - 2, oy - 5, bx - 4, oy + 1, K.pole); lineP(P, bx + 9, oy - 5, bx + 11, oy + 1, K.pole); }
      P(hx0 + 1, hy0 - 1, 3, 1, K.helmetHi); P(hx0, hy0, 5, 5, K.jacket); P(hx0, hy0, 1, 5, K.jacketSh);
      P(hx0 + 1 + side, hy0 + 1, 3, 3, K.skin); P(hx0 + 1 + side, hy0 + 1, 3, 1, K.skinSh);
      P(hx0 + 1 + side, hy0 + 2, 1, 1, OUTHEX); P(hx0 + 3 + side, hy0 + 2, 1, 1, OUTHEX); P(hx0 + 2 + side, hy0 + 3, 1, 1, K.boot);
      P(hx0, hy0 + 5, 5, 1, K.scarf); P(hx0, hy0 + 5, 1, 1, K.scarfSh);
      return;
    }
    for (let n = 0; n < 2; n++) {
      const fx = feet[n][0], fy = feet[n][1], s = n ? 1 : -1;
      P(Math.round((fx + ox + lean + s) / 2) - 1, oy - 6, 2, 3, n ? K.pants : K.pantsSh);
      P(Math.round(fx) - 1, oy - 3, 2, 2, n ? K.pants : K.pantsSh);
      P(Math.round(fx) - 1, Math.round(fy) - 1, 2, 2, K.boot);
    }
    const tx = ox + lean - 3;
    P(tx, oy - 12, 6, 6, K.jacket); P(tx, oy - 12, 1, 6, K.jacketSh); P(tx, oy - 7, 6, 1, K.jacketSh); P(tx + 1, oy - 10, 5, 1, K.accent);
    if (air) {
      P(tx - 2, oy - 14, 2, 4, K.jacketSh); P(tx + 6, oy - 14, 2, 4, K.jacket);
      P(tx - 2, oy - 16, 2, 2, K.glove); P(tx + 6, oy - 16, 2, 2, K.glove);
      lineP(P, tx - 2, oy - 16, tx - 6, oy - 11, K.pole); lineP(P, tx + 7, oy - 16, tx + 11, oy - 11, K.pole);
    } else {
      P(tx - 2, oy - 11, 2, 4, K.jacketSh); P(tx + 6, oy - 11, 2, 4, K.jacket);
      P(tx - 2, oy - 7, 2, 2, K.glove); P(tx + 6, oy - 7, 2, 2, K.glove);
      lineP(P, tx - 2, oy - 6, tx - 4, oy + 1, K.pole); lineP(P, tx + 7, oy - 6, tx + 9, oy + 1, K.pole);
    }
    const hx = ox + lean - 2 + side, hy = oy - 17;
    if (K.style === 'santa') {                         // belt, fur trim, hat and a proper beard
      P(tx, oy - 9, 6, 1, OUTHEX); P(tx + 2, oy - 9, 2, 1, C.gold); P(tx, oy - 7, 6, 1, C.white);
      P(tx - 2, oy - (air ? 14 : 8), 2, 1, C.white); P(tx + 6, oy - (air ? 14 : 8), 2, 1, C.white);
      P(hx + 1, hy - 1, 3, 1, K.jacket); P(hx, hy, 5, 1, K.jacket); P(hx + 3, hy - 1, 2, 1, K.jacketSh);
      P(hx + 4 - (side < 0 ? 5 : 0), hy - 1 + (side ? 1 : 0), 2, 2, C.white);
      P(hx, hy + 1, 5, 1, C.white);
      P(hx, hy + 2, 5, 1, K.skin); P(hx + 1 + side, hy + 2, 1, 1, OUTHEX); P(hx + 3 + side, hy + 2, 1, 1, OUTHEX);
      P(hx, hy + 3, 5, 2, C.white); P(hx + 2 + side, hy + 3, 1, 1, '#e79a8a'); P(hx + 1, hy + 5, 3, 1, C.white); P(hx, hy + 4, 1, 1, C.snowSh);
      return;
    }
    P(hx + 1, hy, 3, 1, K.helmetHi); P(hx, hy + 1, 5, 1, K.helmet); P(hx, hy + 2, 5, 1, K.strap);
    const lx = i >= 3 ? hx + 2 : i <= -3 ? hx : hx + 1;
    P(lx, hy + 2, 3, 1, K.lens); P(lx + 2, hy + 2, 1, 1, K.lensHi);
    P(hx, hy + 3, 5, 1, K.skin); P(hx, hy + 3, 1, 1, K.skinSh);
    P(hx, hy + 4, 5, 1, K.scarf); P(hx, hy + 4, 1, 1, K.scarfSh);
    if (K.pom) P(hx + 2, hy - 1, 1, 1, K.pom);
  }
  function buildSkier(K) {
    const o = { dir: [], air: [], K: K };
    for (let i = -4; i <= 4; i++) {
      // 4px of headroom above the old 30x30 frame, for hats and raised arms
      o.dir.push(mk(30, 34, function (P) { skierPose(function (x, y, w, h, c) { P(x, y + 4, w, h, c); }, K, i, false); }, OUT));
      o.air.push(mk(30, 34, function (P) { skierPose(function (x, y, w, h, c) { P(x, y + 4, w, h, c); }, K, i, true); }, OUT));
    }
    o.crash = mk(30, 22, function (P) {                 // a heap: crossed skis, legs in the air
      lineP(P, 4, 17, 19, 6, K.ski); lineP(P, 9, 5, 24, 17, K.ski);
      P(10, 11, 8, 5, K.jacket); P(10, 15, 8, 1, K.jacketSh); P(11, 12, 6, 1, K.accent);
      P(17, 7, 2, 5, K.pants); P(20, 9, 2, 4, K.pantsSh); P(17, 6, 2, 2, K.boot); P(20, 8, 2, 2, K.boot);
      P(5, 11, 5, 1, K.helmet); P(5, 12, 5, 1, K.strap); P(6, 12, 3, 1, K.lens); P(5, 13, 5, 2, K.skin); P(9, 14, 2, 2, K.scarf);
      P(8, 16, 2, 2, K.glove); lineP(P, 20, 16, 27, 12, K.pole);
    }, OUT);
    o.stuck = mk(22, 16, function (P) {                 // head and ski tips poking out of a tree well
      lineP(P, 3, 9, 5, 2, K.ski); lineP(P, 18, 9, 16, 1, K.ski);
      P(9, 5, 3, 1, K.helmetHi); P(8, 6, 5, 1, K.helmet); P(8, 7, 5, 1, K.strap); P(9, 7, 3, 1, K.lens); P(8, 8, 5, 1, K.skin);
      P(14, 4, 2, 2, K.glove);
    }, OUT);
    return o;
  }

  // ---- ground texture (tileable) ---------------------------------------------------------
  function buildTile() {
    const N = 128, c = document.createElement('canvas'); c.width = c.height = N;
    const g = c.getContext('2d'), im = g.createImageData(N, N), d = im.data;
    const cols = [hexRgb(C.snow), hexRgb(C.snowSh), hexRgb(C.white), hexRgb('#e6edf7')];
    function wn(x, y, cells, s) {                        // value noise that wraps at the tile edge
      const fx = x / N * cells, fy = y / N * cells, ix = Math.floor(fx), iy = Math.floor(fy), u = smooth(fx - ix), v = smooth(fy - iy);
      const h = function (a, b) { return hash(((a % cells) + cells) % cells, ((b % cells) + cells) % cells, s); };
      const a = h(ix, iy), b = h(ix + 1, iy), cc = h(ix, iy + 1), dd = h(ix + 1, iy + 1);
      return a + (b - a) * u + (cc - a) * v + (a - b - cc + dd) * u * v;
    }
    const bay = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const n = wn(x, y, 5, 11) * 0.6 + wn(x, y, 11, 23) * 0.4;      // wind-drift shapes, stretched sideways
      const th = (bay[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
      let k = 0;
      if (n > 0.69 + th * 0.06) k = 1; else if (n > 0.56 + th * 0.1) k = 3;
      const r = hash(x, y, 77);
      if (r > 0.992) k = 2; else if (r < 0.006) k = 1;
      const i = (y * N + x) * 4; d[i] = cols[k][0]; d[i + 1] = cols[k][1]; d[i + 2] = cols[k][2]; d[i + 3] = 255;
    }
    g.putImageData(im, 0, 0);
    return c;
  }

  // ---- world generation -------------------------------------------------------------------
  const CELL = 16, CH = 128;
  const ITEMS = [{ id: 'glove', pts: 150, label: 'LOST GLOVE' }, { id: 'phone', pts: 250, label: 'LOST PHONE' }, { id: 'pole', pts: 200, label: 'LOST POLE' }];
  let seed = 1, chunks = new Map(), majors = new Map();
  let SPR = null, TILE = null, SK = null;

  function density(x, y) {
    const n = vnoise(x / 200, y / 240, seed) * 0.72 + vnoise(x / 64, y / 64, seed + 5) * 0.28;
    return smooth((n - 0.31) / 0.34);
  }
  // Groomed runs: one every PISTE_P pixels, each wandering down the hill and changing width.
  const PISTE_P = 560; let pz0 = 0.5;
  function pisteC(y, k) { return k * PISTE_P + (vnoise(y / 520, k * 17.13, seed + 33) - (k === 0 ? pz0 : 0.5)) * 230; }
  function pisteHW(y, k) {
    let hw = 40 + 46 * vnoise(y / 340, k * 5.7 + 3, seed + 44);
    if (k === 0) { if (y < 300) hw = Math.max(hw, 90 - Math.max(0, y) * 0.12); hw *= smooth((y + 70) / 50); }   // wide at the start, nothing above the lift
    return hw;
  }
  const PN = { k: 0, c: 0, d: 0, hw: 0 };
  function pisteNear(x, y) {                             // nearest run to a point (result object is reused)
    const k0 = Math.round(x / PISTE_P); let bd = 1e9;
    for (let k = k0 - 1; k <= k0 + 1; k++) { const c = pisteC(y, k), d = Math.abs(x - c); if (d < bd) { bd = d; PN.k = k; PN.c = c; } }
    PN.d = bd; PN.hw = pisteHW(y, PN.k); return PN;
  }
  function onPiste(x, y, pad) { const q = pisteNear(x, y); return q.d < q.hw + (pad || 0); }
  function treeObj(kind, x, y, R) {
    if (kind === 'pineXL') return { t: kind, x: x, y: y, r: 3, h: 34, wr: 10, spr: pick(SPR.pineXL, R), sh: SPR.shL, tree: 1, msg: 'TIMBER!' };
    if (kind === 'pineL') return { t: kind, x: x, y: y, r: 3, h: 27, spr: pick(SPR.pineL, R), sh: SPR.shL, tree: 1, msg: 'TIMBER!' };
    if (kind === 'pineM') return { t: kind, x: x, y: y, r: 2.5, h: 20, spr: pick(SPR.pineM, R), sh: SPR.shM, tree: 1, msg: 'TIMBER!' };
    return { t: 'aspL', x: x, y: y, r: 2, h: 26, spr: pick(SPR.aspL, R), sh: SPR.shM, tree: 1, msg: 'ASPEN!' };
  }
  function inRects(rs, x, y) {
    for (let i = 0; i < rs.length; i++) { const r = rs[i]; if (x > r[0] && x < r[2] && y > r[1] && y < r[3]) return true; }
    return false;
  }
  // big features (cliffs, kickers, cabins) plus the ground they keep clear of trees
  function major(cx, cy) {
    const key = cx + ',' + cy; let m = majors.get(key); if (m) return m;
    const R = mulberry(Math.floor(hash(cx, cy, seed + 101) * 4294967296));
    const x0 = cx * CH, y0 = cy * CH; m = { objs: [], clear: [] };
    const roll = R(), q = pisteNear(x0 + 64, y0 + 64), pk = q.k;
    if (q.c >= x0 && q.c < x0 + CH && q.hw > 24) {
      // this chunk carries a groomed run: a few kickers, and now and then an island of trees
      if (y0 > 150 && roll < 0.2) {
        const y = y0 + 12 + R() * 60, x = pisteC(y, pk) + (R() - 0.5) * pisteHW(y, pk);
        m.objs.push({ t: 'kick', x: Math.round(x), y: Math.round(y), spr: SPR.kick, ground: true });
        m.clear.push([x - 14, y - 34, x + 14, y + 135]);
      } else if (y0 > 200 && roll < 0.5) {
        const iy = y0 + 30 + R() * 70, hw = pisteHW(iy, pk);
        if (hw > 52) {
          const ix = pisteC(iy, pk) + (R() - 0.5) * hw * 0.9, oval = R() < 0.45;
          const n = oval ? 5 + Math.floor(R() * 4) : 2 + Math.floor(R() * 2), rx = oval ? 15 + R() * 9 : 9, ry = oval ? 9 + R() * 4 : 5, put = [];
          for (let tries = 0; tries < 50 && put.length < n; tries++) {
            const a = R() * 6.283, rr = Math.sqrt(R()), px = Math.round(ix + Math.cos(a) * rx * rr), py = Math.round(iy + Math.sin(a) * ry * rr);
            let ok = true; for (let e = 0; e < put.length; e++) if (Math.abs(put[e][0] - px) + Math.abs(put[e][1] - py) < 8) ok = false;
            if (ok) put.push([px, py]);
          }
          const pines = R() < 0.7;
          for (let e = 0; e < put.length; e++) {
            const kind = !pines ? 'aspL' : (e === 0 && (oval || R() < 0.5)) || (oval && e === 3) ? 'pineXL' : R() < 0.55 ? 'pineL' : 'pineM';
            m.objs.push(treeObj(kind, put[e][0], put[e][1], R));
          }
          m.clear.push([ix - rx - 14, iy - ry - 14, ix + rx + 14, iy + ry + 12]);
        }
      }
    } else if (y0 > 480 && roll < 0.09) {
      const w = 60 + Math.floor(R() * 52), x = x0 + w / 2 + 6 + R() * (CH - w - 12), y = y0 + 16 + R() * 30;
      const sd = Math.floor(R() * 1e6), pq = pisteNear(x, y + 40);
      if (pq.d > pq.hw + w / 2 + 16) {                   // cliffs stay off the groomed runs
        m.objs.push({ t: 'cliff', x: Math.round(x), y: Math.round(y), w: w, h: 14, spr: cliffSprite(w, 14, sd), ground: true });
        m.clear.push([x - w / 2 - 8, y - 18, x + w / 2 + 8, y + 175]);
      }
    } else if (y0 > 150 && roll < 0.3) {
      const x = x0 + 16 + R() * (CH - 32), y = y0 + 12 + R() * 60;
      if (!onPiste(x, y, 14)) {
        m.objs.push({ t: 'kick', x: Math.round(x), y: Math.round(y), spr: SPR.kick, ground: true });
        m.clear.push([x - 14, y - 34, x + 14, y + 135]);
      }
    } else if (y0 > 260 && roll > 0.962) {
      const x = x0 + 24 + R() * (CH - 48), y = y0 + 40 + R() * 60;
      if (!onPiste(x, y, 30)) {
        m.objs.push({ t: 'cabin', x: Math.round(x), y: Math.round(y), spr: SPR.cabin, sh: SPR.shL, h: 99, msg: 'KNOCK KNOCK' });
        m.clear.push([x - 24, y - 30, x + 24, y + 12]);
      }
    }
    majors.set(key, m); return m;
  }
  function pick(arr, R) { return arr[Math.floor(R() * arr.length)]; }
  function getChunk(cx, cy) {
    const key = cx + ',' + cy; let ch = chunks.get(key); if (ch) return ch;
    const R = mulberry(Math.floor(hash(cx, cy, seed) * 4294967296));
    const x0 = cx * CH, y0 = cy * CH, m = major(cx, cy);
    const clear = m.clear.concat(major(cx, cy - 1).clear, major(cx - 1, cy - 1).clear, major(cx + 1, cy - 1).clear);
    clear.push([-90, -150, 90, 130], [-36, -2400, 36, 0]);   // the start and the lift line are always open
    ch = m.objs.slice();
    const ramp = clamp(0.62 + y0 / 6000, 0.62, 1);

    function minor(n, make, anywhere) {
      for (let k = 0; k < n; k++) {
        const x = x0 + 14 + R() * (CH - 28), y = y0 + 6 + R() * (CH - 12);
        if (inRects(clear, x, y) || (!anywhere && onPiste(x, y, 6))) continue;
        const o = make(Math.round(x), Math.round(y)); ch.push(o);
        clear.push([o.x - (o.w ? o.w / 2 + 3 : 7), o.y - 7, o.x + (o.w ? o.w / 2 + 3 : 7), o.y + 6]);
      }
    }
    minor((R() < 0.42 * ramp + 0.1 ? 1 : 0) + (R() < 0.16 ? 1 : 0), function (x, y) {
      const w = 18 + Math.floor(R() * 12); return { t: 'log', x: x, y: y, w: w, h: 4, spr: logSprite(w, Math.floor(R() * 1e6)), msg: 'LOG!', hop: 'LOG HOP' };
    });
    minor((R() < 0.3 * ramp ? 1 : 0) + (R() < 0.1 ? 1 : 0), function (x, y) {
      return { t: 'rock', x: x, y: y, r: 4, h: 7, spr: pick(SPR.rock, R), sh: SPR.shS, msg: 'ROCK!', hop: 'ROCK HOP' };
    });
    minor(R() < 0.22 ? 1 : 0, function (x, y) { return { t: 'stump', x: x, y: y, r: 2.5, h: 5, spr: SPR.stump, sh: SPR.shS, msg: 'STUMP!', hop: 'STUMP HOP' }; });
    minor(R() < 0.05 ? 1 : 0, function (x, y) { return { t: 'snowman', x: x, y: y, r: 3, h: 12, spr: SPR.snowman, sh: SPR.shS, msg: 'SORRY, FROSTY', hop: 'FROSTY HOP' }; });

    minor(y0 > 120 && R() < 0.17 ? 1 : 0, function (x, y) {
      const k = pick(ITEMS, R); return { t: 'item', x: x, y: y, spr: SPR.items[k.id], sh: SPR.shS, pts: k.pts, label: k.label };
    }, true);
    minor(y0 > 400 && R() < 0.04 ? 1 : 0, function (x, y) { return { t: 'item', heart: 1, x: x, y: y, spr: SPR.items.heart, sh: SPR.shS }; }, true);

    for (let gy = 0; gy < CH / CELL; gy++) for (let gx = 0; gx < CH / CELL; gx++) {
      const x = Math.round(x0 + gx * CELL + 2 + R() * 12), y = Math.round(y0 + gy * CELL + 2 + R() * 12);
      const r1 = R(), r2 = R(), r3 = R(), r4 = R();
      const d = density(x, y);
      if (r1 >= (0.05 + 0.56 * Math.pow(d, 1.4)) * ramp) continue;
      if (inRects(clear, x, y) || onPiste(x, y, 5)) continue;
      const sp = vnoise(x / 230 + 31, y / 230 + 17, seed + 9) + (r2 - 0.5) * 0.3;
      const small = r3 < 0.2 + 0.26 * (1 - d);
      let o;
      if (r4 < 0.05) o = { t: 'bush', x: x, y: y, r: 2.5, h: 5, spr: SPR.bush, msg: 'SHRUBBERY!', hop: 'BUSH HOP' };
      else if (sp < 0.5) {
        if (small) o = r4 < 0.5 ? { t: 'tiny', x: x, y: y, r: 1.5, h: 6, spr: pick(SPR.tiny, R), sh: SPR.shS, msg: 'SAPLING!', hop: 'TREE HOP' }
          : { t: 'sap', x: x, y: y, r: 2, h: 10, spr: pick(SPR.sap, R), sh: SPR.shS, msg: 'SAPLING!', hop: 'TREE HOP' };
        else if (d < 0.62 && r4 > 0.72) o = { t: 'pineXL', x: x, y: y, r: 3, h: 34, wr: 10, spr: pick(SPR.pineXL, R), sh: SPR.shL, tree: 1, msg: 'TIMBER!' };
        else if (r4 > 0.4) o = { t: 'pineL', x: x, y: y, r: 3, h: 27, spr: pick(SPR.pineL, R), sh: SPR.shL, tree: 1, msg: 'TIMBER!' };
        else o = { t: 'pineM', x: x, y: y, r: 2.5, h: 20, spr: pick(SPR.pineM, R), sh: SPR.shM, tree: 1, msg: 'TIMBER!' };
      } else if (small) o = { t: 'aspS', x: x, y: y, r: 1.5, h: 14, spr: pick(SPR.aspS, R), sh: SPR.shS, tree: 1, msg: 'ASPEN!' };
      else o = { t: 'aspL', x: x, y: y, r: 2, h: 26, spr: pick(SPR.aspL, R), sh: SPR.shM, tree: 1, msg: 'ASPEN!' };
      ch.push(o);
    }
    chunks.set(key, ch); return ch;
  }
  function pruneChunks(cyMin) {
    if (chunks.size < 90) return;
    chunks.forEach(function (v, k) { if (Number(k.split(',')[1]) < cyMin) chunks.delete(k); });
    majors.forEach(function (v, k) { if (Number(k.split(',')[1]) < cyMin - 2) majors.delete(k); });
  }

  // ---- state ----------------------------------------------------------------------------
  let W = 480, H = 270, SCALE = 3;
  let mode = 'menu';                 // menu | play | pause | over
  let kit = 'A';
  const s = { x: 0, y: 0, th: HALF, v: 0, z: 0, vz: 0, state: 'idle', timer: 0, inv: 0, airT: 0, from: '', hops: [], well: null };
  const run = { t: 0, score: 0, falls: 0, clean: 0, bestClean: 0, jumps: 0, bigAir: 0, items: 0, top: 0, token: null, started: 0 };
  let camX = 0, camY = 0, look = 0;
  const vis = [], tracks = [], parts = [], flakes = [], smoke = [], npcs = [];
  let NPCS = null, npcT = 0;
  const keys = { left: false, right: false, up: false, down: false };
  let useMouse = false; const mouse = { x: 0, y: 0 };
  const stick = { on: false, x: 0, y: 0, id: null };   // on-screen thumb stick (touch): x, y in -1..1
  let brakeBtn = false;
  const MAX_FALLS = 3, G = 260;

  // launched from the iPhone/iPad home screen: the page styles lower the HUD clear of the status bar blur
  if (window.navigator.standalone === true) document.documentElement.classList.add('ios-app');
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    SCALE = clamp(Math.round(Math.sqrt(w * h) / 330), 2, 6);
    W = Math.ceil(w / SCALE); H = Math.ceil(h / SCALE);
    cv.width = W; cv.height = H; cv.style.width = (W * SCALE) + 'px'; cv.style.height = (H * SCALE) + 'px';
    ctx.imageSmoothingEnabled = false;
    flakes.length = 0;
    for (let i = 0; i < Math.round(W * H / 2600); i++) flakes.push({ x: Math.random() * W, y: Math.random() * H, v: 14 + Math.random() * 22, w: Math.random() * 6.28, big: Math.random() < 0.25 });
  }

  function resetWorld() {
    seed = Math.floor(Math.random() * 1e9) | 0;
    chunks = new Map(); majors = new Map(); pz0 = vnoise(0, 0, seed + 33);
    tracks.length = 0; parts.length = 0; smoke.length = 0;
    s.x = 0; s.y = 0; s.th = HALF * 0.999; s.v = 0; s.z = 0; s.vz = 0; s.state = 'idle'; s.timer = 0; s.inv = 0; s.hops = [];
    run.t = 0; run.score = 0; run.falls = 0; run.clean = 0; run.bestClean = 0; run.jumps = 0; run.bigAir = 0; run.items = 0; run.top = 0; run.token = null;
    look = 0; camX = s.x - W / 2; camY = s.y - H * 0.3;
    npcs.length = 0; npcT = 0;                           // the crowd just off the lift, setting off one by one
    for (let i = 0; i < 9; i++) {
      const side = i % 2 ? 1 : -1, x = side * (13 + Math.random() * 62), y = -24 + Math.random() * 46;
      npcs.push(newNpc(0, x, y, 55 + Math.random() * 70, { state: 'wait', timer: 0.25 + Math.random() * 5.5, th: [HALF, -HALF, 0.7, -0.7, 0][i % 5], off: clamp(x / 80, -0.8, 0.8) }));
    }
  }

  // ---- popups + HUD -------------------------------------------------------------------------
  const pops = $('pops');
  function pop(text, cls) {
    const el = document.createElement('div'); el.className = 'pop ' + (cls || ''); el.textContent = text;
    el.style.left = Math.round((s.x - camX) * SCALE) + 'px';
    el.style.top = Math.round((s.y - camY - s.z - 26) * SCALE - pops.childElementCount * 16) + 'px';
    pops.appendChild(el); setTimeout(function () { el.remove(); }, 1150);
  }
  function mult() { return 1 + Math.min(4, Math.floor(run.clean / 12)); }
  function add(pts) { const p = Math.round(pts * mult()); run.score += p; return p; }
  let hudT = 0, lastMult = 1;
  function hud(force) {
    const now = performance.now(); if (!force && now - hudT < 90) return; hudT = now;
    $('h-score').textContent = Math.floor(run.score).toLocaleString('en-US');
    const m = mult(); const hm = $('h-mult'); hm.textContent = 'x' + m; hm.className = 'm' + m;
    if (m > lastMult && mode === 'play') pop('CLEAN RUN  x' + m, 'gold'); lastMult = m;
    $('h-clean').textContent = fmtTime(run.clean);
    const sp = $('h-speed'); sp.textContent = Math.round(s.v * 0.36) + ' km/h'; sp.className = s.v > 105 ? 'hot' : '';
    $('h-time').textContent = fmtTime(run.t);
    $('h-dist').textContent = Math.max(0, Math.floor(s.y / 10)).toLocaleString('en-US') + ' m';
    const hs = $('h-falls').children; for (let i = 0; i < hs.length; i++) hs[i].className = i < MAX_FALLS - run.falls ? '' : 'off';
  }

  // ---- gameplay -----------------------------------------------------------------------------
  function burst(n, col) {
    for (let i = 0; i < n; i++) parts.push({ x: s.x + (Math.random() - 0.5) * 6, y: s.y + (Math.random() - 0.5) * 4, vx: (Math.random() - 0.5) * 70, vy: (Math.random() - 0.7) * 60, life: 0.35 + Math.random() * 0.45, c: col || C.white });
  }
  function launch(vz, from, z0) {
    s.state = 'air'; s.vz = vz; s.z = z0 || 0.01; s.airT = 0; s.from = from; s.hops = [];
    burst(6);
  }
  function jump() {
    if (mode !== 'play' || s.state !== 'ski') return;
    launch(86, 'hop');
  }
  function land() {
    s.state = 'ski'; s.z = 0; s.vz = 0; burst(8);
    const t = s.airT; let pts = 0; const lines = [];
    if (s.from !== 'hop' || t > 0.5) { run.jumps++; }
    if (t > run.bigAir) run.bigAir = t;
    if (s.from === 'cliff') { pts += 300; lines.push('CLIFF DROP'); }
    else if (s.from === 'kick') { pts += 100; lines.push('KICKER'); }
    if (s.from !== 'hop') pts += Math.round(t * 200);
    for (let i = 0; i < s.hops.length; i++) { pts += 100; if (lines.indexOf(s.hops[i]) < 0) lines.push(s.hops[i]); }
    if (pts > 0) {
      const got = add(pts);
      pop((lines.length ? lines.join(' + ') + '  ' : 'AIR  ') + (s.from !== 'hop' ? t.toFixed(1) + 's  ' : '') + '+' + got, s.from === 'cliff' ? 'gold' : '');
    }
  }
  function fall(msg, stuckAt) {
    if (s.inv > 0 || s.state === 'fall' || s.state === 'stuck') return;
    run.falls++; if (run.clean > run.bestClean) run.bestClean = run.clean; run.clean = 0; lastMult = 1;
    s.v = 0; s.z = 0; s.vz = 0;
    if (stuckAt) {
      s.state = 'stuck'; s.timer = 1.5; s.well = stuckAt;
      const side = s.x >= stuckAt.x ? 1 : -1; s.x = stuckAt.x + side * 6; s.y = stuckAt.y + 3;
    } else { s.state = 'fall'; s.timer = 1.05; }
    burst(16); pop(msg, 'bad'); hud(true);
    if (navigator.vibrate) { try { navigator.vibrate(60); } catch (e) { /* not allowed */ } }
  }
  function gather() {
    vis.length = 0;
    const c0 = Math.floor((camX - 48) / CH), c1 = Math.floor((camX + W + 48) / CH);
    const r0 = Math.floor((camY - 24) / CH), r1 = Math.floor((camY + H + 60) / CH);
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) { const ch = getChunk(c, r); for (let i = 0; i < ch.length; i++) vis.push(ch[i]); }
    pruneChunks(r0 - 1);
  }
  function collide(prevY) {
    const air = s.state === 'air';
    for (let i = 0; i < vis.length; i++) {
      const o = vis[i], dx = s.x - o.x, dy = s.y - o.y;
      if (dy > 40 || dy < -40 || dx > 70 || dx < -70) continue;
      if (o.t === 'item') {
        if (!o.got && dx * dx + dy * dy < 72 && s.z < 16) {
          o.got = 1; burst(7, C.gold);
          if (o.heart) {
            if (run.falls > 0) { run.falls--; pop('+1 LIFE', 'gold'); } else pop('SPARE HEART  +' + add(300), 'gold');
            hud(true);
          } else { run.items++; pop(o.label + '  +' + add(o.pts), 'gold'); }
        }
      } else if (o.t === 'kick') {
        if (!air && prevY < o.y && s.y >= o.y && Math.abs(dx) < 10 && Math.cos(s.th) > 0.45) launch(60 + s.v * 0.5, 'kick');
      } else if (o.t === 'cliff') {
        if (Math.abs(dx) < o.w / 2 - 2) {
          if (!air && prevY < o.y && s.y >= o.y) launch(42 + s.v * 0.34, 'cliff', o.h);
          else if (!air && dy > 1 && dy < o.h) fall('ROCKS!');
        }
      } else if (o.t === 'log') {
        if (Math.abs(dx) < o.w / 2 + 1 && Math.abs(dy) < 2.6) { if (s.z < o.h) fall(o.msg); else if (!o._c) { o._c = 1; s.hops.push(o.hop); } }
      } else if (o.t === 'cabin') {
        if (Math.abs(dx) < 13 && dy < 1 && dy > -9) fall(o.msg);
      } else {
        const rr = o.r + 1.5, d2 = dx * dx + dy * dy;
        if (d2 < rr * rr) { if (s.z < o.h) fall(o.msg); else if (o.hop && !o._c) { o._c = 1; s.hops.push(o.hop); } }
        else if (o.wr && !air && dx * dx + dy * dy * 2.6 < o.wr * o.wr) fall('TREE WELL!', o);
        else if (o.tree && !air && !o._n && d2 < 72 && s.v > 70 && s.inv <= 0) { o._n = 1; pop('CLOSE!  +' + add(20), 'dim'); }
      }
      if (s.state === 'fall' || s.state === 'stuck') return;
    }
  }
  // ---- other skiers -----------------------------------------------------------------------
  const NPC_COL = [['#8e5bd0', '#6a3fa6'], ['#3fa56a', '#2c7a4c'], ['#e8c53a', '#b99522'], ['#e06aa8', '#b24782'], ['#3d7fd6', '#2a5aa3'], ['#d9534f', '#a83a37'], ['#f1f1f1', '#c9d0dc'], ['#2b3550', '#1b2236'], ['#ff9a3c', '#c9701f'], ['#58c7c2', '#3a9490']];
  const NPC_PANTS = [['#2b3550', '#1b2236'], ['#465689', '#35426c'], ['#5a4a86', '#443867'], ['#3a3a3a', '#242424'], ['#7a5539', '#573a26']];
  function buildNpcs() {
    const out = [];
    for (let i = 0; i < 10; i++) {
      const j = NPC_COL[i], pp = NPC_PANTS[(i * 3) % 5], h = NPC_COL[(i * 7 + 3) % 10], sk = NPC_COL[(i * 5 + 1) % 10];
      out.push(buildSkier(Object.assign({}, KITS.A, { jacket: j[0], jacketSh: j[1], accent: pp[0], pants: pp[0], pantsSh: pp[1], helmet: h[0], helmetHi: h[0], scarf: h[0], scarfSh: h[1], ski: sk[0], skiEdge: sk[1], pom: i % 3 === 0 ? '#ffffff' : undefined })));
    }
    return out;
  }
  function newNpc(k, x, y, vt, o) {
    const n = { t: 'npc', k: k, x: x, y: y, v: vt, vt: vt, th: 0, off: (Math.random() * 2 - 1) * 0.7, ph: Math.random() * 6.28, rate: 1.1 + Math.random() * 1.5, amp: 0.2 + Math.random() * 0.45, spr: NPCS[Math.floor(Math.random() * NPCS.length)], state: 'ski', timer: 0, inv: 0 };
    if (o) for (const key in o) n[key] = o[key];
    if (n.state === 'wait') n.v = 0;
    return n;
  }
  function spawnNpc() {
    const q = pisteNear(s.x, s.y), k = q.k, behind = s.v > 60 && Math.random() < 0.22;
    const y = behind ? camY - 34 : camY + H + 30 + Math.random() * 70, hw = pisteHW(y, k);
    if (hw < 26) return;
    const n = newNpc(k, 0, y, behind ? s.v + 22 + Math.random() * 30 : 48 + Math.random() * 52 + Math.min(40, s.y / 300));
    n.x = pisteC(y, k) + n.off * hw * 0.8; npcs.push(n);
  }
  function updateNpcs(dt) {
    npcT -= dt;
    if (npcT <= 0) { npcT = 0.45 + Math.random() * 0.5; if (npcs.length < (s.piste ? 8 : 4) && run.t > 2) spawnNpc(); }
    for (let i = npcs.length - 1; i >= 0; i--) {
      const n = npcs[i];
      if (n.inv > 0) n.inv -= dt;
      if (n.state === 'wait') { n.timer -= dt; if (n.timer <= 0) { n.state = 'ski'; n.v = 8; } continue; }
      if (n.state === 'fall') { n.timer -= dt; if (n.timer <= 0) { n.state = 'ski'; n.v = 8; n.inv = 1.5; } continue; }
      n.v += (n.vt - n.v) * Math.min(1, 0.8 * dt); n.ph += n.rate * dt;
      const ya = n.y + 30, hw = Math.max(10, pisteHW(ya, n.k) - 8);
      const tx = pisteC(ya, n.k) + clamp(n.off + Math.sin(n.ph) * n.amp, -0.92, 0.92) * hw;
      let th = clamp((tx - n.x) / 28, -0.95, 0.95);
      for (let j = 0; j < vis.length; j++) {             // steer round trees and rocks
        const o = vis[j]; if (!o.r) continue;
        const dy = o.y - n.y; if (dy < 2 || dy > 40) continue;
        const dx = o.x - n.x; if (Math.abs(dx) < (o.wr || o.r) + 7) { th = dx >= 0 ? -1.05 : 1.05; break; }
      }
      const pdy = s.y - n.y, pdx = s.x - n.x;             // and round the player, when coming up from behind
      if (pdy > 2 && pdy < 50 && Math.abs(pdx) < 13) th = pdx >= 0 ? -1.05 : 1.05;
      n.th += (th - n.th) * Math.min(1, 4.5 * dt);
      n.x += Math.sin(n.th) * n.v * dt; n.y += Math.cos(n.th) * n.v * dt;
      if (n.inv <= 0 && s.inv <= 0 && s.z < 10 && (s.state === 'ski' || s.state === 'air') && pdx * pdx + pdy * pdy * 1.6 < 34) {
        n.state = 'fall'; n.timer = 1.7; fall(Math.random() < 0.5 ? 'SORRY!' : 'ON YOUR LEFT!');
      }
      if (n.y < camY - 170 || n.y > camY + H + 260 || Math.abs(n.x - s.x) > W + 260) npcs.splice(i, 1);
    }
  }

  function update(dt) {
    gather();
    if (mode !== 'play') return;
    run.t += dt;
    updateNpcs(dt);
    if (s.inv > 0) s.inv -= dt;

    if (s.state === 'fall' || s.state === 'stuck') {
      s.timer -= dt;
      if (s.timer <= 0) {
        if (run.falls >= MAX_FALLS) { gameOver(); return; }
        if (s.state === 'stuck' && s.well) { s.y = s.well.y + 9; }
        s.state = 'ski'; s.inv = 1.7; s.th = 0; s.v = 16;
      }
      return;
    }

    // steering
    let target = null; const air = s.state === 'air', rate = air ? 0.3 : 1;
    const braking = keys.up || brakeBtn || (stick.on && stick.y < -0.45 && Math.abs(stick.x) < -stick.y);
    if (stick.on || brakeBtn) {
      if (braking) target = s.th >= 0 ? HALF : -HALF;
      else if (stick.x * stick.x + stick.y * stick.y > 0.05) target = stick.y <= 0.02 ? (stick.x >= 0 ? HALF : -HALF) : Math.atan2(stick.x, stick.y);
    } else if (keys.left || keys.right || keys.up || keys.down) {
      if (keys.left) s.th -= 3.3 * rate * dt;
      if (keys.right) s.th += 3.3 * rate * dt;
      if (keys.down && !keys.left && !keys.right) target = 0;
      if (keys.up) target = s.th >= 0 ? HALF : -HALF;
    } else if (useMouse) {
      const dx = mouse.x - (s.x - camX), dy = mouse.y - (s.y - camY);
      if (dx * dx + dy * dy > 30) target = dy < 3 ? (dx >= 0 ? HALF : -HALF) : Math.atan2(dx, dy);
    }
    if (target !== null) { const d = target - s.th, st = 5.5 * rate * dt; s.th += Math.abs(d) < st ? d : (d > 0 ? st : -st); }
    s.th = clamp(s.th, -HALF, HALF);

    // speed
    const pq = pisteNear(s.x, s.y); s.piste = pq.d < pq.hw;   // groomed snow runs about a third faster than the glade
    const vmax = (100 + 72 * Math.min(1, s.y / 14000)) * (s.piste ? 1.3 : 1), cs = Math.cos(s.th);
    if (!air) {
      let vt = vmax * Math.pow(Math.max(0, cs), 0.75);
      if (cs < 0.22) vt = braking ? 0 : 9;
      s.v += (vt - s.v) * Math.min(1, (vt > s.v ? 0.95 : 2.8) * dt);
    }
    const prevY = s.y, step = s.v * dt;
    s.x += Math.sin(s.th) * step; s.y += cs * step;
    run.score += (s.y - prevY) / 10 * 2 * mult();
    if (s.v > 105) run.score += (s.v - 105) * 0.4 * mult() * dt;   // speed bonus: nothing below a brisk pace, then more the faster you go
    if (s.v > run.top) run.top = s.v;
    run.clean += dt;

    if (air) {
      s.airT += dt; s.vz -= G * dt; s.z += s.vz * dt;
      if (s.z <= 0) land();
    } else {
      const lt = tracks[tracks.length - 1];
      if (!lt || Math.abs(lt.x - s.x) + Math.abs(lt.y - s.y) > 1.2) { tracks.push({ x: s.x, y: s.y, c: cs, n: Math.sin(s.th) }); if (tracks.length > 620) tracks.shift(); }
      if (s.v > 55 && Math.abs(s.th) > 0.5 && Math.random() < 0.6) {
        parts.push({ x: s.x - Math.sin(s.th) * 2, y: s.y + 1, vx: -Math.sin(s.th) * 26 + (Math.random() - 0.5) * 24, vy: -18 - Math.random() * 22, life: 0.3 + Math.random() * 0.3, c: Math.random() < 0.5 ? C.white : C.snowDk });
      }
    }
    collide(prevY);
  }
  function stepFx(dt) {
    for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.life -= dt; if (p.life <= 0) { parts.splice(i, 1); continue; } p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 90 * dt; }
    for (let i = smoke.length - 1; i >= 0; i--) { const p = smoke[i]; p.life -= dt; if (p.life <= 0) { smoke.splice(i, 1); continue; } p.x += (6 + Math.sin(p.life * 3) * 5) * dt; p.y -= 9 * dt; }
    const drift = Math.sin(performance.now() / 4000) * 6 + 5;
    for (let i = 0; i < flakes.length; i++) {
      const f = flakes[i]; f.y += f.v * dt; f.x += (drift + Math.sin(f.w += dt * 1.6) * 5) * dt;
      if (f.y > H) { f.y = -2; f.x = Math.random() * W; } if (f.x > W) f.x -= W; if (f.x < 0) f.x += W;
    }
    const tx = Math.sin(s.th) * (s.state === 'idle' ? 0 : Math.min(W * 0.16, 44));
    look += (tx - look) * Math.min(1, 2.2 * dt);
    camX = s.x - W / 2 + look; camY = s.y - H * (H > W ? 0.26 : 0.3);
  }

  // ---- time of day: the run slides from afternoon through alpenglow into night ---------------
  const SKYKEYS = [[0, '#ffffff'], [40, '#ffffff'], [85, '#ffe2bd'], [125, '#f4b0ac'], [170, '#7b8bcb'], [1e9, '#6272ba']];
  function tintAt(t) {
    for (let i = 1; i < SKYKEYS.length; i++) if (t < SKYKEYS[i][0]) { const a = SKYKEYS[i - 1], b = SKYKEYS[i]; return mix(a[1], b[1], smooth((t - a[0]) / (b[0] - a[0]))); }
    return SKYKEYS[SKYKEYS.length - 1][1];
  }

  // ---- drawing ----------------------------------------------------------------------------
  function bySort(a, b) { return a.y - b.y; }
  const skEnt = { t: 'skier', y: 0 };
  function draw() {
    const cx = Math.round(camX), cy = Math.round(camY);
    const ox = -(((cx % 128) + 128) % 128), oy = -(((cy % 128) + 128) % 128);
    for (let y = oy; y < H; y += 128) for (let x = ox; x < W; x += 128) ctx.drawImage(TILE, x, y);

    drawPistes(cx, cy);
    for (let i = 0; i < vis.length; i++) { const o = vis[i]; if (o.wr) ctx.drawImage(SPR.well, o.x - cx - SPR.well.ax, o.y - cy - SPR.well.ay); }
    ctx.fillStyle = C.track;
    for (let i = 0; i < tracks.length; i++) {
      const p = tracks[i], x = p.x - cx, y = p.y - cy; if (y < -4 || y > H + 4) continue;
      ctx.fillRect(Math.round(x + p.c * 2), Math.round(y - p.n * 1.3), 1, 1); ctx.fillRect(Math.round(x - p.c * 2), Math.round(y + p.n * 1.3), 1, 1);
    }
    for (let i = 0; i < vis.length; i++) {
      const o = vis[i];
      if (o.sh && !o.got) ctx.drawImage(o.sh, o.x - cx - o.sh.width + 3, o.y - cy - (o.sh.height >> 1));
      if (o.ground) ctx.drawImage(o.spr, o.x - cx - o.spr.ax, o.y - cy - o.spr.ay);
    }
    drawLift(cx, cy);
    for (let i = 0; i < npcs.length; i++) { const n = npcs[i]; ctx.drawImage(SPR.shSk, Math.round(n.x - cx) - 6, Math.round(n.y - cy) - 2); }
    if (s.state !== 'stuck') {
      const sh = s.z > 6 ? SPR.shSkS : SPR.shSk;
      ctx.drawImage(sh, Math.round(s.x - cx - s.z * 0.35) - (sh.width >> 1) - 1, Math.round(s.y - cy) - (sh.height >> 1));
    }

    const list = vis.concat(npcs); skEnt.y = s.y + 0.5; list.push(skEnt); list.sort(bySort);
    for (let i = 0; i < list.length; i++) {
      const o = list[i];
      if (o === skEnt) { drawSkier(cx, cy); continue; }
      if (o.t === 'npc') { drawNpc(o, cx, cy); continue; }
      if (o.ground || o.got) continue;
      const sy = o.y - cy; if (sy < -4 || sy > H + 40) continue;
      if (o.t === 'item') {                              // bobs gently, with a glint, so it reads as a pickup
        const tt = performance.now() / 260 + o.x, bob = Math.round(Math.sin(tt) * 1.5);
        ctx.drawImage(o.spr, o.x - cx - (o.spr.width >> 1), sy - o.spr.height - 2 + bob);
        if (Math.sin(tt * 1.7) > 0.72) { ctx.fillStyle = C.gold; ctx.fillRect(o.x - cx + 5, sy - o.spr.height - 3 + bob, 1, 3); ctx.fillRect(o.x - cx + 4, sy - o.spr.height - 2 + bob, 3, 1); }
        continue;
      }
      ctx.drawImage(o.spr, o.x - cx - o.spr.ax, sy - o.spr.ay);
      if (o.t === 'cabin' && Math.random() < 0.09) smoke.push({ x: o.x + 8, y: o.y - 27, life: 1.6 + Math.random() });
    }

    for (let i = 0; i < smoke.length; i++) { const p = smoke[i]; ctx.fillStyle = p.life > 1.2 ? '#aab6c9' : '#c8d2e0'; ctx.fillRect(Math.round(p.x - cx), Math.round(p.y - cy), p.life > 0.8 ? 2 : 1, p.life > 0.8 ? 2 : 1); }
    for (let i = 0; i < parts.length; i++) { const p = parts[i]; ctx.fillStyle = p.c; ctx.fillRect(Math.round(p.x - cx), Math.round(p.y - cy), 1, 1); }

    // light: tint the whole frame, then add warm lights back on top
    const night = smooth((run.t - 120) / 55);
    if (run.t > 40) {
      ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = tintAt(run.t); ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      if (night > 0.02) {
        ctx.globalAlpha = night;
        for (let i = 0; i < vis.length; i++) { const o = vis[i]; if (o.t === 'cabin') { ctx.drawImage(SPR.glow, o.x - cx - 48 - 7, o.y - cy - 48 - 6); ctx.drawImage(SPR.glow, o.x - cx - 48 + 8, o.y - cy - 48 - 6); } }
        ctx.globalAlpha = night * 0.8;                 // the skier's headlamp, thrown down the hill
        ctx.drawImage(SPR.glow, Math.round(s.x - cx + Math.sin(s.th) * 22) - 48, Math.round(s.y - cy - s.z + Math.cos(s.th) * 22) - 48);
        ctx.globalAlpha = 1;
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.fillStyle = night > 0.5 ? '#dfe7f5' : C.white;
    for (let i = 0; i < flakes.length; i++) { const f = flakes[i]; ctx.fillRect(Math.round(f.x), Math.round(f.y), 1, f.big ? 2 : 1); }
  }
  function drawNpc(n, cx, cy) {
    const x = Math.round(n.x - cx), y = Math.round(n.y - cy);
    if (y < -30 || y > H + 30) return;
    if (n.state === 'fall') { ctx.drawImage(n.spr.crash, x - 15, y - 17); return; }
    ctx.drawImage(n.spr.dir[clamp(Math.round(n.th / HALF * 4), -4, 4) + 4], x - 15, y - 24);
  }
  function drawPistes(cx, cy) {
    const k0 = Math.round((cx + W / 2) / PISTE_P), m = ((cx % 3) + 3) % 3;
    ctx.save(); ctx.translate(-m, 0);
    for (let k = k0 - 1; k <= k0 + 1; k++) {
      for (let row = 0; row < H; row++) {
        const y = cy + row, hw = pisteHW(y, k); if (hw < 3) continue;
        const c = pisteC(y, k), j = Math.round(hash(k, y >> 2, 91) * 2);
        const x0 = Math.round(c - hw - cx) - j, x1 = Math.round(c + hw - cx) + Math.round(hash(k, y >> 2, 92) * 2);
        if (x1 < 0 || x0 > W) continue;
        ctx.fillStyle = SPR.cord; ctx.fillRect(x0 + m, row, x1 - x0, 1);
        ctx.fillStyle = C.snowSh; ctx.fillRect(x0 + m - 1, row, 2, 1); ctx.fillRect(x1 + m - 1, row, 2, 1);   // the groomer's berm
      }
    }
    ctx.restore();
    for (let k = k0 - 1; k <= k0 + 1; k++) {               // marker poles down both edges
      for (let y = Math.ceil((cy - 10) / 96) * 96; y < cy + H + 10; y += 96) {
        const hw = pisteHW(y, k); if (hw < 20 || (k === 0 && y < 0)) continue;
        const c = pisteC(y, k);
        ctx.drawImage(SPR.pole[0], Math.round(c - hw - cx) - 3, y - cy - 7); ctx.drawImage(SPR.pole[1], Math.round(c + hw - cx) + 1, y - cy - 7);
      }
    }
  }
  function drawLift(cx, cy) {                            // the chairlift that drops everyone at the top
    if (cy > 90) return;
    const x = -cx, top = -44 - cy, t = performance.now() / 1000;
    ctx.fillStyle = '#39415b'; ctx.fillRect(x - 12, 0, 1, Math.max(0, top)); ctx.fillRect(x + 12, 0, 1, Math.max(0, top));
    for (let ty = -190; ty > cy - 30; ty -= 170) ctx.drawImage(SPR.tower, x - SPR.tower.ax, ty - cy - SPR.tower.ay);
    for (let i = 0; i < 9; i++) {
      const u = (t * 22 + i * 66) % 594;
      const ya = -44 - 594 + u - cy, yb = -44 - u - cy;   // arriving full on the left, leaving empty on the right
      if (ya > -14 && ya < top - 4) ctx.drawImage(SPR.chairs[i % 3], x - 12 - 5, Math.round(ya));
      if (yb > -14 && yb < top - 4) ctx.drawImage(SPR.chairs[3], x + 12 - 5, Math.round(yb));
    }
    ctx.drawImage(SPR.station, x - SPR.station.ax, -36 - cy - SPR.station.ay);
  }
  function drawSkier(cx, cy) {
    const x = Math.round(s.x - cx), y = Math.round(s.y - cy);
    if (s.state === 'fall') { ctx.drawImage(SK.crash, x - 15, y - 17); return; }
    if (s.state === 'stuck') { ctx.drawImage(SK.stuck, x - 11, y - 12); return; }
    if (s.inv > 0 && Math.floor(s.inv * 12) % 2 === 0) return;
    const idx = clamp(Math.round(s.th / HALF * 4), -4, 4) + 4, air = s.state === 'air';
    const yy = y - Math.round(s.z);
    ctx.drawImage((air ? SK.air : SK.dir)[idx], x - 15, yy - 24);
    if (s.state !== 'idle') {                            // scarf tail streaming back up the hill
      const n = 2 + Math.round(s.v / 55), lean = Math.round(Math.sin(s.th) * 2), by = yy - (air ? 15 : 13), t = performance.now() / 90;
      for (let i = 1; i <= n; i++) {
        ctx.fillStyle = i === n ? SK.K.scarfSh : SK.K.scarf;
        ctx.fillRect(Math.round(x + lean - 3 - Math.sin(s.th) * i * 0.9 + Math.sin(t + i) * 0.7) - (s.th > 0.4 ? 0 : 0), by - i + (i > 2 ? 1 : 0), 1, 1);
      }
    }
  }

  // ---- loop -------------------------------------------------------------------------------
  let last = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000; last = now; if (!(dt > 0)) return; if (dt > 0.05) dt = 0.05;
    if (mode === 'pause') { draw(); return; }
    const sub = dt > 0.02 ? 2 : 1;                       // two physics steps on slow frames, so nothing tunnels
    for (let i = 0; i < sub; i++) update(dt / sub);
    stepFx(dt); draw(); if (mode === 'play') hud(false);
  }

  // ---- leaderboard -----------------------------------------------------------------------------
  // Initials that spell something rude are refused here and, authoritatively, by the server.
  const BLOCK = ('ASS AZZ ARS FUK FUC FCK FUX FUQ FKU FKN FUG FAG FGT SEX SXY TIT TTS CUM KUM JIZ JZZ DIK DIC DCK DIX DIQ COK COC KOK CNT KNT CUN ' +
    'PUS PSY VAG VAJ HOR HOE WHR SLT SLU BCH SHT POO PEE PIS PSS NIG NGR NGA NIP KKK NAZ FAP WTF STF KYS DIE KIL RAP RPE PED PDO ANL ANU BUT BTT TWT WNK ' +
    'SUK SUC BJS SMD GTF PRN MLF THT XXX FU FK BJ HJ').split(' ');
  function cleanInitials(v) { return String(v || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3); }
  function rude(n) { return BLOCK.indexOf(n) >= 0; }

  let board = [], online = false;
  const LOCAL_KEY = 'glade-run-scores', NAME_KEY = 'glade-run-initials', KIT_KEY = 'glade-run-kit';
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function localBoard() { try { const a = JSON.parse(store(LOCAL_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function loadBoard() {
    return fetch(API + '/scores', { cache: 'no-store' }).then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (j) { if (!j || !Array.isArray(j.top)) throw 0; board = j.top; online = true; })
      .catch(function () { board = localBoard(); online = false; })
      .then(renderBoards);
  }
  function renderBoards(mark) {
    const lists = document.querySelectorAll('[data-board]');
    for (let k = 0; k < lists.length; k++) {
      const ol = lists[k]; ol.textContent = '';
      const rows = board.slice(0, 10);
      if (!rows.length) { const li = document.createElement('li'); li.className = 'empty'; li.textContent = 'No runs yet. Be the first.'; ol.appendChild(li); }
      rows.forEach(function (r, i) {
        const li = document.createElement('li'); if (mark && r === mark) li.className = 'me';
        [String(i + 1).padStart(2, ' '), cleanInitials(r.n) || '---', Number(r.s || 0).toLocaleString('en-US'), fmtTime(Number(r.t || 0)), Math.round(Number(r.d || 0)) + ' m'].forEach(function (txt, c) {
          const sp = document.createElement('span'); sp.className = 'c' + c; sp.textContent = txt; li.appendChild(sp);
        });
        ol.appendChild(li);
      });
    }
    const tags = document.querySelectorAll('[data-board-tag]');
    for (let k = 0; k < tags.length; k++) tags[k].textContent = online ? 'TOP RUNS' : 'TOP RUNS ON THIS DEVICE';
  }
  function saveScore(n) {
    const rec = { n: n, s: Math.floor(run.score), t: Math.round(run.t * 10) / 10, d: Math.floor(s.y / 10), c: Math.round(run.bestClean), j: run.jumps };
    function local() {
      const a = localBoard(); a.push(rec); a.sort(function (x, y) { return y.s - x.s; }); a.length = Math.min(a.length, 25);
      store(LOCAL_KEY, JSON.stringify(a)); board = a; online = false; renderBoards(rec); return { ok: true, local: true };
    }
    if (!online) return Promise.resolve(local());
    return fetch(API + '/scores', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ token: run.token }, rec)) })
      .then(function (r) { return r.json().then(function (j) { return { status: r.status, j: j }; }); })
      .then(function (res) {
        if (res.status === 422 && res.j && res.j.error === 'initials') return { ok: false, initials: true };
        if (res.status !== 200 || !res.j || !Array.isArray(res.j.top)) return { ok: false };
        board = res.j.top; const mine = board[res.j.rank - 1]; renderBoards(mine); return { ok: true, rank: res.j.rank };
      })
      .catch(function () { return { ok: false }; });
  }

  // ---- screens --------------------------------------------------------------------------------
  function show(id) { ['menu', 'over', 'paused'].forEach(function (k) { $(k).hidden = k !== id; }); document.body.className = 'mode-' + mode; }
  function startRun() {
    resetWorld(); SK = buildSkier(KITS[kit]);
    mode = 'play'; s.state = 'ski'; s.th = 0; s.v = 18; lastMult = 1; run.started = Date.now();
    useMouse = false; show(null); hud(true);
    fetch(API + '/run', { method: 'POST' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { if (j && j.token) run.token = j.token; }).catch(function () { });
  }
  function gameOver() {
    mode = 'over'; if (run.clean > run.bestClean) run.bestClean = run.clean;
    $('o-score').textContent = Math.floor(run.score).toLocaleString('en-US');
    $('o-time').textContent = fmtTime(run.t);
    $('o-dist').textContent = Math.floor(s.y / 10).toLocaleString('en-US') + ' m';
    $('o-clean').textContent = fmtTime(run.bestClean);
    $('o-jumps').textContent = run.jumps + ' / ' + run.bigAir.toFixed(1) + ' s';
    $('o-speed').textContent = Math.round(run.top * 0.36) + ' km/h';
    $('o-items').textContent = String(run.items);
    $('o-form').hidden = false; $('o-saved').hidden = true; $('o-msg').textContent = '';
    const inp = $('o-name'); inp.value = cleanInitials(store(NAME_KEY)); $('o-save').disabled = false;
    show('over'); loadBoard();
    setTimeout(function () { if (matchMedia('(pointer: fine)').matches) inp.focus(); }, 60);
  }
  function togglePause(force) {
    if (mode === 'play' && force !== false) { mode = 'pause'; show('paused'); }
    else if (mode === 'pause' && force !== true) { mode = 'play'; show(null); last = performance.now(); }
  }
  function setKit(k) {
    if (k === 'bigfoot') k = 'sasquatch';
    kit = KITS[k] ? k : 'A'; store(KIT_KEY, kit); SK = buildSkier(KITS[kit]);
    const bs = document.querySelectorAll('[data-kit]');
    for (let i = 0; i < bs.length; i++) bs[i].setAttribute('aria-pressed', bs[i].getAttribute('data-kit') === kit ? 'true' : 'false');
  }

  // ---- input ----------------------------------------------------------------------------------
  const KEYMAP = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down' };
  window.addEventListener('keydown', function (e) {
    if (e.target && e.target.tagName === 'INPUT') return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = KEYMAP[e.key];
    if (k) { keys[k] = true; useMouse = false; if (mode === 'play') e.preventDefault(); return; }
    if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault(); if (e.repeat) return;
      if (mode === 'play') jump(); else if (mode === 'pause') togglePause(); else startRun();
    } else if (e.key === 'Enter') { if (mode === 'menu' || mode === 'over') { e.preventDefault(); startRun(); } else if (mode === 'pause') togglePause(); }
    else if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') togglePause();
  });
  window.addEventListener('keyup', function (e) { const k = KEYMAP[e.key]; if (k) keys[k] = false; });
  window.addEventListener('blur', function () { keys.left = keys.right = keys.up = keys.down = false; brakeBtn = false; togglePause(true); });
  document.addEventListener('visibilitychange', function () { if (document.hidden) togglePause(true); });

  function point(e) { mouse.x = e.clientX / SCALE; mouse.y = e.clientY / SCALE; }
  cv.addEventListener('pointermove', function (e) { if (e.pointerType === 'touch') return; point(e); useMouse = true; });
  cv.addEventListener('pointerdown', function (e) {
    if (mode !== 'play') return;
    if (e.pointerType !== 'touch' && e.button === 0) jump();   // touch steers with the thumb stick instead
    e.preventDefault();
  });

  // thumb stick: push it the way you want to travel (down = straight, sideways = traverse, up = brake)
  const stickEl = $('stick'), knob = $('knob');
  function stickMove(e) {
    const r = stickEl.getBoundingClientRect(), R = r.width / 2;
    let x = (e.clientX - r.left - R) / (R * 0.62), y = (e.clientY - r.top - R) / (R * 0.62);
    const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; }
    stick.x = x; stick.y = y;
    knob.style.transform = 'translate(' + (x * R * 0.62).toFixed(1) + 'px,' + (y * R * 0.62).toFixed(1) + 'px)';
  }
  stickEl.addEventListener('pointerdown', function (e) {
    e.preventDefault(); if (stick.on) return;
    stick.on = true; stick.id = e.pointerId; useMouse = false; stickEl.classList.add('on');
    try { stickEl.setPointerCapture(e.pointerId); } catch (err) { /* synthetic pointer */ }
    stickMove(e);
  });
  stickEl.addEventListener('pointermove', function (e) { if (stick.on && e.pointerId === stick.id) stickMove(e); });
  function stickEnd(e) {
    if (!stick.on || e.pointerId !== stick.id) return;
    stick.on = false; stick.x = stick.y = 0; knob.style.transform = ''; stickEl.classList.remove('on');   // heading holds until the next push
  }
  stickEl.addEventListener('pointerup', stickEnd); stickEl.addEventListener('pointercancel', stickEnd);
  const brakeEl = $('btn-brake');
  brakeEl.addEventListener('pointerdown', function (e) { e.preventDefault(); brakeBtn = true; try { brakeEl.setPointerCapture(e.pointerId); } catch (err) { /* synthetic */ } });
  function brakeEnd() { brakeBtn = false; }
  brakeEl.addEventListener('pointerup', brakeEnd); brakeEl.addEventListener('pointercancel', brakeEnd);
  document.addEventListener('contextmenu', function (e) { if (e.target.closest && e.target.closest('#touch')) e.preventDefault(); });
  cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  $('btn-jump').addEventListener('pointerdown', function (e) { e.preventDefault(); jump(); });
  $('btn-pause').addEventListener('click', function () { togglePause(); });
  $('btn-resume').addEventListener('click', function () { togglePause(false); });
  $('btn-start').addEventListener('click', startRun);
  $('btn-again').addEventListener('click', startRun);
  const kitBtns = document.querySelectorAll('[data-kit]');
  for (let i = 0; i < kitBtns.length; i++) kitBtns[i].addEventListener('click', function () { setKit(this.getAttribute('data-kit')); });

  // which side the thumb stick sits on (touch only); remembered per device
  const SIDE_KEY = 'glade-run-stick-side';
  function setSide(side) {
    side = side === 'left' ? 'left' : 'right'; store(SIDE_KEY, side);   // right unless the player chose left
    document.documentElement.classList.toggle('swap', side === 'right');
    const bs = document.querySelectorAll('[data-side]');
    for (let i = 0; i < bs.length; i++) bs[i].setAttribute('aria-pressed', bs[i].getAttribute('data-side') === side ? 'true' : 'false');
  }
  const sideBtns = document.querySelectorAll('[data-side]');
  for (let i = 0; i < sideBtns.length; i++) sideBtns[i].addEventListener('click', function () { setSide(this.getAttribute('data-side')); });
  setSide(store(SIDE_KEY));

  $('o-name').addEventListener('input', function () { this.value = cleanInitials(this.value); $('o-msg').textContent = ''; });
  $('o-form').addEventListener('submit', function (e) {
    e.preventDefault();
    const n = cleanInitials($('o-name').value), msg = $('o-msg');
    if (n.length < 2) { msg.textContent = 'Enter two or three letters.'; return; }
    if (rude(n)) { msg.textContent = 'Let’s keep it friendly. Try other initials.'; return; }
    $('o-save').disabled = true; msg.textContent = 'Saving…';
    saveScore(n).then(function (res) {
      if (res.ok) {
        store(NAME_KEY, n); $('o-form').hidden = true; $('o-saved').hidden = false;
        $('o-saved').textContent = res.local ? 'Saved on this device.' : (res.rank ? 'Saved. You are #' + res.rank + ' on the mountain.' : 'Saved.');
      } else {
        $('o-save').disabled = false;
        msg.textContent = res.initials ? 'Let’s keep it friendly. Try other initials.' : 'Couldn’t reach the leaderboard. Try again.';
      }
    });
  });

  // ---- the cocoa at the end: a mug, a peppermint stick and a curl of steam ---------------------
  (function mug() {
    const c = $('mug'), g = c.getContext('2d');
    function P(x, y, w, h, col) { g.fillStyle = col; g.fillRect(x, y, w, h); }
    function drawMug() {
      if (mode !== 'over') return;
      const t = performance.now() / 1000; g.clearRect(0, 0, c.width, c.height);
      // steam: each strand is rooted at the cocoa and sways more the higher it gets, with a slow
      // wave travelling up it, so the wisps dance from the top instead of hopping out of the mug
      for (let w = 0; w < 2; w++) {                      // two strands, nearly in step, so they sway together and don't tangle
        const base = 7 + w * 5, ph = w * 0.8, len = 12 + Math.round(Math.sin(t * 0.6 + ph) * 1.5);
        let prev = base;
        for (let j = 0; j < len; j++) {
          const amp = Math.min(2, j * 0.22), lean = Math.sin(t * 0.75 + ph) * j * 0.16;
          const x = Math.round(base + Math.sin(j * 0.6 - t * 2.1 + ph) * amp + lean), y = 16 - j;
          g.globalAlpha = 0.78 * Math.pow(1 - j / len, 1.15);
          const a = Math.min(prev, x), bw = Math.abs(prev - x) + 1;
          P(bw > 2 ? a : x, y, bw > 2 ? bw : 1, 1, '#f7eedd');   // bridge any sideways step so the strand never breaks
          prev = x;
        }
      }
      g.globalAlpha = 1;
      for (let i = 0; i < 13; i++) {                     // peppermint stick, leaning out of the mug
        const x = 15 + Math.round(i * 0.55), y = 18 - i; P(x, y, 3, 1, (i >> 1) % 2 ? '#d43d3d' : '#ffffff');
      }
      P(21, 5, 2, 1, '#ffffff');
      P(4, 17, 18, 1, '#fff6e6'); P(5, 18, 16, 1, '#6b4226'); P(6, 18, 3, 1, '#8a5a36');          // rim and cocoa
      P(8, 18, 2, 1, '#ffffff'); P(12, 18, 2, 1, '#fff6e6');                                        // marshmallows
      for (let i = 15; i < 18; i++) P(15 + Math.round((18 - i) * 0.55), i, 3, 1, ((18 - i) >> 1) % 2 ? '#d43d3d' : '#ffffff');
      P(4, 19, 18, 10, '#ee6c4d'); P(4, 19, 2, 10, '#ff9d84'); P(19, 19, 3, 10, '#b94a30'); P(5, 29, 16, 1, '#b94a30');
      const OG = ['111 111', '101 100', '101 101', '101 101', '111 111'];                          // "OG", in cream
      for (let r = 0; r < 5; r++) for (let q = 0; q < 7; q++) if (OG[r][q] === '1') P(8 + q, 21 + r, 1, 1, '#fff6e6');
      P(22, 20, 3, 1, '#ee6c4d'); P(24, 21, 2, 5, '#ee6c4d'); P(22, 26, 3, 1, '#b94a30');           // handle
      P(2, 30, 22, 1, '#fff6e6'); P(4, 31, 18, 1, '#d9cdb8');                                       // saucer
    }
    setInterval(drawMug, 110);
  })();

  // ---- boot -----------------------------------------------------------------------------------
  SPR = buildStatic(); TILE = buildTile(); NPCS = buildNpcs();
  resize(); resetWorld();
  setKit(store(KIT_KEY) || 'A');
  (function previews() {
    const cs = document.querySelectorAll('[data-kit] canvas');
    for (let i = 0; i < cs.length; i++) {
      const k = cs[i].parentNode.getAttribute('data-kit'), g = cs[i].getContext('2d');
      g.imageSmoothingEnabled = false; g.drawImage(buildSkier(KITS[k]).dir[5], 0, -3);
    }
  })();
  let rz = 0;
  window.addEventListener('resize', function () { clearTimeout(rz); rz = setTimeout(function () { resize(); camX = s.x - W / 2 + look; }, 120); });
  show('menu'); hud(true); loadBoard();
  window.GLADE = { art: function () { return { SPR: SPR, TILE: TILE, build: buildSkier, KITS: KITS }; }, npcs: npcs, stick: stick, s: s, run: run, keys: keys, start: startRun, vis: vis, mode: function () { return mode; } };   // handy for testing
  requestAnimationFrame(function (t) { last = t; requestAnimationFrame(frame); });
})();
