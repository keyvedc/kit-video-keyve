#!/usr/bin/env node
// Analisa um vídeo de referência para criar um ESTILO novo: ritmo de cortes, duração média dos planos,
// folha de quadros (1 por corte), paleta dominante e loudness. A IA lê o relatório + a folha e escreve estilos/<nome>/.
//   node ferramentas/analisar-referencia.mjs <referencia.mp4> <pasta-saida> [--limiar 0.3]
import fs from 'node:fs';
import path from 'node:path';
import { pos, opt, die, ff, run, probe, principal } from './lib.mjs';

if (principal(import.meta.url)) {
  const [src, dir] = pos;
  if (!src || !dir) die('uso: node ferramentas/analisar-referencia.mjs <referencia.mp4> <pasta-saida>');
  fs.mkdirSync(dir, { recursive: true });
  const info = await probe(src);
  const lim = +opt('limiar', 0.3);
  const { err } = await run('ffmpeg', ['-hide_banner', '-i', src, '-vf', `select='gt(scene,${lim})',showinfo`, '-an', '-f', 'null', '-']);
  const cortes = [...err.matchAll(/pts_time:([\d.]+)/g)].map((m) => +m[1]);
  const planos = [0, ...cortes, info.duration].slice(1).map((t, i, a) => t - (i ? a[i - 1] : 0));
  const med = planos.reduce((s, x) => s + x, 0) / planos.length;
  // poucos cortes secos (transições suaves): amostra em intervalos regulares
const ts = cortes.length >= 8 ? [0.2, ...cortes.map((c) => c + 0.15)].slice(0, 48) : Array.from({ length: 40 }, (_, i) => +(0.2 + (i * (info.duration - 0.4)) / 39).toFixed(2));
  for (let i = 0; i < ts.length; i++) await ff(['-ss', String(ts[i]), '-i', src, '-frames:v', '1', '-vf', 'scale=270:-2', path.join(dir, `q${String(i).padStart(3, '0')}.jpg`)]);
  const cols = 8, rows = Math.ceil(ts.length / cols);
  await ff(['-framerate', '1', '-i', path.join(dir, 'q%03d.jpg'), '-vf', `pad=iw+6:ih+6:3:3:color=0xd0d3da,tile=${cols}x${rows}`, '-frames:v', '1', path.join(dir, 'quadros.png')]);
  for (const f of fs.readdirSync(dir)) if (/^q\d+\.jpg$/.test(f)) fs.unlinkSync(path.join(dir, f));
  await ff(['-i', src, '-vf', 'fps=1,scale=64:-2,palettegen=max_colors=8:reserve_transparent=0', '-frames:v', '1', path.join(dir, 'paleta.png')]);
  let lufs = null;
  if (info.audio) { const { err: e2 } = await run('ffmpeg', ['-hide_banner', '-i', src, '-af', 'ebur128', '-f', 'null', '-']); const m = e2.match(/I:\s+(-?[\d.]+) LUFS/g); lufs = m ? m[m.length - 1].replace(/I:\s+/, '') : null; }
  const rel = {
    arquivo: path.basename(src), duracao: +info.duration.toFixed(2), formato: info.video ? `${info.video.w}x${info.video.h} @${info.video.fps.toFixed(2)} fps` : null,
    cortes: cortes.length, plano_medio_s: +med.toFixed(2), plano_min_s: +Math.min(...planos).toFixed(2), plano_max_s: +Math.max(...planos).toFixed(2),
    tempos_dos_cortes: cortes.map((c) => +c.toFixed(2)), loudness: lufs,
    observacao: cortes.length < 8 ? 'poucos cortes secos: o ritmo vem de transições suaves (zoom, desfoque, push) ou de grafismos. A folha mostra 40 quadros em intervalos regulares.' : 'folha com 1 quadro por corte',
    leia_tambem: ['quadros.png (1 quadro por corte, linha a linha)', 'paleta.png (8 cores dominantes)'],
  };
  fs.writeFileSync(path.join(dir, 'relatorio.json'), JSON.stringify(rel, null, 1));
  console.log(`✓ ${cortes.length} cortes · plano médio ${med.toFixed(2)} s · ${dir}/relatorio.json, quadros.png, paleta.png`);
}
