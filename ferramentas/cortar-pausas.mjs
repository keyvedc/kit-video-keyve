#!/usr/bin/env node
// Remove as pausas da fala. Gera edl.json (trechos mantidos) e, opcionalmente, o vídeo e o áudio cortados.
//   node ferramentas/cortar-pausas.mjs <video-ou-audio> <pasta-saida> [--audio voz-limpa.wav] [--offset 0] [--db -38] [--min 0.25] [--respiro 0.09]
// --audio: detecta as pausas no áudio limpo (melhor) e corta os dois iguais. offset = saída de sincronizar.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { pos, opt, die, probe, silencios, edlDeSilencios, cortarVideo, cortarAudio, fpsDeTrabalho, mapaTempo, principal } from './lib.mjs';

export async function cortarPausas(src, dir, { audio, offset = 0, db = -38, min = 0.25, respiro = 0.09 } = {}) {
  fs.mkdirSync(dir, { recursive: true });
  const info = await probe(src);
  const fps = info.video ? fpsDeTrabalho(info.video.fps) : 30;
  // detecção no áudio limpo (no relógio do vídeo: desloca pelo offset)
  const ref = audio || src;
  const sil = (await silencios(ref, db, min)).map(([a, b]) => [a - (audio ? offset : 0), b - (audio ? offset : 0)]).filter(([, b]) => b > 0);
  const edl = edlDeSilencios(sil, info.duration, { min, respiro, fps });
  const m = mapaTempo(edl);
  fs.writeFileSync(path.join(dir, 'edl.json'), JSON.stringify({ fonte: path.basename(src), fps, offset, edl, duracao_original: +info.duration.toFixed(3), duracao_cortada: +m.duracao.toFixed(3), emendas: m.emendas.map((x) => +x.toFixed(3)) }, null, 1));
  if (info.video) await cortarVideo(src, edl, path.join(dir, 'video-cortado.mp4'), { fps });
  await cortarAudio(audio || src, edl, path.join(dir, 'voz.wav'), { offset: audio ? offset : 0 });
  return { edl, fps, duracao: m.duracao, original: info.duration, emendas: m.emendas };
}

if (principal(import.meta.url)) {
  const [src, dir] = pos;
  if (!src || !dir) die('uso: node ferramentas/cortar-pausas.mjs <video> <pasta-saida> [--audio limpo.wav] [--offset s]');
  const r = await cortarPausas(src, dir, { audio: opt('audio'), offset: +opt('offset', 0), db: +opt('db', -38), min: +opt('min', 0.25), respiro: +opt('respiro', 0.09) });
  console.log(`✓ ${r.edl.length} trechos · ${r.original.toFixed(1)} s → ${r.duracao.toFixed(1)} s (−${(r.original - r.duracao).toFixed(1)} s de pausas) · ${dir}/edl.json, voz.wav${r.fps ? ', video-cortado.mp4' : ''}`);
}
