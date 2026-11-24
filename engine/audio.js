// Keyve Video Engine — trilha sintetizada em OfflineAudioContext (determinística).
// Kick em toda batida, hi-hat nos contratempos, baixo em Lá menor (Am–F–G–Am),
// impacto em cada troca de cena, riser antes do compasso mais forte, "tick" nos toques de UI.

const SR = 48000;

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
}
function noiseBuffer(ctx, seconds, seed = 7) {
  const b = ctx.createBuffer(1, Math.ceil(seconds * SR), SR);
  const d = b.getChannelData(0), r = rng(seed);
  for (let i = 0; i < d.length; i++) d[i] = r();
  return b;
}

function kick(ctx, out, t, vel = 1) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(150, t);
  o.frequency.exponentialRampToValueAtTime(46, t + 0.11);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.95 * vel, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
  o.connect(g).connect(out);
  o.start(t); o.stop(t + 0.4);
  // clique de ataque
  const n = ctx.createBufferSource(), ng = ctx.createGain(), hp = ctx.createBiquadFilter();
  n.buffer = noiseBuffer(ctx, 0.02, 11); hp.type = 'highpass'; hp.frequency.value = 2500;
  ng.gain.setValueAtTime(0.18 * vel, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.015);
  n.connect(hp).connect(ng).connect(out); n.start(t);
}

function hat(ctx, out, t, vel = 1) {
  const n = ctx.createBufferSource(), g = ctx.createGain(), hp = ctx.createBiquadFilter();
  n.buffer = noiseBuffer(ctx, 0.08, 23); hp.type = 'highpass'; hp.frequency.value = 7500;
  g.gain.setValueAtTime(0.11 * vel, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
  n.connect(hp).connect(g).connect(out); n.start(t);
}

function bass(ctx, out, t, freq, dur) {
  const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
  o.type = 'sawtooth'; o2.type = 'sine';
  o.frequency.value = freq; o2.frequency.value = freq;
  lp.type = 'lowpass'; lp.Q.value = 6;
  lp.frequency.setValueAtTime(900, t); lp.frequency.exponentialRampToValueAtTime(180, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.32, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(lp); o2.connect(lp); lp.connect(g).connect(out);
  o.start(t); o2.start(t); o.stop(t + dur + 0.02); o2.stop(t + dur + 0.02);
}

function impact(ctx, out, t, big = false) {
  // boom grave
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(big ? 90 : 80, t);
  o.frequency.exponentialRampToValueAtTime(32, t + (big ? 1.1 : 0.6));
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(big ? 0.8 : 0.5, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + (big ? 1.4 : 0.7));
  o.connect(g).connect(out); o.start(t); o.stop(t + 1.5);
  // corpo de ruído
  const n = ctx.createBufferSource(), ng = ctx.createGain(), bp = ctx.createBiquadFilter();
  n.buffer = noiseBuffer(ctx, 0.8, 31); bp.type = 'bandpass'; bp.frequency.value = big ? 1200 : 1800; bp.Q.value = 0.7;
  ng.gain.setValueAtTime(big ? 0.42 : 0.26, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + (big ? 0.6 : 0.3));
  n.connect(bp).connect(ng).connect(out); n.start(t);
  // brilho tonal (Lá + Mi) — assinatura sonora
  for (const [f, a] of [[880, 0.07], [1318.5, 0.05], big ? [1760, 0.04] : [0, 0]]) {
    if (!f) continue;
    const s = ctx.createOscillator(), sg = ctx.createGain();
    s.type = 'triangle'; s.frequency.value = f;
    sg.gain.setValueAtTime(0.0001, t); sg.gain.exponentialRampToValueAtTime(a, t + 0.005);
    sg.gain.exponentialRampToValueAtTime(0.0001, t + (big ? 1.2 : 0.5));
    s.connect(sg).connect(out); s.start(t); s.stop(t + 1.3);
  }
}

function tick(ctx, out, t) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'square'; o.frequency.setValueAtTime(2400, t); o.frequency.exponentialRampToValueAtTime(1200, t + 0.03);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5000;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09, t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  o.connect(lp).connect(g).connect(out); o.start(t); o.stop(t + 0.06);
}

function riser(ctx, out, t0, t1) {
  const d = t1 - t0;
  const n = ctx.createBufferSource(), g = ctx.createGain(), bp = ctx.createBiquadFilter();
  n.buffer = noiseBuffer(ctx, d + 0.1, 47); bp.type = 'bandpass'; bp.Q.value = 3;
  bp.frequency.setValueAtTime(300, t0); bp.frequency.exponentialRampToValueAtTime(7000, t1);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.32, t1 - 0.02);
  g.gain.linearRampToValueAtTime(0, t1);
  n.connect(bp).connect(g).connect(out); n.start(t0); n.stop(t1 + 0.05);
  const o = ctx.createOscillator(), og = ctx.createGain(), lp = ctx.createBiquadFilter();
  o.type = 'sawtooth'; o.frequency.setValueAtTime(110, t0); o.frequency.exponentialRampToValueAtTime(880, t1);
  lp.type = 'lowpass'; lp.frequency.setValueAtTime(400, t0); lp.frequency.exponentialRampToValueAtTime(5000, t1);
  og.gain.setValueAtTime(0.0001, t0); og.gain.exponentialRampToValueAtTime(0.09, t1 - 0.02); og.gain.linearRampToValueAtTime(0, t1);
  o.connect(lp).connect(og).connect(out); o.start(t0); o.stop(t1 + 0.05);
}

