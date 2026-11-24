#!/usr/bin/env node
// Prepara um vídeo falado de ponta a ponta: sincroniza, corta pausas, extrai frames e transcreve.
//   node ferramentas/preparar-falado.mjs <video-da-camera.mp4> videos/<slug> [--audio voz-limpa.wav] [--marca keyve] [--sem-cortes] [--sem-transcricao]
// Resultado em videos/<slug>/: src/frames (+info.json), src/voz.wav, src/video-cortado.mp4, src/edl.json, words.json e scene.html (do modelo).
import fs from 'node:fs';
import path from 'node:path';
import { KIT, pos, opt, die, probe, fpsDeTrabalho, cortarVideo, cortarAudio, extrairFrames, principal } from './lib.mjs';
import { medirOffset } from './sincronizar.mjs';
import { cortarPausas } from './cortar-pausas.mjs';
import { transcrever } from './transcrever.mjs';
import { novoVideo } from './novo-video.mjs';

const [src, vdir] = pos;
if (!principal(import.meta.url)) { /* importado */ } else {
  if (!src || !vdir) die('uso: node ferramentas/preparar-falado.mjs <video.mp4> videos/<slug> [--audio voz-limpa.wav] [--marca keyve]');
  const slug = path.basename(vdir), marca = opt('marca', 'keyve'), audio = opt('audio');
  const t0 = Date.now(), log = (m) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0).padStart(3)} s] ${m}`);
  const dir = novoVideo(slug, { tipo: 'falado', marca });
  const sdir = path.join(dir, 'src');
  fs.mkdirSync(sdir, { recursive: true });
  const info = await probe(src);
  if (!info.video) die('a entrada precisa ser um vídeo');
  const fps = fpsDeTrabalho(info.video.fps);
  log(`fonte: ${info.video.w}x${info.video.h} @${info.video.fps.toFixed(2)} fps, ${info.duration.toFixed(1)} s → trabalho a ${fps} fps`);

  let offset = 0;
  if (audio) {
    const r = await medirOffset(src, audio);
    offset = r.offset;
    log(`sincronia com o áudio limpo: offset ${offset} s (correlação ${r.confianca})${r.confianca < 0.5 ? ' ⚠ baixa — confira se é a mesma gravação' : ''}`);
  }
  let res;
  if (opt('sem-cortes')) {
    const edl = [[0, Math.floor(info.duration * fps) / fps]];
    await cortarVideo(src, edl, path.join(sdir, 'video-cortado.mp4'), { fps });
    await cortarAudio(audio || src, edl, path.join(sdir, 'voz.wav'), { offset });
    fs.writeFileSync(path.join(sdir, 'edl.json'), JSON.stringify({ fonte: path.basename(src), fps, offset, edl }, null, 1));
    res = { duracao: edl[0][1], edl };
    log('sem cortes de pausa (--sem-cortes)');
  } else {
    res = await cortarPausas(src, sdir, { audio, offset });
    log(`pausas cortadas: ${res.edl.length} trechos, ${res.original.toFixed(1)} s → ${res.duracao.toFixed(1)} s`);
  }
  const fi = await extrairFrames(path.join(sdir, 'video-cortado.mp4'), path.join(sdir, 'frames'), { fps });
  log(`${fi.total} frames extraídos`);
  let words = [];
  if (!opt('sem-transcricao')) {
    words = await transcrever(path.join(sdir, 'voz.wav'), path.join(dir, 'words.json'));
    log(`transcrição: ${words.length} palavras`);
  }
  // ajusta o scene.html do modelo à filmagem
  const fimFala = words.length ? words[words.length - 1][1] : res.duracao;
  const DUR = +(Math.min(res.duracao, fimFala + 0.3) + 2.6).toFixed(2), T_FIM = +(fimFala + 0.25).toFixed(2);
  const sc = path.join(dir, 'scene.html');
  fs.writeFileSync(sc, fs.readFileSync(sc, 'utf8')
    .replace(/const DUR = [\d.]+, T_FIM = [\d.]+;/, `const DUR = ${DUR}, T_FIM = ${T_FIM};`)
    .replace('const TEM_VOZ = false;', 'const TEM_VOZ = true;')
    .replace(/fps: \d+(\.\d+)?,/, `fps: ${fps},`));
  console.log(`\n✓ pronto em ${path.relative(KIT, dir)}/  (fala ${fimFala.toFixed(1)} s, vídeo ${DUR} s, ${fps} fps)
  Próximos passos (skill video-falado):
  1. Corrija nomes próprios em words.json (confira com marcas/${marca}/copy.json).
  2. Escreva storyboard.md: frase a frase → layout (CHEIA/CARD/GRÁFICO) e cena.
  3. Ajuste scene.html (janelas CARD_WIN/DARK_WIN/CAP_OFF, moves da filmagem, cenas) e rode --beats.`);
}
