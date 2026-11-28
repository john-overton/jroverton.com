/*
 * Fire for Effect — sound effects, synthesised with Web Audio (no audio files).
 * window.FFEAudio = { unlock, sfx(name, arg), whistle(vy | null), set(on), get() }
 */
(function () {
  'use strict';
  const AC = window.AudioContext || window.webkitAudioContext;
  const KEY = 'ffe-sfx';
  let meter = null, ctx = null, out = null, noiseBuf = null, on = true, wh = null, fr = null, am = null, amKind = null, lastTick = 0, lastSteam = 0, lastHit = 0;
  try { on = localStorage.getItem(KEY) !== '0'; } catch (e) { /* private mode */ }

  function boot() {
    if (ctx || !AC) return;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6; comp.attack.value = 0.003; comp.release.value = 0.2;
    out = ctx.createGain(); out.gain.value = on ? 0.9 : 0; out.connect(comp); comp.connect(ctx.destination);
    const an = ctx.createAnalyser(); an.fftSize = 2048; comp.connect(an); const md = new Float32Array(2048);
    meter = function () { an.getFloatTimeDomainData(md); let m = 0; for (let i = 0; i < md.length; i++) m = Math.max(m, Math.abs(md[i])); return m; };
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  // iPhone and iPad mute Web Audio when the ring/silent switch is on silent, because the page counts as
  // "ambient" sound. Media playback is not muted, so two things move the page into that category:
  // the Audio Session API where Safari has it, and otherwise a silent <audio> loop kept playing
  // alongside the game. Both have to start from a tap.
  const IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let keep = null;
  function silentWav() {
    const n = 4000, b = new Uint8Array(44 + n), v = new DataView(b.buffer), put = function (o, t) { for (let i = 0; i < t.length; i++) b[o + i] = t.charCodeAt(i); };
    put(0, 'RIFF'); v.setUint32(4, 36 + n, true); put(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); put(36, 'data'); v.setUint32(40, n, true);
    b.fill(128, 44); return URL.createObjectURL(new Blob([b], { type: 'audio/wav' }));
  }
  function playback(want) {
    try { if (navigator.audioSession) navigator.audioSession.type = want ? 'playback' : 'auto'; } catch (e) { /* older Safari */ }
    if (!IOS) return;
    if (want) {
      if (!keep) { keep = document.createElement('audio'); keep.src = silentWav(); keep.loop = true; keep.preload = 'auto'; keep.setAttribute('playsinline', ''); keep.setAttribute('x-webkit-airplay', 'deny'); keep.disableRemotePlayback = true; }
      if (keep.paused) { const pr = keep.play(); if (pr && pr.catch) pr.catch(function () { /* needs a tap */ }); }
    } else if (keep && !keep.paused) keep.pause();
  }
  // iOS can leave a context 'interrupted' or silently dead after a call, the app switcher or a screen lock.
  // If it did not come back after the last attempt to resume it, throw it away and build a fresh one on this tap.
  let lastTry = 0;
  function unlock() {
    const now = Date.now();
    if (ctx && ctx.state !== 'running' && lastTry && now - lastTry > 400) {
      try { ctx.close(); } catch (e) { /* already closed */ }
      ctx = null; out = null; wh = null; fr = null; am = null; meter = null;
    }
    boot();
    if (on && !document.hidden) playback(true);
    if (ctx && ctx.state !== 'running') { lastTry = now; ctx.resume().catch(function () { /* needs a gesture */ }); } else lastTry = 0;
  }
  document.addEventListener('visibilitychange', function () { if (document.hidden) { if (keep && !keep.paused) keep.pause(); } else if (ctx && ctx.state !== 'running') ctx.resume().catch(function () { /* next tap */ }); });

  // a pitched voice: type, start/end frequency, length, level
  function tone(type, f0, f1, dur, vol, at, attack) {
    const t = ctx.currentTime + (at || 0), o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + (attack || 0.004)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.02);
  }
  // filtered noise: filter type, start/end cutoff, length, level
  function noise(ftype, f0, f1, dur, vol, at, q, attack) {
    const t = ctx.currentTime + (at || 0), s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; s.loop = true; f.type = ftype; f.Q.value = q || 0.7;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + (attack || 0.004)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(out); s.start(t, Math.random()); s.stop(t + dur + 0.02);
  }

  const FX = {
    fire: function (heavy) { const k = heavy ? 1.5 : 1; noise('lowpass', 2600, 240, 0.22 * k, 0.7); tone('sine', 150 / k, 38, 0.24 * k, 0.9); tone('square', 90, 40, 0.07, 0.25); },
    boom: function (r) {          // r = blast radius, 7 to 21
      r = r || 10; const k = Math.min(1.6, r / 12), d = 0.45 + r * 0.035;
      noise('lowpass', 3200, 70, d, 0.9 * Math.min(1, 0.55 + k * 0.4));
      tone('sine', 110 / k, 26, d * 0.9, 1);
      tone('triangle', 220 / k, 40, 0.12, 0.5);
      noise('bandpass', 900, 300, d * 1.6, 0.16, 0.08, 0.5);                                       // rumble tail
      for (let i = 0; i < 5; i++) noise('highpass', 2500, 5000, 0.04, 0.12, 0.15 + Math.random() * d, 1);   // falling grit
    },
    dirt: function () { noise('lowpass', 700, 120, 0.3, 0.8); tone('sine', 90, 40, 0.2, 0.6); for (let i = 0; i < 9; i++) noise('bandpass', 500 + Math.random() * 900, 400, 0.05, 0.25, 0.08 + i * 0.05 + Math.random() * 0.03, 2); },
    mud: function () { noise('bandpass', 900, 160, 0.35, 0.7, 0, 3); tone('sawtooth', 130, 45, 0.3, 0.3); noise('bandpass', 300, 700, 0.12, 0.4, 0.22, 5); tone('sine', 240, 90, 0.1, 0.3, 0.28); },
    water: function () { noise('bandpass', 700, 2600, 0.5, 0.6, 0, 0.8, 0.03); noise('highpass', 3000, 6000, 0.6, 0.22, 0.05); for (let i = 0; i < 6; i++) tone('sine', 500 + Math.random() * 700, 1400, 0.06, 0.14, 0.1 + i * 0.07 + Math.random() * 0.04); },
    splash: function () { noise('bandpass', 1200, 3000, 0.22, 0.4, 0, 1, 0.01); tone('sine', 420, 900, 0.07, 0.18, 0.03); },
    split: function () { for (let i = 0; i < 5; i++) { noise('highpass', 1800, 3500, 0.05, 0.4, i * 0.035); tone('square', 700 + i * 90, 300, 0.05, 0.12, i * 0.035); } },
    hit: function (n) { const now = ctx.currentTime; if (now - lastHit < 0.07) return; lastHit = now; const v = Math.min(0.5, 0.2 + (n || 10) / 120); tone('square', 520, 500, 0.16, v * 0.5); tone('triangle', 787, 760, 0.22, v); tone('sine', 1310, 1290, 0.3, v * 0.5); },
    death: function () { FX.boom(18); tone('sawtooth', 420, 50, 0.7, 0.3, 0.05); noise('lowpass', 500, 60, 1.2, 0.5, 0.2); },
    thud: function () { tone('sine', 100, 35, 0.16, 0.7); noise('lowpass', 500, 100, 0.12, 0.4); },
    skip: function () { tone('sine', 220, 620, 0.14, 0.4); tone('triangle', 330, 930, 0.1, 0.2, 0.02); },
    roll: function () { noise('lowpass', 260, 120, 0.07, 0.35); tone('sine', 70, 50, 0.06, 0.25); },
    drill: function () { tone('sawtooth', 95 + Math.random() * 30, 70, 0.07, 0.22); noise('bandpass', 1400, 700, 0.06, 0.2, 0, 4); },
    lance: function () { tone('sawtooth', 2400, 180, 0.32, 0.4); tone('square', 1200, 90, 0.36, 0.22); noise('highpass', 5000, 1500, 0.3, 0.4); tone('sine', 90, 40, 0.3, 0.6, 0.04); },
    ignite: function () { noise('bandpass', 300, 2200, 0.5, 0.7, 0, 0.7, 0.05); noise('lowpass', 900, 200, 0.7, 0.4, 0.1); tone('sine', 120, 60, 0.4, 0.4); },
    crackle: function () { noise('highpass', 2000 + Math.random() * 3000, 6000, 0.02 + Math.random() * 0.03, 0.12 + Math.random() * 0.14); },
    steam: function () { const n = ctx.currentTime; if (n - lastSteam < 0.12) return; lastSteam = n; noise('highpass', 3500, 7000, 0.3, 0.14, 0, 0.7, 0.03); },
    dust: function () { noise('lowpass', 600, 60, 0.9, 0.9, 0, 0.7, 0.03); tone('sine', 60, 30, 0.7, 0.7); for (let i = 0; i < 12; i++) noise('bandpass', 400 + Math.random() * 800, 300, 0.05, 0.2, 0.1 + i * 0.06 + Math.random() * 0.03, 2); },
    ping: function () { tone('sine', 1400, 1800, 0.09, 0.2); tone('sine', 2100, 2100, 0.14, 0.08, 0.03); },
    nuke: function (size) {
      const k = size >= 2 ? 1.4 : size >= 1 ? 1 : 0.7;
      noise('lowpass', 500, 40, 2.6 * k, 1, 0, 0.7, 0.02); tone('sine', 62, 20, 2.4 * k, 1); tone('sine', 41, 18, 3 * k, 0.8, 0.1);
      noise('bandpass', 1200, 200, 1.6 * k, 0.3, 0.15, 0.4); for (let i = 0; i < 14; i++) noise('lowpass', 300 + Math.random() * 300, 80, 0.25, 0.3, 0.4 + i * 0.16 * k + Math.random() * 0.1);
    },
    disco: function (n) { const f = [392, 494, 587, 659, 784, 988][(n || 0) % 6] * (1 + ((n / 6) | 0) % 2); noise('lowpass', 2400, 120, 0.3, 0.6); tone('sine', 120, 40, 0.22, 0.7); tone('square', f, f, 0.16, 0.2, 0.02); tone('square', f * 1.5, f * 1.5, 0.2, 0.14, 0.1); tone('triangle', f * 2, f * 2, 0.22, 0.14, 0.18); },
    gun: function () { noise('highpass', 1500, 600, 0.035, 0.3); tone('square', 210, 90, 0.04, 0.18); },
    buzz: function () { tone('sawtooth', 150, 138, 0.12, 0.07); tone('square', 301, 280, 0.12, 0.03); },
    jet: function () { noise('bandpass', 500, 3000, 0.7, 0.7, 0, 0.6, 0.04); noise('highpass', 2500, 5000, 0.8, 0.3, 0.05); tone('sawtooth', 180, 620, 0.6, 0.2); },
    arm: function () { tone('square', 1500, 1500, 0.04, 0.14); tone('square', 2000, 2000, 0.05, 0.14, 0.07); noise('highpass', 3000, 2000, 0.02, 0.2); },
    plasma: function () { noise('bandpass', 2600, 500, 0.4, 0.7, 0, 1.5); tone('sawtooth', 900, 120, 0.4, 0.3); tone('square', 1800, 240, 0.35, 0.14); tone('sine', 80, 45, 0.3, 0.6); },
    canister: function () { noise('lowpass', 1800, 300, 0.1, 0.5); tone('square', 300, 120, 0.08, 0.2); noise('highpass', 4000, 2500, 1.4, 0.12, 0.08, 0.7, 0.1); },
    flyby: function () { noise('bandpass', 300, 1600, 1.3, 0.5, 0, 0.6, 0.6); noise('bandpass', 1600, 250, 1.8, 0.5, 1.25, 0.6, 0.05); tone('sawtooth', 240, 420, 1.3, 0.12, 0, 0.6); tone('sawtooth', 420, 150, 1.8, 0.12, 1.25, 0.05); },
    drop: function () { tone('sine', 1300, 500, 0.5, 0.06); },
    lock: function () { tone('square', 1760, 1760, 0.05, 0.14); },
    rod: function () { noise('highpass', 800, 6000, 0.6, 0.5, 0, 0.7, 0.3); tone('sawtooth', 3000, 200, 0.62, 0.2, 0, 0.3); },
    ioncharge: function () { tone('sine', 160, 2600, 0.9, 0.22, 0, 0.5); tone('square', 80, 1300, 0.9, 0.08, 0, 0.5); },
    ion: function () { tone('sawtooth', 92, 86, 1.7, 0.4, 0, 0.02); tone('square', 1840, 1700, 1.7, 0.08, 0, 0.02); tone('sawtooth', 184, 176, 1.7, 0.2, 0, 0.02); noise('highpass', 4000, 3000, 1.7, 0.35, 0, 0.7, 0.02); noise('lowpass', 300, 80, 2, 0.6, 0, 0.7, 0.02); },
    chime: function () {         // a quick disco run while the ball goes up
      [523, 659, 784, 1047, 1319, 1568, 2093].forEach(function (f, i) { tone('square', f, f, 0.09, 0.13, i * 0.085); tone('triangle', f * 2, f * 2, 0.12, 0.08, i * 0.085); });
      [131, 262, 131, 262].forEach(function (f, i) { tone('sawtooth', f, f, 0.12, 0.16, i * 0.17); }); noise('highpass', 6000, 9000, 0.05, 0.12, 0.17); noise('highpass', 6000, 9000, 0.05, 0.12, 0.51);
    },
    pew: function (n) { const f = [784, 988, 1175, 1319, 1568][(n || 0) % 5]; tone('square', f * 2, f, 0.09, 0.14); noise('highpass', 4000, 2000, 0.04, 0.12); },
    thunder: function (far) { const v = far ? 0.45 : 1; if (!far) { noise('highpass', 1500, 5000, 0.12, 0.8); noise('bandpass', 2500, 400, 0.3, 0.6, 0.02, 0.6); } noise('lowpass', 260, 40, 3.2, 0.9 * v, far ? 0.3 : 0.05, 0.7, 0.05); tone('sine', 58, 24, 2.6, 0.8 * v, far ? 0.3 : 0.05); for (let i = 0; i < 7; i++) noise('lowpass', 180 + Math.random() * 200, 60, 0.3, 0.4 * v, 0.4 + i * 0.3 + Math.random() * 0.2); },
    bounce: function () { tone('sine', 300, 140, 0.16, 0.5); tone('triangle', 600, 240, 0.1, 0.2); },
    spring: function () { tone('sine', 180, 720, 0.22, 0.4); tone('square', 360, 1440, 0.2, 0.1); tone('sine', 900, 500, 0.3, 0.12, 0.05); },
    ufo: function () { for (let i = 0; i < 6; i++) tone('sine', 620 + (i & 1) * 240, 760 - (i & 1) * 200, 0.16, 0.05, i * 0.15); tone('triangle', 1240, 1500, 0.9, 0.025); },
    turn: function () { tone('square', 523, 523, 0.07, 0.16); tone('square', 784, 784, 0.1, 0.16, 0.08); },
    weapon: function () { tone('square', 330, 330, 0.04, 0.14); tone('square', 494, 494, 0.06, 0.14, 0.045); },
    ui: function () { tone('square', 440, 660, 0.06, 0.14); },
    start: function () { [262, 330, 392, 523].forEach(function (f, i) { tone('square', f, f, 0.1, 0.16, i * 0.08); }); },
    win: function () { [392, 523, 659, 784, 659, 784, 1047].forEach(function (f, i) { tone('square', f, f, i === 6 ? 0.5 : 0.12, 0.17, i * 0.12); tone('triangle', f / 2, f / 2, 0.14, 0.2, i * 0.12); }); },
    lose: function () { [392, 330, 262, 196].forEach(function (f, i) { tone('triangle', f, f * 0.97, 0.28, 0.25, i * 0.2); }); },
    tick: function () { const n = ctx.currentTime; if (n - lastTick < 0.04) return; lastTick = n; tone('square', 1200, 1100, 0.012, 0.05); }
  };

  window.FFEAudio = {
    unlock: unlock, state: function () { return ctx ? ctx.state : 'none'; }, level: function () { return meter ? meter() : -1; },
    sfx: function (name, arg) { if (!on || !ctx || ctx.state !== 'running' || !FX[name]) return; try { FX[name](arg); } catch (e) { /* never break the game for a sound */ } },
    // the falling-shell whistle: pass the shell's vertical speed each frame, or null to stop
    whistle: function (vy) {
      if (!ctx || ctx.state !== 'running') return;
      const t = ctx.currentTime;
      if (vy === null || !on) { if (wh) { wh.g.gain.setTargetAtTime(0, t, 0.02); const w = wh; wh = null; setTimeout(function () { try { w.o.stop(); } catch (e) { /* already stopped */ } }, 200); } return; }
      if (!wh) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; g.gain.value = 0; o.connect(g); g.connect(out); o.start(); wh = { o: o, g: g }; }
      wh.o.frequency.setTargetAtTime(Math.max(300, 1500 - vy * 3.2), t, 0.05);
      wh.g.gain.setTargetAtTime(vy > 0 ? Math.min(0.07, vy / 2500) : 0, t, 0.08);
    },
    // the fire bed: pass the number of burning cells each frame (0 stops it)
    burn: function (n) {
      if (!ctx || ctx.state !== 'running') return;
      const t = ctx.currentTime;
      if (!n || !on) { if (fr) { fr.g.gain.setTargetAtTime(0, t, 0.1); const f = fr; fr = null; setTimeout(function () { try { f.s.stop(); } catch (e) { /* already stopped */ } }, 600); } return; }
      if (!fr) { const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noiseBuf; s.loop = true; f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 0.5; g.gain.value = 0; s.connect(f); f.connect(g); g.connect(out); s.start(); fr = { s: s, g: g }; }
      fr.g.gain.setTargetAtTime(Math.min(0.22, 0.04 + n / 900), t, 0.15);
      if (Math.random() < 0.1 * Math.min(1, n / 80)) FX.crackle();
    },
    // the weather bed: 'rain', 'storm', 'wind' or null
    ambient: function (kind) {
      amKind = kind || null;
      if (!ctx || ctx.state !== 'running') return;
      const t = ctx.currentTime;
      if (am) { am.g.gain.setTargetAtTime(0, t, 0.2); const o = am; am = null; setTimeout(function () { try { o.s.stop(); } catch (e) { /* already stopped */ } }, 900); }
      if (!kind || !on) return;
      const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noiseBuf; s.loop = true;
      if (kind === 'wind') { f.type = 'bandpass'; f.frequency.value = 420; f.Q.value = 0.5; } else { f.type = 'highpass'; f.frequency.value = kind === 'storm' ? 1400 : 2200; }
      g.gain.value = 0; g.gain.setTargetAtTime(kind === 'storm' ? 0.13 : kind === 'rain' ? 0.09 : 0.07, t, 0.6);
      s.connect(f); f.connect(g); g.connect(out); s.start(); am = { s: s, g: g };
    },
    set: function (v) { on = !!v; try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) { /* private mode */ } if (out) out.gain.value = on ? 0.9 : 0; if (!on) { this.whistle(null); this.burn(0); const k = amKind; this.ambient(null); amKind = k; playback(false); } else if (ctx) { playback(true); this.ambient(amKind); } },
    get: function () { return on; }
  };
})();
