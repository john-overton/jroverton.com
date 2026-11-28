/*
 * Glade Run audio: three lo-fi songs and every sound effect, synthesised with Web Audio.
 * Nothing is downloaded: the songs are written out below as chords, melodies and drum patterns,
 * and a small sequencer plays them.
 *
 * window.GladeAudio = { unlock, startMusic, stopMusic, duck, pause, resume, sfx, ski, set, get, render, songs }
 */
(function () {
  'use strict';
  const AC = window.AudioContext || window.webkitAudioContext;
  const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function midi(n) { const m = /^([A-G])(#|b)?(\d)$/.exec(n); return 12 * (+m[3] + 1) + SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0); }
  function hz(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  const KINDS = { '': [0, 4, 7], m: [0, 3, 7], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], '7': [0, 4, 7, 10], m9: [0, 3, 7, 10, 14], maj9: [0, 4, 7, 11, 14] };
  function chordOf(name) {                               // 'Fmaj7', 'Dm9', 'E7' -> bass root (around C2) and an electric-piano voicing
    const m = /^([A-G])(#|b)?(.*)$/.exec(name), r = 36 + SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0), iv = KINDS[m[3]];
    const keys = iv.slice(1).map(function (v) { let k = r + 24 + v; while (k > 76) k -= 12; return k; });
    keys.push(r + 24 > 66 ? r + 12 : r + 24);
    return { root: r, keys: keys.sort(function (a, b) { return a - b; }) };
  }

  // ---- the songs -----------------------------------------------------------------------------
  // Lo-fi, slow and swung: seventh chords on an electric piano, a round bass, dusty drums, a
  // sparse lead with an echo, vinyl crackle underneath and a little tape wobble on everything.
  // A phrase is eight bars: a chord per bar and a melody in eighth notes ('-' holds, '.' rests).
  // A song is a list of sections: which phrase, which bars of it, and which parts play
  // (k keys, b bass, d drums, l lead, h lead doubled an octave up).
  function phrase(ch, mel) {
    const toks = mel.join(' ').split(/\s+/), notes = [];
    for (let i = 0; i < toks.length; i++) {
      const k = toks[i];
      if (k === '-') { if (notes.length && notes[notes.length - 1].open) notes[notes.length - 1].len++; continue; }
      if (notes.length) notes[notes.length - 1].open = false;
      if (k !== '.') notes.push({ step: i, len: 1, m: midi(k), open: true });
    }
    return { ch: ch.map(chordOf), notes: notes };
  }
  // Drum and comping patterns are in sixteenths (16 to the bar); odd sixteenths are played late by `swing`.
  const SONGS = [
    {
      name: 'First Chair', bpm: 82, swing: 0.2,
      kick: [0, 7, 10], snare: [4, 12], rim: [], hat: [0, 2, 4, 6, 8, 10, 12, 14, 15], open: [],
      comp: [[0, 6], [7, 2], [10, 5]], bass: [[0, 0, 6], [7, 0, 2], [10, 0, 5]],
      P: {
        A: phrase(['Fmaj7', 'Em7', 'Dm9', 'Cmaj7', 'Fmaj7', 'Em7', 'Dm9', 'Cmaj7'], [
          'E5 - - C5 - - A4 -', 'G4 - - - B4 - D5 -', 'E5 - - - . C5 A4 -', 'G4 - - - - - . .',
          '. . A4 C5 E5 - - G5', '- - D5 - B4 - G4 -', 'A4 - - C5 - - E5 -', 'D5 - - B4 - - - -']),
        B: phrase(['Am7', 'Dm9', 'G7', 'Cmaj7', 'Fmaj7', 'Em7', 'Dm7', 'G7'], [
          'C5 - E5 - - - A4 -', 'F5 - E5 - C5 - - -', 'D5 - - B4 - - G4 -', 'E5 - - - - - . .',
          '. . A4 - C5 - E5 -', 'D5 - B4 - G4 - - -', 'F4 - A4 - C5 - E5 -', 'D5 - - - - - . .'])
      },
      form: [['A', 0, 4, 'k'], ['A', 0, 8, 'kbd'], ['A', 0, 8, 'kbdl'], ['B', 0, 8, 'kbdl'], ['A', 0, 8, 'kbdlh'], ['A', 4, 8, 'kb']]
    },
    {
      name: 'Glade Line', bpm: 88, swing: 0.16,
      kick: [0, 3, 8, 11], snare: [4, 12], rim: [], hat: [0, 2, 4, 6, 8, 10, 12], open: [14],
      comp: [[0, 8], [11, 4]], bass: [[0, 0, 3], [3, 0, 4], [8, 0, 3], [11, 7, 4]],
      // picked acoustic guitar instead of keys: strum down on one, pick through the chord, brush up on three, pick out
      gtr: [[0, 'D'], [3, 2], [4, 3], [6, 1], [7, 4], [8, 'U'], [10, 0], [11, 2], [12, 3], [14, 4], [15, 2]],
      P: {
        A: phrase(['Am9', 'Fmaj7', 'Dm7', 'E7', 'Am9', 'Fmaj7', 'Dm7', 'E7'], [
          'E5 - - - C5 - B4 -', 'A4 - - - - - . C5', '- - A4 - F4 - A4 -', 'G#4 - - - B4 - - -',
          '. . E5 - G5 - E5 -', 'C5 - - A4 - - C5 -', 'D5 - - F5 - E5 D5 -', 'E5 - - - - - . .']),
        B: phrase(['Fmaj7', 'Em7', 'Dm7', 'Em7', 'Fmaj7', 'Em7', 'Dm7', 'E7'], [
          'A5 - - G5 - E5 - -', 'D5 - - B4 - - G4 -', 'F5 - - E5 - C5 - -', 'B4 - - - D5 - E5 -',
          'C5 - E5 - A5 - - -', 'G5 - - E5 - - D5 -', 'C5 - - A4 - - F4 -', 'G#4 - B4 - E5 - - -']),
        C: phrase(['Dm7', 'Am9', 'Fmaj7', 'E7', 'Dm7', 'Am9', 'Fmaj7', 'E7'], [
          'A4 - - - - - . .', '. . . . C5 - E5 -', 'A5 - - - - - - -', '. . . . . . . .',
          'D5 - - - F5 - - -', 'E5 - - - C5 - - -', 'A4 - - - - - C5 -', 'B4 - - - - - . .'])
      },
      form: [['A', 0, 4, 'k'], ['A', 0, 8, 'kbd'], ['A', 0, 8, 'kbdl'], ['B', 0, 8, 'kbdl'], ['C', 0, 8, 'kbl'], ['A', 0, 8, 'kbdlh'], ['A', 4, 8, 'k']]
    },
    {
      name: 'Cocoa Dusk', bpm: 74, swing: 0.24,
      kick: [0, 10], snare: [], rim: [4, 12], hat: [2, 6, 10, 14], open: [],
      comp: [[0, 10], [12, 4]], strum: 0.028, pad: true, bass: [[0, 0, 9], [10, 0, 5]],   // held pad chords instead of keys
      P: {
        A: phrase(['Dmaj7', 'Bm7', 'Gmaj7', 'A7', 'Dmaj7', 'Bm7', 'Em7', 'A7'], [
          'F#5 - - - A4 - - -', 'D5 - - - - - F#4 -', 'B4 - - D5 - - - -', 'C#5 - - - E5 - - -',
          '. . A4 - D5 - F#5 -', '- - - D5 - - B4 -', 'G4 - - B4 - - E5 -', 'C#5 - - - - - . .']),
        B: phrase(['Gmaj7', 'F#m7', 'Em7', 'A7', 'Gmaj7', 'F#m7', 'Em7', 'Dmaj7'], [
          'B4 - D5 - - - F#5 -', 'E5 - - C#5 - - A4 -', 'G4 - - B4 - - D5 -', 'E5 - - - - - . .',
          '. . B4 - D5 - G5 -', 'F#5 - - - C#5 - - -', 'E5 - - G4 - - B4 -', 'A4 - - - - - - -'])
      },
      form: [['A', 0, 4, 'k'], ['A', 0, 8, 'kbdl'], ['B', 0, 8, 'kbdl'], ['A', 0, 8, 'kbdlh'], ['B', 4, 8, 'kbl'], ['A', 4, 8, 'k']]
    }
  ];
  SONGS.forEach(function (s) {                           // flatten each song into its list of bars
    s.bars = [];
    s.form.forEach(function (f) {
      const p = s.P[f[0]];
      for (let b = f[1]; b < f[2]; b++) s.bars.push({ ch: p.ch[b], L: f[3], notes: p.notes.filter(function (n) { return n.step >= b * 8 && n.step < b * 8 + 8; }).map(function (n) { return { at: n.step - b * 8, len: n.len, m: n.m }; }) });
    });
    s.barLen = 240 / s.bpm; s.tonic = s.P.A.ch[s.name === 'Glade Line' ? 0 : s.name === 'First Chair' ? 3 : 0];
    s.length = s.bars.length * s.barLen + s.barLen * 2;
  });

  // ---- voices ----------------------------------------------------------------------------------
  const noiseOf = new WeakMap();
  function noiseBuf(c) {
    let b = noiseOf.get(c);
    if (!b) { b = c.createBuffer(1, c.sampleRate, c.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; noiseOf.set(c, b); }
    return b;
  }
  // a pitched note: quick attack, optional fall to a sustain level, release at the end, optional glide
  function tone(c, out, type, f, t, dur, vol, o) {
    o = o || {};
    const osc = c.createOscillator(), g = c.createGain(), a = o.a || 0.006, r = Math.min(o.r || 0.04, dur * 0.6);
    osc.type = type; osc.frequency.setValueAtTime(f, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    if (o.det) osc.detune.value = o.det;
    if (o.wob) o.wob.connect(osc.detune);                // tape wobble
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + a);
    if (o.sus !== undefined) g.gain.exponentialRampToValueAtTime(Math.max(0.0001, vol * o.sus), t + Math.max(a + 0.01, dur - r));
    else g.gain.setValueAtTime(vol, t + Math.max(a, dur - r));
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(out); osc.start(t); osc.stop(t + dur + 0.03);
  }
  // a burst of filtered noise that dies away; the filter can sweep
  function hiss(c, out, t, dur, vol, type, f, o) {
    o = o || {};
    const src = c.createBufferSource(), flt = c.createBiquadFilter(), g = c.createGain();
    src.buffer = noiseBuf(c); src.loop = true;
    flt.type = type; flt.frequency.setValueAtTime(f, t); flt.Q.value = o.q || 0.8;
    if (o.to) flt.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + (o.a || 0.004));
    if (o.flat) { g.gain.setValueAtTime(vol, t + dur - 0.02); g.gain.linearRampToValueAtTime(0.0001, t + dur); } else g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(flt); flt.connect(g); g.connect(out); src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.03);
  }
  // an electric piano note: a round fundamental, a little octave, and a bell that is gone almost at once
  function epiano(mx, m, t, dur, vol) {
    const f = hz(m), c = mx.c, o = mx.keys;
    tone(c, o, 'sine', f, t, dur, vol, { sus: 0.3, a: 0.004, r: 0.12, wob: mx.wob });
    tone(c, o, 'triangle', f, t, dur, vol * 0.22, { sus: 0.15, a: 0.004, r: 0.1, wob: mx.wob });
    tone(c, o, 'sine', f * 2, t, dur * 0.7, vol * 0.2, { sus: 0.08, wob: mx.wob });
    tone(c, o, 'sine', f * 4.02, t, 0.14, vol * 0.1, { sus: 0.05 });
  }

  // A plucked steel string (Karplus-Strong): a burst of noise fed round a short delay that
  // averages itself, so the brightness dies away the way a string does. Each pitch is worked
  // out once and kept.
  const pluckOf = new WeakMap();
  function pluckBuf(c, m) {
    let all = pluckOf.get(c); if (!all) { all = {}; pluckOf.set(c, all); }
    if (all[m]) return all[m];
    const sr = c.sampleRate, n = Math.round(sr / hz(m)), len = Math.floor(sr * 1.8), buf = c.createBuffer(1, len, sr), d = buf.getChannelData(0);
    let lp = 0, peak = 0;
    for (let i = 0; i < n; i++) { lp += ((Math.random() * 2 - 1) - lp) * 0.55; d[i] = lp; }   // a slightly soft pick
    const keep = m < 55 ? 0.9975 : m < 67 ? 0.996 : 0.994;
    for (let i = n + 1; i < len; i++) d[i] = keep * 0.5 * (d[i - n] + d[i - n - 1]);
    for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(d[i]));
    for (let i = 0; i < len; i++) d[i] /= peak;
    all[m] = { buf: buf, rate: hz(m) / (sr / (n + 0.5)) };
    return all[m];
  }
  function pluck(mx, m, t, dur, vol) {
    const c = mx.c, p = pluckBuf(c, m), src = c.createBufferSource(), g = c.createGain();
    src.buffer = p.buf; src.playbackRate.value = p.rate;
    if (src.detune && mx.wob) mx.wob.connect(src.detune);
    g.gain.setValueAtTime(vol, t); g.gain.setValueAtTime(vol, t + Math.max(0.02, dur - 0.08)); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    src.connect(g); g.connect(mx.gtr); src.start(t); src.stop(t + dur + 0.02);
  }
  // a warm synth pad: each chord swells in slowly, is held for the whole bar and melts into the next
  function padChord(mx, ch, t, dur) {
    const c = mx.c, notes = [ch.root + 12].concat(ch.keys);
    for (let k = 0; k < notes.length; k++) {
      const f = hz(notes[k]), v = k ? 0.026 : 0.034, o = { a: 0.45, r: 0.7, wob: mx.wob };
      tone(c, mx.pad, 'sawtooth', f, t, dur, v, { a: o.a, r: o.r, wob: o.wob, det: -8 });
      tone(c, mx.pad, 'sawtooth', f, t, dur, v, { a: o.a, r: o.r, wob: o.wob, det: 8 });
      tone(c, mx.pad, 'triangle', f, t, dur, v * 1.4, o);
    }
  }
  // one bar of guitar: 'D' strums down across the strings, 'U' brushes back up the top three, a number picks one string
  function guitar(mx, s, ch, at, s16) {
    const strings = [ch.root + 12].concat(ch.keys);     // bright and high, somewhere between a guitar and a koto
    for (let i = 0; i < s.gtr.length; i++) {
      const g = s.gtr[i], w = at(g[0]) + (Math.random() - 0.5) * 0.01, v = 0.8 + Math.random() * 0.4;
      if (g[1] === 'D') for (let k = 0; k < strings.length; k++) pluck(mx, strings[k], w + k * 0.017, s16 * 7, 0.16 * v);
      else if (g[1] === 'U') for (let k = 0; k < 3; k++) pluck(mx, strings[strings.length - 1 - k], w + k * 0.013, s16 * 5, 0.115 * v);
      else pluck(mx, strings[Math.min(strings.length - 1, g[1])], w, s16 * 5, 0.2 * v);
    }
  }

  // ---- the band: schedule one bar of a song at time t ---------------------------------------
  function mixer(c, dest) {
    const lofi = c.createBiquadFilter(), warm = c.createWaveShaper(), pump = c.createGain(), keys = c.createGain(), lead = c.createBiquadFilter();
    const gtr = c.createBiquadFilter(); gtr.type = 'lowpass'; gtr.frequency.value = 5200; gtr.Q.value = 0.3; gtr.connect(pump);
    // pad: dark, with the filter drifting slowly open and shut
    const pad = c.createBiquadFilter(), padL = c.createOscillator(), padD = c.createGain(); pad.type = 'lowpass'; pad.frequency.value = 1050; pad.Q.value = 0.8; pad.connect(pump);
    padL.frequency.value = 0.13; padD.gain.value = 320; padL.connect(padD); padD.connect(pad.frequency); padL.start();
    const bass = c.createBiquadFilter(), drum = c.createBiquadFilter(), echo = c.createDelay(1.5), fb = c.createGain(), wet = c.createGain();
    const curve = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; curve[i] = Math.tanh(x * 1.2) / Math.tanh(1.2); }
    warm.curve = curve; warm.connect(dest);                                   // gentle tape saturation
    lofi.type = 'lowpass'; lofi.frequency.value = 4200; lofi.Q.value = 0.5; lofi.connect(warm);   // the top end rolled off
    pump.connect(lofi);                                                        // ducks keys and bass under each kick
    keys.connect(pump);
    const trem = c.createOscillator(), tremG = c.createGain(); trem.frequency.value = 4.3; tremG.gain.value = 0.1; trem.connect(tremG); tremG.connect(keys.gain); trem.start();
    bass.type = 'lowpass'; bass.frequency.value = 520; bass.connect(pump);
    lead.type = 'lowpass'; lead.frequency.value = 2100; lead.Q.value = 0.6; lead.connect(lofi);
    lead.connect(echo); echo.connect(fb); fb.connect(echo); echo.connect(wet); wet.connect(lofi); fb.gain.value = 0.34; wet.gain.value = 0.3;
    drum.type = 'lowpass'; drum.frequency.value = 6500; drum.connect(warm);
    const wobL = c.createOscillator(), wob = c.createGain(); wobL.frequency.value = 0.37; wob.gain.value = 7; wobL.connect(wob); wobL.start();
    return { c: c, out: warm, gtr: gtr, pad: pad, keys: keys, bass: bass, lead: lead, drum: drum, pump: pump, echo: echo, wob: wob };
  }
  function playBar(mx, s, bar, t) {
    const c = mx.c, s16 = s.barLen / 16, L = bar.L, ch = bar.ch, has = function (k) { return L.indexOf(k) >= 0; };
    const at = function (i) { return t + (i - (i % 2) + (i % 2 ? 1 + s.swing : 0)) * s16; };   // swung sixteenths
    const loose = function () { return (Math.random() - 0.5) * 0.012; };
    mx.echo.delayTime.setValueAtTime(s16 * 6, t);
    // vinyl: a bed of hiss and a few pops
    hiss(c, mx.out, t, s.barLen + 0.03, 0.006, 'bandpass', 2600, { q: 0.3, flat: true, a: 0.02 });
    for (let i = 0, n = 3 + Math.floor(Math.random() * 5); i < n; i++) hiss(c, mx.out, t + Math.random() * s.barLen, 0.005, 0.02 + Math.random() * 0.04, 'highpass', 1500 + Math.random() * 2500);
    if (has('k') && s.gtr) guitar(mx, s, ch, at, s16);
    else if (has('k') && s.pad) padChord(mx, ch, t, s.barLen + 0.75);
    else if (has('k')) for (let i = 0; i < s.comp.length; i++) {
      const cp = s.comp[i], when = at(cp[0]) + loose(), dur = cp[1] * s16 * 1.05;
      for (let k = 0; k < ch.keys.length; k++) epiano(mx, ch.keys[k], when + k * (s.strum || 0.008), dur, (i ? 0.06 : 0.08) * (0.85 + Math.random() * 0.3));
    }
    if (has('b')) for (let i = 0; i < s.bass.length; i++) {
      const b = s.bass[i], f = hz(ch.root + b[1] + (ch.root < 41 ? 12 : 0)), when = at(b[0]), dur = b[2] * s16 * 0.95;
      tone(c, mx.bass, 'sine', f, when, dur, 0.15, { sus: 0.5, a: 0.012, r: 0.08, wob: mx.wob });
      tone(c, mx.bass, 'triangle', f * 2, when, dur, 0.07, { sus: 0.3, a: 0.012, r: 0.08, wob: mx.wob });
    }
    if (has('l')) for (let i = 0; i < bar.notes.length; i++) {
      const n = bar.notes[i], when = at(n.at * 2) + loose(), dur = n.len * 2 * s16 * 0.96;
      tone(c, mx.lead, 'triangle', hz(n.m), when, dur, 0.13, { sus: 0.4, a: 0.018, r: 0.1, wob: mx.wob });
      tone(c, mx.lead, 'sine', hz(n.m), when, dur, 0.1, { sus: 0.5, a: 0.018, r: 0.1, wob: mx.wob });
      if (has('h')) tone(c, mx.lead, 'sine', hz(n.m + 12), when, dur, 0.035, { sus: 0.25, a: 0.02, wob: mx.wob });
    }
    if (has('d')) {
      const d = mx.drum;
      s.kick.forEach(function (i) {
        const w = at(i), v = i === 0 ? 0.42 : 0.32;
        tone(c, d, 'sine', 118, w, 0.26, v, { to: 40, a: 0.002, sus: 0.06 }); hiss(c, d, w, 0.03, 0.12, 'lowpass', 900);
        mx.pump.gain.setValueAtTime(0.55, w); mx.pump.gain.linearRampToValueAtTime(1, w + 0.24);
      });
      s.snare.forEach(function (i) {
        const w = at(i) + 0.008 + loose();
        hiss(c, d, w, 0.22, 0.2, 'bandpass', 1650, { q: 0.6 }); hiss(c, d, w + 0.012, 0.16, 0.12, 'bandpass', 2900, { q: 0.8 });
        tone(c, d, 'triangle', 190, w, 0.11, 0.13, { to: 140, sus: 0.1 });
      });
      s.rim.forEach(function (i) { const w = at(i) + 0.006 + loose(); tone(c, d, 'triangle', 820, w, 0.035, 0.16, { sus: 0.1 }); hiss(c, d, w, 0.07, 0.1, 'bandpass', 2400, { q: 1.4 }); });
      s.hat.forEach(function (i) { hiss(c, d, at(i) + loose(), 0.04, (i % 4 === 2 ? 0.05 : 0.03) * (0.7 + Math.random() * 0.6), 'highpass', 6800); });
      s.open.forEach(function (i) { hiss(c, d, at(i), 0.2, 0.04, 'highpass', 6000); });
    }
  }
  function playEnd(mx, s, t) {                           // the last chord, left to ring
    const ch = s.tonic;
    if (s.gtr) [ch.root + 12].concat(ch.keys).forEach(function (m, k) { pluck(mx, m, t + k * 0.03, 1.7, 0.17); });
    else if (s.pad) padChord(mx, ch, t, s.barLen * 1.8);
    else for (let k = 0; k < ch.keys.length; k++) epiano(mx, ch.keys[k], t + k * 0.03, s.barLen * 1.7, 0.06);
    tone(mx.c, mx.bass, 'sine', hz(ch.root + (ch.root < 41 ? 12 : 0)), t, s.barLen * 1.5, 0.14, { sus: 0.15, a: 0.012 });
    hiss(mx.c, mx.out, t, s.barLen * 1.8, 0.006, 'bandpass', 2600, { q: 0.3 });
  }

  // ---- live playback -------------------------------------------------------------------------
  let ctx = null, master = null, musicBus = null, sfxBus = null, session = null, mx = null, timer = null;
  let song = Math.floor(Math.random() * SONGS.length), barAt = 0, nextT = 0, ducked = false, carve = null;
  const pref = { music: true, sfx: true };
  try { pref.music = localStorage.getItem('glade-run-music') !== '0'; pref.sfx = localStorage.getItem('glade-run-sfx') !== '0'; } catch (e) { /* private mode */ }
  const MUSIC_VOL = 0.55, SFX_VOL = 0.9;

  function boot() {
    if (ctx || !AC) return !!ctx;
    try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { try { ctx = new AC(); } catch (e2) { return false; } }
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 5; comp.attack.value = 0.004; comp.release.value = 0.2;
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(comp); comp.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = pref.music ? MUSIC_VOL : 0; musicBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = pref.sfx ? SFX_VOL : 0; sfxBus.connect(master);
    return true;
  }
  function unlock() { if (boot() && ctx.state === 'suspended' && !held) ctx.resume().catch(function () { }); }
  let held = false;
  function tick() {
    if (!ctx || !session || ctx.state !== 'running') return;
    while (nextT < ctx.currentTime + 0.35) {
      const s = SONGS[song];
      if (barAt < s.bars.length) { playBar(mx, s, s.bars[barAt], nextT); nextT += s.barLen; barAt++; }
      else { playEnd(mx, s, nextT); nextT += s.barLen * 2.4; barAt = 0; song = (song + 1) % SONGS.length; }
    }
  }
  function stopMusic(fade) {
    if (timer) { clearInterval(timer); timer = null; }
    if (session && ctx) {
      const g = session, t = ctx.currentTime, f = fade === undefined ? 0.4 : fade;
      g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0.0001, t + f);
      setTimeout(function () { try { g.disconnect(); } catch (e) { /* gone */ } }, f * 1000 + 300);
    }
    session = null; mx = null;
  }
  function startMusic(nextSong) {
    if (!boot()) return;
    stopMusic(0.15);
    if (nextSong) song = (song + 1) % SONGS.length;
    session = ctx.createGain(); session.gain.value = 1; session.connect(musicBus); mx = mixer(ctx, session);
    barAt = 0; nextT = ctx.currentTime + 0.25; ducked = false;
    timer = setInterval(tick, 90); tick();
  }
  function duck(on) {                                    // drop the music under the end card
    if (!session || !ctx) return; ducked = !!on;
    session.gain.setTargetAtTime(on ? 0.4 : 1, ctx.currentTime, 0.4);
  }
  function pause() { held = true; if (ctx && ctx.state === 'running') ctx.suspend().catch(function () { }); }
  function resume() { held = false; if (ctx && ctx.state !== 'running') ctx.resume().catch(function () { }); }
  function set(kind, on) {
    pref[kind] = !!on;
    try { localStorage.setItem('glade-run-' + kind, on ? '1' : '0'); } catch (e) { /* private mode */ }
    if (ctx) (kind === 'music' ? musicBus : sfxBus).gain.setTargetAtTime(on ? (kind === 'music' ? MUSIC_VOL : SFX_VOL) : 0, ctx.currentTime, 0.05);
  }

  // The hiss of the skis: quiet filtered noise that follows speed, and bites harder in a turn.
  function ski(v, turn, air) {
    if (!ctx || !pref.sfx || ctx.state !== 'running') return;
    if (!carve) {
      const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      src.buffer = noiseBuf(ctx); src.loop = true; f.type = 'bandpass'; f.Q.value = 0.6; g.gain.value = 0;
      src.connect(f); f.connect(g); g.connect(sfxBus); src.start();
      carve = { f: f, g: g };
    }
    const k = air ? 0 : Math.min(1, v / 170), t = ctx.currentTime;
    carve.g.gain.setTargetAtTime(k * (0.035 + 0.075 * Math.min(1, turn)), t, 0.06);
    carve.f.frequency.setTargetAtTime(700 + k * 1500 + turn * 900, t, 0.08);
  }

  // ---- sound effects ---------------------------------------------------------------------------
  const N = function (n) { return hz(midi(n)); };
  function run(c, out, t, names, gap, dur, vol, type) { for (let i = 0; i < names.length; i++) tone(c, out, type || 'triangle', N(names[i]), t + gap * i, dur, vol, { sus: 0.3 }); }
  const FX = {
    jump: function (c, o, t) { tone(c, o, 'square', 300, t, 0.12, 0.09, { to: 640, sus: 0.4 }); },
    boost: function (c, o, t) { tone(c, o, 'square', 262, t, 0.24, 0.09, { to: 880, sus: 0.4 }); hiss(c, o, t, 0.28, 0.12, 'bandpass', 900, { to: 4200, q: 1.2 }); },
    spin: function (c, o, t, n) { n = Math.min(12, n || 1); hiss(c, o, t, 0.11, 0.13, 'bandpass', 800 + n * 220, { to: 2200 + n * 380, q: 2 }); tone(c, o, 'triangle', 420 + n * 60, t, 0.08, 0.06, { to: 640 + n * 90, sus: 0.3 }); },
    land: function (c, o, t) { hiss(c, o, t, 0.14, 0.22, 'lowpass', 700, { to: 150 }); tone(c, o, 'sine', 130, t, 0.12, 0.2, { to: 58, sus: 0.2 }); },
    trick: function (c, o, t, tier) {
      tier = tier || 0;
      if (tier === 0) { run(c, o, t, ['E5', 'G5'], 0.07, 0.14, 0.13); return; }
      if (tier === 1) { run(c, o, t, ['C5', 'E5', 'G5', 'C6'], 0.06, 0.16, 0.13); run(c, o, t, ['C5', 'E5', 'G5', 'C6'], 0.06, 0.12, 0.04, 'square'); return; }
      const up = tier === 2 ? ['C5', 'E5', 'G5', 'C6', 'E6', 'G6'] : ['C5', 'G5', 'C6', 'E6', 'G6', 'C7', 'E7', 'G7'];
      run(c, o, t, up, 0.05, 0.2, 0.13); run(c, o, t, up, 0.05, 0.14, 0.045, 'square');
      hiss(c, o, t, 0.5, 0.1, 'highpass', 5200);
      if (tier >= 3) {                                    // the full works: a boom, a crash and a held chord
        tone(c, o, 'sine', 110, t, 0.6, 0.4, { to: 34, sus: 0.1 });
        hiss(c, o, t, 0.9, 0.2, 'highpass', 3200);
        const at = t + 0.05 * up.length;
        ['C5', 'E5', 'G5', 'C6'].forEach(function (n, i) { tone(c, o, i % 2 ? 'triangle' : 'square', N(n), at, 0.7, i % 2 ? 0.1 : 0.04, { sus: 0.15 }); });
        run(c, o, at + 0.16, ['G6', 'C7'], 0.14, 0.4, 0.1);
      }
    },
    pickup: function (c, o, t) { run(c, o, t, ['B5', 'E6'], 0.07, 0.16, 0.14); },
    heart: function (c, o, t) { run(c, o, t, ['C5', 'E5', 'G5', 'C6'], 0.08, 0.26, 0.15, 'sine'); run(c, o, t, ['C6', 'E6', 'G6', 'C7'], 0.08, 0.2, 0.04); },
    crash: function (c, o, t) { hiss(c, o, t, 0.4, 0.3, 'lowpass', 2400, { to: 180 }); tone(c, o, 'sawtooth', 230, t, 0.42, 0.1, { to: 52, sus: 0.3 }); tone(c, o, 'square', 150, t + 0.02, 0.2, 0.06, { to: 70 }); },
    well: function (c, o, t) { hiss(c, o, t, 0.5, 0.36, 'lowpass', 480, { to: 90 }); tone(c, o, 'sine', 120, t, 0.4, 0.26, { to: 42, sus: 0.2 }); },
    bump: function (c, o, t) { tone(c, o, 'square', 190, t, 0.13, 0.1, { to: 85 }); hiss(c, o, t, 0.12, 0.18, 'lowpass', 1200, { to: 300 }); },
    close: function (c, o, t) { hiss(c, o, t, 0.09, 0.09, 'bandpass', 2600, { to: 6400, q: 2.5 }); },
    mult: function (c, o, t, m) { const top = ['C6', 'D6', 'E6', 'G6', 'C7'][Math.max(0, Math.min(4, (m || 2) - 1))]; run(c, o, t, ['G5', top], 0.09, 0.22, 0.13); },
    start: function (c, o, t) { run(c, o, t, ['C5', 'E5', 'G5'], 0.07, 0.16, 0.11); },
    over: function (c, o, t) { run(c, o, t, ['G5', 'E5', 'C5', 'G4'], 0.2, 0.34, 0.14); tone(c, o, 'sine', N('C4'), t + 0.8, 0.9, 0.16, { sus: 0.1 }); tone(c, o, 'triangle', N('E4'), t + 0.8, 0.9, 0.08, { sus: 0.1 }); },
    save: function (c, o, t) { run(c, o, t, ['C6', 'E6', 'G6', 'C7'], 0.06, 0.2, 0.12); },
    ui: function (c, o, t) { tone(c, o, 'square', 880, t, 0.035, 0.05); },
    say: function (c, o, t) { const b = 480 + Math.random() * 420, n = 2 + Math.floor(Math.random() * 2); for (let i = 0; i < n; i++) tone(c, o, 'square', b * (1 + (Math.random() - 0.4) * 0.3), t + i * 0.055, 0.04, 0.035); }
  };
  function sfx(name, arg, delay) {
    if (!pref.sfx || !FX[name] || !boot() || ctx.state !== 'running') return;
    FX[name](ctx, sfxBus, ctx.currentTime + (delay || 0), arg);
  }

  // Render a whole song, or a row of sound effects, without playing it: used to check and preview the audio.
  function render(what) {
    const OC = window.OfflineAudioContext || window.webkitOfflineAudioContext, rate = 44100;
    if (typeof what === 'number') {
      const s = SONGS[what], c = new OC(2, Math.ceil(rate * s.length), rate), g = c.createGain(), m = mixer(c, g);
      g.gain.value = MUSIC_VOL * 0.9; g.connect(c.destination);
      for (let i = 0; i < s.bars.length; i++) playBar(m, s, s.bars[i], 0.05 + i * s.barLen);
      playEnd(m, s, 0.05 + s.bars.length * s.barLen);
      return c.startRendering();
    }
    const c = new OC(2, Math.ceil(rate * what.length * 1.2), rate), g = c.createGain(); g.gain.value = SFX_VOL * 0.9; g.connect(c.destination);
    what.forEach(function (w, i) { FX[w[0]](c, g, 0.1 + i * 1.2, w[1]); });
    return c.startRendering();
  }

  window.GladeAudio = {
    ok: !!AC, unlock: unlock, startMusic: startMusic, stopMusic: stopMusic, duck: duck, pause: pause, resume: resume, sfx: sfx, ski: ski,
    set: set, get: function (k) { return pref[k]; }, render: render, songs: SONGS.map(function (s) { return { name: s.name, length: s.length }; }),
    song: function () { return SONGS[song].name; }
  };
})();
