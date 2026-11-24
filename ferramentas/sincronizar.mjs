#!/usr/bin/env node
// Mede o atraso entre o áudio da câmera e o áudio limpo (gravador, Adobe Podcast...) por correlação de envelope.
//   node ferramentas/sincronizar.mjs <video-ou-audio-da-camera> <audio-limpo>
// Saída: offset em segundos. offset > 0 = o áudio limpo está ADIANTADO (fala chega depois no arquivo limpo):
//   audio_limpo(t + offset) ≈ camera(t). Use como voice.offset em createVideo, ou deixe o preparar-falado alinhar.
import { pos, die, pcm, principal } from './lib.mjs';

export async function medirOffset(cam, limpo, { janela = 3 } = {}) {
  const SR = 8000, HOP = 80; // envelope a 100 Hz
  const env = (x) => { const n = Math.floor(x.length / HOP), e = new Float32Array(n); for (let i = 0; i < n; i++) { let s = 0; for (let k = 0; k < HOP; k++) { const v = x[i * HOP + k]; s += v * v; } e[i] = Math.sqrt(s / HOP); } return e; };
  const norm = (e) => { let m = 0; for (const v of e) m += v; m /= e.length; let sd = 0; for (const v of e) sd += (v - m) ** 2; sd = Math.sqrt(sd / e.length) || 1; return e.map((v) => (v - m) / sd); };
  const a = norm(env(await pcm(cam, SR))).slice(0, 12000), b = norm(env(await pcm(limpo, SR))).slice(0, 12000);
  const L = Math.round(janela * 100);
  let best = -1e9, lag = 0; const sc = {};
  for (let d = -L; d <= L; d++) {
    let s = 0, n = 0;
    for (let i = 0; i < a.length; i++) { const j = i + d; if (j < 0 || j >= b.length) continue; s += a[i] * b[j]; n++; }
    sc[d] = n ? s / n : -1e9;
    if (sc[d] > best) { best = sc[d]; lag = d; }
  }
  // refino parabólico (sub-amostra)
  const y0 = sc[lag - 1] ?? best, y2 = sc[lag + 1] ?? best, den = y0 - 2 * best + y2;
  const frac = den ? (0.5 * (y0 - y2)) / den : 0;
  return { offset: +((lag + frac) / 100).toFixed(3), confianca: +best.toFixed(3) };
}

if (principal(import.meta.url)) {
  const [cam, limpo] = pos;
  if (!cam || !limpo) die('uso: node ferramentas/sincronizar.mjs <camera.mp4> <audio-limpo.wav>');
  const r = await medirOffset(cam, limpo);
  console.log(`offset: ${r.offset} s   (correlação ${r.confianca}${r.confianca < 0.5 ? ' — BAIXA: confira se é a mesma gravação' : ''})`);
}
