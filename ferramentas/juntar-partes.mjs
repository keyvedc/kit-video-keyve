#!/usr/bin/env node
// Junta as partes que voltaram da IA de vídeo e grava os frames para a cena (o áudio delas é descartado).
// A IA costuma devolver 1–3 frames a mais ou a menos: sobras no fim são aparadas, faltas repetem o último frame.
//   node ferramentas/juntar-partes.mjs <pasta-com-partes-editadas> videos/<slug>/src/frames --partes videos/<slug>/partes/partes.json
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pos, opt, die, ff, principal } from './lib.mjs';

if (principal(import.meta.url)) {
  const [pdir, fdir] = pos;
  if (!pdir || !fdir || !opt('partes')) die('uso: node ferramentas/juntar-partes.mjs <pasta-editadas> <pasta-frames> --partes partes.json');
  const P = JSON.parse(fs.readFileSync(opt('partes'), 'utf8'));
  const files = fs.readdirSync(pdir).filter((f) => /\.(mp4|mov|webm)$/i.test(f)).sort();
  if (files.length !== P.partes.length) die(`achei ${files.length} vídeos em ${pdir}, esperava ${P.partes.length} (mesma ordem de nome das partes originais)`);
  fs.mkdirSync(fdir, { recursive: true });
  for (const f of fs.readdirSync(fdir)) if (/^f\d+\.jpg$/.test(f)) fs.unlinkSync(path.join(fdir, f));
  let k = 0;
  for (let i = 0; i < files.length; i++) {
    const [a, b] = P.partes[i], n = b - a;
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'parte-'));
    await ff(['-i', path.join(pdir, files[i]), '-vf', `fps=${P.fps},scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920`, '-q:v', '3', '-start_number', '0', path.join(tmp, 'g%05d.jpg')]);
    const got = fs.readdirSync(tmp).filter((x) => x.endsWith('.jpg')).sort();
    const diff = got.length - n;
    for (let j = 0; j < n; j++) fs.copyFileSync(path.join(tmp, got[Math.min(j, got.length - 1)]), path.join(fdir, `f${String(k++).padStart(5, '0')}.jpg`));
    fs.rmSync(tmp, { recursive: true, force: true });
    console.log(`  ${files[i]}: ${got.length} frames, esperado ${n}${diff ? ` → ${diff > 0 ? `aparei ${diff} no fim` : `repeti o último ${-diff}×`}${Math.abs(diff) > 3 ? ' ⚠ diferença grande: confira a sincronia labial dessa parte' : ''}` : ''}`);
  }
  fs.writeFileSync(path.join(fdir, 'info.json'), JSON.stringify({ fps: P.fps, total: k, prefixo: 'f', digitos: 5, ext: 'jpg', w: 1080, h: 1920 }, null, 1));
  console.log(`✓ ${k} frames em ${fdir}. A voz continua sendo src/voz.wav (a do vídeo cortado).`);
}
