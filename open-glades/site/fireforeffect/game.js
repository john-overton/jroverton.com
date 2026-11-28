/*
 * Fire for Effect — a turn-based artillery game for openglades.com/fireforeffect.
 *
 * The battlefield is a grid of material cells, one per pixel, simulated as a cellular automaton:
 *   DIRT    packed earth. Holds any slope, but falls when there is nothing beneath it.
 *   LOOSE   dirt in motion. Slides into 45 degree piles, then packs back into DIRT (or MUD if wet).
 *   MUD     slumps slowly until its slope is gentle.
 *   WATER   falls, runs downhill and pools. Dirt and mud sink through it.
 *   ROCK    bedrock. Never moves; only the heaviest shells chip it.
 *   FIRE    burning fuel. Runs downhill like water, burns out (its shade bits hold the fuel left), and dies in water.
 * A cell is one byte: material in the low 3 bits, a colour shade in the next 3.
 * Everything is drawn in code; there are no image or sound files.
 */
(function () {
  'use strict';

  const AIR = 0, DIRT = 1, LOOSE = 2, MUD = 3, WATER = 4, ROCK = 5, FIRE = 6;
  const H = 300, FLOOR = 8;                 // world height; the bottom rows can never be destroyed
  const WIND_K = 3, DT = 1 / 60;
  let GRAV = 120, WALL = 'out', SOFT = 0;   // set per match: gravity, what the side walls do, and whether the ground is loose sand or dust
  const GRASS = 6, SCORCH = 7;              // reserved shades
  let W = 640, G = new Uint8Array(W * H);

  const TEAMS = [
    { name: 'RED', main: '#e0524a', dark: '#8f2a2e', lite: '#ff9a8a' },
    { name: 'BLUE', main: '#4a8fe0', dark: '#27508f', lite: '#a8d0ff' },
    { name: 'GREEN', main: '#5cb850', dark: '#2f7036', lite: '#b4f0a0' },
    { name: 'GOLD', main: '#e8b83a', dark: '#9a7420', lite: '#fff0a0' }
  ];
  // ai: the computer may choose it. Everything else about a weapon is read where it is used.
  const WEAPONS = [
    { id: 'shell', name: 'SHELL', ammo: Infinity, r: 10, dmg: 32, ai: true },
    { id: 'heavy', name: 'HEAVY SHELL', ammo: 2, r: 21, dmg: 62, rock: true, ai: true },
    { id: 'bnuke', name: 'BABY NUKE', ammo: 1, r: 32, dmg: 88, nuke: 1, ai: true },
    { id: 'nuke', name: 'NUKE', ammo: 1, r: 50, dmg: 125, nuke: 2 },
    { id: 'cluster', name: 'CLUSTER', ammo: 2, r: 7, dmg: 20, split: 5, ai: true },
    { id: 'mirv', name: 'MIRV', ammo: 1, r: 21, dmg: 52, split: 5, nuke: 0.5, ai: true },
    { id: 'area', name: 'AREA DENIAL', ammo: 1, r: 8, dmg: 20, split: 5, mines: 3, ai: true },
    { id: 'layer', name: 'MINE LAYER', ammo: 1, r: 11, dmg: 34, split: 3, kidMine: true },
    { id: 'barrage', name: 'BARRAGE', ammo: 1, r: 10, dmg: 26, salvo: 8, ai: true },
    { id: 'scatter', name: 'SCATTER BOMB', ammo: 2, r: 9, dmg: 20, scatter: 6, ai: true },
    { id: 'disco', name: 'DISCO BOMB', ammo: 1, r: 8, dmg: 14, ball: 10, disco: true, ai: true },
    { id: 'skipper', name: 'SKIPPER', ammo: 2, r: 9, dmg: 24, hops: 2, ai: true },
    { id: 'roller', name: 'ROLLER', ammo: 2, r: 12, dmg: 40, roll: true },
    { id: 'digger', name: 'DIGGER', ammo: 2, r: 13, dmg: 42, dig: 48 },
    { id: 'buster', name: 'BUNKER BUSTER', ammo: 1, r: 21, dmg: 62, rock: true, dig: 54, ai: true },
    { id: 'drone', name: 'STRAFING DRONE', ammo: 1, r: 15, dmg: 46, drone: true, ai: true },
    { id: 'guided', name: 'GUIDED BOMB', ammo: 1, r: 21, dmg: 62, rock: true, guided: true },
    { id: 'air', name: 'AIRSTRIKE', ammo: 1, call: 'air' },
    { id: 'rod', name: 'RODS FROM GOD', ammo: 1, call: 'rod' },
    { id: 'ion', name: 'ION CANNON', ammo: 1, call: 'ion' },
    { id: 'plasma', name: 'PLASMA CUTTER', ammo: 2, dmg: 34, cone: true },
    { id: 'minigun', name: 'MINIGUN', ammo: 1, gun: 3 },
    { id: 'lance', name: 'LANCE', ammo: 2, dmg: 45, beam: true },
    { id: 'inferno', name: 'INFERNO', ammo: 2, r: 6, dmg: 10, napalm: 9, ai: true },
    { id: 'excav', name: 'EXCAVATOR', ammo: 2, r: 24, dust: true },
    { id: 'dirt', name: 'DIRT CHARGE', ammo: 3, r: 15, fill: LOOSE },
    { id: 'mover', name: 'EARTH MOVER', ammo: 1, r: 26, fill: LOOSE },
    { id: 'mother', name: 'MOTHER OF DIRT', ammo: 1, r: 37, fill: LOOSE },
    { id: 'mud', name: 'MUD CHARGE', ammo: 2, r: 19, dmg: 8, mud: true },
    { id: 'rain', name: 'RAIN MAKER', ammo: 2, r: 14, fill: WATER },
    { id: 'tracer', name: 'TRACER', ammo: 5, tracer: true }
  ];
  const BOMBLET = { id: 'bomblet', r: 8, dmg: 18 }, DISCO = { id: 'disco2', r: 10, dmg: 20, disco: true };
  const MINE = { id: 'mine', r: 11, dmg: 34, mine: true }, AIRBOMB = { id: 'airbomb', r: 12, dmg: 32 };
  const NEON = ['#ff4fd8', '#4ff0ff', '#7dff5a', '#ffe14f', '#b06bff', '#ff8a3c'];

  // ---------- helpers ----------
  function rngOf(seed) { let a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const rnd = Math.random;
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function abgr(hex, a) { const n = parseInt(hex.slice(1), 16); return (((a === undefined ? 255 : a) << 24) | ((n & 255) << 16) | (n & 0xff00) | (n >> 16)) >>> 0; }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { /* private mode */ } return null; }
  function solid(c) { const m = c & 7; return m === DIRT || m === LOOSE || m === MUD || m === ROCK; }
  function cell(x, y) { return (x < 0 || x >= W || y >= H) ? ROCK : y < 0 ? AIR : G[y * W + x]; }

  // ---------- biomes, skies and weather ----------
  // soft: the ground never packs (sand, moon dust). dust: blasts leave a haze. grav: what AUTO gravity means here.
  const BIOMES = {
    grass: { name: 'GRASSLAND', dirt: '#96633a', top: '#6cc04a', mud: '#5e4a3a', rock: '#6a7180', water: '#3f8fdc', foam: '#bfe6ff', topD: 2, amp: 1, waterP: 0.8, mudN: 4, weather: ['clear', 'clear', 'clear', 'rain', 'storm', 'meteor'] },
    snow: { name: 'SNOW', dirt: '#7d6a5c', top: '#f2f6fb', mud: '#5a5048', rock: '#7c8696', water: '#7fb8e8', foam: '#e8f6ff', topD: 6, amp: 1.05, waterP: 0.5, mudN: 1, rim: '#e8eef6', weather: ['snow', 'snow', 'clear'] },
    jungle: { name: 'JUNGLE', dirt: '#6e4a2a', top: '#2f9a3a', mud: '#4a3a2a', rock: '#56625c', water: '#3aa08a', foam: '#b0f0d8', topD: 4, amp: 0.9, waterP: 1, mudN: 9, bumpy: true, weather: ['clear', 'rain', 'rain', 'storm'] },
    mountain: { name: 'MOUNTAINS', dirt: '#857a6c', top: '#e8eef6', mud: '#5c544c', rock: '#7a8090', water: '#4f9fe0', foam: '#d8f0ff', topD: 3, amp: 1.5, waterP: 0.5, mudN: 1, rocky: true, peaks: true, rim: '#e8eef6', weather: ['clear', 'snow', 'storm'] },
    mars: { name: 'MARS', dirt: '#c8663a', top: '#e08a4a', mud: '#8a4a30', rock: '#7a3a2a', water: '#3f8fdc', foam: '#bfe6ff', topD: 2, amp: 0.9, waterP: 0, mudN: 0, noRock: true, craters: 5, grav: 0.4, sky: 'mars', nightSky: 'marsnight', meteors: true, ufos: true, dust: true, weather: ['clear', 'dust', 'meteor'] },
    moon: { name: 'THE MOON', dirt: '#9a9aa6', top: '#c8c8d2', mud: '#6a6a74', rock: '#52525e', water: '#3f8fdc', foam: '#bfe6ff', topD: 3, amp: 0.6, waterP: 0, mudN: 0, soft: 2, craters: 9, grav: 0.17, sky: 'space', weather: ['clear', 'clear', 'meteor'] },
    beach: { name: 'BEACH', dirt: '#e6cf8a', top: '#f6e8b0', mud: '#b8a070', rock: '#8a7f70', water: '#3fb8dc', foam: '#e8fbff', topD: 2, amp: 0.5, waterP: 1, sea: true, mudN: 0, soft: 1, times: ['day', 'day', 'dawn', 'dusk'], weather: ['clear', 'clear', 'rain'] },
    desert: { name: 'DESERT', dirt: '#d8a85a', top: '#ecc878', mud: '#a07a48', rock: '#a8643e', water: '#3f8fdc', foam: '#bfe6ff', topD: 3, amp: 0.7, waterP: 0, mudN: 0, dust: true, mesa: true, times: ['day', 'dusk', 'night', 'dawn'], weather: ['clear', 'dust', 'dust'] },
    rainy: { name: 'RAINY', like: 'grass', weather: ['rain'] },
    thunder: { name: 'THUNDERSTORM', like: 'grass', weather: ['storm'] }
  };
  ['rainy', 'thunder'].forEach(function (k) { const b = BIOMES[k], g = BIOMES[b.like]; for (const f in g) if (!(f in b)) b[f] = g[f]; });
  const BIOME_ROLL = ['grass', 'grass', 'snow', 'jungle', 'mountain', 'mars', 'moon', 'beach', 'desert'];
  const WEATHER = { clear: '', rain: 'RAIN', storm: 'THUNDERSTORM', snow: 'SNOWFALL', dust: 'DUST STORM', meteor: 'METEOR STORM' };
  const SKY = {
    dusk: { bands: ['#171c40', '#232552', '#3a2c66', '#5b3674', '#86417a', '#b55372', '#de7062', '#f39a5c', '#fbc670', '#fde3a0'], hills: [['#6a3f78', '#7d4a80'], ['#3d2a5c', '#4a3168']], cloud: ['#f7c9b0', '#c98a9a', '#ffe9d0'], stars: 1, orb: { c: '#fff3c4', c2: '#ffd27a', halo: '#ffd9a0', x: 0.7, y: 0.5, r: 0.085 } },
    dawn: { bands: ['#2a3a6a', '#4a5a8e', '#8a7aa8', '#c890a8', '#f0a898', '#f8c090', '#fcd8a0', '#fdeab8'], hills: [['#7a6a98', '#9080a8'], ['#4a4a78', '#5a5a88']], cloud: ['#ffe0d0', '#e8a8b0', '#fff4e8'], stars: 0.3, orb: { c: '#fff8d8', c2: '#ffe0a0', halo: '#ffe8c0', x: 0.24, y: 0.6, r: 0.07 } },
    day: { bands: ['#2f6fd0', '#3f80dc', '#5494e6', '#6ea8ee', '#8cbef4', '#aad2f8', '#c6e2fa', '#dceefc'], hills: [['#7aa0c8', '#8cb0d4'], ['#4f7fa8', '#5f8fb8']], cloud: ['#ffffff', '#c8d8ec', '#ffffff'], stars: 0, orb: { c: '#fffbe0', c2: '#fff3a8', halo: '#fff7c8', x: 0.78, y: 0.16, r: 0.055 } },
    night: { bands: ['#04051a', '#070a24', '#0b102e', '#101838', '#162042', '#1c2a4c'], hills: [['#18223e', '#202c4a'], ['#0e1428', '#141c34']], cloud: ['#2a3450', '#1a2238', '#3a4664'], stars: 2.6, orb: { c: '#e8ecf4', c2: '#c8d0dc', halo: '#3a4a6a', x: 0.3, y: 0.2, r: 0.055, moon: true } },
    storm: { bands: ['#14161f', '#1e222e', '#2a303c', '#363e4a', '#444c58', '#525a66'], hills: [['#3a4250', '#444c5a'], ['#262c38', '#2e3442']], cloud: ['#4a5262', '#343a48', '#5a6272'], stars: 0, clouds: 11 },
    mars: { bands: ['#3a2030', '#5a3038', '#8a4a40', '#b06a4a', '#cc8656', '#e0a066', '#eeb87a', '#f4cc90'], hills: [['#a8603e', '#b87048'], ['#7a3e2c', '#8a4a34']], cloud: null, stars: 0.5, orb: { c: '#fff4e8', c2: '#ffe8d0', halo: '#f0c8a0', x: 0.66, y: 0.3, r: 0.032 } },
    marsnight: { bands: ['#07050c', '#0e0a14', '#170f1c', '#221524', '#2e1c2a', '#3a2430'], hills: [['#3a2028', '#462830'], ['#22121a', '#2c1820']], cloud: null, stars: 2.8, dots: [[0.3, 0.22, 2, '#d8c8b8'], [0.58, 0.13, 1, '#e8dcd0']] },   // no big moon: Phobos and Deimos are specks
    space: { bands: ['#000004', '#010108', '#03030c', '#05050f'], hills: [['#5a5a66', '#6c6c78'], ['#3a3a44', '#4a4a54']], cloud: null, stars: 3.6, orb: { c: '#3f8fdc', c2: '#5cb850', halo: '#16284a', x: 0.72, y: 0.24, r: 0.08, earth: true } }
  };
  let ENV = { key: 'grass', b: BIOMES.grass, time: 'dusk', weather: 'clear', sky: 'dusk' };
  function shadeHex(hex, k) { const n = parseInt(hex.slice(1), 16), f = function (v) { return ('0' + Math.max(0, Math.min(255, Math.round(v * k))).toString(16)).slice(-2); }; return '#' + f(n >> 16) + f(n >> 8 & 255) + f(n & 255); }

  // palette: PAL[cell byte] -> ABGR, rebuilt for each biome
  const PAL = new Uint32Array(64); let WSURF = 0;
  function buildPal(B) {
    for (let s = 0; s < 8; s++) {
      PAL[DIRT | s << 3] = PAL[LOOSE | s << 3] = abgr(s === 6 ? B.top : s === 7 ? shadeHex(B.dirt, 0.3) : shadeHex(B.dirt, 1 - s * 0.085));
      PAL[MUD | s << 3] = abgr(s === 7 ? shadeHex(B.mud, 0.45) : shadeHex(B.mud, 1 - (s % 4) * 0.07));
      PAL[ROCK | s << 3] = abgr(s === 7 ? shadeHex(B.rock, 0.42) : shadeHex(B.rock, 1 - (s % 5) * 0.09 + (s === 5 ? 0.12 : 0)));
      PAL[WATER | s << 3] = abgr(s & 1 ? shadeHex(B.water, 0.94) : B.water, 190);
      PAL[FIRE | s << 3] = abgr(['#7a2430', '#a83232', '#d8483e', '#e8603a', '#ff9a3c', '#ffb04a', '#ffe27a', '#fff3c4'][s]);
    }
    WSURF = abgr(B.foam, 235);
  }
  buildPal(BIOMES.grass);

  // ---------- canvas and layout ----------
  const cv = document.getElementById('ffe-canvas'), cx = cv.getContext('2d');
  const tcv = document.createElement('canvas'), tctx = tcv.getContext('2d');
  let S = 1, VW = 0, VH = 0, DPR = 1, img = null, buf = null, lum = null, lumUsed = false;
  let sky = null, hills = [], clouds = [];
  let camX = 0, camY = 0, camXi = 0, camYi = 0, shake = 0;

  function layout() {
    DPR = window.devicePixelRatio || 1;
    const devW = Math.max(1, Math.round(window.innerWidth * DPR)), devH = Math.max(1, Math.round(window.innerHeight * DPR));
    S = Math.max(1, Math.round(devW / 680));          // whole device pixels per game pixel, about 680 across
    VW = Math.ceil(devW / S); VH = Math.ceil(devH / S);
    cv.width = VW; cv.height = VH; cv.style.width = (VW * S / DPR) + 'px'; cv.style.height = (VH * S / DPR) + 'px';
    tcv.width = VW; tcv.height = VH; img = tctx.createImageData(VW, VH); buf = new Uint32Array(img.data.buffer); lum = new Uint8Array(VW * VH); lumUsed = false;
    cx.imageSmoothingEnabled = false;
    buildBackdrop(); snapCam();
  }

  // ---------- backdrop: a dithered sky for the time of day, sun or moon, two ranges of hills, drifting clouds ----------
  // the Earth, seen from the Moon: a lit sphere with oceans, continents, ice caps, cloud and a night side
  function vnoise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, h = function (a, b) { const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return n - Math.floor(n); };
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    return (h(xi, yi) * (1 - sx) + h(xi + 1, yi) * sx) * (1 - sy) + (h(xi, yi + 1) * (1 - sx) + h(xi + 1, yi + 1) * sx) * sy;
  }
  function fbm(x, y) { return vnoise(x, y) * 0.55 + vnoise(x * 2.1 + 7, y * 2.1 + 3) * 0.3 + vnoise(x * 4.3 + 13, y * 4.3 + 9) * 0.15; }
  function earthPixel(nx, ny, px, py) {
    const z = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny)), lit = -nx * 0.55 - ny * 0.45 + z * 0.7;   // sun from the upper left
    const lon = Math.atan2(nx, z) * 1.25 + 0.9, lat = Math.asin(clamp(ny, -1, 1)), dith = (px + py) & 1;
    const land = fbm(lon * 1.9 + 2.3, lat * 1.9 + 5.1), cloud = fbm(lon * 2.6 + 11, lat * 4.4 + 2), ice = Math.abs(ny) > 0.84 - vnoise(lon * 3, 1) * 0.1;
    if (lit < -0.04 || (lit < 0.06 && dith)) return land > 0.56 && !ice && vnoise(px * 0.9, py * 0.9) > 0.82 ? '#ffd27a' : '#070d20';   // night side, with a few city lights
    let col;
    if (ice) col = '#f4f8ff';
    else if (land > 0.56) col = Math.abs(lat) < 0.42 && fbm(lon * 3 + 1, lat * 3) > 0.52 ? (land > 0.66 ? '#b89a5a' : '#cdb26e') : land > 0.68 ? '#2f7a3c' : '#4a9a48';
    else col = land > 0.52 ? '#57b4e6' : lit > 0.62 ? '#3f8fdc' : '#2a6cc4';
    if (cloud > 0.6 && (cloud > 0.66 || dith)) col = lit > 0.3 ? '#ffffff' : '#c8d4e8';
    if (lit < 0.24 && !dith) col = shadeHex(col, 0.55);                   // dusk band toward the terminator
    return col;
  }
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  function buildBackdrop() {
    const r = rngOf(7 + ENV.key.length * 13 + ENV.sky.length), K = SKY[ENV.sky], B = ENV.b;
    sky = document.createElement('canvas'); sky.width = VW; sky.height = VH;
    const c = sky.getContext('2d'), im = c.createImageData(VW, VH), b = new Uint32Array(im.data.buffer);
    const bands = K.bands.map(function (h) { return abgr(h); });
    const hz = VH * 0.82;
    for (let y = 0; y < VH; y++) {
      const t = clamp(y / hz, 0, 1) * (bands.length - 1), i = Math.min(bands.length - 2, t | 0), f = t - i;
      for (let x = 0; x < VW; x++) b[y * VW + x] = (f * 16 > BAYER[(x & 3) + (y & 3) * 4] + 0.5) ? bands[i + 1] : bands[i];
    }
    const star = abgr('#f4e9ff'), dim = abgr('#8a90b8');
    for (let k = 0; k < VW / 5 * K.stars; k++) { const x = (r() * VW) | 0, y = (r() * (K.stars > 2 ? r() * 0.5 + 0.5 : r()) * VH * (K.stars > 2 ? 0.8 : 0.4)) | 0; b[y * VW + x] = k % 3 ? star : dim; }
    c.putImageData(im, 0, 0);
    if (K.dots) K.dots.forEach(function (d) { c.fillStyle = d[3]; c.fillRect(Math.round(VW * d[0]), Math.round(VH * d[1]), d[2], d[2]); });
    if (K.orb) {                                                          // sun, moon or the Earth
      const O = K.orb, sx = Math.round(VW * O.x), sy = Math.round(VH * O.y), sr = Math.round(Math.min(VW, VH) * O.r);
      for (let y = -sr - 6; y <= sr + 6; y++) for (let x = -sr - 6; x <= sr + 6; x++) {
        const d = Math.sqrt(x * x + y * y);
        if (d <= sr) {
          let col = y > sr * 0.25 && ((y / 3) | 0) % 2 ? O.c2 : O.c;
          if (O.moon) col = ((x + 3) * (x + 3) + (y - 2) * (y - 2) < sr * sr * 0.1 || (x - sr * 0.4) * (x - sr * 0.4) + (y + sr * 0.4) * (y + sr * 0.4) < sr * sr * 0.05) ? O.c2 : x - y > sr * 0.9 ? O.c2 : O.c;
          if (O.earth) col = earthPixel(x / sr, y / sr, x, y);
          c.fillStyle = col; c.fillRect(sx + x, sy + y, 1, 1);
        } else if (O.earth) { if (d <= sr + 1.5 && x + y < sr * 0.5 && (d <= sr + 0.8 || ((x + y) & 1))) { c.fillStyle = '#7cc4ff'; c.fillRect(sx + x, sy + y, 1, 1); } }   // a thin rim of atmosphere on the sunlit side
        else if (d <= sr + 6 && ((x + y) & 1) && (d < sr + 3 || ((x - y) & 2))) { c.fillStyle = O.halo; c.fillRect(sx + x, sy + y, 1, 1); }
      }
    }
    hills = [];
    [[K.hills[0][0], K.hills[0][1], 0.44, 0.012, 0.12], [K.hills[1][0], K.hills[1][1], 0.6, 0.02, 0.25]].forEach(function (L, li) {
      const hc = document.createElement('canvas'), hw = VW + 260; hc.width = hw; hc.height = VH;
      const k = hc.getContext('2d'), ph = [r() * 9, r() * 9, r() * 9], amp = B.peaks ? 1.7 : B.soft === 2 ? 0.35 : B.sea ? 0.3 : 1;
      if (B.sea && li === 1) { k.fillStyle = shadeHex(B.water, 0.8); k.fillRect(0, Math.round(VH * 0.6), hw, VH); k.fillStyle = B.foam; for (let x = 0; x < hw; x += 9) k.fillRect(x + (x * 7) % 5, Math.round(VH * 0.6) + (x * 3) % 14, 4, 1); }
      for (let x = 0; x < hw; x++) {
        let n = Math.sin(x * L[3] + ph[0]) * 0.5 + Math.sin(x * L[3] * 2.7 + ph[1]) * 0.28 + Math.sin(x * L[3] * 6.1 + ph[2]) * 0.12;
        if (B.peaks) n = n * 0.6 + Math.abs(Math.sin(x * L[3] * 3.3 + ph[1])) * 0.55 - 0.45;   // sharp summits
        if (B.mesa) n = Math.round((Math.sin(x * L[3] + ph[0]) * 0.5 + Math.sin(x * L[3] * 2.7 + ph[1]) * 0.28) * 2.5) / 2.5;   // flat-topped mesas
        if (B.bumpy) n -= Math.abs(Math.sin(x * 0.35 + li)) * 0.06 + Math.abs(Math.sin(x * 0.13 + ph[2])) * 0.05;
        const jag = B.soft === 2 || B.mesa ? 0 : ((x * 7 + li * 13) % 11 < 3 ? 1 : 0) + ((x >> 2) % 3 === 0 ? 1 : 0);
        const top = Math.round(VH * (L[2] + (B.sea ? 0.12 : 0)) + n * VH * 0.13 * amp + jag);
        if (B.sea && li === 1) continue;
        k.fillStyle = L[0]; k.fillRect(x, top, 1, VH - top);
        k.fillStyle = B.rim || L[1]; k.fillRect(x, top, 1, 2 + ((x * 5) % 7 < 2 ? 3 : 0));   // rim light, or snow on the tops
      }
      hills.push({ c: hc, par: L[4] });
    });
    clouds = [];
    if (K.cloud) for (let i = 0, nC = K.clouds || 5; i < nC; i++) {
      const w = 34 + (r() * 40 | 0) + (K.clouds ? 30 : 0), h = 9 + (r() * 6 | 0) + (K.clouds ? 5 : 0), cc = document.createElement('canvas'); cc.width = w; cc.height = h;
      const k = cc.getContext('2d');
      for (let n = 0; n < 6; n++) {
        const bx = 4 + r() * (w - 8), bw = 8 + r() * 14, by = 1 + r() * 4;
        k.fillStyle = K.cloud[0]; k.fillRect(Math.round(bx - bw / 2), Math.round(by), Math.round(bw), h - Math.round(by) - 2);
      }
      k.fillStyle = K.cloud[0]; k.fillRect(2, h - 5, w - 4, 3);
      k.globalCompositeOperation = 'source-atop'; k.fillStyle = K.cloud[1]; k.fillRect(0, h - 4, w, 4); k.fillStyle = K.cloud[2]; k.fillRect(0, 0, w, 2);
      clouds.push({ c: cc, x: r() * VW, y: Math.round(VH * (0.04 + r() * (K.clouds ? 0.22 : 0.3))), k: 0.4 + r() * 0.6 });
    }
  }

  // ---------- world generation ----------
  function noise1(r, n) { const a = []; for (let i = 0; i < n + 2; i++) a.push(r()); return function (x) { const i = Math.floor(x), f = x - i, s = f * f * (3 - 2 * f); return a[i % n] * (1 - s) + a[(i + 1) % n] * s; }; }
  function generate(seed) {
    const r = rngOf(seed), B = ENV.b;
    SOFT = B.soft || 0;
    W = clamp(VW, 520, 840); G = new Uint8Array(W * H);
    const n1 = noise1(r, 64), n2 = noise1(r, 64), n3 = noise1(r, 64), n4 = noise1(r, 64), n5 = noise1(r, 64), n6 = noise1(r, 256);
    const surf = new Int16Array(W), rock = new Int16Array(W), tilt = B.sea ? (r() < 0.5 ? 1 : -1) : 0;
    for (let x = 0; x < W; x++) {
      let s = H * 0.56 + ((n1(x / 170) - 0.5) * 120 + (n2(x / 62) - 0.5) * 46 + (n3(x / 21) - 0.5) * (B.peaks ? 34 : 10)) * B.amp;
      if (B.peaks) s -= Math.pow(Math.abs(Math.sin(x / 47 + n1(x / 90) * 4)), 3) * 30;
      if (tilt) s += (x / W - 0.5) * 90 * tilt + 6;
      surf[x] = s;
    }
    for (let k = 0; k < (B.craters || 0); k++) {                          // old impact craters, with a raised rim
      const cxr = 30 + r() * (W - 60), cr = 10 + r() * r() * 30;
      for (let x = Math.max(0, cxr - cr - 6 | 0); x < Math.min(W, cxr + cr + 6); x++) { const d = Math.abs(x - cxr); surf[x] += d < cr ? Math.sqrt(cr * cr - d * d) * 0.45 - 2 : -2 * (1 - (d - cr) / 6); }
    }
    if (SOFT) for (let pass = 0; pass < 2; pass++) { for (let x = 1; x < W; x++) if (surf[x] < surf[x - 1] - 1) surf[x] = surf[x - 1] - 1; for (let x = W - 2; x >= 0; x--) if (surf[x] < surf[x + 1] - 1) surf[x] = surf[x + 1] - 1; }
    for (let x = 0; x < W; x++) {
      let s = clamp(Math.round(surf[x]), 84, H - 66);
      let k = H - 20 - n4(x / 80) * 30 - Math.max(0, n5(x / 60) - 0.74) * 240;   // bedrock, with the odd outcrop
      if (B.rocky) k = Math.min(k, s + 7 + n4(x / 26) * 24 - Math.max(0, n5(x / 40) - 0.6) * 60);
      if (B.noRock) k = H;
      k = Math.max(Math.round(k), s - 12);
      if (k < s) s = k;
      surf[x] = s; rock[x] = k;
    }
    for (let x = 0; x < W; x++) for (let y = surf[x]; y < H; y++) {
      const d = y - surf[x]; let c;
      if (y >= rock[x] || y >= H - FLOOR) c = ROCK | (((n6(x * 0.31 + y * 0.17) * 6) | 0) + ((x * 3 + y * 5) % 17 === 0 ? 1 : 0)) % 6 << 3;
      else if (d < B.topD + (n6(x * 0.9) > 0.6 ? 1 : 0)) c = DIRT | GRASS << 3;
      else c = DIRT | clamp(((d + n6(x * 0.13) * 22) / 13 | 0) % 4 + (n6(x * 0.7 + y * 0.9) > 0.62 ? 1 : 0) + (d > 60 ? 1 : 0), 0, 5) << 3;
      G[y * W + x] = c;
    }
    for (let k = 0, n = B.mudN ? B.mudN - 1 + (r() * 3 | 0) : 0; k < n; k++) {   // mud pockets
      const mx = 30 + (r() * (W - 60) | 0), my = surf[mx] + (r() * 26 | 0), mr = 10 + r() * 12;
      for (let y = -mr - 4 | 0; y <= mr + 4; y++) for (let x = -mr - 4 | 0; x <= mr + 4; x++) {
        const px = mx + x, py = my + y; if (px < 0 || px >= W || py < 0 || py >= H) continue;
        const i = py * W + px;
        if ((G[i] & 7) === DIRT && x * x + y * y * 1.6 < mr * mr * (0.6 + n6(px * 0.2 + py * 0.3) * 0.8)) G[i] = MUD | (G[i] & 0x38);
      }
    }
    if (r() < B.waterP) {                                                 // water in the low ground, with a muddy bed
      const sorted = Array.from(surf).sort(function (a, b) { return a - b; }), wl = sorted[Math.floor(W * (B.sea ? 0.55 : 0.8 + r() * 0.08))];
      for (let x = 0; x < W; x++) {
        if (surf[x] <= wl) continue;
        for (let y = wl; y < surf[x]; y++) G[y * W + x] = WATER | ((x + y) & 1) << 3;
        if (!SOFT) for (let y = surf[x]; y < surf[x] + 3 && y < H; y++) if ((G[y * W + x] & 7) === DIRT) G[y * W + x] = MUD | (r() * 4 | 0) << 3;
      }
    }
    for (let i = 0; i < (SOFT ? 320 : 160); i++) tick();   // let mud and sand find their slope before anyone sets up on them
  }

  // ---------- the material simulation ----------
  let tickN = 0, moves = 0, fireN = 0;
  function tick() {
    const dirx = (tickN++ & 1) ? 1 : -1; let mv = 0, fn = 0;
    for (let y = H - 2; y >= 0; y--) {
      const row = y * W; let x = dirx > 0 ? 0 : W - 1;
      for (let k = 0; k < W; k++, x += dirx) {
        const i = row + x, c = G[i];
        if (c === 0) continue;
        const m = c & 7; if (m === ROCK) continue;
        const b = i + W, cb = G[b], mb = cb & 7;
        if (m === DIRT && !SOFT) {
          if (cb === 0) { G[b] = (c & 0x38) | LOOSE; G[i] = 0; mv++; }
          else if (mb === WATER) { if (rnd() < 0.5) { G[b] = (c & 0x38) | LOOSE; G[i] = cb; } mv++; }
          else if (mb === FIRE) { G[b] = (c & 0x38) | LOOSE; G[i] = cb; mv++; }
        } else if (m === LOOSE || m === DIRT) {                            // on sand and dust everything is loose
          if (cb === 0) { G[b] = c; G[i] = 0; mv++; continue; }
          if (mb === WATER) { if (rnd() < 0.6) { G[b] = c; G[i] = cb; } mv++; continue; }
          if (mb === FIRE) { G[b] = c; G[i] = cb; mv++; continue; }
          let d = rnd() < 0.5 ? 1 : -1, went = false;
          for (let t = 0; t < 2 && !went; t++, d = -d) {
            const nx = x + d; if (nx < 0 || nx >= W) continue;
            const cj = G[b + d], cs = G[i + d];
            if ((cj === 0 || (cj & 7) === WATER) && (cs === 0 || (cs & 7) === WATER)) { G[b + d] = c; G[i] = cj; mv++; went = true; }
          }
          if (!went && !SOFT) {   // at rest: pack down, or turn to mud where it is wet
            const wet = (x > 0 && (G[i - 1] & 7) === WATER) || (x < W - 1 && (G[i + 1] & 7) === WATER) || (y > 0 && (G[i - W] & 7) === WATER);
            G[i] = (c & 0x38) | (wet ? MUD : DIRT);
          }
        } else if (m === MUD) {
          if (cb === 0) { G[b] = c; G[i] = 0; mv++; continue; }
          if (mb === WATER) { if (rnd() < 0.35) { G[b] = c; G[i] = cb; } mv++; continue; }
          if (mb === FIRE) { G[b] = c; G[i] = cb; mv++; continue; }
          if (rnd() < 0.3) {
            let d = rnd() < 0.5 ? 1 : -1, went = false;
            for (let t = 0; t < 2 && !went; t++, d = -d) for (let n = 1; n <= 3; n++) {
              const nx = x + d * n; if (nx < 0 || nx >= W) break;
              const cs = G[i + d * n]; if (cs !== 0 && (cs & 7) !== WATER) break;
              const cj = G[b + d * n];
              if (cj === 0 || (cj & 7) === WATER) { const o = G[i + d]; G[i + d] = c; G[i] = o; mv++; went = true; break; }
            }
          }
        } else if (m === WATER) {
          if (cb === 0) { G[b] = c; G[i] = 0; mv++; continue; }
          let d = rnd() < 0.5 ? 1 : -1, went = false;
          for (let t = 0; t < 2 && !went; t++, d = -d) for (let n = 1; n <= 40; n++) {
            const nx = x + d * n; if (nx < 0 || nx >= W) break;
            if (G[i + d * n] !== 0) break;
            if (G[b + d * n] === 0) { if (n <= 5) G[b + d * n] = c; else G[i + d * 5] = c; G[i] = 0; mv++; went = true; break; }
          }
        } else if (m === FIRE) {
          fn++;
          if (mb === WATER || (x > 0 && (G[i - 1] & 7) === WATER) || (x < W - 1 && (G[i + 1] & 7) === WATER) || (y > 0 && (G[i - W] & 7) === WATER)) { G[i] = 0; if (rnd() < 0.3) steam(x, y); continue; }
          let f = c;
          if (rnd() < 0.034) { const left = (c >> 3) - 1; if (left < 0) { G[i] = 0; continue; } f = FIRE | left << 3; G[i] = f; }
          if (cb === 0) { G[b] = f; G[i] = 0; mv++; continue; }
          if (rnd() < 0.03) { if (mb === DIRT || mb === LOOSE) G[b] = mb | SCORCH << 3; else if (mb === MUD) G[b] = DIRT | SCORCH << 3; }   // scorches earth, bakes mud dry
          if (y > 0 && G[i - W] === 0 && rnd() < 0.02) flame(x, y);
          let d = rnd() < 0.5 ? 1 : -1, went = false;
          for (let t = 0; t < 2 && !went; t++, d = -d) for (let n = 1; n <= 10; n++) {
            const nx = x + d * n; if (nx < 0 || nx >= W) break;
            if (G[i + d * n] !== 0) break;
            if (G[b + d * n] === 0) { if (n <= 3) G[b + d * n] = f; else G[i + d * 3] = f; G[i] = 0; mv++; went = true; break; }
          }
        }
      }
    }
    moves = mv; fireN = fn; return mv;
  }

  // ---------- sound and effects ----------
  const AU = window.FFEAudio || null;
  function snd(name, arg) { if (AU) AU.sfx(name, arg); }
  let smokes = [], lights = [];
  // an ember: cools from white through yellow and red, bounces once or twice off the ground
  function ember(x, y, vx, vy, life, g) { if (sparks.length < 900) sparks.push({ x: x, y: y, vx: vx, vy: vy, life: life, max: life, hot: true, g: g === undefined ? 1 : g }); }
  function smoke(x, y, r, life, vx, vy, wait, hot) { if (smokes.length < 440) smokes.push({ x: x, y: y, vx: vx || 0, vy: vy || 0, r: r, life: life, max: life, wait: wait || 0, hot: !!hot }); }
  function light(x, y, r, dur, k) { lights.push({ x: x, y: y, r: r, t: 0, dur: dur, k: k || 1 }); }
  function flame(x, y) { if (rnd() < 0.7) ember(x + 0.5, y - 1, (rnd() - 0.5) * 12, -14 - rnd() * 22, 0.25 + rnd() * 0.45, -0.12); else smoke(x, y - 2, 1.5 + rnd() * 1.5, 0.8 + rnd() * 0.8, 0, -8); }
  function steam(x, y) { sparks.push({ x: x, y: y, vx: (rnd() - 0.5) * 14, vy: -18 - rnd() * 20, life: 0.5 + rnd() * 0.5, col: '#e8f4ff', g: -0.05 }); if (rnd() < 0.2) snd('steam'); }
  let beams = [], bullets = [], discoN = 0, mines = [], strikes = [], planes = [], cones = [], balls = [], salvo = null;
  function puff(x, y, r, life, vx, vy, wait, col) { smoke(x, y, r, life, vx, vy, wait); if (smokes.length) smokes[smokes.length - 1].col = col; }
  const HEAT = ['#5a4660', '#d8483e', '#ff9a3c', '#ffe27a', '#ffffff'];

  // ---------- game state ----------
  let state = 'menu';              // menu | aim | flight | settle | over
  let tanks = [], cur = 0, wind = 0, shots = [], grains = [], sparks = [], booms = [], floats = [];
  let again = false, ambSet = null;
  function amb(off) { const want = off ? null : (ENV.weather === 'rain' ? 'rain' : ENV.weather === 'storm' ? 'storm' : ENV.weather === 'snow' || ENV.weather === 'dust' ? 'wind' : null); if (want !== ambSet && AU) { ambSet = want; AU.ambient(want); } }
  let quiet = 0, stT = 0, bannerT = 0, paused = false, ai = null, time = 0;
  let opts = { walls: 'out', grav: 'auto', biome: 'random' };
  try { const so = JSON.parse(store('ffe-opts') || 'null'); if (so) ['walls', 'grav', 'biome'].forEach(function (k) { if (typeof so[k] === 'string') opts[k] = so[k]; }); } catch (e) { /* keep the defaults */ }
  let setup = [1, 2, 0, 0];        // per team: 0 off, 1 human, 2 computer
  try { const sv = JSON.parse(store('ffe-setup') || 'null'); if (Array.isArray(sv) && sv.length === 4) setup = sv.map(function (v) { return v === 1 || v === 2 ? v : 0; }); } catch (e) { /* keep the default */ }

  function surfaceAt(x) { for (let y = 0; y < H; y++) if (solid(G[y * W + x])) return y; return H - 1; }
  function rollEnv() {
    const key = opts.biome === 'random' ? BIOME_ROLL[(rnd() * BIOME_ROLL.length) | 0] : opts.biome, b = BIOMES[key];
    const weather = b.weather[(rnd() * b.weather.length) | 0], times = b.times || ['dawn', 'day', 'dusk', 'night'], time = times[(rnd() * times.length) | 0];
    const sky = b.sky === 'space' ? 'space' : (weather === 'rain' || weather === 'storm') ? 'storm' : weather === 'meteor' && !b.sky ? 'night' : b.sky && time !== 'night' ? b.sky : time === 'night' && b.nightSky ? b.nightSky : time;
    ENV = { key: key, b: b, time: sky === 'night' || sky === 'marsnight' ? 'night' : time, weather: weather, sky: sky };
    const walls = ['out', 'rubber', 'spring', 'wrap']; WALL = opts.walls === 'random' ? walls[(rnd() * 4) | 0] : opts.walls;
    ENV.g = opts.grav === 'auto' ? (b.grav || 1) : +opts.grav; GRAV = 120 * ENV.g;
    buildPal(b); buildBackdrop(); wxT = 4 + rnd() * 6; bolts = []; meteors = []; skyFlash = 0; ufos = []; ufoT = 20 + rnd() * 80; metT = 8 + rnd() * 12;
  }
  function newMatch() {
    rollEnv();
    generate((Math.random() * 1e9) | 0);
    const ids = []; for (let i = 0; i < 4; i++) if (setup[i]) ids.push(i);
    const order = ids.slice().sort(function () { return rnd() - 0.5; }), slot = (W - 90) / order.length;
    tanks = [];
    order.forEach(function (id, k) {
      const x = Math.round(45 + slot * (k + 0.5) + (rnd() - 0.5) * slot * 0.45); let y = surfaceAt(x);
      let wt = y; while (wt > 0 && (G[(wt - 1) * W + x] & 7) === WATER) wt--;
      if (wt < y) y = wt - 3;                                           // stood in water: build an island
      for (let xx = x - 8; xx <= x + 8; xx++) {
        if (xx < 0 || xx >= W) continue;
        const edge = Math.abs(xx - x) > 6;
        for (let yy = edge ? y + 2 : 0; yy < y + (edge ? 2 : 0); yy++) if (!edge) G[yy * W + xx] = 0;
        for (let yy = y + (edge ? 2 : 0); yy < H && !solid(G[yy * W + xx]); yy++) G[yy * W + xx] = DIRT | (yy - y < 2 && !edge ? GRASS : 2) << 3;
      }
      tanks.push({ id: id, team: TEAMS[id], cpu: setup[id] === 2, x: x, y: y, a: x < W / 2 ? 60 : 120, p: 60, hp: 100, alive: true, w: 0, vy: 0, fall: 0,
        burn: 0, trace: null, beacon: null, ammo: WEAPONS.map(function (w) { return w.ammo; }) });
    });
    tanks.sort(function (a, b) { return a.id - b.id; });
    shots = []; grains = []; sparks = []; booms = []; floats = []; smokes = []; lights = []; beams = []; bullets = []; mines = []; strikes = []; planes = []; cones = []; balls = []; salvo = null;
    wind = Math.round((rnd() - 0.5) * 12); cur = -1; paused = false;
    buildTankHud(); snapCam(); beginTurn(0); snd('start'); amb();
    el('env').textContent = ENV.b.name + (ENV.sky === 'night' || ENV.sky === 'marsnight' ? ' \u00B7 NIGHT' : ENV.time === 'dawn' && ENV.sky === 'dawn' ? ' \u00B7 DAWN' : '') + (WEATHER[ENV.weather] && !ENV.b.like ? ' \u00B7 ' + WEATHER[ENV.weather] : '') + (ENV.g !== 1 ? ' \u00B7 ' + Math.round(ENV.g * 100) + '% G' : '') + (WALL !== 'out' ? ' \u00B7 ' + WALL.toUpperCase() + ' WALLS' : '');
  }
  function beginTurn(i) {
    cur = i; state = 'aim'; const t = tanks[cur];
    if (t.beacon && t.beacon.spent) t.beacon = null;                     // a beacon lasts for the one shot after the tracer
    if (t.ammo[t.w] <= 0) t.w = 0;
    banner(t.team.name + (t.cpu ? ' IS AIMING' : ' — YOUR SHOT'), t.team.lite);
    ai = t.cpu ? { t: 0, plan: null } : null;
    hudDirty = true; snd('turn');
  }
  function nextTurn() {
    const alive = tanks.filter(function (t) { return t.alive; });
    if (alive.length <= 1) return gameOver(alive[0]);
    let i = cur;
    do { i = (i + 1) % tanks.length; if (i === 0) wind = clamp(wind + Math.round((rnd() - 0.5) * 8), -10, 10); } while (!tanks[i].alive);
    beginTurn(i);
  }
  function gameOver(t) {
    state = 'over'; hudDirty = true;
    el('over-title').textContent = t ? t.team.name + ' WINS' : 'NOBODY WINS';
    el('over-title').style.color = t ? t.team.lite : '';
    el('over-sub').textContent = t ? (t.cpu ? 'The computer holds the field.' : 'Last tank standing, ' + Math.ceil(t.hp) + ' armour left.') : 'The field is empty.';
    show('over'); snd(t && !t.cpu ? 'win' : 'lose'); amb(true);
  }

  // ---------- shots ----------
  function muzzle(t) { const a = t.a * Math.PI / 180; return { x: t.x + Math.cos(a) * 9, y: t.y - 5 - Math.sin(a) * 9, c: Math.cos(a), s: Math.sin(a) }; }
  function speedOf(p) { return 60 + p * 2.7; }
  function fire() {
    if (state !== 'aim' || paused) return;
    const t = tanks[cur], w = WEAPONS[t.w], m = muzzle(t), v = speedOf(t.p);
    if (t.ammo[t.w] !== Infinity) t.ammo[t.w]--;
    closePicker();
    if (w.gun) { if (t.beacon) t.beacon.spent = true; salvo = { t: t, w: w, time: w.gun, acc: 0, n: 0 }; state = 'flight'; ai = null; hudDirty = true; bannerT = 0; el('banner').classList.remove('on'); return; }
    if (w.salvo) {                                                        // a barrage: shell after shell from the barrel
      if (t.beacon) t.beacon.spent = true;
      salvo = { t: t, w: w, left: w.salvo, next: 0 }; state = 'flight'; ai = null; hudDirty = true; bannerT = 0; el('banner').classList.remove('on'); return;
    }
    if (w.cone) { if (t.beacon) t.beacon.spent = true; plasma(t, w, m); state = 'flight'; ai = null; hudDirty = true; bannerT = 0; el('banner').classList.remove('on'); return; }
    if (w.beam) { lance(t, w, m); state = 'flight'; ai = null; hudDirty = true; bannerT = 0; el('banner').classList.remove('on'); return; }
    if (w.tracer) t.trace = []; else if (t.beacon) t.beacon.spent = true;
    shots.push({ x: m.x, y: m.y, vx: m.c * v, vy: -m.s * v, w: w, own: t, t: 0, wet: false });
    for (let i = 0; i < 12; i++) ember(m.x, m.y, m.c * (30 + rnd() * 70) + (rnd() - 0.5) * 36, -m.s * (30 + rnd() * 70) + (rnd() - 0.5) * 36, 0.2 + rnd() * 0.25, 0.2);
    for (let i = 0; i < 4; i++) smoke(m.x + m.c * i * 2, m.y - m.s * i * 2, 2 + rnd() * 2, 0.6 + rnd() * 0.5, m.c * (14 - i * 3), -m.s * (14 - i * 3) - 4, i * 0.03);
    light(m.x, m.y, 26, 0.14); snd(w.tracer ? 'ping' : 'fire', w.r > 18); if (AU) AU.whistle(0);
    state = 'flight'; ai = null; hudDirty = true; bannerT = 0; el('banner').classList.remove('on');
  }
  function hitsTank(x, y, s) {
    for (let i = 0; i < tanks.length; i++) { const t = tanks[i]; if (!t.alive || (s && t === s.own && s.t < 0.3)) continue; if (Math.abs(x - t.x) <= 7 && y >= t.y - 7 && y <= t.y) return t; }
    return null;
  }
  // moves a shot one step; returns 0 flying, 1 burst at (s.x, s.y), 2 left the field
  function stepShot(s, real) {
    s.t += DT;
    const ix0 = s.x | 0, iy0 = s.y | 0, inW = iy0 >= 0 && iy0 < H && ix0 >= 0 && ix0 < W && (G[iy0 * W + ix0] & 7) === WATER;
    if (!s.jet) s.vy += GRAV * DT;
    if (inW) { s.vx *= 0.9; s.vy *= 0.9; if (real && !s.wet) { s.wet = true; splash(s.x, s.y, 10); snd('splash'); } } else { if (!s.jet && !s.calm) s.vx += wind * WIND_K * DT; if (real) s.wet = false; }
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(s.vx), Math.abs(s.vy)) * DT)), dy = s.vy * DT / n; let dx = s.vx * DT / n;
    for (let k = 0; k < n; k++) {
      let nx = s.x + dx; const ny = s.y + dy;
      if (WALL !== 'out' && (nx < 0 || nx >= W)) {                        // side walls: wrap round, or bounce (a spring wall adds speed)
        if (WALL === 'wrap') nx += nx < 0 ? W : -W;
        else { const e = WALL === 'spring' ? 1.25 : 0.92; s.vx = -s.vx * e; dx = -dx * e; if (WALL === 'spring') s.vy *= 1.08; nx = nx < 0 ? 0.5 : W - 0.5; if (real) { snd(WALL === 'spring' ? 'spring' : 'bounce'); for (let q = 0; q < 6; q++) sparks.push({ x: nx, y: ny, vx: (nx < 5 ? 1 : -1) * rnd() * 50, vy: (rnd() - 0.5) * 60, life: 0.3, col: WALL === 'spring' ? '#7dff5a' : '#ff9a3c', g: 0.4 }); } }
      }
      const ix = Math.floor(nx), iy = Math.floor(ny);
      if (ix < -80 || ix >= W + 80 || iy >= H) return 2;
      if (ix >= 0 && ix < W && iy >= 0 && solid(G[iy * W + ix])) return 1;
      s.x = nx; s.y = ny;
      if (hitsTank(nx, ny, s)) return 1;
    }
    return s.t > 70 ? 2 : 0;
  }
  // a roller follows the ground, downhill for preference; it bursts when it meets a tank, a wall or a climb it has no momentum for
  function stepRoll(s) {
    const R = s.roll; s.t += DT; R.acc += 58 * DT;
    while (R.acc >= 1) {
      R.acc--; const nx = s.x + R.dir;
      if (nx < 1 || nx >= W - 1 || ++R.dist > 280) return 1;
      if (solid(cell(nx, s.y))) { if (!solid(cell(nx, s.y - 1)) && R.climb < 5) { s.y--; R.climb++; } else return 1; }
      s.x = nx; let d = 0;
      while (s.y < H - 1 && !solid(cell(s.x, s.y + 1))) { s.y++; d++; }
      if (d) R.climb = Math.max(0, R.climb - d);
      if (hitsTank(s.x, s.y, s)) return 1;
      if (R.dist % 7 === 0) { snd('roll'); if (rnd() < 0.5) sparks.push({ x: s.x, y: s.y, vx: -R.dir * 10, vy: -12, life: 0.3, col: '#c9a070', g: 1 }); }
    }
    return 0;
  }
  // a digger bores on in the direction it struck, then bursts underground
  function stepDig(s) {
    const D = s.dig; s.t += DT; D.acc += 62 * DT;
    while (D.acc >= 1) {
      D.acc--; s.x += D.ux; s.y += D.uy; D.left--; D.n++;
      const ix = Math.round(s.x), iy = Math.round(s.y);
      if (ix < 2 || ix >= W - 2 || iy >= H - FLOOR - 2 || iy < 2) return 1;
      const here = G[iy * W + ix] & 7;
      if (here === ROCK || D.left <= 0 || hitsTank(s.x, s.y, s)) return 1;
      if (here === AIR) { if (++D.air > 5 && D.n > 8) return 1; } else D.air = 0;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        if (dx * dx + dy * dy > 5) continue; const i = (iy + dy) * W + ix + dx, m = G[i] & 7;
        if (m === DIRT || m === LOOSE || m === MUD) { if (rnd() < 0.3 && grains.length < 700) grains.push({ x: ix + dx, y: iy + dy, vx: -D.ux * (30 + rnd() * 50) + (rnd() - 0.5) * 30, vy: -D.uy * (30 + rnd() * 50) - 30 - rnd() * 30, c: LOOSE | (G[i] & 0x38) }); G[i] = 0; }
      }
      if (D.n % 4 === 0) snd('drill');
    }
    return 0;
  }
  function updateShots() {
    if (AU) AU.whistle(shots.length && !shots[0].roll && !shots[0].dig ? shots[0].vy : null);
    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i];
      if (s.w.guided && s.own && s.own.beacon) {                          // once it is coming down it lights a jet and drives at the beacon
        const B = s.own.beacon, dx = B.x - s.x, dy = B.y - s.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
        if (!s.jet && s.vy > 0 && s.t > 0.35) { s.jet = true; snd('jet'); light(s.x, s.y, 40, 0.3); }
        if (s.jet) {
          if (d < 5) { shots.splice(i, 1); s.dir = dx < 0 ? -1 : 1; burst(s.x, s.y, s.w, s); continue; }
          s.vx = dx / d * 400; s.vy = dy / d * 400;
          for (let k = 0; k < 3; k++) ember(s.x, s.y, -s.vx * 0.15 + (rnd() - 0.5) * 40, -s.vy * 0.15 + (rnd() - 0.5) * 40, 0.2 + rnd() * 0.3, 0.2);
          if (tickN % 3 === 0) smoke(s.x, s.y, 2, 0.7, 0, -4);
        }
      }
      if (s.w.nuke && s.vy > 0) {                                         // airburst: one tank length above whatever is below
        const ix = Math.round(s.x), iy = Math.round(s.y); let near = false;
        for (let d = 1; d <= 15 && !near; d++) if (solid(cell(ix, iy + d)) || hitsTank(ix, iy + d, s)) near = true;
        if (near) { shots.splice(i, 1); s.dir = s.vx < 0 ? -1 : 1; burst(s.x, s.y, s.w, s); continue; }
      }
      if (s.w.drone && !s.wet && s.t > 0.3) {                             // a drone guns whatever is ahead of its nose
        if (tickN % 5 === 0) {
          const a = Math.atan2(s.vy, s.vx) + (rnd() - 0.5) * 0.07;
          bullets.push({ x: s.x, y: s.y, vx: Math.cos(a) * 430, vy: Math.sin(a) * 430, own: s.own, life: 1.1 }); snd('gun');
        }
        if (tickN % 7 === 0) snd('buzz');
      }
      const vy0 = s.vy, vx0 = s.vx, r = s.roll ? stepRoll(s) : s.dig ? stepDig(s) : stepShot(s, true);
      if (r === 0 && s.w.split && !s.kid && vy0 <= 0 && s.vy > 0) {   // a cluster breaks up at the top of its arc
        shots.splice(i, 1); const n = s.w.split + (s.w.mines || 0);
        for (let k = 0; k < n; k++) shots.push({ x: s.x, y: s.y, vx: s.vx * (0.62 + k * 0.76 / (n - 1)), vy: -14 + k * 28 / (n - 1), w: s.w.kidMine || (s.w.mines && k % 3 === 1) ? MINE : s.w, own: s.own, t: 1, kid: true, wet: false });
        for (let k = 0; k < 14; k++) ember(s.x, s.y, (rnd() - 0.5) * 90, (rnd() - 0.5) * 90, 0.3 + rnd() * 0.2, 0.3);
        smoke(s.x, s.y, 3, 0.6, 0, -4); light(s.x, s.y, 22, 0.15); snd('split');
        continue;
      }
      if (r === 0) {
        if (s.roll || s.dig) continue;
        if (s.w.tracer) { if (tickN & 1) s.own.trace.push(Math.round(s.x), Math.round(s.y)); }
        else if ((tickN & 1) === 0) sparks.push({ x: s.x, y: s.y, vx: 0, vy: -4, life: 0.35, col: s.wet ? '#bfe6ff' : '#d8d2e8', g: 0 });
        continue;
      }
      if (r === 1 && !s.roll && !s.dig && !hitsTank(s.x, s.y, s)) {          // struck the ground: some shells are only getting started
        if (s.w.mine) { mines.push({ x: Math.round(s.x), y: Math.round(s.y), own: s.own, t: 0, fuse: -1 }); shots.splice(i, 1); snd('arm'); continue; }
        if (s.w.roll) { s.x = Math.round(s.x); s.y = Math.round(s.y); s.roll = { dir: vx0 < 0 ? -1 : 1, climb: 0, dist: 0, acc: 0 }; snd('thud'); continue; }
        if (s.w.dig) { const v = Math.sqrt(vx0 * vx0 + vy0 * vy0) || 1; s.dig = { ux: vx0 / v, uy: vy0 / v, left: s.w.dig, n: 0, air: 0, acc: 0 }; continue; }
      }
      shots.splice(i, 1); s.dir = vx0 < 0 ? -1 : 1;
      if (r === 1) burst(s.x, s.y, s.w, s);
    }
  }
  function updateSalvo() {
    if (!salvo) return;
    const t = salvo.t; salvo.next -= DT;
    if (!t.alive) { salvo = null; return; }
    if (salvo.w.gun) {                                                    // minigun: 48 rounds a second at full power, whatever the power dial says
      salvo.time -= DT; salvo.acc += 48 * DT;
      while (salvo.acc >= 1) {
        salvo.acc--; salvo.n++;
        const m = muzzle(t), a = Math.atan2(-m.s, m.c) + (rnd() - 0.5) * 0.035, v = speedOf(100) * (0.985 + rnd() * 0.03);
        bullets.push({ x: m.x, y: m.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, own: t, life: 7, age: 0, g: 1 });
        if (salvo.n % 3 === 0) { snd('gun'); ember(m.x, m.y, m.c * 60 + (rnd() - 0.5) * 50, -m.s * 60 + (rnd() - 0.5) * 50, 0.15 + rnd() * 0.15, 0.2); }
        if (salvo.n % 8 === 0) { light(m.x, m.y, 20, 0.08, 0.7); sparks.push({ x: t.x - m.c * 3, y: t.y - 7, vx: -m.c * 30 + (rnd() - 0.5) * 20, vy: -40 - rnd() * 30, life: 0.5, col: '#ffe27a', g: 1 }); }
      }
      shake = Math.max(shake, 0.8);
      if (salvo.time <= 0) salvo = null;
      return;
    }
    if (salvo.next > 0) return;
    const m = muzzle(t), v = speedOf(t.p) * (1 + (rnd() * 2 - 1) * 0.02);   // each shell within 2% of the set power
    shots.push({ x: m.x, y: m.y, vx: m.c * v, vy: -m.s * v, w: salvo.w, own: t, t: 0, wet: false, kid: true });
    for (let i = 0; i < 7; i++) ember(m.x, m.y, m.c * (30 + rnd() * 70) + (rnd() - 0.5) * 36, -m.s * (30 + rnd() * 70) + (rnd() - 0.5) * 36, 0.2 + rnd() * 0.25, 0.2);
    smoke(m.x, m.y, 2 + rnd() * 2, 0.6 + rnd() * 0.5, m.c * 12, -m.s * 12 - 4);
    light(m.x, m.y, 26, 0.12); snd('fire'); t.flash = 0; shake = Math.max(shake, 1.5);
    salvo.next = 0.13; if (--salvo.left <= 0) salvo = null;
  }
  function updateBullets() {
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i]; b.life -= DT; b.age = (b.age || 0) + DT; let dead = b.life <= 0;
      if (b.g) { b.vy += GRAV * DT; b.vx += wind * WIND_K * DT; }
      const n = Math.max(1, Math.ceil(Math.max(Math.abs(b.vx), Math.abs(b.vy)) * DT)), dx = b.vx * DT / n, dy = b.vy * DT / n;
      for (let k = 0; k < n && !dead; k++) {
        b.x += dx; b.y += dy; const ix = Math.floor(b.x), iy = Math.floor(b.y);
        if (WALL !== 'out' && (ix < 0 || ix >= W)) { if (WALL === 'wrap') b.x += ix < 0 ? W : -W; else { b.vx = -b.vx; b.x = ix < 0 ? 0.5 : W - 0.5; } continue; }
        if (ix < -60 || ix >= W + 60 || iy >= H) { dead = true; break; }
        if (iy < 0 || ix < 0 || ix >= W) continue;
        const tt = hitsTank(b.x, b.y, { own: b.own, t: b.age });
        if (tt) { damage(tt, 2); ember(b.x, b.y, -b.vx * 0.1, -30, 0.25); dead = true; break; }
        const c = G[iy * W + ix], m = c & 7;
        if (solid(c)) { if (m !== ROCK && iy < H - FLOOR && rnd() < 0.6) G[iy * W + ix] = 0; sparks.push({ x: b.x, y: b.y, vx: -b.vx * 0.08 + (rnd() - 0.5) * 30, vy: -25 - rnd() * 25, life: 0.25, col: m === ROCK ? '#fff3c4' : '#c9a070', g: 1 }); dead = true; }
        else if (m === WATER) { b.life -= 0.05; if (rnd() < 0.1) sparks.push({ x: b.x, y: b.y, vx: 0, vy: -20, life: 0.2, col: '#bfe6ff', g: 1 }); }
      }
      if (dead) bullets.splice(i, 1);
    }
  }
  // ---------- weather ----------
  const BOLT = { id: 'bolt', r: 7, dmg: 18 }, METEOR = { id: 'meteor', r: 11, dmg: 28 };
  let wxT = 6, bolts = [], meteors = [], skyFlash = 0, ufos = [], ufoT = 5, metT = 10;
  function spawnMeteor() {                                                 // starts far above the top of the view and comes down steeply
    const tx = 20 + rnd() * (W - 40), vy = 260 + rnd() * 90, y0 = Math.min(camY, 0) - 620, t = (groundAt(tx) - y0) / vy; let vx = (rnd() < 0.5 ? 1 : -1) * (20 + rnd() * 40), x0 = tx - vx * t;
    if (x0 < 5 || x0 > W - 5) { vx = -vx; x0 = tx - vx * t; } if (x0 < 5 || x0 > W - 5) { vx *= 0.2; x0 = tx - vx * t; }
    meteors.push({ x: x0, y: y0, vx: vx, vy: vy, w: METEOR, own: null, t: 1, kid: true, wet: false, calm: true, jet: true }); snd('drop');
  }
  function lightning(x) {
    const gy = groundAt(x), pts = []; let px = x + (rnd() - 0.5) * 60;
    for (let y = Math.min(-20, camY - 10); y < gy; y += 7) { px += (x - px) * 0.18 + (rnd() - 0.5) * 12; pts.push(Math.round(px), y); }
    pts.push(x, gy); bolts.push({ pts: pts, t: 0 });
    blast(x, gy, BOLT); light(x, gy - 24, 230, 0.7, 1.5); lights[lights.length - 1].pen = 22; skyFlash = 1; shake = Math.max(shake, 6); snd('thunder');
  }
  function updateWeather() {
    const wx = ENV.weather;
    if (skyFlash > 0) skyFlash = Math.max(0, skyFlash - DT * 3.5);
    for (let i = bolts.length - 1; i >= 0; i--) { bolts[i].t += DT; if (bolts[i].t > 0.28) bolts.splice(i, 1); }
    for (let i = meteors.length - 1; i >= 0; i--) {
      const m = meteors[i], r = stepShot(m, true);
      for (let k = 0; k < 2; k++) ember(m.x, m.y, -m.vx * 0.1 + (rnd() - 0.5) * 20, -m.vy * 0.1 + (rnd() - 0.5) * 20, 0.3 + rnd() * 0.5, 0.1);
      if (r) { meteors.splice(i, 1); if (r === 1) { m.dir = m.vx < 0 ? -1 : 1; burst(m.x, m.y, METEOR, m); } }
    }
    for (let i = ufos.length - 1; i >= 0; i--) { const u = ufos[i]; u.t += DT; u.x += u.vx * DT; u.y += u.vy * DT + Math.sin(u.t * 5) * 0.15; if (u.x < -40 || u.x > VW + 40 || u.y < -30 || u.y > VH * 0.75) ufos.splice(i, 1); }
    if (state !== 'aim' && state !== 'flight' && state !== 'settle') return;
    if (ENV.b.ufos) {                                                     // sightseers: saucers crossing the sky at odd angles
      ufoT -= DT;
      if (ufoT <= 0) { ufoT = 50 + rnd() * 110; const dir = rnd() < 0.5 ? 1 : -1, sp = 35 + rnd() * 90, a = (rnd() - 0.5) * 0.9; ufos.push({ x: dir > 0 ? -20 : VW + 20, y: VH * (0.06 + rnd() * 0.4), vx: dir * sp * Math.cos(a), vy: sp * Math.sin(a) * 0.6, t: 0, big: rnd() < 0.3 }); snd('ufo'); }
    }
    if (ENV.b.meteors && wx !== 'meteor') { metT -= DT; if (metT <= 0) { metT = 12 + rnd() * 20; spawnMeteor(); } }   // and the odd meteor, whoever's turn it is
    if (wx === 'rain' || wx === 'storm') {                                // rain really does fill the low ground, slowly
      if (rnd() < (wx === 'storm' ? 0.28 : 0.14)) {
        const x = (rnd() * W) | 0; let y = 0; while (y < H && G[y * W + x] === 0) y++;
        if (y > 2 && y < H) { if ((G[y * W + x] & 7) === FIRE) G[y * W + x] = 0; else G[(y - 1) * W + x] = WATER | (x & 1) << 3; }
      }
    }
    if (wx !== 'storm' && wx !== 'meteor') return;
    wxT -= DT; if (wxT > 0) return;
    if (wx === 'storm') { wxT = 9 + rnd() * 13; if (rnd() < 0.35) { skyFlash = 0.7; snd('thunder', 1); } else lightning(20 + ((rnd() * (W - 40)) | 0)); }
    else { wxT = 7 + rnd() * 10; spawnMeteor(); }
  }
  function drawWeather() {
    const wx = ENV.weather, mod = function (a, n) { return ((a % n) + n) % n; };
    if (wx === 'rain' || wx === 'storm') {
      cx.fillStyle = 'rgba(170,200,235,.55)';
      for (let i = 0, n = wx === 'storm' ? 190 : 120; i < n; i++) { const sp = 420 + (i % 7) * 34, x = mod(i * 53.7 + time * (wind * 9) - camX * 0.5, VW), y = mod(i * 91.3 + time * sp, VH); cx.fillRect(x | 0, y | 0, 1, 3 + (i % 3)); }
    } else if (wx === 'snow') {
      cx.fillStyle = '#ffffff';
      for (let i = 0; i < 110; i++) { const x = mod(i * 37.1 + Math.sin(time * 0.9 + i) * 7 + time * wind * 4 - camX * 0.5, VW), y = mod(i * 71.9 + time * (20 + (i % 5) * 7), VH); cx.fillRect(x | 0, y | 0, i % 4 ? 1 : 2, 1); }
    } else if (wx === 'dust') {
      cx.fillStyle = 'rgba(' + (ENV.key === 'mars' ? '230,150,100' : '236,200,130') + ',.4)';
      for (let i = 0; i < 70; i++) { const x = mod(i * 61.3 + time * ((wind || 2) * 16 + (wind < 0 ? -40 : 40)) * (0.6 + (i % 5) * 0.2), VW), y = mod(i * 43.7 + Math.sin(time * 0.6 + i) * 6, VH); cx.fillRect(x | 0, y | 0, 5 + (i % 4) * 3, 1); }
    } else if (wx === 'meteor') {
      for (let i = 0; i < 2; i++) { const per = 9 + i * 6.7, win = 0.5 / per, ph = mod(time / per + i * 0.37, 1); if (ph > win) continue; const x0 = mod(i * 197 + Math.floor(time / per) * 131, VW), y0 = (i * 23 + Math.floor(time / per) * 37) % 70, d = ph / win * 90; cx.fillStyle = '#fff3c4'; for (let k = 0; k < 14; k++) if (k < 4 || (k & 1)) cx.fillRect((x0 + d - k * 1.6) | 0, (y0 + d * 0.7 - k * 1.1) | 0, 1, 1); }
    }
    for (let i = 0; i < meteors.length; i++) { const m = meteors[i], x = Math.round(m.x) - camXi, y = Math.round(m.y) - camYi; cx.fillStyle = '#ff9a3c'; cx.fillRect(x - 2, y - 2, 5, 5); cx.fillStyle = '#ffffff'; cx.fillRect(x - 1, y - 1, 3, 3); }
    for (let i = 0; i < bolts.length; i++) {
      const b = bolts[i], p = b.pts; if (b.t > 0.12 && ((b.t * 60) | 0) & 1) continue;
      for (let k = 2; k < p.length; k += 2) { line(p[k - 2] - camXi, p[k - 1] - camYi, p[k] - camXi, p[k + 1] - camYi, '#c8d8ff', b.t < 0.08); line(p[k - 2] - camXi, p[k - 1] - camYi, p[k] - camXi, p[k + 1] - camYi, '#ffffff', false); }
    }
    if (WALL !== 'out') {                                                 // the side walls
      const col = WALL === 'wrap' ? '#4ff0ff' : WALL === 'spring' ? '#7dff5a' : '#ff9a3c';
      for (let sd = 0; sd < 2; sd++) { const x = (sd ? W - 1 : 0) - camXi; if (x < -2 || x > VW + 2) continue; cx.fillStyle = col; for (let y = (tickN >> 3) % 8 - 8; y < VH; y += WALL === 'wrap' ? 4 : 8) cx.fillRect(x - (sd ? 1 : 0) + (WALL === 'spring' && (y >> 3) & 1 ? (sd ? -1 : 1) : 0), y, 2, WALL === 'wrap' ? 2 : 5); }
    }
  }

  // mines sit where they land, drop with the ground, and go off under a tank or in another blast
  function updateMines() {
    for (let i = mines.length - 1; i >= 0; i--) {
      const m = mines[i]; m.t += DT;
      if (m.y < H - FLOOR - 1 && !solid(cell(m.x, m.y + 1))) m.y++;
      if (m.fuse < 0 && m.t > 1) for (let k = 0; k < tanks.length; k++) { const t = tanks[k]; if (t.alive && Math.abs(t.x - m.x) <= 9 && m.y >= t.y - 9 && m.y <= t.y + 3) { m.fuse = 0.05; snd('arm'); } }
      if (m.fuse >= 0) { m.fuse -= DT; if (m.fuse <= 0) { mines.splice(i, 1); blast(m.x, m.y, MINE); } }
    }
  }
  function groundAt(x, from) { x = clamp(Math.round(x), 0, W - 1); for (let y = Math.max(0, from || 0); y < H; y++) if (solid(G[y * W + x])) return y; return H - 1; }
  // called-in strikes: an aircraft's bomb run, a rod dropped from orbit, a beam from the sky
  function updateStrikes() {
    for (let i = strikes.length - 1; i >= 0; i--) {
      const k = strikes[i]; k.t += DT;
      if (k.kind === 'air') {
        if (k.t > 0.7) {
          let top = H; for (let x = 0; x < W; x += 4) top = Math.min(top, groundAt(x));
          const alt = Math.max(12, top - 55), gy = groundAt(k.x), tf = Math.sqrt(2 * Math.max(10, gy - alt) / GRAV), lead = 60 * tf, drops = [];
          for (let n = -3; n <= 3; n++) drops.push(k.x + n * 15 * k.dir - k.dir * lead);
          planes.push({ x: k.dir > 0 ? -50 : W + 50, y: alt, dir: k.dir, drops: drops, own: k.own }); snd('flyby');
          strikes.splice(i, 1);
        }
      } else if (k.kind === 'rod') {
        if (k.t < 0.9) { if (((k.t * 60) | 0) % 12 === 0) snd('lock'); continue; }
        if (!k.go) { k.go = true; k.gy = groundAt(k.x); k.ry = k.gy - 760; snd('rod'); }
        k.ry += 1250 * DT; k.gy = groundAt(k.x);
        if (k.ry >= k.gy) {                                               // a narrow shaft punched deep, bedrock and all
          const gy = k.gy, x = Math.round(k.x);
          for (let d = -6; d < 84; d++) { const hw = Math.round(7 * (1 - Math.max(0, d) / 84 * 0.65)); for (let dx = -hw; dx <= hw; dx++) { const px = x + dx, py = gy + d; if (px < 0 || px >= W || py < 0 || py >= H - FLOOR) continue; const i2 = py * W + px; if (G[i2] !== 0) { if (rnd() < 0.12) throwGrain(px, py, LOOSE | SCORCH << 3, x, gy + 90, 150); G[i2] = 0; } } }
          blast(x, gy + 6, { id: 'rod1', r: 24, dmg: 95, rock: true }); blast(x, Math.min(H - FLOOR - 4, gy + 54), { id: 'rod2', r: 15, dmg: 50, rock: true });
          light(x, gy - 30, 220, 1.2, 1); shake = 16; snd('nuke', 1);
          for (let n = 0; n < 60; n++) ember(x + (rnd() - 0.5) * 8, gy, (rnd() - 0.5) * 90, -120 - rnd() * 220, 0.6 + rnd() * 1.2);
          for (let n = 0; n < 30; n++) smoke(x + (rnd() - 0.5) * 10, gy - n * 3, 3 + rnd() * 4, 2 + rnd() * 1.5, (rnd() - 0.5) * 8, -26 - rnd() * 18, n * 0.03, true);
          strikes.splice(i, 1);
        }
      } else if (k.kind === 'ion') {
        if (k.t < 0.9) { if (!k.ch) { k.ch = true; snd('ioncharge'); } continue; }
        if (!k.go) { k.go = true; snd('ion'); }
        if (k.t > 2.5) { strikes.splice(i, 1); continue; }
        const x0 = Math.round(k.x); let gsum = 0, gn = 0;
        for (let dx = -15; dx <= 15; dx++) {                              // boil the ground away from the top, fastest in the middle
          const px = x0 + dx; if (px < 0 || px >= W) continue;
          let y = 0; while (y < H && (G[y * W + px] & 7) === AIR) y++;
          gsum += y; gn++;
          if (y >= H - FLOOR || rnd() > 0.62 * (1 - Math.abs(dx) / 22)) continue;
          const m = G[y * W + px] & 7;
          if (m === ROCK && rnd() > 0.12) { G[y * W + px] = ROCK | SCORCH << 3; continue; }
          G[y * W + px] = 0;
          if (m === WATER) { if (rnd() < 0.3) steam(px, y); } else if (rnd() < 0.1) ember(px, y, (rnd() - 0.5) * 50, -40 - rnd() * 110, 0.3 + rnd() * 0.7, 0.6);
          if (y + 1 < H && ((G[(y + 1) * W + px] & 7) === DIRT)) G[(y + 1) * W + px] = DIRT | SCORCH << 3;
        }
        k.gy = gn ? gsum / gn : H / 2;
        if (tickN % 4 === 0) { light(x0, k.gy - 8, 120, 0.14, 1); if (rnd() < 0.6) smoke(x0 + (rnd() - 0.5) * 26, k.gy - 2, 2 + rnd() * 3, 0.8 + rnd(), (rnd() - 0.5) * 14, -20); }
        shake = Math.max(shake, 2.5);
        for (let n = 0; n < tanks.length; n++) { const t = tanks[n]; if (!t.alive || Math.abs(t.x - x0) > 20) continue; t.burn += 0.85 * (1 - Math.abs(t.x - x0) / 40); if (t.burn >= 3) { damage(t, t.burn | 0); t.burn -= t.burn | 0; } }
      }
    }
    for (let i = balls.length - 1; i >= 0; i--) {                         // the disco ball: up it goes, then it throws its bombs
      const B = balls[i]; B.t += DT;
      if (B.t < 0.8) {
        const e = 1 - Math.pow(1 - B.t / 0.8, 2.2), ny = B.y0 - B.top * e;
        if (ny < 6 || solid(cell(Math.round(B.x), Math.round(ny) - 4))) { B.top = B.y0 - B.y; } else B.y = ny;
        if (tickN % 2 === 0) sparks.push({ x: B.x + (rnd() - 0.5) * 4, y: B.y + 4, vx: (rnd() - 0.5) * 20, vy: 20 + rnd() * 30, life: 0.4, col: NEON[(tickN >> 1) % NEON.length], g: 0.3 });
        continue;
      }
      if (tickN % 6 === 0) light(B.x, B.y, 70, 0.16, 0.8);
      B.next -= DT;
      if (B.left > 0 && B.next <= 0) {
        const a = rnd() * 6.283, v = 70 + rnd() * 110; B.left--; B.next = 0.11;
        shots.push({ x: B.x, y: B.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, w: DISCO, own: B.own, t: 1, kid: true, wet: false, hue: B.left }); snd('pew', B.left);
      }
      if (B.left <= 0 && B.next < -0.25) {
        for (let k = 0; k < 40; k++) { const a = rnd() * 6.283, v = 30 + rnd() * 120; sparks.push({ x: B.x, y: B.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.4 + rnd() * 0.7, col: k % 3 ? NEON[k % NEON.length] : '#ffffff', g: 0.5 }); }
        light(B.x, B.y, 90, 0.3); snd('split'); balls.splice(i, 1);
      }
    }
    for (let i = planes.length - 1; i >= 0; i--) {
      const P = planes[i]; P.x += P.dir * 190 * DT;
      while (P.drops.length && (P.x - P.drops[0]) * P.dir >= 0) { P.drops.shift(); shots.push({ x: P.x, y: P.y + 4, vx: P.dir * 60, vy: 12, w: AIRBOMB, own: P.own, t: 1, kid: true, wet: false, calm: true }); snd('drop'); }
      if (tickN % 3 === 0) sparks.push({ x: P.x - P.dir * 13, y: P.y + 1, vx: -P.dir * 20, vy: 0, life: 0.5, col: '#d8d2e8', g: 0 });
      if (P.x < -70 || P.x > W + 70) planes.splice(i, 1);
    }
  }
  // the plasma cutter: a short cone from the muzzle that eats earth and scorches tanks
  function plasma(t, w, m) {
    const L = 48, x0 = Math.round(m.x), y0 = Math.round(m.y);
    for (let dy = -L; dy <= L; dy++) for (let dx = -L; dx <= L; dx++) {
      const d = dx * m.c - dy * m.s; if (d <= 0 || d > L) continue;
      const side = Math.abs(dx * m.s + dy * m.c); if (side > 3 + d * 0.42) continue;
      const px = x0 + dx, py = y0 + dy; if (px < 0 || px >= W || py < 0 || py >= H - FLOOR) continue;
      const i = py * W + px, mm = G[i] & 7; if (mm === AIR) continue;
      if (mm === ROCK) { if (rnd() < 0.4) G[i] = ROCK | SCORCH << 3; continue; }
      if (mm === WATER) { if (rnd() < 0.05) steam(px, py); } else if (rnd() < 0.03) sparks.push({ x: px, y: py, vx: m.c * 60 + (rnd() - 0.5) * 70, vy: -m.s * 60 - rnd() * 50, life: 0.3 + rnd() * 0.5, col: rnd() < 0.5 ? '#4ff0ff' : '#ffffff', g: 0.6 });
      G[i] = 0;
    }
    for (let i = 0; i < tanks.length; i++) {
      const o = tanks[i]; if (!o.alive || o === t) continue;
      const dx = o.x - m.x, dy = (o.y - 3) - m.y, d = dx * m.c - dy * m.s, side = Math.abs(dx * m.s + dy * m.c);
      if (d > -4 && d < L + 8 && side < 9 + Math.max(0, d) * 0.42) damage(o, w.dmg * (1 - Math.max(0, d) / L * 0.5));
    }
    cones.push({ x: m.x, y: m.y, c: m.c, s: m.s, L: L, t: 0 });
    light(m.x + m.c * 14, m.y - m.s * 14, 80, 0.4, 1); shake = Math.max(shake, 3); snd('plasma');
  }
  // the lance: an instant beam along the barrel that cuts through anything but bedrock
  function lance(t, w, m) {
    let x = m.x, y = m.y; const L = 110 + t.p * 2.2, hit = [];
    for (let d = 0; d < L; d++) {
      x += m.c; y -= m.s; const ix = Math.round(x), iy = Math.round(y);
      if (ix < 1 || ix >= W - 1 || iy >= H - FLOOR) break; if (iy < 1) continue;
      if ((G[iy * W + ix] & 7) === ROCK) { G[iy * W + ix] = ROCK | SCORCH << 3; break; }
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const i = (iy + dy) * W + ix + dx, mm = G[i] & 7; if (mm === ROCK || mm === AIR) continue; if (mm === WATER) { if (rnd() < 0.2) steam(ix, iy); } else if (rnd() < 0.08) ember(ix, iy, (rnd() - 0.5) * 60, -20 - rnd() * 50, 0.3 + rnd() * 0.5); G[i] = 0; }
      const tt = hitsTank(x, y, { own: t, t: d > 14 ? 1 : 0 });
      if (tt && hit.indexOf(tt) < 0) { hit.push(tt); damage(tt, w.dmg); for (let k = 0; k < 20; k++) ember(x, y, (rnd() - 0.5) * 120, (rnd() - 0.5) * 120 - 30, 0.3 + rnd() * 0.6); }
      if (d % 26 === 13) light(x, y, 44, 0.35, 0.9);
    }
    beams.push({ x0: m.x, y0: m.y, x1: x, y1: y, t: 0 });
    burst(x, y, { id: 'zap', r: 6, dmg: 12 }); shake = Math.max(shake, 3); snd('lance');
  }

  // ---------- explosions and terrain edits ----------
  function throwGrain(x, y, c, cx0, cy0, power) {
    if (grains.length > (SOFT ? 1700 : 700)) return;
    const dx = x - cx0, dy = y - cy0, d = Math.sqrt(dx * dx + dy * dy) || 1, v = power * (0.5 + rnd() * 0.8);
    grains.push({ x: x, y: y, vx: dx / d * v + (rnd() - 0.5) * 30, vy: dy / d * v - 50 - rnd() * 50, c: c });
  }
  function burst(x, y, w, s) {
    x = Math.round(x); y = Math.round(y);
    if (w.tracer) { for (let k = 0; k < 6; k++) sparks.push({ x: x, y: y, vx: (rnd() - 0.5) * 30, vy: -10 - rnd() * 30, life: 0.4, col: '#fff3c4', g: 0.6 }); snd('ping'); if (s && s.own) { s.own.beacon = { x: x, y: y, spent: false }; light(x, y, 30, 0.4); } return; }
    if (w.call) {                                                         // a marker: something much worse is on its way
      const col = w.call === 'air' ? '#e0524a' : w.call === 'rod' ? '#ffe14f' : '#4ff0ff';
      strikes.push({ kind: w.call, x: clamp(x, 20, W - 20), y: y, dir: s && s.dir ? s.dir : 1, t: 0, own: s ? s.own : null });
      for (let k = 0; k < 16; k++) puff(x + (rnd() - 0.5) * 6, y - 2, 2 + rnd() * 2.5, 1.2 + rnd() * 1.6, (rnd() - 0.5) * 8, -12 - rnd() * 10, k * 0.07, col);
      snd('canister'); return;
    }
    blast(x, y, w);
    const own = s ? s.own : null, dir = s && s.dir ? s.dir : 1;
    if (w.scatter) { const sp = w.disco ? 1.5 : 1; for (let k = 0; k < w.scatter; k++) shots.push({ x: x, y: y - w.r - 2, vx: (rnd() - 0.5) * 170 * sp, vy: (-70 - rnd() * 95) * (w.disco ? 1.25 : 1), w: w.disco ? DISCO : BOMBLET, own: own, t: 1, kid: true, wet: false, hue: k }); if (!w.disco) snd('split'); }
    if (w.ball) { balls.push({ x: x, y: y - w.r, y0: y - w.r, t: 0, left: w.ball, next: 0, top: 200, own: own }); snd('chime'); }
    if (w.hops && s && (s.hop || 0) < w.hops) { shots.push({ x: x, y: y - w.r - 3, vx: dir * 54, vy: -102, w: w, own: own, t: 1, kid: true, wet: false, hop: (s.hop || 0) + 1 }); snd('skip'); }
    if (w.napalm) {
      const r = w.napalm;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const px = x + dx, py = y + dy; if (dx * dx + dy * dy > r * r || px < 0 || px >= W || py < 0 || py >= H - FLOOR) continue; if (G[py * W + px] === 0) G[py * W + px] = FIRE | 7 << 3; }
      for (let k = 0; k < 70; k++) throwGrain(x + (rnd() - 0.5) * 6, y - 2 - rnd() * 4, FIRE | 7 << 3, x, y + 8, 75);
      snd('ignite');
    }
  }
  // Nuclear weapons burst in the air. They leave the ground where it is (scorched), and do their work with
  // heat and a pressure wave: a long, bright flash, a slow fireball, a shock ring racing outward, a mushroom cloud.
  function nukeBlast(x, y, w) {
    const r = w.r, big = w.nuke, R = Math.round(r * 1.6), gy = groundAt(x, y);
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const px = x + dx, py = y + dy; if (dx * dx + dy * dy > R * R || px < 0 || px >= W || py < 3 || py >= H - FLOOR) continue;
      const i = py * W + px, m = G[i] & 7; if (m !== DIRT && m !== LOOSE && m !== MUD) continue;
      if ((G[i - W] === 0 || G[i - 2 * W] === 0 || G[i - 3 * W] === 0) && rnd() < 0.85) G[i] = (m === MUD ? DIRT : m) | SCORCH << 3;
    }
    booms.push({ x: x, y: y, r: r, t: 0, kind: 'nuke', dur: 1.5 + big * 0.5, big: big });
    for (let k = 0; k < r * 4; k++) { const a = rnd() * 6.283, v = 30 + rnd() * r * 7; ember(x, y, Math.cos(a) * v, Math.sin(a) * v - 20, 0.5 + rnd() * rnd() * 2); }
    const stem = Math.max(8, gy - y);
    for (let k = 0; k < 40; k++) smoke(x + (rnd() - 0.5) * r * 0.3, gy - rnd() * stem, r * (0.12 + rnd() * 0.1), 2.4 + rnd() * 1.8, (rnd() - 0.5) * 4, -20 - rnd() * 14, 0.5 + rnd() * 0.9, true);
    for (let k = 0; k < 50; k++) { const a = rnd() * 6.283; smoke(x + Math.cos(a) * r * 0.8 * rnd(), y - r * 0.5 + Math.sin(a) * r * 0.35, r * (0.2 + rnd() * 0.18), 3 + rnd() * 2, Math.cos(a) * 14, -13 - rnd() * 7, 0.9 + rnd() * 0.7, true); }
    light(x, y, VW * (big >= 2 ? 0.33 : big >= 1 ? 0.25 : 0.17), 1.3 + big * 0.5, 1.5); lights[lights.length - 1].pen = 26;   // lights about a third of the screen at full strength, and soaks deep into the ground
    hurt(x, y, r + 22, w.dmg); shake = Math.max(shake, 8 + big * 4); snd('nuke', big);
    if (navigator.vibrate) try { navigator.vibrate(big >= 1 ? [60, 40, 120] : 40); } catch (e) { /* not allowed */ }
  }
  function blast(x, y, w) {
    const r = w.r;
    if (w.nuke) { nukeBlast(x, y, w); return; }
    if (w.fill) {   // dirt and water charges add material instead of taking it away
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const px = x + dx, py = y + dy; if (dx * dx + dy * dy > r * r || px < 0 || px >= W || py < 0 || py >= H - FLOOR) continue;
        if (G[py * W + px] === 0) G[py * W + px] = w.fill | (w.fill === WATER ? (px + py) & 1 : (rnd() * 5 | 0)) << 3;
      }
      booms.push({ x: x, y: y, r: r, t: 0, kind: w.fill === WATER ? 'water' : 'dirt' }); snd(w.fill === WATER ? 'water' : 'dirt');
      if (w.fill !== WATER) for (let k = 0; k < 8; k++) smoke(x + (rnd() - 0.5) * r * 2, y + (rnd() - 0.5) * r, 3 + rnd() * 3, 0.7 + rnd() * 0.6, (rnd() - 0.5) * 20, -6 - rnd() * 8, 0, false);
      if (w.fill === WATER) splash(x, y, 24);
      shake = Math.max(shake, 2); return;
    }
    if (w.mud) {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const px = x + dx, py = y + dy; if (dx * dx + dy * dy > r * r || px < 0 || px >= W || py < 0 || py >= H) continue;
        const i = py * W + px, m = G[i] & 7; if (m === DIRT || m === LOOSE) G[i] = MUD | (rnd() * 4 | 0) << 3;
      }
      booms.push({ x: x, y: y, r: r, t: 0, kind: 'mud' }); snd('mud'); hurt(x, y, r, w.dmg); shake = Math.max(shake, 2); return;
    }
    const r2 = r * r, rr = r + 2, chip = w.rock ? r2 * 0.22 : -1;
    for (let dy = -rr; dy <= rr; dy++) for (let dx = -rr; dx <= rr; dx++) {
      const px = x + dx, py = y + dy, d2 = dx * dx + dy * dy; if (d2 > rr * rr || px < 0 || px >= W || py < 0 || py >= H - FLOOR) continue;
      const i = py * W + px, c = G[i], m = c & 7; if (m === AIR) continue;
      if (d2 > r2) { if ((m === DIRT || m === LOOSE) && rnd() < 0.75) G[i] = m | SCORCH << 3; continue; }
      if (m === ROCK) { if (d2 < chip) { G[i] = 0; if (rnd() < 0.05) throwGrain(px, py, LOOSE | SCORCH << 3, x, y, r * 6); } else if (rnd() < 0.5) G[i] = ROCK | SCORCH << 3; continue; }
      G[i] = 0;
      if (rnd() < (m === WATER ? 0.5 : SOFT ? 0.5 + SOFT * 0.1 : 0.14)) throwGrain(px, py, m === DIRT ? LOOSE | (c & 0x38) : c, x, y, (30 + r * 5) * (SOFT ? 0.75 : 1));   // sand and dust are thrown, not destroyed
    }
    if (w.dust) {                                                         // an excavator moves earth without a bang
      booms.push({ x: x, y: y, r: r, t: 0, kind: 'dirt' });
      for (let k = 0; k < 22; k++) { const a = rnd() * 6.283; smoke(x + Math.cos(a) * r * rnd(), y + Math.sin(a) * r * rnd(), 3 + rnd() * 4, 0.8 + rnd() * 0.9, Math.cos(a) * 22, Math.sin(a) * 12 - 8); }
      snd('dust'); shake = Math.max(shake, 4); return;
    }
    if (w.disco) {                                                        // all colour and noise, and a real blast underneath
      const col = NEON[discoN % NEON.length];
      booms.push({ x: x, y: y, r: r, t: 0, kind: 'disco', col: col, col2: NEON[(discoN + 2) % NEON.length] });
      for (let k = 0; k < 34; k++) { const a = rnd() * 6.283, v = 40 + rnd() * 110; sparks.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, life: 0.4 + rnd() * 0.8, col: NEON[(discoN + k) % NEON.length], g: 0.8 }); }
      for (let k = 0; k < 5; k++) smoke(x + (rnd() - 0.5) * r, y - rnd() * r * 0.5, 2 + rnd() * 3, 0.8 + rnd(), (rnd() - 0.5) * 16, -10);
      light(x, y - r, 70, 0.45); snd('disco', discoN++); hurt(x, y, r, w.dmg); shake = Math.max(shake, 3); return;
    }
    booms.push({ x: x, y: y, r: r, t: 0, kind: 'fire' });
    if (ENV.b.dust || SOFT === 2) for (let k = 0; k < 6 + r; k++) { puff(x + (rnd() - 0.5) * r * 2.4, y - rnd() * r, 3 + rnd() * r * 0.25, 4 + rnd() * 5, (rnd() - 0.5) * 30, -4 - rnd() * 8, rnd() * 0.3, shadeHex(ENV.b.top, 0.8 + rnd() * 0.2)); smokes[smokes.length - 1].hang = true; }   // dust that hangs about
    for (let k = 0; k < r * 5; k++) { const a = rnd() * 6.283, v = (30 + rnd() * r * 9) * (k % 4 ? 1 : 1.6); ember(x, y, Math.cos(a) * v, Math.sin(a) * v - 40, 0.35 + rnd() * rnd() * 1.4); }
    for (let k = 0; k < r * 1.2; k++) {                                   // a rolling cloud, then a plume from the crater
      const a = rnd() * 6.283, d = rnd() * r * 0.8;
      smoke(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.7, r * (0.22 + rnd() * 0.28), 0.9 + rnd() * 1.3, Math.cos(a) * (10 + rnd() * 24), Math.sin(a) * 14 - 10 - rnd() * 14, rnd() * 0.12, true);
    }
    for (let k = 0; k < r * 0.6; k++) smoke(x + (rnd() - 0.5) * r, y + r * 0.3 * rnd(), 2 + rnd() * r * 0.16, 1.2 + rnd() * 1.4, (rnd() - 0.5) * 6, -10 - rnd() * 10, 0.35 + rnd() * 1.6);
    { const ly = y - Math.round(r * 0.85) - 2; light(x, ly >= 0 && solid(cell(x, ly)) ? y : ly, Math.min(150, r * 6), 0.55 + r * 0.015);
      const hy = y - Math.round(r * 2.4); if (hy < 0 || !solid(cell(x, hy))) light(x, hy, Math.min(150, r * 6), 0.45 + r * 0.012, 0.8); }   // and from the rising glow above it   // lit from the top of the fireball, so it clears the crater lip
    snd(w.id ? 'boom' : 'death', r);
    hurt(x, y, r, w.dmg); shake = Math.max(shake, Math.min(9, r * 0.4));
    if (navigator.vibrate && r > 12) try { navigator.vibrate(30); } catch (e) { /* not allowed */ }
  }
  function hurt(x, y, r, dmg) {
    if (!dmg) return;
    for (let i = 0; i < mines.length; i++) { const m = mines[i], dx = m.x - x, dy = m.y - y; if (m.fuse < 0 && dx * dx + dy * dy < r * r * 1.7) m.fuse = 0.1 + rnd() * 0.2; }
    for (let i = 0; i < tanks.length; i++) {
      const t = tanks[i]; if (!t.alive) continue;
      const dx = Math.max(Math.abs(x - t.x) - 6, 0), dy = Math.max(Math.abs(y - (t.y - 3)) - 3, 0), d = Math.sqrt(dx * dx + dy * dy), reach = r * 1.45;
      if (d < reach) damage(t, dmg * (1 - d / reach) * (d < 2 ? 1.15 : 1));
    }
  }
  function damage(t, n) {
    n = Math.round(n); if (n <= 0 || !t.alive) return;
    t.hp = Math.max(0, t.hp - n); t.flash = 0.35; hudDirty = true; snd('hit', n);
    for (let i = 0; i < floats.length; i++) if (floats[i].tank === t && floats[i].t < 0.5) { floats[i].n += n; floats[i].t = Math.min(floats[i].t, 0.15); return; }
    floats.push({ x: t.x, y: t.y - 14, n: n, t: 0, col: t.team.lite, tank: t });
  }
  function splash(x, y, n) { for (let i = 0; i < n; i++) sparks.push({ x: x, y: y, vx: (rnd() - 0.5) * 70, vy: -30 - rnd() * 70, life: 0.4 + rnd() * 0.4, col: i & 1 ? '#bfe6ff' : '#5fa8ec', g: 1 }); }

  function updateGrains() {
    for (let i = grains.length - 1; i >= 0; i--) {
      const g = grains[i]; g.vy += GRAV * DT;
      const n = Math.max(1, Math.ceil(Math.max(Math.abs(g.vx), Math.abs(g.vy)) * DT)); let done = false;
      for (let k = 0; k < n && !done; k++) {
        const nx = g.x + g.vx * DT / n, ny = g.y + g.vy * DT / n, ix = Math.floor(nx), iy = Math.floor(ny);
        if (ix < 0 || ix >= W || iy >= H) { done = true; break; }
        if (iy >= 0 && G[iy * W + ix] !== 0 && !((g.c & 7) !== WATER && (G[iy * W + ix] & 7) === WATER)) {
          let px = Math.floor(g.x), py = Math.floor(g.y);                // land in the last free cell
          for (let u = 0; u < 8 && py >= 0 && G[py * W + px] !== 0; u++) py--;
          if (py >= 0 && px >= 0 && px < W && G[py * W + px] === 0) G[py * W + px] = g.c;
          done = true; break;
        }
        g.x = nx; g.y = ny;
      }
      if (done) grains.splice(i, 1);
    }
  }

  // ---------- tanks ----------
  function support(t) { let n = 0; for (let x = t.x - 4; x <= t.x + 4; x++) if (solid(cell(x, t.y))) n++; return n; }
  function updateTanks() {
    let falling = false;
    for (let i = 0; i < tanks.length; i++) {
      const t = tanks[i]; if (!t.alive) continue;
      if (t.flash > 0) t.flash -= DT;
      if (fireN) {
        let n = 0; for (let yy = t.y - 8; yy <= t.y + 1; yy++) for (let xx = t.x - 7; xx <= t.x + 7; xx++) if ((cell(xx, yy) & 7) === FIRE) n++;
        t.burn += n * 0.002; if (t.burn >= 3) { damage(t, t.burn | 0); t.burn -= t.burn | 0; }
      }
      if (support(t) < 3 && t.y < H - FLOOR) {
        falling = true; t.vy = Math.min(t.vy + GRAV * DT, 200); t.fy = (t.fy || 0) + t.vy * DT;
        while (t.fy >= 1 && support(t) < 3 && t.y < H - FLOOR) { t.y++; t.fy--; t.fall++; }
      } else if (t.vy) {
        if (t.fall > 12) damage(t, (t.fall - 12) * 1.4); if (t.fall > 3) snd('thud');
        t.vy = 0; t.fy = 0; t.fall = 0;
      }
    }
    return falling;
  }
  function killDead() {
    let any = false;
    for (let i = 0; i < tanks.length; i++) { const t = tanks[i]; if (t.alive && t.hp <= 0) { t.alive = false; any = true; hudDirty = true; burst(t.x, t.y - 3, { r: 13, dmg: 30 }); banner(t.team.name + ' IS OUT', t.team.lite); } }
    return any;
  }

  // ---------- computer players ----------
  function simShot(t, a, p) {
    const save = { a: t.a }; t.a = a; const m = muzzle(t), v = speedOf(p); t.a = save.a;
    const s = { x: m.x, y: m.y, vx: m.c * v, vy: -m.s * v, own: t, t: 0 };
    for (let k = 0; k < 900; k++) { const r = stepShot(s, false); if (r) return r === 1 ? s : null; }
    return null;
  }
  function plan(t) {
    const foes = tanks.filter(function (o) { return o.alive && o !== t; }); if (!foes.length) return { a: 90, p: 40, w: 0 };
    const foe = foes[(rnd() * foes.length) | 0]; let best = null, bd = 1e9;
    for (let a = 8; a <= 172; a += 3) for (let p = 20; p <= 100; p += 4) {
      const s = simShot(t, a, p); if (!s) continue;
      const mine = Math.abs(s.x - t.x) < 24 && Math.abs(s.y - t.y) < 24;
      const d = Math.abs(s.x - foe.x) + Math.abs(s.y - (foe.y - 3)) + (mine ? 500 : 0);
      if (d < bd) { bd = d; best = { a: a, p: p }; }
    }
    if (!best) best = { a: t.x < foe.x ? 60 : 120, p: 70 };
    const g = function () { return (rnd() + rnd() + rnd() - 1.5) * 1.6; };
    let w = 0; if (rnd() < 0.3) { const opts = []; for (let i = 1; i < WEAPONS.length; i++) if (t.ammo[i] > 0 && WEAPONS[i].ai) opts.push(i); if (opts.length) w = opts[(rnd() * opts.length) | 0]; }
    return { a: clamp(Math.round(best.a + g() * 4), 0, 180), p: clamp(Math.round(best.p + g() * 5), 5, 100), w: w };
  }
  function updateAI() {
    const t = tanks[cur]; ai.t += DT;
    if (ai.t < 0.7) return;
    if (!ai.plan) { ai.plan = plan(t); t.w = ai.plan.w; hudDirty = true; return; }
    if ((tickN & 3) === 0 && (ai.plan.a !== t.a || ai.plan.p !== t.p)) snd('tick');
    const da = ai.plan.a - t.a, dp = ai.plan.p - t.p;
    if (da) { t.a += Math.sign(da) * Math.min(Math.abs(da), 1); hudDirty = true; ai.hold = 0; return; }
    if (dp) { t.p += Math.sign(dp) * Math.min(Math.abs(dp), 1); hudDirty = true; ai.hold = 0; return; }
    ai.hold = (ai.hold || 0) + DT; if (ai.hold > 0.35) fire();
  }

  // ---------- update ----------
  const held = {};
  function nudge(k, n) {
    if (state !== 'aim' || paused) return; const t = tanks[cur]; if (t.cpu) return;
    if (k === 'al') t.a = clamp(t.a + n, 0, 180); else if (k === 'ar') t.a = clamp(t.a - n, 0, 180);
    else if (k === 'pu') t.p = clamp(t.p + n, 5, 100); else if (k === 'pd') t.p = clamp(t.p - n, 5, 100);
    hudDirty = true; snd('tick');
  }
  function cycleWeapon(d) {
    if (state !== 'aim' || paused) return; const t = tanks[cur]; if (t.cpu) return;
    for (let k = 0; k < WEAPONS.length; k++) { t.w = (t.w + d + WEAPONS.length) % WEAPONS.length; if (t.ammo[t.w] > 0) break; }
    hudDirty = true; snd('weapon');
  }
  function step() {
    time += DT;
    for (const k in held) { const h = held[k]; h.t += DT; if (h.t > 0.28) { h.acc += DT * (h.t > 1.2 ? 60 : 28); while (h.acc >= 1) { h.acc--; nudge(k, 1); } } }
    tick();
    updateGrains();
    const falling = updateTanks();
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i]; p.life -= DT; if (p.life <= 0) { sparks.splice(i, 1); continue; }
      p.vy += GRAV * p.g * DT; const nx = p.x + p.vx * DT, ny = p.y + p.vy * DT;
      if (p.hot && ny >= 0 && solid(cell(nx | 0, ny | 0))) { p.vy *= -0.35; p.vx *= 0.5; p.life *= 0.7; } else { p.x = nx; p.y = ny; }
    }
    for (let i = smokes.length - 1; i >= 0; i--) {
      const m = smokes[i]; if (m.wait > 0) { m.wait -= DT; continue; }
      m.life -= DT; if (m.life <= 0) { smokes.splice(i, 1); continue; }
      m.vx += (wind * 2.2 - m.vx) * DT * 1.2; m.vy += ((m.hang ? -1.5 : -13) - m.vy) * DT * 1.8; m.x += m.vx * DT; m.y += m.vy * DT;
    }
    for (let i = beams.length - 1; i >= 0; i--) { beams[i].t += DT; if (beams[i].t > 0.35) beams.splice(i, 1); }
    if (AU) AU.burn(fireN);
    for (let i = lights.length - 1; i >= 0; i--) { lights[i].t += DT; if (lights[i].t >= lights[i].dur) lights.splice(i, 1); }
    for (let i = booms.length - 1; i >= 0; i--) { booms[i].t += DT; if (booms[i].t > (booms[i].dur || 0.55)) { booms.splice(i, 1); continue; }
      const b = booms[i]; if (b.kind !== 'nuke') continue;
      const q = b.t / (b.dur * 0.6); if (q >= 1 || (tickN & 1)) continue;
      const ring = b.r * (0.6 + 2.8 * q);
      for (let sd = -1; sd <= 1; sd += 2) {
        const gx = Math.round(b.x + sd * ring); if (gx < 2 || gx >= W - 2) continue;
        const gy = groundAt(gx); if (Math.abs(gy - b.y) > ring * 0.9 + 30) continue;
        puff(gx, gy - 2, 2 + rnd() * 3, 0.5 + rnd() * 0.6, sd * (30 + rnd() * 30), -6 - rnd() * 10, 0, rnd() < 0.5 ? '#b89a78' : '#8a7460');
        for (let k = 0; k < 2; k++) sparks.push({ x: gx, y: gy - 1, vx: sd * (40 + rnd() * 60), vy: -20 - rnd() * 50, life: 0.3 + rnd() * 0.4, col: '#c9a070', g: 1 });
      }
      shake = Math.max(shake, 3 * (1 - q));
    }
    for (let i = floats.length - 1; i >= 0; i--) { floats[i].t += DT; if (floats[i].t > 1.3) floats.splice(i, 1); }
    for (let i = 0; i < clouds.length; i++) { const c = clouds[i]; c.x += (wind * 0.5 + 0.6) * c.k * DT; if (c.x > VW + 10) c.x = -c.c.width; if (c.x < -c.c.width - 10) c.x = VW; }
    if (shake > 0) shake = Math.max(0, shake - DT * 22);
    if (bannerT > 0) { bannerT -= DT; if (bannerT <= 0) el('banner').classList.remove('on'); }
    updateWeather();
    if (state === 'aim') for (let i = 0; i < tanks.length; i++) if (tanks[i].alive && tanks[i].hp <= 0) { state = 'settle'; stT = 0; quiet = 0; again = true; ai = null; closePicker(); break; }   // weather or a mine got someone mid-turn
    if (state === 'aim' && ai) updateAI();
    updateMines();
    for (let i = cones.length - 1; i >= 0; i--) { cones[i].t += DT; if (cones[i].t > 0.32) cones.splice(i, 1); }
    if (state === 'flight') { updateSalvo(); updateShots(); updateBullets(); updateStrikes(); if (!salvo && !shots.length && !bullets.length && !strikes.length && !planes.length && !balls.length) { state = 'settle'; stT = 0; quiet = 0; if (AU) AU.whistle(null); } }
    else if (state === 'settle') {
      stT += DT; quiet = moves < (ENV.weather === 'rain' || ENV.weather === 'storm' ? 110 : 24) ? quiet + 1 : 0;   // mud oozes for a long while; a trickle does not hold up the next shot
      let fused = false; for (let i = 0; i < mines.length; i++) if (mines[i].fuse >= 0) fused = true;
      const calm = !falling && !fused;   // only what decides the turn: tanks at rest and no mine about to go off. Debris, smoke, water and fire carry on into the next turn.
      if (calm && stT > 0.9) { if (killDead()) { stT = 0; quiet = 0; } else if (again && tanks[cur].alive && tanks.filter(function (t) { return t.alive; }).length > 1) { again = false; beginTurn(cur); } else { again = false; nextTurn(); } }
    }
    followCam();
  }

  // ---------- camera ----------
  function camTarget() {
    let fx = W / 2, fy = null;
    if (balls.length) { fx = balls[0].x; fy = balls[0].y; } else if (shots.length) { fx = shots[0].x; fy = shots[0].y; } else if (strikes.length) fx = strikes[0].x; else if (planes.length) fx = planes[0].x; else if (cur >= 0 && tanks[cur] && state !== 'menu') fx = tanks[cur].x;
    const tx = VW >= W ? -((VW - W) >> 1) : clamp(fx - VW / 2, 0, W - VW);
    const base = H - VH; let ty = base;
    if (fy !== null && fy < base + VH * 0.25) ty = Math.max(fy - VH * 0.25, -260);
    return [tx, Math.min(ty, base)];
  }
  function snapCam() { const t = camTarget(); camX = t[0]; camY = t[1]; }
  function followCam() { const t = camTarget(); camX += (t[0] - camX) * 0.1; camY += (t[1] - camY) * (t[1] < camY ? 0.25 : 0.06); }

  // ---------- drawing ----------
  const planeSpr = {};
  function planeSprite(dir) {
    if (planeSpr[dir]) return planeSpr[dir];
    const rows = ['..o.....................', '.oMo.........oo.........', '.oMMo.......oMMoo.......', '.oMMMoooooooMMMCCooo....', 'oLMMMMMMMMMMMMMMMMMMoo..', '.ooMMMdddddMMMMMMMMMMMo.', '...oooooddddooooooooooo.', '........oooo............'];
    const c = document.createElement('canvas'); c.width = 24; c.height = 8; const k = c.getContext('2d'), col = { o: '#141226', M: '#9aa3b4', L: '#ff9a3c', d: '#5d6472', C: '#4ff0ff' };
    rows.forEach(function (r, y) { for (let x = 0; x < r.length; x++) if (r[x] !== '.') { k.fillStyle = col[r[x]]; k.fillRect(dir > 0 ? x : 23 - x, y, 1, 1); } });
    return (planeSpr[dir] = c);
  }
  const tankSpr = {};
  function tankSprite(team) {
    if (tankSpr[team.name]) return tankSpr[team.name];
    const rows = ['.....ooooo.....', '....oLMMMdo....', '...oMMMMMMdo...', '.oooooooooooooo', 'oLMMMMMMMMMMMdo', 'oddddddddddddd.', 'okwkkwkkwkkwkko', '.okkkkkkkkkko..'];
    const c = document.createElement('canvas'); c.width = 15; c.height = 8; const k = c.getContext('2d');
    const col = { o: '#141226', L: team.lite, M: team.main, d: team.dark, k: '#2a2838', w: '#8a88a0' };
    rows.forEach(function (r, y) { for (let x = 0; x < r.length; x++) if (r[x] !== '.') { k.fillStyle = col[r[x]]; k.fillRect(x, y, 1, 1); } });
    return (tankSpr[team.name] = c);
  }
  function line(x0, y0, x1, y1, col, wide) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx + dy;
    cx.fillStyle = col;
    for (;;) { cx.fillRect(x0 - (wide ? 1 : 0), y0 - (wide ? 1 : 0), wide ? 3 : 1, wide ? 3 : 1); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
  }
  function disc(x, y, r, col, dither) {
    cx.fillStyle = col; r = Math.round(r); if (r < 1) { cx.fillRect(x, y, 1, 1); return; }
    for (let dy = -r; dy <= r; dy++) {
      const hw = Math.floor(Math.sqrt(r * r - dy * dy));
      if (!dither) cx.fillRect(x - hw, y + dy, hw * 2 + 1, 1);
      else for (let dx = -hw; dx <= hw; dx++) if (((x + dx + y + dy) & 1) === (dither & 1) && (dither < 3 || ((x + dx) & 1))) cx.fillRect(x + dx, y + dy, 1, 1);
    }
  }
  const FONT = { 0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111', 4: '101101111001001', 5: '111100111001111', 6: '111100111101111', 7: '111001010010010', 8: '111101111101111', 9: '111101111001111', '-': '000000111000000' };
  function digits(str, x, y, col) {
    x = Math.round(x - str.length * 2); y = Math.round(y);
    for (let pass = 0; pass < 2; pass++) for (let i = 0; i < str.length; i++) {
      const g = FONT[str[i]]; if (!g) continue;
      for (let k = 0; k < 15; k++) if (g[k] === '1') {
        const px = x + i * 4 + (k % 3), py = y + ((k / 3) | 0);
        if (pass === 0) { cx.fillStyle = '#141226'; cx.fillRect(px - 1, py - 1, 3, 3); } else { cx.fillStyle = col; cx.fillRect(px, py, 1, 1); }
      }
    }
  }
  function drawTank(t) {
    const x = t.x - camXi, y = t.y - camYi, a = t.a * Math.PI / 180;
    line(x, y - 6, x + Math.cos(a) * 9, y - 6 - Math.sin(a) * 9, '#141226', true);
    line(x, y - 6, x + Math.cos(a) * 9, y - 6 - Math.sin(a) * 9, t.flash > 0 ? '#ffffff' : t.team.dark, false);
    cx.drawImage(tankSprite(t.team), x - 7, y - 8);
    if (t.flash > 0 && ((t.flash * 20) | 0) & 1) { cx.fillStyle = 'rgba(255,255,255,.75)'; cx.fillRect(x - 6, y - 7, 13, 6); }
  }
  // Flash lighting. Each light casts rays outward through the air; a ray lights the first few pixels of
  // whatever ground it strikes and stops there, so only surfaces facing the blast light up and anything
  // behind a ridge stays in shadow. Water lets light through and glints a little.
  const DEPTH = [1, 1, 0.92, 0.82, 0.7, 0.58, 0.46, 0.34, 0.22, 0.12];
  function castLights() {
    if (!lights.length) { if (lumUsed) { lum.fill(0); lumUsed = false; } return; }
    lum.fill(0); lumUsed = true;
    for (let i = 0; i < lights.length; i++) {
      const L = lights[i], f = 1 - L.t / L.dur, a = f * Math.sqrt(f) * 255 * L.k, R = L.r, pen = L.pen || 10, n = Math.ceil(6.283 * R * (R > 160 ? 0.9 : 1.2));
      for (let k = 0; k < n; k++) {
        const ang = k / n * 6.283, dx = Math.cos(ang), dy = Math.sin(ang); let x = L.x + 0.5, y = L.y + 0.5, depth = 0;
        for (let d = 1; d < R; d++) {
          x += dx; y += dy; const ix = Math.floor(x), iy = Math.floor(y);
          if (ix < 0 || ix >= W || iy >= H) break; if (iy < 0) continue;
          const m = G[iy * W + ix] & 7;
          if (m === AIR) { if (depth) break; continue; }
          let v = Math.min(255, a * 1.5 * (1 - d / R));
          if (m === WATER || m === FIRE) v *= 0.3; else v *= DEPTH[(depth++ * 10 / pen) | 0];
          const vx = ix - camXi, vy = iy - camYi;
          if (vx >= 0 && vx < VW && vy >= 0 && vy < VH) { const j = vy * VW + vx; if (lum[j] < v) lum[j] = v; }
          if (depth >= pen) break;
        }
      }
    }
  }
  function drawTerrain() {
    castLights();
    let p = 0; const x0 = Math.max(0, -camXi), x1 = Math.min(VW, W - camXi);
    for (let vy = 0; vy < VH; vy++) {
      const wy = vy + camYi;
      if (wy < 0 || wy >= H || x1 <= x0) { buf.fill(0, p, p + VW); p += VW; continue; }
      const row = wy * W + camXi;
      if (x0 > 0) buf.fill(0, p, p + x0);
      for (let vx = x0; vx < x1; vx++) {
        const c = G[row + vx];
        let col = c === 0 ? 0 : ((c & 7) === WATER && (wy === 0 || G[row + vx - W] === 0)) ? WSURF : (c & 7) === FIRE ? PAL[FIRE | Math.min(7, (c >> 3) + (((vx * 7 + wy * 3 + (tickN >> 1)) & 3) === 0 ? 2 : 0)) << 3] : PAL[c];
        if (lumUsed && col !== 0) {
          const l = lum[p + vx] & 0xf0;                                  // stepped, to keep the pixel look
          if (l) { const r = col & 255, g = col >> 8 & 255, b = col >> 16 & 255; col = ((col & 0xff000000) | (b + ((Math.max(b, 170) - b) * l >> 8)) << 16 | (g + ((235 - g) * l >> 8)) << 8 | (r + ((255 - r) * l >> 8))) >>> 0; }
        }
        buf[p + vx] = col;
      }
      if (x1 < VW) buf.fill(0, p + x1, p + VW);
      p += VW;
    }
    tctx.putImageData(img, 0, 0); cx.drawImage(tcv, 0, 0);
  }
  function draw() {
    camXi = Math.round(camX + (shake ? (rnd() - 0.5) * shake : 0)); camYi = Math.round(camY + (shake ? (rnd() - 0.5) * shake : 0));
    cx.drawImage(sky, 0, 0);
    if (skyFlash > 0) { cx.fillStyle = 'rgba(220,230,255,' + (skyFlash * 0.55).toFixed(3) + ')'; cx.fillRect(0, 0, VW, VH); }
    for (let i = 0; i < clouds.length; i++) cx.drawImage(clouds[i].c, Math.round(clouds[i].x), clouds[i].y - Math.round((camY - (H - VH)) * 0.15));
    for (let i = 0; i < hills.length; i++) { const h = hills[i]; cx.drawImage(h.c, -Math.round(clamp(camX * h.par + 40, 0, 260)), -Math.round((camY - (H - VH)) * h.par)); }
    for (let i = 0; i < ufos.length; i++) {                               // in the sky, behind the ground
      const u = ufos[i], x = Math.round(u.x), y = Math.round(u.y), w = u.big ? 9 : 6, bl = (tickN >> 3);
      cx.fillStyle = '#141226'; cx.fillRect(x - w - 1, y - 1, w * 2 + 3, 4); cx.fillRect(x - 3, y - 5, 7, 5);
      cx.fillStyle = '#4ff0ff'; cx.fillRect(x - 2, y - 4, 5, 3); cx.fillStyle = '#c8fbff'; cx.fillRect(x - 2, y - 4, 2, 1);
      cx.fillStyle = '#9aa3b4'; cx.fillRect(x - w, y, w * 2 + 1, 2); cx.fillStyle = '#d8dce8'; cx.fillRect(x - w + 1, y, w * 2 - 1, 1);
      for (let k = -w + 1; k < w; k += 3) { cx.fillStyle = ((k + bl) % 3 + 3) % 3 === 0 ? '#ffe14f' : ((k + bl) % 3 + 3) % 3 === 1 ? '#ff4fd8' : '#7dff5a'; cx.fillRect(x + k, y + 1, 1, 1); }
      if ((bl & 3) === 0) { cx.fillStyle = 'rgba(79,240,255,.35)'; cx.fillRect(x - 1, y + 3, 3, 2); }
    }
    for (let i = 0; i < tanks.length; i++) if (tanks[i].alive) drawTank(tanks[i]);
    drawTerrain();
    if (VW > W) { cx.fillStyle = 'rgba(12,10,30,.55)'; cx.fillRect(0, 0, -camXi, VH); cx.fillRect(W - camXi, 0, VW - (W - camXi), VH); }
    for (let i = 0; i < smokes.length; i++) {
      const m = smokes[i]; if (m.wait > 0) continue;
      const p = 1 - m.life / m.max, x = Math.round(m.x) - camXi, y = Math.round(m.y) - camYi;
      disc(x, y, m.r * (0.55 + p * 0.9), m.col ? m.col : m.hot && p < 0.12 ? '#ff9a3c' : m.hot && p < 0.22 ? '#8a4a50' : p < 0.55 ? '#4e4660' : '#6a6480', p < 0.3 ? 0 : p < 0.65 ? 1 + ((x + y) & 1) : 3);
    }
    for (let i = 0; i < grains.length; i++) { const g = grains[i], c = PAL[g.c & 63]; cx.fillStyle = 'rgb(' + (c & 255) + ',' + (c >> 8 & 255) + ',' + (c >> 16 & 255) + ')'; cx.fillRect((g.x | 0) - camXi, (g.y | 0) - camYi, 1, 1); }
    for (let i = 0; i < sparks.length; i++) { const p = sparks[i]; cx.fillStyle = p.hot ? HEAT[Math.min(4, (p.life / p.max * 5) | 0)] : p.col; cx.fillRect((p.x | 0) - camXi, (p.y | 0) - camYi, 1, 1); }
    for (let i = 0; i < shots.length; i++) {
      const s = shots[i], x = Math.round(s.x) - camXi, y = Math.round(s.y) - camYi, big = s.w.r > 18 || s.roll;
      if (s.w.drone && y >= 2) {
        cx.fillStyle = '#141226'; cx.fillRect(x - 3, y - 2, 7, 4); cx.fillStyle = '#8a88a0'; cx.fillRect(x - 2, y - 1, 5, 2);
        cx.fillStyle = (tickN >> 2) & 1 ? '#ff4f4f' : (s.own ? s.own.team.lite : '#fff3c4'); cx.fillRect(x + (s.vx < 0 ? -2 : 2), y - 1, 1, 1);
        cx.fillStyle = '#d8d2e8'; cx.fillRect(x - ((tickN & 1) ? 4 : 2), y - 3, (tickN & 1) ? 9 : 5, 1); continue;
      }
      if (s.w.disco && y >= 2) { cx.fillStyle = '#141226'; cx.fillRect(x - 1, y - 1, 3, 3); cx.fillStyle = NEON[((s.hue || 0) + (tickN >> 2)) % NEON.length]; cx.fillRect(x, y, 1, 1); if (tickN % 3 === 0) sparks.push({ x: s.x, y: s.y, vx: 0, vy: 0, life: 0.3, col: NEON[((s.hue || 0) + (tickN >> 2)) % NEON.length], g: 0.1 }); continue; }
      if (s.roll) { cx.fillStyle = '#141226'; cx.fillRect(x - 2, y - 3, 5, 5); cx.fillStyle = '#8a88a0'; cx.fillRect(x - 1, y - 2, 3, 3); const q = (s.roll.dist >> 1) & 3; cx.fillStyle = '#fff3c4'; cx.fillRect(x - 1 + (q === 1 || q === 2 ? 2 : 0), y - 2 + (q > 1 ? 2 : 0), 1, 1); continue; }
      if (y < 2) { cx.fillStyle = '#fff3c4'; const ax = clamp(x, 4, VW - 5); cx.fillRect(ax, 3, 1, 1); cx.fillRect(ax - 1, 4, 3, 1); cx.fillRect(ax - 2, 5, 5, 1); digits(String(Math.min(999, Math.round(-(s.y - camYi)))), ax, 9, '#fff3c4'); continue; }
      cx.fillStyle = '#141226'; cx.fillRect(x - 1 - (big ? 1 : 0), y - 1 - (big ? 1 : 0), big ? 4 : 3, big ? 4 : 3);
      cx.fillStyle = s.w.fill === WATER ? '#bfe6ff' : s.w.fill ? '#c98a4a' : s.w.mud ? '#8a7a5a' : '#fff3c4'; cx.fillRect(x - (big ? 1 : 0), y - (big ? 1 : 0), big ? 2 : 1, big ? 2 : 1);
    }
    for (let i = 0; i < booms.length; i++) {
      const b = booms[i], p = b.t / (b.dur || 0.55), x = Math.round(b.x) - camXi, y = Math.round(b.y) - camYi, r = b.r * Math.min(1, p / 0.22);
      if (b.kind === 'fire') {
        if (p < 0.7) disc(x, y, r, p < 0.45 ? '#d8483e' : '#5a4660', p < 0.45 ? 0 : 2);
        if (p < 0.5) disc(x, y, r * 0.78, '#ff9a3c', p > 0.38 ? 1 : 0);
        if (p < 0.34) disc(x, y, r * 0.52, '#ffe27a');
        if (p < 0.18) disc(x, y, r * 0.3, '#ffffff');
      } else if (b.kind === 'nuke') {
        const R0 = b.r, rr = R0 * (0.45 + 0.55 * Math.min(1, p / 0.45)), rise = p > 0.45 ? Math.round((p - 0.45) * R0 * 0.9) : 0, fl = ((b.t * 30) | 0) & 1;
        if (p < 0.07) disc(x, y, R0 * 1.7, '#ffffff', 1 + fl);
        if (p < 0.85) disc(x, y - rise, rr * (p > 0.6 ? 1 - (p - 0.6) * 1.2 : 1), p < 0.5 ? '#d8483e' : '#7a2430', p < 0.6 ? 0 : p < 0.74 ? 1 + fl : 3);
        if (p < 0.64) disc(x, y - rise, rr * 0.8, '#ff9a3c', p > 0.52 ? 1 + fl : 0);
        if (p < 0.48) disc(x, y - rise, rr * 0.6, '#ffe27a', p > 0.4 ? 1 + fl : 0);
        if (p < 0.34) disc(x, y, rr * (p < 0.1 ? 0.9 : 0.4), '#ffffff');
        const q = p / 0.6;
        if (q < 1) {                                                      // the shock ring
          const ring = R0 * (0.6 + 2.8 * q), n = Math.ceil(ring * 6.283); cx.fillStyle = q < 0.45 ? '#ffffff' : '#d8d2e8';
          for (let k = 0; k < n; k++) { if (q > 0.5 && (k & 1)) continue; if (q > 0.8 && (k & 2)) continue; const a = k / n * 6.283, px = Math.round(x + Math.cos(a) * ring), py = Math.round(y + Math.sin(a) * ring); cx.fillRect(px, py, q < 0.3 ? 2 : 1, q < 0.3 ? 2 : 1); }
        }
      } else if (b.kind === 'disco') {
        if (p < 0.75) disc(x, y, r, ((b.t * 24) | 0) & 1 ? b.col2 : b.col, p < 0.4 ? 0 : 1 + ((b.t * 30) & 1));
        if (p < 0.35) disc(x, y, r * 0.5, '#ffffff');
      } else if (p < 0.5) disc(x, y, r, b.kind === 'water' ? '#bfe6ff' : b.kind === 'mud' ? '#8a7a5a' : '#d0a070', 1 + ((b.t * 30) & 1));
    }
    for (let i = 0; i < bullets.length; i++) { const b = bullets[i], x = Math.round(b.x) - camXi, y = Math.round(b.y) - camYi; cx.fillStyle = '#ffe27a'; cx.fillRect(x, y, 1, 1); cx.fillStyle = '#ff9a3c'; cx.fillRect(Math.round(b.x - b.vx * 0.006) - camXi, Math.round(b.y - b.vy * 0.006) - camYi, 1, 1); }
    for (let i = 0; i < tanks.length; i++) {                              // tracer beacons: a blinking marker where the tracer came down
      const t = tanks[i], B = t.beacon; if (!B || !t.alive) continue;
      const x = B.x - camXi, y = B.y - camYi, on = ((time * 4) | 0) & 1;
      cx.fillStyle = '#141226'; cx.fillRect(x - 2, y - 6, 5, 5); cx.fillStyle = on ? '#ffffff' : t.team.lite; cx.fillRect(x - 1, y - 5, 3, 3); cx.fillStyle = t.team.main; cx.fillRect(x, y - 1, 1, 2);
      if (on) { cx.fillStyle = t.team.lite; for (let k = 9; k < 30; k += 4) cx.fillRect(x, y - k, 1, 2); }
    }
    for (let i = 0; i < mines.length; i++) {
      const m = mines[i], x = m.x - camXi, y = m.y - camYi;
      cx.fillStyle = '#141226'; cx.fillRect(x - 2, y - 2, 5, 3); cx.fillStyle = '#5d6472'; cx.fillRect(x - 1, y - 1, 3, 1);
      cx.fillStyle = m.fuse >= 0 || (m.t > 1 && ((time * 2.5) | 0) & 1) ? '#ff4f4f' : m.own ? m.own.team.main : '#8a88a0'; cx.fillRect(x, y - 2, 1, 1);
    }
    for (let i = 0; i < planes.length; i++) { const P = planes[i]; cx.drawImage(planeSprite(P.dir), Math.round(P.x) - 12 - camXi, Math.round(P.y) - 4 - camYi); }
    for (let i = 0; i < strikes.length; i++) {
      const k = strikes[i], x = Math.round(k.x) - camXi, gy = Math.round(k.gy || groundAt(k.x)) - camYi, fl = ((k.t * 30) | 0) & 1;
      if (k.kind === 'rod') {
        if (!k.go) { cx.fillStyle = fl ? '#ffe14f' : '#fff3c4'; for (let y = (tickN & 3); y < gy; y += 6) cx.fillRect(x, y, 1, 2); }
        else { const ry = Math.round(k.ry) - camYi; cx.fillStyle = '#ff9a3c'; cx.fillRect(x - 2, ry - 110, 5, 110); cx.fillStyle = '#ffe27a'; cx.fillRect(x - 1, ry - 70, 3, 70); cx.fillStyle = '#141226'; cx.fillRect(x - 2, ry - 36, 5, 38); cx.fillStyle = '#ffffff'; cx.fillRect(x - 1, ry - 35, 3, 36); }
      } else if (k.kind === 'ion') {
        if (!k.go) { cx.fillStyle = fl ? '#4ff0ff' : '#ffffff'; cx.fillRect(x, 0, 1, gy); if (k.t > 0.5) { cx.fillRect(x - 6, 0, 1, gy); cx.fillRect(x + 6, 0, 1, gy); } }
        else {
          const w = 15 - (fl ? 1 : 0);
          for (let dx = -w - 3; dx <= w + 3; dx++) { const a = Math.abs(dx); if (a > w && ((dx + tickN) & 1)) continue; cx.fillStyle = a < 5 ? '#ffffff' : a < 10 ? '#c8fbff' : a <= w ? '#4ff0ff' : '#2a8fd8'; cx.fillRect(x + dx, 0, 1, gy + 3 - (a >> 2)); }
          disc(x, gy, 9 + (fl ? 2 : 0), '#ffffff'); disc(x, gy, 15, '#c8fbff', 1 + fl);
        }
      }
    }
    for (let i = 0; i < balls.length; i++) {
      const B = balls[i], x = Math.round(B.x) - camXi, y = Math.round(B.y) - camYi, sp = tickN >> 2;
      if (B.t >= 0.8) for (let k = 0; k < 6; k++) {                        // spinning rays
        const a = k * 1.047 + time * 2.4; cx.fillStyle = NEON[(k + sp) % NEON.length];
        for (let d = 8; d < 46; d += 3) if ((d + sp) & 1) cx.fillRect(Math.round(x + Math.cos(a) * d), Math.round(y + Math.sin(a) * d), 1, 1);
      }
      disc(x, y, 5, '#141226'); disc(x, y, 4, '#8a94a6');
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { if (dx * dx + dy * dy > 10) continue; const q = (dx + dy * 2 + sp) % 5; if (((dx + sp) & 1) === (dy & 1)) { cx.fillStyle = q === 0 ? '#ffffff' : q === 2 ? NEON[(dx + dy + sp + 12) % NEON.length] : '#c8d0e0'; cx.fillRect(x + dx, y + dy, 1, 1); } }
      cx.fillStyle = '#ffffff'; cx.fillRect(x - 2, y - 2, 1, 1);
    }
    for (let i = 0; i < cones.length; i++) {
      const k = cones[i], p = k.t / 0.32, x0 = Math.round(k.x) - camXi, y0 = Math.round(k.y) - camYi, L = k.L * Math.min(1, p / 0.25 + 0.3);
      for (let d = 1; d <= L; d++) { const hw = 3 + d * 0.42; for (let q = -hw; q <= hw; q++) { const px = Math.round(x0 + k.c * d - k.s * q * -1 * 0 + q * k.s), py = Math.round(y0 - k.s * d + q * k.c); if (p > 0.45 && ((px + py + tickN) & 1)) continue; if (p > 0.75 && (px & 1)) continue; cx.fillStyle = Math.abs(q) < hw * 0.35 ? '#ffffff' : Math.abs(q) < hw * 0.7 ? '#c8fbff' : ((d + tickN) & 3) ? '#4ff0ff' : '#ff4fd8'; cx.fillRect(px, py, 1, 1); } }
    }
    for (let i = 0; i < beams.length; i++) {
      const b = beams[i], p = b.t / 0.35;
      if (p < 0.6) line(b.x0 - camXi, b.y0 - camYi, b.x1 - camXi, b.y1 - camYi, p < 0.3 ? '#ffe27a' : '#ff9a3c', p < 0.45);
      if (p < 0.4 || ((b.t * 60) | 0) & 1) line(b.x0 - camXi, b.y0 - camYi, b.x1 - camXi, b.y1 - camYi, p < 0.5 ? '#ffffff' : '#ffe27a', false);
    }
    if (cur >= 0 && tanks[cur] && tanks[cur].trace && (state === 'aim' || state === 'flight')) {   // the last tracer's path
      const tr = tanks[cur].trace; cx.fillStyle = tanks[cur].team.lite;
      for (let k = 0; k < tr.length; k += 2) if ((k & 2) === 0 || k > tr.length - 8) cx.fillRect(tr[k] - camXi, tr[k + 1] - camYi, 1, 1);
    }
    // aim guide and turn marker
    if (state === 'aim' && cur >= 0) {
      const t = tanks[cur], x = t.x - camXi, y = t.y - camYi, bob = Math.round(Math.sin(time * 6));
      cx.fillStyle = '#141226'; cx.fillRect(x - 3, y - 21 + bob, 7, 3); cx.fillRect(x - 2, y - 18 + bob, 5, 2); cx.fillRect(x - 1, y - 16 + bob, 3, 2);
      cx.fillStyle = t.team.lite; cx.fillRect(x - 2, y - 20 + bob, 5, 1); cx.fillRect(x - 1, y - 19 + bob, 3, 2); cx.fillRect(x, y - 17 + bob, 1, 2);
      if (!t.cpu) {
        const m = muzzle(t), v = speedOf(t.p); let px = m.x, py = m.y, vx = m.c * v, vy = -m.s * v;
        const beam = WEAPONS[t.w].beam || WEAPONS[t.w].cone; if (WEAPONS[t.w].gun) { const v2 = speedOf(100); vx = m.c * v2; vy = -m.s * v2; }
        for (let k = 1; k <= 30; k++) { if (beam) { vx = m.c * 110; vy = -m.s * 110; } else { vy += GRAV * DT; vx += wind * WIND_K * DT; } px += vx * DT; py += vy * DT; if (k % 5 === 0) { cx.fillStyle = k % 10 ? 'rgba(255,243,196,.55)' : '#fff3c4'; cx.fillRect(Math.round(px) - camXi, Math.round(py) - camYi, 1, 1); } }
      }
    }
    drawWeather();
    for (let i = 0; i < floats.length; i++) { const f = floats[i]; digits('-' + f.n, f.x - camXi, f.y - camYi - f.t * 14, f.t > 1 && ((f.t * 20) | 0) & 1 ? '#141226' : f.col); }
  }

  // ---------- HUD ----------
  function el(id) { return document.getElementById(id); }
  let hudDirty = true;
  function banner(text, col) { const b = el('banner'); b.textContent = text; b.style.color = col || ''; b.classList.add('on'); bannerT = 1.6; }
  function buildTankHud() {
    el('tanks').innerHTML = tanks.map(function (t, i) {
      return '<div class="tk" id="tk' + i + '"><i style="background:' + t.team.main + '"></i><span>' + t.team.name + (t.cpu ? '<em> CPU</em>' : '') + '</span><div class="hp"><b style="background:' + t.team.main + '"></b></div></div>';
    }).join('');
  }
  function drawHud() {
    if (!hudDirty) return; hudDirty = false;
    document.body.className = 'mode-' + (state === 'menu' || state === 'over' ? state : 'play') + (paused ? ' paused' : '');
    if (state === 'menu') return;
    tanks.forEach(function (t, i) { const e = el('tk' + i); if (!e) return; e.className = 'tk' + (t.alive ? '' : ' dead') + (i === cur && state !== 'over' ? ' cur' : ''); e.querySelector('.hp b').style.width = t.hp + '%'; });
    const t = tanks[cur]; if (!t) return;
    const mine = state === 'aim' && !t.cpu;
    el('ctl').classList.toggle('off', !mine);
    el('v-ang').textContent = (t.a > 90 ? '◄' : '') + String(t.a > 90 ? 180 - t.a : t.a) + (t.a < 90 ? '►' : '');
    el('v-pow').textContent = String(t.p);
    el('w-name').textContent = WEAPONS[t.w].name; el('w-ammo').textContent = t.ammo[t.w] === Infinity ? '∞' : 'x' + t.ammo[t.w];
    el('wind').innerHTML = 'WIND <b>' + (wind < 0 ? '◄ ' : '') + Math.abs(wind) + (wind > 0 ? ' ►' : '') + '</b>';
  }

  // ---------- weapon picker ----------
  let picking = false;
  function closePicker() { if (picking) { picking = false; el('picker').hidden = true; } }
  function openPicker() {
    if (state !== 'aim' || paused || tanks[cur].cpu) return; const t = tanks[cur];
    el('picker').innerHTML = WEAPONS.map(function (w, i) { return '<button class="wp' + (i === t.w ? ' sel' : '') + '" data-w="' + i + '"' + (t.ammo[i] > 0 ? '' : ' disabled') + '><span>' + w.name + '</span><b>' + (t.ammo[i] === Infinity ? '\u221E' : t.ammo[i]) + '</b></button>'; }).join('');
    picking = true; el('picker').hidden = false; snd('ui');
  }
  el('picker').addEventListener('click', function (e) {
    const b = e.target.closest('[data-w]'); if (!b || state !== 'aim') return; const t = tanks[cur], i = +b.getAttribute('data-w');
    if (t.cpu || !(t.ammo[i] > 0)) return; t.w = i; hudDirty = true; snd('weapon'); closePicker();
  });

  // ---------- menu ----------
  const MODES = ['OFF', 'HUMAN', 'CPU'];
  const OPTS = {
    walls: { label: 'WALLS', vals: ['out', 'rubber', 'spring', 'wrap', 'random'], names: { out: 'OPEN', rubber: 'RUBBER', spring: 'SPRING', wrap: 'WRAP', random: 'RANDOM' } },
    grav: { label: 'GRAVITY', vals: ['auto', '0.1', '0.25', '0.5', '0.75', '1', '1.25', '1.5', '2'], names: { auto: 'AUTO' } },
    biome: { label: 'BIOME', vals: ['random', 'grass', 'snow', 'jungle', 'mountain', 'mars', 'moon', 'beach', 'desert', 'rainy', 'thunder'], names: { random: 'RANDOM' } }
  };
  function optName(k) { const o = OPTS[k], v = opts[k]; return o.names[v] || (k === 'grav' ? Math.round(v * 100) + '%' : BIOMES[v].name); }
  function drawSetup() {
    el('opts').innerHTML = Object.keys(OPTS).map(function (k) { return '<button class="slot opt" data-opt="' + k + '"><span>' + OPTS[k].label + '</span><b>' + optName(k) + '</b></button>'; }).join('');
    el('slots').innerHTML = TEAMS.map(function (t, i) { return '<button class="slot m' + setup[i] + '" data-slot="' + i + '"><i style="background:' + t.main + '"></i><span>' + t.name + '</span><b>' + MODES[setup[i]] + '</b></button>'; }).join('');
    const n = setup.filter(Boolean).length; el('btn-start').disabled = n < 2;
    el('setup-note').textContent = n < 2 ? 'Pick at least two tanks.' : setup.filter(function (v) { return v === 1; }).length > 1 ? 'Hot-seat: pass the device between shots.' : ' ';
  }
  function show(id) { ['menu', 'over', 'pause'].forEach(function (k) { el('card-' + k).hidden = k !== id; }); }
  function toMenu() { amb(true); state = 'menu'; paused = false; cur = -1; tanks = []; shots = []; hudDirty = true; drawSetup(); show('menu'); snapCam(); }
  function start() { store('ffe-setup', JSON.stringify(setup)); show(null); newMatch(); }
  function setPause(on) { if (state === 'menu' || state === 'over') return; paused = on; closePicker(); if (on && AU) { AU.whistle(null); AU.burn(0); } amb(on); hudDirty = true; show(on ? 'pause' : null); }

  // ---------- input ----------
  el('slots').addEventListener('click', function (e) { const b = e.target.closest('[data-slot]'); if (!b) return; const i = +b.getAttribute('data-slot'); setup[i] = (setup[i] + 1) % 3; drawSetup(); snd('ui'); });
  function drawSound() { const b = document.querySelectorAll('[data-snd]'), on = !AU || AU.get(); for (let i = 0; i < b.length; i++) { b[i].textContent = 'SOUND ' + (on ? 'ON' : 'OFF'); b[i].setAttribute('aria-pressed', on ? 'true' : 'false'); } }
  function toggleSound() { if (!AU) return; AU.unlock(); AU.set(!AU.get()); drawSound(); snd('ui'); }
  Array.prototype.forEach.call(document.querySelectorAll('[data-snd]'), function (b) { b.addEventListener('click', toggleSound); });
  ['pointerdown', 'keydown', 'touchend'].forEach(function (ev) { document.addEventListener(ev, function () { if (AU) AU.unlock(); }, true); });
  drawSound();
  el('opts').addEventListener('click', function (e) { const b = e.target.closest('[data-opt]'); if (!b) return; const k = b.getAttribute('data-opt'), v = OPTS[k].vals; opts[k] = v[(v.indexOf(opts[k]) + 1) % v.length]; store('ffe-opts', JSON.stringify(opts)); drawSetup(); snd('ui'); });
  el('btn-start').addEventListener('click', start);
  el('btn-again').addEventListener('click', start);
  el('btn-setup').addEventListener('click', toMenu);
  el('btn-menu').addEventListener('click', function () { setPause(true); });
  el('btn-resume').addEventListener('click', function () { setPause(false); });
  el('btn-quit').addEventListener('click', toMenu);
  el('fire').addEventListener('click', function () { if (state === 'aim' && !tanks[cur].cpu) fire(); });
  el('wpn').addEventListener('click', function () { if (picking) closePicker(); else openPicker(); });
  Array.prototype.forEach.call(document.querySelectorAll('[data-k]'), function (b) {
    const k = b.getAttribute('data-k');
    b.addEventListener('pointerdown', function (e) { e.preventDefault(); nudge(k, 1); held[k] = { t: 0, acc: 0 }; try { b.setPointerCapture(e.pointerId); } catch (err) { /* older browsers */ } });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (ev) { b.addEventListener(ev, function () { delete held[k]; }); });
  });
  const KEYS = { ArrowLeft: 'al', ArrowRight: 'ar', ArrowUp: 'pu', ArrowDown: 'pd' };
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') { if (state !== 'menu' && state !== 'over') setPause(!paused); return; }
    if (e.key === 'm' || e.key === 'M') { toggleSound(); return; }
    if (state === 'menu') { if (e.key === 'Enter' && !el('btn-start').disabled) start(); return; }
    if (state === 'over') { if (e.key === 'Enter') start(); return; }
    const k = KEYS[e.key];
    if (k) { e.preventDefault(); if (!held[k]) { nudge(k, 1); held[k] = { t: 0, acc: 0 }; } }
    else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (!e.repeat && state === 'aim' && !tanks[cur].cpu) fire(); }
    else if (e.key === 'q' || e.key === 'Q') cycleWeapon(-1);
    else if (e.key === 'e' || e.key === 'E' || e.key === 'Tab') { e.preventDefault(); cycleWeapon(1); }
  });
  document.addEventListener('keyup', function (e) { const k = KEYS[e.key]; if (k) delete held[k]; });
  // drag anywhere on the field: sideways swings the barrel, up and down sets the power
  let drag = null;
  cv.addEventListener('pointerdown', function (e) { closePicker(); if (state !== 'aim' || paused || tanks[cur].cpu) return; drag = { id: e.pointerId, x: e.clientX, y: e.clientY, ax: 0, ay: 0 }; try { cv.setPointerCapture(e.pointerId); } catch (err) { /* older browsers */ } });
  cv.addEventListener('pointermove', function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    drag.ax += (e.clientX - drag.x) * 0.45; drag.ay += (e.clientY - drag.y) * 0.4; drag.x = e.clientX; drag.y = e.clientY;
    const da = drag.ax | 0, dp = drag.ay | 0; drag.ax -= da; drag.ay -= dp;
    if (da) nudge(da > 0 ? 'ar' : 'al', Math.abs(da)); if (dp) nudge(dp > 0 ? 'pd' : 'pu', Math.abs(dp));
  });
  ['pointerup', 'pointercancel'].forEach(function (ev) { cv.addEventListener(ev, function () { drag = null; }); });
  // no zooming or scrolling the page out from under the game
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (ev) { document.addEventListener(ev, function (e) { e.preventDefault(); }, { passive: false }); });
  document.addEventListener('touchmove', function (e) { if (e.cancelable) e.preventDefault(); }, { passive: false });
  document.addEventListener('dblclick', function (e) { e.preventDefault(); });
  document.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  document.addEventListener('visibilitychange', function () { if (document.hidden && state !== 'menu' && state !== 'over') setPause(true); });
  window.addEventListener('resize', layout);

  // ---------- main loop ----------
  let last = 0, acc = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000 || 0); last = now;
    if (!paused) { acc += dt; let n = 0; while (acc >= DT && n < 3) { step(); acc -= DT; n++; } if (acc > DT) acc = 0; }
    draw(); drawHud();
  }

  layout(); generate(20261128); drawSetup(); show('menu'); snapCam();
  requestAnimationFrame(frame);
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(function () { /* offline play is optional */ });

  // test hook
  window.FFE = {
    get state() { return state; }, get tanks() { return tanks; }, get cur() { return cur; }, get wind() { return wind; }, set wind(v) { wind = v; },
    get moves() { return moves; }, get fireN() { return fireN; }, get bullets() { return bullets; }, get mines() { return mines; }, get strikes() { return strikes; }, get planes() { return planes; }, get balls() { return balls; }, get grains() { return grains; }, get shots() { return shots; }, get W() { return W; }, H: H, get G() { return G; },
    get view() { return { S: S, VW: VW, VH: VH, camX: camX, camY: camY }; },
    start: start, fire: fire, burst: burst, get env() { return ENV; }, get opts() { return opts; }, get wall() { return WALL; }, get grav() { return GRAV; }, lightning: lightning, get meteors() { return meteors; }, get ufos() { return ufos; }, get lum() { return lum; }, get lights() { return lights; }, get fx() { return { sparks: sparks.length, smokes: smokes.length, lights: lights.length }; }, tick: tick, step: step, WEAPONS: WEAPONS, setup: setup, simShot: simShot,
    count: function () { const n = [0, 0, 0, 0, 0, 0, 0, 0]; for (let i = 0; i < G.length; i++) n[G[i] & 7]++; return n; }
  };
})();
