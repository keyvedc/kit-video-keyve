#!/usr/bin/env node
// Divide o vídeo (já sem pausas) em partes MUDAS de até 15 s para trocar o cenário em IA de vídeo (Flow, Omni, Veo...).
// Corta de preferência nas emendas das pausas (onde a fala já tem um respiro). Sem áudio = menos recusa da IA.
//   node ferramentas/dividir-partes.mjs videos/<slug>/src/video-cortado.mp4 videos/<slug>/partes [--edl videos/<slug>/src/edl.json] [--max 15]
import fs from 'node:fs';
import path from 'node:path';
import { pos, opt, die, ff, probe, principal } from './lib.mjs';

if (principal(import.meta.url)) {
  const [src, dir] = pos;
  if (!src || !dir) die('uso: node ferramentas/dividir-partes.mjs <video-cortado.mp4> <pasta-partes> [--edl edl.json] [--max 15]');
  const max = +opt('max', 15), info = await probe(src), fps = info.video.fps;
  const total = Math.round(info.duration * fps);
  const emendas = opt('edl') ? (JSON.parse(fs.readFileSync(opt('edl'), 'utf8')).emendas || []) : [];
  const cand = emendas.map((t) => Math.round(t * fps)).filter((f) => f > 0 && f < total);
  const partes = []; let s = 0;
  while (s < total) {
    if (total - s <= max * fps) { partes.push([s, total]); break; }
    const ok = cand.filter((f) => f - s >= 3 * fps && f - s <= max * fps);
    const e = ok.length ? ok[ok.length - 1] : s + Math.floor(max * fps);
    partes.push([s, e]); s = e;
  }
  fs.mkdirSync(dir, { recursive: true });
  const n = partes.length, base = path.basename(src, path.extname(src));
  for (let i = 0; i < n; i++) {
    const [a, b] = partes[i];
    const out = path.join(dir, `parte-${String(i + 1).padStart(2, '0')}-de-${String(n).padStart(2, '0')}.mp4`);
    await ff(['-i', src, '-vf', `select='between(n,${a},${b - 1})',setpts=N/(${fps})/TB`, '-r', String(fps), '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '14', '-pix_fmt', 'yuv420p', out]);
    console.log(`  ${path.basename(out)}: frames ${a}–${b} (${((b - a) / fps).toFixed(2)} s)${emendas.length && cand.includes(b) ? ' · corte numa pausa' : ''}`);
  }
  fs.writeFileSync(path.join(dir, 'partes.json'), JSON.stringify({ fonte: base, fps, total, partes }, null, 1));
  console.log(`✓ ${n} partes mudas em ${dir} (+ partes.json). Troque o cenário de cada uma e salve os resultados numa pasta, na mesma ordem.`);
}