function encodeWav(buf) {
  const ch = buf.numberOfChannels, len = buf.length, bytes = 44 + len * ch * 2;
  const dv = new DataView(new ArrayBuffer(bytes));
  const w = (o, s) => [...s].forEach((c, i) => dv.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); dv.setUint32(4, bytes - 8, true); w(8, 'WAVE'); w(12, 'fmt ');
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, ch, true);
  dv.setUint32(24, buf.sampleRate, true); dv.setUint32(28, buf.sampleRate * ch * 2, true);
  dv.setUint16(32, ch * 2, true); dv.setUint16(34, 16, true); w(36, 'data'); dv.setUint32(40, len * ch * 2, true);
  const data = [...Array(ch)].map((_, c) => buf.getChannelData(c));
  let o = 44;
  for (let i = 0; i < len; i++) for (let c = 0; c < ch; c++) {
    const v = Math.max(-1, Math.min(1, data[c][i]));
    dv.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true); o += 2;
  }
  const u8 = new Uint8Array(dv.buffer);
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
}

/**
 * hits: tempos de troca de cena; big: tempos de impacto maior; riser: [t0, t1];
 * ticks: toques/cliques de UI; bassline: frequências por compasso.
 */
export async function renderSoundtrack({ duration, bpm = 120, hits = [], big = [], riser: r, ticks = [], bassline = [55, 55, 43.65, 49], kickUntil }) {
  const ctx = new OfflineAudioContext(2, Math.ceil(duration * SR), SR);
  const master = ctx.createGain(); master.gain.value = 0.9;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.12;
  master.connect(comp).connect(ctx.destination);

  const spb = 60 / bpm;
  const nBeats = Math.round(duration / spb);
  const kEnd = kickUntil ?? duration;
  for (let b = 0; b < nBeats; b++) {
    const t = b * spb;
    if (t < kEnd - 0.01) kick(ctx, master, t, b % 4 === 0 ? 1 : 0.85);
    hat(ctx, master, t + spb / 2, b % 2 ? 1 : 0.7);
    const barIdx = Math.floor(b / 4) % bassline.length;
    if (t < kEnd - 0.01) bass(ctx, master, t + spb / 2, bassline[barIdx], spb * 0.45);
  }
  if (r) riser(ctx, master, r[0], r[1]);
  for (const t of hits) impact(ctx, master, t, big.includes(t));
  for (const t of ticks) tick(ctx, master, t);

  const buf = await ctx.startRendering();
  return encodeWav(buf);
}

// =====================================================================
// Vídeos com fala: trilha de fundo por seções + efeitos pontuais.
// A voz é mixada depois no ffmpeg (render.mjs) com ducking automático.
// =====================================================================

function whoosh(ctx, out, t, dur = 0.5, gain = 1) {
  const n = ctx.createBufferSource(), g = ctx.createGain(), bp = ctx.createBiquadFilter();
  n.buffer = noiseBuffer(ctx, dur + 0.1, 53 + Math.round(t * 10));
  bp.type = 'bandpass'; bp.Q.value = 1.4;
  bp.frequency.setValueAtTime(350, t); bp.frequency.exponentialRampToValueAtTime(4200, t + dur * 0.55); bp.frequency.exponentialRampToValueAtTime(900, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5 * gain, t + dur * 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const pan = ctx.createStereoPanner(); pan.pan.setValueAtTime(-0.6, t); pan.pan.linearRampToValueAtTime(0.6, t + dur);
  n.connect(bp).connect(g).connect(pan).connect(out); n.start(t); n.stop(t + dur + 0.05);
}
function pop(ctx, out, t, gain = 1, f = 620) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(f * 1.9, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.06);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.32 * gain, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  o.connect(g).connect(out); o.start(t); o.stop(t + 0.14);
}
function chime(ctx, out, t, gain = 1) {
  for (const [dt, f] of [[0, 1318.5], [0.09, 1760]]) {
    for (const [mul, a] of [[1, 0.16], [2, 0.04], [3, 0.02]]) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f * mul;
      g.gain.setValueAtTime(0.0001, t + dt); g.gain.exponentialRampToValueAtTime(a * gain, t + dt + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.9);
      o.connect(g).connect(out); o.start(t + dt); o.stop(t + dt + 1);
    }
  }
}
function typeClicks(ctx, out, t0, t1, gain = 1) {
  const r = rng(99); let t = t0;
  while (t < t1) {
    const n = ctx.createBufferSource(), g = ctx.createGain(), bp = ctx.createBiquadFilter();
    n.buffer = noiseBuffer(ctx, 0.03, 71 + Math.round(t * 100)); bp.type = 'bandpass'; bp.frequency.value = 3000 + r() * 800; bp.Q.value = 2;
    g.gain.setValueAtTime(0.14 * gain * (0.7 + 0.3 * Math.abs(r())), t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.025);
    n.connect(bp).connect(g).connect(out); n.start(t);
    t += 0.075 + Math.abs(r()) * 0.06;
  }
}
const SFX = { whoosh, pop, chime, impact: (c, o, t, g) => impact(c, o, t, g > 1), riser: (c, o, t, g, d = 1) => riser(c, o, t, t + d), tick };

