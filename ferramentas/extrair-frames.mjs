#!/usr/bin/env node
// Extrai os frames de uma filmagem para a cena (o Chromium do render não decodifica H.264 de forma confiável).
//   node ferramentas/extrair-frames.mjs <video> <videos/slug/src/frames> [--fps 30] [--w 1080 --h 1920]
import { pos, opt, die, extrairFrames, probe, fpsDeTrabalho, principal } from './lib.mjs';
if (principal(import.meta.url)) {
  const [src, pasta] = pos;
  if (!src || !pasta) die('uso: node ferramentas/extrair-frames.mjs <video> <pasta-frames> [--fps 30]');
  const fps = +opt('fps', 0) || fpsDeTrabalho((await probe(src)).video.fps);
  const i = await extrairFrames(src, pasta, { fps, w: +opt('w', 1080), h: +opt('h', 1920) });
  console.log(`✓ ${i.total} frames @${i.fps} fps em ${pasta} (+ info.json)`);
}