function pad(ctx, out, t, dur, freqs, gain) {
  for (const f of freqs) for (const det of [-6, 6]) {
    const o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det;
    lp.type = 'lowpass'; lp.frequency.value = 1400; lp.Q.value = 0.5;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.022 * gain, t + 0.35);
    g.gain.setValueAtTime(0.022 * gain, t + dur - 0.3); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(lp).connect(g).connect(out); o.start(t); o.stop(t + dur + 0.05);
  }
}
function pluck(ctx, out, t, f, gain) {
  const o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
  o.type = 'triangle'; o.frequency.value = f;
  lp.type = 'lowpass'; lp.frequency.setValueAtTime(5000, t); lp.frequency.exponentialRampToValueAtTime(700, t + 0.2);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09 * gain, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
  o.connect(lp).connect(g).connect(out); o.start(t); o.stop(t + 0.3);
}

/**
 * Trilha de fundo para vídeo falado + efeitos.
 * sections: [{ t, level: 0..3 }] — 0 só pad, 1 + kick suave/hat, 2 + baixo e pluck, 3 + arpejo cheio.
 * sfx: [{ type: 'whoosh'|'pop'|'chime'|'impact'|'riser'|'typing', t, gain?, dur? }]
 * Progressão Am–F–C–G (1 acorde por compasso). end: tempo em que a música resolve.
 */
export async function renderBed({ duration, bpm = 120, sections = [{ t: 0, level: 1 }], sfx = [], end, musicGain = 1 }) {
  const ctx = new OfflineAudioContext(2, Math.ceil(duration * SR), SR);
  const master = ctx.createGain(); master.gain.value = 0.9;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3;
  master.connect(comp).connect(ctx.destination);
  const music = ctx.createGain(); music.gain.value = musicGain; music.connect(master);
  const fx = ctx.createGain(); fx.gain.value = 1; fx.connect(master);

  const spb = 60 / bpm, stop = end ?? duration;
  const levelAt = (t) => { let l = 0; for (const s of sections) if (t >= s.t) l = s.level; return l; };
  const chords = [[220, 261.6, 329.6], [174.6, 220, 261.6], [130.8, 196, 261.6], [196, 246.9, 293.7]]; // Am F C G
  const roots = [55, 43.65, 65.4, 49];
  const nBars = Math.ceil(stop / (4 * spb));
  for (let b = 0; b < nBars; b++) {
    const t0 = b * 4 * spb; if (t0 >= stop) break;
    const ci = b % 4, L = levelAt(t0), barDur = Math.min(4 * spb, stop - t0);
    pad(ctx, music, t0, barDur, chords[ci], L >= 3 ? 1.2 : 1);
    for (let k = 0; k < 4; k++) {
      const t = t0 + k * spb; if (t >= stop) break;
      const L2 = levelAt(t);
      if (L2 >= 1) kick(ctx, music, t, L2 >= 3 ? 0.55 : 0.4);
      if (L2 >= 1) hat(ctx, music, t + spb / 2, 0.5);
      if (L2 >= 2) bass(ctx, music, t + spb / 2, roots[ci], spb * 0.4);
      if (L2 >= 2) pluck(ctx, music, t, chords[ci][k % 3] * 2, 1);
      if (L2 >= 3) { pluck(ctx, music, t + spb / 2, chords[ci][(k + 1) % 3] * 4, 0.6); hat(ctx, music, t + spb / 4, 0.3); hat(ctx, music, t + 3 * spb / 4, 0.3); }
    }
  }
  // resolução final: acorde de Lá menor aberto + impacto suave
  if (end != null && end < duration) { pad(ctx, music, end, duration - end, [220, 329.6, 440], 1.3); impact(ctx, music, end, false); }

  for (const s of sfx) {
    if (s.type === 'typing') typeClicks(ctx, fx, s.t, s.t + (s.dur ?? 1), s.gain ?? 1);
    else SFX[s.type](ctx, fx, s.t, s.gain ?? 1, s.dur);
  }
  const buf = await ctx.startRendering();
  return encodeWav(buf);
}
